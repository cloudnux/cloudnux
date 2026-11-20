---
"create-cloudnux": minor
---

Scaffold the local secrets file.

New projects get an empty `.secrets.json` next to `package.json` (git-ignored), and `nux.config.js` wires it into the develop environment on top of the CLI defaults:

```js
import { defaultConfig } from "@cloudnux/cli/defaults";

export default {
    // ...
    "environments": {
        "develop": {
            ...defaultConfig.environments.develop,
            "secretsFile": "./.secrets.json"
        },
        // ...
    }
}
```
