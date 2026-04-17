import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import Swal from 'sweetalert2';

const ROLE_LABELS = {
    super_admin: 'Super Administracion',
    admin: 'Administracion',
    asesor: 'Asesores',
    aliado: 'Aliados',
    inventario: 'Inventario',
    compras: 'Compras',
    user: 'Equipo',
};

const getEffectiveRoleName = (role) => role?.base_role_name || role?.name || 'user';
const getRoleLabel = (role) => role?.label || ROLE_LABELS[getEffectiveRoleName(role)] || 'Usuario';

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
    const [selectedFile, setSelectedFile] = useState(null);
    const fileInputRef = useRef(null);
    const [attachmentModal, setAttachmentModal] = useState(null);

    useEffect(() => {
        resetUnreadCount();
        fetchUsers();
    }, []);

    useEffect(() => {
        fetchMessages();
        const intervalId = setInterval(fetchMessages, 300000);
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
            const response = await axios.get('https://autosqp.co/api/users/', {
                params: { limit: 500 },
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
            const response = await axios.get(`https://autosqp.co/api/internal-messages?date=${selectedDate}`, {
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
        if (!newMessage.trim() && !selectedFile) return;

        try {
            const token = localStorage.getItem('token');

            if (selectedFile) {
                const formData = new FormData();
                formData.append('file', selectedFile);
                if (recipientId) {
                    formData.append('recipient_id', recipientId);
                }
                if (newMessage.trim()) {
                    formData.append('content', newMessage.trim());
                }

                await axios.post(
                    'https://autosqp.co/api/internal-messages/upload',
                    formData,
                    {
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'multipart/form-data'
                        }
                    }
                );
            } else {
                await axios.post('https://autosqp.co/api/internal-messages',
                    {
                        content: newMessage,
                        recipient_id: recipientId ? parseInt(recipientId) : null
                    },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            }
            setNewMessage('');
            setSelectedFile(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
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
    const groupedSidebarUsers = sidebarUsers.reduce((acc, currentUser) => {
        const roleName = getEffectiveRoleName(currentUser?.role);
        const groupId = ROLE_LABELS[roleName] ? roleName : 'user';
        if (!acc[groupId]) {
            acc[groupId] = {
                id: groupId,
                label: ROLE_LABELS[groupId] || 'Equipo',
                users: []
            };
        }
        acc[groupId].users.push(currentUser);
        return acc;
    }, {});
    const sidebarGroups = Object.values(groupedSidebarUsers);

    const activeUser = usersList.find(u => u.id === parseInt(recipientId));

    const parseFileMessage = (content) => {
        if (!content || !content.startsWith('__FILE__')) return null;
        try {
            return JSON.parse(content.replace('__FILE__', ''));
        } catch (error) {
            return null;
        }
    };

    const formatFileSize = (size) => {
        const value = Number(size || 0);
        if (value < 1024) return `${value} B`;
        if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
        return `${(value / (1024 * 1024)).toFixed(1)} MB`;
    };

    const resolveFileUrl = (fileData) => {
        if (!fileData) return '#';
        const storageName = fileData.storage_name || (fileData.file_path ? fileData.file_path.split('/').pop() : '');
        if (storageName) {
            return `${window.location.origin}/api/internal-files/${encodeURIComponent(storageName)}`;
        }
        if (fileData.file_url_relative) {
            return `${window.location.origin}${fileData.file_url_relative}`;
        }
        if (fileData.file_path) {
            return `${window.location.origin}/api/${fileData.file_path}`;
        }
        const raw = fileData.file_url || '';
        if (raw.startsWith('http://localhost') || raw.startsWith('http://127.0.0.1')) {
            if (fileData.file_path) {
                return `${window.location.origin}/api/${fileData.file_path}`;
            }
            return raw.replace(/^https?:\/\/[^/]+/, window.location.origin);
        }
        if (raw.startsWith('/')) return `${window.location.origin}${raw}`;
        return raw || '#';
    };

    const isImageFile = (fileData) => (fileData?.file_type || '').toLowerCase().startsWith('image/');
    const isPdfFile = (fileData) => (fileData?.file_type || '').toLowerCase().includes('pdf');
    const openAttachmentModal = (fileData) => {
        setAttachmentModal({
            ...fileData,
            resolvedUrl: resolveFileUrl(fileData)
        });
    };

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
                        Equipo interno
                    </div>

                    {sidebarGroups.map((group) => (
                        <div key={group.id} className="mb-3">
                            <div className="px-4 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-[0.18em]">
                                {group.label}
                            </div>
                            {group.users.map((u) => (
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
                                        <p className="text-xs text-slate-500 truncate">{getRoleLabel(u.role)}</p>
                                    </div>
                                </div>
                            ))}
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
                                {recipientId ? getRoleLabel(activeUser?.role) : 'Mensajes visibles para toda la empresa'}
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

                                        {parseFileMessage(msg.content) ? (
                                            (() => {
                                                const fileData = parseFileMessage(msg.content);
                                                return (
                                                    <div className="space-y-2">
                                                        {fileData?.text && (
                                                            <p className="whitespace-pre-wrap leading-relaxed">{fileData.text}</p>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => openAttachmentModal(fileData)}
                                                            className={`block rounded-lg p-3 border ${isMe ? 'border-blue-400 bg-blue-500/20 text-white' : 'border-slate-200 bg-slate-50 text-slate-800'} hover:opacity-90`}
                                                        >
                                                            <div className="font-semibold truncate">{fileData?.file_name || 'Archivo'}</div>
                                                            <div className={`text-xs mt-1 ${isMe ? 'text-blue-100' : 'text-slate-500'}`}>
                                                                {fileData?.file_type || 'application/octet-stream'} • {formatFileSize(fileData?.file_size)}
                                                            </div>
                                                            <div className={`text-xs mt-2 underline ${isMe ? 'text-blue-100' : 'text-blue-600'}`}>
                                                                Ver adjunto
                                                            </div>
                                                        </button>
                                                        {isImageFile(fileData) && (
                                                            <button type="button" onClick={() => openAttachmentModal(fileData)} className="block w-full text-left">
                                                                <img
                                                                    src={resolveFileUrl(fileData)}
                                                                    alt={fileData?.file_name || 'Imagen adjunta'}
                                                                    className="mt-2 max-h-64 w-full object-contain rounded-lg border border-slate-200 bg-white"
                                                                />
                                                            </button>
                                                        )}
                                                        {isPdfFile(fileData) && (
                                                            <button type="button" onClick={() => openAttachmentModal(fileData)} className="block w-full text-left">
                                                                <iframe
                                                                    title={fileData?.file_name || 'PDF adjunto'}
                                                                    src={resolveFileUrl(fileData)}
                                                                    className="mt-2 w-full h-72 rounded-lg border border-slate-200 bg-white pointer-events-none"
                                                                />
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })()
                                        ) : (
                                            <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                        )}

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
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        />
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-gray-200 text-gray-700 w-12 h-12 rounded-full flex items-center justify-center hover:bg-gray-300 transition"
                            title="Adjuntar archivo"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l7.07-7.07a4 4 0 10-5.656-5.657L5.757 10.757a6 6 0 108.486 8.486L20.314 13" />
                            </svg>
                        </button>
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder={recipientId ? `Mensaje para ${getUserName(activeUser)}...` : "Mensaje al canal general..."}
                            className="flex-1 bg-gray-100 border-none rounded-2xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:bg-white transition"
                        />
                        <button
                            type="submit"
                            disabled={!newMessage.trim() && !selectedFile}
                            className="bg-slate-800 text-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg hover:bg-slate-700 transition transform active:scale-95 disabled:opacity-50 disabled:scale-100"
                        >
                            <svg className="w-5 h-5 translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                        </button>
                    </form>
                    {selectedFile && (
                        <div className="max-w-5xl mx-auto mt-2 text-xs text-slate-600">
                            Archivo seleccionado: <span className="font-semibold">{selectedFile.name}</span>
                        </div>
                    )}
                </div>

            </div>
            {attachmentModal && (
                <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-6xl h-[88vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                        <div className="px-5 py-3 border-b flex items-center justify-between">
                            <div className="min-w-0">
                                <h3 className="font-bold text-slate-800 truncate">{attachmentModal.file_name || 'Adjunto'}</h3>
                                <p className="text-xs text-slate-500">{attachmentModal.file_type || 'application/octet-stream'} • {formatFileSize(attachmentModal.file_size)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href={attachmentModal.resolvedUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    download={attachmentModal.file_name || 'adjunto'}
                                    className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                                >
                                    Descargar
                                </a>
                                <button type="button" onClick={() => setAttachmentModal(null)} className="p-2 text-slate-500 hover:text-slate-800">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 bg-slate-100 p-3">
                            {isImageFile(attachmentModal) ? (
                                <img src={attachmentModal.resolvedUrl} alt={attachmentModal.file_name || 'Adjunto'} className="w-full h-full object-contain rounded-lg bg-white" />
                            ) : isPdfFile(attachmentModal) ? (
                                <iframe title={attachmentModal.file_name || 'PDF'} src={attachmentModal.resolvedUrl} className="w-full h-full rounded-lg bg-white" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <div className="text-center">
                                        <p className="text-slate-700 font-semibold mb-2">Vista previa no disponible para este tipo de archivo.</p>
                                        <a
                                            href={attachmentModal.resolvedUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            download={attachmentModal.file_name || 'adjunto'}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                                        >
                                            Descargar archivo
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InternalChat;
