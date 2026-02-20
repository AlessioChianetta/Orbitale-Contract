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
      console.log("📧 Dati risposta:", arguments[0]);

      try {
        toast({
          title: "Contratto firmato!",
          description: "Il contratto è stato firmato con successo. Riceverai una copia via email.",
        });
      } catch (toastError) {
        console.error("❌ Errore nel toast (onSuccess):", toastError);
      }

      // Invalidate contract data to refresh and show signed status
      queryClient.invalidateQueries({ queryKey: [`/api/client/contracts/${code}`] });
      setTimeout(() => {
        console.log("🔄 Esecuzione reload pagina (fallback)...");
        window.location.reload();
      }, 1500);
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

  return (
    <ProfessionalContractDocument
      mode="sign"
      companySettings={companySettings}
      clientData={clientData}
      template={contract.template}
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
      signatureArea={
        <SignatureArea
          signatureId="marketing"
          onSign={(signature) => setSignatures(prev => ({ ...prev, marketing: signature }))}
          onGlobalSign={handleGlobalSignature}
          disabled={contract.status === 'signed'}
        />
      }
      afterDocumentContent={
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
      }
    />
  );
}