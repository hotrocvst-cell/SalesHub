import { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchEmployees, fetchStores, type EmployeeItem, type StoreItem } from '../../core/lib/storage';
import { getYesterdayDateString, formatDateTime, getShortStoreName } from '../../core/lib/formatters';
import RevenuePasteTab from './components/RevenuePasteTab';
import CampaignPasteTab from './components/CampaignPasteTab';
import WorkHoursPasteTab from './components/WorkHoursPasteTab';
import CumulativeSummaryTab from './components/CumulativeSummaryTab';
import SessionHistoryTab from './components/SessionHistoryTab';
import StoreConfirmModal from './components/StoreConfirmModal';
import WorkHoursConfirmModal, { type WorkHoursSaveScope } from './components/WorkHoursConfirmModal';
import type { ParsedEmployeeRevenue, ParsedCampaignBlock } from './utils/employeeParsers';
import {
    saveEmployeeDataSession,
    updateEmployeeDataSession,
    type EmployeeDataSession
} from './utils/sessionStorage';
import {
    Coins,
    Trophy,
    Clock,
    LayoutDashboard,
    Calendar,
    Store,
    CheckCircle2,
    RefreshCw,
    History,
    AlertCircle,
    Trash2,
    ArrowRight,
    Database,
    Save,
    X
} from 'lucide-react';

