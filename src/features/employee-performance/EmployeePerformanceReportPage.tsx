import { useState, useEffect, useMemo, useRef } from 'react';
import {
    fetchStores,
    fetchEmployees,
    fetchEmployeeRevenueTargets,
    type StoreItem,
    type EmployeeItem
} from '../../core/lib/storage';
import {
    syncAndFetchEmployeeDataSessions,
    type EmployeeDataSession
} from '../employee-cumulative/utils/sessionStorage';
import { getYesterdayDateString, isStoreMatch } from '../../core/lib/formatters';
import ReportDataFreshnessBar from '../../shared/components/report/ReportDataFreshnessBar';
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
import ReportActionButtons from '../../shared/components/report/ReportActionButtons';
import {
    Trophy,
    Calendar,
    Store,
    Search,
    RefreshCw,
    Filter,
    ArrowUpRight,
    ArrowUpDown,
    Target,
    Clock,
    Settings,
    CheckCircle2,
    Lock,
    AlertTriangle,
    X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../shared/contexts/AuthContext';
import { useUserStoreFilter } from '../../shared/hooks/useUserStoreFilter';
import ExcelJS from 'exceljs';
import html2canvas from 'html2canvas';
import { useExcelExportPermission } from '../../shared/hooks/useExcelExportPermission';
import { calculate8KScale } from '../../shared/utils/exportImage';
import { isGuestDemoStore, GUEST_DEMO_STORE } from '../../core/lib/guestDemoStoreService';

export default function EmployeePerformanceReportPage() {
    const navigate = useNavigate();
    const { currentUser, canConfigure } = useAuth();
    const isGuest = Boolean(currentUser?.is_guest);
    const isAdmin = currentUser?.role === 'ADMIN';
    const { canExportExcel } = useExcelExportPermission('/bao-cao-hieu-qua-nhan-vien');
    const canManage = !isGuest && (canConfigure || ['ADMIN', 'QUAN_LY', 'TRUONG_CA'].includes(currentUser?.role));
    const reportRef = useRef<HTMLDivElement>(null);

    const [stores, setStores] = useState<StoreItem[]>([]);
    const [selectedStore, setSelectedStore] = useState<string>('all');

    // Phân quyền ST theo tài khoản người dùng
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

    // Toggle ẩn / hiện thông tin giờ công và năng suất (Mặc định: Ẩn)
    const [showWorkHours, setShowWorkHours] = useState<boolean>(false);

    // Tự động chuyển tiêu chí sắp xếp về mặc định nếu đang xếp theo giờ công/năng suất mà bị tắt toggle
    useEffect(() => {
        if (!showWorkHours && (sortBy === 'PROD_QD_DESC' || sortBy === 'WORK_HOURS_DESC')) {
            setSortBy('FORECAST_RATE_DESC');
        }
    }, [showWorkHours, sortBy]);

    const [employees, setEmployees] = useState<EmployeeItem[]>([]);
    const [revenueTargets, setRevenueTargets] = useState<Record<string, number>>({});
    const [revenueDataMap, setRevenueDataMap] = useState<Record<string, any>>({});
    const [workHoursMap, setWorkHoursMap] = useState<Record<string, number>>({});
    const [latestSession, setLatestSession] = useState<EmployeeDataSession | null>(null);

    const [loading, setLoading] = useState<boolean>(true);
    const [loadError, setLoadError] = useState<string>('');
    const [isExporting, setIsExporting] = useState<boolean>(false);
    const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        };
    }, []);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToast({ message, type });
        toastTimerRef.current = setTimeout(() => {
            setToast(null);
            toastTimerRef.current = null;
        }, 3500);
    };

    const handleResetFilters = () => {
        setPaceFilter('all');
        setTopBotFilter('all');
        setSearchQuery('');
        setSortBy('FORECAST_RATE_DESC');
    };

    // Cấu hình hoạt động ST & TOP/BOT theo đích danh ST
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
        setLoadError('');

        // Tự động đồng bộ cấu hình hoạt động & TOP/BOT từ Cloud Supabase nếu có
        syncPerformanceConfigsFromCloud()
            .then(() => refreshConfigs())
            .catch(() => { });

        try {
            const targetStoreParam = isGuest
                ? GUEST_DEMO_STORE
                : (selectedStore === 'all' ? undefined : selectedStore);

            const [storesRes, empsRes, targetsRes] = await Promise.all([
                fetchStores(),
                fetchEmployees(targetStoreParam),
                fetchEmployeeRevenueTargets(selectedMonth, selectedYear)
            ]);

            if (storesRes.success) setStores(storesRes.data);
            if (empsRes.success) setEmployees(empsRes.data);
            if (!storesRes.success || !empsRes.success) {
                setLoadError('Không thể tải đầy đủ dữ liệu từ máy chủ. Vui lòng thử tải lại.');
            }

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
            const sortedSessions = allSessions.slice().sort((a, b) =>
                (b.report_date || '').localeCompare(a.report_date || '') ||
                (b.created_at || '').localeCompare(a.created_at || '')
            );

            // Xác định phiên mới nhất
            const revSessions = sortedSessions.filter(sess =>
                (sess.session_type === 'REVENUE_CAMPAIGN' || sess.session_type === 'FULL_SYNC') &&
                (selectedStore === 'all' || isStoreMatch(sess.store_name, selectedStore, storesRes.data || stores))
            );
            const newest = revSessions[0] || null;
            setLatestSession(newest);

            sortedSessions.forEach(sess => {
                if (sess.session_type === 'REVENUE_CAMPAIGN' || sess.session_type === 'FULL_SYNC') {
                    if (selectedStore === 'all' || isStoreMatch(sess.store_name, selectedStore, storesRes.data || stores)) {
                        sess.records.forEach(r => {
                            const key = (r.employee_id || '').trim();
                            if (!revMap[key]) revMap[key] = r;
                            if (r.work_hours && r.work_hours > 0 && !hoursMap[key]) {
                                hoursMap[key] = r.work_hours;
                            }
                        });
                    }
                } else if (sess.session_type === 'WORK_HOURS') {
                    sess.records.forEach(r => {
                        const key = (r.employee_id || '').trim();
                        if (r.work_hours && r.work_hours > 0 && !hoursMap[key]) {
                            hoursMap[key] = r.work_hours;
                        }
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
        } catch (err: any) {
            console.error('Lỗi tải dữ liệu hiệu quả nhân viên:', err);
            setLoadError(err?.message || 'Đã xảy ra lỗi kết nối khi tải dữ liệu.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAllData();
    }, [selectedStore, selectedMonth, selectedYear]);

    // 2. HỢP NHẤT DỮ LIỆU HIỆU QUẢ THEO TỪNG NHÂN VIÊN VỚI RÚT GỌN TÊN CHUẨN
    const performanceRows = useMemo<EmployeePerformanceRow[]>(() => {
        if (!employees || employees.length === 0) return [];

        const passed = Math.max(1, operatingConfig.passedDays);
        const totalDays = Math.max(1, operatingConfig.operatingDays);

        const targetEmployees = employees.filter(emp => {
            // 0. Loại bỏ nhân viên đã nghỉ việc
            if (emp.is_active === false) return false;
            const empStatus = (emp.status || '').toLowerCase();
            if (empStatus === 'inactive' || empStatus === 'resigned') return false;

            // 0.1. Loại bỏ nhân viên không có target doanh thu trong kỳ
            const empId = (emp.employee_id || '').trim();
            const target = revenueTargets[empId] ?? revenueTargets[emp.employee_id] ?? 0;
            if (target <= 0) return false;

            const empStore = emp.store_name || '';
            const isDemo = isGuestDemoStore(empStore) || empId.startsWith('NV838');

            if (isGuest) return isDemo;
            if (isDemo) return false;

            if (selectedStore === 'all') {
                if (isAdmin) return true;
                return allowedStores.some(s => isStoreMatch(s.name, empStore, stores));
            }
            return isStoreMatch(empStore, selectedStore, stores);
        });

        const rawList = targetEmployees.map(emp => {
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

        // Áp dụng đánh giá TOP / BOT & gán thứ hạng Rank chuẩn xác theo đích danh ST
        if (selectedStore !== 'all') {
            const targetCfg = getTopBotConfig(selectedStore);
            return applyTopBotEvaluation(rawList, targetCfg);
        } else {
            // Khi xem Toàn bộ cụm: phân loại TOP/BOT theo cấu hình đích danh của từng ST
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
    }, [employees, revenueDataMap, revenueTargets, workHoursMap, operatingConfig, topBotConfig, selectedStore, stores, isGuest, isAdmin, allowedStores]);

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

    // 5. XUẤT BÁO CÁO EXCEL (ĐỒNG BỘ CỘT THEO TOGGLE HIỂN THỊ)
    const handleExportExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Hiệu Quả Nhân Viên');

        const excelColumns: any[] = [
            { header: 'Hạng', key: 'rank', width: 8 },
            { header: 'Mã NV', key: 'emp_id', width: 14 },
            { header: 'Họ và Tên', key: 'name', width: 25 },
            { header: 'Tên Rút Gọn', key: 'short_name', width: 18 },
            { header: 'ST', key: 'store', width: 28 },
            { header: 'Chức Danh', key: 'role', width: 18 },
            { header: 'DTQĐ (tr)', key: 'rev_qd', width: 16 },
            { header: 'Target (tr)', key: 'target', width: 16 },
            { header: '%HT Real', key: 'pct_real', width: 14 },
            { header: '%DKHT', key: 'pct_forecast', width: 14 }
        ];

        if (showWorkHours) {
            excelColumns.push(
                { header: 'Giờ Công (h)', key: 'hours', width: 14 },
                { header: 'DTQĐ / GC (tr/h)', key: 'prod_qd', width: 16 }
            );
        }

        excelColumns.push(
            { header: 'DT Trả Chậm (tr)', key: 'dt_tg', width: 16 },
            { header: '% Trả Chậm', key: 'pct_tg', width: 14 },
            { header: 'Đánh Giá', key: 'top_bot', width: 18 }
        );

        worksheet.columns = excelColumns;

        filteredRows.forEach(r => {
            const rowData: any = {
                rank: r.rank,
                emp_id: r.employee_id,
                name: r.full_name,
                short_name: r.short_name,
                store: r.store_name,
                role: r.job_title,
                rev_qd: r.revenue_qd,
                target: r.revenue_target,
                pct_real: `${r.completion_rate}%`,
                pct_forecast: `${r.forecast_completion_rate}%`
            };

            if (showWorkHours) {
                rowData.hours = r.work_hours;
                rowData.prod_qd = r.productivity_qd_per_hour;
            }

            rowData.dt_tg = r.installment_revenue;
            rowData.pct_tg = `${r.installment_rate}%`;
            rowData.top_bot = r.top_bot_label;

            worksheet.addRow(rowData);
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

    // 6. XUẤT ẢNH 8K (LƯU FILE HOẶC COPY VÀO CLIPBOARD) VỚI CƠ CHẾ AUTO-SAFETY CLAMP
    const generateCanvas = async (): Promise<HTMLCanvasElement | null> => {
        if (!reportRef.current) return null;
        if (document.fonts?.ready) {
            await document.fonts.ready;
        }

        const targetElement = reportRef.current;
        const tableElement = targetElement.querySelector('table');

        // Đo đạc chiều rộng thực tế của bảng để không bao giờ bị cắt cột ở bên phải
        // Bảng 10 cột (có giờ công) cần tối thiểu 1280px; Bảng 8 cột (ẩn giờ công) cần khoảng 1020px
        const minAutoWidth = showWorkHours ? 1280 : 1020;
        const tableScrollWidth = tableElement ? tableElement.scrollWidth : 0;
        const contentWidth = Math.max(tableScrollWidth + 64, targetElement.scrollWidth + 64, minAutoWidth);

        // Tính toán tỷ lệ scale chuẩn 8K với Auto-Safety Clamp bảo vệ bộ nhớ Canvas
        const scale = calculate8KScale(targetElement, contentWidth);

        return await html2canvas(targetElement, {
            scale: scale,
            backgroundColor: '#ffffff',
            useCORS: true,
            logging: false,
            allowTaint: true,
            width: contentWidth,
            windowWidth: contentWidth + 100,
            ignoreElements: (el) =>
                el.getAttribute('data-html2canvas-ignore') === 'true' ||
                el.getAttribute('data-export-ignore') === 'true' ||
                el.getAttribute('data-freshness-bar') === 'true',
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

                // Loại bỏ khối trạng thái dữ liệu và các nút thao tác khỏi ảnh xuất
                clonedReport.querySelectorAll('[data-html2canvas-ignore="true"], [data-export-ignore="true"], [data-freshness-bar="true"]').forEach(el => {
                    (el as HTMLElement).remove();
                });

                // Cố định chiều rộng đầy đủ & chiều dài không giới hạn cho container và tài liệu
                clonedDoc.documentElement.style.width = `${contentWidth}px`;
                clonedDoc.documentElement.style.height = 'auto';
                clonedDoc.body.style.width = `${contentWidth}px`;
                clonedDoc.body.style.height = 'auto';
                clonedDoc.body.style.overflow = 'visible';

                clonedReport.style.width = `${contentWidth}px`;
                clonedReport.style.minWidth = `${contentWidth}px`;
                clonedReport.style.maxWidth = `${contentWidth}px`;
                clonedReport.style.height = 'auto';
                clonedReport.style.minHeight = 'auto';
                clonedReport.style.maxHeight = 'none';
                clonedReport.style.overflow = 'visible';
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

                // Căn chỉnh bảng dữ liệu hiển thị đầy đủ các cột
                const clonedTable = clonedReport.querySelector('table') as HTMLElement;
                if (clonedTable) {
                    clonedTable.style.width = '100%';
                    clonedTable.style.minWidth = `${contentWidth - 48}px`;
                    clonedTable.style.tableLayout = 'auto';
                }

                // Chuyển thead, th, td, tfoot từ sticky sang static để không lệch cột/tiêu đề khi xuất ảnh
                const stickyElements = clonedReport.querySelectorAll('thead, th, td, tfoot');
                stickyElements.forEach((el) => {
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

                const storeLabel = selectedStore === 'all' ? 'Toàn Cụm ST' : selectedStore;
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
            const canvas = await generateCanvas();
            if (!canvas) {
                showToast('Không thể khởi tạo canvas để xuất ảnh!', 'error');
                return;
            }
            const imgData = canvas.toDataURL('image/png', 1.0);
            const a = document.createElement('a');
            a.href = imgData;
            a.download = `BaoCao_HieuQua_NV_${selectedMonth}_${selectedYear}.png`;
            a.click();
            showToast('Đã tải file ảnh báo cáo thành công!');
        } catch (e: any) {
            console.error('Lỗi tải ảnh:', e);
            showToast('Không thể tải ảnh: ' + (e.message || e), 'error');
        } finally {
            setIsExporting(false);
        }
    };

    const handleCopyImageToClipboard = async () => {
        setIsExporting(true);
        try {
            const canvas = await generateCanvas();
            if (!canvas) {
                showToast('Không thể khởi tạo canvas!', 'error');
                return;
            }

            canvas.toBlob(async blob => {
                if (blob && navigator.clipboard && window.ClipboardItem) {
                    try {
                        await navigator.clipboard.write([
                            new ClipboardItem({ 'image/png': blob })
                        ]);
                        showToast('Đã sao chép ảnh vào Clipboard! Bạn hãy nhấn Ctrl + V để dán ngay.');
                    } catch (err: any) {
                        console.warn('Lỗi ghi clipboard trực tiếp, tự động chuyển sang tải file:', err);
                        const imgData = canvas.toDataURL('image/png', 1.0);
                        const a = document.createElement('a');
                        a.href = imgData;
                        a.download = `BaoCao_HieuQua_NV_${selectedMonth}_${selectedYear}.png`;
                        a.click();
                        showToast('Ảnh báo cáo đã tự động được tải về máy của bạn!');
                    }
                } else {
                    handleDownloadImage();
                }
                setIsExporting(false);
            }, 'image/png', 1.0);
        } catch (e: any) {
            console.error('Lỗi sao chép ảnh:', e);
            setIsExporting(false);
            showToast('Không thể copy ảnh: ' + (e.message || e), 'error');
        }
    };

    return (
        <div className="max-w-[1680px] mx-auto space-y-4 pb-12">
            {/* Toast Thông Báo */}
            {toast && (
                <div role="status" className="fixed top-5 right-5 z-50 p-4 bg-slate-900 text-white rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs border border-slate-700 max-w-sm">
                    {toast.type === 'error' ? (
                        <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" aria-hidden="true" />
                    ) : (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" aria-hidden="true" />
                    )}
                    <span className="font-semibold">{toast.message}</span>
                </div>
            )}

            {/* Header Phân Hệ */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-amber-100 text-amber-800 shadow-sm" aria-hidden="true">
                            <Trophy className="w-5 h-5" />
                        </span>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                            Hiệu Quả Doanh Thu Nhân Viên
                        </h1>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                        Xếp hạng nhân viên, vinh danh cá nhân xuất sắc và đánh giá tiến độ hoàn thành mục tiêu.
                    </p>
                </div>

                <div className="flex items-center gap-2 self-stretch sm:self-auto flex-wrap">
                    {/* Nút Cấu Hình ST & TOP/BOT (Chỉ hiển thị với Admin/QL/TC) */}
                    {canManage && (
                        <button
                            type="button"
                            onClick={() => setIsConfigModalOpen(true)}
                            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1"
                            title="Cấu hình giờ mở cửa, số ngày hoạt động và tiêu chuẩn TOP/BOT"
                        >
                            <Settings className="w-4 h-4 text-amber-400" aria-hidden="true" />
                            <span>Cấu Hình ST & TOP/BOT</span>
                        </button>
                    )}

                    {/* Nút Khai Báo Target (Chỉ hiển thị với Admin/QL/TC) */}
                    {canManage && (
                        <button
                            type="button"
                            onClick={() => navigate('/muc-tieu-nhan-vien')}
                            className="px-3.5 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-1"
                            title="Đi đến trang Khai Báo & Quản Lý Mục Tiêu Nhân Viên"
                        >
                            <Target className="w-4 h-4" aria-hidden="true" />
                            <span>Khai Báo Target</span>
                        </button>
                    )}

                    {/* CỤM NÚT BÁO CÁO CHUNG CHO DỰ ÁN */}
                    <ReportActionButtons
                        onExportImage={handleDownloadImage}
                        onCopyImage={handleCopyImageToClipboard}
                        isExporting={isExporting}
                        exportButtonLabel="TẢI ẢNH"
                        copyImageButtonLabel="COPY ẢNH"
                        hasAssessment={true}
                        reportTitle={`Báo Cáo Hiệu Quả Nhân Viên T${selectedMonth}/${selectedYear} - ${selectedStore}`}
                        periodLabel={`Tháng ${selectedMonth}/${selectedYear}`}
                        onExportExcel={handleExportExcel}
                        canExportExcel={canExportExcel}
                    />

                    {/* Nút Cập Nhật Số Liệu (Chỉ hiển thị với Admin/QL/TC) */}
                    {canManage && (
                        <button
                            type="button"
                            onClick={() => navigate('/cap-nhat-luy-ke-nhan-vien')}
                            className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-1"
                        >
                            <span>Cập Nhật Số Liệu</span>
                            <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                        </button>
                    )}
                </div>
            </div>

            {/* Thanh Thông Tin Về Giờ Mở Cửa, Số Ngày & TOP/BOT */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 text-xs">
                <div className="flex items-center gap-x-4 gap-y-2 flex-wrap text-slate-700">
                    <span className="flex items-center gap-1.5 font-bold">
                        <Clock className="w-4 h-4 text-blue-700 shrink-0" aria-hidden="true" />
                        Giờ bán hàng: <strong className="text-blue-900 font-mono tabular-nums">{operatingConfig.openTime} - {operatingConfig.closeTime}</strong>
                        <span className="text-[11px] text-blue-700 font-semibold">({operatingConfig.operatingHours}h/ngày)</span>
                    </span>

                    <span className="text-slate-300 hidden sm:inline" aria-hidden="true">|</span>

                    <span className="flex items-center gap-1.5 font-bold flex-wrap">
                        <Calendar className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
                        Tiến độ hoạt động: <strong className="text-amber-900 font-mono tabular-nums">{operatingConfig.passedDays}/{operatingConfig.operatingDays} ngày</strong>
                        {operatingConfig.operatingDays !== operatingConfig.defaultDays && (
                            <span className="text-[10px] text-amber-900 bg-amber-100 font-extrabold px-1.5 py-0.5 rounded-md">
                                Boss đã chỉnh tay (Lịch chuẩn: {operatingConfig.defaultDays} ngày)
                            </span>
                        )}
                    </span>

                    <span className="text-slate-300 hidden sm:inline" aria-hidden="true">|</span>

                    <span className="flex items-center gap-1.5 font-bold flex-wrap">
                        <Trophy className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
                        Phân loại: <strong className="text-slate-900 font-mono">
                            {topBotConfig.mode === 'PERCENT' ? `TOP ${topBotConfig.topValue}%` : `TOP ${topBotConfig.topValue} NV`}
                        </strong> &amp; <strong className="text-slate-900 font-mono">
                            {topBotConfig.mode === 'PERCENT' ? `BOT ${topBotConfig.botValue}%` : `BOT ${topBotConfig.botValue} NV`}
                        </strong>
                        <span className="text-[11px] text-slate-600 font-medium">
                            (Xếp theo: {topBotConfig.rankBy === 'FORECAST_COMPLETION_RATE' ? '%DKHT' : topBotConfig.rankBy === 'REVENUE_QD' ? 'DTQĐ' : topBotConfig.rankBy === 'REVENUE_ACTUAL' ? 'DT Thực' : '%HT Real'})
                        </span>
                    </span>
                </div>

                {canManage && (
                    <button
                        type="button"
                        onClick={() => setIsConfigModalOpen(true)}
                        className="px-2.5 py-1 rounded-xl bg-white hover:bg-slate-100 text-blue-700 font-bold border border-slate-200 text-xs flex items-center gap-1 shadow-sm transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    >
                        <Settings className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Thay đổi cấu hình</span>
                    </button>
                )}
            </div>

            {/* Thanh Bộ Lọc & Tìm Kiếm & Sắp Xếp */}
            <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200 shadow-sm space-y-3 text-xs">
                {/* HÀNG 1: BỘ LỌC ST RIÊNG LẺ ĐẦU TIÊN (RULE 10 CONVENTION) */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
                    <div className={`w-full sm:w-auto sm:max-w-md flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all min-w-0 focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-blue-600 ${isLockedToSingleStore
                        ? 'bg-amber-50/90 border-amber-200 text-amber-900 shadow-sm'
                        : 'bg-slate-50 border-slate-200 hover:border-amber-400 text-slate-800 shadow-sm'
                        }`}>
                        {isLockedToSingleStore ? (
                            <Lock className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
                        ) : (
                            <Store className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
                        )}
                        <label htmlFor="perf-store-select" className="text-slate-600 font-bold whitespace-nowrap shrink-0">
                            ST:
                        </label>
                        <select
                            id="perf-store-select"
                            name="perf_store"
                            value={selectedStore}
                            onChange={e => setSelectedStore(e.target.value)}
                            disabled={isLockedToSingleStore}
                            title={currentUser?.is_guest ? 'Tài khoản trải nghiệm sử dụng dữ liệu ST 10335 - AAR_BRV_VTA - 290 Trương Công Định' : (isLockedToSingleStore ? 'Tài khoản nhân viên được cố định theo ST đã đăng ký' : undefined)}
                            className={`bg-transparent text-xs font-black outline-none w-full min-w-0 sm:min-w-[240px] truncate ${isLockedToSingleStore
                                ? 'cursor-not-allowed text-amber-900'
                                : 'cursor-pointer text-slate-900'
                                }`}
                        >
                            {canViewAllStores && (
                                <option value="all">Toàn Cụm ST</option>
                            )}
                            {allowedStores.map(s => (
                                <option key={s.id || s.code} value={s.name}>{s.name} ({s.code})</option>
                            ))}
                        </select>
                        {isLockedToSingleStore && (
                            <span className="text-[10px] bg-amber-200/80 text-amber-900 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0">
                                {currentUser?.is_guest ? 'Trải nghiệm' : 'Đã khóa'}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleResetFilters}
                            className="text-slate-600 hover:text-slate-900 text-xs font-bold underline cursor-pointer px-1.5 py-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                        >
                            Đặt lại bộ lọc
                        </button>
                    </div>
                </div>

                {/* HÀNG 2: CÁC TIÊU CHÍ BỘ LỌC KHÁC & TÌM KIẾM */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 pt-0.5">
                    <div className="flex flex-wrap items-center gap-2 min-w-0 max-w-full w-full lg:w-auto">
                        {/* 1. Chọn Tháng / Năm */}
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-blue-600">
                            <Calendar className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
                            <label htmlFor="perf-month-select" className="sr-only">Tháng báo cáo</label>
                            <select
                                id="perf-month-select"
                                name="perf_month"
                                value={selectedMonth}
                                onChange={e => setSelectedMonth(Number(e.target.value))}
                                className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
                            >
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                    <option key={m} value={m}>Tháng {m}</option>
                                ))}
                            </select>
                            <span className="text-slate-500" aria-hidden="true">/</span>
                            <label htmlFor="perf-year-select" className="sr-only">Năm báo cáo</label>
                            <select
                                id="perf-year-select"
                                name="perf_year"
                                value={selectedYear}
                                onChange={e => setSelectedYear(Number(e.target.value))}
                                className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
                            >
                                {[2025, 2026, 2027].map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>

                        {/* 2. Bộ lọc SẮP XẾP KẾT QUẢ (Mặc định: %DKHT Cao -> Thấp) */}
                        <div className="w-full sm:w-auto flex items-center gap-1.5 bg-amber-50/80 border border-amber-300 px-3 py-1.5 rounded-xl max-w-full min-w-0 focus-within:ring-2 focus-within:ring-amber-600 focus-within:border-amber-600">
                            <ArrowUpDown className="w-4 h-4 text-amber-800 shrink-0" aria-hidden="true" />
                            <label htmlFor="perf-sort-select" className="text-amber-950 font-bold whitespace-nowrap shrink-0">
                                Xếp theo:
                            </label>
                            <select
                                id="perf-sort-select"
                                name="perf_sort"
                                value={sortBy}
                                onChange={e => setSortBy(e.target.value)}
                                className="bg-transparent text-xs font-extrabold text-amber-950 outline-none cursor-pointer min-w-0 flex-1 sm:flex-none truncate"
                            >
                                <option value="FORECAST_RATE_DESC">%DKHT Dự báo (Cao → Thấp)</option>
                                <option value="FORECAST_RATE_ASC">%DKHT Dự báo (Thấp → Cao)</option>
                                <option value="REVENUE_QD_DESC">Lũy kế DTQĐ (Cao → Thấp)</option>
                                <option value="COMPLETION_RATE_DESC">%HT Real (Cao → Thấp)</option>
                                {showWorkHours && (
                                    <>
                                        <option value="PROD_QD_DESC">DTQĐ/GC Năng suất (Cao → Thấp)</option>
                                        <option value="WORK_HOURS_DESC">Giờ công (Cao → Thấp)</option>
                                    </>
                                )}
                                <option value="INSTALLMENT_RATE_DESC">% Trả chậm (Cao → Thấp)</option>
                                <option value="RANK_ASC">Thứ hạng (#1 → #N)</option>
                            </select>
                        </div>

                        {/* 3. Lọc nhanh TOP / BOT */}
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-blue-600">
                            <Trophy className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
                            <label htmlFor="perf-topbot-filter" className="sr-only">Lọc nhóm TOP và BOT</label>
                            <select
                                id="perf-topbot-filter"
                                name="perf_topbot_filter"
                                value={topBotFilter}
                                onChange={e => setTopBotFilter(e.target.value)}
                                className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
                            >
                                <option value="all">Tất cả thứ hạng</option>
                                <option value="TOP">Chỉ xem nhóm TOP</option>
                                <option value="MID">Chỉ xem nhóm MID</option>
                                <option value="BOT">Chỉ xem nhóm BOT</option>
                            </select>
                        </div>

                        {/* 4. Lọc nhịp độ */}
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-blue-600">
                            <Filter className="w-4 h-4 text-amber-700 shrink-0" aria-hidden="true" />
                            <label htmlFor="perf-pace-filter" className="sr-only">Lọc nhịp độ hoàn thành</label>
                            <select
                                id="perf-pace-filter"
                                name="perf_pace_filter"
                                value={paceFilter}
                                onChange={e => setPaceFilter(e.target.value)}
                                className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer"
                            >
                                <option value="all">Tất cả nhịp độ</option>
                                <option value="EXCEED">Vượt nhịp (≥100%)</option>
                                <option value="ON_TRACK">Đạt nhịp (80-99%)</option>
                                <option value="SLOW">Cần tăng tốc (50-79%)</option>
                                <option value="CRITICAL">Báo động (&lt;50%)</option>
                            </select>
                        </div>

                        {/* 5. Toggle Ẩn / Hiện Giờ Công & Năng Suất (Mặc định: Ẩn) */}
                        <button
                            type="button"
                            aria-pressed={showWorkHours}
                            onClick={() => setShowWorkHours(prev => !prev)}
                            className={`inline-flex items-center gap-2 border px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-sm select-none shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                                showWorkHours 
                                    ? 'bg-blue-50/90 hover:bg-blue-100/90 border-blue-400 text-blue-950' 
                                    : 'bg-slate-50 hover:bg-slate-100/90 border-slate-300 text-slate-700 hover:border-slate-400'
                            }`}
                            title={showWorkHours ? 'Đang hiện giờ công & năng suất (Bấm để ẩn)' : 'Đang ẩn giờ công & năng suất (Bấm để hiển thị)'}
                        >
                            <Clock className={`w-4 h-4 shrink-0 transition-colors ${showWorkHours ? 'text-blue-700' : 'text-slate-600'}`} aria-hidden="true" />
                            <span className="text-xs font-bold whitespace-nowrap">
                                Giờ công &amp; Năng suất:
                            </span>

                            {/* Cụm Switch Toggle */}
                            <div className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out p-0.5 ${
                                showWorkHours ? 'bg-blue-700' : 'bg-slate-400'
                            }`}>
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
                                    showWorkHours ? 'translate-x-4' : 'translate-x-0'
                                }`} />
                            </div>

                            {/* Badge Hiện / Ẩn rõ nét */}
                            <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded transition-colors shrink-0 ${
                                showWorkHours 
                                    ? 'bg-blue-700 text-white shadow-sm' 
                                    : 'bg-slate-200 text-slate-700'
                            }`}>
                                {showWorkHours ? 'Hiện' : 'Ẩn'}
                            </span>
                        </button>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl flex-1 sm:w-60 min-w-0 focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-blue-600 focus-within:bg-white">
                            <Search className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
                            <label htmlFor="perf-search-input" className="sr-only">Tìm nhân viên hoặc mã nhân viên</label>
                            <input
                                id="perf-search-input"
                                name="perf_search"
                                type="text"
                                aria-label="Tìm theo tên nhân viên hoặc mã nhân viên"
                                placeholder="Tìm nhân viên / mã NV..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="bg-transparent text-xs outline-none w-full min-w-0 text-slate-800 placeholder:text-slate-500"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    aria-label="Xóa từ khóa tìm kiếm"
                                    className="text-slate-500 hover:text-slate-800 rounded p-0.5 cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                                >
                                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                                </button>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={loadAllData}
                            disabled={loading}
                            aria-label="Tải lại số liệu"
                            className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-700 transition cursor-pointer shrink-0 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                            title="Tải lại số liệu"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-700' : ''}`} aria-hidden="true" />
                        </button>
                    </div>
                </div>
            </div>

            {loadError && (
                <div
                    role="alert"
                    data-export-ignore="true"
                    data-html2canvas-ignore="true"
                    className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs text-rose-900"
                >
                    <div className="flex items-center gap-2 font-semibold">
                        <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" aria-hidden="true" />
                        <span>{loadError}</span>
                    </div>
                    <button
                        type="button"
                        onClick={loadAllData}
                        className="px-3 py-1.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold transition cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700"
                    >
                        Thử lại
                    </button>
                </div>
            )}

            {/* Container xuất ảnh chuẩn 8K */}
            <div ref={reportRef} data-report-table="true" className="space-y-4 bg-slate-50/50 p-1.5 rounded-2xl">
                {/* THANH TRẠNG THÁI CẬP NHẬT PHIÊN DỮ LIỆU (hiển thị Roboto, tự loại khi xuất ảnh) */}
                <div className="font-sans" data-export-ignore="true" data-html2canvas-ignore="true">
                    <ReportDataFreshnessBar
                        latestDataDate={latestSession?.report_date}
                        expectedDate={getYesterdayDateString()}
                        sessionTitle={latestSession?.session_title}
                        lastUpdatedAt={latestSession?.created_at}
                        lastUpdatedBy={latestSession?.created_by}
                        storeName={selectedStore}
                        actionUrl="/cap-nhat-luy-ke-nhan-vien"
                        actionLabel="Cập nhật số liệu NV"
                        canUpdate={canManage}
                    />
                </div>

                {loading && performanceRows.length === 0 ? (
                    <div aria-busy="true" className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                            {[1, 2, 3].map(idx => (
                                <div key={idx} className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3 animate-pulse">
                                    <div className="h-4 w-28 bg-slate-200 rounded" />
                                    <div className="h-6 w-40 bg-slate-200 rounded" />
                                    <div className="h-4 w-full bg-slate-100 rounded" />
                                </div>
                            ))}
                        </div>
                        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-xs font-semibold text-slate-600 animate-pulse">
                            Đang tải bảng hiệu quả nhân viên...
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 font-avo">
                        {/* Thẻ Vinh Danh Thành Tích Cá Nhân Xuất Sắc (Thẻ năng suất ẩn/hiện theo toggle) */}
                        <PerformanceKpiCards summary={summary} showWorkHours={showWorkHours} />

                        {/* Bảng Xếp Hạng & Năng Suất Chi Tiết (1 dòng header, tên rút gọn, highlight trả chậm < 35%, ẩn/hiện giờ công theo toggle) */}
                        <PerformanceTable
                            rows={filteredRows}
                            showStoreName={selectedStore === 'all'}
                            showWorkHours={showWorkHours}
                            totalUnfilteredCount={performanceRows.length}
                            onResetFilters={handleResetFilters}
                            onSelectEmployee={(emp) => {
                                const targetStore = emp.store_name || (selectedStore !== 'all' ? selectedStore : '');
                                navigate(`/chi-tiet-nhan-vien?emp=${emp.employee_id}&month=${selectedMonth}&year=${selectedYear}&store=${encodeURIComponent(targetStore)}`);
                            }}
                        />
                    </div>
                )}
            </div>

            {/* Modal Cấu Hình Hoạt Động & TOP/BOT */}
            <PerformanceConfigModal
                isOpen={canManage && isConfigModalOpen}
                onClose={() => setIsConfigModalOpen(false)}
                stores={stores}
                currentStoreName={selectedStore}
                month={selectedMonth}
                year={selectedYear}
                totalEmployees={employees.length}
                onConfigSaved={() => {
                    refreshConfigs();
                    loadAllData();
                    showToast('Đã cập nhật cấu hình hoạt động & phân loại TOP/BOT!');
                }}
            />
        </div>
    );
}
