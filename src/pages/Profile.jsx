import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Loader2, LogOut, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { motion } from "framer-motion";

const ACTIVITY_LEVELS = [
  { value: "sedentary", label: "Sedentary (little exercise)" },
  { value: "light", label: "Light (1-3 days/week)" },
  { value: "moderate", label: "Moderate (3-5 days/week)" },
  { value: "active", label: "Active (6-7 days/week)" },
  { value: "very_active", label: "Very Active (intense daily)" },
];

const GOALS = [
  { value: "lose_weight", label: "Lose weight", emoji: "🎯" },
  { value: "maintain", label: "Maintain", emoji: "⚖️" },
  { value: "gain_muscle", label: "Gain muscle", emoji: "💪" },
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
  if (profile.goal === "lose_weight") tdee -= 400;
  if (profile.goal === "gain_muscle") tdee += 300;
  return Math.round(tdee);
}

const inputStyle = {
  background: "#f9fafb",
  border: "0.5px solid #e5e7eb",
  borderRadius: "8px",
  padding: "7px 10px",
  fontSize: "14px",
  color: "#1a3a22",
  width: "100%",
  outline: "none",
  fontFamily: "inherit",
};

const fieldLabelStyle = {
  fontSize: "10px",
  color: "#9ca3af",
  letterSpacing: "0.3px",
  textTransform: "uppercase",
  marginBottom: "5px",
  display: "block",
};

