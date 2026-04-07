import { Outlet, useNavigate, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import { useAuth } from "@/lib/AuthContext";

export default function AppLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const avatarUrl = user?.user_metadata?.avatar_url || null;
  const isProfile = location.pathname === "/Profile";

  return (
    <div className="min-h-screen md:bg-gray-100">
      <div className="flex min-h-screen bg-background md:max-w-[808px] md:mx-auto md:shadow-xl overflow-x-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col min-h-screen" style={{ minWidth: 0, overflow: "hidden" }}>
          {/* Avatar / back button — hidden on desktop (sidebar handles navigation) */}
          <div className="md:hidden fixed top-[14px] left-[16px] z-[100]">
            {isProfile ? (
              <button
                onClick={() => navigate(-1)}
                className="w-9 h-9 rounded-full bg-white border border-gray-200 shadow-[0_2px_8px_rgba(0,0,0,0.1)] flex items-center justify-center cursor-pointer p-0"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6"/>
                </svg>
              </button>
            ) : (
              <button
                onClick={() => navigate("/Profile")}
                className="w-9 h-9 rounded-full border-2 border-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] flex items-center justify-center cursor-pointer overflow-hidden p-0"
                style={{ background: "linear-gradient(135deg, #16a34a, #15803d)" }}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                )}
              </button>
            )}
          </div>
          <Outlet />
          {/* White base under floating nav */}
          <div className="md:hidden" style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: "80px", background: "white", zIndex: 39 }} />
        </main>
        {!isProfile && <MobileNav />}
      </div>
    </div>
  );
}
