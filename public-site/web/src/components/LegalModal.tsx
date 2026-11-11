import React from 'react';
import { COMPANY_INFO } from '../data/company';
import { X, Shield } from 'lucide-react';

interface LegalModalProps {
  type: 'privacy' | 'data' | null;
  onClose: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({ type, onClose }) => {
  if (!type) return null;

  const isPrivacy = type === 'privacy';
  const title = isPrivacy
    ? 'Política de Privacidad y Términos de Uso'
    : 'Política de Tratamiento de Datos Personales (Ley 1581 de 2012)';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#11161d] border border-[#232c37] rounded-3xl p-6 sm:p-8 shadow-2xl my-8 animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-[#0a0d10] text-slate-400 hover:text-white transition-colors cursor-pointer"
          aria-label="Cerrar modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 text-[#00C896] mb-3">
          <Shield className="w-5 h-5" />
          <span className="text-xs font-bold uppercase tracking-wider">{COMPANY_INFO.name} · NIT {COMPANY_INFO.nit}</span>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mb-4">
          {title}
        </h2>

        <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
          {isPrivacy ? (
            <>
              <p>
                <strong>AUTOS QP S.A.S.</strong>, identificada con NIT <strong>901.263.615-6</strong>, domiciliada en Bogotá D.C. en el C.C. Outlet Factory (Av. de las Américas #62-84, Local 128), informa a los usuarios y clientes que la información suministrada a través de nuestros canales digitales será utilizada exclusivamente para:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Gestión de solicitudes de cotización, compra, venta o consignación de vehículos automotores.</li>
                <li>Tramitación y radicación de solicitudes de crédito vehicular ante las entidades bancarias y financieras aliadas.</li>
                <li>Contacto y asesoría jurídica/financiera personalizada en los servicios de Reactivación Financiera.</li>
                <li>Cotización comparativa de pólizas de seguro todo riesgo y emisión de SOAT con aseguradoras vinculadas.</li>
              </ul>
              <p>
                Garantizamos que bajo ninguna circunstancia comercializamos, alquilamos ni cedemos bases de datos personales a terceros no autorizados.
              </p>
              <p>
                Los precios y disponibilidades publicados en este sitio web corresponden a inventario real y están sujetos a verificación previa al perfeccionamiento del contrato de compraventa y formalización de traspaso.
              </p>
            </>
          ) : (
            <>
              <p>
                En cumplimiento de la <strong>Ley Estatutaria 1581 de 2012</strong> y sus decretos reglamentarios sobre Protección de Datos Personales en Colombia, <strong>AUTOS QP S.A.S.</strong> actúa como Responsable del Tratamiento de los datos personales obtenidos a través de su portal web, formularios y canales de atención de WhatsApp.
              </p>
              <p>
                <strong>Derechos de los Titulares:</strong> Los titulares de los datos tienen derecho a conocer, actualizar, rectificar y solicitar la supresión de sus datos personales, así como a revocar la autorización otorgada para su tratamiento cuando consideren pertinente.
              </p>
              <p>
                <strong>Canal de Peticiones, Quejas y Reclamos (PQR):</strong> Para ejercer sus derechos de Habeas Data, el titular puede enviar una comunicación formal al correo electrónico oficial: <strong>autosqpc@gmail.com</strong> o radicarla físicamente en nuestra vitrina en el Local 128 del C.C. Outlet Factory en Bogotá.
              </p>
              <p>
                <strong>Tratamiento de Información Crediticia y Financiera:</strong> La consulta y radicación de perfiles ante centrales de riesgo (Datacrédito y TransUnion) se realiza con expresa autorización previa del titular y únicamente con el objetivo de evaluar viabilidad financiera vehicular.
              </p>
            </>
          )}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800 text-right">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg bg-[#00C896] text-slate-950 font-bold text-xs"
          >
            Entendido y cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
