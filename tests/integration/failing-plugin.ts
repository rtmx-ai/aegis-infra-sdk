#!/usr/bin/env node

/**
 * Plugin with configurable failure modes for integration testing.
 * The FAIL_MODE env var controls which port fails.
 */

import { createPluginCli } from "../../src/index.js";
import type { CspClient, IaCEngine, HealthChecker } from "../../src/index.js";
import type { InfraConfig, BoundaryOutput, HealthCheck } from "../../src/index.js";

const FAIL_MODE = process.env["FAIL_MODE"] ?? "none";

const cspClient: CspClient = {
  async validateCredentials(): Promise<boolean> {
    if (FAIL_MODE === "credentials") return false;
    return true;
  },
  async checkAccess(_config: InfraConfig): Promise<boolean> {
    if (FAIL_MODE === "access") return false;
    return true;
  },
  async getApiState(_config: InfraConfig, _api: string): Promise<"ENABLED" | "DISABLED"> {
    if (FAIL_MODE === "api_disabled") return "DISABLED";
    if (FAIL_MODE === "api_error") throw new Error("API check network error");
    if (FAIL_MODE === "enable_error") return "DISABLED"; // Force enablement attempt
    return "ENABLED";
  },
  async enableApi(_config: InfraConfig, api: string): Promise<void> {
    if (FAIL_MODE === "enable_error") throw new Error(`Enable failed for ${api}`);
  },
};

const engine: IaCEngine = {
  async preview(_config: InfraConfig): Promise<void> {
    if (FAIL_MODE === "engine_error") throw new Error("Pulumi crashed");
  },
  async up(_config: InfraConfig): Promise<BoundaryOutput> {
    if (FAIL_MODE === "engine_error") throw new Error("Pulumi crashed during up");
    if (FAIL_MODE === "missing_outputs") return { endpoint: "test.example.com" }; // missing key_id
    if (FAIL_MODE === "output_injection") return { endpoint: "attacker-proxy.evil.com", key_id: "key-123" };
    return { endpoint: "test.example.com", key_id: "key-123" };
  },
  async destroy(_config: InfraConfig): Promise<void> {
    if (FAIL_MODE === "engine_error") throw new Error("Pulumi crashed during destroy");
  },
  async getOutputs(_config: InfraConfig): Promise<BoundaryOutput | undefined> {
    return { endpoint: "test.example.com", key_id: "key-123" };
  },
};

const healthChecker: HealthChecker = {
  async checkAll(_config: InfraConfig, _outputs?: BoundaryOutput): Promise<HealthCheck[]> {
    if (FAIL_MODE === "health_fail") {
      return [
        { name: "check_a", status: "pass", detail: "ok" },
        { name: "check_b", status: "fail", detail: "KMS key disabled" },
      ];
    }
    if (FAIL_MODE === "health_warn") {
      return [
        { name: "check_a", status: "pass", detail: "ok" },
        { name: "check_b", status: "warn", detail: "Insufficient permissions: 403" },
      ];
    }
    if (FAIL_MODE === "health_error") throw new Error("Health check crashed");
    return [
      { name: "check_a", status: "pass", detail: "ok" },
      { name: "check_b", status: "pass", detail: "ok" },
    ];
  },
};

createPluginCli({
  name: "failing-plugin",
  version: "0.0.1",
  description: "Plugin with configurable failures",
  credentials: ["test-cred"],
  inputs: [{ name: "target_id", type: "string", required: true }],
  outputs: ["endpoint", "key_id"],
  cspClient,
  engine,
  healthChecker,
  requiredApis: ["test-api.googleapis.com"],
  outputValidation:
    FAIL_MODE === "output_injection"
      ? { endpoint: /^test\.example\.com$/ }
      : undefined,
});
