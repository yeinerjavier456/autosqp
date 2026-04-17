import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const FacebookLeads = () => {
    const [conversations, setConversations] = useState([]);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const messagesEndRef = useRef(null);

    useEffect(() => {
        fetchConversations();
        backgroundSync();

        // Poll for new conversations every 10 seconds
        const interval = setInterval(fetchConversations, 300000);

        // Background sync meta historical every 5 seconds as requested
        const syncInterval = setInterval(backgroundSync, 300000);

        return () => {
            clearInterval(interval);
            clearInterval(syncInterval);
        };
    }, []);

    useEffect(() => {
        if (selectedConversation) {
            fetchMessages(selectedConversation.id);
            const msgInterval = setInterval(() => fetchMessages(selectedConversation.id), 300000);
            return () => clearInterval(msgInterval);
        }
    }, [selectedConversation]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const fetchConversations = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('https://autosqp.co/api/meta/conversations?source=facebook', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setConversations(response.data);
            setLoading(false);
        } catch (error) {
            console.error("Error fetching conventions", error);
        }
    };

    const backgroundSync = async () => {
        try {
            const token = localStorage.getItem('token');
            // Silent sync
            await axios.post('https://autosqp.co/api/meta/sync-historical?source=facebook', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // Don't call fetchConversations here to avoid re-rendering loop, the other interval handles it
        } catch (error) {
            // Silently ignore sync errors (like 400 for unconfigured tokens) to avoid console spam
        }
    };

    const handleSyncHistorical = async () => {
        if (!window.confirm("¿Seguro que deseas sincronizar el historial? Esto descargará los últimos 50 chats de tu Facebook.")) return;
        setIsSyncing(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post('https://autosqp.co/api/meta/sync-historical?source=facebook', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert(`Sincronización Completada.\n- Mensajes sincronizados: ${response.data.synced_messages}\n- Nuevos Leads: ${response.data.new_leads}`);
            fetchConversations();
        } catch (error) {
            console.error("Error syncing historical messages", error);
            alert("Error al sincronizar. Asegúrate de tener el Token de Facebook en Integraciones.");
        } finally {
            setIsSyncing(false);
        }
    };

    const fetchMessages = async (conversationId) => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`https://autosqp.co/api/meta/conversations/${conversationId}/messages`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessages(response.data);
        } catch (error) {
            console.error("Error fetching messages", error);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !selectedConversation) return;

        try {
            const token = localStorage.getItem('token');
            const payload = {
                conversation_id: selectedConversation.id,
                sender_type: 'user',
                content: newMessage,
                message_type: 'text'
            };

            await axios.post(`https://autosqp.co/api/meta/conversations/${selectedConversation.id}/send`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setNewMessage("");
            fetchMessages(selectedConversation.id);
        } catch (error) {
            console.error("Error sending message", error);
        }
    };

    const formatTime = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const isToday = date.getDate() === now.getDate() &&
            date.getMonth() === now.getMonth() &&
            date.getFullYear() === now.getFullYear();

        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (isToday) {
            return timeStr;
        } else {
            return `${date.toLocaleDateString([], { day: '2-digit', month: '2-digit' })} ${timeStr}`;
        }
    };

    return (
        <div className="h-[calc(100vh-100px)] flex bg-white rounded-2xl overflow-hidden shadow-xl border border-gray-200">
            {/* Sidebar */}
            <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-4 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                        <div>
                            <h2 className="text-xl font-bold text-blue-900">Facebook</h2>
                            <p className="text-xs text-blue-600">Messenger Chats</p>
                        </div>
                    </div>
                    <button
                        onClick={handleSyncHistorical}
                        disabled={isSyncing}
                        className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full shadow transition-colors disabled:opacity-50"
                        title="Sincronizar Historial"
                    >
                        {isSyncing ? (
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                        )}
                    </button>
                </div>

                {/* Search Bar */}
                <div className="px-4 pb-3 bg-blue-50 border-b border-blue-100">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Buscar cliente o teléfono..."
                            className="w-full pl-9 pr-4 py-2 bg-white border border-blue-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="p-4 text-center text-gray-400">Cargando chats...</div>
                    ) : conversations.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">No hay mensajes de Facebook.</div>
                    ) : (
                        <ul>
                            {conversations
                                .filter(conv => {
                                    const query = searchTerm.toLowerCase();
                                    const name = (conv.lead?.name || '').toLowerCase();
                                    const phone = (conv.lead?.phone || '').toLowerCase();
                                    return name.includes(query) || phone.includes(query);
                                })
                                .map(conv => (
                                    <li
                                        key={conv.id}
                                        onClick={() => setSelectedConversation(conv)}
                                        className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-slate-50 transition ${selectedConversation?.id === conv.id ? 'bg-slate-50 border-l-4 border-l-blue-600' : ''}`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="font-semibold text-slate-800">
                                                {conv.lead ? (conv.lead.name || conv.lead.phone) : 'Desconocido'}
                                            </div>
                                            <div className="text-xs text-slate-400">
                                                {formatTime(conv.last_message_at)}
                                            </div>
                                        </div>
                                        <div className="text-sm text-slate-500 truncate mt-1">Click para ver mensajes</div>
                                    </li>
                                ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col bg-slate-50">
                {selectedConversation ? (
                    <>
                        {/* Header */}
                        <div className="p-4 bg-white border-b border-gray-200 flex items-center justify-between shadow-sm z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg">
                                    {selectedConversation.lead?.name?.[0] || 'F'}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800">{selectedConversation.lead?.name}</h3>
                                    <p className="text-xs text-slate-500">Facebook User</p>
                                </div>
                            </div>
                        </div>

                        {/* Messages List */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {messages.map((msg) => {
                                const isUser = msg.sender_type === 'user';
                                return (
                                    <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[70%] rounded-2xl p-3 shadow-sm relative ${isUser ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none border border-gray-100'}`}>
                                            {msg.message_type === 'image' && (
                                                <div className="mb-2">
                                                    <img src={msg.media_url} alt="Shared content" className="rounded-lg max-h-60 w-auto" />
                                                </div>
                                            )}
                                            <p className="text-sm">{msg.content}</p>
                                            <div className={`text-[10px] text-right mt-1 ml-4 ${isUser ? 'text-blue-200' : 'text-gray-400'}`}>
                                                {formatTime(msg.created_at)}
                                                {isUser && (
                                                    <span className="ml-1">
                                                        {msg.status === 'read' ? '✓✓' : '✓'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-200 flex gap-2 items-center">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Escribe un mensaje..."
                                className="flex-1 px-4 py-3 rounded-full bg-slate-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
                            />
                            <button
                                type="submit"
                                disabled={!newMessage.trim()}
                                className="bg-blue-600 items-center justify-center w-12 h-12 rounded-full text-white hover:bg-blue-700 transition shadow-md disabled:opacity-50 disabled:shadow-none flex"
                            >
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M1.101 21.757 23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"></path></svg>
                            </button>
                        </form>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                        <svg className="w-16 h-16 text-slate-200 mb-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                        <h3 className="text-xl font-medium text-slate-600 mb-1">Messenger</h3>
                        <p className="text-sm">Selecciona una conversación para responder.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FacebookLeads;
