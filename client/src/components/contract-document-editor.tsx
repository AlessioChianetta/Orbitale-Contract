import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Save,
  X,
  Undo,
  Redo,
  FileEdit,
  AlertTriangle,
} from "lucide-react";
import { type Contract } from "@shared/schema";

interface ContractDocumentEditorProps {
  contract: Contract;
  open: boolean;
  onClose: () => void;
}

export default function ContractDocumentEditor({
  contract,
  open,
  onClose,
}: ContractDocumentEditorProps) {
  const { toast } = useToast();
  const editorRef = useRef<HTMLDivElement>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("PATCH", `/api/contracts/${contract.id}/content`, { content });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "Documento salvato", description: "Le modifiche sono state salvate con successo." });
      setIsDirty(false);
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile salvare il documento.", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (open && editorRef.current) {
      editorRef.current.innerHTML = contract.generatedContent || "";
      setIsDirty(false);
    }
  }, [open, contract.generatedContent]);

  const execCmd = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  }, []);

  const handleInput = useCallback(() => {
    setIsDirty(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!editorRef.current) return;
    saveMutation.mutate(editorRef.current.innerHTML);
  }, [saveMutation]);

  const handleClose = useCallback(() => {
    if (isDirty) {
      setConfirmClose(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  const handleForceClose = useCallback(() => {
    setConfirmClose(false);
    setIsDirty(false);
    onClose();
  }, [onClose]);

  const toolbarBtn = (
    icon: React.ReactNode,
    command: string,
    title: string,
    value?: string
  ) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        execCmd(command, value);
      }}
      className="p-1.5 rounded hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-colors"
    >
      {icon}
    </button>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
        <DialogContent className="max-w-[95vw] w-[1100px] max-h-[95vh] h-[95vh] p-0 gap-0 flex flex-col rounded-2xl overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b bg-white shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileEdit className="h-5 w-5 text-indigo-600" />
                <div>
                  <DialogTitle className="text-base font-semibold text-slate-900">
                    Modifica documento
                  </DialogTitle>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {(contract.clientData as any)?.societa || "Contratto"} — modifica solo questo contratto
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isDirty && (
                  <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                    Modifiche non salvate
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClose}
                  className="rounded-xl"
                >
                  <X className="h-4 w-4 mr-1.5" />
                  Chiudi
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saveMutation.isPending || !isDirty}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <Save className="h-4 w-4 mr-1.5" />
                  {saveMutation.isPending ? "Salvataggio…" : "Salva"}
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Toolbar */}
          <div className="flex items-center gap-0.5 px-4 py-2 border-b bg-slate-50 shrink-0 flex-wrap">
            {toolbarBtn(<Undo className="h-4 w-4" />, "undo", "Annulla")}
            {toolbarBtn(<Redo className="h-4 w-4" />, "redo", "Ripristina")}
            <div className="w-px h-5 bg-slate-200 mx-1" />
            {toolbarBtn(<Bold className="h-4 w-4" />, "bold", "Grassetto")}
            {toolbarBtn(<Italic className="h-4 w-4" />, "italic", "Corsivo")}
            {toolbarBtn(<Underline className="h-4 w-4" />, "underline", "Sottolineato")}
            <div className="w-px h-5 bg-slate-200 mx-1" />
            {toolbarBtn(<AlignLeft className="h-4 w-4" />, "justifyLeft", "Allinea a sinistra")}
            {toolbarBtn(<AlignCenter className="h-4 w-4" />, "justifyCenter", "Centra")}
            {toolbarBtn(<AlignRight className="h-4 w-4" />, "justifyRight", "Allinea a destra")}
            <div className="w-px h-5 bg-slate-200 mx-1" />
            {toolbarBtn(<List className="h-4 w-4" />, "insertUnorderedList", "Elenco puntato")}
            {toolbarBtn(<ListOrdered className="h-4 w-4" />, "insertOrderedList", "Elenco numerato")}
            <div className="flex-1" />
            <span className="text-[11px] text-slate-400 pr-1">
              Modifica direttamente il testo nel documento
            </span>
          </div>

          {/* Editable document */}
          <div className="flex-1 overflow-auto bg-slate-100 p-6">
            <div className="max-w-[860px] mx-auto bg-white shadow-md rounded-lg overflow-hidden">
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleInput}
                className="outline-none min-h-[800px] p-2"
                style={{ fontFamily: "inherit" }}
                spellCheck={false}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm close dialog */}
      <Dialog open={confirmClose} onOpenChange={setConfirmClose}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
              Modifiche non salvate
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 mt-2">
            Hai delle modifiche non salvate. Se chiudi ora le perderai. Vuoi continuare?
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setConfirmClose(false)}>
              Annulla
            </Button>
            <Button size="sm" className="rounded-xl bg-red-600 hover:bg-red-700 text-white" onClick={handleForceClose}>
              Chiudi senza salvare
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
