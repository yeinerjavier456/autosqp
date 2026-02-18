import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const WhatsAppDashboard = () => {
    const { user } = useAuth();
    const [conversations, setConversations] = useState([]);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        fetchConversations();

        // Poll for new conversations every 10 seconds
        const interval = setInterval(fetchConversations, 10000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (selectedConversation) {
            fetchMessages(selectedConversation.id);
            // Poll messages for active conversation
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
            const response = await axios.get('http://localhost:8000/whatsapp/conversations', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setConversations(response.data);
            setLoading(false);
        } catch (error) {
            console.error("Error fetching conversations", error);
        }
    };

    const fetchMessages = async (conversationId) => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`http://localhost:8000/whatsapp/conversations/${conversationId}/messages`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            // verify if new messages to scroll? For now just set
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

            await axios.post(`http://localhost:8000/whatsapp/conversations/${selectedConversation.id}/send`, payload, {
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
        <div className="h-[calc(100vh-100px)] flex bg-gray-100 rounded-2xl overflow-hidden shadow-xl border border-gray-200">
            {/* Sidebar - Conversations List */}
            <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-4 bg-gray-50 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-slate-800">Mensajes</h2>
                    <p className="text-xs text-slate-500">Chats de WhatsApp Business</p>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="p-4 text-center text-gray-400">Cargando chats...</div>
                    ) : conversations.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">No hay conversaciones activas.</div>
                    ) : (
                        <ul>
                            {conversations.map(conv => (
                                <li
                                    key={conv.id}
                                    onClick={() => setSelectedConversation(conv)}
                                    className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition ${selectedConversation?.id === conv.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="font-semibold text-slate-800">
                                            {conv.lead ? (conv.lead.name || conv.lead.phone) : 'Desconocido'}
                                        </div>
                                        <div className="text-xs text-slate-400">
                                            {formatTime(conv.last_message_at)}
                                        </div>
                                    </div>
                                    <div className="text-sm text-slate-500 truncate mt-1">
                                        {/* Ideally show last message preview here if available in conversation object */}
                                        Click para ver mensajes
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col bg-[#e5ddd5]">
                {/* Header */}
                {selectedConversation ? (
                    <>
                        <div className="p-4 bg-gray-100 border-b border-gray-200 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-white font-bold text-lg">
                                    {selectedConversation.lead?.name?.[0] || '#'}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800">{selectedConversation.lead?.name || selectedConversation.lead?.phone}</h3>
                                    <p className="text-xs text-slate-500">{selectedConversation.lead?.phone}</p>
                                </div>
                            </div>
                        </div>

                        {/* Messages List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {messages.map((msg) => {
                                const isUser = msg.sender_type === 'user';
                                return (
                                    <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                                        <div
                                            className={`max-w-[70%] rounded-lg p-3 shadow-sm relative ${isUser ? 'bg-[#d9fdd3] text-gray-800 rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none'
                                                }`}
                                        >
                                            {msg.message_type === 'image' && (
                                                <div className="mb-2">
                                                    <img src={msg.media_url} alt="Shared content" className="rounded-lg max-h-60 w-auto" />
                                                </div>
                                            )}

                                            <p className="text-sm">{msg.content}</p>
                                            <div className="text-[10px] text-gray-500 text-right mt-1 ml-4">
                                                {formatTime(msg.created_at)}
                                                {isUser && (
                                                    <span className="ml-1 text-blue-500">
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
                        <form onSubmit={handleSendMessage} className="p-3 bg-gray-100 border-t border-gray-200 flex gap-2">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Escribe un mensaje..."
                                className="flex-1 px-4 py-2 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                            <button
                                type="submit"
                                disabled={!newMessage.trim()}
                                className="bg-[#00a884] items-center justify-center w-10 h-10 rounded-full text-white hover:bg-[#008f6f] transition disabled:opacity-50 flex"
                            >
                                <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M1.101 21.757 23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"></path></svg>
                            </button>
                        </form>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-[#f0f2f5]">
                        <div className="text-center">
                            <h3 className="text-xl font-light mb-2">WhatsApp Web para AutosQP</h3>
                            <p className="text-sm">Selecciona una conversación para comenzar a chatear.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WhatsAppDashboard;
