export const PDF_LOGO_WIDTH = 130;
export const PDF_LOGO_STYLE = `width: ${PDF_LOGO_WIDTH}px; height: auto; object-fit: contain;`;

export async function logoToBase64(logoUrl: string): Promise<string | null> {
  try {
    const response = await fetch(logoUrl);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function getDocumentHeaderHtml(
  logoUrl: string | null | undefined,
  firmName?: string | null
): Promise<string> {
  let logoHtml = "";
  if (logoUrl) {
    const base64 = await logoToBase64(logoUrl);
    const src = base64 || logoUrl;
    logoHtml = `<img src="${src}" style="${PDF_LOGO_STYLE}" />`;
  }
  const nameHtml = firmName
    ? `<h1 style="color: #1a365d; margin: 0; font-size: 24px;">${firmName}</h1>`
    : `<h1 style="color: #1a365d; margin: 0; font-size: 24px;">AuditWise</h1>`;

  return `
    <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 8px;">
      ${logoHtml}
      <div>
        ${nameHtml}
        <p style="color: #666; margin: 2px 0 0 0; font-size: 12px;">Statutory Audit Management</p>
      </div>
    </div>
  `.trim();
}
