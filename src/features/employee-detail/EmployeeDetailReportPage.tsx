import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
    fetchStores,
    fetchEmployees,
    fetchEmployeeRevenueTargets,
    fetchEmployeeCampaignTargets,
    fetchCampaignDictionary,
    type StoreItem,
    type EmployeeItem,
    type CampaignDictItem
} from '../../core/lib/storage';
import {
    syncAndFetchEmployeeDataSessions,
    type EmployeeDataSession
} from '../employee-cumulative/utils/sessionStorage';
import {
    getStoreOperatingConfig,
    getTopBotConfig,
    applyTopBotEvaluation,
    getShortenedEmployeeName,
    cleanEmployeeName
} from '../employee-performance/utils/performanceConfig';
import { resolveCanonicalCampaign } from '../campaign-summary/utils/campaignSummaryStorage';
import {
    getStoreCampaignScoreConfig,
    getCampaignPoints,
    syncStoreCampaignScoresFromCloud
} from '../../core/lib/storeCampaignScoreService';
import {
    formatDate,
    getYesterdayDateString,
    isStoreMatch,
    getShortStoreName,
    calculateRemainingTarget,
    formatRemainingTarget
} from '../../core/lib/formatters';
import { useAuth } from '../../shared/contexts/AuthContext';
import { useUserStoreFilter } from '../../shared/hooks/useUserStoreFilter';
import ReportDataFreshnessBar from '../../shared/components/report/ReportDataFreshnessBar';
import {
    UserCheck,
    Store,
    Calendar,
    Search,
    Download,
    Camera,
    Copy,
    RefreshCw,
    Filter,
    ChevronLeft,
    ChevronRight,
    Trophy,
    ArrowLeft,
    Sparkles,
    CheckCircle2,
    AlertCircle,
    TrendingUp,
    Clock,
    Lock,
    Award,
    Target,
    Zap,
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    Users,
    X,
    Loader2,
    FileText,
    EyeOff,
    Layers
} from 'lucide-react';
import html2canvas from 'html2canvas';

interface CampaignDetailRow {
    stt: number;
    canonicalKey: string;
    displayName: string;
    unit: string;
    pointsWeight: number;        // Điểm chuẩn theo cấu hình
    target: number;             // Taget
    actual: number;             // L.Kế (Lũy kế)
    remaining: number;          // C.LẠI (Còn lại)
    realCompletionRate: number; // %HT (Lũy kế thực tế / Target * 100)
    completionRate: number;     // %DK (Dự kiến hoàn thành %DKHT)
    pointsEarned: number;       // +/-Điểm (điểm được tính)
    isAchieved: boolean;        // %DK >= 100%
}

// 2. HELPER MÀU SẮC ĐIỂM THI ĐUA THEO PHÂN CẤP ĐIỂM
export const getPointBadgeStyle = (points: number): string => {
    if (points >= 20) {
        return 'bg-purple-100 text-purple-900 border-purple-300 ring-1 ring-purple-400/40 font-black shadow-2xs';
    } else if (points >= 15) {
        return 'bg-indigo-100 text-indigo-900 border-indigo-300 ring-1 ring-indigo-400/40 font-black shadow-2xs';
    } else if (points >= 10) {
        return 'bg-blue-100 text-blue-900 border-blue-300 ring-1 ring-blue-400/40 font-black shadow-2xs';
    } else if (points >= 5) {
        return 'bg-amber-100 text-amber-900 border-amber-300 ring-1 ring-amber-400/40 font-black shadow-2xs';
    } else if (points >= 1) {
        return 'bg-teal-100 text-teal-900 border-teal-300 ring-1 ring-teal-400/40 font-bold shadow-2xs';
    }
    return 'bg-slate-100 text-slate-500 border-slate-200 font-medium';
};

export const getEarnedPointBadgeStyle = (points: number, isAchieved: boolean): string => {
    if (!isAchieved || points <= 0) {
        return 'bg-slate-100 text-slate-400 border-slate-200 font-bold';
    }
    if (points >= 20) {
        return 'bg-purple-600 text-white border-purple-700 shadow-xs font-black';
    } else if (points >= 15) {
        return 'bg-indigo-600 text-white border-indigo-700 shadow-xs font-black';
    } else if (points >= 10) {
        return 'bg-blue-600 text-white border-blue-700 shadow-xs font-black';
    } else if (points >= 5) {
        return 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs font-black';
    }
    return 'bg-emerald-600 text-white border-emerald-700 shadow-xs font-black';
};

// Helper format số tiếng Việt dùng chung
export const formatNumberVn = (val: number, decimals: number = 1): string => {
    if (val == null || isNaN(val)) return '0';
    if (Number.isInteger(val)) return val.toLocaleString('vi-VN');
    return val.toLocaleString('vi-VN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: decimals
    });
};

