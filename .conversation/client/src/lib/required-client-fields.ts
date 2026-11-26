// Re-export dai tipi/condizioni condivise tra client e server, così la
// validazione "campi cliente obbligatori" è una sola fonte di verità.
export {
  type ClientType,
  type RequiredClientField,
  SYNCED_FIELD_KEYS,
  getClientType,
  getRequiredClientFields,
  REQUIRED_CLIENT_FIELDS,
  getMissingClientFields,
} from "@shared/client-fields";
