---
"@cloudnux/cli": minor
---

Add a `coldStart` lifecycle hook.

Configure it in `nux.config` with the path of a module whose default export is `async (moduleName: string) => void`:

```js
export default {
    hooks: { coldStart: "./packages/utils/src/cold-start.ts" },
};
```

- **aws:** the generated entrypoint calls the hook once per Lambda instance, in the init phase, after the cloud provider is set up and before the module's code is loaded. A thrown error fails the init.
- **local:** the dev server calls the hook once per module, before loading that module.

The module itself is now always loaded with a dynamic `import()` after `useCloudProvider()` (in both the aws entrypoint and the local dev server). Before, it was imported statically and evaluated before the provider was registered, so a module that used a cloudnux service at import time failed with "Cloud provider is not defined". esbuild keeps the dynamic import inside the bundle.

Hook paths are resolved relative to the directory the cli is invoked from, like `services` overrides.