export default function EmployeeDetailReportPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const reportRef = useRef<HTMLDivElement>(null);

    // 1. STATE BỘ LỌC CỐT LÕI
    const [selectedMonth, setSelectedMonth] = useState<number>(() => {
        const m = searchParams.get('month');
        return m ? parseInt(m, 10) : new Date().getMonth() + 1;
    });

    const [selectedYear, setSelectedYear] = useState<number>(() => {
        const y = searchParams.get('year');
        return y ? parseInt(y, 10) : new Date().getFullYear();
    });

    const [selectedStore, setSelectedStore] = useState<string>(() => {
        return searchParams.get('store') || 'all';
    });

    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(() => {
        return searchParams.get('emp') || '';
    });

    const [selectedSessionId, setSelectedSessionId] = useState<string>(() => {
        return searchParams.get('session') || searchParams.get('sess') || '';
    });

    const [campaignFilterMode, setCampaignFilterMode] = useState<'TARGET_ONLY' | 'ALL' | 'UNACHIEVED' | 'ACHIEVED'>('TARGET_ONLY');

    // Sắp xếp bảng kết quả thi đua: Mặc định sắp xếp theo %DK (completionRate) giảm dần
    const [sortColumn, setSortColumn] = useState<
        'stt' | 'displayName' | 'pointsWeight' | 'target' | 'actual' | 'remaining' | 'realCompletionRate' | 'completionRate' | 'pointsEarned'
    >('completionRate');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    const handleSort = (col: typeof sortColumn) => {
        if (sortColumn === col) {
            setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
        } else {
            setSortColumn(col);
            if (col === 'displayName' || col === 'stt') {
                setSortDirection('asc');
            } else {
                setSortDirection('desc');
            }
        }
    };

    // 2. STATE DỮ LIỆU TỪ HỆ THỐNG
    const [stores, setStores] = useState<StoreItem[]>([]);
    const [employees, setEmployees] = useState<EmployeeItem[]>([]);
    const [campaignDict, setCampaignDict] = useState<CampaignDictItem[]>([]);
    const [revenueTargets, setRevenueTargets] = useState<Record<string, number>>({});
    const [campaignTargetsMap, setCampaignTargetsMap] = useState<Record<string, Record<string, number>>>({});
    const [sessions, setSessions] = useState<EmployeeDataSession[]>([]);

    const [loading, setLoading] = useState<boolean>(true);
    const [isExporting, setIsExporting] = useState<boolean>(false);
    const [exportResolution, setExportResolution] = useState<'4K' | '8K'>('8K');
    const [toastMessage, setToastMessage] = useState<string>('');

    // Cài đặt cấu hình xuất: Xuất All (kèm Ghi Chú Phân Tích) hoặc Loại Trừ Ghi Chú Phân Tích
    const [includeAnalysisSection, setIncludeAnalysisSection] = useState<boolean>(() => {
        const saved = localStorage.getItem('saleshub_employee_detail_include_analysis');
        return saved !== null ? saved === 'true' : true;
    });

    const handleToggleIncludeAnalysis = (val: boolean) => {
        setIncludeAnalysisSection(val);
        localStorage.setItem('saleshub_employee_detail_include_analysis', String(val));
        showToast(val ? 'Đã bật: Xuất All (kèm Ghi Chú Phân Tích)' : 'Đã chọn: Loại trừ Ghi Chú Phân Tích');
    };

    // State phục vụ xuất ảnh smartphone 16:10 (đơn lẻ & hàng loạt cho tất cả NV theo siêu thị)
    const [batchExport, setBatchExport] = useState<{
        isRunning: boolean;
        current: number;
        total: number;
        currentEmpName: string;
        isCancelled: boolean;
        logs: string[];
    }>({
        isRunning: false,
        current: 0,
        total: 0,
        currentEmpName: '',
        isCancelled: false,
        logs: []
    });
    const cancelBatchRef = useRef<boolean>(false);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 3500);
    };

    // Thông tin tài khoản người dùng & phân quyền
    const { currentUser, isAdmin, canConfigure } = useAuth();
    const isStaffUser = currentUser.role === 'NHAN_VIEN' && !isAdmin;
    const isLockedToEmployee = isStaffUser && Boolean(currentUser.employee_id);
    const canExportAllEmployees = isAdmin || canConfigure || ['ADMIN', 'QUAN_LY', 'TRUONG_CA'].includes(currentUser.role);

    // Phân quyền siêu thị theo tài khoản người dùng
    const { allowedStores, isLockedToSingleStore, canViewAllStores } = useUserStoreFilter(
        stores,
        selectedStore,
        setSelectedStore
    );

    // 3. TẢI DỮ LIỆU ĐỒNG BỘ
    const loadAllData = async () => {
        setLoading(true);
        try {
            const [storesRes, empsRes, dictRes, revTargetsRes, campTargetsRes, allSessions] = await Promise.all([
                fetchStores(),
                fetchEmployees(),
                fetchCampaignDictionary(),
                fetchEmployeeRevenueTargets(selectedMonth, selectedYear),
                fetchEmployeeCampaignTargets(selectedMonth, selectedYear),
                syncAndFetchEmployeeDataSessions({ month: selectedMonth, year: selectedYear }),
                syncStoreCampaignScoresFromCloud()
            ]);

            if (storesRes.success) setStores(storesRes.data);
            if (empsRes.success) setEmployees(empsRes.data);
            if (dictRes.success && dictRes.data) setCampaignDict(dictRes.data);

            // Parse Revenue Targets
            const revMap: Record<string, number> = {};
            if (revTargetsRes.success && revTargetsRes.data) {
                if (Array.isArray(revTargetsRes.data)) {
                    revTargetsRes.data.forEach((r: any) => {
                        if (r && r.employee_id != null) {
                            const raw = Number(r.target_revenue) || 0;
                            const key = String(r.employee_id).trim();
                            revMap[key] = raw >= 100_000 ? Number((raw / 1_000_000).toFixed(1)) : raw;
                        }
                    });
                } else if (typeof revTargetsRes.data === 'object') {
                    Object.entries(revTargetsRes.data).forEach(([k, v]) => {
                        const raw = Number(v) || 0;
                        revMap[k.trim()] = raw >= 100_000 ? Number((raw / 1_000_000).toFixed(1)) : raw;
                    });
                }
            }
            setRevenueTargets(revMap);

            // Parse Campaign Targets: [empId][rawKey] = targetValue
            const cMap: Record<string, Record<string, number>> = {};
            if (campTargetsRes.success && campTargetsRes.data) {
                campTargetsRes.data.forEach((row: any) => {
                    const empId = String(row.employee_id || '').trim();
                    const rawKey = String(row.raw_key || '').trim();
                    if (empId && rawKey) {
                        if (!cMap[empId]) cMap[empId] = {};
                        cMap[empId][rawKey] = Number(row.target_value) || 0;
                    }
                });
            }
            setCampaignTargetsMap(cMap);

            // Sessions
            setSessions(allSessions || []);
        } catch (err) {
            console.error('Lỗi khi tải dữ liệu chi tiết nhân viên:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAllData();
    }, [selectedMonth, selectedYear]);

    // 4. DANH SÁCH NHÂN VIÊN THEO PHẠM VI SIÊU THỊ ĐƯỢC CHỌN
    const availableEmployees = useMemo(() => {
        let list = employees;
        if (selectedStore !== 'all') {
            list = list.filter(e => isStoreMatch(e.store_name, selectedStore, stores));
        } else if (!canViewAllStores && allowedStores.length > 0) {
            list = list.filter(e => allowedStores.some(s => isStoreMatch(e.store_name, s.name, stores)));
        }
        return list.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
    }, [employees, selectedStore, stores, canViewAllStores, allowedStores]);

    // Tự động chọn nhân viên theo phân quyền hoặc Admin kiểm thử
    useEffect(() => {
        if (availableEmployees.length > 0) {
            // 1. Nếu là Nhân Viên hoặc Admin đang chọn nhân viên kiểm thử cụ thể
            if (currentUser.employee_id) {
                const matchedEmp = availableEmployees.find(e => e.employee_id === currentUser.employee_id);
                if (matchedEmp) {
                    if (isLockedToEmployee || !selectedEmployeeId || selectedEmployeeId !== matchedEmp.employee_id) {
                        setSelectedEmployeeId(matchedEmp.employee_id);
                        setSearchParams(prev => {
                            const p = new URLSearchParams(prev);
                            p.set('emp', matchedEmp.employee_id);
                            return p;
                        }, { replace: true });
                        return;
                    }
                }
            }

            // 2. Fallback nếu selectedEmployeeId chưa có hoặc không nằm trong danh sách
            const exists = availableEmployees.some(e => e.employee_id === selectedEmployeeId);
            if (!selectedEmployeeId || !exists) {
                const nextId = availableEmployees[0].employee_id;
                setSelectedEmployeeId(nextId);
                setSearchParams(prev => {
                    const p = new URLSearchParams(prev);
                    p.set('emp', nextId);
                    return p;
                }, { replace: true });
            }
        }
    }, [availableEmployees, selectedEmployeeId, currentUser.employee_id, isLockedToEmployee]);

    // Cập nhật URL khi đổi nhân viên hoặc siêu thị
    const handleSelectEmployee = (empId: string) => {
        setSelectedEmployeeId(empId);
        setSearchParams(prev => {
            const p = new URLSearchParams(prev);
            p.set('emp', empId);
            return p;
        }, { replace: true });
    };

    // Chuyển nhân viên kế tiếp / trước đó
    const handleNavigateEmployee = (direction: 'PREV' | 'NEXT') => {
        if (availableEmployees.length === 0) return;
        const currentIndex = availableEmployees.findIndex(e => e.employee_id === selectedEmployeeId);
        if (currentIndex === -1) return;

        let nextIndex = direction === 'NEXT' ? currentIndex + 1 : currentIndex - 1;
        if (nextIndex < 0) nextIndex = availableEmployees.length - 1;
        if (nextIndex >= availableEmployees.length) nextIndex = 0;

        const nextEmp = availableEmployees[nextIndex];
        if (nextEmp) {
            handleSelectEmployee(nextEmp.employee_id);
        }
    };

    // Nhân viên hiện tại được chọn
    const currentEmployee = useMemo(() => {
        return availableEmployees.find(e => e.employee_id === selectedEmployeeId) || null;
    }, [availableEmployees, selectedEmployeeId]);

    // 5. CẤU HÌNH HOẠT ĐỘNG SHOP (passedDays, operatingDays, ...)
    const operatingConfig = useMemo(() => {
        const storeForConfig = (currentEmployee?.store_name) || (selectedStore === 'all' ? 'ALL' : selectedStore);
        return getStoreOperatingConfig(storeForConfig, selectedMonth, selectedYear);
    }, [currentEmployee, selectedStore, selectedMonth, selectedYear]);

    // Cấu hình tính điểm thi đua của shop: xác định tính theo ĐIỂM (POINTS) hay SỐ CHƯƠNG TRÌNH (COUNT)
    const effectiveStoreName = useMemo(() => {
        return currentEmployee?.store_name || (selectedStore !== 'all' ? selectedStore : 'DEFAULT');
    }, [currentEmployee, selectedStore]);

    const scoreConfig = useMemo(() => {
        return getStoreCampaignScoreConfig(effectiveStoreName);
    }, [effectiveStoreName]);

    const isPointsMode = scoreConfig.scoring_mode === 'POINTS';

    // 6. DANH SÁCH PHIÊN DỮ LIỆU ĐƯỢC LỌC RÀNG BUỘC THEO SIÊU THỊ & NHÂN VIÊN
    const availableSessions = useMemo(() => {
        if (!selectedEmployeeId || sessions.length === 0) return [];
        const empId = selectedEmployeeId.trim();

        // Lọc các phiên thi đua / doanh thu có dữ liệu của nhân viên
        let list = sessions.filter(s => {
            // Loại trừ phiên chỉ thuần giờ công nếu đã có các phiên thi đua doanh thu
            if (s.session_type === 'WORK_HOURS') return false;

            // 1. Ràng buộc theo siêu thị (nếu có chọn cụ thể hoặc bị giới hạn quyền)
            if (selectedStore !== 'all') {
                const matchStore = isStoreMatch(s.store_name, selectedStore, stores) ||
                    s.store_name === 'Toàn Cụm Siêu Thị' ||
                    (currentEmployee && isStoreMatch(s.store_name, currentEmployee.store_name, stores));
                if (!matchStore) return false;
            } else if (!canViewAllStores && allowedStores.length > 0) {
                const matchAllowed = allowedStores.some(st => isStoreMatch(s.store_name, st.name, stores)) ||
                    s.store_name === 'Toàn Cụm Siêu Thị';
                if (!matchAllowed) return false;
            }

            // 2. Ràng buộc phiên BẮT BUỘC phải có bản ghi của nhân viên đang chọn
            return (s.records || []).some(r => (r.employee_id || '').trim() === empId);
        });

        // Fallback: nếu chưa có phiên REVENUE_CAMPAIGN nào nhưng có phiên khác chứa nhân viên
        if (list.length === 0) {
            list = sessions.filter(s => {
                if (selectedStore !== 'all') {
                    const matchStore = isStoreMatch(s.store_name, selectedStore, stores) ||
                        s.store_name === 'Toàn Cụm Siêu Thị' ||
                        (currentEmployee && isStoreMatch(s.store_name, currentEmployee.store_name, stores));
                    if (!matchStore) return false;
                } else if (!canViewAllStores && allowedStores.length > 0) {
                    const matchAllowed = allowedStores.some(st => isStoreMatch(s.store_name, st.name, stores)) ||
                        s.store_name === 'Toàn Cụm Siêu Thị';
                    if (!matchAllowed) return false;
                }
                return (s.records || []).some(r => (r.employee_id || '').trim() === empId);
            });
        }

        // Sắp xếp phiên mới nhất lên đầu
        return list.sort((a, b) => {
            const timeA = new Date(a.created_at || a.report_date || 0).getTime();
            const timeB = new Date(b.created_at || b.report_date || 0).getTime();
            return timeB - timeA;
        });
    }, [sessions, selectedStore, stores, canViewAllStores, allowedStores, selectedEmployeeId, currentEmployee]);

    // Tự động đồng bộ và chọn phiên dữ liệu hợp lệ
    useEffect(() => {
        if (availableSessions.length > 0) {
            const exists = availableSessions.some(s => s.id === selectedSessionId);
            if (!selectedSessionId || !exists) {
                const defaultSessId = availableSessions[0].id;
                setSelectedSessionId(defaultSessId);
                setSearchParams(prev => {
                    const p = new URLSearchParams(prev);
                    p.set('session', defaultSessId);
                    return p;
                }, { replace: true });
            }
        } else {
            if (selectedSessionId) {
                setSelectedSessionId('');
                setSearchParams(prev => {
                    const p = new URLSearchParams(prev);
                    p.delete('session');
                    return p;
                }, { replace: true });
            }
        }
    }, [availableSessions, selectedSessionId]);

    // Phiên dữ liệu đang hoạt động
    const activeSession = useMemo(() => {
        if (availableSessions.length === 0) return null;
        if (selectedSessionId) {
            const found = availableSessions.find(s => s.id === selectedSessionId);
            if (found) return found;
        }
        return availableSessions[0];
    }, [availableSessions, selectedSessionId]);

    // Chọn phiên từ dropdown
    const handleSelectSession = (sessionId: string) => {
        setSelectedSessionId(sessionId);
        setSearchParams(prev => {
            const p = new URLSearchParams(prev);
            if (sessionId) {
                p.set('session', sessionId);
            } else {
                p.delete('session');
            }
            return p;
        }, { replace: true });
    };

    // Bản ghi dữ liệu của nhân viên trong phiên đang chọn
    const employeeLatestSessionRecord = useMemo(() => {
        if (!selectedEmployeeId) return null;
        const empId = selectedEmployeeId.trim();

        // 1. Lấy trong phiên activeSession được người dùng chọn
        if (activeSession && activeSession.records) {
            const found = activeSession.records.find(r => (r.employee_id || '').trim() === empId);
            if (found) {
                return {
                    record: found,
                    session: activeSession
                };
            }
        }

        // 2. Fallback quét trong availableSessions
        for (const sess of availableSessions) {
            if (sess.records) {
                const found = sess.records.find(r => (r.employee_id || '').trim() === empId);
                if (found) {
                    return {
                        record: found,
                        session: sess
                    };
                }
            }
        }
        return null;
    }, [selectedEmployeeId, activeSession, availableSessions]);

    // Giờ công: nếu phiên thi đua không có giờ công thì đối chiếu tìm trong các phiên WORK_HOURS
    const resolvedWorkHours = useMemo(() => {
        const recHours = employeeLatestSessionRecord?.record?.work_hours;
        if (recHours && recHours > 0) return recHours;

        if (!selectedEmployeeId || sessions.length === 0) return 0;
        const empId = selectedEmployeeId.trim();

        for (const sess of sessions) {
            if (sess.session_type === 'WORK_HOURS' && sess.records) {
                const found = sess.records.find(r => (r.employee_id || '').trim() === empId);
                if (found && found.work_hours && found.work_hours > 0) {
                    return found.work_hours;
                }
            }
        }
        return 0;
    }, [employeeLatestSessionRecord, selectedEmployeeId, sessions]);

    // Xác định ngày báo cáo luỹ kế (từ phiên hoặc ngày đã trôi qua)
    const reportDateString = useMemo(() => {
        if (employeeLatestSessionRecord?.session?.report_date) {
            const raw = employeeLatestSessionRecord.session.report_date;
            const parts = raw.split('-');
            if (parts.length === 3) {
                return `${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[0]}`;
            }
            return raw;
        }
        const dayStr = String(operatingConfig.passedDays).padStart(2, '0');
        const monthStr = String(selectedMonth).padStart(2, '0');
        return `${dayStr}-${monthStr}-${selectedYear}`;
    }, [employeeLatestSessionRecord, operatingConfig.passedDays, selectedMonth, selectedYear]);

    // Số ngày đã trôi qua thực tế gắn liền với phiên được chọn
    const effectivePassedDays = useMemo(() => {
        if (employeeLatestSessionRecord?.session?.report_date) {
            const parts = employeeLatestSessionRecord.session.report_date.split('-');
            if (parts.length === 3) {
                const dayVal = parseInt(parts[2], 10);
                if (!isNaN(dayVal) && dayVal > 0) {
                    return Math.min(dayVal, operatingConfig.operatingDays);
                }
            }
        }
        return operatingConfig.passedDays;
    }, [employeeLatestSessionRecord, operatingConfig.passedDays, operatingConfig.operatingDays]);

    // 7. TÍNH TOÁN 6 CHỈ SỐ KPI TỔNG QUÁT CỦA NHÂN VIÊN
    const employeeKpis = useMemo(() => {
        const empId = selectedEmployeeId.trim();
        const targetQd = revenueTargets[empId] ?? 0;

        const rec = employeeLatestSessionRecord?.record;
        const revActual = rec?.revenue_actual ?? 0;
        const revQd = rec?.revenue_qd ?? 0;

        const passed = Math.max(1, effectivePassedDays);
        const totalDays = Math.max(1, operatingConfig.operatingDays);

        const realCompletionRate = targetQd > 0 ? Number(((revQd / targetQd) * 100).toFixed(0)) : 0;
        const forecastRevenue = passed > 0 ? (revQd / passed) * totalDays : revQd;
        const forecastCompletionRate = targetQd > 0 ? Number(((forecastRevenue / targetQd) * 100).toFixed(0)) : 0;

        const exchangeRate = revActual > 0
            ? Number((((revQd - revActual) / revActual) * 100).toFixed(0))
            : 0;

        const instRev = rec?.installment_revenue ?? 0;
        const installmentRate = revActual > 0 && instRev > 0
            ? Number(((instRev / revActual) * 100).toFixed(1))
            : (rec?.installment_rate ?? 0);

        const workHours = resolvedWorkHours;
        const prodQdPerHour = workHours > 0 ? Number((revQd / workHours).toFixed(2)) : 0;
        const bonusText = '-';

        return {
            targetQd,
            revenueQd: revQd,
            revenueActual: revActual,
            forecastCompletionRate,
            realCompletionRate,
            exchangeRate,
            installmentRate,
            workHours,
            prodQdPerHour,
            bonusText
        };
    }, [selectedEmployeeId, revenueTargets, employeeLatestSessionRecord, effectivePassedDays, operatingConfig, resolvedWorkHours]);

    // 8. TÍNH TOÁN CHI TIẾT CÁC NGÀNH HÀNG / THI ĐUA CỦA NHÂN VIÊN THEO CẤU HÌNH ĐIỂM
    const campaignDetailRows = useMemo<CampaignDetailRow[]>(() => {
        if (!selectedEmployeeId) return [];

        const empId = selectedEmployeeId.trim();
        const empTargets = campaignTargetsMap[empId] || {};
        const empCampaigns = employeeLatestSessionRecord?.record?.campaigns || {};

        const passed = Math.max(1, effectivePassedDays);
        const totalDays = Math.max(1, operatingConfig.operatingDays);

        const allKeys = new Set<string>();
        Object.keys(empTargets).forEach(k => allKeys.add(k.trim()));
        Object.keys(empCampaigns).forEach(k => allKeys.add(k.trim()));

        const canonicalGroups = new Map<string, {
            canonicalKey: string;
            displayName: string;
            unit: string;
            orderIndex: number;
            rawKeys: Set<string>;
        }>();

        allKeys.forEach(rawKey => {
            const resolved = resolveCanonicalCampaign(rawKey, campaignDict);
            const cKey = resolved.canonicalKey;

            if (!canonicalGroups.has(cKey)) {
                const dictItem = resolved.dictItem;
                canonicalGroups.set(cKey, {
                    canonicalKey: cKey,
                    displayName: dictItem?.display_name || cKey,
                    unit: dictItem?.unit || '',
                    orderIndex: dictItem?.order_index ?? dictItem?.sort_order ?? 999,
                    rawKeys: new Set<string>()
                });
            }
            canonicalGroups.get(cKey)!.rawKeys.add(rawKey);
        });

        const rows: CampaignDetailRow[] = [];
        let index = 1;

        canonicalGroups.forEach((group, cKey) => {
            const aliasKeys = Array.from(group.rawKeys);

            // 1. Taget: Tìm trong empTargets
            let targetVal = Number(empTargets[cKey]) || 0;
            if (targetVal <= 0) {
                for (const alias of aliasKeys) {
                    const v = Number(empTargets[alias]) || 0;
                    if (v > 0) {
                        targetVal = v;
                        break;
                    }
                }
            }

            // 2. L.Kế: Tìm trong empCampaigns
            let actualVal = 0;
            if (empCampaigns[cKey] !== undefined) {
                actualVal = Number(empCampaigns[cKey]) || 0;
            } else {
                for (const alias of aliasKeys) {
                    if (empCampaigns[alias] !== undefined) {
                        actualVal = Number(empCampaigns[alias]) || 0;
                        break;
                    }
                }
            }

            if (actualVal === 0) {
                for (const [sessKey, sessVal] of Object.entries(empCampaigns)) {
                    const sessResolved = resolveCanonicalCampaign(sessKey, campaignDict);
                    if (sessResolved.canonicalKey === cKey) {
                        actualVal = Number(sessVal) || 0;
                        break;
                    }
                }
            }

            // 3. %HT (Thực tế) và %DK (Dự kiến)
            let forecastRate = 0;
            let realRate = 0;
            if (targetVal > 0) {
                const forecastVal = (actualVal / passed) * totalDays;
                forecastRate = Math.round((forecastVal / targetVal) * 100);
                realRate = Math.round((actualVal / targetVal) * 100);
            } else if (actualVal > 0) {
                forecastRate = 100;
                realRate = 100;
            }

            // 4. C.LẠI: nếu thực tế đã hoàn thành mục tiêu (actualVal >= targetVal) -> 0, chưa đạt -> targetVal - actualVal (số dương)
            const remaining = calculateRemainingTarget(targetVal, actualVal, 1);

            // 5. Điểm và +/-Điểm: Nếu %DK >= 100% -> Có trọn vẹn điểm, ngược lại 0 điểm
            const pointsWeight = getCampaignPoints(cKey, scoreConfig);
            const isAchieved = forecastRate >= 100;
            const pointsEarned = isAchieved ? pointsWeight : 0;

            rows.push({
                stt: index++,
                canonicalKey: cKey,
                displayName: group.displayName,
                unit: group.unit,
                pointsWeight: pointsWeight,
                target: targetVal,
                actual: actualVal,
                remaining: remaining,
                realCompletionRate: realRate,
                completionRate: forecastRate,
                pointsEarned: pointsEarned,
                isAchieved: isAchieved
            });
        });

        // Sắp xếp mặc định danh sách gốc theo % Dự Kiến Hoàn Thành (%DK) giảm dần
        rows.sort((a, b) => {
            const aHasTarget = a.target > 0 ? 1 : 0;
            const bHasTarget = b.target > 0 ? 1 : 0;
            if (bHasTarget !== aHasTarget) {
                return bHasTarget - aHasTarget;
            }
            if (b.completionRate !== a.completionRate) {
                return b.completionRate - a.completionRate;
            }
            if (b.realCompletionRate !== a.realCompletionRate) {
                return b.realCompletionRate - a.realCompletionRate;
            }
            if (b.actual !== a.actual) {
                return b.actual - a.actual;
            }
            return a.displayName.localeCompare(b.displayName);
        });

        // Đánh lại STT sau khi sắp xếp theo %DK giảm dần
        rows.forEach((r, idx) => {
            r.stt = idx + 1;
        });

        return rows;
    }, [selectedEmployeeId, campaignTargetsMap, employeeLatestSessionRecord, effectivePassedDays, operatingConfig, campaignDict, scoreConfig]);

    // 9. LỌC CÁC DÒNG THEO CHẾ ĐỘ & SẮP XẾP THEO CỘT (MẶC ĐỊNH %DK GIẢM DẦN)
    const filteredCampaignRows = useMemo(() => {
        let list = [...campaignDetailRows];

        if (campaignFilterMode === 'TARGET_ONLY') {
            list = list.filter(r => r.target > 0);
        } else if (campaignFilterMode === 'ACHIEVED') {
            list = list.filter(r => r.isAchieved);
        } else if (campaignFilterMode === 'UNACHIEVED') {
            list = list.filter(r => !r.isAchieved && r.target > 0);
        }

        // Sắp xếp linh hoạt theo cột được chọn (mặc định là %DK giảm dần)
        list.sort((a, b) => {
            if (sortColumn === 'completionRate') {
                const diff = b.completionRate - a.completionRate;
                if (diff !== 0) return sortDirection === 'desc' ? diff : -diff;
                return b.realCompletionRate - a.realCompletionRate || b.actual - a.actual;
            }
            if (sortColumn === 'realCompletionRate') {
                const diff = b.realCompletionRate - a.realCompletionRate;
                if (diff !== 0) return sortDirection === 'desc' ? diff : -diff;
                return b.completionRate - a.completionRate;
            }
            if (sortColumn === 'target') {
                const diff = b.target - a.target;
                if (diff !== 0) return sortDirection === 'desc' ? diff : -diff;
                return b.completionRate - a.completionRate;
            }
            if (sortColumn === 'actual') {
                const diff = b.actual - a.actual;
                if (diff !== 0) return sortDirection === 'desc' ? diff : -diff;
                return b.completionRate - a.completionRate;
            }
            if (sortColumn === 'remaining') {
                const diff = b.remaining - a.remaining;
                if (diff !== 0) return sortDirection === 'desc' ? diff : -diff;
                return b.completionRate - a.completionRate;
            }
            if (sortColumn === 'pointsWeight') {
                const diff = b.pointsWeight - a.pointsWeight;
                if (diff !== 0) return sortDirection === 'desc' ? diff : -diff;
                return b.completionRate - a.completionRate;
            }
            if (sortColumn === 'pointsEarned') {
                const diff = b.pointsEarned - a.pointsEarned;
                if (diff !== 0) return sortDirection === 'desc' ? diff : -diff;
                return b.completionRate - a.completionRate;
            }
            if (sortColumn === 'displayName') {
                return sortDirection === 'asc'
                    ? a.displayName.localeCompare(b.displayName)
                    : b.displayName.localeCompare(a.displayName);
            }
            // stt
            return sortDirection === 'asc' ? a.stt - b.stt : b.stt - a.stt;
        });

        return list;
    }, [campaignDetailRows, campaignFilterMode, sortColumn, sortDirection]);

    // 10. TỔNG KẾT KẾT QUẢ TỔNG (THEO ĐIỂM HOẶC SỐ CHƯƠNG TRÌNH ĐẠT TÙY CẤU HÌNH SIÊU THỊ)
    const campaignSummaryStats = useMemo(() => {
        const rowsWithTarget = campaignDetailRows.filter(r => r.target > 0);
        const total = rowsWithTarget.length;
        const achieved = rowsWithTarget.filter(r => r.isAchieved).length;
        const pct = total > 0 ? Math.round((achieved / total) * 100) : 0;

        // Tổng điểm theo cấu hình shop
        const totalPoints = rowsWithTarget.reduce((sum, r) => sum + r.pointsWeight, 0);
        const achievedPoints = rowsWithTarget.reduce((sum, r) => sum + r.pointsEarned, 0);
        const pointsPct = totalPoints > 0 ? Math.round((achievedPoints / totalPoints) * 100) : 0;

        // Tổng sản lượng
        const totalTarget = rowsWithTarget.reduce((sum, r) => sum + r.target, 0);
        const totalActual = rowsWithTarget.reduce((sum, r) => sum + r.actual, 0);
        const totalRemaining = rowsWithTarget.reduce((sum, r) => sum + r.remaining, 0);

        return {
            isPointsMode,
            total,
            achieved,
            percentage: pct,
            totalPoints,
            achievedPoints,
            pointsPercentage: pointsPct,
            totalTarget,
            totalActual,
            totalRemaining
        };
    }, [campaignDetailRows, isPointsMode]);

    // 11. XUẤT ẢNH CHẤT LƯỢNG SIÊU NÉT (4K / 8K) THEO ĐÚNG SCREEN CHO BÁO CÁO CHI TIẾT (KHÔNG GIỚI HẠN CHIỀU DÀI)
    const generateCanvas = async (): Promise<HTMLCanvasElement | null> => {
        if (!reportRef.current) return null;

        const originalEl = reportRef.current;
        if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
        }

        // Chờ 2 frame render của browser để đảm bảo DOM layout, font và bounding box ổn định 100%
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

        const scale = exportResolution === '8K' ? 4 : 2.5;
        const contentWidth = Math.max(originalEl.offsetWidth, 640);

        try {
            return await html2canvas(originalEl, {
                scale: scale,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                logging: false,
                width: contentWidth,
                windowWidth: contentWidth + 60,
                scrollX: 0,
                scrollY: 0,
                ignoreElements: (el) =>
                    el.getAttribute('data-html2canvas-ignore') === 'true' ||
                    el.getAttribute('data-export-ignore') === 'true' ||
                    el.getAttribute('data-freshness-bar') === 'true',
                // KHÔNG giới hạn height và windowHeight để html2canvas tự động mở rộng theo toàn bộ chiều dài tự nhiên của báo cáo
                onclone: (clonedDoc) => {
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
                        img { display: inline-block !important; }
                        td, th { vertical-align: middle !important; }
                        [data-report-container="true"] * { overflow: visible !important; }
                    `;
                    clonedDoc.head.appendChild(fontStyle);

                    // Gỡ bỏ hoàn toàn giới hạn chiều cao ở cấp tài liệu và body
                    clonedDoc.documentElement.style.height = 'auto';
                    clonedDoc.documentElement.style.maxHeight = 'none';
                    clonedDoc.documentElement.style.overflow = 'visible';
                    clonedDoc.body.style.height = 'auto';
                    clonedDoc.body.style.maxHeight = 'none';
                    clonedDoc.body.style.overflow = 'visible';

                    const clonedReport = clonedDoc.querySelector('[data-report-container="true"]') as HTMLElement;
                    if (clonedReport) {
                        // Loại bỏ khối trạng thái dữ liệu và các nút thao tác khỏi ảnh xuất
                        clonedReport.querySelectorAll('[data-html2canvas-ignore="true"], [data-export-ignore="true"], [data-freshness-bar="true"]').forEach(el => {
                            (el as HTMLElement).remove();
                        });

                        clonedReport.style.width = `${contentWidth}px`;
                        clonedReport.style.maxWidth = `${contentWidth}px`;
                        clonedReport.style.height = 'auto';
                        clonedReport.style.minHeight = 'auto';
                        clonedReport.style.maxHeight = 'none';
                        clonedReport.style.overflow = 'visible';
                        clonedReport.style.paddingBottom = '36px'; // Khoảng đệm thoáng đãng ở đáy báo cáo
                        clonedReport.style.backgroundColor = '#ffffff';
                        clonedReport.style.fontFamily = "'UTM Avo', 'Avo', sans-serif";

                        // Mở rộng tất cả container cuộn bên trong để không bị giới hạn chiều cao
                        clonedReport.querySelectorAll<HTMLElement>('.overflow-x-auto, .overflow-y-auto, [class*="max-h-"]').forEach(el => {
                            el.style.maxHeight = 'none';
                            el.style.overflow = 'visible';
                            el.style.overflowX = 'visible';
                            el.style.overflowY = 'visible';
                            el.style.height = 'auto';
                        });
                    }
                }
            });
        } catch (err) {
            console.error('Lỗi khi vẽ canvas ảnh báo cáo:', err);
            return null;
        }
    };

    // Tải file ảnh về máy
    const handleDownloadImage = async () => {
        setIsExporting(true);
        try {
            const canvas = await generateCanvas();
            if (!canvas) {
                showToast('❌ Không thể khởi tạo ảnh báo cáo');
                return;
            }
            const link = document.createElement('a');
            const empNameClean = cleanEmployeeName(currentEmployee?.full_name || 'NhanVien');
            link.download = `ChiTietNV_${empNameClean}_${selectedEmployeeId}_T${selectedMonth}_${selectedYear}_${exportResolution}.png`;
            link.href = canvas.toDataURL('image/png', 1.0);
            link.click();
            showToast(`✅ Đã tải file ảnh ${exportResolution} thành công!`);
        } catch (e: any) {
            showToast(`❌ Lỗi xuất ảnh: ${e.message}`);
        } finally {
            setIsExporting(false);
        }
    };

    // Copy ảnh vào clipboard để dán Messaging App
    const handleCopyImageToClipboard = async () => {
        setIsExporting(true);
        try {
            const canvas = await generateCanvas();
            if (!canvas) {
                showToast('❌ Không thể khởi tạo canvas');
                return;
            }

            canvas.toBlob(async (blob) => {
                if (!blob) {
                    showToast('❌ Không thể nén ảnh blob');
                    return;
                }
                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    showToast(`✅ Đã copy ảnh ${exportResolution} vào bộ nhớ tạm! Bạn có thể dán (Ctrl + V) ngay vào Messaging App.`);
                } catch (clipErr) {
                    const link = document.createElement('a');
                    link.download = `ChiTietNV_${selectedEmployeeId}.png`;
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                    showToast('⚠️ Trình duyệt chặn copy trực tiếp, đã tự động tải file ảnh về máy!');
                }
            }, 'image/png', 1.0);
        } catch (e: any) {
            showToast(`❌ Lỗi copy ảnh: ${e.message}`);
        } finally {
            setIsExporting(false);
        }
    };

    // Xuất ảnh theo chuẩn Screen cho TẤT CẢ nhân viên trong siêu thị được chọn
    const handleBatchExportAllStore = async () => {
        if (!canExportAllEmployees) {
            showToast('⚠️ Bạn không có quyền xuất ảnh báo cáo toàn bộ nhân viên!');
            return;
        }

        if (availableEmployees.length === 0) {
            showToast('⚠️ Không có nhân viên nào trong danh sách siêu thị được chọn!');
            return;
        }

        const storeNameDisplay = selectedStore === 'all' ? 'Tất cả siêu thị' : getShortStoreName(selectedStore);
        const configDisplay = includeAnalysisSection ? 'Xuất All' : 'Loại trừ Phân Tích';
        const confirmMsg = `Bạn có muốn xuất ảnh báo cáo chất lượng ${exportResolution} (${configDisplay}) cho toàn bộ ${availableEmployees.length} nhân viên của "${storeNameDisplay}" không?`;
        if (!window.confirm(confirmMsg)) return;

        const originalEmployeeId = selectedEmployeeId;
        cancelBatchRef.current = false;
        setBatchExport({
            isRunning: true,
            current: 0,
            total: availableEmployees.length,
            currentEmpName: availableEmployees[0]?.full_name || '',
            isCancelled: false,
            logs: [`Bắt đầu xuất ${availableEmployees.length} nhân viên...`]
        });

        try {
            let successCount = 0;
            for (let i = 0; i < availableEmployees.length; i++) {
                if (cancelBatchRef.current) {
                    break;
                }

                const emp = availableEmployees[i];
                const empNameClean = cleanEmployeeName(emp.full_name || emp.employee_id);

                setBatchExport(prev => ({
                    ...prev,
                    current: i + 1,
                    currentEmpName: `${emp.full_name || emp.employee_id} (${emp.employee_id})`,
                    logs: [...prev.logs.slice(-8), `[${i + 1}/${availableEmployees.length}] Đang xuất: ${emp.full_name}...`]
                }));

                // Chọn nhân viên trên screen để React re-render toàn bộ card báo cáo
                setSelectedEmployeeId(emp.employee_id);
                // Chờ React re-render DOM và tính toán lại layout đầy đủ cho nhân viên mới
                await new Promise(r => setTimeout(r, 380));
                // Chờ browser hoàn tất reflow và repaint
                await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

                const canvas = await generateCanvas();
                if (canvas) {
                    const link = document.createElement('a');
                    const sttPrefix = String(i + 1).padStart(2, '0');
                    link.download = `${sttPrefix}_ChiTietNV_${empNameClean}_${emp.employee_id}_T${selectedMonth}_${selectedYear}_${exportResolution}.png`;
                    link.href = canvas.toDataURL('image/png', 1.0);
                    link.click();
                    successCount++;
                }

                // Chờ ngắn giữa các file để tránh trình duyệt nghẽn queue tải file
                await new Promise(r => setTimeout(r, 350));
            }

            if (!cancelBatchRef.current) {
                showToast(`🎉 Đã xuất thành công ${successCount}/${availableEmployees.length} ảnh báo cáo ${exportResolution}!`);
            } else {
                showToast(`⚠️ Đã dừng xuất ảnh. Đã tải ${successCount} ảnh.`);
            }
        } catch (err: any) {
            showToast(`❌ Lỗi xuất ảnh hàng loạt: ${err.message}`);
        } finally {
            if (originalEmployeeId) {
                setSelectedEmployeeId(originalEmployeeId);
            }
            setTimeout(() => {
                setBatchExport(prev => ({ ...prev, isRunning: false }));
            }, 1000);
        }
    };

    const handleCancelBatchExport = () => {
        cancelBatchRef.current = true;
        setBatchExport(prev => ({ ...prev, isCancelled: true }));
    };

    // Copy tóm tắt Messaging App
    const handleCopyZaloSummary = () => {
        const empName = currentEmployee?.full_name || selectedEmployeeId;
        const storeName = currentEmployee?.store_name || selectedStore;

        const summaryText = isPointsMode
            ? `🎯 ĐIỂM THI ĐUA DK: ${campaignSummaryStats.achievedPoints}/${campaignSummaryStats.totalPoints} ĐIỂM (${campaignSummaryStats.pointsPercentage}%)`
            : `🎯 THI ĐUA DK: ${campaignSummaryStats.achieved}/${campaignSummaryStats.total} (${campaignSummaryStats.percentage}%)`;

        let text = `⚡NHÂN VIÊN: ${empName.toUpperCase()} - ${selectedEmployeeId}\n`;
        text += `🏢 ${storeName}\n`;
        text += `📅 Luỹ kế đến hết: ${reportDateString}\n`;
        text += `${summaryText}\n\n`;

        text += `📊 CHỈ SỐ DOANH THU:\n`;
        text += `• Target QĐ: ${employeeKpis.targetQd.toLocaleString('vi-VN')} tr\n`;
        text += `• DTQĐ: ${employeeKpis.revenueQd.toLocaleString('vi-VN')} tr (${employeeKpis.forecastCompletionRate}% DKHT)\n`;
        text += `• % Quy đổi: ${employeeKpis.exchangeRate}%\n`;
        text += `• Tỷ lệ trả chậm: ${employeeKpis.installmentRate}%\n`;
        if (employeeKpis.workHours > 0) {
            text += `• Giờ công: ${employeeKpis.workHours}h (Năng suất: ${employeeKpis.prodQdPerHour} tr/h)\n`;
        }

        text += `\n🏆 TIẾN ĐỘ THI ĐUA:\n`;
        filteredCampaignRows.forEach((r, idx) => {
            const icon = r.isAchieved ? '✅' : '⏳';
            const scorePart = isPointsMode ? ` | Điểm: +${r.pointsEarned}/${r.pointsWeight} đ` : (r.isAchieved ? ' | +1 Đạt' : ' | 0');
            text += `${icon} #${idx + 1} ${r.displayName}: L.Kế ${r.actual.toLocaleString('vi-VN')} / Taget ${r.target.toLocaleString('vi-VN')}`;
            if (r.remaining > 0) {
                text += ` (Còn lại: ${r.remaining.toLocaleString('vi-VN')})`;
            }
            text += ` | %DK: ${r.completionRate}%\n`;
        });

        navigator.clipboard.writeText(text);
        showToast('📋 Đã copy nội dung tóm tắt Messaging App vào bộ nhớ tạm!');
    };

    return (
        <div className="space-y-6 pb-12 font-avo">
            {/* Toast Thông Báo */}
            {toastMessage && (
                <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-top-3">
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* 1. THANH ĐIỀU HƯỚNG & HÀNH ĐỘNG HỆ THỐNG */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/bao-cao-hieu-qua-nhan-vien')}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                        title="Quay lại Báo Cáo Hiệu Quả Nhân Viên"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span className="hidden sm:inline">Quay Lại Bảng Hiệu Quả</span>
                    </button>

                    <div className="h-6 w-px bg-slate-200" />

                    <div>
                        <h1 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                            <UserCheck className="w-5 h-5 text-emerald-600" />
                            <span>Báo Cáo Chi Tiết Nhân Viên</span>
                        </h1>
                        <p className="text-xs text-slate-500 hidden sm:block">
                            Luỹ kế doanh thu, tiến độ thi đua & phân tích hiệu quả từng nhân sự
                        </p>
                    </div>
                </div>

                {/* Các nút Xuất Báo Cáo */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Toggle Độ Phân Giải */}
                    <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-[11px] font-bold">
                        <button
                            type="button"
                            onClick={() => setExportResolution('4K')}
                            className={`px-2 py-1 rounded-lg transition cursor-pointer ${exportResolution === '4K'
                                ? 'bg-white text-slate-900 shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            4K
                        </button>
                        <button
                            type="button"
                            onClick={() => setExportResolution('8K')}
                            className={`px-2 py-1 rounded-lg transition cursor-pointer ${exportResolution === '8K'
                                ? 'bg-amber-400 text-amber-950 font-black shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            8K Ultra
                        </button>
                    </div>

                    {/* Cài đặt cấu hình: Xuất All hoặc Loại trừ Ghi Chú Phân Tích */}
                    <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-[11px] font-bold border border-slate-200">
                        <button
                            type="button"
                            onClick={() => handleToggleIncludeAnalysis(true)}
                            className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${includeAnalysisSection
                                ? 'bg-emerald-600 text-white shadow-2xs font-black'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                            title="Xuất All: Bao gồm Bảng Kết Quả và Ghi Chú Phân Tích Hiệu Quả Cá Nhân"
                        >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Xuất All</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleToggleIncludeAnalysis(false)}
                            className={`px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 ${!includeAnalysisSection
                                ? 'bg-slate-800 text-amber-300 shadow-2xs font-black'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                            title="Loại trừ Ghi Chú Phân Tích: Chỉ xuất Bảng & KPI, giúp hình ảnh ngắn gọn nhất"
                        >
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>Loại trừ Phân Tích</span>
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={handleCopyImageToClipboard}
                        disabled={isExporting || batchExport.isRunning}
                        className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-blue-200 shadow-2xs"
                        title="Copy ảnh độ nét cao vào Clipboard để dán trực tiếp vào Messaging App"
                    >
                        <Copy className="w-4 h-4 text-blue-600" />
                        <span>{isExporting ? `Đang xuất ${exportResolution}...` : `Copy Ảnh`}</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleDownloadImage}
                        disabled={isExporting || batchExport.isRunning}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-slate-200"
                        title="Tải ảnh PNG độ nét cao về máy"
                    >
                        <Camera className="w-4 h-4 text-slate-600" />
                        <span>Tải Ảnh</span>
                    </button>

                    {/* NÚT XUẤT ẢNH HÀNG LOẠT CHO TẤT CẢ NHÂN VIÊN CỦA SHOP (THEO SCREEN) (Chỉ hiển thị với Admin/QL/TC) */}
                    {canExportAllEmployees && (
                        <button
                            type="button"
                            onClick={handleBatchExportAllStore}
                            disabled={isExporting || batchExport.isRunning}
                            className="px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                            title={`Xuất ảnh báo cáo theo screen (${exportResolution}) cho tất cả ${availableEmployees.length} nhân viên trong siêu thị được chọn`}
                        >
                            {batchExport.isRunning ? (
                                <Loader2 className="w-4 h-4 animate-spin text-white" />
                            ) : (
                                <Users className="w-4 h-4 text-amber-300" />
                            )}
                            <span>Xuất Tất Cả NV ({exportResolution})</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={handleCopyZaloSummary}
                        className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                        title="Copy tóm tắt kết quả dạng văn bản gửi Messaging App"
                    >
                        <Sparkles className="w-4 h-4" />
                        <span>Copy Nhận xét</span>
                    </button>
                </div>
            </div>

            {/* 2. THANH BỘ LỌC THỜI GIAN, SIÊU THỊ & CHỌN NHÂN VIÊN */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Chọn Siêu Thị */}
                    <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold ${isLockedToSingleStore
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
                            disabled={isLockedToSingleStore}
                            onChange={e => {
                                const newStore = e.target.value;
                                setSelectedStore(newStore);
                                setSearchParams(prev => {
                                    const p = new URLSearchParams(prev);
                                    p.set('store', newStore);
                                    return p;
                                });
                            }}
                            className="bg-transparent text-xs font-bold outline-hidden cursor-pointer disabled:cursor-not-allowed max-w-[200px] truncate"
                        >
                            {canViewAllStores && <option value="all">🏢 Toàn Cụm Siêu Thị</option>}
                            {allowedStores.map(s => (
                                <option key={s.id || s.name} value={s.name}>
                                    {getShortStoreName(s.name)}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Chọn Tháng */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
                        <Calendar className="w-4 h-4 text-blue-600" />
                        <select
                            value={selectedMonth}
                            onChange={e => {
                                const m = parseInt(e.target.value, 10);
                                setSelectedMonth(m);
                                setSearchParams(prev => {
                                    const p = new URLSearchParams(prev);
                                    p.set('month', String(m));
                                    return p;
                                });
                            }}
                            className="bg-transparent text-xs font-bold text-slate-800 outline-hidden cursor-pointer"
                        >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                <option key={m} value={m}>Tháng {m}</option>
                            ))}
                        </select>
                    </div>

                    {/* Chọn Năm */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
                        <select
                            value={selectedYear}
                            onChange={e => {
                                const y = parseInt(e.target.value, 10);
                                setSelectedYear(y);
                                setSearchParams(prev => {
                                    const p = new URLSearchParams(prev);
                                    p.set('year', String(y));
                                    return p;
                                });
                            }}
                            className="bg-transparent text-xs font-bold text-slate-800 outline-hidden cursor-pointer"
                        >
                            {[2025, 2026, 2027].map(y => (
                                <option key={y} value={y}>Năm {y}</option>
                            ))}
                        </select>
                    </div>

                    {/* Chọn Nhân Viên Dropdown + Quick Prev / Next */}
                    <div className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border transition ${isLockedToEmployee
                        ? 'bg-amber-50/90 border-amber-300 text-amber-950 shadow-2xs'
                        : 'bg-emerald-50 border-emerald-200'
                        }`}>
                        {isLockedToEmployee ? (
                            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                        ) : (
                            <UserCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                        )}
                        <button
                            type="button"
                            disabled={isLockedToEmployee}
                            onClick={() => handleNavigateEmployee('PREV')}
                            className="p-1 hover:bg-emerald-100 rounded-lg text-emerald-800 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            title={isLockedToEmployee ? 'Vai trò Nhân Viên chỉ được xem dữ liệu cá nhân' : 'Xem nhân viên trước đó'}
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>

                        <select
                            value={selectedEmployeeId}
                            disabled={isLockedToEmployee}
                            onChange={e => handleSelectEmployee(e.target.value)}
                            className="bg-transparent text-xs font-black text-emerald-950 outline-hidden cursor-pointer disabled:cursor-not-allowed max-w-[240px] truncate"
                        >
                            {availableEmployees.map(emp => (
                                <option key={emp.employee_id} value={emp.employee_id}>
                                    {emp.employee_id} - {cleanEmployeeName(emp.full_name)}
                                </option>
                            ))}
                        </select>

                        <button
                            type="button"
                            disabled={isLockedToEmployee}
                            onClick={() => handleNavigateEmployee('NEXT')}
                            className="p-1 hover:bg-emerald-100 rounded-lg text-emerald-800 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            title={isLockedToEmployee ? 'Vai trò Nhân Viên chỉ được xem dữ liệu cá nhân' : 'Xem nhân viên kế tiếp'}
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>

                        {isLockedToEmployee && (
                            <span className="hidden xl:inline text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded ml-1">
                                Cá nhân
                            </span>
                        )}
                    </div>

                    {/* Chọn Phiên Dữ Liệu (Ràng buộc Siêu Thị & Nhân Viên) */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold min-w-[220px] max-w-full flex-1 sm:flex-initial">
                        <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span className="text-slate-500 shrink-0">Phiên:</span>
                        <select
                            value={selectedSessionId || activeSession?.id || ''}
                            onChange={e => handleSelectSession(e.target.value)}
                            disabled={availableSessions.length === 0}
                            className="bg-transparent text-xs font-bold text-slate-800 outline-hidden cursor-pointer disabled:cursor-not-allowed flex-1 min-w-0 truncate"
                            title="Chọn phiên cập nhật số liệu cần xem (ràng buộc theo siêu thị và nhân viên)"
                        >
                            {availableSessions.length === 0 ? (
                                <option value="">Chưa có phiên dữ liệu cho NV này</option>
                            ) : (
                                availableSessions.map(s => {
                                    const storeLabel = s.store_name === 'Toàn Cụm Siêu Thị'
                                        ? 'Toàn Cụm'
                                        : (getShortStoreName(s.store_name) || s.store_name || 'Shop');
                                    const dateLabel = s.report_date ? formatDate(s.report_date) : (s.created_at ? formatDate(s.created_at) : '');
                                    return (
                                        <option key={s.id} value={s.id}>
                                            [{storeLabel}] Phiên ngày {dateLabel}
                                        </option>
                                    );
                                })
                            )}
                        </select>
                        {availableSessions.length > 0 && (
                            <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full shrink-0">
                                {availableSessions.length} phiên
                            </span>
                        )}
                    </div>

                    {/* Bộ lọc chế độ hiển thị ngành hàng */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
                        <Filter className="w-4 h-4 text-amber-600" />
                        <select
                            value={campaignFilterMode}
                            onChange={e => setCampaignFilterMode(e.target.value as any)}
                            className="bg-transparent text-xs font-bold text-slate-800 outline-hidden cursor-pointer"
                        >
                            <option value="TARGET_ONLY">🎯 Chỉ ngành hàng có Taget ({campaignDetailRows.filter(r => r.target > 0).length})</option>
                            <option value="ALL">📋 Tất cả ngành hàng ({campaignDetailRows.length})</option>
                            <option value="UNACHIEVED">⏳ Chưa đạt ({campaignDetailRows.filter(r => !r.isAchieved && r.target > 0).length})</option>
                            <option value="ACHIEVED">✅ Đã đạt ({campaignDetailRows.filter(r => r.isAchieved).length})</option>
                        </select>
                    </div>

                    {/* Chỉ báo Chế độ Tính Điểm Thi Đua của Siêu Thị */}
                    <div className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-black flex items-center gap-1.5 ${isPointsMode
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-900'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        }`}>
                        <Award className="w-3.5 h-3.5" />
                        <span>{isPointsMode ? 'Tính theo Tổng Điểm đạt' : 'Tính theo Số CT đạt'}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={loadAllData}
                        className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition cursor-pointer flex items-center gap-1 text-xs font-bold"
                        title="Tải lại số liệu"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
                        <span className="hidden sm:inline">Làm Mới</span>
                    </button>
                </div>
            </div>

            {/* Cảnh báo nếu không có phiên dữ liệu nào cho nhân viên đang chọn */}
            {availableSessions.length === 0 && !loading && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-800 flex items-center gap-2.5 shadow-2xs">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                        <div className="font-bold">Chưa có phiên dữ liệu thi đua / doanh thu cho nhân viên này</div>
                        <div className="text-[11px] text-amber-700 mt-0.5">
                            Nhân viên <strong>{currentEmployee ? cleanEmployeeName(currentEmployee.full_name) : selectedEmployeeId}</strong> ({selectedEmployeeId}) chưa có số liệu trong các phiên của Tháng {selectedMonth}/{selectedYear}. Vui lòng kiểm tra lại siêu thị hoặc cập nhật số liệu phiên tại phân hệ Quản lý Phiên.
                        </div>
                    </div>
                </div>
            )}

            {/* 3. KHU VỰC BÁO CÁO CHÍNH - XUẤT ẢNH CHUẨN SCREEN CHO SMARTPHONE */}
            <div className="flex justify-center w-full">
                <div
                    ref={reportRef}
                    data-report-container="true"
                    className="w-full max-w-[660px] bg-white rounded-3xl p-4 sm:p-5 pb-8 border border-slate-200/90 shadow-sm space-y-4 font-avo"
                >
                    {/* THANH TRẠNG THÁI CẬP NHẬT PHIÊN DỮ LIỆU */}
                    <ReportDataFreshnessBar
                        latestDataDate={employeeLatestSessionRecord?.session?.report_date}
                        expectedDate={getYesterdayDateString()}
                        sessionTitle={employeeLatestSessionRecord?.session?.session_title}
                        lastUpdatedAt={employeeLatestSessionRecord?.session?.created_at}
                        lastUpdatedBy={employeeLatestSessionRecord?.session?.created_by}
                        storeName={selectedStore}
                        actionUrl="/cap-nhat-luy-ke-nhan-vien"
                        actionLabel="Cập nhật số liệu NV"
                        canUpdate={canConfigure || isAdmin}
                    />

                    {/* 3.1. HERO HEADER BANNER */}
                    <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-emerald-600/50 text-center relative overflow-hidden">
                        <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none" />
                        <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />

                        {/* Tiêu đề chính */}
                        <h2 className="text-lg sm:text-xl font-black text-amber-300 uppercase tracking-wide drop-shadow-xs">
                            {currentEmployee ? cleanEmployeeName(currentEmployee.full_name).toUpperCase() : 'NHÂN VIÊN'} - {selectedEmployeeId || 'USER'}
                        </h2>

                        {/* Dòng phụ đề luỹ kế và tỷ lệ đạt */}
                        <div className="mt-2 flex items-center justify-center gap-1.5 text-xs sm:text-[13px] font-bold text-emerald-100 flex-wrap">
                            <span className="flex items-center gap-1 text-amber-200">
                                <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300 shrink-0" />
                                <span>Lũy kế đến ngày: <strong className="text-white font-mono">{reportDateString}</strong></span>
                            </span>
                            <span className="text-emerald-400/80">||</span>
                            <span className="text-emerald-50">
                                {isPointsMode ? (
                                    <>
                                        DK ĐẠT: <strong className="text-amber-300 font-mono">{campaignSummaryStats.achievedPoints}/{campaignSummaryStats.totalPoints} ĐIỂM</strong> ({campaignSummaryStats.pointsPercentage}%)
                                        <span className="text-emerald-300 text-[11px] ml-1 font-normal">({campaignSummaryStats.achieved}/{campaignSummaryStats.total} CT)</span>
                                    </>
                                ) : (
                                    <>
                                        DK ĐẠT: <strong className="text-amber-300 font-mono">{campaignSummaryStats.achieved}/{campaignSummaryStats.total}</strong> ({campaignSummaryStats.percentage}%)
                                    </>
                                )}
                            </span>
                        </div>

                        {/* Tag bổ sung thông tin Siêu Thị, Chức Danh & Phiên */}
                        <div className="mt-3 flex items-center justify-center gap-2 flex-wrap text-[11px] font-semibold text-emerald-100/90">
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-900/60 border border-emerald-500/40">
                                🏢 {currentEmployee?.store_name || selectedStore}
                            </span>
                            {currentEmployee?.job_title && (
                                <span className="px-2.5 py-0.5 rounded-full bg-emerald-900/60 border border-emerald-500/40">
                                    💼 {currentEmployee.job_title}
                                </span>
                            )}
                            {employeeKpis.workHours > 0 && (
                                <span className="px-2.5 py-0.5 rounded-full bg-emerald-900/60 border border-emerald-500/40">
                                    ⏱️ {employeeKpis.workHours}h công ({employeeKpis.prodQdPerHour} tr/h)
                                </span>
                            )}
                        </div>
                    </div>

                    {/* 3.2. 5 THẺ KPI TỔNG QUÁT CỦA NHÂN VIÊN */}
                    <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                        {/* 1. TARGET QĐ */}
                        <div className="bg-slate-50/80 rounded-xl p-2 sm:p-2.5 border border-slate-200 text-center shadow-2xs">
                            <div className="text-[9.5px] sm:text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                TARGET QĐ
                            </div>
                            <div className="text-base sm:text-lg font-black font-mono text-slate-900 mt-0.5">
                                {formatNumberVn(employeeKpis.targetQd, 1)}
                            </div>
                        </div>

                        {/* 2. DTQĐ */}
                        <div className="bg-slate-50/80 rounded-xl p-2 sm:p-2.5 border border-slate-200 text-center shadow-2xs">
                            <div className="text-[9.5px] sm:text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                DTQĐ
                            </div>
                            <div className="text-base sm:text-lg font-black font-mono text-rose-600 mt-0.5">
                                {formatNumberVn(employeeKpis.revenueQd, 1)}
                            </div>
                        </div>

                        {/* 3. % HT */}
                        <div className="bg-slate-50/80 rounded-xl p-2 sm:p-2.5 border border-slate-200 text-center shadow-2xs">
                            <div className="text-[9.5px] sm:text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                % HT
                            </div>
                            <div className={`text-base sm:text-lg font-black font-mono mt-0.5 ${employeeKpis.forecastCompletionRate >= 100
                                ? 'text-emerald-600'
                                : employeeKpis.forecastCompletionRate >= 80
                                    ? 'text-blue-600'
                                    : 'text-rose-600'
                                }`}>
                                {employeeKpis.forecastCompletionRate}%
                            </div>
                        </div>

                        {/* 4. % QĐ */}
                        <div className="bg-slate-50/80 rounded-xl p-2 sm:p-2.5 border border-slate-200 text-center shadow-2xs">
                            <div className="text-[9.5px] sm:text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                % QĐ
                            </div>
                            <div className="text-base sm:text-lg font-black font-mono text-indigo-600 mt-0.5">
                                {employeeKpis.exchangeRate}%
                            </div>
                        </div>

                        {/* 5. TRẢ CHẬM */}
                        <div className="bg-slate-50/80 rounded-xl p-2 sm:p-2.5 border border-slate-200 text-center shadow-2xs">
                            <div className="text-[9.5px] sm:text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                TRẢ CHẬM
                            </div>
                            <div className="text-base sm:text-lg font-black font-mono text-teal-700 mt-0.5">
                                {formatNumberVn(employeeKpis.installmentRate, 1)}%
                            </div>
                        </div>
                    </div>

                    {/* 3.3. BẢNG KẾT QUẢ THI ĐUA TINH GỌN */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                        {/* Header Bar trên cùng của bảng */}
                        <div className="bg-emerald-700 px-3.5 py-2.5 flex items-center justify-between text-white flex-wrap gap-2">
                            <div className="text-xs font-black uppercase tracking-wider flex items-center gap-2 flex-wrap">
                                <Trophy className="w-4 h-4 text-amber-300 shrink-0" />
                                <span>BẢNG KẾT QUẢ THI ĐUA</span>

                                {isPointsMode && (
                                    <span className="text-[9.5px] bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full font-black uppercase shadow-2xs">
                                        Thang điểm shop
                                    </span>
                                )}
                            </div>
                            <div className="text-xs font-black text-amber-300 flex items-center gap-1 font-mono">
                                <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300 shrink-0" />
                                {isPointsMode ? (
                                    <span>ĐẠT: {campaignSummaryStats.achievedPoints}/{campaignSummaryStats.totalPoints} Đ ({campaignSummaryStats.pointsPercentage}%)</span>
                                ) : (
                                    <span>ĐẠT: {campaignSummaryStats.achieved}/{campaignSummaryStats.total} NH ({campaignSummaryStats.percentage}%)</span>
                                )}
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table
                                className="w-full text-left text-xs border-collapse"
                                style={{ tableLayout: 'fixed', minWidth: '580px' }}
                            >
                                <thead className="bg-emerald-800 text-white font-black uppercase tracking-wider text-[10.5px] sm:text-[11px] select-none">
                                    <tr>
                                        {/* 1. STT: 36px */}
                                        <th
                                            style={{ width: '36px' }}
                                            onClick={() => handleSort('stt')}
                                            className="py-2.5 px-0.5 text-center border-r border-emerald-700/80 cursor-pointer hover:bg-emerald-900/50 transition"
                                            title="Bấm để sắp xếp theo STT"
                                        >
                                            <div className="flex items-center justify-center gap-0.5">
                                                <span>STT</span>
                                                {sortColumn === 'stt' && (
                                                    sortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-amber-300" /> : <ArrowDown className="w-2.5 h-2.5 text-amber-300" />
                                                )}
                                            </div>
                                        </th>

                                        {/* 2. Ngành Hàng */}
                                        <th
                                            style={{ width: isPointsMode ? '170px' : '194px' }}
                                            onClick={() => handleSort('displayName')}
                                            className="py-2.5 px-2 text-left border-r border-emerald-700/80 cursor-pointer hover:bg-emerald-900/50 transition"
                                            title="Bấm để sắp xếp theo Tên Ngành Hàng"
                                        >
                                            <div className="flex items-center justify-between gap-1">
                                                <span>Ngành Hàng</span>
                                                {sortColumn === 'displayName' ? (
                                                    sortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-amber-300" /> : <ArrowDown className="w-2.5 h-2.5 text-amber-300" />
                                                ) : (
                                                    <ArrowUpDown className="w-2 h-2 opacity-40" />
                                                )}
                                            </div>
                                        </th>

                                        {/* 3. Điểm (chỉ hiển thị nếu st tính theo điểm đạt) */}
                                        {isPointsMode && (
                                            <th
                                                style={{ width: '44px' }}
                                                onClick={() => handleSort('pointsWeight')}
                                                className={`py-2.5 px-0.5 text-center border-r border-emerald-700/80 cursor-pointer hover:bg-emerald-900/50 transition ${sortColumn === 'pointsWeight' ? 'bg-emerald-950 text-amber-300 font-extrabold' : 'bg-emerald-900/60 text-amber-300'
                                                    }`}
                                                title="Điểm chuẩn quy định theo cấu hình của siêu thị"
                                            >
                                                <div className="flex items-center justify-center gap-0.5">
                                                    <span>Điểm</span>
                                                    {sortColumn === 'pointsWeight' ? (
                                                        sortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-amber-300" /> : <ArrowDown className="w-2.5 h-2.5 text-amber-300" />
                                                    ) : (
                                                        <ArrowUpDown className="w-2 h-2 opacity-40" />
                                                    )}
                                                </div>
                                            </th>
                                        )}

                                        {/* 4. Taget */}
                                        <th
                                            style={{ width: isPointsMode ? '56px' : '60px' }}
                                            onClick={() => handleSort('target')}
                                            className={`py-2.5 px-1 text-center border-r border-emerald-700/80 cursor-pointer hover:bg-emerald-900/50 transition ${sortColumn === 'target' ? 'bg-emerald-950 text-amber-300' : ''
                                                }`}
                                            title="Bấm để sắp xếp theo Taget khoán"
                                        >
                                            <div className="flex items-center justify-center gap-0.5">
                                                <span>Taget</span>
                                                {sortColumn === 'target' ? (
                                                    sortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-amber-300" /> : <ArrowDown className="w-2.5 h-2.5 text-amber-300" />
                                                ) : (
                                                    <ArrowUpDown className="w-2 h-2 opacity-40" />
                                                )}
                                            </div>
                                        </th>

                                        {/* 5. L.Kế */}
                                        <th
                                            style={{ width: isPointsMode ? '56px' : '60px' }}
                                            onClick={() => handleSort('actual')}
                                            className={`py-2.5 px-1 text-center border-r border-emerald-700/80 cursor-pointer hover:bg-emerald-900/50 transition ${sortColumn === 'actual' ? 'bg-emerald-950 text-amber-300' : ''
                                                }`}
                                            title="Bấm để sắp xếp theo Lũy Kế thực hiện"
                                        >
                                            <div className="flex items-center justify-center gap-0.5">
                                                <span>L.Kế</span>
                                                {sortColumn === 'actual' ? (
                                                    sortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-amber-300" /> : <ArrowDown className="w-2.5 h-2.5 text-amber-300" />
                                                ) : (
                                                    <ArrowUpDown className="w-2 h-2 opacity-40" />
                                                )}
                                            </div>
                                        </th>

                                        {/* 6. C.LẠI */}
                                        <th
                                            style={{ width: isPointsMode ? '52px' : '54px' }}
                                            onClick={() => handleSort('remaining')}
                                            className={`py-2.5 px-1 text-center border-r border-emerald-700/80 cursor-pointer hover:bg-emerald-900/50 transition ${sortColumn === 'remaining' ? 'bg-emerald-950 text-amber-300' : ''
                                                }`}
                                            title="Bấm để sắp xếp theo Còn Lại"
                                        >
                                            <div className="flex items-center justify-center gap-0.5">
                                                <span>C.LẠI</span>
                                                {sortColumn === 'remaining' ? (
                                                    sortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-amber-300" /> : <ArrowDown className="w-2.5 h-2.5 text-amber-300" />
                                                ) : (
                                                    <ArrowUpDown className="w-2 h-2 opacity-40" />
                                                )}
                                            </div>
                                        </th>

                                        {/* 7. %HT */}
                                        <th
                                            style={{ width: isPointsMode ? '50px' : '54px' }}
                                            onClick={() => handleSort('realCompletionRate')}
                                            className={`py-2.5 px-0.5 text-center border-r border-emerald-700/80 cursor-pointer hover:bg-emerald-900/50 transition ${sortColumn === 'realCompletionRate' ? 'bg-emerald-950 text-amber-300' : ''
                                                }`}
                                            title="% Hoàn thành thực tế: (L.Kế / Taget) * 100"
                                        >
                                            <div className="flex items-center justify-center gap-0.5">
                                                <span>%HT</span>
                                                {sortColumn === 'realCompletionRate' ? (
                                                    sortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-amber-300" /> : <ArrowDown className="w-2.5 h-2.5 text-amber-300" />
                                                ) : (
                                                    <ArrowUpDown className="w-2 h-2 opacity-40" />
                                                )}
                                            </div>
                                        </th>

                                        {/* 8. %DK */}
                                        <th
                                            style={{ width: isPointsMode ? '58px' : '62px' }}
                                            onClick={() => handleSort('completionRate')}
                                            className={`py-2.5 px-0.5 text-center border-r border-emerald-700/80 cursor-pointer hover:bg-emerald-900/60 transition ${sortColumn === 'completionRate'
                                                ? 'bg-emerald-950 text-amber-300 font-extrabold ring-1 ring-inset ring-amber-400/40'
                                                : ''
                                                }`}
                                            title="% Dự kiến hoàn thành tháng theo nhịp ngày đã bán (Mặc định sắp xếp giảm dần)"
                                        >
                                            <div className="flex items-center justify-center gap-0.5">
                                                <span>%DK</span>
                                                {sortColumn === 'completionRate' ? (
                                                    sortDirection === 'desc' ? (
                                                        <ArrowDown className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                                                    ) : (
                                                        <ArrowUp className="w-2.5 h-2.5 text-amber-300 shrink-0" />
                                                    )
                                                ) : (
                                                    <ArrowUpDown className="w-2 h-2 opacity-40 shrink-0" />
                                                )}
                                            </div>
                                        </th>

                                        {/* 9. +/-Điểm */}
                                        <th
                                            style={{ width: isPointsMode ? '60px' : '62px' }}
                                            onClick={() => handleSort('pointsEarned')}
                                            className={`py-2.5 px-0.5 text-center cursor-pointer hover:bg-emerald-900/70 transition ${sortColumn === 'pointsEarned'
                                                ? 'bg-emerald-950 text-amber-200 ring-1 ring-inset ring-amber-300/40'
                                                : 'bg-emerald-900/80 text-amber-200'
                                                }`}
                                            title="Điểm được tính: nếu %DK >= 100% thì đạt trọn vẹn điểm, ngược lại 0 điểm"
                                        >
                                            <div className="flex items-center justify-center gap-0.5">
                                                <span>+/-Điểm</span>
                                                {sortColumn === 'pointsEarned' ? (
                                                    sortDirection === 'asc' ? <ArrowUp className="w-2.5 h-2.5 text-amber-300" /> : <ArrowDown className="w-2.5 h-2.5 text-amber-300" />
                                                ) : (
                                                    <ArrowUpDown className="w-2 h-2 opacity-40" />
                                                )}
                                            </div>
                                        </th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-100 font-medium">
                                    {filteredCampaignRows.length === 0 ? (
                                        <tr>
                                            <td colSpan={isPointsMode ? 9 : 8} className="py-8 text-center text-slate-400 font-medium text-xs">
                                                Không có số liệu ngành hàng phù hợp theo điều kiện lọc.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredCampaignRows.map((row, idx) => {
                                            const rowBg = idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white';
                                            return (
                                                <tr
                                                    key={row.canonicalKey}
                                                    className={`${rowBg} hover:bg-emerald-50/40 transition border-b border-slate-100`}
                                                >
                                                    {/* 1. STT */}
                                                    <td className="py-2.5 px-0.5 text-center font-mono font-bold text-slate-500 text-[11px] border-r border-slate-100">
                                                        #{idx + 1}
                                                    </td>

                                                    {/* 2. Ngành Hàng */}
                                                    <td className="py-2.5 px-2 text-left font-black text-rose-900 text-[11.5px] leading-tight border-r border-slate-100 overflow-hidden">
                                                        <div className="flex items-center gap-1 overflow-hidden" title={row.displayName}>
                                                            <span className="truncate">{row.displayName}</span>
                                                            {row.unit && (
                                                                <span className="text-[9.5px] text-slate-400 font-normal shrink-0">({row.unit})</span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* 3. Điểm */}
                                                    {isPointsMode && (
                                                        <td className="py-2.5 px-0.5 text-center border-r border-slate-100">
                                                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10.5px] font-mono border ${getPointBadgeStyle(row.pointsWeight)}`}>
                                                                {row.pointsWeight} đ
                                                            </span>
                                                        </td>
                                                    )}

                                                    {/* 4. Taget */}
                                                    <td className="py-2.5 px-1 text-right font-mono font-bold text-slate-800 text-[11.5px] border-r border-slate-100">
                                                        {formatNumberVn(row.target, 1)}
                                                    </td>

                                                    {/* 5. L.Kế */}
                                                    <td className="py-2.5 px-1 text-right font-mono font-black text-rose-600 text-[11.5px] border-r border-slate-100">
                                                        {formatNumberVn(row.actual, 1)}
                                                    </td>

                                                    {/* 6. C.LẠI */}
                                                    <td className={`py-2.5 px-1 text-right font-mono font-bold text-[11.5px] border-r border-slate-100 ${row.remaining === 0 ? 'text-emerald-700' : 'text-rose-600'
                                                        }`}>
                                                        {formatRemainingTarget(row.remaining, false, false)}
                                                    </td>

                                                    {/* 7. %HT */}
                                                    <td className="py-2.5 px-0.5 text-center border-r border-slate-100 font-mono text-[10.5px]">
                                                        <span className="inline-block px-1.5 py-0.5 rounded text-[10.5px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                                            {row.realCompletionRate}%
                                                        </span>
                                                    </td>

                                                    {/* 8. %DK */}
                                                    <td className="py-2.5 px-0.5 text-center border-r border-slate-100 font-mono font-black text-[10.5px]">
                                                        {row.isAchieved ? (
                                                            <span className="inline-block px-1.5 py-0.5 rounded text-[10.5px] font-mono font-black bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-2xs">
                                                                {row.completionRate}%
                                                            </span>
                                                        ) : (
                                                            <span className="inline-block px-1.5 py-0.5 rounded text-[10.5px] font-mono font-black bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
                                                                {row.completionRate}%
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* 9. +/-Điểm */}
                                                    <td className="py-2.5 px-0.5 text-center font-mono text-[10.5px]">
                                                        {isPointsMode ? (
                                                            row.isAchieved ? (
                                                                <span className={`inline-block px-1.5 py-0.5 rounded text-[10.5px] font-mono ${getEarnedPointBadgeStyle(row.pointsEarned, true)}`}>
                                                                    +{row.pointsEarned} đ
                                                                </span>
                                                            ) : (
                                                                <span className="inline-block px-1.5 py-0.5 rounded text-[10.5px] font-mono font-bold bg-slate-100 text-slate-400 border border-slate-200">
                                                                    0 đ
                                                                </span>
                                                            )
                                                        ) : (
                                                            row.isAchieved ? (
                                                                <span className="inline-block px-1.5 py-0.5 rounded text-[10.5px] font-mono font-black bg-emerald-600 text-white border border-emerald-700 shadow-xs">
                                                                    +1 (Đạt)
                                                                </span>
                                                            ) : (
                                                                <span className="inline-block px-1.5 py-0.5 rounded text-[10.5px] font-mono font-bold bg-slate-100 text-slate-400 border border-slate-200">
                                                                    0
                                                                </span>
                                                            )
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 3.4. KHU VỰC PHÂN TÍCH NHANH & GỢI Ý HÀNH ĐỘNG (XUẤT ALL HOẶC LOẠI TRỪ) */}
                    {includeAnalysisSection && (
                        <div data-analysis-section="true" className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200 text-xs text-slate-600 space-y-2">
                            <div className="flex items-center justify-between font-bold text-slate-800">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-amber-500" />
                                    <span>Phân Tích Hiệu Quả Cá Nhân:</span>
                                </div>
                                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full border border-emerald-200">
                                    Xuất All
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-200/60 text-emerald-950">
                                    <span className="font-bold flex items-center gap-1.5 text-emerald-800">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                        <span>Nhóm thế mạnh:</span>
                                    </span>
                                    <div className="mt-1.5 pl-5 space-y-0.5">
                                        {campaignDetailRows.filter(r => r.isAchieved).length === 0 ? (
                                            <p className="text-slate-500 italic">Chưa có ngành hàng nào đạt mốc dự kiến 100%.</p>
                                        ) : (
                                            campaignDetailRows.filter(r => r.isAchieved).map(r => (
                                                <p key={r.canonicalKey} className="font-medium">
                                                    • <strong>{r.displayName}</strong>: đạt {r.completionRate}% ({formatNumberVn(r.actual, 1)} / {formatNumberVn(r.target, 1)})
                                                    {isPointsMode && <span className="text-emerald-700 font-bold ml-1">(+{r.pointsEarned} đ)</span>}
                                                </p>
                                            ))
                                        )}
                                    </div>
                                </div>

                                <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-200/60 text-rose-950">
                                    <span className="font-bold flex items-center gap-1.5 text-rose-800">
                                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                                        <span>Trọng tâm cần cải thiện:</span>
                                    </span>
                                    <div className="mt-1.5 pl-5 space-y-0.5">
                                        {campaignDetailRows.filter(r => !r.isAchieved && r.target > 0).length === 0 ? (
                                            <p className="text-emerald-700 font-bold">🎉 Xuất sắc! Tất cả ngành hàng có chỉ tiêu đều đã đạt nhịp.</p>
                                        ) : (
                                            campaignDetailRows.filter(r => !r.isAchieved && r.target > 0).slice(0, 4).map(r => (
                                                <p key={r.canonicalKey} className="font-medium">
                                                    • <strong>{r.displayName}</strong>: còn thiếu {formatNumberVn(r.remaining, 1)} {r.unit} ({r.completionRate}%)
                                                </p>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 4. MODAL TIẾN ĐỘ XUẤT ẢNH HÀNG LOẠT CHO TẤT CẢ NHÂN VIÊN */}
            {batchExport.isRunning && (
                <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-100 flex flex-col items-center text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs">
                            <Loader2 className="w-7 h-7 animate-spin" />
                        </div>

                        <div>
                            <h3 className="text-lg font-black text-slate-900">
                                Đang Xuất Ảnh Báo Cáo ({exportResolution})
                            </h3>
                            <p className="text-xs text-slate-500 mt-1 flex items-center justify-center gap-1.5 flex-wrap">
                                <span>Siêu thị: <strong className="text-slate-800">{selectedStore === 'all' ? 'Tất cả siêu thị' : getShortStoreName(selectedStore)}</strong></span>
                                <span className="text-slate-300">•</span>
                                <span>Cấu hình: <strong className="text-indigo-700">{includeAnalysisSection ? 'Xuất All' : 'Loại trừ Phân Tích'}</strong></span>
                            </p>
                        </div>

                        {/* Progress bar */}
                        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
                            <div
                                className="bg-gradient-to-r from-indigo-500 to-purple-600 h-full rounded-full transition-all duration-300"
                                style={{ width: `${Math.round((batchExport.current / Math.max(1, batchExport.total)) * 100)}%` }}
                            />
                        </div>

                        <div className="w-full flex items-center justify-between text-xs font-bold text-slate-600">
                            <span>Tiến độ: {batchExport.current} / {batchExport.total} Nhân viên</span>
                            <span className="text-indigo-600 font-mono font-black">
                                {Math.round((batchExport.current / Math.max(1, batchExport.total)) * 100)}%
                            </span>
                        </div>

                        {/* Current employee info */}
                        <div className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-left">
                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Đang kết xuất:</div>
                            <div className="text-xs font-black text-slate-800 truncate mt-0.5">
                                {batchExport.currentEmpName || 'Đang chuẩn bị...'}
                            </div>
                        </div>

                        <p className="text-[11px] text-slate-400 italic">
                            Các file ảnh PNG độ nét cao ({exportResolution}) sẽ tự động tải về máy. Vui lòng giữ tab này hoạt động.
                        </p>

                        <button
                            type="button"
                            onClick={handleCancelBatchExport}
                            disabled={batchExport.isCancelled}
                            className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition cursor-pointer"
                        >
                            {batchExport.isCancelled ? 'Đang dừng tiến trình...' : 'Hủy Xuất Hàng Loạt'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
