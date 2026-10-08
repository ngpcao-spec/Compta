import { describe, expect, it, vi } from 'vitest';
import { base64Bytes, handleScan, type Deps } from '../../supabase/functions/scan-receipt/handler';
import {
  buildRequestBody,
  extractOutputText,
  SYSTEM_PROMPT,
} from '../../supabase/functions/scan-receipt/openai';
import {
  DAILY_LIMIT,
  MAX_IMAGE_BYTES,
  type CategoryRef,
} from '../../supabase/functions/scan-receipt/validate';

const NOW = new Date('2026-10-08T05:00:00Z');
const categories: CategoryRef[] = [
  { id: 'c-an', name: 'Ăn uống', type: 'expense' },
  { id: 'c-khac', name: 'Khác', type: 'expense' },
  { id: 'c-luong', name: 'Lương', type: 'income' },
  { id: 'c-tnk', name: 'Thu nhập khác', type: 'income' },
];
const IMG = Buffer.from('fake-jpeg-bytes').toString('base64');

function openAiReply(result: unknown): Response {
  return new Response(
    JSON.stringify({
      status: 'completed',
      output: [
        { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(result) }] },
      ],
    }),
    { status: 200 },
  );
}

function makeDeps(over: Partial<Deps> = {}): Deps & { calls: { fetch: number; recorded: number } } {
  const calls = { fetch: 0, recorded: 0 };
  const baseFetch: Deps['fetchOpenAI'] =
    over.fetchOpenAI ??
    (async () =>
      openAiReply({
        amount: 250000,
        date: '2026-10-07',
        category_id: 'c-an',
        doc_kind: 'invoice',
        tx_type: 'expense',
        merchant: 'Phở 24',
        vat_included: true,
        confidence: 0.92,
      }));
  const deps: Deps = {
    env: { OPENAI_API_KEY: 'sk-test', OPENAI_MODEL: 'gpt-test' },
    now: () => NOW,
    getUserId: async (t) => (t === 'good' ? 'user-1' : null),
    countRecentScans: async () => 0,
    ...over,
    recordScan: async (u) => {
      calls.recorded++;
      await over.recordScan?.(u);
    },
    fetchOpenAI: async (url, init) => {
      calls.fetch++;
      return baseFetch(url, init);
    },
  };
  return Object.assign(deps, { calls });
}

function request(
  body: unknown,
  headers: Record<string, string> = { Authorization: 'Bearer good' },
  method = 'POST',
) {
  return new Request('https://x.test/functions/v1/scan-receipt', {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: method === 'POST' ? JSON.stringify(body) : undefined,
  });
}
const valid = { image_base64: IMG, mime: 'image/jpeg', categories };

