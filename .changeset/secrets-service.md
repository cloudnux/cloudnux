---
"@cloudnux/cli": minor
"@cloudnux/core-cloud-provider": minor
"@cloudnux/cloud-sdk": minor
"@cloudnux/aws-cloud-provider": minor
"@cloudnux/local-cloud-provider": minor
---

Add a `secrets` service for reading secrets from the cloud's secret store.

```ts
import { cloudSecrets } from "@cloudnux/cloud-sdk";

const values = await cloudSecrets().getMany(["/app/prod/database-password", "/app/prod/api-key"]);
```

- `get(name)` and `getMany(names)`; a missing secret throws `SecretsNotFoundError` listing every missing name.
- **aws:** the store is chosen per function with the `CLOUDNUX_SECRETS_STORE` environment variable: `ssm` (default, SSM Parameter Store with decryption, `GetParameters` in batches of 10) or `secrets-manager` (`BatchGetSecretValue` in batches of 20, by name or ARN). Values are cached for the lifetime of the instance. The function's role needs `ssm:GetParameters` (+ `kms:Decrypt` for SecureString) or `secretsmanager:BatchGetSecretValue` + `secretsmanager:GetSecretValue`.
- **local:** reads a JSON file of `name -> value`, keyed by the same names as in the cloud store, so a cold start hook runs the same code locally and in the cloud:
  ```json
  { "/app/dev/database-password": "dev" }
  ```
  The file is `environments.develop.secretsFile` in `nux.config` (default `./.secrets.json`, next to `.env`, resolved from the directory the cli is invoked from; not in the disposable `.nux` folder). Add it to `.gitignore`. It is read on every call, so edits apply without a restart. There is no fallback to the process environment: a missing secret throws `SecretsNotFoundError` naming the missing secrets and the file.
- **azure:** not implemented yet (throws on first use).
- Any other store (e.g. AppConfig) can be plugged in with a `services: { secrets: "./my-secrets.ts" }` override.

Typically used from a `coldStart` hook to load secrets into `process.env` once per instance.
