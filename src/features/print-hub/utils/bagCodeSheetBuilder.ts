import type { BagQrRow } from '../types';
import { buildCode128Svg } from './code128Svg';
import { escapeHtml } from './printDocumentHelper';
import { generateQrDataUrl } from './qrGenerator';

export const BAG_PRESET_ALL_COUNTERS: BagQrRow[] = [
  { code: '1156185000109', name: 'PHONE' },
  { code: '1156185000110', name: 'TABLET' },
  { code: '1156185000108', name: 'LAPTOP' },
  { code: '1156185000112', name: 'ĐỒ NHỎ' },
  { code: '1156185000113', name: 'ĐỒ TRUNG' },
  { code: '1156185000111', name: 'ĐỒ LỚN' },
  { code: '1156185000109', name: 'PHONE' },
  { code: '1156185000110', name: 'TABLET' },
  { code: '1156185000108', name: 'LAPTOP' },
  { code: '1156185000112', name: 'ĐỒ NHỎ' },
  { code: '1156185000113', name: 'ĐỒ TRUNG' },
  { code: '1156185000111', name: 'ĐỒ LỚN' },
];

export const BAG_PRESET_PHONE_LAPTOP: BagQrRow[] = [
  { code: '1156185000109', name: 'PHONE' },
  { code: '1156185000110', name: 'TABLET' },
  { code: '1156185000108', name: 'LAPTOP' },
  { code: '1156185000109', name: 'PHONE' },
  { code: '1156185000110', name: 'TABLET' },
  { code: '1156185000108', name: 'LAPTOP' },
  { code: '1156185000109', name: 'PHONE' },
  { code: '1156185000110', name: 'TABLET' },
  { code: '1156185000108', name: 'LAPTOP' },
  { code: '1156185000109', name: 'PHONE' },
  { code: '1156185000110', name: 'TABLET' },
  { code: '1156185000108', name: 'LAPTOP' },
];

interface NameTypography {
  fontSizePt: number;
  lineHeight: number;
  forceBreakAnywhere: boolean;
}

let measureCanvasCtx: CanvasRenderingContext2D | null | undefined;

function measureUpperWordWidthPx(text: string, fontSizePx: number): number {
  if (typeof document !== 'undefined') {
    if (measureCanvasCtx === undefined) {
      const canvas = document.createElement('canvas');
      measureCanvasCtx = canvas.getContext('2d');
    }
    if (measureCanvasCtx) {
      measureCanvasCtx.font = `700 ${fontSizePx}px "Montserrat", "Roboto", Arial, sans-serif`;
      // Hệ số an toàn 1.08 để không bao giờ bị cắt mép khi in hoặc chuyển font
      return measureCanvasCtx.measureText(text).width * 1.08;
    }
  }
  return text.length * fontSizePx * 0.85;
}

function splitBagNameLines(rawName: string): string[] {
  return String(rawName ?? '')
    .replace(/\r\n/g, '\n')
    .split(/\n|\|/)
    .map((line) => line.trim().toUpperCase().replace(/\s+/g, ' '))
    .filter(Boolean);
}

/**
 * Đo chính xác bề rộng chữ thực tế (Canvas measureText) để tự động co giãn cỡ chữ (pt)
 * cho tên sản phẩm vừa khít khung 116×82px bên cạnh mã QR:
 * - Hỗ trợ ngắt dòng chủ động bằng phím Enter (\n) hoặc dấu | (ví dụ: "ĐỒ | TRUNG").
 * - Tên ngắn: giữ cỡ chữ to rõ (17–18pt).
 * - Tên dài hoặc từ đơn dài: tự động thu nhỏ mượt xuống tới 7pt để không bị cắt chữ hay làm lệch cột.
 */
