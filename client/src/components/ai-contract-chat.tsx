import { useState, useRef, useEffect, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, Send, Copy, FileInput, MessageSquare, Sparkles, User } from "lucide-react";

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

function formatMessage(text: string) {
  const lines = text.split('\n');
  const elements: any[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      elements.push(<div key={`br-${i}`} className="h-2" />);
      i++;
      continue;
    }

    if (/^\s*[\*\-]\s+/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\s*[\*\-]\s+/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\s*[\*\-]\s+/, ''));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="list-disc pl-5 space-y-1 my-1.5">
          {listItems.map((item, idx) => (
            <li key={idx} className="text-[13px] leading-relaxed">
              <InlineFormat text={item} />
            </li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\d+[\.\)]\s+/.test(line)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\d+[\.\)]\s+/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\d+[\.\)]\s+/, ''));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="list-decimal pl-5 space-y-1 my-1.5">
          {listItems.map((item, idx) => (
            <li key={idx} className="text-[13px] leading-relaxed">
              <InlineFormat text={item} />
            </li>
          ))}
        </ol>
      );
      continue;
    }

    elements.push(
      <p key={`p-${i}`} className="text-[13px] leading-relaxed">
        <InlineFormat text={line} />
      </p>
    );
    i++;
  }

  return elements;
}

function InlineFormat({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="font-semibold text-[#0F172A]">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('*') && part.endsWith('*')) {
          return <em key={i} className="italic">{part.slice(1, -1)}</em>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={i} className="bg-[#F1F5F9] text-[#4F46E5] px-1.5 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

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
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-4 pb-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
            <div className="p-3 bg-gradient-to-br from-[#4F46E5]/10 to-[#7C3AED]/10 rounded-2xl">
              <MessageSquare className="h-8 w-8 text-[#4F46E5]/60" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#0F172A] mb-1">
                Assistente AI Contratti
              </p>
              <p className="text-xs text-[#94A3B8] max-w-[280px] leading-relaxed">
                Chiedimi qualsiasi cosa sui contratti. Posso aiutarti a strutturare clausole, termini di pagamento e molto altro.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
            <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${
              msg.role === "user"
                ? "bg-gradient-to-br from-[#4F46E5] to-[#7C3AED]"
                : "bg-[#E8E8F0]"
            }`}>
              {msg.role === "user" ? (
                <User className="h-3.5 w-3.5 text-white" />
              ) : (
                <Bot className="h-3.5 w-3.5 text-[#4F46E5]" />
              )}
            </div>

            <div className={`flex-1 min-w-0 ${msg.role === "user" ? "flex justify-end" : ""}`}>
              <div
                className={`rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-gradient-to-br from-[#4F46E5] to-[#6D5CE7] text-white rounded-tr-md max-w-[85%] ml-auto"
                    : "bg-white border border-[#E5E7EB]/60 text-[#1E293B] rounded-tl-md shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                }`}
              >
                {msg.role === "user" ? (
                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <div className="space-y-1.5">
                    {formatMessage(msg.content)}
                  </div>
                )}

                {msg.role === "model" && (
                  <div className="flex items-center gap-1 mt-3 pt-2.5 border-t border-[#F1F5F9]">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2.5 text-[11px] text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] rounded-lg"
                      onClick={() => handleCopy(msg.content)}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copia
                    </Button>
                    {onInsertContent && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2.5 text-[11px] text-[#4F46E5] hover:text-[#4338CA] hover:bg-[#4F46E5]/5 rounded-lg"
                        onClick={() => onInsertContent(msg.content)}
                      >
                        <FileInput className="h-3 w-3 mr-1" />
                        Inserisci
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {chatMutation.isPending && (
          <div className="flex gap-2.5">
            <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-[#E8E8F0]">
              <Bot className="h-3.5 w-3.5 text-[#4F46E5]" />
            </div>
            <div className="bg-white border border-[#E5E7EB]/60 rounded-2xl rounded-tl-md px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-[#4F46E5]/40 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-[#4F46E5]/40 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-[#4F46E5]/40 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-[#E5E7EB]/40 pt-3 space-y-3 bg-[#F8F9FC]">
        {messages.length === 0 && (
          <div className="flex flex-col gap-1.5">
            {quickSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => handleSend(suggestion)}
                className="text-left text-xs text-[#64748B] bg-white border border-[#E5E7EB]/50 px-3.5 py-2 rounded-xl hover:bg-[#F8FAFC] hover:border-[#4F46E5]/20 hover:text-[#4F46E5] transition-all duration-200"
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
            className="flex-1 rounded-xl border-[#E5E7EB] bg-white text-sm focus:ring-[#4F46E5]/20 focus:border-[#4F46E5] transition-all duration-200"
          />
          <Button
            onClick={() => handleSend()}
            disabled={!inputValue.trim() || chatMutation.isPending}
            size="icon"
            className="rounded-xl bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] hover:from-[#4338CA] hover:to-[#6D28D9] shadow-sm h-9 w-9 flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
