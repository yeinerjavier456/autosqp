export type TransmissionType = 'Mecánico' | 'Automático';
export type FuelType = 'Gasolina' | 'Híbrido' | 'Eléctrico' | 'Diésel';
export type BodyType = 'Sedán' | 'Camioneta / SUV' | 'Pickup' | 'Hatchback';

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  version: string;
  year: number;
  price: number; // in COP
  mileage: number; // in km
  transmission: string;
  fuel: string;
  bodyType: string;
  isNewArrival?: boolean;
  isFeatured?: boolean;
  hasOptionalWarranty?: boolean; // eligible if model < 10 years old
  images: string[];
  specs: {
    engine: string; // e.g. "1.6L 16V" or "2.7L VVT-i"
    doors: number | string;
    traction: string; // e.g. "4x2" or "4x4"
    plateEnding: number | string; // e.g. 5
    soatValidUntil: string;
    technoValidUntil: string;
    color: string;
    city: string;
  };
  description: string;
}

export interface FilterState {
  search: string;
  make: string;
  model: string;
  minYear: number | '';
  maxYear: number | '';
  minPrice: number | '';
  maxPrice: number | '';
  transmission: string;
  fuel: string;
  bodyType: string;
}

export interface Testimonial {
  id: string;
  name: string;
  role?: string;
  avatar: string;
  rating: number;
  comment: string;
  vehiclePurchased?: string;
  date: string;
}

export interface FAQItem {
  id: string;
  category: 'COMPRA' | 'FINANCIAMIENTO' | 'VENTA' | 'REACTIVACION' | 'SEGUROS_GARANTIA';
  categoryLabel: string;
  question: string;
  answer: string;
}

export type PageTab =
  | 'inicio'
  | 'inventario'
  | 'financiamiento'
  | 'reactivacion-financiera'
  | 'nosotros'
  | 'contacto'
  | 'faq';
