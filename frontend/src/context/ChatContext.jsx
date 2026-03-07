import React, { createContext, useState, useContext } from 'react';

const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
    const [unreadCount, setUnreadCount] = useState(0);
    const [unreadByConversation, setUnreadByConversation] = useState({});

    const incrementUnreadCount = (count = 1, messages = []) => {
        const safeCount = Math.max(1, count);
        setUnreadCount(prev => prev + safeCount);

        if (!Array.isArray(messages) || messages.length === 0) {
            setUnreadByConversation(prev => ({
                ...prev,
                general: (prev.general || 0) + safeCount
            }));
            return;
        }

        setUnreadByConversation(prev => {
            const next = { ...prev };
            for (const msg of messages) {
                if (!msg) continue;
                if (!msg.recipient_id) {
                    next.general = (next.general || 0) + 1;
                } else if (msg.sender_id) {
                    const key = `dm_${msg.sender_id}`;
                    next[key] = (next[key] || 0) + 1;
                }
            }
            return next;
        });
    };

    const resetUnreadCount = () => {
        setUnreadCount(0);
        setUnreadByConversation({});
    };

    return (
        <ChatContext.Provider value={{ unreadCount, unreadByConversation, incrementUnreadCount, resetUnreadCount }}>
            {children}
        </ChatContext.Provider>
    );
};

export const useChat = () => useContext(ChatContext);
