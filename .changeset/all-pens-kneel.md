---
"@cloudnux/local-cloud-provider": minor
"@cloudnux/core-cloud-provider": minor
"@cloudnux/aws-cloud-provider": minor
"@cloudnux/cli": minor
"@cloudnux/cloud-sdk": minor
---

feat: implement invoke service for AWS and local providers

- Added AWS Lambda invoke service in `packages/cloud-providers/aws/src/services/invoke.ts`.
- Created core invoke entry and service interfaces in `packages/cloud-providers/core/src/entrypoint/invoke.ts` and `packages/cloud-providers/core/src/services/invoke.ts`.
- Developed local invoke plugin with registration and handler management in `packages/cloud-providers/local/src/invoke-plugin`.
- Introduced invoke context creation and handler execution in SDK services for function invocation in `packages/sdk/src/services/functions/invoke`.
- Implemented cloud invoke service initialization in `packages/sdk/src/services/invoke.ts`.
