export type RequiredClientField = {
  key: string;
  label: string;
  sectionId: string;
};

export const REQUIRED_CLIENT_FIELDS: RequiredClientField[] = [
  { key: "societa", label: "Nome società", sectionId: "section-client" },
  { key: "sede", label: "Sede legale", sectionId: "section-client" },
  { key: "indirizzo", label: "Indirizzo società", sectionId: "section-client" },
  { key: "p_iva", label: "Codice Fiscale / P.IVA", sectionId: "section-client" },
  { key: "email", label: "Email", sectionId: "section-client" },
  { key: "cellulare", label: "Cellulare", sectionId: "section-client" },
  { key: "cliente_nome", label: "Nome e cognome del referente", sectionId: "section-client" },
  { key: "nato_a", label: "Luogo di nascita", sectionId: "section-client" },
  { key: "data_nascita", label: "Data di nascita", sectionId: "section-client" },
  { key: "residente_a", label: "Luogo di residenza", sectionId: "section-client" },
  { key: "indirizzo_residenza", label: "Indirizzo di residenza", sectionId: "section-client" },
];

export function getMissingClientFields(clientData: Record<string, any> | undefined | null): RequiredClientField[] {
  const cd = clientData || {};
  return REQUIRED_CLIENT_FIELDS.filter((f) => {
    const v = cd[f.key];
    return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
  });
}
