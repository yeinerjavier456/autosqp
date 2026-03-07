import React, { createContext, useState, useContext } from 'react';

const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
    const [unreadCount, setUnreadCount] = useState(0);

    const incrementUnreadCount = (count = 1) => {
        setUnreadCount(prev => prev + Math.max(1, count));
    };

    const resetUnreadCount = () => {
        setUnreadCount(0);
    };

    return (
        <ChatContext.Provider value={{ unreadCount, incrementUnreadCount, resetUnreadCount }}>
            {children}
        </ChatContext.Provider>
    );
};

export const useChat = () => useContext(ChatContext);
