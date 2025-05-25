import chalk from 'chalk';
import logSymbols from 'log-symbols';
import { parseExpression } from 'cron-parser';

import { logger } from "@cloudnux/utils";

/**
 * Professional cron parser using cron-parser library
 * 
 * Installation:
 * npm install cron-parser
 * npm install -D @types/cron-parser
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

/**
 * Parse cron expression and get next execution time
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
        // Validate and normalize cron expression
        const normalizedCron = normalizeCronExpression(cronExpression);

        const parseOptions: any = {
            tz: timezone,
            utc: utc,
            currentDate: currentDate || new Date()
        };

        // Use lastRun for baseline if preserving natural timing
        if (preserveNaturalTiming && lastRun) {
            parseOptions.currentDate = lastRun;
        }

        const interval = parseExpression(normalizedCron, parseOptions);
        let nextRun = interval.next().toDate();

        // Ensure next run is in the future
        const now = new Date();
        while (nextRun <= now) {
            nextRun = interval.next().toDate();
        }

        return {
            nextRun,
            isValid: true,
            pattern: normalizedCron,
            description: describeCronExpression(normalizedCron)
        };

    } catch (error: any) {
        //BREAKPOINT: LOGGING
        logger.error(`${chalk.red('Invalid cron expression:')} ${cronExpression} - ${error.message}`);

        // Fallback to a safe default (every hour)
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
        const normalizedCron = normalizeCronExpression(cronExpression);
        const parseOptions: any = {
            tz: options.timezone,
            utc: options.utc || false,
            currentDate: options.currentDate || new Date()
        };

        const interval = parseExpression(normalizedCron, parseOptions);
        const executions: Date[] = [];

        for (let i = 0; i < count; i++) {
            executions.push(interval.next().toDate());
        }

        return executions;
    } catch (error: any) {
        //BREAKPOINT: LOGGING
        logger.error(`${chalk.red('Error getting next executions:')} ${error.message}`);
        return [];
    }
}

/**
 * Validate if a cron expression is valid
 */
export function validateCronExpression(cronExpression: string): boolean {
    try {
        const normalized = normalizeCronExpression(cronExpression);
        parseExpression(normalized);
        return true;
    } catch {
        return false;
    }
}

/**
 * Normalize cron expressions to handle different formats
 */
