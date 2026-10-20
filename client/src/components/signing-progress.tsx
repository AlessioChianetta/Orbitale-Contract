import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

/**
 * Schermata mostrata mentre il server registra la firma (verifica del codice,
 * firme nel documento, PDF, copia via email): pochi secondi in cui il cliente
 * non deve pensare che la pagina si sia bloccata. È una sola richiesta, quindi
 * i passaggi avanzano a tempo; l'ultimo resta "in corso" finché il server non
 * risponde, e la pagina passa da sola alla conferma.
 */
const STEPS = [
  { label: "Verifica del codice", at: 0 },
  { label: "Registrazione delle firme nel documento", at: 1200 },
  { label: "Preparazione del PDF firmato", at: 2800 },
  { label: "Invio della copia via email", at: 5000 },
];

export function SigningProgress({ open }: { open: boolean }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!open) {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - started), 200);
    return () => clearInterval(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const active = STEPS.reduce((acc, s, i) => (elapsed >= s.at ? i : acc), 0);
  // La barra si avvicina alla fine senza mai arrivarci da sola.
  const progress = Math.min(92, 8 + (elapsed / 7000) * 84);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 p-4 backdrop-blur-md motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="signing-progress-title"
      aria-describedby="signing-progress-desc"
      data-testid="signing-progress-overlay"
    >
      <div className="w-full max-w-sm rounded-3xl border border-[#e8e8ed] bg-white px-7 py-8 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.25)] motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
        <div className="relative mx-auto h-14 w-14">
          <span className="absolute inset-0 rounded-full border-2 border-[#e8e8ed]" />
          <span className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#1d1d1f] motion-safe:animate-spin" />
          <span className="absolute inset-[9px] rounded-full bg-[#f5f5f7] motion-safe:animate-pulse" />
        </div>

        <h2 id="signing-progress-title" className="mt-6 text-center text-xl font-semibold tracking-tight text-[#1d1d1f]">
          Stiamo registrando la tua firma
        </h2>
        <p id="signing-progress-desc" className="mt-1.5 text-center text-sm leading-relaxed text-[#6e6e73]">
          Ci vogliono pochi secondi. Resta su questa pagina: ti mostriamo noi la conferma.
        </p>

        <div className="mt-6 h-1 overflow-hidden rounded-full bg-[#e8e8ed]">
          <div
            className="h-1 rounded-full bg-[#1d1d1f] transition-[width] duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <ol className="mt-6 space-y-3">
          {STEPS.map((s, i) => {
            const state = i < active ? "done" : i === active ? "current" : "upcoming";
            return (
              <li key={s.label} className="flex items-center gap-3 text-sm" data-state={state}>
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors duration-300 ${
                    state === "done" ? "bg-[#1d1d1f] text-white" : state === "current" ? "text-[#1d1d1f]" : "border border-[#d2d2d7]"
                  }`}
                >
                  {state === "done" && (
                    <Check className="h-3 w-3 motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-300" strokeWidth={3.5} />
                  )}
                  {state === "current" && <Loader2 className="h-4 w-4 motion-safe:animate-spin" />}
                </span>
                <span
                  className={`transition-colors duration-300 ${
                    state === "upcoming" ? "text-[#aeaeb2]" : state === "current" ? "font-medium text-[#1d1d1f]" : "text-[#424245]"
                  }`}
                >
                  {s.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
