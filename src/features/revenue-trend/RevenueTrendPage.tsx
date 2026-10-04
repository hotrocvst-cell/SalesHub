import React, { useState, useEffect, useMemo, useRef } from 'react';
import html2canvas from 'html2canvas';
import {
    fetchMonthlyRecordsForChart,
    type BusinessDayRecord
} from '../../core/lib/storage';
import { formatValue, getShortStoreName, formatDate } from '../../core/lib/formatters';
import {
    TrendingUp,
    Store,
    RefreshCw,
    Coins,
    Target,
    Camera,
    Layers,
    ArrowUpRight
} from 'lucide-react';

interface DailyAggregatedData {
    reportDate: string;
    dayLabel: string;
    revenueActual: number;
    revenueTarget: number;
    revenueInstallment: number;
    dailyPace: number;
    completionRate: number;
    storesCount: number;
}

export default function RevenueTrendPage() {
    const chartRef = useRef<HTMLDivElement | null>(null);

    const today = new Date();
    const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
    const [selectedStore, setSelectedStore] = useState<string>('Tổng');

    const [rawRecords, setRawRecords] = useState<BusinessDayRecord[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [isCapturing, setIsCapturing] = useState<boolean>(false);

    // 1. TẢI DỮ LIỆU TỪ SUPABASE
    const loadData = async () => {
        setLoading(true);
        const res = await fetchMonthlyRecordsForChart(selectedMonth, selectedYear);
        if (res.success && res.data) {
            setRawRecords(res.data);
        } else {
            setRawRecords([]);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, [selectedMonth, selectedYear]);

    // 2. DANH SÁCH SIÊU THỊ ĐỘC LẬP (LOẠI BỎ BẢN GHI TỔNG CÓ SẴN)
    const storeList = useMemo(() => {
        const set = new Set<string>();
        rawRecords.forEach(r => {
            const sName = getShortStoreName(r.storeName);
            if (sName && sName !== 'Tổng' && !/^(tổng|tong)/i.test(r.storeName)) {
                set.add(sName);
            }
        });
        return Array.from(set).sort();
    }, [rawRecords]);

    // 3. TẬP HỢP SỐ LIỆU VÀ TÍNH TOÁN NHỊP PHÁT SINH CHUẨN XÁC
    const timelineData = useMemo<DailyAggregatedData[]>(() => {
        if (rawRecords.length === 0) return [];

        // Lọc và chuẩn hóa bản ghi: nếu cùng 1 shop có nhiều bản ghi trong cùng 1 ngày, lấy bản ghi có doanh thu mới nhất/cao nhất
        const cleanedRecords: BusinessDayRecord[] = [];
        const storeDateMap = new Map<string, BusinessDayRecord>();

        rawRecords.forEach(r => {
            if (!r.reportDate) return;
            const sName = getShortStoreName(r.storeName);
            const key = `${r.reportDate}_${sName}`;
            const existing = storeDateMap.get(key);
            if (!existing || (Number(r.revenueActual) || 0) > (Number(existing.revenueActual) || 0)) {
                storeDateMap.set(key, r);
            }
        });

        storeDateMap.forEach(r => cleanedRecords.push(r));

        // Nhóm bản ghi theo từng siêu thị riêng biệt để tính nhịp từng shop trước
        const recordsByStore: Record<string, BusinessDayRecord[]> = {};
        cleanedRecords.forEach(r => {
            const sName = getShortStoreName(r.storeName);
            if (!recordsByStore[sName]) recordsByStore[sName] = [];
            recordsByStore[sName].push(r);
        });

        // Map lưu nhịp phát sinh theo từng shop từng ngày: key = `${date}_${sName}` => dailyPace
        const paceByStoreDate = new Map<string, number>();

        Object.entries(recordsByStore).forEach(([sName, sRecords]) => {
            // Sắp xếp ngày tăng dần
            sRecords.sort((a, b) => new Date(a.reportDate).getTime() - new Date(b.reportDate).getTime());

            sRecords.forEach((rec, idx) => {
                const curRev = Number(rec.revenueActual) || 0;
                let pace = 0;

                if (idx === 0) {
                    const dayNum = new Date(rec.reportDate).getDate();
                    const passed = Number(rec.passedDays) || dayNum || 1;
                    if (dayNum === 1 || passed <= 1) {
                        pace = curRev;
                    } else {
                        // Nếu ngày đầu ghi nhận đã là giữa tháng, tính nhịp bình quân ngày đã qua
                        pace = Math.round(curRev / passed);
                    }
                } else {
                    const prevRev = Number(sRecords[idx - 1].revenueActual) || 0;
                    const prevDate = new Date(sRecords[idx - 1].reportDate);
                    const curDate = new Date(rec.reportDate);
                    const diffDays = Math.max(1, Math.round((curDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)));

                    const diffRev = Math.max(0, curRev - prevRev);
                    // Nếu ngày liên tiếp thì lấy nguyên số chênh lệch, nếu cách nhiều ngày thì chia đều theo ngày
                    pace = diffDays === 1 ? diffRev : Math.round(diffRev / diffDays);
                }

                paceByStoreDate.set(`${rec.reportDate}_${sName}`, pace);
            });
        });

        // Nhóm theo ngày để tổng hợp lên bảng / biểu đồ
        const groupedByDate: Record<string, BusinessDayRecord[]> = {};
        cleanedRecords.forEach(r => {
            if (!groupedByDate[r.reportDate]) groupedByDate[r.reportDate] = [];
            groupedByDate[r.reportDate].push(r);
        });

        const dates = Object.keys(groupedByDate).sort();
        const dailyResult: DailyAggregatedData[] = [];

        dates.forEach(date => {
            const recordsInDate = groupedByDate[date];

            if (selectedStore === 'Tổng') {
                // Lọc bỏ dòng mang tên Tổng nếu có sẵn
                const memberStores = recordsInDate.filter(r => {
                    const sName = getShortStoreName(r.storeName);
                    return sName !== 'Tổng' && !/^(tổng|tong)/i.test(r.storeName);
                });
                const targetRecords = memberStores.length > 0 ? memberStores : recordsInDate;

                const totalActual = targetRecords.reduce((sum, r) => sum + (Number(r.revenueActual) || 0), 0);
                const totalTarget = targetRecords.reduce((sum, r) => sum + (Number(r.revenueTarget) || 0), 0);
                const totalInstallment = targetRecords.reduce((sum, r) => sum + (Number(r.revenueInstallment) || 0), 0);
                const completionRate = totalTarget > 0 ? (totalActual / totalTarget * 100) : 0;

                // Tổng nhịp cụm = tổng nhịp của từng shop thành viên trong ngày đó
                const totalPace = targetRecords.reduce((sum, r) => {
                    const sName = getShortStoreName(r.storeName);
                    return sum + (paceByStoreDate.get(`${date}_${sName}`) || 0);
                }, 0);

                dailyResult.push({
                    reportDate: date,
                    dayLabel: `Ngày ${formatDate(date, 'dd/mm')}`,
                    revenueActual: totalActual,
                    revenueTarget: totalTarget,
                    revenueInstallment: totalInstallment,
                    dailyPace: totalPace,
                    completionRate,
                    storesCount: targetRecords.length
                });
            } else {
                // Xem riêng 1 siêu thị
                const shopRecord = recordsInDate.find(r => getShortStoreName(r.storeName) === selectedStore);
                if (shopRecord) {
                    const actual = Number(shopRecord.revenueActual) || 0;
                    const target = Number(shopRecord.revenueTarget) || 0;
                    const installment = Number(shopRecord.revenueInstallment) || 0;
                    const completionRate = target > 0 ? (actual / target * 100) : 0;
                    const pace = paceByStoreDate.get(`${date}_${selectedStore}`) || 0;

                    dailyResult.push({
                        reportDate: date,
                        dayLabel: `Ngày ${formatDate(date, 'dd/mm')}`,
                        revenueActual: actual,
                        revenueTarget: target,
                        revenueInstallment: installment,
                        dailyPace: pace,
                        completionRate,
                        storesCount: 1
                    });
                }
            }
        });

        return dailyResult;
    }, [rawRecords, selectedStore]);

    // BẢN GHI MỚI NHẤT TRONG TIMELINE
    const latestData = useMemo(() => {
        if (timelineData.length === 0) return null;
        return timelineData[timelineData.length - 1];
    }, [timelineData]);

    // Giá trị nhịp ngày cao nhất để chuẩn hóa thanh biểu đồ
    const maxPace = useMemo(() => {
        return Math.max(...timelineData.map(d => d.dailyPace), 1);
    }, [timelineData]);

    // CHỤP BÁO CÁO CHUẨN 4K
    const handleCapture = async () => {
        if (!chartRef.current) return;
        setIsCapturing(true);
        try {
            if (document.fonts?.ready) {
                await document.fonts.ready;
            }
            const canvas = await html2canvas(chartRef.current, {
                scale: 4, // Chuẩn độ phân giải 4K Ultra HD
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false
            });
            const a = document.createElement('a');
            a.href = canvas.toDataURL('image/png', 1.0);
            a.download = `Nhip_Doanh_Thu_4K_T${selectedMonth}_${selectedYear}_${selectedStore}.png`;
            a.click();
        } catch (err) {
            console.error('Lỗi chụp ảnh:', err);
        } finally {
            setIsCapturing(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 space-y-4 max-w-full mx-auto w-full">
            {/* THANH ĐIỀU KHIỂN & BỘ LỌC */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center font-bold">
                        <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-base font-black text-slate-800 uppercase tracking-wide">
                            Nhịp Doanh Thu & Diễn Biến Tăng Trưởng
                        </h1>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Theo dõi nhịp thực thu từng ngày, cộng dồn tổng thể cụm và tiến độ chỉ tiêu tháng {selectedMonth}/{selectedYear}
                        </p>
                    </div>
                </div>

                {/* BỘ LỌC */}
                <div className="flex items-center gap-2 flex-wrap">
                    <select
                        value={selectedStore}
                        onChange={(e) => setSelectedStore(e.target.value)}
                        className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                        <option value="Tổng">🏢 TỔNG TOÀN CỤM ({storeList.length} siêu thị)</option>
                        {storeList.map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>

                    <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(Number(e.target.value))}
                        className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                            <option key={m} value={m}>Tháng {m}/{selectedYear}</option>
                        ))}
                    </select>

                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition cursor-pointer"
                        title="Làm mới số liệu"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>

                    {timelineData.length > 0 && (
                        <button
                            onClick={handleCapture}
                            disabled={isCapturing}
                            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50"
                        >
                            <Camera className="w-4 h-4" />
                            <span>{isCapturing ? 'ĐANG KẾT XUẤT 4K...' : 'LƯU ẢNH 4K'}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* KHU VỰC HIỂN THỊ DỮ LIỆU */}
            {loading ? (
                <div className="bg-white p-16 rounded-3xl border border-slate-200 text-center space-y-3">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-500" />
                    <p className="text-xs font-bold text-slate-500">Đang tổng hợp số liệu diễn biến tháng...</p>
                </div>
            ) : timelineData.length === 0 ? (
                <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 space-y-2">
                    <Layers className="w-10 h-10 text-slate-300 mx-auto" />
                    <h3 className="font-bold text-sm text-slate-700">Chưa có bản ghi nào cho tháng {selectedMonth}/{selectedYear}</h3>
                    <p className="text-xs text-slate-400">Vui lòng kiểm tra lại bảng daily_business_records hoặc nhập dữ liệu mới.</p>
                </div>
            ) : (
                <div ref={chartRef} data-report-table="true" className="space-y-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm font-avo">
                    {/* 3 CARD CHỈ SỐ LŨY KẾ CỦA MỐC GẦN NHẤT */}
                    {latestData && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                                <div className="flex items-center justify-between text-slate-400 mb-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider">
                                        {selectedStore === 'Tổng' ? 'Tổng Lũy Kế Cụm' : 'Lũy Kế Thực Thu'}
                                    </span>
                                    <Coins className="w-4 h-4 text-emerald-600" />
                                </div>
                                <p className="text-xl font-black font-mono text-emerald-700">
                                    {formatValue(latestData.revenueActual)}
                                </p>
                                <p className="text-[11px] text-slate-400 mt-1">
                                    Tính đến ngày {formatDate(latestData.reportDate)} ({latestData.storesCount} siêu thị)
                                </p>
                            </div>

                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                                <div className="flex items-center justify-between text-slate-400 mb-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider">
                                        {selectedStore === 'Tổng' ? 'Tổng Chỉ Tiêu Cụm' : 'Chỉ Tiêu Khoán'}
                                    </span>
                                    <Target className="w-4 h-4 text-indigo-600" />
                                </div>
                                <p className="text-xl font-black font-mono text-slate-800">
                                    {formatValue(latestData.revenueTarget)}
                                </p>
                                <p className="text-[11px] text-slate-400 mt-1">
                                    Tiến độ hoàn thành: <b className="font-mono text-indigo-600">{latestData.completionRate.toFixed(1)}%</b>
                                </p>
                            </div>

                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                                <div className="flex items-center justify-between text-slate-400 mb-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Nhịp Thực Thu Ngày Gần Nhất</span>
                                    <ArrowUpRight className="w-4 h-4 text-amber-600" />
                                </div>
                                <p className="text-xl font-black font-mono text-amber-600">
                                    {formatValue(latestData.dailyPace)}
                                </p>
                                <p className="text-[11px] text-slate-400 mt-1">
                                    Phát sinh riêng ngày {formatDate(latestData.reportDate)}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* BIỂU ĐỒ CỘT MINI DIỄN BIẾN NHỊP NGÀY */}
                    <div className="bg-slate-50/70 p-4 sm:p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                            <h3 className="font-black text-xs sm:text-sm text-slate-800 uppercase tracking-wide flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-indigo-600" />
                                <span>Biểu Đồ Nhịp Thực Thu Từng Ngày (Pace Hàng Ngày)</span>
                            </h3>
                            <span className="text-[11px] font-mono font-bold text-slate-500">
                                {timelineData.length} ngày ghi nhận
                            </span>
                        </div>

                        {/* Container vẽ cột */}
                        <div className="h-44 flex items-end gap-1.5 sm:gap-2 pt-6 pb-2 overflow-x-auto no-scrollbar">
                            {timelineData.map((d) => {
                                const heightPercent = Math.max(8, Math.round((d.dailyPace / maxPace) * 100));
                                return (
                                    <div key={d.reportDate} className="flex-1 min-w-[28px] flex flex-col items-center gap-1 group relative">
                                        {/* Tooltip khi hover */}
                                        <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition pointer-events-none bg-slate-900 text-white text-[9px] px-2 py-1 rounded shadow-md z-20 whitespace-nowrap font-mono">
                                            {formatDate(d.reportDate)}: {formatValue(d.dailyPace)}
                                        </div>

                                        <div className="w-full bg-slate-200/70 rounded-t-md flex items-end h-32 overflow-hidden">
                                            <div
                                                className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t-md transition-all group-hover:from-emerald-500 group-hover:to-emerald-400"
                                                style={{ height: `${heightPercent}%` }}
                                            />
                                        </div>
                                        <span className="text-[9px] font-mono text-slate-500 font-bold truncate">
                                            {formatDate(d.reportDate, 'dd/mm')}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* BẢNG CHI TIẾT TỪNG NGÀY */}
                    <div data-report-table="true" className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs font-avo">
                        <div className="p-3.5 bg-slate-50 border-b border-slate-200">
                            <h3 className="font-black text-xs uppercase text-slate-700 tracking-wider">
                                Bảng Thống Kê Chi Tiết {selectedStore === 'Tổng' ? 'Cụm' : selectedStore} Theo Ngày
                            </h3>
                        </div>
                        <div className="overflow-x-auto no-scrollbar">
                            <table className="w-full text-xs text-left font-avo report-table">
                                <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-black border-b border-slate-200">
                                    <tr>
                                        <th className="py-2.5 px-3">Ngày Báo Cáo</th>
                                        <th className="py-2.5 px-3 text-right">Lũy Kế Thực Thu</th>
                                        <th className="py-2.5 px-3 text-right text-indigo-700">Nhịp Phát Sinh Ngày</th>
                                        <th className="py-2.5 px-3 text-right">Chỉ Tiêu Tháng</th>
                                        <th className="py-2.5 px-3 text-right">% Hoàn Thành</th>
                                        <th className="py-2.5 px-3 text-right">Doanh Số Trả Góp</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                    {timelineData.map((d) => (
                                        <tr key={d.reportDate} className="hover:bg-slate-50 transition">
                                            <td className="py-2.5 px-3 font-semibold text-slate-800">
                                                {d.dayLabel} ({formatDate(d.reportDate)})
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-600">
                                                {formatValue(d.revenueActual)}
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-600">
                                                +{formatValue(d.dailyPace)}
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                                                {formatValue(d.revenueTarget)}
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-mono">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${d.completionRate >= 100 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                    {d.completionRate.toFixed(1)}%
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-right font-mono text-purple-600">
                                                {formatValue(d.revenueInstallment)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}