#!/usr/bin/env node

/**
 * Mock plugin that uses createPluginCli with in-memory implementations.
 * Used by integration tests to verify the SDK works end-to-end as a real subprocess.
 */

import { createPluginCli } from "../../src/index.js";
import type { CspClient, IaCEngine, HealthChecker } from "../../src/index.js";
import type { InfraConfig, BoundaryOutput, HealthCheck } from "../../src/index.js";

const mockCspClient: CspClient = {
  async validateCredentials(): Promise<boolean> {
    return true;
  },
  async checkAccess(_config: InfraConfig): Promise<boolean> {
    return true;
  },
  async getApiState(_config: InfraConfig, _api: string): Promise<"ENABLED" | "DISABLED"> {
    return "ENABLED";
  },
  async enableApi(_config: InfraConfig, _api: string): Promise<void> {
    // no-op
  },
};

let provisioned = false;
const storedOutputs: BoundaryOutput = {
  endpoint: "mock-endpoint.example.com",
  key_id: "mock-key-123",
};

const mockEngine: IaCEngine = {
  async preview(_config: InfraConfig): Promise<void> {
    // no-op, preview produces no outputs
  },
  async up(_config: InfraConfig): Promise<BoundaryOutput> {
    provisioned = true;
    return storedOutputs;
  },
  async destroy(_config: InfraConfig): Promise<void> {
    provisioned = false;
  },
  async getOutputs(_config: InfraConfig): Promise<BoundaryOutput | undefined> {
    return provisioned ? storedOutputs : undefined;
  },
};

const mockHealthChecker: HealthChecker = {
  async checkAll(_config: InfraConfig, _outputs?: BoundaryOutput): Promise<HealthCheck[]> {
    return [
      { name: "mock_check_1", status: "pass", detail: "All good" },
      { name: "mock_check_2", status: "pass", detail: "All good" },
    ];
  },
};

createPluginCli({
  name: "mock-plugin",
  version: "0.0.1",
  description: "Mock plugin for integration testing",
  credentials: ["mock-cred"],
  inputs: [
    { name: "target_id", type: "string", required: true },
    { name: "region", type: "string", default: "us-mock-1" },
  ],
  outputs: ["endpoint", "key_id"],
  cspClient: mockCspClient,
  engine: mockEngine,
  healthChecker: mockHealthChecker,
  requiredApis: ["mock-api.googleapis.com"],
});
