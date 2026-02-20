import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Wand2, ArrowRight, Check, Scale, FileText, Loader2, RefreshCw, Sparkles } from "lucide-react";

interface AiContractWizardProps {
  onContractGenerated?: (data: {
    content: string;
    customContent: string;
    paymentText: string;
    bonuses: any[];
    suggestedName?: string;
  }) => void;
}

interface ParsedData {
  message: string;
  currentStep: number;
  totalSteps: number;
  stepName: string;
  isComplete: boolean;
  suggestedOptions?: string[];
  legalReferences?: string[];
  summary?: Record<string, any>;
}

interface WizardResponse {
  response: string;
  parsedData: ParsedData;
}

interface GeneratedContract {
  content: string;
  customContent: string;
  paymentText: string;
  bonuses: any[];
  suggestedName?: string;
}

interface ConversationMessage {
  role: "user" | "model";
  content: string;
}

type WizardPhase = "idle" | "questioning" | "complete" | "generating" | "generated";

export default function AiContractWizard({ onContractGenerated }: AiContractWizardProps) {
  const { toast } = useToast();
  const [phase, setPhase] = useState<WizardPhase>("idle");
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const [generatedContract, setGeneratedContract] = useState<GeneratedContract | null>(null);
  const [additionalInstructions, setAdditionalInstructions] = useState("");

  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/wizard/start");
      return (await res.json()) as WizardResponse;
    },
    onSuccess: (data) => {
      setParsedData(data.parsedData);
      setConversationHistory([{ role: "model", content: data.response }]);
      setPhase(data.parsedData.isComplete ? "complete" : "questioning");
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const answerMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const newHistory = [...conversationHistory, { role: "user" as const, content: userMessage }];
      const res = await apiRequest("POST", "/api/ai/wizard/answer", {
        conversationHistory: newHistory,
        userMessage,
      });
      return { data: (await res.json()) as WizardResponse, newHistory };
    },
    onSuccess: ({ data, newHistory }) => {
      const updatedHistory: ConversationMessage[] = [...newHistory, { role: "model", content: data.response }];
      setConversationHistory(updatedHistory);
      setParsedData(data.parsedData);
      setUserInput("");
      setPhase(data.parsedData.isComplete ? "complete" : "questioning");
    },
    onError: (error: Error) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/wizard/generate", {
        summary: parsedData?.summary,
        additionalInstructions: additionalInstructions || undefined,
      });
      return (await res.json()) as GeneratedContract;
    },
    onSuccess: (data) => {
      setGeneratedContract(data);
      setPhase("generated");
    },
    onError: (error: Error) => {
      toast({ title: "Errore nella generazione", description: error.message, variant: "destructive" });
    },
  });

  const handleStart = () => {
    setPhase("questioning");
    setConversationHistory([]);
    setParsedData(null);
    setGeneratedContract(null);
    setAdditionalInstructions("");
    startMutation.mutate();
  };

  const handleSubmitAnswer = (answer?: string) => {
    const message = answer || userInput.trim();
    if (!message) return;
    answerMutation.mutate(message);
  };

  const handleGenerate = () => {
    setPhase("generating");
    generateMutation.mutate();
  };

  const handleApply = () => {
    if (generatedContract && onContractGenerated) {
      onContractGenerated(generatedContract);
      toast({ title: "Contratto applicato", description: "Il contratto è stato applicato al template." });
    }
  };

  const handleReset = () => {
    setPhase("idle");
    setParsedData(null);
    setConversationHistory([]);
    setUserInput("");
    setGeneratedContract(null);
    setAdditionalInstructions("");
  };

  const isLoading = startMutation.isPending || answerMutation.isPending || generateMutation.isPending;
  const progressValue = parsedData ? (parsedData.currentStep / parsedData.totalSteps) * 100 : 0;

  if (phase === "idle") {
    return (
      <Card className="w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Wand2 className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-xl">Creazione Guidata Contratto</CardTitle>
          <CardDescription>
            L'assistente AI ti guiderà passo dopo passo nella creazione del tuo contratto, ponendoti domande specifiche.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Button onClick={handleStart} size="lg" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Inizia Creazione Guidata
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (phase === "generated" && generatedContract) {
    return (
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Contratto Generato</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Ricomincia
            </Button>
          </div>
          <CardDescription>Anteprima del contratto generato dall'AI</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-h-96 overflow-y-auto rounded-md border bg-muted/30 p-4">
            <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm">{generatedContract.content}</div>
          </div>
          {generatedContract.customContent && (
            <>
              <Separator />
              <div>
                <h4 className="mb-2 text-sm font-medium">Clausole Personalizzate</h4>
                <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                  {generatedContract.customContent}
                </div>
              </div>
            </>
          )}
          {generatedContract.paymentText && (
            <div>
              <h4 className="mb-2 text-sm font-medium">Condizioni di Pagamento</h4>
              <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                {generatedContract.paymentText}
              </div>
            </div>
          )}
          {generatedContract.bonuses && generatedContract.bonuses.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium">Bonus Inclusi</h4>
              <div className="flex flex-wrap gap-2">
                {generatedContract.bonuses.map((bonus: any, i: number) => (
                  <Badge key={i} variant="secondary">
                    {bonus.name || bonus.title || JSON.stringify(bonus)}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={handleApply} className="w-full" size="lg">
            <Check className="mr-2 h-4 w-4" />
            Applica al Template
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Creazione Guidata</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Ricomincia
          </Button>
        </div>
        {parsedData && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Passo {parsedData.currentStep} di {parsedData.totalSteps}
              </span>
              <span className="font-medium">{parsedData.stepName}</span>
            </div>
            <Progress value={progressValue} className="h-2" />
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading && !parsedData ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-3 text-sm text-muted-foreground">L'assistente sta preparando la domanda...</p>
          </div>
        ) : phase === "complete" && parsedData?.summary ? (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Check className="h-5 w-5 text-green-600" />
                <h3 className="font-semibold">Riepilogo del Contratto</h3>
              </div>
              <div className="space-y-3">
                {Object.entries(parsedData.summary).map(([key, value]) => (
                  <div key={key} className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase text-muted-foreground">{key.replace(/_/g, " ")}</span>
                    <span className="text-sm">
                      {typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}
                    </span>
                    <Separator className="mt-1" />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Istruzioni aggiuntive (opzionale)</label>
              <Input
                placeholder="Aggiungi indicazioni specifiche per la generazione..."
                value={additionalInstructions}
                onChange={(e) => setAdditionalInstructions(e.target.value)}
              />
            </div>
            <Button onClick={handleGenerate} className="w-full" size="lg" disabled={generateMutation.isPending}>
              {generateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              Genera Contratto
            </Button>
          </div>
        ) : parsedData ? (
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                Assistente AI
              </div>
              <p className="text-sm leading-relaxed">{parsedData.message}</p>
            </div>

            {parsedData.legalReferences && parsedData.legalReferences.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {parsedData.legalReferences.map((ref, i) => (
                  <Badge key={i} variant="outline" className="text-xs">
                    <Scale className="mr-1 h-3 w-3" />
                    {ref}
                  </Badge>
                ))}
              </div>
            )}

            {parsedData.suggestedOptions && parsedData.suggestedOptions.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Opzioni suggerite:</p>
                <div className="flex flex-wrap gap-2">
                  {parsedData.suggestedOptions.map((option, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      onClick={() => handleSubmitAnswer(option)}
                      disabled={isLoading}
                    >
                      {option}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            <div className="flex gap-2">
              <Input
                placeholder="Scrivi la tua risposta..."
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isLoading) handleSubmitAnswer();
                }}
                disabled={isLoading}
              />
              <Button onClick={() => handleSubmitAnswer()} disabled={isLoading || !userInput.trim()}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
