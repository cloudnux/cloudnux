import { EmailService } from "@cloudnux/core-cloud-provider";

import { getCloudProvider } from "../provider";

let _cloudEmail: EmailService | null = null;

export const cloudEmail = () => {
    if (_cloudEmail) {
        return _cloudEmail;
    }
    _cloudEmail = getCloudProvider().createEmailService();
    return _cloudEmail;
}

export const resetCloudEmail = () => {
    _cloudEmail = null;
}