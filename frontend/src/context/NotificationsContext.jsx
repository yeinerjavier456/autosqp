
import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import Swal from 'sweetalert2';

const NotificationsContext = createContext();
const API_BASE_URL = `${window.location.origin}/crm/api`;

export const useNotifications = () => {
    return useContext(NotificationsContext);
};

export const NotificationsProvider = ({ children }) => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const isInitialFetch = React.useRef(true);
    const maxNotifId = React.useRef(0);
    const toastShownIds = React.useRef(new Set());

    const getToastIcon = (type) => {
        if (type === 'warning') return 'warning';
        if (type === 'success') return 'success';
        if (type === 'error') return 'error';
        return 'info';
    };

    const markAsRead = async (id) => {
        try {
            await axios.post(`${API_BASE_URL}/notifications/read/${id}`, {}, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error("Error marking notification as read:", error);
        }
    };

    const showNotificationToast = (notification) => {
        if (!notification?.id || toastShownIds.current.has(notification.id)) return;
        toastShownIds.current.add(notification.id);

        Swal.fire({
            title: notification.title || 'Nueva Notificación',
            text: notification.message,
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            showCloseButton: true,
            closeButtonHtml: '&times;',
            timer: 12000,
            timerProgressBar: true,
            icon: getToastIcon(notification.type),
            customClass: {
                popup: 'swal2-notification-toast',
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
                toast.addEventListener('mouseenter', Swal.stopTimer);
                toast.addEventListener('mouseleave', Swal.resumeTimer);
            },
            didClose: () => {
                markAsRead(notification.id);
            }
        });
    };

    useEffect(() => {
        isInitialFetch.current = true;
        maxNotifId.current = 0;
        toastShownIds.current = new Set();
        setNotifications([]);
        setUnreadCount(0);
    }, [user?.id]);

    // Fetch Notifications
    const fetchNotifications = async ({ silentToast = false } = {}) => {
        if (!user) return;
        try {
            const response = await axios.get(`${API_BASE_URL}/notifications/`, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            const data = response.data;
            setNotifications(data);
            setUnreadCount(data.filter(n => n.is_read === 0).length);

            if (data.length > 0) {
                let currentMaxId = Math.max(...data.map(n => n.id));

                if (!silentToast) {
                    const toastCandidates = isInitialFetch.current
                        ? data.filter(n => n.is_read === 0)
                        : data.filter(n => n.id > maxNotifId.current && n.is_read === 0);
                    if (toastCandidates.length > 0) {
                        showNotificationToast(toastCandidates[0]);
                    }
                }
                maxNotifId.current = Math.max(maxNotifId.current, currentMaxId);
            }

            if (isInitialFetch.current) {
                isInitialFetch.current = false;
            }
        } catch (error) {
            console.error("Error fetching notifications:", error);
        }
    };

    // Mark All as Read
    const markAllAsRead = async () => {
        try {
            await axios.post(`${API_BASE_URL}/notifications/mark-all-read`, {}, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
            setUnreadCount(0);
        } catch (error) {
            console.error("Error marking all as read:", error);
        }
    };

    // Create Appointment
    const createAppointment = async (leadId, appointmentDate, note) => {
        try {
            await axios.post(`${API_BASE_URL}/appointments/leads/${leadId}`, {
                appointment_date: appointmentDate,
                note: note,
                title: note
            }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            Swal.fire({
                icon: 'success',
                title: 'Cita programada',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                showCloseButton: true,
                closeButtonHtml: '&times;',
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
                },
                timer: 3000
            });
        } catch (error) {
            console.error("Error creating appointment:", error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo programar la cita'
            });
        }
    };

    // Polling
    useEffect(() => {
        if (!user) return undefined;
        fetchNotifications();
        const intervalId = window.setInterval(() => {
            fetchNotifications();
        }, 60000);
        return () => window.clearInterval(intervalId);
    }, [user]);

    const value = {
        notifications,
        unreadCount,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        createAppointment
    };

    return (
        <NotificationsContext.Provider value={value}>
            {children}
        </NotificationsContext.Provider>
    );
};
