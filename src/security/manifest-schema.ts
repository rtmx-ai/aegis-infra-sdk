/**
 * Enhanced plugin.json manifest schema validation.
 * Validates security metadata required for trust verification.
 *
 * Pure function, no I/O. Implements: REQ-SDK-010
 */

const VALID_RISK_CLASSIFICATIONS = ["CUI", "PUBLIC", "INTERNAL"] as const;
const VALID_OIDC_ISSUER = "https://token.actions.githubusercontent.com";
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
const DOMAIN_GLOB_PATTERN = /^(\*\.)?[a-z0-9-]+(\.[a-z0-9-]+)*$/;

export interface PluginManifestValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a plugin.json object against the extended security schema.
 * Returns validation result with specific error messages.
 */
export function validatePluginManifest(json: unknown): PluginManifestValidation {
  const errors: string[] = [];

  if (!json || typeof json !== "object") {
    return { valid: false, errors: ["plugin.json must be a JSON object"] };
  }

  const obj = json as Record<string, unknown>;

  // Core fields
  if (obj["aegis-plugin"] !== true) {
    errors.push("aegis-plugin must be true");
  }
  if (typeof obj["contract"] !== "string" || !obj["contract"]) {
    errors.push("contract is required");
  }
  if (typeof obj["name"] !== "string" || !obj["name"]) {
    errors.push("name is required");
  }
  if (typeof obj["binary-prefix"] !== "string" || !obj["binary-prefix"]) {
    errors.push("binary-prefix is required");
  }

  // Author field
  if (!obj["author"] || typeof obj["author"] !== "object") {
    errors.push("author is required");
  } else {
    const author = obj["author"] as Record<string, unknown>;
    if (typeof author["org"] !== "string" || !author["org"]) {
      errors.push("author.org is required");
    }
    if (typeof author["repo"] !== "string" || !author["repo"]) {
      errors.push("author.repo is required");
    }
    if (typeof author["oidc-issuer"] !== "string") {
      errors.push("author.oidc-issuer is required");
    } else if (author["oidc-issuer"] !== VALID_OIDC_ISSUER) {
      errors.push(
        `author.oidc-issuer must be "${VALID_OIDC_ISSUER}" (got "${author["oidc-issuer"]}")`,
      );
    }
  }

  // Security field
  if (!obj["security"] || typeof obj["security"] !== "object") {
    errors.push("security is required");
  } else {
    const security = obj["security"] as Record<string, unknown>;

    if (typeof security["minimum-aegis-version"] !== "string") {
      errors.push("security.minimum-aegis-version is required");
    } else if (!SEMVER_PATTERN.test(security["minimum-aegis-version"] as string)) {
      errors.push("security.minimum-aegis-version must be valid semver (e.g., 0.1.0)");
    }

    if (typeof security["risk-classification"] !== "string") {
      errors.push("security.risk-classification is required");
    } else if (
      !(VALID_RISK_CLASSIFICATIONS as readonly string[]).includes(
        security["risk-classification"] as string,
      )
    ) {
      errors.push(
        `security.risk-classification must be one of: ${VALID_RISK_CLASSIFICATIONS.join(", ")}`,
      );
    }

    if (!Array.isArray(security["requires-network"])) {
      errors.push("security.requires-network must be an array of domain patterns");
    } else {
      for (const pattern of security["requires-network"]) {
        if (typeof pattern !== "string" || !DOMAIN_GLOB_PATTERN.test(pattern)) {
          errors.push(`security.requires-network contains invalid domain pattern: "${pattern}"`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