export default function EmployeeCumulativePage() {
    const location = useLocation();
    const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
    const [reportDate] = useState<string>(() => getYesterdayDateString());
    const [selectedStore, setSelectedStore] = useState<string>('all');

    // Quản lý phiên đang được nạp vào để xem / chỉnh sửa
    const [editingSession, setEditingSession] = useState<{
        id: string;
        session_title: string;
        session_type: string;
        store_name: string;
        month: number;
        year: number;
        report_date?: string;
    } | null>(null);

    const [stores, setStores] = useState<StoreItem[]>([]);
    const [employees, setEmployees] = useState<EmployeeItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [toastMessage, setToastMessage] = useState<string>('');

    // State lưu dữ liệu bóc tách
    const [activeTab, setActiveTab] = useState<'revenue' | 'campaign' | 'hours' | 'summary' | 'history'>('revenue');
    const [revenueData, setRevenueData] = useState<ParsedEmployeeRevenue[]>([]);
    const [campaignBlocks, setCampaignBlocks] = useState<ParsedCampaignBlock[]>([]);
    const [campaignMatrix, setCampaignMatrix] = useState<Record<string, Record<string, number>>>({});
    const [workHoursMap, setWorkHoursMap] = useState<Record<string, number>>({});

    // State Modal xác nhận siêu thị (Doanh thu & Thi đua) và Giờ công
    const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
    const [isWorkHoursModalOpen, setIsWorkHoursModalOpen] = useState(false);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 3500);
    };

    const loadInitialData = async () => {
        setLoading(true);
        const [storesRes, empsRes] = await Promise.all([
            fetchStores(),
            fetchEmployees()
        ]);
        if (storesRes.success) setStores(storesRes.data);
        if (empsRes.success) setEmployees(empsRes.data);
        setLoading(false);
    };

    useEffect(() => {
        loadInitialData();
    }, []);

    // State quản lý bản nháp chưa lưu phiên
    const [hasLocalDraft, setHasLocalDraft] = useState<boolean>(false);
    const [draftSavedTime, setDraftSavedTime] = useState<string>('');

    // Nạp dữ liệu khi được chuyển hướng từ trang Quản Lý Phiên (hoặc từ SessionHistoryTab)
    useEffect(() => {
        let payload = (location.state as any) || null;
        if (!payload || !payload.editingSession) {
            try {
                const stored = localStorage.getItem('saleshub_emp_cum_active_restore');
                if (stored) {
                    payload = JSON.parse(stored);
                }
            } catch (e) {}
        }

        if (payload && payload.editingSession) {
            if (payload.month) setSelectedMonth(payload.month);
            if (payload.year) setSelectedYear(payload.year);
            if (payload.store && payload.store !== 'all') setSelectedStore(payload.store);
            setEditingSession(payload.editingSession);

            if (payload.revenueData && payload.revenueData.length > 0) {
                setRevenueData(payload.revenueData);
            }
            if (payload.campaignBlocks && payload.campaignBlocks.length > 0) {
                setCampaignBlocks(payload.campaignBlocks);
            }
            if (payload.campaignMatrix && Object.keys(payload.campaignMatrix).length > 0) {
                setCampaignMatrix(payload.campaignMatrix);
            }
            if (payload.workHoursMap && Object.keys(payload.workHoursMap).length > 0) {
                setWorkHoursMap(payload.workHoursMap);
            }
            if (payload.activeTab) {
                setActiveTab(payload.activeTab);
            }

            // Xóa key chuyển tiếp để tránh kích hoạt lại ngoài ý muốn
            localStorage.removeItem('saleshub_emp_cum_active_restore');
            showToast(`📂 Đã nạp thành công phiên: "${payload.editingSession.session_title}"`);
        }
    }, [location.state]);

    const handleExitEditSession = () => {
        setEditingSession(null);
        localStorage.removeItem('saleshub_emp_cum_active_restore');
        showToast('Đã thoát chế độ chỉnh sửa phiên.');
    };

    // Lưu / Đọc bản nháp từ localStorage theo Tháng và Năm (không reset khi đổi siêu thị)
    const draftKey = `saleshub_emp_cum_draft_${selectedMonth}_${selectedYear}`;
    useEffect(() => {
        try {
            const savedDraft = localStorage.getItem(draftKey);
            if (savedDraft) {
                const parsed = JSON.parse(savedDraft);
                let hasContent = false;
                if (parsed.revenueData && parsed.revenueData.length > 0) {
                    setRevenueData(parsed.revenueData);
                    hasContent = true;
                }
                if (parsed.selectedStore && parsed.selectedStore !== 'all') {
                    setSelectedStore(parsed.selectedStore);
                }
                if (parsed.campaignBlocks) setCampaignBlocks(parsed.campaignBlocks);
                if (parsed.campaignMatrix) setCampaignMatrix(parsed.campaignMatrix);
                if (parsed.workHoursMap && Object.keys(parsed.workHoursMap).length > 0) {
                    setWorkHoursMap(parsed.workHoursMap);
                    hasContent = true;
                }
                if (hasContent && !parsed.isSavedSession) {
                    setHasLocalDraft(true);
                    setDraftSavedTime(parsed.updatedAt ? formatDateTime(parsed.updatedAt) : '');
                } else {
                    setHasLocalDraft(false);
                }
            } else {
                setRevenueData([]);
                setCampaignBlocks([]);
                setCampaignMatrix({});
                setWorkHoursMap({});
                setHasLocalDraft(false);
            }
        } catch (e) {
            console.warn(e);
        }
    }, [draftKey]);

    const saveDraft = (overrides?: {
        revenueData?: ParsedEmployeeRevenue[];
        campaignBlocks?: ParsedCampaignBlock[];
        campaignMatrix?: Record<string, Record<string, number>>;
        workHoursMap?: Record<string, number>;
        store?: string;
    }) => {
        try {
            const now = new Date();
            const revToSave = overrides?.revenueData ?? revenueData;
            const campToSave = overrides?.campaignBlocks ?? campaignBlocks;
            const matrixToSave = overrides?.campaignMatrix ?? campaignMatrix;
            const hoursToSave = overrides?.workHoursMap ?? workHoursMap;
            const storeToSave = overrides?.store ?? selectedStore;

            if (revToSave.length === 0 && campToSave.length === 0 && Object.keys(hoursToSave).length === 0) {
                return;
            }

            localStorage.setItem(draftKey, JSON.stringify({
                selectedStore: storeToSave,
                revenueData: revToSave,
                campaignBlocks: campToSave,
                campaignMatrix: matrixToSave,
                workHoursMap: hoursToSave,
                updatedAt: now.toISOString(),
                isSavedSession: false
            }));
            setHasLocalDraft(true);
            setDraftSavedTime(formatDateTime(now));
        } catch (e) {
            console.warn(e);
        }
    };

    const handleDiscardCumulativeDraft = () => {
        if (window.confirm('Bạn có chắc chắn muốn xóa bản nháp số liệu này không?')) {
            localStorage.removeItem(draftKey);
            setRevenueData([]);
            setCampaignBlocks([]);
            setCampaignMatrix({});
            setWorkHoursMap({});
            setHasLocalDraft(false);
            showToast('Đã xóa bản nháp!');
        }
    };

    // 1. Áp dụng Doanh thu & Thi đua
    const handleApplyRevenue = (data: ParsedEmployeeRevenue[], detectedStoreName?: string | null) => {
        setRevenueData(data);
        let storeMsg = '';
        let targetStore = selectedStore;
        if (detectedStoreName) {
            // Tự động tìm siêu thị tương ứng trong danh sách stores
            const matched = stores.find(s => 
                (s.code && detectedStoreName.toLowerCase().includes(s.code.toLowerCase())) ||
                detectedStoreName.toLowerCase().includes(s.name.toLowerCase()) ||
                s.name.toLowerCase().includes(detectedStoreName.toLowerCase())
            );
            if (matched) {
                targetStore = matched.name;
                setSelectedStore(matched.name);
                storeMsg = ` (Đã chọn ST ${matched.name})`;
            }
        }
        saveDraft({ revenueData: data, store: targetStore });
        showToast(`✅ Đã bóc tách doanh thu cho ${data.length} nhân sự!${storeMsg}`);
        setActiveTab('campaign');
    };

    const handleApplyCampaign = (camps: ParsedCampaignBlock[], matrix: Record<string, Record<string, number>>) => {
        setCampaignBlocks(camps);
        setCampaignMatrix(matrix);
        saveDraft({ campaignBlocks: camps, campaignMatrix: matrix });
        showToast(`✅ Đã bóc tách ${camps.length} chiến dịch thi đua!`);
        setActiveTab('hours');
    };

    // 2. Áp dụng Giờ công (Toàn cụm hỗn hợp)
    const handleApplyHours = (hoursMap: Record<string, number>) => {
        setWorkHoursMap(hoursMap);
        saveDraft({ workHoursMap: hoursMap });
        showToast(`✅ Đã cộng dồn giờ công cho ${Object.keys(hoursMap).length} nhân sự!`);
        setActiveTab('summary');
    };

    // Tính toán phân bổ giờ công theo từng siêu thị dựa trên danh mục nhân sự
    const workHoursStoreBreakdown = useMemo(() => {
        const map: Record<string, { employeeCount: number; hours: number }> = {};
        Object.entries(workHoursMap).forEach(([empId, h]) => {
            if (h <= 0) return;
            const emp = employees.find(e => e.employee_id === empId);
            const sName = emp?.store_name?.trim() || (selectedStore !== 'all' ? selectedStore : 'Chưa phân siêu thị');
            if (!map[sName]) {
                map[sName] = { employeeCount: 0, hours: 0 };
            }
            map[sName].employeeCount += 1;
            map[sName].hours = Number((map[sName].hours + h).toFixed(2));
        });
        return Object.entries(map).map(([storeName, stat]) => ({
            storeName,
            employeeCount: stat.employeeCount,
            hours: stat.hours
        })).sort((a, b) => b.hours - a.hours);
    }, [workHoursMap, employees, selectedStore]);

    // 3. MỞ MODAL XÁC NHẬN LƯU GIỜ CÔNG
    const handleSaveWorkHoursOnly = async () => {
        setIsWorkHoursModalOpen(true);
    };

    // THỰC HIỆN LƯU HOẶC CẬP NHẬT GIỜ CÔNG
    const handleConfirmWorkHoursSave = async (options: {
        saveMode: 'update' | 'new';
        scope: WorkHoursSaveScope;
        selectedStoreName?: string;
    }) => {
        setIsSaving(true);
        saveDraft();
        const { saveMode, scope, selectedStoreName } = options;

        // 1. CHẾ ĐỘ TÁCH RIÊNG THEO TỪNG SIÊU THỊ
        if (scope === 'split_by_store') {
            const storeGroups: Record<string, { empId: string; h: number }[]> = {};
            Object.entries(workHoursMap).forEach(([empId, h]) => {
                if (h <= 0) return;
                const emp = employees.find(e => e.employee_id === empId);
                const sName = emp?.store_name?.trim() || (selectedStore !== 'all' ? selectedStore : 'Toàn Cụm Siêu Thị');
                if (!storeGroups[sName]) storeGroups[sName] = [];
                storeGroups[sName].push({ empId, h });
            });

            const storeNames = Object.keys(storeGroups);
            if (storeNames.length === 0) {
                showToast('Không có dữ liệu giờ công lớn hơn 0 để lưu!');
                setIsSaving(false);
                return;
            }

            let savedSuccess = 0;
            for (const sName of storeNames) {
                const groupItems = storeGroups[sName];
                const groupTotalHours = Number(groupItems.reduce((acc, it) => acc + it.h, 0).toFixed(2));
                const groupRecords = groupItems.map(it => ({
                    employee_id: it.empId,
                    full_name: employees.find(e => e.employee_id === it.empId)?.full_name || `NV ${it.empId}`,
                    quantity: 0,
                    revenue_qd: 0,
                    revenue_actual: 0,
                    installment_revenue: 0,
                    installment_rate: 0,
                    work_hours: it.h
                }));

                const sessionPayload = {
                    session_type: 'WORK_HOURS' as const,
                    session_title: `Cập nhật Giờ công - ${getShortStoreName(sName)} (T${selectedMonth}/${selectedYear})`,
                    store_name: sName,
                    month: selectedMonth,
                    year: selectedYear,
                    report_date: reportDate,
                    created_by: 'Quản lý',
                    employee_count: groupRecords.length,
                    total_revenue_actual: 0,
                    total_revenue_qd: 0,
                    total_work_hours: groupTotalHours,
                    source_type: 'PASTE_TEXT' as const,
                    records: groupRecords
                };

                const res = await saveEmployeeDataSession(sessionPayload);
                if (res.success) savedSuccess++;
            }

            setIsSaving(false);
            setIsWorkHoursModalOpen(false);
            setHasLocalDraft(false);
            showToast(`🎉 Đã tách và lưu thành công ${savedSuccess} phiên giờ công riêng theo từng siêu thị lên hệ thống & Cloud!`);
            return;
        }

        // 2. CHẾ ĐỘ LƯU CHO 1 SIÊU THỊ CỤ THỂ HOẶC TOÀN CỤM
        const targetStore = scope === 'single_store' && selectedStoreName
            ? selectedStoreName
            : (selectedStore !== 'all' ? selectedStore : 'Toàn Cụm Siêu Thị');

        const totalHours = Object.values(workHoursMap).reduce((s, h) => s + h, 0);
        const records = Object.entries(workHoursMap).map(([empId, h]) => ({
            employee_id: empId,
            full_name: employees.find(e => e.employee_id === empId)?.full_name || `NV ${empId}`,
            quantity: 0,
            revenue_qd: 0,
            revenue_actual: 0,
            installment_revenue: 0,
            installment_rate: 0,
            work_hours: h
        }));

        const sessionPayload = {
            session_type: 'WORK_HOURS' as const,
            session_title: editingSession && saveMode === 'update' && editingSession.session_type === 'WORK_HOURS'
                ? editingSession.session_title
                : `Cập nhật Giờ công - ${getShortStoreName(targetStore)} (T${selectedMonth}/${selectedYear})`,
            store_name: targetStore,
            month: selectedMonth,
            year: selectedYear,
            report_date: reportDate,
            created_by: 'Quản lý',
            employee_count: Object.keys(workHoursMap).length,
            total_revenue_actual: 0,
            total_revenue_qd: 0,
            total_work_hours: totalHours,
            source_type: 'PASTE_TEXT' as const,
            records
        };

        let res;
        if (saveMode === 'update' && editingSession && editingSession.id && editingSession.session_type === 'WORK_HOURS') {
            res = await updateEmployeeDataSession(editingSession.id, sessionPayload);
            if (res.success && res.session) {
                setEditingSession({
                    ...editingSession,
                    session_title: res.session.session_title
                });
                showToast(`🎉 Đã cập nhật thành công phiên giờ công [${res.session.session_title}] lên hệ thống & Cloud!`);
            }
        } else {
            res = await saveEmployeeDataSession(sessionPayload);
            if (res.success && res.session) {
                setEditingSession({
                    id: res.session.id,
                    session_title: res.session.session_title,
                    session_type: res.session.session_type,
                    store_name: res.session.store_name,
                    month: res.session.month,
                    year: res.session.year,
                    report_date: res.session.report_date
                });
                showToast(`🎉 Đã lưu phiên giờ công [${getShortStoreName(targetStore)}] (${Object.keys(workHoursMap).length} nhân sự) lên hệ thống & Cloud!`);
            }
        }

        setIsSaving(false);
        setIsWorkHoursModalOpen(false);
        setHasLocalDraft(false);

        try {
            localStorage.setItem(draftKey, JSON.stringify({
                revenueData,
                campaignBlocks,
                campaignMatrix,
                workHoursMap,
                updatedAt: new Date().toISOString(),
                isSavedSession: true
            }));
        } catch (e) {}

        if (res && res.error) {
            showToast(`⚠️ ${res.error}`);
        }
    };

    // 4. LƯU DOANH THU & THI ĐUA (Theo siêu thị - HỖ TRỢ CẬP NHẬT PHIÊN ĐANG SỬA HOẶC LƯU MỚI)
    const handleConfirmStoreSave = async (confirmedStoreName: string, saveMode: 'update' | 'new' = 'update') => {
        setIsSaving(true);
        saveDraft();

        const totalRevAct = revenueData.reduce((s, r) => s + r.revenue_actual, 0);
        const totalRevQd = revenueData.reduce((s, r) => s + r.revenue_qd, 0);
        const records = revenueData.map(r => ({
            employee_id: r.employee_id,
            full_name: r.full_name,
            quantity: r.quantity,
            revenue_qd: r.revenue_qd,
            revenue_actual: r.revenue_actual,
            installment_revenue: r.installment_revenue,
            installment_rate: r.installment_rate,
            campaigns: campaignMatrix[r.employee_id] || {}
        }));

        const sessionPayload = {
            session_type: 'REVENUE_CAMPAIGN' as const,
            session_title: editingSession && saveMode === 'update' && editingSession.session_type === 'REVENUE_CAMPAIGN'
                ? editingSession.session_title
                : `Cập nhật Doanh thu & Thi đua - ${confirmedStoreName}`,
            store_name: confirmedStoreName,
            month: selectedMonth,
            year: selectedYear,
            report_date: reportDate,
            created_by: 'Quản lý',
            employee_count: revenueData.length,
            total_revenue_actual: totalRevAct,
            total_revenue_qd: totalRevQd,
            total_work_hours: 0,
            source_type: 'PASTE_TEXT' as const,
            records
        };

        let res;
        if (saveMode === 'update' && editingSession && editingSession.id && editingSession.session_type === 'REVENUE_CAMPAIGN') {
            res = await updateEmployeeDataSession(editingSession.id, sessionPayload);
            if (res.success && res.session) {
                setEditingSession({
                    ...editingSession,
                    session_title: res.session.session_title,
                    store_name: res.session.store_name
                });
                showToast(`🎉 Đã cập nhật thành công phiên [${res.session.session_title}] lên hệ thống & Cloud!`);
            }
        } else {
            res = await saveEmployeeDataSession(sessionPayload);
            if (res.success && res.session) {
                setEditingSession({
                    id: res.session.id,
                    session_title: res.session.session_title,
                    session_type: res.session.session_type,
                    store_name: res.session.store_name,
                    month: res.session.month,
                    year: res.session.year,
                    report_date: res.session.report_date
                });
                showToast(`🎉 Đã lưu phiên Doanh thu & Thi đua cho siêu thị [${confirmedStoreName}] lên hệ thống & Cloud!`);
            }
        }

        setIsSaving(false);
        setIsStoreModalOpen(false);
        setHasLocalDraft(false);

        try {
            localStorage.setItem(draftKey, JSON.stringify({
                revenueData,
                campaignBlocks,
                campaignMatrix,
                workHoursMap,
                updatedAt: new Date().toISOString(),
                isSavedSession: true
            }));
        } catch (e) {}

        if (res && res.error) {
            showToast(`⚠️ ${res.error}`);
        }
    };

    // Phục hồi dữ liệu từ 1 phiên đã lưu
    const handleRestoreSession = (sess: EmployeeDataSession) => {
        setSelectedMonth(sess.month);
        setSelectedYear(sess.year);
        setEditingSession({
            id: sess.id,
            session_title: sess.session_title,
            session_type: sess.session_type,
            store_name: sess.store_name,
            month: sess.month,
            year: sess.year,
            report_date: sess.report_date
        });

        if (sess.session_type === 'REVENUE_CAMPAIGN') {
            const restoredRev = sess.records.map(r => ({
                employee_id: r.employee_id,
                full_name: r.full_name,
                quantity: r.quantity || 0,
                revenue_qd: r.revenue_qd || 0,
                revenue_actual: r.revenue_actual || 0,
                installment_revenue: r.installment_revenue || 0,
                installment_rate: r.installment_rate || 0
            }));
            setRevenueData(restoredRev);

            const campMatrix: Record<string, Record<string, number>> = {};
            const campBlocksMap: Record<string, Record<string, number>> = {};
            sess.records.forEach(r => {
                if (r.campaigns) {
                    campMatrix[r.employee_id] = r.campaigns;
                    Object.entries(r.campaigns).forEach(([cName, val]) => {
                        if (!campBlocksMap[cName]) campBlocksMap[cName] = {};
                        campBlocksMap[cName][r.employee_id] = val;
                    });
                }
            });
            setCampaignMatrix(campMatrix);

            const reconstructedCampaignBlocks: ParsedCampaignBlock[] = Object.entries(campBlocksMap).map(([name, empVals]) => ({
                campaign_name: name,
                unit_type: 'DOANH THU',
                employee_values: empVals
            }));
            setCampaignBlocks(reconstructedCampaignBlocks);

            if (sess.store_name && sess.store_name !== 'Toàn Cụm Siêu Thị') {
                setSelectedStore(sess.store_name);
            }
            showToast(`Đã nạp phiên [${sess.session_title}] để chỉnh sửa!`);
            setActiveTab('revenue');
        } else if (sess.session_type === 'WORK_HOURS') {
            const restoredHours: Record<string, number> = {};
            sess.records.forEach(r => {
                if (r.work_hours !== undefined) {
                    restoredHours[r.employee_id] = r.work_hours;
                }
            });
            setWorkHoursMap(restoredHours);
            showToast(`Đã nạp phiên [${sess.session_title}] để chỉnh sửa!`);
            setActiveTab('hours');
        }
    };

    // Lọc danh sách nhân viên theo siêu thị
    const filteredEmployees = employees.filter(e => {
        if (selectedStore === 'all') return true;
        return e.store_name === selectedStore;
    });

    const totalRevActual = revenueData.reduce((sum, item) => sum + item.revenue_actual, 0);

    return (
        <div className="max-w-[1600px] mx-auto space-y-4 pb-12">
            {/* Header Phân Hệ */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
                            <LayoutDashboard className="w-5 h-5" />
                        </span>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                            Cập Nhật Lũy Kế Nhân Viên (Paste Text)
                        </h1>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                        Doanh thu & Thi đua cập nhật theo Siêu thị (có popup xác nhận). Giờ công nạp hỗn hợp Toàn cụm.
                    </p>
                </div>

                {/* Chọn Tháng & Siêu thị */}
                <div className="flex flex-wrap items-center gap-2 self-stretch lg:self-auto">
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                        <Store className="w-4 h-4 text-blue-600" />
                        <select
                            value={selectedStore}
                            onChange={e => setSelectedStore(e.target.value)}
                            className="bg-transparent text-xs font-bold text-slate-800 outline-hidden cursor-pointer"
                        >
                            <option value="all">🏢 Toàn Cụm Siêu Thị ({stores.length})</option>
                            {stores.map(s => (
                                <option key={s.id || s.code} value={s.name}>{s.name} ({s.code})</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                        <Calendar className="w-4 h-4 text-blue-600" />
                        <select
                            value={selectedMonth}
                            onChange={e => setSelectedMonth(Number(e.target.value))}
                            className="bg-transparent text-xs font-bold text-slate-800 outline-hidden cursor-pointer"
                        >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                <option key={m} value={m}>Tháng {m}</option>
                            ))}
                        </select>
                        <span className="text-slate-300">/</span>
                        <span className="text-xs font-bold text-slate-700">{selectedYear}</span>
                    </div>

                    <button
                        onClick={loadInitialData}
                        disabled={loading}
                        className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-slate-50 transition cursor-pointer"
                        title="Tải lại danh sách"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
                    </button>
                </div>
            </div>

            {/* BANNER CHẾ ĐỘ SỬA PHIÊN DỮ LIỆU */}
            {editingSession && (
                <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900 text-white rounded-2xl p-4 sm:p-5 shadow-lg border border-blue-500/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex items-start gap-3">
                        <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-400/30 shrink-0">
                            <Database className="w-5 h-5 text-amber-300" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider">
                                    Đang Chỉnh Sửa Phiên
                                </span>
                                <span className="text-xs text-blue-200 font-mono">ID: {editingSession.id}</span>
                                <span className="text-xs text-slate-400">·</span>
                                <span className="text-xs text-blue-200">Tháng {selectedMonth}/{selectedYear}</span>
                            </div>
                            <h3 className="font-extrabold text-sm sm:text-base text-white mt-1">
                                {editingSession.session_title}
                            </h3>
                            <p className="text-xs text-blue-200/90 mt-0.5">
                                Siêu thị: <b>{editingSession.store_name}</b> · Loại phiên:{' '}
                                <b>{editingSession.session_type === 'REVENUE_CAMPAIGN' ? 'Doanh Thu & Thi Đua' : 'Giờ Công Toàn Cụm'}</b>
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-stretch md:self-auto shrink-0 flex-wrap">
                        {editingSession.session_type === 'REVENUE_CAMPAIGN' ? (
                            <button
                                type="button"
                                onClick={() => setIsStoreModalOpen(true)}
                                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-md cursor-pointer"
                            >
                                <Save className="w-4 h-4" />
                                <span>Lưu Cập Nhật Phiên Này</span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setIsWorkHoursModalOpen(true)}
                                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-md cursor-pointer"
                            >
                                <Save className="w-4 h-4" />
                                <span>Lưu Cập Nhật Phiên Này</span>
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={handleExitEditSession}
                            className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5" />
                            <span>Thoát Chế Độ Sửa</span>
                        </button>
                    </div>
                </div>
            )}

            {/* BANNER CẢNH BÁO BẢN NHÁP NHÂN SỰ CHƯA LƯU PHIÊN */}
            {hasLocalDraft && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-amber-900 shadow-xs animate-in fade-in duration-200">
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-amber-100 text-amber-700 shrink-0">
                            <AlertCircle className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <h3 className="font-extrabold text-xs uppercase tracking-wider text-amber-900 flex items-center gap-2">
                                <span>⚠️ Đang có bản nháp dữ liệu nhân sự chưa lưu phiên {draftSavedTime ? `(${draftSavedTime})` : ''}</span>
                            </h3>
                            <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                                Dữ liệu doanh thu / thi đua / giờ công đang hiển thị từ bộ nhớ tạm của máy này. Hãy chuyển sang tab <b>Tổng Hợp &amp; Lưu Phiên</b> để lưu chính thức và đồng bộ lên hệ thống.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 self-stretch md:self-auto shrink-0 flex-wrap">
                        <button
                            type="button"
                            onClick={() => setActiveTab('summary')}
                            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                            <span>Đến Tab Tổng Hợp &amp; Lưu Phiên</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={handleDiscardCumulativeDraft}
                            className="px-3 py-2 bg-white hover:bg-rose-50 border border-slate-200 text-rose-600 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Xóa bản nháp</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Toast thông báo */}
            {toastMessage && (
                <div className="fixed top-16 right-5 z-50 animate-in slide-in-from-top-4 duration-200">
                    <div className="px-4 py-2.5 bg-slate-900 text-white rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold border border-slate-700">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>{toastMessage}</span>
                    </div>
                </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 bg-white rounded-t-2xl px-3 pt-2 overflow-x-auto">
                <button
                    onClick={() => setActiveTab('revenue')}
                    className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-extrabold transition cursor-pointer whitespace-nowrap ${
                        activeTab === 'revenue'
                            ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-xl'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <Coins className="w-4 h-4" />
                    <span>1. Lũy Kế Doanh Thu (Theo ST)</span>
                    {revenueData.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-100 text-blue-700">
                            {revenueData.length} NV
                        </span>
                    )}
                </button>

                <button
                    onClick={() => setActiveTab('campaign')}
                    className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-extrabold transition cursor-pointer whitespace-nowrap ${
                        activeTab === 'campaign'
                            ? 'border-amber-600 text-amber-600 bg-amber-50/50 rounded-t-xl'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <Trophy className="w-4 h-4" />
                    <span>2. Lũy Kế Thi Đua (Theo ST)</span>
                    {campaignBlocks.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-700">
                            {campaignBlocks.length} mục
                        </span>
                    )}
                </button>

                <button
                    onClick={() => setActiveTab('hours')}
                    className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-extrabold transition cursor-pointer whitespace-nowrap ${
                        activeTab === 'hours'
                            ? 'border-emerald-600 text-emerald-600 bg-emerald-50/50 rounded-t-xl'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <Clock className="w-4 h-4" />
                    <span>3. Lũy Kế Giờ Công (Toàn Cụm)</span>
                    {Object.keys(workHoursMap).length > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-700">
                            {Object.keys(workHoursMap).length} NV
                        </span>
                    )}
                </button>

                <button
                    onClick={() => setActiveTab('summary')}
                    className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-extrabold transition cursor-pointer whitespace-nowrap ${
                        activeTab === 'summary'
                            ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-xl'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <LayoutDashboard className="w-4 h-4" />
                    <span>4. Bảng Tổng Hợp & Đối Soát</span>
                </button>

                <button
                    onClick={() => setActiveTab('history')}
                    className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-extrabold transition cursor-pointer whitespace-nowrap ${
                        activeTab === 'history'
                            ? 'border-purple-600 text-purple-600 bg-purple-50/50 rounded-t-xl'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <History className="w-4 h-4" />
                    <span>5. Lịch Sử Phiên</span>
                </button>
            </div>

            {/* Nội dung theo Tab */}
            {activeTab === 'revenue' && (
                <RevenuePasteTab
                    onApply={handleApplyRevenue}
                    initialData={revenueData}
                    configuredEmployees={filteredEmployees}
                    currentStoreName={selectedStore}
                />
            )}

            {activeTab === 'campaign' && (
                <CampaignPasteTab
                    onApply={handleApplyCampaign}
                    initialCampaigns={campaignBlocks}
                    initialMatrix={campaignMatrix}
                />
            )}

            {activeTab === 'hours' && (
                <WorkHoursPasteTab
                    onApply={handleApplyHours}
                    initialHoursMap={workHoursMap}
                />
            )}

            {activeTab === 'summary' && (
                <CumulativeSummaryTab
                    employees={filteredEmployees.length > 0 ? filteredEmployees : employees}
                    revenueData={revenueData}
                    campaignBlocks={campaignBlocks}
                    campaignMatrix={campaignMatrix}
                    workHoursMap={workHoursMap}
                    onOpenStoreConfirm={() => setIsStoreModalOpen(true)}
                    onSaveWorkHoursOnly={handleSaveWorkHoursOnly}
                    isSaving={isSaving}
                />
            )}

            {activeTab === 'history' && (
                <SessionHistoryTab
                    currentStoreName={selectedStore}
                    month={selectedMonth}
                    year={selectedYear}
                    onRestoreSession={handleRestoreSession}
                />
            )}

            {/* Popup Xác Nhận Tên Siêu Thị Trước Khi Lưu Doanh Thu & Thi Đua */}
            <StoreConfirmModal
                isOpen={isStoreModalOpen}
                onClose={() => setIsStoreModalOpen(false)}
                onConfirm={handleConfirmStoreSave}
                stores={stores}
                defaultStoreName={selectedStore}
                month={selectedMonth}
                year={selectedYear}
                employeeCount={revenueData.length || filteredEmployees.length}
                totalRevenueActual={totalRevActual}
                campaignCount={campaignBlocks.length}
                isSaving={isSaving}
                editingSession={editingSession?.session_type === 'REVENUE_CAMPAIGN' ? editingSession : null}
            />

            {/* Popup Xác Nhận Lưu Giờ Công */}
            <WorkHoursConfirmModal
                isOpen={isWorkHoursModalOpen}
                onClose={() => setIsWorkHoursModalOpen(false)}
                onConfirm={handleConfirmWorkHoursSave}
                month={selectedMonth}
                year={selectedYear}
                employeeCount={Object.keys(workHoursMap).length}
                totalHours={Object.values(workHoursMap).reduce((s, h) => s + h, 0)}
                isSaving={isSaving}
                stores={stores}
                currentSelectedStore={selectedStore}
                storeBreakdown={workHoursStoreBreakdown}
                editingSession={editingSession?.session_type === 'WORK_HOURS' ? editingSession : null}
            />
        </div>
    );
}
