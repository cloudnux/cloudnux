---
"@cloudnux/local-cloud-provider": minor
"@cloudnux/cli": minor
---

Local storage plugin: `PUT /__storage/<bucket>/<key>` for uploads through a signed URL.

The local counterpart of a presigned S3 PUT, so `storage.createUploadUrl()` works end to end in the dev server:

- the body is taken as raw bytes whatever its content type (up to `uploadBodyLimit`, default 500 MB);
- the request must match the signature: not expired, same `Content-Type`, the signed size, and `If-None-Match: *` when the URL was created without `overwrite`;
- `If-None-Match: *` on an existing object answers `412`, like S3;
- the object is written through the local storage service, so its content type is recorded and storage notification rules fire.

The generated dev server sets `DEV_CLOUD_STORAGE_URL` to `http://localhost:<port>/__storage` unless it is already set.