describe('scan-receipt : réponse valide', () => {
  it('renvoie le résultat validé et enregistre le scan', async () => {
    const deps = makeDeps();
    const res = await handleScan(request(valid), deps);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      result: {
        doc_kind: 'invoice',
        tx_type: 'expense',
        amount: 250000,
        date: '2026-10-07',
        category_id: 'c-an',
        merchant: 'Phở 24',
        vat_included: true,
        confidence: 0.92,
      },
    });
    expect(deps.calls.recorded).toBe(1);
  });

  it('envoie à OpenAI : store=false, JSON Schema strict, image, liste de catégories, modèle configuré', async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const deps = makeDeps({
      fetchOpenAI: async (url, init) => {
        seen.push({ url, init });
        return openAiReply({
          amount: 1000,
          date: null,
          category_id: 'c-khac',
          merchant: null,
          confidence: 0.8,
        });
      },
    });
    await handleScan(request(valid), deps);
    expect(seen).toHaveLength(1);
    const first = seen[0]!;
    expect(first.url).toBe('https://api.openai.com/v1/responses');
    expect((first.init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
    const body = JSON.parse(String(first.init.body));
    expect(body.model).toBe('gpt-test');
    expect(body.store).toBe(false);
    expect(body.text.format).toMatchObject({ type: 'json_schema', strict: true });
    expect(body.text.format.schema.additionalProperties).toBe(false);
    expect(body.text.format.schema.required).toEqual([
      'doc_kind',
      'tx_type',
      'amount',
      'date',
      'category_id',
      'merchant',
      'vat_included',
      'confidence',
    ]);
    expect(body.text.format.schema.properties.vat_included).toEqual({ type: ['boolean', 'null'] });
    expect(body.input[0]).toEqual({ role: 'system', content: SYSTEM_PROMPT });
    const user = body.input[1].content;
    expect(user[0].text).toContain('c-an: Ăn uống');
    expect(user[1]).toMatchObject({
      type: 'input_image',
      image_url: `data:image/jpeg;base64,${IMG}`,
    });
  });

  it('le prompt système fixe les règles de la facture vietnamienne', () => {
    expect(SYSTEM_PROMPT).toMatch(/250\.000/);
    expect(SYSTEM_PROMPT).toMatch(/Tổng cộng/);
    expect(SYSTEM_PROMPT).toMatch(/Thanh toán/);
    expect(SYSTEM_PROMPT).toMatch(/Never the subtotal/);
    expect(SYSTEM_PROMPT).toMatch(/"Khác"/);
  });

  it('corrige une catégorie inventée et une date future', async () => {
    const deps = makeDeps({
      fetchOpenAI: async () =>
        openAiReply({
          amount: 90000,
          date: '2027-01-01',
          category_id: 'zzz',
          merchant: null,
          confidence: 0.7,
        }),
    });
    const body = await (await handleScan(request(valid), deps)).json();
    expect(body.result).toMatchObject({ category_id: 'c-khac', date: null });
  });
});

describe('scan-receipt : erreurs', () => {
  it('JWT absent ou invalide → 401, rien n’est appelé', async () => {
    const deps = makeDeps();
    expect((await handleScan(request(valid, {}), deps)).status).toBe(401);
    expect(
      (await handleScan(request(valid, { Authorization: 'Bearer mauvais' }), deps)).status,
    ).toBe(401);
    expect(deps.calls.fetch).toBe(0);
    expect(deps.calls.recorded).toBe(0);
  });

  it('quota dépassé → 429, OpenAI n’est pas appelé', async () => {
    const deps = makeDeps({ countRecentScans: async () => DAILY_LIMIT });
    const res = await handleScan(request(valid), deps);
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: 'quota_exceeded', limit: 30 });
    expect(deps.calls.fetch).toBe(0);
    expect(deps.calls.recorded).toBe(0);
  });

  it('juste sous le quota → accepté ; la fenêtre est de 24 h', async () => {
    let since = '';
    const deps = makeDeps({
      countRecentScans: async (_u, s) => {
        since = s;
        return DAILY_LIMIT - 1;
      },
    });
    expect((await handleScan(request(valid), deps)).status).toBe(200);
    expect(since).toBe(new Date(NOW.getTime() - 24 * 3600_000).toISOString());
  });

  it('JSON invalide renvoyé par l’IA → 502 invalid_response', async () => {
    const deps = makeDeps({
      fetchOpenAI: async () =>
        new Response(
          JSON.stringify({
            status: 'completed',
            output: [{ content: [{ type: 'output_text', text: '{pas du json' }] }],
          }),
          { status: 200 },
        ),
    });
    const res = await handleScan(request(valid), deps);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'invalid_response' });
  });

  it('réponse incomplète ou refusée → 502 invalid_response', async () => {
    const deps = makeDeps({
      fetchOpenAI: async () =>
        new Response(JSON.stringify({ status: 'incomplete', output: [] }), { status: 200 }),
    });
    expect((await handleScan(request(valid), deps)).status).toBe(502);
  });

  it('montant illisible (0) → 422 unreadable', async () => {
    const deps = makeDeps({
      fetchOpenAI: async () =>
        openAiReply({
          amount: 0,
          date: null,
          category_id: 'c-khac',
          merchant: null,
          confidence: 0,
        }),
    });
    const res = await handleScan(request(valid), deps);
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'unreadable' });
  });

  it('erreur OpenAI (5xx, réseau) → 502 sans fuite du corps', async () => {
    const down = makeDeps({
      fetchOpenAI: async () => new Response('secret details sk-test', { status: 503 }),
    });
    const res = await handleScan(request(valid), down);
    expect(res.status).toBe(502);
    expect(JSON.stringify(await res.json())).not.toContain('sk-test');
    const broken = makeDeps({
      fetchOpenAI: async () => {
        throw new Error('network');
      },
    });
    expect((await handleScan(request(valid), broken)).status).toBe(502);
  });

  it('modèle sans paramètre reasoning : un seul nouvel essai sans lui', async () => {
    const bodies: Record<string, unknown>[] = [];
    const fetchOpenAI = vi.fn(async (_u: string, init: RequestInit) => {
      const b = JSON.parse(String(init.body));
      bodies.push(b);
      if (b.reasoning)
        return new Response('Unsupported parameter: reasoning.effort', { status: 400 });
      return openAiReply({
        amount: 5000,
        date: null,
        category_id: 'c-an',
        merchant: null,
        confidence: 0.9,
      });
    });
    const res = await handleScan(request(valid), makeDeps({ fetchOpenAI }));
    expect(res.status).toBe(200);
    expect(bodies).toHaveLength(2);
    expect(bodies[0]).toHaveProperty('reasoning');
    expect(bodies[1]).not.toHaveProperty('reasoning');
  });

  it('clé OpenAI absente → 500 not_configured, sans consommer de quota', async () => {
    const deps = makeDeps({ env: {} });
    const res = await handleScan(request(valid), deps);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'not_configured' });
    expect(deps.calls.recorded).toBe(0);
  });

  it('base de quota indisponible → 500, OpenAI non appelé', async () => {
    const deps = makeDeps({
      countRecentScans: async () => {
        throw new Error('db');
      },
    });
    expect((await handleScan(request(valid), deps)).status).toBe(500);
    expect(deps.calls.fetch).toBe(0);
  });
});

