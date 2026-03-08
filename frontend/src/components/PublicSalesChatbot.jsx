import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';

const SESSION_STORAGE_KEY = 'autosqp_public_chat_session';

const PublicSalesChatbot = ({ vehicleId = null }) => {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [sessionToken, setSessionToken] = useState('');
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const endRef = useRef(null);

    const ensureSession = async () => {
        let token = localStorage.getItem(SESSION_STORAGE_KEY) || '';
        if (!token) {
            const res = await axios.post('https://autosqp.co/api/public-chat/session', {
                source_page: window.location.pathname
            });
            token = res.data.session_token;
            localStorage.setItem(SESSION_STORAGE_KEY, token);
        }
        setSessionToken(token);
        return token;
    };

    const loadHistory = async (token) => {
        try {
            const res = await axios.get(`https://autosqp.co/api/public-chat/${token}/messages`);
            const apiMessages = (res.data || []).map(m => ({ role: m.role, content: m.content }));
            setMessages(apiMessages);
        } catch (error) {
            setMessages([]);
        }
    };

    useEffect(() => {
        if (!open) return;
        (async () => {
            const token = await ensureSession();
            await loadHistory(token);
        })();
    }, [open]);

    useEffect(() => {
        if (open) {
            endRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, open]);

    const sendMessage = async (e) => {
        e.preventDefault();
        const text = input.trim();
        if (!text || loading) return;

        setLoading(true);
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: text }]);

        try {
            const token = sessionToken || await ensureSession();
            const res = await axios.post('https://autosqp.co/api/public-chat/message', {
                session_token: token,
                message: text,
                vehicle_id: vehicleId || undefined,
                source_page: window.location.pathname
            });
            setMessages(prev => [...prev, { role: 'assistant', content: res.data.reply }]);
        } catch (error) {
            setMessages(prev => [...prev, { role: 'assistant', content: 'Perdón, tuve un problema técnico. ¿Me repites tu mensaje?' }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {open && (
                <div className="fixed bottom-24 right-4 md:right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] h-[560px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
                    <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
                        <div>
                            <h3 className="font-bold">Autos QP</h3>
                            <p className="text-xs text-slate-300">Atención comercial en línea</p>
                        </div>
                        <button onClick={() => setOpen(false)} className="text-slate-300 hover:text-white">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50">
                        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-3 py-2 text-xs">
                            Para iniciar la conversación con una asesora, escribe tu mensaje.
                        </div>
                        {messages.map((m, idx) => (
                            <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'}`}>
                                    {m.content}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="max-w-[85%] rounded-2xl px-3 py-2 text-sm bg-white border border-slate-200 text-slate-500 rounded-bl-none">
                                    Escribiendo...
                                </div>
                            </div>
                        )}
                        <div ref={endRef} />
                    </div>

                    <form onSubmit={sendMessage} className="p-3 border-t bg-white flex gap-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Escribe tu mensaje..."
                            className="flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                            type="submit"
                            disabled={loading || !input.trim()}
                            className="w-10 h-10 rounded-full bg-blue-600 text-white disabled:opacity-50"
                        >
                            <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                        </button>
                    </form>
                </div>
            )}

            <button
                type="button"
                onClick={() => setOpen(prev => !prev)}
                className="fixed bottom-4 right-4 md:right-6 z-50 w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xl flex items-center justify-center"
                title="Hablar con un asesor"
            >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
            </button>
        </>
    );
};

export default PublicSalesChatbot;
