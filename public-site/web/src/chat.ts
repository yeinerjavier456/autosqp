export function openChat(vehicleId?: string) {
  window.dispatchEvent(new CustomEvent('autosqp:open-chat', { detail: { vehicleId } }));
}
