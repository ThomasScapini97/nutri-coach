import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Sparkles } from "lucide-react";
import ChatBubble from "../components/chat/ChatBubble";
import ChatInput from "../components/chat/ChatInput";
import TypingIndicator from "../components/chat/TypingIndicator";
import MotivationalBanner from "../components/chat/MotivationalBanner";
import ExerciseBanner from "../components/chat/ExerciseBanner";
import DailyDashboard from "../components/chat/DailyDashboard";
import DailyNotificationPopup from "../components/notifications/DailyNotificationPopup";
import { evaluateDailyNutrition } from "../components/notifications/DailyEvaluation";
import { useMealReminderCheck } from "../components/notifications/MealReminderToast";
import { toast } from "sonner";
import { recalculateTotals } from "@/lib/nutritionUtils";

const TODAY = format(new Date(), "yyyy-MM-dd");

const WELCOME_MESSAGE = {
  id: "welcome_message",
  role: "assistant",
  content: "Hey there! 👋 I'm your **NutriCoach** — your friendly wellness companion.\n\nTell me what you've eaten today and I'll help you track your calories and nutrition. You can say things like:\n\n- \"I had oatmeal with banana for breakfast\" 🥣\n- \"Grilled chicken salad for lunch\" 🥗\n- \"Give me my daily summary\" 📊\n\nLet's make today a healthy one! What did you eat?",
  timestamp: new Date().toISOString(),
};

function buildSystemPrompt(profile, todayLog, entries = []) {
  const totals = todayLog ? {
    calories: todayLog.total_calories || 0,
    carbs: todayLog.total_carbs || 0,
    protein: todayLog.total_protein || 0,
    fats: todayLog.total_fats || 0,
    fiber: todayLog.total_fiber || 0,
  } : { calories: 0, carbs: 0, protein: 0, fats: 0, fiber: 0 };

  const calorieGoal = profile?.calorie_goal || 2000;
  const proteinGoal = profile?.protein_goal || 120;
  const carbsGoal = profile?.carbs_goal || 250;
  const fatsGoal = profile?.fats_goal || 65;
  const fiberGoal = 30;

  const remaining = {
    calories: Math.max(calorieGoal - totals.calories, 0),
    protein: Math.max(proteinGoal - totals.protein, 0),
    carbs: Math.max(carbsGoal - totals.carbs, 0),
    fats: Math.max(fatsGoal - totals.fats, 0),
    fiber: Math.max(fiberGoal - totals.fiber, 0),
  };

  let conversationContext = "";
  if (entries.length > 0) {
    conversationContext = "\n\n**IMPORTANT: Current meals logged today (source of truth):**\n";
    entries.forEach((entry, idx) => {
      conversationContext += `${idx + 1}. ${entry.meal_type}: ${entry.food_name} (${entry.calories} kcal, ${entry.protein}g protein, ${entry.carbs}g carbs, ${entry.fats}g fat, ${entry.fiber}g fiber)\n`;
    });
    conversationContext += `\n**Current totals: ${totals.calories} kcal, ${totals.protein}g protein, ${totals.carbs}g carbs, ${totals.fats}g fat, ${totals.fiber}g fiber**`;
  } else {
    conversationContext = "\n\n**IMPORTANT: No meals logged today yet. The daily food log is empty.**";
  }

  const burnedToday = todayLog?.total_burned_calories || 0;

  return `You are NutriCoach, an intelligent and personalized AI nutrition coach.

**Core Personality:**
- Friendly, warm, and encouraging like a supportive personal coach
- Clear and helpful without being overly technical
- Remember previous meals today and reference them naturally

**User Profile:**
${profile ? `Age: ${profile.age || 'not set'}, Weight: ${profile.weight || 'not set'}kg, Height: ${profile.height || 'not set'}cm, Activity: ${profile.activity_level || 'not set'}, Goal: ${profile.goal || 'maintain'}` : 'Not configured yet'}

**Daily Goals:**
- Calories: ${calorieGoal} kcal (${remaining.calories} remaining)
- Protein: ${proteinGoal}g (${remaining.protein}g remaining)
- Carbs: ${carbsGoal}g (${remaining.carbs}g remaining)
- Fats: ${fatsGoal}g (${remaining.fats}g remaining)
- Fiber: ${fiberGoal}g (${remaining.fiber}g remaining)
${conversationContext}

Today's total burned so far: ${burnedToday} kcal

**CRITICAL: Multi-Food Parsing**
When user mentions multiple foods, split into SEPARATE objects in "foods" array.

**CRITICAL: Food vs Question vs Exercise**
1. User ATE something → LOG IT (foods array)
2. User ASKING about food → DO NOT LOG, simulate
3. User mentions exercise → foods: [], set burned_calories

**Response Format (JSON only, no markdown code blocks):**
{
  "message": "your response",
  "foods": [{"food_name": "name", "meal_type": "breakfast/lunch/dinner/snack", "calories": 0, "carbs": 0, "protein": 0, "fats": 0, "fiber": 0}],
  "burned_calories": 0,
  "is_simulation": false
}

IMPORTANT: Return ONLY the JSON object, no other text.`;
}

