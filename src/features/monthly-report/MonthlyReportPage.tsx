import React, { useState, useEffect, useMemo, useRef } from "react";
import html2canvas from "html2canvas";
import { useNavigate } from "react-router-dom";
import {
    formatValue,
    getShortStoreName,
    getCampaignLabel,
    formatDate
} from "../../core/lib/formatters";
import {
    fetchBusinessRecords,
    fetchCampaignDictionary,
    type BusinessDayRecord,
    type CampaignDictItem
} from "../../core/lib/storage";
import {
    BarChart3,
    Store,
    RefreshCw,
    TrendingUp,
    AlertCircle,
    Trophy,
    Coins,
    CreditCard,
    Target,
    ArrowRight,
    ArrowUpDown,
    Filter,
    FileText,
    Download,
    Copy,
    Sparkles
} from "lucide-react";

interface EmulationRowItem {
    id: string;
    storeName: string;
    rawKey: string;
    label: string;
    target: number;
    actual: number;
    pctDK: number;
}

export default function MonthlyReportPage() {
    const navigate = useNavigate();
    // Ref chỉ bọc khu vực Summary + Bảng thi đua để xuất ảnh
    const reportRef = useRef<HTMLDivElement | null>(null);

    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
    const [selectedStore, setSelectedStore] = useState<string>("all");
    const [selectedDate, setSelectedDate] = useState<string>("latest");

    // Bộ lọc, sắp xếp và chế độ tóm tắt Zalo
    const [sortOrder, setSortOrder] = useState<string>("pct-desc");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [summaryMode, setSummaryMode] = useState<number>(1);

    const [records, setRecords] = useState<BusinessDayRecord[]>([]);
    const [campaigns, setCampaigns] = useState<CampaignDictItem[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [isProcessingImg, setIsProcessingImg] = useState<boolean>(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 2500);
    };

    // 1. TẢI DỮ LIỆU TỪ SUPABASE
    const loadData = async () => {
        setLoading(true);
        const [recordRes, campRes] = await Promise.all([
            fetchBusinessRecords(selectedMonth, selectedYear),
            fetchCampaignDictionary()
        ]);

        if (recordRes.success && recordRes.data) {
            setRecords(recordRes.data);
        } else {
            setRecords([]);
        }

        if (campRes.success && campRes.data) {
            setCampaigns(campRes.data);
        }

        setLoading(false);
    };

    useEffect(() => {
        loadData();
        setSelectedDate("latest");
    }, [selectedMonth, selectedYear]);

    // 2. DANH SÁCH SIÊU THỊ THÀNH VIÊN ĐỘC LẬP
    const storeList = useMemo(() => {
        const s = new Set<string>();
        records.forEach(r => {
            const sName = getShortStoreName(r.storeName);
            if (sName && sName !== 'Tổng' && !/^(tổng|tong)/i.test(r.storeName)) {
                s.add(sName);
            }
        });
        return Array.from(s).sort();
    }, [records]);

    // 3. DANH SÁCH NGÀY BÁO CÁO CÓ SỐ LIỆU
    const availableDates = useMemo(() => {
        return Array.from(new Set(records.map(r => r.reportDate))).sort().reverse();
    }, [records]);

    // 4. MỐC NGÀY ĐANG ĐƯỢC CHỌN ĐỂ XEM
    const activeReportDate = useMemo(() => {
        if (availableDates.length === 0) return '';
        if (selectedDate === 'latest' || !selectedDate) {
            return availableDates[0];
        }
        return selectedDate;
    }, [availableDates, selectedDate]);

    // 5. CÁC BẢN GHI TRONG MỐC NGÀY ĐƯỢC CHỌN
    const recordsInActiveDay = useMemo(() => {
        if (!activeReportDate) return [];
        return records.filter(r => r.reportDate === activeReportDate);
    }, [records, activeReportDate]);

    // 6. TÍNH TOÁN BẢN GHI TỔNG QUAN (CARD KPI)
    const currentRecord = useMemo<BusinessDayRecord | null>(() => {
        if (!activeReportDate || recordsInActiveDay.length === 0) return null;

        const isAll = selectedStore === "all" || selectedStore === "Tổng";

        if (isAll) {
            const memberStores = recordsInActiveDay.filter(r => {
                const sName = getShortStoreName(r.storeName);
                return sName !== 'Tổng' && !/^(tổng|tong)/i.test(r.storeName);
            });
            const targetList = memberStores.length > 0 ? memberStores : recordsInActiveDay;

            const totalActual = targetList.reduce((sum, r) => sum + (Number(r.revenueActual) || 0), 0);
            const totalTarget = targetList.reduce((sum, r) => sum + (Number(r.revenueTarget) || 0), 0);
            const totalInstallment = targetList.reduce((sum, r) => sum + (Number(r.revenueInstallment) || 0), 0);

            const passedDays = targetList[0]?.passedDays || new Date(activeReportDate).getDate();
            const totalDays = targetList[0]?.totalDays || 30;

            const forecastCompletionRate = (totalTarget > 0 && passedDays > 0)
                ? ((totalActual / passedDays * totalDays) / totalTarget * 100)
                : (totalTarget > 0 ? (totalActual / totalTarget * 100) : 0);

            const installmentRate = totalActual > 0 ? (totalInstallment / totalActual * 100) : 0;

            return {
                storeName: `TỔNG TOÀN CỤM (${targetList.length} SIÊU THỊ)`,
                reportDate: activeReportDate,
                month: targetList[0]?.month || selectedMonth,
                year: targetList[0]?.year || selectedYear,
                passedDays,
                totalDays,
                revenueActual: totalActual,
                revenueTarget: totalTarget,
                revenueInstallment: totalInstallment,
                installmentRate,
                forecastCompletionRate,
                emulationSummary: {},
                rawEmulation: '',
                rawRevenue: '',
                dataType: 'monthly'
            };
        }

        const singleStore = recordsInActiveDay.find(r => getShortStoreName(r.storeName) === selectedStore);
        return singleStore || null;
    }, [recordsInActiveDay, activeReportDate, selectedStore, selectedMonth, selectedYear]);

    // 7. BÓC TÁCH DANH SÁCH THI ĐUA (HIỂN THỊ ĐẦY ĐỦ TÊN SIÊU THỊ KHI XEM CỤM)
    const emulationRowList = useMemo<EmulationRowItem[]>(() => {
        if (!activeReportDate || recordsInActiveDay.length === 0) return [];

        const isAll = selectedStore === "all" || selectedStore === "Tổng";
        const rows: EmulationRowItem[] = [];

        if (isAll) {
            const memberStores = recordsInActiveDay.filter(r => {
                const sName = getShortStoreName(r.storeName);
                return sName !== 'Tổng' && !/^(tổng|tong)/i.test(r.storeName);
            });
            const targetRecords = memberStores.length > 0 ? memberStores : recordsInActiveDay;

            targetRecords.forEach(r => {
                const sName = getShortStoreName(r.storeName);
                if (r.emulationSummary) {
                    Object.entries(r.emulationSummary).forEach(([rawKey, val]) => {
                        const target = Number(val.target) || 0;
                        if (target > 0) {
                            const actual = Number(val.actual) || 0;
                            const pctDK = typeof val.pctDK === 'number' ? val.pctDK : (target > 0 ? (actual / target * 100) : 0);
                            rows.push({
                                id: `${sName}-${rawKey}`,
                                storeName: sName,
                                rawKey,
                                label: getCampaignLabel(rawKey, campaigns),
                                target,
                                actual,
                                pctDK
                            });
                        }
                    });
                }
            });
        } else {
            const shop = recordsInActiveDay.find(r => getShortStoreName(r.storeName) === selectedStore);
            if (shop?.emulationSummary) {
                const sName = getShortStoreName(shop.storeName);
                Object.entries(shop.emulationSummary).forEach(([rawKey, val]) => {
                    const target = Number(val.target) || 0;
                    if (target > 0) {
                        const actual = Number(val.actual) || 0;
                        const pctDK = typeof val.pctDK === 'number' ? val.pctDK : (target > 0 ? (actual / target * 100) : 0);
                        rows.push({
                            id: `${sName}-${rawKey}`,
                            storeName: sName,
                            rawKey,
                            label: getCampaignLabel(rawKey, campaigns),
                            target,
                            actual,
                            pctDK
                        });
                    }
                });
            }
        }

        let filtered = rows;
        if (statusFilter === "passed") {
            filtered = filtered.filter(item => item.pctDK >= 100);
        } else if (statusFilter === "failed") {
            filtered = filtered.filter(item => item.pctDK < 100);
        }

        filtered.sort((a, b) => {
            if (sortOrder === "pct-desc") return b.pctDK - a.pctDK;
            if (sortOrder === "pct-asc") return a.pctDK - b.pctDK;
            if (sortOrder === "store-asc") return a.storeName.localeCompare(b.storeName);
            if (sortOrder === "name-asc") return a.label.localeCompare(b.label);
            return 0;
        });

        return filtered;
    }, [recordsInActiveDay, activeReportDate, selectedStore, campaigns, statusFilter, sortOrder]);

    // 8. TÍNH TOÁN SỐ MỤC THI ĐUA ĐẠT / CHƯA ĐẠT CHO SUMMARY
    const emulationStats = useMemo(() => {
        const total = emulationRowList.length;
        const passed = emulationRowList.filter(d => d.pctDK >= 100).length;
        const passRate = total > 0 ? (passed / total * 100).toFixed(1) : "0.0";
        return { total, passed, passRate };
    }, [emulationRowList]);

    // 9. TÍNH TOÁN BẢNG NHỊP DOANH THU THEO TỪNG NGÀY (DAILY PACE)
    const dailyPaceData = useMemo(() => {
        if (records.length === 0) return [];

        const groupedByDate: Record<string, BusinessDayRecord[]> = {};
        records.forEach(r => {
            if (!r.reportDate) return;
            if (!groupedByDate[r.reportDate]) groupedByDate[r.reportDate] = [];
            groupedByDate[r.reportDate].push(r);
        });

        const dates = Object.keys(groupedByDate).sort();

        const paceList = dates.map(d => {
            const dayRecords = groupedByDate[d];
            if (selectedStore === "all" || selectedStore === "Tổng") {
                const memberStores = dayRecords.filter(r => {
                    const sName = getShortStoreName(r.storeName);
                    return sName !== 'Tổng' && !/^(tổng|tong)/i.test(r.storeName);
                });
                const targets = memberStores.length > 0 ? memberStores : dayRecords;
                const totalActual = targets.reduce((sum, r) => sum + (Number(r.revenueActual) || 0), 0);

                return {
                    date: d,
                    dayLabel: `Ngày ${new Date(d).getDate()}`,
                    cumulativeRevenue: totalActual,
                    dailyPace: 0
                };
            } else {
                const shop = dayRecords.find(r => getShortStoreName(r.storeName) === selectedStore);
                return {
                    date: d,
                    dayLabel: `Ngày ${new Date(d).getDate()}`,
                    cumulativeRevenue: shop ? (Number(shop.revenueActual) || 0) : 0,
                    dailyPace: 0
                };
            }
        });

        for (let i = 0; i < paceList.length; i++) {
            if (i === 0) {
                paceList[i].dailyPace = paceList[i].cumulativeRevenue;
            } else {
                paceList[i].dailyPace = Math.max(0, paceList[i].cumulativeRevenue - paceList[i - 1].cumulativeRevenue);
            }
        }

        return paceList;
    }, [records, selectedStore]);

    // 10. MODULE NHẬN XÉT & TÓM TẮT MỤC TIÊU ZALO
    const summaryText = useMemo(() => {
        if (!currentRecord) return '';

        const isAll = selectedStore === "all" || selectedStore === "Tổng";
        const dispStore = isAll ? 'TỔNG TOÀN CỤM' : selectedStore;
        let txt = `📢 BÁO CÁO THÁNG [${dispStore}] - NGÀY ${formatDate(currentRecord.reportDate)}`;

        txt += `\n\n💰 LŨY KẾ THỰC THU: ${formatValue(currentRecord.revenueActual)} (Dự báo HT: ${(currentRecord.forecastCompletionRate || 0).toFixed(1)}%)`;
        if (currentRecord.revenueInstallment > 0 || currentRecord.installmentRate > 0) {
            txt += `\n- DT trả góp: ${formatValue(currentRecord.revenueInstallment)} (${(currentRecord.installmentRate || 0).toFixed(1)}%)`;
        }
        if (currentRecord.revenueActual < currentRecord.revenueTarget) {
            txt += `\n- Cần thêm: ${formatValue(currentRecord.revenueTarget - currentRecord.revenueActual)}`;
        }

        if (emulationRowList.length > 0) {
            const targeted = emulationRowList;
            const passed = targeted.filter(d => d.pctDK >= 100);
            const passRate = targeted.length > 0 ? (passed.length / targeted.length * 100).toFixed(1) : '0';
            txt += `\n\n🎯 THI ĐUA: Đạt ${passed.length}/${targeted.length} mục (${passRate}%)`;

            const fails = targeted.filter(d => d.pctDK < 100);

            if (fails.length === 0) {
                txt += `\n\n🎉 Xuất sắc! Đã hoàn thành tất cả các chỉ tiêu!`;
            } else {
                const groupNear = fails.filter(d => d.pctDK >= 80);
                const groupSpeed = fails.filter(d => d.pctDK >= 50 && d.pctDK < 80);
                const groupAlert = fails.filter(d => d.pctDK < 50);

                if (summaryMode === 1) {
                    txt += `\n\n📊 TỔNG HỢP CHƯA ĐẠT (${fails.length} mục):`;
                    if (groupNear.length > 0) txt += `\n- ⚡ CẬN ĐÍCH (>80%): ${groupNear.length} mục`;
                    if (groupSpeed.length > 0) txt += `\n- 🔥 CẦN TĂNG TỐC (50% - 80%): ${groupSpeed.length} mục`;
                    if (groupAlert.length > 0) txt += `\n- ⚠️ BÁO ĐỘNG ĐỎ (<50%): ${groupAlert.length} mục`;
                } else if (summaryMode === 2) {
                    txt += `\n\n📊 CHI TIẾT CHƯA ĐẠT (${fails.length} mục):`;
                    if (groupNear.length > 0) {
                        txt += `\n\n⚡ CẬN ĐÍCH (>80%): ${groupNear.length} mục`;
                        groupNear.forEach(d => {
                            const prefix = isAll ? `[${d.storeName}] ` : '';
                            txt += `\n- ${prefix}${d.label}: thiếu ${formatValue(Math.max(0, d.target - d.actual))} (Dự báo: ${d.pctDK.toFixed(1)}%)`;
                        });
                    }
                    if (groupSpeed.length > 0) {
                        txt += `\n\n🔥 CẦN TĂNG TỐC (50% - 80%): ${groupSpeed.length} mục`;
                        groupSpeed.forEach(d => {
                            const prefix = isAll ? `[${d.storeName}] ` : '';
                            txt += `\n- ${prefix}${d.label}: thiếu ${formatValue(Math.max(0, d.target - d.actual))} (Dự báo: ${d.pctDK.toFixed(1)}%)`;
                        });
                    }
                    if (groupAlert.length > 0) {
                        txt += `\n\n⚠️ BÁO ĐỘNG ĐỎ (<50%): ${groupAlert.length} mục`;
                        groupAlert.forEach(d => {
                            const prefix = isAll ? `[${d.storeName}] ` : '';
                            txt += `\n- ${prefix}${d.label}: thiếu ${formatValue(Math.max(0, d.target - d.actual))} (Dự báo: ${d.pctDK.toFixed(1)}%)`;
                        });
                    }
                } else {
                    txt += `\n\n⚠️ CHI TIẾT CHƯA ĐẠT (${fails.length} mục):`;
                    fails.forEach(d => {
                        const prefix = isAll ? `[${d.storeName}] ` : '';
                        txt += `\n- ${prefix}${d.label}: thiếu ${formatValue(Math.max(0, d.target - d.actual))} (Dự báo: ${d.pctDK.toFixed(1)}%)`;
                    });
                }
            }
        }

        return txt;
    }, [currentRecord, emulationRowList, selectedStore, summaryMode]);

    const handleCopyText = () => {
        if (!summaryText) {
            showToast('Chưa có nội dung tóm tắt để sao chép!');
            return;
        }
        navigator.clipboard.writeText(summaryText);
        showToast('Đã copy nội dung nhận xét vào clipboard!');
    };

    // HÀM TẠO ẢNH 4K SIÊU NÉT (SCALE 4) - TỰ ĐỘNG BỎ QUA KHỐI BỘ LỌC
    const generate4KCanvas = async () => {
        if (!reportRef.current) return null;
        if (document.fonts?.ready) {
            await document.fonts.ready;
        }
        return await html2canvas(reportRef.current, {
            scale: 4, // Scale 4 đảm bảo độ phân giải đạt chuẩn Ultra HD 4K
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            imageTimeout: 0,
            ignoreElements: (element) => {
                // Tự động bỏ qua bất kỳ phần tử nào có cờ data-html2canvas-ignore="true"
                return element.getAttribute('data-html2canvas-ignore') === 'true';
            },
            onclone: (clonedDoc) => {
                const target = clonedDoc.querySelector('[data-capture-target="true"]') as HTMLElement;
                if (target) {
                    target.style.width = '100%';
                    target.style.maxWidth = 'none';
                }
            }
        });
    };

    // LƯU ẢNH CHẤT LƯỢNG 4K
    const handleSaveImage = async () => {
        if (!reportRef.current) return;
        setIsProcessingImg(true);

        try {
            const canvas = await generate4KCanvas();
            if (!canvas) throw new Error("Không thể khởi tạo canvas");

            const imgData = canvas.toDataURL("image/png", 1.0);
            const a = document.createElement("a");
            a.href = imgData;
            a.download = `Bao_Cao_4K_T${selectedMonth}_${selectedYear}_${selectedStore}.png`;
            a.click();
            showToast('Đã lưu file ảnh 4K độ nét cao!');
        } catch (err) {
            console.error("Lỗi khi lưu ảnh:", err);
            showToast('Có lỗi xảy ra khi tạo file ảnh!');
        } finally {
            setIsProcessingImg(false);
        }
    };

    // COPY ẢNH VÀO CLIPBOARD ĐỘ NÉT CAO
    const handleCopyImageClipboard = async () => {
        if (!reportRef.current) return;
        setIsProcessingImg(true);

        try {
            const canvas = await generate4KCanvas();
            if (!canvas) throw new Error("Không thể khởi tạo canvas");

            canvas.toBlob(blob => {
                if (blob && navigator.clipboard && window.ClipboardItem) {
                    navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
                        .then(() => showToast('Đã copy ảnh 4K vào clipboard! (Ctrl + V để dán)'))
                        .catch(() => showToast('Trình duyệt chặn copy ảnh, vui lòng dùng "LƯU ẢNH"!'));
                } else {
                    showToast('Trình duyệt không hỗ trợ copy ảnh, hãy dùng "LƯU ẢNH"!');
                }
            }, 'image/png', 1.0);
        } catch (err) {
            console.error("Lỗi khi copy ảnh:", err);
            showToast('Có lỗi khi copy ảnh vào clipboard!');
        } finally {
            setIsProcessingImg(false);
        }
    };

    const isAllMode = selectedStore === "all" || selectedStore === "Tổng";

    return (
        <div className="p-4 sm:p-6 space-y-4 max-w-full mx-auto w-full">
            {/* Toast thông báo */}
            {toastMessage && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold shadow-2xl z-50 animate-bounce">
                    {toastMessage}
                </div>
            )}

            {/* THANH ĐIỀU KHIỂN ĐÃ TÁCH THÀNH 2 HÀNG ĐỘC LẬP */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                {/* HÀNG 1: LỰA CHỌN DỮ LIỆU */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 font-bold">
                            <BarChart3 className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-base font-black text-slate-800 uppercase tracking-wide">
                                Báo Cáo Tiến Độ Doanh Thu & Thi Đua Tháng {selectedMonth}/{selectedYear}
                            </h1>
                            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                                <span>Trạng thái:</span>
                                {currentRecord ? (
                                    <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded text-[10px]">
                                        Bản ghi ngày {formatDate(currentRecord.reportDate)} (Mới nhất)
                                    </span>
                                ) : (
                                    <span className="text-amber-700 font-bold bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded text-[10px]">
                                        Chưa có dữ liệu
                                    </span>
                                )}
                            </p>
                        </div>
                    </div>

                    {/* Bộ lọc lựa chọn dữ liệu */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <select
                            value={selectedStore}
                            onChange={(e) => {
                                setSelectedStore(e.target.value);
                                setSelectedDate("latest");
                            }}
                            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                        >
                            <option value="all">🏢 TỔNG TOÀN CỤM ({storeList.length} siêu thị)</option>
                            {storeList.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>

                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(Number(e.target.value))}
                            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer"
                        >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                <option key={m} value={m}>Tháng {m}/{selectedYear}</option>
                            ))}
                        </select>

                        <select
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            disabled={availableDates.length === 0}
                            className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer disabled:opacity-50"
                        >
                            <option value="latest">⚡ Mới nhất ({availableDates[0] ? formatDate(availableDates[0]) : 'Chưa có'})</option>
                            {availableDates.map(d => (
                                <option key={d} value={d}>Ngày {formatDate(d)}</option>
                            ))}
                        </select>

                        <button
                            onClick={loadData}
                            disabled={loading}
                            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition cursor-pointer"
                            title="Tải lại số liệu"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* HÀNG 2: BUTTON BÁO CÁO */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Công cụ xuất báo cáo Ultra HD (4K)
                    </div>

                    <div className="flex items-center gap-2">
                        {currentRecord && (
                            <>
                                <button
                                    onClick={handleSaveImage}
                                    disabled={isProcessingImg}
                                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50"
                                >
                                    <Download className="w-4 h-4" />
                                    <span>{isProcessingImg ? 'ĐANG KẾT XUẤT 4K...' : 'LƯU ẢNH 4K'}</span>
                                </button>

                                <button
                                    onClick={handleCopyImageClipboard}
                                    disabled={isProcessingImg}
                                    className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50"
                                >
                                    <Copy className="w-4 h-4" />
                                    <span>COPY ẢNH 4K</span>
                                </button>

                                <button
                                    onClick={handleCopyText}
                                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                                >
                                    <FileText className="w-4 h-4 text-amber-400" />
                                    <span>COPY CHỮ</span>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* KHU VỰC HIỂN THỊ */}
            {loading ? (
                <div className="bg-white p-16 rounded-3xl border border-slate-200 text-center space-y-3">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-500" />
                    <p className="text-xs font-bold text-slate-500">Đang tổng hợp số liệu từ Supabase...</p>
                </div>
            ) : !currentRecord ? (
                <div className="bg-white p-12 sm:p-16 rounded-3xl border border-slate-200 text-center space-y-4 shadow-xs">
                    <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto border border-amber-200">
                        <AlertCircle className="w-7 h-7" />
                    </div>
                    <div className="max-w-md mx-auto space-y-1.5">
                        <h3 className="text-base font-black text-slate-800 uppercase tracking-wide">
                            Chưa có dữ liệu kinh doanh
                        </h3>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            Tháng <b>{selectedMonth}/{selectedYear}</b> {selectedStore !== 'all' ? `của siêu thị ${selectedStore}` : ''} chưa được ghi nhận bản ghi thực tế nào trên hệ thống.
                        </p>
                        <p className="text-xs font-bold text-indigo-600 pt-1">
                            👉 Vui lòng nhập dữ liệu doanh thu / thi đua từ màn hình Cập Nhật để xem báo cáo!
                        </p>
                    </div>
                    <div className="pt-2">
                        <button
                            onClick={() => navigate('/cap-nhat')}
                            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider inline-flex items-center gap-2 shadow-sm transition cursor-pointer"
                        >
                            <span>Đi Đến Màn Hình Cập Nhật</span>
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* ==============================================================
              VÙNG CHỤP ẢNH BÁO CÁO (CHỈ CHỨA BANNER + SUMMARY + BẢNG THI ĐUA)
              ============================================================== */}
                    <div
                        ref={reportRef}
                        data-capture-target="true"
                        data-report-table="true"
                        className="space-y-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm font-avo"
                    >
                        {/* 1. BANNER TIÊU ĐỀ BÁO CÁO */}
                        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-4 sm:p-5 rounded-xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <div className="flex items-center gap-2">
                                    <Store className="w-5 h-5 text-amber-400" />
                                    <h2 className="font-black text-sm sm:text-base tracking-wide uppercase">
                                        {currentRecord.storeName}
                                    </h2>
                                </div>
                                <p className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                                    <span>Số liệu ngày: <b className="text-amber-400 font-mono">{formatDate(currentRecord.reportDate)}</b></span>
                                    <span>•</span>
                                    <span>Tiến độ ngày: <b className="text-white font-mono">{currentRecord.passedDays}/{currentRecord.totalDays} ngày</b></span>
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className="bg-white/10 px-3 py-1.5 rounded-xl text-xs font-bold border border-white/10 font-mono text-emerald-400">
                                    Dự kiến HT: {(currentRecord.forecastCompletionRate || 0).toFixed(1)}%
                                </span>
                            </div>
                        </div>

                        {/* 2. CHUẨN HÓA 6 CARD SUMMARY KPI */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                            {/* Card 1: DOANH THU QĐ */}
                            <div className="bg-amber-50/70 border-l-4 border-amber-500 rounded-xl p-3 shadow-xs text-center">
                                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">DOANH THU QĐ</span>
                                <span className="text-base sm:text-lg font-black text-slate-800 font-mono mt-0.5 block">
                                    {formatValue(currentRecord.revenueActual || 0)}
                                </span>
                            </div>

                            {/* Card 2: MỤC TIÊU */}
                            <div className="bg-rose-50/70 border-l-4 border-rose-500 rounded-xl p-3 shadow-xs text-center">
                                <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider block">MỤC TIÊU</span>
                                <span className="text-base sm:text-lg font-black text-slate-800 font-mono mt-0.5 block">
                                    {formatValue(currentRecord.revenueTarget || 0)}
                                </span>
                            </div>

                            {/* Card 3: %DKHT DT */}
                            <div className="bg-sky-50/70 border-l-4 border-sky-500 rounded-xl p-3 shadow-xs text-center">
                                <span className="text-[10px] font-bold text-sky-700 uppercase tracking-wider block">%DKHT DT</span>
                                <span className={`text-base sm:text-lg font-black font-mono mt-0.5 block ${(currentRecord.forecastCompletionRate || 0) >= 100 ? 'text-emerald-600' : 'text-amber-600'
                                    }`}>
                                    {(currentRecord.forecastCompletionRate || 0).toFixed(1)}%
                                </span>
                            </div>

                            {/* Card 4: % TRẢ GÓP */}
                            <div className="bg-purple-50/70 border-l-4 border-purple-500 rounded-xl p-3 shadow-xs text-center">
                                <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">% TRẢ GÓP</span>
                                <span className="text-base sm:text-lg font-black text-purple-700 font-mono mt-0.5 block">
                                    {(currentRecord.installmentRate || 0).toFixed(1)}%
                                </span>
                            </div>

                            {/* Card 5: THI ĐUA ĐẠT */}
                            <div className="bg-slate-100/90 border-l-4 border-slate-600 rounded-xl p-3 shadow-xs text-center">
                                <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">THI ĐUA ĐẠT</span>
                                <span className="text-base sm:text-lg font-black text-slate-800 font-mono mt-0.5 block">
                                    {emulationStats.passed}/{emulationStats.total}
                                </span>
                            </div>

                            {/* Card 6: %HT THI ĐUA */}
                            <div className="bg-emerald-50/70 border-l-4 border-emerald-500 rounded-xl p-3 shadow-xs text-center">
                                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">%HT THI ĐUA</span>
                                <span className="text-base sm:text-lg font-black text-emerald-600 font-mono mt-0.5 block">
                                    {emulationStats.passRate}%
                                </span>
                            </div>
                        </div>

                        {/* 3. BẢNG KẾT QUẢ THI ĐUA (NÂNG CẤP TIÊU ĐỀ NỔI BẬT & CÓ CỜ IGNORE BỘ LỌC KHI CHỤP ẢNH) */}
                        <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                            {/* KHỐI TIÊU ĐỀ BẢNG NỔI BẬT */}
                            <div className="p-3.5 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-amber-400/20 border border-amber-300/40 flex items-center justify-center text-amber-300 shadow-inner">
                                        <Trophy className="w-4 h-4 fill-amber-300" />
                                    </div>
                                    <div>
                                        <h3 className="font-extrabold text-sm sm:text-base tracking-wide uppercase flex items-center gap-1.5 drop-shadow-xs">
                                            <span>Bảng Kết Quả Thi Đua Chi Tiết {isAllMode ? '(Toàn Cụm)' : ''}</span>
                                            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                                        </h3>
                                        <p className="text-[11px] text-blue-100 font-medium mt-0.5">
                                            Tiến độ hoàn thành chỉ tiêu các chương trình thi đua đến ngày {formatDate(currentRecord.reportDate)}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-black uppercase bg-amber-400 text-slate-950 px-3 py-1 rounded-lg shadow-sm border border-amber-300">
                                        {emulationRowList.length} NH THI ĐUA
                                    </span>
                                </div>
                            </div>

                            {/* KHỐI BỘ LỌC TRẠNG THÁI & SẮP XẾP - TỰ ĐỘNG BỊ LOẠI BỎ TRONG ẢNH CHỤP */}
                            <div
                                data-html2canvas-ignore="true"
                                className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 text-xs"
                            >
                                <div className="flex items-center gap-1.5 text-slate-500 font-bold uppercase text-[11px]">
                                    <Filter className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>Bộ lọc bảng:</span>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                    <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-xl px-2.5 py-1 shadow-2xs">
                                        <Filter className="w-3.5 h-3.5 text-slate-400" />
                                        <select
                                            value={statusFilter}
                                            onChange={(e) => setStatusFilter(e.target.value)}
                                            className="bg-transparent font-bold text-slate-700 outline-none cursor-pointer text-xs"
                                        >
                                            <option value="all">Tất cả trạng thái</option>
                                            <option value="passed">✅ Chỉ mục ĐẠT (&ge;100%)</option>
                                            <option value="failed">⚠️ Chỉ mục CHƯA ĐẠT (&lt;100%)</option>
                                        </select>
                                    </div>

                                    <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-xl px-2.5 py-1 shadow-2xs">
                                        <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                                        <select
                                            value={sortOrder}
                                            onChange={(e) => setSortOrder(e.target.value)}
                                            className="bg-transparent font-bold text-slate-700 outline-none cursor-pointer text-xs"
                                        >
                                            <option value="pct-desc">% Tiến độ giảm dần</option>
                                            <option value="pct-asc">% Tiến độ tăng dần</option>
                                            {isAllMode && <option value="store-asc">Sắp xếp theo Siêu Thị</option>}
                                            <option value="name-asc">Sắp xếp theo Tên Thi Đua</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* BẢNG SỐ LIỆU CHI TIẾT */}
                            <div className="overflow-x-auto no-scrollbar">
                                <table className="w-full text-xs text-left min-w-[760px] font-avo report-table">
                                    <thead className="bg-slate-800 text-white uppercase text-[10px] font-black border-b border-slate-700">
                                        <tr>
                                            <th className="py-3 px-3 text-center w-10">#</th>
                                            {isAllMode && (
                                                <th className="py-3 px-3 min-w-[200px]">Siêu Thị</th>
                                            )}
                                            <th className="py-3 px-3">Tên Chương Trình</th>
                                            <th className="py-3 px-3 text-center">Chỉ Tiêu Khoán</th>
                                            <th className="py-3 px-3 text-center">Lũy Kế Thực Hiện</th>
                                            <th className="py-3 px-3 text-center">% Tiến Độ (%DK)</th>
                                            <th className="py-3 px-3 text-center">Trạng Thái</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                        {emulationRowList.length === 0 ? (
                                            <tr>
                                                <td colSpan={isAllMode ? 7 : 6} className="py-8 text-center text-slate-400">
                                                    Không tìm thấy mục thi đua nào khớp với điều kiện lọc trong ngày {formatDate(currentRecord.reportDate)}.
                                                </td>
                                            </tr>
                                        ) : (
                                            emulationRowList.map((row, idx) => {
                                                const isPass = row.pctDK >= 100;
                                                return (
                                                    <tr key={row.id} className={isPass ? 'bg-[#f0fdf4] text-emerald-950' : 'bg-[#fff1f2] text-rose-950'}>
                                                        <td className="py-2.5 px-3 text-center text-slate-400 font-bold">
                                                            {idx + 1}
                                                        </td>
                                                        {isAllMode && (
                                                            <td className="py-2.5 px-3 font-bold text-slate-800 whitespace-nowrap">
                                                                <div className="flex items-center gap-1.5">
                                                                    <Store className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                                                                    <span>{row.storeName}</span>
                                                                </div>
                                                            </td>
                                                        )}
                                                        <td className="py-2.5 px-3 font-bold text-slate-800">
                                                            {row.label}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-center font-mono font-bold">
                                                            {formatValue(row.target)}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-center font-mono font-bold text-indigo-600">
                                                            {formatValue(row.actual)}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-center font-mono font-bold">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isPass ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
                                                                }`}>
                                                                {row.pctDK.toFixed(0)}%
                                                            </span>
                                                        </td>
                                                        <td className="py-2.5 px-3 text-center">
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
                    </div>

                    {/* ==============================================================
              CÁC KHỐI BÊN DƯỚI (KHÔNG NẰM TRONG HÌNH CHỤP BÁO CÁO)
              ============================================================== */}

                    {/* KHỐI THEO DÕI NHỊP DOANH THU (PACE TỪNG NGÀY) */}
                    <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                            <div>
                                <h3 className="font-black text-xs sm:text-sm text-slate-800 uppercase tracking-wide flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-indigo-600" />
                                    <span>Biến Động Nhịp Doanh Thu (Pace Từng Ngày {isAllMode ? 'Toàn Cụm' : selectedStore})</span>
                                </h3>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                    Doanh số phát sinh thực tế từng ngày = Lũy kế ngày N - Lũy kế ngày N-1
                                </p>
                            </div>

                            {dailyPaceData.length > 0 && (
                                <div className="bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-xl text-xs font-bold text-indigo-700">
                                    Nhịp ngày {dailyPaceData[dailyPaceData.length - 1]?.date}:{' '}
                                    <span className="font-mono text-indigo-950 font-black">
                                        {formatValue(dailyPaceData[dailyPaceData.length - 1]?.dailyPace || 0)}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="overflow-x-auto no-scrollbar">
                            <table className="w-full text-xs text-left min-w-[550px]">
                                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-black border-y border-slate-200">
                                    <tr>
                                        <th className="py-2.5 px-3">Ngày Ghi Nhận</th>
                                        <th className="py-2.5 px-3 text-right">Lũy Kế Hệ Thống</th>
                                        <th className="py-2.5 px-3 text-right text-indigo-600">Nhịp Ngày (Thực Thu)</th>
                                        <th className="py-2.5 px-3 text-center">Trạng Thái</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                    {dailyPaceData.map((row, idx) => (
                                        <tr key={`${row.date || 'date'}-${idx}`} className="hover:bg-slate-50 transition">
                                            <td className="py-2 px-3 font-semibold text-slate-800">
                                                {row.dayLabel} ({row.date})
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono text-slate-600">
                                                {formatValue(row.cumulativeRevenue)}
                                            </td>
                                            <td className="py-2 px-3 text-right font-mono font-bold text-indigo-600">
                                                {formatValue(row.dailyPace)}
                                            </td>
                                            <td className="py-2 px-3 text-center">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.dailyPace > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'
                                                    }`}>
                                                    {row.dailyPace > 0 ? 'Có phát sinh' : 'Chưa ghi nhận'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* MODULE NHẬN XÉT & TÓM TẮT MỤC TIÊU ZALO */}
                    {summaryText && currentRecord && (
                        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                        <FileText className="w-4 h-4 text-indigo-600" />
                                        <span>Nhận Xét & Tóm Tắt Mục Tiêu Zalo</span>
                                    </span>

                                    {/* Bộ 3 nút chuyển chế độ tóm tắt */}
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
            )}
        </div>
    );
}