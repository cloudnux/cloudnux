# @cloudnux/dev-console

## 0.23.0

### Minor Changes

- [`7df9fd0`](https://github.com/cloudnux/cloudnux/commit/7df9fd08833186e861f6cec7a0ca59063c316736) Thanks [@minawalphonce](https://github.com/minawalphonce)! - Support AWS-style `rate()` and `cron()` schedule expressions in the local scheduler (alongside plain unix cron). Rates run at a true fixed interval, `cron()` handles AWS day-of-week numbering, `?`, `L`, `#` and the year field, and invalid expressions now report the reason. The dev console shows a RATE/CRON badge, a human-readable description and the next runs for each schedule.

- [`2dada90`](https://github.com/cloudnux/cloudnux/commit/2dada90162869d80ed88ba2959f0c32049a776c5) Thanks [@minawalphonce](https://github.com/minawalphonce)! - feat(invoke): namespace-qualified invoke targets

  `invoke(target, trigger, payload)` now accepts `module` (caller's own namespace) or `namespace/module`.

  - aws: fix the lambda name, which was missing the namespace; it is now `<namespace>_<module>`. The caller's own namespace is derived from `AWS_LAMBDA_FUNCTION_NAME`
  - local: add `POST /__invoke/:module/:trigger` to the invoke plugin, and call other namespaces over http
  - cli: add `namespaces` to the nux config (namespace -> dev server url) used by the local provider
  - dev-console: show invoke triggers per module, with a detail page to call a trigger with a JSON payload and an execution history of every call (in-process, other namespaces and console)

## 0.22.0

### Minor Changes

- [`61ac5fe`](https://github.com/cloudnux/cloudnux/commit/61ac5feb4e41b34bea60c30ee726cebcc94e768a) Thanks [@minawalphonce](https://github.com/minawalphonce)! - feat(storage): implement local storage service with bucket and object management

  - Add `createStorageService` to handle S3-like storage operations.
  - Introduce `StorageService` interface with methods for writing and reading objects.
  - Implement `listStorageBuckets` and `listStorageObjects` for bucket and object retrieval.
  - Create a storage plugin for serving files via Fastify.
  - Develop a storage page in the dev console for managing and viewing storage objects.
  - Add hooks for fetching storage buckets and objects using React Query.
  - Implement UI components for displaying storage objects and their details.
  - Enhance error handling and validation for bucket names and paths.

## 0.21.0

### Minor Changes

- [#23](https://github.com/cloudnux/cloudnux/pull/23) [`3922866`](https://github.com/cloudnux/cloudnux/commit/392286669aac571684ee0b7c7d8f219444c4af86) Thanks [@minawalphonce](https://github.com/minawalphonce)! - email service .

## 0.20.0

## 0.19.0

### Minor Changes

- [#21](https://github.com/cloudnux/cloudnux/pull/21) [`b714d90`](https://github.com/cloudnux/cloudnux/commit/b714d902bab76f59ac2659bf08faa42d49cd6a74) Thanks [@minawalphonce](https://github.com/minawalphonce)! - create logging service

## 0.18.0

### Minor Changes

- [#19](https://github.com/cloudnux/cloudnux/pull/19) [`d1c8105`](https://github.com/cloudnux/cloudnux/commit/d1c8105c170662a91082653454b2a22975000f35) Thanks [@minawalphonce](https://github.com/minawalphonce)! - add delayed message handling and enhance websocket error management

## 0.17.0

### Minor Changes

- [#17](https://github.com/cloudnux/cloudnux/pull/17) [`f14655d`](https://github.com/cloudnux/cloudnux/commit/f14655d99b763f297bab69e21e56378add69e2f5) Thanks [@minawalphonce](https://github.com/minawalphonce)! - invoke handler
  registry logic
  enhancing type definitions

## 0.16.0

### Minor Changes

- [#16](https://github.com/cloudnux/cloudnux/pull/16) [`557ad6d`](https://github.com/cloudnux/cloudnux/commit/557ad6d72c3f0c632d32ed9a196f810f1576100c) Thanks [@minawalphonce](https://github.com/minawalphonce)! - minor mapping fix for websocket

## 0.15.0

### Minor Changes

- [#15](https://github.com/cloudnux/cloudnux/pull/15) [`11fc7ab`](https://github.com/cloudnux/cloudnux/commit/11fc7ab40f5e532b7424f5b22be6d9d236a79107) Thanks [@minawalphonce](https://github.com/minawalphonce)! - run ci cd

## 0.14.0

### Minor Changes

- [#13](https://github.com/cloudnux/cloudnux/pull/13) [`b3ca362`](https://github.com/cloudnux/cloudnux/commit/b3ca36247701a9bc357dc5862fb201f6acef740c) Thanks [@minawalphonce](https://github.com/minawalphonce)! - publish websocket entrypoint includes and more

## 0.13.0

### Minor Changes

- websocket full support, multi entrypoints with merge

## 0.12.0

### Minor Changes

- remove utils as library as external

## 0.11.0

### Minor Changes

- fix logging and dev-console UI for local dev

## 0.10.0

### Minor Changes

- [#9](https://github.com/cloudnux/cloudnux/pull/9) [`3c1476c`](https://github.com/cloudnux/cloudnux/commit/3c1476cc5f3b8f095ab9f8775cb3513de6373265) Thanks [@minawalphonce](https://github.com/minawalphonce)! - making it all the same version
