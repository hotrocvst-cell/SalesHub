import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import { calculate8KScale } from '../../shared/utils/exportImage';
import {
    fetchBusinessRecords,
    type BusinessDayRecord
} from '../../core/lib/storage';
import {
    getShortStoreName,
    formatDate,
    getYesterdayDateString,
    isStoreMatch
} from '../../core/lib/formatters';
import { useAuth } from '../../shared/contexts/AuthContext';
import {
    GUEST_DEMO_STORE,
    isGuestDemoStore,
    isDemoDateAllowed
} from '../../core/lib/guestDemoStoreService';
import {
    type ClusterStoreRow,
    type ClusterSummaryData,
    type ClusterTargetConfigItem,
    type ClusterAssessmentData
} from './types';
import {
    fetchClusterTargetConfigPackage,
    fetchClusterAssessment,
    saveClusterAssessment
} from './services/clusterTargetService';
import { extractStoreRevenueDetailsWithReal } from './utils/revenueExtractor';
import ClusterTargetConfigModal from './components/ClusterTargetConfigModal';
import CloudDataSyncStatusBanner from '../../shared/components/report/CloudDataSyncStatusBanner';
import ReportDataFreshnessBar from '../../shared/components/report/ReportDataFreshnessBar';
import ReportActionButtons from '../../shared/components/report/ReportActionButtons';
import type { AssessmentTemplate } from '../../shared/components/report/ReportAssessmentModal';
import {
    Store,
    Target,
    MessageSquare,
    RefreshCw,
    Coins,
    Award,
    Calendar,
    Check,
    CheckCircle2,
    AlertCircle,
    ArrowRight,
    Eye,
    EyeOff,
    Lock,
    Zap
} from 'lucide-react';

const toBillionValue = (val: number) => (val > 100 ? val / 1000 : val);
const toMillionValue = (val: number) => (val > 100 ? val : val * 1000);

/**
 * Rút gọn tên ST & Loại bỏ mã số ST:
 * Ví dụ:
 * - "111 - TGD_BRV_VTA - 290 Trương Công Định"  => "TGD - 290 Trương Công Định"
 * - "1841 - ĐML_CMA_CMA - 155A NGUYỄN TẤT THÀNH" => "ĐML - 155A NGUYỄN TẤT THÀNH"
 */
export function getCompactStoreName(name: string): string {
    if (!name) return '';
    const trimmed = name.trim();
    if (/^(tổng|tong|toàn cụm|toan cum)/i.test(trimmed)) return 'Tổng Cụm';

    // 1. Tách theo các loại dấu gạch ngang ' - ', ' – ', ' — ', '-'
    const parts = trimmed.split(/\s*[-–—]\s*/).map(p => p.trim()).filter(Boolean);

    // 2. Lọc bỏ các phần thuần số ở đầu hoặc giữa (mã ST như 111, 1841, 1234)
    const nonNumericParts = parts.filter(p => !/^\d+$/.test(p));

    if (nonNumericParts.length >= 2) {
        // Phần đầu thường là mã chuỗi & khu vực (VD: "TGD_BRV_VTA" hoặc "ĐML_CMA_CMA")
        const rawPrefix = nonNumericParts[0];
        // Lấy tên chuỗi ngắn gọn trước dấu gạch dưới '_' (VD: "TGD" hoặc "ĐML")
        const chainPrefix = rawPrefix.includes('_') ? rawPrefix.split('_')[0].trim() : rawPrefix;

        // Phần còn lại là tên đường / địa chỉ / chi nhánh
        const address = nonNumericParts.slice(1).join(' - ').trim();

        // Tránh lặp lại tiền tố nếu phần địa chỉ đã có sẵn
        if (address.toUpperCase().startsWith(chainPrefix.toUpperCase() + ' - ')) {
            return address;
        }

        return `${chainPrefix} - ${address}`;
    }

    if (nonNumericParts.length === 1) {
        let single = nonNumericParts[0];
        // Bỏ mã số ở đầu nếu chưa bị tách: "111 - "
        single = single.replace(/^\d+\s*[-_–.]\s*/, '');
        // Nếu có dạng "TGD_BRV_VTA_290 Trương Công Định"
        if (single.includes('_')) {
            const segs = single.split('_');
            const chain = segs[0];
            const rest = segs.slice(1).filter(s => !/^[A-Z]{2,4}$/.test(s)).join(' ');
            if (rest) return `${chain} - ${rest}`;
        }
        return single.trim();
    }

    return trimmed;
}

