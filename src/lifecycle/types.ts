/**
 * Types for the initialization lifecycle state machine.
 */

import type { InfraConfig } from "../domain/types.js";
import type { EventEmitter, CspClient } from "../domain/ports.js";

export enum InitState {
  PREFLIGHT = "PREFLIGHT",
  API_ENABLEMENT = "API_ENABLEMENT",
  PROVISION = "PROVISION",
  VERIFY = "VERIFY",
}

export interface InitContext {
  config: InfraConfig;
  emitter: EventEmitter;
  cspClient: CspClient;
  requiredApis: readonly string[];
  apiPollIntervalMs: number;
  apiPollTimeoutMs: number;
}
