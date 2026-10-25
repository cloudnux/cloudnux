---
"@cloudnux/core-cloud-provider": minor
"@cloudnux/cloud-sdk": minor
"@cloudnux/aws-cloud-provider": minor
"@cloudnux/local-cloud-provider": minor
---

Invoke responses now behave the same on AWS and locally. `invoke()` returns the data passed to `context.success()`, and throws an `InvokeError` (with `code` and `details`) when the invoked function ends with `context.error()`, `notFound()` or `serverError()`. `context.error()` on an invoke context accepts any string code and an optional `details` object. A function that throws still surfaces as a plain `Error`.

Breaking: the invoked function now returns the whole response object to the invoke client, so caller and callee must both run this version.
