import { describe, it, expect, vi } from "vitest";
import { Writable } from "node:stream";
import type { CspClient } from "../../domain/ports.js";
import {
  runPreflight,
  enableApis,
  pollApiEnabled,
  checkApiReadiness,
  isRetryableError,
} from "../state-machine.js";
import type { InitContext } from "../types.js";
import { StdoutEmitter } from "../../protocol/emitter.js";
import type { ProtocolEvent } from "../../protocol/events.js";

const REQUIRED_APIS = ["compute.googleapis.com", "cloudkms.googleapis.com"];

/** Capture emitted events for assertions. */
function createTestContext(clientOverrides: Partial<CspClient> = {}): {
  ctx: InitContext;
  events: ProtocolEvent[];
} {
  const events: ProtocolEvent[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      events.push(JSON.parse(chunk.toString().trim()));
      callback();
    },
  });
  const emitter = new StdoutEmitter(stream);

  const defaultClient: CspClient = {
    getApiState: vi.fn().mockResolvedValue("ENABLED"),
    enableApi: vi.fn().mockResolvedValue(undefined),
    validateCredentials: vi.fn().mockResolvedValue(true),
    checkAccess: vi.fn().mockResolvedValue(true),
  };

  const client = { ...defaultClient, ...clientOverrides };

  const ctx: InitContext = {
    config: { params: { project_id: "test-project", region: "us-central1" } },
    emitter,
    cspClient: client,
    requiredApis: REQUIRED_APIS,
    apiPollIntervalMs: 0,
    apiPollTimeoutMs: 100,
  };

  return { ctx, events };
}

// --- runPreflight ---

describe("runPreflight", () => {
  it("passes when credentials and access are valid", async () => {
    const { ctx, events } = createTestContext();
    const result = await runPreflight(ctx);
    expect(result).toBe(true);
    expect(
      events.some(
        (e) => e.type === "diagnostic" && "message" in e && e.message.includes("PREFLIGHT"),
      ),
    ).toBe(true);
  });

  it("fails when credentials are invalid", async () => {
    const { ctx, events } = createTestContext({
      validateCredentials: vi.fn().mockResolvedValue(false),
    });
    const result = await runPreflight(ctx);
    expect(result).toBe(false);
    expect(events.some((e) => e.type === "result" && !e.success)).toBe(true);
  });

  it("fails when access check fails", async () => {
    const { ctx } = createTestContext({
      checkAccess: vi.fn().mockResolvedValue(false),
    });
    const result = await runPreflight(ctx);
    expect(result).toBe(false);
  });

  it("fails when credentials throw an error", async () => {
    const { ctx } = createTestContext({
      validateCredentials: vi.fn().mockRejectedValue(new Error("network error")),
    });
    const result = await runPreflight(ctx);
    expect(result).toBe(false);
  });
});

// --- pollApiEnabled ---

describe("pollApiEnabled", () => {
  it("returns immediately when API is already enabled", async () => {
    const getApiState = vi.fn().mockResolvedValue("ENABLED");
    const { ctx } = createTestContext({ getApiState });
    const result = await pollApiEnabled(ctx, "compute.googleapis.com");
    expect(result).toBe(true);
    expect(getApiState).toHaveBeenCalledTimes(1);
  });

  it("polls until API becomes enabled", async () => {
    let callCount = 0;
    const getApiState = vi.fn().mockImplementation(async () => {
      callCount++;
      return callCount >= 3 ? "ENABLED" : "DISABLED";
    });
    const { ctx } = createTestContext({ getApiState });
    ctx.apiPollTimeoutMs = 5000;
    const result = await pollApiEnabled(ctx, "cloudkms.googleapis.com");
    expect(result).toBe(true);
    expect(callCount).toBeGreaterThanOrEqual(3);
  });

  it("returns false on timeout", async () => {
    const getApiState = vi.fn().mockResolvedValue("DISABLED");
    const { ctx } = createTestContext({ getApiState });
    ctx.apiPollTimeoutMs = 50;
    ctx.apiPollIntervalMs = 10;
    const result = await pollApiEnabled(ctx, "compute.googleapis.com");
    expect(result).toBe(false);
  });
});

// --- enableApis ---

describe("enableApis", () => {
  it("skips APIs that are already enabled", async () => {
    const enableApi = vi.fn();
    const { ctx, events } = createTestContext({
      getApiState: vi.fn().mockResolvedValue("ENABLED"),
      enableApi,
    });
    const result = await enableApis(ctx);
    expect(result).toBe(true);
    expect(enableApi).not.toHaveBeenCalled();
    const progressEvents = events.filter((e) => e.type === "progress");
    expect(progressEvents.length).toBe(REQUIRED_APIS.length);
  });

  it("enables APIs that are disabled then polls until active", async () => {
    let enabled = false;
    const getApiState = vi.fn().mockImplementation(async () => {
      return enabled ? "ENABLED" : "DISABLED";
    });
    const enableApi = vi.fn().mockImplementation(async () => {
      enabled = true;
    });
    const { ctx } = createTestContext({ getApiState, enableApi });
    ctx.apiPollTimeoutMs = 5000;
    const result = await enableApis(ctx);
    expect(result).toBe(true);
    expect(enableApi).toHaveBeenCalled();
  });

  it("returns false if any API fails to enable within timeout", async () => {
    const getApiState = vi.fn().mockResolvedValue("DISABLED");
    const enableApi = vi.fn().mockResolvedValue(undefined);
    const { ctx } = createTestContext({ getApiState, enableApi });
    ctx.apiPollTimeoutMs = 50;
    ctx.apiPollIntervalMs = 10;
    const result = await enableApis(ctx);
    expect(result).toBe(false);
  });

  it("emits diagnostic event indicating API_ENABLEMENT state", async () => {
    const { ctx, events } = createTestContext();
    await enableApis(ctx);
    expect(
      events.some(
        (e) => e.type === "diagnostic" && "message" in e && e.message.includes("API_ENABLEMENT"),
      ),
    ).toBe(true);
  });
});

// --- checkApiReadiness ---

describe("checkApiReadiness", () => {
  it("returns empty array when all APIs are enabled", async () => {
    const { ctx } = createTestContext({
      getApiState: vi.fn().mockResolvedValue("ENABLED"),
    });
    const disabled = await checkApiReadiness(ctx);
    expect(disabled).toEqual([]);
  });

  it("returns disabled API names", async () => {
    const { ctx } = createTestContext({
      getApiState: vi.fn().mockResolvedValue("DISABLED"),
    });
    const disabled = await checkApiReadiness(ctx);
    expect(disabled).toEqual(REQUIRED_APIS);
  });
});

// --- isRetryableError ---

describe("isRetryableError", () => {
  it("returns true for 403 API not enabled errors", () => {
    expect(isRetryableError(new Error("googleapi: Error 403: API has not been used"))).toBe(true);
  });

  it("returns true for SERVICE_DISABLED errors", () => {
    expect(isRetryableError(new Error("SERVICE_DISABLED"))).toBe(true);
  });

  it("returns false for genuine permission denied", () => {
    expect(isRetryableError(new Error("caller does not have permission"))).toBe(false);
  });

  it("returns false for unrelated errors", () => {
    expect(isRetryableError(new Error("network timeout"))).toBe(false);
  });
});
