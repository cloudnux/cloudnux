import { InvokeService } from "@cloudnux/core-cloud-provider";

import { getCloudProvider } from "../provider";

let _cloudInvoke: InvokeService | null = null;

export const cloudInvoke = () => {
    if (_cloudInvoke) {
        return _cloudInvoke;
    }
    _cloudInvoke = getCloudProvider().createInvokeService();
    return _cloudInvoke;
}

export const resetCloudInvoke = () => {
    _cloudInvoke = null;
}
