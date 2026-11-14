import React, { useState, useMemo, useRef } from 'react';
import { useAuth } from '../../shared/contexts/AuthContext';
import { useUserStoreFilter } from '../../shared/hooks/useUserStoreFilter';
import { useExcelExportPermission } from '../../shared/hooks/useExcelExportPermission';
import CloudDataSyncStatusBanner from '../../shared/components/report/CloudDataSyncStatusBanner';
import { useQuarterlyRankingData } from './hooks/useQuarterlyRankingData';
import QuarterlyFilterBar from './components/QuarterlyFilterBar';
import QuarterlyKpiCards from './components/QuarterlyKpiCards';
import QuarterlyPodium from './components/QuarterlyPodium';
import QuarterlyRevenueTable from './components/QuarterlyRevenueTable';
import QuarterlyEmulationTable from './components/QuarterlyEmulationTable';
import { exportQuarterlyRankingToExcel } from './utils/quarterlyExcelExport';
import { getCurrentQuarterPreset } from './utils/quarterlyAggregator';
import { EMPLOYEE_DATA_SESSIONS_SQL } from '../employee-cumulative/utils/sessionStorage';
import type { QuarterPreset, QuarterlyTab, FilterCategory, SortField } from './types';
import { getShortStoreName } from '../../core/lib/formatters';
import html2canvas from 'html2canvas';
import { calculate8KScale } from '../../shared/utils/exportImage';
import { Trophy, Award, Calendar } from 'lucide-react';

