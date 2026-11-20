---
"@cloudnux/cli": patch
"@cloudnux/local-cloud-provider": minor
---

Default `DEV_CLOUD_EVENT_BROKER_URL` to this dev server again, and check storage notification targets where messages are delivered.

- The generated dev server sets `DEV_CLOUD_EVENT_BROKER_URL` to `http://localhost:<port>/queues` unless it is already set. Since the local event broker lost its built-in default, `publish()` without the variable built a relative URL and failed; set it only to deliver to another dev server.
- Queue plugin: `GET /queues/topics/:topic` returns the queues subscribed to a topic, `404` if there are none (the counterpart of the existing `GET /queues/:queue`).
- Adding a storage notification rule in the dev console checks the queue or topic on the dev server `DEV_CLOUD_EVENT_BROKER_URL` points to, so rules can target queues of another dev server. Without the variable, it checks this dev server's own queues and topics.
