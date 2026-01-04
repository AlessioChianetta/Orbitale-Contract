import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { File, Save, X, User, Building, Euro, Plus, FileText, Calculator, Users, CheckCircle, XCircle, Loader2, MapPin, Phone, Mail, Calendar } from "lucide-react";
import DynamicFormFields from "./dynamic-form-fields";
import PaymentCalculatorAdvanced from "./payment-calculator-advanced";
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

export default function ContractForm({ onClose, contract }: ContractFormProps) {
  const { toast } = useToast();
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(contract?.templateId || null);
  const [sendImmediately, setSendImmediately] = useState(false);
  const [sendToEmail, setSendToEmail] = useState(contract?.sentToEmail || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPercentageMode, setIsPercentageMode] = useState(contract?.isPercentagePartnership || false);
  const [vatValidation, setVatValidation] = useState<{ isValid: boolean | null; type: 'vat' | 'cf' | null; isValidating: boolean }>({ 
    isValid: null, 
    type: null, 
    isValidating: false 
  });
  const isEditing = !!contract; // Determine if we are editing an existing contract

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
      toast({
        title: isEditing ? "Errore nell'aggiornamento del contratto" : "Errore nella creazione del contratto",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsSubmitting(false); // Ensure isSubmitting is reset after mutation completes
    }
  });

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

  if (templatesLoading) {
    return (
      <Dialog open onOpenChange={() => onClose()}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mr-4"></div>
            <span className="text-lg">Caricamento template...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (templatesError) {
    return (
      <Dialog open onOpenChange={() => onClose()}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="text-red-500 mb-4">Errore nel caricamento dei template</div>
              <Button onClick={() => window.location.reload()}>
                Ricarica la pagina
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  console.log("Templates loaded:", templates);

  const currentTotalValue = form.watch("totalValue") || 0;
  const currentIsPercentageMode = form.watch("isPercentagePartnership") || false;

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto bg-gradient-to-br from-gray-50 via-white to-purple-50 border-0 shadow-2xl">
        <DialogHeader className="pb-6 border-b-2 border-purple-100 bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 -m-6 mb-6 rounded-t-lg">
          <DialogTitle className="flex items-center text-2xl font-bold">
            <FileText className="h-6 w-6 mr-3" />
            {isEditing ? "Modifica Contratto" : "Nuovo Contratto"}
          </DialogTitle>
          <DialogDescription className="text-purple-100 mt-2">
            Genera un nuovo contratto compilando tutti i dati necessari. Il sistema produrrà automaticamente il PDF e lo invierà al cliente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 mt-6">
          {/* Template Selection */}
          <Card className="border-2 border-purple-100 shadow-lg hover:shadow-xl transition-shadow bg-white">
            <CardHeader className="pb-4 bg-gradient-to-r from-purple-50 to-pink-50">
              <CardTitle className="text-lg font-medium text-gray-900 flex items-center">
                <File className="mr-3 h-5 w-5 text-purple-600" />
                Selezione Template
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="template" className="text-sm font-medium text-gray-700">
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
                  <SelectTrigger className="mt-2 h-10 border border-gray-300 focus:border-gray-500">
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
            </CardContent>
          </Card>

          {/* Client Data Section */}
          <Card className="border-2 border-blue-100 shadow-lg hover:shadow-xl transition-shadow bg-white">
            <CardHeader className="pb-4 bg-gradient-to-r from-blue-50 to-cyan-50">
              <CardTitle className="text-lg font-medium text-gray-900 flex items-center">
                <Users className="mr-3 h-5 w-5 text-blue-600" />
                Dati Cliente/Committente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                {/* Dati Azienda/Società */}
                <div>
                  <h4 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
                    <Building className="h-4 w-4 mr-2" />
                    Dati Azienda/Società
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="societa" className="text-sm font-medium text-gray-700">
                        Società *
                      </Label>
                      <Input
                        id="societa"
                        {...form.register("clientData.societa")}
                        placeholder="Nome della società"
                        disabled={createContractMutation.isPending}
                        className="mt-1 h-11 border-2 border-gray-200 focus:border-purple-400 hover:border-gray-300 transition-all duration-200 rounded-lg shadow-sm focus:shadow-md"
                      />
                      {form.formState.errors.clientData?.societa && (
                        <p className="text-sm text-red-600 mt-1">
                          {form.formState.errors.clientData.societa.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="sede" className="text-sm font-medium text-gray-700">
                        Sede *
                      </Label>
                      <Input
                        id="sede"
                        {...form.register("clientData.sede")}
                        placeholder="Città sede legale"
                        disabled={createContractMutation.isPending}
                        className="mt-1 h-11 border-2 border-gray-200 focus:border-purple-400 hover:border-gray-300 transition-all duration-200 rounded-lg shadow-sm focus:shadow-md"
                      />
                      {form.formState.errors.clientData?.sede && (
                        <p className="text-sm text-red-600 mt-1">
                          {form.formState.errors.clientData.sede.message}
                        </p>
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <Label htmlFor="indirizzo" className="text-sm font-medium text-gray-700">
                        Indirizzo *
                      </Label>
                      <Input
                        id="indirizzo"
                        {...form.register("clientData.indirizzo")}
                        placeholder="Via, numero civico, CAP"
                        disabled={createContractMutation.isPending}
                        className="mt-1 h-11 border-2 border-gray-200 focus:border-purple-400 hover:border-gray-300 transition-all duration-200 rounded-lg shadow-sm focus:shadow-md"
                      />
                      {form.formState.errors.clientData?.indirizzo && (
                        <p className="text-sm text-red-600 mt-1">
                          {form.formState.errors.clientData.indirizzo.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="p_iva" className="text-sm font-medium text-gray-700">
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
                          className={`mt-1 h-11 border pr-10 ${
                            vatValidation.isValid === true 
                              ? 'border-green-500 focus:border-green-600' 
                              : vatValidation.isValid === false 
                              ? 'border-red-500 focus:border-red-600' 
                              : 'border-gray-300 focus:border-gray-500'
                          }`}
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 mt-1">
                          {vatValidation.isValidating && (
                            <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
                          )}
                          {!vatValidation.isValidating && vatValidation.isValid === true && (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          )}
                          {!vatValidation.isValidating && vatValidation.isValid === false && (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                        </div>
                      </div>
                      {vatValidation.type && vatValidation.isValid && (
                        <p className="text-sm text-green-600 mt-1">
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
                            className="h-7 px-3 text-xs bg-yellow-50 border-yellow-300 text-yellow-700 hover:bg-yellow-100 hover:border-yellow-400"
                          >
                            Forza inserimento
                          </Button>
                        </div>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="codice_univoco" className="text-sm font-medium text-gray-700">
                        Codice Univoco
                      </Label>
                      <Input
                        id="codice_univoco"
                        {...form.register("clientData.codice_univoco")}
                        placeholder="Codice univoco (opzionale)"
                        disabled={createContractMutation.isPending}
                        className="mt-1 h-11 border-2 border-gray-200 focus:border-purple-400 hover:border-gray-300 transition-all duration-200 rounded-lg shadow-sm focus:shadow-md"
                      />
                    </div>

                    <div>
                      <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                        Email *
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        {...form.register("clientData.email")}
                        placeholder="email@esempio.com"
                        disabled={createContractMutation.isPending}
                        className="mt-1 h-11 border-2 border-gray-200 focus:border-purple-400 hover:border-gray-300 transition-all duration-200 rounded-lg shadow-sm focus:shadow-md"
                      />
                      {form.formState.errors.clientData?.email && (
                        <p className="text-sm text-red-600 mt-1">
                          {form.formState.errors.clientData.email.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="pec" className="text-sm font-medium text-gray-700">
                        PEC
                      </Label>
                      <Input
                        id="pec"
                        {...form.register("clientData.pec")}
                        placeholder="pec@esempio.com (opzionale)"
                        disabled={createContractMutation.isPending}
                        className="mt-1 h-11 border-2 border-gray-200 focus:border-purple-400 hover:border-gray-300 transition-all duration-200 rounded-lg shadow-sm focus:shadow-md"
                      />
                    </div>

                    <div>
                      <Label htmlFor="cellulare" className="text-sm font-medium text-gray-700">
                        Cellulare *
                      </Label>
                      <Input
                        id="cellulare"
                        type="tel"
                        {...form.register("clientData.cellulare")}
                        placeholder="+39 333 123 4567"
                        disabled={createContractMutation.isPending}
                        className="mt-1 h-11 border-2 border-gray-200 focus:border-purple-400 hover:border-gray-300 transition-all duration-200 rounded-lg shadow-sm focus:shadow-md"
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
                  <h4 className="text-base font-semibold text-gray-900 mb-4 flex items-center">
                    <User className="h-4 w-4 mr-2" />
                    Dati Personali Referente
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <Label htmlFor="cliente_nome" className="text-sm font-medium text-gray-700">
                        Signor./a *
                      </Label>
                      <Input
                        id="cliente_nome"
                        {...form.register("clientData.cliente_nome")}
                        placeholder="Nome e cognome del referente"
                        disabled={createContractMutation.isPending}
                        className="mt-1 h-11 border-2 border-gray-200 focus:border-purple-400 hover:border-gray-300 transition-all duration-200 rounded-lg shadow-sm focus:shadow-md"
                      />
                      {form.formState.errors.clientData?.cliente_nome && (
                        <p className="text-sm text-red-600 mt-1">
                          {form.formState.errors.clientData.cliente_nome.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="nato_a" className="text-sm font-medium text-gray-700">
                        Nato a *
                      </Label>
                      <Input
                        id="nato_a"
                        {...form.register("clientData.nato_a")}
                        placeholder="Luogo di nascita"
                        disabled={createContractMutation.isPending}
                        className="mt-1 h-11 border-2 border-gray-200 focus:border-purple-400 hover:border-gray-300 transition-all duration-200 rounded-lg shadow-sm focus:shadow-md"
                      />
                      {form.formState.errors.clientData?.nato_a && (
                        <p className="text-sm text-red-600 mt-1">
                          {form.formState.errors.clientData.nato_a.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="data_nascita" className="text-sm font-medium text-gray-700">
                        Data di Nascita *
                      </Label>
                      <Input
                        id="data_nascita"
                        type="date"
                        {...form.register("clientData.data_nascita")}
                        disabled={createContractMutation.isPending}
                        className="mt-1 h-11 border-2 border-gray-200 focus:border-purple-400 hover:border-gray-300 transition-all duration-200 rounded-lg shadow-sm focus:shadow-md"
                      />
                      {form.formState.errors.clientData?.data_nascita && (
                        <p className="text-sm text-red-600 mt-1">
                          {form.formState.errors.clientData.data_nascita.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="residente_a" className="text-sm font-medium text-gray-700">
                        Residente a *
                      </Label>
                      <Input
                        id="residente_a"
                        {...form.register("clientData.residente_a")}
                        placeholder="Città di residenza"
                        disabled={createContractMutation.isPending}
                        className="mt-1 h-11 border-2 border-gray-200 focus:border-purple-400 hover:border-gray-300 transition-all duration-200 rounded-lg shadow-sm focus:shadow-md"
                      />
                      {form.formState.errors.clientData?.residente_a && (
                        <p className="text-sm text-red-600 mt-1">
                          {form.formState.errors.clientData.residente_a.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="indirizzo_residenza" className="text-sm font-medium text-gray-700">
                        Indirizzo di Residenza *
                      </Label>
                      <Input
                        id="indirizzo_residenza"
                        {...form.register("clientData.indirizzo_residenza")}
                        placeholder="Via, numero civico, CAP"
                        disabled={createContractMutation.isPending}
                        className="mt-1 h-11 border-2 border-gray-200 focus:border-purple-400 hover:border-gray-300 transition-all duration-200 rounded-lg shadow-sm focus:shadow-md"
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
            </CardContent>
          </Card>

          {/* Total Price / Partnership Mode */}
          <Card className="border-2 border-emerald-100 shadow-lg hover:shadow-xl transition-shadow bg-white">
            <CardHeader className="pb-4 bg-gradient-to-r from-emerald-50 to-green-50 border-b border-emerald-100">
              <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
                <Euro className="mr-3 h-5 w-5 text-emerald-600" />
                Modello di Pagamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {/* Partnership Mode Toggle */}
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-lg p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex-1 mr-6">
                    <h4 className="text-base font-semibold text-purple-800 mb-2">
                      Modello Partnership Avanzato
                    </h4>
                    <p className="text-sm text-purple-700 leading-relaxed">
                      Attiva per partnership basata su percentuale del fatturato totale
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <Checkbox
                      checked={isPercentageMode}
                      onCheckedChange={(checked) => {
                        const isChecked = checked as boolean;
                        setIsPercentageMode(isChecked);
                        form.setValue("isPercentagePartnership", isChecked);
                        if (isChecked) {
                          form.setValue("totalValue", undefined);
                          // Clear validation errors when switching modes
                          form.clearErrors("totalValue");
                        } else {
                          form.setValue("partnershipPercentage", undefined);
                          // Clear validation errors when switching modes
                          form.clearErrors("partnershipPercentage");
                        }
                        // Trigger form revalidation
                        form.trigger();
                      }}
                      className="h-6 w-6 border-2 border-purple-300 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                    />
                  </div>
                </div>
              </div>

              {/* Show either fixed price or percentage based on mode */}
              {!isPercentageMode ? (
                <div className="max-w-md">
                  <Label htmlFor="totalValue" className="text-sm font-medium text-gray-700 mb-2 block">
                    Prezzo Totale *
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-gray-500 text-sm font-medium">€</span>
                    <Input
                      id="totalValue"
                      type="number"
                      step="0.01"
                      min="0"
                      {...form.register("totalValue", { valueAsNumber: true })}
                      placeholder="0.00"
                      className="pl-8 h-12 text-base border-2 border-emerald-200 focus:border-emerald-400 hover:border-emerald-300 transition-all duration-200 rounded-lg shadow-sm focus:shadow-md"
                      disabled={createContractMutation.isPending}
                    />
                  </div>
                  {form.formState.errors.totalValue && (
                    <p className="text-sm text-red-600 mt-3">
                      {form.formState.errors.totalValue.message}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-8">
                  <div className="max-w-md">
                    <Label htmlFor="partnershipPercentage" className="text-sm font-medium text-gray-700 mb-2 block">
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
                        className="pr-8 h-12 text-base border-2 border-emerald-200 focus:border-emerald-400 hover:border-emerald-300 transition-all duration-200 rounded-lg shadow-sm focus:shadow-md"
                        disabled={createContractMutation.isPending}
                      />
                      <span className="absolute right-3 top-3 text-gray-500 text-sm font-medium">%</span>
                    </div>
                    <div className="mt-3 bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-200 rounded-lg p-3">
                      <p className="text-sm text-yellow-800 leading-relaxed">
                        <strong>Nota:</strong> La percentuale sarà applicata sul fatturato TOTALE del ristorante
                      </p>
                    </div>
                    {form.formState.errors.partnershipPercentage && (
                      <p className="text-sm text-red-600 mt-2">
                        {form.formState.errors.partnershipPercentage.message}
                      </p>
                    )}
                  </div>

                  {/* Anteprima Clausole Partnership */}
                  {form.watch("partnershipPercentage") && (
                    <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                      <h4 className="font-bold text-gray-800 mb-3">
                        Anteprima Clausole Partnership
                      </h4>
                      <div className="text-sm space-y-3 max-h-60 overflow-y-auto">
                        <div className="bg-white p-3 rounded border border-gray-200">
                          <h5 className="font-semibold text-gray-700 mb-1">Definizione di Fatturato Totale</h5>
                          <p className="text-gray-700 text-xs">
                            Tutti i ricavi lordi dell'attività: vendite, catering, delivery, eventi privati e qualsiasi altro ricavo collegato all'attività.
                          </p>
                        </div>
                        
                        <div className="bg-white p-3 rounded border border-gray-200">
                          <h5 className="font-semibold text-gray-700 mb-1">Modalità di Pagamento</h5>
                          <p className="text-gray-700 text-xs">
                            Calcolo mensile su fatturato del mese precedente, pagamento entro il 15 del mese successivo.
                          </p>
                        </div>
                        
                        <div className="bg-white p-3 rounded border border-gray-200">
                          <h5 className="font-semibold text-gray-700 mb-1">Documentazione Richiesta</h5>
                          <p className="text-gray-700 text-xs">
                            Estratti cassa/POS, fatture emesse, dichiarazioni IVA, report certificati dal commercialista.
                          </p>
                        </div>
                        
                        <div className="bg-white p-3 rounded border border-gray-300">
                          <h5 className="font-semibold text-gray-700 mb-1">Penali Ritardo</h5>
                          <p className="text-gray-700 text-xs">
                            2% dell'importo dovuto per ogni mese di ritardo + interessi legali.
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 mt-3 font-medium italic">
                        Queste clausole verranno inserite automaticamente nel contratto e nel PDF finale.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Calculator - Only show when total value is set and not in percentage mode */}
          {currentTotalValue > 0 && !currentIsPercentageMode && (
            <Card className="border-2 border-blue-100 shadow-lg hover:shadow-xl transition-shadow bg-white">
              <CardHeader className="pb-4 bg-gradient-to-r from-blue-50 to-cyan-50 border-b border-blue-100">
                <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
                  <Calculator className="mr-3 h-5 w-5 text-blue-600" />
                  Calcolo Rate di Pagamento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-4">
                {/* Switch tra modalità: Calcolo Automatico o Rate Personalizzate */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <h4 className="text-base font-semibold text-blue-800 mb-3">Modalità Rate di Pagamento</h4>
                  <div className="space-y-3">
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="radio"
                        name="paymentMode"
                        value="automatic"
                        checked={rataListFields.fields.length === 0}
                        onChange={() => {
                          // Svuota tutte le rate personalizzate per attivare il calcolatore automatico
                          const fieldCount = rataListFields.fields.length;
                          for (let i = fieldCount - 1; i >= 0; i--) {
                            rataListFields.remove(i);
                          }
                        }}
                        className="h-4 w-4 text-blue-600"
                      />
                      <span className="text-sm font-medium text-blue-800">Calcolo Automatico (con frequenza)</span>
                    </label>
                    <label className="flex items-center space-x-3 cursor-pointer">
                      <input
                        type="radio"
                        name="paymentMode"
                        value="manual"
                        checked={rataListFields.fields.length > 0}
                        onChange={() => {
                          // Aggiungi rate con date automatiche
                          if (rataListFields.fields.length === 0) {
                            const today = new Date().toISOString().split('T')[0];
                            const nextMonth = new Date();
                            nextMonth.setMonth(nextMonth.getMonth() + 1);
                            const nextMonthStr = nextMonth.toISOString().split('T')[0];
                            
                            rataListFields.append({ rata_importo: 0, rata_scadenza: today });
                            rataListFields.append({ rata_importo: 0, rata_scadenza: nextMonthStr });
                          }
                        }}
                        className="h-4 w-4 text-blue-600"
                      />
                      <span className="text-sm font-medium text-blue-800">Rate Personalizzate (inserimento manuale)</span>
                    </label>
                  </div>
                </div>

                {/* Calcolo Automatico Rate - Solo se non ci sono rate personalizzate */}
                {rataListFields.fields.length === 0 && (
                  <div>
                    <h4 className="text-base font-semibold text-gray-800 mb-3">Calcolo Automatico Rate</h4>
                    <PaymentCalculatorAdvanced
                      totalAmount={currentTotalValue}
                      onPaymentPlanChange={(paymentPlan) => {
                        // Aggiorna il payment_plan nel form quando viene calcolato automaticamente
                        console.log("Calcolo automatico completato:", paymentPlan);
                        form.setValue("clientData.payment_plan", paymentPlan);
                      }}
                    />
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        ℹ️ <strong>Modalità Calcolo Automatico:</strong> Le rate vengono calcolate automaticamente in base alla frequenza selezionata. 
                        Non è necessario inserire rate personalizzate.
                      </p>
                    </div>
                  </div>
                )}

                {/* Rate Personalizzate - Solo se attivate */}
                {rataListFields.fields.length > 0 && (
                  <div>
                    <h4 className="text-base font-semibold text-gray-800 mb-3">Rate Personalizzate</h4>
                    <p className="text-sm text-gray-600 mb-4">
                      Inserisci manualmente gli importi e le scadenze per ogni rata (es: 2000€ primo mese, 500€ mesi successivi)
                    </p>
                    
                    {/* Validazione Somma */}
                    {rataListFields.fields.length > 0 && (
                      <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800">
                          ⚠️ <strong>Controllo somma:</strong> Totale rate: {
                            rataListFields.fields.reduce((sum, field, index) => {
                              const value = form.watch(`clientData.rata_list.${index}.rata_importo`) || 0;
                              return sum + Number(value);
                            }, 0).toFixed(2)
                          }€ / Prezzo totale: {currentTotalValue}€
                        </p>
                      </div>
                    )}
                    
                    {/* Lista Rate Personalizzate */}
                    <div className="space-y-3 mb-4">
                      {rataListFields.fields.map((field, index) => (
                        <div key={field.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1 grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs text-gray-600 mb-1 block">Importo (€)</Label>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                {...form.register(`clientData.rata_list.${index}.rata_importo`, { valueAsNumber: true })}
                                placeholder="0.00"
                                className="h-10 text-sm"
                                disabled={createContractMutation.isPending}
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-gray-600 mb-1 block">Scadenza</Label>
                              <Input
                                type="date"
                                {...form.register(`clientData.rata_list.${index}.rata_scadenza`)}
                                className="h-10 text-sm"
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
                            className="h-8 w-8 text-gray-500 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
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
                        // Calcola la data per il mese successivo
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
                      className="h-10 px-4 border border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Aggiungi Rata Personalizzata
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Contract Duration Section */}
          <Card className="border-2 border-indigo-100 shadow-lg hover:shadow-xl transition-shadow bg-white">
            <CardHeader className="pb-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100">
              <CardTitle className="text-lg font-semibold text-gray-900 flex items-center">
                <Calendar className="mr-3 h-5 w-5 text-indigo-600" />
                Durata Contratto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border-2 border-indigo-200 rounded-lg p-4 shadow-sm">
                <p className="text-sm text-indigo-800 font-semibold mb-2">
                  📅 Date di validità del contratto e autorinnovo automatico
                </p>
                <p className="text-sm text-indigo-700 leading-relaxed">
                  Tutti i contratti si rinnovano automaticamente alle stesse condizioni
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="contractStartDate" className="text-sm font-medium text-gray-700 mb-2 block">
                    Data Inizio Contratto *
                  </Label>
                  <Input
                    id="contractStartDate"
                    type="date"
                    {...form.register("contractStartDate")}
                    className="h-12 text-base border-2 border-indigo-200 focus:border-indigo-400 hover:border-indigo-300 transition-all duration-200 rounded-lg shadow-sm focus:shadow-md"
                    disabled={createContractMutation.isPending}
                  />
                  <p className="text-sm text-gray-600 mt-3 leading-relaxed">
                    Data di inizio validità del contratto
                  </p>
                  {form.formState.errors.contractStartDate && (
                    <p className="text-sm text-red-600 mt-2">
                      {form.formState.errors.contractStartDate.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="contractEndDate" className="text-sm font-medium text-gray-700 mb-2 block">
                    Data Fine Contratto *
                  </Label>
                  <Input
                    id="contractEndDate"
                    type="date"
                    {...form.register("contractEndDate")}
                    className="h-12 text-base border-2 border-indigo-200 focus:border-indigo-400 hover:border-indigo-300 transition-all duration-200 rounded-lg shadow-sm focus:shadow-md"
                    disabled={createContractMutation.isPending}
                  />
                  <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                    Data di scadenza prima del rinnovo automatico
                  </p>
                  {form.formState.errors.contractEndDate && (
                    <p className="text-sm text-red-600 mt-2">
                      {form.formState.errors.contractEndDate.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="renewalDuration" className="text-sm font-medium text-gray-700 mb-2 block">
                    Durata Rinnovo (mesi)
                  </Label>
                  <Input
                    id="renewalDuration"
                    type="number"
                    min="1"
                    max="60"
                    {...form.register("renewalDuration", { valueAsNumber: true })}
                    placeholder="12"
                    className="h-12 text-base border-2 border-indigo-200 focus:border-indigo-400 hover:border-indigo-300 transition-all duration-200 rounded-lg shadow-sm focus:shadow-md"
                    disabled={createContractMutation.isPending}
                  />
                  <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                    Durata del rinnovo automatico
                  </p>
                  {form.formState.errors.renewalDuration && (
                    <p className="text-sm text-red-600 mt-2">
                      {form.formState.errors.renewalDuration.message}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bonus Section */}
          <Card className="border border-gray-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-medium text-gray-900 flex items-center">
                <Plus className="mr-3 h-5 w-5 text-gray-600" />
                Bonus e Servizi Inclusi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Show predefined bonuses from template */}
              {selectedTemplate?.predefinedBonuses && selectedTemplate.predefinedBonuses.length > 0 && (
                <div className="space-y-4">
                  <Label className="text-sm font-medium text-gray-700">
                    Bonus Predefiniti dal Template:
                  </Label>
                  <div className="grid gap-3">
                    {selectedTemplate.predefinedBonuses.map((bonus: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg">
                        <span className="font-medium text-gray-900">{bonus.description}</span>
                        {bonus.value && (
                          <span className="text-sm font-medium text-gray-600 bg-gray-200 px-2 py-1 rounded">
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
                    <div key={field.id} className="flex items-center space-x-3">
                      <Input
                        {...form.register(`clientData.bonus_list.${index}.bonus_descrizione`)}
                        placeholder="Descrizione bonus personalizzato..."
                        disabled={createContractMutation.isPending}
                        className="flex-1 h-11 border-2 border-gray-200 focus:border-purple-400 hover:border-gray-300 transition-all duration-200 rounded-lg shadow-sm focus:shadow-md"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => bonusFields.remove(index)}
                        disabled={createContractMutation.isPending}
                        className="h-10 w-10 text-gray-500 hover:text-red-600 hover:bg-red-50"
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
                    className="h-10 px-4 border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Aggiungi Bonus Personalizzato
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Email Section */}
          <div className="space-y-3 pt-4 border-t">
            <div>
              <Label htmlFor="sendToEmail">Email per l'invio del contratto</Label>
              <Input
                id="sendToEmail"
                type="email"
                value={sendToEmail}
                onChange={(e) => setSendToEmail(e.target.value)}
                placeholder="email@esempio.com"
                disabled={isSubmitting}
              />
              <p className="text-xs text-gray-600 mt-1">
                Email dove verrà inviato il contratto (può essere diversa da quella nel contratto)
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="sendImmediately"
                checked={sendImmediately}
                onCheckedChange={setSendImmediately}
              />
              <Label htmlFor="sendImmediately" className="text-sm">
                Invia immediatamente al cliente
              </Label>
            </div>
          </div>

          {/* Submit Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={createContractMutation.isPending}
              className="h-10 px-6 border border-gray-300 hover:bg-gray-50"
            >
              Annulla
            </Button>
            <Button
              type="submit"
              disabled={createContractMutation.isPending}
              className="h-10 px-6 bg-gray-900 hover:bg-gray-800 text-white"
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
                ? "Generazione..." 
                : isEditing ? "Aggiorna Contratto" : "Genera e Invia Contratto"
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}