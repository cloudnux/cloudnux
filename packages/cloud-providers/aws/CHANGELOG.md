# @cloudnux/aws-cloud-provider

## 0.20.0

### Patch Changes

- Updated dependencies []:
  - @cloudnux/core-cloud-provider@0.20.0

## 0.19.0

### Minor Changes

- [#21](https://github.com/cloudnux/cloudnux/pull/21) [`b714d90`](https://github.com/cloudnux/cloudnux/commit/b714d902bab76f59ac2659bf08faa42d49cd6a74) Thanks [@minawalphonce](https://github.com/minawalphonce)! - create logging service

### Patch Changes

- Updated dependencies [[`b714d90`](https://github.com/cloudnux/cloudnux/commit/b714d902bab76f59ac2659bf08faa42d49cd6a74)]:
  - @cloudnux/core-cloud-provider@0.19.0

## 0.18.0

### Minor Changes

- [#19](https://github.com/cloudnux/cloudnux/pull/19) [`d1c8105`](https://github.com/cloudnux/cloudnux/commit/d1c8105c170662a91082653454b2a22975000f35) Thanks [@minawalphonce](https://github.com/minawalphonce)! - add delayed message handling and enhance websocket error management

### Patch Changes

- Updated dependencies [[`d1c8105`](https://github.com/cloudnux/cloudnux/commit/d1c8105c170662a91082653454b2a22975000f35)]:
  - @cloudnux/core-cloud-provider@0.18.0

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

### Patch Changes

- Updated dependencies [[`2add6db`](https://github.com/cloudnux/cloudnux/commit/2add6db77fb7773da7c3fc8e0c19cd5031971783), [`f14655d`](https://github.com/cloudnux/cloudnux/commit/f14655d99b763f297bab69e21e56378add69e2f5)]:
  - @cloudnux/core-cloud-provider@0.17.0

## 0.16.0

### Minor Changes

- [#16](https://github.com/cloudnux/cloudnux/pull/16) [`557ad6d`](https://github.com/cloudnux/cloudnux/commit/557ad6d72c3f0c632d32ed9a196f810f1576100c) Thanks [@minawalphonce](https://github.com/minawalphonce)! - minor mapping fix for websocket

### Patch Changes

- Updated dependencies [[`557ad6d`](https://github.com/cloudnux/cloudnux/commit/557ad6d72c3f0c632d32ed9a196f810f1576100c)]:
  - @cloudnux/core-cloud-provider@0.16.0

## 0.15.0

### Minor Changes

- [#15](https://github.com/cloudnux/cloudnux/pull/15) [`11fc7ab`](https://github.com/cloudnux/cloudnux/commit/11fc7ab40f5e532b7424f5b22be6d9d236a79107) Thanks [@minawalphonce](https://github.com/minawalphonce)! - run ci cd

### Patch Changes

- Updated dependencies [[`11fc7ab`](https://github.com/cloudnux/cloudnux/commit/11fc7ab40f5e532b7424f5b22be6d9d236a79107)]:
  - @cloudnux/core-cloud-provider@0.15.0

## 0.14.0

### Minor Changes

- [#13](https://github.com/cloudnux/cloudnux/pull/13) [`b3ca362`](https://github.com/cloudnux/cloudnux/commit/b3ca36247701a9bc357dc5862fb201f6acef740c) Thanks [@minawalphonce](https://github.com/minawalphonce)! - publish websocket entrypoint includes and more

### Patch Changes

- Updated dependencies [[`b3ca362`](https://github.com/cloudnux/cloudnux/commit/b3ca36247701a9bc357dc5862fb201f6acef740c)]:
  - @cloudnux/core-cloud-provider@0.14.0

## 0.13.0

### Minor Changes

- websocket full support, multi entrypoints with merge

### Patch Changes

- Updated dependencies []:
  - @cloudnux/core-cloud-provider@0.13.0

## 0.12.0

### Minor Changes

- remove utils as library as external

### Patch Changes

- Updated dependencies []:
  - @cloudnux/core-cloud-provider@0.12.0

## 0.11.0

### Patch Changes

- Updated dependencies []:
  - @cloudnux/core-cloud-provider@0.11.0

## 0.10.0

### Minor Changes

- [#9](https://github.com/cloudnux/cloudnux/pull/9) [`3c1476c`](https://github.com/cloudnux/cloudnux/commit/3c1476cc5f3b8f095ab9f8775cb3513de6373265) Thanks [@minawalphonce](https://github.com/minawalphonce)! - making it all the same version

### Patch Changes

- Updated dependencies [[`3c1476c`](https://github.com/cloudnux/cloudnux/commit/3c1476cc5f3b8f095ab9f8775cb3513de6373265)]:
  - @cloudnux/core-cloud-provider@0.10.0

## 0.9.0

### Minor Changes

- [#7](https://github.com/cloudnux/cloudnux/pull/7) [`f1a14bb`](https://github.com/cloudnux/cloudnux/commit/f1a14bbc0196ea213004156562db04e797f4a98e) Thanks [@minawalphonce](https://github.com/minawalphonce)! - - normalize queue and schedule
  - implement websocket
  - release CLI

### Patch Changes

- Updated dependencies [[`f1a14bb`](https://github.com/cloudnux/cloudnux/commit/f1a14bbc0196ea213004156562db04e797f4a98e)]:
  - @cloudnux/core-cloud-provider@0.6.0

## 0.8.0

### Minor Changes

- [#6](https://github.com/cloudnux/cloudnux/pull/6) [`700f5fc`](https://github.com/cloudnux/cloudnux/commit/700f5fca9c6eb71a10706d3313cbbe7a66cdc5f4) Thanks [@minawalphonce](https://github.com/minawalphonce)! - add coordinates to aws location

## 0.7.1

### Patch Changes

- Updated dependencies [[`a3066d9`](https://github.com/cloudnux/cloudnux/commit/a3066d92d0bc23495c561d9bdb9bd8be53abef93)]:
  - @cloudnux/core-cloud-provider@0.5.0

## 0.7.0

### Minor Changes

- adding route planning to location service

### Patch Changes

- Updated dependencies []:
  - @cloudnux/core-cloud-provider@0.4.0

## 0.6.0

### Minor Changes

- [#3](https://github.com/cloudnux/cloudnux/pull/3) [`15e046b`](https://github.com/cloudnux/cloudnux/commit/15e046b2e3daae0e1b9d83ea38518acbc09bbfa0) Thanks [@IIslam](https://github.com/IIslam)! - update location service contract

- [#3](https://github.com/cloudnux/cloudnux/pull/3) [`b1b28f1`](https://github.com/cloudnux/cloudnux/commit/b1b28f17af60969fc3504cdafdd646e219bfb244) Thanks [@IIslam](https://github.com/IIslam)! - fix schedule and sqs handlers

### Patch Changes

- Updated dependencies [[`15e046b`](https://github.com/cloudnux/cloudnux/commit/15e046b2e3daae0e1b9d83ea38518acbc09bbfa0)]:
  - @cloudnux/core-cloud-provider@0.3.0

## 0.5.0

### Minor Changes

- targetting only ESM build

### Patch Changes

- Updated dependencies []:
  - @cloudnux/core-cloud-provider@0.2.0

## 0.4.0

### Minor Changes

- fix schedule and sqs handlers

## 0.3.0

### Minor Changes

- change the log to text. change the routing comparision to ignore case

## 0.2.0

### Minor Changes

- [`d2d16b1`](https://github.com/cloudnux/cloudnux/commit/d2d16b114d413f6e76eeabfd6214a71052575b5e) Thanks [@minawalphonce](https://github.com/minawalphonce)! - beta version

### Patch Changes

- Updated dependencies [[`d2d16b1`](https://github.com/cloudnux/cloudnux/commit/d2d16b114d413f6e76eeabfd6214a71052575b5e)]:
  - @cloudnux/core-cloud-provider@0.1.0

## 0.1.0

### Minor Changes

- [`4ea1676`](https://github.com/cloudnux/cloudnux/commit/4ea167631da265505e5abf75d398dcc2dffea4e1) Thanks [@minawalphonce](https://github.com/minawalphonce)! - beta version

## 0.0.2

### Patch Changes

- [`c0f6e26`](https://github.com/cloudnux/cloudnux/commit/c0f6e2601040228afdfced540fcd2cc324b7c941) Thanks [@minawalphonce](https://github.com/minawalphonce)! - fix all type-check and linting

- [`fb148e6`](https://github.com/cloudnux/cloudnux/commit/fb148e65fec7663be748a85e10402edb544fab71) Thanks [@minawalphonce](https://github.com/minawalphonce)! - basic implementation of the aws cloud provider and fastify cloud provider

- Updated dependencies [[`c0f6e26`](https://github.com/cloudnux/cloudnux/commit/c0f6e2601040228afdfced540fcd2cc324b7c941), [`fb148e6`](https://github.com/cloudnux/cloudnux/commit/fb148e65fec7663be748a85e10402edb544fab71)]:
  - @cloudnux/core-cloud-provider@0.0.2
