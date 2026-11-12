import React, { useState } from 'react';
import { BookmarkPlus, Check, Loader2, Trash2 } from 'lucide-react';
import type { PrintPresetRecord } from '../types';

interface PrintPresetBarProps {
  presets: PrintPresetRecord[];
  activePresetId: string | null;
  saving: boolean;
  onSavePreset: (presetName: string) => Promise<void>;
  onApplyPreset: (preset: PrintPresetRecord) => void;
  onDeletePreset: (preset: PrintPresetRecord) => Promise<void>;
}

export const PrintPresetBar: React.FC<PrintPresetBarProps> = ({
  presets,
  activePresetId,
  saving,
  onSavePreset,
  onApplyPreset,
  onDeletePreset,
}) => {
  const [nameInput, setNameInput] = useState('');
  const [justSaved, setJustSaved] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    await onSavePreset(trimmed);
    setNameInput('');
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1800);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <form onSubmit={handleSave} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="sr-only" htmlFor="print-preset-name-input">
          Tên mẫu cấu hình in của ST
        </label>
        <input
          id="print-preset-name-input"
          type="text"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder="Đặt tên để lưu cấu hình in này cho ST..."
          className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
        />
        <button
          type="submit"
          disabled={saving || !nameInput.trim()}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : justSaved ? (
            <Check className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          ) : (
            <BookmarkPlus className="h-4 w-4" aria-hidden="true" />
          )}
          <span>{justSaved ? 'Đã lưu Cloud' : 'Lưu mẫu ST'}</span>
        </button>
      </form>

      {presets.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-slate-600">Mẫu đã lưu:</span>
          {presets.map((preset) => {
            const isActive = activePresetId === preset.id;
            return (
              <div
                key={preset.id}
                className={`inline-flex items-center overflow-hidden rounded-lg border text-xs transition ${
                  isActive
                    ? 'border-blue-600 bg-blue-50 text-blue-900'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onApplyPreset(preset)}
                  className="px-2.5 py-1.5 font-medium"
                  title={`Nạp mẫu "${preset.preset_name}" (${preset.paper_size})`}
                >
                  {preset.preset_name}
                  <span className="ml-1 text-[11px] font-normal text-slate-500">
                    ({preset.paper_size})
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void onDeletePreset(preset)}
                  aria-label={`Xóa mẫu ${preset.preset_name}`}
                  className="border-l border-slate-200 px-1.5 py-1.5 text-slate-500 transition hover:bg-rose-50 hover:text-rose-700"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
