// Garde de production : le build normal ne doit contenir ni faux serveur ni crochets e2e.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

if (process.env.VITE_E2E === '1') {
  console.log('Build e2e : contrôle ignoré.');
  process.exit(0);
}
const dir = 'dist/assets';
const markers = ['stc.e2e.server', 'stc.e2e.user', '__stc', 'e2e-login', 'stc.e2e.scan'];
const bad = [];
for (const f of readdirSync(dir)) {
  if (!f.endsWith('.js')) continue;
  const text = readFileSync(join(dir, f), 'utf8');
  for (const m of markers) if (text.includes(m)) bad.push(`${f}: ${m}`);
}
if (bad.length) {
  console.error('Code e2e présent dans le build de production :\n' + bad.join('\n'));
  process.exit(1);
}
console.log('OK : aucun code e2e dans le build de production.');
