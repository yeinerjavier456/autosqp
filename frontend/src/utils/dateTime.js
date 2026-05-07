export const BOGOTA_TIMEZONE = 'America/Bogota';

const buildSafeDate = (value) => {
    if (!value) return null;
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

export const formatBogotaDateTime = (value, options = {}) => {
    const parsedDate = buildSafeDate(value);
    if (!parsedDate) return '';

    return parsedDate.toLocaleString('es-CO', {
        timeZone: BOGOTA_TIMEZONE,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        ...options,
    });
};

export const formatBogotaDate = (value, options = {}) => {
    const parsedDate = buildSafeDate(value);
    if (!parsedDate) return '';

    return parsedDate.toLocaleDateString('es-CO', {
        timeZone: BOGOTA_TIMEZONE,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        ...options,
    });
};

export const formatBogotaDateForInput = (value) => {
    const parsedDate = buildSafeDate(value);
    if (!parsedDate) return '';

    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: BOGOTA_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });

    return formatter.format(parsedDate);
};
