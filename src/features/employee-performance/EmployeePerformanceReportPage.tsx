import { useState, useEffect, useMemo, useRef } from 'react';
import {
    fetchStores,
    fetchEmployees,
    fetchEmployeeRevenueTargets,
    type StoreItem,
    type EmployeeItem
} from '../../core/lib/storage';
import {
    syncAndFetchEmployeeDataSessions
} from '../employee-cumulative/utils/sessionStorage';
import type { EmployeePerformanceRow, StorePerformanceSummary } from './types';
import PerformanceKpiCards from './components/PerformanceKpiCards';
import PerformanceTable from './components/PerformanceTable';
import PerformanceConfigModal from './components/PerformanceConfigModal';
import {
    getStoreOperatingConfig,
    getTopBotConfig,
    applyTopBotEvaluation,
    getShortenedEmployeeName,
    syncPerformanceConfigsFromCloud,
    type TopBotConfig
} from './utils/performanceConfig';
import {
    Trophy,
    Calendar,
    Store,
    Search,
    Download,
    Camera,
    Copy,
    RefreshCw,
    Filter,
    ArrowUpRight,
    ArrowUpDown,
    Target,
    Clock,
    Settings,
    CheckCircle2,
    Lock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useUserStoreFilter } from '../../shared/hooks/useUserStoreFilter';
import ExcelJS from 'exceljs';
import html2canvas from 'html2canvas';

