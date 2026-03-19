import { motion } from "framer-motion";
import { Flame } from "lucide-react";

export default function ExerciseBanner({ burnedCalories }) {
  if (!burnedCalories || burnedCalories <= 0) return null;
  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mx-4 mt-2 mb-2 p-4 rounded-2xl bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-white/80 flex items-center justify-center shrink-0">
          <Flame className="w-5 h-5 text-orange-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Exercise logged 🔥</p>
          <p className="text-xs text-muted-foreground">{burnedCalories} kcal burned today</p>
        </div>
      </div>
    </motion.div>
  );
}