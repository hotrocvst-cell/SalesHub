import React, { useState } from 'react';
import type { BatchReportKey, BatchReportCustomOptions } from '../types';
import { BATCH_REPORT_OPTIONS } from '../constants';
import {
    Zap,
    UserCheck,
    CalendarDays,
    Trophy,
    TrendingUp,
    CheckCircle2,
    AlertCircle,
    Eye,
    Download,
    Copy,
    Check,
    Loader2,
    SlidersHorizontal,
    ChevronDown,
    ChevronUp,
    MessageSquareText
} from 'lucide-react';

interface Props {
    checkedKeys: Set<BatchReportKey>;
    onToggleCheck: (key: BatchReportKey) => void;
    onPreview: (key: BatchReportKey) => void;
    onExportSingle: (key: BatchReportKey) => void;
    onCopySingle: (key: BatchReportKey) => void;
    onCopyRemarksSingle: (key: BatchReportKey) => void;
    onCopyAllRemarks: () => void;
    isExporting: boolean;
    actionLoadingKey: string | null;
    copiedKey: string | null;
    copiedRemarksKey: string | null;
    dataAvailability: Record<BatchReportKey, boolean>;
    selectedStore: string;
    customOptions: BatchReportCustomOptions;
    onOptionsChange: (newOptions: BatchReportCustomOptions) => void;
}

