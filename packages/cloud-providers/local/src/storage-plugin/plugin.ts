import fs from "node:fs";
import path from "node:path";

import { FastifyInstance, FastifyPluginAsync } from "fastify";
import fsPlugin from "fastify-plugin";
import fastifyStatic from "@fastify/static";

import { getLocalStorageDir, METADATA_SUFFIX } from "../services/storage";
import { StoragePluginOptions } from "./types";

const DEFAULT_PREFIX = "__storage";

/**
 * Read the content type recorded in an object's metadata sidecar, if any
 */
function readSidecarContentType(filePath: string): string | undefined {
    try {
        return JSON.parse(fs.readFileSync(`${filePath}${METADATA_SUFFIX}`, "utf8")).contentType || undefined;
    } catch {
        return undefined;
    }
}

/**
 * Serves every bucket of the local storage directory as static files:
 *   GET /<prefix>/<bucket>/<encoded key>
 * ACLs are ignored - this is the dev server. Metadata sidecars are never served,
 * but the content type recorded in them is used when present.
 */
export const storagePlugin: FastifyPluginAsync<StoragePluginOptions> =
    fsPlugin(async (
        app: FastifyInstance,
        options: StoragePluginOptions
    ) => {
        const root = getLocalStorageDir();
        const prefix = (options.prefix ?? DEFAULT_PREFIX).replace(/^\/+|\/+$/g, "");
        const urlPrefix = `/${prefix}/`;

        if (!fs.existsSync(root)) {
            fs.mkdirSync(root, { recursive: true });
        }

        // Encapsulated scope so the onSend hook only applies to storage routes
        await app.register(async (scope) => {
            // @fastify/static sets Content-Type from the extension after
            // setHeaders runs, so the sidecar's content type is applied here.
            scope.addHook("onSend", async (request, reply, payload) => {
                if (reply.statusCode !== 200 && reply.statusCode !== 206) return payload;
                const urlPath = request.url.split("?")[0];
                if (!urlPath.startsWith(urlPrefix)) return payload;
                try {
                    const relative = decodeURIComponent(urlPath.slice(urlPrefix.length));
                    const contentType = readSidecarContentType(path.join(root, path.normalize(relative)));
                    if (contentType) {
                        reply.header("content-type", contentType);
                    }
                } catch {
                    // malformed URL - keep the inferred type
                }
                return payload;
            });

            await scope.register(fastifyStatic, {
                root,
                prefix: urlPrefix,
                // the dev console already decorates reply.sendFile
                decorateReply: false,
                index: false,
                list: false,
                dotfiles: "allow",
                allowedPath: (pathName) => !pathName.endsWith(METADATA_SUFFIX),
            });
        });
    }, {
        name: "storage-plugin",
    });
