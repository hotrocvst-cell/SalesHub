import React, { useState, useMemo, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { calculate8KScale, buildReportImageFileName } from '../../../shared/utils/exportImage';
import {
    getShortStoreName,
    formatDate,
    getYesterdayDateString,
    isStoreMatch
} from '../../../core/lib/formatters';
import type { BusinessDayRecord } from '../../../core/lib/storage';
import {
    GUEST_DEMO_STORE,
    isGuestDemoStore,
    isDemoDateAllowed
} from '../../../core/lib/guestDemoStoreService';
import type {
    ClusterStoreRow,
    ClusterSummaryData,
    ClusterTargetConfigItem,
    ClusterAssessmentData
} from '../../cluster-report/types';
import {
    saveClusterAssessment
} from '../../cluster-report/services/clusterTargetService';
import { extractStoreRevenueDetailsWithReal } from '../../cluster-report/utils/revenueExtractor';
import ClusterTargetConfigModal from '../../cluster-report/components/ClusterTargetConfigModal';
import type { AssessmentTemplate } from '../../../shared/components/report/ReportAssessmentModal';
import {
    Store,
    Target,
    Coins,
    Award,
    AlertCircle,
    Check,
    Lock,
    Zap,
    Eye,
    EyeOff,
    CheckCircle2
} from 'lucide-react';

const toBillionValue = (val: number) => (val > 100 ? val / 1000 : val);
const toMillionValue = (val: number) => (val > 100 ? val : val * 1000);

export function getCompactStoreName(name: string): string {
    if (!name) return '';
    const trimmed = name.trim();
    if (/^(tổng|tong|toàn cụm|toan cum)/i.test(trimmed)) return 'Tổng Cụm';

    const parts = trimmed.split(/\s*[-–—]\s*/).map(p => p.trim()).filter(Boolean);
    const nonNumericParts = parts.filter(p => !/^\d+$/.test(p));

    if (nonNumericParts.length >= 2) {
        const rawPrefix = nonNumericParts[0];
        const chainPrefix = rawPrefix.includes('_') ? rawPrefix.split('_')[0].trim() : rawPrefix;
        const address = nonNumericParts.slice(1).join(' - ').trim();
        if (address.toUpperCase().startsWith(chainPrefix.toUpperCase() + ' - ')) {
            return address;
        }
        return `${chainPrefix} - ${address}`;
    }

    if (nonNumericParts.length === 1) {
        let single = nonNumericParts[0];
        single = single.replace(/^\d+\s*[-_–.]\s*/, '');
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

interface ClusterHealthTabProps {
    records: BusinessDayRecord[];
    targetConfigs: ClusterTargetConfigItem[];
    globalPaceRate: number;
    assessmentData: ClusterAssessmentData | null;
    selectedMonth: number;
    selectedYear: number;
    selectedStore: string;
    effectiveDate: string;
    availableDates: string[];
    isAdmin: boolean;
    isGuest: boolean;
    canAccessStore: (store: string) => boolean;
    showToast: (msg: string, tone?: 'success' | 'error') => void;
    onRefreshData: () => void;
    onRegisterExportHandler?: (handler: (action: 'DOWNLOAD' | 'COPY') => Promise<void>) => void;
    onUpdateAssessmentTemplates?: (templates: AssessmentTemplate[]) => void;
}

export default function ClusterHealthTab({
    records,
    targetConfigs,
    globalPaceRate,
    assessmentData,
    selectedMonth,
    selectedYear,
    selectedStore,
    effectiveDate,
    availableDates,
    isAdmin,
    isGuest,
    canAccessStore,
    showToast,
    onRefreshData,
    onRegisterExportHandler,
    onUpdateAssessmentTemplates
}: ClusterHealthTabProps) {
    const reportCaptureRef = useRef<HTMLDivElement | null>(null);

    const [displayUnit, setDisplayUnit] = useState<'BILLION' | 'MILLION'>('BILLION');
    const [tableFilter, setTableFilter] = useState<'ALL' | 'STANDARD' | 'OVER'>('ALL');
    const [showAssessment, setShowAssessment] = useState<boolean>(false);
    const [isTargetModalOpen, setIsTargetModalOpen] = useState<boolean>(false);
    const [isExportingImg, setIsExportingImg] = useState<boolean>(false);

    const canConfigureTarget = !isGuest && isAdmin;

    // 1. TÍNH TOÁN DỮ LIỆU CÁC ST TRONG CỤM
    const allAccessibleClusterRows = useMemo<ClusterStoreRow[]>(() => {
        if (records.length === 0) return [];

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

        const dateRecords = records.filter(r => r.reportDate === effectiveDate);
        const sourceRecords = dateRecords.length > 0 ? dateRecords : records;

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

            const passedDays = (rec.passedDays && rec.passedDays > 0) ? rec.passedDays : defaultPassedDays;
            const totalDays = (rec.totalDays && rec.totalDays > 0) ? rec.totalDays : daysInMonth;
            const remainingDays = Math.max(1, totalDays - passedDays);

            const extracted = extractStoreRevenueDetailsWithReal(rec.rawRevenue, storeName);
            const realInfo = (rec.emulationSummary as any)?.['__real_revenue'];
            const revMeta = (rec.emulationSummary as any)?.['__revenue_meta'];
            const rRealFromSummary = Number(realInfo?.revenueReal || realInfo?.revenueActual || 0);
            const legacyRealForInstallment = rRealFromSummary > 0
                ? rRealFromSummary
                : ((extracted && extracted.revenueActual > 0 && extracted.revenueActual !== extracted.revenueQd) ? extracted.revenueActual : 0);

            const storedVal = Number(rec.revenueActual) || 0;
            const revQd = (extracted && extracted.revenueQd > 0) ? extracted.revenueQd : storedVal;

            const targetRealFromSummary = Number(realInfo?.targetReal ?? realInfo?.targetActual) || 0;
            const targetReal = targetRealFromSummary > 0 ? targetRealFromSummary : (extracted?.targetReal || 0);

            const targetQd = (extracted?.targetQd && extracted.targetQd > 0)
                ? extracted.targetQd
                : (Number(rec.revenueTarget) > 0
                    ? Number(rec.revenueTarget)
                    : ((extracted?.revenueTarget && extracted.revenueTarget > 0 && (targetReal === 0 || Math.abs(extracted.revenueTarget - targetReal) > 0.05))
                        ? extracted.revenueTarget
                        : 0));

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

            let installmentRate = 0;
            let hasInstallmentRate = false;

            if (revMeta && (revMeta.installmentRate !== undefined || rec.installmentRate)) {
                const metaRate = Number(revMeta.installmentRate) || Number(rec.installmentRate) || 0;
                if (metaRate > 0) {
                    installmentRate = metaRate;
                    hasInstallmentRate = true;
                }
            } else if (realInfo && (realInfo.installmentRateReal !== undefined || realInfo.installmentReal !== undefined || realInfo.installmentRevenue !== undefined)) {
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

            const calcDailyRemainingMillion = (remainingVal: number) =>
                remainingDays > 0 ? Math.round(toMillionValue(remainingVal) / remainingDays) : 0;

            const pctHtStandard = baseTarget > 0 ? (revQd / baseTarget) * 100 : 0;
            const targetRemainingStandard = Math.max(0, baseTarget - revQd);
            const forecastRevenueQd = passedDays > 0 ? (revQd / passedDays) * totalDays : revQd;
            const pctDkhtStandard = baseTarget > 0 ? (forecastRevenueQd / baseTarget) * 100 : 0;
            const targetDailyRemainingStandard = calcDailyRemainingMillion(targetRemainingStandard);

            const targetRate = cfg?.targetRate && cfg.targetRate > 0
                ? cfg.targetRate
                : globalPaceRate;

            const isMillionScale = baseTarget > 100;
            const computedTargetOver = isMillionScale
                ? Math.round((baseTarget * targetRate) / 100)
                : Number(((baseTarget * targetRate) / 100).toFixed(3));

            let targetOver = computedTargetOver;
            if (cfg?.targetOver && cfg.targetOver > 0 && targetRate > 0) {
                const impliedBase = (cfg.targetOver / targetRate) * 100;
                const isBaseTargetChanged = Math.abs(impliedBase - baseTarget) > (isMillionScale ? 5 : 0.05);
                const isCalculatedFromReal = targetReal > 0 && Math.abs(impliedBase - targetReal) < (isMillionScale ? 5 : 0.1) && Math.abs(impliedBase - baseTarget) > (isMillionScale ? 5 : 0.5);

                if (!isBaseTargetChanged && !isCalculatedFromReal) {
                    targetOver = cfg.targetOver;
                }
            }

            const pctHtOver = targetOver > 0 ? (revQd / targetOver) * 100 : 0;
            const targetRemainingOver = Math.max(0, targetOver - revQd);
            const pctDkhtOver = targetOver > 0 ? (forecastRevenueQd / targetOver) * 100 : 0;
            const targetDailyRemainingOver = calcDailyRemainingMillion(targetRemainingOver);

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
                revenueQd: revQd,
                baseTarget,
                pctHtStandard,
                targetRemainingStandard,
                forecastRevenueQd,
                pctDkhtStandard,
                targetDailyRemainingStandard,
                installmentRate,
                hasInstallmentRate,
                targetRate,
                targetOver,
                pctHtOver,
                targetRemainingOver,
                pctDkhtOver,
                targetDailyRemainingOver,
                avg3Months,
                pctGrowth,
                reportDate: rec.reportDate,
                passedDays,
                totalDays,
                remainingDays
            });
        });

        rows.sort((a, b) => b.revenueQd - a.revenueQd);
        rows.forEach((r, idx) => { r.orderIndex = idx + 1; });

        return rows;
    }, [records, effectiveDate, targetConfigs, globalPaceRate, selectedMonth, selectedYear, isGuest, isAdmin, canAccessStore]);

    // 2. LỌC THEO ST NẾU CHỌN 1 ST RIÊNG
    const clusterRows = useMemo<ClusterStoreRow[]>(() => {
        if (selectedStore === 'all' || selectedStore === 'Tổng') return allAccessibleClusterRows;
        return allAccessibleClusterRows.filter(r => {
            const shortName = getCompactStoreName(r.storeName);
            return shortName === selectedStore || isStoreMatch(r.storeName, selectedStore);
        });
    }, [allAccessibleClusterRows, selectedStore]);

    // 3. TỔNG KẾT TOÀN CỤM
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
        const totalTargetOver = clusterRows.reduce((sum, r) => sum + r.targetOver, 0);
        const totalTargetRemainingStandard = clusterRows.reduce((sum, r) => sum + r.targetRemainingStandard, 0);
        const totalTargetRemainingOver = clusterRows.reduce((sum, r) => sum + r.targetRemainingOver, 0);
        const totalForecastRevenueQd = clusterRows.reduce((sum, r) => sum + r.forecastRevenueQd, 0);
        const totalTargetDailyRemainingStandard = clusterRows.reduce((sum, r) => sum + r.targetDailyRemainingStandard, 0);
        const totalTargetDailyRemainingOver = clusterRows.reduce((sum, r) => sum + r.targetDailyRemainingOver, 0);
        const totalAvg3Months = clusterRows.reduce((sum, r) => sum + r.avg3Months, 0);

        const avgPctHtStandard = totalBaseTarget > 0 ? (totalRevenueQd / totalBaseTarget) * 100 : 0;
        const avgPctHtOver = totalTargetOver > 0 ? (totalRevenueQd / totalTargetOver) * 100 : 0;
        const avgPctDkhtStandard = totalBaseTarget > 0 ? (totalForecastRevenueQd / totalBaseTarget) * 100 : 0;
        const avgPctDkhtOver = totalTargetOver > 0 ? (totalForecastRevenueQd / totalTargetOver) * 100 : 0;
        const avgTargetRate = totalBaseTarget > 0 ? (totalTargetOver / totalBaseTarget) * 100 : (globalPaceRate || 100);
        const avgPctGrowth = totalAvg3Months > 0 ? ((totalForecastRevenueQd - totalAvg3Months) / totalAvg3Months) * 100 : 0;

        const installmentStores = clusterRows.filter(r => r.hasInstallmentRate && r.installmentRate > 0);
        let avgInstallmentRate = 0;
        if (installmentStores.length > 0) {
            const sumWeighted = installmentStores.reduce((sum, r) => sum + (r.installmentRate * r.revenueQd), 0);
            const sumWeight = installmentStores.reduce((sum, r) => sum + r.revenueQd, 0);
            avgInstallmentRate = sumWeight > 0 ? (sumWeighted / sumWeight) : (installmentStores.reduce((sum, r) => sum + r.installmentRate, 0) / installmentStores.length);
        }

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
            installmentStoresCount: installmentStores.length,
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

    // 4. MẪU NHẬN XÉT CỤM
    const clusterAssessmentTemplates = useMemo<AssessmentTemplate[]>(() => {
        if (clusterRows.length === 0) return [];
        const topPctHt = [...clusterRows].sort((a, b) => b.pctHtOver - a.pctHtOver)[0];
        const lowPctHt = [...clusterRows].sort((a, b) => a.pctHtOver - b.pctHtOver)[0];
        const totalRevBillion = toBillionValue(clusterSummary.totalRevenueQd).toFixed(3);

        const t1Lines: string[] = [
            `📊 ĐÁNH GIÁ SỨC KHỎE CỤM T${selectedMonth}/${selectedYear}:`,
            `• DTQĐ: ${totalRevBillion} tỷ • %HT Vượt trội: ${clusterSummary.avgPctHtOver.toFixed(1)}%${clusterSummary.hasInstallmentRate ? ` • Trả góp: ${clusterSummary.avgInstallmentRate.toFixed(1)}%` : ''}.`,
            topPctHt ? `🌟 Dẫn đầu: [${getShortStoreName(topPctHt.storeName)}] đạt ${topPctHt.pctHtOver.toFixed(1)}% target vượt trội.` : '',
            lowPctHt && lowPctHt.pctHtOver < 100 ? `🚨 Tăng tốc: [${getShortStoreName(lowPctHt.storeName)}] đạt ${lowPctHt.pctHtOver.toFixed(1)}%, tập trung dồn lực ca tối.` : '',
            `🎯 Toàn cụm bám sát nhịp ca để cán đích thắng lợi!`
        ].filter(Boolean);

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

        return [
            { id: 1, title: 'Mẫu 1: Tổng quan', badge: 'Súc tích', content: t1Lines.join('\n'), description: 'Đánh giá nhanh 3-4 dòng gửi nhóm Zalo cụm' },
            { id: 2, title: 'Mẫu 2: Phân loại', badge: 'Trọng tâm', content: t2Lines.join('\n'), description: 'Phân loại nhóm đạt, cận đích và nhóm cần tăng tốc' }
        ];
    }, [clusterRows, clusterSummary, selectedMonth, selectedYear]);

    // Đồng bộ templates lên parent
    useEffect(() => {
        if (onUpdateAssessmentTemplates) {
            onUpdateAssessmentTemplates(clusterAssessmentTemplates);
        }
    }, [clusterAssessmentTemplates, onUpdateAssessmentTemplates]);

    // 5. CHỤP ẢNH BÁO CÁO CỤM (960px PORTRAIT, NO WATERMARK, FONT UTM-AVO)
    const handleCaptureReport = async (action: 'DOWNLOAD' | 'COPY') => {
        if (!reportCaptureRef.current || isExportingImg) return;
        setIsExportingImg(true);

        try {
            const scale = calculate8KScale(reportCaptureRef.current, 960);
            const canvas = await html2canvas(reportCaptureRef.current, {
                scale,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                onclone: (clonedDoc) => {
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
                    const targetEl = clonedDoc.getElementById('cluster-health-export-area');
                    if (targetEl) {
                        targetEl.style.height = 'auto';
                        targetEl.style.maxHeight = 'none';
                        targetEl.style.overflow = 'visible';
                        targetEl.style.fontFamily = "'UTM Avo', 'UTM-Avo', sans-serif";
                        targetEl.style.width = '960px';
                        targetEl.style.maxWidth = '960px';
                        targetEl.style.margin = '0 auto';
                        targetEl.querySelectorAll<HTMLElement>('.overflow-x-auto, .overflow-y-auto').forEach((el) => {
                            el.style.overflow = 'visible';
                            el.style.maxHeight = 'none';
                        });
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
                            showToast('Đã copy ảnh báo cáo cụm vào clipboard!');
                        } catch {
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
        link.download = buildReportImageFileName(
            'Bao_Cao_Cum_ST',
            selectedStore,
            effectiveDate || `T${selectedMonth}_${selectedYear}`
        );
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('Đã tải ảnh báo cáo cụm về thiết bị!');
    };

    // Đăng ký hàm xuất ảnh với parent
    useEffect(() => {
        if (onRegisterExportHandler) {
            onRegisterExportHandler(handleCaptureReport);
        }
    }, [onRegisterExportHandler, handleCaptureReport]);

    if (clusterRows.length === 0) {
        return (
            <div className="bg-white p-12 sm:p-16 rounded-3xl border border-slate-200 text-center space-y-4 shadow-sm">
                <div className="w-14 h-14 bg-amber-50 text-amber-700 rounded-2xl flex items-center justify-center mx-auto border border-amber-200">
                    <AlertCircle className="w-7 h-7" aria-hidden="true" />
                </div>
                <div className="max-w-md mx-auto space-y-1.5">
                    <h3 className="text-base font-black text-slate-800 uppercase tracking-wide">
                        Chưa có dữ liệu sức khỏe cụm tháng {selectedMonth}/{selectedYear}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                        Chưa ghi nhận bản ghi lũy kế nào của các ST trong cụm cho kỳ này.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* THANH ĐIỀU KHIỂN RIÊNG CỦA TAB: ĐƠN VỊ & CHỌN BẢNG */}
            <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Bộ lọc bảng hiển thị */}
                    <div
                        role="group"
                        aria-label="Chọn bảng hiển thị"
                        className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 border border-slate-200 text-[11px] font-bold"
                    >
                        <button
                            type="button"
                            onClick={() => setTableFilter('ALL')}
                            className={`px-2.5 py-1 rounded-lg transition cursor-pointer whitespace-nowrap ${tableFilter === 'ALL' ? 'bg-white text-indigo-700 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Tất cả (2)
                        </button>
                        <button
                            type="button"
                            onClick={() => setTableFilter('STANDARD')}
                            className={`px-2.5 py-1 rounded-lg transition cursor-pointer whitespace-nowrap ${tableFilter === 'STANDARD' ? 'bg-white text-emerald-700 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Bảng 1: Chuẩn
                        </button>
                        <button
                            type="button"
                            onClick={() => setTableFilter('OVER')}
                            className={`px-2.5 py-1 rounded-lg transition cursor-pointer whitespace-nowrap ${tableFilter === 'OVER' ? 'bg-white text-amber-700 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Bảng 2: Vượt Trội
                        </button>
                    </div>

                    {/* Đơn vị hiển thị: Tỷ / Triệu */}
                    <div
                        role="group"
                        aria-label="Chọn đơn vị hiển thị số liệu"
                        className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 border border-slate-200 text-[11px] font-bold"
                    >
                        <button
                            type="button"
                            onClick={() => setDisplayUnit('BILLION')}
                            className={`px-2.5 py-1 rounded-lg transition cursor-pointer whitespace-nowrap ${displayUnit === 'BILLION' ? 'bg-white text-indigo-700 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Tỷ đồng (1.638)
                        </button>
                        <button
                            type="button"
                            onClick={() => setDisplayUnit('MILLION')}
                            className={`px-2.5 py-1 rounded-lg transition cursor-pointer whitespace-nowrap ${displayUnit === 'MILLION' ? 'bg-white text-indigo-700 shadow-2xs font-black' : 'text-slate-600 hover:text-slate-900'}`}
                        >
                            Triệu đồng (1,638 tr)
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                    {canConfigureTarget && (
                        <button
                            type="button"
                            onClick={() => setIsTargetModalOpen(true)}
                            className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-black flex items-center gap-1.5 transition cursor-pointer"
                        >
                            <Target className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />
                            <span>Cấu Hình Target Cụm</span>
                        </button>
                    )}
                </div>
            </div>

            {/* 3 THẺ CHỈ SỐ SỨC KHỎE CỐT LÕI */}
            <div className={`grid grid-cols-1 ${clusterSummary.hasInstallmentRate ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3`}>
                {/* THẺ 1: TỔNG DTQĐ */}
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
                            Dự kiến: <b className="text-slate-700 font-bold tabular-nums">{formatNumberVal(clusterSummary.totalForecastRevenueQd)} {displayUnit === 'BILLION' ? 'tỷ' : 'tr'}</b> ({clusterSummary.avgPctDkhtStandard.toFixed(1)}% DK)
                        </div>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                        <Coins className="w-5 h-5" aria-hidden="true" />
                    </div>
                </div>

                {/* THẺ 2: %HT TARGET VƯỢT TRỘI */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-[11px] font-bold text-amber-800 uppercase tracking-wider truncate">
                            %HT Target Vượt Trội
                        </div>
                        <div className={`text-xl sm:text-2xl font-black mt-0.5 tracking-tight tabular-nums ${clusterSummary.avgPctHtOver >= 100 ? 'text-emerald-600' : clusterSummary.avgPctHtOver >= 85 ? 'text-amber-700' : 'text-rose-600'}`}>
                            {clusterSummary.avgPctHtOver.toFixed(1)}%
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium mt-0.5 truncate">
                            Mục tiêu: <b className="text-slate-700 font-bold tabular-nums">{formatNumberVal(clusterSummary.totalTargetOver)} {displayUnit === 'BILLION' ? 'tỷ' : 'tr'}</b> ({clusterSummary.avgTargetRate.toFixed(1)}%)
                        </div>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                        <Target className="w-5 h-5" aria-hidden="true" />
                    </div>
                </div>

                {/* THẺ 3: TỶ TRỌNG TRẢ GÓP */}
                {clusterSummary.hasInstallmentRate && (
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3">
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
                        <div className="w-11 h-11 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                            <Award className="w-5 h-5" aria-hidden="true" />
                        </div>
                    </div>
                )}
            </div>

            {/* VÙNG CHỤP ẢNH BÁO CÁO CỤM 960px PORTRAIT */}
            <div className="overflow-x-auto no-scrollbar">
                <style>{`
                    #cluster-health-export-area,
                    #cluster-health-export-area *,
                    #cluster-health-export-area table,
                    #cluster-health-export-area thead,
                    #cluster-health-export-area tbody,
                    #cluster-health-export-area tfoot,
                    #cluster-health-export-area tr,
                    #cluster-health-export-area th,
                    #cluster-health-export-area td,
                    #cluster-health-export-area span,
                    #cluster-health-export-area div,
                    #cluster-health-export-area h2 {
                        font-family: 'UTM Avo', 'UTM-Avo', sans-serif !important;
                    }
                `}</style>
                <div
                    ref={reportCaptureRef}
                    id="cluster-health-export-area"
                    data-report-table="true"
                    style={{ fontFamily: "'UTM Avo', 'UTM-Avo', sans-serif" }}
                    className="bg-white p-3.5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm max-w-[960px] mx-auto space-y-4 font-avo report-table"
                >
                    {/* BANNER BÁO CÁO CỤM */}
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

                        <div className="flex items-center gap-2">
                            <span className="bg-white/10 px-3 py-1.5 rounded-xl text-xs font-black border border-white/15 text-amber-300 inline-flex items-center gap-1.5 whitespace-nowrap">
                                <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
                                <span>Nhịp Cụm: <b className="tabular-nums">{globalPaceRate}%</b></span>
                            </span>
                        </div>
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
                                        (Tiến độ theo Target vượt trội nhịp {globalPaceRate}%)
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
                </div>
            </div>

            {/* MODAL CẤU HÌNH TARGET VƯỢT TRỘI */}
            {isTargetModalOpen && canConfigureTarget && (
                <ClusterTargetConfigModal
                    isOpen={isTargetModalOpen}
                    onClose={() => setIsTargetModalOpen(false)}
                    month={selectedMonth}
                    year={selectedYear}
                    rows={clusterRows}
                    currentConfigs={targetConfigs}
                    initialGlobalPace={globalPaceRate}
                    onSaved={() => {
                        setIsTargetModalOpen(false);
                        onRefreshData();
                        showToast('Đã lưu cấu hình target cụm thành công!');
                    }}
                />
            )}
        </div>
    );
}
