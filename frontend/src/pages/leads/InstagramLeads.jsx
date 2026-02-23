import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const InstagramLeads = () => {
    const [conversations, setConversations] = useState([]);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        fetchConversations();
        const interval = setInterval(fetchConversations, 10000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (selectedConversation) {
            fetchMessages(selectedConversation.id);
            const msgInterval = setInterval(() => fetchMessages(selectedConversation.id), 5000);
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
            const response = await axios.get('http://3.234.117.124:8000/meta/conversations?source=instagram', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setConversations(response.data);
            setLoading(false);
        } catch (error) {
            console.error("Error fetching conventions", error);
        }
    };

    const handleSyncHistorical = async () => {
        if (!window.confirm("¿Seguro que deseas sincronizar el historial? Esto descargará los últimos 50 chats de tu Instagram.")) return;
        setIsSyncing(true);
        try {
            const token = localStorage.getItem('token');
            const response = await axios.post('http://3.234.117.124:8000/meta/sync-historical?source=instagram', {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            alert(`Sincronización Completada.\n- Mensajes sincronizados: ${response.data.synced_messages}\n- Nuevos Leads: ${response.data.new_leads}`);
            fetchConversations();
        } catch (error) {
            console.error("Error syncing historical messages", error);
            alert("Error al sincronizar. Asegúrate de tener el Token Configurado en Integraciones.");
        } finally {
            setIsSyncing(false);
        }
    };

    const fetchMessages = async (conversationId) => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`http://3.234.117.124:8000/meta/conversations/${conversationId}/messages`, {
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

            await axios.post(`http://3.234.117.124:8000/meta/conversations/${selectedConversation.id}/send`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setNewMessage("");
            fetchMessages(selectedConversation.id);
        } catch (error) {
            console.error("Error sending message", error);
        }
    };

    const formatTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="h-[calc(100vh-100px)] flex bg-white rounded-2xl overflow-hidden shadow-xl border border-gray-200">
            {/* Sidebar */}
            <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-pink-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <svg className="w-6 h-6 text-pink-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
                        <div>
                            <h2 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">Instagram</h2>
                            <p className="text-xs text-pink-500">Direct Messages</p>
                        </div>
                    </div>
                    <button
                        onClick={handleSyncHistorical}
                        disabled={isSyncing}
                        className="bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 text-white p-2 rounded-full shadow transition-all disabled:opacity-50"
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

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="p-4 text-center text-gray-400">Cargando chats...</div>
                    ) : conversations.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">No hay DMs de Instagram.</div>
                    ) : (
                        <ul>
                            {conversations.map(conv => (
                                <li
                                    key={conv.id}
                                    onClick={() => setSelectedConversation(conv)}
                                    className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-slate-50 transition ${selectedConversation?.id === conv.id ? 'bg-slate-50 border-l-4 border-l-pink-500' : ''}`}
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
                                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-100 to-pink-100 text-pink-600 flex items-center justify-center font-bold text-lg">
                                    {selectedConversation.lead?.name?.[0] || 'I'}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800">{selectedConversation.lead?.name}</h3>
                                    <p className="text-xs text-slate-500">Instagram User</p>
                                </div>
                            </div>
                        </div>

                        {/* Messages List */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                            {messages.map((msg) => {
                                const isUser = msg.sender_type === 'user';
                                return (
                                    <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[70%] rounded-2xl p-3 shadow-sm relative ${isUser ? 'bg-gradient-to-bl from-purple-500 to-pink-500 text-white rounded-br-none' : 'bg-white text-gray-800 rounded-bl-none border border-gray-100'}`}>
                                            {msg.message_type === 'image' && (
                                                <div className="mb-2">
                                                    <img src={msg.media_url} alt="Shared content" className="rounded-lg max-h-60 w-auto" />
                                                </div>
                                            )}
                                            <p className="text-sm">{msg.content}</p>
                                            <div className={`text-[10px] text-right mt-1 ml-4 ${isUser ? 'text-pink-100' : 'text-gray-400'}`}>
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
                                className="flex-1 px-4 py-3 rounded-full bg-slate-100 border-transparent focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-200 outline-none transition"
                            />
                            <button
                                type="submit"
                                disabled={!newMessage.trim()}
                                className="bg-gradient-to-r from-purple-500 to-pink-500 items-center justify-center w-12 h-12 rounded-full text-white hover:opacity-90 transition shadow-md disabled:opacity-50 disabled:shadow-none flex"
                            >
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M1.101 21.757 23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"></path></svg>
                            </button>
                        </form>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                        <svg className="w-16 h-16 text-slate-200 mb-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
                        <h3 className="text-xl font-medium text-slate-600 mb-1">Instagram Direct</h3>
                        <p className="text-sm">Selecciona una conversación para responder.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InstagramLeads;