export default function EmployeePerformanceReportPage() {
    const navigate = useNavigate();
    const reportRef = useRef<HTMLDivElement>(null);

    const [stores, setStores] = useState<StoreItem[]>([]);
    const [selectedStore, setSelectedStore] = useState<string>('all');

    // Phân quyền siêu thị theo tài khoản người dùng
    const { allowedStores, isLockedToSingleStore, canViewAllStores } = useUserStoreFilter(
        stores,
        selectedStore,
        setSelectedStore
    );

    const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [topBotFilter, setTopBotFilter] = useState<string>('all');
    const [paceFilter, setPaceFilter] = useState<string>('all');

    // Mặc định sắp xếp theo % Dự kiến hoàn thành (%DKHT)
    const [sortBy, setSortBy] = useState<string>('FORECAST_RATE_DESC');

    const [employees, setEmployees] = useState<EmployeeItem[]>([]);
    const [revenueTargets, setRevenueTargets] = useState<Record<string, number>>({});
    const [revenueDataMap, setRevenueDataMap] = useState<Record<string, any>>({});
    const [workHoursMap, setWorkHoursMap] = useState<Record<string, number>>({});

    const [loading, setLoading] = useState<boolean>(true);
    const [isExporting, setIsExporting] = useState<boolean>(false);
    const [exportResolution, setExportResolution] = useState<'4K' | '8K'>('8K');
    const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);
    const [toastMessage, setToastMessage] = useState<string>('');

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 3500);
    };

    // Cấu hình hoạt động shop & TOP/BOT theo đích danh siêu thị
    const [operatingConfig, setOperatingConfig] = useState(() =>
        getStoreOperatingConfig(selectedStore === 'all' ? 'ALL' : selectedStore, selectedMonth, selectedYear)
    );
    const [topBotConfig, setTopBotConfig] = useState<TopBotConfig>(() =>
        getTopBotConfig(selectedStore === 'all' ? 'ALL' : selectedStore)
    );

    // Cập nhật cấu hình khi đổi store/tháng/năm
    const refreshConfigs = () => {
        const targetStore = selectedStore === 'all' ? 'ALL' : selectedStore;
        const op = getStoreOperatingConfig(
            targetStore,
            selectedMonth,
            selectedYear
        );
        setOperatingConfig(op);
        setTopBotConfig(getTopBotConfig(targetStore));
    };

    useEffect(() => {
        refreshConfigs();
    }, [selectedStore, selectedMonth, selectedYear]);

    // 1. TẢI DỮ LIỆU CỐT LÕI
    const loadAllData = async () => {
        setLoading(true);

        // Tự động đồng bộ cấu hình hoạt động & TOP/BOT từ Cloud Supabase nếu có
        syncPerformanceConfigsFromCloud()
            .then(() => refreshConfigs())
            .catch(() => { });

        const [storesRes, empsRes, targetsRes] = await Promise.all([
            fetchStores(),
            fetchEmployees(selectedStore === 'all' ? undefined : selectedStore),
            fetchEmployeeRevenueTargets(selectedMonth, selectedYear)
        ]);

        if (storesRes.success) setStores(storesRes.data);
        if (empsRes.success) setEmployees(empsRes.data);

        // Chuyển đổi dữ liệu target sang Map theo Mã NV (chuẩn hóa về đơn vị triệu)
        const targetMap: Record<string, number> = {};
        if (targetsRes.success && targetsRes.data) {
            if (Array.isArray(targetsRes.data)) {
                targetsRes.data.forEach((r: any) => {
                    if (r && r.employee_id != null) {
                        const rawTarget = Number(r.target_revenue) || 0;
                        const key = String(r.employee_id).trim();
                        targetMap[key] = rawTarget >= 100_000 ? Math.round(rawTarget / 1_000_000) : rawTarget;
                    }
                });
            } else if (typeof targetsRes.data === 'object') {
                Object.entries(targetsRes.data).forEach(([k, v]) => {
                    const rawTarget = Number(v) || 0;
                    targetMap[k.trim()] = rawTarget >= 100_000 ? Math.round(rawTarget / 1_000_000) : rawTarget;
                });
            }
        }
        setRevenueTargets(targetMap);

        // Lấy số liệu từ phiên cập nhật gần nhất hoặc draft
        const revMap: Record<string, any> = {};
        const hoursMap: Record<string, number> = {};

        // Quét qua các phiên lưu trữ (tự động đồng bộ với Cloud Supabase)
        const allSessions = await syncAndFetchEmployeeDataSessions({ month: selectedMonth, year: selectedYear });
        allSessions.forEach(sess => {
            if (sess.session_type === 'REVENUE_CAMPAIGN') {
                if (selectedStore === 'all' || sess.store_name === selectedStore) {
                    sess.records.forEach(r => {
                        const key = (r.employee_id || '').trim();
                        if (!revMap[key]) revMap[key] = r;
                    });
                }
            } else if (sess.session_type === 'WORK_HOURS') {
                sess.records.forEach(r => {
                    const key = (r.employee_id || '').trim();
                    if (r.work_hours && !hoursMap[key]) hoursMap[key] = r.work_hours;
                });
            }
        });

        // Fallback quét qua các draft trong LocalStorage
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(`saleshub_emp_cum_draft_${selectedMonth}_${selectedYear}_`)) {
                    if (selectedStore === 'all' || key.endsWith(`_${selectedStore}`)) {
                        const raw = localStorage.getItem(key);
                        if (raw) {
                            const parsed = JSON.parse(raw);
                            if (parsed.revenueData) {
                                parsed.revenueData.forEach((r: any) => {
                                    const k = (r.employee_id || '').trim();
                                    if (!revMap[k]) revMap[k] = r;
                                });
                            }
                            if (parsed.workHoursMap) {
                                Object.entries(parsed.workHoursMap).forEach(([empId, h]) => {
                                    const k = empId.trim();
                                    if (!hoursMap[k]) hoursMap[k] = Number(h);
                                });
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.warn(e);
        }

        setRevenueDataMap(revMap);
        setWorkHoursMap(hoursMap);
        setLoading(false);
    };

    useEffect(() => {
        loadAllData();
    }, [selectedStore, selectedMonth, selectedYear]);

    // 2. HỢP NHẤT DỮ LIỆU HIỆU QUẢ THEO TỪNG NHÂN VIÊN VỚI RÚT GỌN TÊN CHUẨN
    const performanceRows = useMemo<EmployeePerformanceRow[]>(() => {
        if (!employees || employees.length === 0) return [];

        const passed = Math.max(1, operatingConfig.passedDays);
        const totalDays = Math.max(1, operatingConfig.operatingDays);

        const rawList = employees.map(emp => {
            const empId = (emp.employee_id || '').trim();
            const rev = revenueDataMap[empId] || revenueDataMap[emp.employee_id];
            const target = revenueTargets[empId] ?? revenueTargets[emp.employee_id] ?? 0;
            const hours = workHoursMap[empId] ?? workHoursMap[emp.employee_id] ?? 0;

            const revActual = rev ? rev.revenue_actual : 0;
            const revQd = rev ? rev.revenue_qd : 0;

            // 1. %HT (real) = (Lũy kế DTQĐ / Target DTQĐ) * 100
            const completionRate = target > 0 ? Number(((revQd / target) * 100).toFixed(1)) : 0;

            // 2. %DKHT (Dự báo) = ((Lũy kế DTQĐ / passedDays * totalDays) / Target DTQĐ) * 100
            const revForecast = passed > 0 ? (revQd / passed) * totalDays : revQd;
            const forecastRate = target > 0 ? Number(((revForecast / target) * 100).toFixed(1)) : 0;

            // 3. %Quy đổi = ((DTQĐ - DT thực) / DT thực) * 100
            const exchangeRate = revActual > 0
                ? Number((((revQd - revActual) / revActual) * 100).toFixed(1))
                : 0;

            // 4. Giờ công
            // 5. DTQĐ/GC = Lũy kế DTQĐ / Giờ công (triệu / giờ)
            const prodQd = hours > 0 ? Number((revQd / hours).toFixed(2)) : 0;
            const prodActual = hours > 0 ? Number((revActual / hours).toFixed(2)) : 0;

            // 6. % Trả chậm = (DT Trả chậm / DT thực) * 100
            const instRev = rev ? rev.installment_revenue : 0;
            const instRate = revActual > 0 && instRev > 0
                ? Number(((instRev / revActual) * 100).toFixed(1))
                : (rev ? rev.installment_rate : 0);

            let paceStatus: EmployeePerformanceRow['pace_status'] = 'ON_TRACK';
            if (completionRate >= 100) paceStatus = 'EXCEED';
            else if (completionRate >= 80) paceStatus = 'ON_TRACK';
            else if (completionRate >= 50) paceStatus = 'SLOW';
            else paceStatus = 'CRITICAL';

            // Rút gọn tên nhân viên: 2 chữ cuối, nếu chữ kế cuối là "Thị" thì chỉ lấy tên
            const shortName = getShortenedEmployeeName(emp.full_name);

            return {
                employee_id: emp.employee_id,
                full_name: emp.full_name,
                short_name: shortName,
                store_name: emp.store_name,
                job_title: emp.job_title || emp.role || 'Tư vấn bán hàng',
                revenue_target: target,
                revenue_actual: revActual,
                revenue_qd: revQd,
                completion_rate: completionRate,
                forecast_completion_rate: forecastRate,
                exchange_rate: exchangeRate,
                work_hours: hours,
                productivity_qd_per_hour: prodQd,
                productivity_actual_per_hour: prodActual,
                installment_revenue: instRev,
                installment_rate: instRate,
                order_quantity: rev ? rev.quantity : 0,
                pace_status: paceStatus
            };
        });

        // Áp dụng đánh giá TOP / BOT & gán thứ hạng Rank chuẩn xác theo đích danh siêu thị
        if (selectedStore !== 'all') {
            const targetCfg = getTopBotConfig(selectedStore);
            return applyTopBotEvaluation(rawList, targetCfg);
        } else {
            // Khi xem Toàn bộ cụm: phân loại TOP/BOT theo cấu hình đích danh của từng siêu thị
            const storeGroups: Record<string, typeof rawList> = {};
            rawList.forEach(item => {
                const sName = item.store_name || 'Khác';
                if (!storeGroups[sName]) storeGroups[sName] = [];
                storeGroups[sName].push(item);
            });

            const evaluatedList: EmployeePerformanceRow[] = [];
            Object.entries(storeGroups).forEach(([sName, items]) => {
                const storeCfg = getTopBotConfig(sName);
                const evaluatedItems = applyTopBotEvaluation(items, storeCfg);
                evaluatedList.push(...evaluatedItems);
            });

            return evaluatedList.sort((a, b) => {
                if (topBotConfig.rankBy === 'FORECAST_COMPLETION_RATE') {
                    return b.forecast_completion_rate - a.forecast_completion_rate;
                }
                if (topBotConfig.rankBy === 'REVENUE_ACTUAL') {
                    return b.revenue_actual - a.revenue_actual;
                }
                if (topBotConfig.rankBy === 'COMPLETION_RATE') {
                    return b.completion_rate - a.completion_rate;
                }
                if (topBotConfig.rankBy === 'REVENUE_QD') {
                    return b.revenue_qd - a.revenue_qd;
                }
                return b.forecast_completion_rate - a.forecast_completion_rate;
            });
        }
    }, [employees, revenueDataMap, revenueTargets, workHoursMap, operatingConfig, topBotConfig, selectedStore]);

    // 3. TÍNH TỔNG KẾT BÁO CÁO (CHỈ TẬP TRUNG VINH DANH CHỈ SỐ CÁ NHÂN)
    const summary = useMemo<StorePerformanceSummary>(() => {
        let topCount = 0;
        let botCount = 0;
        let midCount = 0;

        performanceRows.forEach(r => {
            if (r.top_bot_status === 'TOP') topCount++;
            else if (r.top_bot_status === 'BOT') botCount++;
            else midCount++;
        });

        // 1. Top 1 Doanh thu quy đổi (DTQĐ)
        const sortedByRevQd = [...performanceRows].sort((a, b) => b.revenue_qd - a.revenue_qd);
        const topRev = sortedByRevQd.length > 0 && sortedByRevQd[0].revenue_qd > 0 ? sortedByRevQd[0] : null;

        // 2. Top 1 Năng suất lao động DTQĐ/GC
        const sortedByProd = [...performanceRows].sort(
            (a, b) => b.productivity_qd_per_hour - a.productivity_qd_per_hour
        );
        const topProd = sortedByProd.length > 0 && sortedByProd[0].productivity_qd_per_hour > 0 ? sortedByProd[0] : null;

        // 3. Top 1 Dự báo về đích %DKHT
        const sortedByForecast = [...performanceRows].sort(
            (a, b) => b.forecast_completion_rate - a.forecast_completion_rate
        );
        const topForecast = sortedByForecast.length > 0 && sortedByForecast[0].forecast_completion_rate > 0 ? sortedByForecast[0] : null;

        // 4. Top 1 Doanh thu trả chậm
        const sortedByInstallment = [...performanceRows].sort(
            (a, b) => b.installment_revenue - a.installment_revenue
        );
        const topInstallment = sortedByInstallment.length > 0 && sortedByInstallment[0].installment_revenue > 0 ? sortedByInstallment[0] : null;

        return {
            topRevenueEmp: topRev,
            topProductivityEmp: topProd,
            topForecastEmp: topForecast,
            topInstallmentEmp: topInstallment,
            topCount,
            botCount,
            midCount,
            totalEmployees: performanceRows.length
        };
    }, [performanceRows]);

    // 4. SẮP XẾP & LỌC TÌM KIẾM
    const filteredRows = useMemo(() => {
        // 1. Sắp xếp danh sách (Mặc định: %DKHT Cao -> Thấp)
        const sorted = [...performanceRows].sort((a, b) => {
            switch (sortBy) {
                case 'FORECAST_RATE_DESC':
                    return b.forecast_completion_rate - a.forecast_completion_rate;
                case 'FORECAST_RATE_ASC':
                    return a.forecast_completion_rate - b.forecast_completion_rate;
                case 'REVENUE_QD_DESC':
                    return b.revenue_qd - a.revenue_qd;
                case 'REVENUE_ACTUAL_DESC':
                    return b.revenue_actual - a.revenue_actual;
                case 'COMPLETION_RATE_DESC':
                    return b.completion_rate - a.completion_rate;
                case 'PROD_QD_DESC':
                    return b.productivity_qd_per_hour - a.productivity_qd_per_hour;
                case 'WORK_HOURS_DESC':
                    return b.work_hours - a.work_hours;
                case 'INSTALLMENT_RATE_DESC':
                    return b.installment_rate - a.installment_rate;
                case 'RANK_ASC':
                default:
                    return a.rank - b.rank;
            }
        });

        // 2. Lọc theo từ khóa, TOP/BOT, Nhịp độ
        return sorted.filter(r => {
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchName = r.full_name.toLowerCase().includes(q) || r.short_name.toLowerCase().includes(q);
                const matchId = r.employee_id.toLowerCase().includes(q);
                if (!matchName && !matchId) return false;
            }
            if (topBotFilter !== 'all' && r.top_bot_status !== topBotFilter) {
                return false;
            }
            if (paceFilter !== 'all' && r.pace_status !== paceFilter) {
                return false;
            }
            return true;
        });
    }, [performanceRows, sortBy, searchQuery, topBotFilter, paceFilter]);

    // 5. XUẤT BÁO CÁO EXCEL ĐỦ 12 CỘT CHUẨN
    const handleExportExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Hiệu Quả Nhân Viên');

        worksheet.columns = [
            { header: 'Hạng', key: 'rank', width: 8 },
            { header: 'Mã NV', key: 'emp_id', width: 14 },
            { header: 'Họ và Tên', key: 'name', width: 25 },
            { header: 'Tên Rút Gọn', key: 'short_name', width: 18 },
            { header: 'Siêu Thị', key: 'store', width: 28 },
            { header: 'Chức Danh', key: 'role', width: 18 },
            { header: 'DT Thực (tr)', key: 'actual', width: 16 },
            { header: 'DTQĐ (tr)', key: 'rev_qd', width: 16 },
            { header: 'Target (tr)', key: 'target', width: 16 },
            { header: '%HT Real', key: 'pct_real', width: 14 },
            { header: '%DKHT', key: 'pct_forecast', width: 14 },
            { header: '%QĐ', key: 'exchange', width: 14 },
            { header: 'Giờ Công (h)', key: 'hours', width: 14 },
            { header: 'DTQĐ / GC (tr/h)', key: 'prod_qd', width: 16 },
            { header: 'DT Trả Chậm (tr)', key: 'dt_tg', width: 16 },
            { header: '% Trả Chậm', key: 'pct_tg', width: 14 },
            { header: 'Đánh Giá', key: 'top_bot', width: 18 }
        ];

        filteredRows.forEach(r => {
            worksheet.addRow({
                rank: r.rank,
                emp_id: r.employee_id,
                name: r.full_name,
                short_name: r.short_name,
                store: r.store_name,
                role: r.job_title,
                actual: r.revenue_actual,
                rev_qd: r.revenue_qd,
                target: r.revenue_target,
                pct_real: `${r.completion_rate}%`,
                pct_forecast: `${r.forecast_completion_rate}%`,
                exchange: `${r.exchange_rate > 0 ? '+' : ''}${r.exchange_rate}%`,
                hours: r.work_hours,
                prod_qd: r.productivity_qd_per_hour,
                dt_tg: r.installment_revenue,
                pct_tg: `${r.installment_rate}%`,
                top_bot: r.top_bot_label
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `BaoCao_HieuQua_NV_${selectedMonth}_${selectedYear}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // 6. XUẤT ẢNH 4K / 8K (LƯU FILE HOẶC COPY VÀO CLIPBOARD)
    const generateCanvas = async (resolution: '4K' | '8K' = exportResolution): Promise<HTMLCanvasElement | null> => {
        if (!reportRef.current) return null;
        if (document.fonts?.ready) {
            await document.fonts.ready;
        }

        const targetElement = reportRef.current;
        const tableElement = targetElement.querySelector('table');

        // Đo đạc chiều rộng thực tế của bảng để không bao giờ bị cắt cột ở bên phải
        // Bảng 12 cột cần ít nhất 1460px; cộng thêm padding 48px -> tối thiểu 1520px
        const tableScrollWidth = tableElement ? tableElement.scrollWidth : 0;
        const contentWidth = Math.max(tableScrollWidth + 64, targetElement.scrollWidth + 64, 1520);
        const elementHeight = targetElement.scrollHeight || 1000;

        // Tính toán tỷ lệ scale chuẩn xác: 8K (~7680px) hoặc 4K (~3840px)
        const targetPixelWidth = resolution === '8K' ? 7680 : 3840;
        let scale = targetPixelWidth / contentWidth;
        const minScale = resolution === '8K' ? 4.5 : 2.4;
        const maxScale = resolution === '8K' ? 5.5 : 2.8;
        scale = Math.min(Math.max(scale, minScale), maxScale);

        // Giới hạn an toàn chiều cao để không vượt quá canvas buffer trình duyệt (14,000px)
        if (elementHeight * scale > 14000) {
            scale = 14000 / elementHeight;
        }

        return await html2canvas(targetElement, {
            scale: scale,
            backgroundColor: '#ffffff',
            useCORS: true,
            logging: false,
            allowTaint: true,
            width: contentWidth,
            windowWidth: contentWidth + 100,
            onclone: (clonedDoc) => {
                // Nạp trực tiếp định nghĩa font chữ UTM Avo vào iframe clone và cấu hình chống cắt chữ
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
                    @font-face {
                        font-family: 'UTM-Avo';
                        src: url('/fonts/UTM-Avo.ttf') format('truetype');
                        font-weight: 400;
                        font-style: normal;
                    }
                    @font-face {
                        font-family: 'UTM-Avo';
                        src: url('/fonts/UTM-AvoBold.ttf') format('truetype');
                        font-weight: 700;
                        font-style: normal;
                    }
                    * {
                        -webkit-font-smoothing: antialiased;
                        -moz-osx-font-smoothing: grayscale;
                    }
                    /* Fix lỗi html2canvas tính sai baseline do Tailwind Preflight ép img { display: block } */
                    img {
                        display: inline-block !important;
                    }
                    /* Đảm bảo toàn bộ ô bảng căn giữa chuẩn */
                    .report-table td, .report-table th {
                        vertical-align: middle !important;
                    }
                    /* Đảm bảo tuyệt đối không phần tử nào bị cắt mất 50% chữ tiếng Việt */
                    [data-report-table="true"] * {
                        overflow: visible !important;
                    }
                    /* Giữ bo góc cho các huy hiệu tròn/pill */
                    [data-report-table="true"] .rounded-full {
                        overflow: hidden !important;
                    }
                `;
                clonedDoc.head.appendChild(fontStyle);

                const clonedReport = clonedDoc.querySelector('[data-report-table="true"]') as HTMLElement;
                if (!clonedReport) return;

                // Cố định chiều rộng đầy đủ cho container và tài liệu
                clonedDoc.documentElement.style.width = `${contentWidth}px`;
                clonedDoc.body.style.width = `${contentWidth}px`;
                clonedDoc.body.style.overflow = 'visible';

                clonedReport.style.width = `${contentWidth}px`;
                clonedReport.style.minWidth = `${contentWidth}px`;
                clonedReport.style.maxWidth = `${contentWidth}px`;
                clonedReport.style.boxSizing = 'border-box';
                clonedReport.style.fontFamily = "'UTM Avo', 'Avo', sans-serif";
                clonedReport.style.letterSpacing = 'normal';
                clonedReport.style.padding = '24px';
                clonedReport.style.backgroundColor = '#ffffff';

                // Mở rộng tất cả container cuộn để xuất đủ 100% dòng không bị cắt mép
                const scrollContainers = clonedReport.querySelectorAll('.overflow-x-auto, .overflow-y-auto, [class*="max-h-"]');
                scrollContainers.forEach((el) => {
                    const htmlEl = el as HTMLElement;
                    htmlEl.style.maxHeight = 'none';
                    htmlEl.style.overflow = 'visible';
                    htmlEl.style.overflowX = 'visible';
                    htmlEl.style.overflowY = 'visible';
                    htmlEl.style.width = '100%';
                });

                // Căn chỉnh bảng dữ liệu hiển thị toàn bộ 12 cột
                const clonedTable = clonedReport.querySelector('table') as HTMLElement;
                if (clonedTable) {
                    clonedTable.style.width = '100%';
                    clonedTable.style.minWidth = `${contentWidth - 48}px`;
                    clonedTable.style.tableLayout = 'auto';
                }

                // Chuyển thead và th từ sticky sang static để không lệch dòng tiêu đề
                const stickyHeaders = clonedReport.querySelectorAll('thead, th');
                stickyHeaders.forEach((el) => {
                    const htmlEl = el as HTMLElement;
                    htmlEl.style.position = 'static';
                    htmlEl.style.letterSpacing = 'normal';
                });

                // Thêm Header Banner Doanh Nghiệp Sang Trọng ở đầu ảnh xuất
                const banner = clonedDoc.createElement('div');
                banner.style.marginBottom = '20px';
                banner.style.padding = '22px 28px';
                banner.style.background = 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)';
                banner.style.borderRadius = '18px';
                banner.style.color = '#ffffff';
                banner.style.display = 'flex';
                banner.style.alignItems = 'center';
                banner.style.justifyContent = 'space-between';
                banner.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.18)';

                const storeLabel = selectedStore === 'all' ? 'Toàn Cụm Siêu Thị' : selectedStore;
                const currentTimeStr = new Date().toLocaleString('vi-VN', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                banner.innerHTML = `
                    <div>
                        <div style="font-size: 22px; font-weight: 900; letter-spacing: -0.02em; color: #f8fafc; font-family: 'UTM Avo', sans-serif;">
                            BÁO CÁO HIỆU QUẢ LŨY KẾ DOANH THU NHÂN VIÊN
                        </div>
                        <div style="font-size: 13px; color: #94a3b8; margin-top: 6px; font-family: 'UTM Avo', sans-serif;">
                            Đơn vị: <strong style="color: #f59e0b;">${storeLabel}</strong> • Tháng ${selectedMonth}/${selectedYear} • Xuất lúc: ${currentTimeStr}
                        </div>
                    </div>

                `;

                clonedReport.insertBefore(banner, clonedReport.firstChild);
            }
        });
    };

    const handleDownloadImage = async () => {
        setIsExporting(true);
        try {
            const canvas = await generateCanvas(exportResolution);
            if (!canvas) {
                showToast('⚠️ Không thể khởi tạo canvas để xuất ảnh!');
                return;
            }
            const imgData = canvas.toDataURL('image/png', 1.0);
            const a = document.createElement('a');
            a.href = imgData;
            a.download = `BaoCao_HieuQua_NV_${selectedMonth}_${selectedYear}_${exportResolution}.png`;
            a.click();
            showToast(`🎉 Đã tải file ảnh báo cáo độ phân giải ${exportResolution} siêu nét thành công!`);
        } catch (e: any) {
            console.error(`Lỗi tải ảnh ${exportResolution}:`, e);
            showToast('⚠️ Không thể tải ảnh: ' + (e.message || e));
        } finally {
            setIsExporting(false);
        }
    };

    const handleCopyImageToClipboard = async () => {
        setIsExporting(true);
        try {
            const canvas = await generateCanvas(exportResolution);
            if (!canvas) {
                showToast('⚠️ Không thể khởi tạo canvas!');
                return;
            }

            canvas.toBlob(async blob => {
                if (blob && navigator.clipboard && window.ClipboardItem) {
                    try {
                        await navigator.clipboard.write([
                            new ClipboardItem({ 'image/png': blob })
                        ]);
                        showToast(`📋 Đã sao chép ảnh ${exportResolution} vào Clipboard! Boss hãy nhấn Ctrl + V để dán ngay vào Zalo/Telegram.`);
                    } catch (err: any) {
                        console.warn('Lỗi ghi clipboard trực tiếp, tự động chuyển sang tải file:', err);
                        const imgData = canvas.toDataURL('image/png', 1.0);
                        const a = document.createElement('a');
                        a.href = imgData;
                        a.download = `BaoCao_HieuQua_NV_${selectedMonth}_${selectedYear}_${exportResolution}.png`;
                        a.click();
                        showToast(`💾 Ảnh ${exportResolution} dung lượng cao đã tự động được tải về máy của bạn!`);
                    }
                } else {
                    handleDownloadImage();
                }
                setIsExporting(false);
            }, 'image/png', 1.0);
        } catch (e: any) {
            console.error('Lỗi sao chép ảnh:', e);
            setIsExporting(false);
            showToast('⚠️ Không thể copy ảnh: ' + (e.message || e));
        }
    };

    return (
        <div className="max-w-[1680px] mx-auto space-y-4 pb-12">
            {/* Toast Thông Báo */}
            {toastMessage && (
                <div className="fixed top-5 right-5 z-50 p-4 bg-slate-900 text-white rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs border border-slate-700 animate-in fade-in slide-in-from-top-2 duration-200">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span className="font-semibold">{toastMessage}</span>
                </div>
            )}

            {/* Header Phân Hệ */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-amber-100 text-amber-700 shadow-2xs">
                            <Trophy className="w-5 h-5" />
                        </span>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                            Hiệu Quả Doanh Thu Nhân Viên
                        </h1>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                        Xếp hạng nhân viên, vinh danh cá nhân xuất sắc và đánh giá tiến độ hoàn thành mục tiêu.
                    </p>
                </div>

                <div className="flex items-center gap-2 self-stretch sm:self-auto flex-wrap">
                    {/* Nút Cấu Hình Shop & TOP/BOT */}
                    <button
                        type="button"
                        onClick={() => setIsConfigModalOpen(true)}
                        className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                        title="Cấu hình giờ mở cửa, số ngày hoạt động và tiêu chuẩn TOP/BOT"
                    >
                        <Settings className="w-4 h-4 text-amber-400" />
                        <span>Cấu Hình Shop & TOP/BOT</span>
                    </button>

                    {/* Nút Khai Báo Target */}
                    <button
                        type="button"
                        onClick={() => navigate('/muc-tieu-nhan-vien')}
                        className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                        title="Đi đến trang Khai Báo & Quản Lý Mục Tiêu Nhân Viên"
                    >
                        <Target className="w-4 h-4" />
                        <span>Khai Báo Target</span>
                    </button>

                    {/* Toggle Chọn Độ Phân Giải 4K / 8K */}
                    <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 shadow-2xs">
                        <button
                            type="button"
                            onClick={() => setExportResolution('4K')}
                            className={`px-2.5 py-1.5 text-xs font-black rounded-lg transition cursor-pointer ${exportResolution === '4K'
                                ? 'bg-white text-blue-700 shadow-2xs'
                                : 'text-slate-500 hover:text-slate-800'
                                }`}
                            title="Chọn độ phân giải 4K (khoảng 3840px)"
                        >
                            4K UHD
                        </button>
                        <button
                            type="button"
                            onClick={() => setExportResolution('8K')}
                            className={`px-2.5 py-1.5 text-xs font-black rounded-lg transition cursor-pointer flex items-center gap-1 ${exportResolution === '8K'
                                ? 'bg-slate-900 text-amber-300 shadow-2xs'
                                : 'text-slate-500 hover:text-slate-800'
                                }`}
                            title="Chọn độ phân giải 8K Ultra-HD (khoảng 7680px siêu nét)"
                        >
                            <span>8K</span>
                            <span className="text-[9px] px-1 py-0.2 rounded bg-amber-400 text-slate-950 font-black">MAX</span>
                        </button>
                    </div>

                    {/* Nút Copy Ảnh vào Clipboard */}
                    <button
                        type="button"
                        onClick={handleCopyImageToClipboard}
                        disabled={isExporting}
                        className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-blue-200 shadow-2xs"
                        title={`Copy ảnh độ phân giải ${exportResolution} vào bộ nhớ tạm để dán (Ctrl+V) vào Zalo`}
                    >
                        <Copy className="w-4 h-4 text-blue-600" />
                        <span>{isExporting ? `Đang xuất ${exportResolution}...` : `Copy Ảnh ${exportResolution}`}</span>
                    </button>

                    {/* Nút Lưu File Ảnh */}
                    <button
                        type="button"
                        onClick={handleDownloadImage}
                        disabled={isExporting}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-slate-200"
                        title={`Tải file ảnh chất lượng cao ${exportResolution} về máy`}
                    >
                        <Camera className="w-4 h-4 text-slate-600" />
                        <span>Tải Ảnh {exportResolution}</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleExportExcel}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                    >
                        <Download className="w-4 h-4" />
                        <span>Xuất Excel</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => navigate('/cap-nhat-luy-ke-nhan-vien')}
                        className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                    >
                        <span>Cập Nhật Số Liệu</span>
                        <ArrowUpRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Thanh Thông Tin Về Giờ Mở Cửa, Số Ngày & TOP/BOT */}
            <div className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-amber-50/60 border border-slate-200 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-4 flex-wrap text-slate-700">
                    <span className="flex items-center gap-1.5 font-bold">
                        <Clock className="w-4 h-4 text-blue-600" />
                        Giờ bán hàng: <strong className="text-blue-900 font-mono">{operatingConfig.openTime} - {operatingConfig.closeTime}</strong>
                        <span className="text-[11px] text-blue-600 font-normal">({operatingConfig.operatingHours}h/ngày)</span>
                    </span>

                    <span className="text-slate-300">|</span>

                    <span className="flex items-center gap-1.5 font-bold">
                        <Calendar className="w-4 h-4 text-amber-600" />
                        Tiến độ hoạt động: <strong className="text-amber-900 font-mono">{operatingConfig.passedDays}/{operatingConfig.operatingDays} ngày</strong>
                        {operatingConfig.operatingDays !== operatingConfig.defaultDays && (
                            <span className="text-[10px] text-amber-800 bg-amber-100 font-extrabold px-1.5 py-0.5 rounded-md">
                                Boss đã chỉnh tay (Lịch chuẩn: {operatingConfig.defaultDays} ngày)
                            </span>
                        )}
                    </span>

                    <span className="text-slate-300">|</span>

                    <span className="flex items-center gap-1.5 font-bold">
                        <Trophy className="w-4 h-4 text-amber-500" />
                        Phân loại: <strong className="text-slate-900 font-mono">
                            {topBotConfig.mode === 'PERCENT' ? `TOP ${topBotConfig.topValue}%` : `TOP ${topBotConfig.topValue} NV`}
                        </strong> &amp; <strong className="text-slate-900 font-mono">
                            {topBotConfig.mode === 'PERCENT' ? `BOT ${topBotConfig.botValue}%` : `BOT ${topBotConfig.botValue} NV`}
                        </strong>
                        <span className="text-[11px] text-slate-500 font-normal">
                            (Xếp theo: {topBotConfig.rankBy === 'FORECAST_COMPLETION_RATE' ? '%DKHT' : topBotConfig.rankBy === 'REVENUE_QD' ? 'DTQĐ' : topBotConfig.rankBy === 'REVENUE_ACTUAL' ? 'DT Thực' : '%HT Real'})
                        </span>
                    </span>
                </div>

                <button
                    type="button"
                    onClick={() => setIsConfigModalOpen(true)}
                    className="px-2.5 py-1 rounded-xl bg-white hover:bg-slate-100 text-blue-700 font-bold border border-slate-200 text-xs flex items-center gap-1 shadow-2xs transition cursor-pointer"
                >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Thay đổi cấu hình</span>
                </button>
            </div>

            {/* Thanh Bộ Lọc & Tìm Kiếm & Sắp Xếp */}
            <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                    {/* 1. Chọn Siêu Thị (Theo phân quyền tài khoản) */}
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${isLockedToSingleStore
                        ? 'bg-amber-50/90 border-amber-200 text-amber-900 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                        }`}>
                        {isLockedToSingleStore ? (
                            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                        ) : (
                            <Store className="w-4 h-4 text-amber-600 shrink-0" />
                        )}
                        <select
                            value={selectedStore}
                            onChange={e => setSelectedStore(e.target.value)}
                            disabled={isLockedToSingleStore}
                            title={isLockedToSingleStore ? 'Tài khoản nhân viên được cố định theo siêu thị đã đăng ký' : undefined}
                            className={`bg-transparent text-xs font-bold outline-hidden ${isLockedToSingleStore
                                ? 'cursor-not-allowed text-amber-900 font-black'
                                : 'cursor-pointer text-slate-800'
                                }`}
                        >
                            {canViewAllStores && (
                                <option value="all">🏢 Toàn Cụm Siêu Thị</option>
                            )}
                            {allowedStores.map(s => (
                                <option key={s.id || s.code} value={s.name}>{s.name} ({s.code})</option>
                            ))}
                        </select>
                        {isLockedToSingleStore && (
                            <span className="text-[10px] bg-amber-200/80 text-amber-800 px-1 py-0.5 rounded font-bold uppercase tracking-wider hidden sm:inline">
                                Đã khóa
                            </span>
                        )}
                    </div>

                    {/* 2. Chọn Tháng / Năm */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                        <Calendar className="w-4 h-4 text-amber-600" />
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
                        <select
                            value={selectedYear}
                            onChange={e => setSelectedYear(Number(e.target.value))}
                            className="bg-transparent text-xs font-bold text-slate-800 outline-hidden cursor-pointer"
                        >
                            {[2025, 2026, 2027].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    {/* 3. Bộ lọc SẮP XẾP KẾT QUẢ (Mặc định: %DKHT Cao -> Thấp) */}
                    <div className="flex items-center gap-1.5 bg-amber-50/80 border border-amber-300 px-3 py-1.5 rounded-xl">
                        <ArrowUpDown className="w-4 h-4 text-amber-700" />
                        <span className="text-amber-900 font-bold">Xếp theo:</span>
                        <select
                            value={sortBy}
                            onChange={e => setSortBy(e.target.value)}
                            className="bg-transparent text-xs font-extrabold text-amber-950 outline-hidden cursor-pointer"
                        >
                            <option value="FORECAST_RATE_DESC">🎯 %DKHT Dự Báo (Cao ➔ Thấp) [Mặc định]</option>
                            <option value="FORECAST_RATE_ASC">🎯 %DKHT Dự Báo (Thấp ➔ Cao)</option>
                            <option value="REVENUE_QD_DESC">💎 Lũy kế DTQĐ (Cao ➔ Thấp)</option>
                            <option value="REVENUE_ACTUAL_DESC">💵 Lũy kế DT Thực (Cao ➔ Thấp)</option>
                            <option value="COMPLETION_RATE_DESC">📊 %HT Real (Cao ➔ Thấp)</option>
                            <option value="PROD_QD_DESC">⚡ DTQĐ/GC Năng Suất (Cao ➔ Thấp)</option>
                            <option value="WORK_HOURS_DESC">⏰ Giờ công (Cao ➔ Thấp)</option>
                            <option value="INSTALLMENT_RATE_DESC">💳 % Trả chậm (Cao ➔ Thấp)</option>
                            <option value="RANK_ASC">🥇 Thứ hạng (#1 ➔ #N)</option>
                        </select>
                    </div>

                    {/* 4. Lọc nhanh TOP / BOT */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                        <Trophy className="w-4 h-4 text-amber-500" />
                        <select
                            value={topBotFilter}
                            onChange={e => setTopBotFilter(e.target.value)}
                            className="bg-transparent text-xs font-bold text-slate-800 outline-hidden cursor-pointer"
                        >
                            <option value="all">Tất cả thứ hạng</option>
                            <option value="TOP">🏆 Chỉ xem nhóm TOP</option>
                            <option value="MID">⭐️ Chỉ xem nhóm MID</option>
                            <option value="BOT">⚠️ Chỉ xem nhóm BOT</option>
                        </select>
                    </div>

                    {/* 5. Lọc nhịp độ */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                        <Filter className="w-4 h-4 text-amber-600" />
                        <select
                            value={paceFilter}
                            onChange={e => setPaceFilter(e.target.value)}
                            className="bg-transparent text-xs font-bold text-slate-800 outline-hidden cursor-pointer"
                        >
                            <option value="all">Tất cả nhịp độ</option>
                            <option value="EXCEED">Vượt nhịp (≥100%)</option>
                            <option value="ON_TRACK">Đạt nhịp (80-99%)</option>
                            <option value="SLOW">Cần tăng tốc (50-79%)</option>
                            <option value="CRITICAL">Báo động (&lt;50%)</option>
                        </select>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl w-60">
                        <Search className="w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Tìm nhân viên / mã NV..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="bg-transparent text-xs outline-hidden w-full text-slate-800 placeholder-slate-400"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={loadAllData}
                        className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition cursor-pointer"
                        title="Tải lại số liệu"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-600' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Container xuất ảnh chuẩn 4K */}
            <div ref={reportRef} data-report-table="true" className="space-y-4 bg-slate-50/50 p-1.5 rounded-2xl font-avo">
                {/* 4 Thẻ Vinh Danh Thành Tích Cá Nhân Xuất Sắc */}
                <PerformanceKpiCards summary={summary} />

                {/* Bảng Xếp Hạng & Năng Suất Chi Tiết (1 dòng header, tên rút gọn, highlight trả chậm < 35%) */}
                <PerformanceTable
                    rows={filteredRows}
                    showStoreName={selectedStore === 'all'}
                    onSelectEmployee={(emp) => {
                        const targetStore = emp.store_name || (selectedStore !== 'all' ? selectedStore : '');
                        navigate(`/chi-tiet-nhan-vien?emp=${emp.employee_id}&month=${selectedMonth}&year=${selectedYear}&store=${encodeURIComponent(targetStore)}`);
                    }}
                />
            </div>

            {/* Modal Cấu Hình Hoạt Động & TOP/BOT */}
            <PerformanceConfigModal
                isOpen={isConfigModalOpen}
                onClose={() => setIsConfigModalOpen(false)}
                stores={stores}
                currentStoreName={selectedStore}
                month={selectedMonth}
                year={selectedYear}
                totalEmployees={employees.length}
                onConfigSaved={() => {
                    refreshConfigs();
                    loadAllData();
                    showToast('✅ Đã cập nhật cấu hình hoạt động & phân loại TOP/BOT!');
                }}
            />
        </div>
    );
}
