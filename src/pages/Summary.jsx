import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { recalculateTotals } from "@/lib/nutritionUtils";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Flame, TrendingUp } from "lucide-react";
import AnimatedProgressBar from "../components/summary/AnimatedProgressBar";
import FoodEntryItem from "../components/summary/FoodEntryItem";
import ScrollableChart from "../components/summary/ScrollableChart";
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

  const navigateDay = (dir) => {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + dir);
      return next;
    });
  };

  const isToday = dateStr === format(new Date(), "yyyy-MM-dd");
  const isPast = !isToday;
  const caloriesConsumed = dayLog?.total_calories || 0;
  const burnedCalories = dayLog?.total_burned_calories || 0;
  const netCalories = Math.max(caloriesConsumed - burnedCalories, 0);
  const caloriesRemaining = Math.max(calorieGoal - netCalories, 0);
  const caloriePercentage = calorieGoal > 0 ? Math.min((netCalories / calorieGoal) * 100, 100) : 0;

  const handleAddEntry = async (group) => {
    if (!dayLog || isPast) return;
    await supabase.from("food_entries").insert({
      foodlog_id: dayLog.id,
      food_name: group.food_name,
      food_key: group.food_key || group.food_name.toLowerCase().trim().replace(/\s+/g, "_"),
      meal_type: group.meal_type,
      grams: group.grams ? Math.round(group.grams / group.quantity) : null,
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
    if (!dayLog || isPast) return;
    const idToDelete = group.ids[group.ids.length - 1];
    await supabase.from("food_entries").delete().eq("id", idToDelete);
    await recalculateTotals(dayLog.id);
    queryClient.invalidateQueries({ queryKey: ["foodEntries", dayLog.id] });
    queryClient.invalidateQueries({ queryKey: ["foodlog"] });
    toast.success(`Removed ${group.food_name} ➖`);
  };

  // Modifica grammi con ricalcolo proporzionale
  const handleUpdateGrams = async (entry, newGrams) => {
    if (!dayLog || !entry.grams || entry.grams === newGrams) return;

    const ratio = newGrams / entry.grams;
    const newCalories = Math.round((entry.calories || 0) * ratio);
    const newProtein = Math.round((entry.protein || 0) * ratio * 10) / 10;
    const newCarbs = Math.round((entry.carbs || 0) * ratio * 10) / 10;
    const newFats = Math.round((entry.fats || 0) * ratio * 10) / 10;
    const newFiber = Math.round((entry.fiber || 0) * ratio * 10) / 10;

    // Aggiorna tutti gli entry_ids del gruppo
    const idsToUpdate = entry.ids || [entry.id];
    const perEntryCalories = Math.round(newCalories / idsToUpdate.length);
    const perEntryGrams = Math.round(newGrams / idsToUpdate.length);

    await Promise.all(idsToUpdate.map(id =>
      supabase.from("food_entries").update({
        grams: perEntryGrams,
        calories: perEntryCalories,
        protein: Math.round(newProtein / idsToUpdate.length * 10) / 10,
        carbs: Math.round(newCarbs / idsToUpdate.length * 10) / 10,
        fats: Math.round(newFats / idsToUpdate.length * 10) / 10,
        fiber: Math.round(newFiber / idsToUpdate.length * 10) / 10,
      }).eq("id", id)
    ));

    await recalculateTotals(dayLog.id);

    // Messaggio di sistema in chat
    await supabase.from("messages").insert({
      foodlog_id: dayLog.id,
      role: "system",
      content: `✏️ **${entry.food_name}** aggiornato: ${Math.round(entry.grams)}g → ${newGrams}g (${newCalories} kcal)`,
      timestamp: new Date().toISOString(),
    });

    queryClient.invalidateQueries({ queryKey: ["foodEntries", dayLog.id] });
    queryClient.invalidateQueries({ queryKey: ["foodlog"] });
    queryClient.invalidateQueries({ queryKey: ["messages", dayLog.id] });

    toast.success(`${entry.food_name} aggiornato ✏️`, {
      description: `${Math.round(entry.grams)}g → ${newGrams}g · ${newCalories} kcal`,
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#f0fcf3", overflow: "hidden" }}>

      {/* Date navigator */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "white", borderBottom: "0.5px solid #e5e7eb",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        padding: "14px 24px", position: "relative", flexShrink: 0,
      }}>
        <button onClick={() => navigateDay(-1)} style={{ position: "absolute", left: "60px", background: "none", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <ChevronLeft style={{ width: "20px", height: "20px", color: "#6b7280" }} />
        </button>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#1a3a22", lineHeight: 1.2 }}>
            {isToday ? "Today" : format(selectedDate, "EEEE, MMM d")}
          </h2>
          <p style={{ fontSize: "11px", color: isPast ? "#f59e0b" : "#9ca3af" }}>
            {isPast
              ? `📅 ${format(selectedDate, "yyyy")} · past day`
              : dayLog ? `${netCalories} kcal logged` : "Start tracking your meals"}
          </p>
        </div>
        <button onClick={() => navigateDay(1)} disabled={isToday} style={{ position: "absolute", right: "16px", background: "none", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: isToday ? "default" : "pointer", opacity: isToday ? 0.3 : 1 }}>
          <ChevronRight style={{ width: "20px", height: "20px", color: "#6b7280" }} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", paddingBottom: "8px" }}>
        <div className="max-w-lg mx-auto px-4 py-4 space-y-4">

          {/* Hero calorie card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            style={{
              background: isPast
                ? "linear-gradient(135deg, #4b7c5a 0%, #3a6348 100%)"
                : "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
              borderRadius: "20px", padding: "18px", color: "white",
              position: "relative", overflow: "hidden",
            }}
          >
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
              <div style={{ width: "44px", height: "44px", borderRadius: "14px", background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Flame className="w-5 h-5 text-white" />
              </div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: "99px", height: "6px", overflow: "hidden", marginBottom: "8px" }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${caloriePercentage}%` }} transition={{ duration: 0.8 }} style={{ background: "white", height: "100%", borderRadius: "99px" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.85)" }}>
                {caloriesRemaining > 0 ? `${caloriesRemaining} kcal remaining` : "Goal reached! 🎉"}
              </p>
              {burnedCalories > 0 && (
                <div style={{ display: "flex", gap: "6px" }}>
                  <span style={{ fontSize: "10px", background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)", padding: "2px 8px", borderRadius: "20px" }}>🍽 {caloriesConsumed} eaten</span>
                  <span style={{ fontSize: "10px", background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)", padding: "2px 8px", borderRadius: "20px" }}>🏃 {burnedCalories} burned</span>
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
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            style={{ position: "relative" }}
          >
            {isPast && (
              <div style={{
                position: "absolute", inset: 0, zIndex: 10,
                background: "rgba(240,252,243,0.3)",
                borderRadius: "16px",
                display: "flex", alignItems: "flex-start", justifyContent: "flex-end",
                padding: "8px",
                pointerEvents: "all",
              }}>
                <span style={{ fontSize: "11px", color: "#9ca3af", background: "white", padding: "4px 12px", borderRadius: "20px", border: "0.5px solid #e5e7eb" }}>
                  🔒 read only
                </span>
              </div>
            )}
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
                    acc[key] = {
                      ...entry, meal_type: mealType, quantity: 1, ids: [entry.id],
                      total_calories: entry.calories || 0, total_carbs: entry.carbs || 0,
                      total_protein: entry.protein || 0, total_fats: entry.fats || 0,
                      total_fiber: entry.fiber || 0,
                      total_grams: entry.grams || null,
                    };
                  } else {
                    acc[key].quantity += 1;
                    acc[key].ids.push(entry.id);
                    acc[key].total_calories += entry.calories || 0;
                    acc[key].total_carbs += entry.carbs || 0;
                    acc[key].total_protein += entry.protein || 0;
                    acc[key].total_fats += entry.fats || 0;
                    acc[key].total_fiber += entry.fiber || 0;
                    if (entry.grams) acc[key].total_grams = (acc[key].total_grams || 0) + entry.grams;
                  }
                  return acc;
                }, {});
                return Object.values(grouped).map(group => (
                  <FoodEntryItem
                    key={group.ids[0]}
                    entry={{
                      ...group,
                      id: group.ids[0],
                      calories: group.total_calories,
                      carbs: group.total_carbs,
                      protein: group.total_protein,
                      fats: group.total_fats,
                      fiber: group.total_fiber,
                      grams: group.total_grams,
                    }}
                    quantity={group.quantity}
                    onAdd={() => handleAddEntry(group)}
                    onRemove={() => handleRemoveEntry(group)}
                    onUpdateGrams={!isPast ? (entry, newGrams) => handleUpdateGrams({ ...group, calories: group.total_calories, carbs: group.total_carbs, protein: group.total_protein, fats: group.total_fats, fiber: group.total_fiber, grams: group.total_grams }, newGrams) : undefined}
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

        </div>
      </div>

      {/* Grafico fisso in basso */}
      <div style={{ background: "#f0fcf3", padding: "8px 16px 90px", flexShrink: 0 }}>
        <div style={{ background: "white", borderRadius: "20px", padding: "10px 16px 10px", border: "0.5px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <TrendingUp style={{ width: "14px", height: "14px", color: "#16a34a" }} />
              <span style={{ fontSize: "13px", fontWeight: 500, color: "#1a3a22" }}>Trend</span>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              {[
                { color: "#16a34a", label: "On track" },
                { color: "#f59e0b", label: "Close" },
                { color: "#ef4444", label: "Off track" },
                { color: "#e5e7eb", label: "No data" },
              ].map(({ color, label }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                  <div style={{ width: "6px", height: "6px", borderRadius: "2px", background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: "9px", color: "#9ca3af" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
          <ScrollableChart calorieGoal={calorieGoal} />
        </div>
      </div>

    </div>
  );
}