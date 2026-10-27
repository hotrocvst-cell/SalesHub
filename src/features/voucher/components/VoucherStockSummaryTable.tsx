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
    ChevronUp,
    Ban,
    Search,
    Eye,
    EyeOff
} from 'lucide-react';
import type { VoucherItem, VoucherStockForecast, VoucherCampaignStatusConfig } from '../types';
import { calculateStockForecasts, getDenominationHotStyle, formatCurrency, parseConditionLines } from '../voucherFormatters';

interface Props {
    vouchers: VoucherItem[];
    campaignStatuses?: Record<string, VoucherCampaignStatusConfig>;
    onOpenImportModalWithPreset?: (campaignName: string, denomination: number, description?: string) => void;
    onToggleCampaignEndStatus?: (campaignName: string, denomination: number, currentIsEnded: boolean) => void;
    onToggleCampaignHiddenStatus?: (campaignName: string, currentIsHidden: boolean) => void;
    defaultExpanded?: boolean;
}

export default function VoucherStockSummaryTable({
    vouchers,
    campaignStatuses,
    onOpenImportModalWithPreset,
    onToggleCampaignEndStatus,
    onToggleCampaignHiddenStatus,
    defaultExpanded = false
}: Props) {
    // Mặc định hiển thị thu gọn theo yêu cầu
    const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
    // Tùy chọn xem cả các chương trình đã ẩn (lưu trữ)
    const [showHidden, setShowHidden] = useState<boolean>(false);
    // Bộ lọc xem theo chương trình
    const [selectedCampaign, setSelectedCampaign] = useState<string>('ALL');
    // Bộ lọc trạng thái: mặc định hiển thị Cần nạp gấp và Sắp hết (NEED_ATTENTION)
    const [filterAlert, setFilterAlert] = useState<'NEED_ATTENTION' | 'SAFE' | 'ENDED' | 'ALL'>('NEED_ATTENTION');
    const [searchKeyword, setSearchKeyword] = useState<string>('');

    // Tính toán số liệu dự báo tồn kho và tốc độ tiêu thụ
    const forecasts = useMemo<VoucherStockForecast[]>(() => {
        return calculateStockForecasts(vouchers, campaignStatuses);
    }, [vouchers, campaignStatuses]);

    // Thống kê số lượng chương trình bị ẩn
    const hiddenForecastsCount = useMemo(() => {
        return forecasts.filter(f => f.is_hidden).length;
    }, [forecasts]);

    const hiddenCampaignNames = useMemo(() => {
        const set = new Set<string>();
        forecasts.forEach(f => {
            if (f.is_hidden) set.add(f.campaign_name.trim());
        });
        return Array.from(set);
    }, [forecasts]);

    // Danh sách các chương trình duy nhất từ dự báo
    const campaignOptions = useMemo<string[]>(() => {
        const set = new Set<string>();
        forecasts.forEach(f => {
            if (f.campaign_name && (showHidden || !f.is_hidden)) {
                set.add(f.campaign_name.trim());
            }
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
    }, [forecasts, showHidden]);

    // Các chương trình đang hoạt động (loại trừ đã ẩn) phục vụ thống kê cảnh báo chính
    const activeForecasts = useMemo(() => {
        return forecasts.filter(f => !f.is_hidden);
    }, [forecasts]);

    const urgentCount = useMemo(() => {
        return activeForecasts.filter(f => f.alertLevel === 'OUT_OF_STOCK' || f.alertLevel === 'CRITICAL').length;
    }, [activeForecasts]);

    const warningCount = useMemo(() => {
        return activeForecasts.filter(f => f.alertLevel === 'WARNING').length;
    }, [activeForecasts]);

    // Dữ liệu theo chương trình đang chọn (nếu có) để tính số lượng badge trên các nút lọc trạng thái
    const campaignScopedForecasts = useMemo(() => {
        let base = forecasts;
        if (!showHidden) {
            base = base.filter(f => !f.is_hidden);
        }
        if (selectedCampaign === 'ALL') return base;
        return base.filter(f => f.campaign_name.trim() === selectedCampaign.trim());
    }, [forecasts, showHidden, selectedCampaign]);

    const needAttentionCount = useMemo(() => {
        return campaignScopedForecasts.filter(f => f.alertLevel === 'OUT_OF_STOCK' || f.alertLevel === 'CRITICAL' || f.alertLevel === 'WARNING').length;
    }, [campaignScopedForecasts]);

    const safeCount = useMemo(() => {
        return campaignScopedForecasts.filter(f => f.alertLevel === 'SAFE' || f.alertLevel === 'INACTIVE').length;
    }, [campaignScopedForecasts]);

    const endedCount = useMemo(() => {
        return campaignScopedForecasts.filter(f => f.alertLevel === 'ENDED').length;
    }, [campaignScopedForecasts]);

    // Lọc theo chương trình, trạng thái cảnh báo, ẩn/hiện và từ khóa
    const filteredForecasts = useMemo(() => {
        let list = forecasts;

        // 0. Lọc theo ẩn/hiện chương trình
        if (!showHidden) {
            list = list.filter(f => !f.is_hidden);
        }

        // 1. Lọc theo chương trình
        if (selectedCampaign !== 'ALL') {
            list = list.filter(f => f.campaign_name.trim() === selectedCampaign.trim());
        }

        // 2. Lọc theo trạng thái cảnh báo (gộp chung Cần nạp gấp & Sắp hết, Đủ dùng, Đã kết thúc, Tất cả)
        if (filterAlert === 'NEED_ATTENTION') {
            list = list.filter(f => f.alertLevel === 'OUT_OF_STOCK' || f.alertLevel === 'CRITICAL' || f.alertLevel === 'WARNING');
        } else if (filterAlert === 'SAFE') {
            list = list.filter(f => f.alertLevel === 'SAFE' || f.alertLevel === 'INACTIVE');
        } else if (filterAlert === 'ENDED') {
            list = list.filter(f => f.alertLevel === 'ENDED');
        }
        // filterAlert === 'ALL' => không lọc bỏ theo trạng thái

        // 3. Lọc theo từ khóa tìm kiếm (nếu có)
        if (searchKeyword.trim()) {
            const q = searchKeyword.trim().toLowerCase();
            list = list.filter(f =>
                f.campaign_name.toLowerCase().includes(q) ||
                (f.description && f.description.toLowerCase().includes(q)) ||
                String(f.denomination).includes(q)
            );
        }

        return list;
    }, [forecasts, showHidden, selectedCampaign, filterAlert, searchKeyword]);

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
                                Tổng Hợp Số Lượng & Cảnh báo tồn kho PMH
                            </h2>
                            <span className="bg-slate-800 text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-700">
                                {filteredForecasts.length} loại PMH
                            </span>
                            {hiddenCampaignNames.length > 0 && (
                                <span className="bg-slate-800 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-700 flex items-center gap-1">
                                    <EyeOff className="w-2.5 h-2.5 text-amber-400" />
                                    <span>Đã ẩn {hiddenCampaignNames.length} CT</span>
                                </span>
                            )}
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
                            Phân tích trung bình cấp mã mỗi ngày và cảnh báo tồn kho PMH
                        </p>
                    </div>
                </div>

                {/* Nút bấm chuyển đổi thu gọn / mở rộng */}
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-amber-200/90 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-1.5 transition">
                        <span>{isExpanded ? 'Thu Gọn' : 'Xem Chi Tiết'}</span>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-amber-300" /> : <ChevronDown className="w-4 h-4 text-amber-300" />}
                    </span>
                </div>
            </div>

            {/* VÙNG NỘI DUNG MỞ RỘNG */}
            {isExpanded && (
                <>
                    {/* Thanh lọc chương trình, từ khóa & trạng thái cảnh báo */}
                    <div className="bg-slate-900/95 px-4 py-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-150">
                        {/* Nhóm 1: Bộ lọc Chương trình & Ô tìm kiếm */}
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <div className="flex items-center gap-2">
                                <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5 shrink-0">
                                    <Filter className="w-3.5 h-3.5 text-amber-400" />
                                    <span>Chương trình:</span>
                                </label>
                                <select
                                    value={selectedCampaign}
                                    onChange={(e) => setSelectedCampaign(e.target.value)}
                                    className="bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-xl px-3 py-1.5 text-xs font-bold text-amber-300 focus:outline-none focus:border-amber-400 max-w-[220px] sm:max-w-[280px] truncate cursor-pointer shadow-xs transition"
                                >
                                    <option value="ALL">✨ Tất Cả Chương Trình ({campaignOptions.length})</option>
                                    {campaignOptions.map((c) => (
                                        <option key={c} value={c} className="bg-slate-900 text-white">
                                            {c}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Ô tìm kiếm nhanh */}
                            <div className="relative min-w-[140px] max-w-[190px]">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={searchKeyword}
                                    onChange={(e) => setSearchKeyword(e.target.value)}
                                    placeholder="Tìm mệnh giá, ghi chú..."
                                    className="w-full pl-8 pr-6 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-400"
                                />
                                {searchKeyword && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchKeyword('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
                                        title="Xóa tìm kiếm"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Nhóm 2: Bộ lọc 4 trạng thái cảnh báo */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {/* 1. Tất Cả */}
                            <button
                                type="button"
                                onClick={() => setFilterAlert('ALL')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${filterAlert === 'ALL'
                                    ? 'bg-white text-slate-900 shadow-xs'
                                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                                    }`}
                            >
                                <Layers className="w-3.5 h-3.5" />
                                <span>Tất Cả ({campaignScopedForecasts.length})</span>
                            </button>

                            {/* 2. Gộp chung Cần nạp gấp & Sắp hết */}
                            <button
                                type="button"
                                onClick={() => setFilterAlert('NEED_ATTENTION')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${filterAlert === 'NEED_ATTENTION'
                                    ? 'bg-rose-600 text-white shadow-xs'
                                    : 'bg-slate-800/80 text-rose-300 hover:bg-rose-950/50'
                                    }`}
                            >
                                <Flame className="w-3.5 h-3.5" />
                                <span>Cần Nạp Gấp & Sắp Hết ({needAttentionCount})</span>
                            </button>

                            {/* 3. Đủ dùng */}
                            <button
                                type="button"
                                onClick={() => setFilterAlert('SAFE')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${filterAlert === 'SAFE'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'bg-slate-800/80 text-emerald-300 hover:bg-emerald-950/50'
                                    }`}
                            >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Đủ Dùng ({safeCount})</span>
                            </button>

                            {/* 4. Đã kết thúc */}
                            <button
                                type="button"
                                onClick={() => setFilterAlert('ENDED')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${filterAlert === 'ENDED'
                                    ? 'bg-slate-700 text-white shadow-xs'
                                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                                    }`}
                            >
                                <Ban className="w-3.5 h-3.5 text-rose-400" />
                                <span>Đã Kết Thúc ({endedCount})</span>
                            </button>

                            {/* 5. Nút bật/tắt hiển thị các chương trình đã ẩn */}
                            {hiddenForecastsCount > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setShowHidden(!showHidden)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 border ${
                                        showHidden
                                            ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-xs'
                                            : 'bg-slate-800/80 text-amber-300 hover:bg-slate-800 border-slate-700'
                                    }`}
                                    title={showHidden ? "Đang xem cả các chương trình đã ẩn (bấm để ẩn lại)" : "Bấm để xem các chương trình đã ẩn (lưu trữ)"}
                                >
                                    {showHidden ? <Eye className="w-3.5 h-3.5 text-slate-950" /> : <EyeOff className="w-3.5 h-3.5 text-amber-400" />}
                                    <span>{showHidden ? `Đang Hiện Đã Ẩn (${hiddenForecastsCount})` : `Hiện Đã Ẩn (${hiddenForecastsCount})`}</span>
                                </button>
                            )}
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
                                    <th className="py-3 px-2 text-center" style={{ width: '110px' }}>TB/Ngày</th>
                                    <th className="py-3 px-2 text-center" style={{ width: '110px' }}>Dự Báo Còn</th>
                                    <th className="py-3 px-3 text-center">Tình Trạng & Cảnh Báo</th>
                                    <th className="py-3 px-2 text-right" style={{ minWidth: '150px' }}>Thao Tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredForecasts.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="py-8 text-center text-slate-500 font-bold">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                                    {filterAlert === 'NEED_ATTENTION' ? (
                                                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                                    ) : (
                                                        <Filter className="w-5 h-5 text-slate-400" />
                                                    )}
                                                </div>
                                                <div className="text-sm font-black text-slate-700">
                                                    {filterAlert === 'NEED_ATTENTION'
                                                        ? 'Không có loại PMH nào ở trạng thái Cần nạp gấp hoặc Sắp hết.'
                                                        : 'Không có loại PMH nào thỏa mãn điều kiện lọc.'}
                                                </div>
                                                {filterAlert === 'NEED_ATTENTION' && campaignScopedForecasts.length > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setFilterAlert('ALL')}
                                                        className="mt-1 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                                                    >
                                                        <Layers className="w-3.5 h-3.5" />
                                                        <span>Xem tất cả ({campaignScopedForecasts.length} loại PMH)</span>
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredForecasts.map((item) => {
                                        const hot = getDenominationHotStyle(item.denomination);
                                        const isEnded = item.alertLevel === 'ENDED' || Boolean(item.is_ended);
                                        const isOutOfStock = !isEnded && item.alertLevel === 'OUT_OF_STOCK';
                                        const isCritical = !isEnded && item.alertLevel === 'CRITICAL';
                                        const isWarning = !isEnded && item.alertLevel === 'WARNING';
                                        const percentAvailable = item.total > 0 ? Math.round((item.available / item.total) * 100) : 0;

                                        return (
                                            <tr
                                                key={`${item.campaign_name}_${item.denomination}`}
                                                className={`hover:bg-slate-50/80 transition ${isEnded
                                                    ? 'bg-slate-100/60 opacity-80'
                                                    : isOutOfStock
                                                        ? 'bg-rose-50/40'
                                                        : isCritical
                                                            ? 'bg-amber-50/30'
                                                            : ''
                                                    }`}
                                            >
                                                {/* Chương Trình & Diễn Giải Điều Kiện */}
                                                <td className="py-2.5 px-3">
                                                    <div className="font-black text-slate-900 text-xs line-clamp-1 flex items-center gap-1.5 flex-wrap">
                                                        <span>{item.campaign_name}</span>
                                                        {item.is_hidden && (
                                                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 border border-slate-300 inline-flex items-center gap-0.5" title="Chương trình này đã được ẩn khỏi danh sách lấy mã">
                                                                <EyeOff className="w-2.5 h-2.5 text-slate-500" />
                                                                <span>Đã ẩn</span>
                                                            </span>
                                                        )}
                                                        {isEnded && !item.is_hidden && (
                                                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 border border-rose-200">
                                                                Đã đóng
                                                            </span>
                                                        )}
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
                                                    <span className={`inline-block px-2 py-0.5 rounded font-black text-xs ${isEnded
                                                        ? 'bg-slate-200 text-slate-600'
                                                        : isOutOfStock
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
                                                    {isEnded ? (
                                                        <span className="text-slate-400 font-bold text-xs">
                                                            Đã kết thúc
                                                        </span>
                                                    ) : isOutOfStock ? (
                                                        <span className="text-rose-600 font-black text-xs">
                                                            0 ngày
                                                        </span>
                                                    ) : item.daysRemaining !== Infinity ? (
                                                        <span className={`font-black text-xs ${isCritical ? 'text-rose-600' : isWarning ? 'text-amber-600' : 'text-slate-800'
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
                                                    {isEnded ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-slate-900 text-rose-300 border border-rose-500/40 shadow-xs">
                                                            <Ban className="w-3 h-3 text-rose-400" /> HẾT MÃ - KẾT THÚC
                                                        </span>
                                                    ) : isOutOfStock ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-600 text-white shadow-xs animate-pulse">
                                                            <Flame className="w-3 h-3" /> TẠM HẾT (CHỜ NẠP)
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

                                                {/* Nút Thao Tác Nhanh: Nạp Thêm Mã & Toggle Kết Thúc */}
                                                <td className="py-2.5 px-2 text-right">
                                                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                                        {onOpenImportModalWithPreset && !isEnded && (
                                                            <button
                                                                type="button"
                                                                onClick={() => onOpenImportModalWithPreset(item.campaign_name, item.denomination, item.description)}
                                                                className={`px-2 py-1 rounded-xl text-xs font-black transition cursor-pointer inline-flex items-center gap-1 shadow-2xs active:scale-[0.98] ${isOutOfStock || isCritical
                                                                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                                    }`}
                                                                title={`Nạp thêm mã cho chương trình "${item.campaign_name}" (${formatCurrency(item.denomination)})`}
                                                            >
                                                                <Plus className="w-3 h-3" />
                                                                <span>Nạp Thêm</span>
                                                            </button>
                                                        )}

                                                        {onToggleCampaignEndStatus && (
                                                            isEnded ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onToggleCampaignEndStatus(item.campaign_name, item.denomination, true)}
                                                                    className="px-2 py-1 rounded-xl text-[10.5px] font-black transition cursor-pointer inline-flex items-center gap-1 shadow-2xs active:scale-[0.98] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300"
                                                                    title="Mở lại khả năng nạp thêm cho chương trình/mệnh giá này"
                                                                >
                                                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                                    <span>Mở Lại</span>
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onToggleCampaignEndStatus(item.campaign_name, item.denomination, false)}
                                                                    className="px-2 py-1 rounded-xl text-[10.5px] font-bold transition cursor-pointer inline-flex items-center gap-1 shadow-2xs active:scale-[0.98] bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-300"
                                                                    title="Đánh dấu hết mã hoàn toàn - Kết thúc chương trình"
                                                                >
                                                                    <Ban className="w-3 h-3 text-rose-500" />
                                                                    <span>Kết Thúc</span>
                                                                </button>
                                                            )
                                                        )}

                                                        {onToggleCampaignHiddenStatus && (
                                                            item.is_hidden ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onToggleCampaignHiddenStatus(item.campaign_name, true)}
                                                                    className="px-2 py-1 rounded-xl text-[10.5px] font-black transition cursor-pointer inline-flex items-center gap-1 shadow-2xs active:scale-[0.98] bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300"
                                                                    title={`Hiện lại chương trình "${item.campaign_name}" trên hệ thống`}
                                                                >
                                                                    <Eye className="w-3 h-3 text-amber-600" />
                                                                    <span>Hiện CT</span>
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => onToggleCampaignHiddenStatus(item.campaign_name, false)}
                                                                    className="px-2 py-1 rounded-xl text-[10.5px] font-bold transition cursor-pointer inline-flex items-center gap-1 shadow-2xs active:scale-[0.98] bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-800 border border-slate-200 hover:border-amber-300"
                                                                    title={`Ẩn chương trình "${item.campaign_name}" để lưu trữ và rút gọn danh sách`}
                                                                >
                                                                    <EyeOff className="w-3 h-3 text-slate-500" />
                                                                    <span>Ẩn CT</span>
                                                                </button>
                                                            )
                                                        )}
                                                    </div>
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
