import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { File, Save, X, User, Building, Euro, Plus, FileText, Calculator, Users, CheckCircle, XCircle, Loader2, MapPin, Phone, Mail, Calendar, Send, Gift, Check, Info, AlertTriangle, Eye } from "lucide-react";
import DynamicFormFields from "./dynamic-form-fields";
import ProfessionalContractDocument from "./professional-contract-document";
import PaymentCalculatorAdvanced from "./payment-calculator-advanced";
import EmailConfigBanner, { useEmailStatus } from "./email-config-banner";
import MissingDataPanel from "./missing-data-panel";
import CoFillDialog from "./co-fill-dialog";
import { REQUIRED_CLIENT_FIELDS, type RequiredClientField } from "@/lib/required-client-fields";
import { validatePartitaIva, validateCodiceFiscale, detectVATorCF } from "@/lib/validation-utils";

const contractFormSchema = z.object({
  templateId: z.number().min(1, "Seleziona un template"),
  clientData: z.object({
    // Company/Client info
    societa: z.string().min(1, "Nome società richiesto"),
    sede: z.string().min(1, "Sede richiesta"),
    indirizzo: z.string().min(1, "Indirizzo richiesto"),
    p_iva: z.string().min(1, "Codice Fiscale/P.IVA richiesto"),
    pec: z.string().optional(),
    email: z.string().email("Email non valida"),
    cellulare: z.string().min(1, "Numero di cellulare richiesto"),
    codice_univoco: z.string().optional(),

    // Personal info
    cliente_nome: z.string().min(1, "Nome referente richiesto"),
    nato_a: z.string().min(1, "Luogo di nascita richiesto"),
    residente_a: z.string().min(1, "Luogo di residenza richiuto"),
    indirizzo_residenza: z.string().min(1, "Indirizzo di residenza richiesto"),
    data_nascita: z.string().min(1, "Data di nascita richiesta"),

    // Dynamic sections
    bonus_list: z.array(z.object({
      bonus_descrizione: z.string().min(1, "Descrizione bonus richiesta")
    })).default([]).optional(),
    payment_plan: z.array(z.object({
      rata_importo: z.string().optional(),
      rata_scadenza: z.string().optional()
    })).default([]).optional(),
    rata_list: z.array(z.object({
      rata_importo: z.number().min(0.01, "Importo deve essere maggiore di 0").optional(),
      rata_scadenza: z.string().min(1, "Data scadenza richiesta").optional()
    })).default([]).optional(),
  }),
  totalValue: z.number().optional(),
  sendImmediately: z.boolean().default(true),
  renewalDuration: z.number().min(1).max(60).default(12),
  contractStartDate: z.string().min(1, "Data inizio contratto richiesta"),
  contractEndDate: z.string().min(1, "Data fine contratto richiesta"),
  isPercentagePartnership: z.boolean().default(false),
  partnershipPercentage: z.number().min(0.01).max(100).optional(),
}).refine((data) => {
  if (data.isPercentagePartnership) {
    return data.partnershipPercentage !== undefined && data.partnershipPercentage > 0;
  }
  return data.totalValue !== undefined && data.totalValue > 0;
}, {
  message: "Inserisci il prezzo totale o la percentuale partnership",
  path: ["totalValue"]
}).refine((data) => {
  // Only validate payment plan if NOT in partnership mode
  if (!data.isPercentagePartnership && data.clientData.payment_plan) {
    return data.clientData.payment_plan.every(payment => 
      !payment.rata_importo || (payment.rata_importo.trim() !== "" && payment.rata_scadenza && payment.rata_scadenza.trim() !== "")
    );
  }
  return true;
}, {
  message: "Completa tutti i campi del piano di pagamento o rimuovi le righe vuote",
  path: ["clientData", "payment_plan"]
}).refine((data) => {
  // Validate that rata_list sum equals totalValue when using manual rates
  if (!data.isPercentagePartnership && data.clientData.rata_list && data.clientData.rata_list.length > 0) {
    const validRates = data.clientData.rata_list.filter(rata => 
      rata.rata_importo && rata.rata_importo > 0 && 
      rata.rata_scadenza && rata.rata_scadenza.trim() !== ""
    );
    
    if (validRates.length > 0) {
      const sum = validRates.reduce((total, rata) => total + (rata.rata_importo || 0), 0);
      return Math.abs(sum - (data.totalValue || 0)) < 0.01; // Allow small floating point differences
    }
  }
  return true;
}, {
  message: "La somma delle rate deve corrispondere al prezzo totale",
  path: ["clientData", "rata_list"]
});

type ContractForm = z.infer<typeof contractFormSchema>;

interface ContractFormProps {
  onClose: () => void;
  contract?: any; // Optional: Pass the contract data for editing
}

const STEPS = [
  { id: 1, label: "Template", icon: FileText, sectionId: "section-template" },
  { id: 2, label: "Dati Cliente", icon: Users, sectionId: "section-client" },
  { id: 3, label: "Pagamento", icon: Euro, sectionId: "section-payment" },
  { id: 4, label: "Durata", icon: Calendar, sectionId: "section-duration" },
  { id: 5, label: "Bonus", icon: Gift, sectionId: "section-bonus" },
  { id: 6, label: "Invio", icon: Send, sectionId: "section-send" },
];

const inputClass = "h-12 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 hover:border-gray-300 transition-all duration-200";
const labelClass = "text-sm font-medium text-slate-700 mb-2 block";

