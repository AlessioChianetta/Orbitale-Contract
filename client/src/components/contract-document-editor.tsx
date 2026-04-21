import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
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
  Underline as UnderlineIcon,
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
  Eye,
  Pencil,
} from "lucide-react";
import { type Contract } from "@shared/schema";

interface ContractDocumentEditorProps {
  contract: Contract;
  open: boolean;
  onClose: () => void;
}

const PREVIEW_BODY_CLASS =
  "text-sm text-slate-700 leading-relaxed custom-content-section " +
  "[&_p]:mb-4 [&_p]:leading-relaxed " +
  "[&_ul]:my-4 [&_ul]:pl-6 [&_ul]:list-disc " +
  "[&_ol]:my-4 [&_ol]:pl-6 [&_ol]:list-decimal " +
  "[&_li]:mb-2 " +
  "[&_strong]:font-semibold [&_strong]:text-slate-900 " +
  "[&_em]:italic " +
  "[&_u]:underline " +
  "[&_h1]:text-xl [&_h1]:font-bold [&_h1]:my-5 [&_h1]:text-slate-900 " +
  "[&_h2]:text-lg [&_h2]:font-bold [&_h2]:my-4 [&_h2]:text-slate-900 " +
  "[&_h3]:text-base [&_h3]:font-bold [&_h3]:my-3 [&_h3]:text-slate-900";