export default function Chat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const [dailyEvaluation, setDailyEvaluation] = useState(null);
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["userProfile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('user_profiles').select('*').eq('user_id', user.id).single();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: todayLogs } = useQuery({
    queryKey: ["foodlog", TODAY, user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('food_logs').select('*').eq('date', TODAY).eq('user_id', user.id);
      return data || [];
    },
    enabled: !!user?.id,
    initialData: [],
  });

  const todayLog = todayLogs?.[0] || null;

  const { data: foodEntries } = useQuery({
    queryKey: ["foodEntries", todayLog?.id],
    queryFn: async () => {
      if (!todayLog?.id) return [];
      const { data } = await supabase.from('food_entries').select('*').eq('foodlog_id', todayLog.id).order('timestamp', { ascending: true });
      return data || [];
    },
    enabled: !!todayLog?.id,
    initialData: [],
  });

  const { data: chatMessages } = useQuery({
    queryKey: ["messages", todayLog?.id],
    queryFn: async () => {
      if (!todayLog?.id) return [];
      const { data } = await supabase.from('messages').select('*').eq('foodlog_id', todayLog.id).order('timestamp', { ascending: true });
      return (data || []).map(msg => ({ ...msg, id: msg.id || crypto.randomUUID() }));
    },
    enabled: !!todayLog?.id,
    initialData: [],
  });

  const calorieGoal = profile?.calorie_goal || 2000;

  useEffect(() => {
    if (chatMessages?.length > 0) {
      setMessages([WELCOME_MESSAGE, ...chatMessages]);
    } else {
      setMessages([WELCOME_MESSAGE]);
    }
  }, [chatMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    const checkEndOfDay = () => {
      const hour = new Date().getHours();
      if (hour === 21 && todayLog && !dailyEvaluation) {
        const evaluation = evaluateDailyNutrition(todayLog, calorieGoal);
        if (evaluation) setDailyEvaluation(evaluation);
      }
    };
    const interval = setInterval(checkEndOfDay, 60000);
    checkEndOfDay();
    return () => clearInterval(interval);
  }, [todayLog, calorieGoal, dailyEvaluation]);

  const lastLogTime = chatMessages?.length ? chatMessages[chatMessages.length - 1].timestamp : null;
  useMealReminderCheck(lastLogTime);

  const handleSend = async (text) => {
    const userMessage = { id: crypto.randomUUID(), role: "user", content: text, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const systemPrompt = buildSystemPrompt(profile, todayLog, foodEntries || []);
      const recentMessages = [...messages, userMessage].filter(m => m.id !== "welcome_message").slice(-6).map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));

   const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
  },
  body: JSON.stringify({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    system: systemPrompt,
    messages: recentMessages,
  }),
});

