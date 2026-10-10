import React, { useState, useMemo } from 'react';
import {
    PackageCheck,
    AlertTriangle,
    Flame,
    Plus,
    Clock,
    TrendingUp,
    ShieldAlert,
    CheckCircle2,
    Calendar,
    Filter,
    ArrowUpRight,
    Layers,
    FileText,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import type { VoucherItem, VoucherStockForecast } from '../types';
import { calculateStockForecasts, getDenominationHotStyle, formatCurrency, parseConditionLines } from '../voucherFormatters';

interface Props {
    vouchers: VoucherItem[];
    onOpenImportModalWithPreset?: (campaignName: string, denomination: number, description?: string) => void;
}

export default function VoucherStockSummaryTable({
    vouchers,
    onOpenImportModalWithPreset
}: Props) {
    // Mặc định tự động thu ẩn hiển thị, chỉ hiện tiêu đề/badge cảnh báo cho đến khi người dùng click để mở rộng
    const [isExpanded, setIsExpanded] = useState<boolean>(false);
    const [filterAlert, setFilterAlert] = useState<'ALL' | 'URGENT' | 'WARNING' | 'SAFE'>('ALL');
    const [searchKeyword, setSearchKeyword] = useState<string>('');

    // Tính toán số liệu dự báo tồn kho và tốc độ tiêu thụ
    const forecasts = useMemo<VoucherStockForecast[]>(() => {
        return calculateStockForecasts(vouchers);
    }, [vouchers]);

    const urgentCount = useMemo(() => {
        return forecasts.filter(f => f.alertLevel === 'OUT_OF_STOCK' || f.alertLevel === 'CRITICAL').length;
    }, [forecasts]);

    const warningCount = useMemo(() => {
        return forecasts.filter(f => f.alertLevel === 'WARNING').length;
    }, [forecasts]);

    const safeCount = useMemo(() => {
        return forecasts.filter(f => f.alertLevel === 'SAFE' || f.alertLevel === 'INACTIVE').length;
    }, [forecasts]);

    // Lọc theo trạng thái cảnh báo và từ khóa
    const filteredForecasts = useMemo(() => {
        let list = forecasts;

        if (filterAlert === 'URGENT') {
            list = list.filter(f => f.alertLevel === 'OUT_OF_STOCK' || f.alertLevel === 'CRITICAL');
        } else if (filterAlert === 'WARNING') {
            list = list.filter(f => f.alertLevel === 'WARNING');
        } else if (filterAlert === 'SAFE') {
            list = list.filter(f => f.alertLevel === 'SAFE' || f.alertLevel === 'INACTIVE');
        }

        if (searchKeyword.trim()) {
            const q = searchKeyword.trim().toLowerCase();
            list = list.filter(f =>
                f.campaign_name.toLowerCase().includes(q) ||
                (f.description && f.description.toLowerCase().includes(q)) ||
                String(f.denomination).includes(q)
            );
        }

        return list;
    }, [forecasts, filterAlert, searchKeyword]);

    if (forecasts.length === 0) {
        return null;
    }

    return (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden font-avo">
            {/* Header phân hệ Tổng Hợp & Cảnh Báo Tồn Kho (Click vào để mở rộng/thu gọn) */}
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 sm:p-5 text-white flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none hover:brightness-105 transition"
                title="Bấm để mở rộng hoặc thu ẩn bảng tổng hợp dự báo"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0">
                        <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-sm sm:text-base font-black uppercase tracking-wide text-amber-300">
                                Tổng Hợp Số Lượng & Dự Báo Tiêu Thụ Mã Voucher
                            </h2>
                            <span className="bg-slate-800 text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-700">
                                {forecasts.length} nhóm mã
                            </span>
                            {urgentCount > 0 && (
                                <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse border border-rose-300">
                                    🚨 {urgentCount} loại cần bổ sung gấp
                                </span>
                            )}
                            {warningCount > 0 && (
                                <span className="bg-amber-500 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300">
                                    ⚠️ {warningCount} loại sắp hết
                                </span>
                            )}
                            {urgentCount === 0 && warningCount === 0 && (
                                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                                    🟢 Tồn kho an toàn
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-300 mt-0.5">
                            Phân tích tốc độ dùng trung bình mỗi ngày (burn rate) để tự động cảnh báo sắp hết / đã hết mã
                        </p>
                    </div>
                </div>

                {/* Nút bấm chuyển đổi thu gọn / mở rộng */}
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-amber-200/90 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-1.5 transition">
                        <span>{isExpanded ? 'Thu gọn bảng' : 'Bấm để mở rộng xem chi tiết'}</span>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-amber-300" /> : <ChevronDown className="w-4 h-4 text-amber-300" />}
                    </span>
                </div>
            </div>

            {/* VÙNG NỘI DUNG MỞ RỘNG */}
            {isExpanded && (
                <>
                    {/* Thanh lọc trạng thái & Bộ lọc nhanh */}
                    <div className="bg-slate-900/95 px-4 py-2.5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 animate-in fade-in duration-150">
                        <span className="text-xs font-bold text-slate-300">Lọc theo mức độ cảnh báo tồn kho:</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                                type="button"
                                onClick={() => setFilterAlert('ALL')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                                    filterAlert === 'ALL'
                                        ? 'bg-white text-slate-900 shadow-xs'
                                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                                }`}
                            >
                                Tất Cả ({forecasts.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterAlert('URGENT')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1 ${
                                    filterAlert === 'URGENT'
                                        ? 'bg-rose-600 text-white shadow-xs'
                                        : 'bg-slate-800/80 text-rose-300 hover:bg-rose-950/50'
                                }`}
                            >
                                <Flame className="w-3.5 h-3.5" />
                                <span>Cần Nạp Gấp ({urgentCount})</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterAlert('WARNING')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1 ${
                                    filterAlert === 'WARNING'
                                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                                        : 'bg-slate-800/80 text-amber-300 hover:bg-amber-950/50'
                                }`}
                            >
                                <Clock className="w-3.5 h-3.5" />
                                <span>Sắp Hết ({warningCount})</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setFilterAlert('SAFE')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1 ${
                                    filterAlert === 'SAFE'
                                        ? 'bg-emerald-600 text-white shadow-xs'
                                        : 'bg-slate-800/80 text-emerald-300 hover:bg-emerald-950/50'
                                }`}
                            >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Đủ Dùng ({safeCount})</span>
                            </button>
                        </div>
                    </div>

            {/* Bảng Dữ Liệu Tổng Hợp */}
            <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase text-slate-600">
                            <th className="py-3 px-3">Chương Trình & Diễn Giải</th>
                            <th className="py-3 px-2 text-center" style={{ width: '130px' }}>Mệnh Giá</th>
                            <th className="py-3 px-2 text-right">Tổng Kho</th>
                            <th className="py-3 px-2 text-right">Đã Cấp</th>
                            <th className="py-3 px-2 text-right">Còn Lại</th>
                            <th className="py-3 px-2 text-center" style={{ width: '110px' }}>Tốc Độ TB/Ngày</th>
                            <th className="py-3 px-2 text-center" style={{ width: '110px' }}>Dự Báo Còn</th>
                            <th className="py-3 px-3 text-center">Tình Trạng & Cảnh Báo</th>
                            <th className="py-3 px-2 text-right" style={{ width: '100px' }}>Bổ Sung</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredForecasts.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="py-6 text-center text-slate-400 font-bold">
                                    Không có loại voucher nào thỏa mãn điều kiện lọc.
                                </td>
                            </tr>
                        ) : (
                            filteredForecasts.map((item) => {
                                const hot = getDenominationHotStyle(item.denomination);
                                const isOutOfStock = item.alertLevel === 'OUT_OF_STOCK';
                                const isCritical = item.alertLevel === 'CRITICAL';
                                const isWarning = item.alertLevel === 'WARNING';
                                const percentAvailable = item.total > 0 ? Math.round((item.available / item.total) * 100) : 0;

                                return (
                                    <tr
                                        key={`${item.campaign_name}_${item.denomination}`}
                                        className={`hover:bg-slate-50/80 transition ${
                                            isOutOfStock
                                                ? 'bg-rose-50/40'
                                                : isCritical
                                                ? 'bg-amber-50/30'
                                                : ''
                                        }`}
                                    >
                                        {/* Chương Trình & Diễn Giải Điều Kiện */}
                                        <td className="py-2.5 px-3">
                                            <div className="font-black text-slate-900 text-xs line-clamp-1">
                                                {item.campaign_name}
                                            </div>
                                            {item.description ? (
                                                <div className="mt-1 space-y-0.5" title={item.description}>
                                                    {parseConditionLines(item.description).map((cond, cIdx) => (
                                                        <div key={cIdx} className="text-[10px] font-medium text-amber-950 flex items-start gap-1 leading-tight">
                                                            <span className="text-amber-500 font-bold shrink-0">•</span>
                                                            <span className="truncate max-w-[240px]">{cond}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-[10px] text-slate-400 italic mt-0.5">
                                                    Chưa cài đặt điều kiện
                                                </div>
                                            )}
                                        </td>

                                        {/* Mệnh Giá (Hiển thị theo thang màu độ hot) */}
                                        <td className="py-2.5 px-2 text-center">
                                            <div className="inline-flex flex-col items-center">
                                                <div className={`px-2 py-0.5 rounded-lg border font-mono font-black text-xs flex items-center gap-1 ${hot.badgeClass}`}>
                                                    <span className="text-[10px]">{hot.tagIcon}</span>
                                                    <span>{formatCurrency(item.denomination)}</span>
                                                </div>
                                                <span className="text-[9px] font-bold text-slate-400 mt-0.5">
                                                    {hot.label}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Tổng Kho Nạp */}
                                        <td className="py-2.5 px-2 text-right font-mono font-bold text-slate-600">
                                            {item.total.toLocaleString('vi-VN')}
                                        </td>

                                        {/* Đã Cấp (Claimed + Used) */}
                                        <td className="py-2.5 px-2 text-right font-mono font-bold text-indigo-700">
                                            {(item.claimed + item.used).toLocaleString('vi-VN')}
                                        </td>

                                        {/* Tồn Kho Khả Dụng */}
                                        <td className="py-2.5 px-2 text-right font-mono">
                                            <span className={`inline-block px-2 py-0.5 rounded font-black text-xs ${
                                                isOutOfStock
                                                    ? 'bg-rose-600 text-white'
                                                    : isCritical
                                                    ? 'bg-amber-100 text-amber-900 border border-amber-300 font-black'
                                                    : 'text-emerald-700 font-black bg-emerald-50'
                                            }`}>
                                                {item.available.toLocaleString('vi-VN')}
                                            </span>
                                            <div className="text-[9.5px] text-slate-400 font-normal mt-0.5">
                                                còn {percentAvailable}%
                                            </div>
                                        </td>

                                        {/* Tốc Độ Tiêu Thụ TB/Ngày */}
                                        <td className="py-2.5 px-2 text-center font-mono">
                                            <div className="font-bold text-slate-800 text-xs">
                                                ~{item.avgDailyUsage > 0 ? item.avgDailyUsage : 0} mã/ngày
                                            </div>
                                            <div className="text-[9px] text-slate-400">
                                                {item.claimed + item.used > 0 ? 'theo lịch sử cấp' : 'chưa có dữ liệu'}
                                            </div>
                                        </td>

                                        {/* Dự Báo Còn Bao Nhiêu Ngày */}
                                        <td className="py-2.5 px-2 text-center font-mono">
                                            {isOutOfStock ? (
                                                <span className="text-rose-600 font-black text-xs">
                                                    0 ngày
                                                </span>
                                            ) : item.daysRemaining !== Infinity ? (
                                                <span className={`font-black text-xs ${
                                                    isCritical ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-slate-800'
                                                }`}>
                                                    ~{item.daysRemaining} ngày
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 text-[10px]">
                                                    Dồi dào (∞)
                                                </span>
                                            )}
                                        </td>

                                        {/* Tình Trạng & Cảnh Báo Bổ Sung */}
                                        <td className="py-2.5 px-3 text-center">
                                            {isOutOfStock ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-black bg-rose-600 text-white shadow-xs animate-pulse">
                                                    <Flame className="w-3 h-3" /> ĐÃ HẾT MÃ
                                                </span>
                                            ) : isCritical ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                                                    <AlertTriangle className="w-3 h-3 text-rose-600" /> SẮP HẾT GẤP
                                                </span>
                                            ) : isWarning ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                                    <Clock className="w-3 h-3 text-amber-600" /> SẮP HẾT
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ĐỦ DÙNG
                                                </span>
                                            )}
                                        </td>

                                        {/* Nút Thao Tác Nhanh: Nạp Thêm Mã */}
                                        <td className="py-2.5 px-2 text-right">
                                            {onOpenImportModalWithPreset ? (
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenImportModalWithPreset(item.campaign_name, item.denomination, item.description)}
                                                    className={`px-2.5 py-1 rounded-xl text-xs font-black transition cursor-pointer inline-flex items-center gap-1 shadow-2xs active:scale-[0.98] ${
                                                        isOutOfStock || isCritical
                                                            ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                    }`}
                                                    title={`Nạp thêm mã cho chương trình "${item.campaign_name}" (${formatCurrency(item.denomination)})`}
                                                >
                                                    <Plus className="w-3 h-3" />
                                                    <span>Nạp Thêm</span>
                                                </button>
                                            ) : null}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </>
    )}
</div>
    );
}
