import { cn } from "@/lib/utils";
import { User, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import NutritionCard from "./NutritionCard";
import { motion } from "framer-motion";

export default function ChatBubble({ message, foodEntries }) {
  const isUser = message.role === "user";
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className={cn("flex gap-3 max-w-4xl w-full", isUser ? "ml-auto flex-row-reverse" : "mr-auto")}>
      <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-sm", isUser ? "bg-secondary" : "bg-gradient-to-br from-primary to-primary/80")}>
        {isUser ? <User className="w-5 h-5 text-foreground" /> : <Sparkles className="w-5 h-5 text-white" />}
      </div>
      <div className={cn("flex flex-col gap-3 flex-1", isUser ? "items-end" : "items-start")}>
        <div className={cn("rounded-3xl px-5 py-3.5 max-w-2xl shadow-sm", isUser ? "bg-white border border-border/50 rounded-tr-lg" : "bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-tl-lg")}>
          {isUser ? (
            <p className="text-sm leading-relaxed text-foreground">{message.content}</p>
          ) : (
            <div className="text-sm leading-relaxed prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:text-foreground [&_strong]:text-foreground">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>
        {message.nutrition && <NutritionCard nutrition={message.nutrition} foodEntries={foodEntries} />}
        {message.timestamp && (
          <span className="text-[10px] text-muted-foreground px-2">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </motion.div>
  );
}