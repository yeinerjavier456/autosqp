export async function sendContact(payload: Record<string, unknown>, requestId: string) {
  const response = await fetch('/api/public/website/contact', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, request_id: requestId })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data.detail === 'string' ? data.detail
      : Array.isArray(data.detail) && data.detail[0]?.msg ? String(data.detail[0].msg).replace(/^Value error,\s*/, '')
      : 'No fue posible registrar la solicitud. Intenta nuevamente.';
    throw new Error(message);
  }
  return data;
}
