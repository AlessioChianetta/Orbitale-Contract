import { useState } from "react";
import { ClipboardList, Copy, Edit3, CheckCircle2, ChevronDown, ChevronUp, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getMissingClientFields, type RequiredClientField } from "@/lib/required-client-fields";

interface MissingDataPanelProps {
  clientData: Record<string, any> | undefined | null;
  onJumpToField: (field: RequiredClientField) => void;
  variant?: "sidebar" | "accordion";
  className?: string;
}

export default function MissingDataPanel({
  clientData,
  onJumpToField,
  variant = "sidebar",
  className = "",
}: MissingDataPanelProps) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(true);
  const [justCopied, setJustCopied] = useState(false);
  const missing = getMissingClientFields(clientData);
  const isComplete = missing.length === 0;

  const handleCopy = async () => {
    const text = `Ciao, per completare il contratto mi servono i seguenti dati:\n${missing
      .map((f) => `• ${f.label}`)
      .join("\n")}\n\nGrazie!`;
    try {
      await navigator.clipboard.writeText(text);
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 1800);
      toast({
        title: "Elenco copiato",
        description: "Puoi incollarlo in WhatsApp o email per il cliente.",
      });
    } catch {
      toast({
        title: "Impossibile copiare",
        description: "Copia manualmente l'elenco dei dati mancanti.",
        variant: "destructive",
      });
    }
  };

  const headerCount = (
    <span
      className={`inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-bold ${
        isComplete ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
      }`}
      data-testid="missing-data-count"
    >
      {missing.length}
    </span>
  );

  if (variant === "accordion") {
    return (
      <div
        className={`rounded-2xl border ${
          isComplete ? "border-emerald-200 bg-emerald-50/40" : "border-amber-200 bg-amber-50/40"
        } overflow-hidden ${className}`}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
          aria-expanded={expanded}
          aria-controls="missing-data-region"
          data-testid="missing-data-toggle"
        >
          <span className="flex items-center gap-2">
            <ClipboardList className={`h-4 w-4 ${isComplete ? "text-emerald-600" : "text-amber-600"}`} />
            <span className="text-sm font-semibold text-slate-800">Dati da chiedere al cliente</span>
            {headerCount}
          </span>
          {expanded ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
        </button>
        {expanded && (
          <div id="missing-data-region" className="px-4 pb-4">
            <PanelBody
              missing={missing}
              isComplete={isComplete}
              onJumpToField={onJumpToField}
              onCopy={handleCopy}
              justCopied={justCopied}
              compact
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <aside
      aria-label="Dati cliente mancanti"
      className={`flex flex-col bg-gradient-to-b from-slate-50 to-white border-l border-gray-100 ${className}`}
      data-testid="missing-data-panel"
    >
      <div className="px-5 py-4 border-b border-gray-100 bg-white/70">
        <div className="flex items-center gap-2 mb-1">
          <ClipboardList className="h-4 w-4 text-indigo-600" />
          <h4 className="text-sm font-semibold text-slate-900">Dati da chiedere al cliente</h4>
          {headerCount}
        </div>
        <p className="text-xs text-slate-500 leading-snug">
          {isComplete
            ? "Tutti i dati obbligatori sono stati inseriti."
            : "Campi obbligatori ancora vuoti. Aggiornano in tempo reale mentre compili."}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <PanelBody
          missing={missing}
          isComplete={isComplete}
          onJumpToField={onJumpToField}
          onCopy={handleCopy}
          justCopied={justCopied}
        />
      </div>
    </aside>
  );
}

function PanelBody({
  missing,
  isComplete,
  onJumpToField,
  onCopy,
  justCopied,
  compact,
}: {
  missing: RequiredClientField[];
  isComplete: boolean;
  onJumpToField: (field: RequiredClientField) => void;
  onCopy: () => void;
  justCopied: boolean;
  compact?: boolean;
}) {
  if (isComplete) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-8 px-3">
        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
        </div>
        <p className="text-sm font-semibold text-emerald-700">Tutti i dati obbligatori sono presenti</p>
        <p className="text-xs text-slate-500 mt-1">Puoi procedere con l'invio del contratto.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <ul className={`space-y-1.5 ${compact ? "" : "mb-3"}`}>
        {missing.map((f) => (
          <li key={f.key}>
            <button
              type="button"
              onClick={() => onJumpToField(f)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/40 group transition-colors"
              data-testid={`missing-field-${f.key}`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                <span className="text-sm text-slate-700 truncate">{f.label}</span>
              </span>
              <Edit3 className="h-3.5 w-3.5 text-gray-400 group-hover:text-indigo-500 shrink-0" />
            </button>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onCopy}
        className="w-full rounded-lg border-indigo-200 text-indigo-700 hover:bg-indigo-50"
        data-testid="button-copy-missing-list"
      >
        {justCopied ? (
          <>
            <Check className="h-3.5 w-3.5 mr-1.5" />
            Copiato
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            Copia elenco per il cliente
          </>
        )}
      </Button>
    </div>
  );
}
