import { FastifyPluginOptions } from "fastify";

export interface StoragePluginOptions extends FastifyPluginOptions {
    /**
     * URL prefix the buckets are served under (default "__storage"),
     * giving URLs of the form /<prefix>/<bucket>/<key>
     */
    prefix?: string;
}
