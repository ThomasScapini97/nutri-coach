import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import ChatBubble from "../components/chat/ChatBubble";
import TypingIndicator from "../components/chat/TypingIndicator";
import { useChatContext } from "@/lib/ChatContext";
import DailyDashboard from "../components/chat/DailyDashboard";
import DailyNotificationPopup from "../components/notifications/DailyNotificationPopup";
import { evaluateDailyNutrition } from "../components/notifications/DailyEvaluation";
import { useMealReminderCheck } from "../components/notifications/MealReminderToast";
import { toast } from "sonner";
import { recalculateTotals, FIBER_GOAL, getToday } from "@/lib/nutritionUtils";
import { generateDailySummary, loadPastSummaries } from "@/lib/dailySummary";
import { AI_MAX_TOKENS, CHAT_HISTORY_LIMIT } from "@/lib/constants";
import { updateStreak } from "@/lib/streakUtils";
import BarcodeScanner from "../components/chat/BarcodeScanner";

const WELCOME_MESSAGE = {
  id: "welcome_message",
  role: "assistant",
  content: "Hey there! 👋 I'm your **NutriCoach** — your friendly wellness companion.\n\nTell me what you've eaten today and I'll help you track your calories and nutrition. You can say things like:\n\n- \"I had oatmeal with banana for breakfast\" 🥣\n- \"Grilled chicken salad for lunch\" 🥗\n- \"Give me my daily summary\" 📊\n\nLet's make today a healthy one! What did you eat?",
  timestamp: new Date().toISOString(),
};

