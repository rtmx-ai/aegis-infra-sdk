import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { CspClient, IaCEngine, HealthChecker } from "../../domain/ports.js";
import type { PluginConfig } from "../entrypoint.js";
import { createPluginCli } from "../entrypoint.js";

/** Capture stdout writes for assertion. */
function captureStdout() {
  const chunks: string[] = [];
  const original = process.stdout.write;
  process.stdout.write = ((chunk: string | Uint8Array) => {
    chunks.push(typeof chunk === "string" ? chunk : chunk.toString());
    return true;
  }) as typeof process.stdout.write;
  return {
    lines: () =>
      chunks
        .join("")
        .split("\n")
        .filter((l) => l.length > 0),
    restore: () => {
      process.stdout.write = original;
    },
  };
}

function createMocks() {
  const cspClient: CspClient = {
    validateCredentials: vi.fn().mockResolvedValue(true),
    checkAccess: vi.fn().mockResolvedValue(true),
    getApiState: vi.fn().mockResolvedValue("ENABLED"),
    enableApi: vi.fn().mockResolvedValue(undefined),
  };

  const engine: IaCEngine = {
    preview: vi.fn().mockResolvedValue(undefined),
    up: vi.fn().mockResolvedValue({ endpoint: "https://example.com" }),
    destroy: vi.fn().mockResolvedValue(undefined),
    getOutputs: vi.fn().mockResolvedValue({ endpoint: "https://example.com" }),
  };

  const healthChecker: HealthChecker = {
    checkAll: vi
      .fn()
      .mockResolvedValue([{ name: "endpoint_reachable", status: "pass", detail: "OK" }]),
  };

  return { cspClient, engine, healthChecker };
}

function buildPluginConfig(mocks: ReturnType<typeof createMocks>): PluginConfig {
  return {
    name: "test-plugin",
    version: "0.1.0",
    description: "Test plugin",
    credentials: ["test-cred"],
    inputs: [{ name: "project_id", type: "string", required: true }],
    outputs: ["endpoint"],
    cspClient: mocks.cspClient,
    engine: mocks.engine,
    healthChecker: mocks.healthChecker,
    requiredApis: ["compute.googleapis.com"],
    apiPollIntervalMs: 0,
    apiPollTimeoutMs: 100,
  };
}

