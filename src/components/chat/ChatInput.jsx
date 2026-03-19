import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";

export default function ChatInput({ onSend, isLoading }) {
  const [message, setMessage] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;
    onSend(message.trim());
    setMessage("");
  };

  return (
    <form onSubmit={handleSubmit} className="px-5 pt-5 bg-white border-t border-border/50" style={{ paddingBottom: "max(80px, env(safe-area-inset-bottom))" }}>
      <div className="max-w-4xl mx-auto flex items-end gap-3">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
          placeholder="Tell me what you ate today... 🥗"
          rows={1}
          className="flex-1 resize-none rounded-2xl border-2 border-input bg-background/50 px-5 py-3.5 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary transition-all min-h-[52px] max-h-32"
          style={{ fontSize: "16px" }}
        />
        <Button type="submit" size="icon" disabled={!message.trim() || isLoading} className="h-[52px] w-[52px] rounded-2xl shrink-0 bg-primary hover:bg-primary/90 shadow-md">
          {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </Button>
      </div>
    </form>
  );
}