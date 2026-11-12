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

export async function renderBagCodeSheetHtml(rows: BagQrRow[]): Promise<string> {
  const uniqueCodes = [...new Set(rows.map((r) => r.code.trim()).filter(Boolean))];
  const qrEntries = await Promise.all(
    uniqueCodes.map(async (code) => [code, await generateQrDataUrl(code, 160)] as const)
  );
  const qrMap = Object.fromEntries(qrEntries);

  const numColumns = 3;
  const tableRows: string[] = [];

  for (let i = 0; i < rows.length; i += numColumns) {
    const tds: string[] = [];
    for (let j = 0; j < numColumns; j += 1) {
      const item = rows[i + j];
      if (!item) {
        tds.push('<td></td>');
        continue;
      }
      const qrSrc = qrMap[item.code.trim()] || '';
      const barcodeSvg = buildCode128Svg(item.code.trim(), { height: 52, showText: true });
      tds.push(`
        <td>
          <div class="product-code">${escapeHtml(item.code)}</div>
          <div class="qr-name-container">
            <div class="qrcode-container">
              ${qrSrc ? `<img class="qrcode-img" src="${qrSrc}" alt="QR ${escapeHtml(item.code)}" />` : ''}
            </div>
            <div class="product-name-container">${escapeHtml(item.name.toUpperCase())}</div>
          </div>
          <div class="barcode-container">
            <div class="barcode-img">${barcodeSvg}</div>
          </div>
        </td>`);
    }
    tableRows.push(`<tr>${tds.join('')}</tr>`);
  }

  return `<div id="sal-bag-grid" style="width:94%;height:auto;"><table><tbody>${tableRows.join('')}</tbody></table></div>`;
}

