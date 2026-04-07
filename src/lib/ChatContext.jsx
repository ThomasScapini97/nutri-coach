import { createContext, useContext, useState } from "react";

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const [chatInputProps, setChatInputProps] = useState(null);
  return (
    <ChatContext.Provider value={{ chatInputProps, setChatInputProps }}>
      {children}
    </ChatContext.Provider>
  );
}

export const useChatContext = () => useContext(ChatContext);
