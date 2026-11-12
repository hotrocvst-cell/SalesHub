import type { PrintPresetPayload } from '../types';
import { escapeHtml } from './printDocumentHelper';

export interface BatchFieldSlot {
  slotIdx: number;
  label: string;
  value: string;
}

export function injectStorePlaceholders(
  rawHtml: string,
  storeShort: string,
  storeFull: string
): string {
  const safeShort = escapeHtml(storeShort || 'CỬA HÀNG ST');
  const safeFull = escapeHtml(storeFull || 'CỬA HÀNG ST');
  return rawHtml
    .replace(/\{\{STORE_SHORT\}\}/g, safeShort)
    .replace(/\{\{STORE_NAME\}\}/g, safeFull);
}

export function hydrateInteractivePaper(paperEl: HTMLElement): () => void {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = String(now.getFullYear());
  const dateText = `ÁP DỤNG: ${dd}/${mm}/${yyyy}`;

  const dateInputs = paperEl.querySelectorAll<HTMLInputElement>('input[id^="datenow"]');
  dateInputs.forEach((inp) => {
    if (!inp.value) inp.value = dateText;
  });

  const timeFields: Array<[string, string]> = [
    ['HourNow', String(now.getHours()).padStart(2, '0')],
    ['MinuteNow', String(now.getMinutes()).padStart(2, '0')],
    ['DayNow', dd],
    ['MonthNow', mm],
    ['YearNow', yyyy],
  ];
  timeFields.forEach(([id, val]) => {
    const el = paperEl.querySelector<HTMLInputElement>(`#${id}`);
    if (el && !el.value) el.value = val;
  });

  // Đồng bộ chữ ký Bên A / Bên B trên Biên bản nhận hàng
  const cleanups: Array<() => void> = [];
  (['a', 'b'] as const).forEach((side) => {
    const src = paperEl.querySelector<HTMLInputElement>(`[data-rep-input="${side}"]`);
    const dst = paperEl.querySelector<HTMLElement>(`[data-rep-sign="${side}"]`);
    if (src && dst) {
      const handler = () => {
        dst.textContent = src.value;
      };
      src.addEventListener('input', handler);
      cleanups.push(() => src.removeEventListener('input', handler));
    }
  });

  return () => {
    cleanups.forEach((fn) => fn());
  };
}

function getCardContainers(paperContentEl: HTMLElement): HTMLElement[] {
  const children = Array.from(paperContentEl.children).filter(
    (el): el is HTMLElement => el instanceof HTMLElement && el.querySelectorAll('input[type="text"]').length > 0
  );
  return children;
}

function inferFieldLabel(inputEl: HTMLInputElement, fallbackIdx: number): string {
  const cls = inputEl.className || '';
  if (/\btsp\b/.test(cls)) return 'Tên sản phẩm';
  if (/\bgoc\b|\bgg\b|\bggh\b/.test(cls)) return 'Giá gốc / Giá gạch';
  if (/\bgiam\b|\bgc\b|\bggg\b/.test(cls)) return 'Giá sau giảm / Mức giảm';
  if (/\bptg\b/.test(cls) || inputEl.parentElement?.classList.contains('ptg')) return 'Phần trăm (%)';
  if (/\bim\b|\bimore\b|\bpdat\b|\bprtdate\b|\bdt\b/.test(cls) || inputEl.id.startsWith('datenow')) {
    return 'Thời gian / Ghi chú';
  }
  if (/\btt\b/.test(cls)) return 'Trả trước';
  if (/\btit\b/.test(cls)) return 'Tiêu đề';
  if (/\bsubtit\b/.test(cls)) return 'Đơn vị ST';
  if (/\bnbp\b/.test(cls)) return 'Số Hotline';
  if (/\bhdf\b/.test(cls)) return 'Tiêu đề chính';
  if (/\bn\b/.test(cls)) return 'Tên nhân viên';
  if (/\bv\b/.test(cls)) return 'Bộ phận';
  if (/\bgia\b/.test(cls)) return 'Giá gói';
  if (/\bthang\b/.test(cls)) return 'Thời hạn';
  return `Ô nhập #${fallbackIdx + 1}`;
}

