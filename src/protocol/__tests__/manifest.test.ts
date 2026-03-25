import { describe, it, expect } from "vitest";
import { buildManifest, CONTRACT_VERSION } from "../manifest.js";
import type { PluginConfig } from "../../cli/entrypoint.js";
import type { CspClient, IaCEngine, HealthChecker } from "../../domain/ports.js";

const stubCspClient: CspClient = {
  validateCredentials: async () => true,
  checkAccess: async () => true,
  getApiState: async () => "ENABLED",
  enableApi: async () => {},
};

const stubEngine: IaCEngine = {
  preview: async () => {},
  up: async () => ({}),
  destroy: async () => {},
  getOutputs: async () => undefined,
};

const stubHealthChecker: HealthChecker = {
  checkAll: async () => [],
};

const testConfig: PluginConfig = {
  name: "test-plugin",
  version: "1.0.0",
  description: "A test plugin for unit testing",
  credentials: ["gcp-adc"],
  inputs: [
    { name: "project_id", type: "string", required: true },
    { name: "region", type: "string", default: "us-central1" },
    { name: "impact_level", type: "enum", values: ["IL4", "IL5"], default: "IL4" },
  ],
  outputs: ["vertex_endpoint", "kms_key"],
  cspClient: stubCspClient,
  engine: stubEngine,
  healthChecker: stubHealthChecker,
  requiredApis: ["compute.googleapis.com"],
};

describe("buildManifest", () => {
  const manifest = buildManifest(testConfig);

  it("returns correct plugin name", () => {
    expect(manifest.name).toBe("test-plugin");
  });

  it("returns correct version", () => {
    expect(manifest.version).toBe("1.0.0");
  });

  it("returns aegis-infra/v1 contract", () => {
    expect(manifest.contract).toBe("aegis-infra/v1");
    expect(CONTRACT_VERSION).toBe("aegis-infra/v1");
  });

  it("includes credentials", () => {
    expect(manifest.requires.credentials).toContain("gcp-adc");
  });

  it("includes declared inputs with schema", () => {
    const projectId = manifest.requires.inputs.find((i) => i.name === "project_id");
    expect(projectId).toBeDefined();
    expect(projectId!.required).toBe(true);
    expect(projectId!.type).toBe("string");
  });

  it("includes enum inputs with values", () => {
    const impact = manifest.requires.inputs.find((i) => i.name === "impact_level");
    expect(impact).toBeDefined();
    expect(impact!.type).toBe("enum");
    expect(impact!.values).toEqual(["IL4", "IL5"]);
  });

  it("maps output names to OutputField objects", () => {
    const names = manifest.provides.outputs.map((o) => o.name);
    expect(names).toContain("vertex_endpoint");
    expect(names).toContain("kms_key");
    for (const output of manifest.provides.outputs) {
      expect(output.type).toBe("string");
    }
  });

  it("is JSON-serializable without data loss", () => {
    const json = JSON.stringify(manifest);
    const roundtripped = JSON.parse(json);
    expect(roundtripped).toEqual(manifest);
  });
});
