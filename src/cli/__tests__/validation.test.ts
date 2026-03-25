import { describe, it, expect, vi } from "vitest";
import { validatePluginConfig } from "../validation.js";
import type { PluginConfig } from "../entrypoint.js";

// @req REQ-SDK-007: PluginConfig validation

function validConfig(): PluginConfig {
  return {
    name: "test-plugin",
    version: "0.1.0",
    description: "Test plugin",
    credentials: ["test-cred"],
    inputs: [{ name: "target_id", type: "string", required: true }],
    outputs: ["endpoint"],
    cspClient: {
      validateCredentials: vi.fn(),
      checkAccess: vi.fn(),
      getApiState: vi.fn(),
      enableApi: vi.fn(),
    },
    engine: {
      preview: vi.fn(),
      up: vi.fn(),
      destroy: vi.fn(),
      getOutputs: vi.fn(),
    },
    healthChecker: {
      checkAll: vi.fn(),
    },
    requiredApis: ["test.googleapis.com"],
  };
}

describe("validatePluginConfig", () => {
  it("returns null for a valid config", () => {
    expect(validatePluginConfig(validConfig())).toBeNull();
  });

  it("rejects empty name", () => {
    const config = validConfig();
    config.name = "";
    expect(validatePluginConfig(config)).toContain("name");
  });

  it("rejects missing name", () => {
    const config = validConfig() as unknown as Record<string, unknown>;
    delete config.name;
    expect(validatePluginConfig(config as unknown as PluginConfig)).toContain("name");
  });

  it("rejects empty version", () => {
    const config = validConfig();
    config.version = "";
    expect(validatePluginConfig(config)).toContain("version");
  });

  it("rejects empty description", () => {
    const config = validConfig();
    config.description = "";
    expect(validatePluginConfig(config)).toContain("description");
  });

  it("rejects empty credentials array", () => {
    const config = validConfig();
    config.credentials = [];
    expect(validatePluginConfig(config)).toContain("credentials");
  });

  it("rejects empty outputs array", () => {
    const config = validConfig();
    config.outputs = [];
    expect(validatePluginConfig(config)).toContain("outputs");
  });

  it("rejects null cspClient", () => {
    const config = validConfig();
    (config as unknown as Record<string, unknown>).cspClient = null;
    expect(validatePluginConfig(config)).toContain("cspClient");
  });

  it("rejects cspClient missing validateCredentials", () => {
    const config = validConfig();
    delete (config.cspClient as unknown as Record<string, unknown>).validateCredentials;
    expect(validatePluginConfig(config)).toContain("cspClient.validateCredentials");
  });

  it("rejects null engine", () => {
    const config = validConfig();
    (config as unknown as Record<string, unknown>).engine = null;
    expect(validatePluginConfig(config)).toContain("engine");
  });

  it("rejects engine missing up", () => {
    const config = validConfig();
    delete (config.engine as unknown as Record<string, unknown>).up;
    expect(validatePluginConfig(config)).toContain("engine.up");
  });

  it("rejects null healthChecker", () => {
    const config = validConfig();
    (config as unknown as Record<string, unknown>).healthChecker = null;
    expect(validatePluginConfig(config)).toContain("healthChecker");
  });

  it("accepts empty requiredApis (optional)", () => {
    const config = validConfig();
    config.requiredApis = [];
    expect(validatePluginConfig(config)).toBeNull();
  });

  it("accepts missing requiredApis (optional)", () => {
    const config = validConfig();
    delete (config as unknown as Record<string, unknown>).requiredApis;
    expect(validatePluginConfig(config)).toBeNull();
  });
});