function buildSystemPrompt(profile, todayLog, entries = [], pastSummaries = []) {
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
  const fiberGoal = FIBER_GOAL;

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
      conversationContext += `${idx + 1}. ${entry.meal_type}: ${entry.food_name}${entry.grams ? ` (${entry.grams}g)` : ''} — ${entry.calories} kcal, ${entry.protein}g protein, ${entry.carbs}g carbs, ${entry.fats}g fat, ${entry.fiber}g fiber\n`;
    });
    conversationContext += `\n**Current totals: ${totals.calories} kcal, ${totals.protein}g protein, ${totals.carbs}g carbs, ${totals.fats}g fat, ${totals.fiber}g fiber**`;
  } else {
    conversationContext = "\n\n**IMPORTANT: No meals logged today yet. The daily food log is empty.**";
  }

  const burnedToday = todayLog?.total_burned_calories || 0;

  return `You are NutriCoach, an intelligent and personalized AI nutrition coach with expert knowledge of nutrition databases.

**Core Personality:**
- IMPORTANT: Always respond in the same language the user writes in. If the user writes in Italian, respond in Italian. If in English, respond in English. Never switch language mid-conversation.
- Friendly, warm, and encouraging like a supportive personal coach
- Clear and helpful without being overly technical
- Remember previous meals today and reference them naturally
- Response style: ${profile?.chat_style === 'detailed' ? 'Be detailed, give advice, explain nutritional values and suggest improvements. Be like a personal coach.' : 'BE CONCISE: Max 3-4 lines. Bold key numbers. Only give advice if explicitly asked.'}

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

**CRITICAL: Nutrition Calculation Rules**
You MUST calculate calories and macros accurately based on the EXACT quantity specified by the user.

Unit conversion reference — PER SINGLE UNIT (use these exact values for each individual item):
- 1 uovo intero = 55g = 85 kcal, 7g protein, 6g fat, 0g carbs, 0g fiber
- 1 fetta pane comune = 30g = 81 kcal, 3g protein, 16g carbs, 0.5g fat
- 1 fetta pane tostato = 25g = 78 kcal, 2.5g protein, 15g carbs, 1g fat
- 1 cucchiaio olio = 10g = 88 kcal, 0g protein, 0g carbs, 10g fat
- 1 cucchiaino olio = 5g = 44 kcal, 0g protein, 0g carbs, 5g fat
- 1 porzione pasta cruda = 80g = 280 kcal, 10g protein, 57g carbs, 1g fat
- 1 porzione riso crudo = 80g = 286 kcal, 6g protein, 63g carbs, 0.5g fat
- 1 banana media = 120g = 107 kcal, 1g protein, 27g carbs, 0g fat
- 1 mela media = 150g = 78 kcal, 0.5g protein, 21g carbs, 0g fat
- 1 bicchiere latte = 200ml = 128 kcal, 7g protein, 10g carbs, 7g fat
- 1 vasetto yogurt greco = 150g = 150 kcal, 15g protein, 6g carbs, 7g fat
- 1 cup = ~240ml

Nutrition values per 100g (use these as reference, apply to actual quantity):
- Bresaola: 155 kcal, 32g protein, 0g carbs, 2g fat, 0g fiber
- Olio d'oliva: 884 kcal, 0g protein, 0g carbs, 100g fat, 0g fiber
- Parmigiano reggiano: 392 kcal, 33g protein, 0g carbs, 28g fat, 0g fiber
- Prosciutto crudo: 250 kcal, 26g protein, 0g carbs, 17g fat, 0g fiber
- Petto di pollo: 165 kcal, 31g protein, 0g carbs, 4g fat, 0g fiber
- Pasta: 350 kcal, 12g protein, 71g carbs, 1g fat, 3g fiber
- Riso: 358 kcal, 7g protein, 79g carbs, 1g fat, 1g fiber
- Pane comune: 270 kcal, 9g protein, 53g carbs, 1g fat, 3g fiber
- Pane tostato: 310 kcal, 10g protein, 60g carbs, 3g fat, 3g fiber
- Mozzarella: 280 kcal, 18g protein, 2g carbs, 22g fat, 0g fiber
- Uovo intero: 155 kcal per 100g — 1 egg = 55g = 85 kcal, 13g protein, 1g carbs, 11g fat, 0g fiber
- Latte intero: 64 kcal, 3g protein, 5g carbs, 4g fat, 0g fiber
- Yogurt greco: 100 kcal, 10g protein, 4g carbs, 5g fat, 0g fiber
- Banana: 89 kcal, 1g protein, 23g carbs, 0g fat, 3g fiber
- Mela: 52 kcal, 0g protein, 14g carbs, 0g fat, 2g fiber
- Salmone: 208 kcal, 20g protein, 0g carbs, 13g fat, 0g fiber
- Tonno in scatola: 116 kcal, 26g protein, 0g carbs, 1g fat, 0g fiber
- Avocado: 160 kcal, 2g protein, 9g carbs, 15g fat, 7g fiber

CALCULATION EXAMPLES:
"150g bresaola" → ONE entry: food_name="bresaola", grams=150, calories=232, protein=48, fats=3, carbs=0
"due uova" → TWO entries each: food_name="uovo", grams=55, calories=85, protein=7, fats=6, carbs=0
"3 cucchiai olio" → THREE entries each: food_name="olio d'oliva", grams=10, calories=88, protein=0, fats=10, carbs=0
"100g parmigiano" → ONE entry: food_name="parmigiano reggiano", grams=100, calories=392, protein=33, fats=28, carbs=0

**CRITICAL: food_name must be CLEAN**
- food_name: only the food name, NO quantities, NO descriptions (e.g. "bresaola", "olio d'oliva", "parmigiano reggiano", "pane tostato")
- grams: the actual quantity in grams (convert units if needed: cucchiai→g, fette→g, ml→g)
- If quantity not specified, use a reasonable default and mention it in the message
- Descriptions like "a scaglie", "al vapore", "grigliato" go in food_name only if they significantly change nutrition, otherwise omit

**CRITICAL: Multi-Food Parsing**
When user mentions multiple units of the SAME food, create SEPARATE entries for each unit (so the Summary can show "uovo x2" with +/- controls).
When user mentions multiple DIFFERENT foods, create one entry per food type.
The grams field = weight of ONE single unit, not the total.
Example: "due uova" → TWO entries each: food_name="uovo", grams=55, calories=85, protein=7, fats=6, carbs=0
Example: "3 cucchiai olio" → THREE entries each: food_name="olio d'oliva", grams=10, calories=88, fats=10
Example: "pasta e insalata" → ONE entry "pasta" + ONE entry "insalata"

**CRITICAL: Food vs Question vs Exercise**
1. User ATE something → LOG IT (foods array). When in doubt, ALWAYS log it.
2. User ASKING hypothetically → DO NOT LOG, simulate (is_simulation: true). Only skip logging if user explicitly uses words like: "what if", "would", "se mangiassi", "quante calorie ha", "cosa ha", "how many", "hypothetically"
3. User mentions exercise → foods: [], set burned_calories

**Response Format (JSON only, no markdown code blocks):**
{
  "message": "your response",
  "foods": [
    {
      "food_name": "clean name only",
      "meal_type": "breakfast/lunch/dinner/snack",
      "grams": 150,
      "calories": 232,
      "carbs": 0,
      "protein": 48,
      "fats": 2,
      "fiber": 0
    }
  ],
  "burned_calories": 0,
  "is_simulation": false
}

**Past 7 days memory (use this to give personalized, contextual advice):**
${pastSummaries.length > 0
  ? pastSummaries.map(s => `- ${s}`).join("\n")
  : "No past data available yet — this is the user's first days using the app."}

IMPORTANT: Return ONLY the JSON object, no other text.`;
}

