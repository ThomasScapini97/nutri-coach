import { useState, useMemo, useRef, useEffect } from "react";
import html2canvas from 'html2canvas';
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { recalculateTotals, FIBER_GOAL } from "@/lib/nutritionUtils";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight, Flame, TrendingUp, Share2, Wheat, Drumstick, Droplets, Salad, Download, Plus, X, Send } from "lucide-react";
import AnimatedProgressBar from "../components/summary/AnimatedProgressBar";
import FoodEntryItem from "../components/summary/FoodEntryItem";
import ScrollableChart from "../components/summary/ScrollableChart";
import { motion, AnimatePresence } from "framer-motion";
import buildSystemPrompt from "@/lib/buildSystemPrompt";
import ReactMarkdown from 'react-markdown';

export default function Summary() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { t } = useTranslation();
  const [showShare, setShowShare] = useState(false);
  const [exportingMeal, setExportingMeal] = useState(null);
  const [isExportingProgress, setIsExportingProgress] = useState(false);
  const cardRefs = useRef({});
  const progressCardRef = useRef(null);
  const pastChatEndRef = useRef(null);
  const sheetRef = useRef(null);
  const [showPastChat, setShowPastChat] = useState(false);
  const [pastChatMessages, setPastChatMessages] = useState([]);
  const [pastChatInput, setPastChatInput] = useState("");
  const [pastChatLoading, setPastChatLoading] = useState(false);
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
  const isPast = !isToday;
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

  const buildCardBlob = async (meal) => {
    const cardEl = cardRefs.current[meal];
    if (!cardEl) return null;
    const raw = await html2canvas(cardEl, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      logging: false,
    });
    const radius = 16 * 2;
    const w = raw.width;
    const h = raw.height;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(w - radius, 0);
    ctx.quadraticCurveTo(w, 0, w, radius);
    ctx.lineTo(w, h - radius);
    ctx.quadraticCurveTo(w, h, w - radius, h);
    ctx.lineTo(radius, h);
    ctx.quadraticCurveTo(0, h, 0, h - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(raw, 0, 0);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  };

  const shareCard = async (meal, mealLabel) => {
    setExportingMeal(meal);
    await new Promise(r => setTimeout(r, 60));
    try {
      const blob = await buildCardBlob(meal);
      if (!blob) return;
      const file = new File([blob], `nutricoach-${meal}.png`, { type: 'image/png' });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: `My ${mealLabel} — NutriCoach`, files: [file] });
        toast.success('Shared! 🎉');
      } else {
        toast.error('Sharing not supported on this device');
      }
    } catch (err) {
      if (err?.name !== 'AbortError') console.error('Share failed:', err);
    }
    setExportingMeal(null);
  };

  const saveCard = async (meal) => {
    setExportingMeal(meal);
    await new Promise(r => setTimeout(r, 60));
    try {
      const blob = await buildCardBlob(meal);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nutricoach-${meal}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Saved! 📸');
    } catch (err) {
      console.error('Save failed:', err);
    }
    setExportingMeal(null);
  };

  const buildProgressBlob = async () => {
    const cardEl = progressCardRef.current;
    if (!cardEl) return null;
    const raw = await html2canvas(cardEl, { backgroundColor: null, scale: 2, useCORS: true, logging: false });
    const radius = 20 * 2;
    const w = raw.width, h = raw.height;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(radius, 0); ctx.lineTo(w - radius, 0); ctx.quadraticCurveTo(w, 0, w, radius);
    ctx.lineTo(w, h - radius); ctx.quadraticCurveTo(w, h, w - radius, h);
    ctx.lineTo(radius, h); ctx.quadraticCurveTo(0, h, 0, h - radius);
    ctx.lineTo(0, radius); ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath(); ctx.clip(); ctx.drawImage(raw, 0, 0);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  };

  const shareProgressCard = async () => {
    setIsExportingProgress(true);
    await new Promise(r => setTimeout(r, 60));
    try {
      const blob = await buildProgressBlob();
      if (!blob) return;
      const file = new File([blob], 'nutricoach-progress.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: "My Daily Progress — NutriCoach", files: [file] });
        toast.success('Shared! 🎉');
      } else {
        toast.error('Sharing not supported on this device');
      }
    } catch (err) {
      if (err?.name !== 'AbortError') console.error('Share failed:', err);
    }
    setIsExportingProgress(false);
  };

  const saveProgressCard = async () => {
    setIsExportingProgress(true);
    await new Promise(r => setTimeout(r, 60));
    try {
      const blob = await buildProgressBlob();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'nutricoach-progress.png'; a.click();
      URL.revokeObjectURL(url);
      toast.success('Saved! 📸');
    } catch (err) {
      console.error('Save failed:', err);
    }
    setIsExportingProgress(false);
  };

  useEffect(() => {
    setPastChatMessages([]);
    setShowPastChat(false);
  }, [dateStr]);

  useEffect(() => {
    if (showPastChat) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [showPastChat]);

  useEffect(() => {
    if (!showPastChat) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const sheetEl = sheetRef.current;
    if (!sheetEl) return;
    const update = () => {
      const offsetY = window.innerHeight - vv.height - vv.offsetTop;
      sheetEl.style.transform = `translateY(-${Math.max(offsetY, 0)}px)`;
    };
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      if (sheetEl) sheetEl.style.transform = '';
    };
  }, [showPastChat]);

  useEffect(() => {
    pastChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [pastChatMessages, pastChatLoading]);

  const handlePastChatSend = async () => {
    const text = pastChatInput.trim();
    if (!text || pastChatLoading) return;
    setPastChatInput("");
    const userMsg = { role: "user", content: text, id: crypto.randomUUID() };
    setPastChatMessages(prev => [...prev, userMsg]);
    setPastChatLoading(true);
    try {
      const pastDaySystemPrompt = buildSystemPrompt(
        profile,
        dayLog,
        dayEntries || [],
        [],
        format(selectedDate, 'EEEE, MMMM d, yyyy')
      );

      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          system: pastDaySystemPrompt,
          messages: [{ role: "user", content: text }],
        }),
      });
      const data = await response.json();
      const rawText = data.content?.[0]?.text || '{"message":"Sorry, could not process.","foods":[]}';
      let result;
      try {
        const cleaned = rawText.replace(/```json|```/g, "").trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        result = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        if (!result?.message) throw new Error("Invalid");
      } catch {
        result = { message: rawText, foods: [] };
      }
      setPastChatMessages(prev => [...prev, { role: "assistant", content: result.message, id: crypto.randomUUID() }]);
      const foods = Array.isArray(result.foods) ? result.foods : [];
      if (foods.length > 0) {
        let logId = dayLog?.id;
        if (!logId) {
          const { data: created, error: insertError } = await supabase.from('food_logs').insert({
            date: dateStr, user_id: user.id,
            total_calories: 0, total_carbs: 0, total_protein: 0, total_fats: 0, total_fiber: 0, total_burned_calories: 0,
          }).select().single();
          if (insertError) {
            const { data: existing } = await supabase.from('food_logs').select('id').eq('date', dateStr).eq('user_id', user.id).maybeSingle();
            logId = existing?.id;
          } else {
            logId = created?.id;
          }
        }
        if (logId) {
          await supabase.from('food_entries').insert(
            foods.map(food => ({
              foodlog_id: logId,
              food_name: food.food_name,
              food_key: food.food_name.toLowerCase().trim().replace(/\s+/g, '_'),
              meal_type: food.meal_type,
              grams: food.grams || null,
              calories: food.calories || 0,
              carbs: food.carbs || 0,
              protein: food.protein || 0,
              fats: food.fats || 0,
              fiber: food.fiber || 0,
              timestamp: new Date().toISOString(),
            }))
          );
          await recalculateTotals(logId);
          queryClient.invalidateQueries({ queryKey: ["foodEntries", logId] });
          queryClient.invalidateQueries({ queryKey: ["foodlog", dateStr, user?.id] });
          queryClient.invalidateQueries({ queryKey: ["foodlog"] });
          toast.success(`Added to ${format(selectedDate, 'MMM d')} ✅`);
        }
      }
    } catch (err) {
      console.error("Past chat error:", err);
      setPastChatMessages(prev => [...prev, { role: "assistant", content: "Sorry, something went wrong.", id: crypto.randomUUID() }]);
    } finally {
      setPastChatLoading(false);
    }
  };

  const handleNativeShare = async () => {
    const dateLabel = isToday ? "Today" : format(selectedDate, "EEEE, d MMM");
    try {
      await navigator.share({ title: `NutriCoach — ${dateLabel}`, text: `${netCalories} kcal logged on NutriCoach` });
    } catch { /* cancelled */ }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-mint">

      {/* Date navigator */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center bg-white border-b border-gray-200 shadow-[0_1px_4px_rgba(0,0,0,0.06)] px-4 py-[14px]" style={{ paddingTop: 'calc(14px + env(safe-area-inset-top, 0px))' }}>
        <button onClick={() => navigateDay(-1)} className="absolute left-[56px] bg-transparent border-none flex items-center justify-center cursor-pointer p-1">
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className="text-center">
          <h2 className="text-base font-semibold text-forest leading-[1.2] m-0">
            {isToday ? t("summary.today") : format(selectedDate, "EEEE, MMM d")}
          </h2>
          <p className="text-[11px] m-0 text-gray-400">
            {dayLog ? `${netCalories} kcal logged` : t("summary.noMealsLogged")}
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

      <div className="flex-1 overflow-y-auto pt-top-bar md:pt-0" style={{ paddingBottom: 'calc(200px + env(safe-area-inset-bottom))' }}>
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
                  {burnedCalories > 0 ? t("summary.netCalories") : t("summary.caloriesToday")}
                </p>
                <p className="text-[42px] font-medium leading-none tracking-[-1px]">
                  {netCalories.toLocaleString()}
                </p>
                <p className="text-[11px] text-white/65 mt-[2px]">
                  {t("summary.kcalGoal", { value: calorieGoal.toLocaleString() })}
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
                {caloriesRemaining > 0 ? t("summary.kcalRemaining", { value: caloriesRemaining }) : t("summary.goalReached")}
              </p>
              {burnedCalories > 0 && (
                <div className="flex gap-[6px]">
                  <span className="text-[10px] bg-white/15 text-white/90 px-2 py-[2px] rounded-full">🍽 {caloriesConsumed} {t("summary.eaten")}</span>
                  <span className="text-[10px] bg-white/15 text-white/90 px-2 py-[2px] rounded-full">🏃 {burnedCalories} {t("summary.burned")}</span>
                </div>
              )}
            </div>
          </motion.div>

          {/* Macro grid 2x2 */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="flex items-center gap-[6px] mb-[10px] px-[2px]">
              <span className="text-[13px] font-medium text-forest">{t("summary.nutrition")}</span>
            </div>
            <div style={{ background: "white", borderRadius: "16px", border: "0.5px solid rgba(0,0,0,0.06)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", padding: "12px 14px" }}>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <AnimatedProgressBar label={t("dashboard.carbs")} value={dayLog?.total_carbs || 0} max={carbsGoal} unit="g" color="chart-3" />
                <AnimatedProgressBar label={t("dashboard.protein")} value={dayLog?.total_protein || 0} max={proteinGoal} unit="g" color="chart-4" />
                <AnimatedProgressBar label={t("dashboard.fats")} value={dayLog?.total_fats || 0} max={fatsGoal} unit="g" color="blue-500" />
                <AnimatedProgressBar label={t("dashboard.fiber")} value={dayLog?.total_fiber || 0} max={fiberGoal} unit="g" color="primary" />
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
              <span className="text-[13px] font-medium text-forest">{t("summary.whatYouAte")}</span>
              {dayEntries?.length > 0 && (
                <span className="text-[11px] text-gray-400">{t("summary.items", { count: dayEntries.length })}</span>
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
                  <p className="text-[13px] text-gray-400 mb-1">{t("summary.noFoodLogged")}</p>
                  <p className="text-xs text-gray-400">{t("summary.headToChat")}</p>
                </div>
              )}
            </div>
          </motion.div>

        </div>
      </div>

      {/* Trend chart — fixed above navbar */}
      <div style={{
        position: 'fixed',
        bottom: 'calc(56px + env(safe-area-inset-bottom))',
        left: 0,
        right: 0,
        zIndex: 30,
        padding: '0 16px 8px',
        background: '#f0fcf3',
      }}>
        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: '10px 16px',
          border: '0.5px solid rgba(0,0,0,0.06)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        }}>
          <div className="flex items-center justify-between mb-[10px]">
            <div className="flex items-center gap-[6px]">
              <TrendingUp className="w-[14px] h-[14px] text-green-600" />
              <span className="text-[13px] font-medium text-forest">{t("summary.trend")}</span>
            </div>
            <div className="flex gap-2">
              {[
                { color: "#16a34a", label: t("summary.onTrack") },
                { color: "#f59e0b", label: t("summary.close") },
                { color: "#ef4444", label: t("summary.offTrack") },
                { color: "#e5e7eb", label: t("summary.noData") },
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

      {/* Floating + button for past days */}
      {isPast && (
        <button
          onClick={() => setShowPastChat(true)}
          style={{
            position: 'fixed',
            bottom: 'calc(200px + env(safe-area-inset-bottom))',
            right: '20px',
            zIndex: 35,
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: '#16a34a',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(22,163,74,0.4)',
          }}
        >
          <Plus style={{ width: '22px', height: '22px', color: 'white' }} />
        </button>
      )}

      {/* Past day mini chat bottom sheet */}
      <AnimatePresence>
        {showPastChat && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 60 }}
              onClick={() => setShowPastChat(false)}
            />
            <motion.div
              ref={sheetRef}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 61,
                background: 'white',
                borderRadius: '24px 24px 0 0',
                height: '75vh',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Header */}
              <div style={{ padding: '16px 16px 10px', borderBottom: '0.5px solid rgba(0,0,0,0.06)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '15px', color: '#15803d' }}>
                      Add food to {format(selectedDate, 'MMM d')}
                    </p>
                    <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                      Tell me what you ate on this day
                    </p>
                  </div>
                  <button
                    onClick={() => setShowPastChat(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#9ca3af' }}
                  >
                    <X style={{ width: '20px', height: '20px' }} />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {pastChatMessages.length === 0 && (
                  <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '13px', marginTop: '24px' }}>
                    What did you eat? 🍽
                  </p>
                )}
                {pastChatMessages.map(msg => (
                  <div
                    key={msg.id}
                    style={{
                      alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '80%',
                      background: msg.role === 'user' ? '#16a34a' : '#f3f4f6',
                      color: msg.role === 'user' ? 'white' : '#111827',
                      borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      padding: '10px 14px',
                      fontSize: '14px',
                      lineHeight: '1.4',
                    }}
                  >
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : msg.content}
                  </div>
                ))}
                {pastChatLoading && (
                  <div style={{ alignSelf: 'flex-start', background: '#f3f4f6', borderRadius: '18px 18px 18px 4px', padding: '10px 14px' }}>
                    <span style={{ color: '#9ca3af', fontSize: '14px' }}>...</span>
                  </div>
                )}
                <div ref={pastChatEndRef} />
              </div>

              {/* Input bar */}
              <div style={{ padding: '10px 12px', borderTop: '0.5px solid rgba(0,0,0,0.06)', display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0, paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}>
                <input
                  type="text"
                  value={pastChatInput}
                  onChange={e => setPastChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handlePastChatSend(); }}
                  placeholder="e.g. pasta al pomodoro 200g"
                  style={{
                    flex: 1,
                    border: '1px solid #e5e7eb',
                    borderRadius: '9999px',
                    padding: '10px 16px',
                    fontSize: '14px',
                    outline: 'none',
                    background: '#f9fafb',
                  }}
                />
                <button
                  onClick={handlePastChatSend}
                  disabled={!pastChatInput.trim() || pastChatLoading}
                  style={{
                    width: '38px', height: '38px', borderRadius: '50%',
                    background: pastChatInput.trim() && !pastChatLoading ? '#16a34a' : '#e5e7eb',
                    border: 'none', cursor: pastChatInput.trim() && !pastChatLoading ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    transition: 'background 0.15s',
                  }}
                >
                  <Send style={{ width: '16px', height: '16px', color: pastChatInput.trim() && !pastChatLoading ? 'white' : '#9ca3af' }} />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
                  <p className="text-[11px] text-gray-400 m-0">{isToday ? t("summary.today") : format(selectedDate, "EEEE, d MMM yyyy")}</p>
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
                  { label: t("dashboard.protein"), value: Math.round(dayLog?.total_protein || 0), color: "#ec4899" },
                  { label: t("dashboard.carbs"),   value: Math.round(dayLog?.total_carbs   || 0), color: "#f59e0b" },
                  { label: t("dashboard.fats"),    value: Math.round(dayLog?.total_fats    || 0), color: "#3b82f6" },
                  { label: t("dashboard.fiber"),   value: Math.round(dayLog?.total_fiber   || 0), color: "#22c55e" },
                ].map(m => (
                  <div key={m.label} className="bg-white rounded-[12px] py-2 text-center">
                    <p className="text-[10px] text-gray-400 m-0">{m.label}</p>
                    <p className="text-sm font-bold m-0" style={{ color: m.color }}>{m.value}g</p>
                  </div>
                ))}
              </div>

              {/* Today's Progress card */}
              <div ref={progressCardRef} className="bg-white rounded-2xl p-4 shadow-md border border-black/[0.08]" style={{ position: 'relative' }}>
                {!isExportingProgress && (
                  <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '6px', zIndex: 1 }}>
                    {navigator.share && (
                      <button onClick={shareProgressCard} style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#f3f4f6', border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <Share2 style={{ width: '13px', height: '13px', color: '#6b7280' }} />
                      </button>
                    )}
                    <button onClick={saveProgressCard} style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#f3f4f6', border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <Download style={{ width: '13px', height: '13px', color: '#6b7280' }} />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">🔥</span>
                  <p className="text-sm font-semibold text-forest m-0">Today's Progress</p>
                </div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span style={{ fontSize: '28px', fontWeight: 700, color: '#15803d', lineHeight: 1 }}>{netCalories}</span>
                  <span style={{ fontSize: '12px', color: '#9ca3af' }}>/ {calorieGoal} kcal</span>
                </div>
                <div style={{ background: '#e5e7eb', borderRadius: '9999px', height: '5px', overflow: 'hidden', marginBottom: '12px' }}>
                  <div style={{ width: `${caloriePercentage}%`, background: '#16a34a', height: '100%', borderRadius: '9999px' }} />
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Protein', value: Math.round(dayLog?.total_protein || 0), color: '#ec4899' },
                    { label: 'Carbs',   value: Math.round(dayLog?.total_carbs   || 0), color: '#f59e0b' },
                    { label: 'Fats',    value: Math.round(dayLog?.total_fats    || 0), color: '#3b82f6' },
                    { label: 'Fiber',   value: Math.round(dayLog?.total_fiber   || 0), color: '#22c55e' },
                  ].map(m => (
                    <div key={m.label} className="bg-gray-50 rounded-[10px] py-2 text-center">
                      <p className="text-[10px] text-gray-400 m-0">{m.label}</p>
                      <p className="text-sm font-bold m-0" style={{ color: m.color }}>{m.value}g</p>
                    </div>
                  ))}
                </div>
                {burnedCalories > 0 && (
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '10px', marginBottom: 0 }}>🏃 {burnedCalories} kcal burned</p>
                )}
                {(dayLog?.water_glasses || 0) > 0 && (
                  <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '6px', marginBottom: 0 }}>💧 {dayLog.water_glasses}/8 glasses</p>
                )}
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#16a34a', letterSpacing: '0.2px', textAlign: 'right', marginTop: '12px', marginBottom: 0 }}>@nutricoach.app</p>
              </div>

              {/* Per-meal cards — same style as NutritionCard in chat */}
              {["breakfast", "lunch", "dinner", "snack"].map(meal => {
                const entries = groupedEntries.filter(e => e.meal_type === meal);
                if (!entries.length) return null;
                const { emoji, label } = MEAL_META[meal];
                const mealMacros = [
                  { key: "calories", label: t("common.kcal"),           unit: "kcal", Icon: Flame,     bg: "bg-orange-100",  color: "text-orange-500", value: Math.round(entries.reduce((s, e) => s + e.total_calories, 0)) },
                  { key: "carbs",    label: t("dashboard.carbs"),       unit: "g",    Icon: Wheat,     bg: "bg-amber-100",   color: "text-amber-400",  value: Math.round(entries.reduce((s, e) => s + e.total_carbs,    0)) },
                  { key: "protein",  label: t("dashboard.protein"),     unit: "g",    Icon: Drumstick, bg: "bg-red-100",     color: "text-red-400",    value: Math.round(entries.reduce((s, e) => s + e.total_protein,  0)) },
                  { key: "fats",     label: t("dashboard.fats"),        unit: "g",    Icon: Droplets,  bg: "bg-blue-100",    color: "text-blue-500",   value: Math.round(entries.reduce((s, e) => s + e.total_fats,     0)) },
                  { key: "fiber",    label: t("dashboard.fiber"),       unit: "g",    Icon: Salad,     bg: "bg-emerald-100", color: "text-emerald-500", value: Math.round(entries.reduce((s, e) => s + e.total_fiber,    0)) },
                ];
                return (
                  <div key={meal} ref={el => { cardRefs.current[meal] = el; }} className="bg-white rounded-2xl p-4 shadow-md border border-black/[0.08]" style={{ position: 'relative' }}>
                    {exportingMeal !== meal && (
                      <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '6px', zIndex: 1 }}>
                        {navigator.share && (
                          <button
                            onClick={() => shareCard(meal, label)}
                            style={{
                              width: '28px', height: '28px', borderRadius: '8px',
                              background: '#f3f4f6', border: '1px solid #e5e7eb',
                              boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer',
                            }}
                          >
                            <Share2 style={{ width: '13px', height: '13px', color: '#6b7280' }} />
                          </button>
                        )}
                        <button
                          onClick={() => saveCard(meal)}
                          style={{
                            width: '28px', height: '28px', borderRadius: '8px',
                            background: '#f3f4f6', border: '1px solid #e5e7eb',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <Download style={{ width: '13px', height: '13px', color: '#6b7280' }} />
                        </button>
                      </div>
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
                    <p style={{ fontSize: '11px', fontWeight: 600, color: '#16a34a', letterSpacing: '0.2px', textAlign: 'right', marginTop: '12px', marginBottom: 0 }}>@nutricoach.app</p>
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