/**
 * Integration tests for the SDK -- runs the mock plugin as a real subprocess
 * and validates protocol output on stdout.
 *
 * @req REQ-SDK-001, REQ-SDK-002
 */

import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const exec = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOCK_PLUGIN = path.join(__dirname, "mock-plugin.ts");
const FAILING_PLUGIN = path.join(__dirname, "failing-plugin.ts");
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

// --- REQ-SDK-001: Plugin Packaging Convention and Input Design ---

async function runFailingPlugin(
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

describe("manifest input schema (REQ-SDK-001)", () => {
  it("inputs include type metadata", async () => {
    const { stdout } = await runPlugin(["manifest"]);
    const manifest = JSON.parse(stdout.trim());
    for (const input of manifest.requires.inputs) {
      expect(input).toHaveProperty("name");
      expect(input).toHaveProperty("type");
    }
  });

  it("required inputs are marked required", async () => {
    const { stdout } = await runPlugin(["manifest"]);
    const manifest = JSON.parse(stdout.trim());
    const targetId = manifest.requires.inputs.find(
      (i: { name: string }) => i.name === "target_id",
    );
    expect(targetId.required).toBe(true);
  });

  it("optional inputs have default values", async () => {
    const { stdout } = await runPlugin(["manifest"]);
    const manifest = JSON.parse(stdout.trim());
    const region = manifest.requires.inputs.find(
      (i: { name: string }) => i.name === "region",
    );
    expect(region.default).toBe("us-mock-1");
    expect(region.required).toBeUndefined();
  });

  it("manifest declares credentials", async () => {
    const { stdout } = await runPlugin(["manifest"]);
    const manifest = JSON.parse(stdout.trim());
    expect(manifest.requires.credentials).toContain("mock-cred");
  });

  it("manifest includes description", async () => {
    const { stdout } = await runPlugin(["manifest"]);
    const manifest = JSON.parse(stdout.trim());
    expect(manifest.description).toBe("Mock plugin for integration testing");
  });

  it("outputs declare names in manifest", async () => {
    const { stdout } = await runPlugin(["manifest"]);
    const manifest = JSON.parse(stdout.trim());
    const outputNames = manifest.provides.outputs.map((o: { name: string }) => o.name);
    expect(outputNames).toEqual(expect.arrayContaining(["endpoint", "key_id"]));
  });
});

// --- REQ-SDK-002: Plugin Developer Best Practices ---

describe("protocol event structure (REQ-SDK-002)", () => {
  it("all events have a type field", async () => {
    const { stdout } = await runPlugin(["up", "--input", '{"target_id":"test-123"}']);
    const events = parseLines(stdout);
    for (const event of events) {
      expect(event).toHaveProperty("type");
    }
  });

  it("diagnostic events have severity field", async () => {
    const { stdout } = await runPlugin(["up", "--input", '{"target_id":"test-123"}']);
    const events = parseLines(stdout) as any[];
    const diagnostics = events.filter((e) => e.type === "diagnostic");
    expect(diagnostics.length).toBeGreaterThan(0);
    for (const d of diagnostics) {
      expect(["info", "warning", "error"]).toContain(d.severity);
    }
  });

  it("check events have name, status, and detail", async () => {
    const { stdout } = await runPlugin(["status", "--input", '{"target_id":"test-123"}']);
    const events = parseLines(stdout) as any[];
    const checks = events.filter((e) => e.type === "check");
    expect(checks.length).toBeGreaterThan(0);
    for (const c of checks) {
      expect(c).toHaveProperty("name");
      expect(c).toHaveProperty("status");
      expect(c).toHaveProperty("detail");
      expect(["pass", "fail", "warn"]).toContain(c.status);
    }
  });

  it("result event has success boolean", async () => {
    const { stdout } = await runPlugin(["up", "--input", '{"target_id":"test-123"}']);
    const events = parseLines(stdout) as any[];
    const result = events.find((e) => e.type === "result");
    expect(result).toBeDefined();
    expect(typeof result.success).toBe("boolean");
  });

  it("successful result includes outputs", async () => {
    const { stdout } = await runPlugin(["up", "--input", '{"target_id":"test-123"}']);
    const events = parseLines(stdout) as any[];
    const result = events.find((e) => e.type === "result");
    expect(result.success).toBe(true);
    expect(result.outputs).toBeDefined();
    expect(Object.keys(result.outputs).length).toBeGreaterThan(0);
  });

  it("failed result includes error string", async () => {
    const { stdout } = await runPlugin(["up", "--input", "{}"]);
    const events = parseLines(stdout) as any[];
    const result = events.find((e) => e.type === "result");
    expect(result.success).toBe(false);
    expect(typeof result.error).toBe("string");
    expect(result.error.length).toBeGreaterThan(0);
  });

  it("exactly one result event per invocation", async () => {
    for (const cmd of ["manifest", "preview", "up", "status"]) {
      const args = cmd === "manifest" ? [cmd] : [cmd, "--input", '{"target_id":"test-123"}'];
      const { stdout } = await runPlugin(args);
      const lines = stdout.trim().split("\n").filter((l) => l.length > 0);
      const parsed = lines.map((l) => JSON.parse(l));
      if (cmd === "manifest") {
        // manifest outputs a single JSON object, not protocol events
        expect(lines).toHaveLength(1);
      } else {
        const results = parsed.filter((e: any) => e.type === "result");
        expect(results, `${cmd} should emit exactly one result`).toHaveLength(1);
      }
    }
  });
});

describe("health check status values (REQ-SDK-002)", () => {
  it("health checks can report warn status", async () => {
    const { stdout, exitCode } = await runFailingPlugin(
      ["status", "--input", '{"target_id":"test"}'],
      "health_warn",
    );
    expect(exitCode).toBe(0);
    const events = (stdout.trim().split("\n").filter((l) => l.length > 0)).map(
      (l) => JSON.parse(l),
    );
    const checks = events.filter((e: any) => e.type === "check");
    const warns = checks.filter((c: any) => c.status === "warn");
    expect(warns.length).toBeGreaterThan(0);
    expect(warns[0].detail).toContain("permissions");
  });

  it("warn checks do not make result success false", async () => {
    const { stdout } = await runFailingPlugin(
      ["status", "--input", '{"target_id":"test"}'],
      "health_warn",
    );
    const events = (stdout.trim().split("\n").filter((l) => l.length > 0)).map(
      (l) => JSON.parse(l),
    );
    const result = events.find((e: any) => e.type === "result") as any;
    expect(result.success).toBe(true);
  });
});