describe('scan-receipt : entrées', () => {
  it('refuse une image de plus de 5 Mo (413) sans appeler OpenAI', async () => {
    const big = 'A'.repeat(Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 8);
    expect(base64Bytes(big)).toBeGreaterThan(MAX_IMAGE_BYTES);
    const deps = makeDeps();
    const res = await handleScan(request({ ...valid, image_base64: big }), deps);
    expect(res.status).toBe(413);
    expect(deps.calls.fetch).toBe(0);
    expect(deps.calls.recorded).toBe(0);
  });

  it('accepte juste sous 5 Mo', () => {
    const ok = 'A'.repeat(Math.floor((MAX_IMAGE_BYTES * 4) / 3) - 8);
    expect(base64Bytes(ok)).toBeLessThanOrEqual(MAX_IMAGE_BYTES);
  });

  it('refuse un corps invalide (400) sans consommer de quota', async () => {
    const deps = makeDeps();
    for (const body of [
      {},
      { ...valid, mime: 'application/pdf' },
      { ...valid, categories: [] },
      { ...valid, image_base64: '' },
    ]) {
      expect((await handleScan(request(body), deps)).status).toBe(400);
    }
    const bad = new Request('https://x.test/', {
      method: 'POST',
      headers: { Authorization: 'Bearer good' },
      body: 'pas du json',
    });
    expect((await handleScan(bad, deps)).status).toBe(400);
    expect(deps.calls.recorded).toBe(0);
  });

  it('accepte une data URL et répond aux requêtes OPTIONS / refuse GET', async () => {
    const deps = makeDeps();
    expect(
      (await handleScan(request({ ...valid, image_base64: `data:image/jpeg;base64,${IMG}` }), deps))
        .status,
    ).toBe(200);
    expect((await handleScan(request(null, {}, 'OPTIONS'), deps)).status).toBe(200);
    expect((await handleScan(new Request('https://x.test/', { method: 'GET' }), deps)).status).toBe(
      405,
    );
  });
});

