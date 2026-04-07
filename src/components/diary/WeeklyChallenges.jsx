import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { format } from "date-fns";
import { getToday } from "@/lib/nutritionUtils";
import { WATER_GOAL } from "@/lib/constants";
import { motion } from "framer-motion";

export default function WeeklyChallenges() {
  const { user } = useAuth();
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    loadChallenges();
  }, [user?.id]);

  const loadChallenges = async () => {
    setLoading(true);
    const today = getToday();

    // Start of current week (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - daysFromMonday);
    const weekStart = format(monday, "yyyy-MM-dd");

    const [profileRes, foodLogsRes, exerciseRes, diaryRes] = await Promise.all([
      supabase.from("user_profiles").select("calorie_goal, protein_goal").eq("user_id", user.id).maybeSingle(),
      supabase.from("food_logs").select("date, total_calories, total_protein, water_glasses").eq("user_id", user.id).gte("date", weekStart).lte("date", today),
      supabase.from("exercise_logs").select("date").eq("user_id", user.id).gte("date", weekStart).lte("date", today),
      supabase.from("diary_entries").select("date, mood").eq("user_id", user.id).gte("date", weekStart).lte("date", today).not("mood", "is", null),
    ]);

    const profile = profileRes.data;
    const foodLogs = foodLogsRes.data || [];
    const exercises = exerciseRes.data || [];
    const diaryDays = diaryRes.data || [];

    const calorieGoal = profile?.calorie_goal || 2000;
    const proteinGoal = profile?.protein_goal || 100;

    const exerciseDays = new Set(exercises.map(e => e.date)).size;
    const loggedDays = foodLogs.length;
    const hydrationDays = foodLogs.filter(l => (l.water_glasses || 0) >= WATER_GOAL).length;
    const proteinDays = foodLogs.filter(l => (l.total_protein || 0) >= proteinGoal).length;
    const calorieDays = foodLogs.filter(l => {
      const cal = l.total_calories || 0;
      return cal >= calorieGoal - 150 && cal <= calorieGoal + 150;
    }).length;
    const diaryCount = diaryDays.length;

    setChallenges([
      {
        id: "log",
        emoji: "📋",
        title: "Log every day",
        desc: "Track your food 5 days",
        current: loggedDays,
        target: 5,
        color: "#16a34a",
        bg: "#f0fdf4",
      },
      {
        id: "hydration",
        emoji: "💧",
        title: "Stay hydrated",
        desc: `${WATER_GOAL} glasses/day for 5 days`,
        current: hydrationDays,
        target: 5,
        color: "#3b82f6",
        bg: "#eff6ff",
      },
      {
        id: "protein",
        emoji: "🥩",
        title: "Hit protein goal",
        desc: `${proteinGoal}g protein for 4 days`,
        current: proteinDays,
        target: 4,
        color: "#f59e0b",
        bg: "#fffbeb",
      },
      {
        id: "calories",
        emoji: "🎯",
        title: "Stay on target",
        desc: `Within ±150 kcal of goal for 4 days`,
        current: calorieDays,
        target: 4,
        color: "#8b5cf6",
        bg: "#f5f3ff",
      },
      {
        id: "exercise",
        emoji: "🏃",
        title: "Move your body",
        desc: "Exercise 3 times this week",
        current: exerciseDays,
        target: 3,
        color: "#ef4444",
        bg: "#fef2f2",
      },
      {
        id: "diary",
        emoji: "📓",
        title: "Wellness check",
        desc: "Fill your diary 4 days",
        current: diaryCount,
        target: 4,
        color: "#ec4899",
        bg: "#fdf2f8",
      },
    ]);

    setLoading(false);
  };

  if (loading) return null;

  const completed = challenges.filter(c => c.current >= c.target).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
      className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden"
    >
      <div className="flex items-center gap-2 px-[14px] py-[10px] border-b border-gray-100">
        <div className="w-[26px] h-[26px] rounded-[7px] bg-yellow-100 flex items-center justify-center text-[13px]">🏆</div>
        <span className="text-xs font-medium text-forest">Weekly Challenges</span>
        <span
          className="ml-auto text-[10px] font-medium px-2 py-[2px] rounded-full"
          style={{
            background: completed === challenges.length ? "#dcfce7" : "#f3f4f6",
            color: completed === challenges.length ? "#16a34a" : "#9ca3af",
          }}
        >
          {completed}/{challenges.length} done
        </span>
      </div>

      <div className="p-3 flex flex-col gap-2">
        {challenges.map((c) => {
          const done = c.current >= c.target;
          const pct = Math.min((c.current / c.target) * 100, 100);
          return (
            <div
              key={c.id}
              className="rounded-[12px] px-3 py-[10px]"
              style={{
                background: done ? c.bg : "#f9fafb",
                border: `0.5px solid ${done ? c.color + "33" : "#e5e7eb"}`,
              }}
            >
              <div className="flex items-center gap-2 mb-[6px]">
                <span className="text-[15px]">{c.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[12px] font-semibold text-forest truncate">{c.title}</span>
                    {done ? (
                      <span className="text-[10px] font-semibold shrink-0" style={{ color: c.color }}>✓ Done!</span>
                    ) : (
                      <span className="text-[10px] text-gray-400 shrink-0">{c.current}/{c.target}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-400">{c.desc}</span>
                </div>
              </div>
              <div className="bg-gray-200 rounded-full h-[5px] overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="h-full rounded-full"
                  style={{ background: c.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
