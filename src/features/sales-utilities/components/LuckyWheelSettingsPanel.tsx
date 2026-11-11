import React from 'react';
import { Users, Save } from 'lucide-react';
import type { LuckyWheelConfig } from '../types';

interface Props {
    config: LuckyWheelConfig;
    isSpinning: boolean;
    storeLabel: string;
    storeEmployeesCount: number;
    spinDurationSec: number;
    onChangeDuration: (sec: number) => void;
    onChangeConfig: (next: LuckyWheelConfig) => void;
    onSaveConfig: (next: LuckyWheelConfig) => void;
    onLoadStoreEmployees: () => void;
}

export default function LuckyWheelSettingsPanel({
    config,
    isSpinning,
    storeLabel,
    storeEmployeesCount,
    spinDurationSec,
    onChangeDuration,
    onChangeConfig,
    onSaveConfig,
    onLoadStoreEmployees
}: Props) {
    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <label htmlFor="lw-items" className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">
                    Danh sách mục quay
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                    {storeEmployeesCount > 0 && (
                        <button
                            type="button"
                            onClick={onLoadStoreEmployees}
                            disabled={isSpinning}
                            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-sky-50 hover:bg-sky-100 text-[#0066ab] border border-sky-200 inline-flex items-center gap-1 transition cursor-pointer"
                        >
                            <Users className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Nạp NV {storeLabel}</span>
                        </button>
                    )}
                    <button
                        type="button"
                        disabled={isSpinning}
                        onClick={() => onSaveConfig(config)}
                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1 transition cursor-pointer"
                    >
                        <Save className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Lưu</span>
                    </button>
                </div>
            </div>

            <textarea
                id="lw-items"
                rows={7}
                disabled={isSpinning}
                value={config.rawItemsText}
                onChange={e => onChangeConfig({ ...config, rawItemsText: e.target.value })}
                placeholder="Nhập mỗi dòng một tên hoặc phần quà..."
                className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-500 outline-none focus:bg-white focus:ring-2 focus:ring-[#0066ab] disabled:opacity-60"
            />

            <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <label htmlFor="lw-duration">Thời gian quay</label>
                    <span className="font-mono text-[#0066ab] tabular-nums">{spinDurationSec} giây</span>
                </div>
                <input
                    id="lw-duration"
                    type="range"
                    min={3}
                    max={8}
                    step={1}
                    disabled={isSpinning}
                    value={spinDurationSec}
                    onChange={e => onChangeDuration(parseInt(e.target.value, 10))}
                    className="w-full accent-[#0066ab] cursor-pointer"
                />
            </div>

            <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer select-none">
                <input
                    type="checkbox"
                    checked={config.removeWinnerAfterSpin}
                    onChange={e => onChangeConfig({ ...config, removeWinnerAfterSpin: e.target.checked })}
                    className="w-4 h-4 rounded accent-[#0066ab] cursor-pointer"
                />
                <span>Loại bỏ mục đã trúng ở lượt tiếp theo</span>
            </label>
        </div>
    );
}

