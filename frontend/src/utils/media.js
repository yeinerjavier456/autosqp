export const normalizeMediaUrl = (url) => {
    if (!url) return '';

    const raw = String(url);
    const origin = window.location.origin;

    if (raw.startsWith('http://localhost') || raw.startsWith('http://127.0.0.1')) {
        const path = raw.replace(/^https?:\/\/[^/]+/, '');
        if (path.startsWith('/static/')) return `${origin}/api${path}`;
        return `${origin}${path}`;
    }

    if (raw.startsWith('/static/')) return `${origin}/api${raw}`;
    if (raw.startsWith('/api/static/')) return `${origin}${raw}`;

    if (raw.includes('/static/')) {
        return raw.replace('/static/', '/api/static/');
    }

    return raw;
};

