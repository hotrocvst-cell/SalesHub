import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    fetchStores,
    fetchEmployees,
    fetchEmployeeRevenueTargets,
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
    getStoreOperatingConfig,
    getTopBotConfig,
    getShortenedEmployeeName,
    syncPerformanceConfigsFromCloud,
    type TopBotConfig
} from '../employee-performance/utils/performanceConfig';
import {
    getStoreCampaignScoreConfig,
    getCampaignPoints,
    syncStoreCampaignScoresFromCloud,
    type StoreCampaignScoreConfig
} from '../../core/lib/storeCampaignScoreService';
import { resolveCanonicalCampaign } from '../campaign-summary/utils/campaignSummaryStorage';
import { getYesterdayDateString, isStoreMatch, getShortStoreName } from '../../core/lib/formatters';
import { useAuth } from '../../shared/contexts/AuthContext';
import { useUserStoreFilter } from '../../shared/hooks/useUserStoreFilter';
import { useExcelExportPermission } from '../../shared/hooks/useExcelExportPermission';
import ReportDataFreshnessBar from '../../shared/components/report/ReportDataFreshnessBar';
import PerformanceConfigModal from '../employee-performance/components/PerformanceConfigModal';
import EmployeeRankingKpiCards from './components/EmployeeRankingKpiCards';
import EmployeeRankingTable, { type SortField } from './components/EmployeeRankingTable';
import EmployeeRankingAssessmentModal from './components/EmployeeRankingAssessmentModal';
import ReportActionButtons from '../../shared/components/report/ReportActionButtons';
import {
    fetchEmployeeRankingAssessment,
    type EmployeeRankingAssessmentData
} from './services/employeeRankingAssessmentService';
import type { EmployeeRankingRow, EmployeeRankingSummary } from './types';
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
    Settings,
    ArrowUpDown,
    CheckCircle2,
    Users,
    Award,
    HelpCircle,
    ChevronDown,
    MessageSquare,
    Edit3,
    Eye,
    EyeOff
} from 'lucide-react';
import ExcelJS from 'exceljs';
import html2canvas from 'html2canvas';
import { calculate8KScale } from '../../shared/utils/exportImage';

