import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleReset = async () => {
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password updated! 🎉");
      navigate("/Chat");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "#f0fcf3" }}>
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mb-4 shadow-sm">
              <span className="text-5xl">🔑</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Set new password</h1>
            <p className="text-gray-500 mt-1 text-sm text-center">
              Choose a strong password for your account
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">New password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                onKeyDown={(e) => e.key === "Enter" && handleReset()}
                className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
            <button
              onClick={handleReset}
              disabled={loading || !password || !confirm}
              className="w-full rounded-2xl bg-gray-900 hover:bg-gray-800 text-white font-semibold py-4 flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-sm mt-2"
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              Update password
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
