import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Wheat, Drumstick, Droplets, Salad, ChevronRight, ChevronDown, GlassWater } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { format } from "date-fns";

const WATER_GOAL = 8;

const MacroProgressMini = ({ label, value, max, unit, icon: Icon, color = "primary" }) => {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const isDanger = percentage >= 100;
  const isWarning = percentage >= 85 && !isDanger;
  const barColor = isDanger ? "bg-red-500" : isWarning ? "bg-orange-400" : color === "chart-4" ? "bg-red-400" : color === "chart-3" ? "bg-amber-400" : color === "blue-500" ? "bg-blue-500" : "bg-emerald-500";
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

export default function DailyDashboard({ todayLog, calorieGoal, proteinGoal, carbsGoal, fatsGoal, fiberGoal, onWaterUpdate }) {
  const [expanded, setExpanded] = useState(true);
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
          user_id: (await supabase.auth.getUser()).data.user.id,
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
    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mx-4 mt-4 mb-3">
      <div className="bg-white rounded-3xl shadow-lg transition-all">

        {/* Header — sempre visibile */}
        <div className="flex items-center justify-between p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
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

        {/* Dettagli macros + water — visibili solo se expanded */}
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

              {/* Water tracker */}
              <div style={{
                margin: "0 16px 12px",
                background: "#eff6ff",
                borderRadius: "12px",
                padding: "8px 12px",
                border: "0.5px solid #bfdbfe",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <GlassWater style={{ width: "14px", height: "14px", color: "#3b82f6" }} />
                    <span style={{ fontSize: "11px", fontWeight: 500, color: "#1e40af" }}>Water</span>
                    <span style={{ fontSize: "10px", color: "#93c5fd" }}>{glasses * 250}ml / 2000ml</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); if (glasses > 0) updateWater(glasses - 1); }}
                      disabled={glasses === 0 || waterLoading}
                      style={{
                        width: "20px", height: "20px", borderRadius: "50%",
                        background: glasses === 0 ? "#dbeafe" : "white",
                        border: "0.5px solid #bfdbfe",
                        color: glasses === 0 ? "#93c5fd" : "#3b82f6",
                        fontSize: "14px", cursor: glasses === 0 ? "default" : "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontFamily: "inherit", lineHeight: 1, flexShrink: 0,
                      }}
                    >−</button>
                    <span style={{ fontSize: "11px", fontWeight: 500, color: "#1e40af", minWidth: "24px", textAlign: "center" }}>
                      {glasses}/{WATER_GOAL}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); if (glasses < WATER_GOAL) updateWater(glasses + 1); }}
                      disabled={glasses === WATER_GOAL || waterLoading}
                      style={{
                        width: "20px", height: "20px", borderRadius: "50%",
                        background: glasses === WATER_GOAL ? "#dbeafe" : "#3b82f6",
                        border: "none",
                        color: "white",
                        fontSize: "14px", cursor: glasses === WATER_GOAL ? "default" : "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontFamily: "inherit", lineHeight: 1, flexShrink: 0,
                      }}
                    >+</button>
                  </div>
                </div>

                {/* Bicchieri */}
                <div style={{ display: "flex", gap: "3px" }}>
                  {Array.from({ length: WATER_GOAL }).map((_, i) => (
                    <motion.button
                      key={i}
                      onClick={(e) => { e.stopPropagation(); updateWater(i < glasses ? i : i + 1); }}
                      animate={{ opacity: i < glasses ? 1 : 0.3 }}
                      transition={{ duration: 0.15 }}
                      style={{
                        flex: 1, height: "20px", borderRadius: "4px",
                        background: i < glasses ? "#3b82f6" : "#bfdbfe",
                        border: "none", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "9px",
                      }}
                    >
                      {i < glasses ? "💧" : ""}
                    </motion.button>
                  ))}
                </div>

                {glasses === WATER_GOAL && (
                  <p style={{ fontSize: "10px", color: "#1d4ed8", textAlign: "center", marginTop: "5px", fontWeight: 500 }}>
                    Daily water goal reached! 🎉
                  </p>
                )}
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