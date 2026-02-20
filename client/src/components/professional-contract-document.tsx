import { useState, useEffect, useRef, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";

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
  };
  clientData?: {
    societa?: string;
    sede?: string;
    indirizzo?: string;
    p_iva?: string;
    pec?: string;
    email?: string;
    cellulare?: string;
    codice_univoco?: string;
    rea?: string;
    cliente_nome?: string;
    nato_a?: string;
    data_nascita?: string;
    residente_a?: string;
    indirizzo_residenza?: string;
  };
  template?: {
    name?: string;
    content?: string;
    customContent?: string;
    paymentText?: string;
    predefinedBonuses?: any[];
  };
  contract?: {
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
    rata_numero: number;
    rata_importo: string;
    rata_scadenza: string;
  }>;
  bonusList?: Array<{ bonus_descrizione: string }>;
  usingCustomInstallments?: boolean;
  signatureArea?: React.ReactNode;
  afterDocumentContent?: React.ReactNode;
}

function formatDateSafe(dateString?: string | Date): string {
  if (!dateString) return "";
  try {
    const date =
      typeof dateString === "string" ? new Date(dateString) : dateString;
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export default function ProfessionalContractDocument({
  mode,
  companySettings,
  clientData,
  template,
  contract,
  paymentPlan,
  bonusList,
  usingCustomInstallments,
  signatureArea,
  afterDocumentContent,
}: ProfessionalContractDocumentProps) {
  const [activeSection, setActiveSection] = useState("intestazione");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const isPreview = mode === "preview";
  const company = companySettings || {};
  const client = clientData || {};
  const hasPaymentPlan = paymentPlan && paymentPlan.length > 0;
  const isPartnership =
    contract?.isPercentagePartnership && contract?.partnershipPercentage;
  const hasBonuses = bonusList && bonusList.length > 0;
  const hasCustomContent = !!template?.customContent;
  const hasPaymentText = !!template?.paymentText;
  const hasContent = !!template?.content;
  const renewalDuration = contract?.renewalDuration || 12;

  const sections = useMemo(() => {
    const s: Array<{ id: string; title: string; icon: any }> = [
      { id: "intestazione", title: "Intestazione", icon: Building2 },
      { id: "dati-cliente", title: "Dati Cliente", icon: User },
    ];
    if (hasCustomContent)
      s.push({
        id: "contenuto-personalizzato",
        title: "Contenuto Personalizzato",
        icon: FileText,
      });
    if (hasPaymentPlan || isPartnership)
      s.push({ id: "piano-pagamenti", title: "Piano Pagamenti", icon: Euro });
    if (hasPaymentText)
      s.push({
        id: "condizioni-pagamento",
        title: "Condizioni di Pagamento",
        icon: Euro,
      });
    if (hasContent)
      s.push({
        id: "corpo-contratto",
        title: "Corpo del Contratto",
        icon: FileText,
      });
    if (hasBonuses)
      s.push({ id: "bonus", title: "Bonus", icon: Gift });
    s.push(
      { id: "validita", title: "Validità Contratto", icon: Calendar },
      { id: "autorinnovo", title: "Autorinnovo", icon: Shield },
      { id: "firma", title: "Firma", icon: FileText }
    );
    return s;
  }, [
    hasCustomContent,
    hasPaymentPlan,
    isPartnership,
    hasPaymentText,
    hasContent,
    hasBonuses,
  ]);

  useEffect(() => {
    if (isPreview) return;
    const handleScroll = () => {
      if (contentRef.current) {
        setShowScrollTop(contentRef.current.scrollTop > 600);
        const sectionEls =
          contentRef.current.querySelectorAll("[data-section]");
        let currentId = "intestazione";
        sectionEls.forEach((section) => {
          const rect = section.getBoundingClientRect();
          if (rect.top <= 200) {
            currentId =
              section.getAttribute("data-section") || currentId;
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

  const p = (val: string | undefined, placeholder: string) =>
    isPreview ? val || placeholder : val || "";

  const totalAmount =
    paymentPlan
      ?.reduce((sum, pm) => sum + parseFloat(pm.rata_importo || "0"), 0)
      .toFixed(2) || "0.00";

  const contractStartDate =
    contract?.contractStartDate || contract?.createdAt;
  const contractEndDate = contract?.contractEndDate;

  const documentContent = (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden print:shadow-none print:border-none print:rounded-none">
      <div className="px-6 sm:px-10 lg:px-14 py-10 sm:py-14 space-y-10 contract-content">
        <div data-section="intestazione" className="space-y-6 pb-8 border-b border-slate-200">
          <div className="flex justify-between items-start">
            <div>
              {company.logoUrl ? (
                <img
                  src={company.logoUrl}
                  alt="Logo"
                  className="max-w-[120px] max-h-[80px] object-contain"
                />
              ) : (
                <div className="w-[120px] h-[80px] rounded bg-black flex flex-col items-center justify-center text-white">
                  <span className="text-sm font-bold tracking-wide">
                    {p(company.companyName, "AZIENDA")
                      .substring(0, 8)
                      .toUpperCase()}
                  </span>
                </div>
              )}
            </div>
            <div className="text-right text-sm text-slate-600 space-y-0.5">
              <div className="font-semibold text-base text-slate-900">
                {p(company.companyName, "Nome Azienda")}
              </div>
              <div>
                {p(company.address, "Via...")} Cap{" "}
                {p(company.postalCode, "00000")}{" "}
                {p(company.city, "Città")}
              </div>
              <div>C.F. e P.I. {p(company.taxId, "00000000000")}</div>
              <div>
                Codice univoco: {p(company.uniqueCode, "XXXXXXX")}
              </div>
              <div>Pec: {p(company.pec, "pec@esempio.it")}</div>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight tracking-tight text-center">
            {template?.name ||
              company.contractTitle ||
              p(undefined, "Contratto")}
          </h1>
        </div>

        <section data-section="dati-cliente" className="space-y-4">
          <h2 className="text-xl font-bold text-slate-800 border-l-4 border-indigo-500 pl-4">
            DATI DEL CLIENTE / COMMITTENTE
          </h2>

          <div className="hidden sm:block overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <td
                    colSpan={2}
                    className="bg-blue-500 text-white font-semibold text-sm uppercase tracking-wide px-4 py-3"
                  >
                    Dati del cliente/committente
                  </td>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="px-4 py-2.5 text-slate-700 border-r border-slate-100">
                    Società {p(client.societa, "Nome Società")}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">
                    Con sede in {p(client.sede, "Città")}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 text-slate-700 border-r border-slate-100">
                    Indirizzo {p(client.indirizzo, "Via...")}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">
                    Codice fiscale/PIVA {p(client.p_iva, "00000000000")}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 text-slate-700 border-r border-slate-100">
                    PEC {p(client.pec, "pec@esempio.it")}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">
                    Email {p(client.email, "email@esempio.it")}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 text-slate-700 border-r border-slate-100">
                    Cellulare {p(client.cellulare, "+39...")}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">
                    Codice univoco{" "}
                    {p(client.codice_univoco, "XXXXXXX")}
                  </td>
                </tr>
                <tr>
                  <td
                    colSpan={2}
                    className="px-4 py-2.5 text-slate-700"
                  >
                    Numero iscrizione al REA o al registro delle imprese{" "}
                    {p(client.rea, "")}
                  </td>
                </tr>
                <tr>
                  <td
                    colSpan={2}
                    className="px-4 py-2.5 text-slate-600 italic"
                  >
                    In persona del suo legale rappresentante p.t.
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 text-slate-700 border-r border-slate-100">
                    <strong className="text-slate-900">Signor./a.</strong>{" "}
                    {p(client.cliente_nome, "Nome Cognome")}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">
                    <strong className="text-slate-900">Nato a</strong>{" "}
                    {p(client.nato_a, "Città")}
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-2.5 text-slate-700 border-r border-slate-100">
                    <strong className="text-slate-900">
                      Data di nascita
                    </strong>{" "}
                    {client.data_nascita
                      ? formatDateSafe(client.data_nascita)
                      : isPreview
                        ? "01/01/1990"
                        : ""}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">
                    <strong className="text-slate-900">Residente a</strong>{" "}
                    {p(client.residente_a, "Città")}
                  </td>
                </tr>
                <tr>
                  <td
                    colSpan={2}
                    className="px-4 py-2.5 text-slate-700"
                  >
                    <strong className="text-slate-900">
                      Indirizzo di residenza:
                    </strong>{" "}
                    {p(client.indirizzo_residenza, "Via...")}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="sm:hidden space-y-3">
            {[
              {
                label: "Società",
                value: p(client.societa, "Nome Società"),
              },
              { label: "Sede", value: p(client.sede, "Città") },
              {
                label: "Indirizzo",
                value: p(client.indirizzo, "Via..."),
              },
              {
                label: "P.IVA/CF",
                value: p(client.p_iva, "00000000000"),
              },
              {
                label: "PEC",
                value: p(client.pec, "pec@esempio.it"),
              },
              {
                label: "Email",
                value: p(client.email, "email@esempio.it"),
              },
              {
                label: "Cellulare",
                value: p(client.cellulare, "+39..."),
              },
              {
                label: "Codice Univoco",
                value: p(client.codice_univoco, "XXXXXXX"),
              },
              { label: "REA", value: p(client.rea, "") },
              {
                label: "Legale Rappresentante",
                value: p(client.cliente_nome, "Nome Cognome"),
              },
              { label: "Nato a", value: p(client.nato_a, "Città") },
              {
                label: "Data di nascita",
                value: client.data_nascita
                  ? formatDateSafe(client.data_nascita)
                  : isPreview
                    ? "01/01/1990"
                    : "",
              },
              {
                label: "Residente a",
                value: p(client.residente_a, "Città"),
              },
              {
                label: "Indirizzo residenza",
                value: p(client.indirizzo_residenza, "Via..."),
              },
            ].map(
              (item, i) =>
                item.value && (
                  <div
                    key={i}
                    className="flex justify-between py-2 px-3 bg-slate-50 rounded-lg text-sm"
                  >
                    <span className="text-slate-500 font-medium">
                      {item.label}
                    </span>
                    <span className="text-slate-800 text-right ml-2">
                      {item.value}
                    </span>
                  </div>
                )
            )}
          </div>
        </section>

        {hasCustomContent && (
          <section data-section="contenuto-personalizzato" className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800 border-l-4 border-indigo-500 pl-4">
              CONTENUTO PERSONALIZZATO
            </h2>
            <div
              className="text-sm text-slate-700 leading-relaxed custom-content-section [&_p]:mb-4 [&_p]:leading-relaxed [&_ul]:my-4 [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:pl-6 [&_li]:mb-2 [&_strong]:font-semibold [&_strong]:text-slate-900 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:my-5 [&_h1]:text-slate-900 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:my-4 [&_h2]:text-slate-900 [&_h3]:text-base [&_h3]:font-bold [&_h3]:my-3 [&_h3]:text-slate-900"
              dangerouslySetInnerHTML={{
                __html: template!.customContent!,
              }}
            />
          </section>
        )}

        {isPartnership && (
          <section data-section="piano-pagamenti" className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800 border-l-4 border-amber-500 pl-4">
              MODELLO DI PARTNERSHIP
            </h2>
            <div className="p-5 rounded-xl bg-gradient-to-br from-amber-50/80 to-yellow-50/40 border border-amber-200">
              <div className="text-center mb-4">
                <span className="inline-block px-4 py-2 bg-amber-400 rounded-lg text-amber-900 font-bold text-lg">
                  Percentuale: {contract!.partnershipPercentage}% sul
                  fatturato TOTALE
                </span>
              </div>
              <div className="space-y-4 text-sm text-slate-700">
                <div>
                  <h4 className="font-semibold text-amber-800 mb-2">
                    DEFINIZIONE DI FATTURATO TOTALE
                  </h4>
                  <p className="leading-relaxed mb-2">
                    Per "fatturato TOTALE" si intende la somma di tutti i
                    ricavi lordi generati dall'attività, comprensivi di:
                  </p>
                  <ul className="space-y-1 ml-4">
                    {[
                      "Vendite di cibo e bevande",
                      "Servizi di catering e delivery",
                      "Eventi privati e prenotazioni speciali",
                      "Qualsiasi altro ricavo direttamente collegato all'attività",
                    ].map((t, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-amber-500 mt-0.5">•</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-amber-800 mb-2">
                    MODALITÀ DI CALCOLO E PAGAMENTO
                  </h4>
                  <p className="leading-relaxed">
                    Il pagamento della percentuale sarà calcolato
                    mensilmente sul fatturato TOTALE del mese precedente e
                    dovrà essere corrisposto entro il 15 del mese
                    successivo tramite bonifico bancario.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-amber-800 mb-2">
                    TRASPARENZA E RENDICONTAZIONE
                  </h4>
                  <p className="leading-relaxed mb-2">
                    Il Cliente si impegna a fornire mensilmente la
                    documentazione contabile necessaria per il calcolo
                    della percentuale dovuta, inclusi:
                  </p>
                  <ul className="space-y-1 ml-4">
                    {[
                      "Estratti conto del registratore di cassa o POS",
                      "Fatture emesse nel periodo di riferimento",
                      "Dichiarazioni IVA periodiche",
                      "Report di fatturato certificati dal commercialista",
                    ].map((t, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-amber-500 mt-0.5">•</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-center">
                  <p className="text-red-800 font-semibold text-sm">
                    IMPORTANTE: Questo modello di partnership sostituisce
                    qualsiasi piano di pagamento fisso. Il compenso sarà
                    calcolato esclusivamente come percentuale del
                    fatturato totale.
                  </p>
                </div>
              </div>
            </div>
          </section>
        )}

        {!isPartnership && hasPaymentPlan && (
          <section data-section="piano-pagamenti" className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800 border-l-4 border-blue-500 pl-4">
              PIANO PAGAMENTI
            </h2>
            <div className="p-5 rounded-xl bg-gradient-to-br from-blue-50/80 to-indigo-50/40 border border-blue-200">
              <p className="text-sm text-blue-800 font-semibold mb-4">
                Il prezzo totale di {totalAmount} EUR + IVA sarà
                corrisposto con le seguenti modalità:
              </p>
              <div className="space-y-2">
                {paymentPlan!.map((payment, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 text-sm text-slate-700"
                  >
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                    <span>
                      Pagamento {payment.rata_numero || index + 1} di EUR{" "}
                      <strong className="text-slate-900">
                        {payment.rata_importo}
                      </strong>{" "}
                      + IVA entro il{" "}
                      <strong className="text-slate-900">
                        {payment.rata_scadenza}
                      </strong>
                    </span>
                  </div>
                ))}
              </div>
              {usingCustomInstallments && (
                <p className="text-xs text-blue-600 mt-3 italic">
                  Piano di pagamento personalizzato
                </p>
              )}
            </div>
          </section>
        )}

        {hasPaymentText && (
          <section data-section="condizioni-pagamento" className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800 border-l-4 border-blue-500 pl-4">
              CONDIZIONI DI PAGAMENTO
            </h2>
            <div
              className="text-sm text-slate-700 leading-relaxed [&_p]:mb-4 [&_p]:leading-relaxed [&_ul]:my-4 [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:pl-6 [&_li]:mb-2 [&_strong]:font-semibold [&_strong]:text-slate-900"
              dangerouslySetInnerHTML={{
                __html: template!.paymentText!,
              }}
            />
          </section>
        )}

        {hasContent && (
          <section data-section="corpo-contratto" className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800 border-l-4 border-violet-500 pl-4">
              CORPO DEL CONTRATTO
            </h2>
            <div
              className="text-sm text-slate-700 leading-relaxed custom-content-section [&_p]:mb-4 [&_p]:leading-relaxed [&_ul]:my-4 [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:pl-6 [&_li]:mb-2 [&_strong]:font-semibold [&_strong]:text-slate-900 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:my-5 [&_h1]:text-slate-900 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:my-4 [&_h2]:text-slate-900 [&_h3]:text-base [&_h3]:font-bold [&_h3]:my-3 [&_h3]:text-slate-900"
              dangerouslySetInnerHTML={{ __html: template!.content! }}
            />
          </section>
        )}

        {hasBonuses && (
          <section data-section="bonus" className="space-y-4">
            <h2 className="text-xl font-bold text-slate-800 border-l-4 border-emerald-500 pl-4">
              BONUS INCLUSI
            </h2>
            <div className="space-y-3">
              {bonusList!.map((bonus, index) => (
                <div
                  key={index}
                  className="p-4 rounded-r-xl border-l-4 border-emerald-500 bg-gradient-to-br from-emerald-50/80 to-green-50/40"
                >
                  <div className="flex items-start gap-3">
                    <Gift className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-800">
                        Bonus {index + 1}
                      </p>
                      <p className="text-sm text-slate-700 mt-1">
                        {bonus.bonus_descrizione}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section data-section="validita" className="space-y-4">
          <h2 className="text-xl font-bold text-slate-800 border-l-4 border-indigo-500 pl-4">
            VALIDITÀ DEL CONTRATTO
          </h2>
          <div className="p-5 rounded-xl bg-gradient-to-br from-indigo-50/80 to-blue-50/40 border border-indigo-100">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-2 text-sm text-slate-700">
                {contractStartDate && (
                  <p>
                    <strong className="text-slate-900">
                      Data di inizio:
                    </strong>{" "}
                    {formatDateSafe(contractStartDate)}
                  </p>
                )}
                {contractEndDate && (
                  <p>
                    <strong className="text-slate-900">
                      Data di scadenza:
                    </strong>{" "}
                    {formatDateSafe(contractEndDate)}
                  </p>
                )}
                {!contractStartDate && !contractEndDate && isPreview && (
                  <p className="text-slate-400 italic">
                    Le date di validità saranno compilate alla creazione
                    del contratto.
                  </p>
                )}
                {contract?.signedAt && (
                  <p>
                    <strong className="text-slate-900">Firmato il:</strong>{" "}
                    {formatDateSafe(contract.signedAt)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section data-section="autorinnovo" className="space-y-4">
          <h2 className="text-xl font-bold text-slate-800 border-l-4 border-violet-500 pl-4">
            CLAUSOLA DI AUTORINNOVO
          </h2>
          <div className="p-5 rounded-xl bg-gradient-to-br from-violet-50/80 to-purple-50/40 border border-violet-100">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-violet-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-2 text-sm text-slate-700">
                <p className="leading-relaxed">
                  Il presente contratto si intende tacitamente rinnovato per
                  un periodo di{" "}
                  <strong className="text-slate-900">
                    {renewalDuration} mesi
                  </strong>{" "}
                  salvo disdetta da comunicarsi con un preavviso di almeno
                  30 giorni prima della scadenza mediante raccomandata A/R
                  o PEC.
                </p>
                <p className="leading-relaxed">
                  In assenza di comunicazione di disdetta nei termini
                  previsti, il contratto si rinnoverà automaticamente alle
                  medesime condizioni economiche e contrattuali per
                  ulteriori{" "}
                  <strong className="text-slate-900">
                    {renewalDuration} mesi
                  </strong>
                  .
                </p>
              </div>
            </div>
          </div>
        </section>

        <section data-section="firma" className="space-y-4">
          <h2 className="text-xl font-bold text-slate-800 border-l-4 border-indigo-500 pl-4">
            DICHIARAZIONI E FIRMA
          </h2>
          <div className="p-5 rounded-xl bg-gradient-to-br from-slate-50/80 to-gray-50/40 border border-slate-200">
            <div className="space-y-3 text-sm text-slate-700">
              <p className="leading-relaxed">
                Con la sottoscrizione del presente contratto, il Cliente
                dichiara:
              </p>
              <ul className="space-y-2 ml-2">
                {[
                  "di aver letto e compreso integralmente il contenuto del presente contratto;",
                  "di accettare espressamente tutte le clausole e condizioni in esso contenute;",
                  "di aver ricevuto tutte le informazioni necessarie prima della sottoscrizione;",
                  "che i dati forniti sono veritieri e aggiornati.",
                ].map((text, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {!isPreview && signatureArea && (
            <div className="mt-6">{signatureArea}</div>
          )}
          {isPreview && (
            <div className="mt-6 border-2 border-dashed border-slate-300 bg-slate-50 p-6 rounded-xl text-center">
              <FileText className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-500 font-medium">
                Area firma digitale
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Visibile nella versione finale del contratto
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );

  if (isPreview) {
    return (
      <div className="max-w-4xl mx-auto py-6">{documentContent}</div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex flex-col">
      <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/80 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent leading-tight">
                {template?.name || company.contractTitle || "Contratto"}
              </h1>
              <p className="text-xs text-slate-500 hidden sm:block">
                {company.companyName || ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:flex gap-2 text-slate-600 border-slate-200 hover:bg-slate-50"
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
              {sidebarOpen ? (
                <ChevronLeft className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside
          className={`${
            sidebarOpen ? "w-72 xl:w-80" : "w-0"
          } transition-all duration-300 border-r border-slate-200/60 bg-white/60 backdrop-blur-sm flex-shrink-0 overflow-hidden print:hidden`}
        >
          <ScrollArea className="h-[calc(100vh-4rem)]">
            <div className="p-4">
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 px-2">
                Indice
              </h2>
              <nav className="space-y-0.5">
                {sections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => scrollToSection(section.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-150 flex items-center gap-2 ${
                        activeSection === section.id
                          ? "bg-indigo-50 text-indigo-700 shadow-sm font-semibold"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-800 font-medium"
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {section.title}
                    </button>
                  );
                })}
              </nav>
            </div>
          </ScrollArea>
        </aside>

        <main ref={contentRef} className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 sm:px-8 lg:px-12 py-8 sm:py-12">
            {documentContent}
            {afterDocumentContent && (
              <div className="mt-8">
                {afterDocumentContent}
              </div>
            )}
          </div>
        </main>
      </div>

      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-40 w-10 h-10 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-200 flex items-center justify-center hover:bg-indigo-700 transition-colors print:hidden"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
