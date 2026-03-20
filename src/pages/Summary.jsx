import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { recalculateTotals } from "@/lib/nutritionUtils";
import { format, subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar, Flame, TrendingUp, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import AnimatedProgressBar from "../components/summary/AnimatedProgressBar";
import FoodEntryItem from "../components/summary/FoodEntryItem";
import WeeklyChart from "../components/summary/WeeklyChart";
import DaySuccessIndicator from "../components/summary/DaySuccessIndicator";
import { motion } from "framer-motion";

export default function Summary() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["userProfile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_profiles").select("*").eq("user_id", user.id).single();
      return data;
    },
    enabled: !!user?.id,
  });

  const calorieGoal = profile?.calorie_goal || 2000;
  const proteinGoal = profile?.protein_goal || 120;
  const carbsGoal = profile?.carbs_goal || 250;
  const fatsGoal = profile?.fats_goal || 65;
  const fiberGoal = 30;

  const { data: dayLogs } = useQuery({
    queryKey: ["foodlog", dateStr, user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("food_logs").select("*").eq("date", dateStr).eq("user_id", user.id);
      return data || [];
    },
    enabled: !!user?.id,
    initialData: [],
  });

  const dayLog = dayLogs?.[0] || null;

  const { data: dayEntries } = useQuery({
    queryKey: ["foodEntries", dayLog?.id],
    queryFn: async () => {
      if (!dayLog?.id) return [];
      const { data } = await supabase.from("food_entries").select("*").eq("foodlog_id", dayLog.id);
      return data || [];
    },
    enabled: !!dayLog?.id,
    initialData: [],
  });

  const weekDates = Array.from({ length: 7 }, (_, i) => format(subDays(selectedDate, 6 - i), "yyyy-MM-dd"));

  const { data: weekLogs } = useQuery({
    queryKey: ["foodlog-week", weekDates[0], weekDates[6], user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("food_logs").select("*").eq("user_id", user.id).in("date", weekDates);
      return data || [];
    },
    enabled: !!user?.id,
    initialData: [],
  });

  const weeklyChartData = weekDates.map((d) => {
    const log = weekLogs.find((l) => l.date === d);
    return { day: format(new Date(d + "T12:00:00"), "EEE"), calories: log?.total_calories || 0 };
  });

  const navigateDay = (dir) => {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + dir);
      return next;
    });
  };

  const isToday = dateStr === format(new Date(), "yyyy-MM-dd");
  const caloriesConsumed = dayLog?.total_calories || 0;
  const burnedCalories = dayLog?.total_burned_calories || 0;
  const netCalories = Math.max(caloriesConsumed - burnedCalories, 0);
  const caloriesRemaining = Math.max(calorieGoal - netCalories, 0);
  const caloriePercentage = calorieGoal > 0 ? Math.min((netCalories / calorieGoal) * 100, 100) : 0;

  const handleAddEntry = async (group) => {
    if (!dayLog) return;
    await supabase.from("food_entries").insert({
      foodlog_id: dayLog.id,
      food_name: group.food_name,
      food_key: group.food_key || group.food_name.toLowerCase().trim().replace(/\s+/g, "_"),
      meal_type: group.meal_type,
      calories: Math.round(group.calories / group.quantity),
      carbs: Math.round((group.carbs / group.quantity) * 10) / 10,
      protein: Math.round((group.protein / group.quantity) * 10) / 10,
      fats: Math.round((group.fats / group.quantity) * 10) / 10,
      fiber: Math.round((group.fiber / group.quantity) * 10) / 10,
      timestamp: new Date().toISOString(),
    });
    await recalculateTotals(dayLog.id);
    queryClient.invalidateQueries({ queryKey: ["foodEntries", dayLog.id] });
    queryClient.invalidateQueries({ queryKey: ["foodlog"] });
    toast.success(`Added ${group.food_name} ➕`);
  };

  const handleRemoveEntry = async (group) => {
    if (!dayLog) return;
    const idToDelete = group.ids[group.ids.length - 1];
    await supabase.from("food_entries").delete().eq("id", idToDelete);
    await recalculateTotals(dayLog.id);
    queryClient.invalidateQueries({ queryKey: ["foodEntries", dayLog.id] });
    queryClient.invalidateQueries({ queryKey: ["foodlog"] });
    toast.success(`Removed ${group.food_name} ➖`);
  };

  return (
    <div className="flex-1 overflow-y-auto pb-24" style={{ background: "#f0fcf3" }}>
      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* Date navigator */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "white",
            borderRadius: "16px",
            padding: "10px 14px",
            border: "0.5px solid rgba(0,0,0,0.06)",
          }}
        >
          <Button variant="ghost" size="icon" onClick={() => navigateDay(-1)} style={{ borderRadius: "10px", width: "32px", height: "32px" }}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Calendar className="w-4 h-4" style={{ color: "#16a34a" }} />
            <span style={{ fontSize: "15px", fontWeight: 500, color: "#1a3a22" }}>
              {isToday ? "Today" : format(selectedDate, "MMM d, yyyy")}
            </span>
            {dayLog && <DaySuccessIndicator calories={netCalories} calorieGoal={calorieGoal} />}
          </div>
          <Button variant="ghost" size="icon" onClick={() => navigateDay(1)} disabled={isToday} style={{ borderRadius: "10px", width: "32px", height: "32px" }}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </motion.div>

                {/* Hero calorie card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-gradient-to-br from-green-600 to-green-700 text-white"
          style={{
            borderRadius: "20px",
            padding: "18px",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Decorative circles */}
          <div style={{ position: "absolute", top: "-30px", right: "-30px", width: "120px", height: "120px", borderRadius: "50%", background: "rgba(255,255,255,0.07)" }} />
          <div style={{ position: "absolute", bottom: "-20px", right: "30px", width: "80px", height: "80px", borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px", position: "relative" }}>
            <div>
              <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.75)", marginBottom: "2px" }}>
                {burnedCalories > 0 ? "Net calories" : "Calories today"}
              </p>
              <p style={{ fontSize: "42px", fontWeight: 500, lineHeight: 1, letterSpacing: "-1px" }}>
                {netCalories.toLocaleString()}
              </p>
              <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.65)", marginTop: "2px" }}>
                of {calorieGoal.toLocaleString()} kcal goal
              </p>
            </div>
            <div style={{
              width: "44px", height: "44px", borderRadius: "14px",
              background: "rgba(255,255,255,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center",
              position: "relative",
            }}>
              <Flame className="w-5 h-5 text-white" />
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: "99px", height: "6px", overflow: "hidden", marginBottom: "8px" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${caloriePercentage}%` }}
              transition={{ duration: 0.8 }}
              style={{ background: "white", height: "100%", borderRadius: "99px" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.85)" }}>
              {caloriesRemaining > 0 ? `${caloriesRemaining} kcal remaining` : "Goal reached! 🎉"}
            </p>
            {burnedCalories > 0 && (
              <div style={{ display: "flex", gap: "6px" }}>
                <span style={{ fontSize: "10px", background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)", padding: "2px 8px", borderRadius: "20px" }}>
                  🍽 {caloriesConsumed} eaten
                </span>
                <span style={{ fontSize: "10px", background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)", padding: "2px 8px", borderRadius: "20px" }}>
                  🏃 {burnedCalories} burned
                </span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Macro grid 2x2 */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px", padding: "0 2px" }}>
            <span style={{ fontSize: "13px", fontWeight: 500, color: "#1a3a22" }}>🏅 Nutrition</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <AnimatedProgressBar label="Carbs" value={dayLog?.total_carbs || 0} max={carbsGoal} unit="g" color="chart-3" />
            <AnimatedProgressBar label="Protein" value={dayLog?.total_protein || 0} max={proteinGoal} unit="g" color="chart-4" />
            <AnimatedProgressBar label="Fats" value={dayLog?.total_fats || 0} max={fatsGoal} unit="g" color="blue-500" />
            <AnimatedProgressBar label="Fiber" value={dayLog?.total_fiber || 0} max={fiberGoal} unit="g" color="primary" />
          </div>
        </motion.div>

        {/* What you ate */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px", padding: "0 2px" }}>
            <span style={{ fontSize: "13px", fontWeight: 500, color: "#1a3a22" }}>🍽 What you ate</span>
            {dayEntries?.length > 0 && (
              <span style={{ fontSize: "11px", color: "#9ca3af" }}>{dayEntries.length} items</span>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {dayEntries?.length > 0 ? (() => {
              const validEntries = dayEntries.filter(e => e && e.id && e.food_name);
              const grouped = validEntries.reduce((acc, entry) => {
                const mealType = entry.meal_type?.toLowerCase().trim() || "other";
                const foodKey = (entry.food_key || entry.food_name).toLowerCase().trim();
                const key = `${foodKey}_${mealType}`;
                if (!acc[key]) {
                  acc[key] = { ...entry, meal_type: mealType, quantity: 1, ids: [entry.id], total_calories: entry.calories || 0, total_carbs: entry.carbs || 0, total_protein: entry.protein || 0, total_fats: entry.fats || 0, total_fiber: entry.fiber || 0 };
                } else {
                  acc[key].quantity += 1; acc[key].ids.push(entry.id);
                  acc[key].total_calories += entry.calories || 0; acc[key].total_carbs += entry.carbs || 0;
                  acc[key].total_protein += entry.protein || 0; acc[key].total_fats += entry.fats || 0; acc[key].total_fiber += entry.fiber || 0;
                }
                return acc;
              }, {});
              return Object.values(grouped).map(group => (
                <FoodEntryItem
                  key={group.ids[0]}
                  entry={{ ...group, calories: group.total_calories, carbs: group.total_carbs, protein: group.total_protein, fats: group.total_fats, fiber: group.total_fiber }}
                  quantity={group.quantity}
                  onAdd={() => handleAddEntry(group)}
                  onRemove={() => handleRemoveEntry(group)}
                />
              ));
            })() : (
              <div style={{ textAlign: "center", padding: "32px 0", background: "white", borderRadius: "16px", border: "0.5px solid rgba(0,0,0,0.06)" }}>
                <p style={{ fontSize: "13px", color: "#9ca3af", marginBottom: "4px" }}>No food logged yet</p>
                <p style={{ fontSize: "12px", color: "#9ca3af" }}>Head to chat to start tracking 💬</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Weekly trend */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px", padding: "0 2px" }}>
            <TrendingUp className="w-4 h-4" style={{ color: "#16a34a" }} />
            <span style={{ fontSize: "13px", fontWeight: 500, color: "#1a3a22" }}>Weekly trend</span>
          </div>

          <div style={{ background: "white", borderRadius: "16px", padding: "14px", border: "0.5px solid rgba(0,0,0,0.06)" }}>
            <WeeklyChart data={weeklyChartData} calorieGoal={calorieGoal} />

            {weekLogs.length > 0 && (
              <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
                {weekLogs.slice().reverse().map((log, i) => {
                  const pct = (log.total_calories / calorieGoal) * 100;
                  let icon = "❌";
                  let statusText = pct < 80 ? "Under goal" : "Over goal";
                  let statusStyle = { background: "#fee2e2", color: "#991b1b" };
                  if (pct >= 90 && pct <= 110) { icon = "✅"; statusText = "On track"; statusStyle = { background: "#dcfce7", color: "#166534" }; }
                  else if ((pct >= 80 && pct < 90) || (pct > 110 && pct <= 120)) { icon = "⚠️"; statusText = "Close"; statusStyle = { background: "#fef9c3", color: "#854d0e" }; }
                  return (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      style={{
                        display: "flex", alignItems: "center", gap: "10px",
                        background: "#f9fafb", borderRadius: "12px", padding: "8px 10px",
                      }}
                    >
                      <span style={{ fontSize: "13px", width: "20px", textAlign: "center" }}>{icon}</span>
                      <span style={{ fontSize: "12px", fontWeight: 500, color: "#1a3a22", flex: 1 }}>
                        {format(new Date(log.date + "T12:00:00"), "MMM d")}
                      </span>
                      <span style={{ fontSize: "11px", color: "#6b7280" }}>{log.total_calories} kcal</span>
                      <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "20px", ...statusStyle }}>
                        {statusText}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>

      </div>
    </div>
  );
}
```

---

## 🚀 Deploy

Quando hai sostituito tutti e 3 i file, apri il terminale nella cartella del progetto e lancia:
```
git add .
git commit -m "redesign Summary: hero card, macro grid 2x2, weekly chart verde"
git push