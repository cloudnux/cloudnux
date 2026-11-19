# @cloudnux/azure-cloud-provider

Azure implementation of the cloudnux `CloudProvider`. Work in progress: services land one at a time, and any service not listed below throws `not implemented yet` on first use.

| Service | Status | Backed by |
|---|---|---|
| storage | ✅ | Azure Blob Storage (`@azure/storage-blob`) |
| event-broker | ✅ | Azure Service Bus (`@azure/service-bus`) |
| location | ✅ | Azure Maps REST (Search 2026-01-01, Route 2025-01-01) |
| logger | ✅ | JSON lines on stdout, `AsyncLocalStorage` context |
| email | ✅ | Azure Communication Services (`@azure/communication-email`) |
| functions, invoke, websocket | later | — |

```ts
import { useCloudProvider } from "@cloudnux/cloud-sdk";
import { azureCloudProvider } from "@cloudnux/azure-cloud-provider";

useCloudProvider(azureCloudProvider);
```

## Storage

`bucket` is the **storage account name**. `path` is `<container>/<blob name>`, e.g. `write("uploads/2026/a.png", data, "mediaacct")`. One client is created per account, on first use. Containers are not created automatically.

### Configuration

| Env var | Purpose |
|---|---|
| `AZURE_STORAGE_BLOB_ENDPOINT` | Optional endpoint template with an `{account}` placeholder. Default `https://{account}.blob.core.windows.net`. |
| `AZURE_STORAGE_CONNECTION_STRING` | Optional. Used only for the account named in its `AccountName` (Azurite, CI). |

Every other account authenticates with `DefaultAzureCredential` (managed identity in Azure, `az login` locally). The identity needs **Storage Blob Data Contributor** on each account it uses.

### Differences from AWS, handled by the adapter

- **Metadata keys** must be C# identifiers on Azure. Keys are rewritten: invalid characters become `_`, and a leading digit gets an `_` prefix (`content-owner` → `content_owner`). Azure returns keys lower-cased.
- **`acl`** has no per-blob equivalent (access is per container). It is ignored, with a one-time warning when it isn't `private`.
- **`delete()`** of a missing blob resolves, matching S3. Snapshots are deleted with the blob.
- **`key` / `encodedKey`** in the write result are the full path including the container, so `https://<account>.blob.core.windows.net/` + `encodedKey` is the blob URL.
- **`read()`** of a missing blob rejects with a `RestError` (`statusCode` 404), the way the AWS adapter surfaces S3's `NoSuchKey`.

## Location

| Env var | Purpose |
|---|---|
| `AZURE_MAPS_KEY` | Subscription key. Used when set (or `config.apiKey`). |
| `AZURE_MAPS_CLIENT_ID` | Maps account client ID, for Entra ID auth via `DefaultAzureCredential` when there's no key. The identity needs the **Azure Maps Data Reader** role. |
| `AZURE_MAPS_ENDPOINT` | Optional. Default `https://atlas.microsoft.com`. |

- **Suggestions have no coordinates.** Azure's autocomplete returns none. Each suggestion's `placeId` is an opaque token; pass it to `getLocationDetails()` to get coordinates and the full address, the same flow as on AWS.
- **Country codes** stay ISO alpha-3 in the interface; the adapter converts to and from Azure's alpha-2. Autocomplete accepts one country, so with several `countries` the results are filtered client-side.
- `sampledPoints` and `bbox` are computed from the route geometry, as in the AWS adapter.

## Event broker

- **`publish(target)`**: `target` is `<namespace>/<queue or topic>`, e.g. `myns/orders`.
- **`peek(source)` / `read(source)`**: `source` is `<namespace>/<queue>` or `<namespace>/<topic>/<subscription>`.
- A bare namespace becomes `<namespace>.servicebus.windows.net`; a value with a dot is used as the host.
- Auth is `DefaultAzureCredential` (needs **Azure Service Bus Data Sender** / **Data Receiver**). `AZURE_SERVICEBUS_CONNECTION_STRING` is used only for the namespace named in its `Endpoint` (emulator, CI).
- `messageGroupId` → `sessionId`, `messageDeduplicationId` → `messageId` (needs duplicate detection on the entity), `delaySeconds` → `scheduledEnqueueTimeUtc`. Bodies are sent as strings, like on AWS.
- `peek` is non-destructive. `read` uses receive-and-delete. `visibilityTimeout` has no per-call equivalent on Service Bus (lock duration is set on the entity) and is ignored. Session-enabled queues aren't supported by `peek`/`read` yet.

