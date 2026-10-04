import { useState, useEffect, useMemo, useRef } from 'react';
import html2canvas from 'html2canvas';
import {
    formatValue,
    formatDate,
    getYesterdayDateString,
    isStoreMatch,
    getShortStoreName
} from '../../core/lib/formatters';
import {
    fetchStores,
    fetchEmployees,
    type StoreItem,
    type EmployeeItem
} from '../../core/lib/storage';
import {
    parseEmployeeRevenueText,
    detectStoreFromRawText,
    type ParsedEmployeeRevenue
} from '../employee-cumulative/utils/employeeParsers';
import {
    processDailyEmployeeRevenueData,
    generateDailyZaloText
} from './utils/dailyEmployeeRevenueUtils';
import {
    Zap,
    Download,
    Copy,
    FileText,
    Search,
    Store,
    Calendar,
    ArrowUpDown,
    CheckCircle2,
    AlertCircle,
    AlertTriangle,
    CreditCard,
    TrendingUp,
    Trophy,
    SlidersHorizontal,
    ChevronDown,
    ChevronUp,
    Trash2,
    Coins,
    Users,
    UserCheck,
    Table as TableIcon,
    LayoutGrid,
    Lock
} from 'lucide-react';
import { useUserStoreFilter } from '../../shared/hooks/useUserStoreFilter';

const DRAFT_STORE_KEY = 'saleshub_daily_emp_revenue_store_v1';
const DRAFT_DATE_KEY = 'saleshub_daily_emp_revenue_date_v1';

