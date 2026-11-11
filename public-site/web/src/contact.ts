export async function sendContact(payload: Record<string, unknown>, requestId: string) {
  const response = await fetch('/api/public/website/contact', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, request_id: requestId })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'No fue posible enviar el mensaje. Intenta nuevamente.');
  return data;
}
