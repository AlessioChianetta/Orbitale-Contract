import { useCallback, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
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
  const [confirmClose, setConfirmClose] = useState(false);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ history: { depth: 100 } }),
        Underline,
        TextAlign.configure({ types: ["heading", "paragraph"] }),
      ],
      content: contract.generatedContent || "",
      editorProps: {
        attributes: {
          class:
            "prose prose-sm sm:prose max-w-none outline-none min-h-[800px] p-6 focus:outline-none",
        },
      },
    },
    [contract.id]
  );

  const isDirty = editor ? !editor.isEmpty && editor.isEditable : false;

  const saveMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("PATCH", `/api/contracts/${contract.id}/content`, {
        content,
      });
      return res.json();
    },
    onSuccess: (data: { message?: string; pdfRegenerated?: boolean; pdfError?: string | null }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
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

  const handleSave = useCallback(() => {
    if (!editor) return;
    saveMutation.mutate(editor.getHTML());
  }, [editor, saveMutation]);

  const handleClose = useCallback(() => {
    if (editor?.isEditable && !saveMutation.isIdle) return;
    setConfirmClose(true);
  }, [editor, saveMutation.isIdle]);

  const handleForceClose = useCallback(() => {
    setConfirmClose(false);
    onClose();
  }, [onClose]);

  const toolbarBtn = (
    icon: React.ReactNode,
    onClick: () => void,
    title: string,
    isActive?: boolean
  ) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`p-1.5 rounded transition-colors ${
        isActive
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
          if (!o) setConfirmClose(true);
        }}
      >
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
                    {(contract.clientData as Record<string, unknown>)?.societa as string ||
                      "Contratto"}{" "}
                    — le modifiche si applicano solo a questo contratto
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmClose(true)}
                  className="rounded-xl"
                >
                  <X className="h-4 w-4 mr-1.5" />
                  Chiudi
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
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

          {/* Editor area */}
          <div className="flex-1 overflow-auto bg-slate-100 py-6 px-4">
            <div className="max-w-[860px] mx-auto bg-white shadow-md rounded-lg overflow-hidden">
              <EditorContent editor={editor} />
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
              Chiudere l'editor?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 mt-2">
            Eventuali modifiche non salvate andranno perse. Vuoi continuare?
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
