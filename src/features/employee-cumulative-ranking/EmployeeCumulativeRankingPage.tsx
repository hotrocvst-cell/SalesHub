import React, { useState, useEffect, useMemo, useRef } from 'react';
import { fetchStores, fetchEmployees, type StoreItem, type EmployeeItem } from '../../core/lib/storage';
import { getYesterdayDateString, formatDate, getStartOfWeek, getShortStoreName } from '../../core/lib/formatters';
import { useUserStoreFilter } from '../../shared/hooks/useUserStoreFilter';
import { useExcelExportPermission } from '../../shared/hooks/useExcelExportPermission';
import type { CumulativeRankingViewMode, EmployeeCumulativeRankingRow, StoreCumulativeSummary, PeriodTargetConfig, TargetSelectionMode } from './types';
import { fetchCumulativeRankingData } from './services/cumulativeRankingService';
import CumulativeRankingFilterBar, { type RankingDatePreset } from './components/CumulativeRankingFilterBar';
import CumulativeRankingKpiCards from './components/CumulativeRankingKpiCards';
import CumulativeRankingTable from './components/CumulativeRankingTable';
import PeriodTargetConfigModal from './components/PeriodTargetConfigModal';
import PeriodTargetSessionManagerModal from './components/PeriodTargetSessionManagerModal';
import CloudDataSyncStatusBanner from '../../shared/components/report/CloudDataSyncStatusBanner';
import {
    checkSupabasePeriodTargetTable,
    syncLocalPeriodTargetsToCloud,
    getLocalCache,
    EMPLOYEE_PERIOD_TARGETS_SQL
} from './services/periodTargetStorage';
import { Trophy, CheckCircle2, AlertCircle } from 'lucide-react';
import ExcelJS from 'exceljs';
import html2canvas from 'html2canvas';
import { calculate8KScale } from '../../shared/utils/exportImage';

