import { useMemo } from "react";
import { ChevronDown, ChevronUp, FileText, User, Building, Layers, Euro, Calendar, Gift } from "lucide-react";
import { useState } from "react";

export interface ContractRecapData {
  templateName?: string | null;
  clientType?: "azienda" | "privato";
  clientLabel?: string | null;
  clientEmail?: string | null;
  modulesCount?: number;
  modulesTotal?: number;
  bonusCount?: number;
  totalValue?: number | null;
  isPercentagePartnership?: boolean;
  partnershipPercentage?: number | null;
  contractStartDate?: string | null;
  contractEndDate?: string | null;
  durationMonths?: number | null;
  presetName?: string | null;
}

interface Props {
  data: ContractRecapData;
  /** Layout: "sidebar" su desktop (>=lg), "accordion" mobile. */
  variant?: "sidebar" | "accordion";
  className?: string;
}

function fmtEuro(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return s;
  }
}

export default function ContractRecapPanel({ data, variant = "sidebar", className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const months = useMemo(() => {
    if (data.durationMonths != null) return data.durationMonths;
    if (data.contractStartDate && data.contractEndDate) {
      const a = new Date(data.contractStartDate);
      const b = new Date(data.contractEndDate);
      if (!Number.isNaN(a.getTime()) && !Number.isNaN(b.getTime())) {
        const months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
        return months > 0 ? months : null;
      }
    }
    return null;
  }, [data.contractStartDate, data.contractEndDate, data.durationMonths]);

  const body = (
    <div className="space-y-3 text-sm" data-testid="contract-recap-body">
      {data.presetName && (
        <div className="text-[11px] uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1">
          Preset: <strong className="font-semibold">{data.presetName}</strong>
        </div>
      )}
      <Row icon={<FileText className="h-4 w-4 text-indigo-500" />} label="Template">
        {data.templateName || <span className="text-slate-400">non scelto</span>}
      </Row>
      <Row
        icon={data.clientType === "privato" ? <User className="h-4 w-4 text-indigo-500" /> : <Building className="h-4 w-4 text-indigo-500" />}
        label="Cliente"
      >
        <div>{data.clientLabel || <span className="text-slate-400">da compilare</span>}</div>
        {data.clientEmail && <div className="text-xs text-slate-500 truncate">{data.clientEmail}</div>}
      </Row>
      <Row icon={<Layers className="h-4 w-4 text-indigo-500" />} label="Pacchetti">
        {data.modulesTotal != null
          ? <>{data.modulesCount ?? 0} <span className="text-slate-400">/ {data.modulesTotal}</span></>
          : <span className="text-slate-400">—</span>}
      </Row>
      <Row icon={<Gift className="h-4 w-4 text-indigo-500" />} label="Bonus">
        {data.bonusCount ?? 0}
      </Row>
      <Row icon={<Euro className="h-4 w-4 text-indigo-500" />} label="Totale">
        {data.isPercentagePartnership ? (
          <span>{data.partnershipPercentage != null ? `${data.partnershipPercentage}% partnership` : <span className="text-slate-400">—</span>}</span>
        ) : (
          <span className="font-semibold text-slate-900">{fmtEuro(data.totalValue ?? null)}</span>
        )}
      </Row>
      <Row icon={<Calendar className="h-4 w-4 text-indigo-500" />} label="Durata">
        <div>{months != null ? `${months} mesi` : <span className="text-slate-400">—</span>}</div>
        {(data.contractStartDate || data.contractEndDate) && (
          <div className="text-xs text-slate-500">{fmtDate(data.contractStartDate)} → {fmtDate(data.contractEndDate)}</div>
        )}
      </Row>
    </div>
  );

  if (variant === "accordion") {
    return (
      <div className={`rounded-xl border border-slate-200 bg-white ${className}`}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-800"
          aria-expanded={open}
          data-testid="recap-accordion-toggle"
        >
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-indigo-500" />
            Riepilogo contratto
          </span>
          {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </button>
        {open && <div className="border-t border-slate-100 px-4 py-3">{body}</div>}
      </div>
    );
  }

  return (
    <aside className={`rounded-2xl border border-slate-200 bg-white p-4 ${className}`} data-testid="contract-recap-panel">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-3 flex items-center gap-2">
        <FileText className="h-3.5 w-3.5" />
        Riepilogo contratto
      </h4>
      {body}
    </aside>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <div className="mt-0.5 flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
        <div className="text-slate-800">{children}</div>
      </div>
    </div>
  );
}
