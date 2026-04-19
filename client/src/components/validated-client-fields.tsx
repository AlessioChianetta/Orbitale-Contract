import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, CheckCircle, Loader2, XCircle } from "lucide-react";
import {
  ITALIAN_PROVINCES,
  detectVATorCF,
  looksLikeAddress,
  lookupCompanyByVAT,
  validateCodiceFiscale,
  validateItalianMobile,
  validatePartitaIva,
} from "@/lib/validation-utils";

export type CfPivaValidation = {
  isValid: boolean | null;
  type: "vat" | "cf" | null;
  isValidating: boolean;
  forced: boolean;
};

export const initialCfPivaValidation: CfPivaValidation = {
  isValid: null,
  type: null,
  isValidating: false,
  forced: false,
};

export function isCfPivaBlocking(value: string, v: CfPivaValidation): boolean {
  const trimmed = (value || "").trim();
  if (!trimmed) return false;
  if (v.forced) return false;
  if (v.isValid === false) return true;
  if (v.isValidating || v.isValid === null) return true;
  return false;
}

export function isMobileInvalid(value: string): boolean {
  const v = (value || "").trim();
  if (!v) return false;
  return !validateItalianMobile(v);
}

type LookupAutofill = Partial<{
  societa: string;
  indirizzo: string;
  sede: string;
  provincia_sede: string;
  postal_code: string;
}>;

export function ValidatedCityField({
  label,
  value,
  province,
  onChange,
  onProvinceChange,
  disabled,
  testIdPrefix,
}: {
  label: string;
  value: string;
  province: string;
  onChange: (v: string) => void;
  onProvinceChange: (v: string) => void;
  disabled?: boolean;
  testIdPrefix?: string;
}) {
  return (
    <div>
      <Label className="text-sm font-medium text-slate-700 mb-1.5 block">{label}</Label>
      <div className="grid grid-cols-[1fr_90px] gap-2">
        <Input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Es. Milano"
          disabled={disabled}
          className={disabled ? "bg-slate-100" : ""}
          data-testid={testIdPrefix ? `${testIdPrefix}-city` : undefined}
        />
        <Select
          value={province || ""}
          onValueChange={onProvinceChange}
          disabled={disabled}
        >
          <SelectTrigger
            className={disabled ? "bg-slate-100" : ""}
            data-testid={testIdPrefix ? `${testIdPrefix}-province` : undefined}
          >
            <SelectValue placeholder="PR" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {ITALIAN_PROVINCES.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {!disabled && looksLikeAddress(value) && (
        <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Sembra un indirizzo. Inserisci solo il nome della città (es. "Milano"), l'indirizzo va nel campo sotto.
        </p>
      )}
    </div>
  );
}

export function ValidatedAddressField({
  label,
  value,
  onChange,
  disabled,
  testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  testId?: string;
}) {
  const trimmed = (value || "").trim();
  return (
    <div>
      <Label className="text-sm font-medium text-slate-700 mb-1.5 block">{label}</Label>
      <Input
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Via, numero civico, CAP"
        disabled={disabled}
        className={disabled ? "bg-slate-100" : ""}
        data-testid={testId}
      />
      {!disabled && trimmed && !looksLikeAddress(trimmed) && (
        <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Inserisci via e numero civico (es. "Via Roma 12, 20100").
        </p>
      )}
    </div>
  );
}

export function ValidatedCfPivaField({
  label,
  value,
  validation,
  onChange,
  onValidationChange,
  onLookup,
  isPrivato = false,
  disabled,
  testId,
}: {
  label: string;
  value: string;
  validation: CfPivaValidation;
  onChange: (v: string) => void;
  onValidationChange: (v: CfPivaValidation) => void;
  onLookup?: (data: LookupAutofill) => void;
  isPrivato?: boolean;
  disabled?: boolean;
  testId?: string;
}) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const v = (value || "").toString();
    if (!v) {
      onValidationChange(initialCfPivaValidation);
      return;
    }
    onValidationChange({ ...validation, isValidating: true, forced: false });
    debounceRef.current = setTimeout(async () => {
      const detectedType = detectVATorCF(v);
      let isValid = false;
      if (detectedType === "vat") {
        isValid = validatePartitaIva(v);
        if (isValid && onLookup) {
          try {
            const lookup = await lookupCompanyByVAT(v);
            if (lookup.success && lookup.data) {
              onLookup({
                societa: lookup.data.company_name,
                indirizzo: lookup.data.address,
                sede: lookup.data.city,
                provincia_sede: lookup.data.province,
                postal_code: lookup.data.postal_code,
              });
            }
          } catch {
            /* lookup non disponibile, non bloccante */
          }
        }
      } else if (detectedType === "cf") {
        isValid = validateCodiceFiscale(v);
      }
      onValidationChange({
        isValid,
        type: detectedType !== "unknown" ? detectedType : null,
        isValidating: false,
        forced: false,
      });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const showInvalid = validation.isValid === false && !validation.forced;

  return (
    <div>
      <Label className="text-sm font-medium text-slate-700 mb-1.5 block">{label}</Label>
      <div className="relative">
        <Input
          value={value || ""}
          onChange={(e) => onChange(e.target.value.toUpperCase().replace(/\s/g, ""))}
          placeholder={isPrivato ? "16 caratteri" : "Codice Fiscale o Partita IVA"}
          disabled={disabled}
          className={`pr-10 ${
            validation.isValid === true
              ? "border-emerald-400 focus:border-emerald-500"
              : showInvalid
              ? "border-red-400 focus:border-red-500"
              : ""
          }`}
          data-testid={testId}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {validation.isValidating && (
            <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
          )}
          {!validation.isValidating && validation.isValid === true && (
            <CheckCircle className="h-5 w-5 text-emerald-500" />
          )}
          {!validation.isValidating && showInvalid && (
            <XCircle className="h-5 w-5 text-red-500" />
          )}
        </div>
      </div>
      {validation.isValid === true && validation.type && (
        <p className="text-sm text-emerald-600 mt-1">
          {validation.type === "vat" ? "Partita IVA valida" : "Codice Fiscale valido"}
        </p>
      )}
      {showInvalid && (
        <div className="flex items-center justify-between mt-1 gap-2">
          <p className="text-sm text-red-600">
            {validation.type === "vat"
              ? "Partita IVA non valida"
              : validation.type === "cf"
              ? "Codice Fiscale non valido"
              : "Formato non riconosciuto"}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onValidationChange({ ...validation, isValid: true, forced: true })
            }
            className="h-7 px-3 text-xs border-amber-300 text-amber-700 hover:bg-amber-50 rounded-lg"
            data-testid={testId ? `${testId}-force` : undefined}
          >
            Forza inserimento
          </Button>
        </div>
      )}
    </div>
  );
}

export function ValidatedMobileField({
  label,
  value,
  onChange,
  disabled,
  testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  testId?: string;
}) {
  const invalid = isMobileInvalid(value);
  return (
    <div>
      <Label className="text-sm font-medium text-slate-700 mb-1.5 block">{label}</Label>
      <Input
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="+39 333 123 4567"
        disabled={disabled}
        className={invalid ? "border-red-400 focus:border-red-500" : ""}
        data-testid={testId}
      />
      {invalid ? (
        <p className="text-sm text-red-600 mt-1">
          Numero non valido. Inserisci un cellulare italiano (es. 333 123 4567).
        </p>
      ) : (
        <p className="text-xs text-slate-500 mt-1">
          Es. 333 123 4567 o +39 333 123 4567.
        </p>
      )}
    </div>
  );
}
