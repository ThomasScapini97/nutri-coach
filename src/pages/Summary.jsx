import { useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { recalculateTotals, FIBER_GOAL } from "@/lib/nutritionUtils";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Flame, TrendingUp, Share2 } from "lucide-react";
import AnimatedProgressBar from "../components/summary/AnimatedProgressBar";
import FoodEntryItem from "../components/summary/FoodEntryItem";
import ScrollableChart from "../components/summary/ScrollableChart";
import { motion } from "framer-motion";

export default function Summary() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showShare, setShowShare] = useState(false);
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["userProfile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_profiles").select("*").eq("user_id", user.id).maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const calorieGoal = profile?.calorie_goal || 2000;
  const proteinGoal = profile?.protein_goal || 120;
  const carbsGoal = profile?.carbs_goal || 250;
  const fatsGoal = profile?.fats_goal || 65;
  const fiberGoal = FIBER_GOAL;

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
const caloriesConsumed = dayLog?.total_calories || 0;
  const burnedCalories = dayLog?.total_burned_calories || 0;
  const netCalories = Math.max(caloriesConsumed - burnedCalories, 0);
  const caloriesRemaining = Math.max(calorieGoal - netCalories, 0);
  const caloriePercentage = calorieGoal > 0 ? Math.min((netCalories / calorieGoal) * 100, 100) : 0;

  const groupedEntries = useMemo(() => {
    const validEntries = (dayEntries || []).filter(e => e && e.id && e.food_name);
    return Object.values(validEntries.reduce((acc, entry) => {
      const mealType = entry.meal_type?.toLowerCase().trim() || "other";
      const foodKey = (entry.food_name || entry.food_key || "").toLowerCase().trim().replace(/\s+/g, "_");
      const key = `${foodKey}_${mealType}`;
      if (!acc[key]) {
        acc[key] = {
          ...entry, meal_type: mealType, quantity: 1, ids: [entry.id],
          total_calories: entry.calories || 0, total_carbs: entry.carbs || 0,
          total_protein: entry.protein || 0, total_fats: entry.fats || 0,
          total_fiber: entry.fiber || 0, total_grams: entry.grams || null,
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
    }, {}));
  }, [dayEntries]);

  const handleAddEntry = async (group) => {
    if (!dayLog) return;
    try {
      const { error } = await supabase.from("food_entries").insert({
        foodlog_id: dayLog.id,
        food_name: group.food_name,
        food_key: group.food_key || group.food_name.toLowerCase().trim().replace(/\s+/g, "_"),
        meal_type: group.meal_type,
        grams: group.total_grams ? Math.round(group.total_grams / group.quantity) : null,
        calories: Math.round(group.total_calories / group.quantity),
        carbs: Math.round((group.total_carbs / group.quantity) * 10) / 10,
        protein: Math.round((group.total_protein / group.quantity) * 10) / 10,
        fats: Math.round((group.total_fats / group.quantity) * 10) / 10,
        fiber: Math.round((group.total_fiber / group.quantity) * 10) / 10,
        timestamp: new Date().toISOString(),
      });
      if (error) throw error;
      await recalculateTotals(dayLog.id);
      await supabase.from("messages").insert({
        foodlog_id: dayLog.id,
        role: "system",
        content: `➕ **${group.food_name}** aggiunto (x${group.quantity + 1})`,
        timestamp: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ["foodEntries", dayLog.id] });
      queryClient.invalidateQueries({ queryKey: ["foodlog"] });
      queryClient.invalidateQueries({ queryKey: ["messages", dayLog.id] });
      toast.success(`Added ${group.food_name} ➕`);
    } catch {
      toast.error("Failed to add entry. Please try again.");
    }
  };

  const handleRemoveEntry = async (group) => {
    if (!dayLog) return;
    try {
      const idToDelete = group.ids[group.ids.length - 1];
      const { error } = await supabase.from("food_entries").delete().eq("id", idToDelete);
      if (error) throw error;
      await recalculateTotals(dayLog.id);
      const isDeleted = group.quantity === 1;
      await supabase.from("messages").insert({
        foodlog_id: dayLog.id,
        role: "system",
        content: isDeleted
          ? `🗑️ **${group.food_name}** eliminato`
          : `➖ **${group.food_name}** rimosso (x${group.quantity - 1})`,
        timestamp: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ["foodEntries", dayLog.id] });
      queryClient.invalidateQueries({ queryKey: ["foodlog"] });
      queryClient.invalidateQueries({ queryKey: ["messages", dayLog.id] });
      toast.success(`Removed ${group.food_name} ➖`);
    } catch {
      toast.error("Failed to remove entry. Please try again.");
    }
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

  const MEAL_META = {
    breakfast: { emoji: "🌅", label: "Breakfast" },
    lunch:     { emoji: "☀️", label: "Lunch" },
    dinner:    { emoji: "🌙", label: "Dinner" },
    snack:     { emoji: "🍎", label: "Snack" },
  };

  const handleCopyText = () => {
    const dateLabel = isToday ? "Today" : format(selectedDate, "EEEE, d MMM");
    let text = `🥗 NutriCoach — ${dateLabel}\n`;
    text += `━━━━━━━━━━━━━━━━━━\n`;
    text += `🔥 ${netCalories} / ${calorieGoal} kcal\n`;
    text += `💪 ${Math.round(dayLog?.total_protein || 0)}g prot  🌾 ${Math.round(dayLog?.total_carbs || 0)}g carbs  🫐 ${Math.round(dayLog?.total_fats || 0)}g fats\n\n`;
    ["breakfast", "lunch", "dinner", "snack"].forEach(meal => {
      const entries = groupedEntries.filter(e => e.meal_type === meal);
      if (!entries.length) return;
      const { emoji, label } = MEAL_META[meal];
      const kcal = Math.round(entries.reduce((s, e) => s + e.total_calories, 0));
      text += `${emoji} ${label} — ${kcal} kcal\n`;
      entries.forEach(e => { text += `  • ${e.food_name}${e.quantity > 1 ? ` x${e.quantity}` : ""}\n`; });
      text += "\n";
    });
    if (burnedCalories > 0) text += `🏃 Exercise: -${burnedCalories} kcal\n`;
    navigator.clipboard.writeText(text).then(() => toast.success("Copied to clipboard!"));
  };

  const handleNativeShare = async () => {
    const dateLabel = isToday ? "Today" : format(selectedDate, "EEEE, d MMM");
    try {
      await navigator.share({ title: `NutriCoach — ${dateLabel}`, text: `${netCalories} kcal logged on NutriCoach` });
    } catch { /* cancelled */ }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-mint overflow-hidden">

      {/* Date navigator */}
      <div className="flex items-center bg-white border-b border-gray-200 shadow-[0_1px_4px_rgba(0,0,0,0.06)] px-4 py-[14px] shrink-0">
        <div className="w-16 flex items-center justify-start">
          <button onClick={() => navigateDay(-1)} className="bg-transparent border-none flex items-center justify-center cursor-pointer p-1">
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="flex-1 text-center">
          <h2 className="text-base font-semibold text-forest leading-[1.2] m-0">
            {isToday ? "Today" : format(selectedDate, "EEEE, MMM d")}
          </h2>
          <p className="text-[11px] m-0 text-gray-400">
            {dayLog ? `${netCalories} kcal logged` : "No meals logged"}
          </p>
        </div>
        <div className="w-16 flex items-center justify-end gap-3">
          <button
            disabled={isToday}
            onClick={() => navigateDay(1)}
            className={`bg-transparent border-none flex items-center justify-center p-1 ${isToday ? "opacity-30 cursor-default" : "cursor-pointer"}`}
          >
            <ChevronRight className="w-5 h-5 text-gray-500" />
          </button>
          {dayLog && (
            <button onClick={() => setShowShare(true)} className="bg-transparent border-none flex items-center justify-center cursor-pointer p-1">
              <Share2 className="w-[18px] h-[18px] text-gray-400" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-[72px]">
        <div className="max-w-lg mx-auto px-4 py-4 space-y-4">

          {/* Hero calorie card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="rounded-[20px] p-[18px] text-white relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
            }}
          >
            <div className="absolute -top-[30px] -right-[30px] w-[120px] h-[120px] rounded-full bg-white/[0.07]" />
            <div className="absolute -bottom-[20px] right-[30px] w-[80px] h-[80px] rounded-full bg-white/[0.05]" />
            <div className="flex justify-between items-start mb-[14px] relative">
              <div>
                <p className="text-[11px] text-white/75 mb-[2px]">
                  {burnedCalories > 0 ? "Net calories" : "Calories today"}
                </p>
                <p className="text-[42px] font-medium leading-none tracking-[-1px]">
                  {netCalories.toLocaleString()}
                </p>
                <p className="text-[11px] text-white/65 mt-[2px]">
                  of {calorieGoal.toLocaleString()} kcal goal
                </p>
              </div>
              <div className="w-11 h-11 rounded-[14px] bg-white/[0.18] flex items-center justify-center">
                <Flame className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="bg-white/20 rounded-full h-[6px] overflow-hidden mb-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${caloriePercentage}%` }}
                transition={{ duration: 0.8 }}
                className="bg-white h-full rounded-full"
              />
            </div>
            <div className="flex justify-between items-center">
              <p className="text-[11px] text-white/85">
                {caloriesRemaining > 0 ? `${caloriesRemaining} kcal remaining` : "Goal reached! 🎉"}
              </p>
              {burnedCalories > 0 && (
                <div className="flex gap-[6px]">
                  <span className="text-[10px] bg-white/15 text-white/90 px-2 py-[2px] rounded-full">🍽 {caloriesConsumed} eaten</span>
                  <span className="text-[10px] bg-white/15 text-white/90 px-2 py-[2px] rounded-full">🏃 {burnedCalories} burned</span>
                </div>
              )}
            </div>
          </motion.div>

          {/* Macro grid 2x2 */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="flex items-center gap-[6px] mb-[10px] px-[2px]">
              <span className="text-[13px] font-medium text-forest">🏅 Nutrition</span>
            </div>
            <div style={{ background: "white", borderRadius: "16px", border: "0.5px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", padding: "12px 14px" }}>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <AnimatedProgressBar label="Carbs" value={dayLog?.total_carbs || 0} max={carbsGoal} unit="g" color="chart-3" />
                <AnimatedProgressBar label="Protein" value={dayLog?.total_protein || 0} max={proteinGoal} unit="g" color="chart-4" />
                <AnimatedProgressBar label="Fats" value={dayLog?.total_fats || 0} max={fatsGoal} unit="g" color="blue-500" />
                <AnimatedProgressBar label="Fiber" value={dayLog?.total_fiber || 0} max={fiberGoal} unit="g" color="primary" />
              </div>
            </div>
          </motion.div>

          {/* What you ate */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="relative"
          >
            <div className="flex items-center justify-between mb-[10px] px-[2px]">
              <span className="text-[13px] font-medium text-forest">🍽 What you ate</span>
              {dayEntries?.length > 0 && (
                <span className="text-[11px] text-gray-400">{dayEntries.length} items</span>
              )}
            </div>
            <div className="flex flex-col gap-[6px]">
              {groupedEntries.length > 0 ? groupedEntries.map(group => (
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
                    onUpdateGrams={(_entry, newGrams) => handleUpdateGrams({ ...group, calories: group.total_calories, carbs: group.total_carbs, protein: group.total_protein, fats: group.total_fats, fiber: group.total_fiber, grams: group.total_grams }, newGrams)}
                  />
                )) : (
                <div className="text-center py-8 bg-white rounded-2xl border border-black/[0.06]">
                  <p className="text-[13px] text-gray-400 mb-1">No food logged yet</p>
                  <p className="text-xs text-gray-400">Head to chat to start tracking 💬</p>
                </div>
              )}
            </div>
          </motion.div>

        </div>
      </div>

      {/* Trend chart */}
      <div className="bg-mint px-4 pt-2 pb-[72px] shrink-0">
        <div className="bg-white rounded-[20px] px-4 pt-[10px] pb-[10px] border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between mb-[10px]">
            <div className="flex items-center gap-[6px]">
              <TrendingUp className="w-[14px] h-[14px] text-green-600" />
              <span className="text-[13px] font-medium text-forest">Trend</span>
            </div>
            <div className="flex gap-2">
              {[
                { color: "#16a34a", label: "On track" },
                { color: "#f59e0b", label: "Close" },
                { color: "#ef4444", label: "Off track" },
                { color: "#e5e7eb", label: "No data" },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-[3px]">
                  <div className="w-[6px] h-[6px] rounded-[2px] shrink-0" style={{ background: color }} />
                  <span className="text-[9px] text-gray-400">{label}</span>
                </div>
              ))}
            </div>
          </div>
          <ScrollableChart calorieGoal={calorieGoal} />
        </div>
      </div>

      {/* Share modal */}
      {showShare && (
        <div className="fixed inset-0 z-[9999] bg-black/60 flex items-end justify-center" onClick={() => setShowShare(false)}>
          <div className="w-full max-w-[480px] bg-white rounded-t-[28px] px-4 pb-10 pt-5 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

            {/* Card preview */}
            <div className="rounded-[20px] p-4 space-y-3" style={{ background: "linear-gradient(135deg, #f0fdf4, #dcfce7)" }}>
              {/* Header */}
              <div className="flex items-center gap-3 pb-1">
                <span className="text-2xl">🥗</span>
                <div>
                  <p className="font-semibold text-forest text-sm m-0">NutriCoach</p>
                  <p className="text-[11px] text-gray-400 m-0">{isToday ? "Today" : format(selectedDate, "EEEE, d MMM yyyy")}</p>
                </div>
              </div>

              {/* Total calories */}
              <div className="bg-white rounded-[14px] px-4 py-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-forest">🔥 Total</span>
                <div className="text-right">
                  <span className="text-lg font-bold text-forest">{netCalories}</span>
                  <span className="text-xs text-gray-400"> / {calorieGoal} kcal</span>
                </div>
              </div>

              {/* Macros */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Protein", value: Math.round(dayLog?.total_protein || 0), color: "#ec4899" },
                  { label: "Carbs",   value: Math.round(dayLog?.total_carbs   || 0), color: "#f59e0b" },
                  { label: "Fats",    value: Math.round(dayLog?.total_fats    || 0), color: "#3b82f6" },
                ].map(m => (
                  <div key={m.label} className="bg-white rounded-[12px] py-2 text-center">
                    <p className="text-[10px] text-gray-400 m-0">{m.label}</p>
                    <p className="text-sm font-bold m-0" style={{ color: m.color }}>{m.value}g</p>
                  </div>
                ))}
              </div>

              {/* Per-meal cards */}
              {["breakfast", "lunch", "dinner", "snack"].map(meal => {
                const entries = groupedEntries.filter(e => e.meal_type === meal);
                if (!entries.length) return null;
                const { emoji, label } = MEAL_META[meal];
                const kcal  = Math.round(entries.reduce((s, e) => s + e.total_calories, 0));
                const prot  = Math.round(entries.reduce((s, e) => s + e.total_protein,  0));
                const carbs = Math.round(entries.reduce((s, e) => s + e.total_carbs,    0));
                const fats  = Math.round(entries.reduce((s, e) => s + e.total_fats,     0));
                return (
                  <div key={meal} className="bg-white rounded-[14px] px-4 py-3">
                    <div className="flex items-center justify-between mb-[6px]">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{emoji}</span>
                        <span className="font-semibold text-sm text-forest">{label}</span>
                      </div>
                      <span className="text-sm font-bold text-forest">{kcal} kcal</span>
                    </div>
                    <p className="text-[11px] text-gray-500 m-0 mb-2 leading-relaxed">
                      {entries.map(e => `${e.food_name}${e.quantity > 1 ? ` x${e.quantity}` : ""}`).join(" · ")}
                    </p>
                    <div className="flex gap-3">
                      <span className="text-[10px] font-medium" style={{ color: "#ec4899" }}>{prot}g prot</span>
                      <span className="text-[10px] font-medium" style={{ color: "#f59e0b" }}>{carbs}g carbs</span>
                      <span className="text-[10px] font-medium" style={{ color: "#3b82f6" }}>{fats}g fats</span>
                    </div>
                  </div>
                );
              })}

              {/* Burned calories */}
              {burnedCalories > 0 && (
                <div className="bg-white rounded-[14px] px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>🏃</span>
                    <span className="text-sm font-medium text-forest">Exercise</span>
                  </div>
                  <span className="text-sm font-bold text-red-500">−{burnedCalories} kcal</span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 mt-4">
              <button onClick={handleCopyText}
                className="flex-1 bg-gray-100 border-none rounded-[14px] py-[13px] text-sm font-medium text-forest cursor-pointer font-[inherit]">
                📋 Copy text
              </button>
              {typeof navigator.share === "function" && (
                <button onClick={handleNativeShare}
                  className="flex-1 bg-green-600 border-none rounded-[14px] py-[13px] text-sm font-medium text-white cursor-pointer font-[inherit]">
                  Share ↗
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}