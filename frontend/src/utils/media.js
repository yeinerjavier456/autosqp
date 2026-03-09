export const normalizeMediaUrl = (url) => {
    if (!url) return '';

    const raw = String(url).trim();
    const origin = window.location.origin;

    if (raw.startsWith('data:') || raw.startsWith('blob:')) return raw;

    // Already normalized absolute URL
    if (/^https?:\/\/.+\/api\/static\//i.test(raw)) return raw;
    if (/^https?:\/\/.+\/api\/api\/static\//i.test(raw)) {
        return raw.replace(/\/api\/api\/static\//i, '/api/static/');
    }

    // Absolute URL pointing to /static -> rewrite once to /api/static
    if (/^https?:\/\/.+\/static\//i.test(raw)) {
        return raw.replace('/static/', '/api/static/');
    }

    if (raw.startsWith('http://localhost') || raw.startsWith('http://127.0.0.1')) {
        const path = raw.replace(/^https?:\/\/[^/]+/, '');
        if (path.startsWith('/api/static/')) return `${origin}${path}`;
        if (path.startsWith('/static/')) return `${origin}/api${path}`;
        return `${origin}${path}`;
    }

    // Defensive: collapse duplicated /api prefixes if they appear.
    if (raw.startsWith('/api/')) {
        return `${origin}${raw.replace(/(?:\/api)+\/static\//, '/api/static/')}`;
    }
    if (raw.startsWith('api/')) {
        const normalized = `/${raw}`.replace(/(?:\/api)+\/static\//, '/api/static/');
        return `${origin}${normalized}`;
    }

    if (raw.startsWith('/static/')) return `${origin}/api${raw}`;
    if (raw.startsWith('static/')) return `${origin}/api/${raw}`;

    if (raw.includes('/api/static/')) {
        return raw.replace(/(?:\/api)+\/static\//, '/api/static/');
    }
    if (raw.includes('api/static/')) {
        const suffix = raw.substring(raw.indexOf('api/static/'));
        const normalized = `/${suffix}`.replace(/(?:\/api)+\/static\//, '/api/static/');
        return `${origin}${normalized}`;
    }

    if (raw.includes('/static/')) {
        return raw.replace('/static/', '/api/static/');
    }

    // Legacy rows may store only the filename (uuid.jpeg)
    if (!raw.includes('/')) return `${origin}/api/static/${raw}`;

    return raw;
};
