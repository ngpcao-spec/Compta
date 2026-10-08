/**
 * Photo → JPEG compressé avant envoi : côté le plus long ≤ 1600 px, qualité 0,8.
 * Robuste aux photos de la bibliothèque : HEIC (Safari), captures PNG, très grandes images,
 * orientation EXIF (une facture prise en portrait ne doit pas arriver tournée de 90°).
 */
export const MAX_SIDE = 1600;
export const JPEG_QUALITY = 0.8;
/** Au-delà, on refuse plutôt que de risquer de saturer la mémoire du téléphone. */
export const MAX_FILE_BYTES = 60 * 1024 * 1024;
const HEAD_BYTES = 256 * 1024;

export class ImageDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageDecodeError';
  }
}

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

// --- Lecture minimale d'un JPEG : orientation EXIF et dimensions stockées --------------------

export interface JpegInfo {
  /** 1..8 (1 = normal) */
  orientation: number;
  /** dimensions stockées dans le fichier, avant rotation */
  width: number;
  height: number;
}

function isSof(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
}

function readOrientation(b: Uint8Array, tiff: number): number | null {
  if (tiff + 8 > b.length) return null;
  const little = b[tiff] === 0x49; // « II » petit-boutiste, « MM » grand-boutiste
  const u16 = (o: number) =>
    little ? (b[o] ?? 0) | ((b[o + 1] ?? 0) << 8) : ((b[o] ?? 0) << 8) | (b[o + 1] ?? 0);
  const u32 = (o: number) =>
    (little ? u16(o) | (u16(o + 2) << 16) : (u16(o) << 16) | u16(o + 2)) >>> 0;
  const ifd = tiff + u32(tiff + 4);
  if (ifd + 2 > b.length) return null;
  const count = u16(ifd);
  for (let k = 0; k < count; k++) {
    const entry = ifd + 2 + 12 * k;
    if (entry + 12 > b.length) return null;
    if (u16(entry) === 0x0112) {
      const v = u16(entry + 8);
      return v >= 1 && v <= 8 ? v : null;
    }
  }
  return null;
}

/** Orientation EXIF et dimensions d'un JPEG (null si ce n'est pas un JPEG lisible). */
export function readJpegInfo(b: Uint8Array): JpegInfo | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let orientation = 1;
  let width = 0;
  let height = 0;
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = b[i + 1] ?? 0;
    if (marker === 0xff) {
      i++;
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      i += 2; // marqueurs sans longueur
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) break; // fin d'image / début des données
    const len = ((b[i + 2] ?? 0) << 8) | (b[i + 3] ?? 0);
    const start = i + 4;
    if (
      marker === 0xe1 &&
      b[start] === 0x45 &&
      b[start + 1] === 0x78 &&
      b[start + 2] === 0x69 &&
      b[start + 3] === 0x66
    ) {
      orientation = readOrientation(b, start + 6) ?? orientation; // « Exif\0\0 » puis en-tête TIFF
    } else if (isSof(marker) && start + 5 <= b.length) {
      height = ((b[start + 1] ?? 0) << 8) | (b[start + 2] ?? 0);
      width = ((b[start + 3] ?? 0) << 8) | (b[start + 4] ?? 0);
    }
    if (len < 2) break;
    i += 2 + len;
  }
  return width > 0 && height > 0 ? { orientation, width, height } : null;
}

/**
 * Matrice de canvas qui redresse une image stockée en orientation EXIF 5–8 (quart de tour),
 * pour un canvas de sortie `w`×`h`. null pour les autres orientations.
 */
export function exifTransform(
  orientation: number,
  w: number,
  h: number,
): [number, number, number, number, number, number] | null {
  switch (orientation) {
    case 5:
      return [0, 1, 1, 0, 0, 0];
    case 6:
      return [0, 1, -1, 0, w, 0];
    case 7:
      return [0, -1, -1, 0, w, h];
    case 8:
      return [0, -1, 1, 0, 0, h];
    default:
      return null;
  }
}

/**
 * Le décodeur a-t-il ignoré l'orientation ? Pour 5–8 les dimensions affichées doivent être
 * inversées par rapport à celles stockées ; si elles sont identiques, il faut tourner à la main.
 * (Les orientations 2–4 ne changent pas les dimensions : on se fie au navigateur.)
 */
export function manualRotation(
  decodedW: number,
  decodedH: number,
  info: JpegInfo | null,
): number | null {
  if (!info || info.orientation < 5 || info.orientation > 8) return null;
  return decodedW === info.width && decodedH === info.height && decodedW !== decodedH
    ? info.orientation
    : null;
}

