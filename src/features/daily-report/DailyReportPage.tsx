import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../shared/contexts/AuthContext';
import {
    generateStandardReportCanvas,
    downloadReportCanvas,
    copyReportCanvasToClipboard
} from '../../shared/utils/exportImage';
import {
    formatValue,
    getShortStoreName,
    formatDate,
    isStoreMatch
} from '../../core/lib/formatters';
import {
    fetchStores,
    fetchCampaignDictionary,
    type CampaignDictItem,
    type StoreItem
} from '../../core/lib/storage';
import {
    Zap,
    Target,
    Calendar,
    Store,
    Info,
    Edit3
} from 'lucide-react';
import ReportActionButtons from '../../shared/components/report/ReportActionButtons';
import CloudDataSyncStatusBanner from '../../shared/components/report/CloudDataSyncStatusBanner';
import type { AssessmentTemplate } from '../../shared/components/report/ReportAssessmentModal';

import {
    DAILY_REPORT_STORAGE_KEYS,
    parseEmulationData,
    parseRevenueData,
    type CampaignItem,
    type RevenueItem
} from './utils/dailyReportParsers';

import {
    fetchRealtimeStoreSessions,
    convertSessionsToDailyReportState,
    type RealtimeStoreSessionRecord,
    type RealtimeSessionSummary
} from './services/realtimeSessionService';
import RealtimeSessionBanner from './components/RealtimeSessionBanner';
import RealtimeDataUpdateModal from './components/RealtimeDataUpdateModal';

import DailyRealtimeTable from './components/DailyRealtimeTable';
import DailyRemainingTable from './components/DailyRemainingTable';
import DailyReportInputSection from './components/DailyReportInputSection';
import { useDailyRemainingData } from './hooks/useDailyRemainingData';

