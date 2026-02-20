import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertContractTemplateSchema } from "@shared/schema";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Save,
  X,
  FileText,
  Settings,
  Gift,
  Euro,
  Sparkles,
  Bold,
  Italic,
  List,
  Pilcrow,
  Eye,
  Code,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import BonusManager from "./bonus-manager";
import AiContractChat from "./ai-contract-chat";
import AiContractWizard from "./ai-contract-wizard";

const templateFormSchema = insertContractTemplateSchema.omit({ createdBy: true });
type TemplateForm = z.infer<typeof templateFormSchema>;

interface TemplateEditorProps {
  template?: any;
  onClose: () => void;
}

function HtmlToolbar({
  fieldId,
  fieldName,
  form,
  disabled,
}: {
  fieldId: string;
  fieldName: "customContent" | "paymentText" | "content";
  form: any;
  disabled: boolean;
}) {
  const insertTag = (openTag: string, closeTag: string, placeholder: string) => {
    const textarea = document.getElementById(fieldId) as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentValue = form.getValues(fieldName) || "";
    const selectedText = currentValue.substring(start, end);
    const newText =
      currentValue.substring(0, start) +
      `${openTag}${selectedText || placeholder}${closeTag}` +
      currentValue.substring(end);
    form.setValue(fieldName, newText);
  };

  const appendText = (text: string) => {
    const currentValue = form.getValues(fieldName) || "";
    form.setValue(fieldName, currentValue + text);
  };

  return (
    <div className="border-b border-[#E5E7EB]/60 px-3 py-2 bg-[#FAFBFC] flex items-center gap-1 flex-wrap">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => insertTag("<strong>", "</strong>", "testo")}
        disabled={disabled}
        className="h-7 w-7 p-0 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-all duration-200"
        title="Grassetto"
      >
        <Bold className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => insertTag("<em>", "</em>", "testo")}
        disabled={disabled}
        className="h-7 w-7 p-0 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-all duration-200"
        title="Corsivo"
      >
        <Italic className="h-3.5 w-3.5" />
      </Button>
      <div className="w-px h-4 bg-[#E5E7EB]/60 mx-1" />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() =>
          appendText("\n<ul>\n  <li>Elemento</li>\n</ul>\n")
        }
        disabled={disabled}
        className="h-7 px-2 text-xs rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-all duration-200"
        title="Lista"
      >
        <List className="h-3.5 w-3.5 mr-1" />
        Lista
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => appendText("\n<p>Nuovo paragrafo</p>\n")}
        disabled={disabled}
        className="h-7 px-2 text-xs rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-all duration-200"
        title="Paragrafo"
      >
        <Pilcrow className="h-3.5 w-3.5 mr-1" />
        Paragrafo
      </Button>
    </div>
  );
}

