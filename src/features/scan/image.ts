/** Compression de la photo avant envoi : côté le plus long ≤ 1600 px, JPEG qualité 0,8. */
export const MAX_SIDE = 1600;
export const JPEG_QUALITY = 0.8;

export function fitWithin(
  width: number,
  height: number,
  max = MAX_SIDE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const k = max / longest;
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

export interface Ctx2D {
  fillStyle: string | CanvasGradient | CanvasPattern;
  fillRect(x: number, y: number, w: number, h: number): void;
}
export interface CanvasLike {
  width: number;
  height: number;
  getContext(type: '2d'): Ctx2D | null;
  toBlob(cb: (b: Blob | null) => void, type: string, quality: number): void;
}
export interface Decoded {
  width: number;
  height: number;
  draw(ctx: Ctx2D, w: number, h: number): void;
  close?(): void;
}
export interface ImageDeps {
  decode(file: Blob): Promise<Decoded>;
  createCanvas(): CanvasLike;
}

const browserDeps: ImageDeps = {
  async decode(file) {
    const bmp = await createImageBitmap(file);
    return {
      width: bmp.width,
      height: bmp.height,
      draw: (ctx, w, h) => (ctx as unknown as CanvasRenderingContext2D).drawImage(bmp, 0, 0, w, h),
      close: () => bmp.close(),
    };
  },
  createCanvas: () => document.createElement('canvas') as unknown as CanvasLike,
};

export interface Compressed {
  blob: Blob;
  width: number;
  height: number;
}

export async function compressImage(
  file: Blob,
  deps: ImageDeps = browserDeps,
): Promise<Compressed> {
  const img = await deps.decode(file);
  try {
    const { width, height } = fitWithin(img.width, img.height);
    const canvas = deps.createCanvas();
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas indisponible');
    ctx.fillStyle = '#ffffff'; // le JPEG n'a pas de transparence
    ctx.fillRect(0, 0, width, height);
    img.draw(ctx, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    );
    if (!blob) throw new Error('compression impossible');
    return { blob, width, height };
  } finally {
    img.close?.();
  }
}

/** Contenu base64 d'un Blob, sans le préfixe `data:…;base64,`. */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('lecture impossible'));
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}
