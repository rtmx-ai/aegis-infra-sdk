import { describe, it, expect, vi } from "vitest";
import { Writable } from "node:stream";
import { enableApis, checkApiReadiness, backoffDelay, pollApiEnabled } from "../state-machine.js";
import type { InitContext } from "../types.js";
import { StdoutEmitter } from "../../protocol/emitter.js";
import type { ProtocolEvent } from "../../protocol/events.js";
import type { CspClient } from "../../domain/ports.js";

// @req REQ-SDK-007: Partial failure handling, backoff, error context

function createCtx(clientOverrides: Partial<CspClient> = {}): {
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

  const defaultClient: CspClient = {
    validateCredentials: vi.fn().mockResolvedValue(true),
    checkAccess: vi.fn().mockResolvedValue(true),
    getApiState: vi.fn().mockResolvedValue("ENABLED"),
    enableApi: vi.fn().mockResolvedValue(undefined),
  };

  return {
    ctx: {
      config: { params: { project_id: "test" } },
      emitter: new StdoutEmitter(stream),
      cspClient: { ...defaultClient, ...clientOverrides },
      requiredApis: ["api-a", "api-b", "api-c"],
      apiPollIntervalMs: 0,
      apiPollTimeoutMs: 100,
    },
    events,
  };
}

// --- backoffDelay ---

describe("backoffDelay", () => {
  it("increases with attempt number", () => {
    // With jitter, we can't check exact values, but trend should increase
    // Run multiple times to average out jitter
    let sum0 = 0,
      sum1 = 0,
      sum2 = 0;
    for (let i = 0; i < 100; i++) {
      sum0 += backoffDelay(0, 1000, 30000);
      sum1 += backoffDelay(1, 1000, 30000);
      sum2 += backoffDelay(2, 1000, 30000);
    }
    expect(sum1 / 100).toBeGreaterThan(sum0 / 100);
    expect(sum2 / 100).toBeGreaterThan(sum1 / 100);
  });

  it("caps at maxMs", () => {
    for (let i = 0; i < 100; i++) {
      const delay = backoffDelay(20, 1000, 5000);
      // With +25% jitter, max is 5000 * 1.25 = 6250
      expect(delay).toBeLessThanOrEqual(6250);
    }
  });

  it("returns positive values", () => {
    for (let i = 0; i < 50; i++) {
      expect(backoffDelay(i, 100, 30000)).toBeGreaterThan(0);
    }
  });
});

// --- enableApis partial failure ---

describe("enableApis partial failure", () => {
  it("continues after enableApi throws on one API", async () => {
    const enableApi = vi.fn().mockImplementation(async (_cfg: unknown, api: string) => {
      if (api === "api-b") throw new Error("permission denied");
    });
    const { ctx, events } = createCtx({
      getApiState: vi.fn().mockResolvedValue("DISABLED"),
      enableApi,
    });

    const result = await enableApis(ctx);
    expect(result).toBe(false);

    // All 3 APIs attempted (enableApi called for a, b, c)
    expect(enableApi).toHaveBeenCalledTimes(3);

    // Diagnostic emitted for api-b failure
    const diagnostics = events.filter(
      (e) => e.type === "diagnostic" && "severity" in e && e.severity === "error",
    );
    expect(diagnostics.length).toBeGreaterThanOrEqual(1);
    expect(
      diagnostics.some(
        (d) => "message" in d && (d as { message: string }).message.includes("api-b"),
      ),
    ).toBe(true);

    // Final result lists failed APIs
    const results = events.filter((e) => e.type === "result");
    expect(results.length).toBeGreaterThanOrEqual(1);
    const lastResult = results[results.length - 1] as { error?: string };
    expect(lastResult.error).toContain("api-b");
  });

  it("succeeds when all APIs enable despite initial getApiState throwing", async () => {
    let checkCount = 0;
    const getApiState = vi.fn().mockImplementation(async () => {
      checkCount++;
      if (checkCount === 1) throw new Error("transient network error");
      return "ENABLED";
    });
    const enableApi = vi.fn().mockResolvedValue(undefined);
    const { ctx } = createCtx({ getApiState, enableApi });

    const result = await enableApis(ctx);
    // api-a: getApiState throws, enableApi called, pollApiEnabled returns true
    // api-b, api-c: getApiState returns ENABLED
    expect(result).toBe(true);
  });
});

// --- checkApiReadiness partial failure ---

describe("checkApiReadiness partial failure", () => {
  it("includes API in disabled list when getApiState throws", async () => {
    const getApiState = vi.fn().mockImplementation(async (_cfg: unknown, api: string) => {
      if (api === "api-b") throw new Error("network error");
      return "ENABLED";
    });
    const { ctx, events } = createCtx({ getApiState });

    const disabled = await checkApiReadiness(ctx);
    expect(disabled).toContain("api-b");
    expect(disabled).toHaveLength(1);

    // Warning diagnostic emitted
    const warnings = events.filter(
      (e) => e.type === "diagnostic" && "severity" in e && e.severity === "warning",
    );
    expect(warnings.length).toBeGreaterThanOrEqual(1);
  });

  it("returns all APIs when all getApiState calls throw", async () => {
    const { ctx } = createCtx({
      getApiState: vi.fn().mockRejectedValue(new Error("all broken")),
    });

    const disabled = await checkApiReadiness(ctx);
    expect(disabled).toHaveLength(3);
  });
});

// --- pollApiEnabled with error resilience ---

describe("pollApiEnabled error resilience", () => {
  it("continues polling when getApiState throws transiently", async () => {
    let callCount = 0;
    const getApiState = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount <= 2) throw new Error("transient");
      return "ENABLED";
    });
    const { ctx } = createCtx({ getApiState });
    ctx.apiPollTimeoutMs = 5000;

    const result = await pollApiEnabled(ctx, "test-api");
    expect(result).toBe(true);
    expect(callCount).toBeGreaterThanOrEqual(3);
  });
});
