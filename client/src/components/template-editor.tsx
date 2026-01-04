import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertContractTemplateSchema } from "@shared/schema";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Info, Save, X } from "lucide-react";
import BonusManager from "./bonus-manager";

const templateFormSchema = insertContractTemplateSchema.omit({ createdBy: true });
type TemplateForm = z.infer<typeof templateFormSchema>;

interface TemplateEditorProps {
  template?: any;
  onClose: () => void;
}

export default function TemplateEditor({ template, onClose }: TemplateEditorProps) {
  const { toast } = useToast();
  const isEditing = !!template;

  const form = useForm<TemplateForm>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: template?.name || "",
      description: template?.description || "",
      content: template?.content || `<div class="contract-content">

<h2>TERMINI E CONDIZIONI</h2>
<p>Il presente contratto è regolato dalla legge italiana...</p>
</div>`,
      customContent: template?.customContent || `Il presente contratto include una serie di bonus esclusivi e servizi di valore aggiunto che potenziano significativamente l'offerta base, garantendo al cliente un pacchetto completo e una strategia di crescita personalizzata per massimizzare i risultati dell'investimento.

Tutti i bonus inclusi sono stati progettati per eliminare le principali barriere che impediscono ai clienti di ottenere risultati immediati: mancanza di tempo, complessità tecnologica, incertezza sui risultati e necessità di supporto continuo. L'obiettivo è garantire un percorso di crescita guidato, sicuro e misurabile fin dal primo giorno.`,
      paymentText: template?.paymentText || `<p>Il pagamento sarà corrisposto mediante modalità che il Cliente/Committente avrà cura di accendere come soluzione sottoscritta nel contratto con conseguente pagamento dell'indicato importo secondo il piano prestabilito.</p>

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
        paymentFrequencies: ["monthly", "quarterly", "annual"]
      }
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
        description: "Le modifiche sono state salvate con successo"
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

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Save className="mr-2 h-5 w-5" />
            {isEditing ? "Modifica Template" : "Nuovo Template"}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? "Modifica il template di contratto esistente con contenuti dinamici e bonus predefiniti."
              : "Crea un nuovo template di contratto con contenuti dinamici e bonus predefiniti."
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Nome Template *</Label>
              <Input
                id="name"
                {...form.register("name")}
                placeholder="es. MASTERCLASS FINANZIAMENTO"
                disabled={saveTemplateMutation.isPending}
              />
              {form.formState.errors.name && (
                <p className="text-sm text-red-600 mt-1">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={form.watch("isActive")}
                onCheckedChange={(checked) => form.setValue("isActive", checked)}
                disabled={saveTemplateMutation.isPending}
              />
              <Label htmlFor="isActive">Template Attivo</Label>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Descrizione</Label>
            <Input
              id="description"
              {...form.register("description")}
              placeholder="Breve descrizione del template"
              disabled={saveTemplateMutation.isPending}
            />
          </div>

          <Separator />

          {/* Custom Content Section */}
          <div>
            <Label htmlFor="customContent">Contenuto Personalizzato (prima dei bonus)</Label>
            <div className="mt-2 mb-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
              <div className="flex items-start space-x-2">
                <Info className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-amber-800">
                  <p>Questo testo apparirà nel contratto prima della sezione dei bonus. Puoi usare HTML per formattare il testo (grassetti, corsivi, elenchi, etc.).</p>
                  <div className="mt-2 space-y-1 text-xs">
                    <p><strong>Esempi di formattazione:</strong></p>
                    <p><code>&lt;strong&gt;testo in grassetto&lt;/strong&gt;</code></p>
                    <p><code>&lt;em&gt;testo in corsivo&lt;/em&gt;</code></p>
                    <p><code>&lt;ul&gt;&lt;li&gt;elemento lista&lt;/li&gt;&lt;/ul&gt;</code></p>
                    <p><code>&lt;p&gt;nuovo paragrafo&lt;/p&gt;</code></p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Rich Text Editor */}
            <div className="border border-gray-300 rounded-lg">
              {/* Toolbar */}
              <div className="border-b border-gray-200 p-2 bg-gray-50 rounded-t-lg">
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => {
                      const textarea = document.getElementById('customContent') as HTMLTextAreaElement;
                      if (textarea) {
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const selectedText = textarea.value.substring(start, end);
                        const newText = textarea.value.substring(0, start) + 
                          `<strong>${selectedText || 'testo in grassetto'}</strong>` + 
                          textarea.value.substring(end);
                        form.setValue('customContent', newText);
                      }
                    }}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100"
                    disabled={saveTemplateMutation.isPending}
                  >
                    <strong>B</strong>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const textarea = document.getElementById('customContent') as HTMLTextAreaElement;
                      if (textarea) {
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const selectedText = textarea.value.substring(start, end);
                        const newText = textarea.value.substring(0, start) + 
                          `<em>${selectedText || 'testo in corsivo'}</em>` + 
                          textarea.value.substring(end);
                        form.setValue('customContent', newText);
                      }
                    }}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 italic"
                    disabled={saveTemplateMutation.isPending}
                  >
                    I
                  </button>
                  <div className="border-l border-gray-300 h-6 mx-1"></div>
                  <button
                    type="button"
                    onClick={() => {
                      const textarea = document.getElementById('customContent') as HTMLTextAreaElement;
                      if (textarea) {
                        const currentValue = form.getValues('customContent');
                        const newText = currentValue + '\n<ul>\n  <li>Primo elemento</li>\n  <li>Secondo elemento</li>\n</ul>\n';
                        form.setValue('customContent', newText);
                      }
                    }}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100"
                    disabled={saveTemplateMutation.isPending}
                  >
                    • Lista
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const textarea = document.getElementById('customContent') as HTMLTextAreaElement;
                      if (textarea) {
                        const currentValue = form.getValues('customContent');
                        const newText = currentValue + '\n<p>Nuovo paragrafo</p>\n';
                        form.setValue('customContent', newText);
                      }
                    }}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100"
                    disabled={saveTemplateMutation.isPending}
                  >
                    ¶ Paragrafo
                  </button>
                </div>
              </div>
              
              {/* Text Area */}
              <Textarea
                id="customContent"
                {...form.register("customContent")}
                rows={8}
                placeholder={`<p>Il presente contratto include una serie di bonus esclusivi e servizi di valore aggiunto che potenziano significativamente l'offerta base.</p>

<p><strong>Obiettivi principali:</strong></p>
<ul>
  <li>Eliminazione delle barriere tecnologiche</li>
  <li>Supporto continuo personalizzato</li>
  <li>Risultati misurabili fin dal primo giorno</li>
</ul>

<p><em>Tutti i bonus sono stati progettati per garantire un percorso di crescita guidato e sicuro.</em></p>`}
                className="border-0 rounded-none rounded-b-lg resize-none font-mono text-sm"
                disabled={saveTemplateMutation.isPending}
              />
            </div>
            
            {/* Preview */}
            {form.watch("customContent") && (
              <div className="mt-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">Anteprima formattazione:</p>
                <div 
                  className="text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: form.watch("customContent") || "" }}
                />
              </div>
            )}
          </div>

          <Separator />

          {/* Payment Text Section */}
          <div>
            <Label htmlFor="paymentText">Testo Termini di Pagamento</Label>
            <div className="mt-2 mb-2 p-3 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-start space-x-2">
                <Info className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-green-800">
                  <p>Questo testo apparirà nel contratto nella sezione dei termini di pagamento. Personalizza i termini secondo le tue esigenze commerciali. Puoi usare HTML per formattare il testo.</p>
                  <div className="mt-2 space-y-1 text-xs">
                    <p><strong>Esempi di formattazione:</strong></p>
                    <p><code>&lt;strong&gt;testo in grassetto&lt;/strong&gt;</code></p>
                    <p><code>&lt;em&gt;testo in corsivo&lt;/em&gt;</code></p>
                    <p><code>&lt;ul&gt;&lt;li&gt;elemento lista&lt;/li&gt;&lt;/ul&gt;</code></p>
                    <p><code>&lt;p&gt;nuovo paragrafo&lt;/p&gt;</code></p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Rich Text Editor */}
            <div className="border border-gray-300 rounded-lg">
              {/* Toolbar */}
              <div className="border-b border-gray-200 p-2 bg-gray-50 rounded-t-lg">
                <div className="flex items-center space-x-1">
                  <button
                    type="button"
                    onClick={() => {
                      const textarea = document.getElementById('paymentText') as HTMLTextAreaElement;
                      if (textarea) {
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const selectedText = textarea.value.substring(start, end);
                        const newText = textarea.value.substring(0, start) + 
                          `<strong>${selectedText || 'testo in grassetto'}</strong>` + 
                          textarea.value.substring(end);
                        form.setValue('paymentText', newText);
                      }
                    }}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100"
                    disabled={saveTemplateMutation.isPending}
                  >
                    <strong>B</strong>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const textarea = document.getElementById('paymentText') as HTMLTextAreaElement;
                      if (textarea) {
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const selectedText = textarea.value.substring(start, end);
                        const newText = textarea.value.substring(0, start) + 
                          `<em>${selectedText || 'testo in corsivo'}</em>` + 
                          textarea.value.substring(end);
                        form.setValue('paymentText', newText);
                      }
                    }}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 italic"
                    disabled={saveTemplateMutation.isPending}
                  >
                    I
                  </button>
                  <div className="border-l border-gray-300 h-6 mx-1"></div>
                  <button
                    type="button"
                    onClick={() => {
                      const textarea = document.getElementById('paymentText') as HTMLTextAreaElement;
                      if (textarea) {
                        const currentValue = form.getValues('paymentText');
                        const newText = currentValue + '\n<ul>\n  <li>Primo elemento</li>\n  <li>Secondo elemento</li>\n</ul>\n';
                        form.setValue('paymentText', newText);
                      }
                    }}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100"
                    disabled={saveTemplateMutation.isPending}
                  >
                    • Lista
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const textarea = document.getElementById('paymentText') as HTMLTextAreaElement;
                      if (textarea) {
                        const currentValue = form.getValues('paymentText');
                        const newText = currentValue + '\n<p>Nuovo paragrafo</p>\n';
                        form.setValue('paymentText', newText);
                      }
                    }}
                    className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100"
                    disabled={saveTemplateMutation.isPending}
                  >
                    ¶ Paragrafo
                  </button>
                </div>
              </div>
              
              {/* Text Area */}
              <Textarea
                id="paymentText"
                {...form.register("paymentText")}
                rows={6}
                placeholder={`<p>sarà corrisposto mediante pagamento che il Cliente/Committente avrà cura di accendere come soluzione sottoscritta nel contratto.</p>

<p><strong>Modalità di pagamento accettate:</strong></p>
<ul>
  <li>Pagamento in unica soluzione</li>
  <li>Pagamento rateale come prestabilito nel contratto</li>
</ul>

<p><em>Resta inteso che in caso di inerzia del Cliente potrà esser emesso un rimborso entro 30 giorni dalla firma del contratto e avvenuto pagamento.</em></p>`}
                className="border-0 rounded-none rounded-b-lg resize-none font-mono text-sm"
                disabled={saveTemplateMutation.isPending}
              />
            </div>
            
            {/* Preview */}
            {form.watch("paymentText") && (
              <div className="mt-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">Anteprima formattazione:</p>
                <div 
                  className="text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: form.watch("paymentText") || "" }}
                />
              </div>
            )}
          </div>

          <Separator />

          {/* Template Content */}
          <div>
            <Label htmlFor="content">Contenuto Template *</Label>
            <div className="mt-2 mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-start space-x-2">
                <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-2">Guida all'utilizzo delle variabili:</p>
                  <div className="space-y-1 text-xs">
                    <p><strong>Variabili semplici:</strong> <code>{"{{nome_variabile}}"}</code></p>
                    <p><strong>Blocchi ripetibili:</strong></p>
                    <pre className="bg-blue-100 p-2 rounded mt-1 overflow-x-auto">
{`<!-- BLOCK:BONUS_LIST -->
• {{bonus_descrizione}}
<!-- END_BLOCK:BONUS_LIST -->

<!-- BLOCK:PAYMENT_PLAN -->
• Rata {{rata_numero}} di EUR {{rata_importo}} + IVA entro il {{rata_scadenza}}
<!-- END_BLOCK:PAYMENT_PLAN -->`}
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            <Textarea
              id="content"
              {...form.register("content")}
              rows={20}
              className="font-mono text-sm"
              disabled={saveTemplateMutation.isPending}
            />
            {form.formState.errors.content && (
              <p className="text-sm text-red-600 mt-1">
                {form.formState.errors.content.message}
              </p>
            )}
          </div>

          {/* Bonus Configuration */}
          <BonusManager
            bonuses={form.watch("predefinedBonuses") || []}
            onChange={(bonuses) => form.setValue("predefinedBonuses", bonuses)}
            disabled={saveTemplateMutation.isPending}
          />

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saveTemplateMutation.isPending}
            >
              <X className="h-4 w-4 mr-2" />
              Annulla
            </Button>
            <Button
              type="submit"
              disabled={saveTemplateMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {saveTemplateMutation.isPending 
                ? "Salvataggio..." 
                : (isEditing ? "Aggiorna Template" : "Crea Template")
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
