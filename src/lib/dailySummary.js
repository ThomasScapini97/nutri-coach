import { supabase } from "@/lib/supabase";
import { format } from "date-fns";

export async function generateDailySummary(userId, date, calorieGoal) {
  try {
    // Skip if summary already exists
    const { data: existing } = await supabase
      .from("daily_summaries")
      .select("id")
      .eq("user_id", userId)
      .eq("date", date)
      .maybeSingle();

    if (existing) return;

    // Fetch food log
    const { data: foodLog } = await supabase
      .from("food_logs")
      .select("*")
      .eq("user_id", userId)
      .eq("date", date)
      .maybeSingle();

    if (!foodLog) return; // No data for this day — nothing to summarize

    // Fetch diary entry (weight, mood)
    const { data: diary } = await supabase
      .from("diary_entries")
      .select("weight, mood, energy")
      .eq("user_id", userId)
      .eq("date", date)
      .maybeSingle();

    // Fetch food entries (list of foods eaten)
    const { data: foodEntries } = await supabase
      .from("food_entries")
      .select("food_name")
      .eq("foodlog_id", foodLog.id);

    const calories = Math.round(foodLog.total_calories || 0);
    const protein = Math.round(foodLog.total_protein || 0);
    const carbs = Math.round(foodLog.total_carbs || 0);
    const fats = Math.round(foodLog.total_fats || 0);
    const burned = Math.round(foodLog.total_burned_calories || 0);

    const goalMet = calorieGoal ? (calories <= calorieGoal ? "✅" : "❌") : "";

    // "6 Apr" label
    const [year, month, day] = date.split("-");
    const dateLabel = format(new Date(Number(year), Number(month) - 1, Number(day)), "d MMM");

    // Unique food names, max 6
    const foodNames = [
      ...new Set((foodEntries || []).map(e => (e.food_name || "").toLowerCase().trim())),
    ]
      .filter(Boolean)
      .slice(0, 6)
      .join(", ");

    let summary = `${dateLabel}: ${calories} kcal`;
    if (calorieGoal) summary += ` (goal ${calorieGoal}${goalMet})`;
    summary += `, P:${protein}g C:${carbs}g F:${fats}g`;
    if (burned > 0) summary += `, burned ${burned} kcal`;
    if (foodNames) summary += `. Ate: ${foodNames}`;
    if (diary?.weight) summary += `. Weight: ${diary.weight}kg`;
    if (diary?.mood) summary += `. Mood: ${diary.mood}`;

    // Hard cap at 220 chars
    if (summary.length > 220) summary = summary.slice(0, 217) + "...";

    await supabase.from("daily_summaries").upsert(
      {
        user_id: userId,
        date,
        summary_text: summary,
        calories,
        protein: foodLog.total_protein || 0,
        carbs: foodLog.total_carbs || 0,
        fats: foodLog.total_fats || 0,
        burned_calories: burned,
        weight: diary?.weight || null,
      },
      { onConflict: "user_id,date" }
    );
  } catch {
    // Silent fail — never break the chat
  }
}

export async function loadPastSummaries(userId) {
  try {
    const { data } = await supabase
      .from("daily_summaries")
      .select("summary_text")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(7);

    return (data || []).map(r => r.summary_text).filter(Boolean);
  } catch {
    return [];
  }
}