export default function ClusterReportPage() {
    const navigate = useNavigate();
    const reportCaptureRef = useRef<HTMLDivElement | null>(null);
    const loadSeqRef = useRef<number>(0);
    const toastTimerRef = useRef<number | null>(null);

    const { currentUser, isAdmin, canAccessStore } = useAuth();
    const isGuest = Boolean(currentUser?.is_guest);
    const isStaff = currentUser?.role === 'NHAN_VIEN';
    const canConfigureTarget = !isGuest && (isAdmin || ['ADMIN', 'QUAN_LY', 'TRUONG_CA'].includes(currentUser?.role || ''));

    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState<number>(() => isGuest ? 10 : today.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(() => isGuest ? 2026 : today.getFullYear());
    const [selectedStore, setSelectedStore] = useState<string>('all');
    const [selectedDate, setSelectedDate] = useState<string>('latest');
    const [displayUnit, setDisplayUnit] = useState<'BILLION' | 'MILLION'>('BILLION'); // 'BILLION' (1.638 tỷ) | 'MILLION' (1,638 tr)

    // Cố định tháng 10/2026 cho tài khoản trải nghiệm
    useEffect(() => {
        if (isGuest) {
            if (selectedMonth !== 10) setSelectedMonth(10);
            if (selectedYear !== 2026) setSelectedYear(2026);
        }
    }, [isGuest, selectedMonth, selectedYear]);

    const [records, setRecords] = useState<BusinessDayRecord[]>([]);
    const [targetConfigs, setTargetConfigs] = useState<ClusterTargetConfigItem[]>([]);
    const [globalPaceRate, setGlobalPaceRate] = useState<number>(100);
    const [assessmentData, setAssessmentData] = useState<ClusterAssessmentData | null>(null);
    const [showAssessment, setShowAssessment] = useState<boolean>(false); // Mặc định ẩn nhận xét
    const [loading, setLoading] = useState<boolean>(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);

    const [tableFilter, setTableFilter] = useState<'ALL' | 'STANDARD' | 'OVER'>('ALL');

    // Modals & thông báo
    const [isTargetModalOpen, setIsTargetModalOpen] = useState<boolean>(false);
    const [isExportingImg, setIsExportingImg] = useState<boolean>(false);
    const [toastState, setToastState] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

    const showToast = (message: string, tone: 'success' | 'error' = 'success') => {
        setToastState({ message, tone });
        if (toastTimerRef.current) {
            window.clearTimeout(toastTimerRef.current);
        }
        toastTimerRef.current = window.setTimeout(() => setToastState(null), 3200);
    };

    useEffect(() => {
        return () => {
            if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
        };
    }, []);

    // 1. Tải dữ liệu kinh doanh và cấu hình (chống ghi đè khi đổi bộ lọc nhanh)
    const loadAllData = async () => {
        const requestSeq = ++loadSeqRef.current;
        const targetMonth = selectedMonth;
        const targetYear = selectedYear;

        setLoading(true);
        setLoadError(null);
        try {
            const [recordsRes, targetPkg, assessment] = await Promise.all([
                fetchBusinessRecords(targetMonth, targetYear),
                fetchClusterTargetConfigPackage(targetMonth, targetYear),
                fetchClusterAssessment(targetMonth, targetYear)
            ]);

            if (requestSeq !== loadSeqRef.current) return;

            if (recordsRes.success && recordsRes.data) {
                setRecords(recordsRes.data);
                setLastLoadedAt(new Date());
            } else {
                setRecords([]);
                setLoadError(
                    typeof recordsRes.error === 'string'
                        ? recordsRes.error
                        : 'Không thể tải dữ liệu cụm từ Cloud. Vui lòng thử lại.'
                );
            }

            setTargetConfigs(targetPkg.items);
            setGlobalPaceRate(targetPkg.globalPaceRate || 100);
            setAssessmentData(assessment);
        } catch (err: any) {
            if (requestSeq !== loadSeqRef.current) return;
            console.error('Lỗi loadAllData ClusterReportPage:', err);
            setRecords([]);
            setLoadError(err?.message || 'Mất kết nối khi đồng bộ số liệu cụm.');
        } finally {
            if (requestSeq === loadSeqRef.current) {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        loadAllData();
    }, [selectedMonth, selectedYear]);

    // 2a. Danh sách ST mà user được phân quyền trong kỳ này
    const accessibleStoreList = useMemo(() => {
        if (isGuest) {
            return [getCompactStoreName(GUEST_DEMO_STORE)];
        }
        const set = new Set<string>();
        records.forEach(r => {
            if (!r.storeName || /^(tổng|tong)/i.test(r.storeName)) return;
            const cName = getCompactStoreName(r.storeName);
            const sName = getShortStoreName(r.storeName);
            if (isAdmin || canAccessStore(r.storeName) || canAccessStore(sName) || canAccessStore(cName)) {
                set.add(cName);
            }
        });
        const list = Array.from(set).sort();
        if (list.length > 0) return list;

        const accessible = currentUser?.accessible_stores && currentUser.accessible_stores.length > 0
            ? currentUser.accessible_stores
            : (currentUser?.store_name ? [currentUser.store_name] : []);
        return Array.from(new Set(accessible.map(s => getCompactStoreName(s))));
    }, [records, isGuest, isAdmin, canAccessStore, currentUser]);

    const isLockedToSingleStore = (!isAdmin && isStaff) || isGuest || accessibleStoreList.length === 1;
    const canViewAllStores = !isGuest && (isAdmin || (!isStaff && accessibleStoreList.length > 1));

    // Điều chỉnh selectedStore tự động
    useEffect(() => {
        if (isGuest) {
            const guestCompact = getCompactStoreName(GUEST_DEMO_STORE);
            if (selectedStore !== guestCompact) {
                setSelectedStore(guestCompact);
            }
            return;
        }

        if (isLockedToSingleStore && accessibleStoreList.length > 0) {
            if (selectedStore !== accessibleStoreList[0]) {
                setSelectedStore(accessibleStoreList[0]);
            }
            return;
        }

        if (selectedStore !== 'all' && !accessibleStoreList.includes(selectedStore) && accessibleStoreList.length > 0) {
            setSelectedStore(canViewAllStores ? 'all' : accessibleStoreList[0]);
        }
    }, [isGuest, isLockedToSingleStore, accessibleStoreList, selectedStore, canViewAllStores]);

    // 2b. Danh sách các ngày có dữ liệu trong tháng (đã lọc theo phân quyền ST)
    const availableDates = useMemo(() => {
        const set = new Set<string>();
        records.forEach(r => {
            if (!r.reportDate) return;
            if (isGuest) {
                if ((isGuestDemoStore(r.storeName) || isStoreMatch(r.storeName, GUEST_DEMO_STORE) || isStoreMatch(r.storeName, '838679')) && isDemoDateAllowed(r.reportDate)) {
                    set.add(r.reportDate);
                }
            } else if (isAdmin) {
                set.add(r.reportDate);
            } else {
                const sShort = getShortStoreName(r.storeName);
                const sCompact = getCompactStoreName(r.storeName);
                if (canAccessStore(r.storeName) || canAccessStore(sShort) || canAccessStore(sCompact)) {
                    set.add(r.reportDate);
                }
            }
        });
        return Array.from(set).sort((a, b) => b.localeCompare(a));
    }, [records, isAdmin, isGuest, canAccessStore]);

    // Xác định ngày đang xem thực tế
    const effectiveDate = useMemo(() => {
        if (selectedDate !== 'latest' && availableDates.includes(selectedDate)) {
            return selectedDate;
        }
        return availableDates[0] || getYesterdayDateString();
    }, [selectedDate, availableDates]);

    // 3a. Tính toán và chuyển đổi dữ liệu cho tất cả ST trong cụm mà user có quyền truy cập
    const allAccessibleClusterRows = useMemo<ClusterStoreRow[]>(() => {
        if (records.length === 0) return [];

        // Xác định số ngày trong tháng và số ngày đã trôi qua
        const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
        let defaultPassedDays = 1;
        if (effectiveDate) {
            const parts = effectiveDate.split('-');
            if (parts.length === 3) {
                const parsedDay = parseInt(parts[2], 10);
                if (!isNaN(parsedDay) && parsedDay > 0) {
                    defaultPassedDays = Math.min(parsedDay, daysInMonth);
                }
            }
        }

        // Lọc bản ghi của ngày hiệu lực
        const dateRecords = records.filter(r => r.reportDate === effectiveDate);
        const sourceRecords = dateRecords.length > 0 ? dateRecords : records;

        // Gom nhóm theo từng ST (bỏ qua bản ghi tổng và lọc theo phân quyền user)
        const storeMap = new Map<string, BusinessDayRecord>();
        sourceRecords.forEach(r => {
            if (!r.storeName || /^(tổng|tong)/i.test(r.storeName)) return;

            if (isGuest) {
                if (!isGuestDemoStore(r.storeName) && !isStoreMatch(r.storeName, GUEST_DEMO_STORE) && !isStoreMatch(r.storeName, '838679')) return;
                if (!isDemoDateAllowed(r.reportDate)) return;
            } else if (!isAdmin) {
                const sShort = getShortStoreName(r.storeName);
                const sCompact = getCompactStoreName(r.storeName);
                if (!canAccessStore(r.storeName) && !canAccessStore(sShort) && !canAccessStore(sCompact)) {
                    return;
                }
            }

            const existing = storeMap.get(r.storeName);
            if (!existing || (r.reportDate && existing.reportDate && r.reportDate > existing.reportDate) || (Number(r.revenueActual) || 0) > (Number(existing.revenueActual) || 0)) {
                storeMap.set(r.storeName, r);
            }
        });

        const rows: ClusterStoreRow[] = [];
        let index = 1;

        storeMap.forEach((rec, storeName) => {
            const shortName = getCompactStoreName(storeName);
            const cfg = targetConfigs.find(c => c.storeName === storeName);

            // Số ngày
            const passedDays = (rec.passedDays && rec.passedDays > 0) ? rec.passedDays : defaultPassedDays;
            const totalDays = (rec.totalDays && rec.totalDays > 0) ? rec.totalDays : daysInMonth;
            const remainingDays = Math.max(1, totalDays - passedDays);

            // Bóc tách chi tiết Doanh thu Quy đổi (DTQĐ) và metadata mới từ rawRevenue & emulationSummary
            const extracted = extractStoreRevenueDetailsWithReal(rec.rawRevenue, storeName);
            const realInfo = (rec.emulationSummary as any)?.['__real_revenue'];
            const revMeta = (rec.emulationSummary as any)?.['__revenue_meta'];
            const rRealFromSummary = Number(realInfo?.revenueReal || realInfo?.revenueActual || 0);
            const legacyRealForInstallment = rRealFromSummary > 0
                ? rRealFromSummary
                : ((extracted && extracted.revenueActual > 0 && extracted.revenueActual !== extracted.revenueQd) ? extracted.revenueActual : 0);

            // Lũy kế DTQĐ
            const storedVal = Number(rec.revenueActual) || 0;
            const revQd = (extracted && extracted.revenueQd > 0) ? extracted.revenueQd : storedVal;

            // Target DT Thực nội bộ chỉ dùng đối soát, tránh nhầm vào Target DTQĐ
            const targetRealFromSummary = Number(realInfo?.targetReal ?? realInfo?.targetActual) || 0;
            const targetReal = targetRealFromSummary > 0 ? targetRealFromSummary : (extracted?.targetReal || 0);

            // Target DTQĐ: Ưu tiên bóc tách từ phần DTQĐ hoặc cột rec.revenueTarget (chuẩn hệ thống lưu DTQĐ)
            const targetQd = (extracted?.targetQd && extracted.targetQd > 0)
                ? extracted.targetQd
                : (Number(rec.revenueTarget) > 0
                    ? Number(rec.revenueTarget)
                    : ((extracted?.revenueTarget && extracted.revenueTarget > 0 && (targetReal === 0 || Math.abs(extracted.revenueTarget - targetReal) > 0.05))
                        ? extracted.revenueTarget
                        : 0));

            // Target Gốc (Base Target): Chuẩn mục tiêu kinh doanh LUÔN LÀ TARGET DTQĐ
            // 1. targetQd (bóc tách DTQĐ hoặc cột rec.revenueTarget)
            // 2. cfg.baseTarget (nếu có và không bị dính targetReal cũ)
            // 3. Fallback revQd
            let baseTarget = targetQd;
            if (!baseTarget || baseTarget <= 0) {
                if (cfg?.baseTarget && cfg.baseTarget > 0 && (targetReal === 0 || Math.abs(cfg.baseTarget - targetReal) > 0.05)) {
                    baseTarget = cfg.baseTarget;
                } else if (extracted?.revenueTarget && extracted.revenueTarget > 0 && (targetReal === 0 || Math.abs(extracted.revenueTarget - targetReal) > 0.05)) {
                    baseTarget = extracted.revenueTarget;
                } else {
                    baseTarget = revQd;
                }
            }

            // Tỷ lệ trả góp (%TG)
            let installmentRate = 0;
            let hasInstallmentRate = false;

            if (revMeta && (revMeta.installmentRate !== undefined || rec.installmentRate)) {
                const metaRate = Number(revMeta.installmentRate) || Number(rec.installmentRate) || 0;
                if (metaRate > 0) {
                    installmentRate = metaRate;
                    hasInstallmentRate = true;
                }
            } else if (realInfo && (realInfo.installmentRateReal !== undefined || realInfo.installmentReal !== undefined || realInfo.installmentRevenue !== undefined)) {
                // Ưu tiên dữ liệu cũ từ __real_revenue nếu có
                if (realInfo.installmentRateReal !== undefined && realInfo.installmentRateReal !== null) {
                    installmentRate = Number(realInfo.installmentRateReal);
                    hasInstallmentRate = installmentRate > 0;
                } else if (legacyRealForInstallment > 0) {
                    const legacyInst = Number(realInfo.installmentReal ?? realInfo.installmentRevenue) || 0;
                    installmentRate = Number(((legacyInst / legacyRealForInstallment) * 100).toFixed(2));
                    hasInstallmentRate = installmentRate > 0;
                }
            } else if (extracted?.installmentRate !== undefined && extracted.installmentRate > 0) {
                installmentRate = extracted.installmentRate;
                hasInstallmentRate = true;
            } else if (extracted?.installmentRevenue !== undefined && extracted.installmentRevenue > 0 && legacyRealForInstallment > 0 && rRealFromSummary > 0) {
                installmentRate = Number(((extracted.installmentRevenue / legacyRealForInstallment) * 100).toFixed(2));
                hasInstallmentRate = installmentRate > 0;
            } else if (Number(rec.installmentRate) > 0) {
                installmentRate = Number(rec.installmentRate);
                hasInstallmentRate = true;
            } else if (Number(rec.revenueInstallment) > 0 && legacyRealForInstallment > 0 && rRealFromSummary > 0) {
                installmentRate = Number(((Number(rec.revenueInstallment) / legacyRealForInstallment) * 100).toFixed(2));
                hasInstallmentRate = installmentRate > 0;
            }

            // === BẢNG 1: DỮ LIỆU CHUẨN CỦA HỆ THỐNG ===
            const calcDailyRemainingMillion = (remainingVal: number) =>
                remainingDays > 0 ? Math.round(toMillionValue(remainingVal) / remainingDays) : 0;

            const pctHtStandard = baseTarget > 0 ? (revQd / baseTarget) * 100 : 0;
            const targetRemainingStandard = Math.max(0, baseTarget - revQd);
            const forecastRevenueQd = passedDays > 0 ? (revQd / passedDays) * totalDays : revQd;
            const pctDkhtStandard = baseTarget > 0 ? (forecastRevenueQd / baseTarget) * 100 : 0;
            const targetDailyRemainingStandard = calcDailyRemainingMillion(targetRemainingStandard);

            // === BẢNG 2: MỤC TIÊU VƯỢT TRỘI ===
            const targetRate = cfg?.targetRate && cfg.targetRate > 0
                ? cfg.targetRate
                : globalPaceRate;
            let targetOver = cfg?.targetOver && cfg.targetOver > 0
                ? cfg.targetOver
                : Number(((baseTarget * targetRate) / 100).toFixed(3));

            // Tự động kiểm tra và đồng bộ lại targetOver nếu targetOver cũ bị tính theo targetReal (lỗi cũ)
            if (cfg?.targetOver && cfg?.targetRate && targetReal > 0) {
                const impliedBase = (cfg.targetOver / cfg.targetRate) * 100;
                if (Math.abs(impliedBase - targetReal) < 0.1 && Math.abs(impliedBase - baseTarget) > 0.5) {
                    targetOver = Number(((baseTarget * targetRate) / 100).toFixed(3));
                }
            } else if (targetReal > 0 && Math.abs(targetOver - targetReal) < 0.05 && baseTarget !== targetReal) {
                targetOver = Number(((baseTarget * targetRate) / 100).toFixed(3));
            }

            const pctHtOver = targetOver > 0 ? (revQd / targetOver) * 100 : 0;
            const targetRemainingOver = Math.max(0, targetOver - revQd);
            const pctDkhtOver = targetOver > 0 ? (forecastRevenueQd / targetOver) * 100 : 0;

            // Mỗi ngày trung bình = Target còn lại (triệu) / Số ngày còn lại (VD: 5501 / 20 = 275 tr)
            const targetDailyRemainingOver = calcDailyRemainingMillion(targetRemainingOver);

            // TB 3 Tháng & Tăng trưởng
            const avg3Months = (cfg?.avg3Months && cfg.avg3Months > 0)
                ? cfg.avg3Months
                : (revMeta?.avg3Months && Number(revMeta.avg3Months) > 0)
                    ? Number(revMeta.avg3Months)
                    : ((extracted?.avg3Months && extracted.avg3Months > 0)
                        ? extracted.avg3Months
                        : (baseTarget > 0 ? baseTarget * 0.9 : revQd * 0.95));
            const pctGrowth = (revMeta?.pctGrowth !== undefined && revMeta?.pctGrowth !== null && Number(revMeta.pctGrowth) !== 0)
                ? Number(revMeta.pctGrowth)
                : (extracted?.pctGrowth !== undefined ? extracted.pctGrowth : (avg3Months > 0 ? ((forecastRevenueQd - avg3Months) / avg3Months) * 100 : 0));

            rows.push({
                id: rec.id,
                storeName,
                shortName,
                orderIndex: index++,

                // Bảng 1
                revenueQd: revQd,
                baseTarget,
                pctHtStandard,
                targetRemainingStandard,
                forecastRevenueQd,
                pctDkhtStandard,
                targetDailyRemainingStandard,
                installmentRate,
                hasInstallmentRate,

                // Bảng 2
                targetRate,
                targetOver,
                pctHtOver,
                targetRemainingOver,
                pctDkhtOver,
                targetDailyRemainingOver,

                // Khác
                avg3Months,
                pctGrowth,

                // Metadata
                reportDate: rec.reportDate,
                passedDays,
                totalDays,
                remainingDays
            });
        });

        // Sắp xếp theo doanh thu quy đổi giảm dần
        rows.sort((a, b) => b.revenueQd - a.revenueQd);
        // Cập nhật lại số thứ tự sau khi sắp xếp
        rows.forEach((r, idx) => { r.orderIndex = idx + 1; });

        return rows;
    }, [records, effectiveDate, targetConfigs, globalPaceRate, selectedMonth, selectedYear, isGuest, isAdmin, canAccessStore]);

    // 3b. Bảng dữ liệu hiển thị trên giao diện (đã lọc theo selectedStore nếu user chọn xem 1 ST riêng biệt)
    const clusterRows = useMemo<ClusterStoreRow[]>(() => {
        if (selectedStore === 'all') return allAccessibleClusterRows;
        return allAccessibleClusterRows.filter(r => {
            const shortName = getCompactStoreName(r.storeName);
            return shortName === selectedStore || isStoreMatch(r.storeName, selectedStore);
        });
    }, [allAccessibleClusterRows, selectedStore]);

    // 4. Tổng kết toàn cụm (TỔNG CỤM)
    const clusterSummary = useMemo<ClusterSummaryData>(() => {
        if (clusterRows.length === 0) {
            return {
                totalRevenueQd: 0,
                totalBaseTarget: 0,
                avgPctHtStandard: 0,
                totalTargetRemainingStandard: 0,
                totalForecastRevenueQd: 0,
                avgPctDkhtStandard: 0,
                totalTargetDailyRemainingStandard: 0,
                avgInstallmentRate: 0,
                hasInstallmentRate: false,
                installmentStoresCount: 0,

                avgTargetRate: globalPaceRate || 100,
                totalTargetOver: 0,
                avgPctHtOver: 0,
                totalTargetRemainingOver: 0,
                avgPctDkhtOver: 0,
                totalTargetDailyRemainingOver: 0,

                totalAvg3Months: 0,
                avgPctGrowth: 0,
                storesCount: 0
            };
        }

        const hasInstallmentRate = clusterRows.some(r => r.hasInstallmentRate);
        const totalRevenueQd = clusterRows.reduce((sum, r) => sum + r.revenueQd, 0);
        const totalBaseTarget = clusterRows.reduce((sum, r) => sum + r.baseTarget, 0);
        const avgPctHtStandard = totalBaseTarget > 0 ? (totalRevenueQd / totalBaseTarget) * 100 : 0;
        const totalTargetRemainingStandard = clusterRows.reduce((sum, r) => sum + r.targetRemainingStandard, 0);
        const totalForecastRevenueQd = clusterRows.reduce((sum, r) => sum + r.forecastRevenueQd, 0);
        const avgPctDkhtStandard = totalBaseTarget > 0 ? (totalForecastRevenueQd / totalBaseTarget) * 100 : 0;
        const totalTargetDailyRemainingStandard = clusterRows.reduce((sum, r) => sum + r.targetDailyRemainingStandard, 0);
        const rowsWithInstRate = clusterRows.filter(r => r.hasInstallmentRate && r.installmentRate > 0);
        const totalInstWeight = rowsWithInstRate.reduce((sum, r) => sum + (r.revenueQd > 0 ? r.revenueQd : 1), 0);
        const avgInstallmentRate = hasInstallmentRate && rowsWithInstRate.length > 0 && totalInstWeight > 0
            ? rowsWithInstRate.reduce((sum, r) => sum + r.installmentRate * (r.revenueQd > 0 ? r.revenueQd : 1), 0) / totalInstWeight
            : 0;

        const totalTargetOver = clusterRows.reduce((sum, r) => sum + r.targetOver, 0);
        const avgTargetRate = totalBaseTarget > 0 ? (totalTargetOver / totalBaseTarget) * 100 : globalPaceRate;
        const avgPctHtOver = totalTargetOver > 0 ? (totalRevenueQd / totalTargetOver) * 100 : 0;
        const totalTargetRemainingOver = clusterRows.reduce((sum, r) => sum + r.targetRemainingOver, 0);
        const avgPctDkhtOver = totalTargetOver > 0 ? (totalForecastRevenueQd / totalTargetOver) * 100 : 0;
        const totalTargetDailyRemainingOver = clusterRows.reduce((sum, r) => sum + r.targetDailyRemainingOver, 0);

        const totalAvg3Months = clusterRows.reduce((sum, r) => sum + r.avg3Months, 0);
        const avgPctGrowth = totalAvg3Months > 0 ? ((totalForecastRevenueQd - totalAvg3Months) / totalAvg3Months) * 100 : 0;

        return {
            totalRevenueQd,
            totalBaseTarget,
            avgPctHtStandard,
            totalTargetRemainingStandard,
            totalForecastRevenueQd,
            avgPctDkhtStandard,
            totalTargetDailyRemainingStandard,
            avgInstallmentRate,
            hasInstallmentRate,
            installmentStoresCount: rowsWithInstRate.length,

            avgTargetRate,
            totalTargetOver,
            avgPctHtOver,
            totalTargetRemainingOver,
            avgPctDkhtOver,
            totalTargetDailyRemainingOver,

            totalAvg3Months,
            avgPctGrowth,
            storesCount: clusterRows.length
        };
    }, [clusterRows, globalPaceRate]);

    // Metadata cập nhật mới nhất trong ngày hiệu lực (phục vụ ReportDataFreshnessBar)
    const latestRecordMeta = useMemo(() => {
        if (records.length === 0 || availableDates.length === 0) {
            return { updatedAt: null as string | null, updatedBy: null as string | null };
        }
        const matched = records.filter(r => {
            if (r.reportDate !== effectiveDate) return false;
            if (selectedStore === 'all') return true;
            const cName = getCompactStoreName(r.storeName);
            return cName === selectedStore || isStoreMatch(r.storeName, selectedStore);
        });
        const sorted = [...matched].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
        return {
            updatedAt: sorted[0]?.updatedAt || null,
            updatedBy: sorted[0]?.updatedBy || null
        };
    }, [records, availableDates.length, effectiveDate, selectedStore]);

    // Hàm định dạng số tiền theo đơn vị Tỷ hoặc Triệu (khớp quy chuẩn SalesHub: tỷ dùng '.', triệu dùng ',')
    const formatNumberVal = (val: number) => {
        if (displayUnit === 'BILLION') {
            return toBillionValue(val).toFixed(3);
        }
        return Math.round(toMillionValue(val)).toLocaleString('en-US');
    };

    // Hệ 9 cột đồng bộ độ rộng tuyệt đối cho cả Bảng 1 và Bảng 2
    const renderAlignedColGroup = () => (
        <colgroup>
            <col style={{ width: '25.5%' }} />
            <col style={{ width: '8.5%' }} />
            <col style={{ width: '11%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '7.5%' }} />
            <col style={{ width: '9.5%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '8%' }} />
            <col style={{ width: '10%' }} />
        </colgroup>
    );

    // 5. Chụp ảnh báo cáo 8K (TUYỆT ĐỐI KHÔNG CHÈN FOOTER WATERMARK, CHUẨN FONT UTM-AVO)
    const handleCaptureReport = async (action: 'DOWNLOAD' | 'COPY') => {
        if (!reportCaptureRef.current) return;
        setIsExportingImg(true);

        try {
            const scale = calculate8KScale(reportCaptureRef.current, 960);
            const canvas = await html2canvas(reportCaptureRef.current, {
                scale: scale,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                onclone: (clonedDoc) => {
                    // Nhúng trực tiếp font UTM Avo vào iframe onclone để canvas render sắc nét 100% chuẩn font
                    const styleFont = clonedDoc.createElement('style');
                    styleFont.innerHTML = `
                        @font-face {
                            font-family: 'UTM Avo';
                            src: url('/fonts/UTM-Avo.ttf') format('truetype');
                            font-weight: normal;
                            font-style: normal;
                        }
                        @font-face {
                            font-family: 'UTM Avo';
                            src: url('/fonts/UTM-AvoBold.ttf') format('truetype');
                            font-weight: bold;
                            font-style: normal;
                        }
                        * {
                            font-family: 'UTM Avo', 'UTM-Avo', sans-serif !important;
                        }
                    `;
                    clonedDoc.head.appendChild(styleFont);

                    clonedDoc.documentElement.style.height = 'auto';
                    clonedDoc.body.style.height = 'auto';
                    const targetEl = clonedDoc.getElementById('cluster-report-export-area');
                    if (targetEl) {
                        targetEl.style.height = 'auto';
                        targetEl.style.maxHeight = 'none';
                        targetEl.style.overflow = 'visible';
                        targetEl.style.fontFamily = "'UTM Avo', 'UTM-Avo', sans-serif";
                        // Đảm bảo chiều rộng portrait mobile-friendly 960px
                        targetEl.style.width = '960px';
                        targetEl.style.maxWidth = '960px';
                        targetEl.style.margin = '0 auto';
                        targetEl.querySelectorAll<HTMLElement>('.overflow-x-auto, .overflow-y-auto').forEach((el) => {
                            el.style.overflow = 'visible';
                            el.style.maxHeight = 'none';
                        });
                        // Gỡ trạng thái sticky trên ảnh xuất phẳng 960px
                        targetEl.querySelectorAll<HTMLElement>('.sticky').forEach((el) => {
                            el.style.position = 'static';
                            el.style.boxShadow = 'none';
                        });
                    }
                }
            });

            if (action === 'COPY') {
                canvas.toBlob(async (blob) => {
                    if (blob) {
                        try {
                            await navigator.clipboard.write([
                                new ClipboardItem({ 'image/png': blob })
                            ]);
                            showToast('Đã sao chép ảnh báo cáo 8K vào bộ nhớ tạm.');
                        } catch {
                            // Fallback tải file nếu trình duyệt không hỗ trợ clipboard item
                            downloadCanvas(canvas);
                        }
                    }
                }, 'image/png');
            } else {
                downloadCanvas(canvas);
            }
        } catch (err: any) {
            console.error('Lỗi xuất ảnh báo cáo cụm:', err);
            showToast('Không thể xuất ảnh báo cáo: ' + err.message, 'error');
        } finally {
            setIsExportingImg(false);
        }
    };

    const downloadCanvas = (canvas: HTMLCanvasElement) => {
        const link = document.createElement('a');
        link.download = `Bao_Cao_Cum_ST_${effectiveDate || `Thang_${selectedMonth}`}_8K.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('Đã tải ảnh báo cáo 8K về thiết bị thành công.');
    };

    // 6. Cấu hình 3 mẫu nhận xét tạo sẵn cho Cụm ST (chuẩn hóa tỷ & triệu đồng)
    const clusterAssessmentTemplates = useMemo<AssessmentTemplate[]>(() => {
        if (clusterRows.length === 0) return [];
        const topPctHt = [...clusterRows].sort((a, b) => b.pctHtOver - a.pctHtOver)[0];
        const lowPctHt = [...clusterRows].sort((a, b) => a.pctHtOver - b.pctHtOver)[0];
        const totalRevBillion = toBillionValue(clusterSummary.totalRevenueQd).toFixed(3);

        // Mẫu 1: Tổng quan súc tích
        const t1Lines: string[] = [
            `📊 ĐÁNH GIÁ SỨC KHỎE CỤM T${selectedMonth}/${selectedYear}:`,
            `• DTQĐ: ${totalRevBillion} tỷ • %HT: ${clusterSummary.avgPctHtOver.toFixed(1)}%${clusterSummary.hasInstallmentRate ? ` • Trả góp: ${clusterSummary.avgInstallmentRate.toFixed(1)}%` : ''}.`,
            topPctHt ? `🌟 Dẫn đầu: [${getShortStoreName(topPctHt.storeName)}] đạt ${topPctHt.pctHtOver.toFixed(1)}% target vượt trội.` : '',
            lowPctHt && lowPctHt.pctHtOver < 100 ? `🚨 Tăng tốc: [${getShortStoreName(lowPctHt.storeName)}] đạt ${lowPctHt.pctHtOver.toFixed(1)}%, tập trung dồn lực ca tối${clusterSummary.hasInstallmentRate ? ' & trả chậm' : ''}.` : '',
            `🎯 Toàn cụm bám sát nhịp ca để cán đích thắng lợi!`
        ].filter(Boolean);

        // Mẫu 2: Phân loại & Trọng tâm
        const reached = clusterRows.filter(r => r.pctHtOver >= 100);
        const near = clusterRows.filter(r => r.pctHtOver >= 80 && r.pctHtOver < 100);
        const alertGroup = clusterRows.filter(r => r.pctHtOver < 80);

        const t2Lines: string[] = [
            `📊 PHÂN LOẠI TIẾN ĐỘ CỤM T${selectedMonth}/${selectedYear}:`,
            `• Tổng DTQĐ: ${totalRevBillion} tỷ • %HT Vượt Trội: ${clusterSummary.avgPctHtOver.toFixed(1)}%`,
            `\n🌟 NHÓM VƯỢT TRỘI / ĐẠT CHUẨN (${reached.length}/${clusterRows.length} ST):`,
            reached.length > 0 ? reached.map(r => `- ${getShortStoreName(r.storeName)}: ${r.pctHtOver.toFixed(1)}% (${toBillionValue(r.revenueQd).toFixed(3)} tỷ)`).join('\n') : '- Chưa có ST nào đạt 100%',
            `\n⚡ NHÓM CẬN ĐÍCH (>80%): ${near.length} ST`,
            near.length > 0 ? near.map(r => `- ${getShortStoreName(r.storeName)}: ${r.pctHtOver.toFixed(1)}% (Thiếu ${Math.round(toMillionValue(r.targetRemainingOver)).toLocaleString('en-US')} tr)`).join('\n') : '- Không có',
            `\n🚨 NHÓM CẦN BỨT PHÁ (<80%): ${alertGroup.length} ST`,
            alertGroup.length > 0 ? alertGroup.map(r => `- ${getShortStoreName(r.storeName)}: ${r.pctHtOver.toFixed(1)}% (Cần ${Math.round(r.targetDailyRemainingOver).toLocaleString('en-US')} tr/ngày)`).join('\n') : '- Không có',
            `\n🔥 Toàn cụm dồn lực giờ vàng ca tối!`
        ];

        // Mẫu 3: Chi tiết & Hướng dẫn hành động
        const t3Lines: string[] = [
            `📋 HƯỚNG DẪN HÀNH ĐỘNG CỤM T${selectedMonth}/${selectedYear}:`,
            `1. THỰC TRẠNG: Toàn cụm đạt ${clusterSummary.avgPctHtOver.toFixed(1)}% target vượt trội. Mục tiêu mỗi ngày còn lại cần ${Math.round(clusterSummary.totalTargetDailyRemainingOver).toLocaleString('en-US')} tr/ngày.`,
            `2. ĐIỂM SÁNG: ${topPctHt ? `[${getShortStoreName(topPctHt.storeName)}] dẫn đầu với ${topPctHt.pctHtOver.toFixed(1)}%` : 'Duy trì nhịp bán hàng tốt'}.`,
            `3. GIẢI PHÁP HÀNH ĐỘNG THỰC CHIẾN:`,
            `• Nhịp ca: Bám sát target từng ca, không để dồn số về cuối ngày.`,
            `• Cơ cấu doanh thu: Tối ưu triệt để DTQĐ các ngành hàng trọng điểm${clusterSummary.hasInstallmentRate ? ` và nâng tỷ lệ trả chậm >${clusterSummary.avgInstallmentRate > 30 ? clusterSummary.avgInstallmentRate.toFixed(0) : '35'}%` : ''}.`,
            `• Quản lý ST: Trực tiếp bám sàn trong khung giờ vàng 18h-21h30 để chốt đơn và hỗ trợ nhân viên.`,
            `💪 Quyết tâm 100% ST trong cụm cán đích!`
        ];

        return [
            { id: 1, title: 'Mẫu 1: Tổng quan', badge: 'Súc tích', content: t1Lines.join('\n'), description: 'Đánh giá nhanh 3-4 dòng gửi nhóm Zalo cụm' },
            { id: 2, title: 'Mẫu 2: Trọng tâm', badge: 'Phân loại', content: t2Lines.join('\n'), description: 'Phân loại nhóm đạt, cận đích và nhóm cần tăng tốc' },
            { id: 3, title: 'Mẫu 3: Chi tiết', badge: 'Hành động', content: t3Lines.join('\n'), description: 'Hướng dẫn giải pháp thực chiến ca tối & trả chậm' }
        ];
    }, [clusterRows, clusterSummary, selectedMonth, selectedYear]);

    return (
        <div className="space-y-3.5 sm:space-y-4 pb-12 animate-in fade-in duration-200 max-w-[960px] mx-auto px-2 sm:px-0">
            {/* Thanh Thông Báo / Toast */}
            {toastState && (
                <div
                    role="status"
                    aria-live="polite"
                    className={`fixed top-20 right-4 z-50 px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold animate-in slide-in-from-top-3 backdrop-blur-xs ${toastState.tone === 'error'
                        ? 'bg-rose-900/95 text-white border border-rose-500/40'
                        : 'bg-slate-900/95 text-white'
                        }`}
                >
                    <Check className={`w-4 h-4 shrink-0 ${toastState.tone === 'error' ? 'text-rose-300' : 'text-emerald-400'}`} aria-hidden="true" />
                    <span>{toastState.message}</span>
                </div>
            )}

            {/* HEADER THANH ĐIỀU KHIỂN CHÍNH */}
            <div className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 border border-slate-200/80 shadow-xs space-y-3">
                {/* Band 1: Tiêu đề & Subtitle */}
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-200 shrink-0">
                        <Store className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.2]" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                            <h1 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">
                                BÁO CÁO CỤM ST
                            </h1>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200/60 uppercase tracking-wider whitespace-nowrap">
                                2 BẢNG BÁO CÁO CỤM
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-900 border border-amber-300 inline-flex items-center gap-1 whitespace-nowrap">
                                <Zap className="w-3 h-3 text-amber-600 shrink-0" aria-hidden="true" />
                                <span>Nhịp Target:</span>
                                <b className="tabular-nums">{globalPaceRate}%</b>
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-1.5 flex-wrap">
                            <span>Dữ liệu đồng bộ từ:</span>
                            <code className="text-indigo-600 font-bold bg-indigo-50/80 px-1.5 py-0.5 rounded font-mono text-[11px]">
                                Cập nhật &gt; Báo cáo Tổng hợp &gt; Luỹ kế DT
                            </code>
                        </p>
                    </div>
                </div>

                {/* Band 2: Thanh nút hành động chính */}
                {(canConfigureTarget || clusterRows.length > 0) && (
                    <div className="flex items-center justify-start sm:justify-end gap-2 flex-wrap pt-2.5 border-t border-slate-100">
                        {/* Nút Cấu hình Target: Mở cho ADMIN, QUẢN LÝ (QL) và TRƯỞNG CA (TC) */}
                        {canConfigureTarget && (
                            <button
                                type="button"
                                onClick={() => setIsTargetModalOpen(true)}
                                className="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/80 text-xs font-black flex items-center gap-1.5 shadow-2xs transition cursor-pointer whitespace-nowrap"
                                title="Tùy biến Target Vượt Trội & Doanh thu TB 3 tháng cho từng ST phụ trách"
                            >
                                <Target className="w-4 h-4 text-amber-600 shrink-0" aria-hidden="true" />
                                <span>CẤU HÌNH TARGET</span>
                            </button>
                        )}

                        {clusterRows.length > 0 && (
                            <ReportActionButtons
                                onExportImage={() => handleCaptureReport('DOWNLOAD')}
                                onCopyImage={() => handleCaptureReport('COPY')}
                                isExporting={isExportingImg}
                                hasAssessment={true}
                                hasAssessmentToggle={true}
                                showAssessmentOnReport={showAssessment}
                                onToggleShowAssessment={setShowAssessment}
                                assessmentTemplates={clusterAssessmentTemplates}
                                currentComment={assessmentData?.comment}
                                onSaveComment={async (comment, showOnReport) => {
                                    await saveClusterAssessment({
                                        month: selectedMonth,
                                        year: selectedYear,
                                        comment
                                    });
                                    setShowAssessment(showOnReport);
                                    loadAllData();
                                    showToast('Đã lưu nhận xét thành công!');
                                }}
                                reportTitle={`Báo Cáo Sức Khỏe Cụm T${selectedMonth}/${selectedYear}`}
                                periodLabel={`Tháng ${selectedMonth}/${selectedYear}`}
                            />
                        )}
                    </div>
                )}
            </div>

            {/* BỘ LỌC KỲ BÁO CÁO, CHỌN BẢNG & ĐƠN VỊ HIỂN THỊ */}
            <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-2xs space-y-3 text-xs">
                {/* HÀNG 1: BỘ LỌC ST / CỤM (BẮT BUỘC ĐẦU TIÊN & NẰM RIÊNG LẺ 1 DÒNG) */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
                        <label
                            htmlFor="cluster-store-select"
                            className="text-xs font-black text-slate-600 uppercase tracking-wider shrink-0 flex items-center gap-1.5"
                        >
                            <Store className="w-4 h-4 text-amber-600" aria-hidden="true" />
                            <span>ST / Cụm:</span>
                        </label>
                        <div className={`flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-xl border text-xs font-bold transition-all w-full sm:w-auto sm:min-w-[300px] ${isLockedToSingleStore
                            ? 'bg-amber-50/90 border-amber-200 text-amber-900 shadow-2xs'
                            : 'bg-slate-50 border-slate-300 text-slate-700 hover:border-amber-400'
                            }`}>
                            {isLockedToSingleStore ? (
                                <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />
                            ) : (
                                <Store className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
                            )}
                            <select
                                id="cluster-store-select"
                                name="selectedStore"
                                aria-label="Chọn ST hoặc Cụm"
                                value={selectedStore}
                                onChange={(e) => setSelectedStore(e.target.value)}
                                disabled={isLockedToSingleStore}
                                className={`bg-transparent outline-none font-bold w-full min-w-0 ${isLockedToSingleStore
                                    ? 'cursor-not-allowed text-amber-900 font-black'
                                    : 'cursor-pointer text-slate-700'
                                    }`}
                            >
                                {canViewAllStores && (
                                    <option value="all">
                                        {isAdmin
                                            ? `TỔNG TOÀN CỤM (${accessibleStoreList.length} ST)`
                                            : `TỔNG CỤM PHỤ TRÁCH (${accessibleStoreList.length} ST)`
                                        }
                                    </option>
                                )}
                                {accessibleStoreList.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                            {isLockedToSingleStore && (
                                <span className="text-[10px] bg-amber-200/80 text-amber-800 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0">
                                    {isGuest ? 'Trải nghiệm' : 'Đã khóa'}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* HÀNG 2: TIÊU CHÍ THỜI GIAN, CHỌN BẢNG & ĐƠN VỊ HIỂN THỊ */}
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 sm:gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Chọn Tháng / Năm */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 min-h-[36px]">
                        <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
                        <label htmlFor="cluster-month-select" className="font-bold text-slate-600 text-[11px]">Kỳ:</label>
                        <select
                            id="cluster-month-select"
                            name="selectedMonth"
                            aria-label="Chọn tháng báo cáo"
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(Number(e.target.value))}
                            className="bg-transparent font-extrabold text-slate-800 outline-none cursor-pointer"
                        >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                <option key={m} value={m}>Tháng {m}</option>
                            ))}
                        </select>
                        <span className="text-slate-300">/</span>
                        <select
                            id="cluster-year-select"
                            name="selectedYear"
                            aria-label="Chọn năm báo cáo"
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="bg-transparent font-extrabold text-slate-800 outline-none cursor-pointer"
                        >
                            {[2024, 2025, 2026, 2027].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    {/* Chọn Ngày chốt */}
                    {availableDates.length > 0 && (
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 min-h-[36px]">
                            <label htmlFor="cluster-date-select" className="font-bold text-slate-600 text-[11px] whitespace-nowrap">Ngày chốt:</label>
                            <select
                                id="cluster-date-select"
                                name="selectedDate"
                                aria-label="Chọn ngày chốt số liệu"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="bg-transparent font-extrabold text-slate-800 outline-none cursor-pointer"
                            >
                                <option value="latest">Mới nhất ({formatDate(availableDates[0])})</option>
                                {availableDates.map(d => (
                                    <option key={d} value={d}>{formatDate(d)}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* BỘ CHỌN TAB HIỂN THỊ BẢNG */}
                    <div
                        role="group"
                        aria-label="Chọn bảng hiển thị"
                        className="grid grid-cols-3 sm:inline-flex items-center p-0.5 rounded-xl bg-slate-100 border border-slate-200 text-[11px] font-bold w-full sm:w-auto"
                    >
                        <button
                            type="button"
                            onClick={() => setTableFilter('ALL')}
                            aria-pressed={tableFilter === 'ALL'}
                            className={`px-2.5 py-1.5 sm:py-1 rounded-lg transition cursor-pointer whitespace-nowrap text-center ${tableFilter === 'ALL'
                                ? 'bg-white text-indigo-700 shadow-2xs font-black'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            Tất cả (2)
                        </button>
                        <button
                            type="button"
                            onClick={() => setTableFilter('STANDARD')}
                            aria-pressed={tableFilter === 'STANDARD'}
                            className={`px-2.5 py-1.5 sm:py-1 rounded-lg transition cursor-pointer whitespace-nowrap text-center ${tableFilter === 'STANDARD'
                                ? 'bg-white text-emerald-700 shadow-2xs font-black'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            Bảng 1: Chuẩn
                        </button>
                        <button
                            type="button"
                            onClick={() => setTableFilter('OVER')}
                            aria-pressed={tableFilter === 'OVER'}
                            className={`px-2.5 py-1.5 sm:py-1 rounded-lg transition cursor-pointer whitespace-nowrap text-center ${tableFilter === 'OVER'
                                ? 'bg-white text-amber-700 shadow-2xs font-black'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            Bảng 2: V.Trội
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2 justify-between sm:justify-end">
                    {/* Chuyển đổi đơn vị Tỷ / Triệu */}
                    <div
                        role="group"
                        aria-label="Chọn đơn vị hiển thị số liệu"
                        className="flex items-center p-0.5 rounded-xl bg-slate-100 border border-slate-200 text-[11px] font-bold"
                    >
                        <button
                            type="button"
                            onClick={() => setDisplayUnit('BILLION')}
                            aria-pressed={displayUnit === 'BILLION'}
                            className={`px-2.5 py-1.5 sm:py-1 rounded-lg transition cursor-pointer whitespace-nowrap ${displayUnit === 'BILLION'
                                ? 'bg-white text-indigo-700 shadow-2xs font-black'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            Tỷ đồng (1.638)
                        </button>
                        <button
                            type="button"
                            onClick={() => setDisplayUnit('MILLION')}
                            aria-pressed={displayUnit === 'MILLION'}
                            className={`px-2.5 py-1.5 sm:py-1 rounded-lg transition cursor-pointer whitespace-nowrap ${displayUnit === 'MILLION'
                                ? 'bg-white text-indigo-700 shadow-2xs font-black'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            Triệu đồng (1,638 tr)
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={loadAllData}
                        disabled={loading}
                        aria-label="Tải lại số liệu"
                        className="w-9 h-9 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer flex items-center justify-center shrink-0 disabled:opacity-60"
                        title="Tải lại số liệu"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} aria-hidden="true" />
                    </button>
                </div>
                </div>
            </div>

            {/* TRẠNG THÁI LƯU TRỮ CLOUD & ĐỘ MỚI DỮ LIỆU (BỊ BỎ QUA KHI XUẤT ẢNH) */}
            <CloudDataSyncStatusBanner
                compact={true}
                storageType="cloud"
                syncStatus={loadError ? 'error' : loading ? 'syncing' : 'synced'}
                tableReady={!loadError}
                tableName="daily_business_records & system_performance_configs"
                lastSyncTime={lastLoadedAt}
                onSyncNow={loadAllData}
                customMessage={
                    loadError
                        ? loadError
                        : 'Số liệu kinh doanh & cấu hình Target Cụm đồng bộ trực tiếp từ Supabase Cloud.'
                }
            />

            {!loading && !loadError && availableDates.length > 0 && (
                <ReportDataFreshnessBar
                    latestDataDate={effectiveDate}
                    lastUpdatedAt={latestRecordMeta.updatedAt}
                    lastUpdatedBy={latestRecordMeta.updatedBy}
                    storeName={selectedStore === 'all' ? 'Toàn cụm ST phụ trách' : selectedStore}
                    actionUrl="/cap-nhat"
                    actionLabel="Cập nhật số liệu LK"
                    canUpdate={canConfigureTarget}
                    compact={true}
                />
            )}

            {loadError ? (
                <div className="bg-white rounded-2xl border border-rose-200 p-6 sm:p-8 text-center space-y-3 shadow-xs">
                    <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
                        <AlertCircle className="w-5 h-5" aria-hidden="true" />
                    </div>
                    <div className="space-y-1 max-w-md mx-auto">
                        <h2 className="text-sm sm:text-base font-black text-slate-900">
                            Không thể tải báo cáo cụm ST
                        </h2>
                        <p className="text-xs text-slate-600 leading-relaxed">
                            {loadError}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={loadAllData}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition cursor-pointer"
                    >
                        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Thử tải lại</span>
                    </button>
                </div>
            ) : loading ? (
                <div className="space-y-3.5" aria-busy="true" aria-label="Đang tải dữ liệu báo cáo cụm">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                        {[0, 1, 2].map((idx) => (
                            <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs animate-pulse space-y-2.5">
                                <div className="h-3 w-28 bg-slate-200 rounded" />
                                <div className="h-7 w-32 bg-slate-200 rounded" />
                                <div className="h-3 w-40 bg-slate-100 rounded" />
                            </div>
                        ))}
                    </div>
                    <div className="bg-white rounded-3xl border border-slate-200 p-5 space-y-3 animate-pulse">
                        <div className="h-16 bg-slate-200/80 rounded-2xl" />
                        <div className="h-44 bg-slate-100 rounded-2xl" />
                    </div>
                </div>
            ) : clusterRows.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-10 text-center space-y-3.5 shadow-xs">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center mx-auto">
                        <Store className="w-6 h-6" aria-hidden="true" />
                    </div>
                    <div className="space-y-1 max-w-md mx-auto">
                        <h2 className="text-sm sm:text-base font-black text-slate-900">
                            Chưa có dữ liệu báo cáo Tháng {selectedMonth}/{selectedYear}
                        </h2>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            {canConfigureTarget
                                ? 'Chưa ghi nhận dữ liệu lũy kế ST cho kỳ này. Vui lòng nạp báo cáo tại phân hệ Cập nhật số liệu LK để hệ thống tổng hợp.'
                                : 'Chưa có dữ liệu kinh doanh cho kỳ hoặc phạm vi ST đã chọn. Vui lòng đổi kỳ báo cáo hoặc liên hệ Quản lý.'}
                        </p>
                    </div>
                    <div className="flex items-center justify-center gap-2 flex-wrap">
                        {canConfigureTarget && (
                            <button
                                type="button"
                                onClick={() => navigate('/cap-nhat')}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer shadow-2xs"
                            >
                                <span>Đi tới Cập nhật số liệu LK</span>
                                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={loadAllData}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                        >
                            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Kiểm tra lại</span>
                        </button>
                    </div>
                </div>
            ) : (
                <>
                    {/* KHỐI THẺ CHỈ SỐ SỨC KHỎE CỐT LÕI (TỰ ĐỘNG CO DÃN 2 HOẶC 3 CỘT NẾU CÓ HOẶC KHÔNG CÓ % TRẢ GÓP) */}
                    <div className={`grid grid-cols-1 ${clusterSummary.hasInstallmentRate ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3.5`}>
                        {/* THẺ 1: TỔNG DTQĐ LŨY KẾ CỤM (LẤY DTQĐ LÀM TRỌNG TÂM) */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <div className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider truncate">
                                    Tổng DTQĐ Cụm
                                </div>
                                <div className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5 tracking-tight tabular-nums">
                                    {formatNumberVal(clusterSummary.totalRevenueQd)}{' '}
                                    <span className="text-xs font-bold text-indigo-600">{displayUnit === 'BILLION' ? 'tỷ' : 'tr'}</span>
                                </div>
                                <div className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">
                                    Dự kiến: <b className="text-slate-700 font-bold tabular-nums">{formatNumberVal(clusterSummary.totalForecastRevenueQd)} {displayUnit === 'BILLION' ? 'tỷ' : 'tr'}</b> (<span className="tabular-nums">{clusterSummary.avgPctDkhtStandard.toFixed(1)}%</span> DKHT)
                                </div>
                            </div>
                            <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-2xs">
                                <Coins className="w-5 h-5 stroke-[2.2]" aria-hidden="true" />
                            </div>
                        </div>

                        {/* THẺ 2: %HT TARGET VƯỢT TRỘI */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider truncate">
                                    %HT Target Vượt Trội
                                </div>
                                <div className={`text-xl sm:text-2xl font-black mt-0.5 tracking-tight tabular-nums ${clusterSummary.avgPctHtOver >= 100
                                    ? 'text-emerald-600'
                                    : clusterSummary.avgPctHtOver >= 85
                                        ? 'text-amber-700'
                                        : 'text-rose-600'
                                    }`}>
                                    {clusterSummary.avgPctHtOver.toFixed(1)}%
                                </div>
                                <div className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">
                                    Mục tiêu: <b className="text-slate-700 font-bold tabular-nums">{formatNumberVal(clusterSummary.totalTargetOver)} {displayUnit === 'BILLION' ? 'tỷ' : 'tr'}</b> (<span className="tabular-nums">{clusterSummary.avgTargetRate.toFixed(1)}%</span>)
                                </div>
                            </div>
                            <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0 shadow-2xs">
                                <Target className="w-5 h-5 stroke-[2.2]" aria-hidden="true" />
                            </div>
                        </div>

                        {/* THẺ 3: TỶ TRỌNG TRẢ GÓP (CHỈ HIỂN THỊ KHI CÓ DỮ LIỆU % TRẢ GÓP) */}
                        {clusterSummary.hasInstallmentRate && (
                            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3 animate-in fade-in">
                                <div className="min-w-0">
                                    <div className="text-[11px] font-bold text-purple-800 uppercase tracking-wider truncate">
                                        Tỷ Trọng Trả Góp
                                    </div>
                                    <div className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5 tracking-tight tabular-nums">
                                        {clusterSummary.avgInstallmentRate.toFixed(1)}%
                                    </div>
                                    <div className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">
                                        Ghi nhận tại <b className="text-slate-700 font-bold tabular-nums">{clusterSummary.installmentStoresCount}/{clusterSummary.storesCount} ST</b>
                                    </div>
                                </div>
                                <div className="w-11 h-11 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0 shadow-2xs">
                                    <Award className="w-5 h-5 stroke-[2.2]" aria-hidden="true" />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* VÙNG XUẤT ẢNH BÁO CÁO (CHỤP CANVAS GỬI MESSAGING APP) */}
                    <div className="overflow-x-auto no-scrollbar">
                        <style>{`
                            #cluster-report-export-area,
                            #cluster-report-export-area *,
                            #cluster-report-export-area table,
                            #cluster-report-export-area thead,
                            #cluster-report-export-area tbody,
                            #cluster-report-export-area tfoot,
                            #cluster-report-export-area tr,
                            #cluster-report-export-area th,
                            #cluster-report-export-area td,
                            #cluster-report-export-area span,
                            #cluster-report-export-area div,
                            #cluster-report-export-area h2 {
                                font-family: 'UTM Avo', 'UTM-Avo', sans-serif !important;
                            }
                        `}</style>
                        <div
                            ref={reportCaptureRef}
                            id="cluster-report-export-area"
                            data-report-table="true"
                            style={{ fontFamily: "'UTM Avo', 'UTM-Avo', sans-serif" }}
                            className="bg-white p-3.5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm max-w-[960px] mx-auto space-y-4 font-avo report-table"
                        >
                            {/* BANNER BÁO CÁO: ĐỒNG BỘ HIỆN ĐẠI CHUẨN SALESHUB */}
                            <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-xl bg-amber-400/20 border border-amber-300/30 flex items-center justify-center text-amber-300 shrink-0">
                                            <Store className="w-4.5 h-4.5" aria-hidden="true" />
                                        </div>
                                        <h2 className="text-base sm:text-lg font-black tracking-wide uppercase text-white font-avo">
                                            BÁO CÁO SỨC KHỎE CỤM ST
                                        </h2>
                                    </div>
                                    <div className="text-xs text-slate-300 mt-2 flex items-center gap-1.5 flex-wrap">
                                        <span className="bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                                            Số liệu ngày: <b className="text-amber-300 tabular-nums">{formatDate(effectiveDate)}</b>
                                        </span>
                                        <span className="bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                                            Kỳ: <b className="text-white tabular-nums">Tháng {selectedMonth}/{selectedYear}</b>
                                        </span>
                                        <span className="bg-white/5 px-2 py-0.5 rounded-md border border-white/10">
                                            {selectedStore === 'all' ? (isAdmin ? 'Toàn cụm' : 'Cụm phụ trách') : selectedStore}: <b className="text-emerald-400 tabular-nums">{clusterRows.length} ST</b>
                                        </span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                                    <span className="bg-white/10 px-3 py-1.5 rounded-xl text-xs font-black border border-white/15 text-amber-300 inline-flex items-center gap-1.5 whitespace-nowrap">
                                        <Zap className="w-3.5 h-3.5 text-amber-300 shrink-0" aria-hidden="true" />
                                        <span className="tabular-nums">TARGET VÙNG: {globalPaceRate}%</span>
                                    </span>
                                    <span className="bg-white/10 px-2.5 py-1.5 rounded-xl text-xs font-bold border border-white/10 text-slate-200 whitespace-nowrap">
                                        {displayUnit === 'BILLION' ? 'Đơn vị: Tỷ' : 'Đơn vị: Triệu'}
                                    </span>
                                </div>
                            </div>

                            {/* Gợi ý thao tác trên mobile */}
                            <div
                                data-html2canvas-ignore="true"
                                className="md:hidden flex items-center justify-end text-[11px] font-bold text-slate-500 px-1"
                            >
                                <span>Vuốt ngang bảng để xem đủ 9 cột &rarr;</span>
                            </div>

                            {/* ============================================================== */}
                            {/* BẢNG 1: LŨY KẾ THEO DỮ LIỆU CHUẨN CỦA HỆ THỐNG (9 CỘT) */}
                            {/* ============================================================== */}
                            {(tableFilter === 'ALL' || tableFilter === 'STANDARD') && (
                                <div className="space-y-2">
                                    {/* Tiêu đề Bảng 1 */}
                                    <div className="flex items-center justify-between gap-2 flex-wrap px-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="px-2.5 py-1 rounded-xl font-black text-xs uppercase bg-emerald-700 text-white shadow-2xs inline-flex items-center gap-1.5 whitespace-nowrap">
                                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                                <span>TARGET CHUẨN HỆ THỐNG</span>
                                            </span>
                                            <span className="text-[11px] font-bold text-slate-500">
                                                (Tiến độ theo Target chuẩn 100%)
                                            </span>
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-slate-200 overflow-x-auto shadow-2xs">
                                        <table
                                            data-report-table="true"
                                            className="table-fixed w-full min-w-[820px] text-xs text-left border-collapse font-avo report-table"
                                            style={{ fontFamily: "'UTM Avo', 'UTM-Avo', sans-serif" }}
                                        >
                                            {renderAlignedColGroup()}
                                            <thead>
                                                {/* Hàng 1: Khối nhóm Header chuyên nghiệp (9 cột thẳng hàng Bảng 2) */}
                                                <tr className="text-[10px] font-black uppercase tracking-wider border-b border-slate-200">
                                                    <th
                                                        rowSpan={2}
                                                        className="sticky left-0 z-20 py-3 px-2 bg-slate-800 text-white text-center border-r border-slate-700"
                                                    >
                                                        ST
                                                    </th>
                                                    <th
                                                        rowSpan={2}
                                                        className="py-3 px-1.5 bg-emerald-700 text-white text-center border-r border-emerald-600 leading-tight"
                                                    >
                                                        %TG
                                                        <div className="text-[9px] font-normal lowercase text-emerald-100">(trả góp)</div>
                                                    </th>
                                                    <th
                                                        rowSpan={2}
                                                        className="py-3 px-1.5 bg-blue-700 text-white text-center border-r border-blue-600 leading-tight"
                                                    >
                                                        LŨY KẾ DTQĐ
                                                    </th>
                                                    <th
                                                        colSpan={3}
                                                        className="py-2 px-1.5 bg-amber-600 text-white text-center border-r border-amber-500"
                                                    >
                                                        TARGET CHUẨN
                                                    </th>
                                                    <th
                                                        colSpan={2}
                                                        className="py-2 px-1.5 bg-indigo-700 text-white text-center border-r border-indigo-600"
                                                    >
                                                        DỰ KIẾN THÁNG
                                                    </th>
                                                    <th
                                                        rowSpan={2}
                                                        className="py-3 px-1.5 bg-purple-700 text-white text-center leading-tight"
                                                    >
                                                        CÒN LẠI
                                                        <div className="text-[9px] font-normal lowercase text-purple-200">(tr/ngày)</div>
                                                    </th>
                                                </tr>

                                                {/* Hàng 2: Chi tiết các cột con (Target Chuẩn + Dự Kiến Tháng) */}
                                                <tr className="text-[9.5px] sm:text-[10px] font-black uppercase tracking-tight border-b border-slate-200">
                                                    {/* Target Chuẩn (3 cột) */}
                                                    <th className="py-2 px-1 text-center bg-amber-50 text-amber-900 border-r border-amber-100 whitespace-nowrap">
                                                        TARGET
                                                    </th>
                                                    <th className="py-2 px-1 text-center bg-amber-50 text-amber-900 border-r border-amber-100 whitespace-nowrap">
                                                        %HT
                                                    </th>
                                                    <th className="py-2 px-1 text-center bg-amber-50 text-amber-900 border-r border-amber-100 whitespace-nowrap">
                                                        CÒN LẠI
                                                    </th>

                                                    {/* Dự kiến tháng (2 cột) */}
                                                    <th className="py-2 px-1 text-center bg-indigo-50 text-indigo-900 border-r border-indigo-100 whitespace-nowrap">
                                                        DTQĐ
                                                    </th>
                                                    <th className="py-2 px-1 text-center bg-indigo-50 text-indigo-900 border-r border-indigo-100 whitespace-nowrap">
                                                        %DKHT
                                                    </th>
                                                </tr>
                                            </thead>

                                            <tbody className="divide-y divide-slate-100 font-bold text-slate-800 text-[11px] sm:text-xs">
                                                {clusterRows.map((row) => {
                                                    const compactName = getCompactStoreName(row.storeName);

                                                    return (
                                                        <tr
                                                            key={`b1-${row.storeName}`}
                                                            className="hover:bg-amber-50/40 transition group"
                                                        >
                                                            {/* 1. ST: Gọn gàng, không hiển thị mã số */}
                                                            <td className="sticky left-0 z-10 py-2.5 px-2 bg-white group-hover:bg-amber-50 border-r border-slate-100 shadow-[2px_0_4px_-2px_rgba(15,23,42,0.08)]">
                                                                <div className="flex items-center gap-1.5 min-w-0">
                                                                    <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-black text-[10px] flex items-center justify-center shrink-0 shadow-2xs tabular-nums">
                                                                        {row.orderIndex}
                                                                    </span>
                                                                    <span
                                                                        className="font-black text-slate-900 leading-tight truncate flex-1 min-w-0"
                                                                        title={row.storeName}
                                                                    >
                                                                        {compactName}
                                                                    </span>
                                                                </div>
                                                            </td>

                                                            {/* 2. %TG (Tỷ trọng trả góp) */}
                                                            <td
                                                                className="py-2.5 px-1.5 text-center font-black border-r border-slate-100 tabular-nums"
                                                                title={row.hasInstallmentRate ? `Tỷ trọng trả góp: ${row.installmentRate.toFixed(1)}%` : 'Chưa có dữ liệu tỷ trọng trả góp'}
                                                            >
                                                                {row.hasInstallmentRate ? (
                                                                    <span className="inline-block text-[10.5px] font-black text-emerald-900 bg-emerald-100/80 px-1.5 py-0.5 rounded border border-emerald-300">
                                                                        {row.installmentRate.toFixed(1)}%
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-slate-400">—</span>
                                                                )}
                                                            </td>

                                                            {/* 3. LŨY KẾ DTQĐ */}
                                                            <td className="py-2.5 px-1.5 text-center font-black text-blue-700 border-r border-slate-100 tabular-nums">
                                                                {formatNumberVal(row.revenueQd)}
                                                            </td>

                                                            {/* 4. TARGET (Target DTQĐ Chuẩn Hệ Thống) */}
                                                            <td
                                                                className="py-2.5 px-1.5 text-center font-black border-r border-slate-100 text-slate-900 tabular-nums"
                                                                title={`Target DTQĐ: ${formatNumberVal(row.baseTarget)}`}
                                                            >
                                                                {formatNumberVal(row.baseTarget)}
                                                            </td>

                                                            {/* 5. %HT */}
                                                            <td className={`py-2.5 px-1 text-center font-black border-r border-slate-100 tabular-nums ${row.pctHtStandard >= 100
                                                                ? 'text-emerald-600'
                                                                : row.pctHtStandard >= 85
                                                                    ? 'text-amber-600'
                                                                    : 'text-rose-600'
                                                                }`}>
                                                                {row.pctHtStandard.toFixed(1)}%
                                                            </td>

                                                            {/* 6. TARGET CÒN LẠI */}
                                                            <td className="py-2.5 px-1.5 text-center font-black border-r border-slate-100 text-slate-700 tabular-nums">
                                                                {formatNumberVal(row.targetRemainingStandard)}
                                                            </td>

                                                            {/* 7. DTQĐ DỰ KIẾN */}
                                                            <td className="py-2.5 px-1.5 text-center font-black text-indigo-700 border-r border-slate-100 tabular-nums">
                                                                {formatNumberVal(row.forecastRevenueQd)}
                                                            </td>

                                                            {/* 8. %DKHT */}
                                                            <td className={`py-2.5 px-1 text-center font-black border-r border-slate-100 tabular-nums ${row.pctDkhtStandard >= 100
                                                                ? 'text-emerald-600'
                                                                : row.pctDkhtStandard >= 90
                                                                    ? 'text-amber-600'
                                                                    : 'text-rose-600'
                                                                }`}>
                                                                {row.pctDkhtStandard.toFixed(1)}%
                                                            </td>

                                                            {/* 9. TARGET CHUẨN MỖI NGÀY CÒN LẠI (Hiển thị tr/ngày làm tròn) */}
                                                            <td
                                                                className="py-2.5 px-1.5 text-center font-black text-purple-900 bg-purple-50/30 tabular-nums"
                                                                title={`Còn ${row.remainingDays} ngày trong tháng • Target chuẩn còn lại: ${Math.round(toMillionValue(row.targetRemainingStandard)).toLocaleString('en-US')} tr`}
                                                            >
                                                                {Math.round(row.targetDailyRemainingStandard).toLocaleString('en-US')}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>

                                            {/* DÒNG TỔNG CỤM BẢNG 1 - EXECUTIVE DARK STYLE */}
                                            <tfoot>
                                                <tr className="bg-slate-900 text-white font-black text-xs border-t-2 border-slate-700">
                                                    {/* Cột Tên */}
                                                    <td className="sticky left-0 z-20 py-3 px-2 bg-slate-900 text-center uppercase tracking-wider border-r border-slate-800 text-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.3)]">
                                                        TỔNG CỤM
                                                    </td>

                                                    {/* % Trả góp */}
                                                    <td className="py-3 px-1.5 text-center font-black border-r border-slate-800 tabular-nums">
                                                        {clusterSummary.hasInstallmentRate ? (
                                                            <span className="inline-block text-[10.5px] font-black text-emerald-200 bg-emerald-900/60 px-1.5 py-0.5 rounded border border-emerald-700/60">
                                                                {clusterSummary.avgInstallmentRate.toFixed(1)}%
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400">—</span>
                                                        )}
                                                    </td>

                                                    {/* Lũy kế DTQĐ */}
                                                    <td className="py-3 px-1.5 text-center font-black text-blue-300 border-r border-slate-800 tabular-nums">
                                                        {formatNumberVal(clusterSummary.totalRevenueQd)}
                                                    </td>

                                                    {/* Target */}
                                                    <td className="py-3 px-1.5 text-center font-black border-r border-slate-800 text-amber-200 tabular-nums">
                                                        {formatNumberVal(clusterSummary.totalBaseTarget)}
                                                    </td>

                                                    {/* %HT */}
                                                    <td className="py-3 px-1 text-center font-black text-emerald-400 border-r border-slate-800 tabular-nums">
                                                        {clusterSummary.avgPctHtStandard.toFixed(1)}%
                                                    </td>

                                                    {/* Target còn lại */}
                                                    <td className="py-3 px-1.5 text-center font-black border-r border-slate-800 text-slate-300 tabular-nums">
                                                        {formatNumberVal(clusterSummary.totalTargetRemainingStandard)}
                                                    </td>

                                                    {/* DTQĐ Dự kiến */}
                                                    <td className="py-3 px-1.5 text-center font-black text-indigo-300 border-r border-slate-800 tabular-nums">
                                                        {formatNumberVal(clusterSummary.totalForecastRevenueQd)}
                                                    </td>

                                                    {/* %DKHT */}
                                                    <td className="py-3 px-1 text-center font-black text-emerald-400 border-r border-slate-800 tabular-nums">
                                                        {clusterSummary.avgPctDkhtStandard.toFixed(1)}%
                                                    </td>

                                                    {/* Target chuẩn mỗi ngày còn lại (triệu/ngày) */}
                                                    <td className="py-3 px-1.5 text-center font-black text-purple-200 bg-slate-800/80 tabular-nums">
                                                        {Math.round(clusterSummary.totalTargetDailyRemainingStandard).toLocaleString('en-US')}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* ============================================================== */}
                            {/* BẢNG 2: MỤC TIÊU VƯỢT TRỘI (9 CỘT) */}
                            {/* ============================================================== */}
                            {(tableFilter === 'ALL' || tableFilter === 'OVER') && (
                                <div className="space-y-2 pt-2">
                                    {/* Tiêu đề Bảng 2 */}
                                    <div className="flex items-center justify-between gap-2 flex-wrap px-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="px-2.5 py-1 rounded-xl font-black text-xs uppercase bg-indigo-700 text-white shadow-2xs inline-flex items-center gap-1.5 whitespace-nowrap">
                                                <Target className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                                <span>TARGET VƯỢT TRỘI</span>
                                            </span>
                                            <span className="text-[11px] font-bold text-slate-500">
                                                (Tiến độ theo Target vượt trội)
                                            </span>
                                        </div>
                                    </div>

                                    <div className="rounded-2xl border border-slate-200 overflow-x-auto shadow-2xs">
                                        <table
                                            data-report-table="true"
                                            className="table-fixed w-full min-w-[820px] text-xs text-left border-collapse font-avo report-table"
                                            style={{ fontFamily: "'UTM Avo', 'UTM-Avo', sans-serif" }}
                                        >
                                            {renderAlignedColGroup()}
                                            <thead>
                                                {/* Hàng 1: Khối nhóm Header chuyên nghiệp (9 cột thẳng hàng Bảng 1) */}
                                                <tr className="text-[10px] font-black uppercase tracking-wider border-b border-slate-200">
                                                    <th
                                                        rowSpan={2}
                                                        className="sticky left-0 z-20 py-3 px-2 bg-slate-800 text-white text-center border-r border-slate-700"
                                                    >
                                                        ST
                                                    </th>
                                                    <th
                                                        rowSpan={2}
                                                        className="py-3 px-1.5 bg-amber-600 text-white text-center border-r border-amber-500 leading-tight"
                                                    >
                                                        TARGET
                                                        <div className="text-[9px] font-normal lowercase text-amber-100">(nhịp %)</div>
                                                    </th>
                                                    <th
                                                        rowSpan={2}
                                                        className="py-3 px-1.5 bg-blue-700 text-white text-center border-r border-blue-600 leading-tight"
                                                    >
                                                        LŨY KẾ DTQĐ
                                                    </th>
                                                    <th
                                                        colSpan={3}
                                                        className="py-2 px-1.5 bg-amber-700 text-white text-center border-r border-amber-600"
                                                    >
                                                        TIẾN ĐỘ VƯỢT TRỘI
                                                    </th>
                                                    <th
                                                        colSpan={2}
                                                        className="py-2 px-1.5 bg-indigo-700 text-white text-center border-r border-indigo-600"
                                                    >
                                                        DỰ KIẾN
                                                    </th>
                                                    <th
                                                        rowSpan={2}
                                                        className="py-3 px-1.5 bg-purple-700 text-white text-center leading-tight"
                                                    >
                                                        CÒN LẠI
                                                        <div className="text-[9px] font-normal lowercase text-purple-200">(tr/ngày)</div>
                                                    </th>
                                                </tr>

                                                {/* Hàng 2: Chi tiết các cột con */}
                                                <tr className="text-[9.5px] sm:text-[10px] font-black uppercase tracking-tight border-b border-slate-200">
                                                    {/* Tiến độ vượt trội */}
                                                    <th className="py-2 px-1 text-center bg-amber-50 text-amber-900 border-r border-amber-100 whitespace-nowrap">
                                                        TARGET
                                                    </th>
                                                    <th className="py-2 px-1 text-center bg-amber-50 text-amber-900 border-r border-amber-100 whitespace-nowrap">
                                                        %HT
                                                    </th>
                                                    <th className="py-2 px-1 text-center bg-amber-50 text-amber-900 border-r border-amber-100 whitespace-nowrap">
                                                        CÒN LẠI
                                                    </th>

                                                    {/* Dự kiến tháng */}
                                                    <th className="py-2 px-1 text-center bg-indigo-50 text-indigo-900 border-r border-indigo-100 whitespace-nowrap">
                                                        DTQĐ
                                                    </th>
                                                    <th className="py-2 px-1 text-center bg-indigo-50 text-indigo-900 border-r border-indigo-100 whitespace-nowrap">
                                                        %DKHT
                                                    </th>
                                                </tr>
                                            </thead>

                                            <tbody className="divide-y divide-slate-100 font-bold text-slate-800 text-[11px] sm:text-xs">
                                                {clusterRows.map((row) => {
                                                    const compactName = getCompactStoreName(row.storeName);

                                                    return (
                                                        <tr
                                                            key={`b2-${row.storeName}`}
                                                            className="hover:bg-amber-50/40 transition group"
                                                        >
                                                            {/* 1. ST */}
                                                            <td className="sticky left-0 z-10 py-2.5 px-2 bg-white group-hover:bg-amber-50 border-r border-slate-100 shadow-[2px_0_4px_-2px_rgba(15,23,42,0.08)]">
                                                                <div className="flex items-center gap-1.5 min-w-0">
                                                                    <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-black text-[10px] flex items-center justify-center shrink-0 shadow-2xs tabular-nums">
                                                                        {row.orderIndex}
                                                                    </span>
                                                                    <span
                                                                        className="font-black text-slate-900 leading-tight truncate flex-1 min-w-0"
                                                                        title={row.storeName}
                                                                    >
                                                                        {compactName}
                                                                    </span>
                                                                </div>
                                                            </td>

                                                            {/* 2. % VƯỢT TRỘI */}
                                                            <td className="py-2.5 px-1.5 text-center font-black border-r border-slate-100 tabular-nums">
                                                                <span className="inline-block text-[10.5px] font-black text-amber-900 bg-amber-100/80 px-1.5 py-0.5 rounded border border-amber-300">
                                                                    {row.targetRate}%
                                                                </span>
                                                            </td>

                                                            {/* 3. LŨY KẾ DTQĐ */}
                                                            <td className="py-2.5 px-1.5 text-center font-black text-blue-700 border-r border-slate-100 tabular-nums">
                                                                {formatNumberVal(row.revenueQd)}
                                                            </td>

                                                            {/* 4. TARGET VƯỢT TRỘI */}
                                                            <td
                                                                className="py-2.5 px-1.5 text-center font-black border-r border-slate-100 text-slate-900 tabular-nums"
                                                                title={`Target gốc: ${formatNumberVal(row.baseTarget)} • Nhịp: ${row.targetRate}%`}
                                                            >
                                                                {formatNumberVal(row.targetOver)}
                                                            </td>

                                                            {/* 5. %HT (theo Target vượt trội) */}
                                                            <td className={`py-2.5 px-1 text-center font-black border-r border-slate-100 tabular-nums ${row.pctHtOver >= 100
                                                                ? 'text-emerald-600'
                                                                : row.pctHtOver >= 85
                                                                    ? 'text-amber-600'
                                                                    : 'text-rose-600'
                                                                }`}>
                                                                {row.pctHtOver.toFixed(1)}%
                                                            </td>

                                                            {/* 6. TARGET CÒN LẠI */}
                                                            <td className="py-2.5 px-1.5 text-center font-black border-r border-slate-100 text-slate-700 tabular-nums">
                                                                {formatNumberVal(row.targetRemainingOver)}
                                                            </td>

                                                            {/* 7. DTQĐ DỰ KIẾN */}
                                                            <td className="py-2.5 px-1.5 text-center font-black text-indigo-700 border-r border-slate-100 tabular-nums">
                                                                {formatNumberVal(row.forecastRevenueQd)}
                                                            </td>

                                                            {/* 8. %DKHT (theo Target vượt trội) */}
                                                            <td className={`py-2.5 px-1 text-center font-black border-r border-slate-100 tabular-nums ${row.pctDkhtOver >= 100
                                                                ? 'text-emerald-600'
                                                                : row.pctDkhtOver >= 90
                                                                    ? 'text-amber-600'
                                                                    : 'text-rose-600'
                                                                }`}>
                                                                {row.pctDkhtOver.toFixed(1)}%
                                                            </td>

                                                            {/* 9. TARGET MỖI NGÀY CÒN LẠI (Hiển thị tr/ngày làm tròn) */}
                                                            <td
                                                                className="py-2.5 px-1.5 text-center font-black text-purple-900 bg-purple-50/30 tabular-nums"
                                                                title={`Còn ${row.remainingDays} ngày trong tháng • Target còn lại: ${Math.round(toMillionValue(row.targetRemainingOver)).toLocaleString('en-US')} tr`}
                                                            >
                                                                {Math.round(row.targetDailyRemainingOver).toLocaleString('en-US')}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>

                                            {/* DÒNG TỔNG CỤM BẢNG 2 - EXECUTIVE DARK STYLE */}
                                            <tfoot>
                                                <tr className="bg-slate-900 text-white font-black text-xs border-t-2 border-slate-700">
                                                    {/* Cột Tên */}
                                                    <td className="sticky left-0 z-20 py-3 px-2 bg-slate-900 text-center uppercase tracking-wider border-r border-slate-800 text-slate-200 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.3)]">
                                                        TỔNG CỤM
                                                    </td>

                                                    {/* % Vượt trội TB */}
                                                    <td className="py-3 px-1.5 text-center font-black border-r border-slate-800 tabular-nums">
                                                        <span className="inline-block text-[10.5px] font-black text-amber-200 bg-amber-900/60 px-1.5 py-0.5 rounded border border-amber-700/60">
                                                            {clusterSummary.avgTargetRate.toFixed(1)}%
                                                        </span>
                                                    </td>

                                                    {/* Lũy kế DTQĐ */}
                                                    <td className="py-3 px-1.5 text-center font-black text-blue-300 border-r border-slate-800 tabular-nums">
                                                        {formatNumberVal(clusterSummary.totalRevenueQd)}
                                                    </td>

                                                    {/* Target vượt trội */}
                                                    <td className="py-3 px-1.5 text-center font-black border-r border-slate-800 text-amber-200 tabular-nums">
                                                        {formatNumberVal(clusterSummary.totalTargetOver)}
                                                    </td>

                                                    {/* %HT */}
                                                    <td className="py-3 px-1 text-center font-black text-emerald-400 border-r border-slate-800 tabular-nums">
                                                        {clusterSummary.avgPctHtOver.toFixed(1)}%
                                                    </td>

                                                    {/* Target còn lại */}
                                                    <td className="py-3 px-1.5 text-center font-black border-r border-slate-800 text-slate-300 tabular-nums">
                                                        {formatNumberVal(clusterSummary.totalTargetRemainingOver)}
                                                    </td>

                                                    {/* DTQĐ dự kiến */}
                                                    <td className="py-3 px-1.5 text-center font-black text-indigo-300 border-r border-slate-800 tabular-nums">
                                                        {formatNumberVal(clusterSummary.totalForecastRevenueQd)}
                                                    </td>

                                                    {/* %DKHT */}
                                                    <td className="py-3 px-1 text-center font-black text-emerald-400 border-r border-slate-800 tabular-nums">
                                                        {clusterSummary.avgPctDkhtOver.toFixed(1)}%
                                                    </td>

                                                    {/* Target mỗi ngày còn lại (triệu/ngày) */}
                                                    <td className="py-3 px-1.5 text-center font-black text-purple-200 bg-slate-800/80 tabular-nums">
                                                        {Math.round(clusterSummary.totalTargetDailyRemainingOver).toLocaleString('en-US')}
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* KHỐI NHẬN XÉT & HƯỚNG DẪN CỤM (MẶC ĐỊNH ẨN, USER TÙY CHỌN HIỂN THỊ TRÊN BÁO CÁO) */}
                            {showAssessment && assessmentData && assessmentData.comment && (
                                <div className="bg-gradient-to-r from-blue-50/70 to-indigo-50/50 p-4 rounded-2xl border border-blue-200/90 space-y-1.5 shadow-2xs">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-xs font-black text-blue-900 uppercase tracking-wider">
                                            <MessageSquare className="w-4 h-4 text-blue-600" aria-hidden="true" />
                                            <span>Nhận Xét & Hướng Dẫn Cụm</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setShowAssessment(false)}
                                            className="text-[11px] font-bold text-slate-400 hover:text-slate-700 flex items-center gap-1 cursor-pointer transition"
                                            title="Ẩn nhận xét này khỏi báo cáo"
                                        >
                                            <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                                            <span>Ẩn</span>
                                        </button>
                                    </div>
                                    <div className="text-xs text-slate-700 whitespace-pre-line leading-relaxed font-medium pl-6">
                                        {assessmentData.comment}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* THÔNG BÁO GỢI Ý KHI CÓ NHẬN XÉT ĐANG ẨN (BỊ BỎ QUA KHI XUẤT ẢNH) */}
                    {assessmentData && assessmentData.comment && !showAssessment && (
                        <div
                            data-html2canvas-ignore="true"
                            className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600 shadow-2xs"
                        >
                            <div className="flex items-center gap-2">
                                <MessageSquare className="w-4 h-4 text-blue-600 shrink-0" aria-hidden="true" />
                                <span className="font-medium">
                                    Đã có nội dung nhận xét & hướng dẫn cụm (đang ẩn theo mặc định).
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowAssessment(true)}
                                className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-slate-800 font-bold text-[11px] flex items-center gap-1.5 cursor-pointer shadow-2xs self-start sm:self-auto"
                            >
                                <Eye className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
                                <span>Hiển thị vào báo cáo</span>
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* MODAL CẤU HÌNH TARGET */}
            <ClusterTargetConfigModal
                isOpen={isTargetModalOpen}
                onClose={() => setIsTargetModalOpen(false)}
                rows={allAccessibleClusterRows}
                month={selectedMonth}
                year={selectedYear}
                currentConfigs={targetConfigs}
                initialGlobalPace={globalPaceRate}
                onSaved={loadAllData}
            />
        </div>
    );
}
