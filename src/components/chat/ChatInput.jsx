import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Send, ScanLine, Camera, Plus } from "lucide-react";
import Spinner from "@/components/ui/Spinner";
import { motion, AnimatePresence } from "framer-motion";
import { compressImage } from "@/lib/imageUtils";

export default function ChatInput({ onSend, isLoading, onScannerOpen, onPhotoSend }) {
  const [message, setMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const fileInputRef = useRef(null);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!message.trim() || isLoading) return;
    onSend(message.trim());
    setMessage("");
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // reset so same file can be selected again
    setMenuOpen(false);
    setCompressing(true);
    try {
      const base64 = await compressImage(file);
      onPhotoSend(base64);
    } catch {
      // silent fail — user just won't get photo logging
    } finally {
      setCompressing(false);
    }
  };

  const menuItems = [
    {
      icon: <Camera className="w-5 h-5 text-purple-500" />,
      label: "Foto",
      bg: "#f3e8ff",
      action: () => { setMenuOpen(false); fileInputRef.current?.click(); },
    },
    {
      icon: <ScanLine className="w-5 h-5 text-green-600" />,
      label: "Scanner",
      bg: "#f0fcf3",
      action: () => { setMenuOpen(false); onScannerOpen(); },
    },
  ];

  return (
    <form
      onSubmit={handleSubmit}
      className="px-5 pt-3 pb-4 bg-white border-t border-gray-200 fixed bottom-20 left-0 right-0 z-40 md:relative md:bottom-auto md:left-auto md:right-auto md:z-auto"
    >
      {/* Hidden camera input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      <div className="max-w-4xl mx-auto flex items-end gap-2">
        {/* + button with popup menu */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(v => !v)}
            style={{
              width: "52px", height: "52px", borderRadius: "16px",
              background: menuOpen ? "#e5e7eb" : "#f3f4f6",
              border: "1px solid #e5e7eb",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", transition: "background 0.15s",
            }}
          >
            {compressing
              ? <Spinner size="sm" />
              : <Plus style={{ width: "22px", height: "22px", color: "#6b7280", transition: "transform 0.2s", transform: menuOpen ? "rotate(45deg)" : "rotate(0deg)" }} />
            }
          </button>

          {/* Popup menu */}
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: "absolute",
                  bottom: "60px",
                  left: 0,
                  background: "white",
                  borderRadius: "16px",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
                  border: "0.5px solid rgba(0,0,0,0.06)",
                  padding: "6px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                  minWidth: "130px",
                  zIndex: 50,
                }}
              >
                {menuItems.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.action}
                    style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      padding: "9px 12px", borderRadius: "10px",
                      border: "none", background: "transparent",
                      cursor: "pointer", fontSize: "13px",
                      fontWeight: 500, color: "#111827",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: item.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {item.icon}
                    </div>
                    {item.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
          placeholder="Tell me what you ate today... 🥗"
          rows={1}
          className="flex-1 resize-none rounded-2xl border border-gray-200 bg-white px-5 py-3.5 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-all min-h-[52px] max-h-32 shadow-sm"
          style={{ fontSize: "16px" }}
        />

        <Button
          type="submit"
          size="icon"
          disabled={!message.trim() || isLoading}
          className="h-[52px] w-[52px] rounded-2xl shrink-0 bg-primary hover:bg-primary/90 shadow-md"
        >
          {isLoading ? <Spinner size="md" /> : <Send className="w-5 h-5" />}
        </Button>
      </div>
    </form>
  );
}