export default function DailyEmployeeRevenueReportPage() {
    const reportRef = useRef<HTMLDivElement>(null);

    // 1. DỮ LIỆU DANH BẠ HỆ THỐNG
    const [stores, setStores] = useState<StoreItem[]>([]);
    const [employees, setEmployees] = useState<EmployeeItem[]>([]);
    const [selectedStore, setSelectedStore] = useState<string>(() => {
        try {
            return localStorage.getItem(DRAFT_STORE_KEY) || 'all';
        } catch {
            return 'all';
        }
    });

    // Phân quyền phạm vi siêu thị theo vai trò người dùng (Nhân viên bị khóa shop, Quản lý đa shop, Admin toàn quyền)
    const { allowedStores, isLockedToSingleStore, canViewAllStores } = useUserStoreFilter(
        stores,
        selectedStore,
        setSelectedStore
    );

    // 2. DỮ LIỆU BÁO CÁO DÁN (Mặc định để trống)
    const [rawText, setRawText] = useState<string>('');

    const [reportDate, setReportDate] = useState<string>(() => {
        try {
            return localStorage.getItem(DRAFT_DATE_KEY) || getYesterdayDateString();
        } catch {
            return getYesterdayDateString();
        }
    });

    // Tên siêu thị nhận diện được từ văn bản dán
    const [detectedStoreName, setDetectedStoreName] = useState<string>('');

    // Danh sách nhân sự đi làm trong ca được chọn bổ sung thủ công (chưa có DT trong báo cáo dán)
    const [manualShiftEmpIds, setManualShiftEmpIds] = useState<Set<string>>(new Set());

    // Trạng thái giao diện
    const [isInputExpanded, setIsInputExpanded] = useState<boolean>(false);
    const [isRosterModalOpen, setIsRosterModalOpen] = useState<boolean>(false);
    const [reminderViewMode, setReminderViewMode] = useState<'CARDS' | 'TABLE'>('CARDS');

    const [searchQuery, setSearchQuery] = useState<string>('');
    const [sortField, setSortField] = useState<'rank' | 'qd' | 'actual' | 'installment' | 'qty' | 'name'>('qd');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
    const [filterCategory, setFilterCategory] = useState<'ALL' | 'ACTIVE_ONLY' | 'TOP_30' | 'BELOW_AVG' | 'ZERO_OR_NEG' | 'ZERO_INSTALLMENT'>('ALL');

    // Tùy chọn xuất ảnh: 'ALL' (Bảng kèm tóm tắt) | 'TABLE_ONLY' (Chỉ bảng) | 'SUMMARY_ONLY' (Chỉ tóm tắt)
    const [exportScope, setExportScope] = useState<'ALL' | 'TABLE_ONLY' | 'SUMMARY_ONLY'>('ALL');
    const [exportResolution, setExportResolution] = useState<'4K' | '8K'>('8K');
    const [isExporting, setIsExporting] = useState<boolean>(false);
    const [toastMessage, setToastMessage] = useState<string>('');

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 3500);
    };

    // Tải danh bạ Siêu thị và Nhân viên từ Supabase
    useEffect(() => {
        Promise.all([fetchStores(), fetchEmployees()]).then(([storesRes, empsRes]) => {
            if (storesRes.success && storesRes.data) setStores(storesRes.data);
            if (empsRes.success && empsRes.data) setEmployees(empsRes.data);
        });
    }, []);

    // Bản đồ nhân viên -> siêu thị
    const empStoreMap = useMemo(() => {
        const map: Record<string, string> = {};
        employees.forEach(e => {
            if (e.employee_id) {
                map[e.employee_id.trim()] = e.store_name || '';
            }
        });
        return map;
    }, [employees]);

    // Phân tích cú pháp văn bản dán
    const parsedRawList = useMemo<ParsedEmployeeRevenue[]>(() => {
        if (!rawText.trim()) return [];
        return parseEmployeeRevenueText(rawText);
    }, [rawText]);

    // Tự động nhận diện siêu thị từ văn bản dán và khớp với dropdown
    useEffect(() => {
        if (rawText.trim()) {
            const detected = detectStoreFromRawText(rawText);
            if (detected) {
                setDetectedStoreName(detected);
                // Khớp thử với danh sách siêu thị được phép truy cập
                const matched = allowedStores.find(s => isStoreMatch(s.name, detected, stores));
                if (matched && selectedStore === 'all' && canViewAllStores) {
                    setSelectedStore(matched.name);
                }
            }
        }
    }, [rawText, stores, allowedStores, selectedStore, canViewAllStores]);

    // Lưu nháp bộ lọc vào localStorage (không lưu dữ liệu dán để mặc định luôn sạch sẽ)
    useEffect(() => {
        try {
            localStorage.setItem(DRAFT_STORE_KEY, selectedStore);
            localStorage.setItem(DRAFT_DATE_KEY, reportDate);
        } catch (e) {
            console.warn('Lỗi lưu nháp:', e);
        }
    }, [selectedStore, reportDate]);

    // Danh sách nhân sự cấu hình của siêu thị đang chọn
    const currentStoreEmployees = useMemo(() => {
        if (selectedStore === 'all') return employees;
        return employees.filter(e => isStoreMatch(e.store_name, selectedStore, stores));
    }, [employees, selectedStore, stores]);

    // MẶC ĐỊNH: Lọc nhân viên theo siêu thị đã chọn và CHỈ TỰ ĐỘNG CHỌN các bạn có DTQĐ khác 0
    useEffect(() => {
        if (parsedRawList.length === 0) {
            setManualShiftEmpIds(new Set());
            return;
        }

        const newChecked = new Set<string>();

        // Chỉ tự động chọn nhân viên có DTQĐ khác 0 thuộc siêu thị đang chọn
        parsedRawList.forEach(p => {
            if (p.revenue_qd !== 0) {
                const id = p.employee_id.trim();
                if (selectedStore === 'all') {
                    newChecked.add(id);
                } else {
                    const empStore = empStoreMap[id];
                    if (empStore && isStoreMatch(empStore, selectedStore, stores)) {
                        newChecked.add(id);
                    } else if (detectedStoreName && isStoreMatch(detectedStoreName, selectedStore, stores)) {
                        newChecked.add(id);
                    }
                }
            }
        });

        setManualShiftEmpIds(newChecked);
    }, [selectedStore, parsedRawList, empStoreMap, stores, detectedStoreName]);

    // Danh sách nhân sự bổ sung thủ công (chưa có trong báo cáo dán nhưng được user tích chọn đi làm)
    const additionalZeroEmployees = useMemo(() => {
        const parsedIds = new Set(parsedRawList.map(p => p.employee_id.trim()));
        const list: Array<{ employee_id: string; full_name: string; store_name?: string }> = [];

        currentStoreEmployees.forEach(emp => {
            const id = emp.employee_id.trim();
            // Nếu được chọn đi làm mà chưa có trong báo cáo dán -> bổ sung với 0 DT
            if (manualShiftEmpIds.has(id) && !parsedIds.has(id)) {
                list.push({
                    employee_id: id,
                    full_name: emp.full_name,
                    store_name: emp.store_name
                });
            }
        });

        return list;
    }, [currentStoreEmployees, manualShiftEmpIds, parsedRawList]);

    // 2. Xử lý & Chuẩn hóa toàn bộ số liệu theo siêu thị đang chọn
    const processedData = useMemo(() => {
        return processDailyEmployeeRevenueData(parsedRawList, {
            selectedStore,
            empStoreMap,
            storesList: stores,
            detectedStoreName,
            additionalZeroEmployees,
            manualShiftEmpIds
        });
    }, [parsedRawList, selectedStore, empStoreMap, stores, detectedStoreName, additionalZeroEmployees, manualShiftEmpIds]);

    const {
        analyzedEmployees,
        allShiftEmployees,
        top30Employees,
        belowAvgEmployees,
        zeroOrNegativeEmployees,
        zeroInstallmentEmployees,
        summary
    } = processedData;

    // Tên siêu thị hiển thị trên báo cáo
    const displayStoreTitle = useMemo(() => {
        if (selectedStore === 'all') {
            return detectedStoreName ? `Toàn Cụm (${detectedStoreName})` : 'Toàn Cụm Siêu Thị';
        }
        return selectedStore;
    }, [selectedStore, detectedStoreName]);

    // 3. Lọc & Sắp xếp bảng chi tiết
    const displayTableRows = useMemo(() => {
        let list = [...allShiftEmployees];

        // Lọc theo danh mục
        if (filterCategory === 'ACTIVE_ONLY') {
            list = list.filter(e => !e.is_zero_or_negative);
        } else if (filterCategory === 'TOP_30') {
            list = list.filter(e => e.is_top_30);
        } else if (filterCategory === 'BELOW_AVG') {
            list = list.filter(e => e.is_below_avg);
        } else if (filterCategory === 'ZERO_OR_NEG') {
            list = list.filter(e => e.is_zero_or_negative);
        } else if (filterCategory === 'ZERO_INSTALLMENT') {
            list = list.filter(e => e.is_zero_installment);
        }

        // Lọc tìm kiếm
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter(e =>
                e.employee_id.toLowerCase().includes(q) ||
                e.full_name.toLowerCase().includes(q) ||
                e.short_name.toLowerCase().includes(q)
            );
        }

        // Sắp xếp
        list.sort((a, b) => {
            let diff = 0;
            if (sortField === 'rank') diff = a.rank - b.rank;
            else if (sortField === 'qd') diff = a.revenue_qd - b.revenue_qd;
            else if (sortField === 'actual') diff = a.revenue_actual - b.revenue_actual;
            else if (sortField === 'installment') diff = a.installment_revenue - b.installment_revenue;
            else if (sortField === 'qty') diff = a.quantity - b.quantity;
            else if (sortField === 'name') diff = a.short_name.localeCompare(b.short_name, 'vi');
            return sortDirection === 'asc' ? diff : -diff;
        });

        return list;
    }, [allShiftEmployees, filterCategory, searchQuery, sortField, sortDirection]);

    const handleSort = (field: typeof sortField) => {
        if (sortField === field) {
            setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortDirection(field === 'name' ? 'asc' : 'desc');
        }
    };

    // Toggle chọn nhân sự đi làm trong ca
    const handleToggleShiftEmp = (empId: string) => {
        setManualShiftEmpIds(prev => {
            const next = new Set(prev);
            if (next.has(empId)) {
                next.delete(empId);
            } else {
                next.add(empId);
            }
            return next;
        });
    };

    // Chọn tất cả nhân sự của shop đi làm
    const handleSelectAllStoreShift = () => {
        const next = new Set(manualShiftEmpIds);
        currentStoreEmployees.forEach(e => next.add(e.employee_id.trim()));
        setManualShiftEmpIds(next);
        showToast(`✅ Đã chọn tất cả ${currentStoreEmployees.length} nhân sự đi làm trong ca!`);
    };

    // Đặt lại mặc định: chỉ chọn nhân sự thuộc siêu thị có DTQĐ khác 0
    const handleResetToDefaultShift = () => {
        const newChecked = new Set<string>();
        parsedRawList.forEach(p => {
            if (p.revenue_qd !== 0) {
                const id = p.employee_id.trim();
                if (selectedStore === 'all') {
                    newChecked.add(id);
                } else {
                    const empStore = empStoreMap[id];
                    if (empStore && isStoreMatch(empStore, selectedStore, stores)) {
                        newChecked.add(id);
                    } else if (detectedStoreName && isStoreMatch(detectedStoreName, selectedStore, stores)) {
                        newChecked.add(id);
                    }
                }
            }
        });
        setManualShiftEmpIds(newChecked);
        showToast(`🎯 Đã đặt lại mặc định: ${newChecked.size} nhân sự có DTQĐ khác 0`);
    };

    // Xóa trắng dữ liệu dán
    const handleClearData = () => {
        setRawText('');
        setDetectedStoreName('');
        setManualShiftEmpIds(new Set());
        showToast('🗑️ Đã xóa trắng dữ liệu báo cáo!');
    };

    // =========================================================================
    // 4. BỘ XUẤT ẢNH ULTRA HD 4K / 8K & SAO CHÉP CLIPBOARD
    // =========================================================================
    const generateReportCanvas = async (): Promise<HTMLCanvasElement | null> => {
        if (!reportRef.current) return null;

        const exportContainer = document.createElement('div');
        exportContainer.style.position = 'fixed';
        exportContainer.style.left = '-99999px';
        exportContainer.style.top = '0';
        exportContainer.style.zIndex = '-9999';
        const targetWidth = 1440;
        exportContainer.style.width = `${targetWidth}px`;
        exportContainer.style.backgroundColor = '#ffffff';

        const clonedReport = reportRef.current.cloneNode(true) as HTMLElement;
        clonedReport.style.width = `${targetWidth}px`;
        clonedReport.style.maxWidth = `${targetWidth}px`;
        clonedReport.style.margin = '0 auto';
        clonedReport.style.boxSizing = 'border-box';
        clonedReport.style.padding = '24px';
        clonedReport.style.borderRadius = '0px';
        clonedReport.style.boxShadow = 'none';

        // 1. Áp dụng phạm vi xuất ảnh (exportScope)
        if (exportScope === 'TABLE_ONLY') {
            const topSec = clonedReport.querySelector('[data-section="top30"]');
            const reminderSec = clonedReport.querySelector('[data-section="reminders"]');
            if (topSec) (topSec as HTMLElement).style.display = 'none';
            if (reminderSec) (reminderSec as HTMLElement).style.display = 'none';
        } else if (exportScope === 'SUMMARY_ONLY') {
            const tableSec = clonedReport.querySelector('[data-section="table"]');
            if (tableSec) (tableSec as HTMLElement).style.display = 'none';
        }

        // 2. Ẩn tất cả các nút tương tác
        clonedReport.querySelectorAll<HTMLElement>('[data-export-ignore="true"]').forEach(el => {
            el.style.display = 'none';
        });

        // 3. Mở rộng chiều cao bảng
        clonedReport.querySelectorAll<HTMLElement>('.overflow-x-auto, .overflow-y-auto').forEach(el => {
            el.style.maxHeight = 'none';
            el.style.overflow = 'visible';
        });

        // 4. Thêm chân trang chuyên nghiệp (Watermark)
        const watermark = document.createElement('div');
        watermark.className = 'pt-4 mt-4 flex items-center justify-between text-[11px] text-slate-500 font-semibold border-t border-slate-200';
        watermark.innerHTML = `
            <span>Báo cáo doanh thu nhân viên ngày • Siêu thị: <b class="text-slate-800">${displayStoreTitle}</b></span>
            <span>Độ phân giải: <b>${exportResolution} Ultra HD</b> • Xuất từ SalesHub: <b class="text-slate-800">${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</b></span>
        `;
        clonedReport.appendChild(watermark);

        exportContainer.appendChild(clonedReport);
        document.body.appendChild(exportContainer);

        try {
            if (document.fonts?.ready) {
                await document.fonts.ready;
            }
            await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 80)));

            const targetHeight = clonedReport.scrollHeight || clonedReport.offsetHeight;
            let exportScale = exportResolution === '8K' ? 4.0 : 3.0;
            if (targetWidth * exportScale > 14000) {
                exportScale = Math.floor(14000 / targetWidth * 10) / 10;
            }

            const canvas = await html2canvas(clonedReport, {
                scale: exportScale,
                width: targetWidth,
                height: targetHeight,
                windowWidth: targetWidth,
                windowHeight: targetHeight,
                scrollX: 0,
                scrollY: 0,
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false,
                allowTaint: true
            });

            return canvas;
        } finally {
            if (document.body.contains(exportContainer)) {
                document.body.removeChild(exportContainer);
            }
        }
    };

    // Tải File Ảnh
    const handleDownloadImage = async () => {
        if (allShiftEmployees.length === 0) {
            showToast('⚠️ Không có dữ liệu để xuất ảnh!');
            return;
        }
        setIsExporting(true);
        showToast(`⏳ Đang tạo ảnh báo cáo ${exportResolution} Ultra HD...`);

        try {
            const canvas = await generateReportCanvas();
            if (!canvas) throw new Error('Không thể tạo canvas');

            const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
            if (!blob) throw new Error('Không thể tạo blob ảnh');

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const cleanStore = displayStoreTitle.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
            const scopeTag = exportScope === 'TABLE_ONLY' ? 'Bang' : exportScope === 'SUMMARY_ONLY' ? 'TomTat' : 'DayDu';
            link.download = `BaoCao_DoanhThu_Ngay_${cleanStore}_${reportDate}_${scopeTag}_${exportResolution}.png`;
            link.href = url;
            link.click();
            URL.revokeObjectURL(url);

            showToast(`🎉 Đã tải file ảnh ${exportResolution} thành công!`);
        } catch (err: any) {
            console.error('Lỗi tải ảnh:', err);
            showToast(`⚠️ Không thể xuất ảnh: ${err.message || 'Lỗi không xác định'}`);
        } finally {
            setIsExporting(false);
        }
    };

    // Sao chép Ảnh vào Clipboard
    const handleCopyImageClipboard = async () => {
        if (allShiftEmployees.length === 0) {
            showToast('⚠️ Không có dữ liệu để sao chép ảnh!');
            return;
        }
        setIsExporting(true);
        showToast(`⏳ Đang tạo ảnh ${exportResolution} để copy vào Clipboard...`);

        try {
            const canvas = await generateReportCanvas();
            if (!canvas) throw new Error('Không thể tạo canvas');

            const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
            if (!blob) throw new Error('Không thể tạo blob ảnh');

            if (!navigator.clipboard?.write) {
                throw new Error('Trình duyệt không hỗ trợ sao chép ảnh trực tiếp vào Clipboard');
            }

            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);

            showToast(`📋 Đã sao chép ảnh ${exportResolution} vào Clipboard! Bạn có thể dán (Ctrl+V) ngay vào Zalo.`);
        } catch (err: any) {
            console.error('Lỗi copy ảnh:', err);
            showToast(`⚠️ Lỗi copy ảnh: ${err.message || 'Hãy dùng nút Tải File Ảnh'}`);
        } finally {
            setIsExporting(false);
        }
    };

    // Sao chép văn bản Zalo
    const handleCopyZaloText = async () => {
        if (allShiftEmployees.length === 0) {
            showToast('⚠️ Không có dữ liệu để tạo tin nhắn Zalo!');
            return;
        }

        try {
            const text = generateDailyZaloText(
                displayStoreTitle,
                reportDate,
                summary,
                top30Employees,
                belowAvgEmployees,
                zeroOrNegativeEmployees,
                zeroInstallmentEmployees
            );

            await navigator.clipboard.writeText(text);
            showToast(`📝 Đã sao chép tin nhắn Zalo! Bạn có thể dán ngay vào nhóm chat.`);
        } catch (err: any) {
            console.error('Lỗi copy text:', err);
            showToast('⚠️ Không thể copy text vào bộ nhớ tạm.');
        }
    };

    return (
        <div className="max-w-[1720px] mx-auto space-y-4 pb-16 font-avo antialiased">
            {/* Toast Thông Báo */}
            {toastMessage && (
                <div className="fixed top-5 right-5 z-50 p-4 bg-slate-900 text-white rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs border border-slate-700 animate-in fade-in slide-in-from-top-2 duration-200">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span className="font-semibold">{toastMessage}</span>
                </div>
            )}

            {/* ========================================================= */}
            {/* 1. KHU VỰC ĐIỀU KHIỂN & BỘ LỌC SIÊU THỊ                   */}
            {/* ========================================================= */}
            <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Tiêu đề & Chọn Siêu thị / Ngày */}
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[11px] font-black rounded-lg uppercase tracking-wider flex items-center gap-1">
                                <Zap className="w-3.5 h-3.5 text-emerald-600" />
                                <span>BÁO CÁO NGÀY</span>
                            </span>
                            <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-[11px] font-bold rounded-lg border border-blue-200">
                                Doanh Thu Nhân Viên
                            </span>
                        </div>

                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                            Báo Cáo Doanh Thu Nhân Viên Trong Ngày
                        </h1>

                        {/* Dropdown chọn siêu thị và ngày */}
                        <div className="flex items-center gap-3 pt-1 flex-wrap">
                            {/* 1. Chọn Siêu thị (Tổng cụm hoặc từng siêu thị theo phân quyền) */}
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                                isLockedToSingleStore
                                    ? 'bg-amber-50/90 border-amber-200 text-amber-900 shadow-xs'
                                    : 'bg-slate-100 border-slate-200 text-slate-800'
                            }`}>
                                {isLockedToSingleStore ? (
                                    <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                ) : (
                                    <Store className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                )}
                                <span className="text-slate-500 hidden sm:inline">Siêu thị:</span>
                                <select
                                    value={selectedStore}
                                    onChange={e => setSelectedStore(e.target.value)}
                                    disabled={isLockedToSingleStore}
                                    title={isLockedToSingleStore ? 'Tài khoản nhân viên được cố định theo siêu thị đã đăng ký' : undefined}
                                    className={`bg-transparent font-extrabold outline-hidden ${
                                        isLockedToSingleStore
                                            ? 'cursor-not-allowed text-amber-900 font-black'
                                            : 'cursor-pointer text-slate-800'
                                    }`}
                                >
                                    {canViewAllStores && (
                                        <option value="all">🌐 Toàn Cụm Siêu Thị</option>
                                    )}
                                    {allowedStores.map(s => (
                                        <option key={s.id || s.name} value={s.name}>
                                            {s.code ? `[${s.code}] ` : ''}{s.name}
                                        </option>
                                    ))}
                                </select>
                                {isLockedToSingleStore && (
                                    <span className="text-[10px] bg-amber-200/80 text-amber-800 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider hidden md:inline">
                                        Đã khóa
                                    </span>
                                )}
                            </div>

                            {/* 2. Chọn ngày báo cáo */}
                            <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold">
                                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                                <span className="text-slate-500 hidden sm:inline">Ngày:</span>
                                <input
                                    type="date"
                                    value={reportDate}
                                    onChange={e => setReportDate(e.target.value)}
                                    className="bg-transparent text-slate-800 font-extrabold outline-hidden cursor-pointer"
                                />
                            </div>

                            {/* 3. Nút mở Danh sách nhân sự đi làm trong ca */}
                            <button
                                type="button"
                                onClick={() => setIsRosterModalOpen(!isRosterModalOpen)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer ${isRosterModalOpen
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                                    }`}
                                title="Điểm danh và chọn thêm nhân viên đi làm nhưng chưa có biến động doanh thu"
                            >
                                <UserCheck className="w-4 h-4 text-emerald-600" />
                                <span>Điểm danh ca ({manualShiftEmpIds.size}/{currentStoreEmployees.length})</span>
                                {isRosterModalOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                        </div>
                    </div>

                    {/* Bộ công cụ xuất ảnh & tác vụ */}
                    <div className="flex flex-wrap items-center gap-2.5">
                        {/* 1. Nút Mở Ô Dán Báo Cáo */}
                        <button
                            type="button"
                            onClick={() => setIsInputExpanded(!isInputExpanded)}
                            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 border border-slate-200"
                        >
                            <SlidersHorizontal className="w-4 h-4 text-slate-600" />
                            <span>{isInputExpanded ? 'Đóng Ô Dán' : 'Dán Dữ Liệu Mới'}</span>
                            {isInputExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        {/* 2. Chọn phạm vi xuất ảnh */}
                        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
                            <span className="text-slate-500 px-2 text-[11px] hidden sm:inline">Phạm vi:</span>
                            <button
                                type="button"
                                onClick={() => setExportScope('ALL')}
                                className={`px-2.5 py-1 rounded-lg transition cursor-pointer text-xs ${exportScope === 'ALL'
                                        ? 'bg-white text-emerald-700 shadow-2xs font-extrabold'
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                title="Xuất toàn bộ Bảng kèm Tóm tắt"
                            >
                                Đầy Đủ
                            </button>
                            <button
                                type="button"
                                onClick={() => setExportScope('TABLE_ONLY')}
                                className={`px-2.5 py-1 rounded-lg transition cursor-pointer text-xs ${exportScope === 'TABLE_ONLY'
                                        ? 'bg-white text-emerald-700 shadow-2xs font-extrabold'
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                title="Chỉ xuất phần Bảng chi tiết"
                            >
                                Chỉ Bảng
                            </button>
                            <button
                                type="button"
                                onClick={() => setExportScope('SUMMARY_ONLY')}
                                className={`px-2.5 py-1 rounded-lg transition cursor-pointer text-xs ${exportScope === 'SUMMARY_ONLY'
                                        ? 'bg-white text-emerald-700 shadow-2xs font-extrabold'
                                        : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                title="Chỉ xuất phần Tóm tắt & Nhắc nhở"
                            >
                                Chỉ Tóm Tắt
                            </button>
                        </div>

                        {/* 3. Chọn độ phân giải 4K / 8K */}
                        <div className="flex items-center bg-slate-900 text-white p-1 rounded-xl text-xs font-black shadow-xs">
                            <button
                                type="button"
                                onClick={() => setExportResolution('4K')}
                                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${exportResolution === '4K'
                                        ? 'bg-emerald-500 text-slate-950 shadow-xs'
                                        : 'text-slate-300 hover:text-white'
                                    }`}
                            >
                                4K
                            </button>
                            <button
                                type="button"
                                onClick={() => setExportResolution('8K')}
                                className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${exportResolution === '8K'
                                        ? 'bg-emerald-500 text-slate-950 shadow-xs'
                                        : 'text-slate-300 hover:text-white'
                                    }`}
                            >
                                8K
                            </button>
                        </div>

                        {/* 4. Nút Tải File Ảnh */}
                        <button
                            type="button"
                            onClick={handleDownloadImage}
                            disabled={isExporting || allShiftEmployees.length === 0}
                            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50"
                        >
                            <Download className="w-4 h-4" />
                            <span>Tải Ảnh ({exportResolution})</span>
                        </button>

                        {/* 5. Nút Copy Ảnh vào Clipboard */}
                        <button
                            type="button"
                            onClick={handleCopyImageClipboard}
                            disabled={isExporting || allShiftEmployees.length === 0}
                            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50"
                            title="Sao chép ảnh vào Clipboard để dán ngay vào Zalo"
                        >
                            <Copy className="w-4 h-4" />
                            <span className="hidden sm:inline">Copy Ảnh</span>
                        </button>

                        {/* 6. Nút Copy Text Zalo */}
                        <button
                            type="button"
                            onClick={handleCopyZaloText}
                            disabled={allShiftEmployees.length === 0}
                            className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50"
                            title="Sao chép tin nhắn báo cáo Zalo chuẩn format"
                        >
                            <FileText className="w-4 h-4" />
                            <span>Copy Text</span>
                        </button>
                    </div>
                </div>

                {/* Ngăn kéo dán dữ liệu */}
                {isInputExpanded && (
                    <div className="pt-4 border-t border-slate-200 space-y-3 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
                            <span>Dán toàn bộ bảng báo cáo doanh thu từ MWG Dashboard vào ô dưới đây:</span>
                            {rawText && (
                                <button
                                    type="button"
                                    onClick={handleClearData}
                                    className="text-rose-600 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Xóa trắng</span>
                                </button>
                            )}
                        </div>
                        <textarea
                            rows={7}
                            value={rawText}
                            onChange={e => setRawText(e.target.value)}
                            placeholder="Ví dụ dán:&#10;10335 - AAR_BRV_VTA - 290 Trương Công Định&#10;NHÂN VIÊN	SỐ LƯỢNG	DOANH THU QĐ	% TỈ TRỌNG	DOANH THU...&#10;4614 - Lê Quang Vinh	8	39	48.8%	34...&#10;249041 - Nguyễn Phương Nam	1	41	51.2%	32..."
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 shadow-inner"
                        />
                        <div className="flex items-center justify-between pt-1">
                            <span className="text-[11px] text-slate-400">
                                Hệ thống sẽ tự động lọc nhân viên theo siêu thị, chuẩn hóa DTQĐ khác 0 và loại bỏ dòng Online.
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsInputExpanded(false);
                                    showToast(`✅ Đã phân tích ${parsedRawList.length} dòng dữ liệu!`);
                                }}
                                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                            >
                                Hoàn tất dán
                            </button>
                        </div>
                    </div>
                )}

                {/* ========================================================= */}
                {/* 2. BẢNG CHỌN THỦ CÔNG NHÂN SỰ ĐI LÀM TRONG CA (0 DT)       */}
                {/* ========================================================= */}
                {isRosterModalOpen && (
                    <div className="pt-4 border-t border-slate-200 space-y-3 animate-in fade-in duration-200 bg-blue-50/40 p-4 rounded-2xl border border-blue-200">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <h4 className="text-xs font-black text-slate-900 uppercase flex items-center gap-1.5">
                                    <Users className="w-4 h-4 text-blue-600" />
                                    <span>Danh sách nhân sự thuộc Siêu thị ({currentStoreEmployees.length} nhân sự)</span>
                                </h4>
                                <p className="text-[11px] text-slate-500">
                                    Tích chọn các nhân viên <b>có đi làm trong ca</b> hôm nay nhưng <b>không có biến động doanh thu</b> để hiển thị đầy đủ trên báo cáo.
                                </p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                    type="button"
                                    onClick={handleSelectAllStoreShift}
                                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                                >
                                    Chọn tất cả
                                </button>
                                <button
                                    type="button"
                                    onClick={handleResetToDefaultShift}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                                >
                                    Mặc định (DTQĐ ≠ 0)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setManualShiftEmpIds(new Set());
                                        showToast('Đã bỏ chọn toàn bộ');
                                    }}
                                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold transition cursor-pointer"
                                >
                                    Bỏ chọn hết
                                </button>
                            </div>
                        </div>

                        {/* Lưới danh sách nhân viên để tích chọn */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 pt-2 max-h-60 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-blue-200">
                            {currentStoreEmployees.map(emp => {
                                const id = emp.employee_id.trim();
                                const isChecked = manualShiftEmpIds.has(id);
                                const parsedMatch = parsedRawList.find(p => p.employee_id.trim() === id);
                                const hasRevenue = parsedMatch && parsedMatch.revenue_qd !== 0;

                                return (
                                    <label
                                        key={id}
                                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer select-none transition ${isChecked
                                                ? 'bg-white border-blue-400 shadow-2xs'
                                                : 'bg-white/60 border-slate-200 text-slate-400 opacity-75 hover:opacity-100'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => handleToggleShiftEmp(id)}
                                                className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                            />
                                            <div className="truncate">
                                                <div className="font-extrabold text-slate-900 truncate">
                                                    {emp.employee_id} - {emp.full_name}
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-medium">
                                                    {getShortStoreName(emp.store_name || selectedStore)}
                                                </div>
                                            </div>
                                        </div>

                                        {hasRevenue ? (
                                            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded shrink-0">
                                                {formatValue(parsedMatch.revenue_qd)} tr
                                            </span>
                                        ) : parsedMatch ? (
                                            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-bold rounded shrink-0">
                                                0 tr
                                            </span>
                                        ) : isChecked ? (
                                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded shrink-0">
                                                Đi làm (0)
                                            </span>
                                        ) : (
                                            <span className="px-1.5 py-0.5 bg-slate-100 text-slate-400 text-[10px] font-medium rounded shrink-0">
                                                Nghỉ
                                            </span>
                                        )}
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* ========================================================= */}
            {/* 3. TRƯỜNG HỢP CHƯA CÓ DỮ LIỆU BÁO CÁO                     */}
            {/* ========================================================= */}
            {(!rawText.trim() || allShiftEmployees.length === 0) ? (
                <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-8 sm:p-12 text-center shadow-xs space-y-5 max-w-2xl mx-auto my-6 animate-in fade-in duration-300">
                    <div className="w-16 h-16 rounded-3xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto shadow-inner">
                        <AlertCircle className="w-8 h-8" />
                    </div>

                    <div className="space-y-1.5">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-900 rounded-full text-[11px] font-black uppercase tracking-wider">
                            <span>⚠️ THÔNG BÁO</span>
                        </div>
                        <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                            Chưa Có Dữ Liệu Cần Xử Lý
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">
                            Hiện chưa có bảng báo cáo doanh thu được dán. Vui lòng sao chép bảng từ <b>MWG Dashboard</b> và dán vào ô bên dưới để hệ thống tự động bóc tách số liệu.
                        </p>
                    </div>

                    {/* Vùng dán trực tiếp nhanh */}
                    <div className="max-w-xl mx-auto space-y-3 pt-2 text-left">
                        <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
                            <span>Dán bảng doanh thu MWG vào đây:</span>
                            <span className="text-[11px] text-slate-400">Ctrl + V</span>
                        </div>
                        <textarea
                            rows={6}
                            value={rawText}
                            onChange={e => setRawText(e.target.value)}
                            placeholder="Dán bảng doanh thu MWG vào đây (gồm cột: Nhân viên, Số lượng, Doanh thu QĐ, Doanh thu...)"
                            className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-2xl font-mono text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 shadow-inner"
                        />
                        <button
                            type="button"
                            onClick={() => {
                                if (!rawText.trim()) {
                                    showToast('⚠️ Vui lòng dán văn bản báo cáo vào ô trước!');
                                    return;
                                }
                                showToast(`✅ Đã phân tích ${parsedRawList.length} dòng dữ liệu!`);
                            }}
                            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-2 shadow-md active:scale-[0.99]"
                        >
                            <Zap className="w-4 h-4" />
                            <span>Bắt Đầu Xử Lý Báo Cáo</span>
                        </button>
                    </div>
                </div>
            ) : (
                /* ========================================================= */
                /* 4. KHUNG NỘI DUNG BÁO CÁO XUẤT BẢN (reportRef)             */
                /* ========================================================= */
                <div
                    ref={reportRef}
                    data-report-container="true"
                    className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-6"
                >
                    {/* A. BANNER TIÊU ĐỀ BÁO CÁO */}
                    <div className="rounded-2xl p-5 sm:p-6 bg-gradient-to-r from-[#005a43] via-[#004735] to-[#00382b] text-white shadow-md relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fde047_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

                        <div className="text-center md:text-left z-10 space-y-1 mx-auto md:mx-0">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-400 text-slate-950 rounded-full text-[10px] font-black uppercase tracking-wider shadow-xs">
                                <span>⚡ DOANH THU NHÂN VIÊN TRONG NGÀY</span>
                            </div>
                            <h2 className="text-2xl sm:text-3xl font-black text-[#fde047] tracking-wide uppercase drop-shadow-sm">
                                BÁO CÁO HIỆU QUẢ KINH DOANH
                            </h2>
                            <p className="text-xs sm:text-sm font-semibold text-amber-100 flex items-center justify-center md:justify-start gap-2 flex-wrap">
                                <span>🏢 Siêu thị: <b className="text-white">{displayStoreTitle}</b></span>
                                <span>•</span>
                                <span>📅 Ngày: <b className="text-[#fde047]">{formatDate(reportDate)}</b></span>
                            </p>
                        </div>

                        {/* Thống kê nhanh trên banner */}
                        <div className="z-10 grid grid-cols-3 gap-2.5 sm:gap-3 text-center w-full md:w-auto">
                            <div className="bg-white/10 backdrop-blur-xs border border-white/20 rounded-xl p-2.5">
                                <div className="text-[10px] text-amber-200 font-bold uppercase">Nhân sự ca</div>
                                <div className="text-lg sm:text-xl font-black text-white">{summary.totalEmployees} <span className="text-[10px] font-medium text-amber-200">NV</span></div>
                            </div>
                            <div className="bg-white/10 backdrop-blur-xs border border-white/20 rounded-xl p-2.5">
                                <div className="text-[10px] text-amber-200 font-bold uppercase">Tổng DTQĐ</div>
                                <div className="text-lg sm:text-xl font-black text-[#fde047]">{formatValue(summary.totalRevenueQd)} <span className="text-[10px] font-medium text-amber-200">tr</span></div>
                            </div>
                            <div className="bg-white/10 backdrop-blur-xs border border-white/20 rounded-xl p-2.5">
                                <div className="text-[10px] text-amber-200 font-bold uppercase">% Trả góp</div>
                                <div className="text-lg sm:text-xl font-black text-white">{summary.avgInstallmentRate}%</div>
                            </div>
                        </div>
                    </div>

                    {/* B. CHỈ SỐ KPI TỔNG THỂ */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                                <Coins className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-[11px] font-bold text-slate-500 uppercase">Doanh Thu Thực</div>
                                <div className="text-base sm:text-lg font-black text-slate-900">{formatValue(summary.totalActualRevenue)} <span className="text-xs font-semibold text-slate-500">tr</span></div>
                                <div className="text-[10px] text-slate-400 font-medium">TB: {formatValue(summary.avgActualRevenue)} tr/NV</div>
                            </div>
                        </div>

                        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3.5 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                                <TrendingUp className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-[11px] font-extrabold text-emerald-800 uppercase">Doanh Thu Quy Đổi</div>
                                <div className="text-base sm:text-lg font-black text-emerald-700">{formatValue(summary.totalRevenueQd)} <span className="text-xs font-semibold text-emerald-600">tr</span></div>
                                <div className="text-[10px] text-emerald-600 font-bold">TB: {formatValue(summary.avgRevenueQd)} tr/NV</div>
                            </div>
                        </div>

                        <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-3.5 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                                <CreditCard className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-[11px] font-extrabold text-purple-900 uppercase">DT Trả Góp / Trả Chậm</div>
                                <div className="text-base sm:text-lg font-black text-purple-700">{formatValue(summary.totalInstallmentRevenue)} <span className="text-xs font-semibold text-purple-600">tr</span></div>
                                <div className="text-[10px] text-purple-600 font-bold">Chiếm {summary.avgInstallmentRate}% DT thực</div>
                            </div>
                        </div>

                        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3.5 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                                <Trophy className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="text-[11px] font-extrabold text-amber-900 uppercase">Top 30% Đột Phá</div>
                                <div className="text-base sm:text-lg font-black text-amber-800">{summary.top30Count} <span className="text-xs font-semibold text-amber-700">Chiến Binh</span></div>
                                <div className="text-[10px] text-amber-700 font-medium">Chiếm {(top30Employees.reduce((s, e) => s + e.contribution_rate, 0)).toFixed(1)}% DT ST</div>
                            </div>
                        </div>
                    </div>

                    {/* ========================================================= */}
                    {/* C. PHẦN 1: GHI NHẬN TOP 30% VƯỢT TRỘI (THẺ HÀNG HUY CHƯƠNG) */}
                    {/* ========================================================= */}
                    {top30Employees.length > 0 && (
                        <div data-section="top30" className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-6 bg-amber-500 rounded-full inline-block" />
                                    <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                        <span>🏆 TOP 30% XUẤT SẮC DẪN ĐẦU DOANH THU</span>
                                        <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-lg text-xs font-black">
                                            {top30Employees.length} nhân sự
                                        </span>
                                    </h3>
                                </div>
                                <span className="text-xs text-slate-400 font-medium hidden sm:inline">
                                    Huy chương 🥇🥈🥉 • Số liệu định dạng màu xanh lá in đậm
                                </span>
                            </div>

                            {/* Danh sách thẻ hàng Top 30% */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                {top30Employees.map((emp) => {
                                    const isTop1 = emp.rank === 1;
                                    const isTop2 = emp.rank === 2;
                                    const isTop3 = emp.rank === 3;

                                    const cardBorder = isTop1
                                        ? 'border-amber-300 bg-gradient-to-b from-amber-50/70 to-white shadow-xs ring-1 ring-amber-300'
                                        : isTop2
                                            ? 'border-slate-300 bg-gradient-to-b from-slate-50 to-white shadow-2xs'
                                            : isTop3
                                                ? 'border-amber-200 bg-gradient-to-b from-orange-50/50 to-white shadow-2xs'
                                                : 'border-slate-200 bg-white shadow-2xs';

                                    const medalBadge = isTop1
                                        ? '🥇'
                                        : isTop2
                                            ? '🥈'
                                            : isTop3
                                                ? '🥉'
                                                : `🎖️ #${emp.rank}`;

                                    return (
                                        <div
                                            key={emp.employee_id}
                                            className={`rounded-2xl p-4 border transition hover:shadow-md relative overflow-hidden flex flex-col justify-between ${cardBorder}`}
                                        >
                                            {/* Header thẻ: Huy chương & Tên */}
                                            <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-2xl shrink-0 select-none" title={`Hạng ${emp.rank}`}>
                                                        {medalBadge}
                                                    </span>
                                                    <div>
                                                        <div className="text-xs font-black text-slate-900 tracking-tight leading-snug" title={emp.full_name}>
                                                            {emp.display_name}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 font-medium truncate max-w-[150px]">
                                                            {emp.full_name}
                                                        </div>
                                                    </div>
                                                </div>

                                                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-md shrink-0">
                                                    {emp.contribution_rate}% ST
                                                </span>
                                            </div>

                                            {/* Thông số chính: ĐỊNH DẠNG MÀU XANH LÁ IN ĐẬM */}
                                            <div className="py-3 space-y-2">
                                                {/* Doanh thu QĐ - Nổi bật nhất */}
                                                <div className="flex items-baseline justify-between">
                                                    <span className="text-[11px] font-extrabold text-slate-600">DTQĐ:</span>
                                                    <span className="text-base font-black text-emerald-700 tracking-tight">
                                                        {formatValue(emp.revenue_qd)} <span className="text-xs font-bold text-emerald-600">tr</span>
                                                    </span>
                                                </div>

                                                {/* Doanh thu Thực */}
                                                <div className="flex items-baseline justify-between text-xs">
                                                    <span className="text-slate-500 font-semibold">DT Thực:</span>
                                                    <span className="font-extrabold text-emerald-600">
                                                        {formatValue(emp.revenue_actual)} tr
                                                    </span>
                                                </div>

                                                {/* DT Trả góp & Tỷ lệ */}
                                                <div className="flex items-baseline justify-between text-xs">
                                                    <span className="text-slate-500 font-semibold">Trả góp:</span>
                                                    <span className="font-extrabold text-emerald-600">
                                                        {formatValue(emp.installment_revenue)} tr ({emp.installment_rate}%)
                                                    </span>
                                                </div>

                                                {/* Số lượng sản phẩm */}
                                                <div className="flex items-baseline justify-between text-xs">
                                                    <span className="text-slate-500 font-semibold">Số lượng:</span>
                                                    <span className="font-bold text-slate-700">
                                                        {emp.quantity} SP
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Thanh tiến độ tỷ trọng */}
                                            <div className="pt-2 border-t border-slate-100">
                                                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                                    <div
                                                        className="bg-emerald-500 h-1.5 rounded-full"
                                                        style={{ width: `${Math.min(100, emp.contribution_rate * 3)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ========================================================= */}
                    {/* D. PHẦN 2: TRỌNG TÂM NHẮC NHỞ & TĂNG TỐC KÉO SỐ (TỐI ƯU CÂN ĐỐI) */}
                    {/* ========================================================= */}
                    <div data-section="reminders" className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-6 bg-orange-500 rounded-full inline-block" />
                                <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                    <span>⚡ TRỌNG TÂM NHẮC NHỞ & TĂNG TỐC KÉO SỐ</span>
                                    <span className="px-2 py-0.5 bg-orange-100 text-orange-900 rounded-lg text-xs font-black">
                                        {belowAvgEmployees.length + zeroOrNegativeEmployees.length + zeroInstallmentEmployees.length} mục tiêu nhắc nhở
                                    </span>
                                </h3>
                            </div>

                            {/* Nút chuyển đổi giao diện xem */}
                            <div data-export-ignore="true" className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                                <button
                                    type="button"
                                    onClick={() => setReminderViewMode('CARDS')}
                                    className={`px-2 py-1 rounded transition flex items-center gap-1 cursor-pointer font-bold ${reminderViewMode === 'CARDS' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                                        }`}
                                >
                                    <LayoutGrid className="w-3.5 h-3.5" />
                                    <span>Thẻ Cân Đối</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setReminderViewMode('TABLE')}
                                    className={`px-2 py-1 rounded transition flex items-center gap-1 cursor-pointer font-bold ${reminderViewMode === 'TABLE' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                                        }`}
                                >
                                    <TableIcon className="w-3.5 h-3.5" />
                                    <span>Bảng Chi Tiết</span>
                                </button>
                            </div>
                        </div>

                        {/* HIỂN THỊ DẠNG THẺ CHIP CÂN ĐỐI (FLEX-WRAP CHIPS) */}
                        {reminderViewMode === 'CARDS' ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 items-stretch">
                                {/* CỘT 1: DTQĐ DƯỚI TRUNG BÌNH */}
                                <div className="bg-gradient-to-b from-amber-50/70 to-white border border-amber-200 rounded-2xl p-4 flex flex-col justify-between shadow-2xs space-y-3 min-h-[170px]">
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5 text-xs font-black text-amber-950 uppercase">
                                                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                                <span>DTQĐ Dưới Trung Bình</span>
                                            </div>
                                            <span className="px-2 py-0.5 bg-amber-200 text-amber-900 text-[10px] font-black rounded-lg shrink-0">
                                                {belowAvgEmployees.length} bạn
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-amber-800 leading-snug">
                                            Mức TB shop: <b className="text-amber-950 font-black">{formatValue(summary.avgRevenueQd)} tr</b>
                                        </div>
                                    </div>

                                    {/* Danh sách dạng chip gọn gàng */}
                                    <div className="flex-1 py-1">
                                        {belowAvgEmployees.length === 0 ? (
                                            <div className="h-full flex items-center justify-center py-4 px-2 text-center text-xs font-bold text-emerald-700 bg-white/80 rounded-xl border border-emerald-200">
                                                ✨ 100% nhân sự đều vượt mức trung bình!
                                            </div>
                                        ) : (
                                            <div className="flex flex-wrap gap-1.5 content-start">
                                                {belowAvgEmployees.map(emp => {
                                                    const diff = summary.avgRevenueQd - emp.revenue_qd;
                                                    return (
                                                        <div
                                                            key={emp.employee_id}
                                                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-amber-200 rounded-xl shadow-2xs text-xs hover:border-amber-300 transition"
                                                            title={`${emp.full_name}: Hiện có ${formatValue(emp.revenue_qd)} tr, còn thiếu ${formatValue(diff)} tr để chạm TB`}
                                                        >
                                                            <span className="font-extrabold text-slate-800">{emp.display_name}</span>
                                                            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded font-black text-[11px]">
                                                                {formatValue(emp.revenue_qd)} tr
                                                            </span>
                                                            <span className="text-[10px] text-amber-700 font-semibold">
                                                                (-{formatValue(diff)})
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* CỘT 2: DTQĐ <= 0 (CHƯA CÓ SỐ / ÂM) */}
                                <div className="bg-gradient-to-b from-rose-50/70 to-white border border-rose-200 rounded-2xl p-4 flex flex-col justify-between shadow-2xs space-y-3 min-h-[170px]">
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5 text-xs font-black text-rose-950 uppercase">
                                                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                                                <span>Chưa Có DTQĐ / Bị Âm</span>
                                            </div>
                                            <span className="px-2 py-0.5 bg-rose-200 text-rose-900 text-[10px] font-black rounded-lg shrink-0">
                                                {zeroOrNegativeEmployees.length} bạn
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-rose-800 leading-snug">
                                            Nhân sự trong ca chưa có doanh thu quy đổi hoặc bị âm
                                        </div>
                                    </div>

                                    {/* Danh sách dạng chip gọn gàng */}
                                    <div className="flex-1 py-1">
                                        {zeroOrNegativeEmployees.length === 0 ? (
                                            <div className="h-full flex items-center justify-center py-4 px-2 text-center text-xs font-bold text-emerald-700 bg-white/80 rounded-xl border border-emerald-200">
                                                🎉 100% nhân sự trong ca đều đã nổ số!
                                            </div>
                                        ) : (
                                            <div className="flex flex-wrap gap-1.5 content-start">
                                                {zeroOrNegativeEmployees.map(emp => (
                                                    <div
                                                        key={emp.employee_id}
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-rose-200 rounded-xl shadow-2xs text-xs hover:border-rose-300 transition"
                                                        title={`${emp.full_name}: ${emp.revenue_qd < 0 ? 'Bị âm do trả hàng' : 'Chưa có doanh thu'}`}
                                                    >
                                                        <span className="font-extrabold text-slate-800">{emp.display_name}</span>
                                                        <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded font-black text-[11px]">
                                                            {formatValue(emp.revenue_qd)} tr
                                                        </span>
                                                        <span className="text-[10px] text-rose-600 font-bold">
                                                            {emp.revenue_qd < 0 ? '⚠️ Âm số' : '🚨 Chưa có số'}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* CỘT 3: CÓ DT NHƯNG 0% TRẢ GÓP */}
                                <div className="bg-gradient-to-b from-indigo-50/70 to-white border border-indigo-200 rounded-2xl p-4 flex flex-col justify-between shadow-2xs space-y-3 min-h-[170px]">
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5 text-xs font-black text-indigo-950 uppercase">
                                                <CreditCard className="w-4 h-4 text-indigo-600 shrink-0" />
                                                <span>Có DT Nhưng 0% TrẢ GÓP</span>
                                            </div>
                                            <span className="px-2 py-0.5 bg-indigo-200 text-indigo-900 text-[10px] font-black rounded-lg shrink-0">
                                                {zeroInstallmentEmployees.length} bạn
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-indigo-800 leading-snug">
                                            Đã phát sinh doanh số nhưng chưa có hợp đồng trả chậm
                                        </div>
                                    </div>

                                    {/* Danh sách dạng chip gọn gàng */}
                                    <div className="flex-1 py-1">
                                        {zeroInstallmentEmployees.length === 0 ? (
                                            <div className="h-full flex items-center justify-center py-4 px-2 text-center text-xs font-bold text-emerald-700 bg-white/80 rounded-xl border border-emerald-200">
                                                🎯 100% nhân sự có doanh thu đều có đơn trả góp!
                                            </div>
                                        ) : (
                                            <div className="flex flex-wrap gap-1.5 content-start">
                                                {zeroInstallmentEmployees.map(emp => (
                                                    <div
                                                        key={emp.employee_id}
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-indigo-200 rounded-xl shadow-2xs text-xs hover:border-indigo-300 transition"
                                                        title={`${emp.full_name}: DTQĐ ${formatValue(emp.revenue_qd)} tr, chưa có hợp đồng trả góp`}
                                                    >
                                                        <span className="font-extrabold text-slate-800">{emp.display_name}</span>
                                                        <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-800 rounded font-black text-[11px]">
                                                            0% Trả góp
                                                        </span>
                                                        <span className="text-[10px] text-slate-500 font-semibold">
                                                            (DT: {formatValue(emp.revenue_qd)} tr)
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* HIỂN THỊ DẠNG BẢNG CHI TIẾT NHẮC NHỞ */
                            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead className="bg-slate-100 text-slate-700 font-black uppercase text-[10px] tracking-wider sticky top-0 z-10">
                                            <tr>
                                                <th className="py-2.5 px-3">MSNV - Tên Nhân Viên</th>
                                                <th className="py-2.5 px-3 text-right">DTQĐ Hiện Tại</th>
                                                <th className="py-2.5 px-3 text-center">Tiêu Chí Nhắc Nhở</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-medium">
                                            {allShiftEmployees
                                                .filter(e => e.is_below_avg || e.is_zero_or_negative || e.is_zero_installment)
                                                .map(emp => (
                                                    <tr key={emp.employee_id} className="hover:bg-slate-50 transition">
                                                        <td className="py-2.5 px-3 font-extrabold text-slate-900">
                                                            {emp.display_name}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-right font-black text-slate-800">
                                                            {formatValue(emp.revenue_qd)} tr
                                                        </td>
                                                        <td className="py-2.5 px-3 text-center">
                                                            <div className="flex items-center justify-center gap-1 flex-wrap">
                                                                {emp.is_zero_or_negative && (
                                                                    <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-[10px] font-bold">
                                                                        Chưa có số
                                                                    </span>
                                                                )}
                                                                {emp.is_below_avg && !emp.is_zero_or_negative && (
                                                                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-bold">
                                                                        Dưới TB (-{formatValue(summary.avgRevenueQd - emp.revenue_qd)})
                                                                    </span>
                                                                )}
                                                                {emp.is_zero_installment && (
                                                                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold">
                                                                        0% Trả góp
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ========================================================= */}
                    {/* E. PHẦN 3: BẢNG CHI TIẾT SỐ LIỆU DOANH THU NHÂN VIÊN       */}
                    {/* ========================================================= */}
                    <div data-section="table" className="space-y-3">
                        {/* Thanh công cụ bảng: Lọc & Tìm kiếm */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-6 bg-blue-600 rounded-full inline-block" />
                                <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-wide">
                                    BẢNG CHI TIẾT DOANH THU NHÂN VIÊN
                                </h3>
                                <span className="text-xs text-slate-500 font-bold">({displayTableRows.length}/{allShiftEmployees.length} bạn)</span>
                            </div>

                            <div data-export-ignore="true" className="flex flex-wrap items-center gap-2">
                                {/* Bộ lọc danh mục */}
                                <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-bold border border-slate-200">
                                    <button
                                        type="button"
                                        onClick={() => setFilterCategory('ALL')}
                                        className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${filterCategory === 'ALL'
                                                ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                                                : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                    >
                                        Tất cả ({allShiftEmployees.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFilterCategory('ACTIVE_ONLY')}
                                        className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${filterCategory === 'ACTIVE_ONLY'
                                                ? 'bg-white text-emerald-800 shadow-2xs font-extrabold'
                                                : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                    >
                                        Đang có số ({analyzedEmployees.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFilterCategory('TOP_30')}
                                        className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${filterCategory === 'TOP_30'
                                                ? 'bg-white text-amber-700 shadow-2xs font-extrabold'
                                                : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                    >
                                        Top 30%
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFilterCategory('BELOW_AVG')}
                                        className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${filterCategory === 'BELOW_AVG'
                                                ? 'bg-white text-orange-700 shadow-2xs font-extrabold'
                                                : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                    >
                                        Dưới TB
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFilterCategory('ZERO_OR_NEG')}
                                        className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${filterCategory === 'ZERO_OR_NEG'
                                                ? 'bg-white text-rose-700 shadow-2xs font-extrabold'
                                                : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                    >
                                        DTQĐ &le; 0
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFilterCategory('ZERO_INSTALLMENT')}
                                        className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${filterCategory === 'ZERO_INSTALLMENT'
                                                ? 'bg-white text-indigo-700 shadow-2xs font-extrabold'
                                                : 'text-slate-500 hover:text-slate-800'
                                            }`}
                                    >
                                        0% Trả góp
                                    </button>
                                </div>

                                {/* Ô tìm kiếm */}
                                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl w-48 sm:w-56">
                                    <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <input
                                        type="text"
                                        placeholder="Tìm tên / MSNV..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="bg-transparent text-xs outline-hidden w-full text-slate-800 placeholder-slate-400 font-medium"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Bảng dữ liệu chính */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                            <div className="overflow-x-auto max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="sticky top-0 z-20 shadow-2xs select-none">
                                        <tr className="bg-slate-900 text-white text-[11px] font-black uppercase h-11 tracking-wider">
                                            {/* STT */}
                                            <th
                                                onClick={() => handleSort('rank')}
                                                className="py-2 px-2.5 text-center w-12 cursor-pointer hover:bg-slate-800 border-r border-slate-800 transition"
                                                title="Sắp xếp theo thứ hạng"
                                            >
                                                <div className="flex items-center justify-center gap-1">
                                                    <span>STT</span>
                                                    <ArrowUpDown className="w-2.5 h-2.5 opacity-60" />
                                                </div>
                                            </th>

                                            {/* Phân loại & Huy hiệu */}
                                            <th className="py-2 px-2 text-center w-24 border-r border-slate-800">
                                                ĐÁNH GIÁ
                                            </th>

                                            {/* MSNV - Tên NV Rút Gọn */}
                                            <th
                                                onClick={() => handleSort('name')}
                                                className="py-2 px-3 min-w-[190px] cursor-pointer hover:bg-slate-800 border-r border-slate-800 transition"
                                                title="Mã nhân viên và tên rút gọn"
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <span>MSNV - Tên NV</span>
                                                    <ArrowUpDown className="w-2.5 h-2.5 opacity-60" />
                                                </div>
                                            </th>

                                            {/* Số Lượng */}
                                            <th
                                                onClick={() => handleSort('qty')}
                                                className="py-2 px-2.5 text-right w-20 cursor-pointer hover:bg-slate-800 border-r border-slate-800 transition"
                                            >
                                                <div className="flex items-center justify-end gap-1">
                                                    <span>SL SP</span>
                                                    <ArrowUpDown className="w-2.5 h-2.5 opacity-60" />
                                                </div>
                                            </th>

                                            {/* Doanh Thu Thực */}
                                            <th
                                                onClick={() => handleSort('actual')}
                                                className="py-2 px-3 text-right w-32 cursor-pointer hover:bg-slate-800 border-r border-slate-800 transition"
                                            >
                                                <div className="flex items-center justify-end gap-1">
                                                    <span>DT Thực (tr)</span>
                                                    <ArrowUpDown className="w-2.5 h-2.5 opacity-60" />
                                                </div>
                                            </th>

                                            {/* DTQĐ (Màu Vàng Nổi Bật) */}
                                            <th
                                                onClick={() => handleSort('qd')}
                                                className="py-2 px-3 text-right w-32 bg-[#005a43] text-[#fde047] cursor-pointer hover:bg-[#004735] border-r border-[#004735] transition"
                                            >
                                                <div className="flex items-center justify-end gap-1">
                                                    <span>DTQĐ (tr)</span>
                                                    <ArrowUpDown className="w-2.5 h-2.5 opacity-80" />
                                                </div>
                                            </th>

                                            {/* Tỷ trọng ST */}
                                            <th className="py-2 px-2.5 text-right w-24 border-r border-slate-800">
                                                Tỉ Trọng
                                            </th>

                                            {/* DT Trả Góp */}
                                            <th
                                                onClick={() => handleSort('installment')}
                                                className="py-2 px-3 text-right w-32 cursor-pointer hover:bg-slate-800 border-r border-slate-800 transition"
                                            >
                                                <div className="flex items-center justify-end gap-1">
                                                    <span>Trả Góp (tr)</span>
                                                    <ArrowUpDown className="w-2.5 h-2.5 opacity-60" />
                                                </div>
                                            </th>

                                            {/* % Trả Góp */}
                                            <th className="py-2 px-2.5 text-right w-24">
                                                % Trả Góp
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-slate-100 font-medium text-xs">
                                        {displayTableRows.map((row) => {
                                            const isTop1 = row.rank === 1 && !row.is_zero_or_negative;
                                            const isTop2 = row.rank === 2 && !row.is_zero_or_negative;
                                            const isTop3 = row.rank === 3 && !row.is_zero_or_negative;
                                            const isTop30 = row.is_top_30;

                                            const rowBg = isTop1
                                                ? 'bg-amber-50/40 hover:bg-amber-50'
                                                : isTop2
                                                    ? 'bg-slate-50/50 hover:bg-slate-100'
                                                    : isTop3
                                                        ? 'bg-orange-50/30 hover:bg-orange-50'
                                                        : row.is_zero_or_negative
                                                            ? 'bg-rose-50/20 hover:bg-rose-50/40'
                                                            : 'hover:bg-slate-50';

                                            return (
                                                <tr key={row.employee_id} className={`transition ${rowBg}`}>
                                                    {/* 1. STT */}
                                                    <td className="py-2.5 px-2.5 text-center font-bold text-slate-700 border-r border-slate-100">
                                                        {row.rank}
                                                    </td>

                                                    {/* 2. Huy hiệu */}
                                                    <td className="py-2.5 px-2 text-center border-r border-slate-100">
                                                        {isTop1 ? (
                                                            <span className="text-lg" title="Hạng 1 xuất sắc">🥇</span>
                                                        ) : isTop2 ? (
                                                            <span className="text-lg" title="Hạng 2 xuất sắc">🥈</span>
                                                        ) : isTop3 ? (
                                                            <span className="text-lg" title="Hạng 3 xuất sắc">🥉</span>
                                                        ) : isTop30 ? (
                                                            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-black rounded-md">
                                                                Top 30%
                                                            </span>
                                                        ) : row.is_zero_or_negative ? (
                                                            <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-bold rounded-md">
                                                                DTQĐ &le; 0
                                                            </span>
                                                        ) : row.is_below_avg ? (
                                                            <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-md">
                                                                Dưới TB
                                                            </span>
                                                        ) : (
                                                            <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-md">
                                                                Vượt TB
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* 3. MSNV - Tên rút gọn */}
                                                    <td className="py-2.5 px-3 border-r border-slate-100">
                                                        <div className="font-extrabold text-slate-900" title={row.full_name}>
                                                            {row.display_name}
                                                        </div>
                                                    </td>

                                                    {/* 4. Số lượng */}
                                                    <td className="py-2.5 px-2.5 text-right font-bold text-slate-700 border-r border-slate-100">
                                                        {row.quantity}
                                                    </td>

                                                    {/* 5. Doanh thu thực (tr) - Màu xanh lá */}
                                                    <td className="py-2.5 px-3 text-right font-extrabold text-emerald-700 border-r border-slate-100">
                                                        {formatValue(row.revenue_actual)}
                                                    </td>

                                                    {/* 6. DTQĐ (tr) - Định dạng XANH LÁ IN ĐẬM */}
                                                    <td className="py-2.5 px-3 text-right bg-emerald-50/60 font-black text-emerald-800 text-sm border-r border-emerald-100">
                                                        {formatValue(row.revenue_qd)}
                                                    </td>

                                                    {/* 7. Tỷ trọng (%) */}
                                                    <td className="py-2.5 px-2.5 text-right font-bold text-slate-600 border-r border-slate-100">
                                                        {row.contribution_rate}%
                                                    </td>

                                                    {/* 8. DT Trả Góp */}
                                                    <td className="py-2.5 px-3 text-right font-extrabold text-slate-800 border-r border-slate-100">
                                                        {row.installment_revenue > 0 ? (
                                                            <span className="text-purple-700">{formatValue(row.installment_revenue)}</span>
                                                        ) : (
                                                            <span className="text-slate-300 font-medium">0</span>
                                                        )}
                                                    </td>

                                                    {/* 9. % Trả Góp */}
                                                    <td className="py-2.5 px-2.5 text-right font-bold">
                                                        {row.installment_rate > 0 ? (
                                                            <span className={row.installment_rate >= 30 ? 'text-emerald-700 font-black' : 'text-slate-700'}>
                                                                {row.installment_rate}%
                                                            </span>
                                                        ) : (
                                                            <span className="text-rose-500 font-bold">0%</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>

                                    {/* HÀNG TỔNG CỘNG CHÂN BẢNG */}
                                    <tfoot className="sticky bottom-0 bg-slate-900 text-white font-black text-xs z-20 shadow-xs select-none">
                                        <tr className="h-10">
                                            <td colSpan={3} className="py-2 px-3 text-center uppercase tracking-wider border-r border-slate-800">
                                                TỔNG CỘNG ({displayTableRows.length} NHÂN SỰ)
                                            </td>
                                            <td className="py-2 px-2.5 text-right border-r border-slate-800">
                                                {summary.totalQuantity}
                                            </td>
                                            <td className="py-2 px-3 text-right text-emerald-400 border-r border-slate-800">
                                                {formatValue(summary.totalActualRevenue)}
                                            </td>
                                            <td className="py-2 px-3 text-right bg-[#005a43] text-[#fde047] text-sm border-r border-[#004735]">
                                                {formatValue(summary.totalRevenueQd)}
                                            </td>
                                            <td className="py-2 px-2.5 text-right border-r border-slate-800">
                                                100%
                                            </td>
                                            <td className="py-2 px-3 text-right text-purple-300 border-r border-slate-800">
                                                {formatValue(summary.totalInstallmentRevenue)}
                                            </td>
                                            <td className="py-2 px-2.5 text-right text-amber-300">
                                                {summary.avgInstallmentRate}%
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