// --- Décodage ---------------------------------------------------------------------------------

export interface Ctx2D {
  fillStyle: string | CanvasGradient | CanvasPattern;
  fillRect(x: number, y: number, w: number, h: number): void;
  transform(a: number, b: number, c: number, d: number, e: number, f: number): void;
}
export interface CanvasLike {
  width: number;
  height: number;
  getContext(type: '2d'): Ctx2D | null;
  toBlob(cb: (b: Blob | null) => void, type: string, quality: number): void;
}
/** Image décodée, déjà redressée : `width`/`height` sont les dimensions affichées. */
export interface Decoded {
  width: number;
  height: number;
  draw(ctx: Ctx2D, w: number, h: number): void;
  close?(): void;
}
export interface RawImage {
  width: number;
  height: number;
  draw(ctx: Ctx2D, w: number, h: number): void;
  close?(): void;
}
export interface DecodeStrategy {
  name: string;
  run(file: Blob): Promise<RawImage>;
}

const drawable = (ctx: Ctx2D) => ctx as unknown as CanvasRenderingContext2D;

/** 1) createImageBitmap (orientation « from-image »). */
const bitmapStrategy: DecodeStrategy = {
  name: 'bitmap',
  async run(file) {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return {
      width: bmp.width,
      height: bmp.height,
      draw: (ctx, w, h) => drawable(ctx).drawImage(bmp, 0, 0, w, h),
      close: () => bmp.close(),
    };
  },
};

/** 2) Repli : élément <img> (Safari lit ainsi le HEIC que createImageBitmap refuserait). */
const imageElementStrategy: DecodeStrategy = {
  name: 'img',
  async run(file) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch (e) {
      URL.revokeObjectURL(url);
      throw e;
    }
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      draw: (ctx, w, h) => drawable(ctx).drawImage(img, 0, 0, w, h),
      close: () => URL.revokeObjectURL(url),
    };
  },
};

export const browserStrategies: readonly DecodeStrategy[] = [bitmapStrategy, imageElementStrategy];

function readHeadBytes(file: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('lecture impossible'));
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.readAsArrayBuffer(file.slice(0, HEAD_BYTES));
  });
}

/**
 * Décode une photo : essaie chaque stratégie, puis corrige l'orientation si le navigateur
 * l'a ignorée. Lève `ImageDecodeError` si rien ne fonctionne (format illisible, trop lourd…).
 */
export async function decodeImage(
  file: Blob,
  strategies: readonly DecodeStrategy[] = browserStrategies,
  readHead: (f: Blob) => Promise<ArrayBuffer> = readHeadBytes,
): Promise<Decoded> {
  if (file.size > MAX_FILE_BYTES) throw new ImageDecodeError('image trop lourde');
  let raw: RawImage | null = null;
  for (const s of strategies) {
    try {
      const r = await s.run(file);
      if (r.width > 0 && r.height > 0) {
        raw = r;
        break;
      }
      r.close?.();
    } catch {
      /* stratégie suivante */
    }
  }
  if (!raw) throw new ImageDecodeError('format illisible');

  let info: JpegInfo | null = null;
  try {
    info = readJpegInfo(new Uint8Array(await readHead(file)));
  } catch {
    /* pas d'EXIF lisible : on se fie au décodeur */
  }
  const orientation = manualRotation(raw.width, raw.height, info);
  const source = raw;
  if (orientation === null) return source;
  return {
    width: source.height,
    height: source.width,
    draw: (ctx, w, h) => {
      const t = exifTransform(orientation, w, h);
      if (t) ctx.transform(...t);
      source.draw(ctx, h, w); // l'image est dessinée dans ses axes d'origine, la matrice la redresse
    },
    close: () => source.close?.(),
  };
}

// --- Compression ------------------------------------------------------------------------------

export interface ImageDeps {
  decode(file: Blob): Promise<Decoded>;
  createCanvas(): CanvasLike;
}

const browserDeps: ImageDeps = {
  decode: (file) => decodeImage(file),
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
    if (!ctx) throw new ImageDecodeError('canvas indisponible');
    ctx.fillStyle = '#ffffff'; // le JPEG n'a pas de transparence (captures PNG transparentes)
    ctx.fillRect(0, 0, width, height);
    img.draw(ctx, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    );
    if (!blob) throw new ImageDecodeError('compression impossible');
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
