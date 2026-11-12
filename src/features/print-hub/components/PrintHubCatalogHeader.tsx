import React, { useMemo } from 'react';
import {
  Briefcase,
  FileText,
  Flower2,
  LayoutGrid,
  Printer,
  Search,
  Store,
  Tag,
} from 'lucide-react';
import { formatStoreDisplayName } from '../../../core/lib/formatters';
import type { StoreItem } from '../../../core/lib/storage';
import { PRINT_CATEGORIES, PRINT_TOOLS_CATALOG } from '../data/printCatalog';
import type { PaperSize, PrintCategoryKey, PrintToolMeta } from '../types';

const CATEGORY_ICONS: Record<PrintCategoryKey, React.FC<{ className?: string }>> = {
  sticker: Tag,
  popup: LayoutGrid,
  sales: FileText,
  work: Briefcase,
  decor: Flower2,
};

interface PrintHubCatalogHeaderProps {
  selectedStore: string;
  onStoreChange: (s: string) => void;
  allowedStores: StoreItem[];
  isLockedToSingleStore: boolean;
  canViewAllStores: boolean;
  activeCategory: PrintCategoryKey;
  activeTool: PrintToolMeta;
  activeVariantRel: string;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelectTool: (id: string) => void;
  onSelectVariant: (rel: string, paperSize?: PaperSize) => void;
}

export const PrintHubCatalogHeader: React.FC<PrintHubCatalogHeaderProps> = ({
  selectedStore,
  onStoreChange,
  allowedStores,
  isLockedToSingleStore,
  canViewAllStores,
  activeCategory,
  activeTool,
  activeVariantRel,
  searchQuery,
  onSearchChange,
  onSelectTool,
  onSelectVariant,
}) => {
  const filteredTools = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      return PRINT_TOOLS_CATALOG.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.shortDesc.toLowerCase().includes(q) ||
          t.variants.some((v) => v.label.toLowerCase().includes(q))
      );
    }
    return PRINT_TOOLS_CATALOG.filter((t) => t.category === activeCategory);
  }, [activeCategory, searchQuery]);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex flex-1 items-center gap-2 sm:max-w-sm">
          <label
            htmlFor="print-hub-store-select"
            className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold text-slate-700"
          >
            <Store className="h-4 w-4 text-blue-700" aria-hidden="true" />
            <span>ST áp dụng:</span>
          </label>
          <select
            id="print-hub-store-select"
            value={selectedStore}
            disabled={isLockedToSingleStore}
            onChange={(e) => onStoreChange(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-sm font-semibold text-slate-900 focus:border-blue-600 focus:bg-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-75"
          >
            {canViewAllStores && <option value="all">Toàn Cụm ST</option>}
            {allowedStores.map((st) => (
              <option key={st.id || st.name} value={st.name}>
                {formatStoreDisplayName(st.name)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-600">
          <Printer className="h-4 w-4 text-slate-500" aria-hidden="true" />
          <span className="font-semibold text-slate-800">
            In Ấn Quầy ST — Chuẩn kích thước gốc
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {PRINT_CATEGORIES.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.key];
            const isActive = !searchQuery && activeCategory === cat.key;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => {
                  onSearchChange('');
                  const first = PRINT_TOOLS_CATALOG.find((t) => t.category === cat.key);
                  if (first) onSelectTool(first.id);
                }}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                  isActive
                    ? 'border-blue-700 bg-blue-700 text-white shadow-sm'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full lg:w-64">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Tìm mẫu in (6s, máy lạnh, biên bản...)"
            className="w-full rounded-lg border border-slate-300 bg-slate-50 py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {filteredTools.map((tool) => {
          const active = activeTool.id === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => onSelectTool(tool.id)}
              className={`rounded-xl border p-2.5 text-left transition ${
                active
                  ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-600/20'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-900">{tool.name}</span>
                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                  {tool.variants.length} mẫu
                </span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-600">
                {tool.shortDesc}
              </p>
            </button>
          );
        })}
      </div>

      {activeTool.variants.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2.5">
          <span className="text-xs font-bold text-slate-700">Biến thể gốc:</span>
          {activeTool.variants.map((v) => {
            const isSelected = activeVariantRel === v.rel;
            return (
              <button
                key={v.rel}
                type="button"
                onClick={() => onSelectVariant(v.rel, v.paperSize)}
                className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                  isSelected
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {v.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

