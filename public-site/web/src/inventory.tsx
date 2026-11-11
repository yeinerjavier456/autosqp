import React, { createContext, useContext, useEffect, useState } from 'react';
import { Vehicle } from './types';

const InventoryContext = createContext({ vehicles: [] as Vehicle[], brands: [] as string[], loading: true, error: '' });
export const useInventory = () => useContext(InventoryContext);
export function InventoryProvider({ children }: { children: React.ReactNode }) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const items: Vehicle[] = [];
        let cursor: number | null = null;
        do {
          const response = await fetch('/api/public/website/inventory' + (cursor ? `?before_id=${cursor}` : ''), { signal: controller.signal });
          if (!response.ok) throw new Error('No pudimos cargar el inventario. Intenta nuevamente más tarde.');
          const page = await response.json();
          items.push(...page.items);
          cursor = page.next_cursor;
        } while (cursor);
        if (!controller.signal.aborted) setVehicles(items);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'No se pudo cargar el inventario.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);
  const brands = [...new Set(vehicles.map(vehicle => vehicle.make).filter(Boolean))].sort();
  return <InventoryContext.Provider value={{ vehicles, brands, loading, error }}>{children}</InventoryContext.Provider>;
}
