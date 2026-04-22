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

// eslint-disable-next-line react-refresh/only-export-components
export const useChatContext = () => useContext(ChatContext);
