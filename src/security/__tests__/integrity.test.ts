import { describe, it, expect } from "vitest";
import { computeFileSha256 } from "../integrity.js";
import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

// @req REQ-SDK-010: Binary integrity self-check

describe("computeFileSha256", () => {
  const tmpFile = join(tmpdir(), `aegis-integrity-test-${Date.now()}.txt`);

  it("computes correct SHA256 for known content", async () => {
    await writeFile(tmpFile, "hello world");
    const hash = await computeFileSha256(tmpFile);
    // SHA256 of "hello world" is well-known
    expect(hash).toBe("b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
    await unlink(tmpFile);
  });

  it("returns different hash for different content", async () => {
    await writeFile(tmpFile, "content A");
    const hashA = await computeFileSha256(tmpFile);
    await writeFile(tmpFile, "content B");
    const hashB = await computeFileSha256(tmpFile);
    expect(hashA).not.toBe(hashB);
    await unlink(tmpFile);
  });

  it("throws for non-existent file", async () => {
    await expect(computeFileSha256("/nonexistent/path/file.bin")).rejects.toThrow();
  });

  it("returns 64-character hex string", async () => {
    await writeFile(tmpFile, "test");
    const hash = await computeFileSha256(tmpFile);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    await unlink(tmpFile);
  });
});
