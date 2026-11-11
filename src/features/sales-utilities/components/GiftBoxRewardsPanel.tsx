import React from 'react';
import { Plus, Trash2, Shuffle } from 'lucide-react';
import type { GiftBoxRewardItem } from '../types';

interface Props {
    rewards: GiftBoxRewardItem[];
    totalConfiguredCount: number;
    newRewardName: string;
    newRewardQty: number;
    onChangeNewName: (val: string) => void;
    onChangeNewQty: (val: number) => void;
    onAddReward: () => void;
    onUpdateReward: (id: string, field: 'name' | 'quantity', val: string | number) => void;
    onDeleteReward: (id: string) => void;
    onRegenerate: () => void;
}

export default function GiftBoxRewardsPanel({
    rewards,
    totalConfiguredCount,
    newRewardName,
    newRewardQty,
    onChangeNewName,
    onChangeNewQty,
    onAddReward,
    onUpdateReward,
    onDeleteReward,
    onRegenerate
}: Props) {
    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                    <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                        Danh sách phần thưởng
                    </h3>
                    <p className="text-xs text-slate-600 tabular-nums">
                        Tổng: <strong className="text-[#0066ab]">{totalConfiguredCount}</strong> hộp quà
                    </p>
                </div>

                <button
                    type="button"
                    onClick={onRegenerate}
                    className="px-3 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-[#0066ab] to-[#0369a1] hover:from-[#005591] hover:to-[#0284c7] text-white inline-flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                    <Shuffle className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Tạo &amp; Trộn</span>
                </button>
            </div>

            <div className="space-y-2">
                <input
                    type="text"
                    aria-label="Tên phần thưởng mới"
                    value={newRewardName}
                    onChange={e => onChangeNewName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') onAddReward(); }}
                    placeholder="Tên quà (vd: Voucher 100k...)"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 placeholder-slate-500 outline-none focus:bg-white focus:ring-2 focus:ring-[#0066ab]"
                />
                <div className="flex items-center gap-2">
                    <input
                        type="number"
                        min={1}
                        max={50}
                        aria-label="Số lượng phần thưởng"
                        value={newRewardQty}
                        onChange={e => onChangeNewQty(Math.max(1, Math.min(50, parseInt(e.target.value || '1', 10))))}
                        className="w-20 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 text-right tabular-nums outline-none focus:bg-white focus:ring-2 focus:ring-[#0066ab]"
                    />
                    <button
                        type="button"
                        onClick={onAddReward}
                        className="flex-1 px-3 py-2 rounded-xl text-xs font-bold bg-[#0066ab] hover:bg-[#005591] text-white inline-flex items-center justify-center gap-1 transition cursor-pointer"
                    >
                        <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Thêm quà</span>
                    </button>
                </div>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-[340px] overflow-y-auto">
                {rewards.map((rw, idx) => (
                    <div key={rw.id} className="p-2 bg-white flex items-center gap-1.5">
                        <span className="w-5 text-center text-[11px] font-mono font-bold text-slate-500 tabular-nums shrink-0">
                            {idx + 1}
                        </span>
                        <input
                            type="text"
                            aria-label={`Tên quà ${idx + 1}`}
                            value={rw.name}
                            onChange={e => onUpdateReward(rw.id, 'name', e.target.value)}
                            className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-900 outline-none focus:bg-white focus:ring-1 focus:ring-[#0066ab]"
                        />
                        <input
                            type="number"
                            min={1}
                            max={50}
                            aria-label={`Số lượng quà ${idx + 1}`}
                            value={rw.quantity}
                            onChange={e => onUpdateReward(rw.id, 'quantity', e.target.value)}
                            className="w-14 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-900 text-right tabular-nums outline-none focus:bg-white focus:ring-1 focus:ring-[#0066ab]"
                        />
                        <button
                            type="button"
                            onClick={() => onDeleteReward(rw.id)}
                            aria-label={`Xóa phần thưởng ${rw.name}`}
                            className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer shrink-0"
                        >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

