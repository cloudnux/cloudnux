import { SecretsService } from "@cloudnux/core-cloud-provider";

import { getCloudProvider } from "../provider";

let _cloudSecrets: SecretsService | null = null;

export const cloudSecrets = () => {
    if (_cloudSecrets) {
        return _cloudSecrets;
    }
    _cloudSecrets = getCloudProvider().createSecretsService();
    return _cloudSecrets;
}

export const resetCloudSecrets = () => {
    _cloudSecrets = null;
}
