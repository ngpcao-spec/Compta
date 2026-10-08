import { describe, expect, it, vi } from 'vitest';
import {
  blobToBase64,
  compressImage,
  fitWithin,
  JPEG_QUALITY,
  MAX_SIDE,
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
  const ctx: Ctx2D = { fillStyle: '', fillRect: vi.fn() };
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