## Email

Sends through [Azure Communication Services](https://learn.microsoft.com/azure/communication-services/concepts/email/email-overview) (ACS). The sender address must belong to a domain linked to the ACS resource (an Azure-managed `DoNotReply@<id>.azurecomm.net` or your own verified domain).

### Configuration

| Variable | Purpose |
|---|---|
| `AZURE_COMMUNICATION_RESOURCE` | Default ACS resource: `<name>` or `<name>.<data location>` |
| `AZURE_COMMUNICATION_DATA_LOCATION` | Data location used when the resource has none (default `europe`) |
| `AZURE_COMMUNICATION_CONNECTION_STRING` | Optional. Used only for the resource it points at; others use `DefaultAzureCredential` |

`message.configurationSet` picks another ACS resource for one message, in the same format:

```ts
await email.send({ ...message, configurationSet: 'marketing' });              // https://marketing.europe.communication.azure.com
await email.send({ ...message, configurationSet: 'marketing.unitedstates' }); // overrides the data location
```

With Entra ID the identity needs the **Communication and Email Service Owner** role on the ACS resource.

### Differences from AWS, handled by the adapter

- `send` returns `sent` once ACS has accepted the message, as SES does. The message id is the ACS operation id. Later problems (bounces, suppressed recipients) arrive as Event Grid events, not in the result.
- ACS takes the sender's display name from the domain settings, so `"Name <addr>"` in `from` only uses the address. Display names in `to`/`cc`/`bcc` are kept.
- `metadata` becomes custom headers.

## Logger

One JSON line per entry, with `module`/`reqId` held in `AsyncLocalStorage` (Azure Functions runs invocations concurrently in one process).

- **Inside an invocation**, the function service calls `runWithLogContext({ module, reqId, invocation: context }, fn)`. Lines then go through `context.error/warn/info/debug/trace`, so Application Insights links them to the invocation and records the real severity (`fatal` maps to `error`).
- **Outside an invocation** (startup, scripts, standalone use), lines go to stdout. App Insights still ingests them, but as app-level traces with no invocation link.
- `setBindings` changes `module`/`reqId` for the current invocation only, or the process-wide defaults when called outside one. It never replaces the invocation context.

## Tests

`yarn test` starts an in-memory Azurite on a free port, so no Docker or Azure account is needed. Set `AZURE_STORAGE_CONNECTION_STRING` to run against another endpoint instead. Service Bus and Maps are covered with fakes here; the live tests below hit the real services.

### Live tests (real Azure)

```bash
az login
LIVE_EMAIL_TO=you@example.com \
./scripts/live-env.sh up        # resource group with storage, Service Bus (Standard), Maps, email; writes .env.live
yarn test:live                  # keys / connection strings
yarn test:live:entra            # same tests through DefaultAzureCredential (needs the roles `up` grants; allow a few minutes)
./scripts/live-env.sh down      # delete the resource group and .env.live
```

- `.env.live` holds keys and is git-ignored. Values already in your shell take precedence over it.
- Each service's suite is skipped when it isn't configured, so you can point `LIVE_STORAGE_ACCOUNT`, `LIVE_SERVICEBUS_NAMESPACE`, `AZURE_MAPS_KEY` or `AZURE_COMMUNICATION_RESOURCE` + `LIVE_EMAIL_FROM` at existing resources instead of running the script.
- Service Bus Standard has a small hourly base charge; run `down` when you're done.
- Email: the send test goes to `LIVE_EMAIL_TO` and is skipped without it (edit `.env.live` to add it later). For an environment made before email was added, `./scripts/live-env.sh email` adds it.
- Region: `LIVE_LOCATION` (default `swedencentral`), `LIVE_MAPS_LOCATION` (default `westeurope`).

| Suite | What it checks against the real service |
|---|---|
| storage | 2 MB round trip, metadata key sanitizing accepted by Azure, keys with spaces/`#`/non-ASCII and `encodedKey` matching the blob URL, overwrite, missing-blob behaviour, delete |
| event broker | peek leaves messages and read removes them, string/object bodies and attributes round-trip, dedup id becomes the message id, topic → subscription delivery, `delaySeconds` holds a message back |
| email | ACS accepts a message with html, text and an attachment (check the inbox); an unlinked sender domain returns `failed` instead of throwing |
| location | route Stockholm → Arlanda → Uppsala (legs, geometry order, bbox, samples), suggestions → `getLocationDetails` for an address and a place, multi-country filtering, reverse geocoding |
