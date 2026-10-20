import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

/**
 * Link "informativa sulla privacy" della pagina di firma. L'informativa è
 * quella dell'azienda che manda il contratto (titolare del trattamento):
 * testo in una finestra e/o link esterno, come impostato in Impostazioni
 * Azienda. Senza informativa impostata resta testo semplice.
 */
export default function PrivacyPolicyLink({
  companyName,
  text,
  url,
}: {
  companyName?: string | null;
  text?: string | null;
  url?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const policyText = (text || "").trim();
  const policyUrl = (url || "").trim();
  const label = "informativa sulla privacy";

  if (!policyText && !policyUrl) return <span>{label}</span>;

  if (!policyText) {
    return (
      <a
        href={policyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 text-gray-900 hover:text-black"
        onClick={(e) => e.stopPropagation()}
        data-testid="link-privacy-policy"
      >
        {label}
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        className="underline underline-offset-2 text-gray-900 hover:text-black font-medium"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        data-testid="button-privacy-policy"
      >
        {label}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Informativa sulla privacy</DialogTitle>
            {companyName ? (
              <DialogDescription>Titolare del trattamento: {companyName}</DialogDescription>
            ) : null}
          </DialogHeader>
          <div
            className="overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-gray-700 pr-1"
            data-testid="text-privacy-policy"
          >
            {policyText}
          </div>
          {policyUrl ? (
            <a
              href={policyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm underline underline-offset-2 text-gray-900"
            >
              Apri l'informativa completa
            </a>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
