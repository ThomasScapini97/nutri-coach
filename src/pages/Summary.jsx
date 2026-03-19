import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { recalculateTotals } from "@/lib/nutritionUtils";
import { format, subDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar, Flame, Wheat, Drumstick, Droplets, Salad, TrendingUp, Award, CheckCircle2, XCircle } from "lucide-react";
import AnimatedProgressBar from "../components/summary/AnimatedProgressBar";
import FoodEntryItem from "../components/summary/FoodEntryItem";
import WeeklyChart from "../components/summary/WeeklyChart";
import DaySuccessIndicator from "../components/summary/DaySuccessIndicator";
import { motion } from "framer-motion";

export default function Summary() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["userProfile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('user_profiles').select('*').eq('user_id', user.id).single();
      return data;
    },
    enabled: !!user?.id,
  });

  const calorieGoal = profile?.calorie_goal || 2000;
  const proteinGoal = profile?.protein_goal || 120;
  const carbsGoal = profile?.carbs_goal || 250;
  const fatsGoal = profile?.fats_goal || 65;
  const fiberGoal = 30;

  const { data: dayLogs } = useQuery({
    queryKey: ["foodlog", dateStr, user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('food_logs').select('*').eq('date', dateStr).eq('user_id', user.id);
      return data || [];
    },
    enabled: !!user?.id,
    initialData: [],
  });

  const dayLog = dayLogs?.[0] || null;

  const { data: dayEntries } = useQuery({
    queryKey: ["foodEntries", dayLog?.id],
    queryFn: async () => {
      if (!dayLog?.id) return [];
      const { data } = await supabase.from('food_entries').select('*').eq('foodlog_id', dayLog.id);
      return data || [];
    },
    enabled: !!dayLog?.id,
    initialData: [],
  });

  const weekDates = Array.from({ length: 7 }, (_, i) => format(subDays(selectedDate, 6 - i), "yyyy-MM-dd"));

  const { data: weekLogs } = useQuery({
    queryKey: ["foodlog-week", weekDates[0], weekDates[6], user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('food_logs').select('*').eq('user_id', user.id).in('date', weekDates);
      return data || [];
    },
    enabled: !!user?.id,
    initialData: [],
  });

  const weeklyChartData = weekDates.map((d) => {
    const log = weekLogs.find((l) => l.date === d);
    return { day: format(new Date(d + "T12:00:00"), "EEE"), calories: log?.total_calories || 0 };
  });

  const navigateDay = (dir) => {
    setSelectedDate((prev) => { const next = new Date(prev); next.setDate(next.getDate() + dir); return next; });
  };

  const isToday = dateStr === format(new Date(), "yyyy-MM-dd");
  const caloriesConsumed = dayLog?.total_calories || 0;
  const burnedCalories = dayLog?.total_burned_calories || 0;
  const netCalories = Math.max(caloriesConsumed - burnedCalories, 0);
  const caloriesRemaining = Math.max(calorieGoal - netCalories, 0);

  const handleAddEntry = async (group) => {
    if (!dayLog) return;
    await supabase.from('food_entries').insert({
      foodlog_id: dayLog.id,
      food_name: group.food_name,
      food_key: group.food_key || group.food_name.toLowerCase().trim().replace(/\s+/g, "_"),
      meal_type: group.meal_type,
      calories: Math.round(group.calories / group.quantity),
      carbs: Math.round((group.carbs / group.quantity) * 10) / 10,
      protein: Math.round((group.protein / group.quantity) * 10) / 10,
      fats: Math.round((group.fats / group.quantity) * 10) / 10,
      fiber: Math.round((group.fiber / group.quantity) * 10) / 10,
      timestamp: new Date().toISOString(),
    });
    await recalculateTotals(dayLog.id);
    queryClient.invalidateQueries({ queryKey: ["foodEntries", dayLog.id] });
    queryClient.invalidateQueries({ queryKey: ["foodlog"] });
    toast.success(`Added ${group.food_name} ➕`);
  };

  const handleRemoveEntry = async (group) => {
    if (!dayLog) return;
    const idToDelete = group.ids[group.ids.length - 1];
    await supabase.from('food_entries').delete().eq('id', idToDelete);
    await recalculateTotals(dayLog.id);
    queryClient.invalidateQueries({ queryKey: ["foodEntries", dayLog.id] });
    queryClient.invalidateQueries({ queryKey: ["foodlog"] });
    toast.success(`Removed ${group.food_name} ➖`);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background pb-24">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6 pb 0">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-border/50">
          <Button variant="ghost" size="icon" onClick={() => navigateDay(-1)} className="rounded-xl"><ChevronLeft className="w-5 h-5" /></Button>
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="font-bold text-foreground text-lg">{isToday ? "Today" : format(selectedDate, "MMM d, yyyy")}</span>
            {dayLog && <DaySuccessIndicator calories={netCalories} calorieGoal={calorieGoal} />}
          </div>
          <Button variant="ghost" size="icon" onClick={() => navigateDay(1)} disabled={isToday} className="rounded-xl"><ChevronRight className="w-5 h-5" /></Button>
        </motion.div>

        <Card className="border-none shadow-lg bg-gradient-to-br from-primary via-primary to-primary/90 text-white overflow-hidden">
          <CardContent className="pt-6 pb-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="text-white/80 text-sm font-medium mb-1">{burnedCalories > 0 ? "Net Calories" : "Calories Today"}</p>
                <p className="text-5xl font-bold">{netCalories}</p>
                <p className="text-white/70 text-sm mt-1">of {calorieGoal} kcal goal</p>
                {burnedCalories > 0 && <p className="text-white/60 text-xs mt-1">🍽 {caloriesConsumed} eaten · 🔥 {burnedCalories} burned</p>}
              </div>
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center"><Flame className="w-7 h-7 text-white" /></div>
            </div>
            <div className="w-full bg-white/20 rounded-full h-3 overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min((netCalories / calorieGoal) * 100, 100)}%` }} transition={{ duration: 0.8 }} className="bg-white h-3 rounded-full" />
            </div>
            <p className="text-white/90 text-sm mt-3 font-medium">{caloriesRemaining > 0 ? `${caloriesRemaining} kcal remaining` : "Goal reached! 🎉"}</p>
          </CardContent>
        </Card>

        <Card className="shadow-md border-border/50">
          <CardHeader className="pb-3"><CardTitle className="text-lg font-bold flex items-center gap-2"><Award className="w-5 h-5 text-primary" />Daily Nutrition Progress</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            <AnimatedProgressBar label="Carbohydrates" value={dayLog?.total_carbs || 0} max={carbsGoal} unit="g" icon={Wheat} color="chart-3" />
            <AnimatedProgressBar label="Protein" value={dayLog?.total_protein || 0} max={proteinGoal} unit="g" icon={Drumstick} color="chart-4" />
            <AnimatedProgressBar label="Fats" value={dayLog?.total_fats || 0} max={fatsGoal} unit="g" icon={Droplets} color="blue-500" />
            <AnimatedProgressBar label="Fiber" value={dayLog?.total_fiber || 0} max={fiberGoal} unit="g" icon={Salad} color="primary" />
          </CardContent>
        </Card>

        <Card className="shadow-md border-border/50">
          <CardHeader className="pb-3"><CardTitle className="text-lg font-bold flex items-center gap-2"><Flame className="w-5 h-5 text-accent" />What You Ate</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {dayEntries?.length > 0 ? (() => {
              const validEntries = dayEntries.filter(e => e && e.id && e.food_name);
              const grouped = validEntries.reduce((acc, entry) => {
                const mealType = entry.meal_type?.toLowerCase().trim() || "other";
                const foodKey = (entry.food_key || entry.food_name).toLowerCase().trim();
                const key = `${foodKey}_${mealType}`;
                if (!acc[key]) {
                  acc[key] = { ...entry, meal_type: mealType, quantity: 1, ids: [entry.id], total_calories: entry.calories || 0, total_carbs: entry.carbs || 0, total_protein: entry.protein || 0, total_fats: entry.fats || 0, total_fiber: entry.fiber || 0 };
                } else {
                  acc[key].quantity += 1; acc[key].ids.push(entry.id);
                  acc[key].total_calories += entry.calories || 0; acc[key].total_carbs += entry.carbs || 0;
                  acc[key].total_protein += entry.protein || 0; acc[key].total_fats += entry.fats || 0; acc[key].total_fiber += entry.fiber || 0;
                }
                return acc;
              }, {});
              return Object.values(grouped).map(group => (
                <FoodEntryItem key={group.ids[0]} entry={{ ...group, calories: group.total_calories, carbs: group.total_carbs, protein: group.total_protein, fats: group.total_fats, fiber: group.total_fiber }} quantity={group.quantity} onAdd={() => handleAddEntry(group)} onRemove={() => handleRemoveEntry(group)} />
              ));
            })() : (
              <div className="text-center py-10">
                <p className="text-muted-foreground mb-3">No food logged yet today</p>
                <p className="text-sm text-muted-foreground">Head to chat to start tracking! 💬</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-md border-border/50">
          <CardHeader className="pb-3"><CardTitle className="text-lg font-bold flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" />Weekly Trend</CardTitle></CardHeader>
          <CardContent>
            <WeeklyChart data={weeklyChartData} />
            <div className="mt-6 space-y-2">
              <h4 className="text-sm font-semibold text-foreground mb-3">Recent Days</h4>
              {weekLogs.slice().reverse().map((log, i) => {
                const percentage = (log.total_calories / calorieGoal) * 100;
                let Icon = XCircle, iconColor = 'text-destructive', statusText = percentage < 80 ? 'Under goal' : 'Over goal';
                if (percentage >= 90 && percentage <= 110) { Icon = CheckCircle2; iconColor = 'text-primary'; statusText = 'On track'; }
                else if ((percentage >= 80 && percentage < 90) || (percentage > 110 && percentage <= 120)) { Icon = CheckCircle2; iconColor = 'text-amber-600'; statusText = 'Close to goal'; }
                return (
                  <motion.div key={log.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className="flex items-center justify-between py-3 px-4 rounded-xl bg-white border border-border/50">
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 ${iconColor}`} />
                      <div>
                        <p className="text-sm font-semibold">{format(new Date(log.date + "T12:00:00"), "MMM d")}</p>
                        <p className="text-xs text-muted-foreground">{log.total_calories} kcal</p>
                      </div>
                    </div>
                    <div className="text-xs font-medium text-muted-foreground">{statusText}</div>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}