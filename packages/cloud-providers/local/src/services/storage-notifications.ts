import * as fs from 'fs';
import * as path from 'path';

import { EventBrokerService, getService, LoggerService } from "@cloudnux/core-cloud-provider";

import { assertValidBucket, getLocalStorageDir, METADATA_SUFFIX } from "./storage";

/**
 * Local counterpart of S3 event notifications: rules that send a message to a
 * queue or a topic when an object is created in a bucket.
 *
 * Rules live in the storage folder itself, in a file ending with the metadata
 * suffix, so the storage plugin never serves it and it never shows up as a
 * bucket or an object.
 */
export const NOTIFICATION_RULES_FILE = `notifications${METADATA_SUFFIX}`;

/** `type` of the message a rule sends; read back by storage.parseObjectCreated() */
export const OBJECT_CREATED_MESSAGE_TYPE = "cloudnux.storage.object.created";

export type StorageNotificationEvent = "created";

export interface StorageNotificationRule {
    /** Unique id of the rule */
    id: string;
    /** Bucket the rule watches */
    bucket: string;
    /** Only keys starting with this prefix @default "" */
    prefix?: string;
    /** Only keys ending with this suffix @default "" */
    suffix?: string;
    /** Events that trigger the rule */
    events: StorageNotificationEvent[];
    /** Queue to send to; exactly one of queue / topic */
    queue?: string;
    /** Topic to publish to (fans out to its subscribed queues); exactly one of queue / topic */
    topic?: string;
}

export interface ObjectCreatedMessage {
    type: typeof OBJECT_CREATED_MESSAGE_TYPE;
    bucket: string;
    key: string;
    size?: number;
    contentType?: string;
    eTag?: string;
}

const KNOWN_EVENTS: StorageNotificationEvent[] = ["created"];
const ID_PATTERN = /^[A-Za-z0-9._-]+$/;

function rulesPath(): string {
    return path.join(getLocalStorageDir(), NOTIFICATION_RULES_FILE);
}

/**
 * Validate a rule; throws with a readable message
 */
export function validateRule(rule: unknown): StorageNotificationRule {
    if (!rule || typeof rule !== "object" || Array.isArray(rule)) {
        throw new Error("A rule must be an object");
    }
    const r = rule as Record<string, unknown>;

    if (typeof r.id !== "string" || !ID_PATTERN.test(r.id)) {
        throw new Error("rule.id is required and may only contain letters, digits, '.', '_' and '-'");
    }
    if (typeof r.bucket !== "string") {
        throw new Error("rule.bucket is required");
    }
    assertValidBucket(r.bucket);

    for (const field of ["prefix", "suffix"] as const) {
        if (r[field] !== undefined && typeof r[field] !== "string") {
            throw new Error(`rule.${field} must be a string`);
        }
    }

    if (!Array.isArray(r.events) || r.events.length === 0 || !r.events.every(e => KNOWN_EVENTS.includes(e as StorageNotificationEvent))) {
        throw new Error(`rule.events must be a non-empty list of: ${KNOWN_EVENTS.join(", ")}`);
    }

    const hasQueue = typeof r.queue === "string" && r.queue.length > 0;
    const hasTopic = typeof r.topic === "string" && r.topic.length > 0;
    if (hasQueue === hasTopic) {
        throw new Error("rule must have exactly one target: queue or topic");
    }

    return {
        id: r.id,
        bucket: r.bucket,
        prefix: (r.prefix as string | undefined) || undefined,
        suffix: (r.suffix as string | undefined) || undefined,
        events: [...new Set(r.events as StorageNotificationEvent[])],
        ...(hasQueue ? { queue: r.queue as string } : { topic: r.topic as string }),
    };
}

/**
 * Read all rules; a missing file means no rules
 */
export async function listNotificationRules(): Promise<StorageNotificationRule[]> {
    try {
        const raw = await fs.promises.readFile(rulesPath(), "utf8");
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map(validateRule) : [];
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
        throw error;
    }
}

