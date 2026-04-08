import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Plus, X, Clock, Trash2, TrendingUp, ChevronLeft, ChevronRight, Bookmark, Save } from "lucide-react";
import { toast } from "sonner";
import ScrollableExerciseChart from "../components/summary/ScrollableExerciseChart";
import { getToday } from "@/lib/nutritionUtils";

const EXERCISES = [
  // Cardio con velocità
  { name: "Running", emoji: "🏃", met: 9.8, type: "cardio-speed" },
  { name: "Walking", emoji: "🚶", met: 3.5, type: "cardio-speed" },
  { name: "Cycling", emoji: "🚴", met: 7.5, type: "cardio-speed" },
  { name: "Rowing", emoji: "🚣", met: 7.0, type: "cardio-speed" },
  { name: "Hiking", emoji: "🥾", met: 6.0, type: "cardio-speed" },
  // Cardio senza velocità
  { name: "Swimming", emoji: "🏊", met: 8.0, type: "cardio" },
  { name: "HIIT", emoji: "⚡", met: 10.0, type: "cardio" },
  { name: "Football", emoji: "⚽", met: 7.0, type: "cardio" },
  { name: "Basketball", emoji: "🏀", met: 6.5, type: "cardio" },
  { name: "Tennis", emoji: "🎾", met: 7.0, type: "cardio" },
  { name: "Dancing", emoji: "💃", met: 5.0, type: "cardio" },
  { name: "Jump Rope", emoji: "🪃", met: 11.0, type: "cardio" },
  // Flessibilità
  { name: "Yoga", emoji: "🧘", met: 2.5, type: "flexibility" },
  { name: "Pilates", emoji: "🤸", met: 3.0, type: "flexibility" },
  { name: "Stretching", emoji: "🙆", met: 2.0, type: "flexibility" },
  { name: "Tai Chi", emoji: "🥋", met: 3.0, type: "flexibility" },
  // Strength — free weights
  { name: "Bench Press", emoji: "🏋️", met: 5.0, type: "strength" },
  { name: "Deadlift", emoji: "🏋️", met: 6.0, type: "strength" },
  { name: "Squat", emoji: "🦵", met: 5.5, type: "strength" },
  { name: "Shoulder Press", emoji: "🏋️", met: 5.0, type: "strength" },
  { name: "Bicep Curl", emoji: "💪", met: 3.5, type: "strength" },
  { name: "Tricep Extension", emoji: "💪", met: 3.5, type: "strength" },
  { name: "Lateral Raise", emoji: "💪", met: 3.0, type: "strength" },
  { name: "Romanian Deadlift", emoji: "🏋️", met: 5.5, type: "strength" },
  { name: "Dumbbell Row", emoji: "🏋️", met: 4.5, type: "strength" },
  { name: "Lunges", emoji: "🦵", met: 4.5, type: "strength" },
  // Strength — bodyweight
  { name: "Pull-ups", emoji: "🙌", met: 8.0, type: "strength" },
  { name: "Push-ups", emoji: "✊", met: 5.0, type: "strength" },
  { name: "Dips", emoji: "✊", met: 6.0, type: "strength" },
  { name: "Plank", emoji: "🤸", met: 3.0, type: "strength" },
  { name: "Sit-ups", emoji: "🤸", met: 3.8, type: "strength" },
  // Strength — machines
  { name: "Leg Press", emoji: "🦵", met: 5.0, type: "strength" },
  { name: "Leg Curl", emoji: "🦵", met: 3.5, type: "strength" },
  { name: "Leg Extension", emoji: "🦵", met: 3.5, type: "strength" },
  { name: "Lat Pulldown", emoji: "🙌", met: 4.5, type: "strength" },
  { name: "Cable Row", emoji: "🙌", met: 4.5, type: "strength" },
  { name: "Chest Fly", emoji: "💪", met: 3.5, type: "strength" },
  { name: "Pec Deck", emoji: "💪", met: 3.5, type: "strength" },
  { name: "Smith Machine Squat", emoji: "🦵", met: 5.0, type: "strength" },
  { name: "Hip Thrust", emoji: "🦵", met: 4.5, type: "strength" },
  { name: "Cable Curl", emoji: "💪", met: 3.5, type: "strength" },
  { name: "Tricep Pushdown", emoji: "💪", met: 3.5, type: "strength" },
  { name: "Face Pull", emoji: "🙌", met: 3.5, type: "strength" },
];