export default function EmployeeQuarterlyRankingPage() {
    const { currentUser } = useAuth();
    const isAdmin = currentUser?.role === 'ADMIN';
    const isGuest = Boolean(currentUser?.is_guest);
    const reportRef = useRef<HTMLDivElement>(null);

    // 1. STATE BỘ LỌC
    const [selectedStore, setSelectedStore] = useState<string>('all');
    const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
    const [preset, setPreset] = useState<QuarterPreset>(() => getCurrentQuarterPreset(new Date().getMonth() + 1));
    const [customStartMonth, setCustomStartMonth] = useState<number>(1);
    const [customEndMonth, setCustomEndMonth] = useState<number>(3);
    const [tab, setTab] = useState<QuarterlyTab>('REVENUE');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [filterCategory, setFilterCategory] = useState<FilterCategory>('ALL');

    // 2. SẮP XẾP BẢNG
    const [sortField, setSortField] = useState<SortField>('REVENUE_RANK');
    const [sortAsc, setSortAsc] = useState<boolean>(true);

    // Trạng thái xuất ảnh & Toast
    const [isExportingImage, setIsExportingImage] = useState<boolean>(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

    // Kiểm tra quyền xuất Excel (Rule 9)
    const { canExportExcel } = useExcelExportPermission('/xep-hang-quy-nhan-vien');

    // 3. TẢI DỮ LIỆU
    const {
        stores,
        rows,
        summary,
        loading,
        hasTable,
        cloudCount,
        presetInfo,
        refresh
    } = useQuarterlyRankingData({
        selectedStore,
        selectedYear,
        preset,
        customStartMonth,
        customEndMonth,
        isGuest
    });

    // Phân quyền chọn ST
    const { allowedStores, isLockedToSingleStore, canViewAllStores } = useUserStoreFilter(
        stores,
        selectedStore,
        setSelectedStore
    );

    // Khi chuyển tab, tự động cập nhật sortField mặc định
    const handleSelectTab = (newTab: QuarterlyTab) => {
        setTab(newTab);
        if (newTab === 'REVENUE') {
            setSortField('REVENUE_RANK');
            setSortAsc(true);
        } else {
            setSortField('EMULATION_RANK');
            setSortAsc(true);
        }
    };

    // 4. LỌC & SẮP XẾP DỮ LIỆU BẢNG
    const processedRows = useMemo(() => {
        let list = [...rows];

        // Lọc theo tìm kiếm mã NV hoặc tên NV
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter(r =>
                r.employee_id.toLowerCase().includes(q) ||
                r.full_name.toLowerCase().includes(q) ||
                r.short_name.toLowerCase().includes(q)
            );
        }

        // Lọc theo danh mục
        if (filterCategory === 'TOP') {
            list = list.filter(r => tab === 'REVENUE' ? r.top_bot_status === 'TOP' : r.emulation_top_bot_status === 'TOP');
        } else if (filterCategory === 'BOT') {
            list = list.filter(r => tab === 'REVENUE' ? r.top_bot_status === 'BOT' : r.emulation_top_bot_status === 'BOT');
        } else if (filterCategory === 'ACHIEVED') {
            list = list.filter(r => tab === 'REVENUE' ? r.completion_rate >= 100 : r.emulation_rate >= 100);
        } else if (filterCategory === 'UNACHIEVED') {
            list = list.filter(r => tab === 'REVENUE' ? r.completion_rate < 100 : r.emulation_rate < 100);
        }

        // Sắp xếp
        list.sort((a, b) => {
            let res = 0;
            switch (sortField) {
                case 'REVENUE_RANK':
                    res = a.revenue_rank - b.revenue_rank;
                    break;
                case 'EMULATION_RANK':
                    res = a.emulation_rank - b.emulation_rank;
                    break;
                case 'NAME':
                    res = a.short_name.localeCompare(b.short_name, 'vi');
                    break;
                case 'STORE':
                    res = a.store_name.localeCompare(b.store_name, 'vi');
                    break;
                case 'REVENUE_QD':
                    res = b.total_revenue_qd - a.total_revenue_qd;
                    break;
                case 'TARGET':
                    res = tab === 'REVENUE'
                        ? b.total_target_revenue - a.total_target_revenue
                        : b.total_emulation_target - a.total_emulation_target;
                    break;
                case 'COMPLETION_RATE':
                    res = tab === 'REVENUE'
                        ? b.completion_rate - a.completion_rate
                        : b.emulation_rate - a.emulation_rate;
                    break;
                case 'CONSISTENCY':
                    res = tab === 'REVENUE'
                        ? b.months_achieved_count - a.months_achieved_count
                        : b.emulation_months_achieved_count - a.emulation_months_achieved_count;
                    break;
            }
            return sortAsc ? res : -res;
        });

        return list;
    }, [rows, searchQuery, filterCategory, sortField, sortAsc, tab]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortAsc(!sortAsc);
        } else {
            setSortField(field);
            setSortAsc(true);
        }
    };

    // 5. XUẤT ẢNH BÁO CÁO (RULE 2: PORTRAIT MODE, UNLIMITED HEIGHT, NO WATERMARK)
    const handleExportImage = async () => {
        if (!reportRef.current) return;
        setIsExportingImage(true);
        try {
            const el = reportRef.current;
            const originalWidth = el.offsetWidth;
            const targetWidth = Math.min(Math.max(originalWidth, 900), 1080);
            const scale = calculate8KScale(el, targetWidth);

            const canvas = await html2canvas(el, {
                scale,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#f8fafc',
                windowWidth: targetWidth,
                onclone: (clonedDoc: Document) => {
                    clonedDoc.documentElement.style.height = 'auto';
                    clonedDoc.body.style.height = 'auto';
                    const clonedEl = clonedDoc.querySelector('[data-report-container="true"]') as HTMLElement;
                    if (clonedEl) {
                        clonedEl.style.height = 'auto';
                        clonedEl.style.maxHeight = 'none';
                        clonedEl.style.overflow = 'visible';
                        clonedEl.style.width = `${targetWidth}px`;
                    }
                    // Bỏ scroll các container con
                    const scrollables = clonedDoc.querySelectorAll('.overflow-x-auto, .overflow-y-auto');
                    scrollables.forEach(s => {
                        (s as HTMLElement).style.overflow = 'visible';
                        (s as HTMLElement).style.maxHeight = 'none';
                    });
                }
            });

            // Tải ảnh về
            const storeLabel = getShortStoreName(selectedStore);
            const fileName = `Xep_Hang_Quy_NV_${presetInfo.label.replace(/[\/\s()]/g, '_')}_${storeLabel}.png`;
            const link = document.createElement('a');
            link.download = fileName;
            link.href = canvas.toDataURL('image/png', 0.95);
            link.click();
            showToast('✅ Đã xuất ảnh báo cáo thành công!');
        } catch (err) {
            console.error('Lỗi xuất ảnh:', err);
            showToast('⚠️ Không thể xuất ảnh báo cáo');
        } finally {
            setIsExportingImage(false);
        }
    };

    // 6. XUẤT FILE EXCEL (RULE 9)
    const handleExportExcel = async () => {
        if (!canExportExcel) return;
        try {
            await exportQuarterlyRankingToExcel({
                rows: processedRows,
                summary,
                months: presetInfo.months,
                presetLabel: presetInfo.label,
                storeName: selectedStore
            });
            showToast('✅ Đã xuất file Excel thành công!');
        } catch (err) {
            console.error('Lỗi xuất Excel:', err);
            showToast('⚠️ Không thể xuất file Excel');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50/60 pb-16 pt-3 px-2 sm:px-4 md:px-6 space-y-4 max-w-7xl mx-auto">
            {/* TOAST THÔNG BÁO */}
            {toastMessage && (
                <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold flex items-center gap-2 animate-bounce">
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* BANNER ĐỒNG BỘ CLOUD (RULE 8: DATA-HTML2CANVAS-IGNORE="TRUE") */}
            <CloudDataSyncStatusBanner
                storageType="cloud"
                syncStatus="synced"
                tableReady={hasTable}
                tableName="employee_data_sessions"
                unsyncedCount={0}
                onSyncNow={refresh}
                sqlDdl={EMPLOYEE_DATA_SESSIONS_SQL}
                customMessage="Dữ liệu phiên xếp hạng nhân viên được lưu trữ và truy vấn trực tiếp từ Supabase Cloud"
            />

            {/* BỘ LỌC ĐA NĂNG */}
            <QuarterlyFilterBar
                stores={stores}
                selectedStore={selectedStore}
                onSelectStore={setSelectedStore}
                isLockedToSingleStore={isLockedToSingleStore}
                allowedStores={allowedStores}
                canViewAllStores={canViewAllStores}
                selectedYear={selectedYear}
                onSelectYear={setSelectedYear}
                preset={preset}
                onSelectPreset={setPreset}
                presetLabel={presetInfo.label}
                customStartMonth={customStartMonth}
                onChangeCustomStart={setCustomStartMonth}
                customEndMonth={customEndMonth}
                onChangeCustomEnd={setCustomEndMonth}
                tab={tab}
                onSelectTab={handleSelectTab}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                filterCategory={filterCategory}
                onSelectFilterCategory={setFilterCategory}
                onRefresh={refresh}
                onExportImage={handleExportImage}
                onExportExcel={handleExportExcel}
                canExportExcel={canExportExcel}
                isExportingImage={isExportingImage}
                loading={loading}
            />

            {/* KHUNG BÁO CÁO XUẤT ẢNH & HIỂN THỊ */}
            <div
                ref={reportRef}
                data-report-container="true"
                className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-3.5 sm:p-5 space-y-4 font-sans"
            >
                {/* HEADER BÁO CÁO (ĐƯỢC CHỤP KHI XUẤT ẢNH) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="p-1.5 rounded-lg bg-amber-100 text-amber-800">
                                {tab === 'REVENUE' ? <Award className="w-5 h-5" /> : <Trophy className="w-5 h-5" />}
                            </span>
                            <div>
                                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                                    XẾP HẠNG {tab === 'REVENUE' ? 'DOANH THU' : 'THI ĐUA'} NHÂN SỰ {presetInfo.label.toUpperCase()}
                                </h1>
                                <p className="text-[11.5px] font-bold text-slate-500">
                                    Phạm vi: <span className="text-blue-700 font-extrabold">{getShortStoreName(selectedStore)}</span> • Kỳ: <span className="text-slate-800 font-extrabold">{presetInfo.label}</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="text-left sm:text-right text-[11px] font-bold text-slate-500">
                        <div>Tổng nhân sự: <strong className="text-slate-900 font-mono">{summary?.totalEmployees || 0}</strong> NV</div>
                        <div>Cập nhật: <span className="text-slate-700">{new Date().toLocaleDateString('vi-VN')}</span></div>
                    </div>
                </div>

                {/* KPI CARDS (NO PRODUCTIVITY METRICS) */}
                <QuarterlyKpiCards
                    summary={summary}
                    tab={tab}
                    dateLabel={presetInfo.label}
                />

                {/* VINH DANH TOP 3 PODIUM */}
                {!loading && rows.length >= 3 && (
                    <QuarterlyPodium
                        rows={processedRows}
                        tab={tab}
                    />
                )}

                {/* BẢNG DỮ LIỆU */}
                {loading ? (
                    <div className="py-12 text-center text-slate-500">
                        <div className="inline-block w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
                        <p className="text-xs font-bold">Đang tải và tổng hợp dữ liệu Quý...</p>
                    </div>
                ) : tab === 'REVENUE' ? (
                    <QuarterlyRevenueTable
                        rows={processedRows}
                        months={presetInfo.months}
                        sortField={sortField}
                        sortAsc={sortAsc}
                        onSort={handleSort}
                        showStoreColumn={selectedStore === 'all'}
                    />
                ) : (
                    <QuarterlyEmulationTable
                        rows={processedRows}
                        months={presetInfo.months}
                        sortField={sortField}
                        sortAsc={sortAsc}
                        onSort={handleSort}
                        showStoreColumn={selectedStore === 'all'}
                    />
                )}
            </div>
        </div>
    );
}
