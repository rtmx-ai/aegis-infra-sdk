#!/usr/bin/env node
/* eslint-disable no-console */
import { checkCiCompliance } from "./ci-compliance.js";

const dir = process.argv[2];
if (!dir) {
  console.error("Usage: aegis-ci-check <workflow-directory>");
  process.exit(1);
}

const result = checkCiCompliance(dir);
for (const check of result.checks) {
  console.log(
    `${check.passed ? "PASS" : "FAIL"} ${check.name}: ${check.message}`,
  );
}

if (!result.overall) {
  console.error("\nCI compliance check FAILED");
  process.exit(1);
}
console.log("\nCI compliance check PASSED");