function computeBagNameTypography(manualLines: string[]): NameTypography {
  if (manualLines.length === 0) {
    return { fontSizePt: 18, lineHeight: 1.15, forceBreakAnywhere: false };
  }

  const maxBoxWidthPx = 116;
  const maxBoxHeightPx = 82;

  for (let sizePt = 18; sizePt >= 7; sizePt -= 0.5) {
    const px = sizePt * (96 / 72);
    const lineHeightRatio = sizePt >= 14 ? 1.15 : 1.12;
    const maxLines = Math.max(1, Math.floor(maxBoxHeightPx / (px * lineHeightRatio)));

    let hasWordTooWide = false;
    let totalLinesUsed = 0;

    for (const line of manualLines) {
      const words = line.split(' ');
      if (words.some((w) => measureUpperWordWidthPx(w, px) > maxBoxWidthPx)) {
        hasWordTooWide = true;
        break;
      }

      let lineWraps = 1;
      let currentLineText = '';
      for (const word of words) {
        const candidate = currentLineText ? `${currentLineText} ${word}` : word;
        if (!currentLineText || measureUpperWordWidthPx(candidate, px) <= maxBoxWidthPx) {
          currentLineText = candidate;
        } else {
          lineWraps += 1;
          currentLineText = word;
        }
      }
      totalLinesUsed += lineWraps;
    }

    if (hasWordTooWide) continue;

    // Thu nhẹ cỡ chữ khi có từ 3 dòng trở lên để chữ thoáng và cân đối
    if (totalLinesUsed <= maxLines && !(totalLinesUsed >= 3 && sizePt > 13)) {
      return {
        fontSizePt: sizePt,
        lineHeight: lineHeightRatio,
        forceBreakAnywhere: false,
      };
    }
  }

  return { fontSizePt: 7, lineHeight: 1.08, forceBreakAnywhere: true };
}

export async function renderBagCodeSheetHtml(rows: BagQrRow[]): Promise<string> {
  const uniqueCodes = [...new Set(rows.map((r) => r.code.trim()).filter(Boolean))];
  const qrEntries = await Promise.all(
    uniqueCodes.map(async (code) => [code, await generateQrDataUrl(code, 160)] as const)
  );
  const qrMap = Object.fromEntries(qrEntries);

  const numColumns = 3;
  const colWidthPct = `${(100 / numColumns).toFixed(4)}%`;
  const tableRows: string[] = [];

  for (let i = 0; i < rows.length; i += numColumns) {
    const tds: string[] = [];
    for (let j = 0; j < numColumns; j += 1) {
      const item = rows[i + j];
      if (!item) {
        tds.push(`<td style="width:${colWidthPct};box-sizing:border-box;overflow:hidden;"></td>`);
        continue;
      }
      const qrSrc = qrMap[item.code.trim()] || '';
      const barcodeSvg = buildCode128Svg(item.code.trim(), { height: 52, showText: true });
      const manualLines = splitBagNameLines(item.name);
      const typo = computeBagNameTypography(manualLines);
      const renderedNameHtml = manualLines.map((line) => escapeHtml(line)).join('<br />');
      const wrapRule = typo.forceBreakAnywhere
        ? 'overflow-wrap:anywhere;word-break:break-word;'
        : 'overflow-wrap:break-word;word-break:normal;';

      tds.push(`
        <td style="width:${colWidthPct};box-sizing:border-box;overflow:hidden;vertical-align:top;">
          <div class="product-code">${escapeHtml(item.code)}</div>
          <div class="qr-name-container" style="display:flex;align-items:center;gap:6px;width:100%;min-width:0;">
            <div class="qrcode-container" style="flex:0 0 74px;width:74px;display:flex;justify-content:center;align-items:center;">
              ${qrSrc ? `<img class="qrcode-img" src="${qrSrc}" alt="QR ${escapeHtml(item.code)}" style="width:72px;height:72px;object-fit:contain;display:block;" />` : ''}
            </div>
            <div class="product-name-container" style="flex:1 1 auto;min-width:0;height:86px;padding:0 2px;display:flex;justify-content:center;align-items:center;text-align:center;font-size:${typo.fontSizePt}pt;line-height:${typo.lineHeight};overflow:hidden;${wrapRule}"><span style="display:block;width:100%;max-width:100%;">${renderedNameHtml}</span></div>
          </div>
          <div class="barcode-container" style="width:100%;display:flex;justify-content:center;margin-top:5px;overflow:hidden;">
            <div class="barcode-img" style="width:100%;max-width:100%;overflow:hidden;">${barcodeSvg}</div>
          </div>
        </td>`);
    }
    tableRows.push(`<tr>${tds.join('')}</tr>`);
  }

  const colgroup = `<colgroup>${Array.from({ length: numColumns })
    .map(() => `<col style="width:${colWidthPct};" />`)
    .join('')}</colgroup>`;

  return `<div id="sal-bag-grid" style="width:94%;height:auto;"><table style="width:100%;table-layout:fixed;border-collapse:separate;border-spacing:10px;">${colgroup}<tbody>${tableRows.join('')}</tbody></table></div>`;
}
