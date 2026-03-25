# REQ-SDK-005: AWS GovCloud Plugin (Future)

## Overview

An `aws-govcloud` plugin provisioning an IL4/IL5 boundary in AWS GovCloud with Amazon Bedrock access. This requirement captures the design constraints identified during research but is NOT scheduled for implementation. The focus is on GCP Assured Workloads first.

## Key Design Constraints (from research 2026-03-25)

### AWS GovCloud is a separate partition, not a policy overlay
- Separate ARN prefix: `arn:aws-us-gov:` (breaks hardcoded ARNs)
- Separate regions: `us-gov-west-1`, `us-gov-east-1`
- Separate console, separate accounts, separate IAM
- GovCloud account must be created through a linked commercial AWS account

### No controls inheritance
AWS provides physical isolation (the GovCloud partition) but all logical controls are customer-configured:
- KMS keys (FIPS 140-2 Level 3 HSMs)
- VPC + PrivateLink for Bedrock
- CloudTrail for audit logging
- Config rules for drift detection
- SCPs for service/region restriction
- GuardDuty for threat detection
- Security Hub for compliance aggregation

### API enablement is not a concept
AWS services are available (or not) in GovCloud. There is no "enable API" step. The CspClient for AWS would return "ENABLED" for all required services or check service availability. The SDK should make `requiredApis` optional to cleanly skip the API_ENABLEMENT phase.

### FIPS endpoints are mandatory
All API calls must use FIPS-validated endpoints (e.g., `bedrock-fips.us-gov-west-1.amazonaws.com`). This is a Pulumi provider configuration, not a plugin contract change.

### Estimated resource count: 15+
KMS key, VPC, subnets, PrivateLink endpoints (for Bedrock, S3, KMS), CloudTrail trail + S3 bucket, Config recorder + rules, SCP policies, Security Hub standards, GuardDuty detector, IAM roles and policies.

### Estimated health checks: 8+
KMS key active, VPC exists, PrivateLink endpoint reachable, CloudTrail logging, Config recorder active, SCP attached, GuardDuty enabled, Bedrock model accessible.

### IaC reference: AWS Landing Zone Accelerator
AWS-maintained CDK solution for compliant multi-account landing zones. Could inform the Pulumi stack design.

## SDK Changes Required

- Make `PluginConfig.requiredApis` optional (skip API_ENABLEMENT when absent)
- No other SDK changes needed -- CspClient, IaCEngine, HealthChecker map cleanly

## Status

PARKED -- not scheduled for implementation. GCP Assured Workloads is the priority path.
