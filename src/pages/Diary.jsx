import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { format, subDays } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Minus, Plus, Calendar, X } from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { getToday } from "@/lib/nutritionUtils";
import WeeklyChallenges from "@/components/diary/WeeklyChallenges";

const MOODS = [
  {
    value: 1, label: "Bad",
    color: "#dc2626", bg: "#fee2e2", selectedBg: "#fecaca",
    icon: (color) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M16 16s-1.5-2-4-2-4 2-4 2"/>
        <line x1="9" y1="9" x2="9.01" y2="9"/>
        <line x1="15" y1="9" x2="15.01" y2="9"/>
      </svg>
    )
  },
  {
    value: 2, label: "Meh",
    color: "#c2410c", bg: "#fed7aa", selectedBg: "#fdba74",
    icon: (color) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="8" y1="15" x2="16" y2="15"/>
        <line x1="9" y1="9" x2="9.01" y2="9"/>
        <line x1="15" y1="9" x2="15.01" y2="9"/>
      </svg>
    )
  },
  {
    value: 3, label: "Good",
    color: "#16a34a", bg: "#bbf7d0", selectedBg: "#86efac",
    icon: (color) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M8 13s1.5 2 4 2 4-2 4-2"/>
        <line x1="9" y1="9" x2="9.01" y2="9"/>
        <line x1="15" y1="9" x2="15.01" y2="9"/>
      </svg>
    )
  },
  {
    value: 4, label: "Great",
    color: "#059669", bg: "#d1fae5", selectedBg: "#a7f3d0",
    icon: (color) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M8 13s1.5 3 4 3 4-3 4-3"/>
        <line x1="9" y1="9" x2="9.01" y2="9"/>
        <line x1="15" y1="9" x2="15.01" y2="9"/>
      </svg>
    )
  },
  {
    value: 5, label: "Amazing",
    color: "#ca8a04", bg: "#fef9c3", selectedBg: "#fef08a",
    icon: (color) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M8 13s1.5 3 4 3 4-3 4-3"/>
        <path d="M9 8.5c0 0 .5 1 1.5 1s1.5-1 1.5-1"/>
        <path d="M13 8.5c0 0 .5 1 1.5 1s1.5-1 1.5-1"/>
      </svg>
    )
  },
];

const emptyForm = { mood: null, notes: "", weight: "" };

function SkeletonDiary() {
  return (
    <div className="max-w-[480px] mx-auto p-4 flex flex-col gap-[10px]">
      <div className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden p-4 animate-pulse">
        <div style={{ height: "16px", background: "#f3f4f6", borderRadius: "8px", width: "40%", marginBottom: "16px" }} />
        <div style={{ height: "48px", background: "#f3f4f6", borderRadius: "8px", width: "60%", margin: "0 auto 16px" }} />
        <div style={{ height: "8px", background: "#f3f4f6", borderRadius: "8px", marginBottom: "8px" }} />
        <div style={{ height: "80px", background: "#f3f4f6", borderRadius: "8px" }} />
      </div>
      <div className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden p-4 animate-pulse">
        <div style={{ height: "16px", background: "#f3f4f6", borderRadius: "8px", width: "50%", marginBottom: "16px" }} />
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} style={{ flex: 1, height: "60px", background: "#f3f4f6", borderRadius: "10px" }} />
          ))}
        </div>
        <div style={{ height: "40px", background: "#f3f4f6", borderRadius: "8px" }} />
      </div>
      <div className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden p-4 animate-pulse">
        <div style={{ height: "16px", background: "#f3f4f6", borderRadius: "8px", width: "60%", marginBottom: "16px" }} />
        {[1,2,3].map(i => (
          <div key={i} style={{ height: "48px", background: "#f3f4f6", borderRadius: "10px", marginBottom: "8px" }} />
        ))}
      </div>
    </div>
  );
}

