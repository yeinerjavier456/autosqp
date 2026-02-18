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
    const [lastMessageCount, setLastMessageCount] = useState(0);
    const [messages, setMessages] = useState([]);
    const [usersList, setUsersList] = useState([]);

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
            // Initial load shouldn't notify, but we don't have previous count on mount.
            // We can check if lastMessageCount is 0 (initial) and skip? 
            // Or just rely on the fact that if (messages.length > lastMessageCount) triggers.
            // Problem: On page refresh, lastMessageCount is 0, messages.length is N. 
            // We don't want to blast notifications on every refresh.

            // Fix: Initialize setLastMessageCount with current length on FIRST fetch?
            // Actually, we can just check if lastMessageCount > 0.
            // If it's 0, it means we just loaded the app. 

            if (lastMessageCount > 0 && messages.length > lastMessageCount) {
                const lastMsg = messages[messages.length - 1];

                // Only notify if NOT from me
                if (lastMsg && lastMsg.sender_id !== user?.id) {
                    // Check if it's a DM for me or a Broadcast
                    // Backend creates message with recipient_id.
                    // Logic: If I received it (it's in the list), and sender != me.

                    // Optimization: Check if it's "too old"? 
                    // The endpoint returns messages for a specific DATE. 
                    // By default today. So we are good.

                    const senderName = getSenderName(lastMsg);
                    Swal.fire({
                        title: `Nuevo mensaje de ${senderName}`,
                        text: lastMsg.content.length > 50 ? lastMsg.content.substring(0, 50) + '...' : lastMsg.content,
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 10000, // Increased timer as requested
                        timerProgressBar: true,
                        icon: 'info',
                        didOpen: (toast) => {
                            toast.addEventListener('mouseenter', Swal.stopTimer)
                            toast.addEventListener('mouseleave', Swal.resumeTimer)
                        }
                    });

                    // Increment unread count if NOT on chat page
                    if (location.pathname !== '/internal-chat') {
                        incrementUnreadCount();
                    }
                }
            }

            // Always update count
            setLastMessageCount(messages.length);
        }
    }, [messages, location.pathname, incrementUnreadCount]); // Add location.pathname dependency

    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const response = await axios.get('http://localhost:8000/users/', {
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
            const response = await axios.get(`http://localhost:8000/internal-messages?date=${today}`, {
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

    return null; // This component renders nothing, just handles side effects
};

export default GlobalNotifications;
