/**
 * PluginConfig validation.
 * Called at registration time to reject invalid configs with specific error messages.
 *
 * Implements: REQ-SDK-007
 */

import type { PluginConfig } from "./entrypoint.js";

/** Validate a PluginConfig. Returns null if valid, or an error message string. */
export function validatePluginConfig(config: PluginConfig): string | null {
  if (!config) return "PluginConfig is null or undefined";

  if (!config.name || typeof config.name !== "string") {
    return "PluginConfig.name is required and must be a non-empty string";
  }
  if (!config.version || typeof config.version !== "string") {
    return "PluginConfig.version is required and must be a non-empty string";
  }
  if (!config.description || typeof config.description !== "string") {
    return "PluginConfig.description is required and must be a non-empty string";
  }
  if (!Array.isArray(config.credentials) || config.credentials.length === 0) {
    return "PluginConfig.credentials must be a non-empty string array";
  }
  if (!Array.isArray(config.inputs)) {
    return "PluginConfig.inputs must be an array of InputField objects";
  }
  if (!Array.isArray(config.outputs) || config.outputs.length === 0) {
    return "PluginConfig.outputs must be a non-empty string array";
  }

  // Validate port implementations
  if (!config.cspClient || typeof config.cspClient !== "object") {
    return "PluginConfig.cspClient is required";
  }
  for (const method of ["validateCredentials", "checkAccess", "getApiState", "enableApi"]) {
    if (typeof (config.cspClient as unknown as Record<string, unknown>)[method] !== "function") {
      return `PluginConfig.cspClient.${method} must be a function`;
    }
  }

  if (!config.engine || typeof config.engine !== "object") {
    return "PluginConfig.engine is required";
  }
  for (const method of ["preview", "up", "destroy", "getOutputs"]) {
    if (typeof (config.engine as unknown as Record<string, unknown>)[method] !== "function") {
      return `PluginConfig.engine.${method} must be a function`;
    }
  }

  if (!config.healthChecker || typeof config.healthChecker !== "object") {
    return "PluginConfig.healthChecker is required";
  }
  if (typeof (config.healthChecker as unknown as Record<string, unknown>).checkAll !== "function") {
    return "PluginConfig.healthChecker.checkAll must be a function";
  }

  // requiredApis is optional
  if (config.requiredApis !== undefined && !Array.isArray(config.requiredApis)) {
    return "PluginConfig.requiredApis must be a string array if provided";
  }

  return null;
}
