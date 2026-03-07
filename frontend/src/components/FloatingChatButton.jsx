import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useChat } from '../context/ChatContext';

const FloatingChatButton = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { unreadCount } = useChat();

    if (location.pathname === '/internal-chat') return null;

    return (
        <button
            type="button"
            onClick={() => navigate('/internal-chat')}
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
    );
};

export default FloatingChatButton;

