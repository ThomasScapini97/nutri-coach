import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, LogOut, Trash2, Globe } from "lucide-react";
import Spinner from "@/components/ui/Spinner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { getToday } from "@/lib/nutritionUtils";

const ACTIVITY_LEVELS = ["sedentary", "light", "moderate", "active", "very_active"];

const GOALS = [
  { value: "lose_weight", emoji: "🎯" },
  { value: "maintain", emoji: "⚖️" },
  { value: "gain_muscle", emoji: "💪" },
];

const CHAT_STYLE_OPTIONS = [
  { value: "concise", emoji: "⚡" },
  { value: "detailed", emoji: "🧑‍🏫" },
];

function calculateCalorieGoal(profile) {
  if (!profile.weight || !profile.height || !profile.age || !profile.gender) return null;
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

export default function Profile() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    age: "", weight: "", height: "", gender: "",
    activity_level: "", goal: "", chat_style: "concise",
    active_days_goal: 3, burn_goal: 300, weight_goal: "",
  });

  const { data: profile, isLoading } = useQuery({
    queryKey: ["userProfile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_profiles").select("*").eq("user_id", user.id).maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (profile) {
      setForm({
        age: profile.age || "",
        weight: profile.weight || "",
        height: profile.height || "",
        gender: profile.gender || "",
        activity_level: profile.activity_level || "",
        goal: profile.goal || "",
        chat_style: profile.chat_style || "concise",
        active_days_goal: profile.active_days_goal || 3,
        burn_goal: profile.burn_goal || 300,
        weight_goal: profile.weight_goal || "",
      });
    }
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    const calorieGoal = calculateCalorieGoal({
      ...form, weight: Number(form.weight), height: Number(form.height), age: Number(form.age),
    }) || 2000;
    const proteinGoal = form.goal === "gain_muscle"
      ? Math.round(Number(form.weight) * 2)
      : Math.round(Number(form.weight) * 1.5);
    const fatsGoal = Math.round((calorieGoal * 0.25) / 9);
    const carbsGoal = Math.round((calorieGoal - proteinGoal * 4 - fatsGoal * 9) / 4);

    const { error } = await supabase.from("user_profiles").upsert({
      user_id: user.id,
      age: Number(form.age), weight: Number(form.weight),
      height: Number(form.height), gender: form.gender,
      activity_level: form.activity_level, goal: form.goal,
      chat_style: form.chat_style,
      active_days_goal: Number(form.active_days_goal) || 3,
      burn_goal: Number(form.burn_goal) || 300,
      weight_goal: form.weight_goal ? Number(form.weight_goal) : null,
      calorie_goal: calorieGoal, protein_goal: proteinGoal,
      fats_goal: fatsGoal, carbs_goal: carbsGoal,
    }, { onConflict: "user_id" });

    setSaving(false);
    if (error) {
      toast.error("Failed to save profile. Please try again.");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["userProfile"] });
    toast.success(t("profile.savedSuccess"), { description: t("profile.savedDesc", { value: calorieGoal }), duration: 3000 });
  };

  const handleLogout = async () => { await supabase.auth.signOut(); };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/delete-account", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error("Server error");
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Delete account error:", err);
      toast.error("Failed to delete account. Please try again.");
      setDeleting(false);
    }
  };

  const ageValid = Number(form.age) >= 10 && Number(form.age) <= 100;
  const weightValid = Number(form.weight) >= 30 && Number(form.weight) <= 250;
  const heightValid = Number(form.height) >= 120 && Number(form.height) <= 230;
  const formValid = ageValid && weightValid && heightValid && form.gender;

  const previewGoal = calculateCalorieGoal({
    ...form, weight: Number(form.weight), height: Number(form.height), age: Number(form.age),
  });
  const previewProtein = previewGoal ? form.goal === "gain_muscle" ? Math.round(Number(form.weight) * 2) : Math.round(Number(form.weight) * 1.5) : null;
  const previewFats = previewGoal ? Math.round((previewGoal * 0.25) / 9) : null;
  const previewCarbs = previewGoal ? Math.round((previewGoal - (previewProtein || 0) * 4 - (previewFats || 0) * 9) / 4) : null;

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center bg-mint">
      <Spinner size="lg" />
    </div>
  );

  const userName = profile?.display_name || user?.email?.split("@")[0] || "You";

  const today = getToday();
  const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().split('T')[0]; })();
  const lastStreakDate = profile?.last_streak_date;
  const streak = (lastStreakDate === today || lastStreakDate === yesterday) ? (profile?.current_streak || 0) : 0;

  const inputCls = "w-full bg-gray-50 border border-gray-200 rounded-lg py-[7px] px-[10px] text-[14px] text-forest outline-none font-[inherit]";
  const labelCls = "text-[10px] text-gray-400 tracking-[0.3px] uppercase mb-[5px] block";

  return (
    <div className="flex-1 overflow-y-auto pb-24 bg-mint">
      <div className="max-w-[480px] mx-auto px-4 pb-6 flex flex-col gap-[10px]">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center pt-5 pb-2 gap-[6px]"
        >
          <div className="w-[68px] h-[68px] rounded-full flex items-center justify-center text-[28px]"
            style={{ background: "linear-gradient(135deg, #16a34a, #15803d)", boxShadow: "0 0 0 3px #f0fcf3, 0 0 0 5px #bbf7d0" }}
          >✨</div>
          <p className="text-[17px] font-medium text-forest mt-[2px] m-0">{userName}</p>
          <p className="text-[11px] text-gray-400 m-0">{user?.email}</p>
          {(streak > 0 || profile?.longest_streak > 0) && (
            <div className="flex gap-2 mt-[6px]">
              {streak > 0 && (
                <span className="text-[11px] px-3 py-[3px] rounded-full font-medium" style={{ background: "#fff7ed", border: "0.5px solid #fed7aa", color: "#ea580c" }}>
                  🔥 {t("profile.currentStreak", { value: streak })}
                </span>
              )}
              {profile?.longest_streak > 0 && (
                <span className="text-[11px] px-3 py-[3px] rounded-full font-medium" style={{ background: "#fefce8", border: "0.5px solid #fde68a", color: "#b45309" }}>
                  🏆 {t("profile.bestStreak", { value: profile.longest_streak })}
                </span>
              )}
            </div>
          )}
        </motion.div>

        {/* Goal card */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="rounded-2xl px-4 py-[14px] flex items-center justify-between text-white"
          style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
        >
          <div className="flex flex-col gap-[1px]">
            <span className="text-[10px] text-white/70 tracking-[0.3px]">{t("profile.dailyGoal")}</span>
            <span className="text-[30px] font-medium leading-[1.1] tracking-[-1px]">{previewGoal ? previewGoal.toLocaleString() : "—"}</span>
            <span className="text-[10px] text-white/60">{t("profile.caloriesPerDay")}</span>
          </div>
          <div className="flex flex-col items-end gap-[6px]">
            <div className="w-10 h-10 rounded-xl bg-white/[0.18] flex items-center justify-center text-[18px]">🎯</div>
            {previewGoal && (
              <div className="flex gap-1">
                <span className="text-[9px] px-[5px] py-[2px] rounded-full bg-white/[0.18] text-white/90 whitespace-nowrap">{previewCarbs}g carbs</span>
                <span className="text-[9px] px-[5px] py-[2px] rounded-full bg-white/[0.18] text-white/90 whitespace-nowrap">{previewProtein}g prot</span>
                <span className="text-[9px] px-[5px] py-[2px] rounded-full bg-white/[0.18] text-white/90 whitespace-nowrap">{previewFats}g fats</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Personal info */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden"
        >
          <div className="flex items-center gap-2 px-[14px] py-[11px] border-b border-gray-100">
            <div className="w-[26px] h-[26px] rounded-[7px] bg-green-100 flex items-center justify-center text-[13px]">👤</div>
            <span className="text-xs font-medium text-forest">{t("profile.personalInfo")}</span>
          </div>
          <div className="grid grid-cols-2 gap-px bg-gray-100">
            <div className="bg-white p-[10px_12px]">
              <label className={labelCls}>{t("profile.age")}</label>
              <input type="number" placeholder="25" value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} className={inputCls} />
            </div>
            <div className="bg-white p-[10px_12px]">
              <label className={labelCls}>{t("profile.gender")}</label>
              <Select value={form.gender} onValueChange={v => setForm({ ...form, gender: v })}>
                <SelectTrigger className={inputCls + " flex justify-between items-center cursor-pointer"}>
                  <SelectValue placeholder={t("profile.select")} />
                </SelectTrigger>
                <SelectContent position="popper" side="bottom" sideOffset={4} className="bg-white border border-gray-200 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] z-[9999] overflow-hidden">
                  <SelectItem value="male">{t("profile.male")}</SelectItem>
                  <SelectItem value="female">{t("profile.female")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="bg-white p-[10px_12px]">
              <label className={labelCls}>{t("profile.weight")}</label>
              <input type="number" placeholder="70" value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} className={inputCls} />
            </div>
            <div className="bg-white p-[10px_12px]">
              <label className={labelCls}>{t("profile.height")}</label>
              <input type="number" placeholder="175" value={form.height} onChange={e => setForm({ ...form, height: e.target.value })} className={inputCls} />
            </div>
            <div className="bg-white p-[10px_12px] col-span-2">
              <label className={labelCls}>{t("profile.weightGoal")}</label>
              <input type="number" placeholder="65" value={form.weight_goal} onChange={e => setForm({ ...form, weight_goal: e.target.value })} className={inputCls} />
            </div>
          </div>
        </motion.div>

        {/* Activity & Goal */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden"
        >
          <div className="flex items-center gap-2 px-[14px] py-[11px] border-b border-gray-100">
            <div className="w-[26px] h-[26px] rounded-[7px] bg-green-100 flex items-center justify-center text-[13px]">⚡</div>
            <span className="text-xs font-medium text-forest">{t("profile.activityGoal")}</span>
          </div>
          <div className="p-[10px_12px] border-b border-gray-100">
            <label className={labelCls}>{t("profile.activityLevel")}</label>
            <Select value={form.activity_level} onValueChange={v => setForm({ ...form, activity_level: v })}>
              <SelectTrigger className={inputCls + " flex justify-between items-center cursor-pointer"}>
                <SelectValue placeholder={t("profile.selectActivity")} />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" sideOffset={4} className="bg-white border border-gray-200 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.12)] z-[9999] overflow-hidden">
                {ACTIVITY_LEVELS.map(l => <SelectItem key={l} value={l}>{t(`profile.${l}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="p-[10px_12px_12px]">
            <label className={labelCls}>{t("profile.wellnessGoal")}</label>
            <div className="flex gap-[6px] mt-1">
              {GOALS.map(g => (
                <button key={g.value} onClick={() => setForm({ ...form, goal: g.value })}
                  className="flex-1 flex flex-col items-center gap-[5px] pt-[10px] pb-2 px-1 rounded-xl cursor-pointer font-[inherit]"
                  style={{
                    border: form.goal === g.value ? "1.5px solid #16a34a" : "0.5px solid #e5e7eb",
                    background: form.goal === g.value ? "#f0fdf4" : "#f9fafb",
                  }}
                >
                  <span className="text-[20px]">{g.emoji}</span>
                  <span className="text-[10px] text-center" style={{ color: form.goal === g.value ? "#15803d" : "#6b7280", fontWeight: form.goal === g.value ? 500 : 400 }}>{t(`profile.${g.value}`)}</span>
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Fitness goals */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.17 }}
          className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden"
        >
          <div className="flex items-center gap-2 px-[14px] py-[11px] border-b border-gray-100">
            <div className="w-[26px] h-[26px] rounded-[7px] bg-red-100 flex items-center justify-center text-[13px]">🏃</div>
            <span className="text-xs font-medium text-forest">{t("profile.fitnessGoals")}</span>
          </div>
          <div className="grid grid-cols-2 gap-px bg-gray-100">
            <div className="bg-white p-[10px_12px]">
              <label className={labelCls}>{t("profile.activeDays")}</label>
              <div className="flex gap-1 mt-1">
                {[2,3,4,5,6,7].map(d => (
                  <button key={d} onClick={() => setForm({ ...form, active_days_goal: d })}
                    className="flex-1 py-[6px] px-[2px] rounded-lg text-xs font-medium cursor-pointer font-[inherit]"
                    style={{
                      border: form.active_days_goal === d ? "1.5px solid #dc2626" : "0.5px solid #e5e7eb",
                      background: form.active_days_goal === d ? "#fef2f2" : "#f9fafb",
                      color: form.active_days_goal === d ? "#dc2626" : "#6b7280",
                    }}
                  >{d}</button>
                ))}
              </div>
            </div>
            <div className="bg-white p-[10px_12px]">
              <label className={labelCls}>{t("profile.burnGoal")}</label>
              <input type="number" placeholder="300" value={form.burn_goal} onChange={e => setForm({ ...form, burn_goal: e.target.value })} className={inputCls} />
            </div>
          </div>
        </motion.div>

        {/* Chat style */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
          className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden"
        >
          <div className="flex items-center gap-2 px-[14px] py-[11px] border-b border-gray-100">
            <div className="w-[26px] h-[26px] rounded-[7px] bg-green-100 flex items-center justify-center text-[13px]">💬</div>
            <span className="text-xs font-medium text-forest">{t("profile.chatStyle")}</span>
          </div>
          <div className="p-[10px_12px_12px]">
            <div className="flex gap-2">
              {CHAT_STYLE_OPTIONS.map(s => (
                <button key={s.value} onClick={() => setForm({ ...form, chat_style: s.value })}
                  className="flex-1 py-3 px-2 rounded-[14px] cursor-pointer font-[inherit] text-center"
                  style={{
                    border: form.chat_style === s.value ? "1.5px solid #16a34a" : "0.5px solid #e5e7eb",
                    background: form.chat_style === s.value ? "#f0fdf4" : "#f9fafb",
                  }}
                >
                  <div className="text-[22px] mb-1">{s.emoji}</div>
                  <p className="text-[13px] font-medium m-0" style={{ color: form.chat_style === s.value ? "#15803d" : "#1a3a22" }}>{t(`profile.${s.value}`)}</p>
                  <p className="text-[10px] text-gray-400 m-0">{t(`profile.${s.value}Desc`)}</p>
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Language selector */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl border border-black/[0.06] overflow-hidden"
        >
          <div className="flex items-center gap-2 px-[14px] py-[11px] border-b border-gray-100">
            <div className="w-[26px] h-[26px] rounded-[7px] bg-blue-100 flex items-center justify-center text-[13px]"><Globe className="w-3.5 h-3.5 text-blue-500" /></div>
            <span className="text-xs font-medium text-forest">{t("profile.language")}</span>
          </div>
          <div className="p-[10px_12px_12px] flex flex-wrap gap-2">
            {[
              { code: "en", flag: "🇬🇧", label: "English" },
              { code: "it", flag: "🇮🇹", label: "Italiano" },
              { code: "es", flag: "🇪🇸", label: "Español" },
              { code: "fr", flag: "🇫🇷", label: "Français" },
              { code: "de", flag: "🇩🇪", label: "Deutsch" },
              { code: "pt", flag: "🇵🇹", label: "Português" },
            ].map(({ code, flag, label }) => {
              const active = i18n.language?.startsWith(code);
              return (
                <button key={code} onClick={() => i18n.changeLanguage(code)}
                  className="flex items-center gap-[5px] px-3 py-[6px] rounded-full text-[12px] font-medium cursor-pointer font-[inherit]"
                  style={{
                    border: active ? "1.5px solid #16a34a" : "0.5px solid #e5e7eb",
                    background: active ? "#f0fdf4" : "#f9fafb",
                    color: active ? "#15803d" : "#6b7280",
                  }}
                >
                  <span>{flag}</span> {label}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Buttons */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
          className="flex flex-col gap-2"
        >
          <Button onClick={handleSave} disabled={saving || !formValid}
            className="w-full bg-green-600 text-white rounded-[14px] py-[13px] text-[14px] font-medium border-none flex items-center justify-center gap-[7px]"
            style={{ opacity: (!formValid || saving) ? 0.6 : 1 }}
          >
            {saving ? <Spinner size="sm" /> : <Save className="w-4 h-4" />}
            {t("profile.saveProfile")}
          </Button>
          <Button variant="outline" onClick={handleLogout}
            className="w-full bg-white text-gray-700 rounded-[14px] py-[11px] text-[13px] font-normal border border-gray-200 flex items-center justify-center gap-[7px]"
          >
            <LogOut className="w-4 h-4" /> {t("profile.logout")}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="w-full bg-transparent text-red-600 border-none rounded-[14px] py-[9px] text-xs font-normal cursor-pointer flex items-center justify-center gap-[6px] font-[inherit] opacity-80">
                <Trash2 className="w-3.5 h-3.5" /> {t("profile.deleteAccount")}
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[360px] bg-white rounded-2xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-gray-200 z-[99999]">
              <AlertDialogHeader>
                <AlertDialogTitle>{t("profile.deleteConfirm")}</AlertDialogTitle>
                <AlertDialogDescription>{t("profile.deleteDesc")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("profile.cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteAccount} disabled={deleting} className="bg-destructive hover:bg-destructive/90">
                  {deleting ? <Spinner size="sm" className="mr-2" /> : null}
                  {t("profile.deleteAccount")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </motion.div>

        {/* Footer links */}
        <div style={{ textAlign: "center", marginTop: "8px", marginBottom: "16px" }}>
          <p style={{ fontSize: "11px", color: "#9ca3af" }}>
            <Link to="/privacy" style={{ color: "#9ca3af", textDecoration: "none" }}
              onMouseEnter={e => e.currentTarget.style.color = "#6b7280"}
              onMouseLeave={e => e.currentTarget.style.color = "#9ca3af"}
            >{t("profile.privacy")}</Link>
            {" · "}
            <Link to="/privacy" style={{ color: "#9ca3af", textDecoration: "none" }}
              onMouseEnter={e => e.currentTarget.style.color = "#6b7280"}
              onMouseLeave={e => e.currentTarget.style.color = "#9ca3af"}
            >{t("profile.terms")}</Link>
          </p>
          <p style={{ fontSize: "11px", color: "#9ca3af", marginTop: "4px" }}>{t("profile.version")}</p>
        </div>

      </div>
    </div>
  );
}
