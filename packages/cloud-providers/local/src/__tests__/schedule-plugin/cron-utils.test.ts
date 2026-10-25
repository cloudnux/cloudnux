import { describe, it, expect } from 'vitest';
import { parseCronExpression, getNextExecutions, validateCronExpression, detectExpressionType } from '../../schedule-plugin/cron-utils';

const from = new Date('2030-01-01T00:00:00Z');
const utc = (e: string, n = 3) => getNextExecutions(e, n, { utc: true, currentDate: from }).map(d => d.toISOString());

describe('schedule expressions', () => {
  it('detects types', () => {
    expect(detectExpressionType('rate(5 minutes)')).toBe('rate');
    expect(detectExpressionType('cron(0 12 * * ? *)')).toBe('cron');
    expect(detectExpressionType('*/5 * * * *')).toBe('cron');
    expect(detectExpressionType('nope')).toBe('unknown');
  });

  it('enforces AWS rate singular/plural rules', () => {
    expect(validateCronExpression('rate(1 minute)')).toBe(true);
    expect(validateCronExpression('rate(1 minutes)')).toBe(false);
    expect(validateCronExpression('rate(5 minute)')).toBe(false);
    expect(validateCronExpression('rate(90 minutes)')).toBe(true);
    expect(validateCronExpression('rate(0 minutes)')).toBe(false);
  });

  it('rate runs at a fixed interval from the last run', () => {
    expect(utc('rate(90 minutes)', 2)).toEqual(['2030-01-01T01:30:00.000Z', '2030-01-01T03:00:00.000Z']);
    const last = new Date(Date.now() - 1000);
    const r = parseCronExpression('rate(5 minutes)', last);
    expect(r.nextRun.getTime()).toBe(last.getTime() + 300_000);
    expect(r.description).toBe('Every 5 minutes');
  });

  it('cron() daily at 12:00', () => {
    expect(utc('cron(0 12 * * ? *)', 2)).toEqual(['2030-01-01T12:00:00.000Z', '2030-01-02T12:00:00.000Z']);
  });

  it('cron() day-of-week uses AWS numbering (1=SUN) and names', () => {
    // 2030-01-01 is a Tuesday; MON-FRI == 2-6
    const days = utc('cron(0 8 ? * 2-6 *)', 5).map(s => new Date(s).getUTCDay());
    expect(days).toEqual([2, 3, 4, 5, 1]);
    expect(utc('cron(0 8 ? * MON-FRI *)', 5)).toEqual(utc('cron(0 8 ? * 2-6 *)', 5));
    expect(new Date(utc('cron(0 8 ? * 1 *)', 1)[0]).getUTCDay()).toBe(0);
  });

  it('cron() supports L, # and year', () => {
    expect(utc('cron(0 0 L * ? *)', 1)).toEqual(['2030-01-31T00:00:00.000Z']);
    expect(utc('cron(0 0 ? * 6#3 *)', 1)).toEqual(['2030-01-18T00:00:00.000Z']); // 3rd Friday
    expect(utc('cron(0 0 1 1 ? 2032)', 1)).toEqual(['2032-01-01T00:00:00.000Z']);
  });

  it('cron() rejects bad shapes', () => {
    expect(validateCronExpression('cron(0 12 * * *)')).toBe(false);
    expect(validateCronExpression('cron(0 12 1 * 2 *)')).toBe(false);
    expect(validateCronExpression('cron(0 12 15W * ? *)')).toBe(false);
  });

  it('plain unix cron still works', () => {
    expect(utc('*/15 * * * *', 2)).toEqual(['2030-01-01T00:15:00.000Z', '2030-01-01T00:30:00.000Z']);
  });
});
