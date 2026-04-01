import { memo } from "react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import NutritionCard from "./NutritionCard";
import { motion } from "framer-motion";

const ChatBubble = memo(function ChatBubble({ message, foodEntries }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  // Messaggio di sistema — riga grigia centrata
  if (isSystem) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "2px 16px" }}
      >
        <div style={{
          display: "flex", alignItems: "center", gap: "8px",
          background: "#f3f4f6", borderRadius: "20px",
          padding: "5px 14px", maxWidth: "90%",
        }}>
          <span style={{ fontSize: "10px", color: "#6b7280", textAlign: "center", lineHeight: 1.4 }}>
            {message.content}
          </span>
        </div>
      </motion.div>
    );
  }

  const content = message.content || "";
  const looksLikeJson = content.trim().startsWith("{") && content.includes('"message"');
  const displayContent = looksLikeJson
    ? "Scusa, si è verificato un errore. Riprova! 🙏"
    : content;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
      style={{ maxWidth: "100%", width: "100%" }}
    >
      <div style={{ maxWidth: "78%", display: "flex", flexDirection: "column", gap: "2px", alignItems: isUser ? "flex-end" : "flex-start" }}>
        <div
          style={{
            backgroundColor: isUser ? "#dcf8c6" : "white",
            border: "0.5px solid rgba(0,0,0,0.06)",
            borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
            padding: "8px 14px",
            wordBreak: "break-word",
            overflowWrap: "break-word",
            boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
          }}
        >
          {isUser ? (
            <p className="text-sm leading-relaxed text-foreground" style={{ wordBreak: "break-word" }}>
              {content}
            </p>
          ) : (
            <div
              className="text-sm leading-relaxed prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:text-foreground [&_strong]:text-foreground"
              style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
            >
              <ReactMarkdown>{displayContent}</ReactMarkdown>
            </div>
          )}
          {message.timestamp && (
            <p style={{ fontSize: "10px", color: "#9ca3af", textAlign: "right", marginTop: "3px", marginBottom: "-2px" }}>
              {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
        </div>
        {message.nutrition && <NutritionCard nutrition={message.nutrition} foodEntries={foodEntries} />}
      </div>
    </motion.div>
  );
});

export default ChatBubble;