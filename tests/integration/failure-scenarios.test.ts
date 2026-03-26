/**
 * Integration tests exercising failure paths through the SDK.
 * Uses the failing-plugin.ts with FAIL_MODE env var to control which port fails.
 *
 * @req REQ-SDK-007
 */

import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const exec = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FAILING_PLUGIN = path.join(__dirname, "failing-plugin.ts");
const TSX = path.join(__dirname, "../../node_modules/.bin/tsx");

async function runPlugin(
  args: string[],
  failMode: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const result = await exec(TSX, [FAILING_PLUGIN, ...args], {
      timeout: 30000,
      env: { ...process.env, FAIL_MODE: failMode },
    });
    return { stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? "",
      exitCode: e.code ?? 1,
    };
  }
}

function parseEvents(stdout: string): Record<string, unknown>[] {
  return stdout
    .trim()
    .split("\n")
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l));
}

function findResult(events: Record<string, unknown>[]): Record<string, unknown> | undefined {
  return events.find((e) => e.type === "result");
}

// --- Credential failures ---

describe("credential failure", () => {
  it("emits result with success false and stops", async () => {
    const { stdout, exitCode } = await runPlugin(
      ["up", "--input", '{"target_id":"test"}'],
      "credentials",
    );
    expect(exitCode).toBe(2);
    const events = parseEvents(stdout);
    const result = findResult(events);
    expect(result?.success).toBe(false);
    expect(String(result?.error)).toContain("Credentials");

    // No progress events (no API enablement or provisioning)
    expect(events.filter((e) => e.type === "progress")).toHaveLength(0);
  });
});

// --- Access failures ---

describe("access failure", () => {
  it("emits result with success false after credentials pass", async () => {
    const { stdout, exitCode } = await runPlugin(
      ["up", "--input", '{"target_id":"test"}'],
      "access",
    );
    expect(exitCode).toBe(2);
    const events = parseEvents(stdout);
    const result = findResult(events);
    expect(result?.success).toBe(false);
    expect(String(result?.error)).toContain("access");
  });
});

// --- API enablement failures ---

describe("API enablement failure", () => {
  it("reports failed API when enableApi throws", async () => {
    const { stdout, exitCode } = await runPlugin(
      ["up", "--input", '{"target_id":"test"}'],
      "enable_error",
    );
    expect(exitCode).toBe(2);
    const events = parseEvents(stdout);
    const result = findResult(events);
    expect(result?.success).toBe(false);
    expect(String(result?.error)).toContain("test-api.googleapis.com");
  });

  it("reports disabled API when preview checks readiness", async () => {
    const { stdout, exitCode } = await runPlugin(
      ["preview", "--input", '{"target_id":"test"}'],
      "api_disabled",
    );
    expect(exitCode).toBe(2);
    const events = parseEvents(stdout);
    const result = findResult(events);
    expect(result?.success).toBe(false);
    expect(String(result?.error)).toContain("not enabled");
  });
});

// --- Engine failures ---

describe("engine failure", () => {
  it("surfaces engine error during up", async () => {
    const { stdout, exitCode } = await runPlugin(
      ["up", "--input", '{"target_id":"test"}'],
      "engine_error",
    );
    expect(exitCode).toBe(2);
    const events = parseEvents(stdout);
    const result = findResult(events);
    expect(result?.success).toBe(false);
    expect(String(result?.error)).toContain("Pulumi crashed");
  });

  it("surfaces engine error during destroy", async () => {
    const { stdout, exitCode } = await runPlugin(
      ["destroy", "--confirm-destroy", "--input", '{"target_id":"test"}'],
      "engine_error",
    );
    expect(exitCode).toBe(2);
    const events = parseEvents(stdout);
    const result = findResult(events);
    expect(result?.success).toBe(false);
    expect(String(result?.error)).toContain("Pulumi crashed");
  });
});

// --- Health check failures ---

describe("health check failure", () => {
  it("reports failing health check with success false", async () => {
    const { stdout, exitCode } = await runPlugin(
      ["up", "--input", '{"target_id":"test"}'],
      "health_fail",
    );
    expect(exitCode).toBe(0);
    const events = parseEvents(stdout);
    const checks = events.filter((e) => e.type === "check");
    expect(checks).toHaveLength(2);
    expect(checks[1].status).toBe("fail");

    const result = findResult(events);
    expect(result?.success).toBe(false); // aggregation: 1 fail = not healthy
  });

  it("surfaces health checker crash as error", async () => {
    const { stdout, exitCode } = await runPlugin(
      ["up", "--input", '{"target_id":"test"}'],
      "health_error",
    );
    expect(exitCode).toBe(2);
    const events = parseEvents(stdout);
    const result = findResult(events);
    expect(result?.success).toBe(false);
    expect(String(result?.error)).toContain("Health check crashed");
  });
});

// --- Missing outputs ---

describe("manifest-output mismatch", () => {
  it("emits warning when engine returns fewer outputs than declared", async () => {
    const { stdout, exitCode } = await runPlugin(
      ["up", "--input", '{"target_id":"test"}'],
      "missing_outputs",
    );
    // Should succeed (warning, not error) but with diagnostic
    expect(exitCode).toBe(0);
    const events = parseEvents(stdout);
    const warnings = events.filter(
      (e) => e.type === "diagnostic" && e.severity === "warning",
    );
    expect(warnings.some((w) => String(w.message).includes("key_id"))).toBe(true);
  });
});

// --- Output injection attack ---

describe("output injection (Attack 3)", () => {
  it("blocks malicious output values when outputValidation is set", async () => {
    const { stdout, exitCode } = await runPlugin(
      ["up", "--input", '{"target_id":"test"}'],
      "output_injection",
    );
    expect(exitCode).toBe(2);
    const events = parseEvents(stdout);
    const result = findResult(events);
    expect(result?.success).toBe(false);
    expect(String(result?.error)).toContain("Output validation failed");
    expect(String(result?.error)).toContain("endpoint");
    // The malicious value should NOT appear in any result outputs
    const resultWithOutputs = events.find(
      (e) => e.type === "result" && e.outputs,
    );
    if (resultWithOutputs) {
      expect((resultWithOutputs.outputs as Record<string, string>)?.endpoint).not.toBe(
        "attacker-proxy.evil.com",
      );
    }
  });
});