async function saveNotificationRules(rules: StorageNotificationRule[]): Promise<void> {
    const file = rulesPath();
    await fs.promises.mkdir(path.dirname(file), { recursive: true });
    // write then rename, so a crash never leaves a half-written rules file
    const tmp = `${file}.${process.pid}.tmp`;
    await fs.promises.writeFile(tmp, JSON.stringify(rules, null, 2), "utf8");
    await fs.promises.rename(tmp, file);
}

/**
 * A readable id for a new rule, unique among the existing rules:
 * "<bucket>-<queue or topic>", then "-2", "-3", ... if taken
 */
export async function generateRuleId(rule: { bucket?: unknown; queue?: unknown; topic?: unknown }): Promise<string> {
    const slug = (value: unknown) => String(value ?? "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
    const base = [slug(rule.bucket), slug(rule.queue ?? rule.topic)].filter(Boolean).join("-") || "rule";
    const taken = new Set((await listNotificationRules()).map(r => r.id));
    if (!taken.has(base)) return base;
    for (let n = 2; ; n++) {
        if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
    }
}

/**
 * Fill in a generated id when the rule has none
 */
export async function withRuleId<T extends Record<string, unknown>>(rule: T): Promise<T & { id: string }> {
    const id = typeof rule.id === "string" && rule.id.trim() !== "" ? rule.id.trim() : await generateRuleId(rule);
    return { ...rule, id };
}

/**
 * Add a rule; without an id one is generated, a given id must be new
 */
export async function addNotificationRule(rule: unknown): Promise<StorageNotificationRule> {
    const valid = validateRule(rule && typeof rule === "object" && !Array.isArray(rule)
        ? await withRuleId(rule as Record<string, unknown>)
        : rule);
    const rules = await listNotificationRules();
    if (rules.some(r => r.id === valid.id)) {
        throw new Error(`A rule with id "${valid.id}" already exists`);
    }
    await saveNotificationRules([...rules, valid]);
    return valid;
}

/**
 * Delete a rule by id
 * @returns false if no rule had that id
 */
export async function deleteNotificationRule(id: string): Promise<boolean> {
    const rules = await listNotificationRules();
    const remaining = rules.filter(r => r.id !== id);
    if (remaining.length === rules.length) return false;
    await saveNotificationRules(remaining);
    return true;
}

/**
 * Rules that match an event on a key
 */
export function matchNotificationRules(
    rules: StorageNotificationRule[],
    bucket: string,
    key: string,
    event: StorageNotificationEvent,
): StorageNotificationRule[] {
    return rules.filter(rule =>
        rule.bucket === bucket &&
        rule.events.includes(event) &&
        key.startsWith(rule.prefix ?? "") &&
        key.endsWith(rule.suffix ?? ""));
}

function logger(): LoggerService | undefined {
    try {
        return getService<LoggerService>("logger");
    } catch {
        return undefined;
    }
}

/**
 * Send the object-created message to every matching rule's queue or topic,
 * through the event broker service (like the cloud, the write itself never
 * fails because of a notification). Called by the local storage service after
 * every successful write, including uploads through a signed URL.
 */
export async function notifyObjectCreated(
    bucket: string,
    key: string,
    info: { size?: number; contentType?: string; eTag?: string } = {},
): Promise<void> {
    let rules: StorageNotificationRule[];
    try {
        rules = matchNotificationRules(await listNotificationRules(), bucket, key, "created");
    } catch (error) {
        logger()?.warn({ error }, "storage notifications: could not read the rules file");
        return;
    }
    if (rules.length === 0) return;

    const message: ObjectCreatedMessage = {
        type: OBJECT_CREATED_MESSAGE_TYPE,
        bucket,
        key,
        size: info.size,
        contentType: info.contentType,
        eTag: info.eTag,
    };

    for (const rule of rules) {
        const target = rule.queue ?? `topic:${rule.topic}`;
        try {
            await getService<EventBrokerService>("event-broker").publish(target, message);
        } catch (error) {
            logger()?.warn({ error, rule: rule.id, target }, "storage notifications: could not deliver the object-created message");
        }
    }
}
