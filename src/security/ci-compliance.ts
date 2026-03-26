import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface ComplianceCheck {
  name: string;
  passed: boolean;
  message: string;
}

export interface ComplianceResult {
  overall: boolean;
  checks: ComplianceCheck[];
}

interface CheckDefinition {
  name: string;
  pattern: RegExp;
  passMessage: string;
  failMessage: string;
}

const CHECK_DEFINITIONS: CheckDefinition[] = [
  {
    name: "cosign-signing",
    pattern: /cosign sign-blob/,
    passMessage: "Cosign keyless signing step found",
    failMessage: "Missing cosign sign-blob step for binary signing",
  },
  {
    name: "checksum-generation",
    pattern: /sha256sum|shasum/,
    passMessage: "Checksum generation step found",
    failMessage: "Missing sha256sum or shasum step for checksum generation",
  },
  {
    name: "version-verification",
    pattern: /package\.json.*version|version.*package\.json/,
    passMessage: "Version verification step found",
    failMessage:
      "Missing step comparing tag version to package.json version",
  },
  {
    name: "binary-verification",
    pattern: /manifest/,
    passMessage: "Binary verification (manifest test) step found",
    failMessage:
      "Missing binary verification step (binary should respond to manifest)",
  },
  {
    name: "bundle-upload",
    pattern: /\.bundle/,
    passMessage: "Cosign bundle upload step found",
    failMessage:
      "Missing .bundle in upload step (cosign bundles must be uploaded)",
  },
  {
    name: "id-token-permission",
    pattern: /id-token:\s*write/,
    passMessage: "id-token: write permission found",
    failMessage:
      "Missing id-token: write permission (required for keyless signing)",
  },
];

function isReleaseWorkflow(content: string): boolean {
  return /tags:/.test(content) && /v\*/.test(content);
}

export function checkCiCompliance(workflowDir: string): ComplianceResult {
  let files: string[];
  try {
    files = readdirSync(workflowDir);
  } catch {
    return {
      overall: false,
      checks: [
        {
          name: "directory-access",
          passed: false,
          message: `Cannot read workflow directory: ${workflowDir}`,
        },
      ],
    };
  }

  const ymlFiles = files.filter(
    (f) => f.endsWith(".yml") || f.endsWith(".yaml"),
  );

  if (ymlFiles.length === 0) {
    return {
      overall: false,
      checks: [
        {
          name: "workflow-files",
          passed: false,
          message: `No .yml files found in ${workflowDir}`,
        },
      ],
    };
  }

  let releaseContent: string | null = null;
  for (const file of ymlFiles) {
    const content = readFileSync(join(workflowDir, file), "utf-8");
    if (isReleaseWorkflow(content)) {
      releaseContent = content;
      break;
    }
  }

  if (releaseContent === null) {
    return {
      overall: false,
      checks: [
        {
          name: "release-workflow",
          passed: false,
          message: "No release workflow found",
        },
      ],
    };
  }

  const checks: ComplianceCheck[] = CHECK_DEFINITIONS.map((def) => {
    const passed = def.pattern.test(releaseContent);
    return {
      name: def.name,
      passed,
      message: passed ? def.passMessage : def.failMessage,
    };
  });

  return {
    overall: checks.every((c) => c.passed),
    checks,
  };
}
