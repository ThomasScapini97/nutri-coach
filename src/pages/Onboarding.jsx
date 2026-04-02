import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const ACTIVITY_LEVELS = [
  { value: "sedentary", label: "Sedentario", sub: "Poco o nessun esercizio", emoji: "🛋️" },
  { value: "light", label: "Leggero", sub: "1-3 giorni a settimana", emoji: "🚶" },
  { value: "moderate", label: "Moderato", sub: "3-5 giorni a settimana", emoji: "🏃" },
  { value: "active", label: "Attivo", sub: "6-7 giorni a settimana", emoji: "💪" },
  { value: "very_active", label: "Molto attivo", sub: "Allenamento intenso quotidiano", emoji: "🔥" },
];

const GOALS = [
  { value: "lose_weight", label: "Perdere peso", emoji: "🎯", sub: "Deficit calorico controllato" },
  { value: "maintain", label: "Mantenere il peso", emoji: "⚖️", sub: "Bilancio calorico stabile" },
  { value: "gain_muscle", label: "Aumentare la massa", emoji: "💪", sub: "Surplus calorico + proteine" },
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
  if (profile.goal === "gain_muscle") tdee += 300;
  return Math.round(tdee);
}

const inputStyle = {
  background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: "12px",
  padding: "12px 16px", fontSize: "16px", color: "#1a3a22",
  width: "100%", outline: "none", fontFamily: "inherit",
};

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

    if (error) { toast.error("Errore nel salvataggio"); setSaving(false); return; }
    queryClient.invalidateQueries({ queryKey: ["userProfile"] });
    setSaving(false);
    onComplete();
  };

  const steps = [
    /* Step 0 — Nome */
    <div key="name" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "56px", marginBottom: "12px" }}>👋</div>
        <h2 style={{ fontSize: "24px", fontWeight: 600, color: "#1a3a22", marginBottom: "8px" }}>Ciao! Come ti chiami?</h2>
        <p style={{ fontSize: "14px", color: "#9ca3af" }}>Useremo il tuo nome per personalizzare la tua esperienza</p>
      </div>
      <input
        type="text" placeholder="Il tuo nome o nickname..."
        value={form.display_name}
        onChange={e => setForm({ ...form, display_name: e.target.value })}
        onKeyDown={e => e.key === "Enter" && canNext() && goNext()}
        autoFocus
        style={{ ...inputStyle, fontSize: "20px", textAlign: "center", padding: "16px" }}
      />
    </div>,

    /* Step 1 — Dati personali */
    <div key="personal" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "56px", marginBottom: "12px" }}>📋</div>
        <h2 style={{ fontSize: "22px", fontWeight: 600, color: "#1a3a22", marginBottom: "8px" }}>I tuoi dati</h2>
        <p style={{ fontSize: "14px", color: "#9ca3af" }}>Servono per calcolare il tuo fabbisogno calorico preciso</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
        <div>
          <label style={{ fontSize: "11px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.3px", display: "block", marginBottom: "6px" }}>Età</label>
          <input type="number" placeholder="25" value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: "11px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.3px", display: "block", marginBottom: "6px" }}>Sesso biologico</label>
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
          <label style={{ fontSize: "11px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.3px", display: "block", marginBottom: "6px" }}>Peso attuale (kg)</label>
          <input type="number" placeholder="70" value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} style={inputStyle} />
        </div>
        <div>
          <label style={{ fontSize: "11px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.3px", display: "block", marginBottom: "6px" }}>Altezza (cm)</label>
          <input type="number" placeholder="175" value={form.height} onChange={e => setForm({ ...form, height: e.target.value })} style={inputStyle} />
        </div>
        <div style={{ gridColumn: "span 2" }}>
          <label style={{ fontSize: "11px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.3px", display: "block", marginBottom: "6px" }}>Peso obiettivo (kg) — opzionale</label>
          <input type="number" placeholder="65" value={form.weight_goal} onChange={e => setForm({ ...form, weight_goal: e.target.value })} style={inputStyle} />
        </div>
      </div>
    </div>,

    /* Step 2 — Livello attività */
    <div key="activity" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "56px", marginBottom: "12px" }}>🏃</div>
        <h2 style={{ fontSize: "22px", fontWeight: 600, color: "#1a3a22", marginBottom: "8px" }}>Quanto sei attivo?</h2>
        <p style={{ fontSize: "14px", color: "#9ca3af" }}>Considera la tua routine settimanale media</p>
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
        <h2 style={{ fontSize: "22px", fontWeight: 600, color: "#1a3a22", marginBottom: "8px" }}>Il tuo obiettivo</h2>
        <p style={{ fontSize: "14px", color: "#9ca3af" }}>Scegli anche come preferisci che ti risponda il coach</p>
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
        <p style={{ fontSize: "12px", fontWeight: 500, color: "#1a3a22", marginBottom: "8px" }}>Stile risposte del coach</p>
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
        <h2 style={{ fontSize: "22px", fontWeight: 600, color: "#1a3a22", marginBottom: "8px" }}>Obiettivi fitness</h2>
        <p style={{ fontSize: "14px", color: "#9ca3af" }}>Quanti giorni vuoi allenarti e quante calorie bruciare?</p>
      </div>
      <div>
        <label style={{ fontSize: "11px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.3px", display: "block", marginBottom: "10px" }}>Giorni attivi a settimana</label>
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
          {form.active_days_goal} {form.active_days_goal === 1 ? "giorno" : "giorni"} a settimana
        </p>
      </div>
      <div>
        <label style={{ fontSize: "11px", color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.3px", display: "block", marginBottom: "10px" }}>Calorie da bruciare nei giorni attivi</label>
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
          type="number" placeholder="Kcal personalizzate..."
          value={form.burn_goal}
          onChange={e => setForm({ ...form, burn_goal: Number(e.target.value) })}
          style={inputStyle}
        />
      </div>
    </div>,

    /* Step 5 — Disclaimer */
    <div key="disclaimer" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "56px", marginBottom: "12px" }}>📌</div>
        <h2 style={{ fontSize: "22px", fontWeight: 600, color: "#1a3a22", marginBottom: "8px" }}>Prima di iniziare</h2>
        <p style={{ fontSize: "14px", color: "#9ca3af" }}>Leggi queste informazioni importanti</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {[
          { emoji: "⚕️", title: "Non è un dispositivo medico", text: "NutriCoach è un supporto al benessere personale, non un servizio medico. Non sostituisce il parere di un nutrizionista o medico." },
          { emoji: "⚠️", title: "Non adatto a disturbi alimentari", text: "Se soffri o hai sofferto di disturbi alimentari seri (anoressia, bulimia, BED), ti consigliamo di consultare uno specialista prima di usare questa app." },
          { emoji: "✏️", title: "Inserisci dati accurati", text: "I calcoli calorici dipendono dai dati che inserisci. Più sono precisi, più sarà accurato il tuo piano nutrizionale." },
          { emoji: "🤖", title: "L'AI può sbagliare", text: "Le stime caloriche dell'AI sono approssimative. Usale come riferimento, non come valori assoluti." },
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
    </div>,
  ];

  return (
    <div style={{ minHeight: "100dvh", background: "#f0fcf3", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <div style={{ width: "100%", maxWidth: "420px" }}>

        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ width: "52px", height: "52px", borderRadius: "16px", background: "linear-gradient(135deg, #16a34a, #15803d)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", fontSize: "24px" }}>🍎</div>
          <p style={{ fontSize: "13px", color: "#9ca3af" }}>NutriCoach AI</p>
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: "6px", marginBottom: "24px" }}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div key={i} style={{ height: "4px", borderRadius: "99px", background: i <= step ? "#16a34a" : "#d1fae5", transition: "all 0.3s", width: i === step ? "24px" : "8px" }} />
          ))}
        </div>

        <div style={{ background: "white", borderRadius: "24px", padding: "28px 24px", border: "0.5px solid rgba(0,0,0,0.06)", boxShadow: "0 4px 24px rgba(0,0,0,0.06)", overflow: "hidden", position: "relative", minHeight: "420px" }}>
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div key={step} custom={dir} variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.28, ease: "easeInOut" }}>
              {steps[step]}
            </motion.div>
          </AnimatePresence>
        </div>

        <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
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
              Continua <ArrowRight style={{ width: "18px", height: "18px" }} />
            </button>
          ) : (
            <button onClick={handleSave} disabled={saving} style={{
              flex: 1, height: "52px", borderRadius: "14px", background: "#16a34a", color: "white",
              border: "none", fontSize: "15px", fontWeight: 500, cursor: "pointer",
              fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            }}>
              {saving ? <Loader2 style={{ width: "18px", height: "18px", animation: "spin 1s linear infinite" }} /> : null}
              {saving ? "Salvataggio..." : "Inizia ora 🚀"}
            </button>
          )}
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}
