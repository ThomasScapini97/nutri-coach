/**
 * Compress an image File to a JPEG base64 string.
 * Default: max 800px on longest side, JPEG quality 0.75
 *
 * iPhone 12MP original:  ~4MB  → after: ~150-250KB  (~94% reduction)
 * Average food photo:    ~3MB  → after: ~120-200KB  (~93% reduction)
 */
export function compressImage(file, maxWidth = 800, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Scale down keeping aspect ratio, never upscale
      const ratio = Math.min(maxWidth / img.width, maxWidth / img.height, 1);
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);

      // Export as JPEG — strip the "data:image/jpeg;base64," prefix
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve(dataUrl.split(",")[1]);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}
