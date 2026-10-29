import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    fetchStores,
    fetchEmployees,
    fetchCampaignDictionary,
    fetchEmployeeCampaignTargets,
    type StoreItem,
    type EmployeeItem,
    type CampaignDictItem
} from '../../core/lib/storage';
import {
    syncAndFetchEmployeeDataSessions,
    type EmployeeDataSession
} from '../employee-cumulative/utils/sessionStorage';
import {
    fetchCampaignOffsets,
    saveCampaignOffsets,
    deleteCampaignOffset,
    calculateSmartAutoOffsets,
    type CampaignOffsetItem,
    type SmartOffsetSuggestion
} from './services/campaignOffsetService';
import { isStoreMatch, getShortStoreName, getYesterdayDateString } from '../../core/lib/formatters';
import { isGuestDemoStore } from '../../core/lib/guestDemoStoreService';
import { useAuth } from '../../shared/contexts/AuthContext';
import { useUserStoreFilter } from '../../shared/hooks/useUserStoreFilter';
import { useExcelExportPermission } from '../../shared/hooks/useExcelExportPermission';
import ReportDataFreshnessBar from '../../shared/components/report/ReportDataFreshnessBar';
import CampaignOffsetTable from './components/CampaignOffsetTable';
import SmartAutoOffsetModal from './components/SmartAutoOffsetModal';
import ManualAddOffsetModal from './components/ManualAddOffsetModal';
import CampaignOffsetSqlModal from './components/CampaignOffsetSqlModal';
import ReportActionButtons from '../../shared/components/report/ReportActionButtons';
import {
    Shuffle,
    Calendar,
    Store,
    RefreshCw,
    Sparkles,
    Plus,
    Save,
    Camera,
    Copy,
    Database,
    Users,
    PackageCheck,
    Award,
    CheckCircle2,
    Search,
    Filter,
    RotateCcw
} from 'lucide-react';
import html2canvas from 'html2canvas';

