import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  File,
  Clock,
  Eye,
  CheckCircle,
  Shield,
  Signature,
  PenTool,
  MessageSquare,
  Mail,
  Loader2,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import ProfessionalContractDocument from "@/components/professional-contract-document";
import { getMissingClientFields, getClientType } from "@/lib/required-client-fields";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import {
  ValidatedCityField,
  ValidatedAddressField,
  ValidatedCfPivaField,
  ValidatedMobileField,
  initialCfPivaValidation,
  isCfPivaBlocking,
  isMobileInvalid,
  type CfPivaValidation,
} from "@/components/validated-client-fields";

// Componente per le aree di firma cliccabili con modalità avanzata
function SignatureArea({
  onSign,
  disabled = false,
  signatureId,
  onGlobalSign
}: {
  onSign: (signature: string) => void;
  disabled?: boolean;
  signatureId: string;
  onGlobalSign?: (signature: string) => void;
}) {
  const [signed, setSigned] = useState(false);
  const [signatureText, setSignatureText] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState("");
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [signatureMode, setSignatureMode] = useState<'draw' | 'type'>('draw');
  const [typedSignature, setTypedSignature] = useState("");
  const [currentSignature, setCurrentSignature] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const handleClick = () => {
    if (disabled || signed) return;
    setShowSignatureModal(true);
    // Previeni lo scroll del body su mobile
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    e.preventDefault(); // Previene il comportamento di default del touch
    setIsDrawing(true);

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d')!;

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000000';

    let x, y;
    if ('touches' in e) {
      // Calcolo più preciso per touch su mobile
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      x = (e.touches[0].clientX - rect.left) * scaleX;
      y = (e.touches[0].clientY - rect.top) * scaleY;
    } else {
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      x = (e.clientX - rect.left) * scaleX;
      y = (e.clientY - rect.top) * scaleY;
    }

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current) return;
    e.preventDefault(); // Previene il comportamento di default del touch

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d')!;

    let x, y;
    if ('touches' in e) {
      // Calcolo più preciso per touch su mobile
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      x = (e.touches[0].clientX - rect.left) * scaleX;
      y = (e.touches[0].clientY - rect.top) * scaleY;
    } else {
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      x = (e.clientX - rect.left) * scaleX;
      y = (e.clientY - rect.top) * scaleY;
    }

    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000000';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d')!;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  };

  const saveSignature = () => {
    let signature = "";
    if (signatureMode === 'draw') {
      if (!canvasRef.current) return;
      const dataUrl = canvasRef.current.toDataURL('image/png');
      setSignatureDataUrl(dataUrl);
      setSignatureText("Firma disegnata");
      signature = dataUrl;
    } else {
      if (!typedSignature.trim()) return;
      setSignatureText(typedSignature);
      signature = typedSignature;
    }

    setCurrentSignature(signature);
    setShowSignatureModal(false);
    resetBodyStyles(); // Ripristina lo scroll quando si chiude il modal di firma
    setShowConfirmModal(true);
  };

  const confirmSignature = (applyToAll: boolean) => {
    setSigned(true);
    setShowConfirmModal(false);
    resetBodyStyles(); // Assicura che lo scroll sia ripristinato anche dopo la conferma

    if (applyToAll && onGlobalSign) {
      onGlobalSign(currentSignature);
    } else {
      onSign(currentSignature);
    }
  };

  const resetBodyStyles = () => {
    // Riabilita lo scroll del body
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
  };

  const cancelSignature = () => {
    setShowSignatureModal(false);
    setTypedSignature("");
    clearCanvas();
    resetBodyStyles();
  };

  useEffect(() => {
    if (canvasRef.current && showSignatureModal) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, [showSignatureModal, signatureMode]);

  return (
    <>
      <div
        onClick={handleClick}
        className={`
          border-2 border-dashed border-gray-400 bg-gray-50 p-4 rounded-lg text-center min-h-[80px] flex items-center justify-center cursor-pointer transition-all
          ${!disabled && !signed ? 'hover:border-blue-500 hover:bg-blue-50' : ''}
          ${signed ? 'border-green-500 bg-green-50' : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {signed ? (
          <div className="text-green-700">
            <CheckCircle className="h-6 w-6 mx-auto mb-3" />
            {signatureDataUrl ? (
              <img src={signatureDataUrl} alt="Firma" className="max-h-20 mx-auto mb-3" style={{minHeight: '60px'}} />
            ) : (
              <div className="font-semibold text-2xl py-3" style={{fontFamily: 'Dancing Script, cursive', fontSize: '32px'}}>
                {signatureText}
              </div>
            )}
            <div className="text-sm font-medium">✅ Firmato digitalmente</div>
          </div>
        ) : (
          <div className="text-gray-600">
            <PenTool className="h-6 w-6 mx-auto mb-2" />
            <div className="font-medium">Clicca qui per firmare</div>
            <div className="text-sm">Area firma digitale</div>
          </div>
        )}
      </div>

      {/* Modal per la firma */}
      {showSignatureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 touch-none">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-2xl w-full mx-2 sm:mx-4 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4 text-center">Apponi la tua firma</h3>

            {/* Selettore modalità */}
            <div className="flex mb-4 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setSignatureMode('draw')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                  signatureMode === 'draw'
                    ? 'bg-white text-gray-900 shadow'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                ✏️ Disegna
              </button>
              <button
                onClick={() => setSignatureMode('type')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                  signatureMode === 'type'
                    ? 'bg-white text-gray-900 shadow'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                ✍️ Scrivi
              </button>
            </div>

            {/* Area firma */}
            {signatureMode === 'draw' ? (
              <div className="mb-4">
                <div className="border-2 border-gray-300 rounded-lg bg-white p-2 sm:p-4">
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={200}
                    className="w-full h-auto max-w-full touch-none bg-white rounded"
                    style={{
                      aspectRatio: '2/1',
                      maxHeight: '200px',
                      touchAction: 'none'
                    }}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Disegna la tua firma nell'area sopra con il dito o mouse
                </p>
                <button
                  onClick={clearCanvas}
                  className="w-full mt-3 py-3 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg font-medium"
                >
                  🗑️ Cancella e ricomincia
                </button>
              </div>
            ) : (
              <div className="mb-4">
                <input
                  type="text"
                  value={typedSignature}
                  onChange={(e) => setTypedSignature(e.target.value)}
                  placeholder="Scrivi il tuo nome completo..."
                  className="w-full p-4 border border-gray-300 rounded-lg text-center text-2xl"
                  style={{fontFamily: 'Dancing Script, cursive', fontSize: '28px'}}
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Il testo verrà formattato come una firma elegante e leggibile
                </p>
              </div>
            )}

            {/* Pulsanti */}
            <div className="flex space-x-3">
              <button
                onClick={cancelSignature}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Annulla
              </button>
              <button
                onClick={saveSignature}
                disabled={
                  signatureMode === 'type' ? !typedSignature.trim() : false
                }
                className="flex-1 py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Conferma Firma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal di conferma firma */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4 text-center">Conferma la tua firma</h3>

            {/* Anteprima firma */}
            <div className="mb-6 p-4 border-2 border-gray-200 rounded-lg bg-gray-50">
              <p className="text-sm text-gray-600 mb-2 text-center">Anteprima della firma:</p>
              {signatureDataUrl ? (
                <img src={signatureDataUrl} alt="Anteprima firma" className="max-h-16 mx-auto" />
              ) : (
                <div className="text-center text-xl py-2" style={{fontFamily: 'Dancing Script, cursive', fontSize: '24px'}}>
                  {typedSignature}
                </div>
              )}
            </div>

            <p className="text-sm text-gray-700 mb-6 text-center">
              Vuoi utilizzare questa firma per tutti i campi del contratto o solo per questo campo specifico?
            </p>

            {/* Pulsanti di scelta */}
            <div className="space-y-3">
              <button
                onClick={() => confirmSignature(true)}
                className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                📝 Applica a tutti i campi firma
              </button>
              <button
                onClick={() => confirmSignature(false)}
                className="w-full py-3 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                ✏️ Solo per questo campo
              </button>
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setShowSignatureModal(true);
                  // Previeni lo scroll del body quando si riapre il modal di firma
                  document.body.style.overflow = 'hidden';
                  document.body.style.position = 'fixed';
                  document.body.style.width = '100%';
                }}
                className="w-full py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                ↩️ Torna indietro
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================================
// Modalità "cliente compila e firma": il cliente vede l'anteprima delle
// condizioni economiche, inserisce i propri dati anagrafici e poi sblocca
// la firma con OTP. Componente isolato per non interferire con il flusso
// classico del venditore.
// ============================================================================
function ClientFillFlow({
  contract,
  companySettings,
  onCompleted,
  embedded = false,
}: {
  contract: any;
  companySettings: any;
  onCompleted: () => void;
  embedded?: boolean;
}) {
  const { toast } = useToast();
  const initial = (contract.clientData || {}) as Record<string, any>;
  const [data, setData] = useState<Record<string, any>>({
    tipo_cliente: initial.tipo_cliente || "azienda",
    societa: initial.societa || "",
    sede: initial.sede || "",
    provincia_sede: initial.provincia_sede || "",
    indirizzo: initial.indirizzo || "",
    p_iva: initial.p_iva || "",
    pec: initial.pec || "",
    codice_univoco: initial.codice_univoco || "",
    cellulare: initial.cellulare || "",
    cliente_nome: initial.cliente_nome || "",
    nato_a: initial.nato_a || "",
    data_nascita: initial.data_nascita || "",
    residente_a: initial.residente_a || "",
    provincia_residenza: initial.provincia_residenza || "",
    indirizzo_residenza: initial.indirizzo_residenza || "",
    stesso_indirizzo: !!initial.stesso_indirizzo,
    email: initial.email || contract.sentToEmail || "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [vatValidation, setVatValidation] = useState<CfPivaValidation>(initialCfPivaValidation);

  const set = (k: string, v: any) => setData((d) => ({ ...d, [k]: v }));
  const tipo = getClientType(data);
  const isPrivato = tipo === "privato";
  const stessoIndirizzo = !!data.stesso_indirizzo;

  // Heuristics derivati per gating del bottone
  const cellulareInvalid = isMobileInvalid(data.cellulare || "");
  const pivaBlocking = isCfPivaBlocking(data.p_iva || "", vatValidation);

  // Sincronizza residenza con sede quando "stesso indirizzo" è attivo
  useEffect(() => {
    if (!stessoIndirizzo) return;
    setData((d) => ({
      ...d,
      residente_a: d.sede ?? "",
      provincia_residenza: d.provincia_sede ?? "",
      indirizzo_residenza: d.indirizzo ?? "",
    }));
  }, [stessoIndirizzo, data.sede, data.provincia_sede, data.indirizzo]);

  const missing = getMissingClientFields(data);
  const canSubmit =
    missing.length === 0 && !submitting && !cellulareInvalid && !pivaBlocking;

  const fmtMoney = (cents: number | null | undefined) => {
    if (cents == null) return "—";
    return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format((cents || 0) / 100);
  };
  const fmtDate = (d: any) => {
    if (!d) return "—";
    try { return new Date(d).toLocaleDateString("it-IT"); } catch { return "—"; }
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/client/contracts/${contract.contractCode}/client-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientData: data }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "Salvataggio non riuscito");
      toast({ title: "Dati salvati", description: "Ora puoi procedere alla firma." });
      onCompleted();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Errore", description: e?.message || "Riprova tra poco." });
    } finally {
      setSubmitting(false);
    }
  };

  const wrapperClass = embedded ? "" : "min-h-screen bg-slate-50";
  const contentClass = embedded
    ? "max-w-3xl mx-auto space-y-6"
    : "max-w-3xl mx-auto px-6 py-8 space-y-6";
  return (
    <div className={wrapperClass}>
      {/* Header — solo in modalità standalone */}
      {!embedded && (
        <div className="bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] text-white">
          <div className="max-w-3xl mx-auto px-6 py-6">
            <div className="text-sm opacity-90">{companySettings?.companyName || "Contratto"}</div>
            <h1 className="text-xl sm:text-2xl font-bold">Compila i tuoi dati e firma il contratto</h1>
            <p className="text-sm text-white/80 mt-2">
              Controlla l'anteprima delle condizioni qui sotto, inserisci i tuoi dati e procedi con la firma sicura via codice OTP.
            </p>
          </div>
        </div>
      )}

      <div className={contentClass}>
        {/* Anteprima condizioni — saltata in modalità embedded perché il
            documento completo è già visibile sotto */}
        {!embedded && (
        <Card className="rounded-2xl shadow-sm border border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg">Anteprima del contratto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-xs text-slate-500">Importo totale</div>
                <div className="font-semibold text-slate-900">{fmtMoney(contract.totalValue)}</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-xs text-slate-500">Durata</div>
                <div className="font-semibold text-slate-900">{contract.renewalDuration ?? 12} mesi</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-xs text-slate-500">Inizio</div>
                <div className="font-semibold text-slate-900">{fmtDate(contract.contractStartDate)}</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <div className="text-xs text-slate-500">Fine</div>
                <div className="font-semibold text-slate-900">{fmtDate(contract.contractEndDate)}</div>
              </div>
            </div>
            {contract.isPercentagePartnership && contract.partnershipPercentage != null && (
              <div className="text-sm bg-indigo-50 border border-indigo-100 rounded-lg p-3">
                Partnership a percentuale: <strong>{contract.partnershipPercentage}%</strong>
              </div>
            )}
            <p className="text-xs text-slate-500">
              Il documento completo con tutte le clausole sarà disponibile dopo aver compilato i tuoi dati.
            </p>
          </CardContent>
        </Card>
        )}

        {/* Tipo cliente */}
        <Card className="rounded-2xl shadow-sm border border-slate-200">
          <CardContent className="pt-6">
            <Label className="text-sm font-medium text-slate-700 mb-2 block">Sei un'azienda o un privato?</Label>
            <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-xl w-fit" data-testid="toggle-tipo-cliente-clientfill">
              {(["azienda", "privato"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => set("tipo_cliente", opt)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    tipo === opt ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600 hover:text-slate-800"
                  }`}
                  data-testid={`button-tipo-${opt}-clientfill`}
                >
                  {opt === "azienda" ? "Azienda" : "Privato"}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Dati azienda/privato */}
        <Card className="rounded-2xl shadow-sm border border-slate-200">
          <CardHeader><CardTitle className="text-lg">{isPrivato ? "Dati cliente privato" : "Dati Azienda/Società"}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Field label={isPrivato ? "Cognome e Nome" : "Nome società"}>
              <Input value={data.societa} onChange={(e) => set("societa", e.target.value)} placeholder={isPrivato ? "Es. Mario Rossi" : "Nome della società"} />
            </Field>
            <ValidatedCityField
              label={isPrivato ? "Città" : "Città sede legale"}
              value={data.sede}
              province={data.provincia_sede}
              onChange={(v) => set("sede", v)}
              onProvinceChange={(v) => set("provincia_sede", v)}
              testIdPrefix="input-clientfill-sede"
            />
            <ValidatedAddressField
              label="Indirizzo"
              value={data.indirizzo}
              onChange={(v) => set("indirizzo", v)}
              testId="input-clientfill-indirizzo"
            />
            <ValidatedCfPivaField
              label={isPrivato ? "Codice Fiscale" : "Codice Fiscale / P.IVA"}
              value={data.p_iva}
              validation={vatValidation}
              onChange={(v) => set("p_iva", v)}
              onValidationChange={setVatValidation}
              onLookup={(lookup) =>
                setData((d) => ({
                  ...d,
                  societa: d.societa || lookup.societa || "",
                  indirizzo: d.indirizzo || lookup.indirizzo || "",
                  sede: d.sede || lookup.sede || "",
                  provincia_sede: d.provincia_sede || lookup.provincia_sede || "",
                  postal_code: d.postal_code || lookup.postal_code || "",
                }))
              }
              isPrivato={isPrivato}
              testId="input-clientfill-piva"
            />
            {!isPrivato && (
              <>
                <Field label="Codice Univoco / SDI (opzionale)">
                  <Input value={data.codice_univoco} onChange={(e) => set("codice_univoco", e.target.value)} placeholder="7 caratteri" />
                </Field>
                <Field label="PEC (opzionale)">
                  <Input value={data.pec} onChange={(e) => set("pec", e.target.value)} placeholder="pec@esempio.com" />
                </Field>
              </>
            )}
            <Field label="Email" hint="L'email dove ti è arrivato questo link.">
              <Input type="email" value={data.email} disabled className="bg-slate-100" />
            </Field>
            <ValidatedMobileField
              label="Cellulare"
              value={data.cellulare}
              onChange={(v) => set("cellulare", v)}
              testId="input-clientfill-cellulare"
            />
          </CardContent>
        </Card>

        {/* Dati anagrafici */}
        <Card className="rounded-2xl shadow-sm border border-slate-200">
          <CardHeader><CardTitle className="text-lg">{isPrivato ? "Dati anagrafici" : "Dati del referente"}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={stessoIndirizzo}
                onChange={(e) => set("stesso_indirizzo", e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-slate-700">
                {isPrivato ? "La residenza coincide con l'indirizzo sopra" : "La residenza del referente coincide con l'indirizzo dell'azienda"}
              </span>
            </label>
            {!isPrivato && (
              <Field label="Nome e cognome del referente">
                <Input value={data.cliente_nome} onChange={(e) => set("cliente_nome", e.target.value)} placeholder="Es. Mario Rossi" />
              </Field>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Nato a">
                <Input value={data.nato_a} onChange={(e) => set("nato_a", e.target.value)} placeholder="Luogo di nascita" />
              </Field>
              <Field label="Data di nascita">
                <Input type="date" value={data.data_nascita} onChange={(e) => set("data_nascita", e.target.value)} />
              </Field>
            </div>
            <ValidatedCityField
              label="Città di residenza"
              value={data.residente_a}
              province={data.provincia_residenza}
              onChange={(v) => set("residente_a", v)}
              onProvinceChange={(v) => set("provincia_residenza", v)}
              disabled={stessoIndirizzo}
              testIdPrefix="input-clientfill-residente"
            />
            <ValidatedAddressField
              label="Indirizzo di residenza"
              value={data.indirizzo_residenza}
              onChange={(v) => set("indirizzo_residenza", v)}
              disabled={stessoIndirizzo}
              testId="input-clientfill-indirizzo-residenza"
            />
          </CardContent>
        </Card>

        {missing.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <div>
              <div className="font-semibold">Mancano alcuni campi obbligatori:</div>
              <ul className="list-disc ml-5 mt-1">
                {missing.slice(0, 6).map((m) => <li key={m.key}>{m.label}</li>)}
                {missing.length > 6 && <li>… e altri {missing.length - 6}</li>}
              </ul>
            </div>
          </div>
        )}

        <Button
          type="button"
          onClick={submit}
          disabled={!canSubmit}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white shadow-lg disabled:opacity-60"
          data-testid="button-clientfill-submit"
        >
          {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvataggio…</> : "Salva e prosegui alla firma"}
        </Button>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          I tuoi dati sono protetti e visibili solo all'azienda che ti ha inviato il contratto.
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-sm font-medium text-slate-700 mb-1.5 block">{label}</Label>
      {children}
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

export default function ClientView() {
  const { code } = useParams<{ code: string }>();
  const search = useSearch();
  const emailFromUrl = new URLSearchParams(search).get('email');
  const [showOtpInput, setShowOtpInput] = useState(false); // Changed state variable name for clarity
  const [otpCode, setOtpCode] = useState("");
  const [phoneNumber, setPhoneNumber] = useState(""); // State for phone number input
  const [successMessage, setSuccess] = useState(""); // State for success message
  const [error, setError] = useState(""); // State for error message
  const [isLoadingOtp, setIsLoadingOtp] = useState(false); // State for OTP loading indicator

  const [consents, setConsents] = useState({
    privacy: false,
    marketing: false,
  });
  const [signatures, setSignatures] = useState({
    contract: "",
    privacy: "",
    marketing: "",
  });

  // Destructure toast from useToast hook
  const { toast } = useToast();

  // Funzione per applicare la firma al campo del marketing
  const handleGlobalSignature = (signature: string) => {
    setSignatures({
      contract: "",
      privacy: "",
      marketing: signature,
    });
  };

  const { data: contract, isLoading } = useQuery({
    queryKey: [`/api/client/contracts/${code}`],
    enabled: !!code,
  });

  const clientData = contract?.clientData || {}; // Added default empty object
  const clientCode = contract?.contractCode || ""; // Added contractCode
  const companySettings = contract?.companySettings; // Extracted companySettings

  // Presenza live (Task #12) — apriamo un WS dedicato e inviamo un ping ogni
  // 15s. Nessuna UI per il cliente: serve solo a far accendere il pallino
  // verde "in linea ora" nella dashboard del venditore. Reconnect con backoff
  // semplice in caso di interruzioni di rete.
  useEffect(() => {
    if (!clientCode) return;
    let ws: WebSocket | null = null;
    let pingTimer: any = null;
    let reconnectTimer: any = null;
    let reconnectDelay = 2000;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      try {
        const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
        ws = new WebSocket(`${proto}//${window.location.host}/ws/client-presence/${clientCode}`);
      } catch {
        scheduleReconnect();
        return;
      }
      ws.onopen = () => {
        reconnectDelay = 2000;
        const sendPing = () => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            try { ws.send(JSON.stringify({ type: "ping", t: Date.now() })); } catch {}
          }
        };
        sendPing();
        pingTimer = setInterval(sendPing, 15000);
      };
      ws.onclose = () => {
        if (pingTimer) { clearInterval(pingTimer); pingTimer = null; }
        scheduleReconnect();
      };
      ws.onerror = () => { try { ws?.close(); } catch {} };
    };
    const scheduleReconnect = () => {
      if (stopped) return;
      if (reconnectTimer) return;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        reconnectDelay = Math.min(reconnectDelay * 2, 30000);
        connect();
      }, reconnectDelay);
    };
    connect();

    const handleBeforeUnload = () => {
      stopped = true;
      try { ws?.close(); } catch {}
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      stopped = true;
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (pingTimer) clearInterval(pingTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try { ws?.close(); } catch {}
    };
  }, [clientCode]);

  // Inizializza il numero di telefono dal contratto quando viene caricato
  useEffect(() => {
    if (contract && contract.clientData) {
      const clientData = contract.clientData as any;
      const phone = clientData.phone || clientData.telefono || clientData.cellulare || "";
      setPhoneNumber(phone); // Use setPhoneNumber here
    }
  }, [contract]);

  const handleSendOtp = async () => {
    // Per il metodo email, non serve validare il numero di telefono
    if (companySettings?.otpMethod !== "email" && !phoneNumber.trim()) {
      setError("Inserisci un numero di telefono valido");
      return;
    }

    setIsLoadingOtp(true);
    setError("");
    setSuccess("");

    try {
      const requestBody: any = {};

      // Invia il numero di telefono solo se il metodo OTP è SMS/Twilio
      if (companySettings?.otpMethod !== "email" && phoneNumber.trim()) {
        requestBody.phoneNumber = phoneNumber.trim();
      } else if (companySettings?.otpMethod === "email") {
        // For email method, the API might not need phoneNumber in the body,
        // or it might need the email address from the contract itself.
        // Assuming the API handles getting the email from the contract context or clientData.
        // If the API requires the email explicitly:
        // requestBody.email = contract.sentToEmail || clientData.email || "";
      }

      const response = await fetch(`/api/client/contracts/${clientCode}/send-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to send OTP");
      }

      const result = await response.json();
      console.log("OTP sent successfully:", result);

      setShowOtpInput(true);

      // Messaggio di successo basato sul metodo OTP utilizzato
      if (companySettings?.otpMethod === "email") {
        setSuccess("Codice OTP inviato via email!");
      } else {
        setSuccess("Codice OTP inviato via SMS!");
      }
    } catch (error: any) {
      console.error("Error sending OTP:", error);
      setError(error.message || "Errore nell'invio del codice OTP");
    } finally {
      setIsLoadingOtp(false);
    }
  };

  const signContractMutation = useMutation({
    mutationFn: async (data: { otpCode: string; consents: any; signatures: any }) => {
      console.log("🖊️ Inizio processo di firma contratto:", code);

      if (!consents.privacy) {
        console.log("❌ Mancanza consenso privacy");
        throw new Error("Devi accettare l'informativa privacy per procedere");
      }

      if (!signatures.marketing) {
        console.log("❌ Mancanza firma");
        throw new Error("Devi apporre la firma per procedere");
      }

      console.log("✅ Tutti i requisiti soddisfatti, invio richiesta di firma...");
      console.log("📋 Dati firma:", {otpCode, consents, signatures: { ...signatures, marketing: signatures.marketing ? "PRESENTE" : "MANCANTE" } });

      const response = await apiRequest("POST", `/api/client/contracts/${code}/sign`, {
        otpCode,
        consents,
        signatures,
      });

      console.log("✅ Risposta server firma:", response);
      return response;
    },
    onSuccess: () => {
      console.log("🎉 Firma completata con successo!");

      // Redirect immediato alla pagina di conferma server-rendered:
      // niente setTimeout, niente window.reload(), niente rerender React.
      // Questo evita che estensioni del browser (es. Google Translate) o
      // crash JS lascino il cliente con uno schermo bianco senza conferma
      // della firma — incidente #75.
      try {
        window.location.replace(`/firmato/${encodeURIComponent(code || "")}`);
      } catch (navErr) {
        console.error("❌ Redirect alla pagina di conferma fallito:", navErr);
        try {
          toast({
            title: "Contratto firmato!",
            description: "Il contratto è stato firmato con successo. Riceverai una copia via email.",
          });
        } catch {}
        queryClient.invalidateQueries({ queryKey: [`/api/client/contracts/${code}`] });
      }
    },
    onError: (error: any) => {
      console.error("❌ Errore durante la firma:");
      console.error("  - Messaggio:", error.message);
      console.error("  - Errore completo:", error);

      try {
        toast({
          variant: "destructive",
          title: "Errore nella firma",
          description: error.message.includes("Invalid or expired OTP")
            ? "Codice OTP non valido o scaduto. Richiedi un nuovo codice."
            : "Si è verificato un errore durante la firma del contratto.",
        });
      } catch (toastError) {
        console.error("❌ Errore nel toast (onError):", toastError);
      }
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-200 border-t-primary mx-auto"></div>
            <File className="h-8 w-8 text-primary absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="mt-6 text-gray-600 font-medium">Caricamento contratto sicuro...</p>
          <p className="mt-2 text-sm text-gray-500">Stiamo verificando l'autenticità del documento</p>
        </div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <File className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Contratto non trovato
            </h1>
            <p className="text-gray-600">
              Il link potrebbe essere scaduto o non valido.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const clientName = clientData.cliente_nome || clientData.nome || "Cliente";
  const clientEmail = clientData.email || "";

  // Combine predefined bonuses from template with manual bonuses
  let combinedBonusList = [];

  // Add predefined bonuses from template
  if (contract.template?.predefinedBonuses && Array.isArray(contract.template.predefinedBonuses)) {
    combinedBonusList = contract.template.predefinedBonuses.map((bonus: any) => ({
      bonus_descrizione: bonus.description + (bonus.value ? ` (${bonus.value}${bonus.type === 'percentage' ? '%' : '€'})` : '')
    }));
  }

  // Add manual bonuses from client data
  if (clientData.bonus_list && Array.isArray(clientData.bonus_list)) {
    combinedBonusList = [...combinedBonusList, ...clientData.bonus_list];
  }

  const bonusList = combinedBonusList;

  // Priorità: usa rata_list se presente (rate personalizzate), altrimenti payment_plan (calcolo automatico)
  const usingCustomInstallments = clientData.rata_list && Array.isArray(clientData.rata_list) && clientData.rata_list.length > 0;
  const rawPaymentData = usingCustomInstallments ? clientData.rata_list : (clientData.payment_plan || []);

  // Normalizza il formato delle rate per la visualizzazione
  const paymentPlan = rawPaymentData.map((payment: any, index: number) => {
    return {
      rata_numero: index + 1,
      rata_importo: payment.rata_importo || payment.amount || '0.00',
      rata_scadenza: payment.rata_scadenza || payment.date || ''
    };
  });

  const getStatusConfig = (status: string) => {
    const configs = {
      sent: {
        label: "In Attesa di Firma",
        icon: Clock,
        color: "bg-yellow-100 text-yellow-800",
        description: "Il contratto è stato inviato e attende la tua firma"
      },
      viewed: {
        label: "Visualizzato",
        icon: Eye,
        color: "bg-blue-100 text-blue-800",
        description: "Hai visualizzato il contratto, procedi con la firma"
      },
      signed: {
        label: "Firmato",
        icon: CheckCircle,
        color: "bg-green-100 text-green-800",
        description: "Il contratto è stato firmato con successo"
      },
    };
    return configs[status as keyof typeof configs] || configs.sent;
  };

  const statusConfig = getStatusConfig(contract.status);
  const StatusIcon = statusConfig.icon;

  // Modalità "client_fill": se il cliente non ha ancora compilato i propri
  // dati, mostriamo il flow dedicato (anteprima + form) invece del documento
  // completo. Una volta salvati i dati ricarichiamo e cadiamo nel ramo normale
  // così il cliente può procedere con la firma OTP.
  const isClientFillPending =
    (contract as any).fillMode === "client_fill" &&
    (contract as any).dataComplete === false &&
    contract.status !== "signed";

  return (
    <ProfessionalContractDocument
      mode="sign"
      companySettings={companySettings}
      clientData={clientData}
      template={{
        ...contract.template,
        // Sorgente unica: usiamo `generatedContent` (HTML finale risolto
        // dal server con placeholder e sezioni modulari già iniettate)
        // così client-view, preview e PDF rendono identicamente.
        content: (contract as { generatedContent?: string }).generatedContent
          ?? contract.template?.content,
      }}
      contract={{
        createdAt: contract.createdAt,
        signedAt: contract.signedAt,
        status: contract.status,
        isPercentagePartnership: contract.isPercentagePartnership,
        partnershipPercentage: contract.partnershipPercentage,
        renewalDuration: contract.renewalDuration,
        contractStartDate: contract.contractStartDate,
        contractEndDate: contract.contractEndDate,
      }}
      paymentPlan={paymentPlan}
      bonusList={bonusList}
      usingCustomInstallments={usingCustomInstallments}
      beforeDocumentContent={
        isClientFillPending ? (
          <Card className="border border-indigo-200 bg-indigo-50 shadow-sm mb-6">
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold text-indigo-900 mb-1 flex items-center gap-2">
                <PenTool className="h-5 w-5" />
                Compila i tuoi dati per sbloccare la firma
              </h3>
              <p className="text-sm text-indigo-800">
                Puoi scorrere e leggere tutto il contratto qui sotto. Per procedere con la firma e la verifica OTP, prima inserisci i tuoi dati nel modulo qui in alto.
              </p>
              <div className="mt-5">
                <ClientFillFlow
                  embedded
                  contract={contract}
                  companySettings={companySettings}
                  onCompleted={() => {
                    queryClient.invalidateQueries({ queryKey: [`/api/client/contracts/${code}`] });
                  }}
                />
              </div>
            </CardContent>
          </Card>
        ) : undefined
      }
      /*
       * `sections` prop non passato: il body del contratto in
       * `template.content` è già il `generatedContent` con le sezioni
       * modulari iniettate dal server. Passarle di nuovo causerebbe
       * doppio rendering.
       */
      signatureArea={
        isClientFillPending ? (
          <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
            Firma disponibile dopo aver compilato i tuoi dati nel modulo in alto.
          </div>
        ) : (
          <SignatureArea
            signatureId="marketing"
            onSign={(signature) => setSignatures(prev => ({ ...prev, marketing: signature }))}
            onGlobalSign={handleGlobalSignature}
            disabled={contract.status === 'signed'}
          />
        )
      }
      afterDocumentContent={
        isClientFillPending ? null : (
        <>
          {contract.status !== "signed" && !signatures.marketing && (
            <Card className="border border-orange-200 bg-orange-50 shadow-lg">
              <CardContent className="pt-6 text-center">
                <div className="animate-in fade-in duration-500">
                  <PenTool className="mx-auto h-16 w-16 text-orange-500 mb-4" />
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    Firma Richiesta nel Documento
                  </h3>
                  <p className="text-lg text-gray-600 mb-6">
                    Prima di procedere con la firma digitale, è necessario apporre la firma nel documento sopra.
                  </p>
                  <div className="bg-orange-100 border border-orange-200 rounded-lg p-4 text-sm text-orange-800">
                    <p className="font-medium mb-2">Come procedere:</p>
                    <ol className="text-left space-y-1 ml-4">
                      <li>1. Scorri il documento sopra fino alla sezione firma</li>
                      <li>2. Clicca sull'area "Clicca qui per firmare"</li>
                      <li>3. Apponi la tua firma digitale</li>
                      <li>4. Torna qui per completare il processo di autenticazione</li>
                    </ol>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {contract.status === "viewed" && !signatures.marketing && (
            <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Shield className="mr-2 h-5 w-5" />
                Verifica Identità
              </h3>

              {!showOtpInput ? (
                <div className="space-y-4">
                  {companySettings?.otpMethod === "email" ? (
                    <div>
                      <p className="text-sm text-gray-600 mb-4">
                        Per procedere con la firma, riceverai un codice di verifica via email.
                      </p>
                      <div>
                        <Label htmlFor="emailAddress">Email di Verifica</Label>
                        <Input
                          id="emailAddress"
                          type="email"
                          value={contract.sentToEmail || clientData.email || ""}
                          readOnly
                          className="mt-1 bg-gray-100 cursor-not-allowed"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Il codice OTP verrà inviato a questa email
                        </p>
                      </div>
                      <Button
                        onClick={handleSendOtp}
                        disabled={isLoadingOtp}
                        className="w-full"
                      >
                        {isLoadingOtp ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Invio in corso...
                          </>
                        ) : (
                          <>
                            <Mail className="mr-2 h-4 w-4" />
                            Invia Codice OTP via Email
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-gray-600 mb-4">
                        Per procedere con la firma, è necessario verificare la tua identità tramite SMS.
                      </p>
                      <div>
                        <Label htmlFor="phoneNumber">Numero di Telefono</Label>
                        <Input
                          id="phoneNumber"
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder="+39 XXX XXX XXXX"
                          className="mt-1"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Inserisci il tuo numero di telefono per ricevere il codice OTP via SMS
                        </p>
                      </div>
                      <Button
                        onClick={handleSendOtp}
                        disabled={!phoneNumber.trim() || isLoadingOtp}
                        className="w-full"
                      >
                        {isLoadingOtp ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Invio in corso...
                          </>
                        ) : (
                          <>
                            <MessageSquare className="mr-2 h-4 w-4" />
                            Invia Codice OTP via SMS
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="otpCode">Codice OTP</Label>
                    <Input
                      id="otpCode"
                      type="text"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="Inserisci il codice a 6 cifre"
                      className="mt-1 text-center text-lg tracking-widest"
                      maxLength={6}
                    />
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      {companySettings?.otpMethod === "email"
                        ? "Inserisci il codice ricevuto via email"
                        : "Inserisci il codice ricevuto via SMS"
                      }</p>
                  </div>
                  {error && <p className="text-sm text-red-500">{error}</p>}
                  {successMessage && <p className="text-sm text-green-500">{successMessage}</p>}
                </div>
              )}
            </div>
          )}

          {contract.status !== "signed" && signatures.marketing && (
            <Card className="border border-gray-300 shadow-lg bg-white">
              <CardHeader className="bg-gray-50 border-b border-gray-200 p-4 sm:p-6">
                <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                  <div className="flex items-center">
                    <div className="bg-gray-100 p-2 rounded-full mr-3">
                      <Signature className="h-6 w-6 text-gray-600" />
                    </div>
                    <div>
                      <div className="text-xl sm:text-2xl font-bold text-gray-800">Processo di Firma Elettronica</div>
                      <div className="text-sm font-normal text-gray-600">Sicuro e conforme agli standard europei • Seguire i 3 passaggi</div>
                    </div>
                  </div>
                  <Badge className="bg-white text-gray-700 border-2 border-gray-300 px-3 py-2 text-sm font-medium">
                    <Shield className="mr-2 h-4 w-4" />
                    eIDAS Compliant
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 sm:pt-8 px-4 sm:px-8 bg-white rounded-b-lg">
                <div className="mb-8 sm:mb-10 bg-gray-50 p-6 rounded-lg border border-gray-200">
                  <div className="text-center mb-4">
                    <h3 className="text-lg font-bold text-gray-800 mb-2">Progresso Firma Digitale</h3>
                    <div className="flex items-center justify-between text-sm text-gray-700 mb-3">
                      <span className="font-semibold">Passaggio {signContractMutation.isPending ? '3' : (showOtpInput ? '2' : '1')} di 3</span>
                      <span className="font-semibold">{signContractMutation.isPending ? '100%' : (showOtpInput ? '66%' : '33%')} completato</span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 sm:h-4">
                    <div
                      className={`h-3 sm:h-4 rounded-full transition-all duration-700 ease-out ${
                        signContractMutation.isPending ? 'bg-gray-700' : (showOtpInput ? 'bg-gray-600' : 'bg-gray-500')
                      }`}
                      style={{ width: signContractMutation.isPending ? '100%' : (showOtpInput ? '66%' : '33%') }}
                    ></div>
                  </div>
                  {signContractMutation.isPending && (
                    <div className="text-center text-sm text-gray-700 mt-3 font-semibold">
                      Finalizzazione firma in corso...
                    </div>
                  )}
                  <div className="flex justify-between mt-4 text-xs text-gray-600">
                    <div className={`text-center ${!showOtpInput ? 'font-bold text-gray-800' : 'text-gray-500'}`}>
                      {companySettings?.otpMethod === "email" ? "Verifica Email" : "Verifica Telefono"}
                    </div>
                    <div className={`text-center ${showOtpInput && !signContractMutation.isPending ? 'font-bold text-gray-800' : 'text-gray-500'}`}>
                      Codice OTP
                    </div>
                    <div className={`text-center ${signContractMutation.isPending ? 'font-bold text-gray-800' : 'text-gray-500'}`}>
                      Firma Finale
                    </div>
                  </div>
                </div>

                <div className="max-w-lg mx-auto space-y-6 sm:space-y-8">
                  <div className="bg-gray-50 border border-gray-300 rounded-lg p-6">
                    <div className="flex items-center mb-4">
                      <div className="bg-gray-700 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-3">
                        1
                      </div>
                      <Label className="text-base font-bold text-gray-800">
                        {companySettings?.otpMethod === "email" ? "Conferma la tua email" : "Conferma il tuo numero di telefono"}
                      </Label>
                    </div>
                    <div className="space-y-3">
                      {companySettings?.otpMethod === "email" ? (
                        <div className="space-y-3">
                          <div>
                            <Label htmlFor="emailForOtp">Email di Verifica</Label>
                            <Input
                              id="emailForOtp"
                              type="email"
                              value={contract.sentToEmail || clientData.email || ""}
                              readOnly
                              className="h-12 text-base font-medium bg-gray-100 border border-gray-300 text-gray-800 cursor-not-allowed"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Il codice OTP verrà inviato a questa email
                            </p>
                          </div>
                          <Button
                            onClick={handleSendOtp}
                            disabled={isLoadingOtp}
                            className="w-full h-12 px-6 text-sm sm:text-base bg-gray-700 hover:bg-gray-800 disabled:bg-gray-400"
                          >
                            {isLoadingOtp ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Invio...
                              </>
                            ) : (
                              <>
                                <Mail className="mr-2 h-4 w-4" />
                                Invia Codice OTP via Email
                              </>
                            )}
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                            <div className="flex-1 relative">
                              <Input
                                id="phoneNumber"
                                type="tel"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                readOnly={showOtpInput}
                                placeholder="+39 XXX XXX XXXX"
                                className="h-12 text-base font-medium bg-white border border-gray-300 text-gray-800 focus:border-blue-500"
                              />
                            </div>
                            <Button
                              onClick={handleSendOtp}
                              disabled={!phoneNumber.trim() || isLoadingOtp}
                              className="h-12 px-6 text-sm sm:text-base whitespace-nowrap bg-gray-700 hover:bg-gray-800 disabled:bg-gray-400"
                            >
                              {isLoadingOtp ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Invio...
                                </>
                              ) : (
                                <>
                                  <MessageSquare className="mr-2 h-4 w-4" />
                                  Invia Codice OTP via SMS
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                      {error && <p className="text-sm text-red-500">{error}</p>}
                      {successMessage && <p className="text-sm text-green-500">{successMessage}</p>}
                    </div>
                  </div>

                  {showOtpInput && (
                    <div className="bg-gray-50 border border-gray-300 rounded-lg p-6">
                      <div className="flex items-center mb-4">
                        <div className="bg-gray-700 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-3">
                          2
                        </div>
                        <Label className="text-base font-bold text-gray-800">
                          Inserisci il codice OTP
                        </Label>
                      </div>
                      <div className="flex justify-center">
                        <InputOTP
                          maxLength={6}
                          value={otpCode}
                          onChange={setOtpCode}
                          className="gap-2 sm:gap-3"
                        >
                          <InputOTPGroup className="gap-2 sm:gap-3">
                            <InputOTPSlot index={0} className="h-14 w-12 sm:h-16 sm:w-14 text-xl border border-gray-300 bg-white" />
                            <InputOTPSlot index={1} className="h-14 w-12 sm:h-16 sm:w-14 text-xl border border-gray-300 bg-white" />
                            <InputOTPSlot index={2} className="h-14 w-12 sm:h-16 sm:w-14 text-xl border border-gray-300 bg-white" />
                            <InputOTPSlot index={3} className="h-14 w-12 sm:h-16 sm:w-14 text-xl border border-gray-300 bg-white" />
                            <InputOTPSlot index={4} className="h-14 w-12 sm:h-16 sm:w-14 text-xl border border-gray-300 bg-white" />
                            <InputOTPSlot index={5} className="h-14 w-12 sm:h-16 sm:w-14 text-xl border border-gray-300 bg-white" />
                          </InputOTPGroup>
                        </InputOTP>
                      </div>
                      <p className="text-xs text-gray-500 mt-2 text-center">
                        {companySettings?.otpMethod === "email"
                          ? "Inserisci il codice ricevuto via email"
                          : "Inserisci il codice ricevuto via SMS"
                        }</p>
                    </div>
                  )}

                  <div className="flex items-center justify-center my-6">
                    <div className="flex-grow border-t border-gray-300"></div>
                    <div className="mx-4 bg-gray-100 px-3 py-1 rounded">
                      <span className="text-gray-700 font-semibold text-sm">CONSENSI E FIRMA</span>
                    </div>
                    <div className="flex-grow border-t border-gray-300"></div>
                  </div>

                  <div className="bg-gray-50 border border-gray-300 rounded-lg p-6">
                    <div className="flex items-center mb-4">
                      <div className="bg-gray-700 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold mr-3">
                        3
                      </div>
                      <Label className="text-base font-bold text-gray-800">
                        Consensi e Firma Finale
                      </Label>
                    </div>

                    <div className="space-y-4 mb-6">
                      <div className="flex items-start space-x-3 p-4 bg-white rounded-lg border border-gray-200">
                        <Checkbox
                          id="privacy"
                          checked={consents.privacy}
                          onCheckedChange={(checked) =>
                            setConsents(prev => ({ ...prev, privacy: !!checked }))
                          }
                          className="mt-1 h-5 w-5"
                        />
                        <Label htmlFor="privacy" className="text-sm text-gray-700 leading-relaxed cursor-pointer font-medium">
                          Accetto l'informativa sulla privacy e il trattamento dei dati personali
                          <span className="text-red-500 ml-1 font-bold">*</span>
                        </Label>
                      </div>

                      <div className="flex items-start space-x-3 p-4 bg-white rounded-lg border border-gray-200">
                        <Checkbox
                          id="marketing"
                          checked={consents.marketing}
                          onCheckedChange={(checked) =>
                            setConsents(prev => ({ ...prev, marketing: !!checked }))
                          }
                          className="mt-1 h-5 w-5"
                        />
                        <Label htmlFor="marketing" className="text-sm text-gray-700 leading-relaxed cursor-pointer font-medium">
                          Acconsento a ricevere comunicazioni commerciali e promozionali
                        </Label>
                      </div>
                    </div>

                    <Button
                      onClick={() => {
                        console.log("Click su pulsante firma");
                        signContractMutation.mutate({ otpCode, consents, signatures });
                      }}
                      disabled={
                        !showOtpInput ||
                        otpCode.length !== 6 ||
                        !consents.privacy ||
                        !signatures.marketing ||
                        signContractMutation.isPending
                      }
                      className="w-full bg-gray-800 hover:bg-gray-900 text-white py-5 text-lg font-bold min-h-[60px] rounded-lg"
                    >
                      <Signature className="mr-3 h-6 w-6" />
                      {signContractMutation.isPending ? (
                        <div className="flex items-center">
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
                          Firma in corso...
                        </div>
                      ) : "FIRMA IL DOCUMENTO"}
                    </Button>
                  </div>

                  {signContractMutation.isPending && (
                    <div className="text-center text-sm text-gray-600 mt-2">
                      <div className="animate-pulse">
                        Elaborazione firma digitale sicura...
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-center text-xs text-gray-500 space-x-2">
                    <Shield className="h-4 w-4" />
                    <span>
                      La firma elettronica è legalmente valida e conforme agli standard eIDAS
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {contract.status === "signed" && (
            <Card className="border-green-200 shadow-lg">
              <CardContent className="pt-6 text-center">
                <div className="animate-in fade-in duration-500">
                  <CheckCircle className="mx-auto h-20 w-20 text-green-500 mb-6" />
                  <h3 className="text-3xl font-bold text-gray-900 mb-4">
                    Contratto Firmato con Successo!
                  </h3>
                  <p className="text-lg text-gray-600 mb-6">
                    Il documento è stato firmato digitalmente il{" "}
                    {new Date(contract.signedAt).toLocaleDateString('it-IT', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-sm text-green-800 mb-4">
                    <p className="font-medium mb-3 text-lg">Processo Completato</p>
                    <ul className="text-left space-y-2">
                      <li className="flex items-center">
                        <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                        Riceverai una copia del contratto firmato via email
                      </li>
                      <li className="flex items-center">
                        <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                        Il documento è conservato in modo sicuro nei nostri archivi
                      </li>
                      <li className="flex items-center">
                        <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                        La firma elettronica ha piena validità legale
                      </li>
                    </ul>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-blue-800 font-medium">
                      Controlla la tua email per la copia del contratto firmato
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
        )
      }
    />
  );
}