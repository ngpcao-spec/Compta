import { describe, expect, it, vi } from 'vitest';
import {
  blobToBase64,
  compressImage,
  decodeImage,
  exifTransform,
  fitWithin,
  ImageDecodeError,
  JPEG_QUALITY,
  manualRotation,
  MAX_FILE_BYTES,
  MAX_SIDE,
  readJpegInfo,
  type DecodeStrategy,
  type CanvasLike,
  type Ctx2D,
  type ImageDeps,
} from './image';

describe('fitWithin', () => {
  it('réduit le côté le plus long à 1600 px en gardant les proportions', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(3200, 3200)).toEqual({ width: 1600, height: 1600 });
  });
  it('n’agrandit jamais une petite image', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1600, 1000)).toEqual({ width: 1600, height: 1000 });
  });
  it('garde au moins 1 px et gère les formats extrêmes', () => {
    expect(fitWithin(16000, 10)).toEqual({ width: 1600, height: 1 });
  });
});

function fakeDeps(opts: { width: number; height: number; blob?: Blob | null; noCtx?: boolean }) {
  const ctx: Ctx2D = { fillStyle: '', fillRect: vi.fn(), transform: vi.fn() };
  const toBlob = vi.fn((cb: (b: Blob | null) => void) =>
    cb(opts.blob === undefined ? new Blob(['jpeg'], { type: 'image/jpeg' }) : opts.blob),
  );
  const canvas: CanvasLike = {
    width: 0,
    height: 0,
    getContext: () => (opts.noCtx ? null : ctx),
    toBlob,
  };
  const draw = vi.fn();
  const close = vi.fn();
  const deps: ImageDeps = {
    decode: async () => ({ width: opts.width, height: opts.height, draw, close }),
    createCanvas: () => canvas,
  };
  return { deps, canvas, ctx, toBlob, draw, close };
}

describe('compressImage', () => {
  it('dessine à la taille réduite et exporte en JPEG qualité 0,8', async () => {
    const f = fakeDeps({ width: 4032, height: 3024 });
    const out = await compressImage(new Blob(['x']), f.deps);
    expect(out.width).toBe(MAX_SIDE);
    expect(out.height).toBe(1200);
    expect(f.canvas.width).toBe(1600);
    expect(f.canvas.height).toBe(1200);
    expect(f.draw).toHaveBeenCalledWith(f.ctx, 1600, 1200);
    expect(f.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', JPEG_QUALITY);
    expect(JPEG_QUALITY).toBe(0.8);
    expect(out.blob.type).toBe('image/jpeg');
    expect(f.ctx.fillStyle).toBe('#ffffff'); // fond blanc : le JPEG n'a pas de transparence
    expect(f.close).toHaveBeenCalled();
  });

  it('une petite photo garde sa taille', async () => {
    const f = fakeDeps({ width: 640, height: 480 });
    const out = await compressImage(new Blob(['x']), f.deps);
    expect([out.width, out.height]).toEqual([640, 480]);
  });

  it('échoue proprement (et libère l’image) si la compression ou le canvas échouent', async () => {
    const a = fakeDeps({ width: 100, height: 100, blob: null });
    await expect(compressImage(new Blob(['x']), a.deps)).rejects.toThrow('compression impossible');
    expect(a.close).toHaveBeenCalled();
    const b = fakeDeps({ width: 100, height: 100, noCtx: true });
    await expect(compressImage(new Blob(['x']), b.deps)).rejects.toThrow('canvas indisponible');
  });
});

describe('blobToBase64', () => {
  it('renvoie le base64 sans préfixe data:', async () => {
    const b64 = await blobToBase64(new Blob(['hello'], { type: 'image/jpeg' }));
    expect(b64).toBe(Buffer.from('hello').toString('base64'));
    expect(b64).not.toContain('data:');
  });
});

/** JPEG minimal : SOI + APP1 Exif (orientation) + SOF0 (dimensions stockées). */
function jpegWithExif(
  orientation: number | null,
  width: number,
  height: number,
  bigEndian = false,
): Uint8Array {
  const bytes: number[] = [0xff, 0xd8];
  if (orientation !== null) {
    const u16 = (v: number) => (bigEndian ? [v >> 8, v & 255] : [v & 255, v >> 8]);
    const u32 = (v: number) => (bigEndian ? [0, 0, v >> 8, v & 255] : [v & 255, v >> 8, 0, 0]);
    const tiff = [
      ...(bigEndian ? [0x4d, 0x4d] : [0x49, 0x49]),
      ...u16(42),
      ...u32(8),
      ...u16(1), // une entrée
      ...u16(0x0112),
      ...u16(3),
      ...u32(1),
      ...u16(orientation),
      0,
      0,
      ...u32(0),
    ];
    const exif = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
    bytes.push(0xff, 0xe1, ((exif.length + 2) >> 8) & 255, (exif.length + 2) & 255, ...exif);
  }
  bytes.push(
    0xff,
    0xc0,
    0,
    17,
    8,
    height >> 8,
    height & 255,
    width >> 8,
    width & 255,
    3,
    1,
    0x22,
    0,
    2,
    0x11,
    1,
    3,
    0x11,
    1,
  );
  bytes.push(0xff, 0xd9);
  return Uint8Array.from(bytes);
}

describe('readJpegInfo', () => {
  it.each([1, 3, 6, 8])('lit l’orientation %i (petit-boutiste) et les dimensions', (o) => {
    expect(readJpegInfo(jpegWithExif(o, 4032, 3024))).toEqual({
      orientation: o,
      width: 4032,
      height: 3024,
    });
  });
  it('lit aussi l’EXIF grand-boutiste', () => {
    expect(readJpegInfo(jpegWithExif(6, 4032, 3024, true))?.orientation).toBe(6);
  });
  it('sans EXIF : orientation 1', () => {
    expect(readJpegInfo(jpegWithExif(null, 640, 480))).toEqual({
      orientation: 1,
      width: 640,
      height: 480,
    });
  });
  it('renvoie null pour ce qui n’est pas un JPEG (PNG, HEIC, vide, tronqué)', () => {
    expect(readJpegInfo(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))).toBeNull();
    expect(readJpegInfo(new Uint8Array(0))).toBeNull();
    expect(readJpegInfo(jpegWithExif(6, 100, 50).slice(0, 12))).toBeNull();
  });
});