function normalizeCronExpression(cronExpression: string): string {
    const parts = cronExpression.trim().split(/\s+/);

    // Handle different cron formats
    if (parts.length === 5) {
        // Standard 5-field format: minute hour day month dayOfWeek
        return cronExpression;
    } else if (parts.length === 6) {
        // 6-field format with seconds: second minute hour day month dayOfWeek
        return cronExpression;
    } else if (parts.length === 7) {
        // 7-field format with year: second minute hour day month dayOfWeek year
        return cronExpression;
    } else {
        throw new Error(`Invalid cron format: expected 5, 6, or 7 fields, got ${parts.length}`);
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
        const normalizedCron = normalizeCronExpression(cronExpression);
        const parseOptions: any = {
            tz: timezone,
            currentDate: date
        };

        const interval = parseExpression(normalizedCron, parseOptions);
        const nextExecution = interval.next().toDate();

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
    const trimmedExpression = expression.trim();

    // Check for AWS rate expression pattern
    // Format: "rate(value unit)" where unit can be minute(s), hour(s), day(s)
    const ratePattern = /^rate\(\s*(\d+)\s+(minute|minutes|hour|hours|day|days)\s*\)$/i;
    if (ratePattern.test(trimmedExpression)) {
        return 'rate';
    }

    // Check for cron expression pattern
    // Should have 5, 6, or 7 space-separated fields
    const cronParts = trimmedExpression.split(/\s+/);
    if (cronParts.length >= 5 && cronParts.length <= 7) {
        // Additional validation: check if parts contain valid cron characters
        const cronCharPattern = /^[\d\*\-\,\/\?\#LW]+$/;
        const validCronParts = cronParts.every(part => cronCharPattern.test(part) || part === '*');

        if (validCronParts) {
            return 'cron';
        }
    }

    return 'unknown';
}

/**
 * Convert AWS rate expression to cron expression
 * 
 * AWS Rate expressions format: rate(value unit)
 * Examples:
 * - rate(5 minutes) -> *\/5 * * * *
 * - rate(1 hour) -> 0 * * * *
 * - rate(2 hours) -> 0 *\/2 * * *
 * - rate(1 day) -> 0 0 * * *
 * - rate(7 days) -> 0 0 *\/7 * *
*/
export function convertRateToCron(rateExpression: string): {
    cronExpression: string;
    isValid: boolean;
    error?: string;
    originalRate: string;
    description: string;
} {
    const trimmedExpression = rateExpression.trim();

    // Parse rate expression
    const ratePattern = /^rate\(\s*(\d+)\s+(minute|minutes|hour|hours|day|days)\s*\)$/i;
    const match = trimmedExpression.match(ratePattern);

    if (!match) {
        return {
            cronExpression: '',
            isValid: false,
            error: 'Invalid rate expression format. Expected: rate(value unit)',
            originalRate: rateExpression,
            description: ''
        };
    }

    const value = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    // Validate value
    if (value <= 0) {
        return {
            cronExpression: '',
            isValid: false,
            error: 'Rate value must be greater than 0',
            originalRate: rateExpression,
            description: ''
        };
    }

    let cronExpression = '';
    let description = '';

    try {
        switch (unit) {
            case 'minute':
            case 'minutes':
                if (value > 59) {
                    return {
                        cronExpression: '',
                        isValid: false,
                        error: 'Minutes value cannot exceed 59. Use hours for longer intervals.',
                        originalRate: rateExpression,
                        description: ''
                    };
                }

                if (value === 1) {
                    cronExpression = '* * * * *';
                    description = 'Every minute';
                } else {
                    cronExpression = `*/${value} * * * *`;
                    description = `Every ${value} minutes`;
                }
                break;

            case 'hour':
            case 'hours':
                if (value > 23) {
                    // For hours > 23, convert to days if evenly divisible by 24
                    if (value % 24 === 0) {
                        const days = value / 24;
                        cronExpression = `0 0 */${days} * *`;
                        description = `Every ${days} day${days > 1 ? 's' : ''}`;
                    } else {
                        return {
                            cronExpression: '',
                            isValid: false,
                            error: 'Hours value greater than 23 must be divisible by 24, or use days unit.',
                            originalRate: rateExpression,
                            description: ''
                        };
                    }
                } else if (value === 1) {
                    cronExpression = '0 * * * *';
                    description = 'Every hour';
                } else {
                    cronExpression = `0 */${value} * * *`;
                    description = `Every ${value} hours`;
                }
                break;

            case 'day':
            case 'days':
                if (value > 365) {
                    return {
                        cronExpression: '',
                        isValid: false,
                        error: 'Days value cannot exceed 365',
                        originalRate: rateExpression,
                        description: ''
                    };
                }

                if (value === 1) {
                    cronExpression = '0 0 * * *';
                    description = 'Every day (daily)';
                } else if (value === 7) {
                    cronExpression = '0 0 * * 0';
                    description = 'Every 7 days (weekly)';
                } else if (value <= 31) {
                    cronExpression = `0 0 */${value} * *`;
                    description = `Every ${value} days`;
                } else {
                    // For large day intervals, we need to be more careful
                    // This is an approximation since months have different lengths
                    cronExpression = `0 0 */${value} * *`;
                    description = `Every ${value} days (approximate)`;
                }
                break;

            default:
                return {
                    cronExpression: '',
                    isValid: false,
                    error: `Unsupported time unit: ${unit}. Use minute(s), hour(s), or day(s).`,
                    originalRate: rateExpression,
                    description: ''
                };
        }

        // Validate the generated cron expression
        if (!validateCronExpression(cronExpression)) {
            return {
                cronExpression: '',
                isValid: false,
                error: 'Generated cron expression is invalid',
                originalRate: rateExpression,
                description: ''
            };
        }

        return {
            cronExpression,
            isValid: true,
            originalRate: rateExpression,
            description
        };

    } catch (error: any) {
        return {
            cronExpression: '',
            isValid: false,
            error: `Conversion error: ${error.message}`,
            originalRate: rateExpression,
            description: ''
        };
    }
}