export default function ContractDocumentEditor({
  contract,
  open,
  onClose,
}: ContractDocumentEditorProps) {
  const { toast } = useToast();
  const [confirmClose, setConfirmClose] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const lastSyncedContentRef = useRef<string | null>(null);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ history: { depth: 100 } }),
        TextAlign.configure({ types: ["heading", "paragraph"] }),
      ],
      content: contract.generatedContent || "",
      onUpdate: () => {
        setIsDirty(true);
      },
      editorProps: {
        attributes: {
          class:
            "prose prose-sm sm:prose max-w-none outline-none min-h-[800px] p-6 focus:outline-none",
        },
      },
    },
    [contract.id]
  );

  // Sync editor with the latest contract content whenever it changes externally
  // (after a successful save the parent re-renders with the fresh DB content,
  // or when the same dialog is reopened on a contract whose content was updated
  // elsewhere). We only force-sync if the editor isn't currently dirty so we
  // never wipe an unsaved edit that the user is actively typing.
  useEffect(() => {
    if (!editor) return;
    const incoming = contract.generatedContent || "";
    if (lastSyncedContentRef.current === incoming) return;
    if (isDirty) return;
    editor.commands.setContent(incoming, { emitUpdate: false });
    lastSyncedContentRef.current = incoming;
  }, [editor, contract.generatedContent, isDirty]);

  const saveMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("PATCH", `/api/contracts/${contract.id}/content`, {
        content,
      });
      return res.json();
    },
    onSuccess: (data: { message?: string; pdfRegenerated?: boolean; pdfError?: string | null }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      setIsDirty(false);
      if (data.pdfError) {
        toast({
          title: "Documento salvato",
          description: `Le modifiche sono state salvate. Rigenerazione PDF non riuscita: ${data.pdfError}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Documento salvato",
          description: data.pdfRegenerated
            ? "Il documento e il PDF sono stati aggiornati con successo."
            : "Le modifiche sono state salvate con successo.",
        });
      }
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile salvare il documento.",
        variant: "destructive",
      });
    },
  });

  const requestSave = useCallback(() => {
    if (!editor) return;
    setConfirmSave(true);
  }, [editor]);

  const handleSave = useCallback(() => {
    if (!editor) return;
    setConfirmSave(false);
    saveMutation.mutate(editor.getHTML());
  }, [editor, saveMutation]);

  const handleClose = useCallback(() => {
    if (isDirty) {
      setConfirmClose(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  const handleForceClose = useCallback(() => {
    setConfirmClose(false);
    setIsPreview(false);
    onClose();
  }, [onClose]);

  const togglePreview = useCallback(() => {
    if (!editor) return;
    if (!isPreview) {
      setPreviewHtml(editor.getHTML());
      setIsPreview(true);
    } else {
      setIsPreview(false);
    }
  }, [editor, isPreview]);

  const toolbarBtn = (
    icon: React.ReactNode,
    onClick: () => void,
    title: string,
    isActive?: boolean,
    disabled?: boolean
  ) => (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onMouseDown={(e) => {
        e.preventDefault();
        if (!disabled) onClick();
      }}
      className={`p-1.5 rounded transition-colors ${
        disabled
          ? "text-slate-300 cursor-not-allowed"
          : isActive
          ? "bg-indigo-100 text-indigo-700"
          : "hover:bg-slate-100 text-slate-600 hover:text-slate-900"
      }`}
    >
      {icon}
    </button>
  );

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) handleClose();
        }}
      >
        <DialogContent className="max-w-[95vw] w-[1100px] max-h-[95vh] h-[95vh] p-0 gap-0 flex flex-col rounded-2xl overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b bg-white shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileEdit className="h-5 w-5 text-indigo-600" />
                <div>
                  <DialogTitle className="text-base font-semibold text-slate-900">
                    {isPreview ? "Anteprima documento" : "Modifica documento"}
                  </DialogTitle>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {(contract.clientData as Record<string, unknown>)?.societa as string ||
                      "Contratto"}{" "}
                    — {isPreview
                      ? "stai vedendo come apparirà il documento finale"
                      : "le modifiche si applicano solo a questo contratto"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={togglePreview}
                  className="rounded-xl"
                  data-testid="button-toggle-preview"
                >
                  {isPreview ? (
                    <>
                      <Pencil className="h-4 w-4 mr-1.5" />
                      Torna a modifica
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4 mr-1.5" />
                      Anteprima
                    </>
                  )}
                </Button>
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
                  onClick={requestSave}
                  disabled={saveMutation.isPending || isPreview || !isDirty}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
                  title={
                    isPreview
                      ? "Torna in modalità modifica per confermare"
                      : !isDirty
                      ? "Nessuna modifica da applicare"
                      : undefined
                  }
                >
                  <Save className="h-4 w-4 mr-1.5" />
                  {saveMutation.isPending ? "Applicazione…" : "Conferma e applica"}
                </Button>
              </div>
            </div>
          </DialogHeader>

          {/* Toolbar (only in edit mode) */}
          {!isPreview && (
            <div className="flex items-center gap-0.5 px-4 py-2 border-b bg-slate-50 shrink-0 flex-wrap">
              {toolbarBtn(
                <Undo className="h-4 w-4" />,
                () => editor?.chain().focus().undo().run(),
                "Annulla"
              )}
              {toolbarBtn(
                <Redo className="h-4 w-4" />,
                () => editor?.chain().focus().redo().run(),
                "Ripristina"
              )}
              <div className="w-px h-5 bg-slate-200 mx-1" />
              {toolbarBtn(
                <Bold className="h-4 w-4" />,
                () => editor?.chain().focus().toggleBold().run(),
                "Grassetto",
                editor?.isActive("bold")
              )}
              {toolbarBtn(
                <Italic className="h-4 w-4" />,
                () => editor?.chain().focus().toggleItalic().run(),
                "Corsivo",
                editor?.isActive("italic")
              )}
              {toolbarBtn(
                <UnderlineIcon className="h-4 w-4" />,
                () => editor?.chain().focus().toggleUnderline().run(),
                "Sottolineato",
                editor?.isActive("underline")
              )}
              <div className="w-px h-5 bg-slate-200 mx-1" />
              {toolbarBtn(
                <AlignLeft className="h-4 w-4" />,
                () => editor?.chain().focus().setTextAlign("left").run(),
                "Allinea a sinistra",
                editor?.isActive({ textAlign: "left" })
              )}
              {toolbarBtn(
                <AlignCenter className="h-4 w-4" />,
                () => editor?.chain().focus().setTextAlign("center").run(),
                "Centra",
                editor?.isActive({ textAlign: "center" })
              )}
              {toolbarBtn(
                <AlignRight className="h-4 w-4" />,
                () => editor?.chain().focus().setTextAlign("right").run(),
                "Allinea a destra",
                editor?.isActive({ textAlign: "right" })
              )}
              <div className="w-px h-5 bg-slate-200 mx-1" />
              {toolbarBtn(
                <List className="h-4 w-4" />,
                () => editor?.chain().focus().toggleBulletList().run(),
                "Elenco puntato",
                editor?.isActive("bulletList")
              )}
              {toolbarBtn(
                <ListOrdered className="h-4 w-4" />,
                () => editor?.chain().focus().toggleOrderedList().run(),
                "Elenco numerato",
                editor?.isActive("orderedList")
              )}
              <div className="flex-1" />
              {contract.contentManuallyEdited && (
                <span className="text-[11px] text-violet-600 font-medium flex items-center gap-1 pr-1">
                  <FileEdit className="h-3 w-3" />
                  Documento modificato manualmente
                </span>
              )}
            </div>
          )}

          {/* Preview info bar */}
          {isPreview && (
            <div className="flex items-center gap-2 px-4 py-2 border-b bg-amber-50 text-amber-800 shrink-0 text-xs">
              <Eye className="h-3.5 w-3.5" />
              Anteprima del documento finale. Le modifiche non sono ancora state confermate — torna in modifica per continuare o usa "Conferma e applica".
            </div>
          )}

          {/* Client_fill incomplete warning */}
          {!isPreview && (contract as any).fillMode === "client_fill" &&
            contract.status !== "viewed" && contract.status !== "signed" && (
              <div className="flex items-start gap-2 px-4 py-2 border-b bg-sky-50 text-sky-800 shrink-0 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>
                  Il cliente non ha ancora compilato i propri dati. I segnaposto
                  ancora presenti (es. <code className="px-1 rounded bg-sky-100">{`{{ragione_sociale}}`}</code>,{" "}
                  <code className="px-1 rounded bg-sky-100">{`{{partita_iva}}`}</code>) verranno
                  sostituiti automaticamente quando il cliente completerà il modulo.
                  Le tue modifiche manuali al testo restano intatte.
                </span>
              </div>
            )}

          {/* Content area */}
          <div className="flex-1 overflow-auto bg-slate-100 py-6 px-4">
            <div className="max-w-[860px] mx-auto bg-white shadow-md rounded-lg overflow-hidden">
              {isPreview ? (
                <div className="contract-content px-4 sm:px-8 lg:px-14 py-6 sm:py-10 lg:py-14">
                  <div
                    className={PREVIEW_BODY_CLASS}
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                    data-testid="preview-content"
                  />
                </div>
              ) : (
                <EditorContent editor={editor} />
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm save dialog — esplicita conferma prima di applicare le modifiche live */}
      <Dialog open={confirmSave} onOpenChange={setConfirmSave}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-indigo-700">
              <Save className="h-5 w-5" />
              Confermare le modifiche?
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-slate-600 mt-2 space-y-2">
            <p>
              Stai per applicare le tue modifiche al documento di questo contratto.
              Una volta confermate:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-700">
              <li>Il contratto verrà marcato come <strong>modificato manualmente</strong>.</li>
              <li>
                La nuova versione sarà visibile al cliente al prossimo accesso al link
                {contract.status === "signed" ? " e il PDF firmato verrà rigenerato" : ""}.
              </li>
              {(contract as any).fillMode === "client_fill" &&
                contract.status !== "viewed" &&
                contract.status !== "signed" && (
                  <li>
                    I segnaposto ancora presenti verranno compilati con i dati del cliente
                    quando completerà il modulo, senza toccare il testo che hai modificato.
                  </li>
                )}
            </ul>
            <p className="text-xs text-slate-500 pt-1">
              Il link cliente non cambia. Puoi sempre rimodificare in seguito.
            </p>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => setConfirmSave(false)}
              disabled={saveMutation.isPending}
            >
              Annulla
            </Button>
            <Button
              size="sm"
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={handleSave}
              disabled={saveMutation.isPending}
              data-testid="button-confirm-apply"
            >
              <Save className="h-4 w-4 mr-1.5" />
              {saveMutation.isPending ? "Applicazione…" : "Conferma e applica"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm close dialog */}
      <Dialog open={confirmClose} onOpenChange={setConfirmClose}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
              Chiudere l'editor?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 mt-2">
            Hai modifiche non salvate. Se chiudi adesso andranno perse. Vuoi continuare?
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={() => setConfirmClose(false)}
            >
              Continua a modificare
            </Button>
            <Button
              size="sm"
              className="rounded-xl bg-red-600 hover:bg-red-700 text-white"
              onClick={handleForceClose}
            >
              Chiudi senza salvare
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