function HtmlEditorWithPreview({
  fieldId,
  fieldName,
  form,
  disabled,
  rows = 8,
  placeholder,
}: {
  fieldId: string;
  fieldName: "customContent" | "paymentText" | "content";
  form: any;
  disabled: boolean;
  rows?: number;
  placeholder?: string;
}) {
  const [showPreview, setShowPreview] = useState(false);
  const value = form.watch(fieldName) || "";

  return (
    <div className="border border-[#E5E7EB]/60 rounded-2xl overflow-hidden bg-[#FCFCFD] shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between">
        <HtmlToolbar fieldId={fieldId} fieldName={fieldName} form={form} disabled={disabled} />
        <div className="pr-3 flex items-center gap-1">
          <div className="flex items-center bg-[#F1F5F9] rounded-full p-0.5">
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              className={`flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full transition-all duration-200 ${
                !showPreview
                  ? "bg-white text-[#0F172A] shadow-sm"
                  : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              <Code className="h-3 w-3" />
              Codice
            </button>
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className={`flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full transition-all duration-200 ${
                showPreview
                  ? "bg-white text-[#0F172A] shadow-sm"
                  : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              <Eye className="h-3 w-3" />
              Anteprima
            </button>
          </div>
        </div>
      </div>
      {showPreview ? (
        <div className="p-5 min-h-[200px] prose prose-sm max-w-none">
          {value ? (
            <div dangerouslySetInnerHTML={{ __html: value }} />
          ) : (
            <p className="text-[#94A3B8] italic">Nessun contenuto da visualizzare</p>
          )}
        </div>
      ) : (
        <Textarea
          id={fieldId}
          {...form.register(fieldName)}
          rows={rows}
          placeholder={placeholder}
          className="border-0 rounded-none resize-none font-mono text-sm focus-visible:ring-0 focus-visible:ring-offset-0 bg-[#FCFCFD] text-[#0F172A]"
          disabled={disabled}
        />
      )}
    </div>
  );
}

function VariablePill({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="group inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#E5E7EB]/80 rounded-full text-xs font-medium text-[#475569] hover:border-[#4F46E5]/30 hover:text-[#4F46E5] hover:shadow-sm transition-all duration-200 cursor-pointer"
    >
      <code className="text-[11px]">{code}</code>
      <span className="text-[#94A3B8]">·</span>
      <span className="text-[10px] text-[#94A3B8] group-hover:text-[#4F46E5]/60">{label}</span>
      {copied && (
        <CheckCircle className="h-3 w-3 text-[#059669] ml-0.5" />
      )}
    </button>
  );
}

export default function TemplateEditor({ template, onClose }: TemplateEditorProps) {
  const { toast } = useToast();
  const isEditing = !!template;
  const [activeTab, setActiveTab] = useState("info");
  const [aiTab, setAiTab] = useState("wizard");

  const form = useForm<TemplateForm>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: template?.name || "",
      description: template?.description || "",
      content:
        template?.content ||
        `<div class="contract-content">

<h2>TERMINI E CONDIZIONI</h2>
<p>Il presente contratto è regolato dalla legge italiana...</p>
</div>`,
      customContent:
        template?.customContent ||
        `Il presente contratto include una serie di bonus esclusivi e servizi di valore aggiunto che potenziano significativamente l'offerta base, garantendo al cliente un pacchetto completo e una strategia di crescita personalizzata per massimizzare i risultati dell'investimento.

Tutti i bonus inclusi sono stati progettati per eliminare le principali barriere che impediscono ai clienti di ottenere risultati immediati: mancanza di tempo, complessità tecnologica, incertezza sui risultati e necessità di supporto continuo. L'obiettivo è garantire un percorso di crescita guidato, sicuro e misurabile fin dal primo giorno.`,
      paymentText:
        template?.paymentText ||
        `<p>Il pagamento sarà corrisposto mediante modalità che il Cliente/Committente avrà cura di accendere come soluzione sottoscritta nel contratto con conseguente pagamento dell'indicato importo secondo il piano prestabilito.</p>

<p><strong>Modalità di pagamento:</strong></p>
<ul>
  <li>Pagamento in unica soluzione</li>
  <li>Pagamento rateale secondo il piano concordato</li>
</ul>

<p><em>Resta inteso che in caso di inerzia del Cliente potrà essere emesso un rimborso entro 30 giorni dalla firma del contratto e avvenuto pagamento.</em></p>`,
      isActive: template?.isActive ?? true,
      predefinedBonuses: template?.predefinedBonuses || [],
      paymentOptions: template?.paymentOptions || {
        allowInstallments: true,
        maxInstallments: 36,
        paymentFrequencies: ["monthly", "quarterly", "annual"],
      },
    },
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async (data: TemplateForm) => {
      const url = isEditing ? `/api/templates/${template.id}` : "/api/templates";
      const method = isEditing ? "PUT" : "POST";
      return await apiRequest(method, url, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({
        title: isEditing ? "Template aggiornato" : "Template creato",
        description: "Le modifiche sono state salvate con successo",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Errore nel salvataggio",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: TemplateForm) => {
    saveTemplateMutation.mutate(data);
  };

  const handleAiContractGenerated = (data: {
    content: string;
    customContent: string;
    paymentText: string;
    bonuses: any[];
    suggestedName?: string;
  }) => {
    if (data.content) form.setValue("content", data.content);
    if (data.customContent) form.setValue("customContent", data.customContent);
    if (data.paymentText) form.setValue("paymentText", data.paymentText);
    if (data.bonuses && data.bonuses.length > 0) {
      form.setValue("predefinedBonuses", data.bonuses);
    }
    if (data.suggestedName && !form.getValues("name")) {
      form.setValue("name", data.suggestedName);
    }
    toast({
      title: "Contratto AI applicato",
      description:
        "Il contenuto generato dall'AI è stato inserito nel template. Rivedi e personalizza prima di salvare.",
    });
    setActiveTab("content");
  };

  const isPending = saveTemplateMutation.isPending;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] overflow-hidden flex flex-col p-0 rounded-[20px] shadow-[0_20px_60px_rgba(0,0,0,0.08)] border-0 bg-white gap-0">
        <DialogHeader className="px-8 pt-7 pb-5 border-b border-[#F1F5F9]">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-semibold text-[#0F172A] tracking-tight">
                {isEditing ? "Modifica Template" : "Nuovo Template"}
              </DialogTitle>
              <DialogDescription className="mt-1.5 text-[#64748B] text-sm">
                {isEditing
                  ? "Modifica il template di contratto esistente"
                  : "Crea un nuovo template con l'aiuto dell'intelligenza artificiale"}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-3">
              {form.watch("isActive") ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#ECFDF5] text-[#059669]">
                  <CheckCircle className="h-3 w-3" />
                  Attivo
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#FEF2F2] text-[#DC2626]">
                  <AlertCircle className="h-3 w-3" />
                  Disattivato
                </span>
              )}
              <button
                type="button"
                onClick={() => onClose()}
                className="p-2 rounded-xl text-[#94A3B8] hover:text-[#64748B] hover:bg-[#F8FAFC] transition-all duration-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <div className="flex-1 flex overflow-hidden">
            {/* AI SIDEBAR - LEFT */}
            <div className="w-[380px] min-w-[380px] bg-[#F8F9FC] border-r border-[#E5E7EB]/50 flex flex-col overflow-hidden">
              <div className="px-5 pt-5 pb-3">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="p-1.5 bg-gradient-to-br from-[#4F46E5]/10 to-[#7C3AED]/10 rounded-lg">
                    <Sparkles className="h-4 w-4 text-[#4F46E5]" />
                  </div>
                  <h3 className="text-sm font-semibold text-[#0F172A]">Assistente AI</h3>
                </div>
                <div className="flex items-center bg-[#EEEEF4] rounded-full p-0.5">
                  <button
                    type="button"
                    onClick={() => setAiTab("wizard")}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
                      aiTab === "wizard"
                        ? "bg-white text-[#0F172A] shadow-sm"
                        : "text-[#64748B] hover:text-[#0F172A]"
                    }`}
                  >
                    <Sparkles className="h-3 w-3" />
                    Creazione Guidata
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiTab("chat")}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-all duration-200 ${
                      aiTab === "chat"
                        ? "bg-white text-[#0F172A] shadow-sm"
                        : "text-[#64748B] hover:text-[#0F172A]"
                    }`}
                  >
                    <FileText className="h-3 w-3" />
                    Chat Consulenza
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 pb-4">
                {aiTab === "wizard" ? (
                  <AiContractWizard onContractGenerated={handleAiContractGenerated} />
                ) : (
                  <AiContractChat
                    onInsertContent={(text) => {
                      const current = form.getValues("customContent") || "";
                      form.setValue("customContent", current ? current + "\n\n" + text : text);
                      toast({
                        title: "Testo inserito",
                        description: "Il suggerimento AI è stato aggiunto al contenuto introduttivo.",
                      });
                    }}
                    onInsertPaymentText={(text) => {
                      form.setValue("paymentText", text);
                      toast({
                        title: "Termini di pagamento aggiornati",
                        description: "Il testo AI è stato inserito nei termini di pagamento.",
                      });
                    }}
                    onInsertBonuses={(bonuses) => {
                      const current = (form.getValues("predefinedBonuses") as any[]) || [];
                      form.setValue("predefinedBonuses", [...current, ...bonuses] as any);
                      toast({
                        title: "Bonus aggiunti",
                        description: `${bonuses.length} bonus sono stati aggiunti al template.`,
                      });
                    }}
                  />
                )}
              </div>
            </div>

            {/* MAIN EDITOR - RIGHT */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="flex-1 flex flex-col overflow-hidden"
              >
                <div className="px-8 pt-5 pb-0">
                  <div className="inline-flex items-center bg-[#F1F5F9] rounded-full p-1">
                    <TabsList className="bg-transparent h-auto p-0 gap-0.5">
                      <TabsTrigger
                        value="info"
                        className="rounded-full px-4 py-2 text-xs font-medium data-[state=active]:bg-white data-[state=active]:text-[#0F172A] data-[state=active]:shadow-sm data-[state=inactive]:text-[#64748B] data-[state=inactive]:bg-transparent data-[state=inactive]:shadow-none border-0 transition-all duration-200"
                      >
                        <Settings className="h-3.5 w-3.5 mr-1.5" />
                        Info
                      </TabsTrigger>
                      <TabsTrigger
                        value="content"
                        className="rounded-full px-4 py-2 text-xs font-medium data-[state=active]:bg-white data-[state=active]:text-[#0F172A] data-[state=active]:shadow-sm data-[state=inactive]:text-[#64748B] data-[state=inactive]:bg-transparent data-[state=inactive]:shadow-none border-0 transition-all duration-200"
                      >
                        <FileText className="h-3.5 w-3.5 mr-1.5" />
                        Contenuto
                      </TabsTrigger>
                      <TabsTrigger
                        value="bonuspay"
                        className="rounded-full px-4 py-2 text-xs font-medium data-[state=active]:bg-white data-[state=active]:text-[#0F172A] data-[state=active]:shadow-sm data-[state=inactive]:text-[#64748B] data-[state=inactive]:bg-transparent data-[state=inactive]:shadow-none border-0 transition-all duration-200"
                      >
                        <Gift className="h-3.5 w-3.5 mr-1.5" />
                        Bonus & Pagamento
                      </TabsTrigger>
                    </TabsList>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-8 py-6">
                  <TabsContent value="info" className="mt-0 space-y-6">
                    <div className="rounded-2xl border border-[#E5E7EB]/60 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                      <h3 className="text-base font-semibold text-[#0F172A] mb-5 flex items-center gap-2">
                        <Settings className="h-4 w-4 text-[#64748B]" />
                        Configurazione Base
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <Label htmlFor="name" className="text-[#0F172A] text-sm font-medium">Nome Template *</Label>
                          <Input
                            id="name"
                            {...form.register("name")}
                            placeholder="es. MASTERCLASS FINANZIAMENTO"
                            disabled={isPending}
                            className="rounded-xl border-[#E5E7EB] focus:ring-[#4F46E5]/20 focus:border-[#4F46E5] transition-all duration-200"
                          />
                          {form.formState.errors.name && (
                            <p className="text-sm text-red-500">
                              {form.formState.errors.name.message}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="description" className="text-[#0F172A] text-sm font-medium">Descrizione</Label>
                          <Input
                            id="description"
                            {...form.register("description")}
                            placeholder="Breve descrizione del template"
                            disabled={isPending}
                            className="rounded-xl border-[#E5E7EB] focus:ring-[#4F46E5]/20 focus:border-[#4F46E5] transition-all duration-200"
                          />
                        </div>
                      </div>
                      <div className="h-px bg-[#F1F5F9] my-5" />
                      <div className="flex items-center justify-between p-4 bg-[#FAFBFC] rounded-xl border border-[#E5E7EB]/40">
                        <div>
                          <Label htmlFor="isActive" className="text-sm font-medium text-[#0F172A]">
                            Stato Template
                          </Label>
                          <p className="text-xs text-[#94A3B8] mt-1">
                            I template disattivati non saranno disponibili per la creazione di nuovi
                            contratti
                          </p>
                        </div>
                        <Switch
                          id="isActive"
                          checked={form.watch("isActive") ?? true}
                          onCheckedChange={(checked) => form.setValue("isActive", checked)}
                          disabled={isPending}
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="content" className="mt-0 space-y-8">
                    <div className="rounded-2xl border border-[#E5E7EB]/60 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                      <h3 className="text-base font-semibold text-[#0F172A] mb-1 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-[#64748B]" />
                        Contenuto Introduttivo
                      </h3>
                      <p className="text-sm text-[#94A3B8] mb-4">
                        Questo testo apparirà nel contratto prima della sezione dei bonus. Supporta
                        formattazione HTML.
                      </p>
                      <HtmlEditorWithPreview
                        fieldId="customContent"
                        fieldName="customContent"
                        form={form}
                        disabled={isPending}
                        rows={8}
                        placeholder="Descrivi i servizi e i vantaggi inclusi nel contratto..."
                      />
                    </div>

                    <div className="rounded-2xl border border-[#E5E7EB]/60 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-base font-semibold text-[#0F172A] flex items-center gap-2">
                          <Code className="h-4 w-4 text-[#64748B]" />
                          Corpo del Contratto
                        </h3>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#FEF2F2] text-[#DC2626] uppercase tracking-wide">
                          Obbligatorio
                        </span>
                      </div>

                      <div className="mt-4 mb-5 p-4 bg-[#F8FAFC] border border-[#E5E7EB]/50 rounded-xl">
                        <p className="text-xs font-medium text-[#475569] mb-3">
                          Variabili disponibili
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <VariablePill code={"{{societa}}"} label="Nome società" />
                          <VariablePill code={"{{cliente_nome}}"} label="Nome cliente" />
                          <VariablePill code={"{{p_iva}}"} label="P.IVA" />
                          <VariablePill code={"{{sede}}"} label="Sede legale" />
                        </div>
                        <p className="mt-3 text-[11px] text-[#94A3B8]">
                          Blocchi ripetibili:{" "}
                          <code className="text-[#64748B] bg-white px-1.5 py-0.5 rounded border border-[#E5E7EB]/60 text-[10px]">
                            {"<!-- BLOCK:BONUS_LIST -->...<!-- END_BLOCK:BONUS_LIST -->"}
                          </code>
                        </p>
                      </div>

                      <HtmlEditorWithPreview
                        fieldId="content"
                        fieldName="content"
                        form={form}
                        disabled={isPending}
                        rows={22}
                        placeholder="Inserisci il corpo principale del contratto con variabili e blocchi..."
                      />
                      {form.formState.errors.content && (
                        <p className="text-sm text-red-500 mt-2">
                          {form.formState.errors.content.message}
                        </p>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="bonuspay" className="mt-0 space-y-8">
                    <div className="rounded-2xl border border-[#E5E7EB]/60 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                      <h3 className="text-base font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
                        <Gift className="h-4 w-4 text-[#64748B]" />
                        Bonus Predefiniti
                      </h3>
                      <BonusManager
                        bonuses={(form.watch("predefinedBonuses") as any[]) || []}
                        onChange={(bonuses) => form.setValue("predefinedBonuses", bonuses as any)}
                        disabled={isPending}
                      />
                    </div>

                    <div className="rounded-2xl border border-[#E5E7EB]/60 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                      <h3 className="text-base font-semibold text-[#0F172A] mb-1 flex items-center gap-2">
                        <Euro className="h-4 w-4 text-[#64748B]" />
                        Termini di Pagamento
                      </h3>
                      <p className="text-sm text-[#94A3B8] mb-4">
                        Personalizza i termini di pagamento che appariranno nel contratto. Supporta
                        formattazione HTML.
                      </p>
                      <HtmlEditorWithPreview
                        fieldId="paymentText"
                        fieldName="paymentText"
                        form={form}
                        disabled={isPending}
                        rows={8}
                        placeholder="Inserisci i termini di pagamento..."
                      />
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            </div>
          </div>

          {/* FOOTER */}
          <div className="px-8 py-4 border-t border-[#F1F5F9] bg-white flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isPending}
              className="text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] rounded-xl px-5 transition-all duration-200"
            >
              Annulla
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] hover:from-[#4338CA] hover:to-[#6D28D9] text-white rounded-xl px-6 py-2.5 shadow-[0_4px_14px_rgba(79,70,229,0.3)] hover:shadow-[0_6px_20px_rgba(79,70,229,0.4)] hover:-translate-y-0.5 transition-all duration-200 font-medium"
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Salvataggio...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  {isEditing ? "Aggiorna Template" : "Crea Template"}
                </span>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
