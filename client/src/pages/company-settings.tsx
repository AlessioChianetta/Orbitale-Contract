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
import { Building2, Save, Upload, MessageSquare, Mail, Settings } from "lucide-react";

const settingsFormSchema = insertCompanySettingsSchema;
type SettingsForm = z.infer<typeof settingsFormSchema>;

export default function CompanySettings() {
  const { toast } = useToast();
  const [logoFile, setLogoFile] = useState<File | null>(null);

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
      toast({
        title: "Impostazioni salvate",
        description: "Le impostazioni dell'azienda sono state aggiornate con successo"
      });
      setLogoFile(null);
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

              {/* Email Info - Show when Email is selected */}
              {form.watch("otpMethod") === "email" && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Mail className="h-4 w-4 text-green-600" />
                    <h4 className="font-medium text-green-900">Configurazione Email SMTP</h4>
                  </div>
                  <p className="text-sm text-green-800">
                    I codici OTP verranno inviati via email utilizzando le credenziali SMTP già configurate nel sistema.
                    Assicurati che le variabili d'ambiente SMTP siano impostate correttamente.
                  </p>
                </div>
              )}
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