export default function BatchExportChecklist({
    checkedKeys,
    onToggleCheck,
    onPreview,
    onExportSingle,
    onCopySingle,
    onCopyRemarksSingle,
    onCopyAllRemarks,
    isExporting,
    actionLoadingKey,
    copiedKey,
    copiedRemarksKey,
    dataAvailability,
    selectedStore,
    customOptions,
    onOptionsChange
}: Props) {
    const [expandedOptionsKey, setExpandedOptionsKey] = useState<BatchReportKey | null>(null);

    const toggleExpandOptions = (key: BatchReportKey) => {
        setExpandedOptionsKey(prev => (prev === key ? null : key));
    };

    const getReportIcon = (key: BatchReportKey) => {
        switch (key) {
            case 'DAILY_REPORT':
                return <Zap className="w-5 h-5 text-amber-600" aria-hidden="true" />;
            case 'EMPLOYEE_PERFORMANCE':
                return <UserCheck className="w-5 h-5 text-emerald-600" aria-hidden="true" />;
            case 'MONTHLY_REPORT':
                return <CalendarDays className="w-5 h-5 text-blue-600" aria-hidden="true" />;
            case 'CAMPAIGN_SUMMARY':
                return <Trophy className="w-5 h-5 text-purple-600" aria-hidden="true" />;
            case 'REVENUE_TREND':
                return <TrendingUp className="w-5 h-5 text-indigo-600" aria-hidden="true" />;
        }
    };

    return (
        <div className="space-y-3 font-sans">
            {/* Header Checklist & Action Sao Chép Toàn Bộ Nhận Xét */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-1">
                <div>
                    <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                        Danh Sách Báo Cáo ({checkedKeys.size}/{BATCH_REPORT_OPTIONS.length})
                    </h3>
                    <span className="text-xs text-slate-500 font-medium">
                        {selectedStore ? 'Tích chọn báo cáo hoặc cấu hình tùy chọn từng loại bên dưới' : 'Vui lòng chọn ST trước'}
                    </span>
                </div>

                {/* Hero Button: Sao Chép Toàn Bộ Nhận Xét */}
                <button
                    type="button"
                    onClick={onCopyAllRemarks}
                    disabled={!selectedStore || checkedKeys.size === 0}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition cursor-pointer active:scale-95 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Gom và sao chép toàn bộ nhận xét của các báo cáo đã chọn gửi Messaging App"
                >
                    {copiedRemarksKey === 'ALL' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                    ) : (
                        <MessageSquareText className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                    <span>{copiedRemarksKey === 'ALL' ? 'Đã sao chép tất cả nhận xét!' : 'Sao chép toàn bộ nhận xét'}</span>
                </button>
            </div>

            {/* Danh Sách Thẻ Báo Cáo */}
            <div className="grid grid-cols-1 gap-3">
                {BATCH_REPORT_OPTIONS.map(item => {
                    const isChecked = checkedKeys.has(item.key);
                    const isAvailable = dataAvailability[item.key];
                    const isCurrentLoading = actionLoadingKey === item.key;
                    const isCopied = copiedKey === item.key;
                    const isRemarksCopied = copiedRemarksKey === item.key;
                    const isExpanded = expandedOptionsKey === item.key;

                    return (
                        <div
                            key={item.key}
                            className={`rounded-2xl border transition-all p-4 ${
                                isChecked
                                    ? 'bg-white border-blue-300 shadow-sm ring-1 ring-blue-100'
                                    : 'bg-slate-50/70 border-slate-200 opacity-90 hover:opacity-100'
                            }`}
                        >
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                {/* Bên trái: Checkbox + Icon + Tên + Badge Trạng Thái */}
                                <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
                                    <label className="flex items-center gap-3 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => onToggleCheck(item.key)}
                                            disabled={isExporting}
                                            className="w-5 h-5 rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        />
                                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200/80">
                                            {getReportIcon(item.key)}
                                        </div>
                                    </label>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h4 className="text-sm font-bold text-slate-900 leading-snug">
                                                {item.name}
                                            </h4>
                                            {/* Badge trạng thái dữ liệu */}
                                            {isAvailable ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" aria-hidden="true" />
                                                    Đã có số liệu
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                    <AlertCircle className="w-3 h-3 text-amber-600" aria-hidden="true" />
                                                    Chưa có số liệu
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                                            {item.description}
                                        </p>
                                    </div>
                                </div>

                                {/* Bên phải: Nút Tùy chọn, Nhận xét, Xem trước, Tải ảnh, Copy */}
                                <div className="flex flex-wrap items-center gap-1.5 shrink-0 self-end sm:self-center">
                                    {/* Nút Toggle Mở Rộng Tùy Chọn */}
                                    <button
                                        type="button"
                                        onClick={() => toggleExpandOptions(item.key)}
                                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                                            isExpanded
                                                ? 'bg-blue-50 text-blue-700 border-blue-300'
                                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                                        }`}
                                        title="Tùy chọn hiển thị & cấu hình báo cáo này"
                                    >
                                        <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                                        <span>Tùy chọn</span>
                                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                    </button>

                                    {/* Nút Copy Nhận Xét Riêng Lẻ */}
                                    <button
                                        type="button"
                                        onClick={() => onCopyRemarksSingle(item.key)}
                                        disabled={!selectedStore || isExporting}
                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition cursor-pointer disabled:opacity-50"
                                        title="Sao chép văn bản nhận xét của báo cáo này để gửi nhóm chat"
                                    >
                                        {isRemarksCopied ? (
                                            <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                                        ) : (
                                            <MessageSquareText className="w-3.5 h-3.5" aria-hidden="true" />
                                        )}
                                        <span>{isRemarksCopied ? 'Đã chép' : 'Nhận xét'}</span>
                                    </button>

                                    {/* Nút Xem Trước */}
                                    <button
                                        type="button"
                                        onClick={() => onPreview(item.key)}
                                        disabled={!selectedStore || isExporting}
                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 hover:text-blue-700 transition cursor-pointer disabled:opacity-50"
                                        title="Xem trước mẫu ảnh báo cáo này"
                                    >
                                        <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                                        <span>Xem</span>
                                    </button>

                                    {/* Nút Tải Ảnh Riêng */}
                                    <button
                                        type="button"
                                        onClick={() => onExportSingle(item.key)}
                                        disabled={!selectedStore || isExporting || isCurrentLoading}
                                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition cursor-pointer shadow-sm disabled:opacity-50"
                                        title="Xuất và tải ảnh báo cáo này về máy"
                                    >
                                        {isCurrentLoading ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                                        ) : (
                                            <Download className="w-3.5 h-3.5" aria-hidden="true" />
                                        )}
                                        <span>Tải ảnh</span>
                                    </button>

                                    {/* Nút Copy Ảnh */}
                                    <button
                                        type="button"
                                        onClick={() => onCopySingle(item.key)}
                                        disabled={!selectedStore || isExporting || isCurrentLoading}
                                        className="p-1.5 rounded-xl text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 transition cursor-pointer disabled:opacity-50"
                                        title="Sao chép ảnh vào clipboard để gửi nhanh"
                                        aria-label="Sao chép ảnh"
                                    >
                                        {isCopied ? (
                                            <Check className="w-4 h-4 text-emerald-600" aria-hidden="true" />
                                        ) : (
                                            <Copy className="w-4 h-4" aria-hidden="true" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* KHU VỰC TÙY CHỌN / TOGGLE MỞ RỘNG CHO TỪNG BÁO CÁO */}
                            {isExpanded && (
                                <div className="mt-3.5 pt-3.5 border-t border-slate-200 bg-slate-50/80 -mx-4 -mb-4 p-4 rounded-b-2xl space-y-3 animate-fadeIn">
                                    <div className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                        <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                                        <span>Cấu Hình Tùy Chọn Xuất Báo Cáo</span>
                                    </div>

                                    {/* 1. Tùy chọn Báo Cáo Ngày */}
                                    {item.key === 'DAILY_REPORT' && (
                                        <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-700">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <span className="text-slate-600 font-semibold">Chế độ xem:</span>
                                                <select
                                                    value={customOptions.daily.mode}
                                                    onChange={e => onOptionsChange({
                                                        ...customOptions,
                                                        daily: { ...customOptions.daily, mode: e.target.value as 'realtime' | 'remaining' }
                                                    })}
                                                    className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-800"
                                                >
                                                    <option value="realtime">⚡ Báo Cáo Realtime</option>
                                                    <option value="remaining">🎯 Mục Tiêu Còn Lại</option>
                                                </select>
                                            </label>

                                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={customOptions.daily.showTable}
                                                    onChange={e => onOptionsChange({
                                                        ...customOptions,
                                                        daily: { ...customOptions.daily, showTable: e.target.checked }
                                                    })}
                                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                                                />
                                                <span>Hiển thị bảng chi tiết ngành hàng thi đua</span>
                                            </label>
                                        </div>
                                    )}

                                    {/* 2. Tùy chọn Hiệu Quả Nhân Viên */}
                                    {item.key === 'EMPLOYEE_PERFORMANCE' && (
                                        <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-700">
                                            {/* Toggle Giờ công & Năng suất (Mặc định: Ẩn) */}
                                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={customOptions.employeePerformance.showWorkHours}
                                                    onChange={e => onOptionsChange({
                                                        ...customOptions,
                                                        employeePerformance: {
                                                            ...customOptions.employeePerformance,
                                                            showWorkHours: e.target.checked
                                                        }
                                                    })}
                                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <span>Hiển thị Giờ Công & Năng Suất (DTQĐ/GC)</span>
                                            </label>

                                            {/* Sắp xếp theo */}
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <span className="text-slate-600 font-semibold">Sắp xếp theo:</span>
                                                <select
                                                    value={customOptions.employeePerformance.sortBy}
                                                    onChange={e => onOptionsChange({
                                                        ...customOptions,
                                                        employeePerformance: {
                                                            ...customOptions.employeePerformance,
                                                            sortBy: e.target.value as any
                                                        }
                                                    })}
                                                    className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-800"
                                                >
                                                    <option value="forecast">🎯 % Dự Kiến Hoàn Thành (%DKHT)</option>
                                                    <option value="revenue_qd">💰 Doanh Thu Quy Đổi (DTQĐ)</option>
                                                    <option value="actual">💵 Doanh Thu Thực</option>
                                                    <option value="installment">💳 Doanh Thu Trả Chậm</option>
                                                </select>
                                            </label>
                                        </div>
                                    )}

                                    {/* 3. Tùy chọn Báo Cáo Tháng */}
                                    {item.key === 'MONTHLY_REPORT' && (
                                        <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-700">
                                            <span className="text-slate-600 font-semibold">Nội dung bảng:</span>
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="monthly_view_mode"
                                                    value="categories"
                                                    checked={customOptions.monthly.viewMode === 'categories'}
                                                    onChange={() => onOptionsChange({
                                                        ...customOptions,
                                                        monthly: { ...customOptions.monthly, viewMode: 'categories' }
                                                    })}
                                                    className="text-emerald-600 focus:ring-emerald-500"
                                                />
                                                <span>Chi tiết ngành hàng thi đua</span>
                                            </label>
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="monthly_view_mode"
                                                    value="daily_pace"
                                                    checked={customOptions.monthly.viewMode === 'daily_pace'}
                                                    onChange={() => onOptionsChange({
                                                        ...customOptions,
                                                        monthly: { ...customOptions.monthly, viewMode: 'daily_pace' }
                                                    })}
                                                    className="text-emerald-600 focus:ring-emerald-500"
                                                />
                                                <span>Nhịp doanh thu các ngày trong tháng</span>
                                            </label>
                                        </div>
                                    )}

                                    {/* 4. Tùy chọn Thi Đua Trọng Tâm */}
                                    {item.key === 'CAMPAIGN_SUMMARY' && (
                                        <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-700">
                                            <span className="text-slate-600 font-semibold">Cách tính đạt:</span>
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="campaign_scoring_mode"
                                                    value="COUNT"
                                                    checked={customOptions.campaign.scoringMode === 'COUNT'}
                                                    onChange={() => onOptionsChange({
                                                        ...customOptions,
                                                        campaign: { ...customOptions.campaign, scoringMode: 'COUNT' }
                                                    })}
                                                    className="text-purple-600 focus:ring-purple-500"
                                                />
                                                <span>Theo Số Ngành Đạt</span>
                                            </label>
                                            <label className="flex items-center gap-1.5 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="campaign_scoring_mode"
                                                    value="POINTS"
                                                    checked={customOptions.campaign.scoringMode === 'POINTS'}
                                                    onChange={() => onOptionsChange({
                                                        ...customOptions,
                                                        campaign: { ...customOptions.campaign, scoringMode: 'POINTS' }
                                                    })}
                                                    className="text-purple-600 focus:ring-purple-500"
                                                />
                                                <span>Theo Điểm Số Thi Đua</span>
                                            </label>
                                        </div>
                                    )}

                                    {/* 5. Tùy chọn Nhịp Doanh Thu */}
                                    {item.key === 'REVENUE_TREND' && (
                                        <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-700">
                                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={customOptions.revenueTrend.showBarChart}
                                                    onChange={e => onOptionsChange({
                                                        ...customOptions,
                                                        revenueTrend: { ...customOptions.revenueTrend, showBarChart: e.target.checked }
                                                    })}
                                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <span>Hiển thị biểu đồ cột mini nhịp ngày</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={customOptions.revenueTrend.showDetailTable}
                                                    onChange={e => onOptionsChange({
                                                        ...customOptions,
                                                        revenueTrend: { ...customOptions.revenueTrend, showDetailTable: e.target.checked }
                                                    })}
                                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <span>Hiển thị bảng số liệu chi tiết từng ngày</span>
                                            </label>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
