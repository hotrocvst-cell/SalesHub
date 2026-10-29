import React from 'react';
import {
    Sparkles,
    ArrowRight,
    CheckCircle2,
    X,
    Users,
    PackageCheck,
    AlertCircle
} from 'lucide-react';
import type { SmartOffsetSuggestion } from '../services/campaignOffsetService';
import { cleanEmployeeName, getShortenedEmployeeName } from '../../../core/lib/formatters';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    suggestions: SmartOffsetSuggestion[];
    onApply: (suggestions: SmartOffsetSuggestion[]) => void;
}

export default function SmartAutoOffsetModal({
    isOpen,
    onClose,
    suggestions,
    onApply
}: Props) {
    if (!isOpen) return null;

    const totalUnits = suggestions.reduce((sum, s) => sum + s.offset_quantity, 0);
    const uniqueEmployees = new Set(suggestions.map(s => s.employee_id)).size;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="px-5 py-4 bg-linear-to-r from-purple-900 via-indigo-900 to-purple-950 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center border border-amber-400/30">
                            <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold tracking-tight">Gợi Ý Cấn Trừ Thi Đua Tự Động (1 Đổi 1)</h3>
                            <p className="text-[11px] text-purple-200">
                                Tự động bù đắp số dư thừa sang các ngành hàng còn thiếu để tối đa hóa số ngành đạt
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-purple-200 hover:text-white transition"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* KPI Strip */}
                <div className="grid grid-cols-2 gap-3 p-4 bg-purple-50/60 border-b border-purple-100 text-xs shrink-0">
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-purple-100">
                        <Users className="w-4 h-4 text-purple-600 shrink-0" />
                        <div>
                            <div className="text-[10.5px] text-slate-500 font-bold">Số NV Được Cứu Bù Số</div>
                            <div className="text-sm font-black text-purple-950">{uniqueEmployees} nhân viên</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-purple-100">
                        <PackageCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                            <div className="text-[10.5px] text-slate-500 font-bold">Tổng Số Lượng Cấn Trừ</div>
                            <div className="text-sm font-black text-emerald-900">{totalUnits} sản phẩm (1 đổi 1)</div>
                        </div>
                    </div>
                </div>

                {/* List of Suggestions */}
                <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
                    {suggestions.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 italic text-xs space-y-2">
                            <AlertCircle className="w-8 h-8 mx-auto text-slate-300" />
                            <div>Không tìm thấy cặp ngành hàng dư/thiếu nào phù hợp để cấn trừ.</div>
                            <div className="text-[11px] text-slate-400">
                                Tất cả nhân viên đã đạt đủ chỉ tiêu hoặc không có ngành nào dư thừa số.
                            </div>
                        </div>
                    ) : (
                        suggestions.map((s, idx) => (
                            <div
                                key={`${s.employee_id}_${s.from_campaign_key}_${s.to_campaign_key}_${idx}`}
                                className="p-3 rounded-xl border border-slate-200 hover:border-purple-300 bg-white shadow-2xs text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition"
                            >
                                <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-[11px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                        {s.employee_id}
                                    </span>
                                    <span className="font-bold text-slate-900" title={cleanEmployeeName(s.employee_name)}>
                                        {getShortenedEmployeeName(s.employee_name)}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap text-[11px]">
                                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold flex items-center gap-1">
                                        <span>Dư: {s.from_campaign_name}</span>
                                        <b className="text-emerald-900">+{s.from_surplus}</b>
                                    </span>

                                    <div className="flex items-center gap-1 text-purple-700 font-bold font-mono">
                                        <ArrowRight className="w-3.5 h-3.5" />
                                        <span>Cấn {s.offset_quantity}</span>
                                        <ArrowRight className="w-3.5 h-3.5" />
                                    </div>

                                    <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-200 font-bold flex items-center gap-1">
                                        <span>Bù: {s.to_campaign_name}</span>
                                        <b className="text-rose-900">Thiếu -{s.to_deficit}</b>
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-slate-300 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-100 transition"
                    >
                        Hủy Bỏ
                    </button>
                    <button
                        onClick={() => onApply(suggestions)}
                        disabled={suggestions.length === 0}
                        className="px-4 py-2 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-xs"
                    >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Áp Dụng {suggestions.length} Cặp Cấn Trừ</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

