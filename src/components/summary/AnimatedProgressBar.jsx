import { motion } from "framer-motion";
import { Drumstick, Wheat, Droplets, Salad } from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap = {
  "chart-4": Drumstick,
  "chart-3": Wheat,
  "blue-500": Droplets,
  "primary": Salad,
};

const barColorMap = {
  "chart-4": "bg-red-400",
  "chart-3": "bg-amber-400",
  "blue-500": "bg-blue-500",
  "primary": "bg-emerald-500",
};

const iconColorMap = {
  "chart-4": "text-red-400",
  "chart-3": "text-amber-400",
  "blue-500": "text-blue-500",
  "primary": "text-emerald-500",
};

export default function AnimatedProgressBar({ label, value, max, unit, color = "primary" }) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const isDanger = percentage >= 100;
  const isWarning = percentage >= 85 && !isDanger;

  const Icon = iconMap[color] || Salad;
  const barColor = isDanger ? "bg-red-500" : isWarning ? "bg-rose-400" : (barColorMap[color] || "bg-emerald-500");
  const iconColor = isDanger ? "text-destructive" : isWarning ? "text-accent" : (iconColorMap[color] || "text-emerald-500");

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className={cn("w-3.5 h-3.5", iconColor)} />
          <span className="text-xs font-medium text-foreground">{label}</span>
        </div>
        <div className="text-xs font-semibold text-foreground">
          {Math.round(value)}<span className="text-muted-foreground font-normal">/{max}</span>{unit}
        </div>
      </div>
      <div className="relative h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.6 }}
          className={cn("h-full rounded-full", barColor)}
        />
      </div>
    </div>
  );
}