function getCardioMET(exerciseName, speedKmh) {
  const speed = parseFloat(speedKmh) || 0;
  if (speed <= 0) {
    return EXERCISES.find(e => e.name === exerciseName)?.met || 5;
  }
  if (exerciseName === "Walking") {
    if (speed < 4) return 2.5;
    if (speed < 5) return 3.5;
    if (speed < 6) return 4.5;
    if (speed < 7) return 5.5;
    return 7.0; // race walking
  }
  if (exerciseName === "Cycling") {
    if (speed < 16) return 6;
    if (speed <= 20) return 8;
    return 10;
  }
  if (exerciseName === "Rowing") {
    if (speed < 4) return 5.0;
    if (speed < 6) return 7.0;
    return 9.0;
  }
  if (exerciseName === "Hiking") {
    if (speed < 3) return 5.5;
    if (speed < 5) return 6.5;
    return 7.5;
  }
  // Running (default for speed-based)
  if (speed < 7) return 6.0;
  if (speed <= 8) return 8.0;
  if (speed <= 10) return 10.0;
  if (speed <= 12) return 12.0;
  return 14.0;
}

function calcBMR(weight, height, age, gender) {
  // Mifflin-St Jeor
  const base = 10 * weight + 6.25 * height - 5 * age;
  return gender === "female" ? base - 161 : base + 5;
}

function computeCalories({ exerciseType, exerciseName, speedKmh, minutes, sets, userWeight, userAge, userHeight, userGender }) {
  if (exerciseType === "cardio-speed" || exerciseType === "cardio" || exerciseType === "flexibility") {
    const mins = Number(minutes) || 0;
    if (mins <= 0) return 0;
    const met = exerciseType === "cardio-speed"
      ? getCardioMET(exerciseName, speedKmh)
      : (EXERCISES.find(e => e.name === exerciseName)?.met || 5);
    const gross = met * 3.5 * userWeight / 200 * mins;
    const bmr = calcBMR(userWeight, userHeight || 170, userAge || 30, userGender || "male");
    const rest = (bmr / 1440) * mins;
    return Math.max(0, Math.round(gross - rest));
  }
  if (exerciseType === "strength") {
    const s = Number(sets) || 0;
    if (s <= 0) return 0;
    // 90s per set = active contraction + elevated HR during rest
    const effectiveMinutes = s * 1.5;
    const ex = EXERCISES.find(e => e.name === exerciseName);
    const met = ex?.met || 4.5;
    const gross = met * 3.5 * userWeight / 200 * effectiveMinutes;
    const bmr = calcBMR(userWeight, userHeight || 170, userAge || 30, userGender || "male");
    const rest = (bmr / 1440) * effectiveMinutes;
    return Math.max(0, Math.round(gross - rest));
  }
  return 0;
}

function getPresetSummary(preset) {
  const count = preset.exercises.length;
  const totalMin = preset.exercises.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
  const totalCals = preset.exercises.reduce((sum, e) => sum + (e.calories_burned || 0), 0);
  const minPart = totalMin > 0 ? ` · ${totalMin} min` : "";
  return `${count} exercise${count !== 1 ? "s" : ""}${minPart} · ${totalCals} kcal`;
}

