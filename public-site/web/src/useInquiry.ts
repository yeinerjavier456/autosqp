import { useRef, useState } from 'react';
import { sendContact } from './contact';

export function useInquiry() {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const inFlight = useRef(false);
  const request = useRef({ id: '', fingerprint: '' });
  const submit = async (payload: Record<string, unknown>) => {
    if (inFlight.current) return;
    inFlight.current = true; setSending(true); setError('');
    const fingerprint = JSON.stringify(payload);
    if (request.current.fingerprint !== fingerprint) request.current = { id: crypto.randomUUID(), fingerprint };
    try {
      const result = await sendContact(payload, request.current.id);
      if (!result.received && !result.sent) throw new Error('No pudimos confirmar el registro de la solicitud.');
      setSubmitted(true);
      return result;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos registrar la solicitud.');
    } finally { inFlight.current = false; setSending(false); }
  };
  return { sending, error, submitted, submit };
}
