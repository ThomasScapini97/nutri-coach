import { supabase } from "@/lib/supabase";
import { getToday } from "@/lib/nutritionUtils";
import { format } from "date-fns";
import { WATER_GOAL, CHALLENGE_TARGETS, CALORIES_TOLERANCE } from "@/lib/constants";

export async function updateWeeklyScore(userId) {
  try {
    const today = getToday();

    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - daysFromMonday);
    const weekStart = format(monday, "yyyy-MM-dd");

    const [profileRes, foodLogsRes, exerciseRes, diaryRes] = await Promise.all([
      supabase.from("user_profiles").select("calorie_goal, protein_goal, display_name").eq("user_id", userId).maybeSingle(),
      supabase.from("food_logs").select("date, total_calories, total_protein, water_glasses").eq("user_id", userId).gte("date", weekStart).lte("date", today),
      supabase.from("exercise_logs").select("date").eq("user_id", userId).gte("date", weekStart).lte("date", today),
      supabase.from("diary_entries").select("date, mood").eq("user_id", userId).gte("date", weekStart).lte("date", today).not("mood", "is", null),
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
      return cal >= calorieGoal - CALORIES_TOLERANCE && cal <= calorieGoal + CALORIES_TOLERANCE;
    }).length;
    const diaryCount = diaryDays.length;

    const challenges = [
      { current: loggedDays, target: CHALLENGE_TARGETS.log },
      { current: hydrationDays, target: CHALLENGE_TARGETS.hydration },
      { current: proteinDays, target: CHALLENGE_TARGETS.protein },
      { current: calorieDays, target: CHALLENGE_TARGETS.calories },
      { current: exerciseDays, target: CHALLENGE_TARGETS.exercise },
      { current: diaryCount, target: CHALLENGE_TARGETS.diary },
    ];

    const completedCount = challenges.filter(c => c.current >= c.target).length;
    const todayLogged = foodLogs.some(l => l.date === today && (l.total_calories || 0) > 0);
    const points = completedCount + (completedCount === challenges.length ? 10 : 0) + (todayLogged ? 2 : 0);
    const displayName = profile?.display_name || "Anonymous";

    const { error } = await supabase.from("weekly_scores").upsert({
      user_id: userId,
      display_name: displayName,
      week_start: weekStart,
      challenges_completed: completedCount,
      points,
    }, { onConflict: "user_id,week_start" });

    if (error) console.error("updateWeeklyScore error:", error);

  } catch (e) {
    console.error("updateWeeklyScore failed:", e);
  }
}
