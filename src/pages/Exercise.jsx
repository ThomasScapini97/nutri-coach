import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { motion, AnimatePresence, useMotionValue, animate } from "framer-motion";
import { Flame, Plus, X, Clock, Trash2, TrendingUp, ChevronLeft, ChevronRight, Bookmark, Save, Share2, Send, Download } from "lucide-react";
import { toast } from "sonner";
import html2canvas from 'html2canvas';
import ReactMarkdown from 'react-markdown';
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
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const isToday = dateStr === getToday();
  const isPast = !isToday;

  // Sheet state
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [showPastExerciseChat, setShowPastExerciseChat] = useState(false);
  const [pastExerciseChatMessages, setPastExerciseChatMessages] = useState([]);
  const [pastExerciseChatInput, setPastExerciseChatInput] = useState("");
  const [pastExerciseChatLoading, setPastExerciseChatLoading] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [isExportingBurnCard, setIsExportingBurnCard] = useState(false);
  const [exportingExerciseCard, setExportingExerciseCard] = useState(null);
  const sheetExerciseY = useMotionValue(0);

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
  const burnCardRef = useRef(null);
  const exerciseCardRefs = useRef({});
  const pastExerciseChatEndRef = useRef(null);

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
        content: `${selectedExercise.emoji} **${selectedExercise.name}** logged: ${activityLabel} · ${calories} kcal burned`,
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
          content: `🗑️ **${exercise.exercise_name}** removed (${exercise.calories_burned} kcal)`,
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
        content: `💾 **${preset.name}** preset logged: ${preset.exercises.length} exercises · ${totalCals} kcal burned`,
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

  // ─── Effects ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    setPastExerciseChatMessages([]);
    setShowPastExerciseChat(false);
  }, [dateStr]);

  useEffect(() => {
    pastExerciseChatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [pastExerciseChatMessages, pastExerciseChatLoading]);

  // ─── Past exercise chat handler ───────────────────────────────────────────────

  const handlePastExerciseChatSend = async () => {
    const text = pastExerciseChatInput.trim();
    if (!text || pastExerciseChatLoading) return;
    setPastExerciseChatInput("");
    const userMsg = { role: "user", content: text, id: crypto.randomUUID() };
    setPastExerciseChatMessages(prev => [...prev, userMsg]);
    setPastExerciseChatLoading(true);
    try {
      const pastExerciseSystemPrompt = `You are NutriCoach, a fitness tracking assistant.
The user is logging exercise they did on ${format(selectedDate, 'EEEE, MMMM d, yyyy')}.
Parse what they did and return exercise data.
Always respond in the same language the user writes in.
Be concise — confirm what you logged in 1-2 lines.

User stats: weight ${weight}kg, age ${age}, height ${height}cm, gender ${gender}

MET values for calorie calculation (calories = MET × 3.5 × weight_kg / 200 × minutes):
- Running 8km/h: MET 8, 10km/h: MET 10, 12km/h: MET 12
- Walking: MET 3.5-5.5
- Cycling: MET 6-10
- Swimming: MET 8
- HIIT: MET 10
- Gym/weights: MET 4.5-6 (use sets × 1.5 min as duration)
- Yoga: MET 2.5
- Football/Basketball: MET 6.5-7

Default durations if not specified:
- Run/walk/cycle: 30 min
- Gym session: 3 sets per exercise
- Yoga/stretching: 45 min

NEVER ask for more info — always estimate and log.

Response format (JSON only):
{
  "message": "confirmation",
  "exercises": [
    {
      "exercise_name": "Running",
      "exercise_type": "cardio-speed",
      "duration_minutes": 30,
      "speed_kmh": 10,
      "calories_burned": 280,
      "sets": null,
      "reps": null,
      "weight_kg": null
    }
  ]
}`;

      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          system: pastExerciseSystemPrompt,
          messages: [{ role: "user", content: text }],
        }),
      });
      const data = await response.json();
      const rawText = data.content?.[0]?.text || '{"message":"Sorry, could not process.","exercises":[]}';
      let result;
      try {
        const cleaned = rawText.replace(/```json|```/g, "").trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        result = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        if (!result?.message) throw new Error("Invalid");
      } catch {
        result = { message: rawText, exercises: [] };
      }
      setPastExerciseChatMessages(prev => [...prev, { role: "assistant", content: result.message, id: crypto.randomUUID() }]);
      const exercises = Array.isArray(result.exercises) ? result.exercises : [];
      if (exercises.length > 0) {
        const logId = await ensureFoodLog();
        if (logId) {
          let totalCals = 0;
          for (const ex of exercises) {
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
          queryClient.invalidateQueries({ queryKey: ["exercises", dateStr] });
          queryClient.invalidateQueries({ queryKey: ["exercises-week"] });
          queryClient.invalidateQueries({ queryKey: ["foodlog"] });
          toast.success(`Added to ${format(selectedDate, 'MMM d')} ✅`);
        }
      }
    } catch (err) {
      console.error("Past exercise chat error:", err);
      setPastExerciseChatMessages(prev => [...prev, { role: "assistant", content: "Sorry, something went wrong.", id: crypto.randomUUID() }]);
    } finally {
      setPastExerciseChatLoading(false);
    }
  };

  // ─── Share card helpers ───────────────────────────────────────────────────────

  const buildCardBlob = async (ref, radius = 40) => {
    const cardEl = ref.current;
    if (!cardEl) return null;
    const raw = await html2canvas(cardEl, { backgroundColor: null, scale: 2, useCORS: true, logging: false });
    const r = radius;
    const w = raw.width, h = raw.height;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(r, 0); ctx.lineTo(w - r, 0); ctx.quadraticCurveTo(w, 0, w, r);
    ctx.lineTo(w, h - r); ctx.quadraticCurveTo(w, h, w - r, h);
    ctx.lineTo(r, h); ctx.quadraticCurveTo(0, h, 0, h - r);
    ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.closePath(); ctx.clip(); ctx.drawImage(raw, 0, 0);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  };

  const shareBurnCard = async () => {
    setIsExportingBurnCard(true);
    await new Promise(r => setTimeout(r, 60));
    try {
      const blob = await buildCardBlob(burnCardRef);
      if (!blob) return;
      const file = new File([blob], 'nutricoach-burn.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: "Today's Burn — NutriCoach", files: [file] });
        toast.success('Shared! 🎉');
      } else {
        toast.error('Sharing not supported on this device');
      }
    } catch (err) {
      if (err?.name !== 'AbortError') console.error('Share failed:', err);
    }
    setIsExportingBurnCard(false);
  };

  const saveBurnCard = async () => {
    setIsExportingBurnCard(true);
    await new Promise(r => setTimeout(r, 60));
    try {
      const blob = await buildCardBlob(burnCardRef);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'nutricoach-burn.png'; a.click();
      URL.revokeObjectURL(url);
      toast.success('Saved! 📸');
    } catch (err) { console.error('Save failed:', err); }
    setIsExportingBurnCard(false);
  };

  const shareExerciseCard = async (exerciseId) => {
    setExportingExerciseCard(exerciseId);
    await new Promise(r => setTimeout(r, 60));
    try {
      const ref = { current: exerciseCardRefs.current[exerciseId] };
      const blob = await buildCardBlob(ref);
      if (!blob) return;
      const file = new File([blob], 'nutricoach-exercise.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: "Exercise — NutriCoach", files: [file] });
        toast.success('Shared! 🎉');
      } else {
        toast.error('Sharing not supported on this device');
      }
    } catch (err) {
      if (err?.name !== 'AbortError') console.error('Share failed:', err);
    }
    setExportingExerciseCard(null);
  };

  const saveExerciseCard = async (exerciseId) => {
    setExportingExerciseCard(exerciseId);
    await new Promise(r => setTimeout(r, 60));
    try {
      const ref = { current: exerciseCardRefs.current[exerciseId] };
      const blob = await buildCardBlob(ref);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'nutricoach-exercise.png'; a.click();
      URL.revokeObjectURL(url);
      toast.success('Saved! 📸');
    } catch (err) { console.error('Save failed:', err); }
    setExportingExerciseCard(null);
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[100dvh] bg-mint">

      {/* Date navigator */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center bg-white border-b border-gray-200 shadow-[0_1px_4px_rgba(0,0,0,0.06)] px-4 py-[14px]" style={{ paddingTop: 'calc(14px + env(safe-area-inset-top, 0px))' }}>
        <button onClick={() => navigateDay(-1)} className="absolute left-[56px] bg-transparent border-none flex items-center justify-center cursor-pointer p-1">
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className="text-center">
          <h2 className="text-base font-semibold text-forest leading-[1.2] m-0">
            {isToday ? t("exercise.today") : format(selectedDate, "MMM d, yyyy")}
          </h2>
          <p className="text-[11px] text-gray-400 m-0">
            {totalBurnedToday} {t("exercise.kcalBurned")}
          </p>
        </div>
        <div className="absolute right-4 flex items-center gap-3">
          <button onClick={() => navigateDay(1)} disabled={isToday} className={`bg-transparent border-none flex items-center justify-center p-1 ${isToday ? "opacity-30 cursor-default" : "cursor-pointer"}`}>
            <ChevronRight className="w-5 h-5 text-gray-500" />
          </button>
          <button onClick={() => setShowShareSheet(true)} className="bg-transparent border-none flex items-center justify-center cursor-pointer p-1">
            <Share2 className="w-[18px] h-[18px] text-gray-400" />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div
        className="flex-1 overflow-y-auto md:pt-0"
        style={{
          paddingTop: 'calc(60px + env(safe-area-inset-top, 0px))',
          paddingBottom: 'calc(180px + env(safe-area-inset-bottom))',
        }}
      >
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
                <p className="text-[11px] text-white/65 mt-[2px] m-0">{t("exercise.kcalGoal", { value: burnGoal })}</p>
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
                  {activeDaysThisWeek >= activeDaysGoal ? t("exercise.weeklyGoalReached") : t("exercise.weeklyActivityGoal")}
                </p>
                <p className="text-[11px] text-gray-400 m-0">
                  {t("exercise.activeDaysInfo", { active: activeDaysThisWeek, goal: activeDaysGoal, burnGoal })}
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
              <p className="text-[13px] font-medium text-forest m-0">{t("exercise.savedWorkouts")}</p>
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
                      <span className="text-[10px] text-red-600 font-medium">{t("exercise.logAll")}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-[14px] border border-black/[0.06] px-4 py-5 text-center">
                <p className="text-[13px] text-gray-400 font-medium m-0 mb-1">{t("exercise.noSavedWorkouts")}</p>
                <p className="text-[11px] text-gray-400 m-0">{t("exercise.noSavedWorkoutsDesc")}</p>
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
            {t("exercise.logExercise")}
          </motion.button>

          {/* Exercise list */}
          {dayExercises.length > 0 ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className=""
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px", padding: "0 2px" }}>
                <p className="text-[13px] font-medium text-forest m-0">
                  🏃 {isToday ? t("exercise.todayExercises") : t("exercise.exercisesLogged")}
                </p>
                {isPast && (
                  <button
                    onClick={() => setShowPastExerciseChat(true)}
                    style={{
                      width: "26px", height: "26px", borderRadius: "50%",
                      background: "#ef4444", border: "none",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer",
                      boxShadow: "0 2px 6px rgba(239,68,68,0.3)",
                    }}
                  >
                    <Plus style={{ width: "14px", height: "14px", color: "white" }} />
                  </button>
                )}
              </div>
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
                  {t("exercise.saveSessionPreset")}
                </button>
              )}
            </motion.div>
          ) : (
            <div className="text-center p-6 bg-white rounded-2xl border border-black/[0.06]">
              <p className="text-[32px] mb-2">🏃</p>
              <p className="text-[13px] font-medium text-forest mb-1 m-0">
                {t("exercise.noExerciseYet")}
              </p>
              <p className="text-xs text-gray-400 m-0">
                {t("exercise.noExerciseYetDesc")}
              </p>
              {isPast && (
                <button
                  onClick={() => setShowPastExerciseChat(true)}
                  style={{
                    marginTop: "12px",
                    background: "#ef4444", border: "none", borderRadius: "10px",
                    padding: "8px 16px", color: "white", fontSize: "13px",
                    fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                    display: "inline-flex", alignItems: "center", gap: "6px",
                    boxShadow: "0 2px 8px rgba(239,68,68,0.3)",
                  }}
                >
                  <Plus style={{ width: "14px", height: "14px" }} />
                  Add past exercises
                </button>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Bottom chart — fixed above navbar */}
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
          maxWidth: '480px',
          margin: '0 auto',
        }}>
          <div className="flex items-center justify-between mb-[10px]">
            <div className="flex items-center gap-[6px]">
              <TrendingUp className="w-[14px] h-[14px] text-red-600" />
              <span className="text-[13px] font-medium text-forest">{t("exercise.weeklyBurnedTitle")}</span>
            </div>
            <div className="flex gap-2">
              {[
                { color: "#16a34a", label: t("exercise.onTrack") },
                { color: "#f59e0b", label: t("exercise.chartClose") },
                { color: "#ef4444", label: t("exercise.offTrack") },
                { color: "#e5e7eb", label: t("exercise.rest") },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-[3px]">
                  <div className="w-[6px] h-[6px] rounded-[2px] shrink-0" style={{ background: color }} />
                  <span className="text-[9px] text-gray-400">{label}</span>
                </div>
              ))}
            </div>
          </div>
          <ScrollableExerciseChart burnGoal={burnGoal} selectedDate={dateStr} />
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
                  <p className="text-[15px] font-medium text-forest m-0">{t("exercise.logExerciseSheet")}</p>
                  <p className="text-[11px] text-gray-400 m-0">{t("exercise.yourWeight", { value: weight })}</p>
                </div>
                <button onClick={() => { setShowAddSheet(false); resetForm(); }} className="bg-gray-100 border-none rounded-full w-7 h-7 cursor-pointer flex items-center justify-center p-0">
                  <X className="w-[14px] h-[14px] text-gray-500" />
                </button>
              </div>

              {/* Type selector */}
              <div className="flex gap-[4px] mb-4 bg-gray-100 rounded-[12px] p-[3px]">
                {[
                  { id: "cardio-speed", label: t("exercise.speedTab"), emoji: "🏃" },
                  { id: "cardio", label: t("exercise.cardioTab"), emoji: "⚡" },
                  { id: "strength", label: t("exercise.weightsTab"), emoji: "🏋️" },
                  { id: "flexibility", label: t("exercise.flexTab"), emoji: "🧘" },
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
              <p className="text-[11px] text-gray-400 mb-2 uppercase tracking-[0.3px] m-0">{t("exercise.chooseExercise")}</p>
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
                  <p className="text-[11px] text-gray-400 mb-2 uppercase tracking-[0.3px] m-0">{t("exercise.speedOptional")}</p>
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
                    placeholder={t("exercise.customKmh")}
                    className="w-full bg-gray-50 border border-gray-200 rounded-[10px] py-[10px] px-[14px] text-[14px] text-forest outline-none font-[inherit] mt-2"
                  />
                </div>
              )}

              {/* ── Duration (cardio-speed, cardio, flexibility) ── */}
              {exerciseType !== "strength" && (
                <>
                  <p className="text-[11px] text-gray-400 mb-2 uppercase tracking-[0.3px] m-0">{t("exercise.durationLabel")}</p>
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
                      placeholder={t("exercise.customMinutes")}
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
                      <p className="text-[11px] text-gray-400 mb-1 uppercase tracking-[0.3px] m-0">{t("exercise.sets")}</p>
                      <input
                        type="number" value={sets} onChange={e => setSets(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-[10px] py-[10px] px-[10px] text-[14px] text-forest outline-none font-[inherit] text-center"
                      />
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-400 mb-1 uppercase tracking-[0.3px] m-0">{t("exercise.reps")}</p>
                      <input
                        type="number" value={reps} onChange={e => setReps(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-[10px] py-[10px] px-[10px] text-[14px] text-forest outline-none font-[inherit] text-center"
                      />
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-400 mb-1 uppercase tracking-[0.3px] m-0">{t("exercise.kgOptional")}</p>
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
                    {!strengthWeight && <span className="text-[11px] text-red-400">{t("exercise.bodweightEstimate")}</span>}
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
                {saving ? t("exercise.saving") : canSave() ? t("exercise.logKcalBurned", { value: previewCalories }) : t("exercise.selectDetails")}
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
                  <p className="text-[15px] font-medium text-forest m-0">{t("exercise.saveWorkoutPreset")}</p>
                  <p className="text-[11px] text-gray-400 m-0">{t("exercise.exercisesWillBeSaved", { count: dayExercises.length })}</p>
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

              <p className="text-[11px] text-gray-400 mb-2 uppercase tracking-[0.3px] m-0">{t("exercise.presetNameLabel")}</p>
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
                {savingPreset ? t("exercise.saving") : t("exercise.savePresetBtn")}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Past exercise mini chat ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showPastExerciseChat && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 60 }}
              onClick={() => setShowPastExerciseChat(false)}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 61,
                background: 'white', borderRadius: '24px 24px 0 0',
                height: '60vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
              }}
            >
              <div style={{ padding: '16px 16px 10px', borderBottom: '0.5px solid rgba(0,0,0,0.06)', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 600, fontSize: '15px', color: '#dc2626' }}>
                      Add exercise to {format(selectedDate, 'MMM d')}
                    </p>
                    <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>
                      Tell me what exercise you did on this day
                    </p>
                  </div>
                  <button onClick={() => setShowPastExerciseChat(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#9ca3af' }}>
                    <X style={{ width: '20px', height: '20px' }} />
                  </button>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {pastExerciseChatMessages.length === 0 && (
                  <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '13px', marginTop: '24px' }}>
                    What did you do? 🏃
                  </p>
                )}
                {pastExerciseChatMessages.map(msg => (
                  <div
                    key={msg.id}
                    style={{
                      alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '80%',
                      background: msg.role === 'user' ? '#ef4444' : '#f3f4f6',
                      color: msg.role === 'user' ? 'white' : '#111827',
                      borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      padding: '10px 14px', fontSize: '14px', lineHeight: '1.4',
                    }}
                  >
                    {msg.role === 'assistant' ? (
                      <div className="prose prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : msg.content}
                  </div>
                ))}
                {pastExerciseChatLoading && (
                  <div style={{ alignSelf: 'flex-start', background: '#f3f4f6', borderRadius: '18px 18px 18px 4px', padding: '10px 14px' }}>
                    <span style={{ color: '#9ca3af', fontSize: '14px' }}>...</span>
                  </div>
                )}
                <div ref={pastExerciseChatEndRef} />
              </div>
              <div style={{ padding: '10px 12px', borderTop: '0.5px solid rgba(0,0,0,0.06)', display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0, paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}>
                <input
                  type="text"
                  value={pastExerciseChatInput}
                  onChange={e => setPastExerciseChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handlePastExerciseChatSend(); }}
                  placeholder="e.g. ran 5km at 10km/h"
                  style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: '9999px', padding: '10px 16px', fontSize: '14px', outline: 'none', background: '#f9fafb' }}
                />
                <button
                  onClick={handlePastExerciseChatSend}
                  disabled={!pastExerciseChatInput.trim() || pastExerciseChatLoading}
                  style={{
                    width: '38px', height: '38px', borderRadius: '50%',
                    background: pastExerciseChatInput.trim() && !pastExerciseChatLoading ? '#ef4444' : '#e5e7eb',
                    border: 'none', cursor: pastExerciseChatInput.trim() && !pastExerciseChatLoading ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s',
                  }}
                >
                  <Send style={{ width: '16px', height: '16px', color: pastExerciseChatInput.trim() && !pastExerciseChatLoading ? 'white' : '#9ca3af' }} />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Share sheet ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showShareSheet && (
          <motion.div
            className="fixed inset-0 z-[9999] flex items-end justify-center"
            style={{ background: "rgba(0,0,0,0.6)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowShareSheet(false)}
          >
            <motion.div
              className="w-full max-w-[480px] bg-white rounded-t-[28px] max-h-[85vh] flex flex-col"
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              style={{ y: sheetExerciseY }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 1 }}
              dragTransition={{ bounceStiffness: 600, bounceDamping: 30 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 80 || info.velocity.y > 300) {
                  animate(sheetExerciseY, window.innerHeight, { duration: 0.25, ease: "easeIn" })
                    .then(() => { setShowShareSheet(false); sheetExerciseY.set(0); });
                } else {
                  animate(sheetExerciseY, 0, { duration: 0.2, ease: "easeOut" });
                }
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Handle bar */}
              <div
                onClick={() => setShowShareSheet(false)}
                style={{ display: "flex", justifyContent: "center", padding: "12px 0 8px", cursor: "grab", flexShrink: 0 }}
              >
                <div style={{ width: "40px", height: "4px", borderRadius: "2px", background: "#d1d5db" }} />
              </div>

              {/* Scrollable content */}
              <div className="overflow-y-auto px-4 pb-10" onPointerDown={e => e.stopPropagation()}>
                <div className="rounded-[20px] p-4 space-y-3" style={{ background: "linear-gradient(135deg, #fff1f2, #ffe4e6)" }}>
                  <div className="flex items-center gap-3 pb-1">
                    <span className="text-2xl">🔥</span>
                    <div>
                      <p className="font-semibold text-forest text-sm m-0">NutriCoach</p>
                      <p className="text-[11px] text-gray-400 m-0">{isToday ? t("exercise.today") : format(selectedDate, "EEEE, d MMM yyyy")}</p>
                    </div>
                  </div>

                  {/* Burn card */}
                  <div ref={burnCardRef} className="bg-white rounded-2xl p-4 shadow-md border border-black/[0.08]" style={{ position: 'relative' }}>
                    {!isExportingBurnCard && (
                      <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '6px', zIndex: 1 }}>
                        {navigator.share && (
                          <button onClick={shareBurnCard} style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#f3f4f6', border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                            <Share2 style={{ width: '13px', height: '13px', color: '#6b7280' }} />
                          </button>
                        )}
                        <button onClick={saveBurnCard} style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#f3f4f6', border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <Download style={{ width: '13px', height: '13px', color: '#6b7280' }} />
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">🔥</span>
                      <p className="text-sm font-semibold text-forest m-0">Today's Burn</p>
                    </div>
                    <div className="flex items-baseline gap-1 mb-2">
                      <span style={{ fontSize: '28px', fontWeight: 700, color: '#dc2626', lineHeight: 1 }}>{totalBurnedToday}</span>
                      <span style={{ fontSize: '12px', color: '#9ca3af' }}>/ {burnGoal} kcal</span>
                    </div>
                    <div style={{ background: '#e5e7eb', borderRadius: '9999px', height: '5px', overflow: 'hidden', marginBottom: '12px' }}>
                      <div style={{ width: `${Math.min((totalBurnedToday / burnGoal) * 100, 100)}%`, background: '#ef4444', height: '100%', borderRadius: '9999px' }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>🎯 Active days this week:</span>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#1a3a22' }}>{activeDaysThisWeek}/{activeDaysGoal}</span>
                    </div>
                    {dayExercises.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                        {dayExercises.map((e, i) => {
                          const ex = EXERCISES.find(x => x.name === e.exercise_name);
                          return (
                            <span key={i} style={{ fontSize: '10px', background: '#fef2f2', color: '#dc2626', padding: '2px 8px', borderRadius: '9999px', border: '0.5px solid #fecaca' }}>
                              {ex?.emoji || "💪"} {e.exercise_name}
                            </span>
                          );
                        })}
                      </div>
                    )}
                    <p style={{ fontSize: '11px', fontWeight: 600, color: '#ef4444', letterSpacing: '0.2px', textAlign: 'right', marginTop: '8px', marginBottom: 0 }}>@nutricoach.app</p>
                  </div>

                  {/* Per-exercise cards */}
                  {dayExercises.map((exercise) => {
                    const ex = EXERCISES.find(e => e.name === exercise.exercise_name);
                    return (
                      <div
                        key={exercise.id}
                        ref={el => { exerciseCardRefs.current[exercise.id] = el; }}
                        className="bg-white rounded-2xl p-4 shadow-md border border-black/[0.08]"
                        style={{ position: 'relative' }}
                      >
                        {exportingExerciseCard !== exercise.id && (
                          <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '6px', zIndex: 1 }}>
                            {navigator.share && (
                              <button onClick={() => shareExerciseCard(exercise.id)} style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#f3f4f6', border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                <Share2 style={{ width: '13px', height: '13px', color: '#6b7280' }} />
                              </button>
                            )}
                            <button onClick={() => saveExerciseCard(exercise.id)} style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#f3f4f6', border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                              <Download style={{ width: '13px', height: '13px', color: '#6b7280' }} />
                            </button>
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                          <span style={{ fontSize: '28px' }}>{ex?.emoji || "💪"}</span>
                          <p style={{ fontSize: '15px', fontWeight: 600, color: '#1a3a22', margin: 0 }}>{exercise.exercise_name}</p>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                          {exercise.duration_minutes > 0 && (
                            <span style={{ fontSize: '12px', background: '#fef2f2', color: '#dc2626', padding: '3px 10px', borderRadius: '9999px' }}>⏱ {exercise.duration_minutes} min</span>
                          )}
                          {exercise.speed_kmh > 0 && (
                            <span style={{ fontSize: '12px', background: '#fef2f2', color: '#dc2626', padding: '3px 10px', borderRadius: '9999px' }}>🏃 {exercise.speed_kmh} km/h</span>
                          )}
                          {exercise.sets && exercise.reps && (
                            <span style={{ fontSize: '12px', background: '#fef2f2', color: '#dc2626', padding: '3px 10px', borderRadius: '9999px' }}>💪 {exercise.sets}×{exercise.reps}{exercise.weight_kg ? ` · ${exercise.weight_kg}kg` : ""}</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Flame style={{ width: '16px', height: '16px', color: '#ef4444' }} />
                          <span style={{ fontSize: '20px', fontWeight: 700, color: '#dc2626' }}>{exercise.calories_burned}</span>
                          <span style={{ fontSize: '12px', color: '#9ca3af' }}>kcal burned</span>
                        </div>
                        <p style={{ fontSize: '11px', fontWeight: 600, color: '#ef4444', letterSpacing: '0.2px', textAlign: 'right', marginTop: '8px', marginBottom: 0 }}>@nutricoach.app</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
