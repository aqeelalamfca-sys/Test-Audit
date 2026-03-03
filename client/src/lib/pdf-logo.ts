export const PDF_LOGO_WIDTH = 130;

export function getPdfLogoHtml(logoUrl: string | null | undefined): string {
  if (!logoUrl) return "";
  return `<div style="margin-bottom: 12px;"><img src="${logoUrl}" style="width: ${PDF_LOGO_WIDTH}px; height: auto; object-fit: contain;" crossorigin="anonymous" /></div>`;
}
