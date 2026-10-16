import React, { useState, useEffect, useMemo, useRef } from 'react';
import html2canvas from 'html2canvas';
import { calculate8KScale } from '../../shared/utils/exportImage';
import {
    formatValue,
    getShortStoreName,
    getCampaignLabel,
    formatDate
} from '../../core/lib/formatters';
import {
    fetchCampaignDictionary,
    type CampaignDictItem
} from '../../core/lib/storage';
import {
    Zap,
    Play,
    Camera,
    Copy,
    FileText
} from 'lucide-react';
import ReportActionButtons from '../../shared/components/report/ReportActionButtons';
import type { AssessmentTemplate } from '../../shared/components/report/ReportAssessmentModal';

interface CampaignItem {
    label: string;
    store: string;
    shortName: string;
    target: number;
    actual: number;
    pctHT: number;
    pctDK: number;
}

interface RevenueItem {
    store: string;
    shortName: string;
    sl: number;
    rev: number;
    rawRev: number;
    target: number;
    pct: number;
    pctTraGop: number;
    dtTraGop: number;
    isNewFormat: boolean;
}

export default function DailyReportPage() {
    const exportRef = useRef<HTMLDivElement | null>(null);

    // Input states
    const [emulationText, setEmulationText] = useState<string>('');
    const [revenueText, setRevenueText] = useState<string>('');
    const [realRevenueText, setRealRevenueText] = useState<string>('');

    // Processed data states
    const [allData, setAllData] = useState<CampaignItem[]>([]);
    const [revenueData, setRevenueData] = useState<Record<string, RevenueItem>>({});
    const [revenueStores, setRevenueStores] = useState<RevenueItem[]>([]);
    const [selectedStore, setSelectedStore] = useState<string>('Tổng');
    const [summaryMode, setSummaryMode] = useState<number>(1);
    const [isPointsEnabled, setIsPointsEnabled] = useState<boolean>(false);

    // Danh mục từ điển thi đua động từ Supabase
    const [campaignsDict, setCampaignsDict] = useState<CampaignDictItem[]>([]);

    // UI status
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 2500);
    };

    // Nạp danh mục từ điển thi đua khi tải trang
    useEffect(() => {
        fetchCampaignDictionary().then(res => {
            if (res.success && res.data) {
                setCampaignsDict(res.data);
            }
        });
    }, []);

    // =========================================================
    // 1. BỘ PHÂN TÍCH DỮ LIỆU THI ĐUA (CHỈ LẤY MỤC TARGET > 0)
    // =========================================================
    const parseEmulationData = (raw: string): CampaignItem[] => {
        if (!raw.trim()) return [];
        const lines = raw.split('\n');
        const result: CampaignItem[] = [];
        let curHeader = '';

        lines.forEach(l => {
            const trimmedLine = l.trim();
            if (!trimmedLine) return;

            const p = trimmedLine.split(/\t|\s{2,}/).map(x => x.trim()).filter(Boolean);
            const lowerLine = trimmedLine.toLowerCase();
            const firstCol = p[0] || '';
            const firstColUpper = firstCol.toUpperCase();

            const isHeader = (
                (lowerLine.includes('target') ||
                    lowerLine.includes('(rt)') ||
                    lowerLine.includes('realtime') ||
                    lowerLine.includes('lũy kế') ||
                    lowerLine.includes('% ht') ||
                    lowerLine.includes('doanh thu') ||
                    lowerLine.includes('số lượng') ||
                    lowerLine.includes('hạng vùng')) &&
                !firstColUpper.startsWith('TỔNG') &&
                !firstColUpper.startsWith('TONG') &&
                !/^(aar|tgd|đmx|dmx|\d+)/i.test(firstCol)
            );

            if (isHeader) {
                curHeader = firstCol.trim();
                return;
            }

            const isDataRow = (
                firstColUpper.startsWith('TỔNG') ||
                firstColUpper.startsWith('TONG') ||
                /^(aar_|tgd_|đmx_|dmx_)/i.test(firstCol) ||
                /^\d+\s*-\s*(aar|tgd|đmx|dmx)/i.test(firstCol) ||
                firstColUpper.includes('TGD_') ||
                firstColUpper.includes('AAR_') ||
                firstColUpper.includes('ĐMX_') ||
                firstColUpper.includes('DMX_')
            );

            if (isDataRow && curHeader && p.length >= 3) {
                // Ánh xạ tên viết tắt qua từ điển
                const label = getCampaignLabel(curHeader, campaignsDict);
                const isTongRow = firstColUpper.startsWith('TỔNG') || firstColUpper.startsWith('TONG');
                const storeName = isTongRow ? 'Tổng' : firstCol;
                const shortName = isTongRow ? 'Tổng' : getShortStoreName(storeName);

                const actual = parseFloat(String(p[1] || '0').replace(/,/g, '')) || 0;
                const target = parseFloat(String(p[2] || '0').replace(/,/g, '')) || 0;

                // ĐIỀU KIỆN TIÊN QUYẾT: CHỈ LẤY THI ĐUA CÓ TARGET > 0
                if (target > 0) {
                    const pctColRaw = String(p[3] || '').trim();
                    const pctColVal = parseFloat(pctColRaw.replace(/%/g, '').replace(/,/g, ''));
                    const pctHT = (!isNaN(pctColVal) && pctColRaw.includes('%'))
                        ? pctColVal
                        : (actual / target * 100);

                    result.push({
                        label,
                        store: storeName,
                        shortName,
                        target,
                        actual,
                        pctHT,
                        pctDK: pctHT
                    });
                }
            }
        });

        return result;
    };

    // =========================================================
    // 2. BỘ PHÂN TÍCH DỮ LIỆU DOANH THU REALTIME (QD + THỰC)
    // Quy chuẩn: CHỈ lấy duy nhất "DT Trả góp" từ bảng Doanh thu thực
    // =========================================================
    const parseRevenueData = (raw: string, rawReal?: string) => {
        const revMap: Record<string, RevenueItem> = {};
        const revList: RevenueItem[] = [];
        if (!raw.trim() && !(rawReal && rawReal.trim())) return { revMap, revList };

        let qdText = raw;
        let realText = rawReal || '';

        const SPLIT_TOKEN = '=== BẢNG DOANH THU THỰC ===';
        if (!realText && qdText.includes(SPLIT_TOKEN)) {
            const parts = qdText.split(SPLIT_TOKEN);
            qdText = parts[0];
            realText = parts[1] || '';
        }

        // 1. Phân tích bảng Doanh thu thực (nếu có) để lấy DT Thực và DT Trả góp chuẩn
        const realMap: Record<string, { revReal: number; dtTraGop: number; pctTraGop: number }> = {};
        if (realText.trim()) {
            const realLines = realText.split('\n');
            let pendingRealStore: string | null = null;

            const recordReal = (storeName: string, parts: string[]) => {
                const isTong = /^(tổng|tong)/i.test(storeName);
                const sName = isTong ? 'Tổng' : getShortStoreName(storeName);
                const revReal = parseFloat(String(parts[1] || '0').replace(/,/g, '')) || 0;
                // parts[8] ở bảng DT thực là DT Trả Góp thực tế
                const dtTraGop = parts.length > 8 ? parseFloat(String(parts[8] || '0').replace(/,/g, '')) || 0 : 0;
                const pctTraGop = revReal > 0 ? Number(((dtTraGop / revReal) * 100).toFixed(1)) : 0;
                realMap[sName] = { revReal, dtTraGop, pctTraGop };
            };

            for (let i = 0; i < realLines.length; i++) {
                const trimmed = realLines[i].trim();
                if (!trimmed || trimmed.startsWith('Đơn vị') || trimmed.startsWith('Tỉ trọng tính')) continue;

                const parts = trimmed.split(/\t|\s{2,}/).map(x => x.trim()).filter(Boolean);
                const firstCol = parts[0] || '';
                const isStoreNameCol = /^(tổng|\d+\s*-|aar_|tgd_|đmx_|dmx_)/i.test(firstCol);

                if (isStoreNameCol && parts.length >= 6) {
                    recordReal(firstCol, parts.slice(1));
                    pendingRealStore = null;
                    continue;
                }
                if (/^(tổng|\d+\s*-\s*(aar|tgd|đmx|dmx)|aar_|tgd_|đmx_|dmx_)/i.test(trimmed) && parts.length <= 2) {
                    pendingRealStore = trimmed;
                    continue;
                }
                if (pendingRealStore && parts.length >= 6) {
                    recordReal(pendingRealStore, parts);
                    pendingRealStore = null;
                    continue;
                }
            }
        }

        // 2. Phân tích bảng Doanh thu quy đổi (hoặc bảng đơn)
        const lines = qdText.split('\n');
        let pendingStore: string | null = null;

        const recordRevenue = (storeName: string, parts: string[]) => {
            const isTong = /^(tổng|tong)/i.test(storeName);
            const sName = isTong ? 'Tổng' : getShortStoreName(storeName);

            // Kiểm tra cấu trúc mới: parts[4] chứa '%' (tức % HT Target) hoặc cột 2 là % Tỉ trọng
            const isNewFormat = parts.length >= 8 && (
                String(parts[4] || '').includes('%') ||
                String(parts[2] || '').includes('%')
            );

            let sl = 0;
            let revQd = 0;
            let rawRev = 0;
            let target = 0;
            let pct = 0;
            let dtTraGop = 0;
            let pctTraGop = 0;

            if (isNewFormat) {
                // Cấu trúc mới BI:
                // parts[0]: Số lượng | parts[1]: DTQĐ | parts[2]: % Tỉ trọng | parts[3]: Target | parts[4]: % HT Target
                // parts[7]: DT Trả thẳng QĐ | parts[8]: DT Trả góp QĐ (KHÔNG LẤY!)
                sl = parseFloat(String(parts[0] || '0').replace(/,/g, '')) || 0;
                revQd = parseFloat(String(parts[1] || '0').replace(/,/g, '')) || 0;
                target = parseFloat(String(parts[3] || '0').replace(/,/g, '')) || 0;
                pct = parseFloat(String(parts[4] || '0').replace(/%/g, '').replace(/,/g, '')) || 0;

                // CHỈ lấy DT Trả góp từ bảng Doanh thu thực
                const realInfo = realMap[sName];
                if (realInfo) {
                    rawRev = realInfo.revReal;
                    dtTraGop = realInfo.dtTraGop;
                    pctTraGop = realInfo.pctTraGop;
                } else {
                    rawRev = revQd;
                    dtTraGop = 0;
                    pctTraGop = 0;
                }
            } else {
                // Cấu trúc cũ (10 cột gộp):
                sl = parseFloat(String(parts[0] || '0').replace(/,/g, '')) || 0;
                revQd = parseFloat(String(parts[1] || '0').replace(/,/g, '')) || 0;
                rawRev = parseFloat(String(parts[3] || '0').replace(/,/g, '')) || revQd;
                target = parseFloat(String(parts[4] || '0').replace(/,/g, '')) || 0;
                pct = parseFloat(String(parts[5] || '0').replace(/%/g, '').replace(/,/g, '')) || 0;
                dtTraGop = parseFloat(String(parts[8] || '0').replace(/,/g, '')) || 0;
                pctTraGop = parseFloat(String(parts[9] || '0').replace(/%/g, '').replace(/,/g, '')) || 0;
            }

            const item: RevenueItem = {
                store: storeName,
                shortName: sName,
                sl,
                rev: revQd,
                rawRev,
                target,
                pct,
                pctTraGop,
                dtTraGop,
                isNewFormat: true
            };

            revMap[sName] = item;
            if (sName !== 'Tổng') {
                const existingIdx = revList.findIndex(x => x.shortName === sName);
                if (existingIdx >= 0) revList[existingIdx] = item;
                else revList.push(item);
            }
        };

        for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trim();
            if (!trimmed) continue;
            if (trimmed.startsWith('Đơn vị') || trimmed.startsWith('Tỉ trọng tính') || trimmed.includes('Target trọn kỳ')) continue;

            const parts = trimmed.split(/\t|\s{2,}/).map(x => x.trim()).filter(Boolean);
            const firstCol = parts[0] || '';
            const isStoreNameCol = /^(tổng|\d+\s*-|aar_|tgd_|đmx_|dmx_)/i.test(firstCol);

            if (isStoreNameCol && parts.length >= 6) {
                recordRevenue(firstCol, parts.slice(1));
                pendingStore = null;
                continue;
            }

            if (/^(tổng|\d+\s*-\s*(aar|tgd|đmx|dmx)|aar_|tgd_|đmx_|dmx_)/i.test(trimmed) && parts.length <= 2) {
                pendingStore = trimmed;
                continue;
            }

            if (pendingStore && parts.length >= 6) {
                recordRevenue(pendingStore, parts);
                pendingStore = null;
                continue;
            }
        }

        return { revMap, revList };
    };

    // 3. THAO TÁC XỬ LÝ (NÚT XỬ LÝ)
    const handleProcessData = () => {
        const emuParsed = parseEmulationData(emulationText);
        const { revMap, revList } = parseRevenueData(revenueText, realRevenueText);

        if (emuParsed.length === 0 && Object.keys(revMap).length === 0) {
            showToast('⚠️ Vui lòng dán dữ liệu Thi đua hoặc Doanh thu!');
            return;
        }

        setAllData(emuParsed);
        setRevenueData(revMap);
        setRevenueStores(revList);
        setSelectedStore('Tổng');
        showToast(`Đã nạp ${emuParsed.length} mục thi đua có target & ${revList.length} siêu thị!`);
    };

    // Kiểm tra xem phiên dữ liệu có thông tin trả góp hợp lệ (từ bảng Doanh thu thực) hay không
    const hasInstallmentData = useMemo(() => {
        if (realRevenueText.trim()) return true;
        return Object.values(revenueData).some(r => (r.dtTraGop || 0) > 0 || (r.pctTraGop || 0) > 0);
    }, [realRevenueText, revenueData]);

    // Danh sách siêu thị có trong dữ liệu
    const storeOptions = useMemo(() => {
        const set = new Set<string>();
        allData.forEach(d => {
            if (d.shortName && d.shortName !== 'Tổng') set.add(d.shortName);
        });
        revenueStores.forEach(s => {
            if (s.shortName && s.shortName !== 'Tổng') set.add(s.shortName);
        });
        return Array.from(set).sort();
    }, [allData, revenueStores]);

    // LỌC CHỈ TIÊU THI ĐUA THEO SHOP (ĐẢM BẢO CHỈ LẤY TARGET > 0)
    const filteredCampaigns = useMemo(() => {
        return allData.filter(d => {
            const match = (selectedStore === 'Tổng' && (d.store.toUpperCase().startsWith('TỔNG') || d.shortName === 'Tổng')) ||
                d.shortName === selectedStore;
            return match && d.target > 0;
        }).sort((a, b) => b.pctHT - a.pctHT);
    }, [allData, selectedStore]);

    // Doanh thu shop được chọn
    const currentRevenue = useMemo(() => {
        if (revenueData[selectedStore]) return revenueData[selectedStore];
        return null;
    }, [revenueData, selectedStore]);

    // Thống kê tỉ lệ đạt
    const stats = useMemo(() => {
        const total = filteredCampaigns.length;
        const passed = filteredCampaigns.filter(c => c.pctHT >= 100);
        const failed = filteredCampaigns.filter(c => c.pctHT < 100);
        const passRate = total > 0 ? (passed.length / total * 100).toFixed(1) : '0';

        return {
            total,
            passed: passed.length,
            failed: failed.length,
            passRate,
            fails: failed
        };
    }, [filteredCampaigns]);

    // 4. TẠO VĂN BẢN TÓM TẮT GỬI Messaging App
    const summaryText = useMemo(() => {
        if (allData.length === 0 && !currentRevenue) return '';

        const dispStore = selectedStore === 'Tổng' ? 'TỔNG TOÀN CỤM' : selectedStore;
        let txt = `📢 REALTIME [${dispStore}]`;

        if (currentRevenue) {
            txt += `\n\n💰 DOANH THU QĐ: ${formatValue(currentRevenue.rev)} triệu`;
            if (hasInstallmentData && (currentRevenue.dtTraGop > 0 || currentRevenue.pctTraGop > 0)) {
                txt += `\n- DT trả góp: ${formatValue(currentRevenue.dtTraGop)} triệu (${(currentRevenue.pctTraGop || 0).toFixed(1)}%)`;
            }
        }

        if (filteredCampaigns.length > 0) {
            txt += `\n\n🎯 THI ĐUA: Đạt ${stats.passed}/${stats.total} NH (${stats.passRate}%)`;

            if (stats.fails.length === 0) {
                txt += `\n\n🎉 Xuất sắc! Đã hoàn thành tất cả các chỉ tiêu!`;
            } else {
                const groupNear = stats.fails.filter(d => d.pctHT >= 80);
                const groupSpeed = stats.fails.filter(d => d.pctHT >= 50 && d.pctHT < 80);
                const groupAlert = stats.fails.filter(d => d.pctHT < 50);

                if (summaryMode === 1) {
                    txt += `\n\n📊 TỔNG HỢP CHƯA ĐẠT (${stats.fails.length} NH):`;
                    if (groupNear.length > 0) txt += `\n- ⚡ CẬN ĐÍCH (>80%): ${groupNear.length} NH`;
                    if (groupSpeed.length > 0) txt += `\n- 🔥 CẦN TĂNG TỐC (50% - 80%): ${groupSpeed.length} NH`;
                    if (groupAlert.length > 0) txt += `\n- ⚠️ NGUY HIỂM (<50%): ${groupAlert.length} NH`;
                } else if (summaryMode === 2) {
                    txt += `\n\n📊 CHI TIẾT CHƯA ĐẠT (${stats.fails.length} NH):`;
                    if (groupNear.length > 0) {
                        txt += `\n\n⚡ CẬN ĐÍCH (>80%): ${groupNear.length} NH`;
                        groupNear.forEach(d => {
                            txt += `\n- ${d.label}: thiếu ${formatValue(Math.max(0, d.target - d.actual))} (${d.pctHT.toFixed(1)}%)`;
                        });
                    }
                    if (groupSpeed.length > 0) {
                        txt += `\n\n🔥 CẦN TĂNG TỐC (50% - 80%): ${groupSpeed.length} NH`;
                        groupSpeed.forEach(d => {
                            txt += `\n- ${d.label}: thiếu ${formatValue(Math.max(0, d.target - d.actual))} (${d.pctHT.toFixed(1)}%)`;
                        });
                    }
                    if (groupAlert.length > 0) {
                        txt += `\n\n⚠️ NGUY HIỂM (<50%): ${groupAlert.length} NH`;
                        groupAlert.forEach(d => {
                            txt += `\n- ${d.label}: thiếu ${formatValue(Math.max(0, d.target - d.actual))} (${d.pctHT.toFixed(1)}%)`;
                        });
                    }
                } else {
                    txt += `\n\n⚠️ CHI TIẾT CHƯA ĐẠT (${stats.fails.length} NH):`;
                    stats.fails.forEach(d => {
                        txt += `\n- ${d.label}: thiếu ${formatValue(Math.max(0, d.target - d.actual))} (${d.pctHT.toFixed(1)}%)`;
                    });
                }
            }
        }

        return txt;
    }, [allData, currentRevenue, filteredCampaigns, stats, selectedStore, summaryMode, hasInstallmentData]);

    // CẤU HÌNH 3 MẪU NHẬN XÉT TẠO SẴN CHO BÁO CÁO NGÀY
    const dailyAssessmentTemplates = useMemo<AssessmentTemplate[]>(() => {
        if (!allData) return [];

        const generateText = (mode: number) => {
            const isAll = selectedStore === "all" || selectedStore === "Tổng";
            const dispStore = isAll ? 'TỔNG CỤM' : selectedStore;
            let txt = `📢 [${dispStore}]\n- CẬP NHẬT REALTIME: ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;

            if (currentRevenue) {
                const revVal = currentRevenue.rev || currentRevenue.rawRev || 0;
                const pctVal = typeof currentRevenue.pct === 'number'
                    ? currentRevenue.pct
                    : (currentRevenue.target > 0 ? (revVal / currentRevenue.target) * 100 : 0);
                txt += `\n\n💰 DOANH THU QĐ: ${formatValue(revVal)} triệu`;
                if (currentRevenue.target > 0) {
                    txt += ` (Đạt ${pctVal.toFixed(1)}% target)`;
                    if (revVal < currentRevenue.target) {
                        txt += `\n- Còn thiếu: ${formatValue(currentRevenue.target - revVal)} triệu`;
                    }
                }
                if (hasInstallmentData && (currentRevenue.dtTraGop > 0 || currentRevenue.pctTraGop > 0)) {
                    txt += `\n- DT trả góp: ${formatValue(currentRevenue.dtTraGop)} triệu (${(currentRevenue.pctTraGop || 0).toFixed(1)}%)`;
                }
            }

            if (filteredCampaigns.length > 0) {
                txt += `\n\n🎯 THI ĐUA: Đạt ${stats.passed}/${stats.total} NH (${stats.passRate}%)`;

                if (stats.fails.length === 0) {
                    txt += `\n\n🎉 Toàn bộ các chỉ tiêu thi đua đều đạt!`;
                } else {
                    const groupNear = stats.fails.filter(d => (d.pctHT ?? 0) >= 80);
                    const groupSpeed = stats.fails.filter(d => (d.pctHT ?? 0) >= 50 && (d.pctHT ?? 0) < 80);
                    const groupAlert = stats.fails.filter(d => (d.pctHT ?? 0) < 50);

                    if (mode === 1) {
                        txt += `\n\n📊 TỔNG HỢP CHƯA ĐẠT (${stats.fails.length} NH):`;
                        if (groupNear.length > 0) txt += `\n- ⚡ CẬN ĐÍCH (>80%): ${groupNear.length} NH`;
                        if (groupSpeed.length > 0) txt += `\n- 🔥 CẦN TĂNG TỐC (50% - 80%): ${groupSpeed.length} NH`;
                        if (groupAlert.length > 0) txt += `\n- ⚠️ NGUY HIỂM (<50%): ${groupAlert.length} NH`;
                    } else if (mode === 2) {
                        txt += `\n\n📊 CHI TIẾT CHƯA ĐẠT (${stats.fails.length} NH):`;
                        if (groupNear.length > 0) {
                            txt += `\n\n⚡ CẬN ĐÍCH (>80%): ${groupNear.length} NH`;
                            groupNear.forEach(d => {
                                const rate = typeof d.pctHT === 'number' ? d.pctHT.toFixed(1) : '0';
                                txt += `\n- ${d.label}: thiếu ${formatValue(Math.max(0, d.target - d.actual))} (${rate}%)`;
                            });
                        }
                        if (groupSpeed.length > 0) {
                            txt += `\n\n🔥 CẦN TĂNG TỐC (50% - 80%): ${groupSpeed.length} NH`;
                            groupSpeed.forEach(d => {
                                const rate = typeof d.pctHT === 'number' ? d.pctHT.toFixed(1) : '0';
                                txt += `\n- ${d.label}: thiếu ${formatValue(Math.max(0, d.target - d.actual))} (${rate}%)`;
                            });
                        }
                        if (groupAlert.length > 0) {
                            txt += `\n\n⚠️ NGUY HIỂM (<50%): ${groupAlert.length} NH`;
                            groupAlert.forEach(d => {
                                const rate = typeof d.pctHT === 'number' ? d.pctHT.toFixed(1) : '0';
                                txt += `\n- ${d.label}: thiếu ${formatValue(Math.max(0, d.target - d.actual))} (${rate}%)`;
                            });
                        }
                    } else {
                        txt += `\n\n⚠️ CHI TIẾT CHƯA ĐẠT (${stats.fails.length} NH):`;
                        stats.fails.forEach(d => {
                            const rate = typeof d.pctHT === 'number' ? d.pctHT.toFixed(1) : '0';
                            txt += `\n- ${d.label}: thiếu ${formatValue(Math.max(0, d.target - d.actual))} (${rate}%)`;
                        });
                    }
                }
            }

            return txt;
        };

        return [
            { id: 1, title: 'Mẫu 1: Tổng quát', badge: 'Súc tích', content: generateText(1), description: 'Tóm tắt doanh thu realtime và phân loại các nhóm chỉ tiêu' },
            { id: 2, title: 'Mẫu 2: Chi tiết 3 nhóm', badge: 'Phân loại', content: generateText(2), description: 'Phân tích chi tiết ngành hàng cận đích, tăng tốc và nguy hiểm' },
            { id: 3, title: 'Mẫu 3: Chi tiết toàn bộ', badge: 'Hành động', content: generateText(3), description: 'Toàn bộ danh sách ngành hàng cần bổ sung số liệu trong ngày' }
        ];
    }, [allData, currentRevenue, filteredCampaigns, stats, selectedStore, hasInstallmentData]);

    const handleCopyText = () => {
        if (!summaryText) return;
        navigator.clipboard.writeText(summaryText);
        showToast('Đã copy văn bản tóm tắt Messaging App!');
    };

    const handleCaptureImage = async (mode: 'save' | 'copy') => {
        if (!exportRef.current) return;
        try {
            if (document.fonts?.ready) {
                await document.fonts.ready;
            }
            const scale = calculate8KScale(exportRef.current);
            const canvas = await html2canvas(exportRef.current, {
                scale: scale,
                backgroundColor: '#ffffff',
                useCORS: true
            });

            if (mode === 'save') {
                const link = document.createElement('a');
                link.href = canvas.toDataURL('image/png');
                link.download = `BaoCao_Realtime_${selectedStore.replace(/\s+/g, '_')}_8K.png`;
                link.click();
                showToast('Đã lưu file ảnh 8K báo cáo!');
            } else {
                canvas.toBlob(blob => {
                    if (blob && navigator.clipboard && window.ClipboardItem) {
                        navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
                            .then(() => showToast('Đã copy ảnh 8K vào clipboard!'))
                            .catch(() => showToast('Trình duyệt chặn copy ảnh, hãy dùng TẢI ẢNH!'));
                    } else {
                        showToast('Hãy dùng nút TẢI ẢNH trên trình duyệt này!');
                    }
                });
            }
        } catch (err) {
            showToast('Lỗi khi chụp bảng báo cáo!');
        }
    };

    return (
        <div className="p-3 sm:p-6 max-w-5xl mx-auto space-y-4">
            {/* Toast popup */}
            {toastMessage && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold shadow-2xl z-50 animate-bounce">
                    {toastMessage}
                </div>
            )}

            {/* HEADER CÔNG CỤ */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                        <Zap className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                        <h1 className="text-xl font-extrabold text-blue-600 tracking-tight">
                            Báo Cáo Doanh thu & Thi đua Realtime
                        </h1>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Dán chuỗi số liệu từ trang nội bộ để tự động bóc tách chỉ số và tạo báo cáo
                        </p>
                    </div>
                </div>
            </div>

            {/* KHU VỰC DÁN DỮ LIỆU INPUT */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-1.5">
                    <label className="text-xs font-bold text-blue-700 uppercase flex items-center justify-between">
                        <span>🔗 1. Thi đua Realtime</span>
                        <span className="text-[10px] text-blue-600 font-semibold lowercase bg-blue-50 px-1.5 py-0.5 rounded">bắt buộc</span>
                    </label>
                    <textarea
                        rows={3}
                        value={emulationText}
                        onChange={(e) => setEmulationText(e.target.value)}
                        placeholder="Dán dữ liệu Thi đua Realtime..."
                        className="w-full text-xs font-mono p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none"
                    />
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-1.5">
                    <label className="text-xs font-bold text-emerald-700 uppercase flex items-center justify-between">
                        <span>🔗 2. DT Quy Đổi (DTQĐ)</span>
                        <span className="text-[10px] text-emerald-600 font-semibold lowercase bg-emerald-50 px-1.5 py-0.5 rounded">bắt buộc</span>
                    </label>
                    <textarea
                        rows={3}
                        value={revenueText}
                        onChange={(e) => setRevenueText(e.target.value)}
                        placeholder="Dán dữ liệu Doanh thu quy đổi (DTQĐ)..."
                        className="w-full text-xs font-mono p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white resize-none"
                    />
                </div>

                <div className="bg-white p-3.5 rounded-2xl border border-purple-200 shadow-xs space-y-1.5">
                    <label className="text-xs font-bold text-purple-700 uppercase flex items-center justify-between">
                        <span>🔗 3. Doanh Thu Thực</span>
                        <span className="text-[10px] text-purple-600 font-semibold lowercase bg-purple-50 px-1.5 py-0.5 rounded">khuyến nghị</span>
                    </label>
                    <textarea
                        rows={3}
                        value={realRevenueText}
                        onChange={(e) => setRealRevenueText(e.target.value)}
                        placeholder="Dán bảng Doanh thu thực để bóc tách DT Trả góp chuẩn..."
                        className="w-full text-xs font-mono p-2.5 bg-purple-50/30 border border-purple-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white resize-none"
                    />
                </div>
            </div>

            {/* KHỐI NÚT ĐIỀU KHIỂN & BỘ LỌC */}
            <div className="bg-slate-50/90 border border-slate-200/80 rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                        onClick={handleProcessData}
                        className="py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer active:scale-95"
                    >
                        <Play className="w-4 h-4 fill-white" />
                        <span>XỬ LÝ SỐ LIỆU</span>
                    </button>

                    <ReportActionButtons
                        onExportImage={() => handleCaptureImage('save')}
                        onCopyImage={() => handleCaptureImage('copy')}
                        exportButtonLabel="LƯU ẢNH"
                        copyImageButtonLabel="COPY ẢNH"
                        hasAssessment={true}
                        assessmentTemplates={dailyAssessmentTemplates}
                        onCopyText={handleCopyText}
                        reportTitle={`Báo Cáo Doanh Thu Realtime - ${selectedStore}`}
                    />
                </div>

                {/* Lọc Siêu Thị */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-200/70">
                    <div className="w-full sm:w-1/2">
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                            Chọn Cửa Hàng / Toàn Cụm
                        </label>
                        <select
                            value={selectedStore}
                            onChange={(e) => setSelectedStore(e.target.value)}
                            className="w-full bg-white border border-slate-300 text-slate-800 py-2 px-3 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        >
                            <option value="Tổng">Tổng CỤM</option>
                            {storeOptions.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center text-xs">
                        <label className="inline-flex items-center gap-2 cursor-pointer select-none text-slate-700 font-medium">
                            <input
                                type="checkbox"
                                checked={isPointsEnabled}
                                onChange={(e) => setIsPointsEnabled(e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                            />
                            <span>Hiện cột điểm thi đua</span>
                        </label>
                    </div>
                </div>
            </div>

            {/* KHU VỰC HIỂN THỊ BÁO CÁO (VIEW & CHỤP ẢNH) */}
            <div ref={exportRef} data-report-table="true" className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-sm space-y-4 font-avo">
                {/* Tiêu đề Báo Cáo */}
                <div className="text-center pb-3 border-b-2 border-blue-600">
                    <h2 className="text-lg sm:text-xl font-black text-blue-600 uppercase tracking-wide">
                        {selectedStore === 'Tổng' ? 'TỔNG TOÀN CỤM' : selectedStore}
                    </h2>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                        ⚡ BÁO CÁO DOANH THU & THI ĐUA REALTIME • NGÀY {formatDate(new Date())}
                    </p>
                </div>

                {/* CÁC THẺ KPI TỔNG HỢP */}
                <div className={`grid ${hasInstallmentData ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-1 sm:grid-cols-3'} gap-2.5 text-center`}>
                    <div className="bg-amber-50/70 border-l-4 border-amber-500 rounded-xl p-2.5 shadow-xs">
                        <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">DOANH THU QĐ</span>
                        <span className="text-base sm:text-lg font-black text-slate-800 font-mono">
                            {formatValue(currentRevenue ? currentRevenue.rev : 0)}
                        </span>
                    </div>

                    {hasInstallmentData && (
                        <>
                            <div className="bg-indigo-50/70 border-l-4 border-indigo-500 rounded-xl p-2.5 shadow-xs">
                                <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">DT TRẢ GÓP</span>
                                <span className="text-base sm:text-lg font-black text-slate-800 font-mono">
                                    {formatValue(currentRevenue ? currentRevenue.dtTraGop : 0)}
                                </span>
                            </div>

                            <div className="bg-purple-50/70 border-l-4 border-purple-500 rounded-xl p-2.5 shadow-xs">
                                <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">% TRẢ GÓP</span>
                                <span className="text-base sm:text-lg font-black text-slate-800 font-mono">
                                    {currentRevenue ? (currentRevenue.pctTraGop || 0).toFixed(1) : 0}%
                                </span>
                            </div>
                        </>
                    )}

                    <div className="bg-slate-100 border-l-4 border-slate-600 rounded-xl p-2.5 shadow-xs">
                        <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">MỤC ĐẠT</span>
                        <span className="text-base sm:text-lg font-black text-slate-800 font-mono">
                            {stats.passed}/{stats.total}
                        </span>
                    </div>

                    <div className={`bg-emerald-50/70 border-l-4 border-emerald-500 rounded-xl p-2.5 shadow-xs ${hasInstallmentData ? 'col-span-2 sm:col-span-1' : ''}`}>
                        <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">%HT THI ĐUA</span>
                        <span className="text-base sm:text-lg font-black text-emerald-600 font-mono">
                            {stats.passRate}%
                        </span>
                    </div>
                </div>

                {/* BẢNG SỐ LIỆU CHI TIẾT (CHỈ CÁC MỤC TARGET > 0) */}
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-center border-collapse text-xs sm:text-sm font-avo report-table">
                        <thead>
                            <tr className="bg-blue-600 text-white font-bold tracking-wider">
                                <th className="py-2.5 px-2 w-10">#</th>
                                <th className="py-2.5 px-3 text-left">THI ĐUA</th>
                                {isPointsEnabled && <th className="py-2.5 px-2 w-12">ĐIỂM</th>}
                                <th className="py-2.5 px-2">TARGET</th>
                                <th className="py-2.5 px-2">RT</th>
                                <th className="py-2.5 px-2">%HT</th>
                                <th className="py-2.5 px-2">CÒN</th>
                                <th className="py-2.5 px-2 w-12">KQ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {filteredCampaigns.length === 0 ? (
                                <tr>
                                    <td colSpan={isPointsEnabled ? 8 : 7} className="py-8 text-center text-slate-400 font-medium italic">
                                        Chưa có mục thi đua nào có Target &gt; 0. Hãy dán dữ liệu và bấm "XỬ LÝ".
                                    </td>
                                </tr>
                            ) : (
                                filteredCampaigns.map((d, idx) => {
                                    const isPass = d.pctHT >= 100;
                                    const remain = Math.max(0, d.target - d.actual);
                                    return (
                                        <tr
                                            key={d.label + idx}
                                            className={isPass ? 'bg-[#f0fdf4] text-emerald-950' : 'bg-[#fff1f2] text-rose-950'}
                                        >
                                            <td className="py-2 px-2 text-slate-500 font-medium">{idx + 1}</td>
                                            <td className="py-2 px-3 text-left font-bold text-slate-800">{d.label}</td>
                                            {isPointsEnabled && <td className="py-2 px-2 text-slate-400">-</td>}
                                            <td className="py-2 px-2 font-mono">{formatValue(d.target)}</td>
                                            <td className="py-2 px-2 font-mono font-semibold">{formatValue(d.actual)}</td>
                                            <td className="py-2 px-2 font-mono font-bold">
                                                {d.pctHT.toFixed(1)}%
                                            </td>
                                            <td className="py-2 px-2 font-mono font-bold text-slate-700">
                                                {formatValue(remain)}
                                            </td>
                                            <td className="py-2 px-2 align-middle">
                                                {isPass ? (
                                                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-white text-[11px] font-bold">✓</span>
                                                ) : (
                                                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-500 text-white text-[11px] font-bold">✕</span>
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

            {/* TÓM TẮT Messaging App */}
            {summaryText && (
                <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                📋 Tóm tắt mục tiêu Messaging App
                            </span>

                            <div className="inline-flex p-0.5 bg-slate-100 rounded-lg text-[11px] font-bold border border-slate-200">
                                <button
                                    onClick={() => setSummaryMode(1)}
                                    className={`px-2.5 py-1 rounded-md transition ${summaryMode === 1 ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
                                >
                                    1. Tổng quát
                                </button>
                                <button
                                    onClick={() => setSummaryMode(2)}
                                    className={`px-2.5 py-1 rounded-md transition ${summaryMode === 2 ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
                                >
                                    2. Chi tiết 3 nhóm
                                </button>
                                <button
                                    onClick={() => setSummaryMode(3)}
                                    className={`px-2.5 py-1 rounded-md transition ${summaryMode === 3 ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
                                >
                                    3. Chi tiết toàn bộ
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={handleCopyText}
                            className="text-xs text-blue-600 hover:text-blue-700 font-bold underline cursor-pointer"
                        >
                            Sao chép nội dung
                        </button>
                    </div>

                    <pre className="font-mono text-xs p-4 bg-slate-50 border border-slate-200 rounded-xl whitespace-pre-wrap leading-relaxed text-slate-700 max-h-64 overflow-y-auto">
                        {summaryText}
                    </pre>
                </div>
            )}
        </div>
    );
}