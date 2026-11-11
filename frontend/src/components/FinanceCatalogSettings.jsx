import React, { useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';

export default function FinanceCatalogSettings({ entries, onChanged }) {
    const [kind, setKind] = useState('category');
    const [editing, setEditing] = useState(null);
    const [label, setLabel] = useState('');
    const [category, setCategory] = useState('');
    const [movement, setMovement] = useState('expense');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const categories = entries.filter((entry) => entry.kind === 'category' && entry.is_active);
    const config = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    const reset = (nextKind = kind) => { setKind(nextKind); setEditing(null); setLabel(''); setCategory(''); setMovement('expense'); setError(''); };
    const save = async (event) => {
        event.preventDefault(); if (busy) return;
        setBusy(true); setError('');
        try {
            const payload = { kind, label, category_code: kind === 'concept' ? category : null, movement_type: kind === 'concept' ? movement : null };
            if (editing) await axios.put(`/api/finance/catalog/${editing.id}`, payload, config());
            else await axios.post('/api/finance/catalog', payload, config());
            await onChanged(); reset();
        } catch (err) { setError(err.response?.data?.detail || 'No se pudo guardar la opción'); }
        finally { setBusy(false); }
    };
    const remove = async (entry) => {
        const decision = await Swal.fire({ title: 'Eliminar opción del catálogo', text: `Se retirará “${entry.label}” de los formularios. Los recibos y movimientos anteriores no se borrarán.`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Eliminar opción', cancelButtonText: 'Cancelar' });
        if (!decision.isConfirmed) return;
        setBusy(true); setError('');
        try { await axios.delete(`/api/finance/catalog/${entry.id}`, config()); await onChanged(); if (editing?.id === entry.id) reset(); }
        catch (err) { setError(err.response?.data?.detail || 'No se pudo eliminar la opción'); }
        finally { setBusy(false); }
    };
    return <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
        <div><h2 className="text-xl font-bold text-slate-900">Configuración contable de la empresa</h2><p className="mt-2 text-sm text-slate-600">Estas opciones se comparten entre recibos y Cuentas, únicamente para esta empresa. Editar un concepto no reescribe el texto de los recibos anteriores. Eliminar una opción solo la retira de nuevas selecciones.</p></div>
        <div className="flex gap-2">{[['category', 'Categorías'], ['concept', 'Conceptos']].map(([value, title]) => <button key={value} type="button" disabled={busy} onClick={() => reset(value)} className={`rounded-xl px-4 py-2 font-bold ${kind === value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{title}</button>)}</div>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
        <form onSubmit={save} className="grid gap-4 rounded-xl bg-slate-50 p-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">{editing ? 'Editar nombre' : 'Nombre de la nueva opción'}<input required maxLength={180} value={label} disabled={busy} onChange={(event) => setLabel(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" /></label>
            {kind === 'concept' && <><label className="text-sm font-semibold text-slate-700">Categoría predeterminada<select required value={category} disabled={busy} onChange={(event) => setCategory(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="">Seleccionar categoría</option>{categories.filter((item) => item.code !== 'transferencia_cuentas').map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></label><label className="text-sm font-semibold text-slate-700">Tipo de movimiento<select value={movement} disabled={busy} onChange={(event) => setMovement(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"><option value="income">Ingreso</option><option value="expense">Deducción / egreso</option></select></label></>}
            <div className="flex items-end gap-3"><button disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 font-bold text-white disabled:opacity-50">{busy ? 'Guardando...' : editing ? 'Guardar cambios' : 'Agregar'}</button>{editing && <button type="button" disabled={busy} onClick={() => reset()} className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700">Cancelar edición</button>}</div>
        </form>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-3">Nombre</th>{kind === 'concept' && <><th className="p-3">Categoría</th><th className="p-3">Movimiento</th></>}<th className="p-3">Acciones</th></tr></thead><tbody>{entries.filter((entry) => entry.kind === kind && entry.is_active).map((entry) => <tr key={entry.id} className="border-b border-slate-100"><td className="p-3 font-semibold text-slate-900">{entry.label}{entry.protected && <span className="ml-2 text-xs text-slate-500">Opción técnica</span>}</td>{kind === 'concept' && <><td className="p-3 text-slate-600">{categories.find((item) => item.code === entry.category_code)?.label || entry.category_code}</td><td className="p-3 text-slate-600">{entry.movement_type === 'income' ? 'Ingreso' : 'Egreso'}</td></>}<td className="p-3"><div className="flex gap-2"><button type="button" disabled={busy} onClick={() => { setEditing(entry); setLabel(entry.label); setCategory(entry.category_code || ''); setMovement(entry.movement_type || 'expense'); }} className="rounded-lg bg-blue-50 px-3 py-2 font-semibold text-blue-700">Editar</button><button type="button" disabled={busy || entry.protected} onClick={() => remove(entry)} className="rounded-lg bg-red-50 px-3 py-2 font-semibold text-red-700 disabled:opacity-40">Eliminar</button></div></td></tr>)}</tbody></table></div>
        <p className="text-xs text-slate-500">“Otros” permite describir conceptos libres. “Transferencia entre cuentas” conserva el funcionamiento de las transferencias. Estas opciones técnicas no se eliminan. Para eliminar una categoría, primero cambia los conceptos que la utilizan.</p>
    </section>;
}
