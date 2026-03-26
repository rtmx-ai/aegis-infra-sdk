/**
 * Output value validation framework.
 * Validates engine outputs against regex patterns before emission.
 * Blocks output injection attacks (Attack 3).
 *
 * Pure function, no I/O. Implements: REQ-SDK-011
 */

import type { BoundaryOutput } from "../domain/types.js";

/**
 * Validate output values against regex patterns.
 * Returns an array of violation descriptions (empty = all valid).
 */
export function validateOutputValues(
  outputs: BoundaryOutput,
  patterns: Record<string, RegExp>,
): string[] {
  const violations: string[] = [];

  for (const [key, pattern] of Object.entries(patterns)) {
    const value = outputs[key];
    if (value === undefined) continue; // Missing keys handled separately by manifest-output check
    if (!pattern.test(value)) {
      violations.push(`${key}: value "${value}" does not match required pattern ${pattern}`);
    }
  }

  return violations;
}
