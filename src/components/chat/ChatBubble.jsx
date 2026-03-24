import { cn } from "@/lib/utils";
import { User, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import NutritionCard from "./NutritionCard";
import { motion } from "framer-motion";

export default function ChatBubble({ message, foodEntries }) {
  const isUser = message.role === "user";

  const content = message.content || "";
  const looksLikeJson = content.trim().startsWith("{") && content.includes('"message"');
  const displayContent = looksLikeJson
    ? "Scusa, si è verificato un errore. Riprova! 🙏"
    : content;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn("flex gap-3 w-full", isUser ? "ml-auto flex-row-reverse" : "mr-auto")}
      style={{ maxWidth: "100%", width: "100%" }}
    >
      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-sm", isUser ? "bg-secondary" : "bg-gradient-to-br from-primary to-primary/80")}>
        {isUser ? <User className="w-5 h-5 text-foreground" /> : <Sparkles className="w-5 h-5 text-white" />}
      </div>
      <div
        className={cn("flex flex-col gap-3", isUser ? "items-end" : "items-start")}
        style={{ flex: 1, minWidth: 0 }}
      >
        <div
          className={cn("rounded-3xl px-5 py-3.5 shadow-sm", isUser ? "rounded-tr-lg" : "rounded-tl-lg")}
          style={{
            backgroundColor: isUser ? "white" : "#eafff1",
            border: "0.5px solid rgba(0,0,0,0.06)",
            wordBreak: "break-word",
            overflowWrap: "break-word",
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
        </div>
        {message.nutrition && <NutritionCard nutrition={message.nutrition} foodEntries={foodEntries} />}
        {message.timestamp && (
          <span className="text-[10px] text-muted-foreground px-2">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>
    </motion.div>
  );
}
