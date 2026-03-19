import { Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export default function TypingIndicator() {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 max-w-4xl mr-auto">
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shrink-0 shadow-sm">
        <Sparkles className="w-5 h-5 text-white" />
      </div>
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-3xl rounded-tl-lg px-5 py-3.5 shadow-sm">
        <div className="flex gap-1.5 items-center h-5">
          {[0, 0.2, 0.4].map((delay, i) => (
            <motion.div key={i} animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.6, repeat: Infinity, delay }} className="w-2 h-2 rounded-full bg-primary/60" />
          ))}
        </div>
      </div>
    </motion.div>
  );
}