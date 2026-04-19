import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { File, Save, X, User, Building, Euro, Plus, FileText, Calculator, Users, CheckCircle, XCircle, Loader2, MapPin, Phone, Mail, Calendar, Send, Gift, Check, Info, AlertTriangle, Eye, Sparkles, BookmarkPlus, Layers } from "lucide-react";
import type { ContractPreset } from "@shared/schema";
import type { LucideIcon } from "lucide-react";
import type { FieldErrors, FieldPath } from "react-hook-form";
import DynamicFormFields from "./dynamic-form-fields";
import ProfessionalContractDocument from "./professional-contract-document";
import PaymentCalculatorAdvanced from "./payment-calculator-advanced";
import EmailConfigBanner, { useEmailStatus } from "./email-config-banner";
import MissingDataPanel from "./missing-data-panel";
import CoFillDialog from "./co-fill-dialog";
import SendConfirmationGate, { type SendGateEmailData, type SendGatePreviewData } from "./send-confirmation-gate";
import { REQUIRED_CLIENT_FIELDS, SYNCED_FIELD_KEYS, getRequiredClientFields, getClientType, type RequiredClientField, type ClientType } from "@/lib/required-client-fields";
import { validatePartitaIva, validateCodiceFiscale, detectVATorCF, validateItalianMobile, looksLikeAddress, ITALIAN_PROVINCES } from "@/lib/validation-utils";
import { resolveSelectedSections, defaultSelectedIds, parseSections, type ModularSection } from "@shared/sections";
import SectionPreviewDialog from "./section-preview-dialog";
import ContractRecapPanel, { type ContractRecapData } from "./contract-recap-panel";
import { ChevronLeft, ChevronRight, Pencil } from "lucide-react";

function getTemplateSections(t: unknown): ModularSection[] {
  return parseSections((t as { sections?: unknown } | null | undefined)?.sections);
}

const contractFormSchema = z.object({
  templateId: z.number().min(1, "Seleziona un template"),
  clientData: z.object({
    // Tipo cliente: "azienda" (default) o "privato"
    tipo_cliente: z.enum(["azienda", "privato"]).default("azienda"),

    // Company/Client info (per privato: societa = "Cognome e Nome")
    // I campi anagrafici sono opzionali a livello di schema base; quando il
    // venditore compila in prima persona ("seller") li rendiamo
    // obbligatori in superRefine. In modalità "client_fill" basta l'email.
    societa: z.string().optional(),
    sede: z.string().optional(),
    provincia_sede: z.string().optional(),
    indirizzo: z.string().optional(),
    p_iva: z.string().optional(),
    pec: z.string().optional(),
    email: z.string().email("Email non valida"),
    cellulare: z
      .string()
      .optional()
      .refine(
        (v) => !v || validateItalianMobile(v),
        "Inserisci un cellulare italiano valido (es. +39 333 123 4567)",
      ),
    codice_univoco: z.string().optional(),

    // Personal info
    cliente_nome: z.string().optional(),
    nato_a: z.string().optional(),
    residente_a: z.string().optional(),
    provincia_residenza: z.string().optional(),
    indirizzo_residenza: z.string().optional(),
    data_nascita: z.string().optional(),
    stesso_indirizzo: z.boolean().optional(),

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
  autoRenewal: z.boolean().default(true),
  renewalDuration: z.number().min(1).max(60).default(12),
  contractStartDate: z.string().optional().default(""),
  contractEndDate: z.string().optional().default(""),
  isPercentagePartnership: z.boolean().default(false),
  partnershipPercentage: z.number().min(0.01).max(100).optional(),
  selectedSectionIds: z.array(z.string()).default([]).optional(),
  fillMode: z.enum(["seller", "client_fill"]).default("seller"),
}).refine((data) => {
  // In modalità "client_fill" anche le condizioni economiche possono
  // essere lasciate vuote dal venditore: il cliente le vedrà comunque
  // come anteprima e firmerà. Il refine si attiva solo per "seller".
  if (data.fillMode === "client_fill") return true;
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
}).refine((data) => {
  // Data fine contratto deve essere >= data inizio contratto
  if (data.contractStartDate && data.contractEndDate) {
    return data.contractEndDate >= data.contractStartDate;
  }
  return true;
}, {
  message: "La data di fine contratto deve essere successiva o uguale alla data di inizio",
  path: ["contractEndDate"]
}).superRefine((data, ctx) => {
  // In modalità "client_fill" l'unica cosa richiesta sui dati cliente è
  // l'email (già validata dallo schema). Tutto il resto verrà compilato
  // dal cliente sul link, quindi saltiamo le validazioni di obbligo.
  if (data.fillMode === "client_fill") return;

  // Date contratto obbligatorie quando compila il venditore
  if (!data.contractStartDate || !data.contractStartDate.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["contractStartDate"], message: "Data inizio contratto richiesta" });
  }
  if (!data.contractEndDate || !data.contractEndDate.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["contractEndDate"], message: "Data fine contratto richiesta" });
  }

  // Anagrafici obbligatori quando compila il venditore
  const requiredAnagrafici: Array<[string, string]> = [
    ["societa", "Campo richiesto"],
    ["sede", "Città richiesta"],
    ["indirizzo", "Indirizzo richiesto"],
    ["p_iva", "Codice Fiscale/P.IVA richiesto"],
    ["cellulare", "Numero di cellulare richiesto"],
    ["nato_a", "Luogo di nascita richiesto"],
    ["residente_a", "Città richiesta"],
    ["indirizzo_residenza", "Indirizzo di residenza richiesto"],
    ["data_nascita", "Data di nascita richiesta"],
  ];
  for (const [field, msg] of requiredAnagrafici) {
    const v = (data.clientData as any)[field];
    if (!v || (typeof v === "string" && !v.trim())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["clientData", field], message: msg });
    }
  }

  // Validazione condizionale tipo_cliente
  const tipo = data.clientData.tipo_cliente || "azienda";
  if (tipo === "privato") {
    // Per i privati il campo p_iva DEVE essere un Codice Fiscale valido (16 char)
    const v = (data.clientData.p_iva || "").toUpperCase().replace(/\s/g, "");
    if (!validateCodiceFiscale(v)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["clientData", "p_iva"],
        message: "Per un cliente privato serve un Codice Fiscale valido (16 caratteri)",
      });
    }
  } else {
    // Per le aziende il referente è obbligatorio
    if (!data.clientData.cliente_nome || !data.clientData.cliente_nome.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["clientData", "cliente_nome"],
        message: "Nome del referente richiesto",
      });
    }
    // Per le aziende il campo p_iva deve essere una P.IVA valida (11 cifre)
    // oppure un Codice Fiscale valido (società di persone / ditta individuale).
    const v = (data.clientData.p_iva || "").toUpperCase().replace(/\s/g, "");
    const t = detectVATorCF(v);
    const isValid =
      (t === "vat" && validatePartitaIva(v)) ||
      (t === "cf" && validateCodiceFiscale(v));
    if (!isValid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["clientData", "p_iva"],
        message: "Inserisci una Partita IVA (11 cifre) o un Codice Fiscale valido",
      });
    }
  }
});

type ContractForm = z.infer<typeof contractFormSchema>;

interface ContractFormProps {
  onClose: () => void;
  contract?: any; // Optional: Pass the contract data for editing
}

// === Wizard a 5 step ===
// Ogni step elenca i campi RHF da validare prima di poter andare avanti.
// I campi cliente sono validati solo in modalità "seller" (in "client_fill"
// basta l'email perché i dati li compila il cliente sul link).
interface WizardStepConfig {
  id: number;
  label: string;
  icon: LucideIcon;
  sectionId: string;
  validateFields?: (mode: "seller" | "client_fill") => string[];
}
const WIZARD_STEPS: WizardStepConfig[] = [
  {
    id: 1,
    label: "Template & Preset",
    icon: FileText,
    sectionId: "section-template",
    validateFields: () => ["templateId"],
  },
  {
    id: 2,
    label: "Cliente",
    icon: Users,
    sectionId: "section-client",
    validateFields: (mode) => {
      const base = ["clientData.email"];
      if (mode === "client_fill") return base;
      return [
        ...base,
        "clientData.societa",
        "clientData.sede",
        "clientData.indirizzo",
        "clientData.p_iva",
        "clientData.cellulare",
        "clientData.cliente_nome",
        "clientData.nato_a",
        "clientData.residente_a",
        "clientData.indirizzo_residenza",
        "clientData.data_nascita",
      ];
    },
  },
  {
    id: 3,
    label: "Pacchetti & Bonus",
    icon: Layers,
    sectionId: "section-modular-sections",
    validateFields: () => [],
  },
  {
    id: 4,
    label: "Prezzo & Durata",
    icon: Euro,
    sectionId: "section-payment",
    validateFields: (mode) => {
      if (mode === "client_fill") return [];
      return ["totalValue", "partnershipPercentage", "contractStartDate", "contractEndDate"];
    },
  },
  {
    id: 5,
    label: "Riepilogo & Invio",
    icon: Send,
    sectionId: "section-send",
    validateFields: () => [],
  },
];
const TOTAL_STEPS = WIZARD_STEPS.length;

