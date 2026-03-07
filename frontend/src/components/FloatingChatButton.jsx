import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';

const FloatingChatButton = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const { unreadCount, unreadByConversation, resetUnreadCount } = useChat();
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [usersList, setUsersList] = useState([]);
    const [recipientId, setRecipientId] = useState('');
    const [newMessage, setNewMessage] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const fileInputRef = useRef(null);
    const endRef = useRef(null);

    if (location.pathname === '/internal-chat') return null;

    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const response = await axios.get('https://autosqp.co/api/users/', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUsersList(response.data.items || []);
        } catch (error) {
            // silent
        }
    };

    const fetchMessages = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const today = new Date().toISOString().split('T')[0];
            const response = await axios.get(`https://autosqp.co/api/internal-messages?date=${today}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessages(response.data || []);
        } catch (error) {
            // silent
        }
    };

    useEffect(() => {
        if (!open) return;
        fetchUsers();
        fetchMessages();
        resetUnreadCount();
        const interval = setInterval(fetchMessages, 5000);
        return () => clearInterval(interval);
    }, [open]);

    useEffect(() => {
        if (open) {
            endRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, open, recipientId]);

    const parseFileMessage = (content) => {
        if (!content || !content.startsWith('__FILE__')) return null;
        try {
            return JSON.parse(content.replace('__FILE__', ''));
        } catch {
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
        if (fileData.file_url_relative) {
            return `${window.location.origin}${fileData.file_url_relative}`;
        }
        if (fileData.file_path) {
            return `${window.location.origin}/api/${fileData.file_path}`;
        }
        const raw = fileData.file_url || '';
        if (raw.startsWith('http://localhost') || raw.startsWith('http://127.0.0.1')) {
            if (fileData.file_path) return `${window.location.origin}/api/${fileData.file_path}`;
            return raw.replace(/^https?:\/\/[^/]+/, window.location.origin);
        }
        if (raw.startsWith('/')) return `${window.location.origin}${raw}`;
        return raw || '#';
    };

    const isImageFile = (fileData) => (fileData?.file_type || '').toLowerCase().startsWith('image/');
    const isPdfFile = (fileData) => (fileData?.file_type || '').toLowerCase().includes('pdf');

    const getUserName = (u) => {
        if (!u) return 'Usuario';
        if (u.full_name) return u.full_name;
        return u.email?.split('@')[0] || `Usuario ${u.id}`;
    };

    const activeUser = usersList.find(u => u.id === Number(recipientId));

    const filteredMessages = messages.filter(msg => {
        if (!recipientId) return !msg.recipient_id;
        const targetId = Number(recipientId);
        const isFromMeToTarget = msg.sender_id === user?.id && msg.recipient_id === targetId;
        const isFromTargetToMe = msg.sender_id === targetId && msg.recipient_id === user?.id;
        return isFromMeToTarget || isFromTargetToMe;
    });

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() && !selectedFile) return;

        const token = localStorage.getItem('token');
        if (!token) return;

        try {
            if (selectedFile) {
                const formData = new FormData();
                formData.append('file', selectedFile);
                if (recipientId) formData.append('recipient_id', recipientId);
                if (newMessage.trim()) formData.append('content', newMessage.trim());

                await axios.post('https://autosqp.co/api/internal-messages/upload', formData, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'multipart/form-data'
                    }
                });
            } else {
                await axios.post('https://autosqp.co/api/internal-messages', {
                    content: newMessage,
                    recipient_id: recipientId ? Number(recipientId) : null
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }

            setNewMessage('');
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            fetchMessages();
        } catch (error) {
            // silent
        }
    };

    return (
        <>
            {open && (
                <div className="fixed bottom-24 right-6 z-[59] w-[380px] max-w-[calc(100vw-2rem)] h-[560px] bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                    <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
                        <div>
                            <h3 className="font-bold">Chat Interno</h3>
                            <p className="text-xs text-slate-300">Sin salir de la vista actual</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => navigate('/internal-chat')}
                                className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded"
                                title="Abrir chat completo"
                            >
                                Expandir
                            </button>
                            <button type="button" onClick={() => setOpen(false)} className="text-slate-300 hover:text-white">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    </div>

                    <div className="px-3 py-2 border-b bg-slate-50">
                        <select
                            value={recipientId}
                            onChange={(e) => setRecipientId(e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 text-sm"
                        >
                            <option value="">
                                {`Canal General${unreadByConversation.general ? ` (${unreadByConversation.general})` : ''}`}
                            </option>
                            {usersList.filter(u => u.id !== user?.id).map(u => (
                                <option key={u.id} value={u.id}>
                                    {`${getUserName(u)}${unreadByConversation[`dm_${u.id}`] ? ` (${unreadByConversation[`dm_${u.id}`]})` : ''}`}
                                </option>
                            ))}
                        </select>
                        {recipientId && (
                            <p className="text-xs text-slate-500 mt-1">Chat privado con {getUserName(activeUser)}</p>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50">
                        {filteredMessages.map(msg => {
                            const isMe = msg.sender_id === user?.id;
                            const fileData = parseFileMessage(msg.content);
                            return (
                                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none'}`}>
                                        {!isMe && !recipientId && (
                                            <p className="text-[10px] font-bold text-blue-600 mb-1">{getUserName(msg.sender)}</p>
                                        )}
                                        {fileData ? (
                                            <div className="space-y-1">
                                                {fileData.text && <p className="whitespace-pre-wrap">{fileData.text}</p>}
                                                <a href={resolveFileUrl(fileData)} target="_blank" rel="noreferrer" className={`block p-2 rounded border text-xs ${isMe ? 'border-blue-300 text-blue-50' : 'border-slate-200 text-slate-700'}`}>
                                                    <div className="font-semibold truncate">{fileData.file_name}</div>
                                                    <div>{fileData.file_type} - {formatFileSize(fileData.file_size)}</div>
                                                    <div className="underline mt-1">Abrir / Descargar</div>
                                                </a>
                                                {isImageFile(fileData) && (
                                                    <a href={resolveFileUrl(fileData)} target="_blank" rel="noreferrer" className="block">
                                                        <img
                                                            src={resolveFileUrl(fileData)}
                                                            alt={fileData?.file_name || 'Imagen adjunta'}
                                                            className="mt-2 max-h-48 w-full object-contain rounded border border-slate-200 bg-white"
                                                        />
                                                    </a>
                                                )}
                                                {isPdfFile(fileData) && (
                                                    <iframe
                                                        title={fileData?.file_name || 'PDF adjunto'}
                                                        src={resolveFileUrl(fileData)}
                                                        className="mt-2 w-full h-48 rounded border border-slate-200 bg-white"
                                                    />
                                                )}
                                            </div>
                                        ) : (
                                            <p className="whitespace-pre-wrap">{msg.content}</p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={endRef} />
                    </div>

                    <div className="p-3 border-t bg-white">
                        <form onSubmit={handleSendMessage} className="flex gap-2">
                            <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
                            <button type="button" onClick={() => fileInputRef.current?.click()} className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l7.07-7.07a4 4 0 10-5.656-5.657L5.757 10.757a6 6 0 108.486 8.486L20.314 13" /></svg>
                            </button>
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder={recipientId ? `Mensaje para ${getUserName(activeUser)}...` : 'Mensaje general...'}
                                className="flex-1 border rounded-xl px-3 py-2 text-sm"
                            />
                            <button
                                type="submit"
                                disabled={!newMessage.trim() && !selectedFile}
                                className="w-10 h-10 rounded-full bg-blue-600 text-white disabled:opacity-50"
                            >
                                <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                            </button>
                        </form>
                        {selectedFile && <p className="text-xs text-slate-500 mt-1 truncate">Adjunto: {selectedFile.name}</p>}
                    </div>
                </div>
            )}

            <button
                type="button"
                onClick={() => setOpen(prev => !prev)}
                className="fixed bottom-6 right-6 z-[60] w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-2xl flex items-center justify-center transition-transform hover:scale-105"
                title="Abrir chat interno"
            >
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center animate-pulse">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>
        </>
    );
};

export default FloatingChatButton;
