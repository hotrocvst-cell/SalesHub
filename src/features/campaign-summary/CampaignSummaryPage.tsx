import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CampaignSummaryData } from './types';
import { buildCampaignSummaryFromSession } from './utils/campaignSummaryStorage';
import {
    fetchStores,
    fetchCampaignDictionary,
    fetchEmployeeCampaignTargets,
    fetchEmployees,
    type StoreItem,
    type CampaignDictItem,
    type EmployeeItem
} from '../../core/lib/storage';
import { formatDate, getShortStoreName, isStoreMatch, getYesterdayDateString, getCampaignLabel } from '../../core/lib/formatters';
import {
    syncAndFetchEmployeeDataSessions,
    type EmployeeDataSession
} from '../employee-cumulative/utils/sessionStorage';
import { getStoreOperatingConfig } from '../employee-performance/utils/performanceConfig';
import CampaignSummaryTable from './components/CampaignSummaryTable';
import CampaignRemarksModal from './components/CampaignRemarksModal';
import {
    Sparkles,
    Download,
    Copy,
    RefreshCw,
    Search,
    Store,
    Calendar,
    ArrowUpRight,
    FileSpreadsheet,
    AlertTriangle,
    Layers,
    CheckCircle2
} from 'lucide-react';
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';

export default function CampaignSummaryPage() {
    const navigate = useNavigate();
    const reportRef = useRef<HTMLDivElement>(null);

    const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
    const [selectedStore, setSelectedStore] = useState<string>('all');
    const [stores, setStores] = useState<StoreItem[]>([]);
    const [employees, setEmployees] = useState<EmployeeItem[]>([]);

    const [sessions, setSessions] = useState<EmployeeDataSession[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState<string>('');
    const [targetsMap, setTargetsMap] = useState<Record<string, Record<string, number>>>({});
    const [campaignDict, setCampaignDict] = useState<CampaignDictItem[]>([]);

    const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState<string>('');

    const [loading, setLoading] = useState<boolean>(true);
    const [isRemarksModalOpen, setIsRemarksModalOpen] = useState<boolean>(false);
    const [isExporting, setIsExporting] = useState<boolean>(false);
    const [exportResolution, setExportResolution] = useState<'4K' | '8K'>('8K');
    const [toastMessage, setToastMessage] = useState<string>('');

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 3500);
    };

    // 1. TẢI DỮ LIỆU TỪ HỆ THỐNG
    const loadSystemData = async () => {
        setLoading(true);

        const [storesRes, dictRes, targetsRes, empsRes] = await Promise.all([
            fetchStores(),
            fetchCampaignDictionary(),
            fetchEmployeeCampaignTargets(selectedMonth, selectedYear),
            fetchEmployees()
        ]);

        if (storesRes.success) setStores(storesRes.data);
        if (dictRes.success && dictRes.data) setCampaignDict(dictRes.data);
        if (empsRes.success) setEmployees(empsRes.data);

        // Chuyển đổi chỉ tiêu thi đua sang bản đồ [empId][rawKey] = target
        const tMap: Record<string, Record<string, number>> = {};
        if (targetsRes.success && targetsRes.data) {
            targetsRes.data.forEach((row: any) => {
                const empId = String(row.employee_id || '').trim();
                const rawKey = String(row.raw_key || '').trim();
                if (empId && rawKey) {
                    if (!tMap[empId]) tMap[empId] = {};
                    tMap[empId][rawKey] = Number(row.target_value) || 0;
                }
            });
        }
        setTargetsMap(tMap);

        // 2. Lấy danh sách các phiên dữ liệu nhân viên đã cập nhật (tự động đồng bộ với Supabase Cloud)
        const allSessions = await syncAndFetchEmployeeDataSessions({
            month: selectedMonth,
            year: selectedYear
        });

        // Chỉ lấy các phiên có dữ liệu thi đua hoặc phiên REVENUE_CAMPAIGN / FULL_SYNC
        const validSessions = allSessions.filter(s =>
            (s.session_type === 'REVENUE_CAMPAIGN' || s.session_type === 'FULL_SYNC') &&
            s.records.length > 0 &&
            s.records.some(r => r.campaigns && Object.keys(r.campaigns).length > 0)
        );

        setSessions(validSessions);
        setLoading(false);
    };

    useEffect(() => {
        loadSystemData();
    }, [selectedMonth, selectedYear]);

    // Danh sách phiên thi đua phù hợp theo siêu thị đang chọn:
    // - Khi chọn siêu thị A: CHỈ hiển thị các phiên của siêu thị A
    // - Khi chọn Toàn cụm: tổng hợp phiên mới nhất của từng siêu thị lên đầu
    const availableSessions = useMemo<EmployeeDataSession[]>(() => {
        if (selectedStore === 'all') {
            const storeMap = new Map<string, EmployeeDataSession>();
            sessions.forEach(s => {
                const st = s.store_name || '';
                if (st && st !== 'Toàn Cụm Siêu Thị' && !storeMap.has(st)) {
                    storeMap.set(st, s);
                }
            });

            if (storeMap.size > 1) {
                const combinedRecords: any[] = [];
                let latestReportDate = '';
                storeMap.forEach((sess) => {
                    if (sess.report_date && (!latestReportDate || sess.report_date > latestReportDate)) {
                        latestReportDate = sess.report_date;
                    }
                    combinedRecords.push(...(sess.records || []));
                });

                const clusterSession: EmployeeDataSession = {
                    id: 'all_cluster_latest',
                    session_type: 'REVENUE_CAMPAIGN',
                    session_title: '✨ Toàn cụm: Tổng hợp các phiên mới nhất',
                    store_name: 'Toàn Cụm Siêu Thị',
                    month: selectedMonth,
                    year: selectedYear,
                    report_date: latestReportDate || getYesterdayDateString(),
                    created_at: new Date().toISOString(),
                    created_by: 'Hệ thống SalesHub',
                    employee_count: combinedRecords.length,
                    total_revenue_actual: combinedRecords.reduce((sum, r) => sum + (r.revenue_actual || 0), 0),
                    total_revenue_qd: combinedRecords.reduce((sum, r) => sum + (r.revenue_qd || 0), 0),
                    total_work_hours: 0,
                    source_type: 'PASTE_TEXT',
                    records: combinedRecords
                };

                return [clusterSession, ...sessions];
            }

            return sessions;
        }

        // Lọc nghiêm ngặt: CHỈ LẤY CÁC PHIÊN CỦA ĐÚNG SIÊU THỊ ĐƯỢC CHỌN
        return sessions.filter(s => isStoreMatch(s.store_name, selectedStore, stores));
    }, [sessions, selectedStore, stores, selectedMonth, selectedYear]);

    // Khi danh sách phiên khả dụng thay đổi: Tự động chọn phiên mới nhất
    useEffect(() => {
        if (availableSessions.length > 0) {
            setSelectedSessionId(prev => {
                if (prev && availableSessions.some(s => s.id === prev)) {
                    return prev;
                }
                return availableSessions[0].id;
            });
        } else {
            setSelectedSessionId('');
        }
    }, [availableSessions]);

    // Xử lý khi người dùng chọn siêu thị khác trên dropdown:
    // Lập tức chuyển sang phiên mới nhất của siêu thị đó
    const handleStoreChange = (newStore: string) => {
        setSelectedStore(newStore);
        const filtered = newStore === 'all'
            ? sessions
            : sessions.filter(s => isStoreMatch(s.store_name, newStore, stores));
        setSelectedSessionId(filtered[0]?.id || '');
    };

    // Bản đồ nhân viên -> siêu thị
    const empStoreMap = useMemo(() => {
        const map: Record<string, string> = {};
        employees.forEach(e => {
            if (e.employee_id) {
                map[e.employee_id.trim()] = e.store_name || '';
            }
        });
        return map;
    }, [employees]);

    // Phiên đang chọn để hiển thị báo cáo: Luôn tìm trong danh sách availableSessions
    const activeSession = useMemo(() => {
        if (availableSessions.length === 0) return null;
        if (!selectedSessionId) return availableSessions[0];
        return availableSessions.find(s => s.id === selectedSessionId) || availableSessions[0];
    }, [availableSessions, selectedSessionId]);

    // Cấu hình hoạt động shop (ngày trôi qua, tổng ngày)
    const operatingConfig = useMemo(() => {
        return getStoreOperatingConfig(
            selectedStore === 'all' ? 'ALL' : selectedStore,
            selectedMonth,
            selectedYear
        );
    }, [selectedStore, selectedMonth, selectedYear]);

    // 2. TÍNH TOÁN DỮ LIỆU BÁO CÁO THI ĐUA TỪ PHIÊN ĐÃ CẬP NHẬT
    // - Lọc kết quả nhân viên theo siêu thị và chỉ chọn nhân viên có khai báo target
    // - Tổng số thi đua chỉ tính theo thi đua có target và theo siêu thị
    const campaignData = useMemo<CampaignSummaryData | null>(() => {
        if (!activeSession) return null;

        // Xác định số ngày đã trôi qua dựa theo ngày của phiên dữ liệu hoặc cấu hình shop
        let passedDays = operatingConfig.passedDays;
        if (activeSession.report_date) {
            const parts = activeSession.report_date.split('-');
            if (parts.length === 3) {
                const dayFromSession = parseInt(parts[2], 10);
                if (!isNaN(dayFromSession) && dayFromSession > 0) {
                    passedDays = Math.min(dayFromSession, operatingConfig.operatingDays);
                }
            }
        }

        return buildCampaignSummaryFromSession(
            activeSession,
            targetsMap,
            campaignDict,
            passedDays,
            operatingConfig.operatingDays,
            {
                selectedStore,
                empStoreMap,
                storesList: stores
            }
        );
    }, [activeSession, targetsMap, campaignDict, operatingConfig, selectedStore, empStoreMap, stores]);

    // Lọc theo tìm kiếm nhân viên
    const filteredRows = useMemo(() => {
        if (!campaignData || !campaignData.rows || !Array.isArray(campaignData.rows)) return [];
        return campaignData.rows.filter(r => {
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchName = (r.full_name || '').toLowerCase().includes(q) || (r.display_name || '').toLowerCase().includes(q);
                const matchId = (r.employee_id || '').toLowerCase().includes(q);
                if (!matchName && !matchId) return false;
            }
            return true;
        });
    }, [campaignData, searchQuery]);

    // 3. XUẤT ẢNH BÁO CÁO SIÊU NÉT (4K - 8K ULTRA HD) TOÀN BỘ BẢNG
    const generateCanvas4K = async (): Promise<HTMLCanvasElement | null> => {
        if (!reportRef.current) return null;

        const originalEl = reportRef.current;
        const originalTable = originalEl.querySelector('table');
        if (!originalTable) return null;

        // Đảm bảo font chữ đã được tải xong 100% để đo đạc và vẽ chữ chuẩn
        if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
        }

        // 1. Tính toán chiều rộng thực tế cần thiết để hiển thị 100% tất cả các cột
        const ths = originalTable.querySelectorAll('thead th');
        let totalHeaderWidth = 0;
        ths.forEach(th => {
            const el = th as HTMLElement;
            totalHeaderWidth += Math.max(el.offsetWidth, el.scrollWidth, 90);
        });

        const tableContentWidth = Math.max(originalTable.scrollWidth, totalHeaderWidth);
        const targetWidth = Math.max(tableContentWidth + 48, 1400);

        // 2. Tạo container ảo ngoài màn hình (off-screen)
        const exportContainer = document.createElement('div');
        exportContainer.style.position = 'fixed';
        exportContainer.style.left = '-99999px';
        exportContainer.style.top = '0';
        exportContainer.style.zIndex = '-9999';
        exportContainer.style.width = `${targetWidth}px`;
        exportContainer.style.minWidth = `${targetWidth}px`;
        exportContainer.style.maxWidth = `${targetWidth}px`;
        exportContainer.style.backgroundColor = '#ffffff';
        exportContainer.style.overflow = 'visible';
        exportContainer.style.opacity = '1';

        // 3. Clone toàn bộ DOM của reportRef
        const clonedReport = originalEl.cloneNode(true) as HTMLElement;
        clonedReport.style.width = `${targetWidth}px`;
        clonedReport.style.minWidth = `${targetWidth}px`;
        clonedReport.style.maxWidth = `${targetWidth}px`;
        clonedReport.style.overflow = 'visible';
        clonedReport.style.height = 'auto';
        clonedReport.style.maxHeight = 'none';
        clonedReport.style.boxSizing = 'border-box';

        // Gỡ bỏ drop-shadow trên banner để tránh html2canvas làm đứt hoặc lệch chữ
        clonedReport.querySelectorAll<HTMLElement>('h1, h2, h3, [class*="drop-shadow"]').forEach(h => {
            h.style.filter = 'none';
            h.style.textShadow = '0 2px 4px rgba(0, 0, 0, 0.45)';
            h.style.lineHeight = '1.3';
            h.style.overflow = 'visible';
        });

        // 4. Xử lý các container cuộn: gỡ bỏ max-height và overflow để bung toàn bộ hàng và cột
        clonedReport.querySelectorAll<HTMLElement>('.overflow-hidden').forEach(el => {
            el.style.overflow = 'visible';
        });

        clonedReport.querySelectorAll<HTMLElement>('.overflow-x-auto, .overflow-y-auto, [class*="max-h-"]').forEach(el => {
            el.style.overflow = 'visible';
            el.style.overflowX = 'visible';
            el.style.overflowY = 'visible';
            el.style.maxHeight = 'none';
            el.style.height = 'auto';
            el.style.width = '100%';
            el.style.minWidth = '100%';
        });

        // 5. Đảm bảo bảng trong clone bung 100% độ rộng tự nhiên
        const clonedTable = clonedReport.querySelector('table');
        if (clonedTable) {
            clonedTable.style.width = '100%';
            clonedTable.style.minWidth = `${tableContentWidth}px`;
            clonedTable.style.tableLayout = 'auto';
        }

        // 6. Chuẩn hóa thead và toàn bộ th trong bảng:
        // Đảm bảo chữ cân giữa 100%, không bị cắt nửa trên/dưới do line-clamp hay flex lệch
        const clonedThead = clonedReport.querySelector('thead');
        if (clonedThead) {
            clonedThead.style.position = 'static';
            clonedThead.style.height = 'auto';
            clonedThead.style.overflow = 'visible';
        }

        clonedReport.querySelectorAll<HTMLElement>('th').forEach(th => {
            th.style.position = 'static';
            th.style.verticalAlign = 'middle';
            th.style.textAlign = 'center';
            th.style.height = '62px';
            th.style.minHeight = '62px';
            th.style.padding = '8px 4px';
            th.style.overflow = 'visible';
            th.style.boxSizing = 'border-box';
            th.style.lineHeight = '1.35';
        });

        // Ẩn toàn bộ icon mũi tên sắp xếp SVG trong tiêu đề cột để chữ cân giữa đối xứng tuyệt đối
        clonedReport.querySelectorAll<HTMLElement>('th svg').forEach(svg => {
            svg.style.display = 'none';
        });

        // Xử lý tất cả thẻ con bên trong th (div, span, p): gỡ bỏ line-clamp-2 và overflow: hidden
        clonedReport.querySelectorAll<HTMLElement>('th div, th span, th p').forEach(el => {
            el.style.overflow = 'visible';
            el.style.maxHeight = 'none';
            el.style.height = 'auto';
            el.style.webkitLineClamp = 'unset';
            el.style.webkitBoxOrient = 'unset';
            el.style.display = 'block';
            el.style.textAlign = 'center';
            el.style.lineHeight = '1.35';
            el.style.wordBreak = 'break-word';
            el.style.boxSizing = 'border-box';
        });

        // Gỡ bỏ position: sticky trên các cột bên trái trong tbody
        clonedReport.querySelectorAll<HTMLElement>('td.sticky, td[class*="sticky"]').forEach(td => {
            td.style.position = 'static';
            td.style.left = 'auto';
            td.style.top = 'auto';
            td.style.zIndex = 'auto';
            td.style.boxShadow = 'none';
        });

        // 7. Thay thế dropdown select bằng thẻ badge đẹp
        const clonedSelect = clonedReport.querySelector('select');
        if (clonedSelect) {
            const selectedText = clonedSelect.options[clonedSelect.selectedIndex]?.text || selectedCategoryFilter;
            const badge = document.createElement('div');
            badge.className = 'px-3.5 py-2 bg-[#0d9488] text-white text-xs font-black rounded-xl shadow-xs flex items-center gap-1.5';
            badge.innerHTML = `<span>📂 Ngành Hàng: ${selectedText}</span>`;
            clonedSelect.parentElement?.replaceWith(badge);
        }

        // 8. Ẩn các nút hành động (Nhận xét, Copy, Tải file, chọn độ phân giải) trên ảnh báo cáo
        clonedReport.querySelectorAll<HTMLElement>('[data-export-ignore="true"]').forEach(el => {
            el.style.display = 'none';
        });

        // Đưa vào body để trình duyệt hoàn tất layout computation
        exportContainer.appendChild(clonedReport);
        document.body.appendChild(exportContainer);

        try {
            if (document.fonts?.ready) {
                await document.fonts.ready;
            }
            // Chờ browser layout engine hoàn tất tính toán font và vị trí
            await new Promise(resolve => {
                requestAnimationFrame(() => {
                    setTimeout(resolve, 100);
                });
            });

            // Đo chiều cao thực tế của toàn bộ nội dung
            const targetHeight = clonedReport.scrollHeight || clonedReport.offsetHeight;

            // Tính toán scale theo độ phân giải được chọn (8K: 4.0x, 4K: 3.0x)
            let exportScale = exportResolution === '8K' ? 4.0 : 3.0;

            // Giới hạn an toàn tuyệt đối tránh tràn bộ nhớ canvas trình duyệt (>16k pixels)
            if (targetWidth * exportScale > 14000) {
                exportScale = Math.floor(14000 / targetWidth * 10) / 10;
            }

            const canvas = await html2canvas(clonedReport, {
                scale: exportScale,
                width: targetWidth,
                height: targetHeight,
                windowWidth: targetWidth,
                windowHeight: targetHeight,
                scrollX: 0,
                scrollY: 0,
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false,
                allowTaint: true
            });

            return canvas;
        } finally {
            if (document.body.contains(exportContainer)) {
                document.body.removeChild(exportContainer);
            }
        }
    };

    const handleCopyImageToClipboard = async () => {
        setIsExporting(true);
        try {
            const canvas = await generateCanvas4K();
            if (!canvas) {
                showToast('⚠️ Không thể tạo ảnh báo cáo!');
                setIsExporting(false);
                return;
            }

            canvas.toBlob(async blob => {
                try {
                    if (blob && navigator.clipboard && window.ClipboardItem) {
                        try {
                            await navigator.clipboard.write([
                                new ClipboardItem({ 'image/png': blob })
                            ]);
                            showToast(`📋 Đã sao chép toàn bộ bảng thi đua chuẩn Siêu Nét ${exportResolution} vào Clipboard! Nhấn Ctrl + V để dán ngay.`);
                        } catch (err: any) {
                            console.error('Lỗi clipboard, tự động chuyển sang tải file:', err);
                            handleDownloadImage();
                        }
                    } else {
                        handleDownloadImage();
                    }
                } finally {
                    setIsExporting(false);
                }
            }, 'image/png', 1.0);
        } catch (e: any) {
            console.error('Lỗi sao chép ảnh:', e);
            setIsExporting(false);
            showToast('⚠️ Không thể copy ảnh: ' + (e.message || e));
        }
    };

    const handleDownloadImage = async () => {
        if (!campaignData) return;
        setIsExporting(true);
        try {
            const canvas = await generateCanvas4K();
            if (!canvas) {
                showToast('⚠️ Không thể tạo ảnh báo cáo!');
                return;
            }
            const imgData = canvas.toDataURL('image/png', 1.0);
            const a = document.createElement('a');
            a.href = imgData;
            a.download = `TongHop_ThiDua_${campaignData.date_display || (selectedMonth + '_' + selectedYear)}_${exportResolution}.png`;
            a.click();
            showToast(`🎉 Đã tải file ảnh toàn bộ bảng thi đua chuẩn ${exportResolution} thành công!`);
        } catch (e: any) {
            console.error('Lỗi tải ảnh:', e);
            showToast('⚠️ Không thể tải ảnh: ' + (e.message || e));
        } finally {
            setIsExporting(false);
        }
    };

    // 4. XUẤT EXCEL MA TRẬN %DKHT CÁC THI ĐUA
    const handleExportExcel = async () => {
        if (!campaignData) return;
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet('Tong_Hop_Thi_Dua');

        const isPointsMode = campaignData.scoring_mode === 'POINTS';
        const headers = [
            'STT',
            'MSNV - Tên NV',
            isPointsMode ? 'Điểm Dự Kiến' : 'Dự Kiến Đạt',
            '%DKHT',
            ...campaignData.categories.map(c => getCampaignLabel(c, campaignDict))
        ];

        ws.addRow(headers);
        filteredRows.forEach(r => {
            const rowValues = [
                r.stt,
                r.display_name,
                isPointsMode ? `${r.achieved_points ?? 0}/${r.total_points ?? 0}` : `${r.achieved_count}/${r.total_count}`,
                `${r.achievement_rate}%`,
                ...campaignData.categories.map(c => `${r.campaign_rates[c] ?? 0}%`)
            ];
            ws.addRow(rowValues);
        });

        const buf = await wb.xlsx.writeBuffer();
        const blob = new Blob([buf], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `TongHop_ThiDua_NganhHang_${campaignData.date_display}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="max-w-[1720px] mx-auto space-y-4 pb-12">
            {/* Toast Thông Báo */}
            {toastMessage && (
                <div className="fixed top-5 right-5 z-50 p-4 bg-slate-900 text-white rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs border border-slate-700 animate-in fade-in slide-in-from-top-2 duration-200">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span className="font-semibold">{toastMessage}</span>
                </div>
            )}

            {/* Thanh công cụ lọc: Tháng/Năm, Siêu Thị, Chọn Phiên, Tìm kiếm, Xuất Excel */}
            <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-2.5">
                    {/* Chọn Siêu Thị */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                        <Store className="w-4 h-4 text-emerald-600" />
                        <select
                            value={selectedStore}
                            onChange={e => handleStoreChange(e.target.value)}
                            className="bg-transparent text-xs font-bold text-slate-800 outline-hidden cursor-pointer"
                        >
                            <option value="all">🏢 Toàn Cụm Siêu Thị</option>
                            {stores.map(s => (
                                <option key={s.id || s.code} value={s.name}>{s.name} ({s.code})</option>
                            ))}
                        </select>
                    </div>

                    {/* Chọn Tháng / Năm */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                        <Calendar className="w-4 h-4 text-emerald-600" />
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

                    {/* Chọn Phiên Đã Cập Nhật */}
                    {availableSessions.length > 0 && (
                        <div className="flex items-center gap-1.5 bg-blue-50/80 border border-blue-200 px-3 py-1.5 rounded-xl">
                            <Layers className="w-4 h-4 text-blue-600" />
                            <span className="font-bold text-blue-900">Phiên:</span>
                            <select
                                value={selectedSessionId}
                                onChange={e => setSelectedSessionId(e.target.value)}
                                className="bg-transparent text-xs font-bold text-blue-950 outline-hidden cursor-pointer max-w-[260px] truncate"
                            >
                                {availableSessions.map(s => (
                                    <option key={s.id} value={s.id}>
                                        {selectedStore === 'all' && s.id !== 'all_cluster_latest' ? `[${getShortStoreName(s.store_name)}] ` : ''}
                                        {s.session_title} {s.report_date ? `(${formatDate(s.report_date)})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Nút Điều Hướng Sang Trang Cập Nhật Số Liệu NV */}
                    <button
                        type="button"
                        onClick={() => navigate('/cap-nhat-luy-ke-nhan-vien')}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                        title="Đi đến phân hệ Cập nhật số liệu NV để lưu phiên mới"
                    >
                        <span>Cập Nhật Số Liệu NV</span>
                        <ArrowUpRight className="w-4 h-4" />
                    </button>

                    {/* Nút Xuất Excel */}
                    {campaignData && (
                        <button
                            type="button"
                            onClick={handleExportExcel}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-slate-200"
                        >
                            <FileSpreadsheet className="w-4 h-4 text-slate-600" />
                            <span>Xuất Excel</span>
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Tìm kiếm nhân viên */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl w-60">
                        <Search className="w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Tìm nhân viên / MSNV..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="bg-transparent text-xs outline-hidden w-full text-slate-800 placeholder-slate-400 font-medium"
                        />
                    </div>

                    <button
                        type="button"
                        onClick={loadSystemData}
                        className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition cursor-pointer"
                        title="Tải lại số liệu từ hệ thống"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
                    </button>
                </div>
            </div>

            {/* TRƯỜNG HỢP 1: CHƯA CÓ PHIÊN DỮ LIỆU HOẶC KHÔNG CÓ NHÂN VIÊN NÀO CÓ TARGET TẠI SIÊU THỊ NÀY */}
            {!campaignData || availableSessions.length === 0 || campaignData.rows.length === 0 ? (
                <div className="bg-white rounded-3xl border border-amber-200 p-12 text-center shadow-xs space-y-4 max-w-3xl mx-auto my-8">
                    <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto shadow-2xs">
                        <AlertTriangle className="w-8 h-8" />
                    </div>

                    <div className="space-y-1.5">
                        <h3 className="text-base sm:text-lg font-black text-slate-900">
                            {availableSessions.length === 0
                                ? `Chưa Có Dữ Liệu Phiên Thi Đua Cho Siêu Thị Này (Tháng ${selectedMonth}/${selectedYear})`
                                : 'Không Tìm Thấy Nhân Viên Có Khai Báo Target Tại Siêu Thị Này'}
                        </h3>
                        <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
                            {availableSessions.length === 0
                                ? `Tại siêu thị "${selectedStore === 'all' ? 'Toàn Cụm' : selectedStore}", chưa có phiên dữ liệu Doanh thu & Thi đua nào được cập nhật cho Tháng ${selectedMonth}/${selectedYear}. Vui lòng vào phân hệ Cập nhật số liệu NV để lưu phiên Doanh thu & Thi đua trước khi xem bảng báo cáo.`
                                : `Tại siêu thị "${selectedStore === 'all' ? 'Toàn Cụm' : selectedStore}", chưa có nhân sự nào được khai báo chỉ tiêu thi đua (target) cho Tháng ${selectedMonth}/${selectedYear}. Theo quy định, báo cáo chỉ hiển thị nhân sự có khai báo target và tổng thi đua có target.`}
                        </p>
                    </div>

                    <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                        <button
                            type="button"
                            onClick={() => navigate('/cap-nhat-luy-ke-nhan-vien')}
                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition cursor-pointer inline-flex items-center gap-2 shadow-sm"
                        >
                            <span>Cập Nhật Số Liệu NV</span>
                            <ArrowUpRight className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/muc-tieu-nhan-vien')}
                            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition cursor-pointer inline-flex items-center gap-2 shadow-sm"
                        >
                            <span>Khai Báo Mục Tiêu NV</span>
                            <ArrowUpRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ) : (
                /* TRƯỜNG HỢP 2: CÓ DỮ LIỆU TỪ PHIÊN HỆ THỐNG -> HIỂN THỊ BẢNG CHUẨN XÁC THEO ẢNH */
                <div ref={reportRef} data-report-table="true" className="space-y-3 bg-white p-2.5 sm:p-4 rounded-3xl border border-slate-200 shadow-sm font-avo">
                    {/* 1. HEADER BANNER XANH LỤC ĐẬM ĐỈNH CAO VỚI CHỮ VÀNG GOLD */}
                    <div className="rounded-2xl p-4 sm:p-6 bg-gradient-to-b from-[#005a43] to-[#004735] text-white shadow-md relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4">
                        {/* Hiệu ứng nền */}
                        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fde047_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

                        {/* Vùng Tiêu Đề Trung Tâm */}
                        <div className="text-center md:text-left z-10 space-y-1 mx-auto md:mx-0">
                            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#fde047] tracking-wider uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                                TỔNG HỢP THI ĐUA
                            </h1>
                            <p className="text-xs sm:text-sm font-bold text-amber-200/95 tracking-wide flex items-center justify-center md:justify-start gap-1.5">
                                <span>✨ Luỹ kế dự kiến đến ngày:</span>
                                <span className="font-mono text-white font-extrabold">{formatDate(campaignData.date_display)}</span>
                                <span className="text-amber-400">||</span>
                                <span className="text-[#fde047] font-black">{campaignData.mode_label || 'DỰ KIẾN'}</span>
                            </p>
                        </div>

                        {/* Các Nút Tác Vụ Góc Phải (Khớp 100% Ảnh) */}
                        <div className="flex items-center gap-2.5 z-10 flex-wrap justify-center">
                            {/* 1. Dropdown "TẤT CẢ NH" */}
                            <div className="relative">
                                <select
                                    value={selectedCategoryFilter}
                                    onChange={e => setSelectedCategoryFilter(e.target.value)}
                                    className="px-3.5 py-2 bg-[#0d9488] hover:bg-[#0f766e] text-white text-xs font-black rounded-xl appearance-none cursor-pointer pr-7 transition shadow-xs outline-hidden"
                                >
                                    <option value="ALL">TẤT CẢ NH</option>
                                    {campaignData.categories.map(c => (
                                        <option key={c} value={c}>{getCampaignLabel(c, campaignDict)}</option>
                                    ))}
                                </select>
                                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-white text-[10px]">
                                    ⌵
                                </span>
                            </div>

                            {/* 2. Nút "✨ NHẬN XÉT" (Màu tím neon nổi bật) */}
                            <button
                                data-export-ignore="true"
                                type="button"
                                onClick={() => setIsRemarksModalOpen(true)}
                                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-md hover:scale-[1.02] active:scale-[0.98]"
                            >
                                <Sparkles className="w-4 h-4 text-amber-300" />
                                <span>NHẬN XÉT</span>
                            </button>

                            {/* 3. Nút "📥 XUẤT ẢNH & ĐỘ NÉT" */}
                            <div data-export-ignore="true" className="flex items-center gap-1.5 bg-[#0d9488] p-1 rounded-xl shadow-xs">
                                {/* Bộ chuyển độ phân giải 4K / 8K */}
                                <div className="flex items-center bg-[#0b6e65] p-0.5 rounded-lg text-[10px] font-black">
                                    <button
                                        type="button"
                                        onClick={() => setExportResolution('4K')}
                                        className={`px-2 py-1 rounded transition cursor-pointer ${exportResolution === '4K'
                                                ? 'bg-[#fde047] text-slate-900 shadow-xs'
                                                : 'text-teal-100 hover:text-white'
                                            }`}
                                        title="Độ phân giải 4K siêu nét (~4.500px)"
                                    >
                                        4K
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setExportResolution('8K')}
                                        className={`px-2 py-1 rounded transition cursor-pointer ${exportResolution === '8K'
                                                ? 'bg-[#fde047] text-slate-900 shadow-xs'
                                                : 'text-teal-100 hover:text-white'
                                            }`}
                                        title="Độ phân giải 8K Ultra HD cực đại (~7.500px - 8.000px, phóng to không vỡ nét)"
                                    >
                                        💎 8K
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleCopyImageToClipboard}
                                    disabled={isExporting}
                                    className="px-3 py-1.5 hover:bg-[#0f766e] text-white text-xs font-black rounded-lg transition cursor-pointer flex items-center gap-1.5"
                                    title={`Copy ảnh toàn bộ bảng độ nét ${exportResolution} vào Clipboard để dán (Ctrl+V) vào Zalo`}
                                >
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>{isExporting ? 'Đang xuất...' : `Copy ${exportResolution}`}</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={handleDownloadImage}
                                    disabled={isExporting}
                                    className="p-1.5 hover:bg-[#0f766e] text-white rounded-lg transition cursor-pointer"
                                    title={`Tải file ảnh PNG độ nét ${exportResolution}`}
                                >
                                    <Download className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 2. MẪU BẢNG: STT, MSNV - TÊN NV VIẾT TẮT, DỰ KIẾN ĐẠT/TỔNG, %DKHT, TÊN CÁC THI ĐUA VIẾT TẮT */}
                    <CampaignSummaryTable
                        rows={filteredRows}
                        categories={campaignData.categories}
                        selectedCategoryFilter={selectedCategoryFilter}
                        campaignDict={campaignDict}
                    />
                </div>
            )}

            {/* Modal Nhận Xét & Phân Tích Thông Minh */}
            {campaignData && (
                <CampaignRemarksModal
                    isOpen={isRemarksModalOpen}
                    onClose={() => setIsRemarksModalOpen(false)}
                    data={campaignData}
                    campaignDict={campaignDict}
                />
            )}
        </div>
    );
}
