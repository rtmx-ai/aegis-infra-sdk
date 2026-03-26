import { describe, it, expect } from "vitest";
import { validateOutputValues } from "../output-validation.js";

// @req REQ-SDK-011: Output value validation

describe("validateOutputValues", () => {
  const patterns: Record<string, RegExp> = {
    vertex_endpoint: /^[a-z0-9-]+-aiplatform\.googleapis\.com$/,
    perimeter_configured: /^(true|false)$/,
  };

  it("returns empty array when all outputs match their patterns", () => {
    const outputs = {
      vertex_endpoint: "us-central1-aiplatform.googleapis.com",
      perimeter_configured: "true",
    };
    expect(validateOutputValues(outputs, patterns)).toEqual([]);
  });

  it("returns violation for output not matching pattern", () => {
    const outputs = {
      vertex_endpoint: "attacker-proxy.evil.com",
      perimeter_configured: "true",
    };
    const violations = validateOutputValues(outputs, patterns);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain("vertex_endpoint");
    expect(violations[0]).toContain("attacker-proxy.evil.com");
  });

  it("returns multiple violations when multiple outputs fail", () => {
    const outputs = {
      vertex_endpoint: "evil.com",
      perimeter_configured: "maybe",
    };
    const violations = validateOutputValues(outputs, patterns);
    expect(violations).toHaveLength(2);
  });

  it("ignores outputs not in the validation map", () => {
    const outputs = {
      vertex_endpoint: "us-central1-aiplatform.googleapis.com",
      extra_output: "anything goes",
    };
    expect(validateOutputValues(outputs, patterns)).toEqual([]);
  });

  it("ignores missing output keys (handled by manifest check)", () => {
    const outputs = { perimeter_configured: "false" };
    expect(validateOutputValues(outputs, patterns)).toEqual([]);
  });

  it("treats undefined validation map entries gracefully", () => {
    const outputs = { vertex_endpoint: "us-central1-aiplatform.googleapis.com" };
    expect(validateOutputValues(outputs, {})).toEqual([]);
  });

  it("blocks googleapis.com subdomain bypass", () => {
    const outputs = { vertex_endpoint: "us-central1-aiplatform.googleapis.com.evil.com" };
    const violations = validateOutputValues(outputs, patterns);
    expect(violations).toHaveLength(1);
  });

  it("blocks path traversal in endpoint", () => {
    const outputs = { vertex_endpoint: "us-central1-aiplatform.googleapis.com/../../evil" };
    const violations = validateOutputValues(outputs, patterns);
    expect(violations).toHaveLength(1);
  });
});
