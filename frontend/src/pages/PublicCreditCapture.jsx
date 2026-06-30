import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link, useParams } from 'react-router-dom';
import PublicBrandLogo from '../components/PublicBrandLogo';
import { usePublicCompany } from '../utils/publicCompany';

const withAlpha = (hex, alpha = '18') => {
  if (typeof hex !== 'string') return hex;
  const normalized = hex.trim();
  if (!normalized.startsWith('#')) return normalized;
  if (normalized.length === 7) return `${normalized}${alpha}`;
  if (normalized.length === 4) {
    return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}${alpha}`;
  }
  return normalized;
};

const PublicCreditCapture = () => {
  const { token } = useParams();
  const company = usePublicCompany();
  const [session, setSession] = useState(null);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  const theme = useMemo(() => {
    const primary = company?.primary_color || '#2563eb';
    const secondary = company?.secondary_color || '#0f172a';
    return {
      primary,
      secondary,
      primarySoft: withAlpha(primary, '14'),
    };
  }, [company]);

  useEffect(() => {
    let ignore = false;

    const loadSession = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`/api/public/credit-request/capture-session/${token}`);
        if (!ignore) {
          setSession(response.data);
          if (response.data?.uploaded) {
            setStatus({ type: 'success', message: 'Esta foto ya fue cargada correctamente.' });
          }
        }
      } catch (error) {
        if (!ignore) {
          setStatus({
            type: 'error',
            message: error?.response?.data?.detail || 'No se pudo abrir esta sesión de captura.',
          });
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    loadSession();

    return () => {
      ignore = true;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [token]);

  const handleFileChange = (selectedFile) => {
    if (!selectedFile) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setStatus({ type: '', message: '' });
  };

  const uploadPhoto = async () => {
    if (!file) {
      setStatus({ type: 'error', message: 'Primero toma o selecciona la foto del documento.' });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await axios.post(`/api/public/credit-request/capture-session/${token}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSession(response.data);
      setStatus({ type: 'success', message: 'Foto enviada correctamente. Puedes volver al formulario en el computador.' });
    } catch (error) {
      setStatus({
        type: 'error',
        message: error?.response?.data?.detail || 'No se pudo enviar la foto.',
      });
    } finally {
      setUploading(false);
    }
  };

  const sideLabel = session?.side === 'back' ? 'cara posterior' : 'cara frontal';
  const brandName = company?.name || 'AutosQP';

  return (
    <div className="min-h-screen px-4 py-6" style={{ background: `linear-gradient(135deg, ${theme.secondary} 0%, ${theme.primary} 100%)` }}>
      <main className="mx-auto max-w-lg rounded-3xl bg-white p-5 shadow-2xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link to="/autos" className="flex items-center gap-3">
            <PublicBrandLogo company={company} brandName={brandName} className="h-12 w-auto object-contain" />
            <span className="text-sm font-bold text-slate-700">{brandName}</span>
          </Link>
        </div>

        <div className="space-y-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide" style={{ color: theme.primary }}>Formulario de crédito</p>
            <h1 className="text-2xl font-black text-slate-900">Capturar cédula</h1>
            <p className="mt-2 text-sm text-slate-500">
              Toma la foto de la {sideLabel} y envíala. El formulario del computador se actualizará automáticamente.
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500">Validando sesión...</div>
          ) : (
            <>
              {status.message && (
                <div className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
                  status.type === 'success'
                    ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border border-red-200 bg-red-50 text-red-700'
                }`}>
                  {status.message}
                </div>
              )}

              {session && !session.uploaded && (
                <div className="space-y-4">
                  <label className="block rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-center">
                    <span className="block text-base font-bold text-slate-900">Tomar foto o seleccionar imagen</span>
                    <span className="mt-1 block text-sm text-slate-500">Usa la cámara trasera del celular.</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(event) => handleFileChange(event.target.files?.[0])}
                      className="mt-4 block w-full text-sm text-slate-600"
                    />
                  </label>

                  {previewUrl && (
                    <img src={previewUrl} alt="Vista previa del documento" className="h-72 w-full rounded-2xl object-cover" />
                  )}

                  <button
                    type="button"
                    onClick={uploadPhoto}
                    disabled={uploading}
                    className="w-full rounded-2xl px-5 py-4 text-base font-black text-white disabled:opacity-60"
                    style={{ backgroundColor: theme.primary }}
                  >
                    {uploading ? 'Enviando...' : 'Enviar foto'}
                  </button>
                </div>
              )}

              {session?.uploaded && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center text-emerald-800">
                  <p className="text-lg font-black">Foto recibida</p>
                  <p className="mt-2 text-sm">Ya puedes continuar el formulario en el computador.</p>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default PublicCreditCapture;
