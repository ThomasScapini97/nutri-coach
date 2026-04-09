import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const ACTIVITY_LEVELS = [
  { value: "sedentary", label: "Sedentary", sub: "Little or no exercise", emoji: "🛋️" },
  { value: "light", label: "Light", sub: "1-3 days per week", emoji: "🚶" },
  { value: "moderate", label: "Moderate", sub: "3-5 days per week", emoji: "🏃" },
  { value: "active", label: "Active", sub: "6-7 days per week", emoji: "💪" },
  { value: "very_active", label: "Very active", sub: "Intense daily training", emoji: "🔥" },
];

const GOALS = [
  { value: "lose_weight", label: "Lose weight", emoji: "🎯", sub: "Controlled caloric deficit" },
  { value: "maintain", label: "Maintain weight", emoji: "⚖️", sub: "Stable caloric balance" },
  { value: "gain_muscle", label: "Gain muscle", emoji: "💪", sub: "Caloric surplus + protein" },
];

const CHAT_STYLES = [
  { value: "concise", label: "Concise", emoji: "⚡", sub: "Short and to the point" },
  { value: "detailed", label: "Detailed", emoji: "🧑‍🏫", sub: "In-depth advice and explanations" },
];

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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [saving, setSaving] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [privacyError, setPrivacyError] = useState(false);
  const [form, setForm] = useState({
    display_name: "",
    age: "", weight: "", height: "", gender: "",
    activity_level: "", goal: "", chat_style: "concise",
    active_days_goal: 3, burn_goal: 300, weight_goal: "",
  });

  const TOTAL_STEPS = 6;

  const goNext = () => { setDir(1); setStep(s => s + 1); };
  const goPrev = () => { setDir(-1); setStep(s => s - 1); };

  const canNext = () => {
    if (step === 0) return form.display_name.trim().length >= 2;
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
      display_name: form.display_name.trim(),
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

    if (error) { toast.error("Error saving profile"); setSaving(false); return; }
    queryClient.invalidateQueries({ queryKey: ["userProfile"] });
    setSaving(false);
    onComplete();
  };

  const steps = [
    /* Step 0 — Nome */
    <div key="name" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "56px", marginBottom: "12px" }}>👋</div>
        <h2 style={{ fontSize: "24px", fontWeight: 600, color: "#1a3a22", marginBottom: "8px" }}>Hi! What's your name?</h2>
        <p style={{ fontSize: "14px", color: "#9ca3af" }}>We'll use your name to personalize your experience</p>
      </div>
      <input
        type="text" placeholder="Your name or nickname..."
        value={form.display_name}
        onChange={e => setForm({ ...form, display_name: e.target.value })}
        onKeyDown={e => e.key === "Enter" && canNext() && goNext()}
        autoFocus
        className={`${inputCls} text-xl text-center py-4`}
      />
    </div>,

    /* Step 1 — Dati personali */
    <div key="personal" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "56px", marginBottom: "12px" }}>📋</div>
        <h2 style={{ fontSize: "22px", fontWeight: 600, color: "#1a3a22", marginBottom: "8px" }}>Your details</h2>
        <p style={{ fontSize: "14px", color: "#9ca3af" }}>Needed to calculate your precise caloric needs</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        <div>
          <label style={{ fontSize: "11px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.3px", display: "block", marginBottom: "6px" }}>Age</label>
          <input type="number" placeholder="25" value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label style={{ fontSize: "11px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.3px", display: "block", marginBottom: "6px" }}>Biological sex</label>
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
          <label style={{ fontSize: "11px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.3px", display: "block", marginBottom: "6px" }}>Current weight (kg)</label>
          <input type="number" placeholder="70" value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label style={{ fontSize: "11px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.3px", display: "block", marginBottom: "6px" }}>Height (cm)</label>
          <input type="number" placeholder="175" value={form.height} onChange={e => setForm({ ...form, height: e.target.value })} className={inputCls} />
        </div>
        <div style={{ gridColumn: "span 2" }}>
          <label style={{ fontSize: "11px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.3px", display: "block", marginBottom: "6px" }}>Target weight (kg) — optional</label>
          <input type="number" placeholder="65" value={form.weight_goal} onChange={e => setForm({ ...form, weight_goal: e.target.value })} className={inputCls} />
        </div>
      </div>
    </div>,

    /* Step 2 — Livello attività */
    <div key="activity" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "56px", marginBottom: "12px" }}>🏃</div>
        <h2 style={{ fontSize: "22px", fontWeight: 600, color: "#1a3a22", marginBottom: "8px" }}>How active are you?</h2>
        <p style={{ fontSize: "14px", color: "#9ca3af" }}>Consider your average weekly routine</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {ACTIVITY_LEVELS.map(l => (
          <button key={l.value} onClick={() => setForm({ ...form, activity_level: l.value })} style={{
            display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", borderRadius: "14px",
            border: form.activity_level === l.value ? "2px solid #16a34a" : "0.5px solid #e5e7eb",
            background: form.activity_level === l.value ? "#f0fdf4" : "#f9fafb",
            cursor: "pointer", fontFamily: "inherit", textAlign: "left",
          }}>
            <span style={{ fontSize: "24px" }}>{l.emoji}</span>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 500, color: form.activity_level === l.value ? "#15803d" : "#1a3a22" }}>{l.label}</p>
              <p style={{ fontSize: "12px", color: "#9ca3af" }}>{l.sub}</p>
            </div>
            {form.activity_level === l.value && <span style={{ marginLeft: "auto", color: "#16a34a", fontSize: "16px" }}>✓</span>}
          </button>
        ))}
      </div>
    </div>,

    /* Step 3 — Obiettivo + stile chat */
    <div key="goal" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "56px", marginBottom: "12px" }}>🎯</div>
        <h2 style={{ fontSize: "22px", fontWeight: 600, color: "#1a3a22", marginBottom: "8px" }}>Your goal</h2>
        <p style={{ fontSize: "14px", color: "#9ca3af" }}>Also choose how you prefer the coach to respond</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {GOALS.map(g => (
          <button key={g.value} onClick={() => setForm({ ...form, goal: g.value })} style={{
            display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", borderRadius: "14px",
            border: form.goal === g.value ? "2px solid #16a34a" : "0.5px solid #e5e7eb",
            background: form.goal === g.value ? "#f0fdf4" : "#f9fafb",
            cursor: "pointer", fontFamily: "inherit", textAlign: "left",
          }}>
            <span style={{ fontSize: "24px" }}>{g.emoji}</span>
            <div>
              <p style={{ fontSize: "14px", fontWeight: 500, color: form.goal === g.value ? "#15803d" : "#1a3a22" }}>{g.label}</p>
              <p style={{ fontSize: "12px", color: "#9ca3af" }}>{g.sub}</p>
            </div>
            {form.goal === g.value && <span style={{ marginLeft: "auto", color: "#16a34a", fontSize: "16px" }}>✓</span>}
          </button>
        ))}
      </div>
      <div>
        <p style={{ fontSize: "12px", fontWeight: 500, color: "#1a3a22", marginBottom: "8px" }}>Coach response style</p>
        <div style={{ display: "flex", gap: "8px" }}>
          {CHAT_STYLES.map(s => (
            <button key={s.value} onClick={() => setForm({ ...form, chat_style: s.value })} style={{
              flex: 1, padding: "12px 8px", borderRadius: "14px",
              border: form.chat_style === s.value ? "2px solid #16a34a" : "0.5px solid #e5e7eb",
              background: form.chat_style === s.value ? "#f0fdf4" : "#f9fafb",
              cursor: "pointer", fontFamily: "inherit", textAlign: "center",
            }}>
              <div style={{ fontSize: "24px", marginBottom: "4px" }}>{s.emoji}</div>
              <p style={{ fontSize: "13px", fontWeight: 500, color: form.chat_style === s.value ? "#15803d" : "#1a3a22" }}>{s.label}</p>
              <p style={{ fontSize: "10px", color: "#9ca3af", lineHeight: 1.3 }}>{s.sub}</p>
            </button>
          ))}
        </div>
      </div>
    </div>,

    /* Step 4 — Fitness goals */
    <div key="fitness" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "56px", marginBottom: "12px" }}>🏋️</div>
        <h2 style={{ fontSize: "22px", fontWeight: 600, color: "#1a3a22", marginBottom: "8px" }}>Fitness goals</h2>
        <p style={{ fontSize: "14px", color: "#9ca3af" }}>How many days do you want to train and how many calories burn?</p>
      </div>
      <div>
        <label style={{ fontSize: "11px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.3px", display: "block", marginBottom: "10px" }}>Active days per week</label>
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
          {form.active_days_goal} {form.active_days_goal === 1 ? "day" : "days"} per week
        </p>
      </div>
      <div>
        <label style={{ fontSize: "11px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.3px", display: "block", marginBottom: "10px" }}>Calories to burn on active days</label>
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
          type="number" placeholder="Custom kcal..."
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
        <h2 style={{ fontSize: "22px", fontWeight: 600, color: "#1a3a22", marginBottom: "8px" }}>Before you begin</h2>
        <p style={{ fontSize: "14px", color: "#9ca3af" }}>Please read this important information</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {[
          { emoji: "⚕️", title: "Not a medical device", text: "NutriCoach is a personal wellness support tool, not a medical service. It does not replace the advice of a nutritionist or doctor." },
          { emoji: "⚠️", title: "Not suitable for eating disorders", text: "If you suffer or have suffered from serious eating disorders (anorexia, bulimia, BED), we recommend consulting a specialist before using this app." },
          { emoji: "✏️", title: "Enter accurate data", text: "Caloric calculations depend on the data you enter. The more accurate they are, the more accurate your nutrition plan will be." },
          { emoji: "🤖", title: "AI can make mistakes", text: "AI calorie estimates are approximate. Use them as a reference, not as absolute values." },
        ].map((item, i) => (
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
            I have read and accept the{" "}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#16a34a", textDecoration: "underline" }}>
              Privacy Policy
            </a>
            {" "}and Terms of Service
          </span>
        </label>
        {privacyError && (
          <p style={{ fontSize: "11px", color: "#dc2626", marginTop: "6px", marginLeft: "30px" }}>
            You must accept the privacy policy to continue
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
              Continue <ArrowRight style={{ width: "18px", height: "18px" }} />
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
              {saving ? "Saving..." : "Start now 🚀"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
