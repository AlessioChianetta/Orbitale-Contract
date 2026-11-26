// Impaginazione comune delle email (stessa grafica della pagina di firma:
// grigi neutri, nero come colore d'azione, nessun colore "di sistema").
// Tabelle e stili in linea: è l'unico modo che regge Gmail, Outlook e le app
// di posta sul telefono. Nessuna immagine esterna, nessuna emoji.

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const INK = "#1d1d1f";
const MUTED = "#6e6e73";
const SOFT = "#86868b";
const LINE = "#e8e8ed";
const PAGE = "#f5f5f7";

export function escapeEmailHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Paragrafo di testo standard. `html` è già sicuro (escape fatto dal chiamante). */
export function emailParagraph(html: string, opts: { muted?: boolean; small?: boolean } = {}): string {
  const size = opts.small ? 13 : 15;
  const color = opts.muted ? MUTED : "#424245";
  return `<p style="margin:0 0 16px;font-family:${FONT};font-size:${size}px;line-height:1.6;color:${color};">${html}</p>`;
}

/** Pulsante principale (nero, a pillola). */
export function emailButton(href: string, label: string): string {
  const h = escapeEmailHtml(href);
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
    <tr><td align="center" bgcolor="${INK}" style="border-radius:999px;">
      <a href="${h}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none;border-radius:999px;">${escapeEmailHtml(label)}</a>
    </td></tr>
  </table>`;
}

/** Riquadro grigio con coppie etichetta/valore. Le righe senza valore non compaiono. */
export function emailInfoBox(rows: Array<{ label: string; value?: string | null }>): string {
  const visible = rows.filter((r) => r.value);
  if (!visible.length) return "";
  const cells = visible
    .map((r, i) => `
      <tr><td style="padding:${i === 0 ? "0" : "12px"} 0 0;font-family:${FONT};">
        <div style="font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:${SOFT};">${escapeEmailHtml(r.label)}</div>
        <div style="margin-top:2px;font-size:15px;color:${INK};word-break:break-word;">${escapeEmailHtml(r.value)}</div>
      </td></tr>`)
    .join("");
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;background:${PAGE};border-radius:12px;">
    <tr><td style="padding:16px 18px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${cells}</table>
    </td></tr>
  </table>`;
}

/** Passaggi numerati (come il pannello di firma). `steps` sono testi semplici. */
export function emailSteps(title: string, steps: string[]): string {
  const rows = steps
    .map((s, i) => `
      <tr>
        <td valign="top" width="34" style="padding:0 0 12px;">
          <div style="width:24px;height:24px;border-radius:999px;border:1.5px solid ${INK};font-family:${FONT};font-size:12px;font-weight:600;line-height:24px;text-align:center;color:${INK};">${i + 1}</div>
        </td>
        <td valign="top" style="padding:3px 0 12px;font-family:${FONT};font-size:14px;line-height:1.5;color:#424245;">${escapeEmailHtml(s)}</td>
      </tr>`)
    .join("");
  return `
  <div style="margin:0 0 8px;font-family:${FONT};font-size:13px;font-weight:600;color:${INK};">${escapeEmailHtml(title)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px;">${rows}</table>`;
}

/** Codice di verifica grande e leggibile. */
export function emailCode(code: string): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 24px;">
    <tr><td style="padding:16px 24px;background:${PAGE};border-radius:12px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:10px;color:${INK};">${escapeEmailHtml(code)}</td></tr>
  </table>`;
}

/** Link di riserva (se il pulsante non funziona). */
export function emailFallbackLink(href: string): string {
  const h = escapeEmailHtml(href);
  return emailParagraph(
    `Se il pulsante non funziona, copia questo indirizzo nel browser:<br><a href="${h}" style="color:${INK};word-break:break-all;">${h}</a>`,
    { muted: true, small: true },
  );
}

/** Cerchio con la spunta, per le email di conferma. */
export function emailCheckBadge(): string {
  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
    <tr><td width="44" height="44" align="center" valign="middle" bgcolor="#059669" style="width:44px;height:44px;border-radius:999px;font-family:${FONT};font-size:22px;font-weight:700;line-height:44px;color:#ffffff;">&#10003;</td></tr>
  </table>`;
}

/**
 * Pagina email completa. `bodyHtml` va composto con gli helper qui sopra
 * (o con HTML già sicuro). `preheader` è l'anteprima mostrata nella lista
 * delle email, sotto l'oggetto.
 */
export function emailLayout(opts: {
  senderName: string;
  eyebrow?: string;
  title: string;
  bodyHtml: string;
  preheader?: string;
  footerNote?: string;
  /** spunta verde sopra il titolo (email di conferma) */
  success?: boolean;
}): string {
  const sender = escapeEmailHtml(opts.senderName);
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeEmailHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:${PAGE};-webkit-text-size-adjust:100%;">
${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeEmailHtml(opts.preheader)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${PAGE}" style="background:${PAGE};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
      <tr><td style="padding:0 4px 16px;font-family:${FONT};font-size:15px;font-weight:600;letter-spacing:-.01em;color:${INK};">${sender}</td></tr>
      <tr><td bgcolor="#ffffff" style="background:#ffffff;border:1px solid ${LINE};border-radius:16px;padding:32px 28px 16px;">
        ${opts.success ? emailCheckBadge() : ""}
        ${opts.eyebrow ? `<div style="margin:0 0 6px;font-family:${FONT};font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:${SOFT};">${escapeEmailHtml(opts.eyebrow)}</div>` : ""}
        <h1 style="margin:0 0 16px;font-family:${FONT};font-size:22px;font-weight:600;line-height:1.3;letter-spacing:-.01em;color:${INK};">${escapeEmailHtml(opts.title)}</h1>
        ${opts.bodyHtml}
      </td></tr>
      <tr><td style="padding:16px 4px 0;font-family:${FONT};font-size:12px;line-height:1.5;color:${SOFT};">
        ${opts.footerNote ? `${escapeEmailHtml(opts.footerNote)}<br>` : ""}${sender}
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
