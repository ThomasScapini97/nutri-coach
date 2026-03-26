import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import { useAuth } from "@/lib/AuthContext";

export default function AppLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const avatarUrl = user?.user_metadata?.avatar_url || null;

  return (
    <div className="flex min-h-screen bg-background" style={{ overflowX: "hidden", maxWidth: "100vw" }}>
      <Sidebar />
      <main className="flex-1 flex flex-col min-h-screen" style={{ minWidth: 0, overflow: "hidden" }}>
        <div style={{ position: "fixed", top: "12px", left: "12px", zIndex: 100 }}>
          <button
            onClick={() => navigate("/Profile")}
            style={{
              width: "36px", height: "36px", borderRadius: "50%",
              background: "linear-gradient(135deg, #16a34a, #15803d)",
              border: "2px solid white",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", overflow: "hidden", padding: 0,
            }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            )}
          </button>
        </div>
        <Outlet />
      </main>
      <MobileNav />
    </div>
  );
}
