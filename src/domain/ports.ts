/**
 * Port interfaces (hexagonal architecture).
 * Domain defines these; plugin implementations fill them.
 */

import type { InfraConfig, BoundaryOutput, HealthCheck } from "./types.js";
import type { ProtocolEvent } from "../protocol/events.js";

/** Emits protocol events to the transport (stdout in production). */
export interface EventEmitter {
  emit(event: ProtocolEvent): void;
}

/** Cloud service provider API client for preflight and API enablement. */
export interface CspClient {
  /** Validate credentials (e.g., ADC token fetch). Returns true if valid. */
  validateCredentials(): Promise<boolean>;

  /** Check if the caller can access the target resource/project. */
  checkAccess(config: InfraConfig): Promise<boolean>;

  /** Get the enablement state of a single API/service. */
  getApiState(config: InfraConfig, api: string): Promise<"ENABLED" | "DISABLED">;

  /** Enable a single API/service. Returns once the enable request is accepted. */
  enableApi(config: InfraConfig, api: string): Promise<void>;
}

/** Provisions and manages cloud infrastructure. */
export interface IaCEngine {
  preview(config: InfraConfig): Promise<void>;
  up(config: InfraConfig): Promise<BoundaryOutput>;
  destroy(config: InfraConfig): Promise<void>;
  getOutputs(config: InfraConfig): Promise<BoundaryOutput | undefined>;
}

/** Checks boundary health using actual provisioned resource state. */
export interface HealthChecker {
  checkAll(config: InfraConfig, outputs?: BoundaryOutput): Promise<HealthCheck[]>;
}
