---
"@cloudnux/cli": minor
"@cloudnux/core-cloud-provider": minor
"@cloudnux/dev-console": minor
"@cloudnux/aws-cloud-provider": minor
"@cloudnux/local-cloud-provider": minor
---

feat(invoke): namespace-qualified invoke targets

`invoke(target, trigger, payload)` now accepts `module` (caller's own namespace) or `namespace/module`.

- aws: fix the lambda name, which was missing the namespace; it is now `<namespace>_<module>`. The caller's own namespace is derived from `AWS_LAMBDA_FUNCTION_NAME`
- local: add `POST /__invoke/:module/:trigger` to the invoke plugin, and call other namespaces over http
- cli: add `namespaces` to the nux config (namespace -> dev server url) used by the local provider
- dev-console: show invoke triggers per module, with a detail page to call a trigger with a JSON payload and an execution history of every call (in-process, other namespaces and console)
