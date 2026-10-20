import { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  renderContractDocument,
  CONTRACT_DOCUMENT_CSS,
  SIGNATURE_SLOT_ATTR,
  APPROVAL_SIGNATURE_SLOT_ATTR,
} from "@shared/contract-document";
import {
  FileText,
  ChevronLeft,
  ChevronRight,
  Printer,
  ArrowUp,
  Building2,
  User,
  Calendar,
  Euro,
  Gift,
  Shield,
  PenLine,
} from "lucide-react";

/*
 * Il documento (testo e grafica) NON si costruisce qui: viene da
 * `shared/contract-document.ts`, lo stesso modulo che genera il PDF.
 * Pagina del cliente, anteprime del gestionale e PDF sono quindi sempre
 * identici. Questo componente aggiunge solo la cornice della pagina
 * (intestazione, indice laterale) e monta l'area firma interattiva nel
 * punto previsto dal documento.
 */

interface ProfessionalContractDocumentProps {
  mode: "sign" | "preview";
  companySettings?: {
    companyName?: string;
    address?: string;
    city?: string;
    postalCode?: string;
    taxId?: string;
    uniqueCode?: string;
    pec?: string;
    contractTitle?: string;
    logoUrl?: string;
    isOwner?: boolean;
    priceVatMode?: string;
  };
  clientData?: Record<string, any>;
  template?: {
    name?: string;
    recipientType?: string;
    content?: string;
    customContent?: string;
    paymentText?: string;
    predefinedBonuses?: any[];
  };
  contract?: {
    id?: number | string;
    contractNumber?: string | null;
    documentLayout?: number | null;
    autoRenewal?: boolean | null;
    createdAt?: string;
    signedAt?: string;
    status?: string;
    isPercentagePartnership?: boolean;
    partnershipPercentage?: number;
    renewalDuration?: number;
    contractStartDate?: string;
    contractEndDate?: string;
  };
  paymentPlan?: Array<{
    rata_numero?: number;
    rata_importo: string;
    rata_scadenza: string;
    rata_descrizione?: string;
  }>;
  bonusList?: Array<{ bonus_descrizione: string }>;
  usingCustomInstallments?: boolean;
  /**
   * Modular sections selected for this contract, already resolved from
   * `template.sections` + `contract.selectedSectionIds` by the caller.
   */
  sections?: Array<{
    id: string;
    title: string;
    content: string;
  }>;
  /** Firma già apposta (data:image… o testo): viene stampata come nel PDF. */
  signatureValue?: string | null;
  /** Area firma interattiva, montata nella riga di firma del documento. */
  signatureArea?: React.ReactNode;
  /** Firma già apposta per l'approvazione specifica delle clausole. */
  approvalSignatureValue?: string | null;
  /** Area firma interattiva per l'approvazione specifica delle clausole. */
  approvalSignatureArea?: React.ReactNode;
  beforeDocumentContent?: React.ReactNode;
  afterDocumentContent?: React.ReactNode;
  /**
   * When true, missing fields render as "—" (as on the customer page and in
   * the PDF) instead of sample values like "Nome Cognome".
   */
  hidePlaceholders?: boolean;
}

const SECTION_ICONS: Record<string, any> = {
  intestazione: Building2,
  "dati-cliente": User,
  "contenuto-personalizzato": FileText,
  "piano-pagamenti": Euro,
  "condizioni-pagamento": Euro,
  "servizi-inclusi": Gift,
  "corpo-contratto": FileText,
  bonus: Gift,
  validita: Calendar,
  autorinnovo: Shield,
  firma: PenLine,
  "approvazione-clausole": PenLine,
};

