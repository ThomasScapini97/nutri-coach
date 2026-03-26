import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import { useAuth } from "@/lib/AuthContext";

export default function AppLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const initials = user?.email?.charAt(0).toUpperCase() || "U";

  return (
    <div className="flex min-h-screen bg-background" style={{ overflowX: "hidden", maxWidth: "100vw" }}>
      <Sidebar />
      <main className="flex-1 flex flex-col min-h-screen" style={{ minWidth: 0, overflow: "hidden" }}>
        {/* Avatar profilo in alto a sinistra */}
        <div style={{
          position: "fixed", top: "12px", left: "12px", zIndex: 100,
        }}>
          <button
            onClick={() => navigate("/Profile")}
            style={{
              width: "36px", height: "36px", borderRadius: "50%",
              background: "linear-gradient(135deg, #16a34a, #15803d)",
              border: "2px solid white",
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "14px", fontWeight: 600, color: "white",
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            {initials}
          </button>
        </div>
        <Outlet />
      </main>
      <MobileNav />
    </div>
  );
}