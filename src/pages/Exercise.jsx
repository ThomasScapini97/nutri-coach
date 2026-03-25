import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Plus, X, Clock, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";

const TODAY = format(new Date(), "yyyy-MM-dd");

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

  const { data: todayLog } = useQuery({
    queryKey: ["foodlog", TODAY, user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("food_logs").select("*").eq("date", TODAY).eq("user_id", user.id);
      return data?.[0] || null;
    },
    enabled: !!user?.id,
  });

  const { data: todayExercises } = useQuery({
    queryKey: ["exercises", TODAY, user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("exercise_logs").select("*").eq("user_id", user.id).eq("date", TODAY).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user?.id,
    initialData: [],
  });

  const { data: weekExercises } = useQuery({
    queryKey: ["exercises-week", user?.id],
    queryFn: async () => {
      const from = format(subDays(new Date(), 6), "yyyy-MM-dd");
      const { data } = await supabase.from("exercise_logs").select("date, calories_burned").eq("user_id", user.id).gte("date", from).lte("date", TODAY);
      return data || [];
    },
    enabled: !!user?.id,
    initialData: [],
  });

  const totalBurnedToday = todayLog?.total_burned_calories || 0;
  const totalMinutesToday = todayExercises.reduce((sum, e) => sum + e.duration_minutes, 0);
  const activeDaysWeek = new Set(weekExercises.map(e => e.date)).size;
  const kcalPerMin = totalMinutesToday > 0 ? (totalBurnedToday / totalMinutesToday).toFixed(1) : "—";

  const previewCalories = selectedExercise && minutes
    ? calculateCalories(selectedExercise.met, weight, Number(minutes))
    : 0;

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = format(subDays(new Date(), 6 - i), "yyyy-MM-dd");
    const burned = weekExercises.filter(e => e.date === d).reduce((sum, e) => sum + e.calories_burned, 0);
    return { date: d, day: format(new Date(d + "T12:00:00"), "EEE"), burned };
  });
  const maxBurned = Math.max(...weekDays.map(d => d.burned), 1);

  const handleSave = async () => {
    if (!selectedExercise || !minutes || Number(minutes) <= 0) return;
    setSaving(true);
    try {
      const calories = calculateCalories(selectedExercise.met, weight, Number(minutes));
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      let logId = todayLog?.id;
      if (!logId) {
        const { data: created } = await supabase.from("food_logs").insert({
          date: TODAY, user_id: currentUser.id,
          total_calories: 0, total_carbs: 0, total_protein: 0,
          total_fats: 0, total_fiber: 0, total_burned_calories: 0,
        }).select().single();
        logId = created?.id;
      }
      await supabase.from("exercise_logs").insert({
        user_id: currentUser.id, foodlog_id: logId, date: TODAY,
        exercise_name: selectedExercise.name,
        duration_minutes: Number(minutes),
        calories_burned: calories,
      });
      const newTotal = (todayLog?.total_burned_calories || 0) + calories;
      await supabase.from("food_logs").update({ total_burned_calories: newTotal }).eq("id", logId);
      queryClient.invalidateQueries({ queryKey: ["exercises", TODAY] });
      queryClient.invalidateQueries({ queryKey: ["exercises-week"] });
      queryClient.invalidateQueries({ queryKey: ["foodlog"] });
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
    await supabase.from("exercise_logs").delete().eq("id", exercise.id);
    const newTotal = Math.max(0, totalBurnedToday - exercise.calories_burned);
    if (todayLog?.id) await supabase.from("food_logs").update({ total_burned_calories: newTotal }).eq("id", todayLog.id);
    queryClient.invalidateQueries({ queryKey: ["exercises", TODAY] });
    queryClient.invalidateQueries({ queryKey: ["exercises-week"] });
    queryClient.invalidateQueries({ queryKey: ["foodlog"] });
    toast.success("Exercise removed");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#f0fcf3", overflow: "hidden" }}>

      {/* Parte scorrevole */}
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: "8px" }}>
        <div style={{ maxWidth: "480px", margin: "0 auto", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>

          {/* Hero card */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: "linear-gradient(135deg, #ef4444, #dc2626)",
              borderRadius: "20px", padding: "18px", color: "white",
              position: "relative", overflow: "hidden",
            }}
          >
            <div style={{ position: "absolute", top: "-30px", right: "-30px", width: "120px", height: "120px", borderRadius: "50%", background: "rgba(255,255,255,0.07)" }} />
            <div style={{ position: "absolute", bottom: "-20px", right: "30px", width: "80px", height: "80px", borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative" }}>
              <div>
                <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.75)", marginBottom: "2px" }}>Burned today</p>
                <p style={{ fontSize: "42px", fontWeight: 500, lineHeight: 1, letterSpacing: "-1px" }}>{totalBurnedToday.toLocaleString()}</p>
                <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.65)", marginTop: "2px" }}>kcal burned</p>
              </div>
              <div style={{ width: "44px", height: "44px", borderRadius: "14px", background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Flame className="w-5 h-5 text-white" />
              </div>
            </div>
            {todayExercises.length > 0 && (
              <div style={{ marginTop: "12px", display: "flex", gap: "6px", flexWrap: "wrap", position: "relative" }}>
                {todayExercises.map((e, i) => (
                  <span key={i} style={{ fontSize: "10px", background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)", padding: "2px 8px", borderRadius: "20px" }}>
                    {EXERCISES.find(ex => ex.name === e.exercise_name)?.emoji || "💪"} {e.exercise_name} · {e.duration_minutes}min
                  </span>
                ))}
              </div>
            )}
          </motion.div>

          {/* Stats grid 2x2 */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {[
                { emoji: "⏱️", value: `${totalMinutesToday}`, label: "Total minutes" },
                { emoji: "💪", value: `${todayExercises.length}`, label: "Exercises done" },
                { emoji: "⚡", value: `${kcalPerMin}`, label: "kcal / min avg" },
                { emoji: "📅", value: `${activeDaysWeek}`, label: "Active days this week" },
              ].map((s, i) => (
                <div key={i} style={{ background: "white", borderRadius: "14px", padding: "12px", border: "0.5px solid rgba(0,0,0,0.06)" }}>
                  <div style={{ fontSize: "20px", marginBottom: "6px" }}>{s.emoji}</div>
                  <div style={{ fontSize: "20px", fontWeight: 500, color: "#1a3a22", lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: "10px", color: "#9ca3af", marginTop: "3px" }}>{s.label}</div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Bottone aggiungi */}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            onClick={() => setShowAddSheet(true)}
            style={{
              width: "100%", background: "#dc2626", color: "white",
              border: "none", borderRadius: "14px", padding: "13px",
              fontSize: "14px", fontWeight: 500, cursor: "pointer",
              fontFamily: "inherit", display: "flex", alignItems: "center",
              justifyContent: "center", gap: "8px",
            }}
          >
            <Plus style={{ width: "18px", height: "18px" }} />
            Log exercise
          </motion.button>

          {/* Lista esercizi oggi */}
          {todayExercises.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <p style={{ fontSize: "13px", fontWeight: 500, color: "#1a3a22", marginBottom: "8px", padding: "0 2px" }}>
                🏃 Today's exercises
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {todayExercises.map((exercise) => {
                  const ex = EXERCISES.find(e => e.name === exercise.exercise_name);
                  return (
                    <motion.div
                      key={exercise.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      style={{
                        display: "flex", alignItems: "center", gap: "10px",
                        background: "white", borderRadius: "14px", padding: "10px 12px",
                        border: "0.5px solid rgba(0,0,0,0.06)",
                      }}
                    >
                      <span style={{ fontSize: "22px", flexShrink: 0 }}>{ex?.emoji || "💪"}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: "13px", fontWeight: 500, color: "#1a3a22" }}>{exercise.exercise_name}</p>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                          <Clock style={{ width: "10px", height: "10px", color: "#9ca3af" }} />
                          <span style={{ fontSize: "11px", color: "#9ca3af" }}>{exercise.duration_minutes} min</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                        <div style={{ background: "#fef2f2", borderRadius: "20px", padding: "3px 8px", display: "flex", alignItems: "center", gap: "3px" }}>
                          <Flame style={{ width: "12px", height: "12px", color: "#dc2626" }} />
                          <span style={{ fontSize: "12px", fontWeight: 600, color: "#dc2626" }}>{exercise.calories_burned}</span>
                        </div>
                        <button
                          onClick={() => handleDelete(exercise)}
                          style={{ width: "26px", height: "26px", borderRadius: "50%", background: "#f9fafb", border: "0.5px solid #e5e7eb", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                          <Trash2 style={{ width: "12px", height: "12px", color: "#9ca3af" }} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Empty state */}
          {todayExercises.length === 0 && (
            <div style={{ textAlign: "center", padding: "24px", background: "white", borderRadius: "16px", border: "0.5px solid rgba(0,0,0,0.06)" }}>
              <p style={{ fontSize: "32px", marginBottom: "8px" }}>🏃</p>
              <p style={{ fontSize: "13px", fontWeight: 500, color: "#1a3a22", marginBottom: "4px" }}>No exercises logged yet</p>
              <p style={{ fontSize: "12px", color: "#9ca3af" }}>Tap "Log exercise" to get started!</p>
            </div>
          )}

        </div>
      </div>

      {/* Weekly trend fisso in basso */}
      <div style={{ background: "#f0fcf3", padding: "8px 16px 90px", flexShrink: 0 }}>
        <div style={{ background: "white", borderRadius: "20px", padding: "10px 16px", border: "0.5px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.06)", maxWidth: "480px", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
            <TrendingUp style={{ width: "14px", height: "14px", color: "#dc2626" }} />
            <span style={{ fontSize: "13px", fontWeight: 500, color: "#1a3a22" }}>Weekly burned</span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "6px", height: "60px" }}>
            {weekDays.map((day, i) => {
              const isToday = day.date === TODAY;
              const barHeight = day.burned > 0 ? Math.max(6, (day.burned / maxBurned) * 40) : 4;
              return (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", height: "100%" }}>
                  <div style={{ flex: 1, width: "100%", display: "flex", alignItems: "flex-end" }}>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: barHeight }}
                      transition={{ duration: 0.4, delay: i * 0.05 }}
                      style={{
                        width: "100%", borderRadius: "4px 4px 0 0",
                        background: day.burned > 0 ? (isToday ? "#dc2626" : "#fca5a5") : "#f3f4f6",
                        border: isToday ? "2px solid #b91c1c" : "none",
                      }}
                    />
                  </div>
                  <span style={{ fontSize: "9px", color: isToday ? "#dc2626" : "#9ca3af", fontWeight: isToday ? 600 : 400 }}>{day.day}</span>
                  {day.burned > 0 && <span style={{ fontSize: "8px", color: "#9ca3af" }}>{day.burned}</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sheet aggiungi esercizio */}
      <AnimatePresence>
        {showAddSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
            onClick={() => setShowAddSheet(false)}
          >
            <motion.div
              initial={{ y: 400 }}
              animate={{ y: 0 }}
              exit={{ y: 400 }}
              transition={{ type: "spring", damping: 25 }}
              onClick={e => e.stopPropagation()}
              style={{ background: "white", borderRadius: "24px 24px 0 0", padding: "20px", width: "100%", maxWidth: "480px", maxHeight: "85vh", overflowY: "auto" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <div>
                  <p style={{ fontSize: "15px", fontWeight: 500, color: "#1a3a22" }}>Log exercise</p>
                  <p style={{ fontSize: "11px", color: "#9ca3af" }}>Based on your weight: {weight}kg</p>
                </div>
                <button onClick={() => setShowAddSheet(false)} style={{ background: "#f3f4f6", border: "none", borderRadius: "50%", width: "28px", height: "28px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <X style={{ width: "14px", height: "14px", color: "#6b7280" }} />
                </button>
              </div>

              <p style={{ fontSize: "11px", color: "#9ca3af", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.3px" }}>Choose exercise</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "16px" }}>
                {EXERCISES.map((ex) => (
                  <button
                    key={ex.name}
                    onClick={() => setSelectedExercise(ex)}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center", gap: "4px",
                      padding: "10px 4px", borderRadius: "12px",
                      border: selectedExercise?.name === ex.name ? "1.5px solid #dc2626" : "0.5px solid #e5e7eb",
                      background: selectedExercise?.name === ex.name ? "#fef2f2" : "#f9fafb",
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    <span style={{ fontSize: "20px" }}>{ex.emoji}</span>
                    <span style={{ fontSize: "9px", color: selectedExercise?.name === ex.name ? "#dc2626" : "#6b7280", fontWeight: selectedExercise?.name === ex.name ? 500 : 400, textAlign: "center", lineHeight: 1.2 }}>
                      {ex.name}
                    </span>
                  </button>
                ))}
              </div>

              <p style={{ fontSize: "11px", color: "#9ca3af", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.3px" }}>Duration</p>
              <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                {[15, 30, 45, 60, 90].map(m => (
                  <button
                    key={m}
                    onClick={() => setMinutes(String(m))}
                    style={{
                      flex: 1, padding: "8px 4px", borderRadius: "10px",
                      border: minutes === String(m) ? "1.5px solid #dc2626" : "0.5px solid #e5e7eb",
                      background: minutes === String(m) ? "#fef2f2" : "#f9fafb",
                      fontSize: "12px", fontWeight: 500,
                      color: minutes === String(m) ? "#dc2626" : "#6b7280",
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    {m}m
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                <input
                  type="number"
                  value={minutes}
                  onChange={e => setMinutes(e.target.value)}
                  placeholder="Custom minutes..."
                  style={{ flex: 1, background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: "10px", padding: "10px 14px", fontSize: "14px", color: "#1a3a22", outline: "none", fontFamily: "inherit" }}
                />
                <div style={{ background: "#fef2f2", borderRadius: "10px", padding: "10px 14px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Flame style={{ width: "14px", height: "14px", color: "#dc2626" }} />
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "#dc2626" }}>{previewCalories} kcal</span>
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={!selectedExercise || !minutes || Number(minutes) <= 0 || saving}
                style={{
                  width: "100%",
                  background: selectedExercise && minutes && Number(minutes) > 0 ? "#dc2626" : "#f3f4f6",
                  color: selectedExercise && minutes && Number(minutes) > 0 ? "white" : "#9ca3af",
                  border: "none", borderRadius: "14px", padding: "14px",
                  fontSize: "14px", fontWeight: 500,
                  cursor: selectedExercise && minutes ? "pointer" : "default",
                  fontFamily: "inherit",
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
