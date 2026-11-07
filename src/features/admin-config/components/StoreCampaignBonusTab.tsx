import React, { useState, useEffect, useMemo } from 'react';
import type { CampaignDictItem, StoreItem, EmployeeItem } from '../../../core/lib/storage';
import { fetchEmployees } from '../../../core/lib/storage';
import {
    fetchEmployeeBonuses,
    saveEmployeeBonus,
    deleteEmployeeBonus,
    syncLocalBonusesToCloud,
    type EmployeeBonusItem,
    EMPLOYEE_BONUSES_SQL
} from '../../../core/lib/employeeBonusService';
import { getShortenedEmployeeName } from '../../employee-performance/utils/performanceConfig';
import { cleanEmployeeName, getShortStoreName, isStoreMatch } from '../../../core/lib/formatters';
import {
    Award,
    Sparkles,
    Plus,
    Trash2,
    Calendar,
    User,
    Tag,
    Coins,
    Save,
    RotateCcw,
    UploadCloud,
    CheckCircle2,
    AlertCircle,
    Info,
    Store,
    Database,
    Copy,
    Building2,
    Clock,
    Search
} from 'lucide-react';

interface Props {
    campaigns: CampaignDictItem[];
    stores: StoreItem[];
    currentUser: any;
    isAdmin: boolean;
    showToast: (msg: string) => void;
    onDataChanged?: () => void;
}

const PRESET_POINTS = [0.5, 1.0, 1.5, 2.0];
const PRESET_REASONS = [
    '🥇 Mở thẻ VP đầu tiên',
    '⚡ Mở bát doanh số',
    '🎯 Vượt chỉ tiêu ngày',
    '✨ Khen thưởng đột xuất',
    '🔥 Tăng tốc ca tối'
];

