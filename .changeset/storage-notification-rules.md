---
"@cloudnux/local-cloud-provider": minor
"@cloudnux/dev-console": minor
---

Local storage notification rules, the dev server counterpart of S3 event notifications.

A rule sends a message to a queue, or publishes it to a topic, when an object is created in a bucket:

```json
{ "id": "invoice-uploads", "bucket": "invoices", "prefix": "uploads/", "suffix": "", "events": ["created"], "queue": "invoice-processing" }
```

- Exactly one target per rule: `queue` or `topic` (a topic fans out to its subscribed queues).
- Every successful write fires the matching rules: uploads through a signed URL and `storage.write()` from code, like S3 does. A failed delivery is logged and never fails the write.
- The message is `{ type: "cloudnux.storage.object.created", bucket, key, size, contentType, eTag }`; read it with `storage.parseObjectCreated(ctx.message())`, the same call as in the cloud.
- Rules are stored in the storage folder as `notifications.metadata.json`: the storage plugin never serves files ending in `.metadata.json`, and the file never shows up as a bucket or an object.
- Dev console: a Notifications section on the Storage page to list, add and delete rules, backed by `GET/POST /console/storage-notifications` and `DELETE /console/storage-notifications/:id`. Bucket and target are chosen from dropdowns of the existing buckets, queues and topics (topic subscriber queues are left out, target the topic instead); the server checks that the target exists.
- The rule id is optional: without one, a readable id is generated from bucket and target (`invoices-invoice-processing`, then `-2`, `-3`, ...).