export function extractBatchFields(
  paperContentEl: HTMLElement,
  rel: string
): { slots: BatchFieldSlot[]; cardCount: number } {
  // Không gom batch đối với biên bản nhận hàng (mỗi ô là 1 trường riêng biệt)
  if (rel.includes('in-bb-nhan-hang') || rel.includes('in-code-tui')) {
    return { slots: [], cardCount: 0 };
  }

  const cards = getCardContainers(paperContentEl);
  if (cards.length === 0) return { slots: [], cardCount: 0 };

  const firstCardInputs = Array.from(cards[0].querySelectorAll<HTMLInputElement>('input[type="text"]'));
  if (firstCardInputs.length === 0) return { slots: [], cardCount: cards.length };

  const slots: BatchFieldSlot[] = firstCardInputs.map((inp, idx) => ({
    slotIdx: idx,
    label: inferFieldLabel(inp, idx),
    value: inp.value,
  }));

  return { slots, cardCount: cards.length };
}

export function applyBatchFieldToCards(
  paperContentEl: HTMLElement,
  slotIdx: number,
  nextVal: string,
  syncAllCards: boolean
): void {
  const cards = getCardContainers(paperContentEl);
  cards.forEach((card, cardIndex) => {
    if (!syncAllCards && cardIndex > 0) return;
    const inputs = card.querySelectorAll<HTMLInputElement>('input[type="text"]');
    const target = inputs[slotIdx];
    if (target) target.value = nextVal;
  });
}

export function captureSnapshotFromPaper(
  paperContentEl: HTMLElement,
  base: PrintPresetPayload
): PrintPresetPayload {
  const inputValues = Array.from(paperContentEl.querySelectorAll<HTMLInputElement>('input[type="text"]')).map(
    (el) => el.value
  );
  const checkboxStates = Array.from(paperContentEl.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).map(
    (el) => el.checked
  );
  const editableHtmls = Array.from(paperContentEl.querySelectorAll<HTMLElement>('[contenteditable="true"]')).map(
    (el) => el.innerHTML
  );
  return {
    ...base,
    inputValues,
    checkboxStates,
    editableHtmls,
  };
}

export function applySnapshotToPaper(
  paperContentEl: HTMLElement,
  payload: PrintPresetPayload
): void {
  if (payload.inputValues) {
    const inputs = paperContentEl.querySelectorAll<HTMLInputElement>('input[type="text"]');
    inputs.forEach((el, idx) => {
      if (payload.inputValues && idx < payload.inputValues.length) {
        el.value = payload.inputValues[idx];
      }
    });
  }
  if (payload.checkboxStates) {
    const boxes = paperContentEl.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    boxes.forEach((el, idx) => {
      if (payload.checkboxStates && idx < payload.checkboxStates.length) {
        el.checked = Boolean(payload.checkboxStates[idx]);
      }
    });
  }
  if (payload.editableHtmls) {
    const editables = paperContentEl.querySelectorAll<HTMLElement>('[contenteditable="true"]');
    editables.forEach((el, idx) => {
      if (payload.editableHtmls && idx < payload.editableHtmls.length) {
        el.innerHTML = payload.editableHtmls[idx];
      }
    });
  }
}

export function serializePaperForPrint(paperEl: HTMLElement): string {
  const clone = paperEl.cloneNode(true) as HTMLElement;
  clone.style.transform = 'none';

  const origInputs = paperEl.querySelectorAll<HTMLInputElement>('input');
  const cloneInputs = clone.querySelectorAll<HTMLInputElement>('input');
  origInputs.forEach((orig, idx) => {
    const cl = cloneInputs[idx];
    if (!cl) return;
    if (orig.type === 'checkbox' || orig.type === 'radio') {
      if (orig.checked) cl.setAttribute('checked', 'checked');
      else cl.removeAttribute('checked');
    } else {
      cl.setAttribute('value', orig.value);
    }
  });

  clone.querySelectorAll('[contenteditable="true"]').forEach((el) => {
    el.removeAttribute('contenteditable');
  });

  return clone.outerHTML;
}

