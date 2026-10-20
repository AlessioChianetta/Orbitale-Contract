import type { ReactNode } from "react";
import { Check } from "lucide-react";

export type SignStepState = "done" | "current" | "upcoming";

/**
 * Un passaggio del pannello di firma nella pagina cliente. Stessa palette del
 * documento (grigi neutri, nero come colore d'azione).
 */
export function SignStep({
  index,
  title,
  description,
  state,
  children,
  testId,
}: {
  index: number;
  title: string;
  description?: ReactNode;
  state: SignStepState;
  children?: ReactNode;
  testId?: string;
}) {
  const badge =
    state === "done"
      ? "bg-[#1d1d1f] text-white"
      : state === "current"
      ? "border-[1.5px] border-[#1d1d1f] bg-white text-[#1d1d1f]"
      : "border border-[#d2d2d7] bg-white text-[#86868b]";
  return (
    <li className="flex gap-4 px-5 py-5 sm:px-7" data-testid={testId} data-state={state}>
      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold ${badge}`}>
        {state === "done" ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <h4 className={`text-[15px] font-semibold ${state === "upcoming" ? "text-[#86868b]" : "text-[#1d1d1f]"}`}>
            {title}
          </h4>
          {state === "done" && <span className="shrink-0 text-xs text-[#6e6e73]">Fatto</span>}
        </div>
        {description && <p className="mt-1 text-sm leading-relaxed text-[#6e6e73]">{description}</p>}
        {children && state !== "upcoming" && <div className="mt-4">{children}</div>}
      </div>
    </li>
  );
}

/** Riga di stato di una singola firma da apporre nel documento. */
export function SignatureCheckRow({ label, done }: { label: string; done: boolean }) {
  return (
    <li className="flex items-center gap-2.5 text-sm">
      <span
        className={`flex h-4 w-4 items-center justify-center rounded-full ${
          done ? "bg-[#1d1d1f] text-white" : "border border-[#c7c7cc] bg-white"
        }`}
      >
        {done && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
      </span>
      <span className={done ? "text-[#1d1d1f]" : "text-[#6e6e73]"}>{label}</span>
    </li>
  );
}
