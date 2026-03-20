import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Wheat, Drumstick, Droplets, Salad, ChevronRight, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const MacroProgressMini = ({ label, value, max, unit, icon: Icon, color = "primary" }) => {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const isDanger = percentage >= 100;
  const isWarning = percentage >= 85 && !isDanger;
  const barColor = isDanger ? "bg-destructive" : isWarning ? "bg-accent" : color === "chart-4" ? "bg-red-400" : color === "chart-3" ? "bg-amber-400" : color === "blue-500" ? "bg-blue-500" : "bg-emerald-500";
  const iconColor = isDanger ? "text-destructive" : isWarning ? "text-accent" : color === "chart-4" ? "text-red-400" : color === "chart-3" ? "text-amber-400" : color === "blue-500" ? "text-blue-500" : "text-emerald-500";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className={cn("w-3.5 h-3.5", iconColor)} />
          <span className="text-xs font-medium text-foreground">{label}</span>
        </div>
        <div className="text-xs font-semibold text-foreground">{Math.round(value)}<span className="text-muted-foreground font-normal">/{max}</span>{unit}</div>
      </div>
      <div className="relative h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${percentage}%` }} transition={{ duration: 0.6 }} className={cn("h-full rounded-full", barColor)} />
      </div>
    </div>
  );
};

export default function DailyDashboard({ todayLog, calorieGoal, proteinGoal, carbsGoal, fatsGoal, fiberGoal }) {
  const [expanded, setExpanded] = useState(false);

  const calories = todayLog?.total_calories || 0;
  const protein = todayLog?.total_protein || 0;
  const carbs = todayLog?.total_carbs || 0;
  const fats = todayLog?.total_fats || 0;
  const fiber = todayLog?.total_fiber || 0;
  const burnedCalories = todayLog?.total_burned_calories || 0;
  const netCalories = Math.max(calories - burnedCalories, 0);
  const caloriePercentage = Math.min((netCalories / calorieGoal) * 100, 100);
  const caloriesRemaining = Math.max(calorieGoal - netCalories, 0);
  const isDanger = caloriePercentage >= 100;
  const isWarning = caloriePercentage >= 85 && !isDanger;

  return (
    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mx-4 mt-4 mb-3">
      <div className="bg-white rounded-3xl shadow-lg transition-all">
        {/* Header — sempre visibile */}
        <div
          className="flex items-center justify-between p-4 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-2">
            <span className="text-xl">🔥</span>
            <div>
              <h3 className="text-sm font-bold text-foreground">Today's Progress</h3>
              <p className="text-[10px] text-muted-foreground">{caloriesRemaining > 0 ? `${caloriesRemaining} kcal left` : "Goal reached! 🎉"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">{Math.round(netCalories)}<span className="text-muted-foreground font-normal text-xs"> / {calorieGoal}</span></span>
            <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />
          </div>
        </div>

        {/* Barra calorie — sempre visibile */}
        <div className="px-4 pb-3">
          <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${caloriePercentage}%` }} transition={{ duration: 0.8 }} className={cn("h-full rounded-full", isDanger ? "bg-red-500" : isWarning ? "bg-orange-400" : "bg-rose-500")} />
          </div>
        </div>

        {/* Dettagli macros — visibili solo se expanded */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-gray-100 pt-3">
                <MacroProgressMini label="Protein" value={protein} max={proteinGoal} unit="g" icon={Drumstick} color="chart-4" />
                <MacroProgressMini label="Carbs" value={carbs} max={carbsGoal} unit="g" icon={Wheat} color="chart-3" />
                <MacroProgressMini label="Fats" value={fats} max={fatsGoal} unit="g" icon={Droplets} color="blue-500" />
                <MacroProgressMini label="Fiber" value={fiber} max={fiberGoal} unit="g" icon={Salad} color="primary" />
              </div>
              <Link to="/Summary" className="flex items-center justify-center gap-1 pb-3 text-xs text-primary font-medium">
                View full summary <ChevronRight className="w-3 h-3" />
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}