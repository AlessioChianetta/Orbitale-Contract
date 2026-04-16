import { z } from "zod";

export const modularSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  content: z.string(),
  defaultEnabled: z.boolean().default(true),
  required: z.boolean().default(false),
  order: z.number().int().optional().default(0),
});
export type ModularSection = z.infer<typeof modularSectionSchema>;

export const modularSectionsArraySchema = z.array(modularSectionSchema);

export function parseSections(raw: unknown): ModularSection[] {
  if (!Array.isArray(raw)) return [];
  const result: ModularSection[] = [];
  for (const item of raw) {
    const parsed = modularSectionSchema.safeParse(item);
    if (parsed.success) result.push(parsed.data);
  }
  return result.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function parseSelectedIds(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  return raw.filter((v): v is string => typeof v === "string");
}

export function defaultSelectedIds(sections: ModularSection[]): string[] {
  return sections.filter((s) => s.defaultEnabled || s.required).map((s) => s.id);
}

export function resolveSelectedSections(
  templateSections: unknown,
  selectedIds: unknown,
): ModularSection[] {
  const sections = parseSections(templateSections);
  if (sections.length === 0) return [];
  const ids = parseSelectedIds(selectedIds);
  if (ids === null) {
    return sections.filter((s) => s.defaultEnabled || s.required);
  }
  const idSet = new Set(ids);
  return sections.filter((s) => s.required || idSet.has(s.id));
}

export function renderSectionsHtml(sections: ModularSection[]): string {
  if (sections.length === 0) return "";
  const body = sections
    .map(
      (s) => `
<section class="modular-section" data-section-id="${escapeHtml(s.id)}">
  <h3 style="font-size: 14pt; font-weight: 700; color: #0f172a; margin: 18px 0 10px 0;">${escapeHtml(s.title)}</h3>
  <div class="modular-section-content" style="font-size: 10pt; color: #334155; line-height: 1.65;">${s.content || ""}</div>
</section>`,
    )
    .join("\n");
  return `<div class="modular-sections">${body}</div>`;
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const SECTIONS_MARKER = "<!-- BLOCK:SECTIONS -->";