export default function CampaignOffsetPage() {
    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
    const [selectedStore, setSelectedStore] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Dữ liệu nền tảng
    const [stores, setStores] = useState<StoreItem[]>([]);
    const [employees, setEmployees] = useState<EmployeeItem[]>([]);
    const [campaignDict, setCampaignDict] = useState<CampaignDictItem[]>([]);
    const [campaignTargets, setCampaignTargets] = useState<Record<string, Record<string, number>>>({});
    const [campaignActualsMap, setCampaignActualsMap] = useState<Record<string, Record<string, number>>>({});
    const [latestSession, setLatestSession] = useState<EmployeeDataSession | null>(null);

    // Danh sách bản ghi cấn trừ
    const [offsets, setOffsets] = useState<CampaignOffsetItem[]>([]);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(true);
    const [isSaving, setIsSaving] = useState<boolean>(false);

    // Modals
    const [isSmartModalOpen, setIsSmartModalOpen] = useState<boolean>(false);
    const [isManualModalOpen, setIsManualModalOpen] = useState<boolean>(false);
    const [showSqlModal, setShowSqlModal] = useState<boolean>(false);
    const [autoSuggestions, setAutoSuggestions] = useState<SmartOffsetSuggestion[]>([]);
    const [toastMessage, setToastMessage] = useState<string>('');

    const { currentUser, isAdmin, isGuest } = useAuth();
    const { allowedStores } = useUserStoreFilter(stores, selectedStore, setSelectedStore);
    const { canExportExcel } = useExcelExportPermission('/can-tru-thi-dua');
    const reportRef = useRef<HTMLDivElement>(null);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 3500);
    };

    // 1. TẢI DỮ LIỆU
    const loadAllData = async () => {
        setLoading(true);
        try {
            const [storesRes, empRes, campDictRes, campTargetsRes, offsetRes, sessions] = await Promise.all([
                fetchStores(),
                fetchEmployees(),
                fetchCampaignDictionary(),
                fetchEmployeeCampaignTargets(selectedMonth, selectedYear),
                fetchCampaignOffsets(selectedStore, selectedMonth, selectedYear),
                syncAndFetchEmployeeDataSessions({
                    month: selectedMonth,
                    year: selectedYear,
                    storeName: selectedStore === 'all' ? undefined : selectedStore
                })
            ]);

            if (storesRes.success && storesRes.data) setStores(storesRes.data);
            if (empRes.success && empRes.data) setEmployees(empRes.data);
            if (campDictRes.success && campDictRes.data) setCampaignDict(campDictRes.data);
            if (offsetRes.success && offsetRes.data) setOffsets(offsetRes.data);

            // Map Targets
            const cTargetMap: Record<string, Record<string, number>> = {};
            if (campTargetsRes.success && campTargetsRes.data) {
                campTargetsRes.data.forEach((row: any) => {
                    const empId = String(row.employee_id || '').trim();
                    const rawKey = String(row.raw_key || '').trim();
                    if (empId && rawKey) {
                        if (!cTargetMap[empId]) cTargetMap[empId] = {};
                        cTargetMap[empId][rawKey] = Number(row.target_value) || 0;
                    }
                });
            }
            setCampaignTargets(cTargetMap);

            // Map Actuals từ phiên mới nhất
            const currentStoresList = storesRes.data || stores;
            const validSessions = sessions.filter(sess => {
                if (sess.session_type !== 'REVENUE_CAMPAIGN' && sess.session_type !== 'FULL_SYNC') return false;
                const isDemo = isGuestDemoStore(sess.store_name);
                if (isGuest) return isDemo;
                if (isDemo) return false;

                if (selectedStore === 'all') {
                    if (isAdmin) return true;
                    return allowedStores.some(s => isStoreMatch(s.name, sess.store_name, currentStoresList));
                }
                return isStoreMatch(sess.store_name, selectedStore, currentStoresList);
            });

            const newest = validSessions.slice().sort((a, b) =>
                (b.report_date || '').localeCompare(a.report_date || '') ||
                (b.created_at || '').localeCompare(a.created_at || '')
            )[0] || null;
            setLatestSession(newest);

            const cActualMap: Record<string, Record<string, number>> = {};
            validSessions.forEach(sess => {
                if (Array.isArray(sess.records)) {
                    sess.records.forEach(r => {
                        const empId = (r.employee_id || '').trim();
                        if (empId && !cActualMap[empId] && r.campaigns) {
                            cActualMap[empId] = r.campaigns;
                        }
                    });
                }
            });
            setCampaignActualsMap(cActualMap);
            setHasUnsavedChanges(false);

        } catch (error) {
            console.error('Lỗi khi tải dữ liệu cấn trừ:', error);
            showToast('⚠️ Không thể tải dữ liệu mới nhất!');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAllData();
    }, [selectedStore, selectedMonth, selectedYear]);

    // Danh sách nhân viên khả dụng theo siêu thị & phân quyền
    const filteredEmployees = useMemo(() => {
        return employees.filter(emp => {
            const empStore = emp.store_name || '';
            const isDemo = isGuestDemoStore(empStore) || emp.employee_id?.trim().startsWith('NV838');
            if (isGuest) return isDemo;
            if (isDemo) return false;

            if (selectedStore === 'all') {
                if (isAdmin) return true;
                return allowedStores.some(s => isStoreMatch(s.name, empStore, stores));
            }
            return isStoreMatch(empStore, selectedStore, stores);
        });
    }, [employees, selectedStore, stores, isGuest, isAdmin, allowedStores]);

    // Danh sách cấn trừ hiển thị (kèm tìm kiếm)
    const displayedOffsets = useMemo(() => {
        if (!searchQuery.trim()) return offsets;
        const q = searchQuery.toLowerCase().trim();
        return offsets.filter(o => {
            const emp = employees.find(e => e.employee_id.trim() === o.employee_id.trim());
            const fullName = emp ? emp.full_name.toLowerCase() : '';
            return (
                o.employee_id.toLowerCase().includes(q) ||
                fullName.includes(q) ||
                (o.note && o.note.toLowerCase().includes(q))
            );
        });
    }, [offsets, searchQuery, employees]);

    // Tổng hợp chỉ số KPI
    const totalOffsetUnits = useMemo(() => {
        return offsets.reduce((sum, o) => sum + (Number(o.offset_quantity) || 0), 0);
    }, [offsets]);

    const uniqueEmployeesOffset = useMemo(() => {
        return new Set(offsets.map(o => o.employee_id.trim())).size;
    }, [offsets]);

    // XỬ LÝ GỢI Ý THÔNG MINH
    const handleOpenSmartAuto = () => {
        const suggestions = calculateSmartAutoOffsets(
            filteredEmployees,
            campaignTargets,
            campaignActualsMap,
            campaignDict
        );
        setAutoSuggestions(suggestions);
        setIsSmartModalOpen(true);
    };

    const handleApplySmartSuggestions = (suggestions: SmartOffsetSuggestion[]) => {
        const newOffsets: CampaignOffsetItem[] = suggestions.map(s => ({
            id: crypto.randomUUID(),
            store_name: selectedStore === 'all' ? (filteredEmployees.find(e => e.employee_id === s.employee_id)?.store_name || 'Hệ Thống') : selectedStore,
            month: selectedMonth,
            year: selectedYear,
            employee_id: s.employee_id,
            from_campaign_key: s.from_campaign_key,
            to_campaign_key: s.to_campaign_key,
            offset_quantity: s.offset_quantity,
            note: s.reason,
            is_approved: true,
            created_at: new Date().toISOString()
        }));

        setOffsets([...offsets, ...newOffsets]);
        setHasUnsavedChanges(true);
        setIsSmartModalOpen(false);
        showToast(`✨ Đã thêm ${newOffsets.length} cặp cấn trừ thông minh! Bấm "Lưu Lên Cloud" để chốt.`);
    };

    const handleAddManualOffset = (newItem: CampaignOffsetItem) => {
        setOffsets([newItem, ...offsets]);
        setHasUnsavedChanges(true);
        showToast('✅ Đã thêm cặp cấn trừ thủ công!');
    };

    const handleDeleteOffset = async (id: string) => {
        setOffsets(offsets.filter(o => o.id !== id));
        setHasUnsavedChanges(true);
        await deleteCampaignOffset(id, selectedStore, selectedMonth, selectedYear);
        showToast('🗑️ Đã xóa bản ghi cấn trừ!');
    };

    const handleSaveToCloud = async () => {
        setIsSaving(true);
        const res = await saveCampaignOffsets(
            offsets,
            selectedStore,
            selectedMonth,
            selectedYear,
            currentUser?.full_name || 'Quản lý'
        );
        setIsSaving(false);

        if (res.success) {
            setHasUnsavedChanges(false);
            showToast('🚀 Đã lưu và chốt số liệu cấn trừ thành công lên Supabase Cloud!');
        } else {
            showToast(`⚠️ Lỗi lưu Cloud: ${res.error || 'Vui lòng thử lại'}`);
        }
    };

    const handleResetAllOffsets = async () => {
        if (!window.confirm(`⚠️ Bạn có chắc chắn muốn xóa TOÀN BỘ ${offsets.length} bản ghi cấn trừ của Tháng ${selectedMonth}/${selectedYear} không?\n\nSố liệu thi đua của nhân viên sẽ lập tức được khôi phục về 100% nguyên bản từ phiên dữ liệu!`)) {
            return;
        }

        setIsSaving(true);
        const res = await saveCampaignOffsets([], selectedStore, selectedMonth, selectedYear, currentUser?.full_name || 'Quản lý');
        setIsSaving(false);

        if (res.success) {
            setOffsets([]);
            setHasUnsavedChanges(false);
            showToast('🔄 Đã khôi phục toàn bộ số liệu gốc ban đầu!');
        } else {
            showToast('⚠️ Lỗi khi khôi phục số liệu!');
        }
    };

    // XUẤT HÌNH ẢNH BÁO CÁO (Quy chuẩn 2: Portrait 800-1000px, không watermark, unlimited height)
    const handleExportImage = async (action: 'DOWNLOAD' | 'COPY') => {
        if (!reportRef.current) return;
        showToast(action === 'COPY' ? '📸 Đang sao chép ảnh...' : '📥 Đang xuất ảnh...');

        try {
            const canvas = await html2canvas(reportRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                ignoreElements: (el) => {
                    return (
                        el.getAttribute('data-html2canvas-ignore') === 'true' ||
                        el.getAttribute('data-export-ignore') === 'true'
                    );
                },
                onclone: (clonedDoc) => {
                    clonedDoc.documentElement.style.height = 'auto';
                    clonedDoc.body.style.height = 'auto';

                    const container = clonedDoc.querySelector('[data-export-container="true"]') as HTMLElement;
                    if (container) {
                        container.style.height = 'auto';
                        container.style.maxHeight = 'none';
                        container.style.overflow = 'visible';
                        container.style.width = '880px';
                    }

                    const scrollableNodes = clonedDoc.querySelectorAll('.overflow-x-auto, .overflow-y-auto, [class*="max-h-"]');
                    scrollableNodes.forEach((node) => {
                        const el = node as HTMLElement;
                        el.style.overflow = 'visible';
                        el.style.maxHeight = 'none';
                    });
                }
            });

            if (action === 'COPY') {
                canvas.toBlob(async (blob) => {
                    if (blob) {
                        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                        showToast('📋 Đã sao chép ảnh cấn trừ vào Clipboard!');
                    }
                });
            } else {
                const link = document.createElement('a');
                link.download = `Can_Tru_Thi_Dua_${selectedStore}_Thang_${selectedMonth}_${selectedYear}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
                showToast('💾 Đã tải ảnh cấn trừ thành công!');
            }
        } catch (err) {
            console.error('Lỗi khi xuất ảnh cấn trừ:', err);
            showToast('⚠️ Không thể xuất ảnh cấn trừ!');
        }
    };

    return (
        <div className="space-y-4 pb-12 font-sans animate-in fade-in duration-300">
            {/* Toast Thông báo */}
            {toastMessage && (
                <div className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-xl border border-slate-700 animate-in slide-in-from-top-2">
                    {toastMessage}
                </div>
            )}

            {/* Banner trạng thái đồng bộ dữ liệu Cloud (Quy chuẩn 8) */}
            <div data-html2canvas-ignore="true" data-export-ignore="true">
                <ReportDataFreshnessBar
                    latestDataDate={latestSession?.report_date}
                    expectedDate={getYesterdayDateString()}
                    sessionTitle={latestSession?.session_title}
                    lastUpdatedAt={latestSession?.created_at}
                    lastUpdatedBy={latestSession?.created_by}
                    storeName={selectedStore}
                    actionUrl="/cap-nhat-luy-ke-nhan-vien"
                    actionLabel="Cập nhật số liệu"
                />
            </div>

            {/* THANH BỘ LỌC CHUYÊN NGHIỆP */}
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3" data-html2canvas-ignore="true" data-export-ignore="true">
                {/* DÒNG 1: SIÊU THỊ / CỤM RIÊNG LẺ (Quy chuẩn 10) & CÁC NÚT HÀNH ĐỘNG */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1 max-w-md">
                        <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-200 shrink-0">
                            <Store className="w-4 h-4" />
                        </div>
                        <select
                            value={selectedStore}
                            onChange={e => setSelectedStore(e.target.value)}
                            className="flex-1 px-3 py-1.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 bg-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                        >
                            <option value="all">Toàn bộ siêu thị ({stores.length} Shop)</option>
                            {stores.map(s => (
                                <option key={s.id || s.name} value={s.name}>
                                    {getShortStoreName(s.name)}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Nút hành động chính */}
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        <button
                            onClick={handleOpenSmartAuto}
                            className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                        >
                            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                            <span>Gợi Ý Tự Động</span>
                        </button>

                        <button
                            onClick={() => setIsManualModalOpen(true)}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Thêm Thủ Công</span>
                        </button>

                        <button
                            onClick={handleSaveToCloud}
                            disabled={isSaving}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs ${
                                hasUnsavedChanges
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse'
                                    : 'bg-slate-800 hover:bg-slate-900 text-white'
                            }`}
                        >
                            <Save className="w-3.5 h-3.5" />
                            <span>{isSaving ? 'Đang lưu...' : hasUnsavedChanges ? 'Lưu Cloud (Có thay đổi)' : 'Lưu Cloud'}</span>
                        </button>

                        {offsets.length > 0 && (
                            <button
                                onClick={handleResetAllOffsets}
                                disabled={isSaving}
                                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                                title="Xóa toàn bộ cấn trừ, khôi phục 100% số liệu gốc ban đầu từ phiên"
                            >
                                <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                                <span>Khôi Phục Gốc</span>
                            </button>
                        )}

                        {/* Nút SQL cho Admin (Quy chuẩn 12) */}
                        {isAdmin && (
                            <button
                                onClick={() => setShowSqlModal(true)}
                                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 transition"
                                title="Xem mã lệnh SQL DDL Supabase (Admin-only)"
                            >
                                <Database className="w-4 h-4 text-emerald-600" />
                            </button>
                        )}

                        {/* Nút Xuất ảnh */}
                        <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                            <button
                                onClick={() => handleExportImage('COPY')}
                                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                                title="Sao chép ảnh báo cáo vào bộ nhớ tạm"
                            >
                                <Copy className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => handleExportImage('DOWNLOAD')}
                                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                                title="Tải ảnh báo cáo về máy"
                            >
                                <Camera className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* DÒNG 2: THÁNG / NĂM & TÌM KIẾM NHÂN VIÊN */}
                <div className="pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-bold text-slate-600">Kỳ chốt số:</span>
                        <select
                            value={selectedMonth}
                            onChange={e => setSelectedMonth(Number(e.target.value))}
                            className="px-2.5 py-1 border border-slate-300 rounded-lg text-xs font-bold bg-white"
                        >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                <option key={m} value={m}>Tháng {m}</option>
                            ))}
                        </select>
                        <select
                            value={selectedYear}
                            onChange={e => setSelectedYear(Number(e.target.value))}
                            className="px-2.5 py-1 border border-slate-300 rounded-lg text-xs font-bold bg-white"
                        >
                            {[2025, 2026, 2027].map(y => (
                                <option key={y} value={y}>Năm {y}</option>
                            ))}
                        </select>
                    </div>

                    <div className="relative w-full sm:w-64">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Tìm theo Mã NV hoặc tên..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-1 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                        />
                    </div>
                </div>
            </div>

            {/* VÙNG XUẤT BÁO CÁO (EXPORT CONTAINER) */}
            <div
                ref={reportRef}
                data-export-container="true"
                className="space-y-4 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200"
            >
                {/* Header Báo Cáo */}
                <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-purple-100 text-purple-900 border border-purple-300 uppercase tracking-wider">
                                CHỐT KỲ THI ĐUA
                            </span>
                            <span className="text-xs text-slate-500 font-medium">
                                Quy tắc cấn trừ 1 đổi 1 theo sản phẩm thực tế
                            </span>
                        </div>
                        <h2 className="text-lg sm:text-xl font-black text-slate-900 mt-1 tracking-tight font-avo">
                            BẢNG CÂN ĐỐI & CẤN TRỪ THI ĐUA CUỐI THÁNG
                        </h2>
                        <div className="text-xs text-slate-600 mt-0.5">
                            Siêu thị: <b className="text-purple-800 font-bold">{selectedStore === 'all' ? 'Toàn bộ siêu thị' : selectedStore}</b> • Kỳ: <b className="text-slate-800 font-bold">Tháng {selectedMonth}/{selectedYear}</b>
                        </div>
                    </div>

                    <div className="text-right text-[11px] text-slate-500 shrink-0">
                        Tổng cặp cấn trừ: <b className="text-purple-900 text-sm font-black font-mono">{offsets.length}</b>
                    </div>
                </div>

                {/* THẺ CHỈ SỐ KPI TỔNG HỢP */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-purple-50/50 p-3 rounded-xl border border-purple-100 flex items-center justify-between">
                        <div>
                            <div className="text-[10.5px] font-bold text-purple-800 uppercase tracking-wider">
                                NV Được Cứu Bù Số
                            </div>
                            <div className="text-lg font-black text-purple-950 mt-0.5 font-avo">
                                {uniqueEmployeesOffset} <span className="text-xs font-normal text-slate-500">nhân sự</span>
                            </div>
                        </div>
                        <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                            <Users className="w-4 h-4" />
                        </div>
                    </div>

                    <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 flex items-center justify-between">
                        <div>
                            <div className="text-[10.5px] font-bold text-emerald-800 uppercase tracking-wider">
                                Tổng Sản Phẩm Cấn Trừ
                            </div>
                            <div className="text-lg font-black text-emerald-950 mt-0.5 font-avo">
                                {totalOffsetUnits} <span className="text-xs font-normal text-slate-500">sản phẩm</span>
                            </div>
                        </div>
                        <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                            <PackageCheck className="w-4 h-4" />
                        </div>
                    </div>

                    <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 col-span-2 sm:col-span-1 flex items-center justify-between">
                        <div>
                            <div className="text-[10.5px] font-bold text-indigo-800 uppercase tracking-wider">
                                Trạng Thái Số Liệu
                            </div>
                            <div className="text-sm font-black text-indigo-950 mt-0.5 font-avo flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span>{hasUnsavedChanges ? 'Chưa lưu Cloud' : 'Đã chốt Cloud'}</span>
                            </div>
                        </div>
                        <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                            <Award className="w-4 h-4" />
                        </div>
                    </div>
                </div>

                {/* BẢNG CHI TIẾT CẤN TRỪ */}
                <CampaignOffsetTable
                    offsets={displayedOffsets}
                    employees={filteredEmployees}
                    campaigns={campaignDict}
                    onDelete={handleDeleteOffset}
                />
            </div>

            {/* MODALS */}
            <SmartAutoOffsetModal
                isOpen={isSmartModalOpen}
                onClose={() => setIsSmartModalOpen(false)}
                suggestions={autoSuggestions}
                onApply={handleApplySmartSuggestions}
            />

            <ManualAddOffsetModal
                isOpen={isManualModalOpen}
                onClose={() => setIsManualModalOpen(false)}
                employees={filteredEmployees}
                campaigns={campaignDict}
                storeName={selectedStore === 'all' ? (filteredEmployees[0]?.store_name || 'Hệ Thống') : selectedStore}
                month={selectedMonth}
                year={selectedYear}
                onAdd={handleAddManualOffset}
            />

            {isAdmin && (
                <CampaignOffsetSqlModal
                    isOpen={showSqlModal}
                    onClose={() => setShowSqlModal(false)}
                />
            )}
        </div>
    );
}
