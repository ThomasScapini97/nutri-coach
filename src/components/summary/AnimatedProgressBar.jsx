import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function AnimatedProgressBar({ label, value, max, unit, icon: Icon, color = "primary" }) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const isDanger = percentage >= 100;
  const isWarning = percentage >= 85 && !isDanger;
  const barColor = isDanger ? "bg-destructive" : isWarning ? "bg-accent" : color === "chart-4" ? "bg-red-400" : color === "chart-3" ? "bg-amber-400" : color === "blue-500" ? "bg-blue-500" : "bg-emerald-500";
  const iconColor = isDanger ? "text-destructive" : isWarning ? "text-accent" : color === "chart-4" ? "text-red-400" : color === "chart-3" ? "text-amber-400" : color === "blue-500" ? "text-blue-500" : "text-emerald-500";
  const bgColor = isDanger ? "bg-destructive/10" : isWarning ? "bg-accent/10" : color === "chart-4" ? "bg-red-400/10" : color === "chart-3" ? "bg-amber-400/10" : color === "blue-500" ? "bg-blue-500/10" : "bg-emerald-500/10";

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Icon && <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", bgColor)}><Icon className={cn("w-4 h-4", iconColor)} /></div>}
          <span className="text-sm font-medium text-foreground">{label}</span>
        </div>
        <div className="text-sm font-semibold text-foreground">{Math.round(value)}{unit} <span className="text-muted-foreground font-normal">/ {max}{unit}</span></div>
      </div>
      <div className="relative h-3 bg-muted rounded-full overflow-hidden shadow-inner">
        <motion.div initial={{ width: 0 }} animate={{ width: `${percentage}%` }} transition={{ duration: 0.8, ease: "easeOut" }} className={cn("h-full rounded-full", barColor)} />
      </div>
    </div>
  );
}