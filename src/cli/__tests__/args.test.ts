import { describe, it, expect } from "vitest";
import { parseSubcommand, parseInput, extractInput, requireConfirmDestroy } from "../args.js";
import { SUBCOMMANDS } from "../../domain/types.js";
import type { InputField } from "../../domain/types.js";

const TEST_INPUTS: InputField[] = [
  { name: "project_id", type: "string", required: true },
  { name: "region", type: "string", default: "us-central1" },
  { name: "impact_level", type: "enum", values: ["IL4", "IL5"], default: "IL4" },
];

// --- parseSubcommand ---

describe("parseSubcommand", () => {
  it("returns the subcommand for each valid value", () => {
    for (const cmd of SUBCOMMANDS) {
      expect(parseSubcommand(cmd)).toBe(cmd);
    }
  });

  it("returns null for undefined input", () => {
    expect(parseSubcommand(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseSubcommand("")).toBeNull();
  });

  it("returns null for unknown subcommand", () => {
    expect(parseSubcommand("foo")).toBeNull();
    expect(parseSubcommand("init")).toBeNull();
    expect(parseSubcommand("MANIFEST")).toBeNull();
  });
});

// --- parseInput ---

describe("parseInput", () => {
  it("parses valid input with all fields", () => {
    const config = parseInput(
      JSON.stringify({
        project_id: "my-project",
        region: "us-east1",
        impact_level: "IL5",
      }),
      TEST_INPUTS,
    );
    expect(config.params).toEqual({
      project_id: "my-project",
      region: "us-east1",
      impact_level: "IL5",
    });
  });

  it("applies defaults for missing optional fields", () => {
    const config = parseInput(JSON.stringify({ project_id: "my-project" }), TEST_INPUTS);
    expect(config.params.region).toBe("us-central1");
    expect(config.params.impact_level).toBe("IL4");
  });

  it("throws on invalid JSON", () => {
    expect(() => parseInput("not json", TEST_INPUTS)).toThrow("Invalid JSON");
  });

  it("throws on non-object JSON", () => {
    expect(() => parseInput('"just a string"', TEST_INPUTS)).toThrow("must be a JSON object");
  });

  it("throws on missing required field", () => {
    expect(() => parseInput(JSON.stringify({}), TEST_INPUTS)).toThrow("project_id is required");
  });

  it("throws on invalid enum value", () => {
    expect(() =>
      parseInput(JSON.stringify({ project_id: "p", impact_level: "IL3" }), TEST_INPUTS),
    ).toThrow("impact_level must be one of");
  });

  it("works with no declared inputs (empty schema)", () => {
    const config = parseInput(JSON.stringify({ anything: "goes" }), []);
    expect(config.params).toEqual({});
  });
});

// --- extractInput ---

describe("extractInput", () => {
  it("extracts --input from argv", () => {
    const argv = ["node", "plugin", "up", "--input", '{"project_id":"p"}'];
    const config = extractInput(argv, TEST_INPUTS);
    expect(config.params.project_id).toBe("p");
  });

  it("throws when --input is missing", () => {
    const argv = ["node", "plugin", "up"];
    expect(() => extractInput(argv, TEST_INPUTS)).toThrow("--input JSON argument is required");
  });

  it("throws when --input has no value", () => {
    const argv = ["node", "plugin", "up", "--input"];
    expect(() => extractInput(argv, TEST_INPUTS)).toThrow("--input JSON argument is required");
  });
});

// --- requireConfirmDestroy ---

describe("requireConfirmDestroy", () => {
  it("returns true when flag is present", () => {
    expect(requireConfirmDestroy(["node", "plugin", "destroy", "--confirm-destroy"])).toBe(true);
  });

  it("returns false when flag is absent", () => {
    expect(requireConfirmDestroy(["node", "plugin", "destroy"])).toBe(false);
  });

  it("returns true when flag is among other args", () => {
    expect(
      requireConfirmDestroy(["node", "plugin", "destroy", "--input", "{}", "--confirm-destroy"]),
    ).toBe(true);
  });
});
