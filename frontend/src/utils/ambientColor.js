const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

const DEFAULT_PALETTE = {
  r: 214,
  g: 54,
  b: 40,
};

const paletteCache = new Map();

function rgbToHsl(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h, s, l];
}

/**
 * Extracts a rich, cinema-calibrated dominant RGB color from the local same-origin
 * poster proxy (/api/v1/movies/{id}/poster) via a tiny 16x16 offscreen canvas.
 */
export function extractAmbientColor(movieId) {
  if (!movieId || typeof document === 'undefined') {
    return Promise.resolve(DEFAULT_PALETTE);
  }
  if (paletteCache.has(movieId)) {
    return Promise.resolve(paletteCache.get(movieId));
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(DEFAULT_PALETTE);
          return;
        }
        ctx.drawImage(img, 0, 0, 16, 16);
        const { data } = ctx.getImageData(0, 0, 16, 16);

        let bestScore = -1;
        let bestRgb = DEFAULT_PALETTE;
        let sumR = 0;
        let sumG = 0;
        let sumB = 0;
        let weightSum = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          if (a < 180) continue;

          const [, s, l] = rgbToHsl(r, g, b);
          // Skip near-black and near-white pixels; favor rich theatrical saturation
          if (l < 0.14 || l > 0.82) continue;
          const weight = (s * 2.2 + 0.15) * (1 - Math.abs(l - 0.48));
          sumR += r * weight;
          sumG += g * weight;
          sumB += b * weight;
          weightSum += weight;

          if (weight > bestScore) {
            bestScore = weight;
            bestRgb = { r, g, b };
          }
        }

        const chosen =
          weightSum > 0.8
            ? {
                r: Math.round((sumR / weightSum) * 0.65 + bestRgb.r * 0.35),
                g: Math.round((sumG / weightSum) * 0.65 + bestRgb.g * 0.35),
                b: Math.round((sumB / weightSum) * 0.65 + bestRgb.b * 0.35),
              }
            : DEFAULT_PALETTE;

        paletteCache.set(movieId, chosen);
        resolve(chosen);
      } catch {
        resolve(DEFAULT_PALETTE);
      }
    };

    img.onerror = () => resolve(DEFAULT_PALETTE);
    img.src = `${API_BASE}/movies/${movieId}/poster`;
  });
}
