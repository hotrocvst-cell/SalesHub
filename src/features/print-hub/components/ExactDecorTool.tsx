import React from 'react';
import { DECOR_CEILING_FILES, DECOR_CUTOUT_GROUPS } from '../data/decorCatalog';

interface ExactDecorToolProps {
  toolId: string;
  ceilingVariant: number;
  cutoutGroup: 'hoa' | 'sao' | 'ong' | 'buom';
  cutoutVariant: number;
  copiesPerSheet: 1 | 2;
  onCeilingChange: (v: number) => void;
  onCutoutGroupChange: (g: 'hoa' | 'sao' | 'ong' | 'buom') => void;
  onCutoutVariantChange: (v: number) => void;
  onCopiesChange: (c: 1 | 2) => void;
}

const CUTOUT_TABS: Array<{ id: 'hoa' | 'sao' | 'ong' | 'buom'; label: string }> = [
  { id: 'hoa', label: 'Bông hoa (5)' },
  { id: 'sao', label: 'Ngôi sao (4)' },
  { id: 'ong', label: 'Chú Ong (7)' },
  { id: 'buom', label: 'Cánh Bướm (8)' },
];

export const ExactDecorTool: React.FC<ExactDecorToolProps> = ({
  toolId,
  ceilingVariant,
  cutoutGroup,
  cutoutVariant,
  copiesPerSheet,
  onCeilingChange,
  onCutoutGroupChange,
  onCutoutVariantChange,
  onCopiesChange,
}) => {
  const activeGroup = DECOR_CUTOUT_GROUPS[cutoutGroup] || DECOR_CUTOUT_GROUPS.hoa;

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
        <span className="text-xs font-bold text-slate-800">
          {toolId === 'dec_ceiling' ? 'Chọn dây treo trần (01–04)' : 'Chọn nhóm họa tiết cắt dán'}
        </span>
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          {([1, 2] as const).map((copies) => (
            <button
              key={copies}
              type="button"
              onClick={() => onCopiesChange(copies)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                copiesPerSheet === copies
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {copies === 1 ? '1 bản nguyên trang' : '2 bản nhỏ / trang'}
            </button>
          ))}
        </div>
      </div>

      {toolId === 'dec_ceiling' ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {DECOR_CEILING_FILES.map((item) => (
            <button
              key={item.variant}
              type="button"
              onClick={() => onCeilingChange(item.variant)}
              className={`flex flex-col items-center gap-1 rounded-xl border p-2 text-xs font-semibold transition ${
                ceilingVariant === item.variant
                  ? 'border-blue-600 bg-blue-50 text-blue-900 ring-2 ring-blue-600/20'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <div className="flex h-16 w-full items-center justify-center overflow-hidden rounded bg-white p-1">
                <img src={item.src} alt={item.label} className="max-h-full max-w-full object-contain" />
              </div>
              <span>Mẫu 0{item.variant}</span>
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {CUTOUT_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  onCutoutGroupChange(tab.id);
                  onCutoutVariantChange(1);
                }}
                className={`rounded-lg border py-1.5 text-xs font-bold transition ${
                  cutoutGroup === tab.id
                    ? 'border-blue-700 bg-blue-700 text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
            {activeGroup.files.map((item) => (
              <button
                key={item.num}
                type="button"
                onClick={() => onCutoutVariantChange(item.num)}
                className={`flex flex-col items-center gap-1 rounded-xl border p-1.5 text-[11px] font-semibold transition ${
                  cutoutVariant === item.num
                    ? 'border-blue-600 bg-blue-50 text-blue-900 ring-2 ring-blue-600/20'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <div className="flex h-12 w-full items-center justify-center overflow-hidden rounded bg-white p-0.5">
                  <img
                    src={item.src}
                    alt={`${activeGroup.label} ${item.num}`}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <span>0{item.num}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