const inputClass = "h-12 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 hover:border-gray-300 transition-all duration-200";
const labelClass = "text-sm font-medium text-slate-700 mb-2 block";

export default function ContractForm({ onClose, contract }: ContractFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(contract?.templateId || null);
  const [sendImmediately, setSendImmediately] = useState(false);
  const { data: emailStatus } = useEmailStatus();
  const emailConfigured = emailStatus?.configured !== false;
  const [sendToEmail, setSendToEmail] = useState(contract?.sentToEmail || "");
  // Modalità di compilazione: "seller" (default, il venditore compila tutto)
  // oppure "client_fill" (il cliente compila i propri dati e firma in autonomia).
  const [fillMode, setFillMode] = useState<"seller" | "client_fill">(
    ((contract as any)?.fillMode === "client_fill") ? "client_fill" : "seller"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPercentageMode, setIsPercentageMode] = useState(contract?.isPercentagePartnership || false);
  const [vatValidation, setVatValidation] = useState<{ isValid: boolean | null; type: 'vat' | 'cf' | null; isValidating: boolean }>({ 
    isValid: null, 
    type: null, 
    isValidating: false 
  });
  const isEditing = !!contract; // Determine if we are editing an existing contract
  // In modifica si parte direttamente dallo step Riepilogo, così l'utente
  // vede tutti i dati e decide cosa cambiare (niente re-attraversamento).
  const [currentStep, setCurrentStep] = useState<number>(isEditing ? TOTAL_STEPS : 1);
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(
    () => new Set(isEditing ? [1, 2, 3, 4, 5] : [1]),
  );
  const [stepBanner, setStepBanner] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Preview modal state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<{ template: any; companySettings: any; generatedContent: string } | null>(null);

  // Anteprima singolo modulo (icona occhio nella checklist sezioni)
  const [previewSectionId, setPreviewSectionId] = useState<string | null>(null);

  // Send-confirmation gate state
  const [gateOpen, setGateOpen] = useState(false);
  const [gateLoading, setGateLoading] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);
  const [gatePreviewData, setGatePreviewData] = useState<SendGatePreviewData | null>(null);
  const [gateEmailData, setGateEmailData] = useState<SendGateEmailData | null>(null);
  // Riferimento per le opzioni di invio dell'ultima sottomissione (draft vs send),
  // letto da onSubmit. Evita l'asincronia di setState quando lanciamo
  // form.handleSubmit() programmaticamente.
  const sendArgsRef = useRef<{
    send: boolean;
    previewToken: string | null;
    canonicalPayload: Record<string, any> | null;
  }>({ send: false, previewToken: null, canonicalPayload: null });

  // Preset Offerta state
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");
  const [appliedPresetName, setAppliedPresetName] = useState<string | null>(null);
  const [presetMissingTemplate, setPresetMissingTemplate] = useState(false);
  const [savePresetDialogOpen, setSavePresetDialogOpen] = useState(false);
  const [savePresetName, setSavePresetName] = useState("");
  const [savePresetDescription, setSavePresetDescription] = useState("");
  const [savePresetVisibility, setSavePresetVisibility] = useState<"personal" | "shared">("personal");

  // Co-fill (real-time client-seller fill) state
  const [coFillDialogOpen, setCoFillDialogOpen] = useState(false);
  const [coFillToken, setCoFillToken] = useState<string | null>(contract?.coFillToken || null);
  // When the seller starts a co-fill from a "new contract" form, the server
  // creates a draft contract and returns its id. We track it so subsequent
  // saves go to PUT /api/contracts/:id instead of creating a duplicate.
  const [draftContractId, setDraftContractId] = useState<number | null>(null);
  const [coFillClientConnected, setCoFillClientConnected] = useState(false);
  const [coFillHighlight, setCoFillHighlight] = useState<Record<string, number>>({});
  const coFillWsRef = useRef<WebSocket | null>(null);
  const coFillClientIdRef = useRef<string>("");
  const coFillApplyingRef = useRef<boolean>(false);
  const coFillReconnectRef = useRef<any>(null);

  // Mappa sezione → step del wizard. Quando MissingDataChecklist o un altro
  // componente chiede di "saltare" a una sezione, prima portiamo l'utente
  // sullo step corretto e poi facciamo lo scroll.
  const sectionToStep = useMemo<Record<string, number>>(() => ({
    "section-template": 1,
    "section-client": 2,
    "section-modular-sections": 3,
    "section-bonus": 3,
    "section-payment": 4,
    "section-duration": 4,
    "section-send": 5,
    "section-summary": 5,
  }), []);

  const scrollToSection = useCallback((sectionId: string) => {
    const targetStep = sectionToStep[sectionId];
    if (targetStep && targetStep !== currentStep) {
      setCurrentStep(targetStep);
      setVisitedSteps((prev) => {
        const n = new Set(prev);
        n.add(targetStep);
        return n;
      });
      // Lascia un tick per il render dello step prima dello scroll
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
      return;
    }
    const element = document.getElementById(sectionId);
    if (element) element.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [sectionToStep, currentStep]);

  // Validazione di uno step prima di avanzare. Restituisce true se i campi
  // obbligatori dello step sono validi (per la modalità di compilazione
  // corrente), altrimenti false e mostra un banner con il primo errore.
  const validateStep = useCallback(async (stepId: number): Promise<boolean> => {
    const step = WIZARD_STEPS.find((s) => s.id === stepId);
    if (!step?.validateFields) return true;
    const fields = step.validateFields(fillMode);
    if (fields.length === 0) return true;
    type FormValues = z.infer<typeof contractFormSchema>;
    const typedFields = fields as Array<FieldPath<FormValues>>;
    const ok = await form.trigger(typedFields, { shouldFocus: true });
    if (!ok) {
      const errs = form.formState.errors as FieldErrors<FormValues>;
      const lookupError = (path: string): string | undefined => {
        const parts = path.split(".");
        let cur: unknown = errs;
        for (const p of parts) {
          if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
            cur = (cur as Record<string, unknown>)[p];
          } else {
            return undefined;
          }
        }
        if (cur && typeof cur === "object" && "message" in cur) {
          const msg = (cur as { message?: unknown }).message;
          return typeof msg === "string" ? msg : undefined;
        }
        return undefined;
      };
      let firstMsg = "Compila i campi obbligatori prima di proseguire.";
      for (const f of fields) {
        const m = lookupError(f);
        if (m) { firstMsg = m; break; }
      }
      setStepBanner(firstMsg);
      return false;
    }
    setStepBanner(null);
    return true;
  }, [form, fillMode]);

  const goToStep = useCallback(
    async (target: number, opts?: { skipValidation?: boolean }) => {
      if (target < 1 || target > TOTAL_STEPS) return;
      // Se vado avanti, valido solo gli step intermedi non ancora visitati.
      if (!opts?.skipValidation && target > currentStep) {
        for (let s = currentStep; s < target; s++) {
          if (visitedSteps.has(s) && s !== currentStep) continue;
          // eslint-disable-next-line no-await-in-loop
          const ok = await validateStep(s);
          if (!ok) return;
        }
      }
      setStepBanner(null);
      setCurrentStep(target);
      setVisitedSteps((prev) => {
        const n = new Set(prev);
        n.add(target);
        return n;
      });
      // Focus sul primo campo dello step (a11y)
      setTimeout(() => {
        const sec = WIZARD_STEPS.find((s) => s.id === target)?.sectionId;
        if (sec) {
          const el = document.getElementById(sec);
          el?.scrollIntoView({ behavior: "smooth", block: "start" });
          const focusable = el?.querySelector<HTMLElement>("input, select, textarea, button");
          focusable?.focus({ preventScroll: true });
        }
      }, 60);
    },
    [currentStep, validateStep, visitedSteps],
  );

  const handleNext = useCallback(() => goToStep(currentStep + 1), [currentStep, goToStep]);
  const handleBack = useCallback(() => goToStep(currentStep - 1, { skipValidation: true }), [currentStep, goToStep]);
  const handleStepClick = useCallback(
    (target: number) => {
      // È possibile saltare a uno step già visitato senza validazione.
      if (visitedSteps.has(target)) {
        goToStep(target, { skipValidation: true });
      } else {
        goToStep(target);
      }
    },
    [visitedSteps, goToStep],
  );

  const { data: presets = [] } = useQuery<ContractPreset[]>({
    queryKey: ["/api/presets"],
  });

  const { data: templates = [], isLoading: templatesLoading, error: templatesError } = useQuery({
    queryKey: ["/api/templates"],
    // I template servono SEMPRE, anche in modifica bozza: senza la lista fresca
    // il selettore mostra "Nessun template disponibile" su un refresh diretto
    // e il salvataggio finisce in "Template not found".
    enabled: true,
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
      selectedSectionIds: (() => {
        const raw = (contract as { selectedSectionIds?: string[] | null } | undefined)?.selectedSectionIds;
        // Preserviamo esplicitamente un array vuoto `[]` (il venditore ha
        // deselezionato tutte le sezioni opzionali). Solo `null`/`undefined`
        // — cioè scelta davvero non espressa — attivano il fallback ai
        // `defaultSelectedIds` del template.
        return Array.isArray(raw) ? raw : undefined;
      })(),
      fillMode: ((contract as any)?.fillMode === "client_fill" ? "client_fill" : "seller") as "seller" | "client_fill",
      clientData: {
        tipo_cliente: "azienda" as const,
        societa: "",
        sede: "",
        provincia_sede: "",
        indirizzo: "",
        p_iva: "",
        pec: "",
        email: "",
        cellulare: "",
        codice_univoco: "",
        cliente_nome: "",
        nato_a: "",
        residente_a: "",
        provincia_residenza: "",
        indirizzo_residenza: "",
        data_nascita: "",
        stesso_indirizzo: false,
        bonus_list: [],
        payment_plan: [{ rata_importo: "", rata_scadenza: "" }],
        rata_list: [],
        ...(contract?.clientData || {}),
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

  // ===== Preset Offerta: applica preset al form =====
  const applyPreset = useCallback((preset: ContractPreset) => {
    // Verifica template ancora esistente
    const tplExists = preset.templateId && templates.some((t: any) => t.id === preset.templateId);
    if (preset.templateId && !tplExists) {
      setPresetMissingTemplate(true);
      setAppliedPresetName(preset.name);
      toast({
        title: "Template del preset non disponibile",
        description: "Seleziona un nuovo template per continuare con questo preset.",
        variant: "destructive",
      });
      return;
    }
    setPresetMissingTemplate(false);

    if (preset.templateId && tplExists) {
      // Segnala all'effect di reset sezioni che il prossimo cambio templateId
      // proviene dall'apply preset e NON deve azzerare le sezioni.
      presetApplyingRef.current = true;
      form.setValue("templateId", preset.templateId, { shouldDirty: true });
      setSelectedTemplateId(preset.templateId);
    }

    const sectionIds = Array.isArray(preset.selectedSectionIds) ? preset.selectedSectionIds : [];
    // Imposta sezioni dopo templateId, in modo che — anche se il reset effect
    // dovesse partire — questo setValue lo sovrascriva.
    form.setValue("selectedSectionIds", sectionIds, { shouldDirty: true });

    const bonusList = Array.isArray(preset.bonusList) ? preset.bonusList : [];
    form.setValue("clientData.bonus_list", bonusList, { shouldDirty: true });

    const paymentPlan = Array.isArray(preset.paymentPlan) ? preset.paymentPlan : [];
    form.setValue(
      "clientData.payment_plan",
      paymentPlan.length ? paymentPlan : [{ rata_importo: "", rata_scadenza: "" }],
      { shouldDirty: true },
    );

    const rataList = Array.isArray(preset.rataList) ? preset.rataList : [];
    form.setValue("clientData.rata_list", rataList, { shouldDirty: true });

    if (preset.totalValue != null) {
      const v = Number(preset.totalValue);
      if (!Number.isNaN(v)) form.setValue("totalValue", v, { shouldDirty: true });
    }

    form.setValue("isPercentagePartnership", !!preset.isPercentagePartnership, { shouldDirty: true });
    setIsPercentageMode(!!preset.isPercentagePartnership);
    if (preset.partnershipPercentage != null) {
      const p = Number(preset.partnershipPercentage);
      if (!Number.isNaN(p)) form.setValue("partnershipPercentage", p, { shouldDirty: true });
    }

    form.setValue("renewalDuration", preset.renewalDuration ?? 12, { shouldDirty: true });
    // autoRenewal: se il preset prevede rinnovo automatico, abilitalo
    if (typeof preset.autoRenewal === "boolean") {
      form.setValue("autoRenewal", preset.autoRenewal, { shouldDirty: true });
    }

    // Modalità di compilazione (seller / client_fill) preferita dal preset
    if (preset.fillMode === "client_fill" || preset.fillMode === "seller") {
      form.setValue("fillMode", preset.fillMode, { shouldDirty: true });
      setFillMode(preset.fillMode);
    }

    // Calcola data fine sulla base della durata standard del preset
    if (preset.defaultDurationMonths) {
      const startStr = form.getValues("contractStartDate") || new Date().toISOString().split("T")[0];
      const start = new Date(startStr);
      const end = new Date(start);
      end.setMonth(end.getMonth() + preset.defaultDurationMonths);
      form.setValue("contractEndDate", end.toISOString().split("T")[0], { shouldDirty: true });
      if (!form.getValues("contractStartDate")) {
        form.setValue("contractStartDate", startStr, { shouldDirty: true });
      }
    }

    setAppliedPresetName(preset.name);
    toast({
      title: "Preset applicato",
      description: `"${preset.name}" è stato caricato. Compila i dati cliente per finalizzare.`,
    });
  }, [form, templates, toast]);

  const handlePresetSelect = (id: string) => {
    setSelectedPresetId(id);
    if (!id || id === "__none__") return;
    const preset = presets.find((p) => p.id.toString() === id);
    if (preset) applyPreset(preset);
  };

  const savePresetMutation = useMutation({
    mutationFn: async (meta: { name: string; description: string; visibility: "personal" | "shared" }) => {
      const formValues = form.getValues();
      const payload = {
        meta,
        contractForm: {
          templateId: formValues.templateId,
          selectedSectionIds: formValues.selectedSectionIds || [],
          totalValue: formValues.totalValue,
          isPercentagePartnership: formValues.isPercentagePartnership,
          partnershipPercentage: formValues.partnershipPercentage,
          autoRenewal: Boolean(formValues.autoRenewal),
          renewalDuration: formValues.renewalDuration,
          fillMode: formValues.fillMode || "seller",
          defaultDurationMonths: (() => {
            // Calcola la durata in mesi dalla differenza tra start ed end
            const s = formValues.contractStartDate ? new Date(formValues.contractStartDate) : null;
            const e = formValues.contractEndDate ? new Date(formValues.contractEndDate) : null;
            if (!s || !e || isNaN(s.getTime()) || isNaN(e.getTime())) return undefined;
            const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
            return months > 0 ? months : undefined;
          })(),
          clientData: {
            bonus_list: formValues.clientData?.bonus_list || [],
            payment_plan: formValues.clientData?.payment_plan || [],
            rata_list: formValues.clientData?.rata_list || [],
          },
        },
      };
      return await apiRequest("POST", "/api/presets/from-contract-form", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/presets"] });
      toast({ title: "Preset salvato", description: "Lo trovi nella sezione Preset Offerta." });
      setSavePresetDialogOpen(false);
      setSavePresetName("");
      setSavePresetDescription("");
      setSavePresetVisibility("personal");
    },
    onError: (err: any) => {
      toast({ title: "Errore salvataggio preset", description: err.message || "Riprova", variant: "destructive" });
    },
  });

  const createContractMutation = useMutation({
    mutationFn: async (contractData: Record<string, any>) => {
      // ATTENZIONE: il payload arriva qui GIÀ canonicalizzato da
      // `buildCanonicalSendPayload` (totalValue in cents, clientData
      // filtrato, ecc.). Non riapplicare conversioni: il server verifica
      // un hash byte-identico al payload firmato da /api/contracts/preview.
      setIsSubmitting(true);
      if (isEditing) {
        return await apiRequest("PUT", `/api/contracts/${contract.id}`, contractData);
      } else if (draftContractId) {
        // A co-fill draft already exists server-side: update it instead of
        // creating a duplicate contract.
        return await apiRequest("PUT", `/api/contracts/${draftContractId}`, contractData);
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
    // In modalità "client_fill" l'anteprima mostra solo le condizioni
    // commerciali con i dati anagrafici come placeholder: non blocchiamo
    // il venditore se l'anagrafica non è ancora compilata.
    if (fillMode === "seller") {
      const isPrivato = (cd.tipo_cliente || "azienda") === "privato";
      const referenteOk = isPrivato ? true : !!cd.cliente_nome;
      if (!cd.societa || !referenteOk || !cd.email) {
        toast({
          title: "Compila i dati cliente",
          description: isPrivato
            ? "Servono almeno cognome e nome del cliente ed email per generare l'anteprima."
            : "Servono almeno società, nome del referente ed email del cliente per generare l'anteprima.",
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
    } else {
      // client_fill: serve almeno l'email per poter inviare il link.
      if (!cd.email) {
        toast({
          title: "Inserisci l'email del cliente",
          description: "Per inviare il link di compilazione serve almeno un'email valida.",
          variant: "destructive",
        });
        scrollToSection("section-client");
        return;
      }
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
        selectedSectionIds: Array.isArray(values.selectedSectionIds)
          ? values.selectedSectionIds
          : defaultSelectedIds(
              getTemplateSections(selectedTemplate),
            ),
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

  // Costruisce il payload canonico inviato sia a /api/contracts/preview
  // (per la firma del previewToken HMAC) sia a POST/PUT /api/contracts.
  // È fondamentale che le due chiamate condividano gli stessi dati,
  // altrimenti il server rifiuta con PREVIEW_TOKEN_PAYLOAD_CHANGED.
  const buildCanonicalSendPayload = (raw: ContractForm, sendEmail: string) => {
    const filteredClient = {
      ...raw.clientData,
      bonus_list: raw.clientData.bonus_list?.filter(
        (b) => b.bonus_descrizione && b.bonus_descrizione.trim() !== "",
      ) || [],
      payment_plan: raw.isPercentagePartnership
        ? []
        : raw.clientData.rata_list && raw.clientData.rata_list.length > 0
          ? []
          : raw.clientData.payment_plan?.filter(
              (p) =>
                p.rata_importo &&
                p.rata_importo.toString().trim() !== "" &&
                p.rata_scadenza &&
                p.rata_scadenza.trim() !== "",
            ) || [],
      rata_list: raw.clientData.rata_list?.filter(
        (r) => r.rata_importo && r.rata_importo > 0 && r.rata_scadenza && r.rata_scadenza.trim() !== "",
      ) || [],
    };
    return {
      templateId: raw.templateId,
      clientData: filteredClient,
      totalValue: raw.totalValue ? Math.round(raw.totalValue * 100) : null,
      isPercentagePartnership: !!raw.isPercentagePartnership,
      partnershipPercentage: raw.partnershipPercentage ?? null,
      autoRenewal: true,
      renewalDuration: raw.renewalDuration,
      contractStartDate: raw.contractStartDate,
      contractEndDate: raw.contractEndDate,
      selectedSectionIds: Array.isArray(raw.selectedSectionIds)
        ? raw.selectedSectionIds
        : defaultSelectedIds(getTemplateSections(selectedTemplate)),
      fillMode,
      sendToEmail: sendEmail,
    };
  };

  // Apre il gate "Conferma invio contratto al cliente": valida i campi
  // minimi, scarica in parallelo l'anteprima documento (con previewToken
  // HMAC) e l'anteprima dell'email, poi mostra la modale.
  const openSendGate = async () => {
    const values = form.getValues();
    const templateId = values.templateId || selectedTemplateId;
    if (!templateId) {
      toast({ title: "Seleziona un template", description: "Per inviare il contratto devi prima scegliere un template.", variant: "destructive" });
      scrollToSection("section-template");
      return;
    }
    const cd: any = values.clientData || {};
    const isPrivato = (cd.tipo_cliente || "azienda") === "privato";
    if (fillMode === "seller") {
      const referenteOk = isPrivato ? true : !!cd.cliente_nome;
      if (!cd.societa || !referenteOk || !cd.email) {
        toast({
          title: "Compila i dati cliente",
          description: isPrivato
            ? "Servono almeno cognome e nome del cliente ed email per inviare il contratto."
            : "Servono almeno società, nome del referente ed email del cliente per inviare il contratto.",
          variant: "destructive",
        });
        scrollToSection("section-client");
        return;
      }
      if (values.isPercentagePartnership) {
        if (!values.partnershipPercentage || values.partnershipPercentage <= 0) {
          toast({ title: "Inserisci la percentuale di partnership", description: "Deve essere maggiore di zero.", variant: "destructive" });
          scrollToSection("section-payment");
          return;
        }
      } else if (!values.totalValue || values.totalValue <= 0) {
        toast({ title: "Inserisci il prezzo totale", description: "Deve essere maggiore di zero.", variant: "destructive" });
        scrollToSection("section-payment");
        return;
      }
    } else if (!cd.email) {
      toast({ title: "Inserisci l'email del cliente", description: "Per inviare il link serve almeno un'email valida.", variant: "destructive" });
      scrollToSection("section-client");
      return;
    }
    const emailToSend = (sendToEmail || cd.email || "").trim();
    if (!emailToSend) {
      toast({ title: "Email destinatario mancante", description: "Specifica una casella valida nella sezione Invio.", variant: "destructive" });
      scrollToSection("section-send");
      return;
    }

    setGateLoading(true);
    setGateError(null);
    setGatePreviewData(null);
    setGateEmailData(null);
    setGateOpen(true);
    try {
      const targetContractId = isEditing && contract ? contract.id : (draftContractId ?? undefined);
      const canonical = buildCanonicalSendPayload(values, emailToSend);
      // Memorizzo il payload canonico: lo userò invariato in onSubmit
      // così l'hash che verrà ricalcolato dal server combacia esattamente
      // con quello firmato dentro il previewToken.
      sendArgsRef.current = {
        ...sendArgsRef.current,
        canonicalPayload: canonical,
      };
      const previewPayload = { ...canonical, contractId: targetContractId };
      const [previewRes, emailRes] = await Promise.all([
        apiRequest("POST", "/api/contracts/preview", previewPayload),
        apiRequest("POST", "/api/contracts/preview-email", {
          contractCode: contract?.contractCode || (isEditing ? contract?.contractCode : "ANTEPRIMA"),
          emailTo: emailToSend,
          clientData: canonical.clientData,
        }),
      ]);
      const previewJson = await previewRes.json();
      const emailJson = await emailRes.json();
      setGatePreviewData(previewJson);
      setGateEmailData(emailJson);
    } catch (err: any) {
      const msg = err?.message || "Impossibile preparare l'anteprima.";
      setGateError(msg);
    } finally {
      setGateLoading(false);
    }
  };

  const onSubmit = (data: ContractForm) => {
    // Le opzioni di invio sono gestite dal gate di conferma esplicito:
    // `Salva come bozza` => { send: false }
    // `Procedi all'invio` (dopo conferma gate) => { send: true, previewToken, canonicalPayload }
    const { send, previewToken, canonicalPayload } = sendArgsRef.current;
    // Quando l'utente invia per davvero, riusiamo IL PAYLOAD ESATTO già
    // mostrato e firmato dal server. Questo garantisce che l'hash
    // ricalcolato in POST/PUT combaci con quello dentro il previewToken,
    // evitando falsi positivi di "PAYLOAD_CHANGED".
    if (send && canonicalPayload) {
      createContractMutation.mutate({
        ...canonicalPayload,
        sendImmediately: true,
        previewToken,
      });
      return;
    }
    // Bozza: applico la stessa normalizzazione del payload canonico.
    const canonical = buildCanonicalSendPayload(data, sendToEmail || "");
    createContractMutation.mutate({
      ...canonical,
      sendImmediately: false,
      previewToken: null,
    });
  };

  const currentTotalValue = form.watch("totalValue") || 0;
  const currentIsPercentageMode = form.watch("isPercentagePartnership") || false;
  const watchedClientData = form.watch("clientData");
  const watchedSelectedSectionIds = form.watch("selectedSectionIds");
  const watchedTotalValue = form.watch("totalValue");
  const watchedIsPercent = form.watch("isPercentagePartnership");
  const watchedPercentage = form.watch("partnershipPercentage");
  const watchedStartDate = form.watch("contractStartDate");
  const watchedEndDate = form.watch("contractEndDate");
  const watchedRenewal = form.watch("renewalDuration");

  const recapData: ContractRecapData = useMemo(() => {
    const tmplSecs = getTemplateSections(selectedTemplate);
    const cd: any = watchedClientData || {};
    const tipo = (cd.tipo_cliente || cd.clientType || "azienda") as "azienda" | "privato";
    const clientLabel = tipo === "privato"
      ? (cd.cliente_nome || cd.nome || null)
      : (cd.societa || cd.cliente_nome || cd.nome || null);
    let durationMonths: number | null = null;
    if (typeof watchedRenewal === "number") durationMonths = watchedRenewal;
    else if (watchedRenewal && !isNaN(parseInt(String(watchedRenewal), 10))) durationMonths = parseInt(String(watchedRenewal), 10);
    return {
      templateName: selectedTemplate?.name || null,
      clientType: tipo,
      clientLabel,
      clientEmail: cd.email || null,
      modulesCount: Array.isArray(watchedSelectedSectionIds) ? watchedSelectedSectionIds.length : 0,
      modulesTotal: tmplSecs.length,
      bonusCount: Array.isArray(cd.bonus_list) ? cd.bonus_list.filter((b: any) => b?.bonus_descrizione).length : 0,
      totalValue: watchedTotalValue != null ? Number(watchedTotalValue) : null,
      isPercentagePartnership: !!watchedIsPercent,
      partnershipPercentage: watchedPercentage != null ? Number(watchedPercentage) : null,
      contractStartDate: watchedStartDate || null,
      contractEndDate: watchedEndDate || null,
      durationMonths,
      presetName: appliedPresetName,
    };
  }, [selectedTemplate, watchedClientData, watchedSelectedSectionIds, watchedTotalValue, watchedIsPercent, watchedPercentage, watchedStartDate, watchedEndDate, watchedRenewal, appliedPresetName]);

  // Effetto: quando "stesso indirizzo" è attivo, replica sede→residenza e
  // mantiene i campi sincronizzati anche durante successive modifiche alla sede.
  const watchStessoIndirizzo = form.watch("clientData.stesso_indirizzo");
  const watchSedeForCopy = form.watch("clientData.sede");
  const watchProvinciaSedeForCopy = form.watch("clientData.provincia_sede");
  const watchIndirizzoForCopy = form.watch("clientData.indirizzo");
  useEffect(() => {
    if (!watchStessoIndirizzo) return;
    const cur = form.getValues("clientData");
    const sede = watchSedeForCopy || "";
    const provSede = watchProvinciaSedeForCopy || "";
    const indirizzo = watchIndirizzoForCopy || "";
    if (cur.residente_a !== sede) {
      form.setValue("clientData.residente_a", sede, { shouldDirty: true, shouldValidate: true });
    }
    if (cur.provincia_residenza !== provSede) {
      form.setValue("clientData.provincia_residenza", provSede, { shouldDirty: true });
    }
    if (cur.indirizzo_residenza !== indirizzo) {
      form.setValue("clientData.indirizzo_residenza", indirizzo, { shouldDirty: true, shouldValidate: true });
    }
  }, [watchStessoIndirizzo, watchSedeForCopy, watchProvinciaSedeForCopy, watchIndirizzoForCopy, form]);

  // ====================================================================
  // Reset della selezione sezioni modulari quando l'utente cambia template
  // (solo in modalità creazione; se stiamo modificando un contratto esistente
  // rispettiamo le selezioni persistite).
  const watchedTemplateId = form.watch("templateId");
  const prevTemplateIdRef = useRef<number | null>(null);
  // Quando si applica un preset, sopprimiamo il reset delle sezioni
  // (altrimenti il cambio di templateId azzererebbe la lista appena impostata).
  const presetApplyingRef = useRef(false);
  useEffect(() => {
    if (isEditing) return;
    if (prevTemplateIdRef.current === null) {
      prevTemplateIdRef.current = watchedTemplateId;
      return;
    }
    if (prevTemplateIdRef.current !== watchedTemplateId) {
      prevTemplateIdRef.current = watchedTemplateId;
      if (presetApplyingRef.current) {
        // Il preset sta forzando templateId+selectedSectionIds insieme,
        // non azzerarli.
        presetApplyingRef.current = false;
        return;
      }
      form.setValue("selectedSectionIds", undefined, { shouldDirty: false });
    }
  }, [watchedTemplateId, isEditing, form]);

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
            for (const key of SYNCED_FIELD_KEYS) {
              if (cd[key] !== undefined && cd[key] !== null) {
                form.setValue(`clientData.${key}` as any, cd[key], { shouldDirty: true });
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
      const allowed = SYNCED_FIELD_KEYS.includes(field);
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
      contractId={isEditing && contract ? contract.id : (draftContractId ?? null)}
      templateId={selectedTemplateId ?? null}
      activeToken={coFillToken}
      clientConnected={coFillClientConnected}
      onSessionStart={(token, ctxContractId) => {
        setCoFillToken(token);
        if (!isEditing && ctxContractId) setDraftContractId(ctxContractId);
      }}
      onSessionEnd={() => setCoFillToken(null)}
    />
    {(() => {
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
      const predefined = Array.isArray(gatePreviewData?.template?.predefinedBonuses)
        ? gatePreviewData!.template.predefinedBonuses.map((b: any) => ({
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
        <SendConfirmationGate
          open={gateOpen}
          onOpenChange={(open) => {
            setGateOpen(open);
            if (!open) setGateError(null);
          }}
          loading={gateLoading}
          error={gateError}
          previewData={gatePreviewData}
          emailData={gateEmailData}
          documentProps={{
            clientData: cd,
            paymentPlan,
            bonusList,
            usingCustomInstallments,
            contract: {
              isPercentagePartnership: !!values.isPercentagePartnership,
              partnershipPercentage: values.partnershipPercentage,
              renewalDuration: values.renewalDuration,
              contractStartDate: values.contractStartDate,
              contractEndDate: values.contractEndDate,
            },
          }}
          contextLabel={isEditing && contract ? `Contratto ${contract.contractCode}` : undefined}
          sending={createContractMutation.isPending && sendArgsRef.current.send}
          onConfirm={() => {
            if (!gatePreviewData?.previewToken) return;
            sendArgsRef.current = {
              ...sendArgsRef.current,
              send: true,
              previewToken: gatePreviewData.previewToken,
            };
            form.handleSubmit(onSubmit)();
          }}
        />
      );
    })()}
    {/* Salva preset dialog */}
    <Dialog open={savePresetDialogOpen} onOpenChange={setSavePresetDialogOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookmarkPlus className="h-5 w-5 text-indigo-600" /> Salva come preset offerta
          </DialogTitle>
          <DialogDescription>
            Salva la configurazione corrente (template, pacchetti, bonus, prezzo, durata) per riutilizzarla in nuovi contratti.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label className="text-xs font-medium text-slate-700">Nome preset *</Label>
            <Input
              value={savePresetName}
              onChange={(e) => setSavePresetName(e.target.value)}
              placeholder="Es. Offerta Standard 12 mesi"
              className="mt-1"
              data-testid="input-save-preset-name"
            />
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">Descrizione (opzionale)</Label>
            <Input
              value={savePresetDescription}
              onChange={(e) => setSavePresetDescription(e.target.value)}
              placeholder="A cosa serve questo preset"
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-xs font-medium text-slate-700">Visibilità</Label>
            <Select
              value={savePresetVisibility}
              onValueChange={(v) => setSavePresetVisibility(v as "personal" | "shared")}
              disabled={!isAdmin}
            >
              <SelectTrigger className="mt-1" data-testid="select-save-preset-visibility">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="personal">Solo io (personale)</SelectItem>
                {isAdmin && (
                  <SelectItem value="shared">Tutta l'azienda (condiviso)</SelectItem>
                )}
              </SelectContent>
            </Select>
            {!isAdmin && (
              <p className="text-[11px] text-slate-400 mt-1">I preset condivisi possono essere creati solo dagli admin.</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setSavePresetDialogOpen(false)}>Annulla</Button>
          <Button
            type="button"
            disabled={savePresetMutation.isPending || !savePresetName.trim()}
            onClick={() => savePresetMutation.mutate({
              name: savePresetName.trim(),
              description: savePresetDescription.trim(),
              visibility: savePresetVisibility,
            })}
            data-testid="button-confirm-save-preset"
          >
            <Save className="h-4 w-4 mr-2" />
            {savePresetMutation.isPending ? "Salvataggio…" : "Salva preset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-[1280px] w-[95vw] h-[95vh] p-0 gap-0 rounded-[20px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.15)] border-0 overflow-hidden bg-white grid grid-rows-[auto_auto_minmax(0,1fr)_auto]">
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

        {/* Step Navigation (wizard) */}
        <div className="px-8 pt-6 pb-4 border-b border-gray-100 flex-shrink-0 bg-white">
          <div className="flex items-center justify-between overflow-x-auto sm:overflow-visible -mx-2 px-2">
            {WIZARD_STEPS.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id || (visitedSteps.has(step.id) && step.id < currentStep);
              const isVisited = visitedSteps.has(step.id);
              return (
                <div key={step.id} className="flex items-center flex-1 last:flex-none min-w-[110px]">
                  <button
                    type="button"
                    onClick={() => handleStepClick(step.id)}
                    aria-current={isActive ? "step" : undefined}
                    className="flex flex-col items-center group cursor-pointer rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2"
                    data-testid={`wizard-step-${step.id}`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 ring-2 ring-indigo-200"
                        : isCompleted
                        ? "bg-indigo-100 text-indigo-600"
                        : isVisited
                        ? "bg-slate-200 text-slate-600"
                        : "bg-gray-100 text-gray-400"
                    }`}>
                      {isCompleted && !isActive ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <StepIcon className="h-4 w-4" />
                      )}
                    </div>
                    <span className={`text-xs mt-2 font-medium text-center transition-colors duration-200 whitespace-nowrap ${
                      isActive ? "text-indigo-700" : isCompleted ? "text-indigo-500" : "text-gray-500"
                    }`}>
                      {step.label}
                    </span>
                  </button>
                  {index < WIZARD_STEPS.length - 1 && (
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
        <div className="flex overflow-hidden min-h-0">
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-8 py-8 bg-white">
            <MissingDataPanel
              variant="accordion"
              className="lg:hidden mb-3"
              clientData={watchedClientData}
              onJumpToField={jumpToClientField}
            />
            <ContractRecapPanel data={recapData} variant="accordion" className="lg:hidden mb-6" />
            <form id="contract-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-0">
            {stepBanner && (
              <div className="mb-4 flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm" data-testid="wizard-step-banner">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <strong className="block">Mancano alcuni dati per proseguire</strong>
                  <span className="text-xs">{stepBanner}</span>
                </div>
                <button type="button" className="text-amber-700 hover:text-amber-900" onClick={() => setStepBanner(null)} aria-label="Chiudi">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            {currentStep === 1 && (<>
            {/* === Preset Offerta bar === */}
            {!isEditing && (
              <div className="mb-6 p-4 rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/50 to-violet-50/30">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                      <Sparkles className="h-4 w-4 text-indigo-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">Preset offerta</p>
                      <p className="text-[11px] text-slate-500">Carica una configurazione salvata oppure salva quella attuale per riusarla.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Select value={selectedPresetId} onValueChange={handlePresetSelect}>
                      <SelectTrigger className="h-10 w-[260px] rounded-xl border-indigo-200 bg-white" data-testid="select-load-preset">
                        <SelectValue placeholder={presets.length === 0 ? "Nessun preset salvato" : "Carica un preset…"} />
                      </SelectTrigger>
                      <SelectContent>
                        {presets.length === 0 ? (
                          <div className="p-2 text-xs text-slate-400">Nessun preset disponibile</div>
                        ) : (
                          presets.map((p) => {
                            const tplMissing = p.templateId != null && !templates.some((t: any) => t.id === p.templateId);
                            return (
                              <SelectItem key={p.id} value={p.id.toString()} disabled={tplMissing}>
                                <div className="flex items-center gap-2">
                                  <Layers className="h-3.5 w-3.5 text-indigo-500" />
                                  <span className={tplMissing ? "text-slate-400 line-through" : ""}>{p.name}</span>
                                  {p.visibility === "shared" && (
                                    <span className="text-[10px] text-emerald-600">· condiviso</span>
                                  )}
                                  {tplMissing && (
                                    <span className="text-[10px] text-amber-600 inline-flex items-center gap-0.5">
                                      <AlertTriangle className="h-2.5 w-2.5" /> template mancante
                                    </span>
                                  )}
                                </div>
                              </SelectItem>
                            );
                          })
                        )}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                      onClick={() => {
                        if (!form.getValues("templateId")) {
                          toast({ title: "Seleziona prima un template", description: "Per salvare un preset serve almeno un template.", variant: "destructive" });
                          return;
                        }
                        setSavePresetDialogOpen(true);
                      }}
                      data-testid="button-save-as-preset"
                    >
                      <BookmarkPlus className="h-4 w-4 mr-1.5" />
                      Salva come preset
                    </Button>
                  </div>
                </div>
                {appliedPresetName && !presetMissingTemplate && (
                  <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
                    <CheckCircle className="h-4 w-4 shrink-0" />
                    <span className="flex-1">Preset <strong>"{appliedPresetName}"</strong> applicato. Compila ora i dati cliente.</span>
                    <button
                      type="button"
                      onClick={() => { setAppliedPresetName(null); setSelectedPresetId(""); }}
                      className="p-1 rounded hover:bg-emerald-100 text-emerald-700"
                      aria-label="Chiudi avviso preset"
                      data-testid="button-dismiss-preset-banner"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                {presetMissingTemplate && (
                  <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span className="flex-1">Il template del preset <strong>"{appliedPresetName}"</strong> non è più disponibile. Seleziona un nuovo template qui sotto.</span>
                    <button
                      type="button"
                      onClick={() => { setPresetMissingTemplate(false); setAppliedPresetName(null); setSelectedPresetId(""); }}
                      className="p-1 rounded hover:bg-amber-100 text-amber-700"
                      aria-label="Chiudi avviso template mancante"
                      data-testid="button-dismiss-missing-template"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}

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
                  disabled={createContractMutation.isPending || (isEditing && contract?.status !== "draft")}
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
            </>)}

            {currentStep === 2 && (
            /* Section 2: Client Data */
            <div id="section-client" className="pt-2">
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
                {/* Toggle Privato / Azienda */}
                {(() => {
                  const tipoCliente: ClientType = (form.watch("clientData.tipo_cliente") as ClientType) || "azienda";
                  return (
                    <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-xl w-fit" data-testid="toggle-tipo-cliente">
                      {(["azienda", "privato"] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => form.setValue("clientData.tipo_cliente", opt, { shouldDirty: true, shouldValidate: true })}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            tipoCliente === opt
                              ? "bg-white text-indigo-700 shadow-sm"
                              : "text-slate-600 hover:text-slate-800"
                          }`}
                          data-testid={`button-tipo-${opt}`}
                        >
                          {opt === "azienda" ? "Azienda" : "Privato"}
                        </button>
                      ))}
                    </div>
                  );
                })()}

                {/* Dati Azienda/Privato */}
                {(() => {
                  const tipoCliente: ClientType = (form.watch("clientData.tipo_cliente") as ClientType) || "azienda";
                  const isPrivato = tipoCliente === "privato";
                  const sedeWatch = (form.watch("clientData.sede") || "") as string;
                  const indirizzoWatch = (form.watch("clientData.indirizzo") || "") as string;
                  return (
                <div>
                  <h4 className="text-base font-semibold text-slate-800 mb-2 flex items-center">
                    <Building className="h-4 w-4 mr-2 text-slate-500" />
                    {isPrivato ? "Dati cliente privato" : "Dati Azienda/Società"}
                  </h4>
                  <p className="text-xs text-slate-500 mb-4">
                    {isPrivato
                      ? "Questi dati appariranno come intestazione del contratto."
                      : "Inserisci i dati fiscali dell'azienda. La P.IVA o il CF è obbligatorio per la fatturazione."}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className={isPrivato ? "md:col-span-2" : ""}>
                      <Label htmlFor="societa" className={labelClass}>
                        {isPrivato ? "Cognome e Nome *" : "Società *"}
                      </Label>
                      <Input
                        id="societa"
                        {...form.register("clientData.societa")}
                        placeholder={isPrivato ? "Es. Mario Rossi" : "Nome della società"}
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
                        {isPrivato ? "Città *" : "Città sede legale *"}
                      </Label>
                      <div className="grid grid-cols-[1fr_90px] gap-2">
                        <Input
                          id="sede"
                          {...form.register("clientData.sede")}
                          placeholder="Es. Milano"
                          disabled={createContractMutation.isPending}
                          className={`${inputClass} ${coFillFieldClass("sede")}`}
                        />
                        <Select
                          value={(form.watch("clientData.provincia_sede") || "") as string}
                          onValueChange={(v) => form.setValue("clientData.provincia_sede", v, { shouldDirty: true })}
                          disabled={createContractMutation.isPending}
                        >
                          <SelectTrigger
                            className={`${inputClass} ${coFillFieldClass("provincia_sede")}`}
                            data-testid="select-provincia-sede"
                          >
                            <SelectValue placeholder="PR" />
                          </SelectTrigger>
                          <SelectContent className="max-h-60">
                            {ITALIAN_PROVINCES.map((p) => (
                              <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {form.formState.errors.clientData?.sede && (
                        <p className="text-sm text-red-600 mt-1">
                          {form.formState.errors.clientData.sede.message}
                        </p>
                      )}
                      {!form.formState.errors.clientData?.sede && looksLikeAddress(sedeWatch) && (
                        <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Sembra un indirizzo. Inserisci solo il nome della città (es. "Milano"), l'indirizzo va nel campo sotto.
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
                      {!form.formState.errors.clientData?.indirizzo && indirizzoWatch && !looksLikeAddress(indirizzoWatch) && (
                        <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Inserisci via e numero civico (es. "Via Roma 12, 20100").
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="p_iva" className={labelClass}>
                        {isPrivato ? "Codice Fiscale *" : "Codice Fiscale / P.IVA *"}
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

                    {!isPrivato && (
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
                    )}

                    <div>
                      <Label htmlFor="email" className={labelClass}>
                        Email *
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        {...form.register("clientData.email")}
                        placeholder="email@esempio.com"
                        disabled={createContractMutation.isPending}
                        className={`${inputClass} ${coFillFieldClass("email")}`}
                      />
                      {form.formState.errors.clientData?.email ? (
                        <p className="text-sm text-red-600 mt-1">
                          {form.formState.errors.clientData.email.message}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500 mt-1">
                          Usiamo questa email per inviarti il contratto da firmare.
                        </p>
                      )}
                    </div>

                    {!isPrivato && (
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
                    )}

                    <div>
                      <Label htmlFor="cellulare" className={labelClass}>
                        Cellulare *
                      </Label>
                      <Input
                        id="cellulare"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        {...form.register("clientData.cellulare")}
                        placeholder="+39 333 123 4567"
                        disabled={createContractMutation.isPending}
                        className={`${inputClass} ${coFillFieldClass("cellulare")}`}
                      />
                      {form.formState.errors.clientData?.cellulare ? (
                        <p className="text-sm text-red-600 mt-1">
                          {form.formState.errors.clientData.cellulare.message}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-500 mt-1">
                          Cellulare italiano (Es. 333 123 4567 o +39 333 123 4567).
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                  );
                })()}

                {/* Dati Personali Referente / Stesso indirizzo */}
                {(() => {
                  const tipoCliente: ClientType = (form.watch("clientData.tipo_cliente") as ClientType) || "azienda";
                  const isPrivato = tipoCliente === "privato";
                  const stessoIndirizzo = !!form.watch("clientData.stesso_indirizzo");
                  const residenteWatch = (form.watch("clientData.residente_a") || "") as string;
                  const indirizzoResWatch = (form.watch("clientData.indirizzo_residenza") || "") as string;

                  return (
                <div>
                  <h4 className="text-base font-semibold text-slate-800 mb-2 flex items-center">
                    <User className="h-4 w-4 mr-2 text-slate-500" />
                    {isPrivato ? "Dati anagrafici" : "Dati Personali Referente"}
                  </h4>
                  <p className="text-xs text-slate-500 mb-4">
                    {isPrivato
                      ? "Servono per identificare il firmatario del contratto."
                      : "Dati del referente che firmerà il contratto a nome dell'azienda."}
                  </p>

                  {/* Stesso indirizzo della sede / azienda */}
                  <label className="flex items-center gap-2 mb-4 cursor-pointer select-none" data-testid="checkbox-stesso-indirizzo">
                    <input
                      type="checkbox"
                      {...form.register("clientData.stesso_indirizzo")}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      disabled={createContractMutation.isPending}
                    />
                    <span className="text-sm text-slate-700">
                      {isPrivato
                        ? "La residenza coincide con l'indirizzo di domicilio sopra"
                        : "La residenza del referente coincide con l'indirizzo dell'azienda"}
                    </span>
                  </label>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {!isPrivato && (
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
                    )}

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
                        Città di residenza *
                      </Label>
                      <div className="grid grid-cols-[1fr_90px] gap-2">
                        <Input
                          id="residente_a"
                          {...form.register("clientData.residente_a")}
                          placeholder="Es. Milano"
                          disabled={createContractMutation.isPending || stessoIndirizzo}
                          className={`${inputClass} ${coFillFieldClass("residente_a")} ${stessoIndirizzo ? "bg-slate-50" : ""}`}
                        />
                        <Select
                          value={(form.watch("clientData.provincia_residenza") || "") as string}
                          onValueChange={(v) => form.setValue("clientData.provincia_residenza", v, { shouldDirty: true })}
                          disabled={createContractMutation.isPending || stessoIndirizzo}
                        >
                          <SelectTrigger
                            className={`${inputClass} ${coFillFieldClass("provincia_residenza")} ${stessoIndirizzo ? "bg-slate-50" : ""}`}
                            data-testid="select-provincia-residenza"
                          >
                            <SelectValue placeholder="PR" />
                          </SelectTrigger>
                          <SelectContent className="max-h-60">
                            {ITALIAN_PROVINCES.map((p) => (
                              <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {form.formState.errors.clientData?.residente_a && (
                        <p className="text-sm text-red-600 mt-1">
                          {form.formState.errors.clientData.residente_a.message}
                        </p>
                      )}
                      {!form.formState.errors.clientData?.residente_a && !stessoIndirizzo && looksLikeAddress(residenteWatch) && (
                        <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Sembra un indirizzo. Inserisci solo il nome della città.
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
                        disabled={createContractMutation.isPending || stessoIndirizzo}
                        className={`${inputClass} ${coFillFieldClass("indirizzo_residenza")} ${stessoIndirizzo ? "bg-slate-50" : ""}`}
                      />
                      {form.formState.errors.clientData?.indirizzo_residenza && (
                        <p className="text-sm text-red-600 mt-1">
                          {form.formState.errors.clientData.indirizzo_residenza.message}
                        </p>
                      )}
                      {!form.formState.errors.clientData?.indirizzo_residenza && !stessoIndirizzo && indirizzoResWatch && !looksLikeAddress(indirizzoResWatch) && (
                        <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Inserisci via e numero civico.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                  );
                })()}
              </div>
            </div>

            )}

            {currentStep === 4 && (<>
            {/* Section 3: Payment */}
            <div id="section-payment" className="pt-2">
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
            <div id="section-duration" className="border-t border-gray-100 pt-8 mt-8" data-wizard-section="duration">
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

            </>)}

            {currentStep === 3 && (<>
            {/* Section 4b: Sezioni modulari (servizi opzionali dal template) */}
            {Array.isArray(getTemplateSections(selectedTemplate)) && getTemplateSections(selectedTemplate).length > 0 && (
              <div id="section-modular-sections" className="border-t border-gray-100 pt-8 mt-8">
                <h3 className="text-xl font-semibold text-slate-900 flex items-center mb-2">
                  <Gift className="mr-3 h-5 w-5 text-sky-600" />
                  Servizi Inclusi
                </h3>
                <p className="text-sm text-slate-500 mb-6">
                  Seleziona le sezioni che vuoi includere in questo contratto. Le sezioni obbligatorie sono sempre incluse.
                </p>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3">
                  {getTemplateSections(selectedTemplate).map((sec) => {
                    const selectedIds: string[] = form.watch("selectedSectionIds") ?? [];
                    const initialized = Array.isArray(form.getValues("selectedSectionIds"));
                    const isSelected = sec.required
                      ? true
                      : initialized
                      ? selectedIds.includes(sec.id)
                      : !!sec.defaultEnabled;
                    return (
                      <label
                        key={sec.id}
                        className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition ${
                          isSelected
                            ? "border-sky-400 bg-sky-50/60"
                            : "border-gray-200 bg-white hover:bg-gray-50"
                        } ${sec.required ? "opacity-90" : ""}`}
                        data-testid={`section-modular-${sec.id}`}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                          checked={isSelected}
                          disabled={!!sec.required || createContractMutation.isPending}
                          onChange={(e) => {
                            const current: string[] = Array.isArray(form.getValues("selectedSectionIds"))
                              ? [...(form.getValues("selectedSectionIds") as string[])]
                              : getTemplateSections(selectedTemplate)
                                  .filter((s) => s.required || s.defaultEnabled)
                                  .map((s) => s.id);
                            const next = e.target.checked
                              ? Array.from(new Set([...current, sec.id]))
                              : current.filter((id) => id !== sec.id);
                            form.setValue("selectedSectionIds", next, { shouldDirty: true });
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-800 text-sm">{sec.title}</span>
                            {sec.required && (
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-700 bg-sky-100 px-2 py-0.5 rounded">
                                Obbligatoria
                              </span>
                            )}
                          </div>
                          {sec.description && (
                            <p className="text-xs text-slate-500 mt-1">{sec.description}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setPreviewSectionId(sec.id);
                          }}
                          className="shrink-0 p-1.5 -m-1 rounded text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
                          title="Anteprima contenuto del modulo"
                          data-testid={`contract-section-preview-${sec.id}`}
                          aria-label={`Anteprima ${sec.title}`}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </label>
                    );
                  })}
                </div>
                <div className="rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50/70 to-white p-5 max-h-[520px] overflow-y-auto">
                  <div className="flex items-center gap-2 mb-3">
                    <Gift className="h-4 w-4 text-sky-600" />
                    <h4 className="text-sm font-semibold text-slate-800">Anteprima live</h4>
                  </div>
                  {(() => {
                    const resolved = resolveSelectedSections(
                      getTemplateSections(selectedTemplate),
                      form.watch("selectedSectionIds") ?? null,
                    );
                    if (resolved.length === 0) {
                      return (
                        <p className="text-xs text-slate-500 italic">
                          Nessuna sezione attiva. Spunta almeno un servizio per vederlo qui.
                        </p>
                      );
                    }
                    return (
                      <div className="space-y-4">
                        {resolved.map((sec) => (
                          <div
                            key={sec.id}
                            className="rounded-lg border-l-4 border-sky-400 bg-white p-3 shadow-sm"
                            data-testid={`preview-section-${sec.id}`}
                          >
                            <h5 className="text-sm font-semibold text-sky-900 mb-1.5">{sec.title}</h5>
                            <div
                              className="text-xs text-slate-700 leading-relaxed [&_p]:mb-2 [&_ul]:pl-5 [&_ul]:list-disc [&_ol]:pl-5 [&_ol]:list-decimal"
                              dangerouslySetInnerHTML={{ __html: sec.content || "<em>Sezione senza contenuto</em>" }}
                            />
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                </div>
              </div>
            )}

            {/* Section 5: Bonus */}
            <div id="section-bonus" className="border-t border-gray-100 pt-8 mt-8" data-wizard-section="bonus">
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

            </>)}

            {currentStep === 5 && (<>
            {/* === Riepilogo finale === */}
            <div id="section-summary" className="mb-6 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-indigo-600" /> Riepilogo del contratto
                </h3>
                <p className="text-xs text-slate-500">Controlla, modifica i blocchi se serve, poi invia.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {([
                  { step: 1, label: "Template & Preset", icon: FileText, value: selectedTemplate?.name || (form.watch("templateId") ? `Template #${form.watch("templateId")}` : "—") },
                  { step: 2, label: "Cliente", icon: Users, value: (form.watch("clientData.societa") || form.watch("clientData.cliente_nome") || form.watch("clientData.email") || "—") as string },
                  { step: 3, label: "Pacchetti & Bonus", icon: Layers, value: `${(form.watch("selectedSectionIds")?.length ?? 0)} pacchetti · ${(form.watch("clientData.bonus_list")?.length ?? 0)} bonus` },
                  { step: 4, label: "Prezzo & Durata", icon: Euro, value: form.watch("isPercentagePartnership")
                    ? `${form.watch("partnershipPercentage") ?? "—"}% partnership`
                    : (form.watch("totalValue") != null ? `€ ${Number(form.watch("totalValue") || 0).toLocaleString("it-IT")}` : "—") },
                ] as Array<{ step: number; label: string; icon: LucideIcon; value: string }>).map((row) => {
                  const Icon = row.icon;
                  return (
                    <div key={row.step} className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:border-indigo-300 transition-colors">
                      <Icon className="h-4 w-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] uppercase tracking-wide text-slate-400">{row.label}</div>
                        <div className="text-sm text-slate-800 truncate">{row.value || "—"}</div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => goToStep(row.step, { skipValidation: true })}
                        className="h-8 px-2 text-indigo-600 hover:bg-indigo-50"
                        data-testid={`recap-edit-step-${row.step}`}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" /> Modifica
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 6: Email / Send */}
            <div id="section-send" className="pt-2">
              <h3 className="text-xl font-semibold text-slate-900 flex items-center mb-6">
                <Send className="mr-3 h-5 w-5 text-indigo-600" />
                Invio Contratto
              </h3>
              <div className="space-y-5">
                {/* Modalità di compilazione */}
                <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/40">
                  <Label className={labelClass}>Chi compila i dati del cliente?</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                    {([
                      { value: "seller", title: "Compilo io", desc: "Inserisco tutti i dati del cliente e gli invio il contratto pronto da firmare." },
                      { value: "client_fill", title: "Lascia che compili il cliente", desc: "Invio il link: il cliente vede un'anteprima delle condizioni, inserisce i propri dati e firma con OTP." },
                    ] as const).map((opt) => {
                      const selected = fillMode === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setFillMode(opt.value);
                            form.setValue("fillMode", opt.value, { shouldValidate: true, shouldDirty: true });
                          }}
                          className={`text-left p-4 rounded-xl border-2 transition-all ${
                            selected
                              ? "border-indigo-400 bg-white shadow-sm"
                              : "border-slate-200 bg-white hover:border-slate-300"
                          }`}
                          data-testid={`button-fillmode-${opt.value}`}
                        >
                          <div className="flex items-start gap-2">
                            <span className={`mt-1 inline-block h-3 w-3 rounded-full border ${selected ? "bg-indigo-600 border-indigo-600" : "border-slate-300"}`} />
                            <div>
                              <div className="text-sm font-semibold text-slate-900">{opt.title}</div>
                              <div className="text-xs text-slate-500 mt-0.5">{opt.desc}</div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {fillMode === "client_fill" && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-3">
                      In questa modalità, dei dati cliente serve solo l'email di invio. Tutto il resto lo compilerà il cliente sul link.
                    </p>
                  )}
                </div>

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

                <div className="p-5 rounded-xl border-2 border-indigo-100 bg-indigo-50/40">
                  <div className="flex items-start gap-3">
                    <Send className="h-5 w-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-slate-700">
                      <p className="font-semibold text-slate-900 mb-1">Invio sicuro al cliente</p>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Quando sei pronto, premi <strong>Procedi all'invio</strong>: aprirò una conferma con
                        l'esatta email che riceverà il cliente, il documento e il link sicuro. Niente parte
                        finché non confermi.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            </>)}

            {/* Spacer for sticky footer */}
            <div className="h-4" />
            </form>
          </div>
          <div className="hidden lg:flex flex-col w-[320px] flex-shrink-0 gap-4 px-4 py-8 overflow-y-auto">
            <ContractRecapPanel data={recapData} variant="sidebar" />
            <MissingDataPanel
              variant="sidebar"
              className="flex-1"
              clientData={watchedClientData}
              onJumpToField={jumpToClientField}
            />
          </div>
        </div>

        {/* Footer Wizard */}
        <div className="bg-white/95 backdrop-blur-sm border-t border-gray-100 py-4 px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={createContractMutation.isPending || gateLoading}
              className="h-11 px-4 rounded-xl text-slate-600 hover:bg-gray-100"
              data-testid="button-cancel"
            >
              Annulla
            </Button>
            <span className="text-xs text-slate-400 hidden sm:inline">Step {currentStep} di {TOTAL_STEPS}</span>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1 || createContractMutation.isPending || gateLoading}
              className="h-11 min-w-[120px] rounded-xl border border-gray-200 text-slate-700 hover:bg-gray-50"
              data-testid="button-wizard-back"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Indietro
            </Button>
            {currentStep < TOTAL_STEPS ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={createContractMutation.isPending || gateLoading}
                className="h-11 min-w-[140px] rounded-xl bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white shadow-lg hover:shadow-xl transition-all duration-200"
                data-testid="button-wizard-next"
              >
                Avanti
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    sendArgsRef.current = { send: false, previewToken: null, canonicalPayload: null };
                    form.handleSubmit(onSubmit)();
                  }}
                  disabled={createContractMutation.isPending || gateLoading}
                  className="h-11 min-w-[160px] rounded-xl border border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                  data-testid="button-save-as-draft"
                >
                  {createContractMutation.isPending && !sendArgsRef.current.send
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvataggio…</>
                    : <>Salva come bozza</>
                  }
                </Button>
                <Button
                  type="button"
                  onClick={openSendGate}
                  disabled={createContractMutation.isPending || gateLoading || !emailConfigured}
                  className="h-11 min-w-[200px] rounded-xl bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50"
                  data-testid="button-open-send-gate"
                  aria-label="Apri la conferma di invio del contratto al cliente"
                >
                  {gateLoading
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Preparazione anteprima…</>
                    : <><Send className="h-4 w-4 mr-2" />Procedi all'invio</>
                  }
                </Button>
              </>
            )}
          </div>
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
                    // `generatedContent` è il documento finale risolto dal
                    // server (placeholder + sezioni modulari espanse).
                    // Lo usiamo come sorgente unica in preview per garantire
                    // parità totale con ciò che riceve il cliente.
                    content: previewData.generatedContent,
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
                  /*
                   * Non passiamo `sections` qui: `generatedContent` è già
                   * stato processato dal server (marker sostituito o blocco
                   * fallback iniettato prima dei termini di pagamento),
                   * quindi le sezioni sono già rese inline. Passare di
                   * nuovo `sections` produrrebbe un doppio rendering.
                   */
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
    {(() => {
      const allSecs = getTemplateSections(selectedTemplate);
      const sec = allSecs.find((s) => s.id === previewSectionId) || null;
      const selIds: string[] = form.watch("selectedSectionIds") ?? [];
      const initialized = Array.isArray(form.getValues("selectedSectionIds"));
      const isSelected = sec
        ? sec.required
          ? true
          : initialized
          ? selIds.includes(sec.id)
          : !!sec.defaultEnabled
        : false;
      return (
        <SectionPreviewDialog
          section={sec}
          open={!!sec}
          isSelected={isSelected}
          onClose={() => setPreviewSectionId(null)}
          onToggle={(id, nextSelected) => {
            const current: string[] = Array.isArray(form.getValues("selectedSectionIds"))
              ? [...(form.getValues("selectedSectionIds") as string[])]
              : allSecs.filter((s) => s.required || s.defaultEnabled).map((s) => s.id);
            const next = nextSelected
              ? Array.from(new Set([...current, id]))
              : current.filter((x) => x !== id);
            form.setValue("selectedSectionIds", next, { shouldDirty: true });
          }}
        />
      );
    })()}
    </>
  );
}