describe("createPluginCli", () => {
  let originalArgv: string[];
  let originalExitCode: typeof process.exitCode;

  beforeEach(() => {
    originalArgv = process.argv;
    originalExitCode = process.exitCode;
    process.exitCode = undefined;
  });

  afterEach(() => {
    process.argv = originalArgv;
    process.exitCode = originalExitCode;
  });

  it("emits manifest JSON for 'manifest' subcommand", async () => {
    process.argv = ["node", "test-plugin", "manifest"];
    const mocks = createMocks();
    const config = buildPluginConfig(mocks);
    const capture = captureStdout();

    try {
      await createPluginCli(config);
      const lines = capture.lines();
      expect(lines.length).toBeGreaterThanOrEqual(1);
      const manifest = JSON.parse(lines[0]);
      expect(manifest.name).toBe("test-plugin");
      expect(manifest.contract).toBe("aegis-infra/v1");
    } finally {
      capture.restore();
    }
  });

  it("runs preview subcommand through preflight and engine", async () => {
    process.argv = ["node", "test-plugin", "preview", "--input", '{"project_id":"my-proj"}'];
    const mocks = createMocks();
    const config = buildPluginConfig(mocks);
    const capture = captureStdout();

    try {
      await createPluginCli(config);
      expect(mocks.engine.preview).toHaveBeenCalled();
      const lines = capture.lines();
      const resultLine = lines.find((l) => {
        const parsed = JSON.parse(l);
        return parsed.type === "result";
      });
      expect(resultLine).toBeDefined();
      expect(JSON.parse(resultLine!).success).toBe(true);
    } finally {
      capture.restore();
    }
  });

  it("runs up subcommand through full lifecycle", async () => {
    process.argv = ["node", "test-plugin", "up", "--input", '{"project_id":"my-proj"}'];
    const mocks = createMocks();
    const config = buildPluginConfig(mocks);
    const capture = captureStdout();

    try {
      await createPluginCli(config);
      expect(mocks.engine.up).toHaveBeenCalled();
      expect(mocks.healthChecker.checkAll).toHaveBeenCalled();
      const lines = capture.lines();
      const resultLine = lines.find((l) => {
        const parsed = JSON.parse(l);
        return parsed.type === "result";
      });
      expect(resultLine).toBeDefined();
      const result = JSON.parse(resultLine!);
      expect(result.success).toBe(true);
      expect(result.outputs).toBeDefined();
    } finally {
      capture.restore();
    }
  });

  it("requires --confirm-destroy for destroy subcommand", async () => {
    process.argv = ["node", "test-plugin", "destroy", "--input", '{"project_id":"my-proj"}'];
    const mocks = createMocks();
    const config = buildPluginConfig(mocks);
    const capture = captureStdout();

    try {
      await createPluginCli(config);
      expect(mocks.engine.destroy).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(2);
      const lines = capture.lines();
      const resultLine = lines.find((l) => {
        const parsed = JSON.parse(l);
        return parsed.type === "result";
      });
      expect(JSON.parse(resultLine!).success).toBe(false);
    } finally {
      capture.restore();
    }
  });

  it("runs destroy when --confirm-destroy is present", async () => {
    process.argv = [
      "node",
      "test-plugin",
      "destroy",
      "--input",
      '{"project_id":"my-proj"}',
      "--confirm-destroy",
    ];
    const mocks = createMocks();
    const config = buildPluginConfig(mocks);
    const capture = captureStdout();

    try {
      await createPluginCli(config);
      expect(mocks.engine.destroy).toHaveBeenCalled();
    } finally {
      capture.restore();
    }
  });

  it("runs status subcommand with health checks", async () => {
    process.argv = ["node", "test-plugin", "status", "--input", '{"project_id":"my-proj"}'];
    const mocks = createMocks();
    const config = buildPluginConfig(mocks);
    const capture = captureStdout();

    try {
      await createPluginCli(config);
      expect(mocks.engine.getOutputs).toHaveBeenCalled();
      expect(mocks.healthChecker.checkAll).toHaveBeenCalled();
      const lines = capture.lines();
      const checkLine = lines.find((l) => JSON.parse(l).type === "check");
      expect(checkLine).toBeDefined();
    } finally {
      capture.restore();
    }
  });

  it("sets exitCode 1 for unknown subcommand", async () => {
    process.argv = ["node", "test-plugin", "unknown"];
    const mocks = createMocks();
    const config = buildPluginConfig(mocks);

    // Capture stderr to prevent noise
    const stderrWrite = process.stderr.write;
    process.stderr.write = (() => true) as typeof process.stderr.write;
    try {
      await createPluginCli(config);
      expect(process.exitCode).toBe(1);
    } finally {
      process.stderr.write = stderrWrite;
    }
  });

  it("catches engine errors and emits result with error", async () => {
    process.argv = ["node", "test-plugin", "up", "--input", '{"project_id":"my-proj"}'];
    const mocks = createMocks();
    (mocks.engine.up as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Pulumi exploded"));
    const config = buildPluginConfig(mocks);
    const capture = captureStdout();

    try {
      await createPluginCli(config);
      expect(process.exitCode).toBe(2);
      const lines = capture.lines();
      const resultLine = lines.find((l) => {
        const parsed = JSON.parse(l);
        return parsed.type === "result" && parsed.error;
      });
      expect(resultLine).toBeDefined();
      expect(JSON.parse(resultLine!).error).toContain("Pulumi exploded");
    } finally {
      capture.restore();
    }
  });
});
