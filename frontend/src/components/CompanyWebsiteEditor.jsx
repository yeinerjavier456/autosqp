import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import defaults from '../../../public-site/content-defaults.json';

const header = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
const explain = error => {
    const detail = error.response?.data?.detail;
    return typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map(item => item.msg).join(' · ') : 'No fue posible completar la operación.';
};

function ImageField({ label, value, onChange, onUpload, busy }) {
    const fileInput = useRef(null);
    return <div className="space-y-3 rounded-xl border border-slate-200 p-4">
        <label className="block text-sm font-semibold text-slate-700">{label}</label>
        {value && <img src={value} alt={`Vista previa: ${label}`} className="h-40 w-full rounded-lg bg-slate-100 object-contain" />}
        <input aria-label={`URL ${label}`} value={value} onChange={event => onChange(event.target.value)} placeholder="https://… o imagen subida" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) onUpload(file); event.target.value = ''; }} />
        <button type="button" disabled={busy} onClick={() => fileInput.current?.click()} className="rounded-lg bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 disabled:opacity-50">{busy ? 'Subiendo imagen…' : 'Subir imagen'}</button>
        <p className="text-xs text-slate-500">PNG, JPG o WEBP · Máximo 8 MB y 16 megapíxeles.</p>
    </div>;
}

