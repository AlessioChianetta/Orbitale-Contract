export type ClientType = "azienda" | "privato";

export type RequiredClientField = {
  key: string;
  label: string;
  sectionId: string;
  requiredFor?: "both" | "azienda" | "privato";
  group?: "company" | "personal";
  type?: "text" | "email" | "tel" | "date" | "select";
};

const ALL_CLIENT_FIELDS: RequiredClientField[] = [
  { key: "societa", label: "Nome società / Cognome e Nome", sectionId: "section-client", requiredFor: "both", group: "company" },
  { key: "sede", label: "Città sede legale / Città", sectionId: "section-client", requiredFor: "both", group: "company" },
  { key: "indirizzo", label: "Indirizzo società / Indirizzo", sectionId: "section-client", requiredFor: "both", group: "company" },
  { key: "p_iva", label: "Codice Fiscale / P.IVA", sectionId: "section-client", requiredFor: "both", group: "company" },
  { key: "email", label: "Email", sectionId: "section-client", requiredFor: "both", group: "company", type: "email" },
  { key: "cellulare", label: "Cellulare", sectionId: "section-client", requiredFor: "both", group: "company", type: "tel" },
  { key: "cliente_nome", label: "Nome e cognome del referente", sectionId: "section-client", requiredFor: "azienda", group: "personal" },
  { key: "nato_a", label: "Luogo di nascita", sectionId: "section-client", requiredFor: "both", group: "personal" },
  { key: "data_nascita", label: "Data di nascita", sectionId: "section-client", requiredFor: "both", group: "personal", type: "date" },
  { key: "residente_a", label: "Città di residenza", sectionId: "section-client", requiredFor: "both", group: "personal" },
  { key: "indirizzo_residenza", label: "Indirizzo di residenza", sectionId: "section-client", requiredFor: "both", group: "personal" },
];

/** All field keys that should be synced over the co-fill WebSocket (includes
 * required fields plus optional/meta ones like tipo_cliente, province, etc.). */
export const SYNCED_FIELD_KEYS: string[] = [
  ...ALL_CLIENT_FIELDS.map((f) => f.key),
  "tipo_cliente",
  "provincia_sede",
  "provincia_residenza",
  "pec",
  "codice_univoco",
  "stesso_indirizzo",
];

export function getClientType(clientData: Record<string, any> | undefined | null): ClientType {
  const t = clientData?.tipo_cliente;
  return t === "privato" ? "privato" : "azienda";
}

export function getRequiredClientFields(tipo: ClientType): RequiredClientField[] {
  return ALL_CLIENT_FIELDS.filter((f) => f.requiredFor === "both" || f.requiredFor === tipo);
}

/** Backwards-compatible flat list (defaults to azienda). Use sparingly — prefer
 * getRequiredClientFields(tipo) so privato vs azienda is honored. */
export const REQUIRED_CLIENT_FIELDS: RequiredClientField[] = getRequiredClientFields("azienda");

export function getMissingClientFields(clientData: Record<string, any> | undefined | null): RequiredClientField[] {
  const cd = clientData || {};
  const tipo = getClientType(cd);
  const fields = getRequiredClientFields(tipo);
  return fields.filter((f) => {
    const v = cd[f.key];
    return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
  });
}
