import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Download, Loader2, Printer, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import type { EmployeeItem } from '../../../core/lib/storage';
import type { PaperSize, PrintPresetPayload } from '../types';
import {
  applyBatchFieldToCards,
  applySnapshotToPaper,
  captureSnapshotFromPaper,
  extractBatchFields,
  hydrateInteractivePaper,
  serializePaperForPrint,
  type BatchFieldSlot,
} from '../utils/exactSheetEngine';
import {
  exportPrintSheetToPng,
  printExactPaperViaIframe,
} from '../utils/printDocumentHelper';

export interface ExactPaperHandle {
  captureSnapshot: (base: PrintPresetPayload) => PrintPresetPayload;
  applySnapshot: (payload: PrintPresetPayload) => void;
  fillEmployees: (employees: EmployeeItem[]) => void;
  applyBatchSlot: (slotIdx: number, value: string, syncAll: boolean) => void;
}

interface ExactPaperWorkspaceProps {
  title: string;
  variantRel: string;
  scopedCss: string;
  renderedHtml: string;
  paperSize: PaperSize;
  onPaperSizeChange: (size: PaperSize) => void;
  resetCounter: number;
  onResetDefault: () => void;
  fileNameBase: string;
  onBatchStateReady: (slots: BatchFieldSlot[], cardCount: number) => void;
  topControlsSlot?: React.ReactNode;
}

export const ExactPaperWorkspace = React.forwardRef<
  ExactPaperHandle,
  ExactPaperWorkspaceProps
>(
  (
    {
      title,
      variantRel,
      scopedCss,
      renderedHtml,
      paperSize,
      onPaperSizeChange,
      resetCounter,
      onResetDefault,
      fileNameBase,
      onBatchStateReady,
      topControlsSlot,
    },
    ref
  ) => {
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const paperRef = useRef<HTMLDivElement | null>(null);
    const paperContentRef = useRef<HTMLDivElement | null>(null);

    const [fitScale, setFitScale] = useState(0.5);
    const [sheetHeight, setSheetHeight] = useState(1100);
    const [manualZoom, setManualZoom] = useState<number | null>(null);
    const [printing, setPrinting] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    const naturalWidth = 780;
    const naturalHeight = sheetHeight;

    useEffect(() => {
      const el = viewportRef.current;
      if (!el) return;
      const update = () => {
        const available = Math.max(280, el.clientWidth - 20);
        const ratio = Math.min(1, Number((available / naturalWidth).toFixed(3)));
        setFitScale(ratio);
      };
      update();
      const observer = new ResizeObserver(update);
      observer.observe(el);
      return () => observer.disconnect();
    }, []);

    useEffect(() => {
      const container = paperContentRef.current;
      if (!container) return;
      container.innerHTML = renderedHtml;

      const cleanupFns = hydrateInteractivePaper(container);
      const { slots, cardCount } = extractBatchFields(container, variantRel);
      onBatchStateReady(slots, cardCount);
      setSheetHeight(Math.max(1100, paperRef.current?.scrollHeight || 1100));

      return cleanupFns;
    }, [renderedHtml, variantRel, resetCounter, onBatchStateReady]);

    useImperativeHandle(ref, () => ({
      captureSnapshot: (base: PrintPresetPayload) => {
        if (!paperContentRef.current) return base;
        return captureSnapshotFromPaper(paperContentRef.current, base);
      },
      applySnapshot: (payload: PrintPresetPayload) => {
        if (!paperContentRef.current) return;
        applySnapshotToPaper(paperContentRef.current, payload);
        const { slots, cardCount } = extractBatchFields(paperContentRef.current, variantRel);
        onBatchStateReady(slots, cardCount);
      },
      fillEmployees: (emps: EmployeeItem[]) => {
        const container = paperContentRef.current;
        if (!container || emps.length === 0) return;
        const cards = Array.from(container.children);
        cards.forEach((card, idx) => {
          const emp = emps[idx];
          if (!emp) return;
          const nameInput = card.querySelector<HTMLInputElement>('input.n');
          const roleInput = card.querySelector<HTMLInputElement>('input.v');
          if (nameInput) nameInput.value = emp.full_name;
          if (roleInput) roleInput.value = emp.job_title || emp.department || 'Nhân viên ST';
        });
        const { slots, cardCount } = extractBatchFields(container, variantRel);
        onBatchStateReady(slots, cardCount);
      },
      applyBatchSlot: (slotIdx: number, value: string, syncAll: boolean) => {
        if (!paperContentRef.current) return;
        applyBatchFieldToCards(paperContentRef.current, slotIdx, value, syncAll);
      },
    }));

    const effectiveScale = manualZoom ?? fitScale;
    const scaledWidth = Math.round(naturalWidth * effectiveScale);
    const scaledHeight = Math.round(naturalHeight * effectiveScale);

    const handlePrint = async () => {
      if (!paperRef.current) return;
      setPrinting(true);
      setErrorMsg(null);
      try {
        const paperOuterHtml = serializePaperForPrint(paperRef.current);
        await printExactPaperViaIframe(paperOuterHtml, scopedCss, paperSize);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Không thể mở hộp thoại in.');
      } finally {
        setPrinting(false);
      }
    };

    const handleExportPng = async () => {
      if (!paperRef.current) return;
      setExporting(true);
      setErrorMsg(null);
      try {
        await exportPrintSheetToPng(paperRef.current, `${fileNameBase}_${paperSize}`);
      } catch {
        setErrorMsg('Không thể xuất ảnh PNG.');
      } finally {
        setExporting(false);
      }
    };

    return (
      <div className="flex flex-col gap-3">
        {scopedCss && <style>{scopedCss}</style>}
        {topControlsSlot}

        <div className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">
                Khung in chuẩn 780x1100 ({paperSize})
              </h3>
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                {(['A4', 'A5'] as PaperSize[]).map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => onPaperSizeChange(sz)}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                      paperSize === sz
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setManualZoom((prev) => (prev === null ? 1 : null))
                }
                aria-label={manualZoom ? 'Thu vừa màn hình' : 'Xem kích thước thật 100%'}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                {manualZoom ? (
                  <ZoomOut className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span className="hidden sm:inline">{manualZoom ? 'Vừa khung' : 'Zoom 100%'}</span>
              </button>

              <button
                type="button"
                onClick={onResetDefault}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                title="Khôi phục nguyên bản"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Gốc</span>
              </button>

              <button
                type="button"
                onClick={() => void handleExportPng()}
                disabled={exporting}
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-50"
              >
                {exporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>Tải PNG</span>
              </button>

              <button
                type="button"
                onClick={() => void handlePrint()}
                disabled={printing}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50"
              >
                {printing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>In Ngay</span>
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {errorMsg}
            </div>
          )}

          <div
            ref={viewportRef}
            className="w-full overflow-x-auto rounded-lg border border-slate-200 bg-slate-100 p-2 sm:p-4"
            aria-label={`Bản xem trước ${title}`}
          >
            <div
              className="mx-auto overflow-hidden border border-slate-300 bg-white shadow-md"
              style={{ width: `${scaledWidth}px`, height: `${scaledHeight}px` }}
            >
              <div
                id="sal-print-paper"
                ref={paperRef}
                style={{
                  transform: `scale(${effectiveScale})`,
                  transformOrigin: 'top left',
                }}
              >
                <div ref={paperContentRef} className="paper_content" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);
ExactPaperWorkspace.displayName = 'ExactPaperWorkspace';