export default function Chat() {
  const { user } = useAuth();
  const { setChatInputProps } = useChatContext();
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const [dailyEvaluation, setDailyEvaluation] = useState(null);
  const [evaluationDismissed, setEvaluationDismissed] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [pastSummaries, setPastSummaries] = useState([]);
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();
  const handleSendRef = useRef(null);
  const handlePhotoSendRef = useRef(null);
  const lastScrollTop = useRef(0);
  const [dashboardTop, setDashboardTop] = useState(0);

  const { data: profile } = useQuery({
    queryKey: ["userProfile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: todayLogs } = useQuery({
    queryKey: ["foodlog", getToday(), user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('food_logs').select('*').eq('date', getToday()).eq('user_id', user.id);
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

  const streak = profile?.current_streak || 0;

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
      setMessages(chatMessages);
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
      if (hour === 21 && todayLog && !dailyEvaluation && !evaluationDismissed) {
        const evaluation = evaluateDailyNutrition(todayLog, calorieGoal);
        if (evaluation) setDailyEvaluation(evaluation);
      }
    };
    const interval = setInterval(checkEndOfDay, 60000);
    checkEndOfDay();
    return () => clearInterval(interval);
  }, [todayLog, calorieGoal, dailyEvaluation, evaluationDismissed]);

  const isLoadingRef = useRef(false);
  useEffect(() => { isLoadingRef.current = isLoading; }, [isLoading]);

  useEffect(() => {
    const now = new Date();
    const msUntilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5).getTime() - now.getTime();
    const timer = setTimeout(() => {
      if (!isLoadingRef.current) window.location.reload();
    }, msUntilMidnight);
    return () => clearTimeout(timer);
  }, []);

  // Load past summaries and silently generate yesterday's if missing
  useEffect(() => {
    if (!user?.id) return;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = format(yesterday, "yyyy-MM-dd");
    const calorieGoal = profile?.calorie_goal || 2000;
    generateDailySummary(user.id, yesterdayStr, calorieGoal)
      .then(() => loadPastSummaries(user.id))
      .then(setPastSummaries)
      .catch(() => {});
  }, [user?.id, profile?.calorie_goal]);

  const systemPrompt = useMemo(
    () => buildSystemPrompt(profile, todayLog, foodEntries || [], pastSummaries),
    [profile, todayLog, foodEntries, pastSummaries]
  );

  const lastLogTime = chatMessages?.length ? chatMessages[chatMessages.length - 1].timestamp : null;
  useMealReminderCheck(lastLogTime);

  const handlePhotoSend = async (imageBase64) => {
    await handleSendRef.current?.("📷 Foto", imageBase64);
  };

  const handleSend = async (text, imageBase64 = null) => {
    const userMessage = { id: crypto.randomUUID(), role: "user", content: text, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // systemPrompt is memoized at component level
      const history = messages
        .filter(m => m.id !== "welcome_message" && (m.role === "user" || m.role === "assistant"))
        .slice(-CHAT_HISTORY_LIMIT)
        .map(m => ({ role: m.role, content: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }));
      // If photo: send as vision message with image + text prompt
      const lastUserContent = imageBase64
        ? [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageBase64 } },
            { type: "text", text: "Analyze this food photo. Identify what food is visible and estimate the portion size, then log it." },
          ]
        : userMessage.content;

      const recentMessages = [...history, { role: "user", content: lastUserContent }];

      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: AI_MAX_TOKENS,
          system: systemPrompt,
          messages: recentMessages,
        }),
      });

      if (response.status === 429) {
        const errorData = await response.json();
        toast.error("Daily limit reached! 🌅", {
          description: errorData.message || "Come back tomorrow for more messages.",
          duration: 5000,
        });
        setIsLoading(false);
        return;
      }

      const data = await response.json();
      const rawText = data.content?.[0]?.text || '{"message": "Sorry, I could not process your request.", "foods": [], "burned_calories": 0}';

      let result;
      try {
        const cleaned = rawText.replace(/```json|```/g, "").trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        result = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        if (!result || !result.message) throw new Error("Invalid");
      } catch {
        // Try to repair truncated JSON (e.g. max_tokens hit mid-response)
        try {
          const cleaned = rawText.replace(/```json|```/g, "").trim();
          const partial = cleaned.replace(/,?\s*"foods"[\s\S]*$/, "");
          const repaired = partial + ',"foods":[],"burned_calories":0}';
          result = JSON.parse(repaired);
          if (!result?.message) throw new Error("Repair failed");
        } catch {
          // Final fallback: extract message text only
          const msgMatch = rawText.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/);
          const fallbackMsg = msgMatch
            ? msgMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"')
            : rawText.replace(/```json|```/g, "").trim() || "Sorry, something went wrong.";
          result = { message: fallbackMsg, foods: [], burned_calories: 0 };
        }
      }

      const foods = Array.isArray(result.foods) ? result.foods : [];
      const burnedCalories = result.burned_calories || 0;
      const assistantMessage = { id: crypto.randomUUID(), role: "assistant", content: result.message, timestamp: new Date().toISOString(), nutrition: null };

      let currentLogId = todayLog?.id;
      if (!currentLogId) {
        const { data: created, error: insertError } = await supabase.from('food_logs').insert({
          date: getToday(), user_id: user.id,
          total_calories: 0, total_carbs: 0, total_protein: 0, total_fats: 0, total_fiber: 0, total_burned_calories: 0,
        }).select().single();
        if (insertError) {
          // Race condition: another request already created the log — re-fetch it
          const { data: existing } = await supabase.from('food_logs')
            .select('id').eq('date', getToday()).eq('user_id', user.id).maybeSingle();
          currentLogId = existing?.id;
        } else {
          currentLogId = created?.id;
        }
        if (!currentLogId) throw new Error("Failed to create food log");
      }

      let createdEntries = [];
      if (foods.length > 0) {
        const { data: inserted } = await supabase.from('food_entries').insert(
          foods.map(food => ({
            foodlog_id: currentLogId,
            food_name: food.food_name,
            food_key: food.food_name.toLowerCase().trim().replace(/\s+/g, '_'),
            meal_type: food.meal_type,
            grams: food.grams || null,
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

      if (foods.length > 0) updateStreak(supabase, user.id, getToday());

      queryClient.invalidateQueries({ queryKey: ["foodlog"] });
      queryClient.invalidateQueries({ queryKey: ["foodEntries", currentLogId] });
      queryClient.invalidateQueries({ queryKey: ["messages", currentLogId] });
      if (foods.length > 0) queryClient.invalidateQueries({ queryKey: ["userProfile", user?.id] });

      if (foods.length > 0) toast.success("Meal logged! 🎉", { description: "Your nutrition has been updated." });
      if (burnedCalories > 0) toast.success("Exercise logged! 🔥", { description: `${burnedCalories} kcal burned.` });

    } catch (error) {
      console.error("Error:", error);
      toast.error("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };

  // Keep refs current so MobileNav always calls the latest version
  handleSendRef.current = handleSend;
  handlePhotoSendRef.current = handlePhotoSend;

  // Register chat input props in context so MobileNav can render ChatInput
  useEffect(() => {
    setChatInputProps({
      onSend: (...args) => handleSendRef.current(...args),
      isLoading,
      onScannerOpen: () => setShowScanner(true),
      onPhotoSend: (...args) => handlePhotoSendRef.current(...args),
    });
  }, [isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => setChatInputProps(null), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col overflow-hidden h-[100dvh] pb-[env(safe-area-inset-bottom)] rounded-[20px] bg-mint">
      <DailyNotificationPopup
        evaluation={dailyEvaluation}
        onClose={() => {
          setDailyEvaluation(null);
          setEvaluationDismissed(true);
        }}
      />

      {/* Top bar */}
      <div className="flex items-center justify-center bg-white border-b border-gray-200 shadow-[0_1px_4px_rgba(0,0,0,0.06)] px-6 py-[14px] shrink-0 relative">
        <div className="text-center">
          <h2 className="text-base font-semibold text-forest leading-[1.2] m-0">NutriCoach</h2>
          <p className="text-[11px] text-gray-400 m-0">Your nutrition coach</p>
        </div>
        {streak >= 1 && (
          <div className="absolute right-4 flex items-center" style={{ background: "#fff7ed", border: "0.5px solid #fed7aa", borderRadius: 20, padding: "3px 10px", fontSize: 12, color: "#ea580c" }}>
            {streak >= 30 ? "🏆" : streak >= 7 ? "👑" : ""}🔥 {streak}
          </div>
        )}
      </div>

      <div
        className="flex-1 overflow-y-auto pb-[160px] md:pb-6 bg-mint"
        onScroll={(e) => {
          const current = e.currentTarget.scrollTop;
          setDashboardTop(current < lastScrollTop.current ? 16 : 0);
          lastScrollTop.current = current;
        }}
      >
        <div style={{ position: "sticky", top: dashboardTop, zIndex: 10, transition: "top 0.3s ease" }}>
          <DailyDashboard todayLog={todayLog} calorieGoal={calorieGoal} proteinGoal={profile?.protein_goal || 120} carbsGoal={profile?.carbs_goal || 250} fatsGoal={profile?.fats_goal || 65} fiberGoal={FIBER_GOAL} userId={user?.id} onWaterUpdate={() => queryClient.invalidateQueries({ queryKey: ["foodlog"] })} />
        </div>
        <div className="max-w-4xl mx-auto space-y-5 px-4 pt-2 pb-6">
          {messages.map((msg) => <ChatBubble key={msg.id} message={msg} foodEntries={foodEntries} />)}
          {isLoading && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>
      </div>
      {showScanner && (
        <BarcodeScanner
          onProductFound={(product) => {
            const g = product.grams || 100;
            const n = product.adjusted || product.per100;
            const msg = `I just ate ${product.name} (${g}g): ${n.calories} kcal, ${n.protein}g protein, ${n.carbs}g carbs, ${n.fats}g fats, ${n.fiber}g fiber.`;
            handleSend(msg);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}