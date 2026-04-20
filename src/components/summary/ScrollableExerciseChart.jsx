import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, X, Flame, Clock } from "lucide-react";

const getToday = () => new Date();
const BAR_WIDTH = 36;
const BAR_GAP = 6;
const DAYS_BACK = 90;
const FUTURE_DAYS = 3;

function getBarColor(burned, burnGoal) {
  if (!burned || burned === 0) return "#f3f4f6";
  const pct = (burned / burnGoal) * 100;
  if (pct >= 90) return "#16a34a";
  if (pct >= 50) return "#f59e0b";
  return "#ef4444";
}

function getDotColor(burned, burnGoal) {
  if (!burned || burned === 0) return null;
  const pct = (burned / burnGoal) * 100;
  if (pct >= 90) return "#16a34a";
  if (pct >= 50) return "#f59e0b";
  return "#ef4444";
}

const EXERCISES_LIST = [
  { name: "Running", emoji: "🏃" }, { name: "Walking", emoji: "🚶" },
  { name: "Cycling", emoji: "🚴" }, { name: "Swimming", emoji: "🏊" },
  { name: "Weight Training", emoji: "🏋️" }, { name: "Yoga", emoji: "🧘" },
  { name: "HIIT", emoji: "⚡" }, { name: "Football", emoji: "⚽" },
  { name: "Basketball", emoji: "🏀" }, { name: "Tennis", emoji: "🎾" },
  { name: "Dancing", emoji: "💃" }, { name: "Hiking", emoji: "🥾" },
  { name: "Jump Rope", emoji: "🪃" }, { name: "Rowing", emoji: "🚣" },
  { name: "Pilates", emoji: "🤸" }, { name: "Other", emoji: "💪" },
];

