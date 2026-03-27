import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { format, subDays } from "date-fns";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Save, Loader2, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const TODAY = format(new Date(), "yyyy-MM-dd");

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
  const isToday = dateStr === TODAY;
  const isPast = !isToday;
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [chartRange, setChartRange] = useState(30);
  const [chartData, setChartData] = useState([]);
  const [lastWeight, setLastWeight] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from("diary_entries").select("*").eq("user_id", user.id).eq("date", dateStr).single()
      .then(({ data }) => {
        if (data) {
          setForm({
            mood: data.mood || null,
            energy: data.energy || null,
            sleep_quality: data.sleep_quality || null,
            stress: data.stress || null,
            notes: data.notes || "",
            weight: data.weight ? String(data.weight) : "",
          });
        } else {
          setForm(emptyForm);
        }
      });
  }, [dateStr, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    const from = format(subDays(new Date(), chartRange), "yyyy-MM-dd");
    supabase.from("diary_entries").select("date, weight").eq("user_id", user.id)
      .gte("date", from).lte("date", TODAY).not("weight", "is", null).order("date")
      .then(({ data }) => {
        setChartData((data || []).map(d => ({
          date: format(new Date(d.date + "T12:00:00"), chartRange <= 7 ? "EEE" : chartRange <= 30 ? "d MMM" : "MMM yy"),
          weight: Number(d.weight),
        })));
      });
  }, [chartRange, user?.id, dateStr]);

  useEffect(() => {
    if (!user?.id) return;
    supabase.from("diary_entries").select("weight").eq("user_id", user.id)
      .lt("date", dateStr).not("weight", "is", null).order("date", { ascending: false }).limit(1)
      .then(({ data }) => {
        const w = data?.[0]?.weight || null;
        setLastWeight(w);
        setForm(prev => prev.weight === "" && w ? { ...prev, weight: String(w) } : prev);
      });
  }, [dateStr, user?.id]);

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

  const handleSave = async () => {
    if (isPast) return;
    setSaving(true);
    const payload = {
      user_id: user.id, date: dateStr,
      mood: form.mood, energy: form.energy,
      sleep_quality: form.sleep_quality, stress: form.stress,
      notes: form.notes || null,
      weight: form.weight ? Number(form.weight) : null,
      waist: null, hips: null, chest: null, arm: null, thigh: null,
    };
    const { error } = await supabase.from("diary_entries").upsert(payload, { onConflict: "user_id,date" });
    if (error) { toast.error("Error saving entry"); } else { toast.success("Entry saved! 📔"); }
    setSaving(false);
  };

  const weightDiff = form.weight && lastWeight
    ? (Number(form.weight) - Number(lastWeight)).toFixed(1)
    : null;

  const inputStyle = {
    background: "#f9fafb", border: "0.5px solid #e5e7eb",
    borderRadius: "8px", padding: "6px 10px", fontSize: "14px",
    color: "#1a3a22", width: "100%", outline: "none", fontFamily: "inherit",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100dvh", background: "#f0fcf3", overflow: "hidden" }}>

      {/* Date navigator */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "white", borderBottom: "0.5px solid #e5e7eb",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        padding: "14px 24px", position: "relative", flexShrink: 0,
      }}>
        <button onClick={() => navigateDay(-1)} style={{
          position: "absolute", left: "60px",
          background: "none", border: "none",
          display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
        }}>
          <ChevronLeft style={{ width: "20px", height: "20px", color: "#6b7280" }} />
        </button>
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#1a3a22", lineHeight: 1.2 }}>
            {isToday ? "Today" : format(selectedDate, "MMM d, yyyy")}
          </h2>
          <p style={{ fontSize: "11px", color: "#9ca3af" }}>
            {isToday ? "Log your wellness" : "Past entry"}
          </p>
        </div>
        <button onClick={() => navigateDay(1)} disabled={isToday} style={{
          position: "absolute", right: "16px",
          background: "none", border: "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: isToday ? "default" : "pointer", opacity: isToday ? 0.3 : 1,
        }}>
          <ChevronRight style={{ width: "20px", height: "20px", color: "#6b7280" }} />
        </button>
      </div>

      {/* Contenuto scorrevole */}
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: "90px" }}>
        <div style={{ maxWidth: "480px", margin: "0 auto", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>

          {/* Weight card */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 }}
            style={{
              background: "white", borderRadius: "16px", border: "0.5px solid rgba(0,0,0,0.06)", overflow: "hidden",
              opacity: isPast ? 0.6 : 1, pointerEvents: isPast ? "none" : "auto",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", borderBottom: "0.5px solid #f3f4f6" }}>
              <div style={{ width: "26px", height: "26px", borderRadius: "7px", background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px" }}>⚖️</div>
              <span style={{ fontSize: "12px", fontWeight: 500, color: "#1a3a22" }}>Weight Progress</span>
              {isPast && <span style={{ fontSize: "10px", color: "#9ca3af", marginLeft: "auto" }}>🔒 Read only</span>}
            </div>

            {/* Peso con +/- centrato */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", padding: "14px 14px 12px" }}>
              <button onClick={() => adjustWeight(-0.1)} style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#f3f4f6", border: "0.5px solid #e5e7eb", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Minus style={{ width: "16px", height: "16px", color: "#6b7280" }} />
              </button>
              <div style={{ textAlign: "center" }}>
                {weightDiff !== null && (
                  <span style={{
                    fontSize: "11px", fontWeight: 500, padding: "2px 8px", borderRadius: "20px",
                    background: Number(weightDiff) < 0 ? "#dcfce7" : Number(weightDiff) > 0 ? "#fee2e2" : "#f3f4f6",
                    color: Number(weightDiff) < 0 ? "#16a34a" : Number(weightDiff) > 0 ? "#dc2626" : "#9ca3af",
                    display: "inline-block", marginBottom: "4px",
                  }}>
                    {Number(weightDiff) > 0 ? "+" : ""}{weightDiff} kg
                  </span>
                )}
                <input
                  type="number"
                  value={form.weight}
                  onChange={e => setForm(f => ({ ...f, weight: e.target.value }))}
                  placeholder="—"
                  style={{ background: "none", border: "none", outline: "none", fontSize: "36px", fontWeight: 600, color: "#1a3a22", width: "100px", textAlign: "center", fontFamily: "inherit", display: "block" }}
                />
                <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "-4px" }}>kg</div>
              </div>
              <button onClick={() => adjustWeight(0.1)} style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#f3f4f6", border: "0.5px solid #e5e7eb", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Plus style={{ width: "16px", height: "16px", color: "#6b7280" }} />
              </button>
            </div>

            {/* Divisore */}
            <div style={{ height: "0.5px", background: "#f3f4f6", margin: "0 14px" }} />

            {/* Grafico */}
            <div style={{ padding: "10px 14px 8px" }}>
              {chartData.length > 1 ? (
                <div style={{ height: "120px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#9ca3af" }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "#9ca3af" }} domain={["auto", "auto"]} />
                      <Tooltip
                        contentStyle={{ background: "white", border: "0.5px solid rgba(0,0,0,0.08)", borderRadius: "10px", fontSize: "11px" }}
                        formatter={(v) => [`${v} kg`, ""]}
                      />
                      <Line type="monotone" dataKey="weight" stroke="#16a34a" strokeWidth={2} dot={{ fill: "#16a34a", r: 2 }} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ height: "60px", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: "11px", textAlign: "center" }}>
                  Log weight for 2+ days to see trend
                </div>
              )}
            </div>

            {/* Range selector — sotto il grafico */}
            <div style={{ display: "flex", gap: "6px", justifyContent: "center", padding: "0 14px 14px" }}>
              {CHART_RANGES.map(r => (
                <button key={r.label} onClick={() => setChartRange(r.days)} style={{
                  padding: "3px 10px", borderRadius: "20px", fontSize: "10px", fontWeight: 500,
                  border: chartRange === r.days ? "1.5px solid #16a34a" : "0.5px solid #e5e7eb",
                  background: chartRange === r.days ? "#f0fdf4" : "#f9fafb",
                  color: chartRange === r.days ? "#16a34a" : "#9ca3af",
                  cursor: "pointer", fontFamily: "inherit",
                }}>{r.label}</button>
              ))}
            </div>
          </motion.div>

          {/* Wellness card */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            style={{
              background: "white", borderRadius: "16px", border: "0.5px solid rgba(0,0,0,0.06)", overflow: "hidden",
              opacity: isPast ? 0.6 : 1, pointerEvents: isPast ? "none" : "auto",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", borderBottom: "0.5px solid #f3f4f6" }}>
              <div style={{ width: "26px", height: "26px", borderRadius: "7px", background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px" }}>😊</div>
              <span style={{ fontSize: "12px", fontWeight: 500, color: "#1a3a22" }}>How are you feeling?</span>
              {isPast && <span style={{ fontSize: "10px", color: "#9ca3af", marginLeft: "auto" }}>🔒 Read only</span>}
            </div>

            {/* Mood */}
            <div style={{ display: "flex", gap: "6px", padding: "10px 12px", borderBottom: "0.5px solid #f3f4f6" }}>
              {MOODS.map(m => (
                <button key={m.value} onClick={() => setForm(f => ({ ...f, mood: m.value }))} style={{
                  flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "3px",
                  padding: "8px 2px", borderRadius: "10px",
                  border: form.mood === m.value ? "1.5px solid #16a34a" : "0.5px solid #e5e7eb",
                  background: form.mood === m.value ? "#f0fdf4" : "#f9fafb",
                  cursor: "pointer", fontFamily: "inherit",
                }}>
                  <span style={{ fontSize: "18px" }}>{m.emoji}</span>
                  <span style={{ fontSize: "8px", color: form.mood === m.value ? "#16a34a" : "#9ca3af" }}>{m.label}</span>
                </button>
              ))}
            </div>

            {/* Energy, Sleep, Stress */}
            {SCALES.map(scale => (
              <div key={scale.key} style={{ padding: "8px 14px", borderBottom: "0.5px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                <span style={{ fontSize: "11px", color: "#6b7280", whiteSpace: "nowrap" }}>{scale.emoji} {scale.label}</span>
                <div style={{ display: "flex", gap: "5px", flex: 1, justifyContent: "flex-end" }}>
                  {[1, 2, 3, 4, 5].map(v => (
                    <button key={v} onClick={() => setForm(f => ({ ...f, [scale.key]: v }))} style={{
                      width: "28px", height: "28px", borderRadius: "50%",
                      background: form[scale.key] >= v ? scale.color : "#f3f4f6",
                      border: "none", cursor: "pointer",
                      fontSize: "11px", fontWeight: 600,
                      color: form[scale.key] >= v ? "white" : "#9ca3af",
                      fontFamily: "inherit",
                    }}>{v}</button>
                  ))}
                </div>
              </div>
            ))}

            {/* Notes */}
            <div style={{ padding: "10px 14px" }}>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="How was your day? Any notes..."
                rows={3}
                style={{ ...inputStyle, resize: "none", fontSize: "13px", lineHeight: 1.5 }}
              />
            </div>
          </motion.div>

          {/* Save button — solo oggi */}
          {!isPast && (
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              onClick={handleSave}
              disabled={saving}
              style={{
                width: "100%", background: "#16a34a", color: "white",
                border: "none", borderRadius: "14px", padding: "13px",
                fontSize: "14px", fontWeight: 500, cursor: "pointer",
                fontFamily: "inherit", display: "flex", alignItems: "center",
                justifyContent: "center", gap: "8px",
              }}
            >
              {saving ? <Loader2 style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite" }} /> : <Save style={{ width: "16px", height: "16px" }} />}
              {saving ? "Saving..." : "Save today's entry"}
            </motion.button>
          )}

        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
