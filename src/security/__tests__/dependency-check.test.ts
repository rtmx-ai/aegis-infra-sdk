import { describe, it, expect } from "vitest";
import { validateSdkPinning } from "../dependency-check.js";

// @req REQ-SDK-011: SDK lockfile enforcement

describe("validateSdkPinning", () => {
  it("accepts exact version '0.1.0'", () => {
    const pkg = { dependencies: { "@aegis-cli/infra-sdk": "0.1.0" } };
    const result = validateSdkPinning(pkg);
    expect(result.valid).toBe(true);
  });

  it("rejects caret range '^0.1.0'", () => {
    const pkg = { dependencies: { "@aegis-cli/infra-sdk": "^0.1.0" } };
    const result = validateSdkPinning(pkg);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("^");
  });

  it("rejects tilde range '~0.1.0'", () => {
    const pkg = { dependencies: { "@aegis-cli/infra-sdk": "~0.1.0" } };
    expect(validateSdkPinning(pkg).valid).toBe(false);
  });

  it("rejects wildcard '*'", () => {
    const pkg = { dependencies: { "@aegis-cli/infra-sdk": "*" } };
    expect(validateSdkPinning(pkg).valid).toBe(false);
  });

  it("rejects range '>=0.1.0'", () => {
    const pkg = { dependencies: { "@aegis-cli/infra-sdk": ">=0.1.0" } };
    expect(validateSdkPinning(pkg).valid).toBe(false);
  });

  it("rejects range with space '0.1.0 - 0.2.0'", () => {
    const pkg = { dependencies: { "@aegis-cli/infra-sdk": "0.1.0 - 0.2.0" } };
    expect(validateSdkPinning(pkg).valid).toBe(false);
  });

  it("rejects file: reference", () => {
    const pkg = { dependencies: { "@aegis-cli/infra-sdk": "file:../aegis-infra-sdk" } };
    expect(validateSdkPinning(pkg).valid).toBe(false);
  });

  it("rejects git: reference", () => {
    const pkg = {
      dependencies: {
        "@aegis-cli/infra-sdk": "git+https://github.com/rtmx-ai/aegis-infra-sdk.git",
      },
    };
    expect(validateSdkPinning(pkg).valid).toBe(false);
  });

  it("returns error when SDK is not in dependencies", () => {
    const pkg = { dependencies: { "other-package": "1.0.0" } };
    const result = validateSdkPinning(pkg);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("not found");
  });

  it("returns error when dependencies field is missing", () => {
    const pkg = {};
    expect(validateSdkPinning(pkg).valid).toBe(false);
  });
});
