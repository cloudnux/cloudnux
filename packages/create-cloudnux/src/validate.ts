const NPM_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

export function slugify(name: string): string {
    return name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export function validateProjectName(name: string): string | undefined {
    const slug = slugify(name);
    if (!slug) {
        return 'Project name must contain at least one letter or number.';
    }
    if (!NPM_NAME_PATTERN.test(slug)) {
        return 'Project name must start with a letter or number and contain only lowercase letters, numbers, "-", "_" or ".".';
    }
    return undefined;
}
