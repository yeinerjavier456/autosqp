import { useEffect, useSyncExternalStore } from 'react';
import defaults from '../../content-defaults.json';
import { Testimonial } from './types';

let snapshot = { values: {} as Record<string, string>, testimonials: defaults.testimonials as Testimonial[], loaded: false, error: '' };
const subscribers = new Set<() => void>();
const notify = () => subscribers.forEach(callback => callback());
const subscribe = (callback: () => void) => { subscribers.add(callback); return () => subscribers.delete(callback); };

export function webText(key: string, fallback: string): string {
  const value = snapshot.values[key];
  if (typeof value !== 'string') return fallback;
  // Keep deliberate spaces surrounding inline highlighted words.
  return (fallback.startsWith(' ') ? ' ' : '') + value.trim() + (fallback.endsWith(' ') ? ' ' : '');
}
export function websiteTestimonials(): Testimonial[] { return snapshot.testimonials; }

export function useWebsiteContent() {
  const current = useSyncExternalStore(subscribe, () => snapshot);
  useEffect(() => {
    let pending = false;
    const controller = new AbortController();
    const load = async () => {
      if (pending || controller.signal.aborted || document.visibilityState === 'hidden') return;
      pending = true;
      try {
        const response = await fetch('/api/public/website/content', { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('No pudimos cargar el contenido de esta página. Intenta nuevamente.');
        const data = await response.json();
        if (!controller.signal.aborted) {
          snapshot = { values: data.values || {}, testimonials: Array.isArray(data.testimonials) ? data.testimonials : defaults.testimonials,
            loaded: true, error: '' };
          notify();
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          snapshot = { ...snapshot, error: error instanceof Error ? error.message : 'No pudimos cargar la página.' };
          notify();
        }
      } finally { pending = false; }
    };
    load();
    const interval = window.setInterval(load, 60000);
    document.addEventListener('visibilitychange', load);
    return () => { controller.abort(); clearInterval(interval); document.removeEventListener('visibilitychange', load); };
  }, []);
  return current;
}
