import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import Swal from 'sweetalert2';

const InternalChat = () => {
    const { user } = useAuth();
    const { resetUnreadCount } = useChat();
    const [messages, setMessages] = useState([]);
    const [usersList, setUsersList] = useState([]);
    const [recipientId, setRecipientId] = useState(''); // '' means broadcast (General)
    const [loading, setLoading] = useState(true);
    const [newMessage, setNewMessage] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const messagesEndRef = useRef(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        resetUnreadCount();
        fetchUsers();
    }, []);

    useEffect(() => {
        fetchMessages();
        const intervalId = setInterval(fetchMessages, 5000);
        return () => clearInterval(intervalId);
    }, [selectedDate]);

    useEffect(() => {
        scrollToBottom();
    }, [messages, recipientId]); // Scroll when messages update or we switch chat

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('http://54.226.30.192:8000/users/', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUsersList(response.data.items || []);
        } catch (error) {
            console.error("Error fetching users", error);
        }
    };

    const fetchMessages = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`http://54.226.30.192:8000/internal-messages?date=${selectedDate}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessages(response.data);
        } catch (error) {
            console.error("Error fetching messages", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        try {
            const token = localStorage.getItem('token');
            await axios.post('http://54.226.30.192:8000/internal-messages',
                {
                    content: newMessage,
                    recipient_id: recipientId ? parseInt(recipientId) : null
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setNewMessage('');
            fetchMessages();
        } catch (error) {
            console.error("Error sending message", error);
            Swal.fire('Error', 'No se pudo enviar el mensaje', 'error');
        }
    };

    const isToday = () => {
        const today = new Date().toISOString().split('T')[0];
        return selectedDate === today;
    };

    // --- Helpers ---
    const getInitials = (name) => {
        return name ? name.substring(0, 2).toUpperCase() : '??';
    };

    const getUserName = (u) => {
        if (!u) return 'Usuario desconocido';
        if (u.full_name) return u.full_name;
        return u.email.split('@')[0];
    };

    // --- Filtering Logic ---
    // Filter messages for the current view
    const filteredMessages = messages.filter(msg => {
        if (!recipientId) {
            // General Channel: Messages with no recipient
            return !msg.recipient_id;
        } else {
            // Private Chat: 
            // 1. From Me to Target
            // 2. From Target to Me
            const targetId = parseInt(recipientId);
            const isFromMeToTarget = msg.sender_id === user?.id && msg.recipient_id === targetId;
            const isFromTargetToMe = msg.sender_id === targetId && msg.recipient_id === user?.id;
            return isFromMeToTarget || isFromTargetToMe;
        }
    });

    // Valid users to show in sidebar (exclude self)
    const sidebarUsers = usersList.filter(u => u.id !== user?.id &&
        (searchTerm === '' || u.email.toLowerCase().includes(searchTerm.toLowerCase()) || (u.full_name && u.full_name.toLowerCase().includes(searchTerm.toLowerCase())))
    );

    const activeUser = usersList.find(u => u.id === parseInt(recipientId));

    return (
        <div className="flex h-[calc(100vh-64px)] bg-gray-100 overflow-hidden">

            {/* --- SIDEBAR --- */}
            <div className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0">
                {/* Sidebar Header */}
                <div className="p-4 border-b border-slate-800">
                    <h2 className="text-xl font-bold text-white mb-4">Mensajes</h2>

                    {/* Search */}
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Buscar usuario..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-800 border-none rounded-lg pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <svg className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                </div>

                {/* Users List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {/* General Channel Option */}
                    <div
                        onClick={() => setRecipientId('')}
                        className={`p-4 flex items-center gap-3 cursor-pointer transition border-b border-slate-800 hover:bg-slate-800/50
                            ${recipientId === '' ? 'bg-blue-600/20 border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent'}`}
                    >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-sm">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        </div>
                        <div>
                            <h3 className={`font-bold text-sm ${recipientId === '' ? 'text-white' : 'text-slate-300'}`}>Canal General</h3>
                            <p className="text-xs text-slate-500">Para todos los usuarios</p>
                        </div>
                    </div>

                    <div className="px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-900/50">
                        Usuarios
                    </div>

                    {sidebarUsers.map(u => (
                        <div
                            key={u.id}
                            onClick={() => setRecipientId(u.id.toString())}
                            className={`p-3 mx-2 rounded-lg flex items-center gap-3 cursor-pointer transition mb-1 border border-transparent
                                ${recipientId === u.id.toString()
                                    ? 'bg-blue-600/20 text-white border-blue-500/30'
                                    : 'hover:bg-slate-800 text-slate-300'}`}
                        >
                            <div className="relative">
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold
                                    ${recipientId === u.id.toString() ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                                    {getInitials(u.email)}
                                </div>
                                {u.is_online && (
                                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-slate-900 rounded-full"></span>
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-semibold text-sm truncate">{getUserName(u)}</h3>
                                    {u.is_online && <span className="text-[10px] text-green-500 font-bold">ON</span>}
                                </div>
                                <p className="text-xs text-slate-500 truncate">{u.role?.name || 'Usuario'}</p>
                            </div>
                        </div>
                    ))}

                    {sidebarUsers.length === 0 && (
                        <div className="p-4 text-center text-sm text-gray-400">
                            No se encontraron usuarios.
                        </div>
                    )}
                </div>

                {/* Current User Info Footer */}
                <div className="p-4 border-t border-slate-800 bg-slate-900 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-700 text-white flex items-center justify-center text-xs font-bold border border-slate-600">
                        {getInitials(user?.email)}
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-sm font-bold text-white truncate">{getUserName(user)}</p>
                        <p className="text-xs text-green-500 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> En línea
                        </p>
                    </div>
                </div>
            </div>

            {/* --- MAIN CHAT AREA --- */}
            <div className="flex-1 flex flex-col bg-[#e5ddd5]/30 relative">
                {/* Chat Background Pattern or Color */}
                <div className="absolute inset-0 opacity-5 pointer-events-none"
                    style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '16px 16px' }}></div>

                {/* Chat Header */}
                <div className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center shadow-sm z-10">
                    <div className="flex items-center gap-3">
                        {recipientId ? (
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold">
                                {getInitials(activeUser?.email)}
                            </div>
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                            </div>
                        )}
                        <div>
                            <h2 className="font-bold text-gray-800 text-lg">
                                {recipientId ? getUserName(activeUser) : 'Canal General'}
                            </h2>
                            <p className="text-xs text-gray-500">
                                {recipientId ? (activeUser?.role?.name || 'Usuario') : 'Mensajes visibles para toda la empresa'}
                            </p>
                        </div>
                    </div>

                    {/* Date Selector */}
                    <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full">
                        <span className="text-xs font-semibold text-gray-500">Historial del:</span>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-transparent text-sm text-gray-700 font-medium focus:outline-none cursor-pointer"
                        />
                        {!isToday() && (
                            <button
                                onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                                className="ml-2 text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full hover:bg-blue-200 transition"
                            >
                                Hoy
                            </button>
                        )}
                    </div>
                </div>

                {/* Messages List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar relative z-0">
                    {loading ? (
                        <div className="flex justify-center items-center h-full">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : filteredMessages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-60">
                            <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                            <p className="font-medium">No hay mensajes aquí.</p>
                            <p className="text-sm">¡Sé el primero en escribir!</p>
                        </div>
                    ) : (
                        filteredMessages.map((msg) => {
                            const isMe = msg.sender_id === user?.id;

                            return (
                                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} group`}>
                                    <div className={`max-w-[70%] rounded-2xl px-5 py-3 shadow-sm relative text-sm
                                         ${isMe
                                            ? 'bg-blue-600 text-white rounded-br-none'
                                            : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
                                        }`}>

                                        {/* Sender Name in General Chat or if not me */}
                                        {!isMe && !recipientId && (
                                            <p className="text-[10px] font-bold text-blue-600 mb-1">
                                                {getUserName(msg.sender)}
                                            </p>
                                        )}

                                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

                                        <div className={`text-[10px] mt-1 flex justify-end gap-1
                                             ${isMe ? 'text-blue-100' : 'text-gray-400'}`}>
                                            <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            {isMe && (
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white border-t border-gray-200 z-10">
                    <form onSubmit={handleSendMessage} className="flex gap-3 max-w-5xl mx-auto">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder={recipientId ? `Mensaje para ${getUserName(activeUser)}...` : "Mensaje al canal general..."}
                            className="flex-1 bg-gray-100 border-none rounded-2xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:bg-white transition"
                        />
                        <button
                            type="submit"
                            disabled={!newMessage.trim()}
                            className="bg-slate-800 text-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg hover:bg-slate-700 transition transform active:scale-95 disabled:opacity-50 disabled:scale-100"
                        >
                            <svg className="w-5 h-5 translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                        </button>
                    </form>
                </div>

            </div>
        </div>
    );
};

export default InternalChat;
