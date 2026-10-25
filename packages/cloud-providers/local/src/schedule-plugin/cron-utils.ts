import { parseExpression } from 'cron-parser';

/**
 * Schedule expression support, mirroring EventBridge Scheduler:
 *  - rate(5 minutes) / rate(1 hour) / rate(7 days)
 *  - cron(min hour day-of-month month day-of-week year)  e.g. cron(0 12 * * ? *)
 *  - plain unix cron (5/6/7 fields)
 *
 * The original expression is always kept as the job's `cronExpression` so the
 * dev console shows exactly what was deployed; it is parsed here on demand.
 */

interface CronParseOptions {
    preserveNaturalTiming?: boolean;
    timezone?: string;
    utc?: boolean;
    currentDate?: Date;
    endDate?: Date;
    iterator?: boolean;
}

interface CronParseResult {
    nextRun: Date;
    isValid: boolean;
    error?: string;
    pattern?: string;
    description?: string;
}

type ParsedSchedule =
    | { kind: 'rate'; intervalMs: number; description: string }
    | { kind: 'cron'; expression: string; yearSpec?: string };

const RATE_PATTERN = /^rate\(\s*(\d+)\s+(minute|minutes|hour|hours|day|days)\s*\)$/i;
const AWS_CRON_PATTERN = /^cron\(\s*([^)]*?)\s*\)$/i;
const UNIT_MS = { minute: 60_000, hour: 3_600_000, day: 86_400_000 } as const;

function parseRate(expression: string): ParsedSchedule {
    const match = expression.trim().match(RATE_PATTERN);
    if (!match) {
        throw new Error('Invalid rate expression format. Expected: rate(value unit)');
    }
    const value = parseInt(match[1], 10);
    const unitWord = match[2].toLowerCase();
    const unit = unitWord.replace(/s$/, '') as keyof typeof UNIT_MS;

    if (value <= 0) {
        throw new Error('Rate value must be greater than 0');
    }
    // Same rule AWS enforces: singular unit only for 1, plural otherwise
    if (value === 1 && unitWord.endsWith('s')) {
        throw new Error(`Invalid rate expression: use "rate(1 ${unit})" (singular) when the value is 1`);
    }
    if (value > 1 && !unitWord.endsWith('s')) {
        throw new Error(`Invalid rate expression: use "rate(${value} ${unit}s)" (plural) when the value is greater than 1`);
    }

    return {
        kind: 'rate',
        intervalMs: value * UNIT_MS[unit],
        description: value === 1 ? `Every ${unit}` : `Every ${value} ${unit}s`,
    };
}

const AWS_DOW_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// AWS day-of-week is 1-7 (SUN=1); cron-parser is 0-6 (SUN=0)
function awsDowToken(token: string): string {
    const upper = token.toUpperCase();
    if (AWS_DOW_NAMES.includes(upper)) return upper;
    if (/^[1-7]$/.test(token)) return String(parseInt(token, 10) - 1);
    throw new Error(`Invalid day-of-week value: ${token}`);
}

