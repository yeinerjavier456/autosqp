import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';

const SESSION_STORAGE_KEY = 'autosqp_public_chat_session';

const PublicSalesChatbot = ({
    vehicleId = null,
    sourcePage = null,
    sessionStorageKey = SESSION_STORAGE_KEY,
    autoOpen = false,
    initialAssistantMessage = '',
    hideLauncher = false,
    embedded = false
}) => {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const [sessionToken, setSessionToken] = useState('');
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [chatbotConfig, setChatbotConfig] = useState({
        bot_name: 'Jennifer Quimbayo',
        typing_min_ms: 7000,
        typing_max_ms: 18000
    });
    const endRef = useRef(null);

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    const resolvedSourcePage = sourcePage || window.location.pathname;
    const visibleMessages = messages.length > 0
        ? messages
        : (initialAssistantMessage
            ? [{ role: 'assistant', content: initialAssistantMessage }]
            : []);

    const ensureSession = async () => {
        let token = localStorage.getItem(sessionStorageKey) || '';
        if (!token) {
            const res = await axios.post('https://autosqp.co/api/public-chat/session', {
                source_page: resolvedSourcePage
            });
            token = res.data.session_token;
            localStorage.setItem(sessionStorageKey, token);
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

    const loadChatbotConfig = async (token) => {
        try {
            const res = await axios.post('https://autosqp.co/api/public-chat/config', {
                session_token: token
            });
            if (res.data) {
                setChatbotConfig({
                    bot_name: res.data.bot_name || 'Jennifer Quimbayo',
                    typing_min_ms: Number(res.data.typing_min_ms) || 7000,
                    typing_max_ms: Number(res.data.typing_max_ms) || 18000
                });
            }
        } catch (error) {
            // Keep defaults if config cannot be loaded
        }
    };

    useEffect(() => {
        if (autoOpen) {
            setOpen(true);
        }
    }, [autoOpen]);

    useEffect(() => {
        if (!open) return;
        (async () => {
            const token = await ensureSession();
            await loadChatbotConfig(token);
            await loadHistory(token);
        })();
    }, [open]);

    useEffect(() => {
        if (!open || !sessionToken) return;
        const intervalId = setInterval(async () => {
            try {
                const res = await axios.post('https://autosqp.co/api/public-chat/check-inactive', {
                    session_token: sessionToken
                });
                if (res.data?.nudged) {
                    await loadHistory(sessionToken);
                }
            } catch (error) {
                // silent: background check should not break chat UX
            }
        }, 30000);

        return () => clearInterval(intervalId);
    }, [open, sessionToken]);

    useEffect(() => {
        if (open) {
            endRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, open, loading, isTyping]);

    const simulateTypingReply = async (replyText) => {
        const safeReply = replyText || '';
        const typingMin = Math.max(0, Number(chatbotConfig.typing_min_ms) || 7000);
        const typingMax = Math.max(typingMin, Number(chatbotConfig.typing_max_ms) || 18000);
        const preDelay = Math.min(typingMax, Math.max(typingMin, 5500 + safeReply.length * 35));

        setIsTyping(true);
        await sleep(preDelay);
        setMessages(prev => [...prev, { role: 'assistant', content: safeReply }]);
        setIsTyping(false);
    };

    const sendMessage = async (e) => {
        e.preventDefault();
        const text = input.trim();
        if (!text || loading) return;

        setLoading(true);
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: text }]);

        let assistantReply = 'Perdón, tuve un problema técnico. ¿Me repites tu mensaje?';
        try {
            const token = sessionToken || await ensureSession();
            const res = await axios.post('https://autosqp.co/api/public-chat/message', {
                session_token: token,
                message: text,
                vehicle_id: vehicleId || undefined,
                source_page: resolvedSourcePage
            });
            assistantReply = res.data.reply || assistantReply;
        } catch (error) {
            // Keep fallback reply
        } finally {
            setLoading(false);
            await simulateTypingReply(assistantReply);
        }
    };

    return (
        <>
            {open && (
                <div className={`${embedded ? 'relative w-full max-w-none h-[430px] sm:h-[470px] lg:h-[500px] 2xl:h-[540px]' : 'fixed bottom-24 right-4 md:right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] h-[560px]'} bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col`}>
                    <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
                        <div>
                            <h3 className="font-bold">Autos QP</h3>
                            <p className="text-xs text-slate-300">Atención comercial en línea</p>
                        </div>
                        <button onClick={() => setOpen(false)} className={`text-slate-300 hover:text-white ${hideLauncher ? 'hidden' : ''}`}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50 min-h-0">
                        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-3 py-2 text-xs">
                            Para iniciar la conversación con una asesora, escribe tu mensaje.
                        </div>
                        {visibleMessages.map((m, idx) => (
                            <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'}`}>
                                    {m.content}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="max-w-[85%] rounded-2xl px-3 py-2 text-sm bg-white border border-slate-200 text-slate-500 rounded-bl-none">
                                    {chatbotConfig.bot_name} está escribiendo
                                    <span className="inline-flex ml-1 gap-1 align-middle">
                                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                                    </span>
                                </div>
                            </div>
                        )}
                        {!loading && isTyping && (
                            <div className="flex justify-start">
                                <div className="max-w-[85%] rounded-2xl px-3 py-2 text-sm bg-white border border-slate-200 text-slate-500 rounded-bl-none">
                                    {chatbotConfig.bot_name} está escribiendo
                                    <span className="inline-flex ml-1 gap-1 align-middle">
                                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                                    </span>
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
                            className="flex-1 min-w-0 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                            type="submit"
                            disabled={loading || isTyping || !input.trim()}
                            className="w-10 h-10 rounded-full bg-blue-600 text-white disabled:opacity-50"
                        >
                            <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                        </button>
                    </form>
                </div>
            )}
            {!hideLauncher && (
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
            )}
        </>
    );
};

export default PublicSalesChatbot;
