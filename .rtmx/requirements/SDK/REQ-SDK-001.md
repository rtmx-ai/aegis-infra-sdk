# REQ-SDK-001: Plugin Packaging Convention and Input Design

## Overview

Plugins must be packaged per CSP compliance boundary, not per model. Model selection is a runtime input parameter. This was determined by analyzing the gcp-cui-gemini exemplar: the provisioned infrastructure (KMS, VPC, VPC-SC, audit) is identical regardless of which Vertex AI model the user calls. The boundary protects the data path, not the model.

A naming convention and input schema pattern ensures consistency across the plugin ecosystem and prevents fragmentation (e.g., `gcp-il4-gemini-pro`, `gcp-il4-gemini-flash`, `gcp-il5-gemini-pro` as separate plugins when they should be one).

## Upstream Cross-References

- REQ-GCG-009 (gcp-cui-gemini): Extract @aegis/infra-sdk for Plugin Ecosystem
- REQ-AEG-008 (aegis-cli): Secure Onboarding State Machine -- mode selection determines which plugin to invoke

## Specification

### Naming Convention

Plugin packages follow the pattern: `<csp>-<compliance-regime>`

| Plugin Name | CSP | Compliance Regime |
|-------------|-----|-------------------|
| gcp-assured-workloads | Google Cloud | Assured Workloads (IL4/IL5) |
| aws-govcloud | AWS | GovCloud (IL4/IL5) |
| azure-government | Azure | Azure Government (IL4/IL5) |
| local-airgap | None (on-prem) | Air-gapped (any IL) |

Model-specific names (`gcp-cui-gemini`, `aws-bedrock-claude`) are explicitly prohibited. The model is an input parameter, not a packaging axis.

### Input Schema Pattern

Every plugin declares two categories of inputs:

**CSP-specific inputs** (vary per plugin):
- `project_id` (GCP), `account_id` (AWS), `subscription_id` (Azure)
- CSP-specific configuration (e.g., `access_policy_id` for GCP VPC-SC)

**Universal inputs** (every plugin supports):
- `region` -- deployment region (default varies per CSP)
- `impact_level` -- enum: IL4, IL5 (default: IL4)
- `model` -- the GenAI model identifier (default varies per CSP, validated during VERIFY)

The SDK does not enforce universal inputs automatically -- each plugin must declare them in its manifest. But the PLUGIN_GUIDE.md establishes the convention that all plugins include region, impact_level, and model.

### Model Validation

The `model` input is validated during the VERIFY phase, not during PROVISION. The boundary is provisioned first; the health checker then verifies the requested model is accessible within the boundary. This separation means:
- A boundary can be provisioned before the user decides which model to use
- The same boundary supports switching models without re-provisioning
- Model availability issues are surfaced as health check failures, not provisioning errors

### Plugin Configuration Mutability

Plugin configurations are NOT immutable. Input parameters can change between invocations:
- Changing `model` re-runs VERIFY but does not re-provision
- Changing `impact_level` may require re-provisioning (additional controls for IL5)
- Changing `region` requires a new boundary (destroy + re-provision)

The SDK's idempotent state machine handles all of these cases through convergence.

## BDD Scenarios

### Scenario 1: Plugin declares model as an input parameter
- Given a plugin following the naming convention
- When the manifest is inspected
- Then inputs include a "model" field of type "enum" or "string"
- And the model field has a default value for the CSP's primary model

### Scenario 2: Boundary provisions without model-specific resources
- Given input with model "gemini-2.5-pro-001"
- When the "up" subcommand provisions the boundary
- Then no model-specific resources are created
- And the boundary resources are identical to a provision with model "gemini-2.5-flash-001"

### Scenario 3: Model is validated during VERIFY not PROVISION
- Given a provisioned boundary
- And input with model "nonexistent-model-999"
- When the "up" subcommand runs
- Then PROVISION succeeds (boundary resources created)
- And VERIFY reports model_accessible check as "fail"

### Scenario 4: Same boundary supports model switching
- Given a provisioned boundary with model "gemini-2.5-pro-001"
- When "status" is invoked with model "gemini-2.5-flash-001"
- Then the model_accessible check validates the new model
- And no re-provisioning occurs

## Acceptance Criteria

- [AC1] Plugin names follow `<csp>-<compliance-regime>` convention
- [AC2] No plugin name contains a model identifier
- [AC3] All plugins declare region, impact_level, and model inputs
- [AC4] Model validation occurs during VERIFY, not PROVISION
- [AC5] Changing the model input does not trigger re-provisioning
- [AC6] The exemplar plugin (gcp-assured-workloads) demonstrates the convention

## Traceability

- Tests: Validated by exemplar plugin structure and manifest inspection
- Docs: PLUGIN_GUIDE.md
