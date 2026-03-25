import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { format, subDays, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isFuture } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, X } from "lucide-react";

const TODAY = new Date();
const BAR_WIDTH = 36;
const BAR_GAP = 6;
const DAYS_BACK = 90;
const FUTURE_DAYS = 3;

function getStatusColor(calories, goal) {
  if (!calories || calories === 0) return null;
  const pct = (calories / goal) * 100;
  if (pct >= 90 && pct <= 110) return "#16a34a";
  if ((pct >= 80 && pct < 90) || (pct > 110 && pct <= 120)) return "#f59e0b";
  return "#ef4444";
}

function getBarColor(calories, goal, isToday) {
  if (!calories || calories === 0) return "#f3f4f6";
  const pct = (calories / goal) * 100;
  if (pct >= 90 && pct <= 110) return "#16a34a";
  if ((pct >= 80 && pct < 90) || (pct > 110 && pct <= 120)) return "#f59e0b";
  return "#ef4444";
}


export default function ScrollableChart({ calorieGoal = 2000, onDaySelect }) {
  const { user } = useAuth();
  const [logs, setLogs] = useState({});
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const scrollRef = useRef(null);

  // Genera tutti i giorni da DAYS_BACK fino a FUTURE_DAYS
  const allDays = Array.from({ length: DAYS_BACK + FUTURE_DAYS + 1 }, (_, i) =>
    format(subDays(TODAY, DAYS_BACK - i), "yyyy-MM-dd")
  );

  // Fetch tutti i log degli ultimi 90 giorni
  useEffect(() => {
    if (!user?.id) return;
    const from = format(subDays(TODAY, DAYS_BACK), "yyyy-MM-dd");
    const to = format(TODAY, "yyyy-MM-dd");
    supabase
      .from("food_logs")
      .select("date, total_calories")
      .eq("user_id", user.id)
      .gte("date", from)
      .lte("date", to)
      .then(({ data }) => {
        const map = {};
        (data || []).forEach(l => { map[l.date] = l.total_calories; });
        setLogs(map);
      });
  }, [user?.id]);

  // Scrolla al giorno corrente (con i 3 giorni futuri visibili a destra)
  useEffect(() => {
    if (!scrollRef.current) return;
    const todayIndex = allDays.findIndex(d => d === format(TODAY, "yyyy-MM-dd"));
    const scrollX = (todayIndex - 4) * (BAR_WIDTH + BAR_GAP);
    scrollRef.current.scrollLeft = scrollX;
  }, []);

  const maxCalories = Math.max(calorieGoal, ...Object.values(logs).filter(Boolean));

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
        <span style={{ fontSize: "11px", color: "#9ca3af" }}>Scroll to see past days</span>
        <button
          onClick={() => setShowCalendar(true)}
          style={{
            display: "flex", alignItems: "center", gap: "4px",
            background: "#f0fdf4", border: "0.5px solid #bbf7d0",
            borderRadius: "8px", padding: "4px 10px",
            fontSize: "11px", color: "#16a34a", cursor: "pointer",
            fontFamily: "inherit", fontWeight: 500,
          }}
        >
          <CalendarDays style={{ width: "12px", height: "12px" }} />
          Calendar
        </button>
      </div>

      {/* Scrollable chart */}
      <div
        ref={scrollRef}
        style={{
          overflowX: "auto", overflowY: "hidden",
          scrollbarWidth: "none", msOverflowStyle: "none",
          paddingBottom: "4px",
        }}
      >
        <div style={{
          display: "flex", alignItems: "flex-end", gap: `${BAR_GAP}px`,
          width: `${allDays.length * (BAR_WIDTH + BAR_GAP)}px`,
          height: "60px", paddingBottom: "20px",
        }}>
          {allDays.map((dateStr) => {
            const calories = logs[dateStr] || 0;
            const todayStr = format(TODAY, "yyyy-MM-dd");
            const isTodayBar = dateStr === todayStr;
            const isFutureBar = dateStr > todayStr;
            const barColor = isFutureBar ? "#f3f4f6" : getBarColor(calories, calorieGoal, isTodayBar);
            const barHeight = isFutureBar || !calories
              ? 6
              : Math.max(4, (calories / maxCalories) * 28);
            const dayLabel = format(new Date(dateStr + "T12:00:00"), "EEE");
            const dayNum = format(new Date(dateStr + "T12:00:00"), "d");

            return (
              <div
                key={dateStr}
                onClick={() => !isFutureBar && onDaySelect?.(dateStr)}
                style={{
                  width: `${BAR_WIDTH}px`, flexShrink: 0,
                  display: "flex", flexDirection: "column", alignItems: "center",
                  cursor: isFutureBar ? "default" : "pointer",
                  gap: "3px",
                }}
              >
                <div style={{
                  width: "100%", height: "32px",
                  display: "flex", alignItems: "flex-end", justifyContent: "center",
                }}>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: barHeight }}
                    transition={{ duration: 0.4 }}
                    style={{
                      width: "100%", borderRadius: "4px 4px 0 0",
                      background: barColor,
                      border: isTodayBar ? "2px solid #15803d" : "none",
                    }}
                  />
                </div>
                <span style={{
                  fontSize: "9px", color: isTodayBar ? "#16a34a" : "#9ca3af",
                  fontWeight: isTodayBar ? 600 : 400, lineHeight: 1,
                }}>
                  {dayLabel}
                </span>
                <span style={{
                  fontSize: "9px", color: isTodayBar ? "#16a34a" : "#9ca3af",
                  fontWeight: isTodayBar ? 600 : 400, lineHeight: 1,
                }}>
                  {dayNum}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Calendar modal */}
      <AnimatePresence>
        {showCalendar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: "fixed", inset: 0, zIndex: 9999,
              background: "rgba(0,0,0,0.5)",
              display: "flex", alignItems: "flex-end", justifyContent: "center",
            }}
            onClick={() => setShowCalendar(false)}
          >
            <motion.div
              initial={{ y: 200 }}
              animate={{ y: 0 }}
              exit={{ y: 200 }}
              transition={{ type: "spring", damping: 25 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: "white", borderRadius: "24px 24px 0 0",
                padding: "20px", width: "100%", maxWidth: "480px",
              }}
            >
              {/* Calendar header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                <button
                  onClick={() => setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))}
                  style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", padding: "4px 8px", color: "#6b7280" }}
                >‹</button>
                <span style={{ fontSize: "15px", fontWeight: 500, color: "#1a3a22" }}>
                  {format(calendarMonth, "MMMM yyyy")}
                </span>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <button
                    onClick={() => setCalendarMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))}
                    disabled={format(calendarMonth, "yyyy-MM") >= format(TODAY, "yyyy-MM")}
                    style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", padding: "4px 8px", color: "#6b7280", opacity: format(calendarMonth, "yyyy-MM") >= format(TODAY, "yyyy-MM") ? 0.3 : 1 }}
                  >›</button>
                  <button onClick={() => setShowCalendar(false)} style={{ background: "#f3f4f6", border: "none", borderRadius: "50%", width: "28px", height: "28px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <X style={{ width: "14px", height: "14px", color: "#6b7280" }} />
                  </button>
                </div>
              </div>

              {/* Day labels */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px", marginBottom: "6px" }}>
                {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map(d => (
                  <div key={d} style={{ textAlign: "center", fontSize: "10px", color: "#9ca3af", fontWeight: 500 }}>{d}</div>
                ))}
              </div>

              {/* Calendar days */}
              {(() => {
                const start = startOfMonth(calendarMonth);
                const end = endOfMonth(calendarMonth);
                const days = eachDayOfInterval({ start, end });
                const startDow = (start.getDay() + 6) % 7; // Monday = 0
                const cells = [...Array(startDow).fill(null), ...days];
                while (cells.length % 7 !== 0) cells.push(null);

                return (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px" }}>
                    {cells.map((day, i) => {
                      if (!day) return <div key={i} />;
                      const dateStr = format(day, "yyyy-MM-dd");
                      const todayStr = format(TODAY, "yyyy-MM-dd");
                      const isFutureDay = dateStr > todayStr;
                      const isTodayDay = dateStr === todayStr;
                      const calories = logs[dateStr] || 0;
                      const dotColor = !isFutureDay && calories > 0 ? getStatusColor(calories, calorieGoal) : null;

                      return (
                        <button
                          key={dateStr}
                          onClick={() => {
                            if (!isFutureDay) {
                              onDaySelect?.(dateStr);
                              setShowCalendar(false);
                            }
                          }}
                          disabled={isFutureDay}
                          style={{
                            display: "flex", flexDirection: "column", alignItems: "center",
                            gap: "2px", padding: "6px 2px", borderRadius: "10px",
                            background: isTodayDay ? "#f0fdf4" : "transparent",
                            border: isTodayDay ? "1.5px solid #16a34a" : "none",
                            cursor: isFutureDay ? "default" : "pointer",
                            fontFamily: "inherit", opacity: isFutureDay ? 0.3 : 1,
                          }}
                        >
                          <span style={{ fontSize: "12px", fontWeight: isTodayDay ? 600 : 400, color: isTodayDay ? "#16a34a" : "#1a3a22" }}>
                            {format(day, "d")}
                          </span>
                          <div style={{
                            width: "5px", height: "5px", borderRadius: "50%",
                            background: dotColor || "transparent",
                          }} />
                        </button>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Legenda calendario */}
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