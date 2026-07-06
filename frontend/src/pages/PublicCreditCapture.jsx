import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const [session, setSession] = useState(null);
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [hasSignature, setHasSignature] = useState(false);
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
            setStatus({ type: 'success', message: response.data?.side === 'signature' ? 'Esta firma ya fue cargada correctamente.' : 'Esta foto ya fue cargada correctamente.' });
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

  useEffect(() => {
    if (session?.side !== 'signature' || !canvasRef.current || session?.uploaded) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = theme.secondary;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setHasSignature(false);
  }, [session?.side, session?.uploaded, theme.secondary]);

  const handleFileChange = (selectedFile) => {
    if (!selectedFile) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setStatus({ type: '', message: '' });
  };

  const uploadPhoto = async () => {
    if (!file) {
      setStatus({ type: 'error', message: session?.side === 'signature' ? 'Primero toma o selecciona la imagen de la firma.' : 'Primero toma o selecciona la foto del documento.' });
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
      setStatus({ type: 'success', message: session?.side === 'signature' ? 'Firma enviada correctamente. Puedes volver al formulario en el computador.' : 'Foto enviada correctamente. Puedes volver al formulario en el computador.' });
    } catch (error) {
      setStatus({
        type: 'error',
        message: error?.response?.data?.detail || (session?.side === 'signature' ? 'No se pudo enviar la firma.' : 'No se pudo enviar la foto.'),
      });
    } finally {
      setUploading(false);
    }
  };

  const getCanvasPosition = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = event.touches?.[0];
    const clientX = touch ? touch.clientX : event.clientX;
    const clientY = touch ? touch.clientY : event.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const startSignature = (event) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawingRef.current = true;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCanvasPosition(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const drawSignature = (event) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const { x, y } = getCanvasPosition(event);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSignature(true);
    setStatus({ type: '', message: '' });
  };

  const stopSignature = () => {
    drawingRef.current = false;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    setStatus({ type: '', message: '' });
  };

  const uploadSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) {
      setStatus({ type: 'error', message: 'Primero firma dentro del recuadro.' });
      return;
    }

    setUploading(true);
    try {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('No se pudo generar la imagen de la firma.');
      const formData = new FormData();
      formData.append('file', blob, 'firma_cliente.png');
      const response = await axios.post(`/api/public/credit-request/capture-session/${token}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSession(response.data);
      setStatus({ type: 'success', message: 'Firma enviada correctamente. Puedes volver al formulario en el computador.' });
    } catch (error) {
      setStatus({
        type: 'error',
        message: error?.response?.data?.detail || 'No se pudo enviar la firma.',
      });
    } finally {
      setUploading(false);
    }
  };

  const isSignature = session?.side === 'signature';
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
            <h1 className="text-2xl font-black text-slate-900">{isSignature ? 'Capturar firma' : 'Capturar cédula'}</h1>
            <p className="mt-2 text-sm text-slate-500">
              {isSignature
                ? 'Firma dentro del recuadro y envíala. El formulario del computador se actualizará automáticamente.'
                : `Toma la foto de la ${sideLabel} y envíala. El formulario del computador se actualizará automáticamente.`}
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

              {session && !session.uploaded && isSignature && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <canvas
                      ref={canvasRef}
                      width={720}
                      height={260}
                      className="h-64 w-full touch-none rounded-xl bg-white"
                      onMouseDown={startSignature}
                      onMouseMove={drawSignature}
                      onMouseUp={stopSignature}
                      onMouseLeave={stopSignature}
                      onTouchStart={startSignature}
                      onTouchMove={drawSignature}
                      onTouchEnd={stopSignature}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={clearSignature}
                      className="rounded-2xl border border-slate-300 px-5 py-4 text-base font-black text-slate-700"
                    >
                      Limpiar
                    </button>
                    <button
                      type="button"
                      onClick={uploadSignature}
                      disabled={uploading || !hasSignature}
                      className="rounded-2xl px-5 py-4 text-base font-black text-white disabled:opacity-60"
                      style={{ backgroundColor: theme.primary }}
                    >
                      {uploading ? 'Enviando...' : 'Enviar firma'}
                    </button>
                  </div>
                </div>
              )}

              {session && !session.uploaded && !isSignature && (
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
                    <img src={previewUrl} alt={isSignature ? 'Vista previa de la firma' : 'Vista previa del documento'} className="h-72 w-full rounded-2xl object-contain bg-slate-50" />
                  )}

                  <button
                    type="button"
                    onClick={uploadPhoto}
                    disabled={uploading}
                    className="w-full rounded-2xl px-5 py-4 text-base font-black text-white disabled:opacity-60"
                    style={{ backgroundColor: theme.primary }}
                  >
                    {uploading ? 'Enviando...' : isSignature ? 'Enviar firma' : 'Enviar foto'}
                  </button>
                </div>
              )}

              {session?.uploaded && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center text-emerald-800">
                  <p className="text-lg font-black">{isSignature ? 'Firma recibida' : 'Foto recibida'}</p>
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
