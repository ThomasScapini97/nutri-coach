import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";

export default function AppLayout() {
  return (
    <div className="flex min-h-screen bg-background" style={{ overflowX: "hidden", maxWidth: "100vw" }}>
      <Sidebar />
      <main className="flex-1 flex flex-col min-h-screen" style={{ minWidth: 0, overflow: "hidden" }}>
        <Outlet />
      </main>
      <MobileNav />
    </div>
  );
}
