import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Lock, Plus, X } from "lucide-react";
import type { ModularSection } from "@shared/sections";

interface SectionPreviewDialogProps {
  section: ModularSection | null;
  open: boolean;
  isSelected: boolean;
  onClose: () => void;
  onToggle?: (sectionId: string, nextSelected: boolean) => void;
}

export default function SectionPreviewDialog({
  section,
  open,
  isSelected,
  onClose,
  onToggle,
}: SectionPreviewDialogProps) {
  if (!section) return null;
  const required = !!section.required;

  const handleToggle = () => {
    if (!onToggle || required) return;
    onToggle(section.id, !isSelected);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-start gap-2">
            <Eye className="h-5 w-5 text-indigo-600 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-left text-base font-semibold text-slate-900">
                {section.title}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {required && (
                  <Badge variant="outline" className="text-[10px] border-sky-200 text-sky-700 bg-sky-50">
                    <Lock className="h-2.5 w-2.5 mr-1" />
                    Modulo obbligatorio
                  </Badge>
                )}
                {isSelected && !required && (
                  <Badge variant="outline" className="text-[10px] border-emerald-200 text-emerald-700 bg-emerald-50">
                    Incluso
                  </Badge>
                )}
              </div>
              {section.description && (
                <DialogDescription className="text-left text-sm text-slate-600 mt-2">
                  {section.description}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        {required && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Modulo obbligatorio del template: non può essere disattivato.
          </div>
        )}

        <div className="flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-4">
          <div
            className="prose prose-sm max-w-none text-slate-700"
            data-testid={`section-preview-content-${section.id}`}
            dangerouslySetInnerHTML={{
              __html: section.content?.trim()
                ? section.content
                : "<em>Nessun contenuto definito per questo modulo.</em>",
            }}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" onClick={onClose} data-testid="section-preview-close">
            Chiudi
          </Button>
          {onToggle && (
            isSelected ? (
              <Button
                type="button"
                variant="destructive"
                onClick={handleToggle}
                disabled={required}
                title={required ? "Modulo obbligatorio: non può essere disattivato" : undefined}
                data-testid="section-preview-remove"
              >
                <X className="h-4 w-4 mr-1.5" />
                Rimuovi modulo
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleToggle}
                className="bg-indigo-600 hover:bg-indigo-700"
                data-testid="section-preview-add"
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Aggiungi modulo
              </Button>
            )
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
