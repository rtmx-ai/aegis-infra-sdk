import { describe, it, expect, afterEach } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { resolveStateDir, ensureStateDir, buildStackName } from "../local.js";

describe("resolveStateDir", () => {
  it("returns default path under ~/.aegis/state/{name}", () => {
    const result = resolveStateDir("my-plugin");
    expect(result).toBe(path.join(os.homedir(), ".aegis", "state", "my-plugin"));
  });

  it("returns custom stateDir when provided", () => {
    const result = resolveStateDir("my-plugin", "/tmp/custom-state");
    expect(result).toBe("/tmp/custom-state");
  });
});

describe("ensureStateDir", () => {
  const tmpDir = path.join(os.tmpdir(), `aegis-sdk-test-${Date.now()}`);

  afterEach(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  it("creates the directory if it does not exist", () => {
    const dir = ensureStateDir("test", tmpDir);
    expect(dir).toBe(tmpDir);
    expect(fs.existsSync(tmpDir)).toBe(true);
  });

  it("is idempotent (does not throw if directory exists)", () => {
    ensureStateDir("test", tmpDir);
    expect(() => ensureStateDir("test", tmpDir)).not.toThrow();
  });
});

describe("buildStackName", () => {
  it("joins param values with hyphens, lowercased", () => {
    const name = buildStackName({ params: { project_id: "MyProject", region: "US-Central1" } });
    expect(name).toBe("myproject-us-central1");
  });

  it("returns 'default' for empty params", () => {
    const name = buildStackName({ params: {} });
    expect(name).toBe("default");
  });

  it("handles single param", () => {
    const name = buildStackName({ params: { id: "Foo" } });
    expect(name).toBe("foo");
  });
});
