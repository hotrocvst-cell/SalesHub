import { useState, useEffect, useMemo } from 'react';
import {
    fetchEmployees,
    fetchCampaignDictionary,
    fetchEmployeeCampaignTargets,
    fetchEmployeeRevenueTargets,
    saveUnifiedEmployeeTargets,
    type EmployeeItem,
    type CampaignDictItem
} from '../../core/lib/storage';
import { getShortStoreName } from '../../core/lib/formatters';
import { exportUnifiedTargetTemplate, type ParsedTargetRow } from './utils/excelHelper';
import UnifiedTargetTable from './components/UnifiedTargetTable';
import ImportTargetModal from './components/ImportTargetModal';
import SupabaseSyncStatusBar, { type SyncStatusType } from './components/SupabaseSyncStatusBar';
import {
    Target,
    Save,
    RefreshCw,
    Search,
    Download,
    UploadCloud,
    CheckCircle2,
    Calendar,
    Store,
    CloudUpload
} from 'lucide-react';

export default function EmployeeTargetUnifiedPage() {
    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
    const [selectedStore, setSelectedStore] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    const [employees, setEmployees] = useState<EmployeeItem[]>([]);
    const [campaigns, setCampaigns] = useState<CampaignDictItem[]>([]);

    // State lưu giá trị mục tiêu
    const [revenueTargets, setRevenueTargets] = useState<Record<string, number>>({});
    const [campaignTargets, setCampaignTargets] = useState<Record<string, Record<string, number>>>({});

    const [loading, setLoading] = useState<boolean>(true);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [hasChanges, setHasChanges] = useState<boolean>(false);
    const [syncStatus, setSyncStatus] = useState<SyncStatusType>('synced');
    const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
    const [lastSyncError, setLastSyncError] = useState<string | null>(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
    const [toastMessage, setToastMessage] = useState<string>('');

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 3500);
    };

    // 1. TẢI DỮ LIỆU TỪ SUPABASE
    const loadData = async () => {
        setLoading(true);
        setLastSyncError(null);
        try {
            const [empRes, campRes, campTargetRes, revTargetRes] = await Promise.all([
                fetchEmployees(),
                fetchCampaignDictionary(),
                fetchEmployeeCampaignTargets(selectedMonth, selectedYear),
                fetchEmployeeRevenueTargets(selectedMonth, selectedYear)
            ]);

            if (empRes.success) setEmployees(empRes.data);

            // Lọc các NHÓM thi đua đang active
            const activeCamps = (campRes.data || []).filter(c => c.is_active);
            setCampaigns(activeCamps);

            // Map Target Doanh Thu
            const revMap: Record<string, number> = {};
            if (revTargetRes.success && revTargetRes.data) {
                revTargetRes.data.forEach((r: any) => {
                    revMap[r.employee_id] = Number(r.target_revenue) || 0;
                });
            }
            setRevenueTargets(revMap);

            // Map Target Thi Đua
            const campMap: Record<string, Record<string, number>> = {};
            if (campTargetRes.success && campTargetRes.data) {
                campTargetRes.data.forEach((r: any) => {
                    if (!campMap[r.employee_id]) campMap[r.employee_id] = {};
                    campMap[r.employee_id][r.raw_key] = Number(r.target_value) || 0;
                });
            }
            setCampaignTargets(campMap);

            setHasChanges(false);
            setSyncStatus('synced');
            const now = new Date();
            setLastSavedTime(
                now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
                ' (' + now.toLocaleDateString('vi-VN') + ')'
            );
        } catch (err: any) {
            console.error('Lỗi loadData:', err);
            setSyncStatus('error');
            setLastSyncError(err?.message || 'Không thể tải dữ liệu từ máy chủ Supabase');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [selectedMonth, selectedYear]);

    // Cảnh báo người dùng khi reload hoặc tắt tab nếu có thay đổi chưa lưu
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasChanges]);

    // Chuyển tháng / năm có xác nhận nếu có thay đổi chưa lưu
    const handleMonthChange = (m: number) => {
        if (hasChanges) {
            const confirmed = window.confirm(
                `⚠️ Bạn có dữ liệu chỉ tiêu chưa lưu cho Tháng ${selectedMonth}/${selectedYear}!\n\nNếu chuyển sang Tháng ${m}, các thay đổi chưa lưu sẽ bị mất.\n\nBạn có muốn tiếp tục chuyển không?`
            );
            if (!confirmed) return;
        }
        setSelectedMonth(m);
    };

    const handleYearChange = (y: number) => {
        if (hasChanges) {
            const confirmed = window.confirm(
                `⚠️ Bạn có dữ liệu chỉ tiêu chưa lưu cho Tháng ${selectedMonth}/${selectedYear}!\n\nNếu chuyển sang Năm ${y}, các thay đổi chưa lưu sẽ bị mất.\n\nBạn có muốn tiếp tục chuyển không?`
            );
            if (!confirmed) return;
        }
        setSelectedYear(y);
    };

    // Thống kê số lượng chỉ tiêu hiện tại của tháng
    const targetStats = useMemo(() => {
        let countWithRevenue = 0;
        let totalRevenue = 0;
        let countCampaignTargets = 0;

        employees.forEach(emp => {
            const rev = revenueTargets[emp.employee_id] || 0;
            if (rev > 0) {
                countWithRevenue++;
                totalRevenue += rev;
            }
            const campMap = campaignTargets[emp.employee_id];
            if (campMap) {
                Object.values(campMap).forEach(val => {
                    if (val > 0) countCampaignTargets++;
                });
            }
        });

        return {
            totalEmployees: employees.length,
            countWithRevenue,
            totalRevenue,
            countCampaignTargets
        };
    }, [employees, revenueTargets, campaignTargets]);

    // Danh sách siêu thị
    const storeList = useMemo(() => {
        const set = new Set<string>();
        employees.forEach(e => {
            if (e.store_name) set.add(getShortStoreName(e.store_name));
        });
        return Array.from(set).sort();
    }, [employees]);

    // Danh sách nhân viên sau khi lọc
    const filteredEmployees = useMemo(() => {
        return employees.filter(e => {
            const sName = getShortStoreName(e.store_name);
            const matchStore = selectedStore === 'all' || sName === selectedStore;
            const q = searchQuery.toLowerCase().trim();
            const matchSearch =
                !q ||
                e.employee_id.toLowerCase().includes(q) ||
                e.full_name.toLowerCase().includes(q) ||
                e.store_name.toLowerCase().includes(q);
            return matchStore && matchSearch;
        });
    }, [employees, selectedStore, searchQuery]);

    // Inline edit handlers
    const handleRevenueChange = (empId: string, val: number) => {
        setRevenueTargets(prev => ({ ...prev, [empId]: val }));
        setHasChanges(true);
        setSyncStatus('unsaved');
    };

    const handleCampaignChange = (empId: string, rawKey: string, val: number) => {
        setCampaignTargets(prev => ({
            ...prev,
            [empId]: {
                ...(prev[empId] || {}),
                [rawKey]: val
            }
        }));
        setHasChanges(true);
        setSyncStatus('unsaved');
    };

    // Xuất file Excel mẫu
    const handleExportExcelTemplate = async () => {
        try {
            await exportUnifiedTargetTemplate(
                filteredEmployees.length > 0 ? filteredEmployees : employees,
                campaigns,
                revenueTargets,
                campaignTargets,
                selectedMonth,
                selectedYear
            );
            showToast('📥 Tải file Excel mẫu thành công!');
        } catch (err: any) {
            console.error(err);
            showToast('⚠️ Không thể xuất file Excel: ' + err.message);
        }
    };

    // Áp dụng dữ liệu đã parse (từ file Excel hoặc clipboard)
    const handleApplyImportedTargets = (parsedRows: ParsedTargetRow[]) => {
        const newRev = { ...revenueTargets };
        const newCamp = { ...campaignTargets };
        let matchCount = 0;

        parsedRows.forEach(item => {
            const exists = employees.some(e => e.employee_id.toLowerCase() === item.employee_id.toLowerCase());
            if (exists) {
                matchCount++;
                if (item.target_revenue !== undefined) {
                    newRev[item.employee_id] = item.target_revenue;
                }
                if (!newCamp[item.employee_id]) newCamp[item.employee_id] = {};
                Object.entries(item.campaign_targets).forEach(([k, val]) => {
                    newCamp[item.employee_id][k] = val;
                });
            }
        });

        setRevenueTargets(newRev);
        setCampaignTargets(newCamp);
        setHasChanges(true);
        setSyncStatus('unsaved');
        showToast(`🎉 Đã nạp chỉ tiêu cho ${matchCount} nhân sự! Bấm "Lưu Lên Supabase" để hoàn tất.`);
    };

    // Lưu toàn bộ lên Supabase
    const handleSaveAll = async () => {
        setIsSaving(true);
        setSyncStatus('saving');
        setLastSyncError(null);

        try {
            const revPayload = Object.entries(revenueTargets).map(([empId, rev]) => ({
                employee_id: empId,
                target_revenue: rev
            }));

            const campPayload: { employee_id: string; raw_key: string; target_value: number }[] = [];
            Object.entries(campaignTargets).forEach(([empId, campMap]) => {
                Object.entries(campMap).forEach(([rawKey, val]) => {
                    campPayload.push({
                        employee_id: empId,
                        raw_key: rawKey,
                        target_value: val
                    });
                });
            });

            const res = await saveUnifiedEmployeeTargets({
                month: selectedMonth,
                year: selectedYear,
                revenueTargets: revPayload,
                campaignTargets: campPayload
            });

            if (res.success) {
                setHasChanges(false);
                setSyncStatus('synced');
                const now = new Date();
                setLastSavedTime(
                    now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
                    ' (' + now.toLocaleDateString('vi-VN') + ')'
                );
                showToast('✅ Đã lưu toàn bộ mục tiêu doanh thu & thi đua lên CLOUD thành công!');
            } else {
                setSyncStatus('error');
                setLastSyncError(res.error || 'Lỗi khi cập nhật mục tiêu lên Supabase');
                showToast('❌ Lưu thất bại: ' + res.error);
            }
        } catch (err: any) {
            console.error('Lỗi handleSaveAll:', err);
            setSyncStatus('error');
            setLastSyncError(err?.message || 'Lỗi kết nối khi gửi dữ liệu lên Supabase');
            showToast('❌ Lưu thất bại: ' + (err?.message || err));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="max-w-[1600px] mx-auto space-y-4 pb-12">
            {/* Header Phân hệ */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
                            <Target className="w-5 h-5" />
                        </span>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                            Phân Bổ Mục Tiêu Nhân Viên
                        </h1>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                        Giao chỉ tiêu Doanh thu (VNĐ) và các chỉ tiêu Thi đua (Sim, Bảo hiểm, Gia dụng...) theo từng nhân sự
                    </p>
                </div>

                {/* Toolbar chọn tháng / năm & Thao tác chính */}
                <div className="flex flex-wrap items-center gap-2 self-stretch lg:self-auto">
                    {/* Chọn tháng / năm */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                        <Calendar className="w-4 h-4 text-blue-600" />
                        <select
                            value={selectedMonth}
                            onChange={e => handleMonthChange(Number(e.target.value))}
                            className="bg-transparent text-xs font-bold text-slate-800 outline-hidden cursor-pointer"
                        >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                <option key={m} value={m}>Tháng {m}</option>
                            ))}
                        </select>
                        <span className="text-slate-300">/</span>
                        <select
                            value={selectedYear}
                            onChange={e => handleYearChange(Number(e.target.value))}
                            className="bg-transparent text-xs font-bold text-slate-800 outline-hidden cursor-pointer"
                        >
                            {[selectedYear - 1, selectedYear, selectedYear + 1].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    {/* Button Xuất Excel mẫu */}
                    <button
                        onClick={handleExportExcelTemplate}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        title="Xuất file Excel mẫu dựa theo các cột đang hiển thị"
                    >
                        <Download className="w-4 h-4 text-blue-600" />
                        <span>Xuất Excel Mẫu</span>
                    </button>

                    {/* Button Nhập liệu (Excel / Parse Text) */}
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                        <UploadCloud className="w-4 h-4" />
                        <span>Nhập Liệu (Excel / Text)</span>
                    </button>

                    {/* Button Lưu Tất Cả Lên Supabase */}
                    <button
                        onClick={handleSaveAll}
                        disabled={isSaving}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer ${
                            hasChanges
                                ? 'bg-blue-600 hover:bg-blue-700 text-white ring-2 ring-blue-500/30 animate-pulse'
                                : 'bg-slate-800 hover:bg-slate-900 text-white'
                        }`}
                        title="Lưu toàn bộ chỉ tiêu Doanh thu & Thi đua lên CLOUD"
                    >
                        {isSaving ? (
                            <RefreshCw className="w-4 h-4 animate-spin text-white" />
                        ) : hasChanges ? (
                            <CloudUpload className="w-4 h-4 text-amber-300" />
                        ) : (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        )}
                        <span>{isSaving ? 'Đang lưu...' : hasChanges ? 'Lưu Lên Supabase *' : 'Đã Lưu Supabase'}</span>
                    </button>

                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-slate-50 transition cursor-pointer"
                        title="Tải lại dữ liệu mới nhất từ Supabase"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
                    </button>
                </div>
            </div>

            {/* THANH TRẠNG THÁI THEO DÕI ĐỒNG BỘ SUPABASE CLOUD */}
            <SupabaseSyncStatusBar
                status={syncStatus}
                lastSavedTime={lastSavedTime}
                lastErrorMessage={lastSyncError}
                selectedMonth={selectedMonth}
                selectedYear={selectedYear}
                stats={targetStats}
                isSaving={isSaving}
                onSaveAll={handleSaveAll}
                onReload={loadData}
            />

            {/* Bộ lọc Siêu thị & Tìm kiếm */}
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-slate-700">Lọc theo siêu thị:</span>
                    <select
                        value={selectedStore}
                        onChange={e => setSelectedStore(e.target.value)}
                        className="text-xs font-semibold px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-slate-800"
                    >
                        <option value="all">🏢 Tất cả siêu thị ({storeList.length})</option>
                        {storeList.map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                </div>

                <div className="relative flex-1 max-w-sm">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Tìm theo mã NV, tên, siêu thị..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800"
                    />
                </div>
            </div>

            {/* Toast Thông báo */}
            {toastMessage && (
                <div className="fixed top-16 right-5 z-50 animate-in slide-in-from-top-4 duration-200">
                    <div className="px-4 py-2.5 bg-slate-900 text-white rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold border border-slate-700">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>{toastMessage}</span>
                    </div>
                </div>
            )}

            {/* BẢNG MỤC TIÊU MA TRẬN */}
            {loading ? (
                <div className="bg-white rounded-2xl p-16 text-center text-slate-400 text-xs font-bold flex flex-col items-center justify-center gap-2 border border-slate-200">
                    <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                    <span>Đang nạp dữ liệu chỉ tiêu nhân viên...</span>
                </div>
            ) : (
                <UnifiedTargetTable
                    employees={filteredEmployees}
                    campaigns={campaigns}
                    revenueTargets={revenueTargets}
                    campaignTargets={campaignTargets}
                    onRevenueChange={handleRevenueChange}
                    onCampaignChange={handleCampaignChange}
                />
            )}

            {/* MODAL IMPORT EXCEL / PARSE TEXT */}
            <ImportTargetModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                employees={employees}
                campaigns={campaigns}
                onApplyTargets={handleApplyImportedTargets}
                onDownloadTemplate={handleExportExcelTemplate}
            />
        </div>
    );
}