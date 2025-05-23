import { storage } from "@@cloud";

import type { Content, Options, Storage } from "@@types";

async function remove(source: string, url: string) {
    return storage.remove(source, url);
}

async function write(source: string, url: string, body: Content) {
    return storage.write(source, url, body);
}

async function read(source: string, url: string, options?: Options): Promise<Content> {
    return storage.read(source, url, options);
}

export const cloudStorage: Storage = {
    remove,
    write,
    read
}