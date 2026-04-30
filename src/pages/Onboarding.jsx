import { useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const ACTIVITY_LEVEL_VALUES = ["sedentary", "light", "moderate", "active", "very_active"];
const ACTIVITY_LEVEL_EMOJIS = { sedentary: "🛋️", light: "🚶", moderate: "🏃", active: "💪", very_active: "🔥" };

const GOAL_VALUES = ["lose_weight", "maintain", "gain_muscle"];
const GOAL_EMOJIS = { lose_weight: "🎯", maintain: "⚖️", gain_muscle: "💪" };

const CHAT_STYLE_VALUES = ["concise", "detailed"];
const CHAT_STYLE_EMOJIS = { concise: "⚡", detailed: "🧑‍🏫" };

function calculateCalorieGoal(profile) {
  if (!profile.weight || !profile.height || !profile.age || !profile.gender) return 2000;
  let bmr;
  if (profile.gender === "male") {
    bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5;
  } else {
    bmr = 10 * profile.weight + 6.25 * profile.height - 5 * profile.age - 161;
  }
  const multipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
  let tdee = bmr * (multipliers[profile.activity_level] || 1.2);
  if (profile.goal === "lose_weight") {
    const minSafe = profile.gender === "male" ? 1500 : 1200;
    tdee = Math.max(tdee * 0.80, minSafe);
  }
  if (profile.goal === "gain_muscle") tdee += 350;
  return Math.round(tdee);
}

const inputCls = "w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base text-forest outline-none font-[inherit]";

const slideVariants = {
  enter: (dir) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
};

export default function Onboarding({ onComplete }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [saving, setSaving] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [privacyError, setPrivacyError] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [usernameStatus, setUsernameStatus] = useState(null);
  const [form, setForm] = useState({
    age: "", weight: "", height: "", gender: "",
    activity_level: "", goal: "", chat_style: "concise",
    active_days_goal: 3, burn_goal: 300, weight_goal: "",
  });

  const TOTAL_STEPS = 6;

  const goNext = () => { setDir(1); setStep(s => s + 1); };
  const goPrev = () => { setDir(-1); setStep(s => s - 1); };

  const checkUsernameAvailability = async () => {
    if (!displayName.trim() || displayName.trim().length < 3) return;
    setUsernameStatus("checking");
    try {
      const currentUserId = (await supabase.auth.getUser()).data?.user?.id;
      const { data, error } = await supabase.rpc('is_display_name_taken', {
        name: displayName.trim().toLowerCase(),
        current_user_id: currentUserId || '00000000-0000-0000-0000-000000000000',
      });
      if (error) {
        console.error("Username check error:", error);
        setUsernameStatus("available");
        return;
      }
      setUsernameStatus(data === true ? "taken" : "available");
    } catch (e) {
      console.error("Username check failed:", e);
      setUsernameStatus("available");
    }
  };

  const canNext = () => {
    if (step === 0) return displayName.trim().length >= 3 && usernameStatus === "available";
    if (step === 1) {
      const age = Number(form.age);
      const weight = Number(form.weight);
      const height = Number(form.height);
      return form.gender && age >= 10 && age <= 100 && weight >= 30 && weight <= 250 && height >= 120 && height <= 230;
    }
    if (step === 2) return !!form.activity_level;
    if (step === 3) return !!form.goal && !!form.chat_style;
    if (step === 4) return form.active_days_goal > 0 && form.burn_goal > 0;
    return true;
  };

  const handleSave = async () => {
    setSaving(true);
    const calorieGoal = calculateCalorieGoal({
      ...form, weight: Number(form.weight), height: Number(form.height), age: Number(form.age),
    });
    const proteinGoal = form.goal === "gain_muscle"
      ? Math.round(Number(form.weight) * 2)
      : Math.round(Number(form.weight) * 1.5);
    const fatsGoal = Math.round((calorieGoal * 0.25) / 9);
    const carbsGoal = Math.round((calorieGoal - proteinGoal * 4 - fatsGoal * 9) / 4);

    const { error } = await supabase.from('user_profiles').upsert({
      user_id: user.id,
      display_name: displayName.trim().toLowerCase() || null,
      age: Number(form.age), weight: Number(form.weight),
      height: Number(form.height), gender: form.gender,
      activity_level: form.activity_level, goal: form.goal,
      chat_style: form.chat_style,
      active_days_goal: form.active_days_goal || 3,
      burn_goal: form.burn_goal || 300,
      weight_goal: form.weight_goal ? Number(form.weight_goal) : null,
      calorie_goal: calorieGoal, protein_goal: proteinGoal,
      fats_goal: fatsGoal, carbs_goal: carbsGoal,
    }, { onConflict: 'user_id' });

    if (error) { toast.error(t("onboarding.errorSaving")); setSaving(false); return; }
    queryClient.invalidateQueries({ queryKey: ["userProfile"] });
    setSaving(false);
    onComplete();
  };

  const disclaimerItems = [
    { emoji: "⚕️", title: t("onboarding.step5.d1title"), text: t("onboarding.step5.d1text") },
    { emoji: "⚠️", title: t("onboarding.step5.d2title"), text: t("onboarding.step5.d2text") },
    { emoji: "✏️", title: t("onboarding.step5.d3title"), text: t("onboarding.step5.d3text") },
    { emoji: "🤖", title: t("onboarding.step5.d4title"), text: t("onboarding.step5.d4text") },
  ];

  const steps = [
    /* Step 0 — Username */
    <div key="username" style={{ display: "flex", flexDirection: "column", gap: "0" }}>
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <div style={{ fontSize: "56px", marginBottom: "12px" }}>🏆</div>
        <h2 style={{ fontSize: "22px", fontWeight: 600, color: "#1a3a22", marginBottom: "8px" }}>
          Choose your username
        </h2>
        <p style={{ fontSize: "13px", color: "#9ca3af" }}>
          This is how you'll appear in the leaderboard
        </p>
      </div>

      <input
        type="text"
        value={displayName}
        onChange={e => {
          const val = e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, "");
          setDisplayName(val);
          setUsernameStatus(null);
        }}
        placeholder="e.g. thomas_fit"
        maxLength={30}
        onBlur={checkUsernameAvailability}
        style={{
          width: "100%",
          background: "#f9fafb",
          border: `1.5px solid ${usernameStatus === "taken" ? "#ef4444" : usernameStatus === "available" ? "#16a34a" : "#e5e7eb"}`,
          borderRadius: "14px",
          padding: "14px 16px",
          fontSize: "16px",
          color: "#1a3a22",
          outline: "none",
          fontFamily: "inherit",
          boxSizing: "border-box",
        }}
      />

      {usernameStatus === "checking" && (
        <p style={{ fontSize: "12px", color: "#9ca3af", marginTop: "8px" }}>Checking availability...</p>
      )}
      {usernameStatus === "available" && (
        <p style={{ fontSize: "12px", color: "#16a34a", marginTop: "8px" }}>✅ Username available!</p>
      )}
      {usernameStatus === "taken" && (
        <p style={{ fontSize: "12px", color: "#ef4444", marginTop: "8px" }}>❌ Already taken — try another one</p>
      )}

      <p style={{ fontSize: "11px", color: "#9ca3af", marginTop: "8px" }}>
        Only letters, numbers, dots and underscores. You can change it later in your profile.
      </p>

      {usernameStatus === "taken" && displayName.length > 0 && (
        <div style={{ marginTop: "12px" }}>
          <p style={{ fontSize: "11px", color: "#6b7280", marginBottom: "8px" }}>Try one of these:</p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {[
              `${displayName}_${Math.floor(Math.random() * 90 + 10)}`,
              `${displayName}.fit`,
              `${displayName}_nt`,
            ].map(suggestion => (
              <button
                key={suggestion}
                onClick={() => { setDisplayName(suggestion); setUsernameStatus(null); }}
                style={{
                  background: "#f0fdf4", border: "0.5px solid #bbf7d0",
                  borderRadius: "8px", padding: "6px 12px",
                  fontSize: "12px", color: "#16a34a",
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>,

    /* Step 1 — Personal details */
    <div key="personal" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "56px", marginBottom: "12px" }}>📋</div>
        <h2 style={{ fontSize: "22px", fontWeight: 600, color: "#1a3a22", marginBottom: "8px" }}>{t("onboarding.step1.title")}</h2>
        <p style={{ fontSize: "14px", color: "#9ca3af" }}>{t("onboarding.step1.subtitle")}</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        <div>
          <label style={{ fontSize: "11px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.3px", display: "block", marginBottom: "6px" }}>{t("onboarding.step1.age")}</label>
          <input type="number" placeholder="25" value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label style={{ fontSize: "11px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.3px", display: "block", marginBottom: "6px" }}>{t("onboarding.step1.sex")}</label>
          <div style={{ display: "flex", gap: "6px" }}>
            {[{ v: "male", l: "👨 M" }, { v: "female", l: "👩 F" }].map(g => (
              <button key={g.v} onClick={() => setForm({ ...form, gender: g.v })} style={{
                flex: 1, padding: "12px", borderRadius: "12px",
                border: form.gender === g.v ? "2px solid #16a34a" : "0.5px solid #e5e7eb",
                background: form.gender === g.v ? "#f0fdf4" : "#f9fafb",
                cursor: "pointer", fontSize: "14px", fontWeight: form.gender === g.v ? 500 : 400,
                color: form.gender === g.v ? "#15803d" : "#6b7280", fontFamily: "inherit",
              }}>{g.l}</button>
            ))}
          </div>
        </div>
        <div>
          <label style={{ fontSize: "11px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.3px", display: "block", marginBottom: "6px" }}>{t("onboarding.step1.weight")}</label>
          <input type="number" placeholder="70" value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label style={{ fontSize: "11px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.3px", display: "block", marginBottom: "6px" }}>{t("onboarding.step1.height")}</label>
          <input type="number" placeholder="175" value={form.height} onChange={e => setForm({ ...form, height: e.target.value })} className={inputCls} />
        </div>
        <div style={{ gridColumn: "span 2" }}>
          <label style={{ fontSize: "11px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.3px", display: "block", marginBottom: "6px" }}>{t("onboarding.step1.weightGoal")}</label>
          <input type="number" placeholder="65" value={form.weight_goal} onChange={e => setForm({ ...form, weight_goal: e.target.value })} className={inputCls} />
        </div>
      </div>
    </div>,

    /* Step 2 — Activity level */
    <div key="activity" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "56px", marginBottom: "12px" }}>🏃</div>
        <h2 style={{ fontSize: "22px", fontWeight: 600, color: "#1a3a22", marginBottom: "8px" }}>{t("onboarding.step2.title")}</h2>
        <p style={{ fontSize: "14px", color: "#9ca3af" }}>{t("onboarding.step2.subtitle")}</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {ACTIVITY_LEVEL_VALUES.map(v => (
          <button key={v} onClick={() => setForm({ ...form, activity_level: v })} style={{
            display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", borderRadius: "14px",
            border: form.activity_level === v ? "2px solid #16a34a" : "0.5px solid #e5e7eb",
            background: form.activity_level === v ? "#f0fdf4" : "#f9fafb",
            cursor: "pointer", fontFamily: "inherit", textAlign: "left",
          }}>
            <span style={{ fontSize: "24px" }}>{ACTIVITY_LEVEL_EMOJIS[v]}</span>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 500, color: form.activity_level === v ? "#15803d" : "#1a3a22" }}>{t(`onboarding.activityLevels.${v}.label`)}</p>
              <p style={{ fontSize: "12px", color: "#9ca3af" }}>{t(`onboarding.activityLevels.${v}.sub`)}</p>
            </div>
            {form.activity_level === v && <span style={{ marginLeft: "auto", color: "#16a34a", fontSize: "16px" }}>✓</span>}
          </button>
        ))}
      </div>
    </div>,

    /* Step 3 — Goal + chat style */
    <div key="goal" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "56px", marginBottom: "12px" }}>🎯</div>
        <h2 style={{ fontSize: "22px", fontWeight: 600, color: "#1a3a22", marginBottom: "8px" }}>{t("onboarding.step3.title")}</h2>
        <p style={{ fontSize: "14px", color: "#9ca3af" }}>{t("onboarding.step3.subtitle")}</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {GOAL_VALUES.map(v => (
          <button key={v} onClick={() => setForm({ ...form, goal: v })} style={{
            display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", borderRadius: "14px",
            border: form.goal === v ? "2px solid #16a34a" : "0.5px solid #e5e7eb",
            background: form.goal === v ? "#f0fdf4" : "#f9fafb",
            cursor: "pointer", fontFamily: "inherit", textAlign: "left",
          }}>
            <span style={{ fontSize: "24px" }}>{GOAL_EMOJIS[v]}</span>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 500, color: form.goal === v ? "#15803d" : "#1a3a22" }}>{t(`onboarding.goals.${v}.label`)}</p>
              <p style={{ fontSize: "12px", color: "#9ca3af" }}>{t(`onboarding.goals.${v}.sub`)}</p>
            </div>
            {form.goal === v && <span style={{ marginLeft: "auto", color: "#16a34a", fontSize: "16px" }}>✓</span>}
          </button>
        ))}
      </div>
      <div>
        <p style={{ fontSize: "12px", fontWeight: 500, color: "#1a3a22", marginBottom: "8px" }}>{t("onboarding.step3.chatStyle")}</p>
        <div style={{ display: "flex", gap: "8px" }}>
          {CHAT_STYLE_VALUES.map(v => (
            <button key={v} onClick={() => setForm({ ...form, chat_style: v })} style={{
              flex: 1, padding: "12px 8px", borderRadius: "14px",
              border: form.chat_style === v ? "2px solid #16a34a" : "0.5px solid #e5e7eb",
              background: form.chat_style === v ? "#f0fdf4" : "#f9fafb",
              cursor: "pointer", fontFamily: "inherit", textAlign: "center",
            }}>
              <div style={{ fontSize: "24px", marginBottom: "4px" }}>{CHAT_STYLE_EMOJIS[v]}</div>
              <p style={{ fontSize: "13px", fontWeight: 500, color: form.chat_style === v ? "#15803d" : "#1a3a22" }}>{t(`onboarding.chatStyles.${v}.label`)}</p>
              <p style={{ fontSize: "10px", color: "#9ca3af", lineHeight: 1.3 }}>{t(`onboarding.chatStyles.${v}.sub`)}</p>
            </button>
          ))}
        </div>
      </div>
    </div>,

    /* Step 4 — Fitness goals */
    <div key="fitness" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "56px", marginBottom: "12px" }}>🏋️</div>
        <h2 style={{ fontSize: "22px", fontWeight: 600, color: "#1a3a22", marginBottom: "8px" }}>{t("onboarding.step4.title")}</h2>
        <p style={{ fontSize: "14px", color: "#9ca3af" }}>{t("onboarding.step4.subtitle")}</p>
      </div>
      <div>
        <label style={{ fontSize: "11px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.3px", display: "block", marginBottom: "10px" }}>{t("onboarding.step4.activeDays")}</label>
        <div style={{ display: "flex", gap: "8px" }}>
          {[2, 3, 4, 5, 6, 7].map(d => (
            <button key={d} onClick={() => setForm({ ...form, active_days_goal: d })} style={{
              flex: 1, padding: "14px 4px", borderRadius: "12px", fontSize: "16px", fontWeight: 600,
              border: form.active_days_goal === d ? "2px solid #dc2626" : "0.5px solid #e5e7eb",
              background: form.active_days_goal === d ? "#fef2f2" : "#f9fafb",
              color: form.active_days_goal === d ? "#dc2626" : "#6b7280",
              cursor: "pointer", fontFamily: "inherit",
            }}>{d}</button>
          ))}
        </div>
        <p style={{ fontSize: "11px", color: "#9ca3af", marginTop: "6px", textAlign: "center" }}>
          {form.active_days_goal} {form.active_days_goal === 1 ? t("onboarding.step4.day") : t("onboarding.step4.days")} {t("onboarding.step4.perWeek")}
        </p>
      </div>
      <div>
        <label style={{ fontSize: "11px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.3px", display: "block", marginBottom: "10px" }}>{t("onboarding.step4.burnGoal")}</label>
        <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
          {[200, 300, 400, 500].map(k => (
            <button key={k} onClick={() => setForm({ ...form, burn_goal: k })} style={{
              flex: 1, padding: "12px 4px", borderRadius: "12px", fontSize: "13px", fontWeight: 500,
              border: form.burn_goal === k ? "2px solid #dc2626" : "0.5px solid #e5e7eb",
              background: form.burn_goal === k ? "#fef2f2" : "#f9fafb",
              color: form.burn_goal === k ? "#dc2626" : "#6b7280",
              cursor: "pointer", fontFamily: "inherit",
            }}>{k} kcal</button>
          ))}
        </div>
        <input
          type="number" placeholder={t("onboarding.step4.customKcal")}
          value={form.burn_goal}
          onChange={e => setForm({ ...form, burn_goal: Number(e.target.value) })}
          className={inputCls}
        />
      </div>
    </div>,

    /* Step 5 — Disclaimer */
    <div key="disclaimer" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "56px", marginBottom: "12px" }}>📌</div>
        <h2 style={{ fontSize: "22px", fontWeight: 600, color: "#1a3a22", marginBottom: "8px" }}>{t("onboarding.step5.title")}</h2>
        <p style={{ fontSize: "14px", color: "#9ca3af" }}>{t("onboarding.step5.subtitle")}</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {disclaimerItems.map((item, i) => (
          <div key={i} style={{ display: "flex", gap: "12px", padding: "12px 14px", background: "#f9fafb", borderRadius: "12px", border: "0.5px solid #e5e7eb" }}>
            <span style={{ fontSize: "20px", flexShrink: 0 }}>{item.emoji}</span>
            <div>
              <p style={{ fontSize: "12px", fontWeight: 500, color: "#1a3a22", marginBottom: "2px" }}>{item.title}</p>
              <p style={{ fontSize: "11px", color: "#6b7280", lineHeight: 1.5 }}>{item.text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Privacy checkbox */}
      <div>
        <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
          <div
            onClick={() => { setPrivacyAccepted(v => !v); setPrivacyError(false); }}
            style={{
              width: "20px", height: "20px", borderRadius: "6px", flexShrink: 0, marginTop: "1px",
              border: privacyAccepted ? "none" : "1.5px solid #d1d5db",
              background: privacyAccepted ? "#16a34a" : "white",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s", cursor: "pointer",
            }}
          >
            {privacyAccepted && <span style={{ color: "white", fontSize: "13px", fontWeight: 700, lineHeight: 1 }}>✓</span>}
          </div>
          <span style={{ fontSize: "12px", color: "#6b7280", lineHeight: 1.5 }}>
            {t("onboarding.privacyAccept")}{" "}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#16a34a", textDecoration: "underline" }}>
              {t("profile.privacy")}
            </a>
            {" "}{t("onboarding.privacyAnd")}
          </span>
        </label>
        {privacyError && (
          <p style={{ fontSize: "11px", color: "#dc2626", marginTop: "6px", marginLeft: "30px" }}>
            {t("onboarding.privacyRequired")}
          </p>
        )}
      </div>
    </div>,
  ];

  return (
    <div style={{ height: "100dvh", background: "#f0fcf3", display: "flex", flexDirection: "column", alignItems: "center", padding: "0 16px" }}>
      <div style={{ width: "100%", maxWidth: "420px", display: "flex", flexDirection: "column", height: "100%", paddingTop: "24px", paddingBottom: "24px" }}>

        {/* Logo — fixed */}
        <div style={{ textAlign: "center", marginBottom: "20px", flexShrink: 0 }}>
          <div style={{ width: "52px", height: "52px", borderRadius: "16px", background: "linear-gradient(135deg, #16a34a, #15803d)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", fontSize: "24px" }}>🍎</div>
          <p style={{ fontSize: "13px", color: "#9ca3af" }}>NutriCoach AI</p>
        </div>

        {/* Progress bar — fixed */}
        <div style={{ display: "flex", justifyContent: "center", gap: "6px", marginBottom: "20px", flexShrink: 0 }}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} style={{ height: "4px", borderRadius: "99px", background: i <= step ? "#16a34a" : "#d1fae5", transition: "all 0.3s", width: i === step ? "24px" : "8px" }} />
          ))}
        </div>

        {/* Card — fills remaining space, scrollable inside */}
        <div style={{ flex: 1, minHeight: 0, background: "white", borderRadius: "24px", border: "0.5px solid rgba(0,0,0,0.06)", boxShadow: "0 4px 24px rgba(0,0,0,0.06)", overflow: "hidden", position: "relative" }}>
          <div style={{ height: "100%", overflowY: "auto", padding: "28px 24px" }}>
            <AnimatePresence mode="wait" custom={dir}>
              <motion.div key={step} custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.28, ease: "easeInOut" }}>
                {steps[step]}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Buttons — always fixed at bottom */}
        <div style={{ display: "flex", gap: "10px", marginTop: "16px", flexShrink: 0 }}>
          {step > 0 && (
            <button onClick={goPrev} style={{ width: "48px", height: "52px", borderRadius: "14px", background: "white", border: "0.5px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <ArrowLeft style={{ width: "18px", height: "18px", color: "#6b7280" }} />
            </button>
          )}
          {step < TOTAL_STEPS - 1 ? (
            <button onClick={goNext} disabled={!canNext()} style={{
              flex: 1, height: "52px", borderRadius: "14px",
              background: canNext() ? "#16a34a" : "#d1fae5",
              color: "white", border: "none", fontSize: "15px", fontWeight: 500,
              cursor: canNext() ? "pointer" : "default", fontFamily: "inherit",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", transition: "background 0.2s",
            }}>
              {t("onboarding.continue")} <ArrowRight style={{ width: "18px", height: "18px" }} />
            </button>
          ) : (
            <button
              onClick={() => { if (!privacyAccepted) { setPrivacyError(true); return; } handleSave(); }}
              disabled={saving}
              style={{
                flex: 1, height: "52px", borderRadius: "14px",
                background: privacyAccepted ? "#16a34a" : "#d1fae5", color: "white",
                border: "none", fontSize: "15px", fontWeight: 500,
                cursor: privacyAccepted ? "pointer" : "default",
                fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                transition: "background 0.2s",
              }}
            >
              {saving ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : null}
              {saving ? t("onboarding.saving") : t("onboarding.startNow")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
