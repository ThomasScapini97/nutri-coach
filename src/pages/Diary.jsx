import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { format, subDays } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { getToday } from "@/lib/nutritionUtils";
import WeeklyChallenges from "@/components/diary/WeeklyChallenges";

const MOODS = [
  { value: 1, emoji: "😔", label: "Bad" },
  { value: 2, emoji: "😐", label: "Meh" },
  { value: 3, emoji: "🙂", label: "Good" },
  { value: 4, emoji: "😄", label: "Great" },
  { value: 5, emoji: "🤩", label: "Amazing" },
];

const SCALES = [
  { key: "energy", label: "Energy", emoji: "⚡", color: "#f59e0b" },
  { key: "sleep_quality", label: "Sleep quality", emoji: "😴", color: "#3b82f6" },
  { key: "stress", label: "Stress", emoji: "🧠", color: "#ef4444" },
];

const CHART_RANGES = [
  { label: "7D", days: 7 },
  { label: "1M", days: 30 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
];

const emptyForm = {
  mood: null, energy: null, sleep_quality: null, stress: null, notes: "",
  weight: "",
};

export default function Diary() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const isToday = dateStr === getToday();
  const isPast = !isToday;
  const [form, setForm] = useState(emptyForm);
  const [saved, setSaved] = useState(false);
  const [chartRange, setChartRange] = useState(30);
  const isLoadingRef = useRef(true);
  const debounceRef = useRef(null);
  const [chartData, setChartData] = useState([]);
  const [lastWeight, setLastWeight] = useState(null);
  const [weightGoal, setWeightGoal] = useState(null);
  const [startWeight, setStartWeight] = useState(null);

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
          energy: data.energy || null,
          sleep_quality: data.sleep_quality || null,
          stress: data.stress || null,
          notes: data.notes || "",
          weight: data.weight ? String(data.weight) : (prevWeight ? String(prevWeight) : ""),
        });
      } else {
        setForm({ ...emptyForm, weight: prevWeight ? String(prevWeight) : "" });
      }
    };

    isLoadingRef.current = true;
    loadData().then(() => { isLoadingRef.current = false; });
  }, [dateStr, user?.id]);

  // Auto-save with 800ms debounce
  useEffect(() => {
    if (isPast || isLoadingRef.current || !user?.id) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const payload = {
        user_id: user.id, date: dateStr,
        mood: form.mood, energy: form.energy,
        sleep_quality: form.sleep_quality, stress: form.stress,
        notes: form.notes || null,
        weight: form.weight ? Number(form.weight) : null,
        waist: null, hips: null, chest: null, arm: null, thigh: null,
      };
      const { error } = await supabase.from("diary_entries").upsert(payload, { onConflict: "user_id,date" });
      if (error) { toast.error("Error saving entry"); }
      else { setSaved(true); setTimeout(() => setSaved(false), 2000); }
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
          date: format(new Date(d.date + "T12:00:00"), chartRange <= 7 ? "EEE" : chartRange <= 30 ? "d MMM" : "MMM yy"),
          weight: Number(d.weight),
        })));
      });
  }, [chartRange, user?.id, dateStr]);

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
    let raw;
    if (losing) {
      raw = ((start - current) / (start - goal)) * 100;
    } else {
      raw = ((current - start) / (goal - start)) * 100;
    }

    return Math.min(Math.max(raw, 0), 100);
  })();

  const goalReached = weightProgress !== null && weightProgress >= 100;

  return (
    <div className="flex flex-col overflow-hidden h-[100dvh] bg-mint">

      {/* Date navigator */}
      <div className="flex items-center justify-center bg-white border-b border-gray-200 shadow-[0_1px_4px_rgba(0,0,0,0.06)] px-6 py-[14px] relative shrink-0">
        <button onClick={() => navigateDay(-1)} className="absolute left-4 bg-transparent border-none flex items-center justify-center cursor-pointer p-0">
          <ChevronLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className="text-center">
          <h2 className="text-base font-semibold text-forest leading-[1.2] m-0">
            {isToday ? "Today" : format(selectedDate, "MMM d, yyyy")}
          </h2>
          <AnimatePresence mode="wait">
            {saved ? (
              <motion.p key="saved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[11px] m-0" style={{ color: "#16a34a" }}>
                ✓ Saved
              </motion.p>
            ) : (
              <motion.p key="subtitle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[11px] text-gray-400 m-0">
                {isToday ? "Auto-saved" : "Past entry"}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        <button onClick={() => navigateDay(1)} disabled={isToday} className={`absolute right-4 bg-transparent border-none flex items-center justify-center p-0 ${isToday ? "opacity-30 cursor-default" : "cursor-pointer"}`}>
          <ChevronRight className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto pb-[72px]">
        <div className="max-w-[480px] mx-auto p-4 flex flex-col gap-[10px]">

          {/* Weight card */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}
            className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden"
            style={{ opacity: isPast ? 0.6 : 1, pointerEvents: isPast ? "none" : "auto" }}
          >
            <div className="flex items-center gap-2 px-[14px] py-[10px] border-b border-gray-100">
              <div className="w-[26px] h-[26px] rounded-[7px] bg-blue-100 flex items-center justify-center text-[13px]">⚖️</div>
              <span className="text-xs font-medium text-forest">Weight Progress</span>
              {weightGoal && <span className="text-[10px] text-gray-400 ml-auto">Goal: {weightGoal} kg</span>}
              {isPast && <span className={`text-[10px] text-gray-400 ${weightGoal ? "ml-2" : "ml-auto"}`}>🔒 Read only</span>}
            </div>

            {/* Weight +/- controls */}
            <div className="flex items-center justify-center gap-4 px-[14px] pt-[14px] pb-2">
              <button onClick={() => adjustWeight(-0.1)} className="w-9 h-9 rounded-full bg-gray-100 border border-gray-200 cursor-pointer flex items-center justify-center p-0">
                <Minus className="w-4 h-4 text-gray-500" />
              </button>
              <div className="text-center">
                {weightDiff !== null && (
                  <div className="mb-1 flex flex-col items-center gap-[2px]">
                    <span className="text-[11px] font-medium px-2 py-[2px] rounded-full"
                      style={{
                        background: Number(weightDiff) < 0 ? "#dcfce7" : Number(weightDiff) > 0 ? "#fee2e2" : "#f3f4f6",
                        color: Number(weightDiff) < 0 ? "#16a34a" : Number(weightDiff) > 0 ? "#dc2626" : "#9ca3af",
                      }}
                    >
                      {Number(weightDiff) > 0 ? "+" : ""}{weightDiff} kg
                    </span>
                    <span className="text-[9px] text-gray-400">vs yesterday</span>
                  </div>
                )}
                <input
                  type="number"
                  value={form.weight}
                  onChange={e => setForm(f => ({ ...f, weight: e.target.value }))}
                  placeholder="—"
                  className="bg-transparent border-none outline-none text-[36px] font-semibold text-forest w-[100px] text-center font-[inherit] block"
                />
                <div className="text-xs text-gray-400 -mt-1">kg</div>
              </div>
              <button onClick={() => adjustWeight(0.1)} className="w-9 h-9 rounded-full bg-gray-100 border border-gray-200 cursor-pointer flex items-center justify-center p-0">
                <Plus className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Progress bar toward goal */}
            {weightProgress !== null && (
              <div className="mx-[14px] mb-3 rounded-xl px-3 py-[10px] border"
                style={{
                  background: goalReached ? "#dcfce7" : "#f0fdf4",
                  borderColor: goalReached ? "#bbf7d0" : "#e5e7eb",
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px]" style={{ color: goalReached ? "#16a34a" : "#6b7280" }}>
                    {goalReached ? "🎉 Goal reached!" : `🎯 Goal: ${weightGoal} kg`}
                  </span>
                  {!goalReached && toGoal !== null && (
                    <span className="text-[11px] font-semibold text-green-600">
                      {Math.abs(Number(toGoal)).toFixed(1)} kg to go
                    </span>
                  )}
                </div>
                <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${weightProgress}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ background: goalReached ? "#16a34a" : "#22c55e" }}
                  />
                </div>
                <div className="flex justify-between items-center mt-[6px]">
                  <span className="text-[9px] text-gray-400">Start: {startWeight} kg</span>
                  <span className="text-[10px] text-green-600 font-semibold">{Math.round(weightProgress)}%</span>
                  <span className="text-[9px] text-gray-400">Goal: {weightGoal} kg</span>
                </div>
              </div>
            )}

            <div className="h-px bg-gray-100 mx-[14px]" />

            {/* Weight chart */}
            <div className="p-[10px_14px_8px]">
              {chartData.length > 1 ? (
                <div className="h-[120px]">
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
                <div className="h-[60px] flex items-center justify-center text-gray-400 text-[11px] text-center">
                  Log weight for 2+ days to see trend
                </div>
              )}
            </div>

            {/* Range selector */}
            <div className="flex gap-[6px] justify-center px-[14px] pb-[14px]">
              {CHART_RANGES.map(r => (
                <button key={r.label} onClick={() => setChartRange(r.days)}
                  className="px-[10px] py-[3px] rounded-full text-[10px] font-medium cursor-pointer font-[inherit]"
                  style={{
                    border: chartRange === r.days ? "1.5px solid #16a34a" : "0.5px solid #e5e7eb",
                    background: chartRange === r.days ? "#f0fdf4" : "#f9fafb",
                    color: chartRange === r.days ? "#16a34a" : "#9ca3af",
                  }}
                >{r.label}</button>
              ))}
            </div>
          </motion.div>

          {/* Wellness card */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden"
            style={{ opacity: isPast ? 0.6 : 1, pointerEvents: isPast ? "none" : "auto" }}
          >
            <div className="flex items-center gap-2 px-[14px] py-[10px] border-b border-gray-100">
              <div className="w-[26px] h-[26px] rounded-[7px] bg-amber-100 flex items-center justify-center text-[13px]">😊</div>
              <span className="text-xs font-medium text-forest">How are you feeling?</span>
              {isPast && <span className="text-[10px] text-gray-400 ml-auto">🔒 Read only</span>}
            </div>

            <div className="flex gap-[6px] px-3 py-[10px] border-b border-gray-100">
              {MOODS.map(m => (
                <button key={m.value} onClick={() => setForm(f => ({ ...f, mood: m.value }))}
                  className="flex-1 flex flex-col items-center gap-[3px] py-2 px-[2px] rounded-[10px] cursor-pointer font-[inherit]"
                  style={{
                    border: form.mood === m.value ? "1.5px solid #16a34a" : "0.5px solid #e5e7eb",
                    background: form.mood === m.value ? "#f0fdf4" : "#f9fafb",
                  }}
                >
                  <span className="text-[18px]">{m.emoji}</span>
                  <span className="text-[8px]" style={{ color: form.mood === m.value ? "#16a34a" : "#9ca3af" }}>{m.label}</span>
                </button>
              ))}
            </div>

            {SCALES.map(scale => (
              <div key={scale.key} className="px-[14px] py-2 border-b border-gray-100 flex items-center justify-between gap-[10px]">
                <span className="text-[11px] text-gray-500 whitespace-nowrap">{scale.emoji} {scale.label}</span>
                <div className="flex gap-[5px] flex-1 justify-end">
                  {[1, 2, 3, 4, 5].map(v => (
                    <button key={v} onClick={() => setForm(f => ({ ...f, [scale.key]: v }))}
                      className="w-7 h-7 rounded-full border-none cursor-pointer text-[11px] font-semibold font-[inherit]"
                      style={{
                        background: form[scale.key] >= v ? scale.color : "#f3f4f6",
                        color: form[scale.key] >= v ? "white" : "#9ca3af",
                      }}
                    >{v}</button>
                  ))}
                </div>
              </div>
            ))}

            <div className="p-[10px_14px]">
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="How was your day? Any notes..."
                rows={3}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-[10px] py-[6px] text-[13px] text-forest outline-none font-[inherit] resize-none leading-relaxed"
              />
            </div>
          </motion.div>

          {/* Weekly challenges */}
          <WeeklyChallenges />


        </div>
      </div>
    </div>
  );
}
