import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';

const bytes = (value) => `${(Number(value || 0) / 1024 / 1024).toLocaleString('es-CO', { maximumFractionDigits: 1 })} MB`;
const jobDate = (value) => {
    if (!value) return '';
    const text = String(value);
    return new Date(/(?:Z|[+-]\d{2}:?\d{2})$/.test(text) ? text : `${text}Z`).toLocaleString('es-CO', { timeZone: 'America/Bogota' });
};

export default function CompanyBackups({ companyId, globalSettings = false }) {
    const [settings, setSettings] = useState(null);
    const [access, setAccess] = useState('');
    const [password, setPassword] = useState('');
    const [items, setItems] = useState([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [jobId, setJobId] = useState('');
    const [message, setMessage] = useState('');
    const [jobHistory, setJobHistory] = useState([]);
    const base = `/api/company-backups/${companyId}`;
    const config = (token = access) => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}`, 'X-Backup-Access-Token': token } });

    useEffect(() => {
        let mounted = true;
        setAccess(''); setPassword(''); setItems([]); setSettings(null); setError(''); setJobId(''); setBusy(false); setMessage(''); setJobHistory([]);
        if (companyId) axios.get(`${base}/settings`, config('')).then(({ data }) => { if (mounted) setSettings(data); }).catch((err) => { if (mounted) setError(err.response?.data?.detail || 'No se pudo consultar la configuración'); });
        return () => { mounted = false; };
    }, [companyId]);

    const refresh = async (token = access) => {
        const { data } = await axios.get(base, config(token));
        setItems(data.items || []);
        setJobHistory(data.jobs || []);
        setJobId(data.active_job || '');
        const active = (data.jobs || []).find((job) => job.id === data.active_job);
        const latest = active || data.jobs?.[0];
        if (latest) setMessage(latest.message);
    };

    useEffect(() => {
        if (!access || !jobId) return;
        let cancelled = false;
        let timer;
        const poll = async () => {
            try {
                const { data } = await axios.get(`${base}/jobs/${jobId}`, config());
                if (cancelled) return;
                setMessage(data.message);
                setJobHistory((current) => [data, ...current.filter((item) => item.id !== data.id)].slice(0, 20));
                if (['complete', 'failed'].includes(data.state)) {
                    setJobId(''); setBusy(false);
                    if (data.state === 'failed') setError(data.message);
                    await refresh();
                    return;
                }
                timer = setTimeout(poll, 2500);
            } catch (err) {
                if (!cancelled) {
                    setError(err.response?.data?.detail || 'No se pudo consultar el avance. La operación puede continuar en el servidor; actualiza el listado antes de repetirla.');
                    setJobId(''); setBusy(false);
                    if (err.response?.status === 403) setAccess('');
                }
            }
        };
        poll();
        return () => { cancelled = true; clearTimeout(timer); };
    }, [access, jobId, companyId]);

    const unlock = async (event) => {
        event.preventDefault(); setBusy(true); setError('');
        try {
            const { data } = await axios.post(`${base}/unlock`, { password }, config(''));
            await refresh(data.access_token);
            setAccess(data.access_token); setPassword('');
        } catch (err) { setError(err.response?.data?.detail || 'No se pudo validar la contraseña'); }
        finally { setBusy(false); }
    };

    const toggle = async () => {
        setBusy(true); setError('');
        try {
            const { data } = await axios.put(`${base}/settings`, { enabled: !settings.enabled }, config(''));
            setSettings({ ...settings, ...data }); setAccess(''); setItems([]);
        } catch (err) { setError(err.response?.data?.detail || 'No se pudo actualizar la configuración'); }
        finally { setBusy(false); }
    };

    const create = async () => {
        if (busy || jobId) return;
        setBusy(true); setError(''); setMessage('Preparando copia de la empresa...');
        try {
            const { data } = await axios.post(`${base}/create`, {}, config());
            setJobId(data.job_id);
        } catch (err) { setBusy(false); setError(err.response?.data?.detail || 'No se pudo iniciar la copia'); }
    };

    const restore = async (backup) => {
        if (busy || jobId) return;
        const result = await Swal.fire({
            title: 'Restaurar esta empresa', icon: 'warning',
            html: '<p>Se reemplazarán los datos operativos, usuarios y archivos de <strong>esta empresa</strong>. Las demás empresas no se modificarán.</p><p>Se creará una copia preventiva. Los cambios posteriores a la copia seleccionada se perderán. Puede ser necesario iniciar sesión nuevamente.</p><p>La licencia, dominios, activación de copias y contraseña de Cuentas actuales se conservan.</p>',
            input: 'text', inputPlaceholder: 'Escribe RESTAURAR EMPRESA', showCancelButton: true,
            confirmButtonText: 'Continuar', cancelButtonText: 'Cancelar',
            inputValidator: (value) => value !== 'RESTAURAR EMPRESA' ? 'Escribe RESTAURAR EMPRESA' : undefined,
        });
        if (!result.isConfirmed) return;
        const secret = await Swal.fire({ title: 'Confirma con la contraseña de Cuentas', input: 'password', inputAttributes: { autocomplete: 'off' }, showCancelButton: true, confirmButtonText: 'Restaurar empresa', cancelButtonText: 'Cancelar', inputValidator: (value) => !value ? 'Ingresa la contraseña' : undefined });
        if (!secret.isConfirmed) return;
        setBusy(true); setError(''); setMessage('Verificando e iniciando la restauración...');
        try {
            const { data } = await axios.post(`${base}/restore`, { backup_id: backup.id, confirmation: result.value, password: secret.value }, config());
            setJobId(data.job_id);
        } catch (err) { setBusy(false); setError(err.response?.data?.detail || 'No se pudo iniciar la restauración'); }
    };

    const download = async (backup) => {
        setError('');
        try {
            const { data } = await axios.post(`${base}/${backup.id}/download-link`, {}, config());
            const link = document.createElement('a'); link.href = data.url; link.download = ''; document.body.appendChild(link); link.click(); link.remove();
        } catch (err) { setError(err.response?.data?.detail || 'No se pudo descargar la copia'); }
    };

    return <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-xl font-bold text-slate-900">Copias de seguridad de la empresa</h3>
        <p className="text-sm text-slate-600">Copias independientes de datos y archivos. Retención: últimos 7 días. Las copias globales anteriores permanecen como recuperación del servidor, no se restauran desde aquí.</p>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {!settings && !error && <p>Cargando configuración...</p>}
        {globalSettings && settings && <label className="flex items-center gap-3 rounded-xl bg-slate-50 p-4 font-semibold text-slate-800"><input type="checkbox" checked={settings.enabled} disabled={busy || Boolean(jobId)} onChange={toggle} />Activar copias y restauración para esta empresa</label>}
        {settings && !settings.enabled && <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Copias desactivadas. Solo el administrador global puede habilitarlas. Desactivar no elimina las copias existentes.</p>}
        {settings?.enabled && !access && <form onSubmit={unlock} className="max-w-md space-y-3">
            <label className="block text-sm font-semibold text-slate-700">Contraseña de Cuentas<input type="password" autoComplete="off" required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>
            <button disabled={busy} className="rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:opacity-50">{busy ? 'Validando...' : 'Ver copias de esta empresa'}</button>
        </form>}
        {settings?.enabled && access && <>
            <div className="flex flex-wrap gap-3"><button type="button" disabled={busy || Boolean(jobId)} onClick={create} className="rounded-xl bg-blue-600 px-4 py-2 font-bold text-white disabled:opacity-50">Crear copia ahora</button><button type="button" disabled={busy && !jobId} onClick={() => refresh().catch((err) => setError(err.response?.data?.detail || 'Error al actualizar'))} className="rounded-xl border border-slate-300 px-4 py-2 font-semibold text-slate-700 disabled:opacity-50">Actualizar listado</button><button type="button" onClick={() => { setAccess(''); setPassword(''); }} className="rounded-xl border border-slate-300 px-4 py-2 text-slate-700">Bloquear</button></div>
            <p className="text-xs text-slate-500">El proceso continúa en el servidor aunque cambies de pestaña, cierres el navegador o recargues. Al volver e ingresar la contraseña recuperarás su estado.</p>
            {(busy || jobId || message) && <p role="status" className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900">{(busy || jobId) && <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />}{message}</p>}
            {jobHistory.length > 0 && <div className="rounded-xl border border-slate-200 p-4"><h4 className="mb-3 font-bold text-slate-800">Historial de operaciones</h4><div className="space-y-3">{jobHistory.map((job) => <div key={job.id} className="border-b border-slate-100 pb-2 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong className="text-slate-800">{job.kind === 'restore' ? 'Restauración' : 'Copia de seguridad'}</strong><span className={job.state === 'complete' ? 'font-bold text-emerald-700' : job.state === 'failed' ? 'font-bold text-red-700' : 'font-bold text-blue-700'}>{{ queued: 'En cola', running: 'En ejecución', complete: 'Terminada', failed: 'Fallida' }[job.state] || job.state}</span></div><p className="mt-1 text-slate-600">{job.message}</p><p className="mt-1 text-xs text-slate-500">{jobDate(job.created_at)}{job.finished_at ? ` · Finalizada: ${jobDate(job.finished_at)}` : ''}</p></div>)}</div></div>}
            {!items.length && <p className="text-sm text-slate-500">No hay copias de esta empresa todavía. Puedes crear la primera ahora.</p>}
            {items.map((backup) => <article key={backup.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 p-4">
                <div><p className="font-bold text-slate-900">{new Date(backup.created_at).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}</p><p className="text-xs text-slate-500">{backup.reason === 'pre-restore' ? 'Preventiva antes de restaurar' : 'Copia de la empresa'} · {bytes(backup.total_bytes)} · {backup.static_files} archivos · {backup.rows} registros</p><p className={`text-xs ${backup.verified ? 'text-emerald-700' : 'text-red-700'}`}>{backup.verified ? 'Completa' : `Incompleta: ${backup.missing_files} archivos faltantes`}</p></div>
                <div className="flex gap-2"><button type="button" disabled={busy || Boolean(jobId)} onClick={() => download(backup)} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 font-semibold text-blue-700 disabled:opacity-50">Descargar ZIP</button><button type="button" disabled={busy || Boolean(jobId) || !backup.verified} onClick={() => restore(backup)} className="rounded-lg bg-red-600 px-3 py-2 font-bold text-white disabled:opacity-50">Restaurar empresa</button></div>
            </article>)}
        </>}
    </section>;
}
