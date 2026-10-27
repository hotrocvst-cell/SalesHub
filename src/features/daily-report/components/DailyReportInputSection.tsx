import React from 'react';
import { ChevronDown, ChevronUp, Play, Trash2, Sparkles } from 'lucide-react';

interface DailyReportInputSectionProps {
    emulationText: string;
    setEmulationText: (val: string) => void;
    revenueText: string;
    setRevenueText: (val: string) => void;
    realRevenueText: string;
    setRealRevenueText: (val: string) => void;
    onProcessData: () => void;
    onClearData: () => void;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    hasData: boolean;
}

export default function DailyReportInputSection({
    emulationText,
    setEmulationText,
    revenueText,
    setRevenueText,
    realRevenueText,
    setRealRevenueText,
    onProcessData,
    onClearData,
    isCollapsed,
    onToggleCollapse,
    hasData
}: DailyReportInputSectionProps) {
    return (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-3.5 sm:p-4 shadow-xs space-y-3">
            {/* Header thanh gập mở */}
            <div className="flex items-center justify-between gap-2">
                <button
                    onClick={onToggleCollapse}
                    className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-slate-800 hover:text-blue-600 transition cursor-pointer"
                >
                    <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                        <Sparkles className="w-4 h-4" />
                    </span>
                    <span>VÙNG NHẬP SỐ LIỆU TỪ TRANG NỘI BỘ</span>
                    {hasData && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Đã nạp số liệu
                        </span>
                    )}
                    {isCollapsed ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                    )}
                </button>

                <div className="flex items-center gap-2">
                    {hasData && (
                        <button
                            onClick={onClearData}
                            className="px-2.5 py-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                            title="Xóa trắng dữ liệu đang dán"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Làm mới</span>
                        </button>
                    )}
                    <button
                        onClick={onProcessData}
                        className="py-1.5 px-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition cursor-pointer active:scale-95"
                    >
                        <Play className="w-3.5 h-3.5 fill-white" />
                        <span>XỬ LÝ</span>
                    </button>
                </div>
            </div>

            {/* Nội dung vùng dán khi mở rộng */}
            {!isCollapsed && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-blue-700 uppercase flex items-center justify-between">
                            <span>🔗 1. Thi đua Realtime</span>
                            <span className="text-[9px] text-blue-600 font-semibold lowercase bg-blue-50 px-1.5 py-0.2 rounded">
                                bắt buộc
                            </span>
                        </label>
                        <textarea
                            rows={3}
                            value={emulationText}
                            onChange={(e) => setEmulationText(e.target.value)}
                            placeholder="Dán dữ liệu Thi đua Realtime..."
                            className="w-full text-xs font-mono p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none leading-tight"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-emerald-700 uppercase flex items-center justify-between">
                            <span>🔗 2. DT Quy Đổi (DTQĐ)</span>
                            <span className="text-[9px] text-emerald-600 font-semibold lowercase bg-emerald-50 px-1.5 py-0.2 rounded">
                                bắt buộc
                            </span>
                        </label>
                        <textarea
                            rows={3}
                            value={revenueText}
                            onChange={(e) => setRevenueText(e.target.value)}
                            placeholder="Dán dữ liệu Doanh thu quy đổi (DTQĐ)..."
                            className="w-full text-xs font-mono p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white resize-none leading-tight"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-purple-700 uppercase flex items-center justify-between">
                            <span>🔗 3. Doanh Thu Thực</span>
                            <span className="text-[9px] text-purple-600 font-semibold lowercase bg-purple-50 px-1.5 py-0.2 rounded">
                                khuyến nghị
                            </span>
                        </label>
                        <textarea
                            rows={3}
                            value={realRevenueText}
                            onChange={(e) => setRealRevenueText(e.target.value)}
                            placeholder="Dán bảng Doanh thu thực để bóc tách DT Trả góp..."
                            className="w-full text-xs font-mono p-2.5 bg-purple-50/30 border border-purple-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white resize-none leading-tight"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