export default function CompanyWebsiteEditor({ companyId }) {
    const [values, setValues] = useState({});
    const [testimonials, setTestimonials] = useState([]);
    const [revision, setRevision] = useState(0);
    const [section, setSection] = useState(defaults.fields.find(field => field.key.startsWith('Hero.'))?.section || '');
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [ready, setReady] = useState(false);
    const [status, setStatus] = useState({ error: '', success: '' });
    const active = useRef(true);
    const pending = useRef(false);
    const baseline = useMemo(() => Object.fromEntries(defaults.fields.map(field => [field.key, field.value])), []);
    const sections = useMemo(() => [...new Set(defaults.fields.map(field => field.section))], []);
    const fields = defaults.fields.filter(field => (section === '__images__' ? field.kind === 'image' : field.section === section) && (!query || `${field.label} ${values[field.key] ?? field.value}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())));

    const load = async () => {
        setLoading(true); setReady(false); setStatus({ error: '', success: '' });
        try {
            const response = await axios.get(`/api/companies/${companyId}/website`, { headers: header(), timeout: 15000 });
            if (!active.current) return;
            setValues(response.data.values || {}); setTestimonials(response.data.testimonials || []);
            setRevision(response.data.revision); setDirty(false); setReady(true);
        } catch (error) { if (active.current) setStatus({ error: explain(error), success: '' }); }
        finally { if (active.current) setLoading(false); }
    };
    useEffect(() => { active.current = true; load(); return () => { active.current = false; }; }, [companyId]);
    useEffect(() => {
        if (!dirty) return undefined;
        const warn = event => { event.preventDefault(); event.returnValue = ''; };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);

    const update = (key, value) => { setValues(previous => ({ ...previous, [key]: value })); setDirty(true); };
    const updateTestimonial = (id, key, value) => { setTestimonials(previous => previous.map(item => item.id === id ? { ...item, [key]: value } : item)); setDirty(true); };
    const upload = async (file, apply) => {
        if (pending.current) return;
        if (file.size > 8 * 1024 * 1024) { setStatus({ error: 'La imagen supera 8 MB.', success: '' }); return; }
        pending.current = true; setUploading(true); setStatus({ error: '', success: '' });
        try {
            const form = new FormData(); form.append('file', file);
            const response = await axios.post(`/api/companies/${companyId}/website/images`, form, { headers: header(), timeout: 60000 });
            if (active.current) apply(response.data.url);
        } catch (error) { if (active.current) setStatus({ error: explain(error), success: '' }); }
        finally { pending.current = false; if (active.current) setUploading(false); }
    };
    const save = async () => {
        if (pending.current || loading || !ready) return;
        pending.current = true; setSaving(true); setStatus({ error: '', success: '' });
        try {
            const response = await axios.put(`/api/companies/${companyId}/website`, { revision, values, testimonials }, { headers: header(), timeout: 30000 });
            if (active.current) {
                setRevision(response.data.revision); setValues(response.data.values); setTestimonials(response.data.testimonials);
                setDirty(false); setStatus({ error: '', success: 'Página guardada. Los cambios se publican sin recompilar; recarga la web para verlos.' });
            }
        } catch (error) { if (active.current) setStatus({ error: explain(error), success: '' }); }
        finally { pending.current = false; if (active.current) setSaving(false); }
    };
    const move = (index, offset) => {
        setTestimonials(previous => { const items = [...previous]; [items[index], items[index + offset]] = [items[index + offset], items[index]]; return items; }); setDirty(true);
    };
    if (loading) return <p role="status" className="p-4 text-slate-600">Cargando contenido de la página…</p>;
    if (!ready) return <div className="space-y-3"><p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{status.error || 'No se pudo cargar la página.'}</p><button type="button" onClick={load} className="rounded-xl border p-3">Reintentar</button></div>;
    return <div className="space-y-6">
        <p className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900">Editas únicamente la página de esta empresa. El inventario, el bot y los formularios siguen conectados al CRM. Los textos se muestran como texto, no como código HTML.</p>
        {status.error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">{status.error}</p>}
        {status.success && <p role="status" className="rounded-xl bg-green-50 p-4 text-green-800">{status.success}</p>}
        <fieldset disabled={saving} className="min-w-0 space-y-6 border-0 p-0">
        <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-64 flex-1 text-sm font-bold text-slate-700">Sección de la página
                <select className="mt-1 w-full rounded-xl border border-slate-300 p-3 font-normal" value={section} onChange={event => { setSection(event.target.value); setQuery(''); }}>
                    {sections.map(item => <option key={item}>{item}</option>)}
                    <option value="__images__">Imágenes estáticas</option>
                    <option value="__testimonials__">Testimonios · Qué dicen nuestros clientes</option>
                </select>
            </label>
            <button type="button" disabled={saving || uploading} onClick={() => { if (!dirty || window.confirm('Se descartarán los cambios sin guardar. ¿Continuar?')) load(); }} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold disabled:opacity-50">Actualizar contenido</button>
            <button type="button" onClick={() => setSection('__testimonials__')} className="rounded-xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">Editar testimonios</button>
            <button type="button" onClick={() => { setSection('__images__'); setQuery(''); }} className="rounded-xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">Editar imágenes</button>
        </div>
        {section !== '__testimonials__' ? <>
            <input aria-label="Buscar texto en esta sección" placeholder="Buscar un título, frase o texto…" value={query} onChange={event => setQuery(event.target.value)} className="w-full rounded-xl border border-slate-300 p-3" />
            <div className="space-y-4">{fields.map(field => <div key={field.key} className="space-y-2">
                {field.kind === 'image' ? <ImageField label={field.label} value={values[field.key] ?? field.value} busy={uploading} onChange={value => update(field.key, value)} onUpload={file => upload(file, value => update(field.key, value))} /> : <label className="block text-sm font-semibold text-slate-700">{field.label}
                    <textarea aria-label={field.label} rows={(values[field.key] ?? field.value).length > 180 ? 4 : 2} maxLength={12000} value={values[field.key] ?? field.value} onChange={event => update(field.key, event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 p-3 font-normal" />
                </label>}
                <button type="button" onClick={() => update(field.key, baseline[field.key])} className="text-xs font-semibold text-blue-700 hover:underline">Restablecer este campo al original</button>
            </div>)}</div>
        </> : <div className="space-y-5">
            <button type="button" disabled={testimonials.length >= 50} onClick={() => { setTestimonials(previous => [...previous, { id: crypto.randomUUID(), name: '', role: '', avatar: '', rating: 5, comment: '', vehiclePurchased: '', date: '' }]); setDirty(true); }} className="rounded-xl bg-blue-600 px-4 py-3 font-bold text-white disabled:opacity-50">Agregar testimonio</button>
            {!testimonials.length && <p className="text-sm text-slate-600">Sin testimonios: esta sección no aparecerá en la web hasta que agregues alguno.</p>}
            {testimonials.map((item, index) => <article key={item.id} className="space-y-4 rounded-2xl border border-slate-200 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold text-slate-900">Testimonio {index + 1}</h3><div className="flex gap-2">
                    <button type="button" disabled={!index} onClick={() => move(index, -1)} className="rounded-lg border px-3 py-1 text-sm disabled:opacity-30">Subir</button>
                    <button type="button" disabled={index === testimonials.length - 1} onClick={() => move(index, 1)} className="rounded-lg border px-3 py-1 text-sm disabled:opacity-30">Bajar</button>
                    <button type="button" onClick={() => { if (window.confirm('¿Quitar este testimonio de la página?')) { setTestimonials(previous => previous.filter(value => value.id !== item.id)); setDirty(true); } }} className="rounded-lg bg-red-50 px-3 py-1 text-sm text-red-700">Quitar</button>
                </div></div>
                <div className="grid gap-4 md:grid-cols-2">{[['name', 'Nombre del cliente'], ['role', 'Descripción del cliente'], ['vehiclePurchased', 'Vehículo / servicio'], ['date', 'Fecha o referencia de tiempo']].map(([key, label]) => <label key={key} className="text-sm font-semibold text-slate-700">{label}<input value={item[key] || ''} onChange={event => updateTestimonial(item.id, key, event.target.value)} maxLength={key === 'name' ? 150 : key === 'date' ? 100 : 200} className="mt-1 w-full rounded-xl border p-3 font-normal" /></label>)}</div>
                <label className="block text-sm font-semibold text-slate-700">Opinión del cliente<textarea aria-label="Opinión del cliente" rows={4} maxLength={4000} value={item.comment} onChange={event => updateTestimonial(item.id, 'comment', event.target.value)} className="mt-1 w-full rounded-xl border p-3 font-normal" /></label>
                <label className="block text-sm font-semibold text-slate-700">Calificación<select value={item.rating} onChange={event => updateTestimonial(item.id, 'rating', Number(event.target.value))} className="ml-3 rounded-lg border p-2">{[1,2,3,4,5].map(rating => <option key={rating} value={rating}>{rating} estrellas</option>)}</select></label>
                <ImageField label={`Foto del cliente ${index + 1}`} value={item.avatar || ''} busy={uploading} onChange={value => updateTestimonial(item.id, 'avatar', value)} onUpload={file => upload(file, value => updateTestimonial(item.id, 'avatar', value))} />
            </article>)}
        </div>}
        <div className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
            <p className="text-sm text-slate-600">{dirty ? 'Tienes cambios sin guardar.' : `Contenido guardado · Versión ${revision}`}</p>
            <button type="button" disabled={saving || uploading || loading || !dirty} onClick={save} className="rounded-xl bg-blue-600 px-6 py-3 font-bold text-white disabled:opacity-50">{saving ? 'Guardando página…' : 'Guardar página web'}</button>
        </div>
        </fieldset>
    </div>;
}