export default function Profile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    age: "", weight: "", height: "", gender: "", activity_level: "", goal: "",
  });

  const { data: profile, isLoading } = useQuery({
    queryKey: ["userProfile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_profiles").select("*").eq("user_id", user.id).single();
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
      });
    }
  }, [profile]);

  const handleSave = async () => {
    setSaving(true);
    const calorieGoal = calculateCalorieGoal({
      ...form,
      weight: Number(form.weight),
      height: Number(form.height),
      age: Number(form.age),
    }) || 2000;
    const proteinGoal = form.goal === "gain_muscle"
      ? Math.round(Number(form.weight) * 2)
      : Math.round(Number(form.weight) * 1.5);
    const fatsGoal = Math.round((calorieGoal * 0.25) / 9);
    const carbsGoal = Math.round((calorieGoal - proteinGoal * 4 - fatsGoal * 9) / 4);

    await supabase.from("user_profiles").upsert({
      user_id: user.id,
      age: Number(form.age),
      weight: Number(form.weight),
      height: Number(form.height),
      gender: form.gender,
      activity_level: form.activity_level,
      goal: form.goal,
      calorie_goal: calorieGoal,
      protein_goal: proteinGoal,
      fats_goal: fatsGoal,
      carbs_goal: carbsGoal,
    }, { onConflict: "user_id" });

    queryClient.invalidateQueries({ queryKey: ["userProfile"] });
    setSaving(false);
    toast.success("Profile saved! 🎉", {
      description: `Daily goal: ${calorieGoal} kcal`,
      duration: 3000,
    });
  };

  const handleLogout = async () => { await supabase.auth.signOut(); };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const { data: logs } = await supabase.from("food_logs").select("id").eq("user_id", user.id);
      if (logs?.length > 0) {
        const logIds = logs.map(l => l.id);
        await supabase.from("food_entries").delete().in("foodlog_id", logIds);
        await supabase.from("messages").delete().in("foodlog_id", logIds);
        await supabase.from("food_logs").delete().eq("user_id", user.id);
      }
      await supabase.from("user_profiles").delete().eq("user_id", user.id);
      await supabase.auth.signOut();
    } catch {
      toast.error("Failed to delete account. Please try again.");
      setDeleting(false);
    }
  };

  const ageValid = Number(form.age) >= 10 && Number(form.age) <= 100;
  const weightValid = Number(form.weight) >= 30 && Number(form.weight) <= 250;
  const heightValid = Number(form.height) >= 120 && Number(form.height) <= 230;
  const formValid = ageValid && weightValid && heightValid && form.gender;

  const previewGoal = calculateCalorieGoal({
    ...form,
    weight: Number(form.weight),
    height: Number(form.height),
    age: Number(form.age),
  });

  const previewProtein = previewGoal
    ? form.goal === "gain_muscle"
      ? Math.round(Number(form.weight) * 2)
      : Math.round(Number(form.weight) * 1.5)
    : null;
  const previewFats = previewGoal ? Math.round((previewGoal * 0.25) / 9) : null;
  const previewCarbs = previewGoal
    ? Math.round((previewGoal - (previewProtein || 0) * 4 - (previewFats || 0) * 9) / 4)
    : null;

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center" style={{ background: "#f0fcf3" }}>
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#16a34a" }} />
    </div>
  );

  const userName = user?.email?.split("@")[0] || "You";

  return (
    <div className="flex-1 overflow-y-auto pb-24" style={{ background: "#f0fcf3" }}>
      <div style={{ maxWidth: "480px", margin: "0 auto", padding: "0 16px 24px", display: "flex", flexDirection: "column", gap: "10px" }}>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 0 8px", gap: "6px" }}
        >
          <div style={{
            width: "68px", height: "68px", borderRadius: "50%",
            background: "linear-gradient(135deg, #16a34a, #15803d)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "28px",
            boxShadow: "0 0 0 3px #f0fcf3, 0 0 0 5px #bbf7d0",
          }}>✨</div>
          <p style={{ fontSize: "17px", fontWeight: 500, color: "#1a3a22", marginTop: "2px" }}>
            {userName}
          </p>
          <p style={{ fontSize: "11px", color: "#9ca3af" }}>{user?.email}</p>
        </motion.div>

        {/* Goal card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          style={{
            background: "linear-gradient(135deg, #16a34a, #15803d)",
            borderRadius: "16px", padding: "14px 16px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            color: "white",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.7)", letterSpacing: "0.3px" }}>
              DAILY CALORIE GOAL
            </span>
            <span style={{ fontSize: "30px", fontWeight: 500, lineHeight: 1.1, letterSpacing: "-1px" }}>
              {previewGoal ? previewGoal.toLocaleString() : "—"}
            </span>
            <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.6)" }}>calories per day</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
            <div style={{
              width: "40px", height: "40px", borderRadius: "12px",
              background: "rgba(255,255,255,0.18)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px",
            }}>🎯</div>
            {previewGoal && (
              <div style={{ display: "flex", gap: "4px" }}>
                <span style={{ fontSize: "9px", padding: "2px 5px", borderRadius: "20px", background: "rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.9)", whiteSpace: "nowrap" }}>
                  {previewCarbs}g carbs
                </span>
                <span style={{ fontSize: "9px", padding: "2px 5px", borderRadius: "20px", background: "rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.9)", whiteSpace: "nowrap" }}>
                  {previewProtein}g prot
                </span>
                <span style={{ fontSize: "9px", padding: "2px 5px", borderRadius: "20px", background: "rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.9)", whiteSpace: "nowrap" }}>
                  {previewFats}g fats
                </span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Personal info */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{ background: "white", borderRadius: "16px", border: "0.5px solid rgba(0,0,0,0.06)", overflow: "hidden" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "11px 14px", borderBottom: "0.5px solid #f3f4f6" }}>
            <div style={{ width: "26px", height: "26px", borderRadius: "7px", background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px" }}>👤</div>
            <span style={{ fontSize: "12px", fontWeight: 500, color: "#1a3a22" }}>Personal info</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", background: "#f3f4f6" }}>
            {/* Age */}
            <div style={{ background: "white", padding: "10px 12px" }}>
              <label style={fieldLabelStyle}>Age</label>
              <input
                type="number" placeholder="25"
                value={form.age}
                onChange={(e) => setForm({ ...form, age: e.target.value })}
                style={inputStyle}
              />
            </div>
            {/* Gender */}
            <div style={{ background: "white", padding: "10px 12px" }}>
              <label style={fieldLabelStyle}>Gender</label>
              <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                <SelectTrigger style={{ ...inputStyle, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Weight */}
            <div style={{ background: "white", padding: "10px 12px" }}>
              <label style={fieldLabelStyle}>Weight (kg)</label>
              <input
                type="number" placeholder="70"
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
                style={inputStyle}
              />
            </div>
            {/* Height */}
            <div style={{ background: "white", padding: "10px 12px" }}>
              <label style={fieldLabelStyle}>Height (cm)</label>
              <input
                type="number" placeholder="175"
                value={form.height}
                onChange={(e) => setForm({ ...form, height: e.target.value })}
                style={inputStyle}
              />
            </div>
          </div>
        </motion.div>

        {/* Activity & Goal */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          style={{ background: "white", borderRadius: "16px", border: "0.5px solid rgba(0,0,0,0.06)", overflow: "hidden" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "11px 14px", borderBottom: "0.5px solid #f3f4f6" }}>
            <div style={{ width: "26px", height: "26px", borderRadius: "7px", background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px" }}>⚡</div>
            <span style={{ fontSize: "12px", fontWeight: 500, color: "#1a3a22" }}>Activity & goal</span>
          </div>

          {/* Activity level */}
          <div style={{ padding: "10px 12px", borderBottom: "0.5px solid #f3f4f6" }}>
            <label style={fieldLabelStyle}>Activity level</label>
            <Select value={form.activity_level} onValueChange={(v) => setForm({ ...form, activity_level: v })}>
              <SelectTrigger style={{ ...inputStyle, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}>
                <SelectValue placeholder="Select activity level" />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" sideOffset={4}>
                {ACTIVITY_LEVELS.map((l) => (
                  <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Wellness goal pills */}
          <div style={{ padding: "10px 12px 12px" }}>
            <label style={fieldLabelStyle}>Wellness goal</label>
            <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
              {GOALS.map((g) => (
                <button
                  key={g.value}
                  onClick={() => setForm({ ...form, goal: g.value })}
                  style={{
                    flex: 1,
                    display: "flex", flexDirection: "column", alignItems: "center", gap: "5px",
                    padding: "10px 4px 8px",
                    borderRadius: "12px",
                    border: form.goal === g.value ? "1.5px solid #16a34a" : "0.5px solid #e5e7eb",
                    background: form.goal === g.value ? "#f0fdf4" : "#f9fafb",
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  <span style={{ fontSize: "20px" }}>{g.emoji}</span>
                  <span style={{
                    fontSize: "10px", textAlign: "center", lineHeight: 1.3,
                    color: form.goal === g.value ? "#15803d" : "#6b7280",
                    fontWeight: form.goal === g.value ? 500 : 400,
                  }}>{g.label}</span>
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{ display: "flex", flexDirection: "column", gap: "8px" }}
        >
          <Button
            onClick={handleSave}
            disabled={saving || !formValid}
            style={{
              width: "100%", background: "#16a34a", color: "white",
              borderRadius: "14px", padding: "13px", fontSize: "14px",
              fontWeight: 500, border: "none", display: "flex",
              alignItems: "center", justifyContent: "center", gap: "7px",
              opacity: (!formValid || saving) ? 0.6 : 1,
            }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save profile
          </Button>

          <Button
            variant="outline"
            onClick={handleLogout}
            style={{
              width: "100%", background: "white", color: "#374151",
              borderRadius: "14px", padding: "11px", fontSize: "13px",
              fontWeight: 400, border: "0.5px solid #e5e7eb",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "7px",
            }}
          >
            <LogOut className="w-4 h-4" /> Log out
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button style={{
                width: "100%", background: "transparent", color: "#dc2626",
                border: "none", borderRadius: "14px", padding: "9px",
                fontSize: "12px", fontWeight: 400, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                fontFamily: "inherit", opacity: 0.8,
              }}>
                <Trash2 className="w-3.5 h-3.5" /> Delete account
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all your data. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Delete account
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </motion.div>

      </div>
    </div>
  );
}