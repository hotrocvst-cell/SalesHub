import React from 'react';
import { CopyCheck, Layers, Plus, Trash2, Users } from 'lucide-react';
import type { BagQrRow } from '../types';
import {
  BAG_PRESET_ALL_COUNTERS,
  BAG_PRESET_PHONE_LAPTOP,
} from '../utils/bagCodeSheetBuilder';
import type { BatchFieldSlot } from '../utils/exactSheetEngine';

interface QuickBatchFillBarProps {
  toolId: string;
  cardCount: number;
  slots: BatchFieldSlot[];
  syncAllCards: boolean;
  onToggleSyncAll: () => void;
  onSlotChange: (slotIdx: number, nextValue: string) => void;
  storeEmployeeCount: number;
  onLoadStoreEmployees: () => void;
  bagRows: BagQrRow[];
  onBagRowsChange: (next: BagQrRow[]) => void;
}

export const QuickBatchFillBar: React.FC<QuickBatchFillBarProps> = ({
  toolId,
  cardCount,
  slots,
  syncAllCards,
  onToggleSyncAll,
  onSlotChange,
  storeEmployeeCount,
  onLoadStoreEmployees,
  bagRows,
  onBagRowsChange,
}) => {
  if (toolId === 'wrk_codetui') {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onBagRowsChange([...BAG_PRESET_ALL_COUNTERS])}
              className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100"
            >
              Bộ đầy đủ (6 loại túi POS x 2)
            </button>
            <button
              type="button"
              onClick={() => onBagRowsChange([...BAG_PRESET_PHONE_LAPTOP])}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Bộ Phone / Tablet / Laptop x 4
            </button>
          </div>
          <button
            type="button"
            onClick={() =>
              onBagRowsChange([...bagRows, { code: '1156185000109', name: 'TÚI MỚI' }])
            }
            className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Thêm ô ({bagRows.length})</span>
          </button>
        </div>

        <div className="mt-2.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
          {bagRows.map((row, idx) => (
            <div key={idx} className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1.5">
              <input
                type="text"
                value={row.code}
                onChange={(e) => {
                  const next = [...bagRows];
                  next[idx] = { ...next[idx], code: e.target.value };
                  onBagRowsChange(next);
                }}
                placeholder="Mã SKU"
                className="w-28 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-slate-900"
              />
              <input
                type="text"
                value={row.name}
                onChange={(e) => {
                  const next = [...bagRows];
                  next[idx] = { ...next[idx], name: e.target.value };
                  onBagRowsChange(next);
                }}
                placeholder="Tên túi"
                className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-900"
              />
              <button
                type="button"
                aria-label="Xóa mã túi"
                onClick={() => onBagRowsChange(bagRows.filter((_, i) => i !== idx))}
                className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (slots.length === 0 && toolId !== 'wrk_bangten') {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-700">
        {toolId === 'wrk_bienban'
          ? 'Đã tự động điền giờ/ngày hiện tại và ST (Bên B). Bấm trực tiếp vào các dòng gạch chấm trên biên bản để điền thông tin và ký tên đồng bộ.'
          : 'Mẫu này có thể bấm trực tiếp lên nội dung trên tờ giấy để chỉnh sửa trước khi bấm In Ngay.'}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
        <div className="text-xs font-bold text-slate-800">
          Điền nhanh trên khung in ({cardCount} ô/trang)
          <span className="ml-1.5 font-normal text-slate-500">
            — Hoặc bấm trực tiếp vào từng ô trên tờ giấy bên dưới
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {toolId === 'wrk_bangten' && (
            <button
              type="button"
              disabled={storeEmployeeCount === 0}
              onClick={onLoadStoreEmployees}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Nạp NV danh bạ ST ({storeEmployeeCount})</span>
            </button>
          )}

          {cardCount > 1 && (
            <button
              type="button"
              onClick={onToggleSyncAll}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                syncAllCards
                  ? 'border-blue-600 bg-blue-50 text-blue-800'
                  : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              {syncAllCards ? (
                <CopyCheck className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Layers className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>{syncAllCards ? 'Đang đồng bộ cả trang' : 'Chỉ sửa ô đầu'}</span>
            </button>
          )}
        </div>
      </div>

      {slots.length > 0 && (
        <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {slots.map((slot) => (
            <div key={slot.slotIdx}>
              <label className="mb-0.5 block text-[11px] font-semibold text-slate-600">
                {slot.label}
              </label>
              <input
                type="text"
                value={slot.value}
                onChange={(e) => onSlotChange(slot.slotIdx, e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

