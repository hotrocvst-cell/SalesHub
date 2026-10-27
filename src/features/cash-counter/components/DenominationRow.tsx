import React from 'react';
import { Minus, Plus } from 'lucide-react';
import type { DenominationItem } from '../types';

interface DenominationRowProps {
    item: DenominationItem;
    qty: number;
    onQtyChange: (val: number, newQty: number) => void;
    onAdjust: (val: number, delta: number) => void;
}

export const DenominationRow: React.FC<DenominationRowProps> = ({
    item,
    qty,
    onQtyChange,
    onAdjust
}) => {
    const subtotal = qty * item.val;

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const parsed = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0;
        onQtyChange(item.val, Math.max(0, parsed));
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        e.target.select();
    };

    return (
        <div className={`flex items-center justify-between gap-1.5 p-1.5 sm:p-2 rounded-xl border ${
            qty > 0 ? `${item.borderClass} ${item.bgClass} shadow-2xs` : 'border-slate-200/80 bg-white hover:bg-slate-50/60'
        } transition-all`}>
            {/* Tag Mệnh Giá */}
            <div className="flex items-center gap-1.5 min-w-[75px] sm:min-w-[90px] shrink-0">
                <span className={`text-[11px] sm:text-xs font-black tracking-tight ${item.textClass}`}>
                    {item.label}
                </span>
            </div>

            {/* Bộ điều khiển Số tờ (Stepper) */}
            <div className="flex items-center border border-slate-300 rounded-lg overflow-hidden bg-white shadow-2xs shrink-0">
                <button
                    type="button"
                    onClick={() => onAdjust(item.val, -1)}
                    disabled={qty <= 0}
                    aria-label={`Giảm số tờ ${item.label}`}
                    className="w-8 h-8 flex items-center justify-center bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer select-none"
                >
                    <Minus className="w-3.5 h-3.5" />
                </button>

                <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={qty === 0 ? '' : qty}
                    placeholder="0"
                    onChange={handleInputChange}
                    onFocus={handleFocus}
                    className="w-12 sm:w-16 h-8 text-center text-xs sm:text-sm font-black text-slate-800 outline-none border-x border-slate-200 bg-white select-all"
                />

                <button
                    type="button"
                    onClick={() => onAdjust(item.val, 1)}
                    aria-label={`Tăng số tờ ${item.label}`}
                    className="w-8 h-8 flex items-center justify-center bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 active:scale-95 transition cursor-pointer select-none"
                >
                    <Plus className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Nút bấm nhanh (+5, +10) cho thao tác đếm cọc tiền */}
            <div className="hidden xs:flex items-center gap-1 shrink-0">
                <button
                    type="button"
                    onClick={() => onAdjust(item.val, 5)}
                    className="px-1.5 py-0.5 text-[9.5px] font-bold text-slate-600 hover:text-indigo-700 bg-slate-100 hover:bg-indigo-50 rounded border border-slate-200 transition cursor-pointer"
                    title="Cộng thêm 5 tờ"
                >
                    +5
                </button>
                <button
                    type="button"
                    onClick={() => onAdjust(item.val, 10)}
                    className="px-1.5 py-0.5 text-[9.5px] font-bold text-slate-600 hover:text-indigo-700 bg-slate-100 hover:bg-indigo-50 rounded border border-slate-200 transition cursor-pointer"
                    title="Cộng thêm 10 tờ (1 thếp)"
                >
                    +10
                </button>
            </div>

            {/* Dấu = và Thành tiền */}
            <div className="text-right min-w-[75px] sm:min-w-[105px] shrink-0">
                <span className={`text-[11.5px] sm:text-xs font-mono font-black ${
                    qty > 0 ? 'text-indigo-700' : 'text-slate-400'
                }`}>
                    {subtotal.toLocaleString('vi-VN')} đ
                </span>
            </div>
        </div>
    );
};