const data = await response.json();
const rawText = data.content?.[0]?.text || '{"message": "Sorry, I could not process your request.", "foods": [], "burned_calories": 0}';

      let result;
      try {
        result = JSON.parse(rawText.replace(/```json|```/g, "").trim());
      } catch {
        result = { message: rawText, foods: [], burned_calories: 0 };
      }

      const foods = Array.isArray(result.foods) ? result.foods : [];
      const burnedCalories = result.burned_calories || 0;
      const assistantMessage = { id: crypto.randomUUID(), role: "assistant", content: result.message, timestamp: new Date().toISOString(), nutrition: null };

      // Ensure FoodLog exists
      let currentLogId = todayLog?.id;
      if (!currentLogId) {
        const { data: created } = await supabase.from('food_logs').insert({
          date: TODAY, user_id: user.id,
          total_calories: 0, total_carbs: 0, total_protein: 0, total_fats: 0, total_fiber: 0, total_burned_calories: 0,
        }).select().single();
        currentLogId = created.id;
      }

      // Create food entries
      let createdEntries = [];
      if (foods.length > 0) {
        const { data: inserted } = await supabase.from('food_entries').insert(
          foods.map(food => ({
            foodlog_id: currentLogId,
            food_name: food.food_name,
            food_key: food.food_name.toLowerCase().trim().replace(/\s+/g, '_'),
            meal_type: food.meal_type,
            calories: food.calories || 0,
            carbs: food.carbs || 0,
            protein: food.protein || 0,
            fats: food.fats || 0,
            fiber: food.fiber || 0,
            timestamp: new Date().toISOString(),
          }))
        ).select();
        createdEntries = inserted || [];
        assistantMessage.nutrition = { foods: foods.map((food, i) => ({ ...food, entry_id: createdEntries[i]?.id })) };
      }

      setMessages(prev => [...prev, assistantMessage]);
      setIsLoading(false);

      await recalculateTotals(currentLogId);

      if (burnedCalories > 0) {
        const totalBurned = (todayLog?.total_burned_calories || 0) + burnedCalories;
        await supabase.from('food_logs').update({ total_burned_calories: totalBurned }).eq('id', currentLogId);
      }

      await supabase.from('messages').insert([
        { foodlog_id: currentLogId, role: userMessage.role, content: userMessage.content, timestamp: userMessage.timestamp },
        { foodlog_id: currentLogId, role: assistantMessage.role, content: assistantMessage.content, timestamp: assistantMessage.timestamp, nutrition: assistantMessage.nutrition || null },
      ]);

      queryClient.invalidateQueries({ queryKey: ["foodlog"] });
      queryClient.invalidateQueries({ queryKey: ["foodEntries", currentLogId] });
      queryClient.invalidateQueries({ queryKey: ["messages", currentLogId] });

      if (foods.length > 0) toast.success("Meal logged! 🎉", { description: "Your nutrition has been updated." });
      if (burnedCalories > 0) toast.success("Exercise logged! 🔥", { description: `${burnedCalories} kcal burned.` });

    } catch (error) {
      console.error("Error:", error);
      toast.error("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col bg-background" style={{ height: "100dvh", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <DailyNotificationPopup evaluation={dailyEvaluation} onClose={() => setDailyEvaluation(null)} />
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border/50 bg-white shadow-sm">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center md:hidden shadow-sm">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-bold text-foreground text-lg">Chat with NutriCoach</h2>
          <p className="text-xs text-muted-foreground">
            {todayLog ? `${todayLog.total_calories || 0} kcal logged today` : "Start tracking your meals"}
          </p>
        </div>
      </div>
      <DailyDashboard todayLog={todayLog} calorieGoal={calorieGoal} proteinGoal={profile?.protein_goal || 120} carbsGoal={profile?.carbs_goal || 250} fatsGoal={profile?.fats_goal || 65} fiberGoal={30} />
      <ExerciseBanner burnedCalories={todayLog?.total_burned_calories} />
      {todayLog && <MotivationalBanner todayLog={todayLog} calorieGoal={calorieGoal} />}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5 pb-40" style={{backgroundColor: "#f0fcf3"}}>
        <div className="max-w-4xl mx-auto space-y-5">
          {messages.map((msg) => <ChatBubble key={msg.id} message={msg} foodEntries={foodEntries} />)}
          {isLoading && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <ChatInput onSend={handleSend} isLoading={isLoading} />
    </div>
  );
}