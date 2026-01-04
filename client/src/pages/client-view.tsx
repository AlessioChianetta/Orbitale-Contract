import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  File,
  Clock,
  Eye,
  Gift,
  Calendar,
  CheckCircle,
  Shield,
  Signature,
  Phone,
  PenTool,
  MessageSquare,
  Mail,
  Loader2,
  FileText,
  Building2,
  User,
  MapPin,
  Euro,
  AlertCircle
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

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

      // Reload the page to show the signed contract
      setTimeout(() => {
        console.log("🔄 Esecuzione reload pagina (fallback)...");
        window.location.reload();
      }, 2000);
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 py-2 sm:py-8">
      <div className="max-w-4xl mx-auto px-2 sm:px-4 lg:px-8 animate-in slide-in-from-bottom-4 duration-500">
        {/* Contract Header */}
        <Card className="mb-3 sm:mb-6 shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="border-b border-gray-200/50 p-3 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
              <div className="flex items-center space-x-3 sm:space-x-4">
                <div className="p-2 sm:p-3 bg-blue-100 rounded-full">
                  <File className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-lg sm:text-2xl font-bold text-gray-900">
                    Contratto Digitale
                  </CardTitle>
                  <p className="text-xs sm:text-sm text-gray-600 mt-1 flex flex-col sm:flex-row sm:items-center">
                    <span className="mb-1 sm:mb-0 sm:mr-2">Codice:</span>
                    <code className="px-2 py-1 bg-gray-100 rounded text-xs font-mono tracking-wider">
                      {contract.contractCode}
                    </code>
                  </p>
                </div>
              </div>
              <div className="text-center sm:text-right">
                <Badge className={`${statusConfig.color} flex items-center justify-center px-2 sm:px-3 py-1 sm:py-2 text-xs sm:text-sm font-medium`}>
                  <StatusIcon className="mr-1 sm:mr-2 h-3 w-3 sm:h-5 sm:w-5" />
                  {statusConfig.label}
                </Badge>
                <p className="text-xs text-gray-500 mt-1 sm:mt-2">{statusConfig.description}</p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Dettagli Cliente
                </h4>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-900">{clientName}</p>
                  <p className="text-sm text-gray-600">{clientEmail}</p>
                  <p className="text-sm text-gray-600">{phoneNumber || 'Numero non specificato'}</p>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Dettagli Contratto
                </h4>
                <div className="space-y-1">
                  <p className="text-sm text-gray-900">
                    {contract.isPercentagePartnership ? 'Modello Partnership: ' : 'Valore Totale: '}
                    <span className="font-semibold">
                      {(() => {
                        // Check if it's a percentage partnership
                        if (contract.isPercentagePartnership && contract.partnershipPercentage) {
                          return `${contract.partnershipPercentage}% sul fatturato TOTALE`;
                        }
                        // Calculate total value based on payment plan
                        else if (paymentPlan.length > 0) {
                          const totalFromPayments = paymentPlan.reduce((sum, payment) =>
                            sum + parseFloat(payment.rata_importo), 0
                          );
                          return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })
                            .format(totalFromPayments);
                        } else if (contract.totalValue) {
                          return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })
                            .format(contract.totalValue / 100);
                        } else {
                          return "Non specificato";
                        }
                      })()}
                    </span>
                  </p>
                  {/* Add special highlighting for partnership contracts */}
                  {contract.isPercentagePartnership && contract.partnershipPercentage && (
                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
                      <strong>🤝 Partnership:</strong> Compenso basato su percentuale del fatturato mensile
                    </div>
                  )}
                  <p className="text-sm text-gray-600">
                    Data Creazione: {new Date(contract.createdAt).toLocaleDateString('it-IT')}
                  </p>
                  {contract.signedAt && (
                    <p className="text-sm text-gray-600">
                      Data Firma: {new Date(contract.signedAt).toLocaleDateString('it-IT')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Separatore Sezione Documento */}
        <div className="flex items-center justify-center my-8">
          <div className="flex-grow border-t-2 border-gray-200"></div>
          <div className="mx-6 bg-white px-4 py-2 rounded-full border-2 border-blue-200 shadow-md">
            <div className="flex items-center text-blue-700 font-semibold">
              <File className="mr-2 h-5 w-5" />
              <span className="text-sm uppercase tracking-wide">Documento da Firmare</span>
            </div>
          </div>
          <div className="flex-grow border-t-2 border-gray-200"></div>
        </div>

        {/* Document Viewer - Professional Layout */}
        <Card className="mb-8 shadow-xl border-2 border-blue-200 bg-gradient-to-br from-white to-blue-50">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-b">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <File className="mr-3 h-6 w-6 text-white" />
                <div>
                  <div className="text-lg font-bold">📄 Documento Contratto</div>
                  <div className="text-sm font-normal text-blue-100">Visualizzazione sicura e protetta • Scorri per leggere tutto</div>
                </div>
              </div>
              <Badge variant="outline" className="bg-white text-green-700 border-green-200">
                <Shield className="mr-1 h-3 w-3" />
                Documento Verificato
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="bg-white border-gray-200 p-3 sm:p-8 text-sm max-h-[800px] overflow-y-auto">
              {/* Header with Logo and Company Info */}
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-6 sm:mb-8 space-y-4 sm:space-y-0">
                <div className="flex justify-center sm:justify-start">
                  {companySettings?.logoUrl ? (
                    <img
                      src={companySettings.logoUrl}
                      alt="Logo"
                      className="max-w-[80px] sm:max-w-[120px] max-h-[50px] sm:max-h-[80px] object-contain"
                    />
                  ) : (
                    <div className="bg-black text-white p-2 sm:p-4 font-bold text-lg sm:text-2xl" style={{width: '80px', height: '50px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center'}}>
                      <div className="text-xs sm:text-sm">CODICE</div>
                      <div className="text-xl sm:text-4xl">1%</div>
                    </div>
                  )}
                </div>
                <div className="text-center sm:text-right text-xs sm:text-xs leading-tight space-y-1">
                  <div className="font-bold text-sm sm:text-base">{companySettings?.companyName || 'Nome Azienda'}</div>
                  <div>{companySettings?.address || 'Indirizzo'} Cap {companySettings?.postalCode || 'CAP'} {companySettings?.city || 'Città'} ({companySettings?.city ? 'MI' : 'Provincia'})</div>
                  <div>C.F. e P.I. {companySettings?.taxId || 'Codice Fiscale/P.IVA'}</div>
                  <div>Codice univoco: {companySettings?.uniqueCode || 'Codice Univoco'}</div>
                  <div>Pec: {companySettings?.pec || 'email@pec.it'}</div>
                </div>
              </div>

              {/* Contract Title */}
              <div className="font-bold text-base sm:text-lg mb-4 sm:mb-6 text-center sm:text-left">
                {contract.template?.name || companySettings?.contractTitle || 'Titolo Contratto'}
              </div>

              {/* Client Data - Responsive Layout */}
              <div className="border border-gray-300 mb-4 sm:mb-6 rounded-lg overflow-hidden">
                <div className="bg-gray-100 border-b border-gray-300 p-3 sm:p-4 font-bold text-sm sm:text-base">
                  Dati del cliente/committente
                </div>

                {/* Mobile: Vertical Cards, Desktop: Table */}
                <div className="block sm:hidden p-3 space-y-3">
                  {/* Mobile Card Layout */}
                  <div className="bg-gray-50 p-3 rounded border">
                    <div className="font-semibold text-xs text-gray-600 mb-1">SOCIETÀ</div>
                    <div className="font-bold text-sm">{clientData.societa || 'Non specificato'}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded border">
                    <div className="font-semibold text-xs text-gray-600 mb-1">SEDE</div>
                    <div className="font-bold text-sm">{clientData.sede || 'Non specificato'}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded border">
                    <div className="font-semibold text-xs text-gray-600 mb-1">INDIRIZZO</div>
                    <div className="font-bold text-sm">{clientData.indirizzo || 'Non specificato'}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded border">
                    <div className="font-semibold text-xs text-gray-600 mb-1">CODICE FISCALE/P.IVA</div>
                    <div className="font-bold text-sm">{clientData.p_iva || 'Non specificato'}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded border">
                    <div className="font-semibold text-xs text-gray-600 mb-1">PEC</div>
                    <div className="font-bold text-sm">{clientData.pec || 'Non specificato'}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded border">
                    <div className="font-semibold text-xs text-gray-600 mb-1">EMAIL</div>
                    <div className="font-bold text-sm">{clientData.email || 'Non specificato'}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded border">
                    <div className="font-semibold text-xs text-gray-600 mb-1">CELLULARE</div>
                    <div className="font-bold text-sm">{clientData.cellulare || 'Non specificato'}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded border">
                    <div className="font-semibold text-xs text-gray-600 mb-1">CODICE UNIVOCO</div>
                    <div className="font-bold text-sm">{clientData.codice_univoco || 'Non specificato'}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded border">
                    <div className="font-semibold text-xs text-gray-600 mb-1">REGISTRO IMPRESE/REA</div>
                    <div className="font-bold text-sm">{clientData.rea || 'Non specificato'}</div>
                  </div>
                  <div className="bg-blue-50 p-3 rounded border border-blue-200">
                    <div className="font-semibold text-xs text-blue-700 mb-2">LEGALE RAPPRESENTANTE</div>
                    <div className="space-y-2">
                      <div>
                        <span className="font-semibold text-xs text-gray-600">Nome: </span>
                        <span className="text-sm">{clientData.cliente_nome || 'Non specificato'}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-xs text-gray-600">Nato a: </span>
                        <span className="text-sm">{clientData.nato_a || 'Non specificato'}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-xs text-gray-600">Data nascita: </span>
                        <span className="text-sm">{clientData.data_nascita ? new Date(clientData.data_nascita).toLocaleDateString('it-IT') : 'Non specificato'}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-xs text-gray-600">Residente a: </span>
                        <span className="text-sm">{clientData.residente_a || 'Non specificato'}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-xs text-gray-600">Indirizzo residenza: </span>
                        <span className="text-sm">{clientData.indirizzo_residenza || 'Non specificato'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Desktop: Original Table Layout */}
                <table className="hidden sm:table w-full text-sm">
                  <tbody>
                    <tr className="border-b border-gray-200">
                      <td className="border-r border-gray-200 p-2 font-bold w-1/2">Società {clientData.societa || ''}</td>
                      <td className="p-2 font-bold">Con sede in {clientData.sede || ''}</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="border-r border-gray-200 p-2 font-bold">Indirizzo {clientData.indirizzo || ''}</td>
                      <td className="p-2 font-bold">Codice fiscale/PIVA {clientData.p_iva || ''}</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="border-r border-gray-200 p-2 font-bold">PEC {clientData.pec || ''}</td>
                      <td className="p-2 font-bold">Email {clientData.email || ''}</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="border-r border-gray-200 p-2 font-bold">Cellulare {clientData.cellulare || ''}</td>
                      <td className="p-2 font-bold">Codice univoco {clientData.codice_univoco || ''}</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="p-2 font-bold" colSpan={2}>Numero iscrizione al REA o al registro delle imprese {clientData.rea || ''}</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="p-2 font-bold" colSpan={2}>In persona del suo legale rappresentante p.t.</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="border-r border-gray-200 p-2">
                        <span className="font-bold">Signor./a.</span> {clientData.cliente_nome || ''}
                      </td>
                      <td className="p-2">
                        <span className="font-bold">Nato a</span> {clientData.nato_a || ''}
                      </td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td className="border-r border-gray-200 p-2">
                        <span className="font-bold">Data di nascita</span> {clientData.data_nascita ? new Date(clientData.data_nascita).toLocaleDateString('it-IT') : ''}
                      </td>
                      <td className="p-2">
                        <span className="font-bold">Residente a</span> {clientData.residente_a || ''}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2" colSpan={2}>
                        <span className="font-bold">Indirizzo di residenza:</span> {clientData.indirizzo_residenza || ''}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Partnership Section - Show if partnership mode */}
              {contract.isPercentagePartnership && contract.partnershipPercentage && (
                <div className="border border-gray-300 p-4 sm:p-6 mb-4 sm:mb-6 rounded-lg bg-gray-50">
                  <div className="text-center mb-4">
                    <div className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">
                      MODELLO DI PARTNERSHIP
                    </div>
                    <div className="text-base sm:text-lg font-semibold text-gray-700">
                      Percentuale: <span className="bg-gray-200 px-3 py-1 rounded font-bold">{contract.partnershipPercentage}%</span> sul fatturato TOTALE
                    </div>
                  </div>

                  <div className="space-y-4 text-sm sm:text-base">
                    <div className="bg-white p-4 rounded border border-gray-200">
                      <h4 className="font-bold text-gray-800 mb-2">DEFINIZIONE DI FATTURATO TOTALE</h4>
                      <p className="text-gray-700 mb-2">Per "fatturato TOTALE" si intende la somma di tutti i ricavi lordi generati dall'attività, comprensivi di:</p>
                      <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
                        <li>Vendite di cibo e bevande</li>
                        <li>Servizi di catering e delivery</li>
                        <li>Eventi privati e prenotazioni speciali</li>
                        <li>Qualsiasi altro ricavo direttamente collegato all'attività</li>
                      </ul>
                    </div>

                    <div className="bg-white p-4 rounded border border-gray-200">
                      <h4 className="font-bold text-gray-800 mb-2">MODALITÀ DI CALCOLO E PAGAMENTO</h4>
                      <p className="text-gray-700">
                        Il pagamento della percentuale sarà calcolato mensilmente sul fatturato TOTALE del mese precedente e dovrà essere corrisposto entro il 15 del mese successivo tramite bonifico bancario.
                      </p>
                    </div>

                    <div className="bg-white p-4 rounded border border-gray-200">
                      <h4 className="font-bold text-gray-800 mb-2">TRASPARENZA E RENDICONTAZIONE</h4>
                      <p className="text-gray-700 mb-2">Il Cliente si impegna a fornire mensilmente la documentazione contabile necessaria per il calcolo della percentuale dovuta, inclusi:</p>
                      <ul className="list-disc list-inside text-gray-700 space-y-1 ml-4">
                        <li>Estratti conto del registratore di cassa o POS</li>
                        <li>Fatture emesse nel periodo di riferimento</li>
                        <li>Dichiarazioni IVA periodiche</li>
                        <li>Report di fatturato certificati dal commercialista</li>
                      </ul>
                    </div>

                    <div className="bg-white p-4 rounded border border-gray-300">
                      <h4 className="font-bold text-gray-800 mb-2">PENALI PER RITARDATO PAGAMENTO</h4>
                      <p className="text-gray-700">
                        In caso di ritardo nel pagamento della percentuale dovuta, saranno applicate penali pari al 2% dell'importo dovuto per ogni mese di ritardo, oltre agli interessi legali.
                      </p>
                    </div>

                    <div className="bg-gray-100 p-4 rounded border border-gray-300">
                      <p className="text-gray-800 font-semibold text-center">
                        IMPORTANTE: Questo modello di partnership sostituisce qualsiasi piano di pagamento fisso. Il compenso sarà calcolato esclusivamente come percentuale del fatturato totale.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Plan - Responsive (solo se NON è partnership) */}
              {!contract.isPercentagePartnership && paymentPlan.length > 0 && (
                <div className="border border-gray-300 p-3 sm:p-4 mb-4 sm:mb-6 rounded-lg bg-blue-50">
                  <div className="font-bold mb-3 text-sm sm:text-base text-blue-900">
                    {usingCustomInstallments && (
                      <div className="mb-2 text-xs sm:text-sm bg-green-100 text-green-800 px-2 py-1 rounded inline-block">
                        📝 Rate Personalizzate (inserimento manuale)
                      </div>
                    )}
                    Il prezzo totale di <span className="bg-yellow-200 px-2 py-1 rounded font-extrabold">{paymentPlan.reduce((sum, payment) => sum + parseFloat(payment.rata_importo), 0).toFixed(2)} EUR</span> + IVA sarà corrisposto con le seguenti modalità:
                  </div>
                  <div className="space-y-2 sm:space-y-1">
                    {paymentPlan.map((payment: any, index: number) => (
                      <div key={index} className="bg-white p-3 rounded border border-blue-200 text-sm">
                        <div className="font-semibold text-blue-800">Pagamento {payment.rata_numero || index + 1}</div>
                        <div className="text-gray-700">
                          <span className="font-medium">Importo:</span> EUR {payment.rata_importo} + IVA
                        </div>
                        <div className="text-gray-700">
                          <span className="font-medium">Scadenza:</span> {payment.rata_scadenza}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Payment Terms - Custom text from template */}
              {(contract.template?.paymentText || contract.paymentText) && (
                <div className="mb-6 text-sm leading-relaxed">
                  <div
                    className="text-justify"
                    dangerouslySetInnerHTML={{ __html: contract.template?.paymentText || contract.paymentText || "" }}
                  />
                </div>
              )}

              {/* Custom Content Section */}
              {contract.template?.customContent && (
                <div className="mb-6 p-4 bg-gray-50 border-l-4 border-gray-400 rounded-r-lg">
                  <div
                    className="text-sm leading-relaxed text-gray-700"
                    dangerouslySetInnerHTML={{ __html: contract.template.customContent }}
                  />
                </div>
              )}

              {/* Contract Validity Period */}
              <div className="mb-6 p-4 border border-gray-300 rounded-lg bg-gray-50">
                <div className="font-bold text-base mb-2 text-center text-gray-800">
                  📅 PERIODO DI VALIDITÀ DEL CONTRATTO
                </div>
                <p className="text-sm text-center text-gray-700">
                  Il presente contratto ha validità dal {new Date(contract.createdAt).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })} al {new Date(new Date(contract.createdAt).setFullYear(new Date(contract.createdAt).getFullYear() + 1)).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
                </p>
              </div>

              {/* Auto Renewal Section - Always Active */}
              <div className="mb-6 p-5 border border-gray-300 rounded-lg bg-gray-50">
                <div className="font-bold text-base mb-3 text-center text-gray-800">
                  🔄 CLAUSOLA DI AUTORINNOVO
                </div>
                <p className="text-sm leading-relaxed mb-3 text-justify">
                  <strong>Il presente contratto si rinnoverà automaticamente per ulteriori {contract.renewalDuration || 12} mesi</strong> alle stesse condizioni economiche e contrattuali, salvo disdetta da comunicarsi da una delle parti all'altra con preavviso di almeno 30 (trenta) giorni prima della scadenza mediante raccomandata A/R o PEC.
                </p>
                <p className="text-sm leading-relaxed mb-3 text-justify">
                  In caso di mancata disdetta nei termini sopra indicati, il contratto si intenderà automaticamente rinnovato per un periodo pari a {contract.renewalDuration || 12} mesi, alle medesime condizioni del contratto originario.
                </p>
                <p className="text-xs text-gray-600 italic text-justify">
                  Questa clausola è stata specificatamente accettata dal Cliente al momento della sottoscrizione del presente contratto.
                </p>
              </div>

              {/* Bonuses */}
              {bonusList.length > 0 && (
                <div className="mb-6">
                  {bonusList.map((bonus: any, index: number) => (
                    <div key={index} className="mb-4 p-4 border-l-4 border-gray-800 bg-gray-50">
                      <p className="font-bold text-gray-800 mb-2">BONUS #{index + 1}</p>
                      <p className="text-sm leading-relaxed">{bonus.bonus_descrizione}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Declaration and Final Signature */}
              <div className="text-sm mb-6">
                <p className="font-bold mb-2">Il sottoscritto dichiara:</p>
                <ul className="list-disc list-inside mb-4">
                  <li>di aver ricevuto il Fascicolo informativo/ condizioni generali di contratto contenente la nota informativa</li>
                  <li>le Condizioni generali di contratto, di averle lette ed accettate</li>
                </ul>
              </div>

              {/* Unica firma per tutto il contratto */}
              <div className="mb-6">
                <p className="font-bold mb-2">Consenso per informazioni commerciali e attività promozionali.</p>
                <p className="mb-2">Presa visione dell'informativa generale allegata, consento che i miei dati anagrafici siano utilizzati dalle Società e/o comunicati a terzi che svolgono attività commerciali e promozionali per finalità di marketing effettuate anche al telefono, ivi compreso l'invio di materiale illustrativo relativo ai servizi e ai prodotti commercializzati.</p>
                <p className="font-bold">Consenso</p>

                <div className="mt-4">
                  <p className="mb-4">Data {new Date().toLocaleDateString('it-IT')} Luogo Milano <span className="font-bold">firma Cliente/Committente</span></p>
                  <SignatureArea
                    signatureId="marketing"
                    onSign={(signature) => setSignatures(prev => ({ ...prev, marketing: signature }))}
                    onGlobalSign={handleGlobalSignature}
                    disabled={contract.status === 'signed'}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Separatore Sezione Firma */}
        <div className="flex items-center justify-center my-12">
          <div className="flex-grow border-t-2 border-gray-300"></div>
          <div className="mx-8 bg-white px-6 py-3 rounded-lg shadow border border-gray-200">
            <div className="flex items-center text-gray-700 font-semibold">
              <Signature className="mr-3 h-5 w-5" />
              <span className="text-base uppercase tracking-wide">Sezione Firma Digitale</span>
              <Signature className="ml-3 h-5 w-5" />
            </div>
          </div>
          <div className="flex-grow border-t-2 border-gray-300"></div>
        </div>

        {/* OTP Section - Show only if no signatures yet */}
        {contract.status === "viewed" && !signatures.marketing && (
          <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Shield className="mr-2 h-5 w-5" />
              Verifica Identità
            </h3>

            {!showOtpInput ? (
              <div className="space-y-4">
                {/* Determine OTP method and show appropriate input */}
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
              // OTP Input Section
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


        {/* Signature Section - Show only if contract signature is present */}
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
              {/* Progress Indicators con design migliorato */}
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

                {/* Step indicators */}
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
                {/* Step 1: Contact Verification */}
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

                {/* Step 2: OTP Input */}
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

                {/* Separatore tra sezioni */}
                <div className="flex items-center justify-center my-6">
                  <div className="flex-grow border-t border-gray-300"></div>
                  <div className="mx-4 bg-gray-100 px-3 py-1 rounded">
                    <span className="text-gray-700 font-semibold text-sm">CONSENSI E FIRMA</span>
                  </div>
                  <div className="flex-grow border-t border-gray-300"></div>
                </div>

                {/* Consent Checkboxes */}
                {/* Step 3: Consensi e Firma */}
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

                  {/* Sign Button */}
                  <Button
                    onClick={() => {
                      console.log("🖱️ Click su pulsante firma");
                      signContractMutation.mutate();
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

                {/* Progress message during signing */}
                {signContractMutation.isPending && (
                  <div className="text-center text-sm text-gray-600 mt-2">
                    <div className="animate-pulse">
                      🔐 Elaborazione firma digitale sicura...
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

        {/* Message when signature is required */}
        {contract.status !== "signed" && !signatures.marketing && (
          <Card className="border border-orange-200 bg-orange-50 shadow-lg">
            <CardContent className="pt-6 text-center">
              <div className="animate-in fade-in duration-500">
                <PenTool className="mx-auto h-16 w-16 text-orange-500 mb-4" />
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  📝 Firma Richiesta nel Documento
                </h3>
                <p className="text-lg text-gray-600 mb-6">
                  Prima di procedere con la firma digitale, è necessario apporre la firma nel documento sopra.
                </p>
                <div className="bg-orange-100 border border-orange-200 rounded-lg p-4 text-sm text-orange-800">
                  <p className="font-medium mb-2">👆 Come procedere:</p>
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

        {/* Signed Status */}
        {contract.status === "signed" && (
          <Card className="border-green-200 shadow-lg">
            <CardContent className="pt-6 text-center">
              <div className="animate-in fade-in duration-500">
                <CheckCircle className="mx-auto h-20 w-20 text-green-500 mb-6" />
                <h3 className="text-3xl font-bold text-gray-900 mb-4">
                  🎉 Contratto Firmato con Successo!
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
                  <p className="font-medium mb-3 text-lg">✅ Processo Completato</p>
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
                    📧 Controlla la tua email per la copia del contratto firmato
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}