function convertAwsDayOfWeek(field: string): string {
    if (field === '?' || field === '*') return '*';
    if (field.toUpperCase() === 'L') return '6'; // bare L = last day of the week (SAT)

    return field.split(',').map(item => {
        const [base, step] = item.split('/');
        const suffix = step !== undefined ? `/${step}` : '';

        const nth = base.match(/^(\w+)#([1-5])$/);
        if (nth) return `${awsDowToken(nth[1])}#${nth[2]}`;

        const last = base.match(/^([1-7])L$/i);
        if (last) return `${awsDowToken(last[1])}L`;

        if (base === '*') return `*${suffix}`;
        return base.split('-').map(awsDowToken).join('-') + suffix;
    }).join(',');
}

function matchesYear(spec: string, year: number): boolean {
    if (spec === '*') return true;
    return spec.split(',').some(item => {
        const [base, step] = item.split('/');
        const stride = step ? parseInt(step, 10) : 1;
        if (base === '*') return (year - 1970) % stride === 0;
        const [from, to] = base.split('-').map(n => parseInt(n, 10));
        if (to === undefined) return step ? year >= from && (year - from) % stride === 0 : year === from;
        return year >= from && year <= to && (year - from) % stride === 0;
    });
}

function parseAwsCron(body: string): ParsedSchedule {
    const parts = body.trim().split(/\s+/);
    if (parts.length !== 6) {
        throw new Error(`Invalid cron() expression: expected 6 fields (minutes hours day-of-month month day-of-week year), got ${parts.length}`);
    }
    const [minute, hour, dom, month, dow, year] = parts;

    if (/W/i.test(dom)) {
        throw new Error('The "W" (nearest weekday) day-of-month modifier is not supported by the local scheduler');
    }
    const domIsWild = dom === '?' || dom === '*';
    const dowIsWild = dow === '?' || dow === '*';
    if (!domIsWild && !dowIsWild) {
        throw new Error('Invalid cron() expression: day-of-month and day-of-week cannot both be specified; use ? for one of them');
    }
    if (!/^[\d*,\-/]+$/.test(year)) {
        throw new Error(`Invalid year field: ${year}`);
    }

    const expression = [
        minute, hour,
        dom === '?' ? '*' : dom,
        month,
        convertAwsDayOfWeek(dow),
    ].join(' ');

    parseExpression(expression); // throws on anything cron-parser rejects
    return { kind: 'cron', expression, yearSpec: year === '*' ? undefined : year };
}

function parseSchedule(expression: string): ParsedSchedule {
    const trimmed = (expression ?? '').trim();

    if (/^rate\(/i.test(trimmed)) return parseRate(trimmed);

    const aws = trimmed.match(AWS_CRON_PATTERN);
    if (aws) return parseAwsCron(aws[1]);

    const parts = trimmed.split(/\s+/);
    if (parts.length < 5 || parts.length > 6) {
        throw new Error(`Invalid cron format: expected 5 or 6 fields, or cron(...)/rate(...), got ${trimmed ? parts.length : 0}`);
    }
    parseExpression(trimmed);
    return { kind: 'cron', expression: trimmed };
}

// Cron-parser has no year field, so unix 7-field / AWS year is applied as a filter
function cronDates(
    schedule: Extract<ParsedSchedule, { kind: 'cron' }>,
    count: number,
    parseOptions: Record<string, any>
): Date[] {
    const interval = parseExpression(schedule.expression, parseOptions);
    const dates: Date[] = [];
    // Bounded so a year spec entirely in the past can't loop forever
    for (let i = 0; i < 100_000 && dates.length < count; i++) {
        let date: Date;
        try {
            date = interval.next().toDate();
        } catch {
            break; // iterator exhausted
        }
        if (!schedule.yearSpec || matchesYear(schedule.yearSpec, date.getFullYear())) {
            dates.push(date);
        }
    }
    return dates;
}

function scheduleDescription(schedule: ParsedSchedule): string {
    return schedule.kind === 'rate' ? schedule.description : describeCronExpression(schedule.expression);
}

/**
 * Parse a schedule expression and get its next execution time
 */
export function parseCronExpression(
    cronExpression: string,
    lastRun?: Date,
    options: CronParseOptions = {}
): CronParseResult {
    const {
        preserveNaturalTiming = true,
        timezone,
        utc = false,
        currentDate
    } = options;

    try {
        const schedule = parseSchedule(cronExpression);
        const now = new Date();

        if (schedule.kind === 'rate') {
            // A rate is a fixed interval from the last run (or from now for a
            // fresh job), not a wall-clock pattern
            const base = preserveNaturalTiming && lastRun ? lastRun : (currentDate ?? now);
            let nextRun = new Date(base.getTime() + schedule.intervalMs);
            if (nextRun <= now) {
                nextRun = new Date(now.getTime() + schedule.intervalMs);
            }
            return { nextRun, isValid: true, pattern: cronExpression, description: schedule.description };
        }

        const parseOptions: any = {
            tz: timezone,
            utc: utc,
            currentDate: currentDate ?? now
        };

        // Use lastRun for baseline if preserving natural timing
        if (preserveNaturalTiming && lastRun) {
            parseOptions.currentDate = lastRun;
        }

        const interval = parseExpression(schedule.expression, parseOptions);
        let nextRun: Date | undefined;
        for (let i = 0; i < 100_000; i++) {
            const candidate = interval.next().toDate();
            const yearOk = !schedule.yearSpec || matchesYear(schedule.yearSpec, candidate.getFullYear());
            // Ensure next run is in the future
            if (yearOk && candidate > now) {
                nextRun = candidate;
                break;
            }
        }
        if (!nextRun) {
            throw new Error('Expression has no future execution time');
        }

        return {
            nextRun,
            isValid: true,
            pattern: schedule.expression,
            description: scheduleDescription(schedule)
        };

    } catch (error: any) {
        // Fallback to a safe default (every hour) - the caller gets the
        // failure via `isValid`/`error` on the returned result, so it can
        // log with whatever module context it has; this module has none.
        const fallbackTime = new Date();
        fallbackTime.setHours(fallbackTime.getHours() + 1);
        fallbackTime.setMinutes(0);
        fallbackTime.setSeconds(0);
        fallbackTime.setMilliseconds(0);

        return {
            nextRun: fallbackTime,
            isValid: false,
            error: error.message,
            pattern: cronExpression
        };
    }
}

/**
 * Get multiple next execution times
 */
export function getNextExecutions(
    cronExpression: string,
    count: number = 5,
    options: CronParseOptions = {}
): Date[] {
    try {
        const schedule = parseSchedule(cronExpression);
        const from = options.currentDate ?? new Date();

        if (schedule.kind === 'rate') {
            return Array.from({ length: count }, (_, i) => new Date(from.getTime() + schedule.intervalMs * (i + 1)));
        }

        return cronDates(schedule, count, {
            tz: options.timezone,
            utc: options.utc ?? false,
            currentDate: from
        });
    } catch {
        return [];
    }
}

/**
 * Validate if a schedule expression (cron, cron(), rate()) is valid
 */
export function validateCronExpression(cronExpression: string): boolean {
    try {
        const schedule = parseSchedule(cronExpression);
        if (schedule.kind === 'cron') parseExpression(schedule.expression);
        return true;
    } catch {
        return false;
    }
}

/**
 * Validate and return the reason when invalid (for error messages)
 */
export function getExpressionError(cronExpression: string): string | undefined {
    try {
        const schedule = parseSchedule(cronExpression);
        if (schedule.kind === 'cron') parseExpression(schedule.expression);
        return undefined;
    } catch (error: any) {
        return error.message;
    }
}

/**
 * Provide human-readable description of cron expression
 */
function describeCronExpression(cronExpression: string): string {
    const parts = cronExpression.split(' ');

    // Handle common patterns
    const patterns: Record<string, string> = {
        '*/5 * * * *': 'Every 5 minutes',
        '0 * * * *': 'Every hour at minute 0',
        '0 */2 * * *': 'Every 2 hours',
        '0 0 * * *': 'Daily at midnight',
        '0 6 * * *': 'Daily at 6:00 AM',
        '0 0 * * 0': 'Weekly on Sunday at midnight',
        '0 0 1 * *': 'Monthly on the 1st at midnight',
        '0 0 1 1 *': 'Yearly on January 1st at midnight'
    };

    if (patterns[cronExpression]) {
        return patterns[cronExpression];
    }

    // Basic description for other patterns
    if (parts.length >= 5) {
        const [minute, hour, day, month, dayOfWeek] = parts;

        let description = 'Runs ';

        if (minute.includes('*/')) {
            const interval = minute.split('*/')[1];
            description += `every ${interval} minutes`;
        } else if (minute === '*') {
            description += 'every minute';
        } else {
            description += `at minute ${minute}`;
        }

        if (hour.includes('*/')) {
            const interval = hour.split('*/')[1];
            description += `, every ${interval} hours`;
        } else if (hour !== '*') {
            description += `, at hour ${hour}`;
        }

        if (day !== '*') {
            description += `, on day ${day}`;
        }

        if (month !== '*') {
            description += `, in month ${month}`;
        }

        if (dayOfWeek !== '*') {
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const dayNames = dayOfWeek.split(',').map(d => days[parseInt(d)] || d).join(', ');
            description += `, on ${dayNames}`;
        }

        return description;
    }

    return 'Custom schedule';
}

/**
 * Calculate time until next execution
 */
export function timeUntilNextExecution(cronExpression: string, timezone?: string): number {
    const result = parseCronExpression(cronExpression, undefined, { timezone });
    if (!result.isValid) {
        return -1;
    }

    return result.nextRun.getTime() - Date.now();
}

/**
 * Check if a time matches a cron expression
 */
export function doesTimeMatchCron(cronExpression: string, date: Date, timezone?: string): boolean {
    try {
        const schedule = parseSchedule(cronExpression);
        if (schedule.kind === 'rate') return false;

        const nextExecution = cronDates(schedule, 1, { tz: timezone, currentDate: date })[0];
        if (!nextExecution) return false;

        // Check if the date is very close to the next execution (within 1 minute)
        const timeDiff = Math.abs(nextExecution.getTime() - date.getTime());
        return timeDiff < 60000; // 1 minute tolerance
    } catch {
        return false;
    }
}

/**
 * Detect the type of scheduling expression
 */
export function detectExpressionType(expression: string | undefined): 'cron' | 'rate' | 'unknown' {
    if (!expression || typeof expression !== 'string') {
        return 'unknown';
    }
    try {
        return parseSchedule(expression).kind;
    } catch {
        return 'unknown';
    }
}