export default function ScrollableExerciseChart({ burnGoal = 300, selectedDate }) {
  const { user } = useAuth();
  const [logs, setLogs] = useState({});
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayExercises, setDayExercises] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const scrollRef = useRef(null);

  const allDays = Array.from({ length: DAYS_BACK + FUTURE_DAYS + 1 }, (_, i) =>
    format(subDays(getToday(), DAYS_BACK - i), "yyyy-MM-dd")
  );

  useEffect(() => {
    if (!user?.id) return;
    const from = format(subDays(getToday(), DAYS_BACK), "yyyy-MM-dd");
    const to = format(getToday(), "yyyy-MM-dd");
    supabase
      .from("exercise_logs")
      .select("date, calories_burned")
      .eq("user_id", user.id)
      .gte("date", from)
      .lte("date", to)
      .then(({ data }) => {
        const map = {};
        (data || []).forEach(l => {
          map[l.date] = (map[l.date] || 0) + l.calories_burned;
        });
        setLogs(map);
      });
  }, [user?.id]);

  useEffect(() => {
    if (!scrollRef.current) return;
    const targetDate = selectedDate || format(getToday(), "yyyy-MM-dd");
    const targetIndex = allDays.findIndex(d => d === targetDate);
    const idx = targetIndex >= 0 ? targetIndex : allDays.findIndex(d => d === format(getToday(), "yyyy-MM-dd"));
    scrollRef.current.scrollLeft = (idx - 4) * (BAR_WIDTH + BAR_GAP);
  }, [selectedDate]);

  const openDayDetail = async (dateStr) => {
    setSelectedDay(dateStr);
    setDayExercises([]);
    setLoadingEntries(true);
    const { data } = await supabase
      .from("exercise_logs")
      .select("exercise_name, duration_minutes, calories_burned")
      .eq("user_id", user.id)
      .eq("date", dateStr)
      .order("created_at", { ascending: true });
    setDayExercises(data || []);
    setLoadingEntries(false);
  };

  const maxBurned = Math.max(burnGoal, ...Object.values(logs).filter(Boolean));

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
        <span style={{ fontSize: "11px", color: "#9ca3af" }}>Scroll to see past days</span>
        <button
          onClick={() => setShowCalendar(true)}
          style={{
            display: "flex", alignItems: "center", gap: "4px",
            background: "#fef2f2", border: "0.5px solid #fecaca",
            borderRadius: "8px", padding: "4px 10px",
            fontSize: "11px", color: "#dc2626", cursor: "pointer",
            fontFamily: "inherit", fontWeight: 500,
          }}
        >
          <CalendarDays style={{ width: "12px", height: "12px" }} />
          Calendar
        </button>
      </div>

      {/* Scrollable chart */}
      <div ref={scrollRef} style={{ overflowX: "auto", overflowY: "hidden", scrollbarWidth: "none", msOverflowStyle: "none" }}>
        <div style={{
          display: "flex", alignItems: "flex-end", gap: `${BAR_GAP}px`,
          width: `${allDays.length * (BAR_WIDTH + BAR_GAP)}px`,
          height: "80px",
        }}>
          {allDays.map((dateStr) => {
            const burned = logs[dateStr] || 0;
            const todayStr = format(getToday(), "yyyy-MM-dd");
            const isTodayBar = dateStr === todayStr;
            const isSelectedBar = selectedDate && dateStr === selectedDate && !isTodayBar;
            const isFutureBar = dateStr > todayStr;
            const barColor = isFutureBar ? "#f3f4f6" : getBarColor(burned, burnGoal);
            const barHeight = isFutureBar || !burned ? 4 : Math.max(4, (burned / maxBurned) * 40);
            const dayLabel = format(new Date(dateStr + "T12:00:00"), "EEE");
            const dayNum = format(new Date(dateStr + "T12:00:00"), "d");

            return (
              <div
                key={dateStr}
                onClick={() => !isFutureBar && openDayDetail(dateStr)}
                style={{
                  width: `${BAR_WIDTH}px`, flexShrink: 0,
                  display: "flex", flexDirection: "column", alignItems: "center",
                  cursor: isFutureBar ? "default" : "pointer", gap: "3px",
                }}
              >
                <div style={{ width: "100%", flex: 1, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: barHeight }}
                    transition={{ duration: 0.4 }}
                    style={{
                      width: "100%", borderRadius: "4px 4px 0 0",
                      background: barColor,
                      border: isTodayBar ? "2px solid #b91c1c" : isSelectedBar ? "2px solid #ef4444" : "none",
                      outline: isSelectedBar ? "2px solid #ef4444" : "none",
                    }}
                  />
                </div>
                <span style={{ fontSize: isSelectedBar ? "10px" : "9px", color: (isTodayBar || isSelectedBar) ? "#ef4444" : "#9ca3af", fontWeight: (isTodayBar || isSelectedBar) ? 700 : 400, lineHeight: 1 }}>{dayLabel}</span>
                <span style={{ fontSize: isSelectedBar ? "10px" : "9px", color: (isTodayBar || isSelectedBar) ? "#ef4444" : "#9ca3af", fontWeight: (isTodayBar || isSelectedBar) ? 700 : 400, lineHeight: 1 }}>{dayNum}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Popup dettaglio giorno */}
      <AnimatePresence>
        {selectedDay && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
            onClick={() => setSelectedDay(null)}
          >
            <motion.div
              initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }}
              transition={{ type: "spring", damping: 25 }}
              onClick={e => e.stopPropagation()}
              style={{ background: "white", borderRadius: "24px 24px 0 0", padding: "20px", width: "100%", maxWidth: "480px", maxHeight: "70vh", overflowY: "auto" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <div>
                  <p style={{ fontSize: "15px", fontWeight: 500, color: "#1a3a22" }}>
                    {format(new Date(selectedDay + "T12:00:00"), "EEEE, MMM d")}
                  </p>
                  <p style={{ fontSize: "11px", color: "#9ca3af" }}>Read only — past day</p>
                </div>
                <button onClick={() => setSelectedDay(null)} style={{ background: "#f3f4f6", border: "none", borderRadius: "50%", width: "28px", height: "28px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <X style={{ width: "14px", height: "14px", color: "#6b7280" }} />
                </button>
              </div>

              {/* Calorie summary */}
              {logs[selectedDay] > 0 && (
                <div style={{ background: "#fef2f2", borderRadius: "12px", padding: "10px 14px", marginBottom: "14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "12px", color: "#dc2626", fontWeight: 500 }}>Total burned</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Flame style={{ width: "14px", height: "14px", color: "#dc2626" }} />
                    <span style={{ fontSize: "16px", fontWeight: 600, color: "#1a3a22" }}>{logs[selectedDay]}</span>
                    <span style={{ fontSize: "11px", color: "#9ca3af" }}>/ {burnGoal} kcal</span>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: getDotColor(logs[selectedDay], burnGoal) || "#e5e7eb" }} />
                  </div>
                </div>
              )}

              {/* Lista esercizi */}
              {loadingEntries ? (
                <div style={{ textAlign: "center", padding: "24px", color: "#9ca3af", fontSize: "13px" }}>Loading...</div>
              ) : dayExercises.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {dayExercises.map((ex, i) => {
                    const exInfo = EXERCISES_LIST.find(e => e.name === ex.exercise_name);
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", background: "#f9fafb", borderRadius: "12px", border: "0.5px solid rgba(0,0,0,0.06)" }}>
                        <span style={{ fontSize: "20px", flexShrink: 0 }}>{exInfo?.emoji || "💪"}</span>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: "13px", fontWeight: 500, color: "#1a3a22" }}>{ex.exercise_name}</p>
                          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                            <Clock style={{ width: "10px", height: "10px", color: "#9ca3af" }} />
                            <span style={{ fontSize: "11px", color: "#9ca3af" }}>{ex.duration_minutes} min</span>
                          </div>
                        </div>
                        <div style={{ background: "#fef2f2", borderRadius: "20px", padding: "3px 8px", display: "flex", alignItems: "center", gap: "3px" }}>
                          <Flame style={{ width: "12px", height: "12px", color: "#dc2626" }} />
                          <span style={{ fontSize: "12px", fontWeight: 600, color: "#dc2626" }}>{ex.calories_burned}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "24px", color: "#9ca3af", fontSize: "13px" }}>
                  No exercises logged this day
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Calendar modal */}
      <AnimatePresence>
        {showCalendar && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
            onClick={() => setShowCalendar(false)}
          >
            <motion.div
              initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }}
              transition={{ type: "spring", damping: 25 }}
              onClick={e => e.stopPropagation()}
              style={{ background: "white", borderRadius: "24px 24px 0 0", padding: "20px", width: "100%", maxWidth: "480px" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <button onClick={() => setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))} style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", padding: "4px 8px", color: "#6b7280" }}>‹</button>
                <span style={{ fontSize: "15px", fontWeight: 500, color: "#1a3a22" }}>{format(calendarMonth, "MMMM yyyy")}</span>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <button
                    onClick={() => setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))}
                    disabled={format(calendarMonth, "yyyy-MM") >= format(getToday(), "yyyy-MM")}
                    style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", padding: "4px 8px", color: "#6b7280", opacity: format(calendarMonth, "yyyy-MM") >= format(getToday(), "yyyy-MM") ? 0.3 : 1 }}
                  >›</button>
                  <button onClick={() => setShowCalendar(false)} style={{ background: "#f3f4f6", border: "none", borderRadius: "50%", width: "28px", height: "28px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <X style={{ width: "14px", height: "14px", color: "#6b7280" }} />
                  </button>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px", marginBottom: "6px" }}>
                {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map(d => (
                  <div key={d} style={{ textAlign: "center", fontSize: "10px", color: "#9ca3af", fontWeight: 500 }}>{d}</div>
                ))}
              </div>

              {(() => {
                const start = startOfMonth(calendarMonth);
                const end = endOfMonth(calendarMonth);
                const days = eachDayOfInterval({ start, end });
                const startDow = (start.getDay() + 6) % 7;
                const cells = [...Array(startDow).fill(null), ...days];
                while (cells.length % 7 !== 0) cells.push(null);

                return (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px" }}>
                    {cells.map((day, i) => {
                      if (!day) return <div key={i} />;
                      const dateStr = format(day, "yyyy-MM-dd");
                      const todayStr = format(getToday(), "yyyy-MM-dd");
                      const isFutureDay = dateStr > todayStr;
                      const isTodayDay = dateStr === todayStr;
                      const burned = logs[dateStr] || 0;
                      const dotColor = !isFutureDay && burned > 0 ? getDotColor(burned, burnGoal) : null;

                      return (
                        <button
                          key={dateStr}
                          onClick={() => {
                            if (!isFutureDay) {
                              setShowCalendar(false);
                              openDayDetail(dateStr);
                            }
                          }}
                          disabled={isFutureDay}
                          style={{
                            display: "flex", flexDirection: "column", alignItems: "center",
                            gap: "2px", padding: "6px 2px", borderRadius: "10px",
                            background: isTodayDay ? "#fef2f2" : "transparent",
                            border: isTodayDay ? "1.5px solid #dc2626" : "none",
                            cursor: isFutureDay ? "default" : "pointer",
                            fontFamily: "inherit", opacity: isFutureDay ? 0.3 : 1,
                          }}
                        >
                          <span style={{ fontSize: "12px", fontWeight: isTodayDay ? 600 : 400, color: isTodayDay ? "#dc2626" : "#1a3a22" }}>
                            {format(day, "d")}
                          </span>
                          <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: dotColor || "transparent" }} />
                        </button>
                      );
                    })}
                  </div>
                );
              })()}

              <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "16px" }}>
                {[
                  { color: "#16a34a", label: "On track" },
                  { color: "#f59e0b", label: "Close" },
                  { color: "#ef4444", label: "Off track" },
                ].map(({ color, label }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: color }} />
                    <span style={{ fontSize: "10px", color: "#9ca3af" }}>{label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}