describe('orientation EXIF', () => {
  it('manualRotation : tourne seulement si le décodeur a ignoré une orientation 5–8', () => {
    const info = (orientation: number) => ({ orientation, width: 4032, height: 3024 });
    expect(manualRotation(4032, 3024, info(6))).toBe(6); // décodeur ignorant l'EXIF
    expect(manualRotation(3024, 4032, info(6))).toBeNull(); // déjà redressée par le navigateur
    expect(manualRotation(4032, 3024, info(1))).toBeNull();
    expect(manualRotation(4032, 3024, info(3))).toBeNull();
    expect(manualRotation(3000, 3000, info(6))).toBeNull(); // carrée : ambigu, on ne touche pas
    expect(manualRotation(4032, 3024, null)).toBeNull();
  });
  it('exifTransform : matrices des quarts de tour', () => {
    expect(exifTransform(6, 300, 400)).toEqual([0, 1, -1, 0, 300, 0]);
    expect(exifTransform(8, 300, 400)).toEqual([0, -1, 1, 0, 0, 400]);
    expect(exifTransform(1, 300, 400)).toBeNull();
  });
});

describe('decodeImage', () => {
  const ok = (w: number, h: number): DecodeStrategy => ({
    name: 'ok',
    run: async () => ({ width: w, height: h, draw: vi.fn() }),
  });
  const ko: DecodeStrategy = { name: 'ko', run: async () => Promise.reject(new Error('HEIC')) };
  const head = (b: Uint8Array) => async () =>
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

  it('retombe sur la stratégie suivante quand la première échoue (HEIC via <img>)', async () => {
    const d = await decodeImage(new Blob(['x']), [ko, ok(800, 600)], head(new Uint8Array(0)));
    expect([d.width, d.height]).toEqual([800, 600]);
  });
  it('lève ImageDecodeError si aucune stratégie ne lit le fichier', async () => {
    await expect(
      decodeImage(new Blob(['x']), [ko, ko], head(new Uint8Array(0))),
    ).rejects.toBeInstanceOf(ImageDecodeError);
  });
  it('refuse une image de dimension nulle', async () => {
    await expect(
      decodeImage(new Blob(['x']), [ok(0, 0)], head(new Uint8Array(0))),
    ).rejects.toBeInstanceOf(ImageDecodeError);
  });
  it('refuse un fichier trop lourd sans le décoder', async () => {
    const run = vi.fn();
    const big = { size: MAX_FILE_BYTES + 1 } as Blob;
    await expect(decodeImage(big, [{ name: 'x', run }])).rejects.toBeInstanceOf(ImageDecodeError);
    expect(run).not.toHaveBeenCalled();
  });
  it('redresse à la main une photo EXIF 6 que le décodeur a laissée couchée', async () => {
    const draw = vi.fn();
    const strat: DecodeStrategy = {
      name: 's',
      run: async () => ({ width: 4032, height: 3024, draw }),
    };
    const d = await decodeImage(new Blob(['x']), [strat], head(jpegWithExif(6, 4032, 3024)));
    expect([d.width, d.height]).toEqual([3024, 4032]);
    const ctx: Ctx2D = { fillStyle: '', fillRect: vi.fn(), transform: vi.fn() };
    d.draw(ctx, 1200, 1600);
    expect(ctx.transform).toHaveBeenCalledWith(0, 1, -1, 0, 1200, 0);
    expect(draw).toHaveBeenCalledWith(ctx, 1600, 1200);
  });
  it('ne touche à rien si le navigateur a déjà appliqué l’orientation', async () => {
    const draw = vi.fn();
    const strat: DecodeStrategy = {
      name: 's',
      run: async () => ({ width: 3024, height: 4032, draw }),
    };
    const d = await decodeImage(new Blob(['x']), [strat], head(jpegWithExif(6, 4032, 3024)));
    expect([d.width, d.height]).toEqual([3024, 4032]);
    const ctx: Ctx2D = { fillStyle: '', fillRect: vi.fn(), transform: vi.fn() };
    d.draw(ctx, 1200, 1600);
    expect(ctx.transform).not.toHaveBeenCalled();
  });
  it('une lecture d’en-tête qui échoue n’empêche pas le scan', async () => {
    const d = await decodeImage(new Blob(['x']), [ok(100, 50)], async () =>
      Promise.reject(new Error('io')),
    );
    expect([d.width, d.height]).toEqual([100, 50]);
  });
});