export default function DailyReportPage() {
    const { isAdmin, currentUser } = useAuth();
    const exportRef = useRef<HTMLDivElement | null>(null);
    const [searchParams, setSearchParams] = useSearchParams();

    // Điều hướng Tab qua URL Query: ?tab=realtime hoặc ?tab=remaining
    const activeTab = (searchParams.get('tab') === 'remaining' ? 'remaining' : 'realtime') as 'realtime' | 'remaining';
    const handleTabChange = (tab: 'realtime' | 'remaining') => {
        setSearchParams(tab === 'remaining' ? { tab: 'remaining' } : {});
    };

    // Quản lý phiên dữ liệu Realtime từ Supabase Cloud
    const [realtimeSessions, setRealtimeSessions] = useState<RealtimeStoreSessionRecord[]>([]);
    const [sessionSummary, setSessionSummary] = useState<RealtimeSessionSummary | null>(null);
    const [isLoadingSessions, setIsLoadingSessions] = useState<boolean>(false);
    const [isTableMissing, setIsTableMissing] = useState<boolean>(false);
    const [isUpdateModalOpen, setIsUpdateModalOpen] = useState<boolean>(false);
    const [availableStores, setAvailableStores] = useState<StoreItem[]>([]);
    const [showLegacyPasteInput, setShowLegacyPasteInput] = useState<boolean>(false);

    // Input states đồng bộ LocalStorage toàn hệ thống
    const [emulationText, setEmulationText] = useState<string>(() => {
        try {
            return localStorage.getItem(DAILY_REPORT_STORAGE_KEYS.EMULATION) || '';
        } catch { return ''; }
    });
    const [revenueText, setRevenueText] = useState<string>(() => {
        try {
            return localStorage.getItem(DAILY_REPORT_STORAGE_KEYS.REVENUE) || '';
        } catch { return ''; }
    });
    const [realRevenueText, setRealRevenueText] = useState<string>(() => {
        try {
            return localStorage.getItem(DAILY_REPORT_STORAGE_KEYS.REAL_REVENUE) || '';
        } catch { return ''; }
    });

    // Dữ liệu bóc tách
    const [allData, setAllData] = useState<CampaignItem[]>([]);
    const [revenueData, setRevenueData] = useState<Record<string, RevenueItem>>({});
    const [revenueStores, setRevenueStores] = useState<RevenueItem[]>([]);
    const [selectedStore, setSelectedStore] = useState<string>(() => {
        try {
            return localStorage.getItem(DAILY_REPORT_STORAGE_KEYS.SELECTED_STORE) || 'Tổng';
        } catch { return 'Tổng'; }
    });

    // Tùy chọn giao diện
    const [isInputCollapsed, setIsInputCollapsed] = useState<boolean>(false);
    const [isPointsEnabled, setIsPointsEnabled] = useState<boolean>(false);
    const [summaryMode, setSummaryMode] = useState<number>(1);
    const [isExporting, setIsExporting] = useState<boolean>(false);
    const [isCopying, setIsCopying] = useState<boolean>(false);

    // Từ điển thi đua
    const [campaignsDict, setCampaignsDict] = useState<CampaignDictItem[]>([]);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 2500);
    };

    // Tự động lưu LocalStorage
    useEffect(() => {
        try {
            if (emulationText) localStorage.setItem(DAILY_REPORT_STORAGE_KEYS.EMULATION, emulationText);
            else localStorage.removeItem(DAILY_REPORT_STORAGE_KEYS.EMULATION);
        } catch { }
    }, [emulationText]);

    useEffect(() => {
        try {
            if (revenueText) localStorage.setItem(DAILY_REPORT_STORAGE_KEYS.REVENUE, revenueText);
            else localStorage.removeItem(DAILY_REPORT_STORAGE_KEYS.REVENUE);
        } catch { }
    }, [revenueText]);

    useEffect(() => {
        try {
            if (realRevenueText) localStorage.setItem(DAILY_REPORT_STORAGE_KEYS.REAL_REVENUE, realRevenueText);
            else localStorage.removeItem(DAILY_REPORT_STORAGE_KEYS.REAL_REVENUE);
        } catch { }
    }, [realRevenueText]);

    useEffect(() => {
        try {
            if (selectedStore) localStorage.setItem(DAILY_REPORT_STORAGE_KEYS.SELECTED_STORE, selectedStore);
        } catch { }
    }, [selectedStore]);

    // Tải phiên Realtime từ Supabase Cloud
    const loadRealtimeSessions = async (currentDict: CampaignDictItem[] = campaignsDict) => {
        setIsLoadingSessions(true);
        const res = await fetchRealtimeStoreSessions();
        setIsTableMissing(Boolean(res.isTableMissing));

        if (res.data && res.data.length > 0) {
            setRealtimeSessions(res.data);
            const parsed = convertSessionsToDailyReportState(res.data, currentDict);
            if (parsed.allData.length > 0 || Object.keys(parsed.revenueData).length > 0) {
                setAllData(parsed.allData);
                setRevenueData(parsed.revenueData);
                setRevenueStores(parsed.revenueStores);
                setSessionSummary(parsed.sessionSummary);
                setIsLoadingSessions(false);
                return;
            }
        }

        // Dự phòng: Nếu trên Cloud chưa có dữ liệu, nhưng có text cũ trong localStorage thì bóc tách
        if (emulationText.trim() || revenueText.trim()) {
            const emuParsed = parseEmulationData(emulationText, currentDict);
            const { revMap, revList } = parseRevenueData(revenueText, realRevenueText);
            if (emuParsed.length > 0 || Object.keys(revMap).length > 0) {
                setAllData(emuParsed);
                setRevenueData(revMap);
                setRevenueStores(revList);
            }
        }
        setIsLoadingSessions(false);
    };

    // Tải từ điển, danh sách siêu thị và phiên Realtime Cloud khi khởi tạo
    useEffect(() => {
        let loadedDict: CampaignDictItem[] = [];
        fetchCampaignDictionary().then(res => {
            if (res.success && res.data) {
                setCampaignsDict(res.data);
                loadedDict = res.data;
            }
            loadRealtimeSessions(loadedDict);
        });

        fetchStores().then(res => {
            if (res.success && res.data) {
                setAvailableStores(res.data);
            }
        });
    }, []);

    // Callback khi nạp và lưu thành công từ Modal OCR / Nhập tay
    const handleSavedSuccessfully = (savedSessions: RealtimeStoreSessionRecord[]) => {
        setRealtimeSessions(savedSessions);
        const parsed = convertSessionsToDailyReportState(savedSessions, campaignsDict);
        setAllData(parsed.allData);
        setRevenueData(parsed.revenueData);
        setRevenueStores(parsed.revenueStores);
        setSessionSummary(parsed.sessionSummary);
        showToast(`🎉 Đã cập nhật phiên Realtime mới cho ${savedSessions.length} siêu thị từ Cloud!`);
    };

    // Xử lý nút bóc tách
    const handleProcessData = () => {
        const emuParsed = parseEmulationData(emulationText, campaignsDict);
        const { revMap, revList } = parseRevenueData(revenueText, realRevenueText);

        if (emuParsed.length === 0 && Object.keys(revMap).length === 0) {
            showToast('⚠️ Vui lòng dán dữ liệu Thi đua hoặc Doanh thu!');
            return;
        }

        setAllData(emuParsed);
        setRevenueData(revMap);
        setRevenueStores(revList);
        showToast(`✅ Đã bóc tách ${emuParsed.length} mục thi đua & ${revList.length} siêu thị!`);
    };

    // Xóa trắng dữ liệu dán
    const handleClearData = () => {
        if (!window.confirm('Bạn có chắc muốn xóa trắng dữ liệu đang dán để nhập phiên mới?')) return;
        setEmulationText('');
        setRevenueText('');
        setRealRevenueText('');
        setAllData([]);
        setRevenueData({});
        setRevenueStores([]);
        try {
            localStorage.removeItem(DAILY_REPORT_STORAGE_KEYS.EMULATION);
            localStorage.removeItem(DAILY_REPORT_STORAGE_KEYS.REVENUE);
            localStorage.removeItem(DAILY_REPORT_STORAGE_KEYS.REAL_REVENUE);
        } catch { }
        showToast('Đã làm mới vùng dán số liệu!');
    };

    // Doanh thu siêu thị đang chọn
    const currentRevenue = useMemo(() => {
        return revenueData[selectedStore] || revenueStores.find(r => r.shortName === selectedStore);
    }, [revenueData, revenueStores, selectedStore]);

    const hasInstallmentData = useMemo(() => {
        if (realRevenueText.trim()) return true;
        return Object.values(revenueData).some(r => (r.dtTraGop || 0) > 0 || (r.pctTraGop || 0) > 0);
    }, [realRevenueText, revenueData]);

    // Danh sách siêu thị khả dụng
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

    // =========================================================================
    // DỮ LIỆU TAB 1: CHUẨN REALTIME
    // =========================================================================
    const filteredRealtimeCampaigns = useMemo(() => {
        const list = allData.filter(d => {
            if (selectedStore === 'Tổng') return d.shortName === 'Tổng';
            return d.shortName.toLowerCase() === selectedStore.toLowerCase() ||
                d.store.toLowerCase().includes(selectedStore.toLowerCase());
        });
        return list.sort((a, b) => (b.pctHT || 0) - (a.pctHT || 0) || (b.actual || 0) - (a.actual || 0));
    }, [allData, selectedStore]);

    const realtimeStats = useMemo(() => {
        const passed = filteredRealtimeCampaigns.filter(d => d.pctHT >= 100);
        const fails = filteredRealtimeCampaigns.filter(d => d.pctHT < 100);
        return {
            total: filteredRealtimeCampaigns.length,
            passed: passed.length,
            fails,
            passRate: filteredRealtimeCampaigns.length > 0
                ? Math.round((passed.length / filteredRealtimeCampaigns.length) * 100)
                : 0
        };
    }, [filteredRealtimeCampaigns]);

    const realtimeAssessmentTemplates = useMemo<AssessmentTemplate[]>(() => {
        const isAll = selectedStore === 'all' || selectedStore === 'Tổng';
        const dispStore = isAll ? 'TỔNG CỤM' : selectedStore;

        const generateText = (mode: number) => {
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

            if (filteredRealtimeCampaigns.length > 0) {
                txt += `\n\n🎯 THI ĐUA: Đạt ${realtimeStats.passed}/${realtimeStats.total} NH (${realtimeStats.passRate}%)`;
                if (realtimeStats.fails.length === 0) {
                    txt += `\n\n🎉 Toàn bộ các chỉ tiêu thi đua đều đạt!`;
                } else {
                    const groupNear = realtimeStats.fails.filter(d => (d.pctHT ?? 0) >= 80);
                    const groupSpeed = realtimeStats.fails.filter(d => (d.pctHT ?? 0) >= 50 && (d.pctHT ?? 0) < 80);
                    const groupAlert = realtimeStats.fails.filter(d => (d.pctHT ?? 0) < 50);

                    if (mode === 1) {
                        // MẪU 1: VỪA TỔNG QUÁT VỪA CHI TIẾT THEO TỪNG NHÓM
                        txt += `\n\n📊 TỔNG HỢP CHƯA ĐẠT (${realtimeStats.fails.length} NH):`;
                        if (groupNear.length > 0) txt += `\n- ⚡ CẬN ĐÍCH (>80%): ${groupNear.length} NH`;
                        if (groupSpeed.length > 0) txt += `\n- 🔥 CẦN TĂNG TỐC (50% - 80%): ${groupSpeed.length} NH`;
                        if (groupAlert.length > 0) txt += `\n- ⚠️ NGUY HIỂM (<50%): ${groupAlert.length} NH`;

                        txt += `\n\n📋 CHI TIẾT THEO TỪNG NHÓM:`;
                        if (groupNear.length > 0) {
                            txt += `\n\n⚡ CẬN ĐÍCH (>80%):`;
                            groupNear.forEach(d => {
                                const rate = typeof d.pctHT === 'number' ? d.pctHT.toFixed(1) : '0';
                                txt += `\n• ${d.label}: thiếu ${formatValue(Math.max(0, d.target - d.actual))} (RT: ${formatValue(d.actual)}/${formatValue(d.target)}, ${rate}%)`;
                            });
                        }
                        if (groupSpeed.length > 0) {
                            txt += `\n\n🔥 CẦN TĂNG TỐC (50% - 80%):`;
                            groupSpeed.forEach(d => {
                                const rate = typeof d.pctHT === 'number' ? d.pctHT.toFixed(1) : '0';
                                txt += `\n• ${d.label}: thiếu ${formatValue(Math.max(0, d.target - d.actual))} (RT: ${formatValue(d.actual)}/${formatValue(d.target)}, ${rate}%)`;
                            });
                        }
                        if (groupAlert.length > 0) {
                            txt += `\n\n⚠️ NGUY HIỂM (<50%):`;
                            groupAlert.forEach(d => {
                                const rate = typeof d.pctHT === 'number' ? d.pctHT.toFixed(1) : '0';
                                txt += `\n• ${d.label}: thiếu ${formatValue(Math.max(0, d.target - d.actual))} (RT: ${formatValue(d.actual)}/${formatValue(d.target)}, ${rate}%)`;
                            });
                        }
                    } else if (mode === 2) {
                        // MẪU 2: CHI TIẾT 3 NHÓM
                        txt += `\n\n📊 CHI TIẾT CHƯA ĐẠT THEO 3 NHÓM (${realtimeStats.fails.length} NH):`;
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
                    } else if (mode === 3) {
                        // MẪU 3: TỔNG QUÁT SÚC TÍCH (Chỉ số lượng)
                        txt += `\n\n📊 TỔNG HỢP CHƯA ĐẠT (${realtimeStats.fails.length} NH):`;
                        if (groupNear.length > 0) txt += `\n- ⚡ CẬN ĐÍCH (>80%): ${groupNear.length} NH`;
                        if (groupSpeed.length > 0) txt += `\n- 🔥 CẦN TĂNG TỐC (50% - 80%): ${groupSpeed.length} NH`;
                        if (groupAlert.length > 0) txt += `\n- ⚠️ NGUY HIỂM (<50%): ${groupAlert.length} NH`;
                    } else {
                        // MẪU 4: CHI TIẾT TOÀN BỘ (Dạng danh sách phẳng)
                        txt += `\n\n⚠️ CHI TIẾT CHƯA ĐẠT (${realtimeStats.fails.length} NH):`;
                        realtimeStats.fails.forEach(d => {
                            const rate = typeof d.pctHT === 'number' ? d.pctHT.toFixed(1) : '0';
                            txt += `\n- ${d.label}: thiếu ${formatValue(Math.max(0, d.target - d.actual))} (${rate}%)`;
                        });
                    }
                }
            }
            return txt;
        };

        return [
            {
                id: 1,
                title: 'Mẫu 1: Tổng Quát & Chi Tiết 3 Nhóm',
                badge: 'Khuyên Dùng',
                content: generateText(1),
                description: 'Vừa tóm tắt tổng quan 3 nhóm vừa liệt kê chi tiết từng ngành hàng chưa đạt theo nhóm'
            },
            {
                id: 2,
                title: 'Mẫu 2: Chi Tiết 3 Nhóm',
                badge: '3 Nhóm',
                content: generateText(2),
                description: 'Liệt kê chi tiết các ngành hàng theo từng nhóm phân loại tiến độ'
            },
            {
                id: 3,
                title: 'Mẫu 3: Tổng Quát Súc Tích',
                badge: 'Súc Tích',
                content: generateText(3),
                description: 'Tóm tắt nhanh số lượng ngành hàng theo 3 mức tiến độ'
            },
            {
                id: 4,
                title: 'Mẫu 4: Chi Tiết Toàn Bộ',
                badge: 'Hành Động',
                content: generateText(4),
                description: 'Danh sách chi tiết toàn bộ các ngành hàng chưa đạt chỉ tiêu ngày'
            }
        ];
    }, [selectedStore, currentRevenue, hasInstallmentData, filteredRealtimeCampaigns, realtimeStats]);

    // =========================================================================
    // DỮ LIỆU TAB 2: MỤC TIÊU CÒN LẠI (NÂNG CAO)
    // =========================================================================
    const remainingData = useDailyRemainingData({
        selectedStore,
        allData,
        campaignsDict,
        currentRevenue
    });

    // Mẫu nhận xét đang kích hoạt tương ứng theo Tab
    const currentAssessmentTemplates = activeTab === 'realtime'
        ? realtimeAssessmentTemplates
        : remainingData.remainingAssessmentTemplates;

    const currentReportTitle = activeTab === 'realtime'
        ? `Báo Cáo Doanh Thu Realtime - ${selectedStore}`
        : `Báo Cáo Realtime Còn Lại - ${selectedStore}`;

    // Chụp xuất ảnh 8K
    const handleCaptureImage = async (mode: 'save' | 'copy') => {
        if (!exportRef.current || isExporting || isCopying) return;
        if (mode === 'save') setIsExporting(true);
        else setIsCopying(true);

        try {
            const targetWidth = activeTab === 'remaining' ? 850 : 800;
            const canvas = await generateStandardReportCanvas(exportRef.current, {
                targetWidth,
                kpiColumns: hasInstallmentData ? 4 : 3,
                containerSelector: '[data-report-table="true"]'
            });

            if (!canvas) throw new Error('Không thể khởi tạo canvas');
            const cleanStore = (selectedStore === 'Tổng' ? 'Tong_Cum' : selectedStore).replace(/[^a-zA-Z0-9_-]/g, '_');
            const prefix = activeTab === 'remaining' ? 'BC_Realtime_ConLai' : 'BaoCao_Realtime';
            const fileName = `${prefix}_${cleanStore}_8K.png`;

            if (mode === 'save') {
                const success = await downloadReportCanvas(canvas, fileName);
                if (success) showToast('Đã lưu ảnh báo cáo 8K!');
                else throw new Error('Lỗi lưu ảnh');
            } else {
                const success = await copyReportCanvasToClipboard(canvas);
                if (success) showToast('Đã copy ảnh vào clipboard!');
                else showToast('Trình duyệt chặn copy ảnh, hãy dùng TẢI ẢNH!');
            }
        } catch (e) {
            console.error('Lỗi xuất ảnh:', e);
            showToast('Lỗi khi chụp ảnh báo cáo!');
        } finally {
            setIsExporting(false);
            setIsCopying(false);
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

            {/* BANNER BÁO CÁO TRẠNG THÁI LƯU TRỮ DỮ LIỆU & ĐỒNG BỘ CLOUD (QUY CHUẨN 8) */}
            <div data-html2canvas-ignore="true" data-export-ignore="true">
                <CloudDataSyncStatusBanner
                    storageType="cloud"
                    syncStatus={isLoadingSessions ? 'syncing' : (sessionSummary?.isCloud ? 'synced' : 'unsynced')}
                    tableReady={!isTableMissing}
                    tableName="realtime_store_sessions"
                    customMessage={sessionSummary
                        ? `Phiên Realtime Cloud: ${sessionSummary.screenshotTimeStr || (sessionSummary.sessionTime ? new Date(sessionSummary.sessionTime).toLocaleTimeString('vi-VN') : '')} (${sessionSummary.storeCount} siêu thị)`
                        : 'Bảng realtime_store_sessions (Mỗi siêu thị lưu 1 phiên duy nhất)'
                    }
                    compact={true}
                />
            </div>

            {/* BANNER THỜI GIAN PHIÊN DỮ LIỆU REALTIME TỪ CLOUD (QUY CHUẨN REALTIME SESSION) */}
            <RealtimeSessionBanner
                sessionSummary={sessionSummary}
                selectedStore={selectedStore}
                isLoading={isLoadingSessions}
                isTableMissing={isTableMissing}
                isAdmin={isAdmin}
                onRefresh={() => loadRealtimeSessions()}
                onOpenUpdateModal={() => setIsUpdateModalOpen(true)}
            />

            {/* HEADER CÔNG CỤ & TAB SEGMENTED SWITCHER */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl text-white flex items-center justify-center font-bold shadow-xs shrink-0 ${activeTab === 'remaining'
                        ? 'bg-gradient-to-br from-amber-500 to-orange-600'
                        : 'bg-blue-600'
                        }`}>
                        {activeTab === 'remaining' ? <Target className="w-5 h-5 text-white" /> : <Zap className="w-5 h-5 text-white" />}
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                                {activeTab === 'remaining'
                                    ? 'Báo Cáo Realtime - Mục Tiêu Còn Lại'
                                    : 'Báo Cáo Doanh Thu & Thi Đua Realtime'
                                }
                            </h1>
                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${activeTab === 'remaining'
                                ? 'bg-amber-100 text-amber-800 border-amber-200'
                                : 'bg-blue-100 text-blue-800 border-blue-200'
                                }`}>
                                {activeTab === 'remaining' ? 'Nâng Cao' : 'Tiêu Chuẩn'}
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                            {activeTab === 'remaining'
                                ? 'Tự động tính toán Target ngày linh hoạt theo số lượng còn thiếu thực tế của tháng.'
                                : 'Đánh giá kết quả kinh doanh trong ngày theo đúng chỉ tiêu ngày cố định ban đầu.'
                            }
                        </p>
                    </div>
                </div>

                {/* TAB SEGMENTED SWITCHER */}
                <div className="flex items-center p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 w-full md:w-auto shadow-inner">
                    <button
                        onClick={() => handleTabChange('realtime')}
                        className={`flex-1 md:flex-initial flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'realtime'
                            ? 'bg-white text-blue-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                            }`}
                    >
                        <Zap className="w-3.5 h-3.5" />
                        <span>⚡ Chuẩn Realtime</span>
                    </button>
                    <button
                        onClick={() => handleTabChange('remaining')}
                        className={`flex-1 md:flex-initial flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'remaining'
                            ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                            }`}
                    >
                        <Target className="w-3.5 h-3.5" />
                        <span>🎯 Mục Tiêu Còn Lại</span>
                    </button>
                </div>
            </div>

            {/* TÙY CHỌN DỰ PHÒNG: VÙNG DÁN VĂN BẢN CŨ (TẠM ẨN THEO YÊU CẦU) */}
            <div className="flex items-center justify-between px-1" data-html2canvas-ignore="true" data-export-ignore="true">
                <span className="text-[11px] text-slate-500 font-medium">
                    Phương thức nạp số liệu chính: <strong className="text-blue-700">OCR Hình Ảnh & Nhập Trực Quan</strong>
                </span>
                <button
                    type="button"
                    onClick={() => setShowLegacyPasteInput(!showLegacyPasteInput)}
                    className="text-[11px] text-slate-400 hover:text-blue-600 font-semibold transition cursor-pointer flex items-center gap-1"
                >
                    <Edit3 className="w-3 h-3" />
                    <span>{showLegacyPasteInput ? '▲ Ẩn vùng dán text dự phòng' : '▼ Mở vùng dán text dự phòng'}</span>
                </button>
            </div>

            {showLegacyPasteInput && (
                <DailyReportInputSection
                    emulationText={emulationText}
                    setEmulationText={setEmulationText}
                    revenueText={revenueText}
                    setRevenueText={setRevenueText}
                    realRevenueText={realRevenueText}
                    setRealRevenueText={setRealRevenueText}
                    onProcessData={handleProcessData}
                    onClearData={handleClearData}
                    isCollapsed={isInputCollapsed}
                    onToggleCollapse={() => setIsInputCollapsed(!isInputCollapsed)}
                    hasData={allData.length > 0 || Object.keys(revenueData).length > 0}
                />
            )}

            {/* THANH ĐIỀU KHIỂN & BỘ LỌC (QUY CHUẨN 10: SIÊU THỊ NẰM HÀNG ĐẦU TIÊN) */}
            <div className="bg-slate-50/90 border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 space-y-3">
                {/* Dòng 1: Chọn Siêu Thị & Nút Hành Động */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="flex-1">
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1 flex items-center gap-1">
                            <Store className="w-3.5 h-3.5 text-blue-600" />
                            <span>Đơn Vị / Siêu Thị</span>
                        </label>
                        <select
                            value={selectedStore}
                            onChange={(e) => setSelectedStore(e.target.value)}
                            className="w-full bg-white border border-slate-300 text-slate-800 py-2 px-3 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs"
                        >
                            <option value="Tổng">🏢 TỔNG TOÀN CỤM</option>
                            {storeOptions.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>

                    <div className="self-end sm:self-center pt-1 sm:pt-4">
                        <ReportActionButtons
                            onExportImage={() => handleCaptureImage('save')}
                            onCopyImage={() => handleCaptureImage('copy')}
                            isExporting={isExporting}
                            isCopying={isCopying}
                            exportButtonLabel="LƯU ẢNH"
                            copyImageButtonLabel="COPY ẢNH"
                            hasAssessment={true}
                            assessmentTemplates={currentAssessmentTemplates}
                            onCopyText={() => {
                                if (currentAssessmentTemplates.length > 0) {
                                    navigator.clipboard.writeText(currentAssessmentTemplates[0].content);
                                    showToast('Đã copy văn bản tóm tắt Messaging App!');
                                }
                            }}
                            reportTitle={currentReportTitle}
                        />
                    </div>
                </div>

                {/* Dòng 2: Tùy chọn riêng theo từng Tab */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-200/80 text-xs">
                    {activeTab === 'realtime' ? (
                        <div className="flex items-center gap-4">
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
                    ) : (
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                                <span>Kỳ Tháng {remainingData.selectedMonth}/{remainingData.selectedYear}</span>
                            </div>
                            <div className="text-[11px] font-semibold text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-xs">
                                ⏳ Số ngày còn lại: <span className="font-black text-amber-600">{remainingData.remainingDays} ngày</span>
                            </div>
                        </div>
                    )}

                    <div className="text-[11px] text-slate-500 font-medium">
                        {allData.length > 0 ? `Đã nạp ${allData.length} mục thi đua` : 'Chưa có dữ liệu'}
                    </div>
                </div>
            </div>

            {/* VÙNG XUẤT ẢNH BÁO CÁO (HTML2CANVAS EXPORT AREA) */}
            <div
                ref={exportRef}
                data-report-table="true"
                className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-sm space-y-4 font-avo"
            >
                {/* Header Báo Cáo */}
                <div className="text-center pb-3 border-b-2 border-blue-600">
                    <h2 className="text-lg sm:text-xl font-black text-blue-600 uppercase tracking-wide">
                        {selectedStore === 'Tổng' ? 'TỔNG TOÀN CỤM' : selectedStore}
                    </h2>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-0.5">
                        {activeTab === 'remaining'
                            ? `🎯 BÁO CÁO REALTIME - MỤC TIÊU CÒN LẠI • NGÀY ${formatDate(new Date())} (CÒN ${remainingData.remainingDays} NGÀY)`
                            : `⚡ BÁO CÁO DOANH THU & THI ĐUA REALTIME • NGÀY ${formatDate(new Date())}`
                        }
                    </p>
                </div>

                {/* THẺ CHỈ SỐ KPI TỔNG HỢP */}
                <div
                    data-kpi-grid="true"
                    className={`grid ${hasInstallmentData ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'} gap-2.5 text-center`}
                >
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

                    {activeTab === 'realtime' ? (
                        <div className="bg-emerald-50/70 border-l-4 border-emerald-500 rounded-xl p-2.5 shadow-xs">
                            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">MỤC ĐẠT THI ĐUA</span>
                            <span className="text-base sm:text-lg font-black text-emerald-600 font-mono">
                                {realtimeStats.passed} / {realtimeStats.total}
                            </span>
                            <span className="text-[10px] text-slate-500 font-bold block mt-0.5">
                                %HT: {realtimeStats.passRate}%
                            </span>
                        </div>
                    ) : (
                        <div className="bg-emerald-50/70 border-l-4 border-emerald-500 rounded-xl p-2.5 shadow-xs">
                            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">ĐẠT TARGET NGÀY</span>
                            <span className="text-base sm:text-lg font-black text-emerald-700 font-mono">
                                {remainingData.stats.pass.length} / {remainingData.stats.total} NH
                            </span>
                            <span className="text-[10px] text-slate-500 font-bold block mt-0.5">
                                Tỷ lệ đạt ngày: {remainingData.stats.passRate.toFixed(0)}%
                            </span>
                        </div>
                    )}
                </div>

                {/* BẢNG SỐ LIỆU TƯƠNG ỨNG THEO TAB */}
                {activeTab === 'realtime' ? (
                    <DailyRealtimeTable
                        campaigns={filteredRealtimeCampaigns}
                        isPointsEnabled={isPointsEnabled}
                    />
                ) : (
                    <DailyRemainingTable
                        campaigns={remainingData.displayedCampaigns}
                        showCompletedCampaigns={remainingData.showCompletedCampaigns}
                        onToggleShowCompleted={remainingData.setShowCompletedCampaigns}
                        completedCount={remainingData.completedCount}
                        sortMode={remainingData.sortMode}
                        onSortModeChange={remainingData.setSortMode}
                    />
                )}
            </div>

            {/* KHỐI TÓM TẮT GỬI MESSAGING APP */}
            {currentAssessmentTemplates.length > 0 && (
                <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <Info className="w-4 h-4 text-blue-600" />
                                <span>Tóm tắt gửi Messaging App</span>
                            </span>

                            {/* Cụm nút chọn mẫu nhận xét */}
                            <div className="inline-flex p-0.5 bg-slate-100 rounded-lg text-xs font-bold border border-slate-200 flex-wrap">
                                {currentAssessmentTemplates.map((tpl, idx) => (
                                    <button
                                        key={tpl.id}
                                        type="button"
                                        onClick={() => setSummaryMode(idx)}
                                        className={`px-2.5 py-1 rounded-md transition cursor-pointer ${(summaryMode >= currentAssessmentTemplates.length ? 0 : summaryMode) === idx
                                            ? 'bg-white text-blue-700 shadow-xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                    >
                                        {tpl.title.split(':')[0]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                const activeIdx = summaryMode >= currentAssessmentTemplates.length ? 0 : summaryMode;
                                const textToCopy = currentAssessmentTemplates[activeIdx]?.content || '';
                                navigator.clipboard.writeText(textToCopy);
                                showToast(`Đã copy ${currentAssessmentTemplates[activeIdx]?.title || 'văn bản tóm tắt'}!`);
                            }}
                            className="text-xs text-blue-600 hover:text-blue-700 font-bold underline cursor-pointer self-start sm:self-auto"
                        >
                            Sao chép mẫu đang chọn
                        </button>
                    </div>

                    <div className="text-[11px] text-slate-500 font-medium italic">
                        {currentAssessmentTemplates[summaryMode >= currentAssessmentTemplates.length ? 0 : summaryMode]?.description}
                    </div>

                    <pre className="font-mono text-xs p-3.5 bg-slate-50 border border-slate-200 rounded-xl whitespace-pre-wrap leading-relaxed text-slate-700 max-h-56 overflow-y-auto">
                        {currentAssessmentTemplates[summaryMode >= currentAssessmentTemplates.length ? 0 : summaryMode]?.content}
                    </pre>
                </div>
            )}

            {/* MODAL NẠP DỮ LIỆU REALTIME MỚI (OCR & NHẬP TRỰC QUAN) */}
            <RealtimeDataUpdateModal
                isOpen={isUpdateModalOpen}
                onClose={() => setIsUpdateModalOpen(false)}
                onSavedSuccessfully={handleSavedSuccessfully}
                availableStores={availableStores}
                campaignDict={campaignsDict}
                isAdmin={isAdmin}
                currentUserName={currentUser?.full_name || currentUser?.employee_id || 'ADMIN'}
            />
        </div>
    );
}