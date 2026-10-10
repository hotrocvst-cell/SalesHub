import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    CheckCircle2,
    AlertTriangle,
    AlertCircle,
    ArrowUpRight,
    Clock,
    User,
    Calendar,
    Sparkles
} from 'lucide-react';
import { formatDate, getYesterdayDateString, normalizeToDateString } from '../../../core/lib/formatters';

export interface ReportDataFreshnessBarProps {
    /** Ngày của dữ liệu báo cáo (YYYY-MM-DD hoặc DD-MM-YYYY) */
    latestDataDate?: string | null;
    /** Ngày dự kiến chốt ca (YYYY-MM-DD hoặc DD-MM-YYYY), mặc định ngày n-1 (hôm qua) */
    expectedDate?: string;
    /** Tiêu đề phiên dữ liệu (nếu có) */
    sessionTitle?: string | null;
    /** Thời điểm cập nhật dữ liệu */
    lastUpdatedAt?: string | Date | null;
    /** Người thực hiện cập nhật */
    lastUpdatedBy?: string | null;
    /** Tên siêu thị áp dụng */
    storeName?: string;
    /** Đường dẫn điều hướng để cập nhật số liệu */
    actionUrl?: string;
    /** Nhãn nút điều hướng cập nhật */
    actionLabel?: string;
    /** Cho phép người dùng thấy nút cập nhật (chỉ hiện cho QL/Admin) */
    canUpdate?: boolean;
    /** Giao diện rút gọn trên mobile/không gian hẹp */
    compact?: boolean;
    /** Class tùy biến */
    className?: string;
}

