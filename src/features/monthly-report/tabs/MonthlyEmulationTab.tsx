import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
    generateStandardReportCanvas,
    downloadReportCanvas,
    copyReportCanvasToClipboard,
    buildReportImageFileName
} from '../../../shared/utils/exportImage';
import {
    formatValue,
    getShortStoreName,
    getCampaignLabel,
    formatDate,
    calculateRemainingTarget,
    formatRemainingTarget
} from '../../../core/lib/formatters';
import type { BusinessDayRecord, CampaignDictItem } from '../../../core/lib/storage';
import type { AssessmentTemplate } from '../../../shared/components/report/ReportAssessmentModal';
import {
    Store,
    TrendingUp,
    AlertCircle,
    Trophy,
    ArrowUpDown,
    Filter,
    Copy,
    Coins,
    Award,
    CheckCircle2,
    Calendar
} from 'lucide-react';

export interface EmulationRowItem {
    id: string;
    storeName: string;
    rawKey: string;
    label: string;
    target: number;
    actual: number;
    pctHT: number;
    pctDK: number;
    remaining: number;
}

interface MonthlyEmulationTabProps {
    records: BusinessDayRecord[];
    campaigns: CampaignDictItem[];
    currentRecord: BusinessDayRecord | null;
    selectedMonth: number;
    selectedYear: number;
    selectedStore: string;
    activeReportDate: string;
    isAllMode: boolean;
    isAdmin: boolean;
    isGuest: boolean;
    canAccessStore: (store: string) => boolean;
    showToast: (msg: string, tone?: 'success' | 'error') => void;
    onRegisterExportHandler?: (handler: (action: 'DOWNLOAD' | 'COPY') => Promise<void>) => void;
    onUpdateAssessmentTemplates?: (templates: AssessmentTemplate[]) => void;
}

