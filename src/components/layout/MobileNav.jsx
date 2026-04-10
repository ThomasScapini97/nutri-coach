import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { MessageCircle, BarChart3, Dumbbell, BookOpen } from "lucide-react";
import { useChatContext } from "@/lib/ChatContext";
import ChatInput from "@/components/chat/ChatInput";
import { useTranslation } from "react-i18next";

function NavItems({ location }) {
  const { t } = useTranslation();
  const navItems = [
    { path: "/Chat", label: t("nav.chat"), icon: MessageCircle },
    { path: "/Summary", label: t("nav.summary"), icon: BarChart3 },
    { path: "/Exercise", label: t("nav.exercise"), icon: Dumbbell },
    { path: "/Diary", label: t("nav.diary"), icon: BookOpen },
  ];
  return (
    <>
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            className="flex flex-col items-center justify-center gap-1 flex-1 h-full"
            style={{
              color: isActive ? "#16a34a" : "#9ca3af",
              textDecoration: "none",
              fontSize: "10px",
              fontWeight: 500,
              transition: "color 0.15s",
            }}
          >
            <item.icon style={{ width: "20px", height: "20px", strokeWidth: isActive ? 2.5 : 2 }} />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}


export default function MobileNav() {
  const location = useLocation();
  const { chatInputProps } = useChatContext();
  const isChat = location.pathname === "/Chat";
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  useEffect(() => {
    const update = () => {
      const vv = window.visualViewport;
      const offset = vv ? Math.max(window.innerHeight - vv.height, 0) : 0;
      setKeyboardOffset(offset);
    };

    // visualViewport fires during keyboard animation — read after rAF to get settled value
    const handleVVResize = () => requestAnimationFrame(update);

    // Fallback: focusin waits 300ms for keyboard animation to complete
    let focusTimer;
    const onFocus = () => { clearTimeout(focusTimer); focusTimer = setTimeout(update, 300); };
    const onBlur  = () => { clearTimeout(focusTimer); focusTimer = setTimeout(() => setKeyboardOffset(0), 100); };

    window.visualViewport?.addEventListener("resize", handleVVResize);
    window.visualViewport?.addEventListener("scroll", handleVVResize);
    document.addEventListener("focusin",  onFocus);
    document.addEventListener("focusout", onBlur);

    return () => {
      window.visualViewport?.removeEventListener("resize", handleVVResize);
      window.visualViewport?.removeEventListener("scroll", handleVVResize);
      document.removeEventListener("focusin",  onFocus);
      document.removeEventListener("focusout", onBlur);
      clearTimeout(focusTimer);
    };
  }, []);

  const safeBottom = "env(safe-area-inset-bottom, 16px)";

  // ── /Chat: expanded nav with ChatInput above tab icons ──────────────────────
  if (isChat && chatInputProps) {
    return (
      <nav
        className="md:hidden fixed z-50 left-0 right-0"
        style={{
          background: "white",
          borderRadius: "24px 24px 0 0",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.08)",
          bottom: keyboardOffset > 0 ? `${keyboardOffset}px` : 0,
          paddingBottom: keyboardOffset > 0 ? 0 : safeBottom,
        }}
      >
        <ChatInput embedded {...chatInputProps} />
        <div
          style={{
            display: "flex",
            height: "56px",
            borderTop: "0.5px solid rgba(0,0,0,0.06)",
          }}
        >
          <NavItems location={location} />
        </div>
      </nav>
    );
  }

  // ── Other pages: same edge-to-edge style, only icons ───────────────────────
  return (
    <nav
      className="md:hidden fixed z-50 bottom-0 left-0 right-0"
      style={{
        background: "white",
        borderRadius: "24px 24px 0 0",
        boxShadow: "0 -4px 20px rgba(0,0,0,0.08)",
        paddingBottom: safeBottom,
      }}
    >
      <div style={{ display: "flex", width: "100%", height: "56px" }}>
        <NavItems location={location} />
      </div>
    </nav>
  );
}