function ExerciseDetails({ exercise }) {
  const type = exercise.exercise_type || "other";
  if (type === "strength") {
    return (
      <div className="flex items-center gap-1 mt-[2px] flex-wrap">
        {exercise.sets && exercise.reps && (
          <span className="text-[11px] text-gray-400">
            {exercise.sets}×{exercise.reps}{exercise.weight_kg ? ` · ${exercise.weight_kg}kg` : " (bodyweight)"}
          </span>
        )}
        {exercise.duration_minutes > 0 && (
          <span className="text-[11px] text-gray-400">· {exercise.duration_minutes} min</span>
        )}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1 mt-[2px]">
      {exercise.duration_minutes > 0 && (
        <>
          <Clock className="w-[10px] h-[10px] text-gray-400" />
          <span className="text-[11px] text-gray-400">{exercise.duration_minutes} min</span>
        </>
      )}
      {exercise.speed_kmh > 0 && (
        <span className="text-[11px] text-gray-400">· {exercise.speed_kmh} km/h</span>
      )}
    </div>
  );
}

export default function Exercise() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const isToday = dateStr === getToday();

  // Sheet state
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showSavePreset, setShowSavePreset] = useState(false);

  // Exercise form state
  const [exerciseType, setExerciseType] = useState("cardio-speed");
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [minutes, setMinutes] = useState("30");
  const [speedKmh, setSpeedKmh] = useState("");
  const [sets, setSets] = useState("3");
  const [reps, setReps] = useState("10");
  const [strengthWeight, setStrengthWeight] = useState("");
  const [saving, setSaving] = useState(false);

  // Preset state
  const [presetName, setPresetName] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);
  const pressTimerRef = useRef(null);

  // ─── Queries ────────────────────────────────────────────────────────────────

  const { data: profile } = useQuery({
    queryKey: ["userProfile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_profiles").select("*").eq("user_id", user.id).maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const weight = profile?.weight || 70;
  const age = profile?.age || 30;
  const height = profile?.height || 170;
  const gender = profile?.gender || "male";
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

  const { data: workoutPresets } = useQuery({
    queryKey: ["workout-presets", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("workout_presets").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user?.id,
    initialData: [],
  });

  // ─── Derived values ──────────────────────────────────────────────────────────

  const totalBurnedToday = dayLog?.total_burned_calories || 0;
  const activeDaysThisWeek = new Set(weekExercises.map(e => e.date)).size;

  const previewCalories = selectedExercise
    ? computeCalories({
        exerciseType,
        exerciseName: selectedExercise.name,
        speedKmh,
        minutes,
        sets,
        userWeight: weight,
        userAge: age,
        userHeight: height,
        userGender: gender,
      })
    : 0;

  const canSave = () => {
    if (!selectedExercise) return false;
    if (["cardio-speed", "cardio", "flexibility"].includes(exerciseType)) return !!minutes && Number(minutes) > 0;
    if (exerciseType === "strength") return !!sets && !!reps && Number(sets) > 0 && Number(reps) > 0;
    return false;
  };

  const filteredExercises = EXERCISES.filter(e => e.type === exerciseType);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const navigateDay = (dir) => {
    setSelectedDate(prev => {
      const next = new Date(prev);
      next.setDate(next.getDate() + dir);
      return next;
    });
  };

  const resetForm = () => {
    setSelectedExercise(null);
    setExerciseType("cardio-speed");
    setMinutes("30");
    setSpeedKmh("");
    setSets("3");
    setReps("10");
    setStrengthWeight("");
  };

  const handleTypeChange = (type) => {
    setExerciseType(type);
    if (selectedExercise && selectedExercise.type !== type) {
      setSelectedExercise(null);
    }
  };

  const ensureFoodLog = async () => {
    if (dayLog?.id) return dayLog.id;
    const { data: created } = await supabase.from("food_logs").insert({
      date: dateStr, user_id: user.id,
      total_calories: 0, total_carbs: 0, total_protein: 0,
      total_fats: 0, total_fiber: 0, total_burned_calories: 0,
    }).select().single();
    return created?.id;
  };

  const handleSave = async () => {
    if (!canSave()) return;
    setSaving(true);
    try {
      const calories = previewCalories;
      const logId = await ensureFoodLog();

      const entry = {
        user_id: user.id,
        foodlog_id: logId,
        date: dateStr,
        exercise_name: selectedExercise.name,
        calories_burned: calories,
        exercise_type: exerciseType,
      };

      if (exerciseType === "cardio-speed") {
        entry.duration_minutes = Number(minutes);
        if (speedKmh) entry.speed_kmh = Number(speedKmh);
      } else if (exerciseType === "cardio" || exerciseType === "flexibility") {
        entry.duration_minutes = Number(minutes);
      } else if (exerciseType === "strength") {
        entry.sets = Number(sets);
        entry.reps = Number(reps);
        if (strengthWeight) entry.weight_kg = Number(strengthWeight);
      }

      await supabase.from("exercise_logs").insert(entry);

      const newTotal = (dayLog?.total_burned_calories || 0) + calories;
      await supabase.from("food_logs").update({ total_burned_calories: newTotal }).eq("id", logId);

      const activityLabel = exerciseType === "strength"
        ? `${sets}×${reps}${strengthWeight ? ` · ${strengthWeight}kg` : " bodyweight"}`
        : `${entry.duration_minutes} min${exerciseType === "cardio-speed" && speedKmh ? ` · ${speedKmh} km/h` : ""}`;

      await supabase.from("messages").insert({
        foodlog_id: logId,
        role: "system",
        content: `${selectedExercise.emoji} **${selectedExercise.name}** aggiunto: ${activityLabel} · ${calories} kcal bruciati`,
        timestamp: new Date().toISOString(),
      });

      queryClient.invalidateQueries({ queryKey: ["exercises", dateStr] });
      queryClient.invalidateQueries({ queryKey: ["exercises-week"] });
      queryClient.invalidateQueries({ queryKey: ["foodlog"] });
      queryClient.invalidateQueries({ queryKey: ["messages", logId] });

      toast.success(`${selectedExercise.emoji} ${selectedExercise.name} logged! 🔥`, { description: `${calories} kcal burned` });
      setShowAddSheet(false);
      resetForm();
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
    setSaving(false);
  };

  const handleDelete = async (exercise) => {
    try {
      await supabase.from("exercise_logs").delete().eq("id", exercise.id);
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

  const handleLogPreset = async (preset) => {
    setSavingPreset(preset.id);
    try {
      const logId = await ensureFoodLog();
      let totalCals = 0;

      for (const ex of preset.exercises) {
        await supabase.from("exercise_logs").insert({
          user_id: user.id,
          foodlog_id: logId,
          date: dateStr,
          exercise_name: ex.exercise_name,
          duration_minutes: ex.duration_minutes || null,
          calories_burned: ex.calories_burned || 0,
          exercise_type: ex.exercise_type || "other",
          speed_kmh: ex.speed_kmh || null,
          sets: ex.sets || null,
          reps: ex.reps || null,
          weight_kg: ex.weight_kg || null,
        });
        totalCals += ex.calories_burned || 0;
      }

      const newTotal = (dayLog?.total_burned_calories || 0) + totalCals;
      await supabase.from("food_logs").update({ total_burned_calories: newTotal }).eq("id", logId);

      await supabase.from("messages").insert({
        foodlog_id: logId,
        role: "system",
        content: `💾 **${preset.name}** preset logged: ${preset.exercises.length} exercises · ${totalCals} kcal bruciati`,
        timestamp: new Date().toISOString(),
      });

      queryClient.invalidateQueries({ queryKey: ["exercises", dateStr] });
      queryClient.invalidateQueries({ queryKey: ["exercises-week"] });
      queryClient.invalidateQueries({ queryKey: ["foodlog"] });
      queryClient.invalidateQueries({ queryKey: ["messages", logId] });

      toast.success(`💾 ${preset.name} logged! 🔥`, { description: `${totalCals} kcal burned` });
    } catch {
      toast.error("Failed to log preset. Please try again.");
    }
    setSavingPreset(null);
  };

  const handleDeletePreset = async (preset) => {
    try {
      await supabase.from("workout_presets").delete().eq("id", preset.id);
      queryClient.invalidateQueries({ queryKey: ["workout-presets"] });
      toast.success(`"${preset.name}" deleted`);
    } catch {
      toast.error("Failed to delete preset.");
    }
  };

  const handlePresetLongPress = (preset) => {
    pressTimerRef.current = setTimeout(() => {
      pressTimerRef.current = null;
      if (window.confirm(`Delete preset "${preset.name}"?`)) {
        handleDeletePreset(preset);
      }
    }, 600);
  };

  const handlePresetPressEnd = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const handleSavePreset = async () => {
    if (!presetName.trim() || dayExercises.length === 0) return;
    const canonicalize = (ex) => [
      ex.exercise_name || "",
      Number(ex.duration_minutes) || 0,
      Number(ex.sets) || 0,
      Number(ex.reps) || 0,
      Number(ex.weight_kg) || 0,
      Number(ex.speed_kmh) || 0,
    ].join("|");
    const newSig = dayExercises.map(canonicalize).sort().join(";;");
    const { data: freshPresets } = await supabase
      .from("workout_presets").select("exercises").eq("user_id", user.id);
    const duplicate = freshPresets?.find(p =>
      p.exercises?.map(canonicalize).sort().join(";;") === newSig
    );
    if (duplicate) {
      toast.error("There's already a saved workout with the same exercises.");
      return;
    }
    setSavingPreset(true);
    try {
      const exercises = dayExercises.map(e => ({
        exercise_name: e.exercise_name,
        duration_minutes: e.duration_minutes || null,
        calories_burned: e.calories_burned || 0,
        exercise_type: e.exercise_type || "other",
        speed_kmh: e.speed_kmh || null,
        sets: e.sets || null,
        reps: e.reps || null,
        weight_kg: e.weight_kg || null,
      }));

      await supabase.from("workout_presets").insert({
        user_id: user.id,
        name: presetName.trim(),
        exercises,
      });

      queryClient.invalidateQueries({ queryKey: ["workout-presets"] });
      toast.success("Preset saved!");
      setShowSavePreset(false);
      setPresetName("");
    } catch {
      toast.error("Failed to save preset.");
    }
    setSavingPreset(false);
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col overflow-hidden h-[100dvh] bg-mint">

      {/* Date navigator */}
      <div className="flex items-center bg-white border-b border-gray-200 shadow-[0_1px_4px_rgba(0,0,0,0.06)] px-4 py-[14px] shrink-0">
        <div className="w-10 flex items-center justify-start">
          <button onClick={() => navigateDay(-1)} className="bg-transparent border-none flex items-center justify-center cursor-pointer p-1">
            <ChevronLeft className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="flex-1 text-center">
          <h2 className="text-base font-semibold text-forest leading-[1.2] m-0">
            {isToday ? "Today" : format(selectedDate, "MMM d, yyyy")}
          </h2>
          <p className="text-[11px] text-gray-400 m-0">
            {`${totalBurnedToday} kcal burned`}
          </p>
        </div>
        <div className="w-10 flex items-center justify-end">
          <button onClick={() => navigateDay(1)} disabled={isToday} className={`bg-transparent border-none flex items-center justify-center p-1 ${isToday ? "opacity-30 cursor-default" : "cursor-pointer"}`}>
            <ChevronRight className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto pb-[72px]">
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
                    {EXERCISES.find(ex => ex.name === e.exercise_name)?.emoji || "💪"} {e.exercise_name}
                    {e.duration_minutes ? ` · ${e.duration_minutes}min` : ""}
                    {e.sets && e.reps ? ` · ${e.sets}×${e.reps}` : ""}
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

          {/* Workout Presets */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <div className="flex items-center gap-[6px] mb-2 px-[2px]">
              <Bookmark className="w-[13px] h-[13px] text-red-600" />
              <p className="text-[13px] font-medium text-forest m-0">Saved Workouts</p>
            </div>
            {workoutPresets.length > 0 ? (
              <div className="flex gap-[8px] overflow-x-auto pb-[4px] scrollbar-hide" style={{ scrollbarWidth: "none" }}>
                {workoutPresets.map(preset => (
                  <button
                    key={preset.id}
                    disabled={savingPreset === preset.id}
                    onClick={() => handleLogPreset(preset)}
                    onTouchStart={() => handlePresetLongPress(preset)}
                    onTouchEnd={handlePresetPressEnd}
                    onTouchCancel={handlePresetPressEnd}
                    onMouseLeave={handlePresetPressEnd}
                    className="shrink-0 text-left bg-white rounded-[14px] border border-black/[0.06] px-3 py-[10px] min-w-[130px] max-w-[160px] relative cursor-pointer font-[inherit]"
                    style={{
                      opacity: savingPreset === preset.id ? 0.5 : 1,
                      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                    }}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-[12px] font-medium text-forest m-0 leading-[1.3] line-clamp-2 flex-1">{preset.name}</p>
                      <button
                        onClick={e => { e.stopPropagation(); handleDeletePreset(preset); }}
                        className="w-5 h-5 rounded-full bg-gray-100 border-none flex items-center justify-center cursor-pointer shrink-0 p-0"
                      >
                        <X className="w-[10px] h-[10px] text-gray-400" />
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-400 m-0 mt-[4px]">{getPresetSummary(preset)}</p>
                    <div className="mt-[8px] bg-red-50 rounded-[8px] py-[4px] px-2 flex items-center justify-center gap-1">
                      <Plus className="w-[10px] h-[10px] text-red-600" />
                      <span className="text-[10px] text-red-600 font-medium">Log all</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-[14px] border border-black/[0.06] px-4 py-5 text-center">
                <p className="text-[13px] text-gray-400 font-medium m-0 mb-1">No saved workouts yet</p>
                <p className="text-[11px] text-gray-400 m-0">Log some exercises and tap "Save as preset" to create one</p>
              </div>
            )}
          </motion.div>

          {/* Log exercise button */}
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

          {/* Exercise list */}
          {dayExercises.length > 0 ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className=""
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
                        <ExerciseDetails exercise={exercise} />
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="bg-red-50 rounded-full py-[3px] px-2 flex items-center gap-[3px]">
                          <Flame className="w-3 h-3 text-red-600" />
                          <span className="text-xs font-semibold text-red-600">{exercise.calories_burned}</span>
                        </div>
                        <button onClick={() => handleDelete(exercise)} className="w-[26px] h-[26px] rounded-full bg-gray-50 border border-gray-200 cursor-pointer flex items-center justify-center p-0">
                          <Trash2 className="w-3 h-3 text-gray-400" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Save as preset button */}
              {isToday && (
                <button
                  onClick={() => setShowSavePreset(true)}
                  className="w-full mt-2 border rounded-[14px] py-[10px] text-[13px] font-medium cursor-pointer font-[inherit] flex items-center justify-center gap-2"
                  style={{ borderColor: "rgba(0,0,0,0.08)", background: "white", color: "#6b7280" }}
                >
                  <Save className="w-[14px] h-[14px]" />
                  Save session as preset
                </button>
              )}
            </motion.div>
          ) : (
            <div className="text-center p-6 bg-white rounded-2xl border border-black/[0.06]">
              <p className="text-[32px] mb-2">🏃</p>
              <p className="text-[13px] font-medium text-forest mb-1 m-0">
                No exercises logged yet
              </p>
              <p className="text-xs text-gray-400 m-0">
                Tap "Log exercise" to get started!
              </p>
            </div>
          )}

        </div>
      </div>

      {/* Bottom chart */}
      <div className="bg-mint px-4 pb-[72px] shrink-0">
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

      {/* ── Add exercise sheet ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAddSheet && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/50 flex items-end justify-center"
            onClick={() => { setShowAddSheet(false); resetForm(); }}
          >
            <motion.div
              initial={{ y: 400 }} animate={{ y: 0 }} exit={{ y: 400 }}
              transition={{ type: "spring", damping: 25 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-[24px_24px_0_0] p-5 w-full max-w-[480px] max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[15px] font-medium text-forest m-0">Log exercise</p>
                  <p className="text-[11px] text-gray-400 m-0">Your weight: {weight}kg</p>
                </div>
                <button onClick={() => { setShowAddSheet(false); resetForm(); }} className="bg-gray-100 border-none rounded-full w-7 h-7 cursor-pointer flex items-center justify-center p-0">
                  <X className="w-[14px] h-[14px] text-gray-500" />
                </button>
              </div>

              {/* Type selector */}
              <div className="flex gap-[4px] mb-4 bg-gray-100 rounded-[12px] p-[3px]">
                {[
                  { id: "cardio-speed", label: "Speed", emoji: "🏃" },
                  { id: "cardio", label: "Cardio", emoji: "⚡" },
                  { id: "strength", label: "Weights", emoji: "🏋️" },
                  { id: "flexibility", label: "Flex", emoji: "🧘" },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => handleTypeChange(tab.id)}
                    className="flex-1 py-[7px] rounded-[10px] text-[11px] font-medium cursor-pointer font-[inherit] border-none flex items-center justify-center gap-[3px] transition-all"
                    style={{
                      background: exerciseType === tab.id ? "white" : "transparent",
                      color: exerciseType === tab.id ? "#dc2626" : "#6b7280",
                      boxShadow: exerciseType === tab.id ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    }}
                  >
                    <span className="text-[13px]">{tab.emoji}</span>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Exercise grid */}
              <p className="text-[11px] text-gray-400 mb-2 uppercase tracking-[0.3px] m-0">Choose exercise</p>
              <div className={`grid gap-2 mb-4 ${exerciseType === "cardio" ? "grid-cols-4" : "grid-cols-3"}`}>
                {filteredExercises.map((ex) => (
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

              {/* ── Speed field (solo cardio-speed) ── */}
              {exerciseType === "cardio-speed" && (
                <div className="mb-3">
                  <p className="text-[11px] text-gray-400 mb-2 uppercase tracking-[0.3px] m-0">Speed (km/h) — optional</p>
                  <div className="flex gap-2">
                    {[6, 8, 10, 12, 15].map(s => (
                      <button key={s} onClick={() => setSpeedKmh(String(s))}
                        className="flex-1 py-2 px-1 rounded-[10px] text-xs font-medium cursor-pointer font-[inherit]"
                        style={{
                          border: speedKmh === String(s) ? "1.5px solid #dc2626" : "0.5px solid #e5e7eb",
                          background: speedKmh === String(s) ? "#fef2f2" : "#f9fafb",
                          color: speedKmh === String(s) ? "#dc2626" : "#6b7280",
                        }}
                      >{s}</button>
                    ))}
                  </div>
                  <input
                    type="number" value={speedKmh} onChange={e => setSpeedKmh(e.target.value)}
                    placeholder="Custom km/h..."
                    className="w-full bg-gray-50 border border-gray-200 rounded-[10px] py-[10px] px-[14px] text-[14px] text-forest outline-none font-[inherit] mt-2"
                  />
                </div>
              )}

              {/* ── Duration (cardio-speed, cardio, flexibility) ── */}
              {exerciseType !== "strength" && (
                <>
                  <p className="text-[11px] text-gray-400 mb-2 uppercase tracking-[0.3px] m-0">Duration</p>
                  <div className="flex gap-2 mb-2">
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
                    <div className="bg-red-50 rounded-[10px] py-[10px] px-[14px] flex items-center gap-[6px] shrink-0">
                      <Flame className="w-[14px] h-[14px] text-red-600" />
                      <span className="text-[14px] font-semibold text-red-600">{previewCalories} kcal</span>
                    </div>
                  </div>
                </>
              )}

              {/* ── Strength fields ── */}
              {exerciseType === "strength" && (
                <>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div>
                      <p className="text-[11px] text-gray-400 mb-1 uppercase tracking-[0.3px] m-0">Sets</p>
                      <input
                        type="number" value={sets} onChange={e => setSets(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-[10px] py-[10px] px-[10px] text-[14px] text-forest outline-none font-[inherit] text-center"
                      />
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-400 mb-1 uppercase tracking-[0.3px] m-0">Reps</p>
                      <input
                        type="number" value={reps} onChange={e => setReps(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-[10px] py-[10px] px-[10px] text-[14px] text-forest outline-none font-[inherit] text-center"
                      />
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-400 mb-1 uppercase tracking-[0.3px] m-0">kg (opt.)</p>
                      <input
                        type="number" value={strengthWeight} onChange={e => setStrengthWeight(e.target.value)}
                        placeholder="BW"
                        className="w-full bg-gray-50 border border-gray-200 rounded-[10px] py-[10px] px-[10px] text-[14px] text-forest outline-none font-[inherit] text-center"
                      />
                    </div>
                  </div>
                  <div className="bg-red-50 rounded-[10px] py-[10px] px-[14px] flex items-center justify-center gap-[6px] mb-4">
                    <Flame className="w-[14px] h-[14px] text-red-600" />
                    <span className="text-[14px] font-semibold text-red-600">{previewCalories} kcal</span>
                    {!strengthWeight && <span className="text-[11px] text-red-400">(bodyweight estimate)</span>}
                  </div>
                </>
              )}

              <button
                onClick={handleSave}
                disabled={!canSave() || saving}
                className="w-full border-none rounded-[14px] py-[14px] text-[14px] font-medium font-[inherit]"
                style={{
                  background: canSave() ? "#dc2626" : "#f3f4f6",
                  color: canSave() ? "white" : "#9ca3af",
                  cursor: canSave() ? "pointer" : "default",
                }}
              >
                {saving ? "Saving..." : canSave() ? `Log ${previewCalories} kcal burned` : "Select exercise and details"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Save preset sheet ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSavePreset && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/50 flex items-end justify-center"
            onClick={() => setShowSavePreset(false)}
          >
            <motion.div
              initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }}
              transition={{ type: "spring", damping: 25 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-[24px_24px_0_0] p-5 w-full max-w-[480px]"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[15px] font-medium text-forest m-0">Save workout preset</p>
                  <p className="text-[11px] text-gray-400 m-0">{dayExercises.length} exercise{dayExercises.length !== 1 ? "s" : ""} will be saved</p>
                </div>
                <button onClick={() => setShowSavePreset(false)} className="bg-gray-100 border-none rounded-full w-7 h-7 cursor-pointer flex items-center justify-center p-0">
                  <X className="w-[14px] h-[14px] text-gray-500" />
                </button>
              </div>

              <div className="flex flex-col gap-[6px] mb-4">
                {dayExercises.map((e, i) => {
                  const ex = EXERCISES.find(x => x.name === e.exercise_name);
                  return (
                    <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-[10px] px-3 py-[8px]">
                      <span className="text-[16px]">{ex?.emoji || "💪"}</span>
                      <span className="text-[12px] text-forest flex-1">{e.exercise_name}</span>
                      <span className="text-[11px] text-red-600 font-medium">{e.calories_burned} kcal</span>
                    </div>
                  );
                })}
              </div>

              <p className="text-[11px] text-gray-400 mb-2 uppercase tracking-[0.3px] m-0">Preset name</p>
              <input
                type="text"
                value={presetName}
                onChange={e => setPresetName(e.target.value)}
                placeholder="e.g. Morning Routine, Gym Day A..."
                autoFocus
                className="w-full bg-gray-50 border border-gray-200 rounded-[10px] py-[12px] px-[14px] text-[14px] text-forest outline-none font-[inherit] mb-4"
                onKeyDown={e => e.key === "Enter" && handleSavePreset()}
              />

              <button
                onClick={handleSavePreset}
                disabled={!presetName.trim() || savingPreset}
                className="w-full border-none rounded-[14px] py-[14px] text-[14px] font-medium font-[inherit]"
                style={{
                  background: presetName.trim() ? "#dc2626" : "#f3f4f6",
                  color: presetName.trim() ? "white" : "#9ca3af",
                  cursor: presetName.trim() ? "pointer" : "default",
                }}
              >
                {savingPreset ? "Saving..." : "Save Preset"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