export default function EmployeeCumulativeRankingPage() {
    const reportRef = useRef<HTMLDivElement>(null);

    // Quyền xuất file Excel (Mặc định khóa và ẩn hiển thị trừ khi được cấp quyền)
    const { canExportExcel } = useExcelExportPermission('/xep-hang-doanh-thu-luy-ke');

    // 1. STATE THỜI GIAN & BỘ LỌC
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const firstDayOfMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
    const defaultYesterday = getYesterdayDateString() || `${currentYear}-${String(currentMonth).padStart(2, '0')}-13`;

    const [fromDate, setFromDate] = useState<string>(firstDayOfMonth);
    const [toDate, setToDate] = useState<string>(defaultYesterday);
    const [activePreset, setActivePreset] = useState<RankingDatePreset>('THIS_MONTH');
    const [stores, setStores] = useState<StoreItem[]>([]);
    const [selectedStore, setSelectedStore] = useState<string>('all');

    // Phân quyền siêu thị
    const { allowedStores, isLockedToSingleStore } = useUserStoreFilter(
        stores,
        selectedStore,
        setSelectedStore
    );

    // Chế độ xem & Target & Quản lý phiên
    const [viewMode, setViewMode] = useState<CumulativeRankingViewMode>('CUMULATIVE_ONLY');
    const [showTarget, setShowTarget] = useState<boolean>(true);
    const [targetMode, setTargetMode] = useState<TargetSelectionMode>('AUTO');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [isPeriodTargetModalOpen, setIsPeriodTargetModalOpen] = useState<boolean>(false);
    const [isSessionManagerOpen, setIsSessionManagerOpen] = useState<boolean>(false);
    const [employees, setEmployees] = useState<EmployeeItem[]>([]);

    // Trạng thái Cloud Storage & Đồng bộ
    const [tableReady, setTableReady] = useState<boolean>(true);
    const [unsyncedCount, setUnsyncedCount] = useState<number>(0);

    // State Dữ liệu
    const [rows, setRows] = useState<EmployeeCumulativeRankingRow[]>([]);
    const [summary, setSummary] = useState<StoreCumulativeSummary>({
        storeName: 'all',
        fromDate: firstDayOfMonth,
        toDate: defaultYesterday,
        dateList: [],
        storeCumulativeRevenue: 0,
        storeDailyRevenue: {},
        storeTarget: 0,
        storeCompletionRate: 0,
        totalEmployeesWithSales: 0,
        sumOfEmployeesCumulative: 0,
        unassignedOrOnlineDiff: 0,
        top1Employee: null,
        avgRevenuePerEmployee: 0
    });

    const [loading, setLoading] = useState<boolean>(true);
    const [isExporting, setIsExporting] = useState<boolean>(false);
    const [toastMessage, setToastMessage] = useState<string>('');

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 3500);
    };

    // 2. TẢI DANH MỤC SIÊU THỊ & NHÂN SỰ
    useEffect(() => {
        fetchStores().then(res => {
            if (res.success && res.data) {
                setStores(res.data);
            }
        });
    }, []);

    useEffect(() => {
        fetchEmployees(selectedStore === 'all' ? undefined : selectedStore).then(res => {
            if (res.success && res.data) {
                setEmployees(res.data);
            }
        });
    }, [selectedStore]);

    // 3. TẢI DỮ LIỆU BÁO CÁO
    const loadReportData = async () => {
        setLoading(true);
        const res = await fetchCumulativeRankingData({
            fromDate,
            toDate,
            store: selectedStore,
            storesList: stores,
            targetMode
        });

        if (res.success) {
            setRows(res.rows);
            setSummary(res.summary);
        } else {
            showToast(res.error || 'Lỗi khi tải dữ liệu báo cáo');
        }
        setLoading(false);
    };

    useEffect(() => {
        loadReportData();
    }, [fromDate, toDate, selectedStore, targetMode]);

    // Kiểm tra trạng thái Cloud & Local cache
    const checkCloudStatus = async () => {
        const check = await checkSupabasePeriodTargetTable();
        setTableReady(check.exists);
        const local = getLocalCache();
        const unsynced = local.filter(l => !l.isCloudStored).length;
        setUnsyncedCount(unsynced);
    };

    useEffect(() => {
        checkCloudStatus();
    }, []);

    // 4. PRESETS THỜI GIAN NHANH (Bắt đầu từ Thứ Hai)
    const handleSelectPreset = (preset: 'THIS_MONTH' | 'THIS_WEEK' | 'LAST_7_DAYS' | 'YESTERDAY' | 'LAST_MONTH') => {
        setActivePreset(preset);
        const d = new Date();
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const pad = (n: number) => String(n).padStart(2, '0');

        if (preset === 'THIS_MONTH') {
            setFromDate(`${y}-${pad(m)}-01`);
            setToDate(defaultYesterday);
        } else if (preset === 'THIS_WEEK') {
            const monday = getStartOfWeek(new Date());
            setFromDate(monday);
            setToDate(defaultYesterday >= monday ? defaultYesterday : monday);
        } else if (preset === 'YESTERDAY') {
            setFromDate(defaultYesterday);
            setToDate(defaultYesterday);
        } else if (preset === 'LAST_7_DAYS') {
            const past7 = new Date();
            past7.setDate(past7.getDate() - 7);
            setFromDate(`${past7.getFullYear()}-${pad(past7.getMonth() + 1)}-${pad(past7.getDate())}`);
            setToDate(defaultYesterday);
        } else if (preset === 'LAST_MONTH') {
            const prevMonthDate = new Date(y, m - 2, 1);
            const lastDayOfPrevMonth = new Date(y, m - 1, 0);
            const prevY = prevMonthDate.getFullYear();
            const prevM = prevMonthDate.getMonth() + 1;
            setFromDate(`${prevY}-${pad(prevM)}-01`);
            setToDate(`${prevY}-${pad(prevM)}-${pad(lastDayOfPrevMonth.getDate())}`);
        }
    };

    // Thao tác áp dụng / chỉnh sửa phiên từ Session Manager
    const handleApplySession = (sess: PeriodTargetConfig) => {
        setActivePreset('CUSTOM');
        setFromDate(sess.fromDate);
        setToDate(sess.toDate);
        if (sess.storeName && sess.storeName !== 'all') {
            setSelectedStore(sess.storeName);
        }
        setIsSessionManagerOpen(false);
        showToast(`🎯 Đã áp dụng phiên: ${sess.periodTitle}`);
    };

    const handleEditSession = (sess: PeriodTargetConfig) => {
        setActivePreset('CUSTOM');
        setFromDate(sess.fromDate);
        setToDate(sess.toDate);
        if (sess.storeName && sess.storeName !== 'all') {
            setSelectedStore(sess.storeName);
        }
        setIsSessionManagerOpen(false);
        setIsPeriodTargetModalOpen(true);
    };

    const handleSyncCloud = async () => {
        const res = await syncLocalPeriodTargetsToCloud();
        await checkCloudStatus();
        await loadReportData();
        if (res.syncedCount > 0) {
            showToast(`✅ Đã đồng bộ ${res.syncedCount} phiên lên Supabase Cloud!`);
        } else if (!res.success) {
            showToast(`⚠️ Không thể đồng bộ. ${res.error || 'Vui lòng kiểm tra kết nối!'}`);
        } else {
            showToast('👍 Dữ liệu đã đồng bộ Cloud.');
        }
    };

    // 5. LỌC TÌM KIẾM THEO TÊN / MÃ NHÂN VIÊN
    const filteredRows = useMemo(() => {
        if (!searchQuery.trim()) return rows;
        const q = searchQuery.toLowerCase().trim();
        return rows.filter(r =>
            r.fullName.toLowerCase().includes(q) ||
            r.employeeId.toLowerCase().includes(q)
        );
    }, [rows, searchQuery]);

    // 6. XUẤT FILE EXCEL
    const handleExportExcel = async () => {
        try {
            showToast('📊 Đang xuất file Excel...');
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('XepHangLuyKe');

            const columns: any[] = [
                { header: 'Hạng', key: 'rank', width: 8 },
                { header: 'Mã NV', key: 'id', width: 12 },
                { header: 'Họ và tên', key: 'name', width: 25 },
                { header: 'Siêu thị', key: 'store', width: 20 },
            ];

            if (showTarget) {
                columns.push({ header: 'Target (VNĐ)', key: 'target', width: 16 });
            }

            columns.push({ header: 'Lũy Kế DT (VNĐ)', key: 'cum_rev', width: 18 });

            if (showTarget) {
                columns.push({ header: '% Hoàn Thành', key: 'pct_ht', width: 14 });
            }

            columns.push({ header: '% Đóng Góp Shop', key: 'share', width: 16 });

            if (viewMode === 'WITH_DAILY') {
                summary.dateList.forEach(d => {
                    columns.push({ header: d, key: `date_${d}`, width: 14 });
                });
            }

            worksheet.columns = columns;

            // Dòng dữ liệu nhân viên
            filteredRows.forEach(r => {
                const rowData: any = {
                    rank: r.rank,
                    id: r.employeeId,
                    name: r.fullName,
                    store: r.storeName,
                    cum_rev: r.cumulativeRevenue,
                    share: `${r.storeShareRate.toFixed(1)}%`
                };
                if (showTarget) {
                    rowData.target = r.target;
                    rowData.pct_ht = r.target > 0 ? `${r.completionRate.toFixed(1)}%` : '-';
                }
                if (viewMode === 'WITH_DAILY') {
                    summary.dateList.forEach(d => {
                        rowData[`date_${d}`] = r.dailyRevenues[d] || 0;
                    });
                }
                worksheet.addRow(rowData);
            });

            // HÀNG TỔNG CỘNG: SỐ TỔNG CỦA SIÊU THỊ
            const footerData: any = {
                rank: 'TỔNG',
                id: 'SIÊU THỊ',
                name: 'TỔNG LŨY KẾ SIÊU THỊ',
                store: summary.storeName,
                cum_rev: summary.storeCumulativeRevenue,
                share: '100%'
            };
            if (showTarget) {
                footerData.target = summary.storeTarget;
                footerData.pct_ht = summary.storeTarget > 0 ? `${summary.storeCompletionRate.toFixed(1)}%` : '-';
            }
            if (viewMode === 'WITH_DAILY') {
                summary.dateList.forEach(d => {
                    footerData[`date_${d}`] = summary.storeDailyRevenue[d] || 0;
                });
            }
            const fRow = worksheet.addRow(footerData);
            fRow.font = { bold: true };

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `XepHangDoanhThuLuyKe_${fromDate}_den_${toDate}.xlsx`;
            anchor.click();
            window.URL.revokeObjectURL(url);
            showToast('✅ Xuất file Excel thành công!');
        } catch (err) {
            console.error('Lỗi xuất Excel:', err);
            showToast('⚠️ Lỗi khi xuất Excel');
        }
    };

    // 7. XUẤT HÌNH ẢNH 8K (PORTRAIT DỌC CHO LŨY KẾ, TỰ ĐỘNG MỞ RỘNG TOÀN DIỆN CHO CHI TIẾT TỪNG NGÀY, TUYỆT ĐỐI KHÔNG FOOTER WATERMARK)
    const handleExportImage = async (mode: 'DOWNLOAD' | 'COPY') => {
        if (!reportRef.current) return;
        setIsExporting(true);
        showToast('📸 Đang tạo hình ảnh báo cáo 8K...');

        const originalEl = reportRef.current;
        const scrollContainers = originalEl.querySelectorAll<HTMLElement>('.overflow-x-auto');
        const previousScrolls = Array.from(scrollContainers).map(c => c.scrollLeft);

        try {
            if (document.fonts && document.fonts.ready) {
                await document.fonts.ready;
            }

            // Chờ 2 frames render để DOM layout và fonts hoàn toàn sẵn sàng
            await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

            // Reset scroll vị trí của tất cả các container cuộn ngang về 0 trước khi chụp để không bị lệch cột
            scrollContainers.forEach(c => { c.scrollLeft = 0; });

            const tableEl = originalEl.querySelector('table');
            const tableScrollWidth = tableEl ? tableEl.scrollWidth : 0;
            const isShowingDaily = viewMode === 'WITH_DAILY';

            // Tính toán độ rộng cơ sở cần thiết để hiển thị 100% tất cả các cột mà không bao giờ bị cắt cụt:
            // Cột cố định (Hạng + Mã & Tên NV + Siêu thị nếu có + Target nếu có + Lũy kế + %HT + %Đóng góp)
            const baseColsWidth = (selectedStore === 'all' ? 110 : 0) + (showTarget ? 160 : 0) + 420;
            const estimatedDailyWidth = isShowingDaily
                ? baseColsWidth + (summary.dateList.length * 70) + 48
                : 960;

            // TargetWidth: Nếu chỉ xem lũy kế -> chuẩn dọc 960px; Nếu xem chi tiết từng ngày -> tự động mở rộng bao quát toàn bộ các ngày
            const targetWidth = Math.max(960, tableScrollWidth + 32, estimatedDailyWidth);

            const scale = calculate8KScale(originalEl, targetWidth);

            const canvas = await html2canvas(originalEl, {
                scale: scale,
                width: targetWidth,
                windowWidth: targetWidth + 40,
                scrollX: 0,
                scrollY: 0,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#f8fafc',
                logging: false,
                ignoreElements: (element) =>
                    element.getAttribute('data-html2canvas-ignore') === 'true' ||
                    element.getAttribute('data-export-ignore') === 'true',
                onclone: (clonedDoc) => {
                    // 1. Nhúng trực tiếp font UTM Avo vào iframe clone
                    const fontStyle = clonedDoc.createElement('style');
                    fontStyle.innerHTML = `
                        @font-face {
                            font-family: 'UTM Avo';
                            src: url('/fonts/UTM-Avo.ttf') format('truetype');
                            font-weight: 400;
                            font-style: normal;
                        }
                        @font-face {
                            font-family: 'UTM Avo';
                            src: url('/fonts/UTM-AvoBold.ttf') format('truetype');
                            font-weight: 700;
                            font-style: normal;
                        }
                        * {
                            -webkit-font-smoothing: antialiased;
                            -moz-osx-font-smoothing: grayscale;
                            box-sizing: border-box;
                        }
                        img, svg { display: inline-block !important; vertical-align: middle !important; }
                        td, th { vertical-align: middle !important; }
                        #cumulative-ranking-export-area * { overflow: visible !important; }
                    `;
                    clonedDoc.head.appendChild(fontStyle);

                    // 2. Không giới hạn chiều cao tài liệu theo Rule Unlimited Height & Mở rộng chiều ngang toàn diện
                    clonedDoc.documentElement.style.height = 'auto';
                    clonedDoc.documentElement.style.maxHeight = 'none';
                    clonedDoc.documentElement.style.overflow = 'visible';
                    clonedDoc.documentElement.style.width = `${targetWidth}px`;

                    clonedDoc.body.style.height = 'auto';
                    clonedDoc.body.style.maxHeight = 'none';
                    clonedDoc.body.style.overflow = 'visible';
                    clonedDoc.body.style.width = `${targetWidth}px`;

                    // 3. Xóa các phần tử gắn cờ bỏ qua
                    clonedDoc.querySelectorAll('[data-html2canvas-ignore="true"], [data-export-ignore="true"]').forEach(el => el.remove());

                    const el = clonedDoc.getElementById('cumulative-ranking-export-area');
                    if (el) {
                        el.classList.remove('max-w-[960px]');
                        el.style.setProperty('width', `${targetWidth}px`, 'important');
                        el.style.setProperty('min-width', `${targetWidth}px`, 'important');
                        el.style.setProperty('max-width', `${targetWidth}px`, 'important');
                        el.style.height = 'auto';
                        el.style.minHeight = 'auto';
                        el.style.maxHeight = 'none';
                        el.style.overflow = 'visible';
                        el.style.margin = '0 auto';
                        el.style.boxSizing = 'border-box';
                        el.style.padding = '16px';
                        el.style.paddingBottom = '32px';

                        // 4. Gỡ bỏ sticky trên thead, th, td để không bị lệch hoặc đè cột trong html2canvas
                        el.querySelectorAll<HTMLElement>('.sticky, thead, th, td').forEach(stickyEl => {
                            if (stickyEl.classList.contains('sticky') || stickyEl.style.position === 'sticky') {
                                stickyEl.style.setProperty('position', 'static', 'important');
                                stickyEl.style.setProperty('left', 'auto', 'important');
                            }
                        });

                        // 5. Mở rộng tất cả container cuộn bên trong để lấy 100% chiều rộng và chiều cao tự nhiên
                        el.querySelectorAll<HTMLElement>('.overflow-x-auto, .overflow-y-auto, [class*="max-h-"], .overflow-hidden').forEach(c => {
                            c.style.setProperty('overflow', 'visible', 'important');
                            c.style.setProperty('overflow-x', 'visible', 'important');
                            c.style.setProperty('overflow-y', 'visible', 'important');
                            c.style.setProperty('max-height', 'none', 'important');
                            c.style.setProperty('height', 'auto', 'important');
                            c.style.setProperty('width', '100%', 'important');
                            c.scrollLeft = 0;
                        });

                        // 6. Căn chỉnh bảng dữ liệu hiển thị toàn bộ các cột
                        const clonedTable = el.querySelector('table');
                        if (clonedTable) {
                            clonedTable.style.setProperty('width', '100%', 'important');
                            clonedTable.style.setProperty('min-width', '100%', 'important');
                            clonedTable.style.setProperty('table-layout', 'auto', 'important');
                        }
                    }
                }
            });

            if (mode === 'DOWNLOAD') {
                const link = document.createElement('a');
                link.download = `XepHangDoanhThuLuyKe_${fromDate}_den_${toDate}_8K.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
                showToast('✅ Đã tải xuống ảnh báo cáo 8K thành công!');
            } else {
                canvas.toBlob(async (blob) => {
                    if (blob && navigator.clipboard && navigator.clipboard.write) {
                        try {
                            await navigator.clipboard.write([
                                new ClipboardItem({ 'image/png': blob })
                            ]);
                            showToast('📋 Đã sao chép ảnh 8K vào Clipboard! Dán trực tiếp vào Messaging App.');
                        } catch (clipErr) {
                            console.warn('Lỗi clipboard API:', clipErr);
                            showToast('⚠️ Không thể ghi clipboard tự động. Vui lòng bấm nút Tải ảnh!');
                        }
                    } else {
                        showToast('⚠️ Trình duyệt chưa hỗ trợ sao chép ảnh tự động. Vui lòng bấm Tải ảnh!');
                    }
                }, 'image/png');
            }
        } catch (err) {
            console.error('Lỗi xuất ảnh:', err);
            showToast('⚠️ Lỗi khi xuất ảnh báo cáo');
        } finally {
            // Khôi phục lại scroll position trên màn hình
            const originalReport = reportRef.current;
            if (originalReport) {
                const activeScrolls = originalReport.querySelectorAll<HTMLElement>('.overflow-x-auto');
                activeScrolls.forEach((c, idx) => {
                    c.scrollLeft = previousScrolls[idx] || 0;
                });
            }
            setIsExporting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50/70 p-2 sm:p-4 md:p-6 font-avo" style={{ fontFamily: "'UTM Avo', 'UTM-Avo', sans-serif" }}>
            {/* TOAST MESSAGE */}
            {toastMessage && (
                <div className="fixed top-4 right-4 z-50 bg-slate-900/95 text-white px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 text-xs font-bold flex items-center gap-2 animate-fade-in backdrop-blur-md">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* HEADER TIÊU ĐỀ */}
            <div className={`mx-auto mb-4 bg-white rounded-2xl border border-slate-200 shadow-2xs p-3 sm:p-4 transition-all ${viewMode === 'WITH_DAILY' ? 'max-w-full md:max-w-6xl xl:max-w-7xl' : 'max-w-[960px]'}`}>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200 shrink-0">
                        <Trophy className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                                XẾP HẠNG DOANH THU LŨY KẾ
                            </h1>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200">
                                Sức Khỏe Nhân Viên
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium">
                            Xếp hạng doanh thu nhân viên theo mốc thời gian từ ngày A đến ngày B • Số tổng là Doanh thu lũy kế của Siêu thị
                        </p>
                    </div>
                </div>
            </div>

            {/* BÁO CÁO TRẠNG THÁI LƯU TRỮ CLOUD & LOCALSTORAGE (MANDATORY RULE) */}
            <div className={`mx-auto mb-3 transition-all ${viewMode === 'WITH_DAILY' ? 'max-w-full md:max-w-6xl xl:max-w-7xl' : 'max-w-[960px]'}`}>
                <CloudDataSyncStatusBanner
                    storageType={summary.isPeriodTargetCloudStored === false ? 'local' : 'cloud'}
                    syncStatus={unsyncedCount > 0 ? 'unsynced' : 'synced'}
                    tableReady={tableReady}
                    tableName="employee_period_targets & daily_business_records"
                    unsyncedCount={unsyncedCount}
                    onSyncNow={handleSyncCloud}
                    sqlDdl={EMPLOYEE_PERIOD_TARGETS_SQL}
                    customMessage={
                        summary.targetSource === 'PERIOD'
                            ? `Đang áp dụng Target giai đoạn "${summary.activePeriodTitle}" (${summary.isPeriodTargetCloudStored ? 'Đã lưu Cloud' : 'Chỉ lưu Local Cache'})`
                            : 'Target nhân sự tính theo cấu hình tháng hoặc phiên làm việc'
                    }
                />
            </div>

            {/* THANH ĐIỀU KHIỂN & BỘ LỌC */}
            <div className={`mx-auto transition-all ${viewMode === 'WITH_DAILY' ? 'max-w-full md:max-w-6xl xl:max-w-7xl' : 'max-w-[960px]'}`}>
                <CumulativeRankingFilterBar
                    fromDate={fromDate}
                    toDate={toDate}
                    onFromDateChange={(val) => {
                        setFromDate(val);
                        setActivePreset('CUSTOM');
                    }}
                    onToDateChange={(val) => {
                        setToDate(val);
                        setActivePreset('CUSTOM');
                    }}
                    activePreset={activePreset}
                    onSelectPreset={handleSelectPreset}
                    selectedStore={selectedStore}
                    onStoreChange={setSelectedStore}
                    storesList={allowedStores}
                    isLockedToSingleStore={isLockedToSingleStore}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    showTarget={showTarget}
                    onShowTargetChange={setShowTarget}
                    targetMode={targetMode}
                    onTargetModeChange={setTargetMode}
                    onOpenPeriodTargetModal={() => setIsPeriodTargetModalOpen(true)}
                    onOpenSessionManager={() => setIsSessionManagerOpen(true)}
                    activePeriodTitle={summary.activePeriodTitle}
                    targetSource={summary.targetSource}
                    isPeriodTargetCloudStored={summary.isPeriodTargetCloudStored}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    loading={loading}
                    canExportExcel={canExportExcel}
                    onRefresh={loadReportData}
                    onExportExcel={handleExportExcel}
                    onExportImage={handleExportImage}
                    isExporting={isExporting}
                />
            </div>

            {/* VÙNG BÁO CÁO XUẤT ẢNH & HIỂN THỊ CHÍNH (PORTRAIT CONTAINER) */}
            <div
                id="cumulative-ranking-export-area"
                ref={reportRef}
                className={`mx-auto space-y-4 transition-all ${viewMode === 'WITH_DAILY' ? 'max-w-full md:max-w-6xl xl:max-w-7xl' : 'max-w-[960px]'}`}
            >
                {/* 1. HEADER NỘI DUNG XUẤT BÁO CÁO (BAO GỒM TIÊU ĐỀ, SIÊU THỊ & GIAI ĐOẠN TÍNH DOANH THU) */}
                <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 font-avo">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 flex items-center justify-center text-white shadow-xs shrink-0">
                                <Trophy className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-base sm:text-lg md:text-xl font-black text-slate-900 tracking-tight leading-tight mt-0.5">
                                    XẾP HẠNG DOANH THU LŨY KẾ
                                </h2>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap pt-0.5">

                            <span className="text-xs sm:text-sm font-black text-indigo-950 bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-200 flex items-center gap-1.5">
                                📅 Giai đoạn: <strong>{formatDate(fromDate)}</strong> → <strong>{formatDate(toDate)}</strong>
                                <span className="text-[11px] font-bold text-indigo-600">({summary.dateList.length} ngày)</span>
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap md:justify-end">
                        <span className="text-xs sm:text-sm font-black text-slate-800 bg-slate-100 px-3 py-1 rounded-xl border border-slate-200">
                            🏪 {selectedStore === 'all' ? 'TOÀN CỤM SIÊU THỊ' : getShortStoreName(selectedStore)}
                        </span>
                        <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black flex items-center gap-1.5">
                            👥 <span>{summary.totalEmployeesWithSales} Nhân Viên</span>
                        </div>
                    </div>
                </div>

                {/* KHỐI KPI TỔNG HỢP */}
                <CumulativeRankingKpiCards
                    summary={summary}
                    showTarget={showTarget}
                />

                {/* BẢNG SỐ LIỆU XẾP HẠNG DOANH THU LŨY KẾ */}
                <CumulativeRankingTable
                    rows={filteredRows}
                    summary={summary}
                    viewMode={viewMode}
                    showTarget={showTarget}
                    isMultiStore={selectedStore === 'all'}
                />
            </div>

            {/* MODAL CẤU HÌNH TARGET GIAI ĐOẠN RIÊNG BIỆT */}
            <PeriodTargetConfigModal
                isOpen={isPeriodTargetModalOpen}
                onClose={() => {
                    setIsPeriodTargetModalOpen(false);
                    checkCloudStatus();
                }}
                fromDate={fromDate}
                toDate={toDate}
                selectedStore={selectedStore}
                employees={employees}
                onSaved={() => {
                    checkCloudStatus();
                    loadReportData();
                }}
            />

            {/* MODAL QUẢN LÝ TẤT CẢ CÁC PHIÊN TARGET GIAI ĐOẠN */}
            <PeriodTargetSessionManagerModal
                isOpen={isSessionManagerOpen}
                onClose={() => {
                    setIsSessionManagerOpen(false);
                    checkCloudStatus();
                }}
                currentStore={selectedStore}
                storesList={allowedStores}
                isLockedToSingleStore={isLockedToSingleStore}
                onSelectSessionToApply={handleApplySession}
                onOpenEditSession={handleEditSession}
                onOpenCreateNew={(targetStore) => {
                    if (targetStore && targetStore !== 'all') {
                        setSelectedStore(targetStore);
                    }
                    setIsSessionManagerOpen(false);
                    setIsPeriodTargetModalOpen(true);
                }}
            />
        </div>
    );
}
