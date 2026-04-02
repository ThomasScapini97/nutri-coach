import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Plus, X, Clock, Trash2, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import ScrollableExerciseChart from "../components/summary/ScrollableExerciseChart";

const getToday = () => format(new Date(), "yyyy-MM-dd");

const EXERCISES = [
  { name: "Running", emoji: "🏃", met: 9.8 },
  { name: "Walking", emoji: "🚶", met: 3.5 },
  { name: "Cycling", emoji: "🚴", met: 7.5 },
  { name: "Swimming", emoji: "🏊", met: 8.0 },
  { name: "Weight Training", emoji: "🏋️", met: 5.0 },
  { name: "Yoga", emoji: "🧘", met: 2.5 },
  { name: "HIIT", emoji: "⚡", met: 10.0 },
  { name: "Football", emoji: "⚽", met: 7.0 },
  { name: "Basketball", emoji: "🏀", met: 6.5 },
  { name: "Tennis", emoji: "🎾", met: 7.0 },
  { name: "Dancing", emoji: "💃", met: 5.0 },
  { name: "Hiking", emoji: "🥾", met: 6.0 },
  { name: "Jump Rope", emoji: "🪃", met: 11.0 },
  { name: "Rowing", emoji: "🚣", met: 7.0 },
  { name: "Pilates", emoji: "🤸", met: 3.0 },
  { name: "Other", emoji: "💪", met: 5.0 },
];

function calculateCalories(met, weightKg, minutes) {
  return Math.round(met * weightKg * (minutes / 60));
}