export default function ReportDataFreshnessBar({
    latestDataDate,
    expectedDate = getYesterdayDateString(),
    sessionTitle,
    lastUpdatedAt,
    lastUpdatedBy,
    storeName,
    actionUrl,
    actionLabel = 'Cập nhật số liệu',
    canUpdate = false,
    compact = false,
    className = ''
}: ReportDataFreshnessBarProps) {
    const navigate = useNavigate();

    // Chuẩn hóa định dạng ngày (YYYY-MM-DD) để so sánh chuỗi chính xác tuyệt đối
    const normLatest = React.useMemo(() => normalizeToDateString(latestDataDate), [latestDataDate]);
    const normExpected = React.useMemo(() => normalizeToDateString(expectedDate) || getYesterdayDateString(), [expectedDate]);

    // Phân tích trạng thái phiên
    const hasData = Boolean(normLatest || latestDataDate);
    // So sánh ngày chuỗi chuẩn ISO (YYYY-MM-DD): nếu ngày dữ liệu >= ngày hôm qua -> Đạt chuẩn mới nhất
    const isUpToDate = Boolean(hasData && normLatest && normExpected && normLatest >= normExpected);

    // Định dạng thời gian cập nhật
    const formattedUpdatedAt = React.useMemo(() => {
        if (!lastUpdatedAt) return null;
        try {
            const d = new Date(lastUpdatedAt);
            if (isNaN(d.getTime())) return null;
            const timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
            return `${timeStr} - ${formatDate(d)}`;
        } catch {
            return null;
        }
    }, [lastUpdatedAt]);

    return (
        <div
            data-freshness-bar="true"
            data-html2canvas-ignore="true"
            data-export-ignore="true"
            className={`rounded-2xl border transition-all ${isUpToDate
                ? 'bg-gradient-to-r from-emerald-50/95 via-teal-50/80 to-emerald-50/90 border-emerald-300/90 text-emerald-950 shadow-2xs'
                : hasData
                    ? 'bg-gradient-to-r from-amber-50/95 via-orange-50/85 to-amber-50/90 border-amber-300/90 text-amber-950 shadow-2xs'
                    : 'bg-gradient-to-r from-rose-50/95 via-red-50/85 to-rose-50/90 border-rose-300/90 text-rose-950 shadow-2xs'
                } ${compact ? 'p-2.5 sm:p-3' : 'p-3 sm:p-3.5'} ${className}`}
        >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                {/* Khối Thông Tin Trạng Thái Dữ Liệu */}
                <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                    {/* Icon đại diện trạng thái */}
                    <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-2xs mt-0.5 sm:mt-0 ${isUpToDate
                            ? 'bg-emerald-600 text-white'
                            : hasData
                                ? 'bg-amber-500 text-slate-950'
                                : 'bg-rose-600 text-white'
                            }`}
                    >
                        {isUpToDate ? (
                            <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                        ) : hasData ? (
                            <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
                        ) : (
                            <AlertCircle className="w-5 h-5 stroke-[2.5]" />
                        )}
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-xs sm:text-sm font-black uppercase tracking-wide flex items-center gap-1.5">
                                <span>
                                    {isUpToDate
                                        ? 'Dữ Liệu Đã Cập Nhật'
                                        : hasData
                                            ? 'Dữ Liệu Chưa Cập Nhật Phiên Mới Nhất'
                                            : 'Chưa Có Dữ Liệu Phiên Nào'}
                                </span>
                            </h4>

                            {/* Badge trạng thái */}
                            <span
                                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border shadow-2xs inline-flex items-center gap-1 ${isUpToDate
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    : hasData
                                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                                        : 'bg-rose-100 text-rose-800 border-rose-300'
                                    }`}
                            >
                                <span className={`w-1.5 h-1.5 rounded-full ${isUpToDate ? 'bg-emerald-600 animate-pulse' : hasData ? 'bg-amber-600' : 'bg-rose-600'}`} />
                                <span>{isUpToDate ? 'Phiên Mới Nhất' : hasData ? 'Chậm Phiên' : 'Thiếu Dữ Liệu'}</span>
                            </span>
                        </div>

                        {/* Diễn giải chi tiết ngày chốt & ngày kỳ vọng */}
                        <p className="text-[11px] sm:text-xs font-semibold text-slate-700 mt-0.5 flex items-center gap-1.5 flex-wrap">
                            {isUpToDate ? (
                                <span>
                                    Đã chốt số liệu ngày <strong className="font-mono text-emerald-900">{formatDate(normLatest || latestDataDate!)}</strong>
                                </span>
                            ) : hasData ? (
                                <span>
                                    Số liệu đang dừng ở ngày <strong className="font-mono text-amber-950 font-bold">{formatDate(normLatest || latestDataDate!)}</strong> • Cần cập nhật chốt ca ngày <strong className="font-mono text-rose-700 font-bold">{formatDate(normExpected || expectedDate)}</strong> (Hôm qua)
                                </span>
                            ) : (
                                <span>
                                    Chưa có số liệu được lưu cho kỳ này. Cần nạp số liệu chốt ngày <strong className="font-mono text-rose-700">{formatDate(normExpected || expectedDate)}</strong>.
                                </span>
                            )}

                            {storeName && storeName !== 'all' && (
                                <span className="text-slate-500 font-normal">
                                    • Siêu thị: <strong className="text-slate-800 font-bold">{storeName}</strong>
                                </span>
                            )}
                        </p>
                    </div>
                </div>

                {/* Khối Metadata & Nút Cập Nhật */}
                <div className="flex items-start sm:items-center gap-2 self-start sm:self-auto flex-wrap shrink-0">
                    {/* Meta: Người cập nhật / Giờ cập nhật */}
                    {(formattedUpdatedAt || lastUpdatedBy || sessionTitle) && (
                        <div className="flex flex-col gap-1 text-[10px] sm:text-[10.5px] font-medium text-slate-600 bg-white/90 backdrop-blur-xs px-2.5 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
                            {formattedUpdatedAt && (
                                <div className="flex items-center gap-1.5 text-slate-600" title={`Cập nhật lúc ${formattedUpdatedAt}`}>
                                    <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span>{formattedUpdatedAt}</span>
                                </div>
                            )}
                            {lastUpdatedBy && (
                                <div className="flex items-center gap-1.5 text-slate-700 font-bold" title={`Bởi ${lastUpdatedBy}`}>
                                    <User className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span className="max-w-[160px] sm:max-w-[200px] truncate">{lastUpdatedBy}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Nút hành động Cập nhật nhanh (Ẩn khi chụp ảnh báo cáo bằng data-html2canvas-ignore) */}
                    {canUpdate && actionUrl && !isUpToDate && (
                        <button
                            type="button"
                            data-html2canvas-ignore="true"
                            data-export-ignore="true"
                            onClick={() => navigate(actionUrl)}
                            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] text-white text-[11px] font-black transition cursor-pointer shadow-xs flex items-center gap-1 shrink-0"
                            title="Chuyển đến màn hình cập nhật số liệu"
                        >
                            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                            <span>{actionLabel}</span>
                            <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