export default function ProfessionalContractDocument({
  mode,
  companySettings,
  clientData,
  template,
  contract,
  paymentPlan,
  bonusList,
  usingCustomInstallments,
  sections: modularSections,
  signatureValue,
  signatureArea,
  approvalSignatureValue,
  approvalSignatureArea,
  beforeDocumentContent,
  afterDocumentContent,
  hidePlaceholders,
}: ProfessionalContractDocumentProps) {
  const [activeSection, setActiveSection] = useState("intestazione");
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [signatureSlot, setSignatureSlot] = useState<HTMLElement | null>(null);
  const [approvalSlot, setApprovalSlot] = useState<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<HTMLDivElement>(null);

  const isPreview = mode === "preview";

  const doc = useMemo(
    () =>
      renderContractDocument(
        {
          company: companySettings,
          client: clientData,
          template,
          contract,
          paymentPlan,
          bonusList,
          usingCustomInstallments,
          modularSections,
        },
        {
          mode: isPreview ? "preview" : "sign",
          placeholders: isPreview && !hidePlaceholders,
          signature: signatureValue || null,
          approvalSignature: approvalSignatureValue || null,
        },
      ),
    [
      companySettings, clientData, template, contract, paymentPlan, bonusList,
      usingCustomInstallments, modularSections, isPreview, hidePlaceholders, signatureValue,
      approvalSignatureValue,
    ],
  );

  // L'HTML del documento può essere sostituito a ogni cambio di dati: dopo
  // ogni render ritroviamo il punto in cui montare l'area firma.
  useLayoutEffect(() => {
    const el = docRef.current?.querySelector<HTMLElement>(`[${SIGNATURE_SLOT_ATTR}]`) ?? null;
    if (el !== signatureSlot) setSignatureSlot(el);
    const approvalEl = docRef.current?.querySelector<HTMLElement>(`[${APPROVAL_SIGNATURE_SLOT_ATTR}]`) ?? null;
    if (approvalEl !== approvalSlot) setApprovalSlot(approvalEl);
  });

  useEffect(() => {
    if (isPreview) return;
    const handleScroll = () => {
      if (contentRef.current) {
        setShowScrollTop(contentRef.current.scrollTop > 600);
        const sectionEls = contentRef.current.querySelectorAll("[data-section]");
        let currentId = "intestazione";
        sectionEls.forEach((section) => {
          const rect = section.getBoundingClientRect();
          if (rect.top <= 200) {
            currentId = section.getAttribute("data-section") || currentId;
          }
        });
        setActiveSection(currentId);
      }
    };
    const el = contentRef.current;
    if (el) el.addEventListener("scroll", handleScroll);
    return () => {
      if (el) el.removeEventListener("scroll", handleScroll);
    };
  }, [isPreview]);

  const scrollToSection = (id: string) => {
    const el = contentRef.current?.querySelector(`[data-section="${id}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const scrollToTop = () => {
    contentRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const documentContent = (
    <div className="bg-white rounded-2xl border border-[#e8e8ed] shadow-sm px-5 py-8 sm:px-10 sm:py-12 lg:px-14 lg:py-14 print:shadow-none print:border-none print:rounded-none print:p-0">
      <style>{CONTRACT_DOCUMENT_CSS}</style>
      <div ref={docRef} dangerouslySetInnerHTML={{ __html: doc.html }} />
      {!isPreview && signatureArea && signatureSlot && createPortal(signatureArea, signatureSlot)}
      {!isPreview && approvalSignatureArea && approvalSlot && createPortal(approvalSignatureArea, approvalSlot)}
    </div>
  );

  if (isPreview) {
    return <div className="max-w-4xl mx-auto py-6">{documentContent}</div>;
  }

  const title = template?.name || companySettings?.contractTitle || "Contratto";

  return (
    <div className="h-screen bg-[#f5f5f7] flex flex-col overflow-hidden">
      <header className="flex-shrink-0 z-50 border-b border-[#e8e8ed] bg-white/85 backdrop-blur-xl print:hidden">
        <div className="flex items-center justify-between px-3 sm:px-6 lg:px-8 h-14 sm:h-16">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-[#1d1d1f] flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-semibold text-[#1d1d1f] leading-tight truncate">
                {title}
              </h1>
              <p className="text-xs text-[#6e6e73] hidden sm:block truncate">
                {companySettings?.companyName || ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:flex gap-2 text-[#424245] border-[#d2d2d7]"
              onClick={() => window.print()}
            >
              <Printer className="w-4 h-4" />
              Stampa
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside
          className={`${
            sidebarOpen ? "w-72 xl:w-80" : "w-0"
          } transition-all duration-300 border-r border-[#e8e8ed] bg-white/95 backdrop-blur-sm flex-shrink-0 overflow-hidden print:hidden ${
            sidebarOpen ? "max-lg:fixed max-lg:left-0 max-lg:top-14 max-lg:bottom-0 max-lg:z-40 max-lg:shadow-2xl" : ""
          }`}
        >
          <div className="h-full overflow-y-auto">
            <div className="p-4">
              <h2 className="text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-4 px-2">
                Indice
              </h2>
              <nav className="space-y-0.5">
                {doc.sections.map((section) => {
                  const Icon = SECTION_ICONS[section.id] || FileText;
                  return (
                    <button
                      key={section.id}
                      onClick={() => scrollToSection(section.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors duration-150 flex items-center gap-2 ${
                        activeSection === section.id
                          ? "bg-[#f5f5f7] text-[#1d1d1f] font-semibold"
                          : "text-[#6e6e73] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] font-medium"
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {section.title}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        </aside>

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/20 z-30 lg:hidden print:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main ref={contentRef} className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-12 py-4 sm:py-8 lg:py-12">
            {beforeDocumentContent && <div className="mb-6 print:hidden">{beforeDocumentContent}</div>}
            {documentContent}
            {afterDocumentContent && <div className="mt-8 print:hidden">{afterDocumentContent}</div>}
          </div>
        </main>
      </div>

      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 w-10 h-10 rounded-full bg-[#1d1d1f] text-white shadow-lg flex items-center justify-center hover:bg-black transition-colors print:hidden"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
