// Gestionnaire de `scan-receipt` : toutes les dépendances externes sont injectées (testable sans Deno).
import {
  buildRequestBody,
  DEFAULT_MODEL,
  DEFAULT_REASONING_EFFORT,
  extractOutputText,
  OPENAI_URL,
} from './openai.ts';
import {
  DAILY_LIMIT,
  MAX_IMAGE_BYTES,
  todayInVietnam,
  validateScan,
  type CategoryRef,
} from './validate.ts';

export interface Deps {
  env: { OPENAI_API_KEY?: string; OPENAI_MODEL?: string; OPENAI_REASONING_EFFORT?: string };
  now(): Date;
  /** Identifiant de l'utilisateur d'après le JWT, ou null s'il est invalide. */
  getUserId(token: string): Promise<string | null>;
  countRecentScans(userId: string, sinceIso: string): Promise<number>;
  recordScan(userId: string): Promise<void>;
  fetchOpenAI(url: string, init: RequestInit): Promise<Response>;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

const MIMES = ['image/jpeg', 'image/png', 'image/webp'];

interface Parsed {
  base64: string;
  mime: string;
  categories: CategoryRef[];
}

function parseBody(body: unknown): Parsed | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.image_base64 !== 'string' || b.image_base64.length === 0) return null;
  const mime = typeof b.mime === 'string' ? b.mime : 'image/jpeg';
  if (!MIMES.includes(mime)) return null;
  if (!Array.isArray(b.categories) || b.categories.length === 0 || b.categories.length > 100)
    return null;
  const categories: CategoryRef[] = [];
  for (const c of b.categories) {
    const r = c as Record<string, unknown>;
    if (
      typeof r?.id !== 'string' ||
      typeof r?.name !== 'string' ||
      r.id.length > 64 ||
      r.name.length > 60
    )
      return null;
    // clients d'avant les revenus : pas de type = dépense
    const type = r.type === undefined ? 'expense' : r.type;
    if (type !== 'expense' && type !== 'income') return null;
    categories.push({ id: r.id, name: r.name, type });
  }
  const base64 = b.image_base64.replace(/^data:[^;]+;base64,/, '');
  return { base64, mime, categories };
}

/** Taille décodée d'une chaîne base64 (sans la décoder). */
export function base64Bytes(b64: string): number {
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - pad;
}

export async function handleScan(req: Request, deps: Deps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'unauthorized' }, 401);
  const userId = await deps.getUserId(token);
  if (!userId) return json({ error: 'unauthorized' }, 401);

  // Garde-fou avant de lire le corps : 5 Mo décodés ≈ 7 Mo en base64 (+ enveloppe JSON).
  const declared = Number(req.headers.get('Content-Length') ?? 0);
  if (declared > Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 100_000)
    return json({ error: 'image_too_large' }, 413);

  let parsed: Parsed | null;
  try {
    parsed = parseBody(await req.json());
  } catch {
    parsed = null;
  }
  if (!parsed) return json({ error: 'bad_request' }, 400);
  if (base64Bytes(parsed.base64) > MAX_IMAGE_BYTES) return json({ error: 'image_too_large' }, 413);

  const apiKey = deps.env.OPENAI_API_KEY;
  if (!apiKey) return json({ error: 'not_configured' }, 500);

  const now = deps.now();
  const since = new Date(now.getTime() - 24 * 3600_000).toISOString();
  try {
    if ((await deps.countRecentScans(userId, since)) >= DAILY_LIMIT) {
      return json({ error: 'quota_exceeded', limit: DAILY_LIMIT }, 429);
    }
    // Comptabilisé avant l'appel : protège le coût même si OpenAI échoue ensuite.
    await deps.recordScan(userId);
  } catch {
    return json({ error: 'quota_unavailable' }, 500);
  }

  const model = deps.env.OPENAI_MODEL || DEFAULT_MODEL;
  const imageDataUrl = `data:${parsed.mime};base64,${parsed.base64}`;
  const call = (reasoningEffort?: string) =>
    deps.fetchOpenAI(OPENAI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(
        buildRequestBody({ model, imageDataUrl, categories: parsed.categories, reasoningEffort }),
      ),
    });

  let res: Response;
  try {
    const effort = deps.env.OPENAI_REASONING_EFFORT || DEFAULT_REASONING_EFFORT;
    res = await call(effort);
    if (res.status === 400) {
      // Modèle sans paramètre `reasoning` : un seul nouvel essai sans lui.
      const msg = (await res.text()).toLowerCase();
      if (msg.includes('reasoning') || msg.includes('effort')) res = await call(undefined);
    }
  } catch {
    return json({ error: 'upstream_error' }, 502);
  }
  // Jamais de journalisation du corps ni de l'image : seulement le statut.
  if (!res.ok) return json({ error: 'upstream_error', status: res.status }, 502);

  let text: string | null;
  try {
    text = extractOutputText(await res.json());
  } catch {
    text = null;
  }
  if (!text) return json({ error: 'invalid_response' }, 502);

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return json({ error: 'invalid_response' }, 502);
  }

  const result = validateScan(raw, parsed.categories, todayInVietnam(now));
  if (!result) return json({ error: 'unreadable' }, 422);
  return json({ ok: true, result });
}
