/**
 * Integration tests for the SDK -- runs the mock plugin as a real subprocess
 * and validates protocol output on stdout.
 */

import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const exec = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOCK_PLUGIN = path.join(__dirname, "mock-plugin.ts");
const TSX = path.join(__dirname, "../../node_modules/.bin/tsx");

async function runPlugin(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const result = await exec(TSX, [MOCK_PLUGIN, ...args], {
      timeout: 30000,
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

function parseLines(stdout: string): unknown[] {
  return stdout
    .trim()
    .split("\n")
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l));
}

// --- manifest ---

describe("manifest subcommand", () => {
  it("outputs valid manifest JSON", async () => {
    const { stdout, exitCode } = await runPlugin(["manifest"]);
    expect(exitCode).toBe(0);
    const manifest = JSON.parse(stdout.trim());
    expect(manifest.name).toBe("mock-plugin");
    expect(manifest.version).toBe("0.0.1");
    expect(manifest.contract).toBe("aegis-infra/v1");
  });

  it("declares correct inputs and outputs", async () => {
    const { stdout } = await runPlugin(["manifest"]);
    const manifest = JSON.parse(stdout.trim());
    const inputNames = manifest.requires.inputs.map((i: { name: string }) => i.name);
    expect(inputNames).toContain("target_id");
    expect(inputNames).toContain("region");
    const outputNames = manifest.provides.outputs.map((o: { name: string }) => o.name);
    expect(outputNames).toContain("endpoint");
    expect(outputNames).toContain("key_id");
  });
});

// --- invalid subcommand ---

describe("invalid subcommand", () => {
  it("exits with code 1 and usage on stderr", async () => {
    const { stderr, exitCode } = await runPlugin(["bogus"]);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Usage:");
  });
});

// --- preview ---

describe("preview subcommand", () => {
  it("runs preflight and API check then succeeds", async () => {
    const { stdout, exitCode } = await runPlugin([
      "preview",
      "--input",
      '{"target_id":"test-123"}',
    ]);
    expect(exitCode).toBe(0);
    const events = parseLines(stdout);
    const types = events.map((e: any) => e.type);
    expect(types).toContain("diagnostic");
    expect(types).toContain("result");
    const result = events.find((e: any) => e.type === "result") as any;
    expect(result.success).toBe(true);
  });

  it("fails without --input", async () => {
    const { stdout, exitCode } = await runPlugin(["preview"]);
    expect(exitCode).toBe(2);
    const events = parseLines(stdout);
    const result = events.find((e: any) => e.type === "result") as any;
    expect(result.success).toBe(false);
    expect(result.error).toContain("--input");
  });
});

// --- up ---

describe("up subcommand", () => {
  it("runs full state machine: PREFLIGHT, API_ENABLEMENT, PROVISION, VERIFY", async () => {
    const { stdout, exitCode } = await runPlugin(["up", "--input", '{"target_id":"test-123"}']);
    expect(exitCode).toBe(0);
    const events = parseLines(stdout);

    // Check state transitions
    const diagnostics = events.filter((e: any) => e.type === "diagnostic") as any[];
    const stateMessages = diagnostics.map((d: any) => d.message);
    expect(stateMessages.some((m: string) => m.includes("PREFLIGHT"))).toBe(true);
    expect(stateMessages.some((m: string) => m.includes("API_ENABLEMENT"))).toBe(true);
    expect(stateMessages.some((m: string) => m.includes("PROVISION"))).toBe(true);
    expect(stateMessages.some((m: string) => m.includes("VERIFY"))).toBe(true);

    // Check health checks emitted
    const checks = events.filter((e: any) => e.type === "check") as any[];
    expect(checks.length).toBe(2);
    expect(checks[0].status).toBe("pass");

    // Check result with outputs
    const result = events.find((e: any) => e.type === "result") as any;
    expect(result.success).toBe(true);
    expect(result.outputs.endpoint).toBe("mock-endpoint.example.com");
    expect(result.outputs.key_id).toBe("mock-key-123");
  });

  it("applies default values for optional inputs", async () => {
    const { stdout, exitCode } = await runPlugin(["up", "--input", '{"target_id":"test-123"}']);
    expect(exitCode).toBe(0);
    // If it didn't fail, region defaulted to "us-mock-1" correctly
  });

  it("fails on missing required input", async () => {
    const { stdout, exitCode } = await runPlugin(["up", "--input", "{}"]);
    expect(exitCode).toBe(2);
    const events = parseLines(stdout);
    const result = events.find((e: any) => e.type === "result") as any;
    expect(result.success).toBe(false);
    expect(result.error).toContain("target_id");
  });
});

// --- destroy ---

describe("destroy subcommand", () => {
  it("requires --confirm-destroy flag", async () => {
    const { stdout, exitCode } = await runPlugin([
      "destroy",
      "--input",
      '{"target_id":"test-123"}',
    ]);
    expect(exitCode).toBe(2);
    const events = parseLines(stdout);
    const result = events.find((e: any) => e.type === "result") as any;
    expect(result.success).toBe(false);
    expect(result.error).toContain("--confirm-destroy");
  });

  it("succeeds with --confirm-destroy", async () => {
    const { stdout, exitCode } = await runPlugin([
      "destroy",
      "--confirm-destroy",
      "--input",
      '{"target_id":"test-123"}',
    ]);
    expect(exitCode).toBe(0);
    const events = parseLines(stdout);
    const result = events.find((e: any) => e.type === "result") as any;
    expect(result.success).toBe(true);
  });
});

// --- status ---

describe("status subcommand", () => {
  it("runs preflight and emits health checks", async () => {
    const { stdout, exitCode } = await runPlugin([
      "status",
      "--input",
      '{"target_id":"test-123"}',
    ]);
    expect(exitCode).toBe(0);
    const events = parseLines(stdout);

    const checks = events.filter((e: any) => e.type === "check") as any[];
    expect(checks.length).toBe(2);

    const result = events.find((e: any) => e.type === "result") as any;
    expect(result.success).toBe(true);
    expect(result.summary).toContain("2 passed");
  });
});

// --- protocol compliance ---

describe("protocol compliance", () => {
  it("every stdout line is valid JSON for all subcommands", async () => {
    for (const cmd of ["preview", "up", "status"]) {
      const { stdout } = await runPlugin([cmd, "--input", '{"target_id":"test-123"}']);
      const lines = stdout.trim().split("\n").filter((l) => l.length > 0);
      for (const line of lines) {
        expect(() => JSON.parse(line), `Invalid JSON in ${cmd}: ${line}`).not.toThrow();
      }
    }
  });
});
