export const BOGOTA_TIMEZONE = 'America/Bogota';

const buildSafeDate = (value, assumeUtc = true) => {
    if (!value) return null;
    // SQLAlchemy serializa los DateTime UTC sin sufijo de zona. JavaScript los
    // interpretaría como hora local, desplazando el historial cinco horas.
    const normalizedValue = assumeUtc && typeof value === 'string'
        && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)
        && !/(Z|[+-]\d{2}:?\d{2})$/i.test(value)
        ? `${value}Z`
        : value;
    const parsedDate = new Date(normalizedValue);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
};

export const formatBogotaDateTime = (value, options = {}, assumeUtc = true) => {
    const parsedDate = buildSafeDate(value, assumeUtc);
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