export default function StoreCampaignBonusTab({
    campaigns,
    stores,
    currentUser,
    isAdmin,
    showToast,
    onDataChanged
}: Props) {
    // 1. Phân quyền danh sách ST
    const allowedStores = useMemo(() => {
        if (isAdmin) return stores;
        const accessible = currentUser?.accessible_stores && currentUser.accessible_stores.length > 0
            ? currentUser.accessible_stores
            : (currentUser?.store_name ? [currentUser.store_name] : []);

        if (accessible.length === 0) return stores;
        return stores.filter(s => accessible.some((acc: string) => isStoreMatch(s.name, acc, stores)));
    }, [stores, currentUser, isAdmin]);

    // State bộ lọc: ST, Tháng, Năm (Quy chuẩn 10: Store-first)
    const today = new Date();
    const [selectedStore, setSelectedStore] = useState<string>(() => {
        if (allowedStores.length > 0) return allowedStores[0].name;
        return 'all';
    });
    const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());

    // Cập nhật selectedStore nếu danh sách thay đổi
    useEffect(() => {
        if (selectedStore === 'all' && allowedStores.length > 0) {
            setSelectedStore(allowedStores[0].name);
        }
    }, [allowedStores, selectedStore]);

    // State danh sách nhân viên của ST
    const [employees, setEmployees] = useState<EmployeeItem[]>([]);
    const [isLoadingEmployees, setIsLoadingEmployees] = useState<boolean>(false);

    // State danh sách điểm cộng trong kỳ
    const [bonuses, setBonuses] = useState<EmployeeBonusItem[]>([]);
    const [isLoadingBonuses, setIsLoadingBonuses] = useState<boolean>(false);

    // State Form cấp điểm
    const [selectedEmpId, setSelectedEmpId] = useState<string>('');
    const [selectedCampaignKey, setSelectedCampaignKey] = useState<string>('GENERAL');
    const [bonusPoints, setBonusPoints] = useState<number>(1.0);
    const [customPointsInput, setCustomPointsInput] = useState<string>('1.0');
    const [reason, setReason] = useState<string>('🥇 Mở thẻ VP đầu tiên');
    const [bonusDate, setBonusDate] = useState<string>(() => today.toISOString().substring(0, 10));
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false);

    // Modal SQL DDL (Admin-only theo Quy chuẩn 12)
    const [showSqlModal, setShowSqlModal] = useState<boolean>(false);
    const [copiedSql, setCopiedSql] = useState<boolean>(false);

    // Tìm kiếm trong bảng lịch sử
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Nạp nhân viên khi đổi ST
    useEffect(() => {
        let isMounted = true;
        const loadEmp = async () => {
            if (!selectedStore || selectedStore === 'all') {
                setEmployees([]);
                return;
            }
            setIsLoadingEmployees(true);
            try {
                const res = await fetchEmployees(selectedStore);
                if (isMounted && res.success && res.data) {
                    setEmployees(res.data);
                    if (res.data.length > 0) {
                        setSelectedEmpId(res.data[0].employee_id);
                    } else {
                        setSelectedEmpId('');
                    }
                }
            } catch {
                if (isMounted) setEmployees([]);
            } finally {
                if (isMounted) setIsLoadingEmployees(false);
            }
        };
        loadEmp();
        return () => { isMounted = false; };
    }, [selectedStore]);

    // Nạp danh sách điểm cộng khi đổi ST, Tháng, Năm
    const loadBonuses = async () => {
        setIsLoadingBonuses(true);
        try {
            const list = await fetchEmployeeBonuses({
                storeName: selectedStore,
                month: selectedMonth,
                year: selectedYear,
                storesList: stores
            });
            setBonuses(list);
        } catch {
            setBonuses([]);
        } finally {
            setIsLoadingBonuses(false);
        }
    };

    useEffect(() => {
        loadBonuses();
    }, [selectedStore, selectedMonth, selectedYear]);

    // Danh sách ngành hàng cho Dropdown
    const activeCampaigns = useMemo(() => {
        return campaigns.filter(c => c.is_active !== false);
    }, [campaigns]);

    // Đồng bộ tất cả dữ liệu từ máy lên Supabase Cloud
    const handleSyncToCloud = async () => {
        setIsSyncingCloud(true);
        try {
            const res = await syncLocalBonusesToCloud();
            if (res.success) {
                showToast(`⚡ Đã đồng bộ thành công ${res.syncedCount} bản ghi lên Supabase Cloud!`);
                await loadBonuses();
                onDataChanged?.();
            } else {
                showToast(`⚠️ Lỗi đồng bộ Cloud: ${res.error || 'Vui lòng kiểm tra lại'}`);
            }
        } finally {
            setIsSyncingCloud(false);
        }
    };

    // Xử lý gửi Form cấp điểm
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStore || selectedStore === 'all') {
            showToast('⚠️ Vui lòng chọn cụ thể một ST để cấp điểm cộng!');
            return;
        }
        if (!selectedEmpId) {
            showToast('⚠️ Vui lòng chọn nhân viên nhận điểm thưởng!');
            return;
        }
        const pts = Number(customPointsInput) || bonusPoints;
        if (pts <= 0) {
            showToast('⚠️ Số điểm cộng phải lớn hơn 0!');
            return;
        }
        if (!reason.trim()) {
            showToast('⚠️ Vui lòng nhập lý do cộng điểm!');
            return;
        }

        const targetEmp = employees.find(e => e.employee_id.trim() === selectedEmpId.trim());
        const empName = targetEmp ? cleanEmployeeName(targetEmp.full_name) : selectedEmpId;

        let campName = 'Điểm thưởng chung';
        if (selectedCampaignKey !== 'GENERAL') {
            const foundCamp = campaigns.find(c => c.raw_key === selectedCampaignKey);
            campName = foundCamp?.display_name || selectedCampaignKey;
        }

        setIsSubmitting(true);
        try {
            const res = await saveEmployeeBonus({
                store_name: selectedStore,
                employee_id: selectedEmpId.trim(),
                employee_name: empName,
                month: selectedMonth,
                year: selectedYear,
                bonus_date: bonusDate,
                campaign_key: selectedCampaignKey,
                campaign_name: campName,
                bonus_points: pts,
                reason: reason.trim(),
                created_by: currentUser?.full_name || currentUser?.email || 'Quản lý'
            });

            if (res.success && res.cloudSaved) {
                showToast(`🎉 Đã cấp +${pts} điểm cho ${getShortenedEmployeeName(empName)} và lưu Cloud thành công!`);
                await loadBonuses();
                onDataChanged?.();
            } else if (!res.cloudSaved) {
                showToast(`⚠️ Đã lưu vào máy nhưng lỗi gửi Cloud: ${res.error || 'Vui lòng kiểm tra lại'}`);
                await loadBonuses();
                onDataChanged?.();
            } else {
                showToast(`⚠️ Lỗi ghi nhận: ${res.error || 'Vui lòng thử lại'}`);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    // Xóa điểm cộng
    const handleDelete = async (id: string, empName: string, pts: number) => {
        if (!window.confirm(`Bạn có chắc muốn xóa lượt cộng +${pts}đ của "${empName}"?`)) return;
        const res = await deleteEmployeeBonus(id);
        if (res.success) {
            showToast('🗑️ Đã xóa bản ghi điểm cộng!');
            await loadBonuses();
            onDataChanged?.();
        } else {
            showToast(`⚠️ Lỗi xóa: ${res.error || 'Vui lòng thử lại'}`);
        }
    };

    // Lọc lịch sử
    const filteredBonuses = useMemo(() => {
        if (!searchQuery.trim()) return bonuses;
        const q = searchQuery.toLowerCase().trim();
        return bonuses.filter(b =>
            b.employee_id.toLowerCase().includes(q) ||
            b.employee_name.toLowerCase().includes(q) ||
            b.campaign_name.toLowerCase().includes(q) ||
            b.reason.toLowerCase().includes(q)
        );
    }, [bonuses, searchQuery]);

    // Thống kê
    const stats = useMemo(() => {
        const totalEntries = bonuses.length;
        const totalPoints = bonuses.reduce((sum, b) => sum + (Number(b.bonus_points) || 0), 0);
        const uniqueEmployees = new Set(bonuses.map(b => b.employee_id)).size;
        return {
            totalEntries,
            totalPoints: Number(totalPoints.toFixed(1)),
            uniqueEmployees
        };
    }, [bonuses]);

    // Độ dài lớn nhất của mã NV để đồng đều badge theo Quy chuẩn 11
    const maxIdLength = useMemo(() => {
        if (bonuses.length === 0) return 6;
        return Math.max(6, ...bonuses.map(b => String(b.employee_id || '').trim().length));
    }, [bonuses]);

    return (
        <div className="space-y-4 animate-in fade-in duration-200">
            {/* 1. DÒNG BỘ LỌC ĐỘC LẬP - STORE & KỲ THÁNG TRƯỚC TIÊN (Quy chuẩn 10) */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700">
                        <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
                        <span className="text-slate-400 font-normal">ST:</span>
                        <select
                            value={selectedStore}
                            onChange={(e) => setSelectedStore(e.target.value)}
                            className="bg-transparent outline-none font-bold text-slate-800 cursor-pointer max-w-[240px] truncate"
                        >
                            {allowedStores.map(s => (
                                <option key={s.id || s.name} value={s.name}>
                                    {s.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700">
                        <Calendar className="w-4 h-4 text-slate-500 shrink-0" />
                        <span className="text-slate-400 font-normal">Tháng:</span>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(Number(e.target.value))}
                            className="bg-transparent outline-none font-bold text-slate-800 cursor-pointer"
                        >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                <option key={m} value={m}>Tháng {m}</option>
                            ))}
                        </select>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="bg-transparent outline-none font-bold text-slate-800 cursor-pointer ml-1"
                        >
                            {[selectedYear - 1, selectedYear, selectedYear + 1].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        type="button"
                        onClick={loadBonuses}
                        disabled={isLoadingBonuses}
                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition cursor-pointer"
                        title="Tải lại danh sách"
                    >
                        <RotateCcw className={`w-4 h-4 ${isLoadingBonuses ? 'animate-spin' : ''}`} />
                    </button>

                    <button
                        type="button"
                        onClick={handleSyncToCloud}
                        disabled={isSyncingCloud}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                        title="Đồng bộ tất cả bản ghi điểm cộng từ bộ nhớ máy lên Cloud Supabase"
                    >
                        <UploadCloud className={`w-3.5 h-3.5 ${isSyncingCloud ? 'animate-spin' : ''}`} />
                        <span>{isSyncingCloud ? 'Đang sync...' : 'Đồng bộ Cloud'}</span>
                    </button>
                </div>

                {/* Nút SQL DDL chỉ dành cho Admin (Quy chuẩn 12) */}
                {isAdmin && (
                    <button
                        type="button"
                        onClick={() => setShowSqlModal(true)}
                        className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer self-start md:self-auto"
                        title="Xem mã lệnh SQL khởi tạo bảng Supabase (Admin Only)"
                    >
                        <Database className="w-3.5 h-3.5 text-purple-600" />
                        <span>Mã SQL Cloud</span>
                    </button>
                )}
            </div>

            {/* 2. FORM CẤP ĐIỂM CỘNG 1 CHẠM (CARD NHẬP LIỆU MOBILE-FIRST) */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-amber-200/80 shadow-xs relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-100/50 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

                <div className="flex items-center gap-2.5 mb-4 border-b border-slate-100 pb-3">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-xs shrink-0">
                        <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-slate-900 tracking-tight">
                            CHỈ ĐỊNH ĐIỂM CỘNG THI ĐUA CHO NHÂN VIÊN
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                            Khen thưởng nhân viên mở bát đầu ngày (mở thẻ VP đầu tiên, doanh số sớm...) do QL/TC trực tiếp trao tặng
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* 1. Chọn Nhân viên */}
                        <div>
                            <label className="block text-[11px] font-black text-slate-700 uppercase mb-1.5 flex items-center gap-1">
                                <User className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Nhân viên nhận thưởng</span>
                            </label>
                            <select
                                value={selectedEmpId}
                                onChange={(e) => setSelectedEmpId(e.target.value)}
                                disabled={isLoadingEmployees || employees.length === 0}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white transition cursor-pointer disabled:opacity-50"
                            >
                                {employees.length === 0 ? (
                                    <option value="">(Không có nhân viên trong ST)</option>
                                ) : (
                                    employees.map(emp => (
                                        <option key={emp.employee_id} value={emp.employee_id}>
                                            {emp.employee_id} - {cleanEmployeeName(emp.full_name)}
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>

                        {/* 2. Chọn Ngành hàng (Dropdown theo chỉ đạo Boss) */}
                        <div>
                            <label className="block text-[11px] font-black text-slate-700 uppercase mb-1.5 flex items-center gap-1">
                                <Tag className="w-3.5 h-3.5 text-amber-600" />
                                <span>Ngành hàng liên quan</span>
                            </label>
                            <select
                                value={selectedCampaignKey}
                                onChange={(e) => setSelectedCampaignKey(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white transition cursor-pointer"
                            >
                                <option value="GENERAL">⭐ [Điểm thưởng chung / Khác]</option>
                                {activeCampaigns.map(c => (
                                    <option key={c.raw_key} value={c.raw_key}>
                                        🎯 {c.display_name} {c.unit ? `(${c.unit})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* 3. Mức điểm thưởng (+đ) */}
                        <div>
                            <label className="block text-[11px] font-black text-slate-700 uppercase mb-1.5 flex items-center gap-1">
                                <Coins className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Mức điểm cộng (+đ)</span>
                            </label>
                            <div className="flex items-center gap-1.5">
                                <div className="flex items-center gap-1">
                                    {PRESET_POINTS.map(p => (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => {
                                                setBonusPoints(p);
                                                setCustomPointsInput(String(p));
                                            }}
                                            className={`px-2 py-1.5 rounded-lg text-xs font-black transition cursor-pointer ${Number(customPointsInput) === p
                                                ? 'bg-amber-500 text-white shadow-2xs'
                                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                            }`}
                                        >
                                            +{p}
                                        </button>
                                    ))}
                                </div>
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0.1"
                                    value={customPointsInput}
                                    onChange={(e) => setCustomPointsInput(e.target.value)}
                                    className="w-16 px-2 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-black text-slate-900 text-center outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white"
                                    placeholder="Điểm"
                                />
                            </div>
                        </div>

                        {/* 4. Ngày ghi nhận */}
                        <div>
                            <label className="block text-[11px] font-black text-slate-700 uppercase mb-1.5 flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                                <span>Ngày áp dụng</span>
                            </label>
                            <input
                                type="date"
                                value={bonusDate}
                                onChange={(e) => setBonusDate(e.target.value)}
                                className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white transition cursor-pointer"
                            />
                        </div>
                    </div>

                    {/* Lý do & Chip bấm nhanh */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[11px] font-black text-slate-700 uppercase flex items-center gap-1">
                                <Award className="w-3.5 h-3.5 text-purple-600" />
                                <span>Lý do / Danh hiệu khen thưởng</span>
                            </label>
                            <span className="text-[10px] text-slate-400 font-medium">(Bấm chip nhanh hoặc tự nhập)</span>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap mb-2">
                            {PRESET_REASONS.map(r => (
                                <button
                                    key={r}
                                    type="button"
                                    onClick={() => setReason(r)}
                                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition cursor-pointer ${reason === r
                                        ? 'bg-purple-100 text-purple-900 border border-purple-300'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                                    }`}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="Nhập lý do chi tiết..."
                                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white transition"
                            />
                            <button
                                type="submit"
                                disabled={isSubmitting || employees.length === 0}
                                className="px-5 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50 shrink-0"
                            >
                                <Save className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`} />
                                <span>{isSubmitting ? 'ĐANG LƯU...' : '💾 GHI NHẬN ĐIỂM CỘNG'}</span>
                            </button>
                        </div>
                    </div>
                </form>
            </div>

            {/* 3. BẢNG DANH SÁCH LỊCH SỬ ĐIỂM CỘNG CỦA ST TRONG THÁNG */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                {/* Header bảng & Thống kê */}
                <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {stats.totalEntries}
                        </div>
                        <div>
                            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                LỊCH SỬ ĐIỂM CỘNG - THÁNG {selectedMonth}/{selectedYear} ({getShortStoreName(selectedStore)})
                            </h4>
                            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                                <span>Tổng cộng: <b className="text-amber-700 font-black">+{stats.totalPoints} điểm</b></span>
                                <span>•</span>
                                <span><b>{stats.uniqueEmployees}</b> nhân sự được thưởng</span>
                            </div>
                        </div>
                    </div>

                    <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Tìm nhân viên, ngành hàng, lý do..."
                            className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 outline-none focus:ring-2 focus:ring-purple-400 w-full sm:w-60"
                        />
                    </div>
                </div>

                {/* Bảng dữ liệu compact */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-slate-100/80 text-slate-700 font-black text-[11px] uppercase border-b border-slate-200">
                                <th className="px-2.5 py-2 text-center w-10">STT</th>
                                <th className="px-2.5 py-2 w-24">Ngày</th>
                                <th className="px-2.5 py-2">Nhân viên</th>
                                <th className="px-2.5 py-2">Ngành hàng</th>
                                <th className="px-2.5 py-2 text-right">Điểm cộng</th>
                                <th className="px-2.5 py-2">Lý do</th>
                                <th className="px-2.5 py-2">Người cấp</th>
                                <th className="px-2.5 py-2 text-center w-12">Xóa</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-avo">
                            {filteredBonuses.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                                        {isLoadingBonuses
                                            ? '🔄 Đang tải dữ liệu điểm cộng...'
                                            : 'Chưa có lượt cấp điểm cộng nào trong tháng này cho ST'}
                                    </td>
                                </tr>
                            ) : (
                                filteredBonuses.map((b, idx) => (
                                    <tr key={b.id} className="hover:bg-amber-50/40 transition">
                                        <td className="px-2.5 py-2 text-center text-slate-400 font-mono text-[11px]">
                                            {idx + 1}
                                        </td>
                                        <td className="px-2.5 py-2 font-mono text-slate-600 text-[11px] whitespace-nowrap">
                                            {b.bonus_date}
                                        </td>
                                        <td className="px-2.5 py-2">
                                            <div className="flex items-center gap-1.5">
                                                <span
                                                    className="font-mono font-bold text-xs px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 inline-block text-center leading-normal shrink-0"
                                                    style={{ minWidth: `${maxIdLength + 2.2}ch`, width: `${maxIdLength + 2.2}ch` }}
                                                >
                                                    {b.employee_id}
                                                </span>
                                                <span
                                                    className="font-bold text-slate-800 truncate"
                                                    title={`Mã NV: ${b.employee_id} - ${cleanEmployeeName(b.employee_name)}`}
                                                >
                                                    {getShortenedEmployeeName(b.employee_name)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-2.5 py-2">
                                            <span className="px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
                                                {b.campaign_name}
                                            </span>
                                        </td>
                                        <td className="px-2.5 py-2 text-right">
                                            <span className="px-2 py-0.5 rounded-md text-xs font-black bg-amber-100 text-amber-900 border border-amber-300 font-mono inline-block">
                                                +{Number(b.bonus_points).toFixed(1)} đ
                                            </span>
                                        </td>
                                        <td className="px-2.5 py-2 text-slate-700 font-medium">
                                            {b.reason}
                                        </td>
                                        <td className="px-2.5 py-2 text-slate-500 text-[11px]">
                                            {b.created_by || 'QL'}
                                        </td>
                                        <td className="px-2.5 py-2 text-center">
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(b.id, b.employee_name, b.bonus_points)}
                                                className="p-1 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded-md transition cursor-pointer"
                                                title="Xóa lượt cộng điểm này"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL MÃ LỆNH SQL DDL (Chỉ dành cho ADMIN theo Quy chuẩn 12) */}
            {showSqlModal && isAdmin && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2">
                                <Database className="w-5 h-5 text-purple-600" />
                                <h3 className="text-sm font-black text-slate-900">
                                    MÃ LỆNH SQL SUPABASE - BẢNG ĐIỂM CỘNG THI ĐUA
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowSqlModal(false)}
                                className="text-slate-400 hover:text-slate-600 text-lg font-bold px-2 cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <p className="text-xs text-slate-600">
                            Chạy câu lệnh SQL này trong <b>Supabase SQL Editor</b> 1 lần để kích hoạt tính năng lưu trữ Cloud cho bảng điểm cộng thi đua:
                        </p>

                        <div className="relative flex-1 overflow-hidden bg-slate-900 text-slate-100 rounded-xl p-3 font-mono text-[11px] overflow-y-auto max-h-80">
                            <pre className="whitespace-pre-wrap">{EMPLOYEE_BONUSES_SQL}</pre>
                            <button
                                type="button"
                                onClick={() => {
                                    navigator.clipboard.writeText(EMPLOYEE_BONUSES_SQL);
                                    setCopiedSql(true);
                                    setTimeout(() => setCopiedSql(false), 2000);
                                }}
                                className="absolute top-2 right-2 px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-md text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-xs"
                            >
                                <Copy className="w-3 h-3" />
                                <span>{copiedSql ? 'Đã sao chép!' : 'Sao chép SQL'}</span>
                            </button>
                        </div>

                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={() => setShowSqlModal(false)}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