export default function EmployeeRankingSummaryPage() {
    const navigate = useNavigate();
    const { currentUser, canConfigure } = useAuth();
    const canManage = canConfigure || ['ADMIN', 'QUAN_LY', 'TRUONG_CA'].includes(currentUser?.role || '');
    const reportRef = useRef<HTMLDivElement>(null);

    // 1. STATE BỘ LỌC CƠ BẢN
    const [stores, setStores] = useState<StoreItem[]>([]);
    const [selectedStore, setSelectedStore] = useState<string>('all');

    // Phân quyền theo siêu thị
    const { allowedStores, isLockedToSingleStore, canViewAllStores } = useUserStoreFilter(
        stores,
        selectedStore,
        setSelectedStore
    );

    // Kiểm tra quyền xuất file Excel (Rule 9)
    const { canExportExcel } = useExcelExportPermission('/tong-hop-xep-hang-nhan-vien');

    const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [filterCategory, setFilterCategory] = useState<'ALL' | 'TOP_REV' | 'BOT_REV' | 'TOP_EMU' | 'BOT_EMU'>('ALL');
    const [displayUnit, setDisplayUnit] = useState<'MILLION' | 'BILLION'>('MILLION');

    // MẶC ĐỊNH SẮP XẾP THEO XẾP HẠNG DOANH THU (REVENUE_RANK)
    const [sortField, setSortField] = useState<SortField>('REVENUE_RANK');
    const [sortAsc, setSortAsc] = useState<boolean>(true); // rank 1 -> rank n

    // 2. STATE DỮ LIỆU CỐT LÕI
    const [employees, setEmployees] = useState<EmployeeItem[]>([]);
    const [revenueTargets, setRevenueTargets] = useState<Record<string, number>>({});
    const [campaignTargets, setCampaignTargets] = useState<Record<string, Record<string, number>>>({});
    const [campaignDict, setCampaignDict] = useState<CampaignDictItem[]>([]);
    const [latestSession, setLatestSession] = useState<EmployeeDataSession | null>(null);

    // Cấu hình TOP/BOT & Shop
    const [topBotConfig, setTopBotConfig] = useState<TopBotConfig>(() =>
        getTopBotConfig(selectedStore === 'all' ? 'ALL' : selectedStore)
    );
    const [operatingConfig, setOperatingConfig] = useState(() =>
        getStoreOperatingConfig(selectedStore === 'all' ? 'ALL' : selectedStore, selectedMonth, selectedYear)
    );

    const [scoreConfigsVersion, setScoreConfigsVersion] = useState<number>(0);

    // State Nhận xét tóm tắt kết quả
    const [assessmentData, setAssessmentData] = useState<EmployeeRankingAssessmentData | null>(null);
    const [showAssessment, setShowAssessment] = useState<boolean>(true);
    const [isAssessmentModalOpen, setIsAssessmentModalOpen] = useState<boolean>(false);

    const [loading, setLoading] = useState<boolean>(true);
    const [isExporting, setIsExporting] = useState<boolean>(false);
    const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);
    const [toastMessage, setToastMessage] = useState<string>('');

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 3500);
    };

    // Cập nhật cấu hình khi đổi store/tháng/năm
    const refreshConfigs = () => {
        const targetStore = selectedStore === 'all' ? 'ALL' : selectedStore;
        setOperatingConfig(getStoreOperatingConfig(targetStore, selectedMonth, selectedYear));
        setTopBotConfig(getTopBotConfig(targetStore));
        setScoreConfigsVersion(v => v + 1);
    };

    useEffect(() => {
        refreshConfigs();
    }, [selectedStore, selectedMonth, selectedYear]);

    // 3. TẢI TOÀN BỘ DỮ LIỆU
    const loadAllData = async () => {
        setLoading(true);

        // Đồng bộ cấu hình TOP/BOT và Cấu hình Điểm thi đua từ Cloud Supabase
        try {
            await Promise.allSettled([
                syncPerformanceConfigsFromCloud(),
                syncStoreCampaignScoresFromCloud()
            ]);
            refreshConfigs();
        } catch { }

        try {
            const [storesRes, empsRes, revTargetsRes, campTargetsRes, dictRes, allSessions] = await Promise.all([
                fetchStores(),
                fetchEmployees(),
                fetchEmployeeRevenueTargets(selectedMonth, selectedYear),
                fetchEmployeeCampaignTargets(selectedMonth, selectedYear),
                fetchCampaignDictionary(),
                syncAndFetchEmployeeDataSessions({ month: selectedMonth, year: selectedYear })
            ]);

            if (storesRes.success) setStores(storesRes.data);
            if (empsRes.success) setEmployees(empsRes.data);
            if (dictRes.success && dictRes.data) setCampaignDict(dictRes.data);

            // Chuyển đổi target doanh thu sang Map theo Mã NV (chuẩn hóa về triệu đồng)
            const rTargetMap: Record<string, number> = {};
            if (revTargetsRes.success && revTargetsRes.data) {
                if (Array.isArray(revTargetsRes.data)) {
                    revTargetsRes.data.forEach((r: any) => {
                        if (r && r.employee_id != null) {
                            const rawTarget = Number(r.target_revenue) || 0;
                            const key = String(r.employee_id).trim();
                            rTargetMap[key] = rawTarget >= 100_000 ? Math.round(rawTarget / 1_000_000) : rawTarget;
                        }
                    });
                } else if (typeof revTargetsRes.data === 'object') {
                    Object.entries(revTargetsRes.data).forEach(([k, v]) => {
                        const rawTarget = Number(v) || 0;
                        rTargetMap[k.trim()] = rawTarget >= 100_000 ? Math.round(rawTarget / 1_000_000) : rawTarget;
                    });
                }
            }
            setRevenueTargets(rTargetMap);

            // Chuyển đổi target thi đua sang Map [empId][rawKey] = target
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

            // Xác định phiên mới nhất REVENUE_CAMPAIGN hoặc FULL_SYNC
            const revSessions = allSessions.filter(sess =>
                (sess.session_type === 'REVENUE_CAMPAIGN' || sess.session_type === 'FULL_SYNC') &&
                (selectedStore === 'all' || isStoreMatch(sess.store_name, selectedStore, storesRes.data || stores))
            );
            const newest = revSessions.slice().sort((a, b) =>
                (b.report_date || '').localeCompare(a.report_date || '') ||
                (b.created_at || '').localeCompare(a.created_at || '')
            )[0] || null;
            setLatestSession(newest);

            // Tải nhận xét tóm tắt xếp hạng nhân viên của kỳ này
            try {
                const assess = await fetchEmployeeRankingAssessment(selectedStore, selectedMonth, selectedYear);
                setAssessmentData(assess);
                if (assess && assess.show_on_report !== undefined) {
                    setShowAssessment(assess.show_on_report);
                }
            } catch { }

        } catch (error) {
            console.error('Lỗi khi tải dữ liệu xếp hạng nhân viên:', error);
            showToast('⚠️ Không thể tải dữ liệu mới nhất!');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAllData();
    }, [selectedStore, selectedMonth, selectedYear]);

    // 4. BẢN ĐỒ NHÂN VIÊN -> SIÊU THỊ & MAP DỮ LIỆU TỪ PHIÊN
    const empStoreMap = useMemo(() => {
        const map: Record<string, string> = {};
        employees.forEach(e => {
            if (e.employee_id) map[e.employee_id.trim()] = e.store_name || '';
        });
        return map;
    }, [employees]);

    // Thu thập bản đồ số liệu doanh thu & thi đua của nhân viên từ phiên mới nhất
    const sessionRecordsMap = useMemo(() => {
        const map: Record<string, any> = {};
        if (latestSession && Array.isArray(latestSession.records)) {
            latestSession.records.forEach(r => {
                const k = (r.employee_id || '').trim();
                if (k) map[k] = r;
            });
        }
        return map;
    }, [latestSession]);

    // 5. TÍNH TOÁN DỮ LIỆU XẾP HẠNG TẤT CẢ NHÂN VIÊN
    const rankingRows = useMemo<EmployeeRankingRow[]>(() => {
        if (employees.length === 0) return [];

        // Xác định số ngày đã trôi qua
        let passedDays = operatingConfig.passedDays;
        if (latestSession?.report_date) {
            const parts = latestSession.report_date.split('-');
            if (parts.length === 3) {
                const d = parseInt(parts[2], 10);
                if (!isNaN(d) && d > 0) {
                    passedDays = Math.min(d, operatingConfig.operatingDays);
                }
            }
        }
        const safePassed = Math.max(1, passedDays);
        const safeTotal = Math.max(1, operatingConfig.operatingDays);

        // Danh sách nhân viên thuộc siêu thị được chọn
        const targetEmployees = employees.filter(emp => {
            if (selectedStore === 'all') return true;
            return isStoreMatch(emp.store_name, selectedStore, stores);
        });

        // 5.1. Thu thập dữ liệu thô từng nhân viên
        const rawList = targetEmployees.map(emp => {
            const empId = emp.employee_id.trim();
            const fullName = emp.full_name || empId;
            const shortName = getShortenedEmployeeName(fullName);
            const jobTitle = emp.job_title || 'Nhân viên';
            const empStore = empStoreMap[empId] || emp.store_name || sessionRecordsMap[empId]?.store_name || (selectedStore === 'all' ? '' : selectedStore);

            // Dữ liệu doanh thu từ phiên
            const sessRecord = sessionRecordsMap[empId];
            let rawActual = Number(sessRecord?.revenue_actual) || 0;
            let rawQd = Number(sessRecord?.revenue_qd) || 0;

            // Quy đổi sang triệu đồng nếu số liệu là VNĐ nguyên bản (> 100,000)
            const revenueActual = rawActual >= 100_000 ? Math.round(rawActual / 1_000_000) : rawActual;
            const revenueQd = rawQd >= 100_000 ? Math.round(rawQd / 1_000_000) : rawQd;
            const revenueTarget = revenueTargets[empId] || 0;

            const completionRate = revenueTarget > 0 ? (revenueQd / revenueTarget) * 100 : 0;
            const forecastRevenueQd = (revenueQd / safePassed) * safeTotal;
            const forecastRate = revenueTarget > 0 ? (forecastRevenueQd / revenueTarget) * 100 : 0;

            // Dữ liệu thi đua của nhân viên: Tự động tra cứu cấu hình theo đúng siêu thị của NV
            const scoreCfg = getStoreCampaignScoreConfig(empStore, stores);
            const isPointsMode = scoreCfg.scoring_mode === 'POINTS';

            const empCampaignTargets = campaignTargets[empId] || {};
            const empCampaignActuals = sessRecord?.campaigns || {};

            let achievedCount = 0;
            let totalCampaigns = 0;
            let achievedPoints = 0;
            let totalPoints = 0;

            // Duyệt qua tất cả các thi đua có target của nhân viên
            Object.entries(empCampaignTargets).forEach(([rawKey, targetVal]) => {
                const tVal = Number(targetVal) || 0;
                if (tVal > 0) {
                    totalCampaigns++;
                    const resolved = resolveCanonicalCampaign(rawKey, campaignDict);
                    const cKey = resolved.canonicalKey;

                    // Lấy actual
                    let actualVal = 0;
                    if (empCampaignActuals[rawKey] !== undefined) {
                        actualVal = Number(empCampaignActuals[rawKey]) || 0;
                    } else if (empCampaignActuals[cKey] !== undefined) {
                        actualVal = Number(empCampaignActuals[cKey]) || 0;
                    }

                    // Điểm số quy định cho nhóm thi đua này
                    const pts = getCampaignPoints(cKey, scoreCfg);
                    totalPoints += pts;

                    // Tính %DKHT nhóm thi đua
                    const forecastCampVal = (actualVal / safePassed) * safeTotal;
                    const campForecastRate = (forecastCampVal / tVal) * 100;

                    if (campForecastRate >= 100) {
                        achievedCount++;
                        achievedPoints += pts;
                    }
                }
            });

            // Tỷ lệ hoàn thành thi đua
            let emulationRate = 0;
            let emulationDisplay = '';
            if (isPointsMode) {
                emulationRate = totalPoints > 0 ? (achievedPoints / totalPoints) * 100 : 0;
                emulationDisplay = `${achievedPoints}/${totalPoints} đ`;
            } else {
                emulationRate = totalCampaigns > 0 ? (achievedCount / totalCampaigns) * 100 : 0;
                emulationDisplay = `${achievedCount}/${totalCampaigns} NH`;
            }

            return {
                employee_id: empId,
                full_name: fullName,
                short_name: shortName,
                store_name: empStore,
                job_title: jobTitle,
                revenue_actual: revenueActual,
                revenue_qd: revenueQd,
                revenue_target: revenueTarget,
                completion_rate: completionRate,
                forecast_completion_rate: forecastRate,
                scoring_mode: scoreCfg.scoring_mode,
                points_achieved: achievedPoints,
                points_total: totalPoints,
                campaigns_achieved: achievedCount,
                campaigns_total: totalCampaigns,
                emulation_rate: emulationRate,
                emulation_display: emulationDisplay
            };
        });

        const totalN = rawList.length;
        if (totalN === 0) return [];

        // 5.2. Tính thứ hạng Doanh thu & Nhãn TOP/BOT
        // Xếp theo %DKHT hoặc DTQĐ tùy cấu hình topBotConfig.rankBy
        const sortedByRev = [...rawList].sort((a, b) => {
            if (topBotConfig.rankBy === 'FORECAST_COMPLETION_RATE') {
                return b.forecast_completion_rate - a.forecast_completion_rate || b.revenue_qd - a.revenue_qd;
            }
            return b.revenue_qd - a.revenue_qd || b.forecast_completion_rate - a.forecast_completion_rate;
        });

        // Xác định số lượng TOP và BOT
        let topCount = 0;
        let botCount = 0;
        if (topBotConfig.mode === 'COUNT') {
            topCount = Math.min(topBotConfig.topValue, totalN);
            botCount = Math.min(topBotConfig.botValue, totalN);
        } else {
            topCount = Math.max(1, Math.round((totalN * topBotConfig.topValue) / 100));
            botCount = Math.max(1, Math.round((totalN * topBotConfig.botValue) / 100));
        }

        const revMapWithRank = new Map<string, { rank: number; status: 'TOP' | 'BOT' | 'MID'; label: string }>();
        sortedByRev.forEach((item, idx) => {
            const rank = idx + 1;
            let status: 'TOP' | 'BOT' | 'MID' = 'MID';
            let label = `#${rank}`;

            if (idx < topCount) {
                status = 'TOP';
                label = `Top #${rank}`;
            } else if (idx >= totalN - botCount) {
                status = 'BOT';
                label = `Bot #${rank}`;
            }
            revMapWithRank.set(item.employee_id, { rank, status, label });
        });

        // 5.3. Tính thứ hạng Thi đua & Nhãn TOP/BOT Thi đua
        const sortedByEmu = [...rawList].sort((a, b) => {
            return b.emulation_rate - a.emulation_rate || b.points_achieved - a.points_achieved;
        });

        const emuMapWithRank = new Map<string, { rank: number; status: 'TOP' | 'BOT' | 'MID'; label: string }>();
        sortedByEmu.forEach((item, idx) => {
            const rank = idx + 1;
            let status: 'TOP' | 'BOT' | 'MID' = 'MID';
            let label = `#${rank}`;

            if (idx < topCount) {
                status = 'TOP';
                label = `Top #${rank}`;
            } else if (idx >= totalN - botCount) {
                status = 'BOT';
                label = `Bot #${rank}`;
            }
            emuMapWithRank.set(item.employee_id, { rank, status, label });
        });

        // 5.4. Ghép nối kết quả hoàn chỉnh
        return rawList.map(item => {
            const revMeta = revMapWithRank.get(item.employee_id) || { rank: 999, status: 'MID' as const, label: '' };
            const emuMeta = emuMapWithRank.get(item.employee_id) || { rank: 999, status: 'MID' as const, label: '' };

            return {
                ...item,
                revenue_rank: revMeta.rank,
                revenue_top_bot_status: revMeta.status,
                revenue_top_bot_label: revMeta.label,
                emulation_rank: emuMeta.rank,
                emulation_top_bot_status: emuMeta.status,
                emulation_top_bot_label: emuMeta.label
            };
        });
    }, [
        employees,
        selectedStore,
        stores,
        operatingConfig,
        latestSession,
        sessionRecordsMap,
        revenueTargets,
        campaignTargets,
        campaignDict,
        topBotConfig,
        empStoreMap,
        scoreConfigsVersion
    ]);

    // 6. TÍNH CHỈ SỐ TỔNG QUAN (SUMMARY)
    const summary = useMemo<EmployeeRankingSummary>(() => {
        const total = rankingRows.length;
        if (total === 0) {
            return {
                totalEmployees: 0,
                totalRevenueQd: 0,
                totalRevenueActual: 0,
                totalRevenueTarget: 0,
                avgForecastRate: 0,
                avgEmulationRate: 0,
                topRevenueCount: 0,
                botRevenueCount: 0,
                topEmulationCount: 0,
                botEmulationCount: 0,
                scoringModeLabel: 'Chưa có dữ liệu'
            };
        }

        const totalRevQd = rankingRows.reduce((sum, r) => sum + r.revenue_qd, 0);
        const totalRevActual = rankingRows.reduce((sum, r) => sum + r.revenue_actual, 0);
        const totalRevTarget = rankingRows.reduce((sum, r) => sum + r.revenue_target, 0);
        const avgForecast = totalRevTarget > 0
            ? rankingRows.reduce((sum, r) => sum + r.forecast_completion_rate, 0) / total
            : 0;
        const avgEmulation = rankingRows.reduce((sum, r) => sum + r.emulation_rate, 0) / total;

        const topRev = rankingRows.filter(r => r.revenue_top_bot_status === 'TOP').length;
        const botRev = rankingRows.filter(r => r.revenue_top_bot_status === 'BOT').length;
        const topEmu = rankingRows.filter(r => r.emulation_top_bot_status === 'TOP').length;
        const botEmu = rankingRows.filter(r => r.emulation_top_bot_status === 'BOT').length;

        let modeLabel = 'Tùy biến từng shop';
        if (selectedStore !== 'all') {
            const curCfg = getStoreCampaignScoreConfig(selectedStore, stores);
            modeLabel = curCfg.scoring_mode === 'POINTS' ? 'Tính Điểm' : 'Tính Số NH';
        } else {
            const allPoints = rankingRows.every(r => r.scoring_mode === 'POINTS');
            const allCount = rankingRows.every(r => r.scoring_mode === 'COUNT');
            modeLabel = allPoints ? 'Tính Điểm' : allCount ? 'Tính Số NH' : 'Tự động theo từng Shop';
        }

        return {
            totalEmployees: total,
            totalRevenueQd: totalRevQd,
            totalRevenueActual: totalRevActual,
            totalRevenueTarget: totalRevTarget,
            avgForecastRate: avgForecast,
            avgEmulationRate: avgEmulation,
            topRevenueCount: topRev,
            botRevenueCount: botRev,
            topEmulationCount: topEmu,
            botEmulationCount: botEmu,
            scoringModeLabel: modeLabel
        };
    }, [rankingRows]);

    // 7. LỌC VÀ SẮP XẾP HIỂN THỊ
    const displayRows = useMemo(() => {
        let result = [...rankingRows];

        // Lọc theo tìm kiếm tên hoặc mã NV
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            result = result.filter(r =>
                r.full_name.toLowerCase().includes(q) ||
                r.short_name.toLowerCase().includes(q) ||
                r.employee_id.toLowerCase().includes(q)
            );
        }

        // Lọc theo nhóm TOP/BOT
        if (filterCategory === 'TOP_REV') {
            result = result.filter(r => r.revenue_top_bot_status === 'TOP');
        } else if (filterCategory === 'BOT_REV') {
            result = result.filter(r => r.revenue_top_bot_status === 'BOT');
        } else if (filterCategory === 'TOP_EMU') {
            result = result.filter(r => r.emulation_top_bot_status === 'TOP');
        } else if (filterCategory === 'BOT_EMU') {
            result = result.filter(r => r.emulation_top_bot_status === 'BOT');
        }

        // Sắp xếp: Mặc định theo Xếp hạng DT (REVENUE_RANK tăng dần)
        result.sort((a, b) => {
            let comp = 0;
            switch (sortField) {
                case 'REVENUE_RANK':
                    comp = a.revenue_rank - b.revenue_rank;
                    break;
                case 'EMULATION_RANK':
                    comp = a.emulation_rank - b.emulation_rank;
                    break;
                case 'NAME':
                    comp = a.short_name.localeCompare(b.short_name);
                    break;
                case 'REVENUE_QD':
                    comp = b.revenue_qd - a.revenue_qd;
                    break;
                case 'TARGET':
                    comp = b.revenue_target - a.revenue_target;
                    break;
                case 'FORECAST_RATE':
                    comp = b.forecast_completion_rate - a.forecast_completion_rate;
                    break;
                case 'EMULATION_RATE':
                    comp = b.emulation_rate - a.emulation_rate;
                    break;
                default:
                    comp = a.revenue_rank - b.revenue_rank;
            }
            return sortAsc ? comp : -comp;
        });

        return result;
    }, [rankingRows, searchQuery, filterCategory, sortField, sortAsc]);

    // Xử lý đổi cột sắp xếp
    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortAsc(!sortAsc);
        } else {
            setSortField(field);
            // Với rank thì mặc định tăng dần (1, 2, 3), các số liệu khác thì giảm dần
            if (field === 'REVENUE_RANK' || field === 'EMULATION_RANK') {
                setSortAsc(true);
            } else {
                setSortAsc(false);
            }
        }
    };

    // 8. XUẤT ẢNH BÁO CÁO 8K (PORTRAIT SMARTPHONE OPTIMIZED, NO FOOTER WATERMARK)
    const exportImage = async (mode: 'DOWNLOAD' | 'COPY') => {
        if (!reportRef.current || isExporting) return;
        setIsExporting(true);
        showToast('📸 Đang tạo hình ảnh báo cáo 8K dọc smartphone...');

        try {
            if (document.fonts && document.fonts.ready) {
                await document.fonts.ready;
            }

            const scale = calculate8KScale(reportRef.current, 960);

            const canvas = await html2canvas(reportRef.current, {
                scale: scale,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                logging: false,
                onclone: (clonedDoc) => {
                    clonedDoc.documentElement.style.height = 'auto';
                    clonedDoc.body.style.height = 'auto';
                    const el = clonedDoc.getElementById('employee-ranking-export-area');
                    if (el) {
                        el.style.height = 'auto';
                        el.style.maxHeight = 'none';
                        el.style.overflow = 'visible';
                        el.style.width = '960px';
                        el.style.maxWidth = '960px';
                        el.style.margin = '0 auto';
                    }
                }
            });

            if (mode === 'DOWNLOAD') {
                const link = document.createElement('a');
                link.download = `XepHangNhanVien_${selectedStore}_T${selectedMonth}_${selectedYear}_8K.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
                showToast('✅ Đã tải xuống ảnh báo cáo 8K thành công!');
            } else {
                canvas.toBlob(async (blob) => {
                    if (blob && navigator.clipboard && navigator.clipboard.write) {
                        await navigator.clipboard.write([
                            new ClipboardItem({ 'image/png': blob })
                        ]);
                        showToast('📋 Đã sao chép ảnh 8K vào Clipboard! Dán trực tiếp vào Messaging App.');
                    } else {
                        showToast('⚠️ Trình duyệt chưa hỗ trợ sao chép ảnh tự động.');
                    }
                }, 'image/png');
            }
        } catch (error) {
            console.error('Lỗi khi xuất ảnh báo cáo:', error);
            showToast('⚠️ Lỗi khi xuất ảnh báo cáo!');
        } finally {
            setIsExporting(false);
        }
    };

    // 9. XUẤT EXCEL BÁO CÁO
    const exportExcel = async () => {
        try {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Xếp Hạng Nhân Viên');

            worksheet.columns = [
                { header: 'STT', key: 'stt', width: 6 },
                { header: 'Mã NV', key: 'id', width: 12 },
                { header: 'Họ và tên', key: 'name', width: 25 },
                { header: 'Siêu thị', key: 'store', width: 25 },
                { header: 'Chức danh', key: 'title', width: 15 },
                { header: 'DTQĐ (tr)', key: 'rev_qd', width: 14 },
                { header: 'Target DT (tr)', key: 'target', width: 14 },
                { header: '%DKHT DT', key: 'rev_rate', width: 12 },
                { header: 'Thứ hạng DT', key: 'rev_rank', width: 12 },
                { header: 'Phân loại DT', key: 'rev_label', width: 14 },
                { header: 'Dự kiến Thi đua', key: 'emu_val', width: 18 },
                { header: '% Đạt Thi đua', key: 'emu_rate', width: 14 },
                { header: 'Thứ hạng Thi đua', key: 'emu_rank', width: 14 },
                { header: 'Phân loại Thi đua', key: 'emu_label', width: 14 },
            ];

            // Header Style
            const headerRow = worksheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1E293B' }
            };

            displayRows.forEach((r, idx) => {
                worksheet.addRow({
                    stt: idx + 1,
                    id: r.employee_id,
                    name: r.full_name,
                    store: r.store_name,
                    title: r.job_title,
                    rev_qd: r.revenue_qd,
                    target: r.revenue_target,
                    rev_rate: `${r.forecast_completion_rate.toFixed(1)}%`,
                    rev_rank: `#${r.revenue_rank}`,
                    rev_label: r.revenue_top_bot_label,
                    emu_val: r.emulation_display,
                    emu_rate: `${r.emulation_rate.toFixed(0)}%`,
                    emu_rank: `#${r.emulation_rank}`,
                    emu_label: r.emulation_top_bot_label
                });
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `BangXepHangNhanVien_${selectedStore}_T${selectedMonth}_${selectedYear}.xlsx`;
            anchor.click();
            window.URL.revokeObjectURL(url);
            showToast('📊 Đã xuất file Excel thành công!');
        } catch (error) {
            console.error('Lỗi xuất Excel:', error);
            showToast('⚠️ Lỗi khi xuất Excel!');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50/70 p-2 sm:p-4 md:p-6 font-avo" style={{ fontFamily: "'UTM Avo', 'UTM-Avo', sans-serif" }}>
            {/* THÔNG BÁO TOAST */}
            {toastMessage && (
                <div className="fixed top-4 right-4 z-50 bg-slate-900/95 text-white px-4 py-2.5 rounded-xl shadow-xl border border-slate-700 text-xs font-bold flex items-center gap-2 animate-fade-in backdrop-blur-md">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* THANH ĐIỀU KHIỂN & BỘ LỌC (CONTROLS BAR) */}
            <div className="max-w-[960px] mx-auto mb-4 bg-white rounded-2xl border border-slate-200 shadow-2xs p-3 sm:p-4">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    {/* TIÊU ĐỀ & TRẠNG THÁI */}
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 flex items-center justify-center text-white shadow-md shadow-indigo-200 shrink-0">
                            <Trophy className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                                    TỔNG HỢP XẾP HẠNG NHÂN VIÊN
                                </h1>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    Sức Khỏe Nhân Sự
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium">
                                Tổng hợp đa chiều: Xếp hạng Doanh thu & Tiến độ Thi đua tổng hợp
                            </p>
                        </div>
                    </div>

                    {/* HÀNG CÔNG CỤ NÚT BẤM */}
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        {canManage && (
                            <button
                                onClick={() => setIsConfigModalOpen(true)}
                                className="px-3 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition border border-slate-200 select-none shadow-2xs"
                                title="Cấu hình tỷ lệ TOP / BOT và ngày giờ hoạt động (dùng chung cho cả hệ thống)"
                            >
                                <Settings className="w-3.5 h-3.5 text-slate-600" />
                                <span>Cấu hình TOP/BOT</span>
                            </button>
                        )}

                        <ReportActionButtons
                            onExportImage={() => exportImage('DOWNLOAD')}
                            onCopyImage={() => exportImage('COPY')}
                            isExporting={isExporting}
                            onOpenAssessment={() => setIsAssessmentModalOpen(true)}
                            hasAssessment={true}
                            hasAssessmentToggle={true}
                            showAssessmentOnReport={showAssessment}
                            onToggleShowAssessment={setShowAssessment}
                            onExportExcel={exportExcel}
                            canExportExcel={canExportExcel}
                            reportTitle={`Bảng Xếp Hạng Thi Đua Nhân Viên - ${selectedStore}`}
                        />

                        <button
                            onClick={loadAllData}
                            className="p-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition border border-slate-200"
                            title="Làm mới dữ liệu"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* BỘ LỌC SIÊU THỊ / CỤM RIÊNG LẺ ĐẦU TIÊN (RULE 10 CONVENTION) */}
                <div className="mt-3 pt-3 border-t border-slate-100 pb-2.5 border-b">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                        Siêu Thị / Đơn Vị Phụ Trách
                    </label>
                    <div className="flex items-center gap-2">
                        <select
                            value={selectedStore}
                            disabled={isLockedToSingleStore}
                            onChange={(e) => setSelectedStore(e.target.value)}
                            className="w-full sm:max-w-md text-xs font-black bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500 cursor-pointer shadow-2xs"
                        >
                            {canViewAllStores && <option value="all">🏢 Toàn Cụm Siêu Thị</option>}
                            {allowedStores.map(st => (
                                <option key={st.id || st.name} value={st.name}>
                                    🏪 {getShortStoreName(st.name)}
                                </option>
                            ))}
                        </select>
                        {isLockedToSingleStore && (
                            <span className="text-[10px] bg-amber-100 text-amber-800 border border-amber-200 px-2 py-1 rounded-lg font-bold uppercase tracking-wider">
                                Đã khóa theo shop
                            </span>
                        )}
                    </div>
                </div>

                {/* BỘ LỌC THỜI GIAN & TIÊU CHÍ BỔ TRỢ (DÒNG 2) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2.5">
                    {/* 1. Chọn Tháng */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                            Tháng
                        </label>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(Number(e.target.value))}
                            className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                        >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                <option key={m} value={m}>Tháng {m}</option>
                            ))}
                        </select>
                    </div>

                    {/* 2. Chọn Năm */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                            Năm
                        </label>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                        >
                            {[selectedYear - 1, selectedYear, selectedYear + 1].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    {/* 3. Đơn vị hiển thị tiền */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                            Đơn Vị Tiền
                        </label>
                        <select
                            value={displayUnit}
                            onChange={(e) => setDisplayUnit(e.target.value as any)}
                            className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                        >
                            <option value="MILLION">Triệu VNĐ</option>
                            <option value="BILLION">Tỷ VNĐ</option>
                        </select>
                    </div>

                    {/* 4. Lọc TOP / BOT nhanh */}
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                            Phân Loại
                        </label>
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value as any)}
                            className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-2 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                        >
                            <option value="ALL">Tất cả ({rankingRows.length})</option>
                            <option value="TOP_REV">🏆 Top DT ({summary.topRevenueCount})</option>
                            <option value="BOT_REV">🚨 Bot DT ({summary.botRevenueCount})</option>
                            <option value="TOP_EMU">⭐ Top T.Đua ({summary.topEmulationCount})</option>
                            <option value="BOT_EMU">⚠️ Bot T.Đua ({summary.botEmulationCount})</option>
                        </select>
                    </div>
                </div>

                {/* TÌM KIẾM NHÂN SỰ */}
                <div className="mt-2.5 relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Tìm theo tên nhân viên hoặc mã số NV..."
                        className="w-full pl-9 pr-4 py-1.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-black"
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            {/* THANH ĐỘ TƯƠI DỮ LIỆU */}
            <div className="max-w-[960px] mx-auto mb-3">
                <ReportDataFreshnessBar
                    latestDataDate={latestSession?.report_date || getYesterdayDateString()}
                    lastUpdatedAt={latestSession?.created_at}
                    lastUpdatedBy={latestSession?.created_by}
                    sessionTitle={latestSession?.session_title}
                    storeName={selectedStore === 'all' ? 'Toàn Cụm' : selectedStore}
                    actionUrl="/cap-nhat-luy-ke-nhan-vien"
                />
            </div>

            {/* VÙNG XUẤT BÁO CÁO (EXPORT CONTAINER ĐƯỢC CĂN CHỈNH MOBILE-FIRST 960PX) */}
            <div
                id="employee-ranking-export-area"
                ref={reportRef}
                className="max-w-[960px] mx-auto bg-white rounded-3xl p-3 sm:p-5 border border-slate-200 shadow-sm space-y-4 font-avo"
                style={{ fontFamily: "'UTM Avo', 'UTM-Avo', sans-serif" }}
            >
                {/* 1. HEADER BÁO CÁO (TÊN SIÊU THỊ, KỲ BÁO CÁO) */}
                <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                        <div className="text-[11px] font-black uppercase text-indigo-600 tracking-wider flex items-center gap-1.5">
                            <Trophy className="w-3.5 h-3.5 text-amber-500" />
                            <span>BÁO CÁO XẾP HẠNG TỔNG HỢP</span>
                        </div>
                        <h2 className="text-base sm:text-xl font-black text-slate-900 tracking-tight mt-0.5">
                            {selectedStore === 'all' ? 'TOÀN CỤM SIÊU THỊ' : getShortStoreName(selectedStore)}
                        </h2>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-right sm:text-right">
                        <div className="px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs font-black">
                            📅 Tháng {selectedMonth}/{selectedYear}
                        </div>
                        <div className="px-2.5 py-1 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-black">
                            👥 {summary.totalEmployees} Nhân sự
                        </div>
                        <div className="px-2.5 py-1 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-xs font-black" title="Chế độ tính điểm thi đua của siêu thị">
                            🎯 {summary.scoringModeLabel}
                        </div>
                    </div>
                </div>

                {/* 2. KHỐI 4 THẺ CHỈ SỐ SỨC KHỎE CỐT LÕI (KEY KPI CARDS) */}
                <EmployeeRankingKpiCards summary={summary} displayUnit={displayUnit} />

                {/* 3. BẢNG DỮ LIỆU BÁO CÁO CHI TIẾT 8 CỘT CHUẨN */}
                <EmployeeRankingTable
                    rows={displayRows}
                    summary={summary}
                    sortField={sortField}
                    sortAsc={sortAsc}
                    onSort={handleSort}
                    displayUnit={displayUnit}
                />

                {/* 4. KHỐI NHẬN XÉT TÓM TẮT KẾT QUẢ (TRANG TRỌNG, THẨM MỸ, XUẤT HIỆN TRONG ẢNH CHỤP) */}
                {assessmentData && assessmentData.comment && showAssessment && (
                    <div className="bg-gradient-to-r from-purple-50/80 via-indigo-50/50 to-blue-50/60 border border-purple-200 rounded-2xl p-3.5 sm:p-4 text-xs shadow-2xs">
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-purple-200/70">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                                    <MessageSquare className="w-3.5 h-3.5 stroke-[2.5]" />
                                </div>
                                <span className="font-black text-purple-950 uppercase tracking-wider text-[11px]">
                                    NHẬN XÉT & HƯỚNG DẪN HÀNH ĐỘNG
                                </span>
                            </div>
                            <div className="flex items-center gap-2" data-html2canvas-ignore="true">
                                <button
                                    type="button"
                                    onClick={() => setIsAssessmentModalOpen(true)}
                                    className="text-[10.5px] font-bold text-purple-700 hover:text-purple-950 flex items-center gap-1 cursor-pointer transition"
                                    title="Chỉnh sửa nội dung nhận xét"
                                >
                                    <Edit3 className="w-3 h-3" />
                                    <span>Sửa</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAssessment(false)}
                                    className="text-[10.5px] font-bold text-slate-400 hover:text-slate-700 flex items-center gap-1 cursor-pointer transition"
                                    title="Tạm ẩn nhận xét này khỏi báo cáo"
                                >
                                    <EyeOff className="w-3 h-3" />
                                    <span>Ẩn</span>
                                </button>
                            </div>
                        </div>
                        <div className="text-slate-800 whitespace-pre-line leading-relaxed font-medium text-[11.5px] pl-1">
                            {assessmentData.comment}
                        </div>
                    </div>
                )}
            </div>

            {/* THÔNG BÁO KHI CÓ NHẬN XÉT ĐANG ẨN (NGOÀI VÙNG CHỤP BÁO CÁO) */}
            {assessmentData && assessmentData.comment && !showAssessment && (
                <div
                    data-html2canvas-ignore="true"
                    className="max-w-[960px] mx-auto mt-2.5 bg-purple-50/70 border border-purple-200 rounded-2xl p-2.5 px-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-purple-950 shadow-2xs"
                >
                    <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-purple-600 shrink-0" />
                        <span className="font-medium text-[11.5px]">
                            Đã có nhận xét tóm tắt kết quả xếp hạng (đang ẩn theo tùy chọn).
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowAssessment(true)}
                        className="px-3 py-1 bg-white hover:bg-purple-100 border border-purple-300 rounded-xl text-purple-900 font-bold text-[11px] flex items-center gap-1.5 cursor-pointer shadow-2xs self-start sm:self-auto"
                    >
                        <Eye className="w-3.5 h-3.5 text-purple-600" />
                        <span>Hiển thị vào báo cáo</span>
                    </button>
                </div>
            )}

            {/* MODAL CẤU HÌNH TOP / BOT CHUNG HỆ THỐNG */}
            {isConfigModalOpen && (
                <PerformanceConfigModal
                    isOpen={isConfigModalOpen}
                    onClose={() => setIsConfigModalOpen(false)}
                    stores={stores}
                    currentStoreName={selectedStore === 'all' ? 'ALL' : selectedStore}
                    month={selectedMonth}
                    year={selectedYear}
                    totalEmployees={summary.totalEmployees}
                    onConfigSaved={() => {
                        refreshConfigs();
                        showToast('✅ Đã lưu và đồng bộ cấu hình TOP/BOT trên toàn hệ thống!');
                    }}
                />
            )}

            {/* MODAL NHẬN XÉT TÓM TẮT XẾP HẠNG NHÂN VIÊN */}
            {isAssessmentModalOpen && (
                <EmployeeRankingAssessmentModal
                    isOpen={isAssessmentModalOpen}
                    onClose={() => setIsAssessmentModalOpen(false)}
                    rows={displayRows}
                    summary={summary}
                    storeName={selectedStore}
                    month={selectedMonth}
                    year={selectedYear}
                    initialData={assessmentData}
                    showAssessment={showAssessment}
                    onToggleShowAssessment={(show) => setShowAssessment(show)}
                    onSaved={() => {
                        loadAllData();
                        showToast('✅ Đã lưu nhận xét tóm tắt kết quả xếp hạng!');
                    }}
                />
            )}
        </div>
    );
}
