/**
 * SDK version pinning enforcement.
 * Verifies plugins use exact version pinning for @aegis-cli/infra-sdk.
 * Prevents supply chain attacks via semver range auto-update (Attack 5).
 *
 * Implements: REQ-SDK-011
 */

export interface PinningResult {
  valid: boolean;
  reason: string;
}

const SDK_PACKAGE_NAME = "@aegis-cli/infra-sdk";
const RANGE_PREFIXES = ["^", "~", ">", "<", "*"];

/**
 * Validate that a package.json pins the SDK to an exact version.
 * Accepts a parsed package.json object.
 */
export function validateSdkPinning(packageJson: Record<string, unknown>): PinningResult {
  const deps = packageJson["dependencies"] as Record<string, string> | undefined;
  if (!deps || typeof deps !== "object") {
    return { valid: false, reason: `${SDK_PACKAGE_NAME} not found in dependencies` };
  }

  const version = deps[SDK_PACKAGE_NAME];
  if (!version) {
    return { valid: false, reason: `${SDK_PACKAGE_NAME} not found in dependencies` };
  }

  if (version.startsWith("file:") || version.startsWith("git")) {
    return { valid: false, reason: `${SDK_PACKAGE_NAME} must use an exact npm version, not a file: or git: reference` };
  }

  for (const prefix of RANGE_PREFIXES) {
    if (version.startsWith(prefix)) {
      return {
        valid: false,
        reason: `${SDK_PACKAGE_NAME} must use exact version pinning (no ${prefix} prefix). Got "${version}"`,
      };
    }
  }

  if (version.includes(" ")) {
    return { valid: false, reason: `${SDK_PACKAGE_NAME} must use exact version pinning (no range operators). Got "${version}"` };
  }

  return { valid: true, reason: `${SDK_PACKAGE_NAME} pinned to exact version ${version}` };
}
