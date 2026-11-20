import fs from "node:fs";
import path from "node:path";

import { FastifyInstance, FastifyPluginAsync } from "fastify";
import fsPlugin from "fastify-plugin";
import fastifyStatic from "@fastify/static";

import { createLocalStorageService, getLocalStorageDir, METADATA_SUFFIX } from "../services/storage";
import { verifyUpload } from "../services/storage-signing";
import { StoragePluginOptions } from "./types";

const DEFAULT_PREFIX = "__storage";
const DEFAULT_UPLOAD_BODY_LIMIT = 500 * 1024 * 1024;

/**
 * Split "/<prefix>/<bucket>/<encoded key>" into bucket and decoded key
 */
function parseObjectUrl(urlPath: string, urlPrefix: string): { bucket: string; key: string } | null {
    if (!urlPath.startsWith(urlPrefix)) return null;
    const rest = urlPath.slice(urlPrefix.length);
    const slash = rest.indexOf("/");
    if (slash <= 0 || slash === rest.length - 1) return null;
    try {
        return {
            bucket: decodeURIComponent(rest.slice(0, slash)),
            key: rest.slice(slash + 1).split("/").map(decodeURIComponent).join("/"),
        };
    } catch {
        return null;
    }
}

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

        // Uploads through a signed URL (storage.createUploadUrl), the local
        // counterpart of a presigned S3 PUT: the body is taken as raw bytes
        // whatever its content type, checked against the signature, and written
        // through the local storage service - which also fires the matching
        // storage notification rules.
        await app.register(async (uploads) => {
            uploads.removeAllContentTypeParsers();
            uploads.addContentTypeParser(
                "*",
                { parseAs: "buffer", bodyLimit: options.uploadBodyLimit ?? DEFAULT_UPLOAD_BODY_LIMIT },
                (_request, body, done) => done(null, body),
            );

            uploads.put(`${urlPrefix}*`, async (request, reply) => {
                const target = parseObjectUrl(request.url.split("?")[0], urlPrefix);
                if (!target) {
                    return reply.status(400).send({ error: `Expected PUT ${urlPrefix}<bucket>/<key>` });
                }

                const body = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
                const verification = verifyUpload({
                    bucket: target.bucket,
                    key: target.key,
                    query: request.query as Record<string, string | undefined>,
                    contentType: request.headers["content-type"],
                    ifNoneMatch: request.headers["if-none-match"] as string | undefined,
                    bodyLength: body.length,
                });
                if (!verification.ok) {
                    return reply.status(verification.status).send({ error: verification.error });
                }

                const storage = createLocalStorageService();
                if (verification.ifNoneMatch && await storage.exists(target.key, target.bucket)) {
                    return reply.status(412).send({ error: "PreconditionFailed: the object already exists" });
                }

                await storage.write(target.key, body, target.bucket, { contentType: verification.contentType });
                return reply.status(200).send();
            });
        });

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
