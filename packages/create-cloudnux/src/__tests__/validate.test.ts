import { describe, expect, it } from 'vitest';
import { slugify, validateProjectName } from '../validate.js';

describe('slugify', () => {
    it('lowercases and dashes spaces', () => {
        expect(slugify('My App')).toBe('my-app');
    });

    it('strips leading/trailing dashes produced by invalid characters', () => {
        expect(slugify('  @My App!!  ')).toBe('my-app');
    });
});

describe('validateProjectName', () => {
    it('accepts a valid name', () => {
        expect(validateProjectName('my-app')).toBeUndefined();
    });

    it('rejects an empty/whitespace-only name', () => {
        expect(validateProjectName('   ')).toBeDefined();
    });

    it('accepts names that need slugifying', () => {
        expect(validateProjectName('My App')).toBeUndefined();
    });
});
