export const VEHICLE_CATALOG = {
  Chevrolet: ['Aveo', 'Beat', 'Captiva', 'Colorado', 'Cruze', 'Equinox', 'Joy', 'Montana', 'Onix', 'Sail', 'Spark', 'Tracker'],
  Renault: ['Alaskan', 'Captur', 'Duster', 'Kangoo', 'Koleos', 'Logan', 'Oroch', 'Sandero', 'Stepway'],
  Mazda: ['2', '3', '6', 'BT-50', 'CX-3', 'CX-30', 'CX-5', 'CX-50', 'CX-60', 'CX-9'],
  Kia: ['Carnival', 'Cerato', 'K3', 'Niro', 'Picanto', 'Rio', 'Seltos', 'Sonet', 'Sorento', 'Sportage', 'Stonic'],
  Toyota: ['4Runner', 'Corolla', 'Corolla Cross', 'Fortuner', 'Hilux', 'Land Cruiser Prado', 'RAV4', 'SW4', 'Yaris', 'Yaris Cross'],
  Nissan: ['Frontier', 'Kicks', 'March', 'Murano', 'Pathfinder', 'Qashqai', 'Sentra', 'Versa', 'X-Trail'],
  Suzuki: ['Baleno', 'Celerio', 'Ertiga', 'Grand Vitara', 'Jimny', 'S-Cross', 'Swift', 'Vitara'],
  Hyundai: ['Accent', 'Creta', 'Elantra', 'Grand i10', 'Santa Fe', 'Tucson', 'Venue'],
  Volkswagen: ['Amarok', 'Gol', 'Jetta', 'Nivus', 'Polo', 'Saveiro', 'Taos', 'T-Cross', 'Tiguan', 'Virtus', 'Voyage'],
  Ford: ['Bronco Sport', 'EcoSport', 'Escape', 'Explorer', 'F-150', 'Fiesta', 'Focus', 'Maverick', 'Ranger'],
  BYD: ['Dolphin', 'Dolphin Mini', 'Han', 'Seal', 'Song Plus', 'Tang', 'Yuan Plus'],
  Chery: ['Tiggo 2 Pro', 'Tiggo 4 Pro', 'Tiggo 7 Pro', 'Tiggo 8 Pro'],
  Citroen: ['Basalt', 'Berlingo', 'C3', 'C3 Aircross', 'C4 Cactus'],
  Peugeot: ['2008', '208', '3008', '5008', 'Partner'],
  BMW: ['Serie 1', 'Serie 2', 'Serie 3', 'Serie 5', 'X1', 'X3', 'X5'],
  'Mercedes-Benz': ['Clase A', 'Clase C', 'Clase E', 'GLA', 'GLB', 'GLC', 'GLE'],
  JAC: ['JS2', 'JS3', 'JS4', 'JS6', 'T6', 'T8'],
  JMC: ['Vigus', 'Vigus Pro'],
  Foton: ['Tunland', 'View', 'Aumark'],
  Mitsubishi: ['ASX', 'L200', 'Montero Sport', 'Outlander', 'Xpander'],
};

export const VEHICLE_BRANDS = Object.keys(VEHICLE_CATALOG);

export const COLOMBIA_CITY_OPTIONS = [
  'Bogota D.C.', 'Medellin', 'Cali', 'Barranquilla', 'Cartagena', 'Cucuta', 'Bucaramanga', 'Pereira',
  'Santa Marta', 'Ibague', 'Manizales', 'Villavicencio', 'Pasto', 'Monteria', 'Neiva', 'Armenia',
  'Popayan', 'Sincelejo', 'Valledupar', 'Tunja', 'Riohacha', 'Florencia', 'Quibdo', 'Yopal',
  'Arauca', 'Mocoa', 'Leticia', 'San Andres', 'Inirida', 'Mitú', 'Puerto Carreno', 'Soacha',
  'Bello', 'Itagui', 'Envigado', 'Sabaneta', 'Rionegro', 'Apartado', 'Turbo', 'Girardota',
  'Copacabana', 'La Estrella', 'Chia', 'Zipaquira', 'Facatativa', 'Mosquera', 'Funza', 'Madrid',
  'Fusagasuga', 'Girardot', 'Cajica', 'Cota', 'Sopo', 'Tocancipa', 'La Calera', 'Jamundi',
  'Palmira', 'Buga', 'Tulua', 'Cartago', 'Yumbo', 'Buenaventura', 'Soledad', 'Malambo',
  'Sabanalarga', 'Galapa', 'Puerto Colombia', 'Turbaco', 'Magangue', 'El Carmen de Bolivar',
  'Floridablanca', 'Giron', 'Piedecuesta', 'Barrancabermeja', 'San Gil', 'Duitama', 'Sogamoso',
  'Chiquinquira', 'Villa de Leyva', 'Dosquebradas', 'Santa Rosa de Cabal', 'La Virginia',
  'Calarca', 'La Tebaida', 'Montenegro', 'Cienaga', 'Fundacion', 'Aguachica', 'Ocaña',
  'Pamplona', 'Los Patios', 'Villa del Rosario', 'Ipiales', 'Tumaco', 'Sahagun', 'Cereté',
  'Lorica', 'Planeta Rica', 'Espinal', 'Melgar', 'Honda', 'Garzon', 'Pitalito', 'La Plata',
  'Acacias', 'Granada', 'Puerto Lopez', 'San Jose del Guaviare',
];

export const sanitizeMoneyInput = (value) => String(value || '').replace(/[^\d]/g, '');

export const formatMoneyInput = (value) => {
  const digits = sanitizeMoneyInput(value);
  if (!digits) return '';
  return Number(digits).toLocaleString('en-US');
};

export const getVehicleModelOptions = (brand) => VEHICLE_CATALOG[brand] || [];
