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
    <div className="border-b border-border p-2 bg-muted/30 rounded-t-lg flex items-center gap-1 flex-wrap">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => insertTag("<strong>", "</strong>", "testo")}
        disabled={disabled}
        className="h-8 w-8 p-0"
        title="Grassetto"
      >
        <Bold className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => insertTag("<em>", "</em>", "testo")}
        disabled={disabled}
        className="h-8 w-8 p-0"
        title="Corsivo"
      >
        <Italic className="h-4 w-4" />
      </Button>
      <Separator orientation="vertical" className="h-6 mx-1" />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() =>
          appendText("\n<ul>\n  <li>Elemento</li>\n</ul>\n")
        }
        disabled={disabled}
        className="h-8 px-2 text-xs"
        title="Lista"
      >
        <List className="h-4 w-4 mr-1" />
        Lista
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => appendText("\n<p>Nuovo paragrafo</p>\n")}
        disabled={disabled}
        className="h-8 px-2 text-xs"
        title="Paragrafo"
      >
        <Pilcrow className="h-4 w-4 mr-1" />
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
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between">
        <HtmlToolbar fieldId={fieldId} fieldName={fieldName} form={form} disabled={disabled} />
        <div className="pr-2 flex gap-1">
          <Button
            type="button"
            variant={!showPreview ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setShowPreview(false)}
            className="h-7 text-xs"
          >
            <Code className="h-3 w-3 mr-1" />
            Codice
          </Button>
          <Button
            type="button"
            variant={showPreview ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setShowPreview(true)}
            className="h-7 text-xs"
          >
            <Eye className="h-3 w-3 mr-1" />
            Anteprima
          </Button>
        </div>
      </div>
      {showPreview ? (
        <div className="p-4 min-h-[200px] prose prose-sm max-w-none">
          {value ? (
            <div dangerouslySetInnerHTML={{ __html: value }} />
          ) : (
            <p className="text-muted-foreground italic">Nessun contenuto da visualizzare</p>
          )}
        </div>
      ) : (
        <Textarea
          id={fieldId}
          {...form.register(fieldName)}
          rows={rows}
          placeholder={placeholder}
          className="border-0 rounded-none rounded-b-lg resize-none font-mono text-sm focus-visible:ring-0"
          disabled={disabled}
        />
      )}
    </div>
  );
}

export default function TemplateEditor({ template, onClose }: TemplateEditorProps) {
  const { toast } = useToast();
  const isEditing = !!template;
  const [activeTab, setActiveTab] = useState("info");

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
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl">
                  {isEditing ? "Modifica Template" : "Nuovo Template"}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  {isEditing
                    ? "Modifica il template di contratto esistente."
                    : "Crea un nuovo template con l'aiuto dell'intelligenza artificiale."}
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {form.watch("isActive") ? (
                <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Attivo
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Disattivato
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 flex flex-col overflow-hidden"
          >
            <div className="px-6 pt-3 border-b bg-background">
              <TabsList className="w-full justify-start bg-transparent h-auto p-0 gap-0">
                <TabsTrigger
                  value="info"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3 pt-2"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Informazioni
                </TabsTrigger>
                <TabsTrigger
                  value="content"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3 pt-2"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Contenuto
                </TabsTrigger>
                <TabsTrigger
                  value="bonuspay"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3 pt-2"
                >
                  <Gift className="h-4 w-4 mr-2" />
                  Bonus & Pagamento
                </TabsTrigger>
                <TabsTrigger
                  value="ai"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-3 pt-2"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Assistente AI
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <TabsContent value="info" className="mt-0 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Configurazione Base
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nome Template *</Label>
                        <Input
                          id="name"
                          {...form.register("name")}
                          placeholder="es. MASTERCLASS FINANZIAMENTO"
                          disabled={isPending}
                        />
                        {form.formState.errors.name && (
                          <p className="text-sm text-destructive">
                            {form.formState.errors.name.message}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="description">Descrizione</Label>
                        <Input
                          id="description"
                          {...form.register("description")}
                          placeholder="Breve descrizione del template"
                          disabled={isPending}
                        />
                      </div>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div>
                        <Label htmlFor="isActive" className="text-sm font-medium">
                          Stato Template
                        </Label>
                        <p className="text-xs text-muted-foreground mt-1">
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
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="content" className="mt-0 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Contenuto Introduttivo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
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
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Code className="h-4 w-4" />
                        Corpo del Contratto *
                      </CardTitle>
                      <Badge variant="outline" className="text-xs">
                        Supporta variabili e blocchi
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md text-sm">
                      <p className="font-medium text-blue-800 dark:text-blue-300 mb-2">
                        Variabili disponibili:
                      </p>
                      <div className="grid grid-cols-2 gap-1 text-xs text-blue-700 dark:text-blue-400">
                        <span>
                          <code>{"{{societa}}"}</code> - Nome società
                        </span>
                        <span>
                          <code>{"{{cliente_nome}}"}</code> - Nome cliente
                        </span>
                        <span>
                          <code>{"{{p_iva}}"}</code> - P.IVA
                        </span>
                        <span>
                          <code>{"{{sede}}"}</code> - Sede legale
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                        Blocchi ripetibili:{" "}
                        <code>{"<!-- BLOCK:BONUS_LIST -->...<!-- END_BLOCK:BONUS_LIST -->"}</code>
                      </p>
                    </div>
                    <HtmlEditorWithPreview
                      fieldId="content"
                      fieldName="content"
                      form={form}
                      disabled={isPending}
                      rows={20}
                      placeholder="Inserisci il corpo principale del contratto con variabili e blocchi..."
                    />
                    {form.formState.errors.content && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.content.message}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="bonuspay" className="mt-0 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Gift className="h-4 w-4" />
                      Bonus Predefiniti
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <BonusManager
                      bonuses={(form.watch("predefinedBonuses") as any[]) || []}
                      onChange={(bonuses) => form.setValue("predefinedBonuses", bonuses as any)}
                      disabled={isPending}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Euro className="h-4 w-4" />
                      Termini di Pagamento
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
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
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="ai" className="mt-0 space-y-6">
                <Tabs defaultValue="wizard" className="w-full">
                  <TabsList className="w-full grid grid-cols-2">
                    <TabsTrigger value="wizard">
                      <Sparkles className="h-4 w-4 mr-2" />
                      Creazione Guidata
                    </TabsTrigger>
                    <TabsTrigger value="chat">
                      <FileText className="h-4 w-4 mr-2" />
                      Chat Consulenza
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="wizard" className="mt-4">
                    <AiContractWizard onContractGenerated={handleAiContractGenerated} />
                  </TabsContent>
                  <TabsContent value="chat" className="mt-4">
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
                          description: `${bonuses.length} bonus suggeriti dall'AI sono stati aggiunti.`,
                        });
                      }}
                    />
                  </TabsContent>
                </Tabs>
              </TabsContent>
            </div>
          </Tabs>

          <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/30">
            <p className="text-xs text-muted-foreground">
              {form.watch("name")
                ? `Template: ${form.watch("name")}`
                : "Compila il nome del template per salvare"}
            </p>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                <X className="h-4 w-4 mr-2" />
                Annulla
              </Button>
              <Button type="submit" disabled={isPending}>
                <Save className="h-4 w-4 mr-2" />
                {isPending
                  ? "Salvataggio..."
                  : isEditing
                    ? "Aggiorna Template"
                    : "Crea Template"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
