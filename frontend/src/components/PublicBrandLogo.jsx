import React, { useMemo, useState } from 'react';
import { normalizeMediaUrl } from '../utils/media';

const initialsFromName = (name) => {
    const normalized = String(name || '').trim();
    if (!normalized) return 'A';
    const parts = normalized.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
};

const PublicBrandLogo = ({
    company,
    brandName,
    className = 'h-12 w-auto object-contain',
    fallbackClassName = 'flex h-12 w-12 items-center justify-center rounded-xl text-sm font-black text-white',
    showText = false,
    textClassName = 'text-sm font-semibold',
    primaryColor = '#2563eb',
    secondaryColor = '#0f172a',
}) => {
    const [imageError, setImageError] = useState(false);
    const logoUrl = company?.logo_url ? normalizeMediaUrl(company.logo_url) : '';
    const initials = useMemo(() => initialsFromName(brandName), [brandName]);

    if (logoUrl && !imageError) {
        return (
            <>
                <img
                    src={logoUrl}
                    alt={brandName}
                    className={className}
                    onError={() => setImageError(true)}
                />
                {showText ? <span className={textClassName}>{brandName}</span> : null}
            </>
        );
    }

    return (
        <>
            <span
                className={fallbackClassName}
                style={{ background: `linear-gradient(135deg, ${secondaryColor} 0%, ${primaryColor} 100%)` }}
            >
                {initials}
            </span>
            {showText ? <span className={textClassName}>{brandName}</span> : null}
        </>
    );
};

export default PublicBrandLogo;
