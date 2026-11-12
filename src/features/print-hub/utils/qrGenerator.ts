import QRCode from 'qrcode';

export async function generateQrDataUrl(text: string, size = 160): Promise<string> {
  const payload = (text || 'SALESHUB').trim();
  try {
    return await QRCode.toDataURL(payload, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    });
  } catch {
    return '';
  }
}

