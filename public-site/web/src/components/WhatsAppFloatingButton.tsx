import React, { useState } from 'react';
import { COMPANY_INFO } from '../data/company';
import { openChat } from '../chat';
import { MessageSquare, X } from 'lucide-react';

export const WhatsAppFloatingButton: React.FC = () => {
  const [showTooltip, setShowTooltip] = useState(true);

  const preFilledMessage = 'Hola, vengo desde la página web de Autos QP y quiero más información.';


  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
      {/* Tooltip speech bubble */}
      {showTooltip && (
        <div className="mb-2 bg-[#141b22] border border-[#00C896]/40 text-slate-100 text-xs px-3.5 py-2 rounded-2xl shadow-2xl flex items-center gap-2 max-w-xs animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div>
            <p className="font-bold text-[#00C896]">¿Asesoría inmediata?</p>
            <p className="text-[11px] text-slate-300">¡Habla con nuestro asesor virtual!</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowTooltip(false);
            }}
            className="text-slate-400 hover:text-white p-0.5 rounded-full"
            aria-label="Cerrar aviso"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Floating Action Button with green glow */}
      <button
        onClick={() => openChat()}
        className="w-14 h-14 rounded-full bg-[#00C896] hover:bg-[#00b486] text-slate-950 flex items-center justify-center shadow-lg shadow-[#00C896]/40 transform hover:scale-110 active:scale-95 transition-all duration-200 group focus:outline-none"
        aria-label="Abrir asesoría inmediata"
      >
        <MessageSquare className="w-7 h-7 fill-slate-950" />
      </button>
    </div>
  );
};
