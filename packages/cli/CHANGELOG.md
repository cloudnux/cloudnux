# @cloudnux/cli

## 0.17.0

### Minor Changes

- [#17](https://github.com/cloudnux/cloudnux/pull/17) [`2add6db`](https://github.com/cloudnux/cloudnux/commit/2add6db77fb7773da7c3fc8e0c19cd5031971783) Thanks [@minawalphonce](https://github.com/minawalphonce)! - feat: implement invoke service for AWS and local providers

  - Added AWS Lambda invoke service in `packages/cloud-providers/aws/src/services/invoke.ts`.
  - Created core invoke entry and service interfaces in `packages/cloud-providers/core/src/entrypoint/invoke.ts` and `packages/cloud-providers/core/src/services/invoke.ts`.
  - Developed local invoke plugin with registration and handler management in `packages/cloud-providers/local/src/invoke-plugin`.
  - Introduced invoke context creation and handler execution in SDK services for function invocation in `packages/sdk/src/services/functions/invoke`.
  - Implemented cloud invoke service initialization in `packages/sdk/src/services/invoke.ts`.

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

### Patch Changes

- Updated dependencies []:
  - @cloudnux/local-cloud-provider@0.12.0
  - @cloudnux/aws-cloud-provider@0.12.0
  - @cloudnux/dev-console@0.12.0
  - @cloudnux/cloud-sdk@0.12.0

## 0.11.0

### Minor Changes

- fix logging and dev-console UI for local dev

### Patch Changes

- Updated dependencies []:
  - @cloudnux/local-cloud-provider@0.11.0
  - @cloudnux/dev-console@0.11.0
  - @cloudnux/cloud-sdk@0.11.0
  - @cloudnux/aws-cloud-provider@0.11.0

## 0.10.0

### Minor Changes

- [#9](https://github.com/cloudnux/cloudnux/pull/9) [`3c1476c`](https://github.com/cloudnux/cloudnux/commit/3c1476cc5f3b8f095ab9f8775cb3513de6373265) Thanks [@minawalphonce](https://github.com/minawalphonce)! - making it all the same version

### Patch Changes

- Updated dependencies [[`3c1476c`](https://github.com/cloudnux/cloudnux/commit/3c1476cc5f3b8f095ab9f8775cb3513de6373265)]:
  - @cloudnux/local-cloud-provider@0.10.0
  - @cloudnux/aws-cloud-provider@0.10.0
  - @cloudnux/cloud-sdk@0.10.0
  - @cloudnux/dev-console@0.10.0

## 0.2.0

### Minor Changes

- [#7](https://github.com/cloudnux/cloudnux/pull/7) [`f1a14bb`](https://github.com/cloudnux/cloudnux/commit/f1a14bbc0196ea213004156562db04e797f4a98e) Thanks [@minawalphonce](https://github.com/minawalphonce)! - - normalize queue and schedule
  - implement websocket
  - release CLI

### Patch Changes

- Updated dependencies [[`f1a14bb`](https://github.com/cloudnux/cloudnux/commit/f1a14bbc0196ea213004156562db04e797f4a98e)]:
  - @cloudnux/local-cloud-provider@0.8.0
  - @cloudnux/aws-cloud-provider@0.9.0
  - @cloudnux/cloud-sdk@0.6.0

## 0.1.0

### Minor Changes

- [`4ea1676`](https://github.com/cloudnux/cloudnux/commit/4ea167631da265505e5abf75d398dcc2dffea4e1) Thanks [@minawalphonce](https://github.com/minawalphonce)! - beta version

## 0.0.2

### Patch Changes

- [`c0f6e26`](https://github.com/cloudnux/cloudnux/commit/c0f6e2601040228afdfced540fcd2cc324b7c941) Thanks [@minawalphonce](https://github.com/minawalphonce)! - fix all type-check and linting
