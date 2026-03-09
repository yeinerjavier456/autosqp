export const normalizeMediaUrl = (url) => {
    if (!url) return '';

    const raw = String(url).trim();
    const origin = window.location.origin;

    if (raw.startsWith('data:') || raw.startsWith('blob:')) return raw;

    // Already normalized absolute URL
    if (/^https?:\/\/.+\/api\/static\//i.test(raw)) return raw;

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

    if (raw.startsWith('/static/')) return `${origin}/api${raw}`;
    if (raw.startsWith('static/')) return `${origin}/api/${raw}`;

    if (raw.includes('/api/static/')) {
        return raw.replace(/(?:\/api)+\/static\//, '/api/static/');
    }

    if (raw.includes('/static/')) {
        return raw.replace('/static/', '/api/static/');
    }

    // Legacy rows may store only the filename (uuid.jpeg)
    if (!raw.includes('/')) return `${origin}/api/static/${raw}`;

    return raw;
};
