import { useState, useEffect, useMemo } from 'react';
import type { StoreItem } from '../../../core/lib/storage';
import {
    getStoreOperatingConfig,
    saveStoreOperatingConfig,
    getTopBotConfig,
    saveTopBotConfig,
    type TopBotConfig
} from '../utils/performanceConfig';
import {
    X,
    Clock,
    Calendar,
    Trophy,
    Store,
    Save,
    RotateCcw,
    CheckCircle2,
    Users
} from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    stores: StoreItem[];
    currentStoreName: string;
    month: number;
    year: number;
    totalEmployees: number;
    onConfigSaved: () => void;
}

export default function PerformanceConfigModal({
    isOpen,
    onClose,
    stores,
    currentStoreName,
    month,
    year,
    totalEmployees,
    onConfigSaved
}: Props) {
    const [activeTab, setActiveTab] = useState<'operating' | 'topbot'>('operating');

    // State Cấu hình hoạt động shop
    const [selectedStore, setSelectedStore] = useState<string>(currentStoreName || 'all');
    const [openTime, setOpenTime] = useState<string>('08:00');
    const [closeTime, setCloseTime] = useState<string>('22:00');
    const [operatingDays, setOperatingDays] = useState<number>(30);
    const [defaultDays, setDefaultDays] = useState<number>(30);
    const [applyToAllStores, setApplyToAllStores] = useState<boolean>(true);

    // State Cấu hình TOP/BOT
    const [topBotMode, setTopBotMode] = useState<'PERCENT' | 'COUNT'>('PERCENT');
    const [topValue, setTopValue] = useState<number>(20);
    const [botValue, setBotValue] = useState<number>(20);
    const [rankBy, setRankBy] = useState<TopBotConfig['rankBy']>('FORECAST_COMPLETION_RATE');

    const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

    // Nạp cấu hình hiện tại khi mở modal hoặc đổi tháng/năm/shop
    useEffect(() => {
        if (!isOpen) return;

        setSelectedStore(currentStoreName || 'all');

        const opCfg = getStoreOperatingConfig(
            currentStoreName === 'all' ? 'ALL' : currentStoreName,
            month,
            year
        );
        setOpenTime(opCfg.openTime);
        setCloseTime(opCfg.closeTime);
        setOperatingDays(opCfg.operatingDays);
        setDefaultDays(opCfg.defaultDays);

        const tbCfg = getTopBotConfig();
        setTopBotMode(tbCfg.mode);
        setTopValue(tbCfg.topValue);
        setBotValue(tbCfg.botValue);
        setRankBy(tbCfg.rankBy);

        setSavedSuccess(false);
    }, [isOpen, currentStoreName, month, year]);

    // Khi chọn shop khác trong tab hoạt động
    const handleStoreChange = (sName: string) => {
        setSelectedStore(sName);
        const opCfg = getStoreOperatingConfig(sName === 'all' ? 'ALL' : sName, month, year);
        setOpenTime(opCfg.openTime);
        setCloseTime(opCfg.closeTime);
        setOperatingDays(opCfg.operatingDays);
        setDefaultDays(opCfg.defaultDays);
    };

    // Số giờ mở cửa tính toán tự động
    const computedHours = useMemo(() => {
        try {
            const [openH, openM] = openTime.split(':').map(Number);
            const [closeH, closeM] = closeTime.split(':').map(Number);
            const diff = (closeH + (closeM || 0) / 60) - (openH + (openM || 0) / 60);
            return diff > 0 ? Number(diff.toFixed(1)) : 14;
        } catch {
            return 14;
        }
    }, [openTime, closeTime]);

    // Dự kiến phân bổ số lượng TOP/BOT theo cấu hình hiện tại
    const previewDistribution = useMemo(() => {
        const total = Math.max(1, totalEmployees);
        let topCount = 0;
        let botCount = 0;

        if (topBotMode === 'PERCENT') {
            topCount = Math.max(1, Math.round(total * (Math.max(1, topValue) / 100)));
            botCount = Math.max(1, Math.round(total * (Math.max(1, botValue) / 100)));
        } else {
            topCount = Math.max(1, Math.min(total, Math.round(topValue)));
            botCount = Math.max(1, Math.min(total, Math.round(botValue)));
        }

        if (topCount + botCount > total) {
            const diff = (topCount + botCount) - total;
            botCount = Math.max(1, botCount - diff);
        }

        const midCount = Math.max(0, total - topCount - botCount);
        return { topCount, botCount, midCount };
    }, [totalEmployees, topBotMode, topValue, botValue]);

    // Xử lý lưu
    const handleSave = () => {
        const allStoreNames = stores.map(s => s.name);

        // 1. Lưu cấu hình shop
        saveStoreOperatingConfig(
            selectedStore === 'all' ? 'ALL' : selectedStore,
            month,
            year,
            {
                openTime,
                closeTime,
                operatingDays: Number(operatingDays) || defaultDays,
                applyToAll: applyToAllStores || selectedStore === 'all'
            },
            allStoreNames
        );

        // 2. Lưu cấu hình TOP/BOT
        saveTopBotConfig({
            mode: topBotMode,
            topValue: Number(topValue) || 20,
            botValue: Number(botValue) || 20,
            rankBy
        });

        setSavedSuccess(true);
        onConfigSaved();
        setTimeout(() => {
            onClose();
        }, 800);
    };

    const handleResetDefaults = () => {
        setOpenTime('08:00');
        setCloseTime('22:00');
        setOperatingDays(defaultDays);
        setTopBotMode('PERCENT');
        setTopValue(20);
        setBotValue(20);
        setRankBy('FORECAST_COMPLETION_RATE');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-2xl w-full flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                            <span>⚙️ Cấu Hình Hoạt Động Shop & Đánh Giá TOP / BOT</span>
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Cấu hình áp dụng cho Tháng {month}/{year}
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs Switcher */}
                <div className="flex border-b border-slate-200 bg-slate-100/50 p-1.5 gap-1.5">
                    <button
                        type="button"
                        onClick={() => setActiveTab('operating')}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                            activeTab === 'operating'
                                ? 'bg-white text-blue-800 shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Clock className="w-4 h-4 text-blue-600" />
                        <span>1. Giờ Mở Cửa & Số Ngày Shop Hoạt Động</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveTab('topbot')}
                        className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer ${
                            activeTab === 'topbot'
                                ? 'bg-white text-amber-800 shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Trophy className="w-4 h-4 text-amber-500" />
                        <span>2. Tiêu Chí Phân Loại TOP / BOT</span>
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-6 space-y-5">
                    {/* TAB 1: THỜI GIAN & SỐ NGÀY HOẠT ĐỘNG CỦA SHOP */}
                    {activeTab === 'operating' && (
                        <div className="space-y-4">
                            {/* Chọn siêu thị áp dụng */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Siêu thị cần cấu hình:
                                </label>
                                <div className="flex items-center gap-2">
                                    <Store className="w-4 h-4 text-slate-400 shrink-0" />
                                    <select
                                        value={selectedStore}
                                        onChange={e => handleStoreChange(e.target.value)}
                                        className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl outline-hidden focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20"
                                    >
                                        <option value="all">🏢 Toàn Cụm Siêu Thị (Áp dụng chung)</option>
                                        {stores.map(s => (
                                            <option key={s.id || s.code} value={s.name}>
                                                {s.name} ({s.code})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Giờ mở cửa & Giờ đóng cửa */}
                            <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                                        <Clock className="w-4 h-4 text-blue-600" />
                                        <span>Thời gian bán hàng mỗi ngày</span>
                                    </span>
                                    <span className="text-xs font-extrabold text-blue-700 bg-blue-100/80 px-2.5 py-0.5 rounded-lg font-mono">
                                        {computedHours} giờ / ngày
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                            Giờ mở cửa shop:
                                        </label>
                                        <input
                                            type="time"
                                            value={openTime}
                                            onChange={e => setOpenTime(e.target.value)}
                                            className="w-full text-xs font-mono font-bold text-slate-900 bg-white border border-slate-200 px-3 py-2 rounded-xl outline-hidden focus:border-blue-600"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                            Giờ đóng cửa shop:
                                        </label>
                                        <input
                                            type="time"
                                            value={closeTime}
                                            onChange={e => setCloseTime(e.target.value)}
                                            className="w-full text-xs font-mono font-bold text-slate-900 bg-white border border-slate-200 px-3 py-2 rounded-xl outline-hidden focus:border-blue-600"
                                        />
                                    </div>
                                </div>
                                <p className="text-[11px] text-slate-500">
                                    Ví dụ: Siêu thị mở từ <strong>08:00</strong> sáng đến <strong>22:00</strong> tối = 14 tiếng phục vụ khách hàng.
                                </p>
                            </div>

                            {/* Số ngày hoạt động trong tháng */}
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                        <Calendar className="w-4 h-4 text-amber-600" />
                                        <span>Số ngày siêu thị hoạt động (Tháng {month}/{year})</span>
                                    </span>
                                    <span className="text-[11px] text-slate-500">
                                        Lịch chuẩn: <strong className="text-slate-800">{defaultDays} ngày</strong>
                                    </span>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="w-32">
                                        <input
                                            type="number"
                                            min={1}
                                            max={31}
                                            value={operatingDays}
                                            onChange={e => setOperatingDays(Number(e.target.value))}
                                            className="w-full text-center text-sm font-mono font-extrabold text-blue-900 bg-white border border-slate-200 px-3 py-2 rounded-xl outline-hidden focus:border-blue-600"
                                        />
                                    </div>
                                    <span className="text-xs font-bold text-slate-700">ngày hoạt động thực tế</span>
                                </div>

                                <p className="text-[11px] text-slate-500">
                                    💡 <em>Ghi chú của Boss:</em> Mặc định là số ngày trong tháng ({defaultDays} ngày). Nếu siêu thị có ngày đóng cửa sửa chữa hoặc nghỉ lễ, Boss điều chỉnh tay số ngày này để hệ thống tính toán <strong>% Dự báo hoàn thành (%DKHT)</strong> chuẩn xác nhất.
                                </p>
                            </div>

                            {/* Tùy chọn áp dụng tất cả */}
                            <label className="flex items-center gap-2 cursor-pointer pt-1">
                                <input
                                    type="checkbox"
                                    checked={applyToAllStores}
                                    onChange={e => setApplyToAllStores(e.target.checked)}
                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <span className="text-xs font-semibold text-slate-700">
                                    Đồng bộ thời gian mở cửa & số ngày hoạt động này cho toàn bộ các shop trong cụm
                                </span>
                            </label>
                        </div>
                    )}

                    {/* TAB 2: CẤU HÌNH ĐÁNH GIÁ TOP / BOT */}
                    {activeTab === 'topbot' && (
                        <div className="space-y-4">
                            {/* Chế độ chọn TOP/BOT */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-2">
                                    Phương thức xác định nhóm TOP & BOT:
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    <label
                                        className={`p-3 rounded-2xl border flex items-center gap-2.5 cursor-pointer transition ${
                                            topBotMode === 'PERCENT'
                                                ? 'bg-amber-50/70 border-amber-300 text-amber-900'
                                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="topBotMode"
                                            checked={topBotMode === 'PERCENT'}
                                            onChange={() => setTopBotMode('PERCENT')}
                                            className="text-amber-600 focus:ring-amber-500 cursor-pointer"
                                        />
                                        <div>
                                            <span className="text-xs font-extrabold block">Theo Tỷ Lệ Phần Trăm (%)</span>
                                            <span className="text-[10px] text-slate-500 block">Ví dụ: TOP 20% & BOT 20% nhân sự</span>
                                        </div>
                                    </label>

                                    <label
                                        className={`p-3 rounded-2xl border flex items-center gap-2.5 cursor-pointer transition ${
                                            topBotMode === 'COUNT'
                                                ? 'bg-blue-50/70 border-blue-300 text-blue-900'
                                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="topBotMode"
                                            checked={topBotMode === 'COUNT'}
                                            onChange={() => setTopBotMode('COUNT')}
                                            className="text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        />
                                        <div>
                                            <span className="text-xs font-extrabold block">Theo Số Lượng Cố Định (Số NV)</span>
                                            <span className="text-[10px] text-slate-500 block">Ví dụ: TOP 3 bạn & BOT 3 bạn</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Thiết lập giá trị TOP & BOT */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3.5 bg-amber-50/60 rounded-2xl border border-amber-200 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-amber-900 flex items-center gap-1">
                                            <Trophy className="w-3.5 h-3.5 text-amber-500" />
                                            <span>Nhóm Xuất Sắc (TOP)</span>
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min={1}
                                            max={topBotMode === 'PERCENT' ? 90 : totalEmployees}
                                            value={topValue}
                                            onChange={e => setTopValue(Number(e.target.value))}
                                            className="w-full text-center text-sm font-mono font-extrabold text-amber-900 bg-white border border-amber-300 px-3 py-2 rounded-xl outline-hidden focus:border-amber-600"
                                        />
                                        <span className="text-xs font-bold text-amber-900">
                                            {topBotMode === 'PERCENT' ? '%' : 'NV'}
                                        </span>
                                    </div>
                                </div>

                                <div className="p-3.5 bg-rose-50/60 rounded-2xl border border-rose-200 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-rose-900 flex items-center gap-1">
                                            ⚠️ <span>Nhóm Cần Tăng Tốc (BOT)</span>
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min={1}
                                            max={topBotMode === 'PERCENT' ? 90 : totalEmployees}
                                            value={botValue}
                                            onChange={e => setBotValue(Number(e.target.value))}
                                            className="w-full text-center text-sm font-mono font-extrabold text-rose-900 bg-white border border-rose-300 px-3 py-2 rounded-xl outline-hidden focus:border-rose-600"
                                        />
                                        <span className="text-xs font-bold text-rose-900">
                                            {topBotMode === 'PERCENT' ? '%' : 'NV'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Tiêu chí xếp hạng */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Tiêu chí xếp thứ hạng TOP / BOT:
                                </label>
                                <select
                                    value={rankBy}
                                    onChange={e => setRankBy(e.target.value as TopBotConfig['rankBy'])}
                                    className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl outline-hidden focus:border-blue-600"
                                >
                                    <option value="FORECAST_COMPLETION_RATE">🎯 % Dự Kiến Hoàn Thành (%DKHT) - [Mặc định]</option>
                                    <option value="REVENUE_QD">💎 Lũy Kế DT Quy Đổi (DTQĐ)</option>
                                    <option value="REVENUE_ACTUAL">💵 Lũy Kế DT Thực Tế</option>
                                    <option value="COMPLETION_RATE">📊 % Hoàn Thành Mục Tiêu (%HT real)</option>
                                </select>
                            </div>

                            {/* Khung mô phỏng phân bổ trực quan */}
                            <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2 text-xs">
                                <div className="flex items-center justify-between text-slate-300">
                                    <span className="font-bold flex items-center gap-1.5">
                                        <Users className="w-4 h-4 text-blue-400" />
                                        <span>Mô phỏng phân bổ với {totalEmployees} nhân sự hiện tại:</span>
                                    </span>
                                </div>

                                <div className="grid grid-cols-3 gap-2 pt-1 text-center font-mono">
                                    <div className="bg-amber-500/20 border border-amber-500/30 p-2 rounded-xl">
                                        <div className="text-[10px] text-amber-300 uppercase font-bold">🏆 Nhóm TOP</div>
                                        <div className="text-base font-black text-amber-400 mt-0.5">
                                            {previewDistribution.topCount} NV
                                        </div>
                                    </div>

                                    <div className="bg-slate-800 border border-slate-700 p-2 rounded-xl">
                                        <div className="text-[10px] text-slate-400 uppercase font-bold">⭐️ Nhóm MID</div>
                                        <div className="text-base font-black text-slate-200 mt-0.5">
                                            {previewDistribution.midCount} NV
                                        </div>
                                    </div>

                                    <div className="bg-rose-500/20 border border-rose-500/30 p-2 rounded-xl">
                                        <div className="text-[10px] text-rose-300 uppercase font-bold">⚠️ Nhóm BOT</div>
                                        <div className="text-base font-black text-rose-400 mt-0.5">
                                            {previewDistribution.botCount} NV
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Modal */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={handleResetDefaults}
                        className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 transition cursor-pointer"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Mặc định ban đầu</span>
                    </button>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                            Đóng
                        </button>

                        <button
                            type="button"
                            onClick={handleSave}
                            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                        >
                            {savedSuccess ? (
                                <>
                                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                                    <span>Đã Lưu!</span>
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    <span>Lưu Cấu Hình</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
