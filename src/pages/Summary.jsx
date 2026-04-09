import { useState, useMemo, useRef } from "react";
import html2canvas from 'html2canvas';
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { recalculateTotals, FIBER_GOAL } from "@/lib/nutritionUtils";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Flame, TrendingUp, Share2, Wheat, Drumstick, Droplets, Salad, Download } from "lucide-react";
import AnimatedProgressBar from "../components/summary/AnimatedProgressBar";
import FoodEntryItem from "../components/summary/FoodEntryItem";
import ScrollableChart from "../components/summary/ScrollableChart";
import { motion } from "framer-motion";

export default function Summary() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showShare, setShowShare] = useState(false);
  const [exportingMeal, setExportingMeal] = useState(null);
  const cardRefs = useRef({});
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
        content: `➕ **${group.food_name}** added (x${group.quantity + 1})`,
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
          ? `🗑️ **${group.food_name}** deleted`
          : `➖ **${group.food_name}** removed (x${group.quantity - 1})`,
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

    try {
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
    } catch {
      toast.error("Failed to update entry. Please try again.");
      return;
    }

    await recalculateTotals(dayLog.id);

    // Messaggio di sistema in chat
    await supabase.from("messages").insert({
      foodlog_id: dayLog.id,
      role: "system",
      content: `✏️ **${entry.food_name}** updated: ${Math.round(entry.grams)}g → ${newGrams}g (${newCalories} kcal)`,
      timestamp: new Date().toISOString(),
    });

    queryClient.invalidateQueries({ queryKey: ["foodEntries", dayLog.id] });
    queryClient.invalidateQueries({ queryKey: ["foodlog"] });
    queryClient.invalidateQueries({ queryKey: ["messages", dayLog.id] });

    toast.success(`${entry.food_name} updated ✏️`, {
      description: `${Math.round(entry.grams)}g → ${newGrams}g · ${newCalories} kcal`,
    });
  };

  const MEAL_META = {
    breakfast: { emoji: "🌅", label: "Breakfast" },
    lunch:     { emoji: "☀️", label: "Lunch" },
    dinner:    { emoji: "🌙", label: "Dinner" },
    snack:     { emoji: "🍎", label: "Snack" },
  };

  const exportCard = async (meal, mealLabel) => {
    const cardEl = cardRefs.current[meal];
    if (!cardEl) return;
    setExportingMeal(meal);
    await new Promise(r => setTimeout(r, 60));
    try {
      const raw = await html2canvas(cardEl, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      });

      // Draw with rounded corners + padding on a transparent canvas
      const pad = 24;
      const radius = 32;
      const w = raw.width + pad * 2;
      const h = raw.height + pad * 2;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      // Rounded clip
      ctx.beginPath();
      ctx.moveTo(pad + radius, pad);
      ctx.lineTo(w - pad - radius, pad);
      ctx.quadraticCurveTo(w - pad, pad, w - pad, pad + radius);
      ctx.lineTo(w - pad, h - pad - radius);
      ctx.quadraticCurveTo(w - pad, h - pad, w - pad - radius, h - pad);
      ctx.lineTo(pad + radius, h - pad);
      ctx.quadraticCurveTo(pad, h - pad, pad, h - pad - radius);
      ctx.lineTo(pad, pad + radius);
      ctx.quadraticCurveTo(pad, pad, pad + radius, pad);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(raw, pad, pad);

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const file = new File([blob], `nutricoach-${meal}.png`, { type: 'image/png' });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: `My ${mealLabel} — NutriCoach`, files: [file] });
        toast.success('Shared! 🎉');
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `nutricoach-${meal}.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Saved! 📸');
      }
    } catch (err) {
      if (err?.name !== 'AbortError') console.error('Export failed:', err);
    }
    setExportingMeal(null);
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
      <div className="relative flex items-center justify-center bg-white border-b border-gray-200 shadow-[0_1px_4px_rgba(0,0,0,0.06)] px-4 py-[14px] shrink-0">
        <button onClick={() => navigateDay(-1)} className="absolute left-[56px] bg-transparent border-none flex items-center justify-center cursor-pointer p-1">
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className="text-center">
          <h2 className="text-base font-semibold text-forest leading-[1.2] m-0">
            {isToday ? "Today" : format(selectedDate, "EEEE, MMM d")}
          </h2>
          <p className="text-[11px] m-0 text-gray-400">
            {dayLog ? `${netCalories} kcal logged` : "No meals logged"}
          </p>
        </div>
        <div className="absolute right-4 flex items-center gap-3">
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
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Protein", value: Math.round(dayLog?.total_protein || 0), color: "#ec4899" },
                  { label: "Carbs",   value: Math.round(dayLog?.total_carbs   || 0), color: "#f59e0b" },
                  { label: "Fats",    value: Math.round(dayLog?.total_fats    || 0), color: "#3b82f6" },
                  { label: "Fiber",   value: Math.round(dayLog?.total_fiber   || 0), color: "#22c55e" },
                ].map(m => (
                  <div key={m.label} className="bg-white rounded-[12px] py-2 text-center">
                    <p className="text-[10px] text-gray-400 m-0">{m.label}</p>
                    <p className="text-sm font-bold m-0" style={{ color: m.color }}>{m.value}g</p>
                  </div>
                ))}
              </div>

              {/* Per-meal cards — same style as NutritionCard in chat */}
              {["breakfast", "lunch", "dinner", "snack"].map(meal => {
                const entries = groupedEntries.filter(e => e.meal_type === meal);
                if (!entries.length) return null;
                const { emoji, label } = MEAL_META[meal];
                const mealMacros = [
                  { key: "calories", label: "Calories", unit: "kcal", Icon: Flame,     bg: "bg-orange-100",  color: "text-orange-500", value: Math.round(entries.reduce((s, e) => s + e.total_calories, 0)) },
                  { key: "carbs",    label: "Carbs",    unit: "g",    Icon: Wheat,     bg: "bg-amber-100",   color: "text-amber-400",  value: Math.round(entries.reduce((s, e) => s + e.total_carbs,    0)) },
                  { key: "protein",  label: "Protein",  unit: "g",    Icon: Drumstick, bg: "bg-red-100",     color: "text-red-400",    value: Math.round(entries.reduce((s, e) => s + e.total_protein,  0)) },
                  { key: "fats",     label: "Fats",     unit: "g",    Icon: Droplets,  bg: "bg-blue-100",    color: "text-blue-500",   value: Math.round(entries.reduce((s, e) => s + e.total_fats,     0)) },
                  { key: "fiber",    label: "Fiber",    unit: "g",    Icon: Salad,     bg: "bg-emerald-100", color: "text-emerald-500", value: Math.round(entries.reduce((s, e) => s + e.total_fiber,    0)) },
                ];
                return (
                  <div key={meal} ref={el => { cardRefs.current[meal] = el; }} className="bg-white rounded-2xl p-4 shadow-md border border-black/[0.08]" style={{ position: 'relative' }}>
                    {exportingMeal !== meal && (
                      <button
                        onClick={() => exportCard(meal, label)}
                        style={{
                          position: 'absolute', top: '10px', right: '10px',
                          width: '28px', height: '28px', borderRadius: '8px',
                          background: '#f3f4f6', border: '1px solid #e5e7eb',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', zIndex: 1,
                        }}
                      >
                        <Download style={{ width: '13px', height: '13px', color: '#6b7280' }} />
                      </button>
                    )}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">{emoji}</span>
                      <p className="text-sm font-semibold text-forest m-0">{label}</p>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {mealMacros.map(({ key, label: ml, unit, Icon, bg, color, value }) => (
                        <div key={key} className="flex flex-col items-center text-center gap-1">
                          <div className={`w-9 h-9 rounded-full ${bg} flex items-center justify-center`}>
                            <Icon className={`w-4 h-4 ${color}`} />
                          </div>
                          <span className="text-[10px] text-gray-400 leading-tight">{ml}</span>
                          <span className="text-xs font-bold text-gray-800">{value}<span className="text-[10px] font-normal text-gray-400">{unit}</span></span>
                        </div>
                      ))}
                    </div>
                    <p style={{ fontSize: '10px', color: '#16a34a', textAlign: 'right', marginTop: '10px', marginBottom: 0 }}>NutriCoach</p>
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

            {/* Share button — iOS style */}
            {typeof navigator.share === "function" && (
              <button onClick={handleNativeShare}
                className="w-full mt-4 bg-green-600 border-none rounded-[14px] py-[13px] flex items-center justify-center gap-2 cursor-pointer font-[inherit]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="8 7 12 3 16 7"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                  <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-2"/>
                </svg>
                <span className="text-sm font-medium text-white">Share</span>
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}