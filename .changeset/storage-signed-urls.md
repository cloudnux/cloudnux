---
"@cloudnux/core-cloud-provider": minor
"@cloudnux/cloud-sdk": minor
"@cloudnux/aws-cloud-provider": minor
"@cloudnux/local-cloud-provider": minor
---

Storage service: signed upload/download URLs and object-created events.

- `createUploadUrl(path, bucket, { contentType, contentLength?, expiresIn?, overwrite? })` returns a time-limited URL the client uploads to directly, plus the headers it must send. Content type, size (when given) and, unless `overwrite: true`, `If-None-Match: *` are part of the signature, so the URL can only create that one object, once. Default expiry 300 s.
- `createDownloadUrl(path, bucket, { expiresIn?, contentDisposition? })` returns a time-limited download URL.
- `parseObjectCreated(message)` reads an object-created notification that arrived through a queue or topic and returns `{ bucket, key, size?, contentType?, eTag? }`, or `null` for anything else (e.g. S3's test event). Use it in an event handler: `storage.parseObjectCreated(ctx.message())`.

**aws:** presigned S3 URLs (`@aws-sdk/s3-request-presigner`). Presigning uses its own S3 client with `requestChecksumCalculation: "WHEN_REQUIRED"`, otherwise the SDK signs a checksum of the empty body and every upload fails. `parseObjectCreated` understands S3 event notifications (URL-decoded keys), the same inside an SNS envelope, and EventBridge "Object Created" events.

**local:** URLs point to the dev server's storage plugin (`DEV_CLOUD_STORAGE_URL`, set by the dev server to `http://localhost:<port>/__storage`); uploads are HMAC-signed with a per-process key (or `DEV_CLOUD_STORAGE_SIGNING_KEY`). Download URLs are not signed, the dev server ignores access control. `parseObjectCreated` reads the messages sent by local storage notification rules.

**azure:** not implemented yet (throws).
