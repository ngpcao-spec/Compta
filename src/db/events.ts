/** Petit bus : les dépôts signalent une écriture locale, le moteur de synchro s'y abonne. */
type Listener = () => void;
const listeners = new Set<Listener>();

export function onLocalWrite(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function emitLocalWrite(): void {
  for (const l of listeners) l();
}
