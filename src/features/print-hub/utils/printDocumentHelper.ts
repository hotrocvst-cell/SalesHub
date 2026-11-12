import html2canvas from 'html2canvas';
import type { PaperSize } from '../types';

export function escapeHtml(raw: string): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const PRINT_FONTS_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Bai+Jamjuree:wght@400;600;700&family=Montserrat:wght@400;600;700;800;900&display=swap');
@font-face {
  font-family: 'UTM-Colossalis';
  src: url('/print-assets/fonts/UTM-Colossalis.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
}
@font-face {
  font-family: 'mt2-font';
  src: url('/print-assets/fonts/mt2-font.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
}
@font-face {
  font-family: 'mt2-mincap';
  src: url('/print-assets/fonts/mt2-mincap.woff2') format('woff2');
  font-weight: normal;
  font-style: normal;
}
`;

export function buildStandalonePrintHtml(
  paperOuterHtml: string,
  scopedCss: string,
  paperSize: PaperSize
): string {
  const pageDims = paperSize === 'A5' ? '148mm 210mm' : '210mm 297mm';

  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>SalesHub - Tài liệu in</title>
<style>
  ${PRINT_FONTS_CSS}
  @page {
    size: ${pageDims};
    margin: 0;
  }
  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #000000;
  }
  #sal-print-paper {
    width: 780px;
    min-height: 1100px;
    background: #ffffff;
    color: #000000;
    margin: 0 auto;
    position: relative;
    ${paperSize === 'A5' ? 'transform: scale(0.716); transform-origin: top left;' : ''}
  }
  #sal-print-paper .paper_content {
    width: 738px;
    margin: 0 auto;
    padding-top: 20px;
  }
  #sal-print-paper input[type="text"],
  #sal-print-paper [contenteditable="true"] {
    outline: none !important;
    background-color: transparent !important;
  }
  ${scopedCss}
</style>
</head>
<body>
  ${paperOuterHtml}
</body>
</html>`;
}

async function waitForPrintDocumentReady(doc: Document): Promise<void> {
  const images = Array.from(doc.querySelectorAll('img'));
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
          setTimeout(done, 3000);
        })
    )
  );
  if (doc.fonts && doc.fonts.ready) {
    try {
      await Promise.race([doc.fonts.ready, new Promise((r) => setTimeout(r, 2000))]);
    } catch {
      // Tiếp tục in dù font API không khả dụng
    }
  }
}

export async function printExactPaperViaIframe(
  paperOuterHtml: string,
  scopedCss: string,
  paperSize: PaperSize
): Promise<void> {
  const fullHtml = buildStandalonePrintHtml(paperOuterHtml, scopedCss, paperSize);
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    throw new Error('Không khởi tạo được khung in trình duyệt.');
  }

  iframeDoc.open();
  iframeDoc.write(fullHtml);
  iframeDoc.close();

  await waitForPrintDocumentReady(iframeDoc);
  await new Promise((r) => setTimeout(r, 150));

  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();

  setTimeout(() => {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
  }, 1500);
}

export async function exportPrintSheetToPng(
  element: HTMLElement,
  fileNameBase: string
): Promise<void> {
  // Quy tắc GEMINI.md #2: Không giới hạn chiều dài, tuyệt đối không chèn Footer Watermark
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    onclone: (clonedDoc, clonedElement) => {
      clonedDoc.documentElement.style.height = 'auto';
      clonedDoc.body.style.height = 'auto';
      const parent = clonedElement.parentElement;
      if (parent) {
        parent.style.width = 'auto';
        parent.style.height = 'auto';
        parent.style.maxHeight = 'none';
        parent.style.overflow = 'visible';
      }
      clonedElement.style.height = 'auto';
      clonedElement.style.maxHeight = 'none';
      clonedElement.style.overflow = 'visible';
      clonedElement.style.transform = 'none';
    },
  });

  const url = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileNameBase.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