describe('prompt système', () => {
  it('donne les règles TVA, catégorie par articles et note de repli', () => {
    expect(SYSTEM_PROMPT).toMatch(/vat_included = true/);
    expect(SYSTEM_PROMPT).toMatch(/chưa bao gồm VAT/);
    expect(SYSTEM_PROMPT).toMatch(/vat_included = false/);
    expect(SYSTEM_PROMPT).toMatch(/Never invent or compute a VAT amount/);
    expect(SYSTEM_PROMPT).toMatch(/not from the type of shop/);
    expect(SYSTEM_PROMPT).toMatch(/Ăn uống/);
    expect(SYSTEM_PROMPT).toMatch(/Mua sắm/);
    expect(SYSTEM_PROMPT).toMatch(/cropped/);
    expect(SYSTEM_PROMPT).toMatch(/invoice number/);
    expect(SYSTEM_PROMPT).toMatch(/Cash & Carry/);
  });

  it('la sortie hors TVA de l’IA traverse la fonction telle quelle', async () => {
    const deps = makeDeps({
      fetchOpenAI: async () =>
        openAiReply({
          amount: 1020331,
          date: null,
          category_id: 'c-an',
          merchant: 'HĐ #ISR06000025498',
          vat_included: false,
          confidence: 0.85,
        }),
    });
    const res = await handleScan(request(valid), deps);
    expect(await res.json()).toMatchObject({ ok: true, result: { vat_included: false } });
  });
});

