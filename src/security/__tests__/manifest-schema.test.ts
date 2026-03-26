import { describe, it, expect } from "vitest";
import { validatePluginManifest } from "../manifest-schema.js";

// @req REQ-SDK-010: Plugin manifest security validation

function validManifest(): Record<string, unknown> {
  return {
    "aegis-plugin": true,
    contract: "aegis-infra/v1",
    name: "gcp-assured-workloads",
    description: "IL4/IL5 boundary",
    "binary-prefix": "gcp-assured-workloads",
    author: {
      org: "rtmx-ai",
      repo: "gcp-assured-workloads",
      "oidc-issuer": "https://token.actions.githubusercontent.com",
    },
    security: {
      "minimum-aegis-version": "0.1.0",
      "risk-classification": "CUI",
      "requires-network": ["*.googleapis.com"],
    },
  };
}

describe("validatePluginManifest", () => {
  it("accepts a valid manifest with all security fields", () => {
    const result = validatePluginManifest(validManifest());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects null input", () => {
    const result = validatePluginManifest(null);
    expect(result.valid).toBe(false);
  });

  it("rejects manifest missing author", () => {
    const m = validManifest();
    delete m.author;
    const result = validatePluginManifest(m);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("author is required");
  });

  it("rejects manifest missing author.org", () => {
    const m = validManifest();
    (m.author as Record<string, unknown>).org = "";
    const result = validatePluginManifest(m);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("author.org"))).toBe(true);
  });

  it("rejects manifest missing author.repo", () => {
    const m = validManifest();
    delete (m.author as Record<string, unknown>).repo;
    const result = validatePluginManifest(m);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("author.repo"))).toBe(true);
  });

  it("rejects invalid OIDC issuer", () => {
    const m = validManifest();
    (m.author as Record<string, unknown>)["oidc-issuer"] = "http://not-github.com";
    const result = validatePluginManifest(m);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("oidc-issuer"))).toBe(true);
  });

  it("rejects manifest missing security", () => {
    const m = validManifest();
    delete m.security;
    const result = validatePluginManifest(m);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("security is required");
  });

  it("rejects invalid risk classification", () => {
    const m = validManifest();
    (m.security as Record<string, unknown>)["risk-classification"] = "UNKNOWN";
    const result = validatePluginManifest(m);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("risk-classification"))).toBe(true);
  });

  it("accepts all valid risk classifications", () => {
    for (const rc of ["CUI", "PUBLIC", "INTERNAL"]) {
      const m = validManifest();
      (m.security as Record<string, unknown>)["risk-classification"] = rc;
      expect(validatePluginManifest(m).valid).toBe(true);
    }
  });

  it("rejects invalid semver in minimum-aegis-version", () => {
    const m = validManifest();
    (m.security as Record<string, unknown>)["minimum-aegis-version"] = "not-semver";
    const result = validatePluginManifest(m);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("semver"))).toBe(true);
  });

  it("rejects invalid domain glob patterns", () => {
    const m = validManifest();
    (m.security as Record<string, unknown>)["requires-network"] = [
      "*.googleapis.com",
      "http://bad",
    ];
    const result = validatePluginManifest(m);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("invalid domain pattern"))).toBe(true);
  });

  it("accepts valid domain glob patterns", () => {
    const m = validManifest();
    (m.security as Record<string, unknown>)["requires-network"] = [
      "*.googleapis.com",
      "oauth2.googleapis.com",
      "accounts.google.com",
    ];
    expect(validatePluginManifest(m).valid).toBe(true);
  });

  it("rejects missing aegis-plugin flag", () => {
    const m = validManifest();
    m["aegis-plugin"] = false;
    expect(validatePluginManifest(m).valid).toBe(false);
  });

  it("collects multiple errors at once", () => {
    const result = validatePluginManifest({ "aegis-plugin": false });
    expect(result.errors.length).toBeGreaterThan(3);
  });
});
