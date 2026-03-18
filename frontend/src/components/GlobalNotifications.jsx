import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { useLocation } from 'react-router-dom';
import Swal from 'sweetalert2';

const GlobalNotifications = () => {
    const { user } = useAuth();
    const { incrementUnreadCount } = useChat();
    const location = useLocation();
    const [lastMessageId, setLastMessageId] = useState(0);
    const [messages, setMessages] = useState([]);
    const [usersList, setUsersList] = useState([]);

    const playNotificationSound = (kind = 'general') => {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const oscillator = ctx.createOscillator();
            const gain = ctx.createGain();
            oscillator.type = 'sine';
            oscillator.frequency.value = kind === 'private' ? 1046 : 880;
            gain.gain.setValueAtTime(0.0001, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
            oscillator.connect(gain);
            gain.connect(ctx.destination);
            oscillator.start();
            oscillator.stop(ctx.currentTime + 0.26);
        } catch (error) {
            // Silent fallback if browser blocks audio.
        }
    };

    // Poll interval (should match InternalChat or be slightly confusing if different, 
    // but independent polling is fine for this requirement)
    // Using 5 seconds

    useEffect(() => {
        if (user) {
            fetchUsers();
            fetchMessages(); // Initial fetch
        }
    }, [user]);

    useEffect(() => {
        if (!user) return;

        const intervalId = setInterval(fetchMessages, 5000);
        return () => clearInterval(intervalId);
    }, [user]);

    useEffect(() => {
        if (messages.length > 0) {
            const newestId = Math.max(...messages.map(m => Number(m.id || 0)));
            if (lastMessageId === 0) {
                // Initial load: only sync cursor, no alerts.
                setLastMessageId(newestId);
                return;
            }

            const incomingMessages = messages.filter(
                m => Number(m.id || 0) > lastMessageId && m.sender_id !== user?.id
            );
            const lastMsg = incomingMessages[incomingMessages.length - 1];

            if (lastMsg) {
                const senderName = getSenderName(lastMsg);
                const previewText = getPreviewText(lastMsg);
                Swal.fire({
                    title: `Nuevo mensaje de ${senderName}`,
                    text: previewText.length > 50 ? previewText.substring(0, 50) + '...' : previewText,
                    toast: true,
                    position: 'top-end',
                    showConfirmButton: false,
                    showCloseButton: true,
                    closeButtonHtml: '&times;',
                    timer: 10000,
                    timerProgressBar: true,
                    icon: 'info',
                    customClass: {
                        closeButton: 'swal2-visible-close-button'
                    },
                    didOpen: (toast) => {
                        const closeButton = toast.querySelector('.swal2-close');
                        if (closeButton) {
                            closeButton.style.display = 'flex';
                            closeButton.style.alignItems = 'center';
                            closeButton.style.justifyContent = 'center';
                            closeButton.style.width = '28px';
                            closeButton.style.height = '28px';
                            closeButton.style.fontSize = '22px';
                            closeButton.style.fontWeight = '700';
                            closeButton.style.color = '#64748b';
                            closeButton.style.margin = '6px 6px 0 0';
                        }
                        toast.addEventListener('mouseenter', Swal.stopTimer)
                        toast.addEventListener('mouseleave', Swal.resumeTimer)
                    }
                });
                const soundType = lastMsg?.recipient_id === user?.id ? 'private' : 'general';
                playNotificationSound(soundType);

                if (location.pathname !== '/internal-chat') {
                    incrementUnreadCount(incomingMessages.length, incomingMessages);
                }
            }

            setLastMessageId(newestId);
        }
    }, [messages, location.pathname, incrementUnreadCount, lastMessageId, user?.id]);

    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const response = await axios.get('https://autosqp.co/api/users/', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUsersList(response.data.items || []);
        } catch (error) {
            console.error("Error fetching users for notifications", error);
        }
    };

    const fetchMessages = async () => {
        try {
            const token = localStorage.getItem('token');
            // Always fetch TODAY's messages for notification purposes
            const today = new Date().toISOString().split('T')[0];
            const response = await axios.get(`https://autosqp.co/api/internal-messages?date=${today}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setMessages(response.data);
        } catch (error) {
            // Setup silent failure for polling
        }
    };

    const getSenderName = (msg) => {
        if (msg.sender && msg.sender.email) return msg.sender.email.split('@')[0];
        const senderObj = usersList.find(u => u.id === msg.sender_id);
        return senderObj ? senderObj.email.split('@')[0] : `Usuario ${msg.sender_id}`;
    };

    const getPreviewText = (msg) => {
        if (!msg?.content) return '';
        if (msg.content.startsWith('__FILE__')) return 'Archivo adjunto';
        return msg.content;
    };

    return null; // This component renders nothing, just handles side effects
};

export default GlobalNotifications;