export default function Exercise() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const isToday = dateStr === getToday();
  const isPast = !isToday;
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [minutes, setMinutes] = useState("30");
  const [saving, setSaving] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["userProfile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_profiles").select("*").eq("user_id", user.id).single();
      return data;
    },
    enabled: !!user?.id,
  });

  const weight = profile?.weight || 70;
  const activeDaysGoal = profile?.active_days_goal || 3;
  const burnGoal = profile?.burn_goal || 300;

  const { data: dayLog } = useQuery({
    queryKey: ["foodlog", dateStr, user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("food_logs").select("*").eq("date", dateStr).eq("user_id", user.id);
      return data?.[0] || null;
    },
    enabled: !!user?.id,
  });

  const { data: dayExercises } = useQuery({
    queryKey: ["exercises", dateStr, user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("exercise_logs").select("*").eq("user_id", user.id).eq("date", dateStr).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user?.id,
    initialData: [],
  });

  const { data: weekExercises } = useQuery({
    queryKey: ["exercises-week", user?.id],
    queryFn: async () => {
      const from = format(subDays(new Date(), 6), "yyyy-MM-dd");
      const { data } = await supabase.from("exercise_logs").select("date, calories_burned").eq("user_id", user.id).gte("date", from).lte("date", getToday());
      return data || [];
    },
    enabled: !!user?.id,
    initialData: [],
  });

  const totalBurnedToday = dayLog?.total_burned_calories || 0;
  const totalMinutesToday = dayExercises.reduce((sum, e) => sum + e.duration_minutes, 0);
  const activeDaysThisWeek = new Set(weekExercises.map(e => e.date)).size;
  const kcalPerMin = totalMinutesToday > 0 ? (totalBurnedToday / totalMinutesToday).toFixed(1) : "—";
  const previewCalories = selectedExercise && minutes ? calculateCalories(selectedExercise.met, weight, Number(minutes)) : 0;

  const navigateDay = (dir) => {
    setSelectedDate(prev => {
      const next = new Date(prev);
      next.setDate(next.getDate() + dir);
      return next;
    });
  };

  const handleSave = async () => {
    if (!selectedExercise || !minutes || Number(minutes) <= 0 || isPast) return;
    setSaving(true);
    try {
      const calories = calculateCalories(selectedExercise.met, weight, Number(minutes));
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      let logId = dayLog?.id;
      if (!logId) {
        const { data: created } = await supabase.from("food_logs").insert({
          date: getToday(), user_id: currentUser.id,
          total_calories: 0, total_carbs: 0, total_protein: 0,
          total_fats: 0, total_fiber: 0, total_burned_calories: 0,
        }).select().single();
        logId = created?.id;
      }
      await supabase.from("exercise_logs").insert({
        user_id: currentUser.id, foodlog_id: logId, date: getToday(),
        exercise_name: selectedExercise.name,
        duration_minutes: Number(minutes),
        calories_burned: calories,
      });
      const newTotal = (dayLog?.total_burned_calories || 0) + calories;
      await supabase.from("food_logs").update({ total_burned_calories: newTotal }).eq("id", logId);
      await supabase.from("messages").insert({
        foodlog_id: logId,
        role: "system",
        content: `${selectedExercise.emoji} **${selectedExercise.name}** aggiunto: ${Number(minutes)} min · ${calories} kcal bruciati`,
        timestamp: new Date().toISOString(),
      });
      queryClient.invalidateQueries({ queryKey: ["exercises", dateStr] });
      queryClient.invalidateQueries({ queryKey: ["exercises-week"] });
      queryClient.invalidateQueries({ queryKey: ["foodlog"] });
      queryClient.invalidateQueries({ queryKey: ["messages", logId] });
      toast.success(`${selectedExercise.emoji} ${selectedExercise.name} logged! 🔥`, { description: `${calories} kcal burned` });
      setShowAddSheet(false);
      setSelectedExercise(null);
      setMinutes("30");
    } catch (err) {
      toast.error("Something went wrong. Please try again.");
    }
    setSaving(false);
  };

  const handleDelete = async (exercise) => {
    if (isPast) return;
    try {
      const { error } = await supabase.from("exercise_logs").delete().eq("id", exercise.id);
      if (error) throw error;
      const newTotal = Math.max(0, totalBurnedToday - exercise.calories_burned);
      if (dayLog?.id) {
        await supabase.from("food_logs").update({ total_burned_calories: newTotal }).eq("id", dayLog.id);
        await supabase.from("messages").insert({
          foodlog_id: dayLog.id,
          role: "system",
          content: `🗑️ **${exercise.exercise_name}** rimosso (${exercise.calories_burned} kcal)`,
          timestamp: new Date().toISOString(),
        });
        queryClient.invalidateQueries({ queryKey: ["messages", dayLog.id] });
      }
      queryClient.invalidateQueries({ queryKey: ["exercises", dateStr] });
      queryClient.invalidateQueries({ queryKey: ["exercises-week"] });
      queryClient.invalidateQueries({ queryKey: ["foodlog"] });
      toast.success("Exercise removed");
    } catch {
      toast.error("Failed to remove exercise. Please try again.");
    }
  };

  return (
    <div className="flex flex-col overflow-hidden h-[100dvh] bg-mint">

      {/* Date navigator */}
      <div className="flex items-center justify-center bg-white border-b border-gray-200 shadow-[0_1px_4px_rgba(0,0,0,0.06)] px-6 py-[14px] relative shrink-0">
        <button onClick={() => navigateDay(-1)} className="absolute left-[60px] bg-transparent border-none flex items-center justify-center cursor-pointer p-0">
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className="text-center">
          <h2 className="text-base font-semibold text-forest leading-[1.2] m-0">
            {isToday ? "Today" : format(selectedDate, "MMM d, yyyy")}
          </h2>
          <p className="text-[11px] text-gray-400 m-0">
            {isToday ? `${totalBurnedToday} kcal burned today` : isPast ? "Past day — read only" : ""}
          </p>
        </div>
        <button onClick={() => navigateDay(1)} disabled={isToday} className={`absolute right-4 bg-transparent border-none flex items-center justify-center p-0 ${isToday ? "opacity-30 cursor-default" : "cursor-pointer"}`}>
          <ChevronRight className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto pb-2">
        <div className="max-w-[480px] mx-auto p-4 flex flex-col gap-[10px]">

          {/* Hero card */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[20px] p-[18px] text-white relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)" }}
          >
            <div className="absolute -top-[30px] -right-[30px] w-[120px] h-[120px] rounded-full bg-white/[0.07]" />
            <div className="absolute -bottom-[20px] right-[30px] w-[80px] h-[80px] rounded-full bg-white/[0.05]" />
            <div className="flex justify-between items-start relative">
              <div>
                <p className="text-[11px] text-white/75 mb-[2px] m-0">Burned today</p>
                <p className="text-[42px] font-medium leading-none tracking-[-1px] m-0">{totalBurnedToday.toLocaleString()}</p>
                <p className="text-[11px] text-white/65 mt-[2px] m-0">of {burnGoal} kcal goal</p>
              </div>
              <div className="w-11 h-11 rounded-[14px] bg-white/[0.18] flex items-center justify-center">
                <Flame className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="bg-white/20 rounded-full h-[6px] overflow-hidden my-3 relative">
              <div className="bg-white h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.min((totalBurnedToday / burnGoal) * 100, 100)}%` }} />
            </div>
            {dayExercises.length > 0 && (
              <div className="flex gap-[6px] flex-wrap relative">
                {dayExercises.map((e, i) => (
                  <span key={i} className="text-[10px] bg-white/[0.15] text-white/90 px-2 py-[2px] rounded-full">
                    {EXERCISES.find(ex => ex.name === e.exercise_name)?.emoji || "💪"} {e.exercise_name} · {e.duration_minutes}min
                  </span>
                ))}
              </div>
            )}
          </motion.div>

          {/* Active days card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.03 }}
            className="rounded-[14px] px-[14px] py-[10px] flex items-center justify-between border"
            style={{
              background: activeDaysThisWeek >= activeDaysGoal ? "#dcfce7" : "white",
              borderColor: activeDaysThisWeek >= activeDaysGoal ? "#bbf7d0" : "rgba(0,0,0,0.06)",
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-[20px]">{activeDaysThisWeek >= activeDaysGoal ? "🎉" : "🎯"}</span>
              <div>
                <p className="text-[13px] font-medium text-forest m-0">
                  {activeDaysThisWeek >= activeDaysGoal ? "Weekly goal reached!" : "Weekly activity goal"}
                </p>
                <p className="text-[11px] text-gray-400 m-0">
                  {activeDaysThisWeek}/{activeDaysGoal} active days · {burnGoal} kcal target/day
                </p>
              </div>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: activeDaysGoal }).map((_, i) => (
                <div key={i} className={`w-2 h-2 rounded-full ${i < activeDaysThisWeek ? "bg-green-600" : "bg-gray-200"}`} />
              ))}
            </div>
          </motion.div>

          {/* Stats grid */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <div className="grid grid-cols-2 gap-2">
              {[
                { emoji: "⏱️", value: `${totalMinutesToday}`, label: "Total minutes" },
                { emoji: "💪", value: `${dayExercises.length}`, label: "Exercises done" },
                { emoji: "⚡", value: `${kcalPerMin}`, label: "kcal / min avg" },
                { emoji: "📅", value: `${activeDaysThisWeek}/${activeDaysGoal}`, label: "Active days this week" },
              ].map((s, i) => (
                <div key={i} className="bg-white rounded-[14px] p-3 border border-black/[0.06]">
                  <div className="text-[20px] mb-[6px]">{s.emoji}</div>
                  <div className="text-[20px] font-medium text-forest leading-none">{s.value}</div>
                  <div className="text-[10px] text-gray-400 mt-[3px]">{s.label}</div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Log exercise button */}
          {!isPast && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              onClick={() => setShowAddSheet(true)}
              className="w-full bg-red-600 text-white border-none rounded-[14px] py-[13px] text-[14px] font-medium cursor-pointer font-[inherit] flex items-center justify-center gap-2"
            >
              <Plus className="w-[18px] h-[18px]" />
              Log exercise
            </motion.button>
          )}

          {/* Exercise list */}
          {dayExercises.length > 0 ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className={isPast ? "opacity-70" : ""}
            >
              <p className="text-[13px] font-medium text-forest mb-2 px-[2px] m-0">
                🏃 {isToday ? "Today's exercises" : "Exercises logged"}
              </p>
              <div className="flex flex-col gap-[6px]">
                {dayExercises.map((exercise) => {
                  const ex = EXERCISES.find(e => e.name === exercise.exercise_name);
                  return (
                    <motion.div key={exercise.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-[10px] bg-white rounded-[14px] px-3 py-[10px] border border-black/[0.06]"
                    >
                      <span className="text-[22px] shrink-0">{ex?.emoji || "💪"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-forest m-0">{exercise.exercise_name}</p>
                        <div className="flex items-center gap-1 mt-[2px]">
                          <Clock className="w-[10px] h-[10px] text-gray-400" />
                          <span className="text-[11px] text-gray-400">{exercise.duration_minutes} min</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="bg-red-50 rounded-full py-[3px] px-2 flex items-center gap-[3px]">
                          <Flame className="w-3 h-3 text-red-600" />
                          <span className="text-xs font-semibold text-red-600">{exercise.calories_burned}</span>
                        </div>
                        {!isPast && (
                          <button onClick={() => handleDelete(exercise)} className="w-[26px] h-[26px] rounded-full bg-gray-50 border border-gray-200 cursor-pointer flex items-center justify-center p-0">
                            <Trash2 className="w-3 h-3 text-gray-400" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          ) : (
            <div className="text-center p-6 bg-white rounded-2xl border border-black/[0.06]">
              <p className="text-[32px] mb-2">🏃</p>
              <p className="text-[13px] font-medium text-forest mb-1 m-0">
                {isPast ? "No exercises logged this day" : "No exercises logged yet"}
              </p>
              <p className="text-xs text-gray-400 m-0">
                {isPast ? "" : "Tap \"Log exercise\" to get started!"}
              </p>
            </div>
          )}

        </div>
      </div>

      {/* Bottom chart */}
      <div className="bg-mint px-4 pb-[90px] shrink-0">
        <div className="bg-white rounded-[20px] p-[10px_16px] border border-black/[0.06] shadow-[0_2px_12px_rgba(0,0,0,0.06)] max-w-[480px] mx-auto">
          <div className="flex items-center justify-between mb-[10px]">
            <div className="flex items-center gap-[6px]">
              <TrendingUp className="w-[14px] h-[14px] text-red-600" />
              <span className="text-[13px] font-medium text-forest">Weekly burned</span>
            </div>
            <div className="flex gap-2">
              {[
                { color: "#16a34a", label: "On track" },
                { color: "#f59e0b", label: "Close" },
                { color: "#ef4444", label: "Off track" },
                { color: "#e5e7eb", label: "Rest" },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-[3px]">
                  <div className="w-[6px] h-[6px] rounded-[2px] shrink-0" style={{ background: color }} />
                  <span className="text-[9px] text-gray-400">{label}</span>
                </div>
              ))}
            </div>
          </div>
          <ScrollableExerciseChart burnGoal={burnGoal} />
        </div>
      </div>

      {/* Add exercise sheet */}
      <AnimatePresence>
        {showAddSheet && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/50 flex items-end justify-center"
            onClick={() => setShowAddSheet(false)}
          >
            <motion.div
              initial={{ y: 400 }} animate={{ y: 0 }} exit={{ y: 400 }}
              transition={{ type: "spring", damping: 25 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-[24px_24px_0_0] p-5 w-full max-w-[480px] max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[15px] font-medium text-forest m-0">Log exercise</p>
                  <p className="text-[11px] text-gray-400 m-0">Based on your weight: {weight}kg</p>
                </div>
                <button onClick={() => setShowAddSheet(false)} className="bg-gray-100 border-none rounded-full w-7 h-7 cursor-pointer flex items-center justify-center p-0">
                  <X className="w-[14px] h-[14px] text-gray-500" />
                </button>
              </div>

              <p className="text-[11px] text-gray-400 mb-2 uppercase tracking-[0.3px] m-0">Choose exercise</p>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {EXERCISES.map((ex) => (
                  <button key={ex.name} onClick={() => setSelectedExercise(ex)}
                    className="flex flex-col items-center gap-1 py-[10px] px-1 rounded-xl cursor-pointer font-[inherit]"
                    style={{
                      border: selectedExercise?.name === ex.name ? "1.5px solid #dc2626" : "0.5px solid #e5e7eb",
                      background: selectedExercise?.name === ex.name ? "#fef2f2" : "#f9fafb",
                    }}
                  >
                    <span className="text-[20px]">{ex.emoji}</span>
                    <span className="text-[9px] text-center leading-[1.2]"
                      style={{ color: selectedExercise?.name === ex.name ? "#dc2626" : "#6b7280", fontWeight: selectedExercise?.name === ex.name ? 500 : 400 }}
                    >{ex.name}</span>
                  </button>
                ))}
              </div>

              <p className="text-[11px] text-gray-400 mb-2 uppercase tracking-[0.3px] m-0">Duration</p>
              <div className="flex gap-2 mb-3">
                {[15, 30, 45, 60, 90].map(m => (
                  <button key={m} onClick={() => setMinutes(String(m))}
                    className="flex-1 py-2 px-1 rounded-[10px] text-xs font-medium cursor-pointer font-[inherit]"
                    style={{
                      border: minutes === String(m) ? "1.5px solid #dc2626" : "0.5px solid #e5e7eb",
                      background: minutes === String(m) ? "#fef2f2" : "#f9fafb",
                      color: minutes === String(m) ? "#dc2626" : "#6b7280",
                    }}
                  >{m}m</button>
                ))}
              </div>

              <div className="flex items-center gap-2 mb-4">
                <input
                  type="number" value={minutes} onChange={e => setMinutes(e.target.value)}
                  placeholder="Custom minutes..."
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-[10px] py-[10px] px-[14px] text-[14px] text-forest outline-none font-[inherit]"
                />
                <div className="bg-red-50 rounded-[10px] py-[10px] px-[14px] flex items-center gap-[6px]">
                  <Flame className="w-[14px] h-[14px] text-red-600" />
                  <span className="text-[14px] font-semibold text-red-600">{previewCalories} kcal</span>
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={!selectedExercise || !minutes || Number(minutes) <= 0 || saving}
                className="w-full border-none rounded-[14px] py-[14px] text-[14px] font-medium font-[inherit]"
                style={{
                  background: selectedExercise && minutes && Number(minutes) > 0 ? "#dc2626" : "#f3f4f6",
                  color: selectedExercise && minutes && Number(minutes) > 0 ? "white" : "#9ca3af",
                  cursor: selectedExercise && minutes ? "pointer" : "default",
                }}
              >
                {saving ? "Saving..." : selectedExercise && minutes ? `Log ${previewCalories} kcal burned` : "Select exercise and duration"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
