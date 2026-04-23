import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
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
import buildSystemPrompt from "@/lib/buildSystemPrompt";

const WELCOME_MESSAGE = {
  id: "welcome_message",
  role: "assistant",
  content: "Hey there! 👋 I'm your **NutriCoach** — your friendly wellness companion.\n\nTell me what you've eaten today and I'll help you track your calories and nutrition. You can say things like:\n\n- \"I had oatmeal with banana for breakfast\" 🥣\n- \"Grilled chicken salad for lunch\" 🥗\n- \"Give me my daily summary\" 📊\n\nLet's make today a healthy one! What did you eat?",
  timestamp: new Date().toISOString(),
};

export default function Chat() {
  const { t } = useTranslation();
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
      const isRedirect = result.redirect_to_summary === true;
      const assistantMessage = { id: crypto.randomUUID(), role: isRedirect ? "redirect" : "assistant", content: isRedirect ? t('chat.redirectToSummary') : result.message, timestamp: new Date().toISOString(), nutrition: null };

      if (isRedirect) {
        setMessages(prev => [...prev, assistantMessage]);
        setIsLoading(false);
        if (todayLog?.id) {
          await supabase.from('messages').insert([
            { foodlog_id: todayLog.id, role: userMessage.role, content: userMessage.content, timestamp: userMessage.timestamp },
            { foodlog_id: todayLog.id, role: 'assistant', content: assistantMessage.content, timestamp: assistantMessage.timestamp },
          ]);
        }
        return;
      }

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
        const { data: inserted, error: entriesError } = await supabase.from('food_entries').insert(
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
        if (entriesError) throw entriesError;
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

      if (foods.length > 0) await updateStreak(supabase, user.id, getToday());

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
    <div className="flex flex-col h-[100dvh] bg-mint">
      <DailyNotificationPopup
        evaluation={dailyEvaluation}
        onClose={() => {
          setDailyEvaluation(null);
          setEvaluationDismissed(true);
        }}
      />

      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center bg-white border-b border-gray-200 shadow-[0_1px_4px_rgba(0,0,0,0.06)] px-6 py-[14px]" style={{ paddingTop: 'calc(14px + env(safe-area-inset-top, 0px))' }}>
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

      {/* Fixed DailyDashboard below top bar — messages scroll behind glassmorphism card */}
      <div style={{
        position: 'fixed',
        top: 'calc(60px + env(safe-area-inset-top, 0px))',
        left: 0,
        right: 0,
        zIndex: 40,
        pointerEvents: 'auto',
      }}>
        <DailyDashboard todayLog={todayLog} calorieGoal={calorieGoal} proteinGoal={profile?.protein_goal || 120} carbsGoal={profile?.carbs_goal || 250} fatsGoal={profile?.fats_goal || 65} fiberGoal={FIBER_GOAL} userId={user?.id} onWaterUpdate={() => queryClient.invalidateQueries({ queryKey: ["foodlog"] })} />
      </div>

      <div
        className="flex-1 overflow-y-auto pb-[160px] md:pb-6 bg-mint"
        style={{ paddingTop: 'calc(180px + env(safe-area-inset-top, 0px))' }}
      >
        <div
          className="max-w-4xl mx-auto px-4"
          style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', minHeight: '100%' }}
        >
          <div className="space-y-5 pt-2 pb-6">
            {messages.map((msg) => <ChatBubble key={msg.id} message={msg} foodEntries={foodEntries} />)}
            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
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