import { useState, useEffect, useMemo } from 'react';
import type { CampaignDictItem, StoreItem } from '../../../core/lib/storage';
import {
    getStoreCampaignScoreConfig,
    saveStoreCampaignScoreConfig,
    type StoreCampaignScoreConfig,
    type CampaignScoringMode
} from '../../../core/lib/storeCampaignScoreService';
import { getShortStoreName, isStoreMatch } from '../../../core/lib/formatters';
import {
    Trophy,
    Award,
    CheckCircle2,
    SlidersHorizontal,
    Save,
    RotateCcw,
    Search,
    AlertCircle,
    Info,
    Store,
    Layers,
    Sparkles,
    Check,
    Copy,
    Building2,
    Coins,
    Hash
} from 'lucide-react';

interface Props {
    campaigns: CampaignDictItem[];
    stores: StoreItem[];
    currentUser: any;
    isAdmin: boolean;
    canAccessStore: (storeName: string) => boolean;
    showToast: (msg: string) => void;
    onHasChangesChange?: (hasChanges: boolean) => void;
    onSavedSuccess?: () => void;
    saveTrigger?: number;
}

export default function StoreCampaignScoreTab({
    campaigns,
    stores,
    currentUser,
    isAdmin,
    canAccessStore,
    showToast,
    onHasChangesChange,
    onSavedSuccess,
    saveTrigger
}: Props) {
    // 1. Danh sách siêu thị khả dụng theo phân quyền của user hiện tại
    const allowedStores = useMemo(() => {
        if (isAdmin) return stores;
        const accessible = currentUser?.accessible_stores && currentUser.accessible_stores.length > 0
            ? currentUser.accessible_stores
            : (currentUser?.store_name ? [currentUser.store_name] : []);

        if (accessible.length === 0) return stores;
        return stores.filter(s => accessible.some((acc: string) => isStoreMatch(s.name, acc, stores)));
    }, [stores, currentUser, isAdmin]);

    // Siêu thị đang chọn cấu hình
    const [selectedStore, setSelectedStore] = useState<string>(() => {
        if (allowedStores.length > 0) return allowedStores[0].name;
        return 'DEFAULT';
    });

    // Cập nhật selectedStore nếu danh sách thay đổi
    useEffect(() => {
        if (selectedStore === 'DEFAULT' && !isAdmin && allowedStores.length > 0) {
            setSelectedStore(allowedStores[0].name);
        }
    }, [allowedStores, isAdmin, selectedStore]);

    // State cấu hình điểm đang chỉnh sửa
    const [scoringMode, setScoringMode] = useState<CampaignScoringMode>('COUNT');
    const [campaignScores, setCampaignScores] = useState<Record<string, number>>({});
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [applyToAllMyStores, setApplyToAllMyStores] = useState<boolean>(false);

    // Tìm kiếm & Lọc trong bảng cấu hình
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [filterScoreType, setFilterScoreType] = useState<'ALL' | 'CUSTOM' | 'DEFAULT'>('ALL');

    const updateHasChanges = (val: boolean) => {
        setHasUnsavedChanges(val);
        onHasChangesChange?.(val);
    };

    // Nạp cấu hình khi đổi siêu thị
    useEffect(() => {
        const cfg = getStoreCampaignScoreConfig(selectedStore);
        setScoringMode(cfg.scoring_mode || 'COUNT');
        setCampaignScores({ ...(cfg.campaign_scores || {}) });
        updateHasChanges(false);
        setApplyToAllMyStores(false);
    }, [selectedStore]);

    // Lắng nghe trigger lưu từ bên ngoài (nếu người dùng bấm sync trên thanh trạng thái Cloud)
    useEffect(() => {
        if (saveTrigger && saveTrigger > 0) {
            handleSave();
        }
    }, [saveTrigger]);

    // Thay đổi số điểm của 1 chương trình
    const handleScoreChange = (key: string, val: number) => {
        const safeVal = Math.max(0.1, Number(val) || 1);
        setCampaignScores(prev => ({
            ...prev,
            [key]: safeVal
        }));
        updateHasChanges(true);
    };

    // Điều chỉnh nhanh tăng/giảm điểm
    const handleAdjustScore = (key: string, delta: number) => {
        const current = campaignScores[key] !== undefined ? campaignScores[key] : 1;
        const next = Math.max(0.5, Number((current + delta).toFixed(1)));
        handleScoreChange(key, next);
    };

    // Đặt nhanh tất cả điểm về 1 giá trị
    const handleSetAllPoints = (pts: number) => {
        const updated: Record<string, number> = {};
        campaigns.forEach(c => {
            updated[c.raw_key] = pts;
        });
        setCampaignScores(updated);
        updateHasChanges(true);
        showToast(`⚡ Đã đặt tất cả chương trình về ${pts} điểm!`);
    };

    // Khôi phục về mặc định
    const handleResetToDefault = () => {
        if (!window.confirm(`Bạn có chắc muốn khôi phục cấu hình điểm của siêu thị "${selectedStore}" về mặc định (1 điểm mỗi mục)?`)) return;
        setCampaignScores({});
        setScoringMode('COUNT');
        updateHasChanges(true);
        showToast('🔄 Đã khôi phục cấu hình về mặc định!');
    };

    // Lưu cấu hình
    const handleSave = async () => {
        setIsSaving(true);
        const configToSave: StoreCampaignScoreConfig = {
            store_name: selectedStore,
            scoring_mode: scoringMode,
            campaign_scores: campaignScores
        };

        const targetStores = applyToAllMyStores
            ? allowedStores.map(s => s.name)
            : undefined;

        const res = await saveStoreCampaignScoreConfig(configToSave, {
            applyToStoreNames: targetStores,
            userName: currentUser?.full_name || currentUser?.email || 'Quản lý'
        });

        setIsSaving(false);
        if (res.success) {
            updateHasChanges(false);
            onSavedSuccess?.();
            if (applyToAllMyStores && allowedStores.length > 1) {
                showToast(`💾 Đã lưu và áp dụng cấu hình điểm cho toàn bộ ${allowedStores.length} siêu thị phụ trách!`);
            } else {
                const sLabel = selectedStore === 'DEFAULT' ? 'Mặc định chung' : getShortStoreName(selectedStore);
                showToast(`💾 Đã lưu thành công cấu hình điểm cho [${sLabel}]!`);
            }
        } else {
            showToast(`⚠️ Lỗi khi lưu cấu hình: ${res.error || 'Vui lòng thử lại'}`);
        }
    };

    // Lọc danh sách thi đua hiển thị
    const filteredCampaigns = useMemo(() => {
        return campaigns.filter(item => {
            // Lọc tìm kiếm
            const q = searchQuery.toLowerCase().trim();
            const matchesQuery = (
                q === '' ||
                item.raw_key.toLowerCase().includes(q) ||
                item.display_name.toLowerCase().includes(q) ||
                (item.unit && item.unit.toLowerCase().includes(q))
            );

            // Lọc loại điểm
            const score = campaignScores[item.raw_key] !== undefined ? campaignScores[item.raw_key] : 1;
            let matchesType = true;
            if (filterScoreType === 'CUSTOM') {
                matchesType = score !== 1;
            } else if (filterScoreType === 'DEFAULT') {
                matchesType = score === 1;
            }

            return matchesQuery && matchesType;
        });
    }, [campaigns, searchQuery, filterScoreType, campaignScores]);

    // Thống kê điểm số
    const stats = useMemo(() => {
        let totalMaxPoints = 0;
        let customCount = 0;
        let activeCount = campaigns.length;

        campaigns.forEach(c => {
            const pts = campaignScores[c.raw_key] !== undefined ? campaignScores[c.raw_key] : 1;
            totalMaxPoints += pts;
            if (pts !== 1) customCount++;
        });

        return {
            totalCampaigns: activeCount,
            totalMaxPoints: Number(totalMaxPoints.toFixed(1)),
            customCount
        };
    }, [campaigns, campaignScores]);

    return (
        <div className="space-y-5 animate-in fade-in duration-200">
            {/* 1. KHU VỰC CHỌN SIÊU THỊ & CẢNH BÁO */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-sm shrink-0">
                        <Store className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md uppercase tracking-wider">
                                Siêu thị áp dụng
                            </span>
                            <span className="text-xs text-slate-400 font-medium">
                                (Tùy chọn cấu hình riêng cho từng siêu thị)
                            </span>
                        </div>
                        <h3 className="text-base font-black text-slate-800 mt-0.5">
                            {selectedStore === 'DEFAULT' ? 'CẤU HÌNH MẪU CHUNG TOÀN HỆ THỐNG' : selectedStore}
                        </h3>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-700">
                        <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
                        <select
                            value={selectedStore}
                            onChange={(e) => setSelectedStore(e.target.value)}
                            className="bg-transparent outline-none font-bold text-slate-800 cursor-pointer max-w-[260px] truncate"
                        >
                            {isAdmin && (
                                <option value="DEFAULT">🏢 CẤU HÌNH MẪU CHUNG (DEFAULT)</option>
                            )}
                            {allowedStores.map(s => (
                                <option key={s.id || s.name} value={s.name}>
                                    {s.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50 ${hasUnsavedChanges
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-400 animate-pulse'
                            : 'bg-slate-800 hover:bg-slate-900 text-white'
                        }`}
                    >
                        <Save className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
                        <span>{isSaving ? 'ĐANG LƯU...' : '💾 LƯU CẤU HÌNH'}</span>
                    </button>
                </div>
            </div>

            {/* 2. CHỌN CHẾ ĐỘ TÍNH ĐIỂM THI ĐUA */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                        <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                            <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
                            CHẾ ĐỘ TÍNH HIỆU QUẢ THI ĐUA CỦA SIÊU THỊ
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Lựa chọn cách hiển thị và tính toán kết quả thi đua nhân viên trên các trang báo cáo hiệu quả
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Chế độ 1: Tính điểm thi đua */}
                    <div
                        onClick={() => {
                            setScoringMode('POINTS');
                            setHasUnsavedChanges(true);
                        }}
                        className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative ${
                            scoringMode === 'POINTS'
                                ? 'bg-amber-50/70 border-amber-500 shadow-sm ring-2 ring-amber-400/30'
                                : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                        }`}
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black ${
                                    scoringMode === 'POINTS'
                                        ? 'bg-amber-500 text-white shadow-xs'
                                        : 'bg-slate-200 text-slate-600'
                                }`}>
                                    <Trophy className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <h5 className="font-black text-sm text-slate-800">
                                            Tính Điểm Thi Đua
                                        </h5>
                                        {scoringMode === 'POINTS' && (
                                            <span className="text-[10px] bg-amber-600 text-white px-1.5 py-0.2 rounded-md font-bold uppercase">
                                                Đang chọn
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[11px] font-bold text-amber-700">
                                        Hiển thị dạng: Điểm Đạt / Tổng Điểm (Ví dụ: 12 / 18 đ)
                                    </p>
                                </div>
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                                scoringMode === 'POINTS'
                                    ? 'border-amber-600 bg-amber-600 text-white'
                                    : 'border-slate-300 bg-white'
                            }`}>
                                {scoringMode === 'POINTS' && <Check className="w-3.5 h-3.5" />}
                            </div>
                        </div>
                        <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                            Mỗi chương trình có thể cấu hình số điểm riêng biệt (1đ, 1.5đ, 2đ...). Tổng điểm sẽ được cộng dồn theo các ngành hàng mà nhân viên dự kiến đạt từ 100% trở lên.
                        </p>
                    </div>

                    {/* Chế độ 2: Chỉ tính Đạt / Không đạt (Số lượng) */}
                    <div
                        onClick={() => {
                            setScoringMode('COUNT');
                            setHasUnsavedChanges(true);
                        }}
                        className={`p-4 rounded-2xl border-2 transition-all cursor-pointer relative ${
                            scoringMode === 'COUNT'
                                ? 'bg-indigo-50/70 border-indigo-500 shadow-sm ring-2 ring-indigo-400/30'
                                : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                        }`}
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black ${
                                    scoringMode === 'COUNT'
                                        ? 'bg-indigo-600 text-white shadow-xs'
                                        : 'bg-slate-200 text-slate-600'
                                }`}>
                                    <Hash className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <h5 className="font-black text-sm text-slate-800">
                                            Chỉ Tính Đạt / Không Đạt
                                        </h5>
                                        {scoringMode === 'COUNT' && (
                                            <span className="text-[10px] bg-indigo-600 text-white px-1.5 py-0.2 rounded-md font-bold uppercase">
                                                Đang chọn
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[11px] font-bold text-indigo-700">
                                        Hiển thị dạng: Số Mục Đạt / Tổng Số Mục (Ví dụ: 15 / 39)
                                    </p>
                                </div>
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                                scoringMode === 'COUNT'
                                    ? 'border-indigo-600 bg-indigo-600 text-white'
                                    : 'border-slate-300 bg-white'
                            }`}>
                                {scoringMode === 'COUNT' && <Check className="w-3.5 h-3.5" />}
                            </div>
                        </div>
                        <p className="text-xs text-slate-600 mt-2.5 leading-relaxed">
                            Mỗi chương trình hoàn thành tính là 1 mục đạt. Báo cáo tổng hợp sẽ đếm số lượng mục dự kiến đạt trên tổng số mục được giao target của nhân viên.
                        </p>
                    </div>
                </div>

                {/* BANNER NGUYÊN TẮC TÍNH ĐIỂM */}
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-300 rounded-2xl p-3.5 flex items-start gap-3 text-emerald-950">
                    <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 shrink-0 mt-0.5">
                        <Sparkles className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="text-xs space-y-1">
                        <div className="font-black text-emerald-900 uppercase tracking-wide flex items-center gap-1.5">
                            <span>Quy tắc tính điểm theo quy định hệ thống:</span>
                        </div>
                        <p className="text-emerald-800 leading-relaxed font-medium">
                            • Nhân viên có <strong>tỷ lệ dự kiến hoàn thành (%DKHT) từ 100% trở lên</strong> ➔ Nhận trọn vẹn <strong>số điểm quy định</strong> của chương trình đó.<br />
                            • Nhân viên có <strong>tỷ lệ dự kiến hoàn thành dưới 100%</strong> ➔ <strong>0 điểm</strong> (không có điểm).
                        </p>
                    </div>
                </div>
            </div>

            {/* 3. THỐNG KÊ NHANH & BỘ CÔNG CỤ */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 font-black">
                        <Layers className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-500 uppercase">Tổng số chương trình</p>
                        <p className="text-lg font-black text-slate-800">{stats.totalCampaigns} <span className="text-xs font-normal text-slate-400">mục</span></p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 font-black">
                        <Coins className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-500 uppercase">Tổng điểm tối đa (100%)</p>
                        <p className="text-lg font-black text-amber-600">
                            {stats.totalMaxPoints} <span className="text-xs font-normal text-slate-400">điểm</span>
                        </p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 font-black">
                        <Award className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[11px] font-bold text-slate-500 uppercase">Trọng điểm tùy biến (&gt;1đ)</p>
                        <p className="text-lg font-black text-purple-700">
                            {stats.customCount} <span className="text-xs font-normal text-slate-400">mục</span>
                        </p>
                    </div>
                </div>
            </div>

            {/* 4. THANH ĐIỀU KHIỂN & BẢNG THIẾT LẬP ĐIỂM SỐ */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    {/* Tìm kiếm */}
                    <div className="relative flex-1 max-w-md">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm chương trình thi đua..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-amber-500"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Bộ lọc điểm & Nút thao tác nhanh */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <select
                            value={filterScoreType}
                            onChange={(e: any) => setFilterScoreType(e.target.value)}
                            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none cursor-pointer"
                        >
                            <option value="ALL">Tất cả điểm số</option>
                            <option value="CUSTOM">Chỉ xem điểm tùy biến (≠ 1đ)</option>
                            <option value="DEFAULT">Chỉ xem điểm chuẩn (1đ)</option>
                        </select>

                        <button
                            type="button"
                            onClick={() => handleSetAllPoints(1)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                            title="Đặt tất cả các mục về 1 điểm"
                        >
                            Tất cả 1đ
                        </button>

                        <button
                            type="button"
                            onClick={() => handleSetAllPoints(2)}
                            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition cursor-pointer"
                            title="Đặt tất cả các mục về 2 điểm"
                        >
                            Tất cả 2đ
                        </button>

                        <button
                            type="button"
                            onClick={handleResetToDefault}
                            className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-600 rounded-xl text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                            title="Khôi phục mặc định"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Mặc định</span>
                        </button>
                    </div>
                </div>

                {/* BẢNG CHI TIẾT ĐIỂM SỐ */}
                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-100/80 text-slate-700 font-extrabold border-b border-slate-200">
                                <th className="py-2.5 px-3 w-12 text-center">STT</th>
                                <th className="py-2.5 px-3 min-w-[220px]">Tên Chương Trình Thi Đua (Hiển thị)</th>
                                <th className="py-2.5 px-3 min-w-[200px]">Mã Gốc (Raw Key Báo Cáo)</th>
                                <th className="py-2.5 px-3 w-20 text-center">Đơn Vị</th>
                                <th className="py-2.5 px-3 w-48 text-center bg-amber-50/80 text-amber-900 border-x border-amber-200 font-black">
                                    Số Điểm Quy Định
                                </th>
                                <th className="py-2.5 px-3 w-28 text-center">Phân Loại</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredCampaigns.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-10 text-center text-slate-400">
                                        Không tìm thấy chương trình thi đua nào phù hợp!
                                    </td>
                                </tr>
                            ) : (
                                filteredCampaigns.map((camp, idx) => {
                                    const score = campaignScores[camp.raw_key] !== undefined
                                        ? campaignScores[camp.raw_key]
                                        : 1;

                                    const isCustom = score !== 1;

                                    return (
                                        <tr
                                            key={camp.id || camp.raw_key}
                                            className={`hover:bg-slate-50/80 transition-colors ${
                                                isCustom ? 'bg-amber-50/30' : ''
                                            }`}
                                        >
                                            <td className="py-2.5 px-3 text-center text-slate-400 font-bold">
                                                {idx + 1}
                                            </td>

                                            <td className="py-2.5 px-3">
                                                <div className="font-extrabold text-slate-800 text-[13px]">
                                                    {camp.display_name || camp.raw_key}
                                                </div>
                                            </td>

                                            <td className="py-2.5 px-3">
                                                <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                                    {camp.raw_key}
                                                </span>
                                            </td>

                                            <td className="py-2.5 px-3 text-center">
                                                <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                                                    {camp.unit || 'Cái'}
                                                </span>
                                            </td>

                                            {/* Ô nhập số điểm */}
                                            <td className="py-2 px-3 bg-amber-50/40 border-x border-amber-200">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAdjustScore(camp.raw_key, -0.5)}
                                                        className="w-6 h-6 rounded-lg bg-white border border-amber-300 hover:bg-amber-100 text-amber-800 font-black flex items-center justify-center cursor-pointer shadow-2xs"
                                                        title="Giảm 0.5 điểm"
                                                    >
                                                        -
                                                    </button>

                                                    <input
                                                        type="number"
                                                        step="0.5"
                                                        min="0.1"
                                                        max="100"
                                                        value={score}
                                                        onChange={(e) => handleScoreChange(camp.raw_key, parseFloat(e.target.value))}
                                                        className="w-16 text-center py-1 bg-white border border-amber-400 rounded-lg font-black text-slate-900 text-xs shadow-inner outline-none focus:ring-2 focus:ring-amber-500"
                                                    />

                                                    <button
                                                        type="button"
                                                        onClick={() => handleAdjustScore(camp.raw_key, 0.5)}
                                                        className="w-6 h-6 rounded-lg bg-white border border-amber-300 hover:bg-amber-100 text-amber-800 font-black flex items-center justify-center cursor-pointer shadow-2xs"
                                                        title="Tăng 0.5 điểm"
                                                    >
                                                        +
                                                    </button>

                                                    {/* Quick pills */}
                                                    <div className="hidden sm:flex items-center gap-1 ml-1">
                                                        {[1, 2, 3].map(p => (
                                                            <button
                                                                key={p}
                                                                type="button"
                                                                onClick={() => handleScoreChange(camp.raw_key, p)}
                                                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                                                                    score === p
                                                                        ? 'bg-amber-600 text-white'
                                                                        : 'bg-white hover:bg-amber-100 border border-amber-200 text-amber-800'
                                                                }`}
                                                            >
                                                                {p}đ
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="py-2.5 px-3 text-center">
                                                {score > 1 ? (
                                                    <span className="text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                                        <Trophy className="w-3 h-3 text-amber-600" /> Trọng điểm
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                                        Chuẩn 1đ
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* TUỲ CHỌN SAO CHÉP CHO TẤT CẢ SIÊU THỊ PHỤ TRÁCH & LƯU */}
                <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={applyToAllMyStores}
                            onChange={(e) => setApplyToAllMyStores(e.target.checked)}
                            className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-slate-700">
                            Đồng thời áp dụng cấu hình này cho tất cả {allowedStores.length} siêu thị tôi phụ trách
                        </span>
                    </label>

                    <div className="flex items-center gap-2">
                        {hasUnsavedChanges && (
                            <span className="text-xs text-amber-700 font-bold animate-pulse">
                                Có thay đổi chưa lưu!
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md transition cursor-pointer disabled:opacity-50"
                        >
                            <Save className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
                            <span>{isSaving ? 'ĐANG LƯU DỮ LIỆU...' : '💾 LƯU CẤU HÌNH NGAY'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
