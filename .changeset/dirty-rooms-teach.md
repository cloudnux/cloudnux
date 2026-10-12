---
"@cloudnux/local-cloud-provider": minor
"@cloudnux/core-cloud-provider": minor
"@cloudnux/aws-cloud-provider": minor
"@cloudnux/dev-console": minor
"@cloudnux/cli": minor
"@cloudnux/cloud-sdk": minor
---
feat(storage): implement local storage service with bucket and object management

- Add `createStorageService` to handle S3-like storage operations.
- Introduce `StorageService` interface with methods for writing and reading objects.
- Implement `listStorageBuckets` and `listStorageObjects` for bucket and object retrieval.
- Create a storage plugin for serving files via Fastify.
- Develop a storage page in the dev console for managing and viewing storage objects.
- Add hooks for fetching storage buckets and objects using React Query.
- Implement UI components for displaying storage objects and their details.
- Enhance error handling and validation for bucket names and paths.