import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Wheat, Drumstick, Droplets, Salad, ChevronDown, GlassWater, Flame } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";
import { WATER_GOAL } from "@/lib/constants";

const MacroProgressMini = ({ label, value, max, unit, icon: Icon, color = "primary" }) => {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const isDanger = percentage >= 100;
  const isWarning = percentage >= 85 && !isDanger;
  const barColor = color === "chart-4" ? "bg-red-400" : color === "chart-3" ? "bg-amber-400" : color === "blue-500" ? "bg-blue-500" : "bg-emerald-500";
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

export default function DailyDashboard({ todayLog, calorieGoal, proteinGoal, carbsGoal, fatsGoal, fiberGoal, userId, onWaterUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [waterLoading, setWaterLoading] = useState(false);

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
  const glasses = todayLog?.water_glasses || 0;

  const updateWater = async (newCount) => {
    if (waterLoading) return;
    setWaterLoading(true);
    let logId = todayLog?.id;
    if (!logId) {
      const { data: created } = await supabase
        .from("food_logs")
        .insert({
          date: format(new Date(), "yyyy-MM-dd"),
          user_id: userId,
          total_calories: 0, total_carbs: 0, total_protein: 0,
          total_fats: 0, total_fiber: 0, total_burned_calories: 0,
          water_glasses: newCount,
        })
        .select()
        .single();
      logId = created?.id;
    } else {
      await supabase.from("food_logs").update({ water_glasses: newCount }).eq("id", logId);
    }
    onWaterUpdate?.();
    setWaterLoading(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-4 mt-4 mb-3">
      <div className="rounded-3xl transition-all pb-px" style={{
        background: "rgba(255,255,255,0.78)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.08), 0 1px 0 rgba(255,255,255,0.6) inset",
        border: "0.5px solid rgba(255,255,255,0.55)",
      }}>

        {/* Header — sempre visibile */}
        <div className="flex items-center justify-between p-4 pb-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            <div>
              <h3 className="text-sm font-bold text-foreground">Today's Progress</h3>
              <p className="text-[10px] text-muted-foreground">
                {caloriesRemaining > 0 ? `${caloriesRemaining} kcal left` : "Goal reached! 🎉"}
              </p>
              {burnedCalories > 0 && (
                <p className="text-[10px] text-orange-500 mt-[1px]">
                  {burnedCalories} kcal burned
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground">
              {Math.round(netCalories)}
              <span className="text-muted-foreground font-normal text-xs"> / {calorieGoal}</span>
            </span>
            <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />
          </div>
        </div>

        {/* Barra calorie — sempre visibile */}
        <div className="px-4 pb-3">
          <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${caloriePercentage}%` }}
              transition={{ duration: 0.8 }}
              className={cn("h-full rounded-full", isDanger ? "bg-rose-500" : isWarning ? "bg-rose-400" : "bg-rose-500")}
            />
          </div>
        </div>

        {/* Macros — visibili solo se expanded */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-gray-100 pt-3">
                <MacroProgressMini label="Protein" value={protein} max={proteinGoal} unit="g" icon={Drumstick} color="chart-4" />
                <MacroProgressMini label="Carbs" value={carbs} max={carbsGoal} unit="g" icon={Wheat} color="chart-3" />
                <MacroProgressMini label="Fats" value={fats} max={fatsGoal} unit="g" icon={Droplets} color="blue-500" />
                <MacroProgressMini label="Fiber" value={fiber} max={fiberGoal} unit="g" icon={Salad} color="primary" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Water tracker — sempre visibile */}
        <div className="mx-4 mb-3 bg-blue-50 rounded-xl px-3 py-2 border border-blue-200">
          <div className="flex items-center justify-between mb-[6px]">
            <div className="flex items-center gap-[6px]">
              <GlassWater className="w-[14px] h-[14px] text-blue-500" />
              <span className="text-[11px] font-medium text-blue-800">Water</span>
              <span className="text-[10px] text-blue-300">{glasses * 250}ml / 2000ml</span>
            </div>
            <div className="flex items-center gap-[6px]">
              <button
                onClick={(e) => { e.stopPropagation(); if (glasses > 0) updateWater(glasses - 1); }}
                disabled={glasses === 0 || waterLoading}
                className={`w-5 h-5 rounded-full border border-blue-200 text-[14px] flex items-center justify-center font-[inherit] leading-none shrink-0 ${glasses === 0 ? "bg-blue-100 text-blue-300 cursor-default" : "bg-white text-blue-500 cursor-pointer"}`}
              >−</button>
              <span className="text-[11px] font-medium text-blue-800 min-w-[24px] text-center">
                {glasses}/{WATER_GOAL}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); if (glasses < WATER_GOAL) updateWater(glasses + 1); }}
                disabled={glasses === WATER_GOAL || waterLoading}
                className={`w-5 h-5 rounded-full border-none text-white text-[14px] flex items-center justify-center font-[inherit] leading-none shrink-0 ${glasses === WATER_GOAL ? "bg-blue-100 cursor-default" : "bg-blue-500 cursor-pointer"}`}
              >+</button>
            </div>
          </div>

          {/* Glasses row */}
          <div className="flex gap-[3px]">
            {Array.from({ length: WATER_GOAL }).map((_, i) => (
              <motion.button
                key={i}
                onClick={(e) => { e.stopPropagation(); updateWater(i < glasses ? i : i + 1); }}
                animate={{ opacity: i < glasses ? 1 : 0.3 }}
                transition={{ duration: 0.15 }}
                className={`flex-1 h-[6px] rounded-[3px] border-none cursor-pointer ${i < glasses ? "bg-blue-500" : "bg-blue-200"}`}
              />
            ))}
          </div>

          {glasses === WATER_GOAL && (
            <p className="text-[10px] text-blue-700 text-center mt-[5px] font-medium m-0">
              Daily water goal reached! 🎉
            </p>
          )}
        </div>

      </div>
    </motion.div>
  );
}