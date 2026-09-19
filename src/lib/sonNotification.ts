// Son de notification web (2026-09) — voir demande utilisateur : "ça doit
// même avoir un son de notification comme c'est le cas avec Gmail, Outlook,
// Facebook web, YouTube". Synthétisé via Web Audio API (petit carillon deux
// tons) plutôt qu'un fichier audio hébergé — aucun asset à charger/héberger,
// fonctionne immédiatement partout. Les navigateurs exigent un geste
// utilisateur avant tout son : à ce stade de la session (utilisateur déjà
// connecté, ayant déjà cliqué dans l'application), l'AudioContext est
// systématiquement déjà autorisé à jouer.
let contexteAudio: AudioContext | null = null;

function obtenirContexte(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!contexteAudio) contexteAudio = new Ctor();
  return contexteAudio;
}

function jouerTon(ctx: AudioContext, frequence: number, debut: number, duree: number, volumeCrete = 0.16): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = frequence;
  osc.connect(gain);
  gain.connect(ctx.destination);
  const t0 = ctx.currentTime + debut;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volumeCrete, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duree);
  osc.start(t0);
  osc.stop(t0 + duree + 0.05);
}

export function jouerSonNotification(): void {
  try {
    const ctx = obtenirContexte();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => undefined);
    jouerTon(ctx, 880, 0, 0.16);
    jouerTon(ctx, 1318.5, 0.11, 0.24);
  } catch {
    // Jamais bloquant — un navigateur sans Web Audio ou une politique
    // d'autoplay stricte ne doit jamais casser l'affichage de la bulle.
  }
}