describe('scan-receipt : notifications bancaires et e-wallet', () => {
  const reply = (over: Record<string, unknown>) =>
    makeDeps({
      fetchOpenAI: async () =>
        openAiReply({
          doc_kind: 'bank_notification',
          tx_type: 'income',
          amount: 3500000,
          date: '2026-10-07',
          category_id: 'c-tnk',
          merchant: 'CAO MINH NHAN - Chuyen tien',
          vat_included: null,
          confidence: 0.93,
          ...over,
        }),
    });

  it('SMS NamABank « nop 3.500.000VND » : revenu 3 500 000 au 07/10/2026, note sans numéro de compte', async () => {
    const res = await handleScan(request(valid), reply({}));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { result: Record<string, unknown> };
    expect(body.result).toMatchObject({
      doc_kind: 'bank_notification',
      tx_type: 'income',
      amount: 3500000, // et non le solde 3.617.661
      date: '2026-10-07',
      category_id: 'c-tnk',
      merchant: 'CAO MINH NHAN - Chuyen tien',
    });
    expect(String(body.result.merchant)).not.toMatch(/4010|0007/);
  });

  it('SMS de débit : dépense avec une catégorie de dépense', async () => {
    const res = await handleScan(
      request(valid),
      reply({
        tx_type: 'expense',
        amount: 250000,
        category_id: 'c-khac',
        merchant: 'Thanh toan GRAB',
      }),
    );
    expect(await res.json()).toMatchObject({
      ok: true,
      result: { tx_type: 'expense', amount: 250000, category_id: 'c-khac' },
    });
  });

  it('capture MoMo de paiement : dépense', async () => {
    const res = await handleScan(
      request(valid),
      reply({
        tx_type: 'expense',
        amount: 89000,
        category_id: 'c-an',
        merchant: 'MoMo - Highlands',
      }),
    );
    expect(await res.json()).toMatchObject({
      ok: true,
      result: { doc_kind: 'bank_notification', tx_type: 'expense', amount: 89000 },
    });
  });

  it('plusieurs transactions (doc_kind « other ») → 422, rien à enregistrer, scan quand même compté', async () => {
    const deps = reply({ doc_kind: 'other', amount: 0, confidence: 0, category_id: 'c-khac' });
    const res = await handleScan(request(valid), deps);
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'unreadable' });
    expect(deps.calls.recorded).toBe(1);
  });

  it('« other » avec un montant et une confiance élevés est quand même refusé', async () => {
    const res = await handleScan(request(valid), reply({ doc_kind: 'other', confidence: 0.99 }));
    expect(res.status).toBe(422);
  });

  it('solde recopié à la place du virement : la fonction ne le devine pas, c’est le prompt qui l’interdit', () => {
    expect(SYSTEM_PROMPT).toMatch(/NEVER the balance/);
    expect(SYSTEM_PROMPT).toMatch(/So du/);
  });

  it('un client sans types de catégories (ancienne version) reste servi : tout est « expense »', async () => {
    const legacy = {
      ...valid,
      categories: [
        { id: 'c-an', name: 'Ăn uống' },
        { id: 'c-khac', name: 'Khác' },
      ],
    };
    const deps = makeDeps();
    const res = await handleScan(request(legacy), deps);
    expect(res.status).toBe(200);
  });

  it('type de catégorie invalide → 400', async () => {
    const bad = { ...valid, categories: [{ id: 'a', name: 'A', type: 'autre' }] };
    expect((await handleScan(request(bad), makeDeps())).status).toBe(400);
  });

  it('envoie les DEUX listes de catégories (dépense et revenu) à OpenAI', async () => {
    const seen: string[] = [];
    const deps = makeDeps({
      fetchOpenAI: async (_u, init) => {
        seen.push(String(init.body));
        return openAiReply({
          doc_kind: 'invoice',
          tx_type: 'expense',
          amount: 1000,
          date: null,
          category_id: 'c-an',
          merchant: null,
          vat_included: null,
          confidence: 0.9,
        });
      },
    });
    await handleScan(request(valid), deps);
    const text: string = JSON.parse(seen[0] ?? '{}').input[1].content[0].text;
    expect(text).toContain('Expense categories (id: name):\n- c-an: Ăn uống\n- c-khac: Khác');
    expect(text).toContain(
      'Income categories (id: name):\n- c-luong: Lương\n- c-tnk: Thu nhập khác',
    );
  });

  it('schéma : doc_kind et tx_type en énumérations strictes', () => {
    const b = buildRequestBody({ model: 'm', imageDataUrl: 'data:x', categories });
    const props = (b.text as { format: { schema: { properties: Record<string, unknown> } } }).format
      .schema.properties;
    expect(props.doc_kind).toEqual({
      type: 'string',
      enum: ['invoice', 'bank_notification', 'other'],
    });
    expect(props.tx_type).toEqual({ type: 'string', enum: ['expense', 'income'] });
  });

  it('le prompt donne le sens, le montant, la note, la catégorie et le cas « other »', () => {
    expect(SYSTEM_PROMPT).toMatch(/"nop"/);
    expect(SYSTEM_PROMPT).toMatch(/"ghi có"/);
    expect(SYSTEM_PROMPT).toMatch(/"rút"/);
    expect(SYSTEM_PROMPT).toMatch(/"ghi nợ"/);
    expect(SYSTEM_PROMPT).toMatch(/Số dư/);
    expect(SYSTEM_PROMPT).toMatch(/ND \/ Nội dung/);
    expect(SYSTEM_PROMPT).toMatch(/NEVER put an account number, card number or phone number/);
    expect(SYSTEM_PROMPT).toMatch(/"Lương"/);
    expect(SYSTEM_PROMPT).toMatch(/"Thu nhập khác"/);
    expect(SYSTEM_PROMPT).toMatch(/SEVERAL transactions/);
    expect(SYSTEM_PROMPT).toMatch(/An invoice is always "expense"/);
  });
});

describe('openai helpers', () => {
  it('extractOutputText', () => {
    expect(
      extractOutputText({
        status: 'completed',
        output: [{ content: [{ type: 'output_text', text: 'ok' }] }],
      }),
    ).toBe('ok');
    expect(
      extractOutputText({ output: [{ content: [{ type: 'refusal', refusal: 'non' }] }] }),
    ).toBeNull();
    expect(extractOutputText(null)).toBeNull();
  });
  it('pas de paramètre reasoning sans effort', () => {
    const b = buildRequestBody({ model: 'm', imageDataUrl: 'data:x', categories });
    expect(b).not.toHaveProperty('reasoning');
  });
});
