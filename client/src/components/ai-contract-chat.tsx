import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Bot, Send, Copy, FileInput, MessageSquare, Sparkles } from "lucide-react";

interface ChatMessage {
  role: "user" | "model";
  content: string;
}

interface AiContractChatProps {
  onInsertContent?: (content: string) => void;
  onInsertPaymentText?: (text: string) => void;
  onInsertBonuses?: (bonuses: any[]) => void;
}

const quickSuggestions = [
  "Come strutturare un contratto di consulenza?",
  "Quali clausole inserire per la privacy?",
  "Differenza tra contratto di servizio e fornitura",
];

export default function AiContractChat({
  onInsertContent,
  onInsertPaymentText,
  onInsertBonuses,
}: AiContractChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const chatMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const res = await apiRequest("POST", "/api/ai/chat", {
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        userMessage,
      });
      return await res.json();
    },
    onSuccess: (data: { response: string }) => {
      setMessages((prev) => [
        ...prev,
        { role: "model", content: data.response },
      ]);
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile ottenere una risposta dall'AI. Riprova.",
        variant: "destructive",
      });
    },
  });

  const handleSend = (text?: string) => {
    const message = text || inputValue.trim();
    if (!message || chatMutation.isPending) return;
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setInputValue("");
    chatMutation.mutate(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast({ title: "Copiato", description: "Testo copiato negli appunti." });
  };

  return (
    <Card className="flex flex-col h-[500px]">
      <CardHeader className="pb-3 border-b">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bot className="h-5 w-5 text-primary" />
          <span>Assistente AI Contratti</span>
          <Sparkles className="h-4 w-4 text-yellow-500" />
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-3">
              <MessageSquare className="h-10 w-10 opacity-40" />
              <p className="text-sm">
                Chiedimi qualsiasi cosa sui contratti. Posso aiutarti a
                strutturare clausole, termini di pagamento e molto altro.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-muted text-foreground rounded-bl-md"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.role === "model" && (
                  <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/40">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => handleCopy(msg.content)}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copia
                    </Button>
                    {onInsertContent && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => onInsertContent(msg.content)}
                      >
                        <FileInput className="h-3 w-3 mr-1" />
                        Inserisci nel template
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {chatMutation.isPending && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="border-t p-3 space-y-3">
          {messages.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {quickSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleSend(suggestion)}
                  className="text-xs bg-secondary text-secondary-foreground px-3 py-1.5 rounded-full hover:bg-secondary/80 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Scrivi la tua domanda..."
              disabled={chatMutation.isPending}
            />
            <Button
              onClick={() => handleSend()}
              disabled={!inputValue.trim() || chatMutation.isPending}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
