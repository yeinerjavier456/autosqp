import { webText } from "../content";
import React from 'react';
import { COMPANY_INFO } from '../data/company';
import { X, Shield } from 'lucide-react';
interface LegalModalProps {
  type: 'privacy' | 'data' | null;
  onClose: () => void;
}
export const LegalModal: React.FC<LegalModalProps> = ({
  type,
  onClose
}) => {
  if (!type) return null;
  const isPrivacy = type === 'privacy';
  const title = isPrivacy ? 'Política de Privacidad y Términos de Uso' : 'Política de Tratamiento de Datos Personales (Ley 1581 de 2012)';
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#11161d] border border-[#232c37] rounded-3xl p-6 sm:p-8 shadow-2xl my-8 animate-in fade-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-[#0a0d10] text-slate-400 hover:text-white transition-colors cursor-pointer" aria-label={webText("LegalModal.0c4bfc3411d1", "Cerrar modal")}>
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 text-[#00C896] mb-3">
          <Shield className="w-5 h-5" />
          <span className="text-xs font-bold uppercase tracking-wider">{COMPANY_INFO.name}{webText("LegalModal.49d6c398d10c", " \xB7 NIT ")}{COMPANY_INFO.nit}</span>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight mb-4">
          {title}
        </h2>

        <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
          {isPrivacy ? <>
              <p>
                <strong>{webText("LegalModal.7dcbb3737f2d", "AUTOS QP S.A.S.")}</strong>{webText("LegalModal.da891d5a5ef6", ", identificada con NIT ")}<strong>{webText("LegalModal.7d3ed5335323", "901.263.615-6")}</strong>{webText("LegalModal.e761202f8c11", ", domiciliada en Bogot\xE1 D.C. en el C.C. Outlet Factory (Av. de las Am\xE9ricas #62-84, Local 128), informa a los usuarios y clientes que la informaci\xF3n suministrada a trav\xE9s de nuestros canales digitales ser\xE1 utilizada exclusivamente para:")}</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>{webText("LegalModal.2ef730c20cd2", "Gesti\xF3n de solicitudes de cotizaci\xF3n, compra, venta o consignaci\xF3n de veh\xEDculos automotores.")}</li>
                <li>{webText("LegalModal.fd249daf159e", "Tramitaci\xF3n y radicaci\xF3n de solicitudes de cr\xE9dito vehicular ante las entidades bancarias y financieras aliadas.")}</li>
                <li>{webText("LegalModal.4804f0fc5607", "Contacto y asesor\xEDa jur\xEDdica/financiera personalizada en los servicios de Reactivaci\xF3n Financiera.")}</li>
                <li>{webText("LegalModal.54d216a3d7ad", "Cotizaci\xF3n comparativa de p\xF3lizas de seguro todo riesgo y emisi\xF3n de SOAT con aseguradoras vinculadas.")}</li>
              </ul>
              <p>{webText("LegalModal.01e5e1f66e7f", "Garantizamos que bajo ninguna circunstancia comercializamos, alquilamos ni cedemos bases de datos personales a terceros no autorizados.")}</p>
              <p>{webText("LegalModal.01434edde204", "Los precios y disponibilidades publicados en este sitio web corresponden a inventario real y est\xE1n sujetos a verificaci\xF3n previa al perfeccionamiento del contrato de compraventa y formalizaci\xF3n de traspaso.")}</p>
            </> : <>
              <p>{webText("LegalModal.46af1add8ca4", "En cumplimiento de la ")}<strong>{webText("LegalModal.71b24f9ba631", "Ley Estatutaria 1581 de 2012")}</strong>{webText("LegalModal.c9a9e70b9e69", " y sus decretos reglamentarios sobre Protecci\xF3n de Datos Personales en Colombia, ")}<strong>{webText("LegalModal.7dcbb3737f2d.2", "AUTOS QP S.A.S.")}</strong>{webText("LegalModal.5af1c0bf9312", " act\xFAa como Responsable del Tratamiento de los datos personales obtenidos a trav\xE9s de su portal web, formularios y canales de atenci\xF3n de WhatsApp.")}</p>
              <p>
                <strong>{webText("LegalModal.cae5306a9249", "Derechos de los Titulares:")}</strong>{webText("LegalModal.b7ff9b2a8fa7", " Los titulares de los datos tienen derecho a conocer, actualizar, rectificar y solicitar la supresi\xF3n de sus datos personales, as\xED como a revocar la autorizaci\xF3n otorgada para su tratamiento cuando consideren pertinente.")}</p>
              <p>
                <strong>{webText("LegalModal.5cb9b49a9d31", "Canal de Peticiones, Quejas y Reclamos (PQR):")}</strong>{webText("LegalModal.f807677b55f6", " Para ejercer sus derechos de Habeas Data, el titular puede enviar una comunicaci\xF3n formal al correo electr\xF3nico oficial: ")}<strong>{webText("LegalModal.60c4cd5e891a", "autosqpc@gmail.com")}</strong>{webText("LegalModal.9b76849fcc42", " o radicarla f\xEDsicamente en nuestra vitrina en el Local 128 del C.C. Outlet Factory en Bogot\xE1.")}</p>
              <p>
                <strong>{webText("LegalModal.c499477f7a9a", "Tratamiento de Informaci\xF3n Crediticia y Financiera:")}</strong>{webText("LegalModal.afb2c8a43905", " La consulta y radicaci\xF3n de perfiles ante centrales de riesgo (Datacr\xE9dito y TransUnion) se realiza con expresa autorizaci\xF3n previa del titular y \xFAnicamente con el objetivo de evaluar viabilidad financiera vehicular.")}</p>
            </>}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800 text-right">
          <button onClick={onClose} className="px-6 py-2.5 rounded-lg bg-[#00C896] text-slate-950 font-bold text-xs">{webText("LegalModal.f769e9d72727", "Entendido y cerrar")}</button>
        </div>
      </div>
    </div>;
};