export default function ContractForm({ onClose, contract }: ContractFormProps) {
  const { toast } = useToast();
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(contract?.templateId || null);
  const [sendImmediately, setSendImmediately] = useState(false);
  const { data: emailStatus } = useEmailStatus();
  const emailConfigured = emailStatus?.configured !== false;
  const [sendToEmail, setSendToEmail] = useState(contract?.sentToEmail || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPercentageMode, setIsPercentageMode] = useState(contract?.isPercentagePartnership || false);
  const [vatValidation, setVatValidation] = useState<{ isValid: boolean | null; type: 'vat' | 'cf' | null; isValidating: boolean }>({ 
    isValid: null, 
    type: null, 
    isValidating: false 
  });
  const [currentStep, setCurrentStep] = useState(1);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isEditing = !!contract; // Determine if we are editing an existing contract

  // Preview modal state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<{ template: any; companySettings: any; generatedContent: string } | null>(null);

  // Co-fill (real-time client-seller fill) state
  const [coFillDialogOpen, setCoFillDialogOpen] = useState(false);
  const [coFillToken, setCoFillToken] = useState<string | null>(null);
  const [coFillClientConnected, setCoFillClientConnected] = useState(false);
  const [coFillHighlight, setCoFillHighlight] = useState<Record<string, number>>({});
  const coFillWsRef = useRef<WebSocket | null>(null);
  const coFillClientIdRef = useRef<string>("");
  const coFillApplyingRef = useRef<boolean>(false);
  const coFillReconnectRef = useRef<any>(null);

  const scrollToSection = useCallback((sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const sections = STEPS.map(s => document.getElementById(s.sectionId)).filter(Boolean) as HTMLElement[];
      const containerRect = container.getBoundingClientRect();
      const containerTop = containerRect.top + 120;

      for (let i = sections.length - 1; i >= 0; i--) {
        const rect = sections[i].getBoundingClientRect();
        if (rect.top <= containerTop + 50) {
          setCurrentStep(i + 1);
          break;
        }
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  const { data: templates = [], isLoading: templatesLoading, error: templatesError } = useQuery({
    queryKey: ["/api/templates"],
    enabled: !isEditing, // 🚫 BLOCCA il caricamento quando siamo in modalità editing
    retry: 3,
    onError: (error) => {
      console.error("Error fetching templates:", error);
      toast({
        title: "Errore nel caricamento dei template",
        description: "Non è stato possibile caricare i template disponibili",
        variant: "destructive",
      });
    }
  });

  // Find the selected template based on selectedTemplateId
  const selectedTemplate = selectedTemplateId 
    ? templates.find((template: any) => template.id === selectedTemplateId)
    : null;

  const form = useForm<ContractForm>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: {
      templateId: contract?.templateId || selectedTemplateId || 0,
      totalValue: contract?.totalValue ? contract.totalValue / 100 : 0, // Convert from cents to euros
      sendImmediately: false,
      renewalDuration: contract?.renewalDuration || 12,
      contractStartDate: contract?.contractStartDate ? new Date(contract.contractStartDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      contractEndDate: contract?.contractEndDate ? new Date(contract.contractEndDate).toISOString().split('T')[0] : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Default to 1 year from now
      isPercentagePartnership: contract?.isPercentagePartnership || false,
      partnershipPercentage: contract?.partnershipPercentage || undefined,
      clientData: contract?.clientData || {
        societa: "",
        sede: "",
        indirizzo: "",
        p_iva: "",
        pec: "",
        email: "",
        cellulare: "",
        codice_univoco: "",
        cliente_nome: "",
        nato_a: "",
        residente_a: "",
        indirizzo_residenza: "",
        data_nascita: "",
        bonus_list: [],
        payment_plan: [{ rata_importo: "", rata_scadenza: "" }],
        rata_list: [],
      },
    },
  });

  const bonusFields = useFieldArray({
    control: form.control,
    name: "clientData.bonus_list",
  });

  const paymentFields = useFieldArray({
    control: form.control,
    name: "clientData.payment_plan",
  });

  const rataListFields = useFieldArray({
    control: form.control,
    name: "clientData.rata_list",
  });

  const createContractMutation = useMutation({
    mutationFn: async (data: ContractForm) => {
      // Convert totalValue from euros to cents only if not in percentage mode
      const contractData = {
        ...data,
        totalValue: data.totalValue ? Math.round(data.totalValue * 100) : null,
        isPercentagePartnership: data.isPercentagePartnership || false,
        partnershipPercentage: data.partnershipPercentage || null,
      };

      setIsSubmitting(true);
      if (isEditing) {
        return await apiRequest("PUT", `/api/contracts/${contract.id}`, contractData);
      } else {
        return await apiRequest("POST", "/api/contracts", contractData);
      }
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });

      if (response.warning) {
        toast({ 
          title: isEditing ? "Contratto aggiornato" : "Contratto creato",
          description: response.message,
          variant: "default"
        });
      } else {
        toast({ 
          title: isEditing ? "Contratto aggiornato con successo" : "Contratto creato con successo",
          description: response.message || (isEditing ? "Il contratto è stato aggiornato" : "Il contratto è stato generato e inviato al cliente")
        });
      }
      onClose();
    },
    onError: (error: any) => {
      const raw = String(error?.message || "");
      const cleaned = raw.replace(/^\d+:\s*/, "");
      let description = cleaned;
      let code: string | undefined;
      try {
        const parsed = JSON.parse(cleaned);
        if (parsed?.message) description = parsed.message;
        if (parsed?.code) code = parsed.code;
      } catch {}
      toast({
        title:
          code === "EMAIL_NOT_CONFIGURED"
            ? "Email aziendale non configurata"
            : isEditing
            ? "Errore nell'aggiornamento del contratto"
            : "Errore nella creazione del contratto",
        description,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsSubmitting(false); // Ensure isSubmitting is reset after mutation completes
    }
  });

  // Open the preview modal with the same data the customer would receive.
  // We mount ProfessionalContractDocument (the very same component used on
  // the public /client/:code page) so the preview is byte-for-byte faithful.
  const handleOpenPreview = async () => {
    const values = form.getValues();
    const templateId = values.templateId || selectedTemplateId;
    if (!templateId) {
      toast({
        title: "Seleziona un template",
        description: "Per vedere l'anteprima devi prima scegliere un template di contratto.",
        variant: "destructive",
      });
      scrollToSection("section-template");
      return;
    }
    const cd: any = values.clientData || {};
    if (!cd.societa || !cd.cliente_nome || !cd.email) {
      toast({
        title: "Compila i dati cliente",
        description: "Servono almeno società, nome del referente ed email del cliente per generare l'anteprima.",
        variant: "destructive",
      });
      scrollToSection("section-client");
      return;
    }
    if (values.isPercentagePartnership) {
      if (!values.partnershipPercentage || values.partnershipPercentage <= 0) {
        toast({
          title: "Inserisci la percentuale di partnership",
          description: "Per generare l'anteprima la percentuale deve essere maggiore di zero.",
          variant: "destructive",
        });
        scrollToSection("section-payment");
        return;
      }
    } else if (!values.totalValue || values.totalValue <= 0) {
      toast({
        title: "Inserisci il prezzo totale",
        description: "Per generare l'anteprima il prezzo totale deve essere maggiore di zero.",
        variant: "destructive",
      });
      scrollToSection("section-payment");
      return;
    }

    setPreviewLoading(true);
    try {
      const payload = {
        templateId,
        clientData: cd,
        totalValue: values.totalValue ? Math.round(values.totalValue * 100) : null,
        isPercentagePartnership: !!values.isPercentagePartnership,
        partnershipPercentage: values.partnershipPercentage ?? null,
        autoRenewal: true,
        renewalDuration: values.renewalDuration,
        contractStartDate: values.contractStartDate,
        contractEndDate: values.contractEndDate,
      };
      const res = await apiRequest("POST", "/api/contracts/preview", payload);
      const data = await res.json();
      setPreviewData(data);
      setPreviewOpen(true);
    } catch (error: any) {
      toast({
        title: "Impossibile caricare l'anteprima",
        description: error?.message || "Riprova tra qualche istante.",
        variant: "destructive",
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  const onSubmit = (data: ContractForm) => {
    console.log("Form submitted with data:", data);
    console.log("Form errors:", form.formState.errors);
    
    // Filter out empty bonus and payment entries
    const filteredData = {
      ...data,
      sendImmediately,
      sendToEmail,
      autoRenewal: true, // Sempre attivo
      renewalDuration: data.renewalDuration,
      // Keep partnershipPercentage as number (no conversion needed)
      partnershipPercentage: data.partnershipPercentage,
      clientData: {
        ...data.clientData,
        bonus_list: data.clientData.bonus_list?.filter(bonus => 
          bonus.bonus_descrizione && bonus.bonus_descrizione.trim() !== ""
        ) || [],
        // Use rata_list (manual) if available, otherwise use payment_plan (automatic)
        payment_plan: data.isPercentagePartnership ? [] : (
          // If we have manual rates (rata_list), ignore payment_plan completely
          data.clientData.rata_list && data.clientData.rata_list.length > 0 ? [] :
          // Otherwise use automatic payment_plan, but filter out empty entries
          data.clientData.payment_plan?.filter(payment => 
            payment.rata_importo && payment.rata_importo.toString().trim() !== "" && 
            payment.rata_scadenza && payment.rata_scadenza.trim() !== ""
          ) || []
        ),
        // Manual rates from rate personalizzate
        rata_list: data.clientData.rata_list?.filter(rata => 
          rata.rata_importo && rata.rata_importo > 0 && 
          rata.rata_scadenza && rata.rata_scadenza.trim() !== ""
        ) || [],
      },
    };

    console.log("Filtered data being sent:", filteredData);
    createContractMutation.mutate(filteredData);
  };

  console.log("Templates loaded:", templates);

  const currentTotalValue = form.watch("totalValue") || 0;
  const currentIsPercentageMode = form.watch("isPercentagePartnership") || false;
  const watchedClientData = form.watch("clientData");

  // ====================================================================
  // Co-fill WebSocket: connect when seller has an active token, mirror data
  // ====================================================================
  useEffect(() => {
    if (!coFillToken) return;
    let cancelled = false;

    const flash = (field: string) => {
      setCoFillHighlight((prev) => ({ ...prev, [field]: Date.now() }));
      setTimeout(() => {
        setCoFillHighlight((prev) => {
          const cp = { ...prev };
          delete cp[field];
          return cp;
        });
      }, 2000);
    };

    const connect = () => {
      if (cancelled) return;
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${proto}//${window.location.host}/ws/co-fill/${coFillToken}?role=seller`);
      coFillWsRef.current = ws;

      ws.onopen = () => {};
      ws.onclose = () => {
        coFillWsRef.current = null;
        setCoFillClientConnected(false);
        if (!cancelled && coFillToken) {
          if (coFillReconnectRef.current) clearTimeout(coFillReconnectRef.current);
          coFillReconnectRef.current = setTimeout(connect, 2000);
        }
      };
      ws.onerror = () => { try { ws.close(); } catch {} };
      ws.onmessage = (evt) => {
        let msg: any;
        try { msg = JSON.parse(evt.data); } catch { return; }
        if (msg.type === "init") {
          coFillClientIdRef.current = msg.clientId;
          // Apply server-side current data to form (for fields the seller cares about)
          coFillApplyingRef.current = true;
          try {
            const cd = msg.currentData || {};
            for (const f of REQUIRED_CLIENT_FIELDS) {
              if (cd[f.key] !== undefined && cd[f.key] !== null && cd[f.key] !== "") {
                form.setValue(`clientData.${f.key}` as any, cd[f.key], { shouldDirty: true });
              }
            }
          } finally {
            setTimeout(() => { coFillApplyingRef.current = false; }, 50);
          }
        } else if (msg.type === "update" && msg.field) {
          if (msg.clientId && msg.clientId === coFillClientIdRef.current) return;
          coFillApplyingRef.current = true;
          try {
            form.setValue(`clientData.${msg.field}` as any, msg.value ?? "", { shouldDirty: true });
          } finally {
            setTimeout(() => { coFillApplyingRef.current = false; }, 50);
          }
          flash(msg.field);
        } else if (msg.type === "presence") {
          setCoFillClientConnected((msg.clients || 0) > 0);
        } else if (msg.type === "terminated") {
          setCoFillToken(null);
        }
      };
    };
    connect();

    return () => {
      cancelled = true;
      if (coFillReconnectRef.current) clearTimeout(coFillReconnectRef.current);
      if (coFillWsRef.current) try { coFillWsRef.current.close(); } catch {}
      coFillWsRef.current = null;
    };
  }, [coFillToken, form]);

  // When the seller edits a watched field, push the change to the WS (debounced).
  useEffect(() => {
    if (!coFillToken) return;
    const debouncers: Record<string, any> = {};
    const sub = form.watch((value, info) => {
      if (!info?.name || info.type !== "change") return;
      if (!info.name.startsWith("clientData.")) return;
      if (coFillApplyingRef.current) return;
      const field = info.name.slice("clientData.".length);
      const allowed = REQUIRED_CLIENT_FIELDS.some((f) => f.key === field);
      if (!allowed) return;
      const fieldValue = (value as any)?.clientData?.[field] ?? "";
      if (debouncers[field]) clearTimeout(debouncers[field]);
      debouncers[field] = setTimeout(() => {
        const ws = coFillWsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "update", field, value: fieldValue }));
        }
      }, 350);
    });
    return () => {
      sub.unsubscribe();
      for (const k in debouncers) clearTimeout(debouncers[k]);
    };
  }, [coFillToken, form]);

  const coFillFieldClass = useCallback(
    (field: string) =>
      coFillHighlight[field]
        ? "ring-2 ring-violet-400 border-violet-500 bg-violet-50 transition-all duration-300"
        : "",
    [coFillHighlight],
  );

  const jumpToClientField = useCallback((field: RequiredClientField) => {
    scrollToSection(field.sectionId);
    setTimeout(() => {
      const el = document.getElementById(field.key) as HTMLInputElement | null;
      if (el) {
        el.focus({ preventScroll: true });
      }
    }, 350);
  }, [scrollToSection]);

  // Early returns must come AFTER all hooks to preserve hook order between renders.
  if (templatesLoading) {
    return (
      <Dialog open onOpenChange={() => onClose()}>
        <DialogContent className="max-w-[1100px] rounded-[20px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.15)] border-0">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 text-indigo-600 animate-spin mr-4" />
            <span className="text-lg text-slate-700">Caricamento template...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (templatesError) {
    return (
      <Dialog open onOpenChange={() => onClose()}>
        <DialogContent className="max-w-[1100px] rounded-[20px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.15)] border-0">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="text-red-500 mb-4">Errore nel caricamento dei template</div>
              <Button onClick={() => window.location.reload()} className="rounded-xl">
                Ricarica la pagina
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
    <CoFillDialog
      open={coFillDialogOpen}
      onClose={() => setCoFillDialogOpen(false)}
      initialData={form.getValues("clientData") || {}}
      contractId={isEditing && contract ? contract.id : null}
      activeToken={coFillToken}
      clientConnected={coFillClientConnected}
      onSessionStart={(token) => setCoFillToken(token)}
      onSessionEnd={() => setCoFillToken(null)}
    />
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-[1280px] w-[95vw] max-h-[95vh] p-0 rounded-[20px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.15)] border-0 overflow-hidden bg-white flex flex-col">
        {/* Header */}
        <div className="p-8 bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] text-white flex-shrink-0">
          <DialogHeader>
            <DialogTitle className="flex items-center text-2xl font-bold text-white">
              <FileText className="h-6 w-6 mr-3" />
              {isEditing ? "Modifica Contratto" : "Nuovo Contratto"}
            </DialogTitle>
            <DialogDescription className="text-white/80 mt-2">
              Genera un nuovo contratto compilando tutti i dati necessari. Il sistema produrrà automaticamente il PDF e lo invierà al cliente.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Step Navigation */}
        <div className="px-8 pt-6 pb-4 border-b border-gray-100 flex-shrink-0 bg-white">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              return (
                <div key={step.id} className="flex items-center flex-1 last:flex-none">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentStep(step.id);
                      scrollToSection(step.sectionId);
                    }}
                    className="flex flex-col items-center group cursor-pointer"
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                        : isCompleted
                        ? "bg-indigo-100 text-indigo-600"
                        : "bg-gray-100 text-gray-400"
                    }`}>
                      {isCompleted ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <StepIcon className="h-4 w-4" />
                      )}
                    </div>
                    <span className={`text-xs mt-2 font-medium transition-colors duration-200 ${
                      isActive ? "text-indigo-600" : isCompleted ? "text-indigo-500" : "text-gray-400"
                    }`}>
                      {step.label}
                    </span>
                  </button>
                  {index < STEPS.length - 1 && (
                    <div className={`flex-1 h-[2px] mx-3 mt-[-18px] transition-colors duration-300 ${
                      isCompleted ? "bg-indigo-300" : "bg-gray-200"
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Scrollable content + sidebar */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-8 py-8 bg-white">
            <MissingDataPanel
              variant="accordion"
              className="lg:hidden mb-6"
              clientData={watchedClientData}
              onJumpToField={jumpToClientField}
            />
            <form id="contract-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-0">
            {/* Section 1: Template Selection */}
            <div id="section-template">
              <h3 className="text-xl font-semibold text-slate-900 flex items-center mb-6">
                <FileText className="mr-3 h-5 w-5 text-indigo-600" />
                Selezione Template
              </h3>
              <div>
                <Label htmlFor="template" className={labelClass}>
                  Seleziona Template *
                </Label>
                <Select
                  value={selectedTemplateId?.toString() || ""}
                  onValueChange={(value) => {
                    const templateId = parseInt(value);
                    form.setValue("templateId", templateId);
                    setSelectedTemplateId(templateId);
                  }}
                  disabled={createContractMutation.isPending}
                >
                  <SelectTrigger className={`${inputClass} mt-1`}>
                    <SelectValue placeholder="Seleziona un template di contratto" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.length === 0 ? (
                      <div className="p-2 text-sm text-gray-500">
                        Nessun template disponibile
                      </div>
                    ) : (
                      templates.map((template: any) => (
                        <SelectItem key={template.id} value={template.id.toString()}>
                          <div className="flex items-center">
                            <FileText className="h-4 w-4 mr-2 text-gray-600" />
                            {template.name}
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {form.formState.errors.templateId && (
                  <p className="text-sm text-red-600 mt-2">
                    {form.formState.errors.templateId.message}
                  </p>
                )}
              </div>
            </div>

            {/* Section 2: Client Data */}
            <div id="section-client" className="border-t border-gray-100 pt-8 mt-8">
              <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
                <h3 className="text-xl font-semibold text-slate-900 flex items-center">
                  <Users className="mr-3 h-5 w-5 text-indigo-600" />
                  Dati Cliente/Committente
                </h3>
                <div className="flex items-center gap-2">
                  {coFillToken && (
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
                        coFillClientConnected
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-500"
                      }`}
                      data-testid="badge-cofill-status"
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          coFillClientConnected ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                        }`}
                      />
                      {coFillClientConnected ? "Cliente connesso" : "In attesa cliente"}
                    </span>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                    onClick={() => setCoFillDialogOpen(true)}
                    data-testid="button-open-cofill"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    {coFillToken ? "Gestisci link cliente" : "Compila con il cliente"}
                  </Button>
                </div>
              </div>
              <div className="space-y-8">
                {/* Dati Azienda/Società */}
                <div>
                  <h4 className="text-base font-semibold text-slate-800 mb-4 flex items-center">
                    <Building className="h-4 w-4 mr-2 text-slate-500" />
                    Dati Azienda/Società
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <Label htmlFor="societa" className={labelClass}>
                        Società *
                      </Label>
                      <Input
                        id="societa"
                        {...form.register("clientData.societa")}
                        placeholder="Nome della società"
                        disabled={createContractMutation.isPending}
                        className={`${inputClass} ${coFillFieldClass("societa")}`}
                      />
                      {form.formState.errors.clientData?.societa && (
                        <p className="text-sm text-red-600 mt-1">
                          {form.formState.errors.clientData.societa.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="sede" className={labelClass}>
                        Sede *
                      </Label>
                      <Input
                        id="sede"
                        {...form.register("clientData.sede")}
                        placeholder="Città sede legale"
                        disabled={createContractMutation.isPending}
                        className={`${inputClass} ${coFillFieldClass("sede")}`}
                      />
                      {form.formState.errors.clientData?.sede && (
                        <p className="text-sm text-red-600 mt-1">
                          {form.formState.errors.clientData.sede.message}
                        </p>
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <Label htmlFor="indirizzo" className={labelClass}>
                        Indirizzo *
                      </Label>
                      <Input
                        id="indirizzo"
                        {...form.register("clientData.indirizzo")}
                        placeholder="Via, numero civico, CAP"
                        disabled={createContractMutation.isPending}
                        className={`${inputClass} ${coFillFieldClass("indirizzo")}`}
                      />
                      {form.formState.errors.clientData?.indirizzo && (
                        <p className="text-sm text-red-600 mt-1">
                          {form.formState.errors.clientData.indirizzo.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="p_iva" className={labelClass}>
                        Codice Fiscale / P.IVA *
                      </Label>
                      <div className="relative">
                        <Input
                          id="p_iva"
                          {...form.register("clientData.p_iva", {
                            onChange: async (e) => {
                              const value = e.target.value.toUpperCase().replace(/\s/g, '');
                              e.target.value = value;

                              if (value.length > 0) {
                                setVatValidation({ isValid: null, type: null, isValidating: true });

                                // Debounce validation
                                setTimeout(async () => {
                                  const detectedType = detectVATorCF(value);
                                  let isValid = false;

                                  if (detectedType === 'vat') {
                                    isValid = validatePartitaIva(value);

                                    // Auto-lookup company data if VAT is valid
                                    if (isValid) {
                                      try {
                                        const { lookupCompanyByVAT } = await import('@/lib/validation-utils');
                                        const lookupResult = await lookupCompanyByVAT(value);

                                        if (lookupResult.success && lookupResult.data) {
                                          // Auto-fill company data
                                          form.setValue('clientData.company_name', lookupResult.data.company_name);
                                          form.setValue('clientData.address', lookupResult.data.address);
                                          form.setValue('clientData.city', lookupResult.data.city);
                                          form.setValue('clientData.postal_code', lookupResult.data.postal_code);
                                        }
                                      } catch (error) {
                                        console.log('Company lookup not available:', error);
                                      }
                                    }
                                  } else if (detectedType === 'cf') {
                                    const { validateCodiceFiscale } = await import('@/lib/validation-utils');
                                    isValid = validateCodiceFiscale(value);
                                  }

                                  setVatValidation({ 
                                    isValid, 
                                    type: detectedType !== 'unknown' ? detectedType : null,
                                    isValidating: false 
                                  });
                                }, 300);
                              } else {
                                setVatValidation({ isValid: null, type: null, isValidating: false });
                              }
                            }
                          })}
                          placeholder="Codice Fiscale o Partita IVA"
                          disabled={createContractMutation.isPending}
                          className={`${inputClass} pr-10 ${
                            vatValidation.isValid === true 
                              ? 'border-emerald-400 focus:border-emerald-500' 
                              : vatValidation.isValid === false 
                              ? 'border-red-400 focus:border-red-500' 
                              : ''
                          } ${coFillFieldClass("p_iva")}`}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {vatValidation.isValidating && (
                            <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
                          )}
                          {!vatValidation.isValidating && vatValidation.isValid === true && (
                            <CheckCircle className="h-5 w-5 text-emerald-500" />
                          )}
                          {!vatValidation.isValidating && vatValidation.isValid === false && (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                        </div>
                      </div>
                      {vatValidation.type && vatValidation.isValid && (
                        <p className="text-sm text-emerald-600 mt-1">
                          {vatValidation.type === 'vat' ? 'Partita IVA valida' : 'Codice Fiscale valido'}
                        </p>
                      )}
                      {form.formState.errors.clientData?.p_iva && (
                        <p className="text-sm text-red-600 mt-1">
                          {form.formState.errors.clientData.p_iva.message}
                        </p>
                      )}
                      {vatValidation.isValid === false && !form.formState.errors.clientData?.p_iva && (
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-sm text-red-600">
                            {vatValidation.type === 'vat' ? 'Partita IVA non valida' : 
                             vatValidation.type === 'cf' ? 'Codice Fiscale non valido' : 
                             'Formato non riconosciuto'}
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setVatValidation({ isValid: true, type: vatValidation.type, isValidating: false })}
                            className="h-7 px-3 text-xs border-amber-300 text-amber-700 hover:bg-amber-50 rounded-lg"
                          >
                            Forza inserimento
                          </Button>
                        </div>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="codice_univoco" className={labelClass}>
                        Codice Univoco
                      </Label>
                      <Input
                        id="codice_univoco"
                        {...form.register("clientData.codice_univoco")}
                        placeholder="Codice univoco (opzionale)"
                        disabled={createContractMutation.isPending}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <Label htmlFor="email" className={labelClass}>
                        Email *
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        {...form.register("clientData.email")}
                        placeholder="email@esempio.com"
                        disabled={createContractMutation.isPending}
                        className={`${inputClass} ${coFillFieldClass("email")}`}
                      />
                      {form.formState.errors.clientData?.email && (
                        <p className="text-sm text-red-600 mt-1">
                          {form.formState.errors.clientData.email.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="pec" className={labelClass}>
                        PEC
                      </Label>
                      <Input
                        id="pec"
                        {...form.register("clientData.pec")}
                        placeholder="pec@esempio.com (opzionale)"
                        disabled={createContractMutation.isPending}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <Label htmlFor="cellulare" className={labelClass}>
                        Cellulare *
                      </Label>
                      <Input
                        id="cellulare"
                        type="tel"
                        {...form.register("clientData.cellulare")}
                        placeholder="+39 333 123 4567"
                        disabled={createContractMutation.isPending}
                        className={`${inputClass} ${coFillFieldClass("cellulare")}`}
                      />
                      {form.formState.errors.clientData?.cellulare && (
                        <p className="text-sm text-red-600 mt-1">
                          {form.formState.errors.clientData.cellulare.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Dati Personali Referente */}
                <div>
                  <h4 className="text-base font-semibold text-slate-800 mb-4 flex items-center">
                    <User className="h-4 w-4 mr-2 text-slate-500" />
                    Dati Personali Referente
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="md:col-span-2">
                      <Label htmlFor="cliente_nome" className={labelClass}>
                        Signor./a *
                      </Label>
                      <Input
                        id="cliente_nome"
                        {...form.register("clientData.cliente_nome")}
                        placeholder="Nome e cognome del referente"
                        disabled={createContractMutation.isPending}
                        className={`${inputClass} ${coFillFieldClass("cliente_nome")}`}
                      />
                      {form.formState.errors.clientData?.cliente_nome && (
                        <p className="text-sm text-red-600 mt-1">
                          {form.formState.errors.clientData.cliente_nome.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="nato_a" className={labelClass}>
                        Nato a *
                      </Label>
                      <Input
                        id="nato_a"
                        {...form.register("clientData.nato_a")}
                        placeholder="Luogo di nascita"
                        disabled={createContractMutation.isPending}
                        className={`${inputClass} ${coFillFieldClass("nato_a")}`}
                      />
                      {form.formState.errors.clientData?.nato_a && (
                        <p className="text-sm text-red-600 mt-1">
                          {form.formState.errors.clientData.nato_a.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="data_nascita" className={labelClass}>
                        Data di Nascita *
                      </Label>
                      <Input
                        id="data_nascita"
                        type="date"
                        {...form.register("clientData.data_nascita")}
                        disabled={createContractMutation.isPending}
                        className={`${inputClass} ${coFillFieldClass("data_nascita")}`}
                      />
                      {form.formState.errors.clientData?.data_nascita && (
                        <p className="text-sm text-red-600 mt-1">
                          {form.formState.errors.clientData.data_nascita.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="residente_a" className={labelClass}>
                        Residente a *
                      </Label>
                      <Input
                        id="residente_a"
                        {...form.register("clientData.residente_a")}
                        placeholder="Città di residenza"
                        disabled={createContractMutation.isPending}
                        className={`${inputClass} ${coFillFieldClass("residente_a")}`}
                      />
                      {form.formState.errors.clientData?.residente_a && (
                        <p className="text-sm text-red-600 mt-1">
                          {form.formState.errors.clientData.residente_a.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="indirizzo_residenza" className={labelClass}>
                        Indirizzo di Residenza *
                      </Label>
                      <Input
                        id="indirizzo_residenza"
                        {...form.register("clientData.indirizzo_residenza")}
                        placeholder="Via, numero civico, CAP"
                        disabled={createContractMutation.isPending}
                        className={`${inputClass} ${coFillFieldClass("indirizzo_residenza")}`}
                      />
                      {form.formState.errors.clientData?.indirizzo_residenza && (
                        <p className="text-sm text-red-600 mt-1">
                          {form.formState.errors.clientData.indirizzo_residenza.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Payment */}
            <div id="section-payment" className="border-t border-gray-100 pt-8 mt-8">
              <h3 className="text-xl font-semibold text-slate-900 flex items-center mb-6">
                <Euro className="mr-3 h-5 w-5 text-indigo-600" />
                Modello di Pagamento
              </h3>
              <div className="space-y-6">
                {/* Partnership Mode Toggle - iOS style */}
                <div
                  className={`p-5 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                    isPercentageMode
                      ? "border-indigo-300 bg-indigo-50/30"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => {
                    const newMode = !isPercentageMode;
                    setIsPercentageMode(newMode);
                    form.setValue("isPercentagePartnership", newMode);
                    if (newMode) {
                      form.setValue("totalValue", undefined);
                      form.clearErrors("totalValue");
                    } else {
                      form.setValue("partnershipPercentage", undefined);
                      form.clearErrors("partnershipPercentage");
                    }
                    form.trigger();
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 mr-6">
                      <h4 className="text-base font-semibold text-slate-900 mb-1">
                        Modello Partnership Avanzato
                      </h4>
                      <p className="text-sm text-slate-500">
                        Attiva per partnership basata su percentuale del fatturato totale
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <div className={`w-14 h-7 rounded-full transition-all duration-300 relative ${
                        isPercentageMode ? "bg-indigo-600" : "bg-gray-200"
                      }`}>
                        <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 ${
                          isPercentageMode ? "left-[30px]" : "left-0.5"
                        }`} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Show either fixed price or percentage based on mode */}
                {!isPercentageMode ? (
                  <div className="max-w-md">
                    <Label htmlFor="totalValue" className={labelClass}>
                      Prezzo Totale *
                    </Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium">€</span>
                      <Input
                        id="totalValue"
                        type="number"
                        step="0.01"
                        min="0"
                        {...form.register("totalValue", { valueAsNumber: true })}
                        placeholder="0.00"
                        className={`${inputClass} pl-9`}
                        disabled={createContractMutation.isPending}
                      />
                    </div>
                    {form.formState.errors.totalValue && (
                      <p className="text-sm text-red-600 mt-2">
                        {form.formState.errors.totalValue.message}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="max-w-md">
                      <Label htmlFor="partnershipPercentage" className={labelClass}>
                        Percentuale sul Fatturato Totale *
                      </Label>
                      <div className="relative">
                        <Input
                          id="partnershipPercentage"
                          type="number"
                          step="0.01"
                          min="0.01"
                          max="100"
                          {...form.register("partnershipPercentage", { valueAsNumber: true })}
                          placeholder="0.00"
                          className={`${inputClass} pr-9`}
                          disabled={createContractMutation.isPending}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium">%</span>
                      </div>
                      <p className="text-sm text-slate-500 mt-2 flex items-center">
                        <Info className="h-3.5 w-3.5 mr-1.5 text-slate-400 flex-shrink-0" />
                        La percentuale sarà applicata sul fatturato TOTALE del ristorante
                      </p>
                      {form.formState.errors.partnershipPercentage && (
                        <p className="text-sm text-red-600 mt-2">
                          {form.formState.errors.partnershipPercentage.message}
                        </p>
                      )}
                    </div>

                    {/* Anteprima Clausole Partnership */}
                    {form.watch("partnershipPercentage") && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-slate-700">
                          Clausole Partnership
                        </h4>
                        <ul className="space-y-2 text-sm text-slate-600">
                          <li className="flex items-start">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 mr-3 flex-shrink-0" />
                            <div><span className="font-medium text-slate-700">Fatturato Totale:</span> tutti i ricavi lordi dell'attività inclusi vendite, catering, delivery, eventi.</div>
                          </li>
                          <li className="flex items-start">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 mr-3 flex-shrink-0" />
                            <div><span className="font-medium text-slate-700">Pagamento:</span> calcolo mensile su fatturato del mese precedente, entro il 15 del mese successivo.</div>
                          </li>
                          <li className="flex items-start">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 mr-3 flex-shrink-0" />
                            <div><span className="font-medium text-slate-700">Documentazione:</span> estratti cassa/POS, fatture emesse, dichiarazioni IVA, report certificati.</div>
                          </li>
                          <li className="flex items-start">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 mr-3 flex-shrink-0" />
                            <div><span className="font-medium text-slate-700">Penali:</span> 2% dell'importo dovuto per ogni mese di ritardo + interessi legali.</div>
                          </li>
                        </ul>
                        <p className="text-xs text-slate-400 italic">
                          Queste clausole verranno inserite automaticamente nel contratto e nel PDF finale.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Payment Calculator - Only show when total value is set and not in percentage mode */}
            {currentTotalValue > 0 && !currentIsPercentageMode && (
              <div className="border-t border-gray-100 pt-8 mt-8">
                <h3 className="text-xl font-semibold text-slate-900 flex items-center mb-6">
                  <Calculator className="mr-3 h-5 w-5 text-indigo-600" />
                  Calcolo Rate di Pagamento
                </h3>
                <div className="space-y-6">
                  {/* Switch tra modalità */}
                  <div className="flex gap-3">
                    <label className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                      rataListFields.fields.length === 0 ? "border-indigo-300 bg-indigo-50/30" : "border-gray-200 hover:border-gray-300"
                    }`}>
                      <input
                        type="radio"
                        name="paymentMode"
                        value="automatic"
                        checked={rataListFields.fields.length === 0}
                        onChange={() => {
                          const fieldCount = rataListFields.fields.length;
                          for (let i = fieldCount - 1; i >= 0; i--) {
                            rataListFields.remove(i);
                          }
                        }}
                        className="h-4 w-4 text-indigo-600"
                      />
                      <span className="text-sm font-medium text-slate-700">Calcolo Automatico</span>
                    </label>
                    <label className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                      rataListFields.fields.length > 0 ? "border-indigo-300 bg-indigo-50/30" : "border-gray-200 hover:border-gray-300"
                    }`}>
                      <input
                        type="radio"
                        name="paymentMode"
                        value="manual"
                        checked={rataListFields.fields.length > 0}
                        onChange={() => {
                          if (rataListFields.fields.length === 0) {
                            const today = new Date().toISOString().split('T')[0];
                            const nextMonth = new Date();
                            nextMonth.setMonth(nextMonth.getMonth() + 1);
                            const nextMonthStr = nextMonth.toISOString().split('T')[0];
                            
                            rataListFields.append({ rata_importo: 0, rata_scadenza: today });
                            rataListFields.append({ rata_importo: 0, rata_scadenza: nextMonthStr });
                          }
                        }}
                        className="h-4 w-4 text-indigo-600"
                      />
                      <span className="text-sm font-medium text-slate-700">Rate Personalizzate</span>
                    </label>
                  </div>

                  {/* Calcolo Automatico Rate */}
                  {rataListFields.fields.length === 0 && (
                    <div>
                      <PaymentCalculatorAdvanced
                        totalAmount={currentTotalValue}
                        onPaymentPlanChange={(paymentPlan) => {
                          console.log("Calcolo automatico completato:", paymentPlan);
                          form.setValue("clientData.payment_plan", paymentPlan);
                        }}
                      />
                      <p className="text-sm text-slate-500 mt-4 flex items-center">
                        <Info className="h-3.5 w-3.5 mr-1.5 text-slate-400 flex-shrink-0" />
                        Le rate vengono calcolate automaticamente in base alla frequenza selezionata.
                      </p>
                    </div>
                  )}

                  {/* Rate Personalizzate */}
                  {rataListFields.fields.length > 0 && (
                    <div>
                      <p className="text-sm text-slate-500 mb-4">
                        Inserisci manualmente gli importi e le scadenze per ogni rata
                      </p>
                      
                      {/* Validazione Somma */}
                      {rataListFields.fields.length > 0 && (
                        <div className="mb-4 flex items-center text-sm text-slate-600">
                          <AlertTriangle className="h-4 w-4 mr-2 text-amber-500 flex-shrink-0" />
                          <span>
                            Totale rate: <strong>{
                              rataListFields.fields.reduce((sum, field, index) => {
                                const value = form.watch(`clientData.rata_list.${index}.rata_importo`) || 0;
                                return sum + Number(value);
                              }, 0).toFixed(2)
                            }€</strong> / Prezzo totale: <strong>{currentTotalValue}€</strong>
                          </span>
                        </div>
                      )}
                      
                      {/* Lista Rate Personalizzate */}
                      <div className="space-y-3 mb-4">
                        {rataListFields.fields.map((field, index) => (
                          <div key={field.id} className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50/50">
                            <div className="flex-1 grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs text-slate-500 mb-1 block">Importo (€)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  {...form.register(`clientData.rata_list.${index}.rata_importo`, { valueAsNumber: true })}
                                  placeholder="0.00"
                                  className="h-10 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 text-sm"
                                  disabled={createContractMutation.isPending}
                                />
                              </div>
                              <div>
                                <Label className="text-xs text-slate-500 mb-1 block">Scadenza</Label>
                                <Input
                                  type="date"
                                  {...form.register(`clientData.rata_list.${index}.rata_scadenza`)}
                                  className="h-10 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 text-sm"
                                  disabled={createContractMutation.isPending}
                                />
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => rataListFields.remove(index)}
                              disabled={createContractMutation.isPending}
                              className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg flex-shrink-0"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      {/* Bottone Aggiungi Rata */}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const lastIndex = rataListFields.fields.length - 1;
                          const lastDate = lastIndex >= 0 ? form.getValues(`clientData.rata_list.${lastIndex}.rata_scadenza`) : null;
                          
                          let nextDate;
                          if (lastDate) {
                            const date = new Date(lastDate);
                            date.setMonth(date.getMonth() + 1);
                            nextDate = date.toISOString().split('T')[0];
                          } else {
                            nextDate = new Date().toISOString().split('T')[0];
                          }
                          
                          rataListFields.append({ rata_importo: 0, rata_scadenza: nextDate });
                        }}
                        disabled={createContractMutation.isPending}
                        className="h-10 px-4 rounded-xl border border-gray-200 text-slate-700 hover:bg-gray-50"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Aggiungi Rata Personalizzata
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Section 4: Contract Duration */}
            <div id="section-duration" className="border-t border-gray-100 pt-8 mt-8">
              <h3 className="text-xl font-semibold text-slate-900 flex items-center mb-6">
                <Calendar className="mr-3 h-5 w-5 text-indigo-600" />
                Durata Contratto
              </h3>
              <div className="space-y-5">
                <p className="text-sm text-slate-500 flex items-center">
                  <Info className="h-3.5 w-3.5 mr-1.5 text-slate-400 flex-shrink-0" />
                  Tutti i contratti si rinnovano automaticamente alle stesse condizioni
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <Label htmlFor="contractStartDate" className={labelClass}>
                      Data Inizio Contratto *
                    </Label>
                    <Input
                      id="contractStartDate"
                      type="date"
                      {...form.register("contractStartDate")}
                      className={inputClass}
                      disabled={createContractMutation.isPending}
                    />
                    <p className="text-xs text-slate-400 mt-1.5">
                      Data di inizio validità del contratto
                    </p>
                    {form.formState.errors.contractStartDate && (
                      <p className="text-sm text-red-600 mt-1">
                        {form.formState.errors.contractStartDate.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="contractEndDate" className={labelClass}>
                      Data Fine Contratto *
                    </Label>
                    <Input
                      id="contractEndDate"
                      type="date"
                      {...form.register("contractEndDate")}
                      className={inputClass}
                      disabled={createContractMutation.isPending}
                    />
                    <p className="text-xs text-slate-400 mt-1.5">
                      Data di scadenza prima del rinnovo
                    </p>
                    {form.formState.errors.contractEndDate && (
                      <p className="text-sm text-red-600 mt-1">
                        {form.formState.errors.contractEndDate.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="renewalDuration" className={labelClass}>
                      Durata Rinnovo (mesi)
                    </Label>
                    <Input
                      id="renewalDuration"
                      type="number"
                      min="1"
                      max="60"
                      {...form.register("renewalDuration", { valueAsNumber: true })}
                      placeholder="12"
                      className={inputClass}
                      disabled={createContractMutation.isPending}
                    />
                    <p className="text-xs text-slate-400 mt-1.5">
                      Durata del rinnovo automatico
                    </p>
                    {form.formState.errors.renewalDuration && (
                      <p className="text-sm text-red-600 mt-1">
                        {form.formState.errors.renewalDuration.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 5: Bonus */}
            <div id="section-bonus" className="border-t border-gray-100 pt-8 mt-8">
              <h3 className="text-xl font-semibold text-slate-900 flex items-center mb-6">
                <Gift className="mr-3 h-5 w-5 text-indigo-600" />
                Bonus e Servizi Inclusi
              </h3>
              <div className="space-y-6">
                {/* Show predefined bonuses from template */}
                {selectedTemplate?.predefinedBonuses && selectedTemplate.predefinedBonuses.length > 0 && (
                  <div className="space-y-3">
                    <Label className={labelClass}>
                      Bonus Predefiniti dal Template:
                    </Label>
                    <div className="grid gap-2">
                      {selectedTemplate.predefinedBonuses.map((bonus: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-3 rounded-xl border border-gray-200 bg-gray-50/50">
                          <span className="font-medium text-slate-800 text-sm">{bonus.description}</span>
                          {bonus.value && (
                            <span className="text-xs font-medium text-slate-500 bg-gray-200/60 px-2.5 py-1 rounded-lg">
                              {bonus.value}{bonus.type === 'percentage' ? '%' : '€'}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom bonus fields */}
                {bonusFields.fields.length > 0 ? (
                  <DynamicFormFields
                    title="Bonus Aggiuntivi"
                    fields={bonusFields.fields}
                    onAdd={() => bonusFields.append({ bonus_descrizione: "" })}
                    onRemove={bonusFields.remove}
                    disabled={createContractMutation.isPending}
                    renderField={(field, index) => (
                      <div key={field.id} className="flex items-center gap-3">
                        <Input
                          {...form.register(`clientData.bonus_list.${index}.bonus_descrizione`)}
                          placeholder="Descrizione bonus personalizzato..."
                          disabled={createContractMutation.isPending}
                          className={`flex-1 ${inputClass}`}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => bonusFields.remove(index)}
                          disabled={createContractMutation.isPending}
                          className="h-10 w-10 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  />
                ) : (
                  <div className="text-center py-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => bonusFields.append({ bonus_descrizione: "" })}
                      disabled={createContractMutation.isPending}
                      className="h-10 px-4 rounded-xl border border-gray-200 text-slate-700 hover:bg-gray-50"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Aggiungi Bonus Personalizzato
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Section 6: Email / Send */}
            <div id="section-send" className="border-t border-gray-100 pt-8 mt-8">
              <h3 className="text-xl font-semibold text-slate-900 flex items-center mb-6">
                <Send className="mr-3 h-5 w-5 text-indigo-600" />
                Invio Contratto
              </h3>
              <div className="space-y-5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleOpenPreview}
                  disabled={previewLoading || isSubmitting}
                  className="h-12 w-full sm:w-auto rounded-xl border border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300"
                  data-testid="button-preview-contract"
                >
                  {previewLoading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Caricamento anteprima…</>
                  ) : (
                    <><Eye className="h-4 w-4 mr-2" />Anteprima contratto</>
                  )}
                </Button>
                <p className="text-xs text-slate-500 -mt-3">
                  Visualizza il documento esattamente come lo vedrà il cliente, prima di inviarlo.
                </p>

                <div>
                  <Label htmlFor="sendToEmail" className={labelClass}>Email per l'invio del contratto</Label>
                  <Input
                    id="sendToEmail"
                    type="email"
                    value={sendToEmail}
                    onChange={(e) => setSendToEmail(e.target.value)}
                    placeholder="email@esempio.com"
                    disabled={isSubmitting}
                    className={inputClass}
                  />
                  <p className="text-xs text-slate-400 mt-1.5">
                    Email dove verrà inviato il contratto (può essere diversa da quella nel contratto)
                  </p>
                </div>

                {!emailConfigured && (
                  <EmailConfigBanner compact className="mb-2" />
                )}

                <div
                  className={`p-5 rounded-xl border-2 transition-all duration-200 ${
                    !emailConfigured
                      ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-70"
                      : sendImmediately
                      ? "border-indigo-300 bg-indigo-50/30 cursor-pointer"
                      : "border-gray-200 hover:border-gray-300 cursor-pointer"
                  }`}
                  onClick={() => {
                    if (!emailConfigured) return;
                    setSendImmediately(!sendImmediately);
                  }}
                  data-testid="toggle-send-immediately"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 mr-6">
                      <h4 className="text-sm font-semibold text-slate-900">
                        Invia immediatamente al cliente
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {emailConfigured
                          ? "Il contratto verrà inviato subito dopo la generazione"
                          : "Disponibile dopo aver configurato l'email aziendale"}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <div className={`w-14 h-7 rounded-full transition-all duration-300 relative ${
                        emailConfigured && sendImmediately ? "bg-indigo-600" : "bg-gray-200"
                      }`}>
                        <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 ${
                          emailConfigured && sendImmediately ? "left-[30px]" : "left-0.5"
                        }`} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Spacer for sticky footer */}
            <div className="h-4" />
            </form>
          </div>
          <MissingDataPanel
            variant="sidebar"
            className="hidden lg:flex w-[320px] flex-shrink-0"
            clientData={watchedClientData}
            onJumpToField={jumpToClientField}
          />
        </div>

        {/* Footer - Sticky */}
        <div className="sticky bottom-0 z-10 bg-white/95 backdrop-blur-sm border-t border-gray-100 py-4 px-8 flex justify-end gap-3 flex-shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={createContractMutation.isPending}
            className="h-12 min-w-[160px] rounded-xl border border-gray-200 text-slate-700 hover:bg-gray-50"
          >
            Annulla
          </Button>
          <Button
            type="submit"
            form="contract-form"
            disabled={createContractMutation.isPending}
            className="h-12 min-w-[160px] rounded-xl bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white shadow-lg hover:shadow-xl transition-all duration-200"
            onClick={() => {
              console.log("Submit button clicked");
              console.log("Form values:", form.getValues());
              console.log("Form errors:", form.formState.errors);
              console.log("Is valid:", form.formState.isValid);
              console.log("Partnership mode:", isPercentageMode);
              console.log("Partnership percentage:", form.getValues("partnershipPercentage"));
            }}
          >
            {createContractMutation.isPending 
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generazione...</>
              : isEditing ? "Aggiorna Contratto" : "Genera e Invia Contratto"
            }
          </Button>
        </div>
      </DialogContent>

      {previewOpen && previewData && (() => {
        const values = form.getValues();
        const cd: any = values.clientData || {};
        const usingCustomInstallments = Array.isArray(cd.rata_list) && cd.rata_list.length > 0;
        const rawPaymentData = usingCustomInstallments ? cd.rata_list : (cd.payment_plan || []);
        const paymentPlan = rawPaymentData
          .map((p: any, i: number) => ({
            rata_numero: i + 1,
            rata_importo: String(p.rata_importo ?? p.amount ?? "0.00"),
            rata_scadenza: String(p.rata_scadenza ?? p.date ?? ""),
          }))
          .filter((p: any) => p.rata_importo && p.rata_importo !== "0.00" && p.rata_scadenza);

        const predefined = Array.isArray(previewData.template?.predefinedBonuses)
          ? previewData.template.predefinedBonuses.map((b: any) => ({
              bonus_descrizione:
                (b.description || "") +
                (b.value ? ` (${b.value}${b.type === "percentage" ? "%" : "€"})` : ""),
            }))
          : [];
        const manual = Array.isArray(cd.bonus_list)
          ? cd.bonus_list.filter((b: any) => b?.bonus_descrizione)
          : [];
        const bonusList = [...predefined, ...manual];

        return (
          <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
            <DialogContent className="max-w-[1100px] w-[95vw] max-h-[95vh] p-0 rounded-[20px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.15)] border-0 overflow-hidden bg-slate-50 flex flex-col">
              <div className="p-6 bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] text-white flex-shrink-0">
                <DialogHeader>
                  <DialogTitle className="flex items-center text-xl font-bold text-white">
                    <Eye className="h-5 w-5 mr-2" />
                    Anteprima contratto
                  </DialogTitle>
                  <DialogDescription className="text-white/80 mt-1">
                    Stai vedendo il documento esattamente come apparirà al cliente. Nessun dato viene salvato.
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-8">
                <ProfessionalContractDocument
                  mode="preview"
                  hidePlaceholders
                  companySettings={previewData.companySettings || {}}
                  clientData={cd}
                  template={{
                    ...previewData.template,
                    // Use the server-rendered HTML so the preview matches
                    // exactly what the send pipeline produces.
                    content: previewData.generatedContent || previewData.template?.content,
                  }}
                  contract={{
                    createdAt: new Date().toISOString(),
                    status: "draft",
                    isPercentagePartnership: !!values.isPercentagePartnership,
                    partnershipPercentage: values.partnershipPercentage,
                    renewalDuration: values.renewalDuration,
                    contractStartDate: values.contractStartDate,
                    contractEndDate: values.contractEndDate,
                  }}
                  paymentPlan={paymentPlan}
                  bonusList={bonusList}
                  usingCustomInstallments={usingCustomInstallments}
                />
              </div>

              <div className="sticky bottom-0 z-10 bg-white border-t border-gray-100 py-4 px-6 flex justify-end gap-3 flex-shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPreviewOpen(false)}
                  className="h-11 min-w-[140px] rounded-xl border border-gray-200 text-slate-700 hover:bg-gray-50"
                  data-testid="button-close-preview"
                >
                  Chiudi
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setPreviewOpen(false);
                    scrollToSection("section-send");
                  }}
                  className="h-11 min-w-[180px] rounded-xl bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white shadow-lg hover:shadow-xl"
                  data-testid="button-proceed-from-preview"
                >
                  Procedi all'invio
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
    </Dialog>
    </>
  );
}