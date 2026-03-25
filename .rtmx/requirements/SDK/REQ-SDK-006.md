# REQ-SDK-006: Azure Government Plugin (Future)

## Overview

An `azure-government` plugin provisioning an IL4/IL5 boundary in Azure Government with Azure OpenAI Service access. This requirement captures the design constraints identified during research but is NOT scheduled for implementation. The focus is on GCP Assured Workloads first.

## Key Design Constraints (from research 2026-03-25)

### Azure Government is a separate cloud, not a policy overlay
- Separate endpoints: `*.usgovcloudapi.net` (not `*.azure.com`)
- Separate portal: `portal.azure.us`
- Separate tenant and subscriptions
- IL5 requires DoD regions: `usdodcentral`, `usdodeast`

### Partial controls inheritance via Azure Policy
- Data residency and personnel screening are automatic (by virtue of the separate cloud)
- Azure Policy built-in initiatives exist for DoD IL4 and IL5 (~200+ individual policies each)
- Policy can **deny** non-compliant resource creation (preventive)
- Policy can **auto-remediate** some configurations via DeployIfNotExists
- But Policy is reactive/preventive, not constructive -- it does not create the Key Vault, VNet, etc.

### Azure Blueprints is deprecated
- Was Microsoft's constructive compliance approach (closest to GCP Assured Workloads)
- Deprecated 2024-2025, replaced by Template Specs + Deployment Stacks + Azure Policy
- Azure Landing Zones (ALZ) via Bicep/Terraform is the current recommended pattern

### API enablement maps to Resource Provider registration
- Azure equivalent of GCP API enablement is registering Resource Providers
- e.g., `Microsoft.CognitiveServices` for Azure OpenAI, `Microsoft.KeyVault`, etc.
- CspClient can implement `getApiState`/`enableApi` as RP registration checks

### Estimated resource count: 12+
Key Vault (Managed HSM for IL5), VNet + subnets, Private Endpoints (for OpenAI, Storage, Key Vault), NSGs, diagnostic settings, Log Analytics workspace, Defender for Cloud enablement, Azure Policy initiative assignment, Storage account (CMEK), Azure OpenAI Service deployment.

### Estimated health checks: 8+
Key Vault accessible, VNet exists, Private Endpoint reachable, diagnostic settings configured, Defender for Cloud posture score, Policy compliance percentage, OpenAI model accessible, Storage account encrypted.

### IaC reference: Azure Landing Zones (ALZ)
Microsoft-maintained Bicep/Terraform modules for compliant landing zones. Could inform the Pulumi stack design.

## SDK Changes Required

- Same as REQ-SDK-005: make `PluginConfig.requiredApis` optional
- No other SDK changes needed

## Status

PARKED -- not scheduled for implementation. GCP Assured Workloads is the priority path.
