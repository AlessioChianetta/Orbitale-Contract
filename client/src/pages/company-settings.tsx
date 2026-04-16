import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCompanySettingsSchema } from "@shared/schema";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Building2, Save, Upload, MessageSquare, Mail, Settings, Send, CheckCircle2, XCircle, KeyRound, X, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import EmailConfigBanner from "@/components/email-config-banner";

const settingsFormSchema = insertCompanySettingsSchema;
type SettingsForm = z.infer<typeof settingsFormSchema>;

export default function CompanySettings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [changeSmtpPass, setChangeSmtpPass] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState<string>("");
  const [testResult, setTestResult] = useState<
    | { kind: "success"; message: string }
    | { kind: "error"; message: string }
    | null
  >(null);

  useEffect(() => {
    if (!testEmailTo && user?.email) {
      setTestEmailTo(user.email);
    }
  }, [user?.email]);

  const testEmailMutation = useMutation({
    mutationFn: async (to: string) => {
      const res = await apiRequest("POST", "/api/company-settings/test-email", { to });
      return (await res.json()) as { success: boolean; message: string; to?: string };
    },
    onSuccess: (data) => {
      setTestResult({ kind: "success", message: data.message });
      toast({
        title: "Email di prova inviata",
        description: data.message,
      });
    },
    onError: (error: any) => {
      const raw = String(error?.message || "Invio fallito.");
      const cleaned = raw.replace(/^\d+:\s*/, "");
      let msg = cleaned;
      try {
        const parsed = JSON.parse(cleaned);
        if (parsed?.message) msg = parsed.message;
      } catch {}
      setTestResult({ kind: "error", message: msg });
      toast({
        title: "Email di prova fallita",
        description: msg,
        variant: "destructive",
      });
    },
  });

  const handleSendTestEmail = () => {
    setTestResult(null);
    const recipient = testEmailTo.trim() || user?.email || "";
    if (!recipient) {
      toast({
        title: "Indirizzo mancante",
        description: "Inserisci un indirizzo email a cui inviare l'email di prova.",
        variant: "destructive",
      });
      return;
    }
    testEmailMutation.mutate(recipient);
  };

  const { data: settings, isLoading } = useQuery({
    queryKey: ["/api/company-settings"],
  });

  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      companyName: settings?.companyName || "",
      address: settings?.address || "",
      city: settings?.city || "",
      postalCode: settings?.postalCode || "",
      taxId: settings?.taxId || "",
      vatId: settings?.vatId || "",
      uniqueCode: settings?.uniqueCode || "",
      pec: settings?.pec || "",
      contractTitle: settings?.contractTitle || "Contratto ",
      logoUrl: settings?.logoUrl || "",
      otpMethod: settings?.otpMethod || "email",
      twilioAccountSid: settings?.twilioAccountSid || "",
      twilioAuthToken: settings?.twilioAuthToken || "",
      twilioVerifyServiceSid: settings?.twilioVerifyServiceSid || "",
      twilioWhatsappFrom: settings?.twilioWhatsappFrom || "",
      smtpHost: settings?.smtpHost || "",
      smtpPort: settings?.smtpPort ?? 465,
      smtpUser: settings?.smtpUser || "",
      smtpPass: "",
      smtpSecure: settings?.smtpSecure ?? true,
      emailFromAddress: settings?.emailFromAddress || "",
      emailFromName: settings?.emailFromName || "",
    },
  });

  // Update form when settings are loaded
  useEffect(() => {
    console.log("Settings loaded:", settings);
    if (settings) {
      const formValues = {
        companyName: settings.companyName || "",
        address: settings.address || "",
        city: settings.city || "",
        postalCode: settings.postalCode || "",
        taxId: settings.taxId || "",
        vatId: settings.vatId || "",
        uniqueCode: settings.uniqueCode || "",
        pec: settings.pec || "",
        contractTitle: settings.contractTitle || "Contratto ",
        logoUrl: settings.logoUrl || "",
        otpMethod: settings.otpMethod || "email",
        twilioAccountSid: settings.twilioAccountSid || "",
        twilioAuthToken: settings.twilioAuthToken || "",
        twilioVerifyServiceSid: settings.twilioVerifyServiceSid || "",
        twilioWhatsappFrom: settings.twilioWhatsappFrom || "",
        smtpHost: settings.smtpHost || "",
        smtpPort: settings.smtpPort ?? 465,
        smtpUser: settings.smtpUser || "",
        smtpPass: "",
        smtpSecure: settings.smtpSecure ?? true,
        emailFromAddress: settings.emailFromAddress || "",
        emailFromName: settings.emailFromName || "",
      };
      console.log("Form reset with values:", formValues);
      form.reset(formValues);
    }
  }, [settings, form]);

  const saveSettingsMutation = useMutation({
    mutationFn: async (data: SettingsForm) => {
      let logoUrl = data.logoUrl;

      // If a new logo file is selected, convert it to base64
      if (logoFile) {
        const reader = new FileReader();
        logoUrl = await new Promise((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(logoFile);
        });
      }

      return await apiRequest("PUT", "/api/company-settings", {
        ...data,
        logoUrl,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/company-settings/email-status"] });
      toast({
        title: "Impostazioni salvate",
        description: "Le impostazioni dell'azienda sono state aggiornate con successo"
      });
      setLogoFile(null);
      setChangeSmtpPass(false);
      form.setValue("smtpPass", "");
    },
    onError: (error: any) => {
      toast({
        title: "Errore nel salvataggio",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SettingsForm) => {
    saveSettingsMutation.mutate(data);
  };

  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setLogoFile(file);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <Link href={user?.role === "admin" ? "/admin" : "/seller"}>
          <Button variant="ghost" size="sm" className="mb-3 -ml-2" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Torna alla dashboard
          </Button>
        </Link>
        <h1 className="text-3xl font-bold flex items-center">
          <Building2 className="mr-3 h-8 w-8" />
          Impostazioni Azienda
        </h1>
        <p className="text-gray-600 mt-2">
          Configura i dati della tua azienda che appariranno nei contratti e nei PDF
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informazioni Aziendali</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Logo Upload */}
            <div>
              <Label htmlFor="logo">Logo Aziendale</Label>
              <div className="mt-2 space-y-4">
                {(settings?.logoUrl || logoFile) && (
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <p className="text-sm text-gray-600 mb-2">Logo attuale:</p>
                    {logoFile ? (
                      <img
                        src={URL.createObjectURL(logoFile)}
                        alt="Nuovo logo"
                        className="max-w-40 max-h-20 object-contain border"
                      />
                    ) : settings?.logoUrl ? (
                      <img
                        src={settings.logoUrl}
                        alt="Logo aziendale"
                        className="max-w-40 max-h-20 object-contain border"
                      />
                    ) : null}
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <Input
                    id="logo"
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    disabled={saveSettingsMutation.isPending}
                  />
                  <Upload className="h-4 w-4 text-gray-400" />
                </div>
                <p className="text-xs text-gray-500">
                  Formati supportati: JPG, PNG, GIF. Dimensioni consigliate: 120x80px
                </p>
              </div>
            </div>

            {/* Company Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="companyName">Ragione Sociale *</Label>
                <Input
                  id="companyName"
                  {...form.register("companyName")}
                  placeholder="es. Ale srl"
                  disabled={saveSettingsMutation.isPending}
                />
                {form.formState.errors.companyName && (
                  <p className="text-sm text-red-600 mt-1">
                    {form.formState.errors.companyName.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="contractTitle">Titolo Contratto</Label>
                <Input
                  id="contractTitle"
                  {...form.register("contractTitle")}
                  placeholder="es. Contratto "
                  disabled={saveSettingsMutation.isPending}
                />
              </div>
            </div>

            {/* Address */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="address">Indirizzo *</Label>
                <Input
                  id="address"
                  {...form.register("address")}
                  placeholder="es. via monza, 14"
                  disabled={saveSettingsMutation.isPending}
                />
                {form.formState.errors.address && (
                  <p className="text-sm text-red-600 mt-1">
                    {form.formState.errors.address.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="postalCode">CAP *</Label>
                <Input
                  id="postalCode"
                  {...form.register("postalCode")}
                  placeholder="es. 98071"
                  disabled={saveSettingsMutation.isPending}
                />
                {form.formState.errors.postalCode && (
                  <p className="text-sm text-red-600 mt-1">
                    {form.formState.errors.postalCode.message}
                  </p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="city">Città *</Label>
              <Input
                id="city"
                {...form.register("city")}
                placeholder="es. Milano"
                disabled={saveSettingsMutation.isPending}
              />
              {form.formState.errors.city && (
                <p className="text-sm text-red-600 mt-1">
                  {form.formState.errors.city.message}
                </p>
              )}
            </div>

            {/* Tax Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="taxId">Codice Fiscale *</Label>
                <Input
                  id="taxId"
                  {...form.register("taxId")}
                  placeholder="es. 00000000000"
                  disabled={saveSettingsMutation.isPending}
                />
                {form.formState.errors.taxId && (
                  <p className="text-sm text-red-600 mt-1">
                    {form.formState.errors.taxId.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="vatId">Partita IVA *</Label>
                <Input
                  id="vatId"
                  {...form.register("vatId")}
                  placeholder="es. 00000000000"
                  disabled={saveSettingsMutation.isPending}
                />
                {form.formState.errors.vatId && (
                  <p className="text-sm text-red-600 mt-1">
                    {form.formState.errors.vatId.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="uniqueCode">Codice Univoco *</Label>
                <Input
                  id="uniqueCode"
                  {...form.register("uniqueCode")}
                  placeholder="es. xxxxxxx"
                  disabled={saveSettingsMutation.isPending}
                />
                {form.formState.errors.uniqueCode && (
                  <p className="text-sm text-red-600 mt-1">
                    {form.formState.errors.uniqueCode.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="pec">PEC *</Label>
                <Input
                  id="pec"
                  type="email"
                  {...form.register("pec")}
                  placeholder="es. ale@casellapec.com"
                  disabled={saveSettingsMutation.isPending}
                />
                {form.formState.errors.pec && (
                  <p className="text-sm text-red-600 mt-1">
                    {form.formState.errors.pec.message}
                  </p>
                )}
              </div>
            </div>

            {/* OTP Settings */}
            <div className="space-y-4 pt-6 border-t">
              <div className="flex items-center space-x-2 mb-4">
                <Settings className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold">Impostazioni OTP</h3>
              </div>

              <div>
                <Label htmlFor="otpMethod">Metodo di Verifica OTP *</Label>
                <Controller
                  name="otpMethod"
                  control={form.control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={saveSettingsMutation.isPending}
                    >
                      <SelectTrigger className="mt-2">
                        <SelectValue placeholder="Seleziona metodo OTP" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">
                          <div className="flex items-center space-x-2">
                            <Mail className="h-4 w-4" />
                            <span>Email (SMTP)</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="twilio">
                          <div className="flex items-center space-x-2">
                            <MessageSquare className="h-4 w-4" />
                            <span>SMS (Twilio Verify)</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Scegli come inviare i codici OTP per la firma dei contratti
                </p>
              </div>

              {/* Twilio Settings - Show only when Twilio is selected */}
              {form.watch("otpMethod") === "twilio" && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
                  <div className="flex items-center space-x-2">
                    <MessageSquare className="h-4 w-4 text-blue-600" />
                    <h4 className="font-medium text-blue-900">Configurazione Twilio</h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="twilioAccountSid">Account SID *</Label>
                      <Input
                        id="twilioAccountSid"
                        {...form.register("twilioAccountSid")}
                        placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        disabled={saveSettingsMutation.isPending}
                      />
                      {form.formState.errors.twilioAccountSid && (
                        <p className="text-sm text-red-600 mt-1">
                          {form.formState.errors.twilioAccountSid.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="twilioAuthToken">Auth Token *</Label>
                      <Input
                        id="twilioAuthToken"
                        type="password"
                        {...form.register("twilioAuthToken")}
                        placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        disabled={saveSettingsMutation.isPending}
                      />
                      {form.formState.errors.twilioAuthToken && (
                        <p className="text-sm text-red-600 mt-1">
                          {form.formState.errors.twilioAuthToken.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="twilioVerifyServiceSid">Verify Service SID *</Label>
                    <Input
                      id="twilioVerifyServiceSid"
                      {...form.register("twilioVerifyServiceSid")}
                      placeholder="VAxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      disabled={saveSettingsMutation.isPending}
                    />
                    {form.formState.errors.twilioVerifyServiceSid && (
                      <p className="text-sm text-red-600 mt-1">
                        {form.formState.errors.twilioVerifyServiceSid.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="twilioWhatsappFrom">WhatsApp From (Opzionale)</Label>
                    <Input
                      id="twilioWhatsappFrom"
                      {...form.register("twilioWhatsappFrom")}
                      placeholder="whatsapp:+14155238886"
                      disabled={saveSettingsMutation.isPending}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Numero WhatsApp Business per inviare congratulazioni (formato: whatsapp:+numero)
                    </p>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                    <p className="text-sm text-yellow-800">
                      <strong>📋 Guida rapida Twilio:</strong><br />
                      1. Vai su <a href="https://console.twilio.com/" target="_blank" className="text-blue-600 underline">console.twilio.com</a><br />
                      2. Copia Account SID e Auth Token dalla Dashboard<br />
                      3. Vai su Verify → Services e crea un nuovo servizio<br />
                      4. Copia il Service SID del servizio Verify
                    </p>
                  </div>
                </div>
              )}

            </div>

            {/* SMTP Email Configuration */}
            <div className="space-y-4 border-t pt-6">
              <div className="flex items-center space-x-2">
                <Mail className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold">Configurazione Email (SMTP)</h3>
              </div>
              <EmailConfigBanner />
              
              <p className="text-sm text-gray-600">
                Inserisci le credenziali del server SMTP del tuo provider (Aruba, Register.it, IONOS, ecc.).
                Le email di contratto, OTP e notifica firma verranno inviate da questo mittente.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="smtpHost">Server SMTP (host) *</Label>
                  <Input
                    id="smtpHost"
                    placeholder="es. smtps.aruba.it"
                    {...form.register("smtpHost")}
                    data-testid="input-smtp-host"
                  />
                </div>
                <div>
                  <Label htmlFor="smtpPort">Porta *</Label>
                  <Input
                    id="smtpPort"
                    type="number"
                    placeholder="465 oppure 587"
                    {...form.register("smtpPort", { valueAsNumber: true })}
                    data-testid="input-smtp-port"
                  />
                  <p className="text-xs text-gray-500 mt-1">465 = TLS implicito · 587 = STARTTLS</p>
                </div>
                <div>
                  <Label htmlFor="smtpUser">Utente SMTP *</Label>
                  <Input
                    id="smtpUser"
                    placeholder="es. no-reply@tuodominio.it"
                    autoComplete="off"
                    {...form.register("smtpUser")}
                    data-testid="input-smtp-user"
                  />
                </div>
                <div>
                  <Label htmlFor="smtpPass">Password SMTP *</Label>
                  {settings?.smtpPassConfigured && !changeSmtpPass ? (
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        id="smtpPass"
                        type="password"
                        value="••••••••"
                        readOnly
                        disabled
                        data-testid="input-smtp-pass-masked"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setChangeSmtpPass(true);
                          form.setValue("smtpPass", "");
                        }}
                        data-testid="button-change-smtp-pass"
                      >
                        <KeyRound className="h-4 w-4 mr-1" />
                        Cambia password
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        id="smtpPass"
                        type="password"
                        placeholder={settings?.smtpPassConfigured ? "Inserisci la nuova password" : "••••••••"}
                        autoComplete="new-password"
                        {...form.register("smtpPass")}
                        data-testid="input-smtp-pass"
                      />
                      {settings?.smtpPassConfigured && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setChangeSmtpPass(false);
                            form.setValue("smtpPass", "");
                          }}
                          data-testid="button-cancel-change-smtp-pass"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Annulla
                        </Button>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    {settings?.smtpPassConfigured
                      ? "La password salvata non viene mai mostrata. Lasciala invariata oppure cambiala esplicitamente."
                      : "Inserisci la password del tuo account SMTP."}
                  </p>
                </div>
                <div>
                  <Label htmlFor="emailFromAddress">Email mittente (From) *</Label>
                  <Input
                    id="emailFromAddress"
                    placeholder="es. no-reply@tuodominio.it"
                    {...form.register("emailFromAddress")}
                    data-testid="input-email-from-address"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Deve essere un indirizzo del tuo dominio con SPF/DKIM allineati.
                  </p>
                </div>
                <div>
                  <Label htmlFor="emailFromName">Nome mittente (opzionale)</Label>
                  <Input
                    id="emailFromName"
                    placeholder="Default: nome azienda"
                    {...form.register("emailFromName")}
                    data-testid="input-email-from-name"
                  />
                </div>
                <div className="md:col-span-2 flex items-center space-x-2">
                  <input
                    id="smtpSecure"
                    type="checkbox"
                    className="h-4 w-4"
                    {...form.register("smtpSecure")}
                    data-testid="checkbox-smtp-secure"
                  />
                  <Label htmlFor="smtpSecure" className="cursor-pointer">
                    Connessione TLS implicita (consigliato su porta 465)
                  </Label>
                </div>
              </div>

              {/* Test email */}
              <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
                <div className="flex items-center space-x-2">
                  <Send className="h-4 w-4 text-blue-600" />
                  <h4 className="font-medium">Invia un'email di prova</h4>
                </div>
                <p className="text-xs text-gray-600">
                  Verifica subito le credenziali SMTP qui sopra inviando un'email a un indirizzo a tua scelta.
                  Le impostazioni vengono lette dal database, quindi <strong>salva prima</strong> qualsiasi modifica.
                </p>
                <div className="flex flex-col md:flex-row md:items-end gap-3">
                  <div className="flex-1">
                    <Label htmlFor="testEmailTo">Destinatario</Label>
                    <Input
                      id="testEmailTo"
                      type="email"
                      value={testEmailTo}
                      onChange={(e) => setTestEmailTo(e.target.value)}
                      placeholder={user?.email || "destinatario@example.com"}
                      disabled={testEmailMutation.isPending}
                      data-testid="input-test-email-to"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSendTestEmail}
                    disabled={testEmailMutation.isPending}
                    data-testid="button-send-test-email"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {testEmailMutation.isPending ? "Invio in corso..." : "Invia email di prova"}
                  </Button>
                </div>
                {testResult && (
                  <div
                    className={
                      testResult.kind === "success"
                        ? "flex items-start gap-2 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-900"
                        : "flex items-start gap-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900"
                    }
                    data-testid={
                      testResult.kind === "success" ? "test-email-success" : "test-email-error"
                    }
                  >
                    {testResult.kind === "success" ? (
                      <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    )}
                    <span className="break-words">{testResult.message}</span>
                  </div>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-900">
                <strong>📌 Suggerimenti per arrivare in inbox:</strong>
                <ul className="list-disc ml-5 mt-1 space-y-1">
                  <li>Usa una casella sul tuo dominio (es. <code>no-reply@tuodominio.it</code>), non Gmail/Libero/etc.</li>
                  <li>Sul DNS del dominio configura <strong>SPF</strong> e <strong>DKIM</strong> del tuo provider SMTP.</li>
                  <li>Aggiungi un record <strong>DMARC</strong> (anche solo <code>p=none</code>) per migliorare il punteggio.</li>
                </ul>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end pt-4 border-t">
              <Button
                type="submit"
                disabled={saveSettingsMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                {saveSettingsMutation.isPending
                  ? "Salvataggio..."
                  : "Salva Impostazioni"
                }
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}