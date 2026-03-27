import { useState, useEffect, useRef } from "react";
import { X, Camera, Search, Loader2, AlertCircle } from "lucide-react";

export default function BarcodeScanner({ onProductFound, onClose }) {
  const [mode, setMode] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [grams, setGrams] = useState("100");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scannerRef = useRef(null);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    scannerRef.current = null;
  };

  const startCamera = async () => {
    setMode("camera");
    setCameraError(null);
    setScanning(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setScanning(true);
      startBarcodeDetection();
    } catch {
      setCameraError("Camera not available. Please use the search instead.");
    }
  };

  const startBarcodeDetection = async () => {
    if (!("BarcodeDetector" in window)) {
      setCameraError("Barcode scanning not supported on this browser. Please use the search.");
      return;
    }
    try {
      const detector = new window.BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e"] });
      scannerRef.current = detector;
      const scan = async () => {
        if (!videoRef.current || !scannerRef.current) return;
        try {
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes.length > 0) {
            const code = barcodes[0].rawValue;
            stopCamera();
            setScanning(false);
            await fetchByBarcode(code);
          } else {
            requestAnimationFrame(scan);
          }
        } catch {
          requestAnimationFrame(scan);
        }
      };
      requestAnimationFrame(scan);
    } catch {
      setCameraError("Could not start barcode detection.");
    }
  };

  const fetchByBarcode = async (barcode) => {
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const data = await res.json();
      if (data.status === 1 && data.product) {
        const product = parseProduct(data.product);
        if (product) {
          // ✅ FIX: mostra il popup grammi invece di chiamare onProductFound direttamente
          handleSelectProduct(product);
        } else {
          setError("Product found but nutritional data is incomplete.");
        }
      } else {
        setError("Product not found in database. Try searching by name.");
        setMode("search");
      }
    } catch {
      setError("Connection error. Please try again.");
      setMode("search");
    } finally {
      setSearching(false);
    }
  };

  const parseProduct = (p) => {
    const n = p.nutriments || {};
    const name = p.product_name || p.product_name_en || null;
    if (!name) return null;
    const per100 = {
      calories: Math.round(n["energy-kcal_100g"] || n["energy-kcal"] || (n["energy_100g"] || 0) / 4.184 || 0),
      carbs: Math.round((n["carbohydrates_100g"] || 0) * 10) / 10,
      protein: Math.round((n["proteins_100g"] || 0) * 10) / 10,
      fats: Math.round((n["fat_100g"] || 0) * 10) / 10,
      fiber: Math.round((n["fiber_100g"] || 0) * 10) / 10,
    };
    return { name, per100, serving: p.serving_size || "100g" };
  };

  const searchByName = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setError(null);
    setResults([]);
    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(searchQuery)}&search_simple=1&action=process&json=1&page_size=8&fields=product_name,nutriments,serving_size,brands`
      );
      const data = await res.json();
      const parsed = (data.products || [])
        .map(p => ({ ...parseProduct(p), brand: p.brands || "" }))
        .filter(p => p && p.name && p.per100.calories > 0);
      if (parsed.length === 0) setError("No products found. Try a different search term.");
      setResults(parsed);
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
    setGrams("100");
  };

  const handleConfirm = () => {
    const g = parseFloat(grams) || 100;
    const ratio = g / 100;
    onProductFound({
      ...selectedProduct,
      grams: g,
      per100: selectedProduct.per100,
      adjusted: {
        calories: Math.round(selectedProduct.per100.calories * ratio),
        carbs: Math.round(selectedProduct.per100.carbs * ratio * 10) / 10,
        protein: Math.round(selectedProduct.per100.protein * ratio * 10) / 10,
        fats: Math.round(selectedProduct.per100.fats * ratio * 10) / 10,
        fiber: Math.round(selectedProduct.per100.fiber * ratio * 10) / 10,
      }
    });
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div style={{ background: "white", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: "480px", maxHeight: "85vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 16px 12px", borderBottom: "0.5px solid #f3f4f6" }}>
          <div>
            <p style={{ fontSize: "15px", fontWeight: 500, color: "#1a3a22" }}>Add food</p>
            <p style={{ fontSize: "11px", color: "#9ca3af" }}>Scan barcode or search by name</p>
          </div>
          <button onClick={onClose} style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#f3f4f6", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X style={{ width: "16px", height: "16px", color: "#6b7280" }} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>

          {/* Mode selector */}
          {!mode && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button onClick={startCamera} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px", borderRadius: "16px", border: "0.5px solid #e5e7eb", background: "#f9fafb", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Camera style={{ width: "20px", height: "20px", color: "#16a34a" }} />
                </div>
                <div>
                  <p style={{ fontSize: "14px", fontWeight: 500, color: "#1a3a22", marginBottom: "2px" }}>Scan barcode</p>
                  <p style={{ fontSize: "12px", color: "#9ca3af" }}>Point camera at product barcode</p>
                </div>
              </button>
              <button onClick={() => setMode("search")} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px", borderRadius: "16px", border: "0.5px solid #e5e7eb", background: "#f9fafb", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Search style={{ width: "20px", height: "20px", color: "#3b82f6" }} />
                </div>
                <div>
                  <p style={{ fontSize: "14px", fontWeight: 500, color: "#1a3a22", marginBottom: "2px" }}>Search by name</p>
                  <p style={{ fontSize: "12px", color: "#9ca3af" }}>Type a food or product name</p>
                </div>
              </button>
            </div>
          )}

          {/* Camera mode */}
          {mode === "camera" && (
            <div>
              {cameraError ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "24px 0" }}>
                  <AlertCircle style={{ width: "32px", height: "32px", color: "#ef4444" }} />
                  <p style={{ fontSize: "13px", color: "#6b7280", textAlign: "center" }}>{cameraError}</p>
                  <button onClick={() => setMode("search")} style={{ fontSize: "13px", color: "#16a34a", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
                    Switch to search →
                  </button>
                </div>
              ) : searching ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", padding: "24px 0" }}>
                  <Loader2 style={{ width: "28px", height: "28px", color: "#16a34a", animation: "spin 1s linear infinite" }} />
                  <p style={{ fontSize: "13px", color: "#9ca3af" }}>Looking up product...</p>
                </div>
              ) : (
                <div>
                  <div style={{ position: "relative", borderRadius: "16px", overflow: "hidden", background: "#000", aspectRatio: "4/3" }}>
                    <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover" }} playsInline muted />
                    {scanning && (
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ width: "60%", height: "25%", border: "2px solid #16a34a", borderRadius: "8px", boxShadow: "0 0 0 9999px rgba(0,0,0,0.4)" }} />
                      </div>
                    )}
                    <p style={{ position: "absolute", bottom: "12px", left: 0, right: 0, textAlign: "center", fontSize: "12px", color: "white", opacity: 0.8 }}>
                      Point at a barcode
                    </p>
                  </div>
                  {error && <p style={{ fontSize: "12px", color: "#ef4444", marginTop: "10px", textAlign: "center" }}>{error}</p>}
                </div>
              )}
              <button onClick={() => { stopCamera(); setMode(null); setError(null); }} style={{ marginTop: "12px", fontSize: "12px", color: "#9ca3af", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", width: "100%", textAlign: "center" }}>
                ← Back
              </button>
            </div>
          )}

          {/* Search mode */}
          {mode === "search" && (
            <div>
              <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                <input
                  type="text" value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && searchByName()}
                  placeholder="e.g. Nutella, Greek yogurt..."
                  autoFocus
                  style={{ flex: 1, background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: "10px", padding: "10px 14px", fontSize: "14px", color: "#1a3a22", outline: "none", fontFamily: "inherit" }}
                />
                <button onClick={searchByName} disabled={searching || !searchQuery.trim()} style={{ background: "#16a34a", color: "white", border: "none", borderRadius: "10px", padding: "10px 16px", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit", opacity: searching || !searchQuery.trim() ? 0.6 : 1, display: "flex", alignItems: "center", gap: "6px" }}>
                  {searching ? <Loader2 style={{ width: "14px", height: "14px", animation: "spin 1s linear infinite" }} /> : <Search style={{ width: "14px", height: "14px" }} />}
                  Search
                </button>
              </div>

              {error && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px", background: "#fef2f2", borderRadius: "10px", marginBottom: "10px" }}>
                  <AlertCircle style={{ width: "14px", height: "14px", color: "#ef4444", flexShrink: 0 }} />
                  <p style={{ fontSize: "12px", color: "#dc2626" }}>{error}</p>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {results.map((product, i) => (
                  <button key={i} onClick={() => handleSelectProduct(product)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: "12px", border: "0.5px solid #e5e7eb", background: "white", cursor: "pointer", fontFamily: "inherit", textAlign: "left", width: "100%" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "13px", fontWeight: 500, color: "#1a3a22", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{product.name}</p>
                      {product.brand && <p style={{ fontSize: "11px", color: "#9ca3af" }}>{product.brand}</p>}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, marginLeft: "10px" }}>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: "14px", fontWeight: 500, color: "#dc2626" }}>{product.per100.calories}</p>
                        <p style={{ fontSize: "10px", color: "#9ca3af" }}>kcal/100g</p>
                      </div>
                      <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px" }}>+</div>
                    </div>
                  </button>
                ))}
              </div>

              <button onClick={() => { setMode(null); setResults([]); setError(null); setSearchQuery(""); }} style={{ marginTop: "12px", fontSize: "12px", color: "#9ca3af", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", width: "100%", textAlign: "center" }}>
                ← Back
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Popup grammi — appare sia dopo barcode che dopo ricerca */}
      {selectedProduct && (
        <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div style={{ background: "white", borderRadius: "20px", padding: "20px", width: "100%", maxWidth: "320px" }}>
            <p style={{ fontSize: "15px", fontWeight: 500, color: "#1a3a22", marginBottom: "4px" }}>{selectedProduct.name}</p>
            <p style={{ fontSize: "11px", color: "#9ca3af", marginBottom: "16px" }}>{selectedProduct.per100.calories} kcal per 100g</p>

            <label style={{ fontSize: "11px", color: "#9ca3af", letterSpacing: "0.3px", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
              How many grams?
            </label>
            <input
              type="number" value={grams}
              onChange={e => setGrams(e.target.value)}
              autoFocus
              style={{ width: "100%", background: "#f9fafb", border: "0.5px solid #e5e7eb", borderRadius: "10px", padding: "10px 14px", fontSize: "20px", fontWeight: 500, color: "#1a3a22", outline: "none", fontFamily: "inherit", textAlign: "center", marginBottom: "12px" }}
            />

            {parseFloat(grams) > 0 && (() => {
              const ratio = parseFloat(grams) / 100;
              return (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "6px", marginBottom: "16px" }}>
                  {[
                    { label: "Kcal", value: Math.round(selectedProduct.per100.calories * ratio), color: "#dc2626" },
                    { label: "Carbs", value: Math.round(selectedProduct.per100.carbs * ratio * 10) / 10 + "g", color: "#f59e0b" },
                    { label: "Prot", value: Math.round(selectedProduct.per100.protein * ratio * 10) / 10 + "g", color: "#ef4444" },
                    { label: "Fats", value: Math.round(selectedProduct.per100.fats * ratio * 10) / 10 + "g", color: "#3b82f6" },
                  ].map(m => (
                    <div key={m.label} style={{ background: "#f9fafb", borderRadius: "10px", padding: "8px 4px", textAlign: "center" }}>
                      <p style={{ fontSize: "13px", fontWeight: 500, color: m.color }}>{m.value}</p>
                      <p style={{ fontSize: "10px", color: "#9ca3af" }}>{m.label}</p>
                    </div>
                  ))}
                </div>
              );
            })()}

            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => setSelectedProduct(null)} style={{ flex: 1, background: "#f9fafb", color: "#6b7280", border: "0.5px solid #e5e7eb", borderRadius: "12px", padding: "11px", fontSize: "13px", cursor: "pointer", fontFamily: "inherit" }}>
                Cancel
              </button>
              <button onClick={handleConfirm} disabled={!parseFloat(grams) || parseFloat(grams) <= 0} style={{ flex: 2, background: "#16a34a", color: "white", border: "none", borderRadius: "12px", padding: "11px", fontSize: "13px", fontWeight: 500, cursor: "pointer", fontFamily: "inherit", opacity: !parseFloat(grams) || parseFloat(grams) <= 0 ? 0.5 : 1 }}>
                Log {parseFloat(grams) > 0 ? Math.round(selectedProduct.per100.calories * parseFloat(grams) / 100) : 0} kcal
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