export default function Diary() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const isToday = dateStr === getToday();
  const isPast = !isToday;
  const [form, setForm] = useState(emptyForm);
  const [saved, setSaved] = useState(false);
  const chartRange = 30;
  const [chartRefreshTrigger, setChartRefreshTrigger] = useState(0);
  const isLoadingRef = useRef(true);
  const debounceRef = useRef(null);
  const [chartData, setChartData] = useState([]);
  const [lastWeight, setLastWeight] = useState(null);
  const [weightGoal, setWeightGoal] = useState(null);
  const [startWeight, setStartWeight] = useState(null);
  const [pageReady, setPageReady] = useState(false);
  const [weekMoods, setWeekMoods] = useState([]);
  const [showNotesHistory, setShowNotesHistory] = useState(false);
  const [pastNotes, setPastNotes] = useState([]);

  useEffect(() => {
    if (!user?.id) return;

    const loadData = async () => {
      const { data: profileData } = await supabase
        .from("user_profiles")
        .select("weight_goal, weight")
        .eq("user_id", user.id)
        .maybeSingle();
      setWeightGoal(profileData?.weight_goal || null);
      setStartWeight(profileData?.weight || null);

      const { data: lastData } = await supabase
        .from("diary_entries").select("weight").eq("user_id", user.id)
        .lt("date", dateStr).not("weight", "is", null)
        .order("date", { ascending: false }).limit(1);
      const prevWeight = lastData?.[0]?.weight || null;
      setLastWeight(prevWeight);

      const { data } = await supabase
        .from("diary_entries").select("*").eq("user_id", user.id).eq("date", dateStr).maybeSingle();

      if (data) {
        setForm({
          mood: data.mood || null,
          notes: data.notes || "",
          weight: data.weight ? String(data.weight) : (prevWeight ? String(prevWeight) : ""),
        });
      } else {
        setForm({ ...emptyForm, weight: prevWeight ? String(prevWeight) : "" });
      }
    };

    isLoadingRef.current = true;
    loadData().then(() => { isLoadingRef.current = false; setPageReady(true); });
  }, [dateStr, user?.id]);

  useEffect(() => { setPageReady(false); }, [dateStr]);

  // Mood strip
  useEffect(() => {
    if (!user?.id) return;
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return format(d, "yyyy-MM-dd");
    });
    supabase
      .from("diary_entries")
      .select("date, mood")
      .eq("user_id", user.id)
      .in("date", days)
      .then(({ data }) => {
        const map = {};
        (data || []).forEach(d => { map[d.date] = d.mood; });
        setWeekMoods(days.map(date => ({ date, mood: map[date] || null })));
      });
  }, [user?.id, dateStr]);


  const handleMoodSelect = (value) => {
    setForm(f => ({ ...f, mood: value }));
    setWeekMoods(prev => prev.map(d =>
      d.date === getToday() ? { ...d, mood: value } : d
    ));
  };

  // Auto-save with 800ms debounce
  useEffect(() => {
    if (isPast || isLoadingRef.current || !user?.id) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const payload = {
        user_id: user.id, date: dateStr,
        mood: form.mood,
        energy: null, sleep_quality: null, stress: null,
        notes: form.notes || null,
        weight: form.weight ? Number(form.weight) : null,
        waist: null, hips: null, chest: null, arm: null, thigh: null,
      };
      const { error } = await supabase.from("diary_entries").upsert(payload, { onConflict: "user_id,date" });
      if (error) { toast.error("Error saving entry"); }
      else { setSaved(true); setTimeout(() => setSaved(false), 2000); setChartRefreshTrigger(prev => prev + 1); }
    }, 800);
    return () => clearTimeout(debounceRef.current);
  }, [form, isPast, user?.id, dateStr]);

  useEffect(() => {
    if (!user?.id) return;
    const from = format(subDays(new Date(), chartRange), "yyyy-MM-dd");
    supabase.from("diary_entries").select("date, weight").eq("user_id", user.id)
      .gte("date", from).lte("date", getToday()).not("weight", "is", null).order("date")
      .then(({ data }) => {
        setChartData((data || []).map(d => ({
          date: format(new Date(d.date + "T12:00:00"), "d MMM"),
          weight: Number(d.weight),
        })));
      });
  }, [chartRange, user?.id, dateStr, chartRefreshTrigger]);

  const navigateDay = (dir) => {
    setSelectedDate(prev => {
      const next = new Date(prev);
      next.setDate(next.getDate() + dir);
      return next;
    });
  };

  const adjustWeight = (delta) => {
    if (isPast) return;
    const current = parseFloat(form.weight) || 0;
    const newVal = Math.max(0, Math.round((current + delta) * 10) / 10);
    setForm(f => ({ ...f, weight: String(newVal) }));
  };

  const loadPastNotes = async () => {
    const { data } = await supabase
      .from("diary_entries")
      .select("date, mood, notes")
      .eq("user_id", user.id)
      .not("notes", "is", null)
      .neq("notes", "")
      .order("date", { ascending: false })
      .limit(30);
    setPastNotes(data || []);
  };

  const handleOpenHistory = () => {
    setShowNotesHistory(true);
    loadPastNotes();
  };

  const weightDiff = form.weight && lastWeight
    ? (Number(form.weight) - Number(lastWeight)).toFixed(1)
    : null;

  const toGoal = form.weight && weightGoal
    ? (Number(form.weight) - Number(weightGoal)).toFixed(1)
    : null;

  const weightProgress = (() => {
    if (!form.weight || !weightGoal || !startWeight) return null;
    const current = Number(form.weight);
    const goal = Number(weightGoal);
    const start = Number(startWeight);
    if (start === goal) return null;
    const losing = goal < start;
    const raw = losing
      ? ((start - current) / (start - goal)) * 100
      : ((current - start) / (goal - start)) * 100;
    return Math.min(Math.max(raw, 0), 100);
  })();

  const goalReached = weightProgress !== null && weightProgress >= 100;

  return (
    <div className="flex flex-col h-[100dvh] bg-mint">

      {/* Date navigator */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center bg-white border-b border-gray-200 shadow-[0_1px_4px_rgba(0,0,0,0.06)] px-4 py-[14px]" style={{ paddingTop: 'calc(14px + env(safe-area-inset-top, 0px))' }}>
        <button onClick={() => navigateDay(-1)} className="absolute left-[56px] bg-transparent border-none flex items-center justify-center cursor-pointer p-1">
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className="text-center">
          <h2 className="text-base font-semibold text-forest leading-[1.2] m-0">
            {isToday ? t("diary.today") : format(selectedDate, "MMM d, yyyy")}
          </h2>
          <AnimatePresence mode="wait">
            {saved ? (
              <motion.p key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[11px] m-0" style={{ color: "#16a34a" }}>
                {t("diary.saved")}
              </motion.p>
            ) : (
              <motion.p key="subtitle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[11px] text-gray-400 m-0">
                {isToday ? t("diary.autoSaved") : t("diary.pastEntry")}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        <button onClick={() => navigateDay(1)} disabled={isToday} className={`absolute right-4 bg-transparent border-none flex items-center justify-center p-1 ${isToday ? "opacity-30 cursor-default" : "cursor-pointer"}`}>
          <ChevronRight className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto pb-nav" style={{ paddingTop: 'calc(60px + env(safe-area-inset-top, 0px))' }}>
        {!pageReady ? <SkeletonDiary /> : (
        <div className="max-w-[480px] mx-auto p-4 flex flex-col gap-[10px]">

          {/* Weight card */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}
            className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden"
            style={{ opacity: isPast ? 0.6 : 1, pointerEvents: isPast ? "none" : "auto" }}
          >
            <div className="flex items-center gap-2 px-[14px] py-[10px] border-b border-gray-100">
              <div className="w-[26px] h-[26px] rounded-[7px] bg-blue-100 flex items-center justify-center text-[13px]">⚖️</div>
              <span className="text-xs font-medium text-forest">{t("diary.weightProgress")}</span>
              {weightGoal && <span className="text-[10px] text-gray-400 ml-auto">{t("diary.goalWeight", { value: weightGoal })}</span>}
              {isPast && <span className={`text-[10px] text-gray-400 ${weightGoal ? "ml-2" : "ml-auto"}`}>{t("diary.readOnly")}</span>}
            </div>

            {/* Weight +/- controls */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", padding: "12px 14px 8px" }}>
              <button onClick={() => adjustWeight(-0.1)} className="w-9 h-9 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center cursor-pointer p-0">
                <Minus className="w-4 h-4 text-gray-500" />
              </button>
              <div style={{ textAlign: "center", minWidth: "120px" }}>
                <input
                  type="number"
                  value={form.weight}
                  onChange={e => setForm(f => ({ ...f, weight: e.target.value }))}
                  placeholder="—"
                  className="bg-transparent border-none outline-none text-[36px] font-semibold text-forest w-[100px] text-center font-[inherit] block mx-auto"
                />
                <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "-4px" }}>kg</div>
              </div>
              <button onClick={() => adjustWeight(0.1)} className="w-9 h-9 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center cursor-pointer p-0">
                <Plus className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Compact info row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
              {weightDiff !== null && (
                <span style={{
                  fontSize: "11px", fontWeight: 500, padding: "2px 8px", borderRadius: "20px",
                  background: Number(weightDiff) < 0 ? "#dcfce7" : Number(weightDiff) > 0 ? "#fee2e2" : "#f3f4f6",
                  color: Number(weightDiff) < 0 ? "#16a34a" : Number(weightDiff) > 0 ? "#dc2626" : "#9ca3af",
                }}>
                  {Number(weightDiff) > 0 ? "+" : ""}{weightDiff} kg vs yesterday
                </span>
              )}
              {!goalReached && toGoal !== null && (
                <span style={{ fontSize: "11px", color: "#6b7280", background: "#f3f4f6", padding: "2px 8px", borderRadius: "20px" }}>
                  🎯 {Math.abs(Number(toGoal)).toFixed(1)} kg to go
                </span>
              )}
              {goalReached && (
                <span style={{ fontSize: "11px", color: "#16a34a", background: "#dcfce7", padding: "2px 8px", borderRadius: "20px" }}>
                  🎉 Goal reached!
                </span>
              )}
            </div>

            {/* Progress bar toward goal */}
            {weightProgress !== null && (
              <div className="mx-[14px] mb-2 rounded-xl px-3 py-[8px] border"
                style={{
                  background: goalReached ? "#dcfce7" : "#f0fdf4",
                  borderColor: goalReached ? "#bbf7d0" : "#e5e7eb",
                }}
              >
                <div className="flex items-center justify-between mb-[4px]">
                  <span style={{ fontSize: "10px", color: goalReached ? "#16a34a" : "#6b7280" }}>
                    Start: {startWeight} kg → Goal: {weightGoal} kg
                  </span>
                  <span style={{ fontSize: "10px", fontWeight: 600, color: "#16a34a" }}>{Math.round(weightProgress)}%</span>
                </div>
                <div className="bg-gray-200 rounded-full h-[5px] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${weightProgress}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ background: goalReached ? "#16a34a" : "#22c55e" }}
                  />
                </div>
              </div>
            )}

            <div className="h-px bg-gray-100 mx-[14px]" />

            {/* Weight chart */}
            <div className="p-[10px_14px_8px]">
              {chartData.length > 1 ? (
                <div className="h-[80px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#9ca3af" }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#9ca3af" }} domain={["auto", "auto"]} />
                      <Tooltip
                        contentStyle={{ background: "white", border: "0.5px solid rgba(0,0,0,0.08)", borderRadius: "10px", fontSize: "11px" }}
                        formatter={(v) => [`${v} kg`, ""]}
                      />
                      {weightGoal && (
                        <ReferenceLine y={Number(weightGoal)} stroke="#16a34a" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: `Goal ${weightGoal}kg`, position: "insideTopRight", fontSize: 8, fill: "#16a34a" }} />
                      )}
                      <Line type="monotone" dataKey="weight" stroke="#16a34a" strokeWidth={2} dot={{ fill: "#16a34a", r: 2 }} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[48px] flex items-center justify-center text-gray-400 text-[11px] text-center">
                  {t("diary.logWeightHint")}
                </div>
              )}
            </div>
          </motion.div>

          {/* Mood card */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden"
            style={{ opacity: isPast ? 0.6 : 1, pointerEvents: isPast ? "none" : "auto" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              <div style={{ width: "26px", height: "26px", borderRadius: "7px", background: "#fef9c3", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px" }}>😊</div>
              <span style={{ fontSize: "12px", fontWeight: 500, color: "#1a3a22" }}>{t("diary.howFeeling")}</span>
              {isPast && <span style={{ fontSize: "10px", color: "#9ca3af", marginLeft: "auto" }}>{t("diary.readOnly")}</span>}
            </div>

            {/* Mood selector */}
            <div style={{ display: "flex", gap: "6px", padding: "12px 14px", borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              {MOODS.map(m => {
                const selected = form.mood === m.value;
                return (
                  <button
                    key={m.value}
                    onClick={() => handleMoodSelect(m.value)}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "4px",
                      padding: "8px 4px",
                      borderRadius: "12px",
                      border: selected ? `1.5px solid ${m.color}` : "0.5px solid #e5e7eb",
                      background: selected ? m.bg : "#f9fafb",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{
                      width: "32px", height: "32px", borderRadius: "50%",
                      background: selected ? m.selectedBg : m.bg,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {m.icon(m.color)}
                    </div>
                    <span style={{ fontSize: "9px", color: selected ? m.color : "#9ca3af", fontWeight: selected ? 500 : 400 }}>
                      {m.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Mood strip */}
            <div style={{ padding: "10px 14px" }}>
              <span style={{ fontSize: "10px", color: "#9ca3af", fontWeight: 500 }}>Last 30 days</span>
              <div
                style={{
                  display: "flex", gap: "18px", marginTop: "8px",
                  overflowX: "auto", paddingBottom: "4px",
                  scrollbarWidth: "none", msOverflowStyle: "none",
                  WebkitOverflowScrolling: "touch",
                  direction: "rtl",
                }}
              >
                {weekMoods.map(({ date, mood }) => {
                  const m = MOODS.find(x => x.value === mood);
                  const todayDate = date === getToday();
                  return (
                    <div key={date} style={{ direction: "ltr", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                      <div style={{
                        width: todayDate ? "28px" : "24px",
                        height: todayDate ? "28px" : "24px",
                        borderRadius: "50%",
                        background: m ? m.bg : "#f3f4f6",
                        border: todayDate ? `2px solid ${m ? m.color : "#e5e7eb"}` : "0.5px solid transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {m ? (
                          <div style={{ transform: "scale(0.7)" }}>{m.icon(m.color)}</div>
                        ) : (
                          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#e5e7eb" }} />
                        )}
                      </div>
                      <span style={{ fontSize: "8px", color: todayDate ? (m?.color || "#9ca3af") : "#9ca3af", fontWeight: todayDate ? 500 : 400 }}>
                        {todayDate ? "Today" : format(new Date(date + "T12:00:00"), "d MMM")}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>

          {/* Notes card */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}
            className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden"
            style={{ opacity: isPast ? 0.6 : 1, pointerEvents: isPast ? "none" : "auto" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
              <div style={{ width: "26px", height: "26px", borderRadius: "7px", background: "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px" }}>📓</div>
              <span style={{ fontSize: "12px", fontWeight: 500, color: "#1a3a22" }}>Daily notes</span>
              <button
                onClick={handleOpenHistory}
                style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "4px", background: "#f9fafb", borderRadius: "8px", padding: "4px 8px", cursor: "pointer", border: "0.5px solid #e5e7eb", fontFamily: "inherit" }}
              >
                <Calendar style={{ width: "12px", height: "12px", color: "#6b7280" }} />
                <span style={{ fontSize: "10px", color: "#6b7280" }}>History</span>
              </button>
            </div>
            <div style={{ padding: "10px 14px" }}>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder={t("diary.notesPlaceholder")}
                rows={3}
                style={{ width: "100%", background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: "10px", padding: "10px", fontSize: "13px", color: "#1a3a22", outline: "none", fontFamily: "inherit", resize: "none", lineHeight: "1.5", boxSizing: "border-box" }}
              />
            </div>
          </motion.div>

          {/* Weekly challenges */}
          <WeeklyChallenges />

        </div>
        )}
      </div>

      {/* Notes history bottom sheet */}
      <AnimatePresence>
        {showNotesHistory && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 60 }}
              onClick={() => setShowNotesHistory(false)}
            />
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "white", borderRadius: "24px 24px 0 0", maxHeight: "70vh", display: "flex", flexDirection: "column", zIndex: 61 }}
            >
              <div style={{ padding: "16px", borderBottom: "0.5px solid rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: "15px", color: "#1a3a22" }}>📓 Notes history</p>
                <button onClick={() => setShowNotesHistory(false)} style={{ background: "#f3f4f6", border: "none", borderRadius: "50%", width: "28px", height: "28px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <X style={{ width: "14px", height: "14px", color: "#6b7280" }} />
                </button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {pastNotes.length === 0 ? (
                  <p style={{ textAlign: "center", color: "#9ca3af", fontSize: "13px", marginTop: "24px" }}>No notes yet</p>
                ) : pastNotes.map((entry) => {
                  const m = MOODS.find(x => x.value === entry.mood);
                  return (
                    <div key={entry.date} style={{ background: "#f9fafb", borderRadius: "14px", padding: "12px 14px", border: "0.5px solid #e5e7eb" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          {m && (
                            <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: m.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <div style={{ transform: "scale(0.6)" }}>{m.icon(m.color)}</div>
                            </div>
                          )}
                          <span style={{ fontSize: "12px", fontWeight: 500, color: "#1a3a22" }}>
                            {format(new Date(entry.date + "T12:00:00"), "EEEE, MMM d")}
                          </span>
                        </div>
                        <button
                          onClick={() => { setSelectedDate(new Date(entry.date + "T12:00:00")); setShowNotesHistory(false); }}
                          style={{ fontSize: "10px", color: "#16a34a", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}
                        >
                          Go to day →
                        </button>
                      </div>
                      <p style={{ fontSize: "13px", color: "#374151", margin: 0, lineHeight: "1.5" }}>{entry.notes}</p>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
