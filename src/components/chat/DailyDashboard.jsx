import { motion } from "framer-motion";
import { Flame, Wheat, Drumstick, Droplets, Salad, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const MacroProgressMini = ({ label, value, max, unit, icon: Icon, color = "primary" }) => {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const isDanger = percentage >= 100;
  const isWarning = percentage >= 85 && !isDanger;
  const barColor = isDanger ? "bg-destructive" : isWarning ? "bg-accent" : color === "chart-4" ? "bg-red-400" : color === "chart-3" ? "bg-amber-400" : color === "blue-500" ? "bg-blue-500" : "bg-primary";
  const iconColor = isDanger ? "text-destructive" : isWarning ? "text-accent" : color === "chart-4" ? "text-red-400" : color === "chart-3" ? "text-amber-400" : color === "blue-500" ? "text-blue-500" : "text-primary";
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
    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mx-0 mt-4 mb-3">
      <Link to="/Summary">
        <div className="bg-white rounded-3xl p-5 shadow-lg hover:shadow-xl transition-all cursor-pointer group">
          <div className="flex items-center justify-between mb-4 w-full">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                <Flame className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
  <span className="text-xl">🔥</span>
  <h3 className="text-sm font-bold text-foreground">Today's Progress</h3>
</div>
                <p className="text-[10px] text-muted-foreground">{caloriesRemaining > 0 ? `${caloriesRemaining} kcal left` : "Goal reached! 🎉"}</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <div className="space-y-2 mb-4">
            {burnedCalories > 0 && (
              <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                <span>🍽 Eaten: <strong className="text-foreground">{Math.round(calories)}</strong> kcal</span>
                <span>🔥 Burned: <strong className="text-orange-500">{Math.round(burnedCalories)}</strong> kcal</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{burnedCalories > 0 ? "Net calories" : "Calories"}</span>
              <div className="text-sm font-bold text-foreground">{Math.round(netCalories)}<span className="text-muted-foreground font-normal"> / {calorieGoal} kcal</span></div>
            </div>
            <div className="relative h-2.5 bg-gray-200 rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${caloriePercentage}%` }} transition={{ duration: 0.8 }} className={cn("h-full rounded-full", isDanger ? "bg-destructive" : isWarning ? "bg-accent" : "bg-gradient-to-r from-primary to-primary/90")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-3">
            <MacroProgressMini label="Protein" value={protein} max={proteinGoal} unit="g" icon={Drumstick} color="chart-4" />
            <MacroProgressMini label="Carbs" value={carbs} max={carbsGoal} unit="g" icon={Wheat} color="chart-3" />
            <MacroProgressMini label="Fats" value={fats} max={fatsGoal} unit="g" icon={Droplets} color="blue-500" />
            <MacroProgressMini label="Fiber" value={fiber} max={fiberGoal} unit="g" icon={Salad} color="primary" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}