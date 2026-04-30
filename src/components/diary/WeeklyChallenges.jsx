import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { format } from "date-fns";
import { getToday } from "@/lib/nutritionUtils";
import { WATER_GOAL } from "@/lib/constants";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function WeeklyChallenges() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [challenges, setChallenges] = useState([]);
  const [dailyDone, setDailyDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState("");
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    loadChallenges();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadChallenges = async () => {
    setLoading(true);
    const today = getToday();

    // Start of current week (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - daysFromMonday);
    const ws = format(monday, "yyyy-MM-dd");
    setWeekStart(ws);

    const [profileRes, foodLogsRes, exerciseRes, diaryRes] = await Promise.all([
      supabase.from("user_profiles").select("calorie_goal, protein_goal, display_name").eq("user_id", user.id).maybeSingle(),
      supabase.from("food_logs").select("date, total_calories, total_protein, water_glasses").eq("user_id", user.id).gte("date", ws).lte("date", today),
      supabase.from("exercise_logs").select("date").eq("user_id", user.id).gte("date", ws).lte("date", today),
      supabase.from("diary_entries").select("date, mood").eq("user_id", user.id).gte("date", ws).lte("date", today).not("mood", "is", null),
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

    const built = [
      { id: "log", emoji: "📋", title: t("diary.challenges.log.title"), desc: t("diary.challenges.log.desc"), current: loggedDays, target: 5, color: "#16a34a", bg: "#f0fdf4" },
      { id: "hydration", emoji: "💧", title: t("diary.challenges.hydration.title"), desc: t("diary.challenges.hydration.desc", { goal: WATER_GOAL }), current: hydrationDays, target: 5, color: "#3b82f6", bg: "#eff6ff" },
      { id: "protein", emoji: "🥩", title: t("diary.challenges.protein.title"), desc: t("diary.challenges.protein.desc", { goal: proteinGoal }), current: proteinDays, target: 4, color: "#f59e0b", bg: "#fffbeb" },
      { id: "calories", emoji: "🎯", title: t("diary.challenges.calories.title"), desc: t("diary.challenges.calories.desc"), current: calorieDays, target: 4, color: "#8b5cf6", bg: "#f5f3ff" },
      { id: "exercise", emoji: "🏃", title: t("diary.challenges.exercise.title"), desc: t("diary.challenges.exercise.desc"), current: exerciseDays, target: 3, color: "#ef4444", bg: "#fef2f2" },
      { id: "diary", emoji: "📓", title: t("diary.challenges.wellness.title"), desc: t("diary.challenges.wellness.desc"), current: diaryCount, target: 4, color: "#ec4899", bg: "#fdf2f8" },
    ];

    const todayLogged = foodLogs.some(l => l.date === today && (l.total_calories || 0) > 0);
    setDailyDone(todayLogged);
    setChallenges(built);
    setLoading(false);

  };

  const loadLeaderboard = async () => {
    setLeaderboardLoading(true);
    const { data } = await supabase
      .from("weekly_scores")
      .select("user_id, display_name, challenges_completed, points")
      .eq("week_start", weekStart)
      .order("points", { ascending: false })
      .order("challenges_completed", { ascending: false })
      .limit(50);
    setLeaderboard(data || []);
    setLeaderboardLoading(false);
  };

  const handleOpenLeaderboard = () => {
    setShowLeaderboard(true);
    loadLeaderboard();
  };

  if (loading) return null;

  const completed = challenges.filter(c => c.current >= c.target).length;
  const userRank = leaderboard.findIndex(r => r.user_id === user?.id);

  const rankLabel = (i) => {
    if (i === 0) return "🥇";
    if (i === 1) return "🥈";
    if (i === 2) return "🥉";
    return `${i + 1}`;
  };

  return (
    <>
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
            {completed}/{challenges.length} {t("diary.done")}
          </span>
        </div>

        <div className="p-3 flex flex-col gap-2">

          {/* Daily challenge */}
          <span style={{ fontSize: "11px", color: "#9ca3af", fontWeight: 500, paddingLeft: "2px" }}>{t("diary.todayLabel")}</span>
          <div
            style={{
              borderRadius: "12px", padding: "12px 14px",
              background: dailyDone ? "#f0fdf4" : "#fffbeb",
              border: `1.5px solid ${dailyDone ? "#22c55e" : "#fbbf24"}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: "20px" }}>⚡</span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: "13px", fontWeight: 600, color: "#1a3a22", marginBottom: "2px" }}>{t("diary.dailyChallenge")}</p>
                  {dailyDone ? (
                    <p style={{ fontSize: "11px", color: "#16a34a" }}>{t("diary.dailyChallengeDone")}</p>
                  ) : (
                    <p style={{ fontSize: "11px", color: "#92400e" }}>{t("diary.dailyChallengeLog")}</p>
                  )}
                </div>
              </div>
              {!dailyDone && (
                <button
                  onClick={() => navigate("/Chat")}
                  style={{ display: "flex", alignItems: "center", gap: "4px", background: "#f59e0b", color: "white", border: "none", borderRadius: "8px", padding: "6px 10px", fontSize: "11px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}
                >
                  {t("diary.goToChat")} <ArrowRight style={{ width: "12px", height: "12px" }} />
                </button>
              )}
            </div>
          </div>

          {/* Weekly challenges */}
          <span style={{ fontSize: "11px", color: "#9ca3af", fontWeight: 500, paddingLeft: "2px", marginTop: "4px" }}>{t("diary.thisWeek")}</span>

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

          {/* Leaderboard button */}
          <button
            onClick={handleOpenLeaderboard}
            style={{
              width: "100%", background: "#f9fafb", border: "0.5px solid #e5e7eb",
              borderRadius: "12px", padding: "10px", fontSize: "12px",
              color: "#6b7280", cursor: "pointer", fontFamily: "inherit",
              marginTop: "2px",
            }}
          >
            {t("diary.leaderboard")}
          </button>
        </div>
      </motion.div>

      {/* Leaderboard modal */}
      <AnimatePresence>
        {showLeaderboard && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLeaderboard(false)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000 }}
            />

            {/* Bottom sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              style={{
                position: "fixed", bottom: 0, left: 0, right: 0,
                background: "white", borderRadius: "24px 24px 0 0",
                maxHeight: "70vh", display: "flex", flexDirection: "column",
                zIndex: 1001,
              }}
            >
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 16px 10px", borderBottom: "0.5px solid #f3f4f6", flexShrink: 0 }}>
                <div>
                  <p style={{ fontSize: "15px", fontWeight: 600, color: "#1a3a22" }}>{t("diary.weeklyLeaderboard")}</p>
                  <p style={{ fontSize: "11px", color: "#9ca3af" }}>{t("diary.weekOf", { date: weekStart })}</p>
                </div>
                <button
                  onClick={() => setShowLeaderboard(false)}
                  style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#f3f4f6", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <X style={{ width: "16px", height: "16px", color: "#6b7280" }} />
                </button>
              </div>

              {/* List */}
              <div style={{ overflowY: "auto", flex: 1, padding: "10px 16px 24px" }}>
                {leaderboardLoading ? (
                  // Skeleton
                  [0, 1, 2].map(i => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 0", borderBottom: "0.5px solid #f3f4f6" }}>
                      <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#f3f4f6" }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ height: "11px", background: "#f3f4f6", borderRadius: "6px", width: "60%", marginBottom: "5px" }} />
                        <div style={{ height: "9px", background: "#f3f4f6", borderRadius: "6px", width: "35%" }} />
                      </div>
                      <div style={{ width: "36px", height: "24px", background: "#f3f4f6", borderRadius: "8px" }} />
                    </div>
                  ))
                ) : leaderboard.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 0", color: "#9ca3af", fontSize: "13px" }}>
                    {t("diary.noScores")}
                  </div>
                ) : (
                  <>
                    {leaderboard.map((row, i) => {
                      const isMe = row.user_id === user?.id;
                      return (
                        <div
                          key={i}
                          style={{
                            display: "flex", alignItems: "center", gap: "10px",
                            padding: "9px 10px", borderRadius: "12px", marginBottom: "4px",
                            background: isMe ? "#f0fdf4" : "transparent",
                            border: isMe ? "0.5px solid #bbf7d0" : "none",
                          }}
                        >
                          <span style={{ width: "24px", textAlign: "center", fontSize: i < 3 ? "18px" : "12px", fontWeight: 600, color: "#9ca3af", flexShrink: 0 }}>
                            {rankLabel(i)}
                          </span>
                          <span style={{ flex: 1, fontSize: "13px", fontWeight: isMe ? 600 : 400, color: isMe ? "#16a34a" : "#1a3a22", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {row.display_name || "Anonymous"}{isMe ? ` (${t("diary.you")})` : ""}
                          </span>
                          <span style={{ fontSize: "10px", color: "#9ca3af", background: "#f3f4f6", borderRadius: "6px", padding: "2px 6px", flexShrink: 0 }}>
                            {row.challenges_completed}/6
                          </span>
                          <span style={{ fontSize: "13px", fontWeight: 600, color: "#16a34a", minWidth: "36px", textAlign: "right", flexShrink: 0 }}>
                            {row.points}pt
                          </span>
                        </div>
                      );
                    })}

                    {/* Current user not in top 50 */}
                    {userRank === -1 && (() => {
                      const myScore = leaderboard.find(r => r.user_id === user?.id);
                      if (myScore) return null;
                      return (
                        <>
                          <div style={{ textAlign: "center", color: "#d1d5db", fontSize: "12px", padding: "6px 0" }}>· · ·</div>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 10px", borderRadius: "12px", background: "#f0fdf4", border: "0.5px solid #bbf7d0" }}>
                            <span style={{ width: "24px", textAlign: "center", fontSize: "12px", color: "#9ca3af" }}>—</span>
                            <span style={{ flex: 1, fontSize: "13px", fontWeight: 600, color: "#16a34a" }}>{t("diary.you")}</span>
                            <span style={{ fontSize: "10px", color: "#9ca3af", background: "#f3f4f6", borderRadius: "6px", padding: "2px 6px" }}>
                              {challenges.filter(c => c.current >= c.target).length}/6
                            </span>
                            <span style={{ fontSize: "13px", fontWeight: 600, color: "#16a34a", minWidth: "36px", textAlign: "right" }}>
                              {challenges.filter(c => c.current >= c.target).length + (challenges.filter(c => c.current >= c.target).length === challenges.length ? 10 : 0)}pt
                            </span>
                          </div>
                        </>
                      );
                    })()}
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
