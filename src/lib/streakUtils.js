import { format, subDays, parseISO } from "date-fns";

export async function updateStreak(supabase, userId, todayStr) {
  try {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("current_streak, longest_streak, last_streak_date")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile) return;

    const lastDate = profile.last_streak_date;
    if (lastDate === todayStr) return; // already updated today

    const yesterdayStr = format(subDays(parseISO(todayStr), 1), "yyyy-MM-dd");
    const newStreak = lastDate === yesterdayStr
      ? (profile.current_streak || 0) + 1
      : 1;
    const newLongest = Math.max(newStreak, profile.longest_streak || 0);

    await supabase
      .from("user_profiles")
      .update({
        current_streak: newStreak,
        longest_streak: newLongest,
        last_streak_date: todayStr,
      })
      .eq("user_id", userId);
  } catch {
    // silent fail — streak is non-critical
  }
}
