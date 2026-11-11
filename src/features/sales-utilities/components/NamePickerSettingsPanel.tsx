import React from 'react';
import { Sparkles, Users, Save } from 'lucide-react';
import type { NamePickerConfig } from '../types';

interface Props {
    config: NamePickerConfig;
    storeLabel: string;
    storeEmployeesCount: number;
    onChangeConfig: (next: NamePickerConfig) => void;
    onSaveConfig: (next: NamePickerConfig) => void;
    onLoadStoreEmployees: () => void;
}

export default function NamePickerSettingsPanel({
    config,
    storeLabel,
    storeEmployeesCount,
    onChangeConfig,
    onSaveConfig,
    onLoadStoreEmployees
}: Props) {
    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <label htmlFor="np-items" className="text-xs font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#0066ab]" aria-hidden="true" />
                    <span>Danh sách Tên / Mã (mỗi dòng 1 mục)</span>
                </label>

                <div className="flex items-center gap-2 flex-wrap">
                    {storeEmployeesCount > 0 && (
                        <button
                            type="button"
                            onClick={onLoadStoreEmployees}
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-sky-50 hover:bg-sky-100 text-[#0066ab] border border-sky-200 inline-flex items-center gap-1 transition cursor-pointer"
                        >
                            <Users className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Nạp NV {storeLabel} ({storeEmployeesCount})</span>
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => onSaveConfig(config)}
                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1 transition cursor-pointer"
                    >
                        <Save className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Lưu danh sách</span>
                    </button>
                </div>
            </div>

            <textarea
                id="np-items"
                rows={6}
                value={config.rawItemsText}
                onChange={e => onChangeConfig({ ...config, rawItemsText: e.target.value })}
                placeholder="Nhập hoặc dán mỗi dòng một tên hoặc mã tham dự..."
                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-500 outline-none focus:bg-white focus:ring-2 focus:ring-[#0066ab]"
            />

            <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer select-none">
                <input
                    type="checkbox"
                    checked={config.removeWinnerAfterDraw}
                    onChange={e => onChangeConfig({ ...config, removeWinnerAfterDraw: e.target.checked })}
                    className="w-4 h-4 rounded accent-[#0066ab] cursor-pointer"
                />
                <span>Bỏ mục đã trúng ở lượt quay kế tiếp</span>
            </label>
        </div>
    );
}