export default function MonthlyEmulationTab({
    records,
    campaigns,
    currentRecord,
    selectedMonth,
    selectedYear,
    selectedStore,
    activeReportDate,
    isAllMode,
    isAdmin,
    isGuest,
    canAccessStore,
    showToast,
    onRegisterExportHandler,
    onUpdateAssessmentTemplates
}: MonthlyEmulationTabProps) {
    const reportRef = useRef<HTMLDivElement | null>(null);

    const [sortOrder, setSortOrder] = useState<string>('pct-desc');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [summaryMode, setSummaryMode] = useState<number>(1);
    const [isProcessingImg, setIsProcessingImg] = useState<boolean>(false);

    // 1. CÁC BẢN GHI TRONG MỐC NGÀY ĐƯỢC CHỌN
    const recordsInActiveDay = useMemo(() => {
        if (!activeReportDate) return [];
        return records.filter(r => r.reportDate === activeReportDate);
    }, [records, activeReportDate]);

    // 2. BÓC TÁCH DANH SÁCH THI ĐUA (24 NGÀNH HÀNG)
    const emulationRowList = useMemo<EmulationRowItem[]>(() => {
        if (!activeReportDate || recordsInActiveDay.length === 0) return [];

        const isAll = selectedStore === 'all' || selectedStore === 'Tổng';
        const rows: EmulationRowItem[] = [];

        if (isAll) {
            const memberStores = recordsInActiveDay.filter(r => {
                const sName = getShortStoreName(r.storeName);
                if (sName === 'Tổng' || /^(tổng|tong)/i.test(r.storeName)) return false;
                if (isAdmin) return true;
                return canAccessStore(r.storeName) || canAccessStore(sName);
            });
            const targetRecords = memberStores.length > 0 ? memberStores : recordsInActiveDay.filter(r => {
                const sName = getShortStoreName(r.storeName);
                if (sName === 'Tổng' || /^(tổng|tong)/i.test(r.storeName)) return false;
                return isAdmin || canAccessStore(r.storeName) || canAccessStore(sName);
            });

            targetRecords.forEach(r => {
                const sName = getShortStoreName(r.storeName);
                if (r.emulationSummary) {
                    Object.entries(r.emulationSummary).forEach(([rawKey, val]) => {
                        const target = Number(val.target) || 0;
                        if (target > 0) {
                            const actual = Number(val.actual) || 0;
                            const pctDK = typeof val.pctDK === 'number' ? val.pctDK : (target > 0 ? (actual / target * 100) : 0);
                            const pctHT = target > 0 ? (actual / target * 100) : (typeof val.pctHT === 'number' ? val.pctHT : 0);
                            const remaining = calculateRemainingTarget(target, actual, 1);
                            rows.push({
                                id: `${sName}-${rawKey}`,
                                storeName: sName,
                                rawKey,
                                label: getCampaignLabel(rawKey, campaigns),
                                target,
                                actual,
                                pctHT,
                                pctDK,
                                remaining
                            });
                        }
                    });
                }
            });
        } else {
            const shop = recordsInActiveDay.find(r =>
                getShortStoreName(r.storeName) === selectedStore ||
                r.storeName.includes(selectedStore)
            );
            if (shop?.emulationSummary) {
                const sName = getShortStoreName(shop.storeName);
                Object.entries(shop.emulationSummary).forEach(([rawKey, val]) => {
                    const target = Number(val.target) || 0;
                    if (target > 0) {
                        const actual = Number(val.actual) || 0;
                        const pctDK = typeof val.pctDK === 'number' ? val.pctDK : (target > 0 ? (actual / target * 100) : 0);
                        const pctHT = target > 0 ? (actual / target * 100) : (typeof val.pctHT === 'number' ? val.pctHT : 0);
                        const remaining = calculateRemainingTarget(target, actual, 1);
                        rows.push({
                            id: `${sName}-${rawKey}`,
                            storeName: sName,
                            rawKey,
                            label: getCampaignLabel(rawKey, campaigns),
                            target,
                            actual,
                            pctHT,
                            pctDK,
                            remaining
                        });
                    }
                });
            }
        }

        let filtered = rows;
        if (statusFilter === 'passed') {
            filtered = filtered.filter(item => item.pctDK >= 100);
        } else if (statusFilter === 'failed') {
            filtered = filtered.filter(item => item.pctDK < 100);
        }

        filtered.sort((a, b) => {
            if (sortOrder === 'pct-desc') return b.pctDK - a.pctDK;
            if (sortOrder === 'pct-asc') return a.pctDK - b.pctDK;
            if (sortOrder === 'pctHT-desc') return b.pctHT - a.pctHT;
            if (sortOrder === 'pctHT-asc') return a.pctHT - b.pctHT;
            if (sortOrder === 'remaining-desc') return b.remaining - a.remaining;
            if (sortOrder === 'remaining-asc') return a.remaining - b.remaining;
            if (sortOrder === 'store-asc') return a.storeName.localeCompare(b.storeName);
            if (sortOrder === 'name-asc') return a.label.localeCompare(b.label);
            return 0;
        });

        return filtered;
    }, [recordsInActiveDay, activeReportDate, selectedStore, campaigns, statusFilter, sortOrder, isAdmin, canAccessStore]);

    // 3. TÍNH TOÁN SỐ MỤC THI ĐUA ĐẠT / CHƯA ĐẠT
    const emulationStats = useMemo(() => {
        const total = emulationRowList.length;
        const passed = emulationRowList.filter(d => d.pctDK >= 100).length;
        const passRate = total > 0 ? (passed / total * 100).toFixed(1) : '0.0';
        return { total, passed, passRate };
    }, [emulationRowList]);

    // 4. MẪU NHẬN XÉT / TÓM TẮT ĐÁNH GIÁ (3 CHẾ ĐỘ)
    const monthlyAssessmentTemplates = useMemo<AssessmentTemplate[]>(() => {
        if (!currentRecord) return [];

        const getSummaryForMode = (mode: number): string => {
            const isAll = selectedStore === 'all' || selectedStore === 'Tổng';
            const storeLabel = isAll ? (isAdmin ? 'TOÀN CỤM ST' : 'CỤM PHỤ TRÁCH') : `ST ${selectedStore}`;
            const target = Number(currentRecord.revenueTarget) || 0;
            const actual = Number(currentRecord.revenueActual) || 0;
            const pctHT = target > 0 ? (actual / target * 100) : 0;
            const pctDK = typeof currentRecord.forecastCompletionRate === 'number'
                ? currentRecord.forecastCompletionRate
                : pctHT;

            let txt = `📊 TÓM TẮT TÌNH HÌNH KINH DOANH THÁNG ${selectedMonth}/${selectedYear} - ${storeLabel}\n`;
            txt += `(Số liệu lũy kế đến ngày ${formatDate(currentRecord.reportDate)} - Tiến độ ${currentRecord.passedDays}/${currentRecord.totalDays} ngày)\n\n`;

            txt += `💰 DOANH THU & TIẾN ĐỘ:\n`;
            txt += `- DTQĐ Thực hiện: ${formatValue(actual)} / Target: ${formatValue(target)} (${pctHT.toFixed(1)}% HT)\n`;
            txt += `- Dự kiến hoàn thành tháng: ${pctDK.toFixed(1)}% DK\n`;

            const hasInstallmentRate = (currentRecord.installmentRate || 0) > 0;
            if (hasInstallmentRate) {
                txt += `- Doanh thu trả góp: ${formatValue(Number(currentRecord.revenueInstallment) || 0)} (${Number(currentRecord.installmentRate).toFixed(1)}%)\n`;
            }

            if (emulationRowList.length > 0) {
                const targeted = emulationRowList;
                const passed = targeted.filter(d => d.pctDK >= 100);
                const passRate = targeted.length > 0 ? (passed.length / targeted.length * 100).toFixed(1) : '0';
                txt += `\n🎯 THI ĐUA: DK Đạt ${passed.length}/${targeted.length} NH (${passRate}%)`;

                const fails = targeted.filter(d => d.pctDK < 100);
                if (fails.length === 0) {
                    txt += `\n\n🎉 Xuất sắc! Đã hoàn thành tất cả các chỉ tiêu!`;
                } else {
                    const groupNear = fails.filter(d => d.pctDK >= 80);
                    const groupSpeed = fails.filter(d => d.pctDK >= 50 && d.pctDK < 80);
                    const groupAlert = fails.filter(d => d.pctDK < 50);

                    if (mode === 1) {
                        txt += `\n\n📊 TỔNG HỢP DK CHƯA ĐẠT (${fails.length} NH):`;
                        if (groupNear.length > 0) txt += `\n- ⚡ CẬN ĐÍCH (>80%): ${groupNear.length} NH`;
                        if (groupSpeed.length > 0) txt += `\n- 🔥 CẦN TĂNG TỐC (50% - 80%): ${groupSpeed.length} NH`;
                        if (groupAlert.length > 0) txt += `\n- ⚠️ NGUY HIỂM (<50%): ${groupAlert.length} NH`;
                    } else if (mode === 2) {
                        txt += `\n\n📊 CHI TIẾT DK CHƯA ĐẠT (${fails.length} NH):`;
                        if (groupNear.length > 0) {
                            txt += `\n\n⚡ CẬN ĐÍCH (>80%): ${groupNear.length} NH`;
                            groupNear.forEach(d => {
                                const prefix = isAll ? `[${d.storeName}] ` : '';
                                txt += `\n- ${prefix}${d.label}: thiếu ${formatValue(Math.max(0, d.target - d.actual))} (${d.pctDK.toFixed(1)}%)`;
                            });
                        }
                        if (groupSpeed.length > 0) {
                            txt += `\n\n🔥 CẦN TĂNG TỐC (50% - 80%): ${groupSpeed.length} NH`;
                            groupSpeed.forEach(d => {
                                const prefix = isAll ? `[${d.storeName}] ` : '';
                                txt += `\n- ${prefix}${d.label}: thiếu ${formatValue(Math.max(0, d.target - d.actual))} (${d.pctDK.toFixed(1)}%)`;
                            });
                        }
                        if (groupAlert.length > 0) {
                            txt += `\n\n⚠️ NGUY HIỂM (<50%): ${groupAlert.length} NH`;
                            groupAlert.forEach(d => {
                                const prefix = isAll ? `[${d.storeName}] ` : '';
                                txt += `\n- ${prefix}${d.label}: thiếu ${formatValue(Math.max(0, d.target - d.actual))} (${d.pctDK.toFixed(1)}%)`;
                            });
                        }
                    } else {
                        txt += `\n\n⚠️ CHI TIẾT DK CHƯA ĐẠT (${fails.length} NH):`;
                        fails.forEach(d => {
                            const prefix = isAll ? `[${d.storeName}] ` : '';
                            txt += `\n- ${prefix}${d.label}: thiếu ${formatValue(Math.max(0, d.target - d.actual))} (${d.pctDK.toFixed(1)}%)`;
                        });
                    }
                }
            }

            return txt;
        };

        return [
            { id: 1, title: 'Mẫu 1: Tổng quát', badge: 'Súc tích', content: getSummaryForMode(1), description: 'Tóm tắt chỉ số và phân loại số lượng ngành hàng chưa đạt' },
            { id: 2, title: 'Mẫu 2: Chi tiết 3 nhóm', badge: 'Phân loại', content: getSummaryForMode(2), description: 'Phân loại chi tiết ngành hàng cận đích, tăng tốc và nguy hiểm' },
            { id: 3, title: 'Mẫu 3: Chi tiết toàn bộ', badge: 'Hành động', content: getSummaryForMode(3), description: 'Chi tiết toàn bộ danh sách ngành hàng cần bổ sung' }
        ];
    }, [currentRecord, emulationRowList, selectedStore, selectedMonth, selectedYear, isAdmin]);

    // Đồng bộ templates lên parent
    useEffect(() => {
        if (onUpdateAssessmentTemplates) {
            onUpdateAssessmentTemplates(monthlyAssessmentTemplates);
        }
    }, [monthlyAssessmentTemplates, onUpdateAssessmentTemplates]);

    const summaryText = useMemo(() => {
        return monthlyAssessmentTemplates.find(t => t.id === summaryMode)?.content
            || monthlyAssessmentTemplates[0]?.content
            || '';
    }, [monthlyAssessmentTemplates, summaryMode]);

    const handleCopyText = () => {
        if (!summaryText) {
            showToast('Chưa có nội dung tóm tắt để sao chép!', 'error');
            return;
        }
        navigator.clipboard.writeText(summaryText);
        showToast('Đã copy nội dung nhận xét vào clipboard!');
    };

    // 5. CHỤP ẢNH BÁO CÁO 8K CHUẨN PORTRAIT MOBILE (960px, NO WATERMARK)
    const handleCaptureAction = async (action: 'DOWNLOAD' | 'COPY') => {
        if (!reportRef.current || isProcessingImg) return;
        setIsProcessingImg(true);

        try {
            const hasInstallmentRate = (currentRecord?.installmentRate || 0) > 0;
            const canvas = await generateStandardReportCanvas(reportRef.current, {
                targetWidth: 960,
                kpiColumns: hasInstallmentRate ? 6 : 5,
                containerSelector: '[data-report-table="true"]',
                onCustomClone: (_doc, clonedReport) => {
                    clonedReport.querySelectorAll<HTMLElement>('.flex-col').forEach(el => {
                        el.style.flexDirection = 'row';
                        el.style.alignItems = 'center';
                        el.style.justifyContent = 'space-between';
                    });
                }
            });

            if (!canvas) throw new Error('Không thể khởi tạo canvas');

            if (action === 'DOWNLOAD') {
                const fileName = buildReportImageFileName(
                    'Bao_Cao_Thang',
                    selectedStore,
                    `T${selectedMonth}_${selectedYear}`
                );
                const success = await downloadReportCanvas(canvas, fileName);
                if (success) showToast('Đã tải ảnh báo cáo tháng về thiết bị!');
                else throw new Error('Không thể lưu file ảnh');
            } else {
                const success = await copyReportCanvasToClipboard(canvas);
                if (success) {
                    showToast('Đã copy ảnh báo cáo vào clipboard! (Ctrl + V)');
                } else {
                    showToast('Trình duyệt chặn copy ảnh, vui lòng dùng TẢI ẢNH!', 'error');
                }
            }
        } catch (err: any) {
            console.error('Lỗi khi xuất ảnh Tab Thi Đua:', err);
            showToast('Có lỗi xảy ra khi tạo ảnh báo cáo!', 'error');
        } finally {
            setIsProcessingImg(false);
        }
    };

    // Đăng ký hàm xuất ảnh với parent page
    useEffect(() => {
        if (onRegisterExportHandler) {
            onRegisterExportHandler(handleCaptureAction);
        }
    }, [onRegisterExportHandler, handleCaptureAction]);

    if (!currentRecord) {
        return (
            <div className="bg-white p-12 sm:p-16 rounded-3xl border border-slate-200 text-center space-y-4 shadow-sm">
                <div className="w-14 h-14 bg-amber-50 text-amber-700 rounded-2xl flex items-center justify-center mx-auto border border-amber-200">
                    <AlertCircle className="w-7 h-7" aria-hidden="true" />
                </div>
                <div className="max-w-md mx-auto space-y-1.5">
                    <h3 className="text-base font-black text-slate-800 uppercase tracking-wide">
                        Chưa có dữ liệu thi đua tháng {selectedMonth}/{selectedYear}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                        Phạm vi {selectedStore !== 'all' ? `ST ${selectedStore}` : 'toàn cụm'} chưa ghi nhận bản ghi thi đua thực tế nào trong kỳ này.
                    </p>
                </div>
            </div>
        );
    }

    const hasInstallment = (currentRecord.installmentRate || 0) > 0;
    const targetRev = Number(currentRecord.revenueTarget) || 0;
    const actualRev = Number(currentRecord.revenueActual) || 0;
    const pctHT = targetRev > 0 ? (actualRev / targetRev * 100) : 0;
    const pctDK = typeof currentRecord.forecastCompletionRate === 'number'
        ? currentRecord.forecastCompletionRate
        : pctHT;

    return (
        <div className="space-y-4">
            {/* VÙNG CHỤP ẢNH BÁO CÁO (BANNER + 6 THẺ KPI + BẢNG 24 NGÀNH HÀNG) */}
            <div
                ref={reportRef}
                data-capture-target="true"
                data-report-table="true"
                className="space-y-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm font-avo report-table"
            >
                {/* 1. BANNER TIÊU ĐỀ BÁO CÁO */}
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4 sm:p-5 rounded-xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <Store className="w-5 h-5 text-amber-400 shrink-0" aria-hidden="true" />
                            <h2 className="font-black text-sm sm:text-base tracking-wide uppercase">
                                {currentRecord.storeName}
                            </h2>
                        </div>
                        <p className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                            <span>Số liệu ngày: <b className="text-amber-300 font-mono tabular-nums">{formatDate(currentRecord.reportDate)}</b></span>
                            <span className="hidden sm:inline text-slate-500" aria-hidden="true">•</span>
                            <span>Tiến độ ngày: <b className="text-white font-mono tabular-nums">{currentRecord.passedDays}/{currentRecord.totalDays} ngày</b></span>
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 px-3 py-1.5 rounded-lg text-xs font-black tracking-wider uppercase">
                            Kỳ Tháng {selectedMonth}/{selectedYear}
                        </span>
                    </div>
                </div>

                {/* 2. KHỐI 6 CARD KPI TỔNG HỢP */}
                <div className={`grid grid-cols-2 ${hasInstallment ? 'sm:grid-cols-3 lg:grid-cols-6' : 'sm:grid-cols-2 lg:grid-cols-5'} gap-2.5 sm:gap-3`}>
                    {/* Thẻ 1: DTQĐ Thực Hiện */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <div className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
                            DTQĐ Thực Hiện
                        </div>
                        <div className="text-base sm:text-lg font-black text-slate-900 mt-1 tabular-nums">
                            {formatValue(actualRev)}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                            Target: <b className="text-slate-700 tabular-nums">{formatValue(targetRev)}</b>
                        </div>
                    </div>

                    {/* Thẻ 2: DT Thực */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <div className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
                            Doanh Thu Thực
                        </div>
                        <div className="text-base sm:text-lg font-black text-slate-900 mt-1 tabular-nums">
                            {formatValue(actualRev)}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                            Tỷ trọng: <b className="text-slate-700">100%</b>
                        </div>
                    </div>

                    {/* Thẻ 3: Dự Kiến Hoàn Thành */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <div className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
                            Dự Kiến Hoàn Thành
                        </div>
                        <div className={`text-base sm:text-lg font-black mt-1 tabular-nums ${pctDK >= 100 ? 'text-emerald-700' : pctDK >= 80 ? 'text-amber-700' : 'text-rose-700'}`}>
                            {pctDK.toFixed(1)}%
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                            Trạng thái: <b className={pctDK >= 100 ? 'text-emerald-700' : pctDK >= 80 ? 'text-amber-700' : 'text-rose-700'}>
                                {pctDK >= 100 ? 'Vượt đích' : pctDK >= 80 ? 'Cận đích' : 'Cần tăng tốc'}
                            </b>
                        </div>
                    </div>

                    {/* Thẻ 4: Trả Chậm (nếu có) */}
                    {hasInstallment && (
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <div className="text-[10px] sm:text-[11px] font-bold text-purple-700 uppercase tracking-wider truncate">
                                Trả Chậm
                            </div>
                            <div className="text-base sm:text-lg font-black text-purple-900 mt-1 tabular-nums">
                                {formatValue(Number(currentRecord.revenueInstallment) || 0)}
                            </div>
                            <div className="text-[10px] text-purple-700 mt-0.5 truncate">
                                Tỷ lệ: <b className="tabular-nums">{Number(currentRecord.installmentRate).toFixed(1)}%</b>
                            </div>
                        </div>
                    )}

                    {/* Thẻ 5: % Hoàn Thành Thực Tế */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <div className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
                            % Hoàn Thành Hiện Tại
                        </div>
                        <div className={`text-base sm:text-lg font-black mt-1 tabular-nums ${pctHT >= 100 ? 'text-emerald-700' : 'text-slate-800'}`}>
                            {pctHT.toFixed(1)}%
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                            Đã trôi: <b className="tabular-nums">{currentRecord.passedDays}/{currentRecord.totalDays} ngày</b>
                        </div>
                    </div>

                    {/* Thẻ 6: Số CT Đạt */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <div className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">
                            Thi Đua Đạt DK
                        </div>
                        <div className="text-base sm:text-lg font-black text-emerald-700 mt-1 tabular-nums">
                            {emulationStats.passed}/{emulationStats.total}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                            Tỷ lệ đạt: <b className="text-emerald-700 tabular-nums">{emulationStats.passRate}%</b>
                        </div>
                    </div>
                </div>

                {/* 3. BẢNG KẾT QUẢ THI ĐUA (NÂNG CẤP TIÊU ĐỀ NỔI BẬT & CÓ CỜ IGNORE BỘ LỌC KHI CHỤP ẢNH) */}
                <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    {/* KHỐI TIÊU ĐỀ BẢNG NỔI BẬT */}
                    <div className="p-3.5 bg-gradient-to-r from-blue-700 to-blue-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-amber-400/20 border border-amber-300/40 flex items-center justify-center text-amber-300 shadow-inner shrink-0">
                                <Trophy className="w-4 h-4 fill-amber-300" aria-hidden="true" />
                            </div>
                            <div>
                                <h3 className="font-extrabold text-sm sm:text-base tracking-wide uppercase flex items-center gap-1.5">
                                    <span>Bảng Thi Đua Chi Tiết {isAllMode ? '(Toàn Cụm)' : ''}</span>
                                </h3>
                                <p className="text-[11px] text-blue-100 font-medium mt-0.5">
                                    Lũy kế tính đến hết ngày {formatDate(currentRecord.reportDate)}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-xs font-black uppercase bg-amber-400 text-slate-950 px-3 py-1 rounded-lg shadow-sm border border-amber-300 tabular-nums">
                                {emulationRowList.length} NH THI ĐUA
                            </span>
                        </div>
                    </div>

                    {/* KHỐI BỘ LỌC TRẠNG THÁI & SẮP XẾP - TỰ ĐỘNG BỊ LOẠI BỎ TRONG ẢNH CHỤP */}
                    <div
                        data-html2canvas-ignore="true"
                        className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 text-xs"
                    >
                        <div className="flex items-center gap-1.5 text-slate-600 font-bold uppercase text-[11px]">
                            <Filter className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
                            <span>Bộ lọc bảng:</span>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 min-h-[34px] shadow-sm">
                                <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
                                <select
                                    id="monthly-status-filter"
                                    name="statusFilter"
                                    aria-label="Lọc theo trạng thái thi đua"
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer text-xs"
                                >
                                    <option value="all">Tất cả trạng thái</option>
                                    <option value="passed">Chỉ mục ĐẠT (≥100%)</option>
                                    <option value="failed">Chỉ mục CHƯA ĐẠT (&lt;100%)</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 min-h-[34px] shadow-sm">
                                <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
                                <select
                                    id="monthly-sort-order"
                                    name="sortOrder"
                                    aria-label="Sắp xếp bảng thi đua"
                                    value={sortOrder}
                                    onChange={(e) => setSortOrder(e.target.value)}
                                    className="bg-transparent font-bold text-slate-800 outline-none cursor-pointer text-xs"
                                >
                                    <option value="pct-desc">% Tiến độ DK giảm dần</option>
                                    <option value="pct-asc">% Tiến độ DK tăng dần</option>
                                    <option value="pctHT-desc">% Hoàn thành (%HT) giảm dần</option>
                                    <option value="pctHT-asc">% Hoàn thành (%HT) tăng dần</option>
                                    <option value="remaining-desc">Mục tiêu còn lại giảm dần</option>
                                    <option value="remaining-asc">Mục tiêu còn lại tăng dần</option>
                                    {isAllMode && <option value="store-asc">Sắp xếp theo ST</option>}
                                    <option value="name-asc">Sắp xếp theo Tên Thi Đua</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Gợi ý cuộn ngang trên mobile */}
                    <div
                        data-html2canvas-ignore="true"
                        className="px-3 py-1.5 bg-slate-100/80 border-b border-slate-200 text-[10px] font-semibold text-slate-600 md:hidden"
                    >
                        Vuốt ngang trên bảng để xem đầy đủ cột %HT, %DKHT và Còn lại
                    </div>

                    {/* BẢNG SỐ LIỆU CHI TIẾT */}
                    <div className="overflow-x-auto">
                        <table
                            data-report-table="true"
                            className="w-full text-xs text-left border-collapse font-avo report-table"
                            style={{ fontFamily: "'UTM Avo', 'UTM-Avo', sans-serif" }}
                        >
                            <thead>
                                <tr className="bg-slate-800 text-white uppercase text-[10px] font-black border-b border-slate-700">
                                    <th className="py-2 px-1.5 text-center w-8 whitespace-nowrap">#</th>
                                    {isAllMode && (
                                        <th className="py-2 px-2 text-left whitespace-nowrap">ST</th>
                                    )}
                                    <th className="py-2 px-2 sm:px-2.5 text-left">Thi đua</th>
                                    <th className="py-2 px-1.5 sm:px-2 text-right whitespace-nowrap">Target</th>
                                    <th className="py-2 px-1.5 sm:px-2 text-right whitespace-nowrap">Lũy Kế</th>
                                    <th className="py-2 px-1.5 text-center whitespace-nowrap" title="% Hoàn thành hiện tại: (Lũy kế / Target) * 100">%HT</th>
                                    <th className="py-2 px-1.5 text-center whitespace-nowrap" title="% Dự kiến hoàn thành cuối tháng theo nhịp bán">%DKHT</th>
                                    <th className="py-2 px-1.5 sm:px-2 text-right whitespace-nowrap" title="Mục tiêu thi đua còn lại: Target - Lũy kế">Còn lại</th>
                                    <th className="py-2 px-1.5 text-center w-12 whitespace-nowrap">Đánh giá</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                                {emulationRowList.length === 0 ? (
                                    <tr>
                                        <td colSpan={isAllMode ? 9 : 8} className="py-8 text-center text-slate-600">
                                            Không tìm thấy mục thi đua nào khớp với điều kiện lọc trong ngày {formatDate(currentRecord.reportDate)}.
                                        </td>
                                    </tr>
                                ) : (
                                    emulationRowList.map((row, idx) => {
                                        const isPass = row.pctDK >= 100;
                                        return (
                                            <tr key={row.id} className={isPass ? 'bg-[#f0fdf4] text-emerald-950' : 'bg-[#fff1f2] text-rose-950'}>
                                                <td className="py-1.5 px-1.5 text-center text-slate-700 font-bold tabular-nums whitespace-nowrap">
                                                    {idx + 1}
                                                </td>
                                                {isAllMode && (
                                                    <td className="py-1.5 px-2 font-bold text-slate-800 whitespace-nowrap text-left">
                                                        {row.storeName}
                                                    </td>
                                                )}
                                                <td className="py-1.5 px-2 sm:px-2.5 font-bold text-slate-900 text-left">
                                                    {row.label}
                                                </td>
                                                <td className="py-1.5 px-1.5 sm:px-2 text-right font-mono tabular-nums font-bold whitespace-nowrap">
                                                    {formatValue(row.target)}
                                                </td>
                                                <td className="py-1.5 px-1.5 sm:px-2 text-right font-mono tabular-nums font-bold text-blue-700 whitespace-nowrap">
                                                    {formatValue(row.actual)}
                                                </td>
                                                <td className="py-1.5 px-1.5 text-center font-mono tabular-nums font-bold whitespace-nowrap">
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${row.pctHT >= 100
                                                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                                        : 'bg-slate-100 text-slate-800 border border-slate-300'
                                                        }`}>
                                                        {row.pctHT.toFixed(0)}%
                                                    </span>
                                                </td>
                                                <td className="py-1.5 px-1.5 text-center font-mono tabular-nums font-bold whitespace-nowrap">
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isPass ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-rose-100 text-rose-900 border border-rose-300'
                                                        }`}>
                                                        {row.pctDK.toFixed(0)}%
                                                    </span>
                                                </td>
                                                <td className={`py-1.5 px-1.5 sm:px-2 text-right font-mono tabular-nums font-bold whitespace-nowrap ${row.remaining === 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                                    {formatRemainingTarget(row.remaining, false)}
                                                </td>
                                                <td className="py-1.5 px-1.5 text-center whitespace-nowrap align-middle">
                                                    {isPass ? (
                                                        <span
                                                            aria-label="Đạt"
                                                            className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-700 text-white text-[11px] font-bold"
                                                        >
                                                            ✓
                                                        </span>
                                                    ) : (
                                                        <span
                                                            aria-label="Chưa đạt"
                                                            className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-700 text-white text-[11px] font-bold"
                                                        >
                                                            ✕
                                                        </span>
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
            </div>

            {/* KHỐI ĐÁNH GIÁ & TÓM TẮT THI ĐUA (NGOÀI VÙNG XUẤT ẢNH) */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-amber-600" aria-hidden="true" />
                        <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wider">
                            Tóm Tắt Nhận Xét Thi Đua (Soạn Sẵn Gửi Messaging App)
                        </h3>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-bold">
                            {monthlyAssessmentTemplates.map(tmpl => (
                                <button
                                    key={tmpl.id}
                                    type="button"
                                    onClick={() => setSummaryMode(Number(tmpl.id))}
                                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer text-[11px] ${summaryMode === Number(tmpl.id) ? 'bg-white text-amber-900 font-black shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
                                >
                                    {tmpl.title.split(':')[0]}
                                </button>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={handleCopyText}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                            <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Copy Nhận Xét</span>
                        </button>
                    </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-700 font-mono whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                    {summaryText}
                </div>
            </div>
        </div>
    );
}
