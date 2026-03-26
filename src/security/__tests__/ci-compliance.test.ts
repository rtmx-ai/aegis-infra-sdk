import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkCiCompliance } from "../ci-compliance.js";

// @req REQ-SDK-012: CI compliance enforcement

const COMPLIANT_WORKFLOW = `name: Release

on:
  push:
    tags:
      - "v*"

permissions:
  contents: write
  id-token: write

jobs:
  verify-version:
    name: Verify Version
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check tag matches package.json version
        run: |
          TAG_VERSION="\${GITHUB_REF_NAME#v}"
          PKG_VERSION=$(node -p "require('./package.json').version")
          if [ "$TAG_VERSION" != "$PKG_VERSION" ]; then
            exit 1
          fi

  build-binaries:
    name: Build
    needs: [verify-version]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: bun build src/index.ts --compile --outfile my-binary
      - name: Verify binary responds to manifest
        run: ./my-binary manifest | head -1
      - uses: sigstore/cosign-installer@v3
      - name: Sign binary with cosign
        run: cosign sign-blob --yes --bundle my-binary.bundle my-binary
      - uses: actions/upload-artifact@v4
        with:
          name: binary
          path: |
            my-binary
            my-binary.bundle

  github-release:
    name: GitHub Release
    needs: [build-binaries]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v4
      - name: Generate checksums
        run: |
          sha256sum my-binary-* > SHA256SUMS.txt
      - uses: softprops/action-gh-release@v2
        with:
          files: |
            binaries/*
`;

function writeWorkflow(dir: string, filename: string, content: string): void {
  writeFileSync(join(dir, filename), content);
}

function removePattern(content: string, pattern: RegExp): string {
  return content.replace(pattern, "");
}

describe("checkCiCompliance", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "ci-compliance-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("passes for workflow with all required steps", () => {
    writeWorkflow(tmpDir, "release.yml", COMPLIANT_WORKFLOW);
    const result = checkCiCompliance(tmpDir);
    expect(result.overall).toBe(true);
    expect(result.checks).toHaveLength(6);
    for (const check of result.checks) {
      expect(check.passed).toBe(true);
    }
  });

  it("fails when cosign sign-blob is missing", () => {
    const content = removePattern(COMPLIANT_WORKFLOW, /cosign sign-blob[^\n]*/g);
    writeWorkflow(tmpDir, "release.yml", content);
    const result = checkCiCompliance(tmpDir);
    expect(result.overall).toBe(false);
    const check = result.checks.find((c) => c.name === "cosign-signing");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(false);
    expect(check!.message).toContain("cosign sign-blob");
  });

  it("fails when sha256sum/checksum generation is missing", () => {
    const content = removePattern(COMPLIANT_WORKFLOW, /sha256sum[^\n]*/g);
    writeWorkflow(tmpDir, "release.yml", content);
    const result = checkCiCompliance(tmpDir);
    expect(result.overall).toBe(false);
    const check = result.checks.find((c) => c.name === "checksum-generation");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(false);
    expect(check!.message).toContain("sha256sum");
  });

  it("fails when version verification step is missing", () => {
    const content = removePattern(COMPLIANT_WORKFLOW, /package\.json.*version/g);
    writeWorkflow(tmpDir, "release.yml", content);
    const result = checkCiCompliance(tmpDir);
    expect(result.overall).toBe(false);
    const check = result.checks.find((c) => c.name === "version-verification");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(false);
    expect(check!.message).toContain("package.json");
  });

  it("fails when binary verification (manifest test) is missing", () => {
    const content = removePattern(COMPLIANT_WORKFLOW, /manifest/g);
    writeWorkflow(tmpDir, "release.yml", content);
    const result = checkCiCompliance(tmpDir);
    expect(result.overall).toBe(false);
    const check = result.checks.find((c) => c.name === "binary-verification");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(false);
    expect(check!.message).toContain("manifest");
  });

  it("fails when .bundle is not in upload step", () => {
    const content = removePattern(COMPLIANT_WORKFLOW, /\.bundle/g);
    writeWorkflow(tmpDir, "release.yml", content);
    const result = checkCiCompliance(tmpDir);
    expect(result.overall).toBe(false);
    const check = result.checks.find((c) => c.name === "bundle-upload");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(false);
    expect(check!.message).toContain(".bundle");
  });

  it("fails when id-token: write permission is missing", () => {
    const content = removePattern(COMPLIANT_WORKFLOW, /id-token:\s*write/g);
    writeWorkflow(tmpDir, "release.yml", content);
    const result = checkCiCompliance(tmpDir);
    expect(result.overall).toBe(false);
    const check = result.checks.find((c) => c.name === "id-token-permission");
    expect(check).toBeDefined();
    expect(check!.passed).toBe(false);
    expect(check!.message).toContain("id-token");
  });

  it("handles missing workflow directory gracefully", () => {
    const result = checkCiCompliance("/nonexistent/path/to/workflows");
    expect(result.overall).toBe(false);
    expect(result.checks).toHaveLength(1);
    expect(result.checks[0].passed).toBe(false);
    expect(result.checks[0].message).toContain("Cannot read");
  });

  it("handles empty workflow directory", () => {
    const result = checkCiCompliance(tmpDir);
    expect(result.overall).toBe(false);
    expect(result.checks).toHaveLength(1);
    expect(result.checks[0].passed).toBe(false);
    expect(result.checks[0].message).toContain("No .yml files");
  });

  it("fails when no release workflow found (only ci.yml with no tags trigger)", () => {
    const ciOnly = `name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - run: npm test
`;
    writeWorkflow(tmpDir, "ci.yml", ciOnly);
    const result = checkCiCompliance(tmpDir);
    expect(result.overall).toBe(false);
    expect(result.checks).toHaveLength(1);
    expect(result.checks[0].message).toBe("No release workflow found");
  });

  it("returns actionable error messages for each failure", () => {
    // Remove all security steps to get all failures
    let content = COMPLIANT_WORKFLOW;
    content = removePattern(content, /cosign sign-blob[^\n]*/g);
    content = removePattern(content, /sha256sum[^\n]*/g);
    content = removePattern(content, /package\.json.*version/g);
    content = removePattern(content, /manifest/g);
    content = removePattern(content, /\.bundle/g);
    content = removePattern(content, /id-token:\s*write/g);
    writeWorkflow(tmpDir, "release.yml", content);

    const result = checkCiCompliance(tmpDir);
    expect(result.overall).toBe(false);
    for (const check of result.checks) {
      expect(check.passed).toBe(false);
      // Each message should be descriptive (more than just the check name)
      expect(check.message.length).toBeGreaterThan(10);
    }
  });

  it("returns overall pass only when all checks pass", () => {
    writeWorkflow(tmpDir, "release.yml", COMPLIANT_WORKFLOW);
    const result = checkCiCompliance(tmpDir);
    expect(result.overall).toBe(true);

    // Now remove one thing and verify overall fails
    const content = removePattern(COMPLIANT_WORKFLOW, /sha256sum[^\n]*/g);
    writeWorkflow(tmpDir, "release.yml", content);
    const result2 = checkCiCompliance(tmpDir);
    expect(result2.overall).toBe(false);
    // But other checks should still pass
    const passingChecks = result2.checks.filter((c) => c.passed);
    expect(passingChecks.length).toBe(5);
  });
});
