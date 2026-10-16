import React, { useState, useEffect, useMemo, useRef } from 'react';
import html2canvas from 'html2canvas';
import { calculate8KScale } from '../../shared/utils/exportImage';
import {
    fetchBusinessRecords,
    fetchAllBusinessRecords,
    type BusinessDayRecord
} from '../../core/lib/storage';
import {
    getShortStoreName,
    formatDate,
    getYesterdayDateString,
    formatValue
} from '../../core/lib/formatters';

/**
 * Rút gọn tên siêu thị & Loại bỏ mã số siêu thị:
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

    // 2. Lọc bỏ các phần thuần số ở đầu hoặc giữa (mã siêu thị như 111, 1841, 1234)
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

import {
    type ClusterStoreRow,
    type ClusterSummaryData,
    type ClusterTargetConfigItem,
    type ClusterAssessmentData
} from './types';
import {
    fetchClusterTargetConfigs,
    fetchClusterTargetConfigPackage,
    fetchClusterAssessment,
    saveClusterAssessment
} from './services/clusterTargetService';
import { extractStoreRevenueDetails, extractStoreRevenueDetailsWithReal } from './utils/revenueExtractor';
import ClusterTargetConfigModal from './components/ClusterTargetConfigModal';
import ClusterAssessmentModal from './components/ClusterAssessmentModal';
import ReportDataFreshnessBar from '../../shared/components/report/ReportDataFreshnessBar';
import ReportActionButtons from '../../shared/components/report/ReportActionButtons';
import type { AssessmentTemplate } from '../../shared/components/report/ReportAssessmentModal';
import {
    Store,
    Target,
    MessageSquare,
    Camera,
    Copy,
    Download,
    RefreshCw,
    TrendingUp,
    Coins,
    Award,
    Calendar,
    Check,
    CheckCircle2,
    AlertCircle,
    Sparkles,
    ChevronDown,
    Building2,
    ArrowUpRight,
    HelpCircle,
    Sliders,
    Cloud,
    Eye,
    EyeOff
} from 'lucide-react';

export default function ClusterReportPage() {
    const reportCaptureRef = useRef<HTMLDivElement | null>(null);

    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
    const [selectedDate, setSelectedDate] = useState<string>('latest');
    const [displayUnit, setDisplayUnit] = useState<'BILLION' | 'MILLION'>('BILLION'); // 'BILLION' (1.638 tỷ như ảnh) | 'MILLION' (1,638.0 tr)

    const [records, setRecords] = useState<BusinessDayRecord[]>([]);
    const [targetConfigs, setTargetConfigs] = useState<ClusterTargetConfigItem[]>([]);
    const [globalPaceRate, setGlobalPaceRate] = useState<number>(100);
    const [assessmentData, setAssessmentData] = useState<ClusterAssessmentData | null>(null);
    const [showAssessment, setShowAssessment] = useState<boolean>(false); // Mặc định ẩn nhận xét
    const [loading, setLoading] = useState<boolean>(true);

    const [tableFilter, setTableFilter] = useState<'ALL' | 'STANDARD' | 'OVER'>('ALL');

    // Modals
    const [isTargetModalOpen, setIsTargetModalOpen] = useState<boolean>(false);
    const [isAssessmentModalOpen, setIsAssessmentModalOpen] = useState<boolean>(false);
    const [isExportingImg, setIsExportingImg] = useState<boolean>(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

    // 1. Tải dữ liệu kinh doanh và cấu hình
    const loadAllData = async () => {
        setLoading(true);
        try {
            const [recordsRes, targetPkg, assessment] = await Promise.all([
                fetchBusinessRecords(selectedMonth, selectedYear),
                fetchClusterTargetConfigPackage(selectedMonth, selectedYear),
                fetchClusterAssessment(selectedMonth, selectedYear)
            ]);

            if (recordsRes.success && recordsRes.data) {
                setRecords(recordsRes.data);
            } else {
                setRecords([]);
            }

            setTargetConfigs(targetPkg.items);
            setGlobalPaceRate(targetPkg.globalPaceRate || 100);
            setAssessmentData(assessment);
        } catch (err) {
            console.error('Lỗi loadAllData ClusterReportPage:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAllData();
    }, [selectedMonth, selectedYear]);

    // 2. Danh sách các ngày có dữ liệu trong tháng
    const availableDates = useMemo(() => {
        const set = new Set<string>();
        records.forEach(r => {
            if (r.reportDate) set.add(r.reportDate);
        });
        return Array.from(set).sort((a, b) => b.localeCompare(a));
    }, [records]);

    // Xác định ngày đang xem thực tế
    const effectiveDate = useMemo(() => {
        if (selectedDate !== 'latest' && availableDates.includes(selectedDate)) {
            return selectedDate;
        }
        return availableDates[0] || getYesterdayDateString();
    }, [selectedDate, availableDates]);

    // 3. Tính toán và chuyển đổi dữ liệu cho từng siêu thị trong cụm
    const clusterRows = useMemo<ClusterStoreRow[]>(() => {
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

        // Gom nhóm theo từng siêu thị (bỏ qua bản ghi tổng nếu có)
        const storeMap = new Map<string, BusinessDayRecord>();
        sourceRecords.forEach(r => {
            if (!r.storeName || /^(tổng|tong)/i.test(r.storeName)) return;
            const existing = storeMap.get(r.storeName);
            if (!existing || (Number(r.revenueActual) || 0) > (Number(existing.revenueActual) || 0)) {
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

            // Bóc tách chi tiết Doanh thu Quy đổi (DTQĐ) và Doanh thu Thực (DT Thực) từ rawRevenue
            const extracted = extractStoreRevenueDetailsWithReal(rec.rawRevenue, storeName);

            // DT Thực (L. KẾ) & DTQĐ (L. KẾ)
            let revActual = 0;
            let revQd = 0;

            if (extracted && extracted.revenueQd > 0 && extracted.revenueActual > 0) {
                revQd = extracted.revenueQd;
                revActual = extracted.revenueActual;
            } else if (extracted && extracted.revenueQd > 0) {
                revQd = extracted.revenueQd;
                revActual = extracted.revenueActual || revQd;
            } else {
                // Fallback nếu không bóc tách được từ rawRevenue
                const storedVal = Number(rec.revenueActual) || 0;
                revQd = storedVal;
                revActual = storedVal;
            }

            // Target Gốc (Base Target): Ưu tiên cấu hình -> parsed Target -> rec.revenueTarget -> revQd
            const baseTarget = (cfg?.baseTarget && cfg.baseTarget > 0)
                ? cfg.baseTarget
                : ((extracted?.revenueTarget && extracted.revenueTarget > 0)
                    ? extracted.revenueTarget
                    : (rec.revenueTarget > 0 ? rec.revenueTarget : revQd));

            // DT Trả góp & Tỷ lệ trả góp (%TG = DT Trả góp / DT Thực)
            const revInstallment = (extracted?.installmentRevenue !== undefined && extracted.installmentRevenue > 0)
                ? extracted.installmentRevenue
                : (Number(rec.revenueInstallment) || 0);

            // Kiểm tra xem siêu thị này có % Trả góp hay không
            let installmentRate = 0;
            let hasInstallmentRate = false;

            if (extracted?.installmentRate !== undefined) {
                // Ưu tiên 1: Lấy từ extracted (đã tính theo DT thực nếu có 2 bảng, hoặc từ cột 9 mẫu cũ)
                installmentRate = extracted.installmentRate;
                hasInstallmentRate = true;
            } else if ((rec.emulationSummary as any)?.['__real_revenue']) {
                // Ưu tiên 2: Lấy từ __real_revenue đã lưu trong emulationSummary
                const realInfo = (rec.emulationSummary as any)['__real_revenue'];
                const rReal = realInfo.revenueReal || realInfo.revenueActual || 0;
                const rInst = realInfo.installmentReal !== undefined ? realInfo.installmentReal : realInfo.installmentRevenue;
                if (rReal > 0 && rInst !== undefined) {
                    installmentRate = Number(((rInst / rReal) * 100).toFixed(2));
                    hasInstallmentRate = true;
                }
            } else if (!rec.rawRevenue && Number(rec.installmentRate) > 0) {
                // Ưu tiên 3: Phiên lưu trước đây không lưu rawRevenue nhưng có installmentRate
                installmentRate = Number(rec.installmentRate);
                hasInstallmentRate = true;
            }

            // === BẢNG 1: DỮ LIỆU CHUẨN CỦA HỆ THỐNG ===
            const pctHtStandard = baseTarget > 0 ? (revQd / baseTarget) * 100 : 0;
            const targetRemainingStandard = Math.max(0, baseTarget - revQd);
            const forecastRevenueQd = passedDays > 0 ? (revQd / passedDays) * totalDays : revQd;
            const pctDkhtStandard = baseTarget > 0 ? (forecastRevenueQd / baseTarget) * 100 : 0;
            const pctQd = revActual > 0 ? ((revQd - revActual) / revActual) * 100 : 0;

            // === BẢNG 2: MỤC TIÊU VƯỢT TRỘI ===
            const targetRate = cfg?.targetRate && cfg.targetRate > 0
                ? cfg.targetRate
                : globalPaceRate;
            const targetOver = cfg?.targetOver && cfg.targetOver > 0
                ? cfg.targetOver
                : Number(((baseTarget * targetRate) / 100).toFixed(3));
            const pctHtOver = targetOver > 0 ? (revQd / targetOver) * 100 : 0;
            const targetRemainingOver = Math.max(0, targetOver - revQd);
            const pctDkhtOver = targetOver > 0 ? (forecastRevenueQd / targetOver) * 100 : 0;

            // Target còn lại quy đổi sang triệu đồng (VD: 5.501 tỷ -> 5501 triệu)
            const targetRemainingOverMillion = targetRemainingOver > 100
                ? targetRemainingOver
                : targetRemainingOver * 1000;
            // Mỗi ngày trung bình = Target còn lại (triệu) / Số ngày còn lại (VD: 5501 / 20 = 275 tr)
            const targetDailyRemainingOver = remainingDays > 0
                ? Math.round(targetRemainingOverMillion / remainingDays)
                : 0;

            // TB 3 Tháng & Tăng trưởng
            const avg3Months = (cfg?.avg3Months && cfg.avg3Months > 0)
                ? cfg.avg3Months
                : ((extracted?.avg3Months && extracted.avg3Months > 0)
                    ? extracted.avg3Months
                    : (rec.revenueTarget > 0 ? rec.revenueTarget * 0.9 : revQd * 0.95));
            const pctGrowth = avg3Months > 0 ? ((forecastRevenueQd - avg3Months) / avg3Months) * 100 : 0;

            rows.push({
                id: rec.id,
                storeName,
                shortName,
                orderIndex: index++,

                // Bảng 1
                revenueActual: revActual,
                revenueQd: revQd,
                baseTarget,
                pctHtStandard,
                targetRemainingStandard,
                forecastRevenueQd,
                pctDkhtStandard,
                pctQd,
                revenueInstallment: revInstallment,
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
    }, [records, effectiveDate, targetConfigs, globalPaceRate, selectedMonth, selectedYear]);

    // 4. Tổng kết toàn cụm (TỔNG CỤM)
    const clusterSummary = useMemo<ClusterSummaryData>(() => {
        if (clusterRows.length === 0) {
            return {
                totalRevenueActual: 0,
                totalRevenueQd: 0,
                totalBaseTarget: 0,
                avgPctHtStandard: 0,
                totalTargetRemainingStandard: 0,
                totalForecastRevenueQd: 0,
                avgPctDkhtStandard: 0,
                avgPctQd: 0,
                totalRevenueInstallment: 0,
                avgInstallmentRate: 0,
                hasInstallmentRate: false,

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
        const totalRevenueActual = clusterRows.reduce((sum, r) => sum + r.revenueActual, 0);
        const totalRevenueQd = clusterRows.reduce((sum, r) => sum + r.revenueQd, 0);
        const totalBaseTarget = clusterRows.reduce((sum, r) => sum + r.baseTarget, 0);
        const avgPctHtStandard = totalBaseTarget > 0 ? (totalRevenueQd / totalBaseTarget) * 100 : 0;
        const totalTargetRemainingStandard = clusterRows.reduce((sum, r) => sum + r.targetRemainingStandard, 0);
        const totalForecastRevenueQd = clusterRows.reduce((sum, r) => sum + r.forecastRevenueQd, 0);
        const avgPctDkhtStandard = totalBaseTarget > 0 ? (totalForecastRevenueQd / totalBaseTarget) * 100 : 0;
        const avgPctQd = totalRevenueActual > 0 ? ((totalRevenueQd - totalRevenueActual) / totalRevenueActual) * 100 : 0;
        const totalRevenueInstallment = clusterRows.reduce((sum, r) => sum + r.revenueInstallment, 0);
        const avgInstallmentRate = (hasInstallmentRate && totalRevenueActual > 0)
            ? (totalRevenueInstallment / totalRevenueActual) * 100
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
            totalRevenueActual,
            totalRevenueQd,
            totalBaseTarget,
            avgPctHtStandard,
            totalTargetRemainingStandard,
            totalForecastRevenueQd,
            avgPctDkhtStandard,
            avgPctQd,
            totalRevenueInstallment,
            avgInstallmentRate,
            hasInstallmentRate,

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

    // Hàm định dạng số tiền theo đơn vị Tỷ hoặc Triệu
    const formatNumberVal = (val: number, isCurrency: boolean = true) => {
        if (displayUnit === 'BILLION') {
            // Hiển thị dạng tỷ đồng với 3 số thập phân (ví dụ: 1.638, 2.248, 5.867)
            // Nếu giá trị lưu dạng triệu (vd: 1638) thì chia 1000, nếu đã ở dạng tỷ (vd: 1.638) thì giữ nguyên
            const bVal = val > 100 ? val / 1000 : val;
            return bVal.toFixed(3);
        } else {
            // Hiển thị dạng triệu đồng có dấu phẩy
            const mVal = val > 100 ? val : val * 1000;
            return Math.round(mVal).toLocaleString('vi-VN');
        }
    };

    // Hàm định dạng số tiền trả góp (thường là triệu đồng trong bảng, ví dụ 614)
    const formatInstallmentVal = (val: number) => {
        if (displayUnit === 'BILLION') {
            // Nếu > 100 nghĩa là số triệu nguyên (ví dụ 614 tr), giữ nguyên 614
            return Math.round(val).toLocaleString('vi-VN');
        }
        return Math.round(val).toLocaleString('vi-VN');
    };

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
                            showToast('📋 Đã sao chép ảnh báo cáo 8K cụm vào bộ nhớ tạm!');
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
            showToast('⚠️ Không thể xuất ảnh báo cáo: ' + err.message);
        } finally {
            setIsExportingImg(false);
        }
    };

    const downloadCanvas = (canvas: HTMLCanvasElement) => {
        const link = document.createElement('a');
        link.download = `Bao_Cao_Cum_Sieu_Thi_${effectiveDate || `Thang_${selectedMonth}`}_8K.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        showToast('💾 Đã tải ảnh báo cáo 8K về thiết bị thành công!');
    };

    // 6. Cấu hình 3 mẫu nhận xét tạo sẵn cho Cụm Siêu Thị
    const clusterAssessmentTemplates = useMemo<AssessmentTemplate[]>(() => {
        if (clusterRows.length === 0) return [];
        const topPctHt = [...clusterRows].sort((a, b) => b.pctHtOver - a.pctHtOver)[0];
        const lowPctHt = [...clusterRows].sort((a, b) => a.pctHtOver - b.pctHtOver)[0];

        // Mẫu 1: Tổng quan súc tích
        const t1Lines: string[] = [
            `📊 ĐÁNH GIÁ SỨC KHỎE CỤM T${selectedMonth}/${selectedYear}:`,
            `• DTQĐ: ${clusterSummary.totalRevenueQd.toFixed(3)} tỷ (+${clusterSummary.avgPctQd.toFixed(1)}% QĐ) • %HT: ${clusterSummary.avgPctHtOver.toFixed(1)}%${clusterSummary.hasInstallmentRate ? ` • Trả góp: ${clusterSummary.avgInstallmentRate.toFixed(1)}%` : ''}.`,
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
            `• Tổng DTQĐ: ${clusterSummary.totalRevenueQd.toFixed(3)} tỷ • %HT Vượt Trội: ${clusterSummary.avgPctHtOver.toFixed(1)}%`,
            `\n🌟 NHÓM VƯỢT TRỘI / ĐẠT CHUẨN (${reached.length}/${clusterRows.length} shop):`,
            reached.length > 0 ? reached.map(r => `- ${getShortStoreName(r.storeName)}: ${r.pctHtOver.toFixed(1)}% (${r.revenueQd.toFixed(3)} tỷ)`).join('\n') : '- Chưa có shop nào đạt 100%',
            `\n⚡ NHÓM CẬN ĐÍCH (>80%): ${near.length} shop`,
            near.length > 0 ? near.map(r => `- ${getShortStoreName(r.storeName)}: ${r.pctHtOver.toFixed(1)}% (Thiếu ${r.targetRemainingOver.toFixed(0)}tr)`).join('\n') : '- Không có',
            `\n🚨 NHÓM CẦN BỨT PHÁ (<80%): ${alertGroup.length} shop`,
            alertGroup.length > 0 ? alertGroup.map(r => `- ${getShortStoreName(r.storeName)}: ${r.pctHtOver.toFixed(1)}% (Cần ${r.targetDailyRemainingOver.toFixed(0)}tr/ngày)`).join('\n') : '- Không có',
            `\n🔥 Toàn cụm dồn lực giờ vàng ca tối!`
        ];

        // Mẫu 3: Chi tiết & Hướng dẫn hành động
        const t3Lines: string[] = [
            `📋 HƯỚNG DẪN HÀNH ĐỘNG CỤM T${selectedMonth}/${selectedYear}:`,
            `1. THỰC TRẠNG: Toàn cụm đạt ${clusterSummary.avgPctHtOver.toFixed(1)}% target vượt trội. Target mỗi ngày còn lại cần ${clusterSummary.totalTargetDailyRemainingOver.toFixed(0)} triệu/ngày.`,
            `2. ĐIỂM SÁNG: ${topPctHt ? `[${getShortStoreName(topPctHt.storeName)}] dẫn đầu với ${topPctHt.pctHtOver.toFixed(1)}%` : 'Duy trì nhịp bán hàng tốt'}.`,
            `3. GIẢI PHÁP HÀNH ĐỘNG THỰC CHIẾN:`,
            `• Nhịp ca: Bám sát target từng ca, không để dồn số về cuối ngày.`,
            `• Cơ cấu doanh thu: Tối ưu triệt để DTQĐ các ngành hàng trọng điểm${clusterSummary.hasInstallmentRate ? ` và nâng tỷ lệ trả chậm >${clusterSummary.avgInstallmentRate > 30 ? clusterSummary.avgInstallmentRate.toFixed(0) : '35'}%` : ''}.`,
            `• Quản lý siêu thị: Trực tiếp bám sàn trong khung giờ vàng 18h-21h30 để chốt đơn và hỗ trợ nhân viên.`,
            `💪 Quyết tâm 100% siêu thị trong cụm cán đích!`
        ];

        return [
            { id: 1, title: 'Mẫu 1: Tổng quan', badge: 'Súc tích', content: t1Lines.join('\n'), description: 'Đánh giá nhanh 3-4 dòng gửi nhóm Zalo cụm' },
            { id: 2, title: 'Mẫu 2: Trọng tâm', badge: 'Phân loại', content: t2Lines.join('\n'), description: 'Phân loại nhóm đạt, cận đích và nhóm cần tăng tốc' },
            { id: 3, title: 'Mẫu 3: Chi tiết', badge: 'Hành động', content: t3Lines.join('\n'), description: 'Hướng dẫn giải pháp thực chiến ca tối & trả chậm' }
        ];
    }, [clusterRows, clusterSummary, selectedMonth, selectedYear]);

    return (
        <div
            style={{ fontFamily: "'UTM Avo', 'UTM-Avo', sans-serif" }}
            className="space-y-4 pb-12 animate-in fade-in duration-200 max-w-[960px] mx-auto px-2 sm:px-0"
        >
            {/* Thanh Thông Báo / Toast */}
            {toastMessage && (
                <div className="fixed top-20 right-4 z-50 bg-slate-900/90 text-white px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold animate-in slide-in-from-top-3 backdrop-blur-xs">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* HEADER THANH ĐIỀU KHIỂN CHÍNH */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Tiêu đề & Subtitle */}
                <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-200 shrink-0">
                        <Store className="w-6 h-6 stroke-[2.2]" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">
                                BÁO CÁO CỤM SIÊU THỊ
                            </h1>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200/60 uppercase tracking-wider">
                                2 BẢNG BÁO CÁO CỤM
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-900 border border-amber-300 flex items-center gap-1">
                                <span>⚡ Nhịp Target:</span>
                                <b>{globalPaceRate}%</b>
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1.5 flex-wrap">
                            <span>Dữ liệu đồng bộ từ:</span>
                            <code className="text-indigo-600 font-bold bg-indigo-50/80 px-1.5 py-0.2 rounded font-mono text-[11px]">
                                Cập nhật &gt; Báo cáo Tổng hợp &gt; Luỹ kế DT
                            </code>
                        </p>
                    </div>
                </div>

                {/* Các nút hành động chính */}
                <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
                    {/* Nút Cấu hình Target */}
                    <button
                        type="button"
                        onClick={() => setIsTargetModalOpen(true)}
                        className="px-3.5 py-2 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/80 text-xs font-black flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                        title="Tùy biến Target Vượt Trội & Doanh thu TB 3 tháng cho từng siêu thị"
                    >
                        <Target className="w-4 h-4 text-amber-600" />
                        <span>CẤU HÌNH TARGET</span>
                    </button>

                    {/* MẪU BUTTON CHUNG DÙNG CHO TOÀN BỘ PROJECT (XUẤT ẢNH, COPY ẢNH, NHẬN XÉT 1-3 MẪU) */}
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
                            showToast('✅ Đã lưu nhận xét thành công!');
                        }}
                        reportTitle={`Báo Cáo Sức Khỏe Cụm T${selectedMonth}/${selectedYear}`}
                        periodLabel={`Tháng ${selectedMonth}/${selectedYear}`}
                    />
                </div>
            </div>

            {/* BỘ LỌC KỲ BÁO CÁO, CHỌN BẢNG & ĐƠN VỊ HIỂN THỊ */}
            <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-2xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Chọn Tháng / Năm */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span className="font-bold text-slate-600 text-[11px]">Kỳ:</span>
                        <select
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
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5">
                            <span className="font-bold text-slate-600 text-[11px]">Ngày chốt:</span>
                            <select
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
                    <div className="flex items-center p-0.5 rounded-xl bg-slate-100 border border-slate-200 text-[11px] font-bold">
                        <button
                            type="button"
                            onClick={() => setTableFilter('ALL')}
                            className={`px-3 py-1 rounded-lg transition cursor-pointer ${tableFilter === 'ALL'
                                ? 'bg-white text-indigo-700 shadow-2xs font-black'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            Tất cả (2 Bảng)
                        </button>
                        <button
                            type="button"
                            onClick={() => setTableFilter('STANDARD')}
                            className={`px-3 py-1 rounded-lg transition cursor-pointer ${tableFilter === 'STANDARD'
                                ? 'bg-white text-emerald-700 shadow-2xs font-black'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            Bảng 1: Dữ liệu chuẩn
                        </button>
                        <button
                            type="button"
                            onClick={() => setTableFilter('OVER')}
                            className={`px-3 py-1 rounded-lg transition cursor-pointer ${tableFilter === 'OVER'
                                ? 'bg-white text-amber-700 shadow-2xs font-black'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            Bảng 2: Mục tiêu vượt trội
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-2 justify-end">
                    {/* Chuyển đổi đơn vị Tỷ / Triệu */}
                    <div className="flex items-center p-0.5 rounded-xl bg-slate-100 border border-slate-200 text-[11px] font-bold">
                        <button
                            type="button"
                            onClick={() => setDisplayUnit('BILLION')}
                            className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${displayUnit === 'BILLION'
                                ? 'bg-white text-indigo-700 shadow-2xs font-black'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            Tỷ đồng (1.638)
                        </button>
                        <button
                            type="button"
                            onClick={() => setDisplayUnit('MILLION')}
                            className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${displayUnit === 'MILLION'
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
                        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition cursor-pointer"
                        title="Tải lại số liệu"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
                    </button>
                </div>
            </div>

            {/* KHỐI THẺ CHỈ SỐ SỨC KHỎE CỐT LÕI (TỰ ĐỘNG CO DÃN 2 HOẶC 3 CỘT NẾU CÓ HOẶC KHÔNG CÓ % TRẢ GÓP) */}
            <div className={`grid grid-cols-1 ${clusterSummary.hasInstallmentRate ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3.5`}>
                {/* THẺ 1: TỔNG DTQĐ LŨY KẾ CỤM (LẤY DTQĐ LÀM TRỌNG TÂM) */}
                <div className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-2xs border-l-4 border-l-indigo-600 flex items-center justify-between">
                    <div className="min-w-0">
                        <div className="text-[10.5px] font-bold text-indigo-700 uppercase tracking-wider truncate">
                            Tổng DTQĐ Cụm
                        </div>
                        <div className="text-xl sm:text-2xl font-black text-indigo-950 mt-0.5 tracking-tight font-avo">
                            {formatNumberVal(clusterSummary.totalRevenueQd)}{' '}
                            <span className="text-xs font-bold text-indigo-600">{displayUnit === 'BILLION' ? 'tỷ' : 'tr'}</span>
                        </div>
                        <div className="text-[10.5px] text-slate-500 font-medium mt-0.5 truncate">
                            DT Thực: <b className="text-slate-700 font-bold">{formatNumberVal(clusterSummary.totalRevenueActual)}</b> ({clusterSummary.avgPctQd >= 0 ? '+' : ''}{clusterSummary.avgPctQd.toFixed(1)}% QĐ)
                        </div>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0 shadow-2xs">
                        <Coins className="w-5 h-5 stroke-[2.2]" />
                    </div>
                </div>

                {/* THẺ 2: %HT TARGET VƯỢT TRỘI */}
                <div className="bg-white p-4 rounded-2xl border border-amber-100 shadow-2xs border-l-4 border-l-amber-500 flex items-center justify-between">
                    <div className="min-w-0">
                        <div className="text-[10.5px] font-bold text-amber-800 uppercase tracking-wider truncate">
                            %HT Target Vượt Trội
                        </div>
                        <div className={`text-xl sm:text-2xl font-black mt-0.5 tracking-tight font-avo ${clusterSummary.avgPctHtOver >= 100
                            ? 'text-emerald-600'
                            : clusterSummary.avgPctHtOver >= 85
                                ? 'text-amber-700'
                                : 'text-rose-600'
                            }`}>
                            {clusterSummary.avgPctHtOver.toFixed(1)}%
                        </div>
                        <div className="text-[10.5px] text-slate-500 font-medium mt-0.5 truncate">
                            Mục tiêu: <b className="text-slate-700 font-bold">{formatNumberVal(clusterSummary.totalTargetOver)}</b> ({clusterSummary.avgTargetRate.toFixed(1)}%)
                        </div>
                    </div>
                    <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0 shadow-2xs">
                        <Target className="w-5 h-5 stroke-[2.2]" />
                    </div>
                </div>

                {/* THẺ 3: TỶ TRỌNG TRẢ GÓP (CHỈ HIỂN THỊ KHI CÓ DỮ LIỆU % TRẢ GÓP) */}
                {clusterSummary.hasInstallmentRate && (
                    <div className="bg-white p-4 rounded-2xl border border-purple-100 shadow-2xs border-l-4 border-l-purple-500 flex items-center justify-between animate-in fade-in">
                        <div className="min-w-0">
                            <div className="text-[10.5px] font-bold text-purple-800 uppercase tracking-wider truncate">
                                Tỷ Trọng Trả Góp
                            </div>
                            <div className="text-xl sm:text-2xl font-black text-purple-950 mt-0.5 tracking-tight font-avo">
                                {clusterSummary.avgInstallmentRate.toFixed(1)}%
                            </div>
                            <div className="text-[10.5px] text-slate-500 font-medium mt-0.5 truncate">
                                DT Góp: <b className="text-slate-700 font-bold">{formatInstallmentVal(clusterSummary.totalRevenueInstallment)} tr</b>
                            </div>
                        </div>
                        <div className="w-11 h-11 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0 shadow-2xs">
                            <Award className="w-5 h-5 stroke-[2.2]" />
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
                    className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-sm max-w-[960px] mx-auto space-y-4 font-avo report-table"
                >
                    {/* BANNER BÁO CÁO: ĐỒNG BỘ HIỆN ĐẠI CHUẨN SALESHUB */}
                    <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-amber-400/20 border border-amber-300/30 flex items-center justify-center text-amber-300 shadow-inner">
                                    <Store className="w-4.5 h-4.5" />
                                </div>
                                <h2 className="text-base sm:text-lg font-black tracking-wide uppercase text-white font-avo">
                                    BÁO CÁO SỨC KHỎE CỤM SIÊU THỊ
                                </h2>
                            </div>
                            <p className="text-xs text-slate-300 mt-1 flex items-center gap-2.5 flex-wrap">
                                <span>Số liệu ngày: <b className="text-amber-300">{formatDate(effectiveDate)}</b></span>
                                <span>•</span>
                                <span>Kỳ: <b className="text-white">Tháng {selectedMonth}/{selectedYear}</b></span>
                                <span>•</span>
                                <span>Cụm: <b className="text-emerald-400">{clusterRows.length} Siêu thị</b></span>
                            </p>
                        </div>

                        <div className="flex items-center gap-2 self-start sm:self-auto">
                            <span className="bg-white/10 px-3 py-1.5 rounded-xl text-xs font-black border border-white/15 text-amber-300">
                                ⚡ TARGET VÙNG: {globalPaceRate}%
                            </span>
                            <span className="bg-white/10 px-2.5 py-1.5 rounded-xl text-xs font-bold border border-white/10 text-slate-300">
                                {displayUnit === 'BILLION' ? 'Đơn vị: Tỷ' : 'Đơn vị: Triệu'}
                            </span>
                        </div>
                    </div>

                    {/* ============================================================== */}
                    {/* BẢNG 1: LŨY KẾ THEO DỮ LIỆU CHUẨN CỦA HỆ THỐNG (11 CỘT) */}
                    {/* ============================================================== */}
                    {(tableFilter === 'ALL' || tableFilter === 'STANDARD') && (
                        <div className="space-y-2">
                            {/* Tiêu đề Bảng 1 */}
                            <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-2">
                                    <span className="px-2.5 py-1 rounded-xl font-black text-xs uppercase bg-emerald-700 text-white shadow-2xs flex items-center gap-1.5">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        <span>TARGET CHUẨN HỆ THỐNG</span>
                                    </span>
                                    <span className="text-[11px] font-bold text-slate-500">
                                        (Tiến độ theo Target chuẩn 100%)
                                    </span>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                                <table
                                    data-report-table="true"
                                    className="w-full text-xs text-left border-collapse font-avo report-table"
                                    style={{ fontFamily: "'UTM Avo', 'UTM-Avo', sans-serif" }}
                                >
                                    <thead>
                                        {/* Hàng 1: Khối nhóm Header chuyên nghiệp */}
                                        <tr className="text-[10px] font-black uppercase tracking-wider border-b border-slate-200">
                                            <th
                                                rowSpan={2}
                                                className="py-3 px-2.5 bg-slate-800 text-white text-center border-r border-slate-700 min-w-[140px] sm:w-60"
                                            >
                                                SIÊU THỊ
                                            </th>
                                            <th
                                                colSpan={3}
                                                className="py-2 px-2 bg-blue-700 text-white text-center border-r border-blue-600"
                                            >
                                                LŨY KẾ DOANH THU
                                            </th>
                                            <th
                                                colSpan={3}
                                                className="py-2 px-2 bg-amber-600 text-white text-center border-r border-amber-500"
                                            >
                                                TARGET CHUẨN
                                            </th>
                                            <th
                                                colSpan={2}
                                                className="py-2 px-2 bg-indigo-700 text-white text-center border-r border-indigo-600"
                                            >
                                                DỰ KIẾN THÁNG
                                            </th>
                                            <th
                                                colSpan={clusterSummary.hasInstallmentRate ? 2 : 1}
                                                className="py-2 px-2 bg-purple-700 text-white text-center"
                                            >
                                                TRẢ GÓP
                                            </th>
                                        </tr>

                                        {/* Hàng 2: Chi tiết 11 cột (hoặc 10 cột nếu không có %TG) */}
                                        <tr className="text-[9.5px] sm:text-[10px] font-black uppercase tracking-tight border-b border-slate-200">
                                            {/* Nhóm Lũy kế doanh thu (3 cột) */}
                                            <th className="py-2 px-1.5 text-center bg-blue-50 text-blue-900 border-r border-blue-100 w-18">
                                                DT THỰC
                                            </th>
                                            <th className="py-2 px-1 text-center bg-blue-50 text-blue-900 border-r border-blue-100 w-14">
                                                %QĐ
                                            </th>
                                            <th className="py-2 px-1.5 text-center bg-blue-100/80 text-blue-950 font-black border-r border-blue-200 w-18">
                                                DTQĐ
                                            </th>

                                            {/* Target Chuẩn (3 cột) */}
                                            <th className="py-2 px-1.5 text-center bg-amber-50 text-amber-900 border-r border-amber-100 w-18">
                                                TARGET
                                            </th>
                                            <th className="py-2 px-1 text-center bg-amber-50 text-amber-900 border-r border-amber-100 w-14">
                                                %HT
                                            </th>
                                            <th className="py-2 px-1.5 text-center bg-amber-50 text-amber-900 border-r border-amber-100 w-18">
                                                CÒN LẠI
                                            </th>

                                            {/* Dự kiến tháng (2 cột) */}
                                            <th className="py-2 px-1.5 text-center bg-indigo-50 text-indigo-900 border-r border-indigo-100 w-20">
                                                DTQĐ
                                            </th>
                                            <th className="py-2 px-1 text-center bg-indigo-50 text-indigo-900 border-r border-indigo-100 w-14">
                                                %DKHT
                                            </th>

                                            {/* Trả góp */}
                                            <th className={`py-2 px-1.5 text-center bg-purple-50 text-purple-900 ${clusterSummary.hasInstallmentRate ? 'border-r border-purple-100' : ''} w-18`}>
                                                DT GÓP
                                            </th>
                                            {clusterSummary.hasInstallmentRate && (
                                                <th className="py-2 px-1 text-center bg-purple-50 text-purple-900 w-14">
                                                    %TG
                                                </th>
                                            )}
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-slate-100 font-bold text-slate-800 text-[11px] sm:text-xs">
                                        {clusterRows.length === 0 ? (
                                            <tr>
                                                <td colSpan={clusterSummary.hasInstallmentRate ? 11 : 10} className="py-8 text-center text-slate-400 italic">
                                                    Chưa có dữ liệu kinh doanh của kỳ báo cáo này. Vui lòng nạp số liệu tại phân hệ "Cập nhật số liệu LK".
                                                </td>
                                            </tr>
                                        ) : (
                                            clusterRows.map((row) => {
                                                const compactName = getCompactStoreName(row.storeName);

                                                return (
                                                    <tr
                                                        key={`b1-${row.storeName}`}
                                                        className="hover:bg-amber-50/20 transition group"
                                                    >
                                                        {/* 1. SIÊU THỊ: Gọn gàng, không hiển thị mã số */}
                                                        <td className="py-2.5 px-2.5 border-r border-slate-100">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-black text-[10px] flex items-center justify-center shrink-0 shadow-2xs">
                                                                    {row.orderIndex}
                                                                </span>
                                                                <span
                                                                    className="font-black text-slate-900 leading-tight truncate max-w-[210px]"
                                                                    title={row.storeName}
                                                                >
                                                                    {compactName}
                                                                </span>
                                                            </div>
                                                        </td>

                                                        {/* 2. DT THỰC */}
                                                        <td className="py-2.5 px-2 text-center font-black border-r border-slate-100 text-slate-900">
                                                            {formatNumberVal(row.revenueActual)}
                                                        </td>

                                                        {/* 3. %QĐ (Vị trí thứ 2 trong nhóm Lũy kế doanh thu) */}
                                                        <td className="py-2.5 px-1.5 text-center font-black text-emerald-700 border-r border-slate-100">
                                                            {row.pctQd >= 0 ? '+' : ''}{row.pctQd.toFixed(1)}%
                                                        </td>

                                                        {/* 4. LŨY KẾ DTQĐ */}
                                                        <td className="py-2.5 px-2 text-center font-black text-blue-700 border-r border-slate-100">
                                                            {formatNumberVal(row.revenueQd)}
                                                        </td>

                                                        {/* 5. TARGET */}
                                                        <td className="py-2.5 px-2 text-center font-black border-r border-slate-100 text-slate-900">
                                                            {formatNumberVal(row.baseTarget)}
                                                        </td>

                                                        {/* 6. %HT */}
                                                        <td className={`py-2.5 px-1.5 text-center font-black border-r border-slate-100 ${row.pctHtStandard >= 100
                                                            ? 'text-emerald-600'
                                                            : row.pctHtStandard >= 85
                                                                ? 'text-amber-600'
                                                                : 'text-rose-600'
                                                            }`}>
                                                            {row.pctHtStandard.toFixed(1)}%
                                                        </td>

                                                        {/* 7. TARGET CÒN LẠI */}
                                                        <td className="py-2.5 px-2 text-center font-black border-r border-slate-100 text-slate-700">
                                                            {formatNumberVal(row.targetRemainingStandard)}
                                                        </td>

                                                        {/* 8. DTQĐ DỰ KIẾN */}
                                                        <td className="py-2.5 px-2 text-center font-black text-indigo-700 border-r border-slate-100">
                                                            {formatNumberVal(row.forecastRevenueQd)}
                                                        </td>

                                                        {/* 9. %DKHT */}
                                                        <td className={`py-2.5 px-1.5 text-center font-black border-r border-slate-100 ${row.pctDkhtStandard >= 100
                                                            ? 'text-emerald-600'
                                                            : row.pctDkhtStandard >= 90
                                                                ? 'text-amber-600'
                                                                : 'text-rose-600'
                                                            }`}>
                                                            {row.pctDkhtStandard.toFixed(1)}%
                                                        </td>

                                                        {/* 10. DT TRẢ GÓP */}
                                                        <td className={`py-2.5 px-2 text-center font-black ${clusterSummary.hasInstallmentRate ? 'border-r border-slate-100' : ''} text-slate-900`}>
                                                            {formatInstallmentVal(row.revenueInstallment)}
                                                        </td>

                                                        {/* 11. % TRẢ GÓP */}
                                                        {clusterSummary.hasInstallmentRate && (
                                                            <td className="py-2.5 px-1.5 text-center font-black text-rose-600">
                                                                {row.hasInstallmentRate ? `${row.installmentRate.toFixed(1)}%` : '—'}
                                                            </td>
                                                        )}
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>

                                    {/* DÒNG TỔNG CỤM BẢNG 1 - EXECUTIVE DARK STYLE */}
                                    {clusterRows.length > 0 && (
                                        <tfoot>
                                            <tr className="bg-slate-900 text-white font-black text-xs border-t-2 border-slate-700">
                                                {/* Cột Tên */}
                                                <td className="py-3 px-2.5 text-center uppercase tracking-wider border-r border-slate-800 text-slate-200">
                                                    TỔNG CỤM
                                                </td>

                                                {/* DT Thực */}
                                                <td className="py-3 px-2 text-center font-black border-r border-slate-800 text-slate-100">
                                                    {formatNumberVal(clusterSummary.totalRevenueActual)}
                                                </td>

                                                {/* %QĐ */}
                                                <td className="py-3 px-1.5 text-center font-black text-emerald-400 border-r border-slate-800">
                                                    {clusterSummary.avgPctQd >= 0 ? '+' : ''}{clusterSummary.avgPctQd.toFixed(1)}%
                                                </td>

                                                {/* Lũy kế DTQĐ */}
                                                <td className="py-3 px-2 text-center font-black text-blue-300 border-r border-slate-800">
                                                    {formatNumberVal(clusterSummary.totalRevenueQd)}
                                                </td>

                                                {/* Target */}
                                                <td className="py-3 px-2 text-center font-black border-r border-slate-800 text-amber-200">
                                                    {formatNumberVal(clusterSummary.totalBaseTarget)}
                                                </td>

                                                {/* %HT */}
                                                <td className="py-3 px-1.5 text-center font-black text-emerald-400 border-r border-slate-800">
                                                    {clusterSummary.avgPctHtStandard.toFixed(1)}%
                                                </td>

                                                {/* Target còn lại */}
                                                <td className="py-3 px-2 text-center font-black border-r border-slate-800 text-slate-300">
                                                    {formatNumberVal(clusterSummary.totalTargetRemainingStandard)}
                                                </td>

                                                {/* DTQĐ Dự kiến */}
                                                <td className="py-3 px-2 text-center font-black text-indigo-300 border-r border-slate-800">
                                                    {formatNumberVal(clusterSummary.totalForecastRevenueQd)}
                                                </td>

                                                {/* %DKHT */}
                                                <td className="py-3 px-1.5 text-center font-black text-emerald-400 border-r border-slate-800">
                                                    {clusterSummary.avgPctDkhtStandard.toFixed(1)}%
                                                </td>

                                                {/* DT Trả góp */}
                                                <td className={`py-3 px-2 text-center font-black ${clusterSummary.hasInstallmentRate ? 'border-r border-slate-800' : ''} text-purple-300`}>
                                                    {formatInstallmentVal(clusterSummary.totalRevenueInstallment)}
                                                </td>

                                                {/* % Trả góp */}
                                                {clusterSummary.hasInstallmentRate && (
                                                    <td className="py-3 px-1.5 text-center font-black text-rose-400">
                                                        {clusterSummary.avgInstallmentRate.toFixed(1)}%
                                                    </td>
                                                )}
                                            </tr>
                                        </tfoot>
                                    )}
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
                            <div className="flex items-center justify-between px-1">
                                <div className="flex items-center gap-2">
                                    <span className="px-2.5 py-1 rounded-xl font-black text-xs uppercase bg-indigo-700 text-white shadow-2xs flex items-center gap-1.5">
                                        <Target className="w-3.5 h-3.5" />
                                        <span>TARGET VƯỢT TRỘI</span>
                                    </span>
                                    <span className="text-[11px] font-bold text-slate-500">
                                        (Tiến độ theo Target vượt trội)
                                    </span>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                                <table
                                    data-report-table="true"
                                    className="w-full text-xs text-left border-collapse font-avo report-table"
                                    style={{ fontFamily: "'UTM Avo', 'UTM-Avo', sans-serif" }}
                                >
                                    <thead>
                                        {/* Hàng 1: Khối nhóm Header chuyên nghiệp */}
                                        <tr className="text-[10px] font-black uppercase tracking-wider border-b border-slate-200">
                                            <th
                                                rowSpan={2}
                                                className="py-3 px-2.5 bg-slate-800 text-white text-center border-r border-slate-700 min-w-[140px] sm:w-60"
                                            >
                                                SIÊU THỊ
                                            </th>
                                            <th
                                                rowSpan={2}
                                                className="py-3 px-2 bg-amber-600 text-white text-center border-r border-amber-500 w-20"
                                            >
                                                TARGET
                                            </th>
                                            <th
                                                rowSpan={2}
                                                className="py-3 px-2 bg-blue-700 text-white text-center border-r border-blue-600 w-22"
                                            >
                                                LŨY KẾ DTQĐ
                                            </th>
                                            <th
                                                colSpan={3}
                                                className="py-2 px-2 bg-amber-700 text-white text-center border-r border-amber-600"
                                            >
                                                TIẾN ĐỘ VƯỢT TRỘI
                                            </th>
                                            <th
                                                colSpan={2}
                                                className="py-2 px-2 bg-indigo-700 text-white text-center border-r border-indigo-600"
                                            >
                                                DỰ KIẾN
                                            </th>
                                            <th
                                                rowSpan={2}
                                                className="py-3 px-2 bg-purple-700 text-white text-center w-24"
                                            >
                                                CÒN LẠI
                                                <div className="text-[9px] font-normal lowercase text-purple-200">(tr/ngày)</div>
                                            </th>
                                        </tr>

                                        {/* Hàng 2: Chi tiết các cột con */}
                                        <tr className="text-[9.5px] sm:text-[10px] font-black uppercase tracking-tight border-b border-slate-200">
                                            {/* Tiến độ vượt trội */}
                                            <th className="py-2 px-1.5 text-center bg-amber-50 text-amber-900 border-r border-amber-100 w-22">
                                                TARGET
                                            </th>
                                            <th className="py-2 px-1 text-center bg-amber-50 text-amber-900 border-r border-amber-100 w-16">
                                                %HT
                                            </th>
                                            <th className="py-2 px-1.5 text-center bg-amber-50 text-amber-900 border-r border-amber-100 w-22">
                                                CÒN LẠI
                                            </th>

                                            {/* Dự kiến tháng */}
                                            <th className="py-2 px-1.5 text-center bg-indigo-50 text-indigo-900 border-r border-indigo-100 w-22">
                                                DTQĐ
                                            </th>
                                            <th className="py-2 px-1 text-center bg-indigo-50 text-indigo-900 border-r border-indigo-100 w-16">
                                                %DKHT
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-slate-100 font-bold text-slate-800 text-[11px] sm:text-xs">
                                        {clusterRows.length === 0 ? (
                                            <tr>
                                                <td colSpan={9} className="py-8 text-center text-slate-400 italic">
                                                    Chưa có dữ liệu kinh doanh của kỳ báo cáo này. Vui lòng nạp số liệu tại phân hệ "Cập nhật số liệu LK".
                                                </td>
                                            </tr>
                                        ) : (
                                            clusterRows.map((row) => {
                                                const compactName = getCompactStoreName(row.storeName);

                                                return (
                                                    <tr
                                                        key={`b2-${row.storeName}`}
                                                        className="hover:bg-amber-50/20 transition group"
                                                    >
                                                        {/* 1. SIÊU THỊ */}
                                                        <td className="py-2.5 px-2.5 border-r border-slate-100">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-black text-[10px] flex items-center justify-center shrink-0 shadow-2xs">
                                                                    {row.orderIndex}
                                                                </span>
                                                                <span
                                                                    className="font-black text-slate-900 leading-tight truncate max-w-[210px]"
                                                                    title={row.storeName}
                                                                >
                                                                    {compactName}
                                                                </span>
                                                            </div>
                                                        </td>

                                                        {/* 2. % VƯỢT TRỘI */}
                                                        <td className="py-2.5 px-2 text-center font-black border-r border-slate-100">
                                                            <span className="inline-block text-[10.5px] font-black text-amber-900 bg-amber-100/80 px-1.5 py-0.5 rounded border border-amber-300">
                                                                {row.targetRate}%
                                                            </span>
                                                        </td>

                                                        {/* 3. LŨY KẾ DTQĐ */}
                                                        <td className="py-2.5 px-2 text-center font-black text-blue-700 border-r border-slate-100">
                                                            {formatNumberVal(row.revenueQd)}
                                                        </td>

                                                        {/* 4. TARGET VƯỢT TRỘI */}
                                                        <td
                                                            className="py-2.5 px-2 text-center font-black border-r border-slate-100 text-slate-900"
                                                            title={`Target gốc: ${formatNumberVal(row.baseTarget)} • Nhịp: ${row.targetRate}%`}
                                                        >
                                                            {formatNumberVal(row.targetOver)}
                                                        </td>

                                                        {/* 5. %HT (theo Target vượt trội) */}
                                                        <td className={`py-2.5 px-1.5 text-center font-black border-r border-slate-100 ${row.pctHtOver >= 100
                                                            ? 'text-emerald-600'
                                                            : row.pctHtOver >= 85
                                                                ? 'text-amber-600'
                                                                : 'text-rose-600'
                                                            }`}>
                                                            {row.pctHtOver.toFixed(1)}%
                                                        </td>

                                                        {/* 6. TARGET CÒN LẠI */}
                                                        <td className="py-2.5 px-2 text-center font-black border-r border-slate-100 text-slate-700">
                                                            {formatNumberVal(row.targetRemainingOver)}
                                                        </td>

                                                        {/* 7. DTQĐ DỰ KIẾN */}
                                                        <td className="py-2.5 px-2 text-center font-black text-indigo-700 border-r border-slate-100">
                                                            {formatNumberVal(row.forecastRevenueQd)}
                                                        </td>

                                                        {/* 8. %DKHT (theo Target vượt trội) */}
                                                        <td className={`py-2.5 px-1.5 text-center font-black border-r border-slate-100 ${row.pctDkhtOver >= 100
                                                            ? 'text-emerald-600'
                                                            : row.pctDkhtOver >= 90
                                                                ? 'text-amber-600'
                                                                : 'text-rose-600'
                                                            }`}>
                                                            {row.pctDkhtOver.toFixed(1)}%
                                                        </td>

                                                        {/* 9. TARGET MỖI NGÀY CÒN LẠI (Hiển thị tr/ngày làm tròn) */}
                                                        <td
                                                            className="py-2.5 px-2 text-center font-black text-purple-900 bg-purple-50/30"
                                                            title={`Còn ${row.remainingDays} ngày trong tháng • Target còn lại: ${Math.round(row.targetRemainingOver > 100 ? row.targetRemainingOver : row.targetRemainingOver * 1000).toLocaleString('vi-VN')} tr`}
                                                        >
                                                            {Math.round(row.targetDailyRemainingOver).toLocaleString('vi-VN')}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>

                                    {/* DÒNG TỔNG CỤM BẢNG 2 - EXECUTIVE DARK STYLE */}
                                    {clusterRows.length > 0 && (
                                        <tfoot>
                                            <tr className="bg-slate-900 text-white font-black text-xs border-t-2 border-slate-700">
                                                {/* Cột Tên */}
                                                <td className="py-3 px-2.5 text-center uppercase tracking-wider border-r border-slate-800 text-slate-200">
                                                    TỔNG CỤM
                                                </td>

                                                {/* % Vượt trội TB */}
                                                <td className="py-3 px-2 text-center font-black border-r border-slate-800 text-amber-300">
                                                    {clusterSummary.avgTargetRate.toFixed(1)}%
                                                </td>

                                                {/* Lũy kế DTQĐ */}
                                                <td className="py-3 px-2 text-center font-black text-blue-300 border-r border-slate-800">
                                                    {formatNumberVal(clusterSummary.totalRevenueQd)}
                                                </td>

                                                {/* Target vượt trội */}
                                                <td className="py-3 px-2 text-center font-black border-r border-slate-800 text-amber-200">
                                                    {formatNumberVal(clusterSummary.totalTargetOver)}
                                                </td>

                                                {/* %HT */}
                                                <td className="py-3 px-1.5 text-center font-black text-emerald-400 border-r border-slate-800">
                                                    {clusterSummary.avgPctHtOver.toFixed(1)}%
                                                </td>

                                                {/* Target còn lại */}
                                                <td className="py-3 px-2 text-center font-black border-r border-slate-800 text-slate-300">
                                                    {formatNumberVal(clusterSummary.totalTargetRemainingOver)}
                                                </td>

                                                {/* DTQĐ dự kiến */}
                                                <td className="py-3 px-2 text-center font-black text-indigo-300 border-r border-slate-800">
                                                    {formatNumberVal(clusterSummary.totalForecastRevenueQd)}
                                                </td>

                                                {/* %DKHT */}
                                                <td className="py-3 px-1.5 text-center font-black text-emerald-400 border-r border-slate-800">
                                                    {clusterSummary.avgPctDkhtOver.toFixed(1)}%
                                                </td>

                                                {/* Target mỗi ngày còn lại (triệu/ngày) */}
                                                <td className="py-3 px-2 text-center font-black text-purple-300 bg-purple-950/40">
                                                    {Math.round(clusterSummary.totalTargetDailyRemainingOver).toLocaleString('vi-VN')}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </div>
                    )}

                    {/* KHỐI NHẬN XÉT & HƯỚNG DẪN CỤM (MẶC ĐỊNH ẨN, USER TÙY CHỌN HIỂN THỊ TRÊN BÁO CÁO) */}
                    {showAssessment && assessmentData && assessmentData.comment && (
                        <div className="bg-gradient-to-r from-blue-50/70 to-indigo-50/50 p-4 rounded-2xl border border-blue-200/90 space-y-1.5 shadow-2xs">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs font-black text-blue-900 uppercase tracking-wider">
                                    <MessageSquare className="w-4 h-4 text-blue-600" />
                                    <span>Nhận Xét & Hướng Dẫn Cụm</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowAssessment(false)}
                                    className="text-[11px] font-bold text-slate-400 hover:text-slate-700 flex items-center gap-1 cursor-pointer transition"
                                    title="Ẩn nhận xét này khỏi báo cáo"
                                >
                                    <EyeOff className="w-3.5 h-3.5" />
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
                        <MessageSquare className="w-4 h-4 text-blue-600 shrink-0" />
                        <span className="font-medium">
                            Đã có nội dung nhận xét & hướng dẫn cụm (đang ẩn theo mặc định).
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowAssessment(true)}
                        className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-slate-800 font-bold text-[11px] flex items-center gap-1.5 cursor-pointer shadow-2xs self-start sm:self-auto"
                    >
                        <Eye className="w-3.5 h-3.5 text-blue-600" />
                        <span>Hiển thị vào báo cáo</span>
                    </button>
                </div>
            )}

            {/* MODAL CẤU HÌNH TARGET */}
            <ClusterTargetConfigModal
                isOpen={isTargetModalOpen}
                onClose={() => setIsTargetModalOpen(false)}
                rows={clusterRows}
                month={selectedMonth}
                year={selectedYear}
                currentConfigs={targetConfigs}
                initialGlobalPace={globalPaceRate}
                onSaved={loadAllData}
            />

            {/* MODAL NHẬN XÉT CỤM */}
            <ClusterAssessmentModal
                isOpen={isAssessmentModalOpen}
                onClose={() => setIsAssessmentModalOpen(false)}
                summary={clusterSummary}
                rows={clusterRows}
                month={selectedMonth}
                year={selectedYear}
                initialData={assessmentData}
                showAssessment={showAssessment}
                onToggleShowAssessment={setShowAssessment}
                onSaved={loadAllData}
            />
        </div>
    );
}
