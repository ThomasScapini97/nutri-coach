import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, X } from "lucide-react";

const getToday = () => new Date();
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

function getBarColor(calories, goal) {
  if (!calories || calories === 0) return "#f3f4f6";
  const pct = (calories / goal) * 100;
  if (pct >= 90 && pct <= 110) return "#16a34a";
  if ((pct >= 80 && pct < 90) || (pct > 110 && pct <= 120)) return "#f59e0b";
  return "#ef4444";
}

export default function ScrollableChart({ calorieGoal = 2000, selectedDate }) {
  const { user } = useAuth();
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayEntries, setDayEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const scrollRef = useRef(null);

  const allDays = Array.from({ length: DAYS_BACK + FUTURE_DAYS + 1 }, (_, i) =>
    format(subDays(getToday(), DAYS_BACK - i), "yyyy-MM-dd")
  );

  const { data: logsData } = useQuery({
    queryKey: ["foodlog", "chart-90days", user?.id],
    queryFn: async () => {
      const from = format(subDays(getToday(), DAYS_BACK), "yyyy-MM-dd");
      const to = format(getToday(), "yyyy-MM-dd");
      const { data } = await supabase
        .from("food_logs")
        .select("date, total_calories, total_burned_calories")
        .eq("user_id", user.id)
        .gte("date", from)
        .lte("date", to);
      const map = {};
      (data || []).forEach(l => {
        map[l.date] = Math.max((l.total_calories || 0) - (l.total_burned_calories || 0), 0);
      });
      return map;
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    enabled: !!user?.id,
  });

  const logs = logsData ?? {};

  useEffect(() => {
    if (!scrollRef.current) return;
    const todayIndex = allDays.findIndex(d => d === format(getToday(), "yyyy-MM-dd"));
    scrollRef.current.scrollLeft = (todayIndex - 4) * (BAR_WIDTH + BAR_GAP);
  }, []);

  useEffect(() => {
    if (!scrollRef.current || !selectedDate) return;
    const idx = allDays.findIndex(d => d === selectedDate);
    if (idx >= 0) {
      scrollRef.current.scrollLeft = Math.max(0, (idx - 3) * (BAR_WIDTH + BAR_GAP));
    }
  }, [selectedDate]);

  useEffect(() => {
    return () => {
      const scrollY = document.body.style.top;
      document.body.style.overflow = '';
      document.body.style.top = '';
      if (scrollY) window.scrollTo(0, parseInt(scrollY) * -1);
    };
  }, []);

  const closeDayDetail = () => {
    const scrollY = document.body.style.top;
    document.body.style.overflow = '';
    document.body.style.top = '';
    if (scrollY) window.scrollTo(0, parseInt(scrollY) * -1);
    setSelectedDay(null);
  };

  const openDayDetail = async (dateStr) => {
    if (dateStr >= format(getToday(), "yyyy-MM-dd") && dateStr !== format(getToday(), "yyyy-MM-dd")) return;
    const scrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.top = `-${scrollY}px`;
    setSelectedDay(dateStr);
    setDayEntries([]);
    setLoadingEntries(true);
    const { data: logData } = await supabase
      .from("food_logs")
      .select("id, total_calories, total_protein, total_carbs, total_fats")
      .eq("user_id", user.id)
      .eq("date", dateStr)
      .maybeSingle();
    if (logData?.id) {
      const { data: entries } = await supabase
        .from("food_entries")
        .select("food_name, meal_type, calories")
        .eq("foodlog_id", logData.id)
        .order("timestamp", { ascending: true });
      setDayEntries(entries || []);
    }
    setLoadingEntries(false);
  };

  const maxCalories = Math.max(calorieGoal, ...Object.values(logs).filter(Boolean));

  const mealColors = {
    breakfast: { bg: "#fef3c7", color: "#92400e" },
    lunch: { bg: "#dbeafe", color: "#1e40af" },
    dinner: { bg: "#ede9fe", color: "#5b21b6" },
    snack: { bg: "#dcfce7", color: "#166534" },
  };

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
      <div ref={scrollRef} style={{ overflowX: "auto", overflowY: "visible", scrollbarWidth: "none", msOverflowStyle: "none" }}>
        <div style={{
          display: "flex", alignItems: "flex-end", gap: `${BAR_GAP}px`,
          width: `${allDays.length * (BAR_WIDTH + BAR_GAP)}px`,
          height: "80px",
        }}>
          {allDays.map((dateStr) => {
            const calories = logs[dateStr] || 0;
            const todayStr = format(getToday(), "yyyy-MM-dd");
            const isTodayBar = dateStr === todayStr;
            const isSelectedBar = dateStr === selectedDate;
            const isFutureBar = dateStr > todayStr;
            const barColor = isFutureBar ? "#f3f4f6" : getBarColor(calories, calorieGoal);
            const barHeight = isFutureBar || !calories ? 4 : Math.max(4, (calories / maxCalories) * 40);
            const dayLabel = format(new Date(dateStr + "T12:00:00"), "EEE");
            const dayNum = format(new Date(dateStr + "T12:00:00"), "d");
            const labelColor = isSelectedBar ? "#16a34a" : isTodayBar ? "#16a34a" : "#9ca3af";
            const labelWeight = isSelectedBar ? 700 : isTodayBar ? 600 : 400;

            return (
              <div
                key={dateStr}
                onClick={() => !isFutureBar && openDayDetail(dateStr)}
                style={{
                  width: `${BAR_WIDTH}px`, flexShrink: 0,
                  display: "flex", flexDirection: "column", alignItems: "center",
                  cursor: isFutureBar ? "default" : "pointer",
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
                      border: isTodayBar ? "2px solid #15803d" : "none",
                      outline: isSelectedBar && !isTodayBar ? "2px solid #16a34a" : "none",
                      outlineOffset: "2px",
                    }}
                  />
                </div>
                <div style={{ textAlign: "center", paddingTop: "6px" }}>
                  <div style={{ fontSize: isSelectedBar ? "11px" : "10px", color: labelColor, fontWeight: labelWeight, lineHeight: 1.2 }}>
                    {dayNum}
                  </div>
                  <div style={{ fontSize: "8px", color: isSelectedBar || isTodayBar ? labelColor : "#d1d5db", lineHeight: 1.2 }}>
                    {dayLabel}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Popup dettaglio giorno */}
      <AnimatePresence>
        {selectedDay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center", overscrollBehavior: "contain" }}
            onClick={() => closeDayDetail()}
            onTouchMove={e => e.stopPropagation()}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              onClick={e => e.stopPropagation()}
              onTouchMove={e => e.stopPropagation()}
              style={{
                background: "white", borderRadius: "24px 24px 0 0",
                width: "100%", maxWidth: "480px", maxHeight: "70vh",
                display: "flex", flexDirection: "column", position: "relative",
              }}
            >
              {/* Header — fixed */}
              <div style={{ padding: "20px 20px 12px", flexShrink: 0, borderBottom: "0.5px solid rgba(0,0,0,0.06)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ fontSize: "15px", fontWeight: 500, color: "#1a3a22", margin: 0 }}>
                      {format(new Date(selectedDay + "T12:00:00"), "EEEE, MMM d")}
                    </p>
                    <p style={{ fontSize: "11px", color: "#9ca3af", margin: 0 }}>Read only — past day</p>
                  </div>
                  <button onClick={() => closeDayDetail()} style={{ background: "#f3f4f6", border: "none", borderRadius: "50%", width: "28px", height: "28px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <X style={{ width: "14px", height: "14px", color: "#6b7280" }} />
                  </button>
                </div>
              </div>

              {/* Scrollable content */}
              <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px", paddingBottom: "calc(80px + env(safe-area-inset-bottom))", WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }} onTouchMove={e => e.stopPropagation()}>
                {/* Calorie summary */}
                {logs[selectedDay] > 0 && (
                  <div style={{
                    background: "#f0fdf4", borderRadius: "12px", padding: "10px 14px",
                    marginBottom: "12px", display: "flex", alignItems: "center", justifyContent: "space-between",
                  }}>
                    <span style={{ fontSize: "12px", color: "#16a34a", fontWeight: 500 }}>Total calories</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "16px", fontWeight: 600, color: "#1a3a22" }}>{logs[selectedDay]}</span>
                      <span style={{ fontSize: "11px", color: "#9ca3af" }}>/ {calorieGoal} kcal</span>
                      <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: getStatusColor(logs[selectedDay], calorieGoal) || "#e5e7eb" }} />
                    </div>
                  </div>
                )}

                {/* Lista pasti */}
                {loadingEntries ? (
                  <div style={{ textAlign: "center", padding: "24px", color: "#9ca3af", fontSize: "13px" }}>Loading...</div>
                ) : dayEntries.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {Object.values(dayEntries.reduce((acc, entry) => {
                      const mealType = entry.meal_type?.toLowerCase().trim() || "other";
                      const foodKey = (entry.food_name || "").toLowerCase().trim().replace(/\s+/g, "_");
                      const key = `${foodKey}_${mealType}`;
                      if (!acc[key]) {
                        acc[key] = { ...entry, meal_type: mealType, quantity: 1, totalCalories: entry.calories || 0 };
                      } else {
                        acc[key].quantity += 1;
                        acc[key].totalCalories += entry.calories || 0;
                      }
                      return acc;
                    }, {})).map((group, i) => {
                      const s = mealColors[group.meal_type] || { bg: "#f3f4f6", color: "#6b7280" };
                      return (
                        <div key={i} style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          padding: "10px 12px", background: "white", borderRadius: "12px",
                          border: "0.5px solid rgba(0,0,0,0.06)",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "20px", background: s.bg, color: s.color, fontWeight: 500 }}>
                              {group.meal_type}
                            </span>
                            <span style={{ fontSize: "13px", color: "#1a3a22" }}>{group.food_name}</span>
                            {group.quantity > 1 && (
                              <span style={{ fontSize: "11px", color: "#6b7280" }}>x{group.quantity}</span>
                            )}
                          </div>
                          <span style={{ fontSize: "12px", fontWeight: 500, color: "#dc2626" }}>{group.totalCalories} kcal</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "24px", color: "#9ca3af", fontSize: "13px" }}>
                    No food logged this day
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Calendar modal */}
      <AnimatePresence>
        {showCalendar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
            onClick={() => setShowCalendar(false)}
          >
            <motion.div
              initial={{ y: 200 }}
              animate={{ y: 0 }}
              exit={{ y: 200 }}
              transition={{ type: "spring", damping: 25 }}
              onClick={e => e.stopPropagation()}
              style={{ background: "white", borderRadius: "24px 24px 0 0", padding: "20px", width: "100%", maxWidth: "480px" }}
            >
              {/* Calendar header */}
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
                      const calories = logs[dateStr] || 0;
                      const dotColor = !isFutureDay && calories > 0 ? getStatusColor(calories, calorieGoal) : null;

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
                            background: isTodayDay ? "#f0fdf4" : "transparent",
                            border: isTodayDay ? "1.5px solid #16a34a" : "none",
                            cursor: isFutureDay ? "default" : "pointer",
                            fontFamily: "inherit", opacity: isFutureDay ? 0.3 : 1,
                          }}
                        >
                          <span style={{ fontSize: "12px", fontWeight: isTodayDay ? 600 : 400, color: isTodayDay ? "#16a34a" : "#1a3a22" }}>
                            {format(day, "d")}
                          </span>
                          <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: dotColor || "transparent" }} />
                        </button>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Legenda */}
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