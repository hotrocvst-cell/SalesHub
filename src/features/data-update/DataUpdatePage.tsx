import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getLocalDraft, saveLocalDraft, clearLocalDraft, syncBatchDailyRecordsToSupabase, type BusinessDayRecord } from '../../core/lib/storage';
import { getYesterdayDateString, getShortStoreName, getCampaignLabel, formatDate, formatDateTime } from '../../core/lib/formatters';
import { Save, Trash2, Calendar, RefreshCw, CheckCircle2, ArrowRight, CloudUpload, Store, RotateCcw, AlertCircle } from 'lucide-react';

export default function DataUpdatePage() {
    const navigate = useNavigate();

    // Khởi tạo ngày chốt là hôm qua (Hôm nay - 1)
    const [reportDate, setReportDate] = useState<string>(() => getYesterdayDateString());

    // 1. Số ngày đã qua (Nhịp passed) : tự động cập nhật theo ngày hiện tại - 1
    const [passedDays, setPassedDays] = useState<number>(() => {
        const now = new Date();
        const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        return y.getDate();
    });

    // 2. Tổng số ngày của tháng : tự động cập nhật theo tổng số ngày của tháng hiện tại
    const [totalDays, setTotalDays] = useState<number>(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    });

    const [emulationRaw, setEmulationRaw] = useState<string>('');
    const [revenueRaw, setRevenueRaw] = useState<string>('');
    const [savedTime, setSavedTime] = useState<string>('');
    const [detectedStores, setDetectedStores] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [toastMessage, setToastMessage] = useState<string>('');
    const [isDraftSynced, setIsDraftSynced] = useState<boolean>(false);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 3000);
    };

    // Nạp dữ liệu bản nháp (Giữ nguyên số liệu dán nháp nhưng KHÔNG ghi đè passedDays và totalDays để luôn theo ngày hiện tại)
    useEffect(() => {
        const draft = getLocalDraft();
        if (draft) {
            setEmulationRaw(draft.rawEmulation || '');
            setRevenueRaw(draft.rawRevenue || '');
            if (draft.updatedAt) {
                setSavedTime(formatDateTime(draft.updatedAt));
            }
            if (draft.isSynced) {
                setIsDraftSynced(true);
            }
        }
    }, []);

    // Xử lý khi người dùng đổi ngày chốt
    const handleReportDateChange = (val: string) => {
        setReportDate(val);
        if (val) {
            const [y, m, d] = val.split('-').map(Number);
            if (y && m && d) {
                setPassedDays(d);
                setTotalDays(new Date(y, m, 0).getDate());
            }
        }
    };

    // Nút reset nhịp về ngày hiện tại - 1 và tổng ngày tháng hiện tại
    const handleResetDateDefaults = () => {
        const now = new Date();
        const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        setReportDate(getYesterdayDateString());
        setPassedDays(y.getDate());
        setTotalDays(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());
        showToast('🔄 Đã cập nhật lại nhịp theo ngày hôm nay - 1');
    };

    // Parser Doanh Thu chuẩn hóa theo file thực tế
    const parseRevenueRawToMap = () => {
        const storeRecordsMap: Record<string, Partial<BusinessDayRecord>> = {};
        const lines = revenueRaw.split('\n').map(l => l.trim()).filter(Boolean);

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.startsWith('Đơn vị') || line.includes('triệu đồng') || line.startsWith('Siêu thị')) continue;

            let storeRawName = '';
            let parts: string[] = [];

            // Dạng 1: Tên siêu thị ở 1 dòng, số liệu ở dòng kế tiếp
            const isStoreHeaderOnly = /^(aar_|tgd_|đmx_|dmx_|\d+\s*-)/i.test(line) && !line.includes('\t');
            if (isStoreHeaderOnly && i + 1 < lines.length) {
                storeRawName = line;
                parts = lines[i + 1].split(/\t|\s{2,}/).map(x => x.trim()).filter(Boolean);
                i++;
            } else {
                // Dạng 2: Cùng nằm trên 1 dòng
                const inlineParts = line.split(/\t/).map(x => x.trim()).filter(Boolean);
                if (inlineParts.length >= 7 && /^(aar_|tgd_|đmx_|dmx_|\d+\s*-)/i.test(inlineParts[0])) {
                    storeRawName = inlineParts[0];
                    parts = inlineParts.slice(1);
                }
            }

            if (storeRawName && parts.length >= 6 && !/^(tổng|tong)/i.test(storeRawName)) {
                const sName = getShortStoreName(storeRawName);
                const rev = parseFloat(String(parts[1] || '0').replace(/,/g, '')) || 0;
                const target = parseFloat(String(parts[4] || '0').replace(/,/g, '')) || 0;
                const dtTraGop = parseFloat(String(parts[8] || '0').replace(/,/g, '')) || 0;
                const pctTraGop = parseFloat(String(parts[9] || '0').replace(/%/g, '').replace(/,/g, '')) || 0;
                const forecastRate = (target > 0 && passedDays > 0)
                    ? ((rev / passedDays * totalDays) / target) * 100
                    : 0;

                storeRecordsMap[sName] = {
                    storeName: storeRawName,
                    reportDate,
                    passedDays,
                    totalDays,
                    revenueActual: rev,
                    revenueTarget: target,
                    revenueInstallment: dtTraGop,
                    installmentRate: pctTraGop,
                    forecastCompletionRate: Number(forecastRate.toFixed(2)),
                    emulationSummary: {},
                    rawEmulation: '',
                    rawRevenue: line
                };
            }
        }
        return storeRecordsMap;
    };

    // Cập nhật danh sách siêu thị nhận diện được
    useEffect(() => {
        const storeMap = parseRevenueRawToMap();
        setDetectedStores(Object.keys(storeMap));
    }, [revenueRaw, passedDays, totalDays, reportDate]);

    // Thao tác Lưu đồng bộ nhiều siêu thị
    const handleSave = async () => {
        if (!emulationRaw.trim() && !revenueRaw.trim()) {
            showToast('⚠️ Vui lòng nhập dữ liệu trước khi lưu!');
            return;
        }

        setIsSaving(true);

        // 1. Lưu bản nháp cục bộ
        saveLocalDraft({
            rawEmulation: emulationRaw,
            rawRevenue: revenueRaw,
            passedDays,
            totalDays
        });

        const selectedD = new Date(reportDate);
        const month = selectedD.getMonth() + 1;
        const year = selectedD.getFullYear();

        // 2. Lấy dữ liệu doanh thu từng siêu thị
        const storeRecordsMap = parseRevenueRawToMap();

        // 3. Bóc tách Thi đua ghép vào từng siêu thị
        let curHeader = '';
        emulationRaw.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (!trimmed) return;
            const parts = trimmed.split(/\t|\s{2,}/).filter(Boolean);
            const firstCol = parts[0] || '';

            const isHeader = (
                (trimmed.toLowerCase().includes('target') ||
                    trimmed.toLowerCase().includes('lũy kế') ||
                    trimmed.toLowerCase().includes('% ht')) &&
                !/^(tổng|tong|aar|tgd|đmx|dmx|\d+)/i.test(firstCol)
            );

            if (isHeader) {
                curHeader = firstCol;
                return;
            }

            if (curHeader && parts.length >= 3 && !/^(tổng|tong)/i.test(firstCol)) {
                const sName = getShortStoreName(firstCol);
                if (storeRecordsMap[sName]) {
                    const act = parseFloat(String(parts[1] || '0').replace(/,/g, '')) || 0;
                    const tg = parseFloat(String(parts[2] || '0').replace(/,/g, '')) || 0;
                    const pctDK = (tg > 0 && passedDays > 0)
                        ? ((act / passedDays * totalDays) / tg) * 100
                        : 0;

                    const label = getCampaignLabel(curHeader);
                    if (!storeRecordsMap[sName].emulationSummary) {
                        storeRecordsMap[sName].emulationSummary = {};
                    }
                    storeRecordsMap[sName].emulationSummary![label] = {
                        target: tg,
                        actual: act,
                        pctDK: Number(pctDK.toFixed(1))
                    };
                }
            }
        });

        // 4. Chuẩn hóa payload
        const finalRecords: BusinessDayRecord[] = Object.values(storeRecordsMap).map(rec => ({
            ...rec,
            reportDate,
            month,
            year,
            passedDays,
            totalDays,
            rawEmulation: emulationRaw,
            rawRevenue: revenueRaw
        })) as BusinessDayRecord[];

        // 5. Lưu batch lên Supabase
        let saveResult = { success: false, count: 0 };
        if (finalRecords.length > 0) {
            saveResult = await syncBatchDailyRecordsToSupabase(finalRecords);
        }

        setIsSaving(false);
        const now = new Date();
        setSavedTime(formatDateTime(now));

        if (saveResult.success) {
            setIsDraftSynced(true);
            saveLocalDraft({
                rawEmulation: emulationRaw,
                rawRevenue: revenueRaw,
                passedDays,
                totalDays,
                isSynced: true,
                updatedAt: now.toISOString()
            });
            showToast(`💾 Đã bóc tách & lưu ${finalRecords.length} siêu thị thành công lên Supabase Cloud!`);
        } else {
            setIsDraftSynced(false);
            saveLocalDraft({
                rawEmulation: emulationRaw,
                rawRevenue: revenueRaw,
                passedDays,
                totalDays,
                isSynced: false,
                updatedAt: now.toISOString()
            });
            showToast('⚠️ Đã lưu bản nháp trên máy (Chưa đồng bộ Cloud)');
        }
    };

    const handleClear = () => {
        if (window.confirm('Bạn có muốn xóa dữ liệu bản nháp này không?')) {
            clearLocalDraft();
            setEmulationRaw('');
            setRevenueRaw('');
            setSavedTime('');
            setDetectedStores([]);
            setIsDraftSynced(false);
            showToast('Đã xóa bản nháp!');
        }
    };

    return (
        <div className="p-4 sm:p-6 space-y-5 max-w-[1050px] mx-auto w-full">
            {toastMessage && (
                <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold">
                    {toastMessage}
                </div>
            )}

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                    <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <RefreshCw className="w-5 h-5 text-emerald-600" />
                        <span>Cập Nhật Bảng Dữ Liệu Kinh Doanh Tổng</span>
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Dán bảng tổng hợp: hệ thống tự động bóc tách lưu riêng từng siêu thị để tính toán Cụm và vẽ biểu đồ nhịp.
                    </p>
                </div>

                {savedTime && (
                    <div className="text-xs flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-xl border border-emerald-200 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Lưu gần nhất: {savedTime}</span>
                    </div>
                )}
            </div>

            {/* BANNER CẢNH BÁO DỮ LIỆU CHƯA ĐỒNG BỘ SUPABASE */}
            {(emulationRaw.trim() || revenueRaw.trim()) && !isDraftSynced && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 shadow-xs animate-in fade-in duration-200">
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-amber-100 text-amber-700 shrink-0">
                            <AlertCircle className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <h3 className="font-extrabold text-xs uppercase tracking-wider text-amber-900 flex items-center gap-2">
                                <span>⚠️ Bản nháp dữ liệu kinh doanh chưa đồng bộ lên Supabase Cloud!</span>
                            </h3>
                            <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                                {savedTime ? `Đã lưu bản nháp cục bộ lúc ${savedTime}. ` : 'Dữ liệu mới nhập chưa được lưu. '}
                                Dữ liệu chưa được đồng bộ lên Supabase Cloud. Báo cáo tổng thể và biểu đồ cụm sẽ chưa có số liệu này.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50"
                        >
                            <CloudUpload className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
                            <span>{isSaving ? 'ĐANG ĐỒNG BỘ...' : '⚡ ĐỒNG BỘ LÊN CLOUD NGAY'}</span>
                        </button>
                    </div>
                </div>
            )}

            {isDraftSynced && (emulationRaw.trim() || revenueRaw.trim()) && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 flex items-center justify-between text-xs text-emerald-800 shadow-2xs">
                    <div className="flex items-center gap-2 font-medium">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span><b>Supabase Cloud:</b> Bản ghi dữ liệu ngày <b>{formatDate(reportDate)}</b> ({detectedStores.length} siêu thị) đã đồng bộ trực tuyến.</span>
                    </div>
                </div>
            )}

            {/* Cấu hình ngày chốt & nhịp */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase">
                        <Calendar className="w-4 h-4 text-emerald-600" />
                        <span>Kỳ chốt số liệu: <b className="text-emerald-700 font-mono">{formatDate(reportDate)}</b></span>
                        <span className="text-[11px] text-slate-400 font-normal lowercase">(mặc định hôm qua)</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {detectedStores.length > 0 && (
                            <div className="flex items-center gap-1.5 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                                <Store className="w-3.5 h-3.5 text-blue-600" />
                                <span className="text-[11px] font-bold text-blue-700">
                                    Nhận diện {detectedStores.length} siêu thị
                                </span>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={handleResetDateDefaults}
                            className="text-[11px] text-slate-500 hover:text-emerald-700 bg-slate-100 hover:bg-emerald-50 px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 cursor-pointer"
                            title="Tự động đồng bộ lại nhịp theo ngày hôm nay"
                        >
                            <RotateCcw className="w-3 h-3 text-emerald-600" />
                            <span>Lấy lại nhịp theo hôm nay</span>
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-[11px] font-bold text-slate-500 uppercase">
                                Ngày chốt (Report Date)
                            </label>
                            {reportDate && (
                                <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                    {formatDate(reportDate)}
                                </span>
                            )}
                        </div>
                        <input
                            type="date"
                            value={reportDate}
                            onChange={(e) => handleReportDateChange(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                        />
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-[11px] font-bold text-slate-500 uppercase">
                                Số ngày đã qua (Nhịp passed)
                            </label>
                            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                Tự động: Hôm nay - 1
                            </span>
                        </div>
                        <input
                            type="number"
                            min={1}
                            max={31}
                            value={passedDays}
                            onChange={(e) => setPassedDays(Number(e.target.value))}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                        />
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-[11px] font-bold text-slate-500 uppercase">
                                Tổng số ngày của tháng
                            </label>
                            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                Tháng hiện tại
                            </span>
                        </div>
                        <input
                            type="number"
                            min={28}
                            max={31}
                            value={totalDays}
                            onChange={(e) => setTotalDays(Number(e.target.value))}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                        />
                    </div>
                </div>
            </div>

            {/* Ô dán dữ liệu */}
            <div className="space-y-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-1.5 shadow-xs">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                        <span>1. Dữ liệu Thi Đua Lũy Kế</span>
                        <span className="text-[10px] text-slate-400 font-normal">Định dạng tiêu đề & các hàng siêu thị</span>
                    </label>
                    <textarea
                        rows={5}
                        value={emulationRaw}
                        onChange={(e) => {
                            setEmulationRaw(e.target.value);
                            setIsDraftSynced(false);
                        }}
                        placeholder="Dán dữ liệu báo cáo thi đua lũy kế của toàn cụm..."
                        className="w-full text-[11px] font-mono p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 resize-none leading-relaxed text-slate-700"
                    />
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-1.5 shadow-xs">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                        <span>2. Dữ liệu Doanh Thu Lũy Kế (Copy từ Dashboard BI)</span>
                        <span className="text-[10px] text-slate-400 font-normal">Hỗ trợ bảng copy trực tiếp từ web nội bộ</span>
                    </label>
                    <textarea
                        rows={5}
                        value={revenueRaw}
                        onChange={(e) => {
                            setRevenueRaw(e.target.value);
                            setIsDraftSynced(false);
                        }}
                        placeholder="Dán dữ liệu báo cáo doanh thu lũy kế của toàn cụm..."
                        className="w-full text-[11px] font-mono p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 resize-none leading-relaxed text-slate-700"
                    />
                </div>
            </div>

            {/* Nút điều khiển */}
            <div className="flex items-center justify-between pt-2">
                <button
                    onClick={handleClear}
                    className="px-4 py-2.5 rounded-xl border border-rose-300 text-rose-600 hover:bg-rose-50 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                >
                    <Trash2 className="w-4 h-4" />
                    <span>XÓA BẢN NHÁP</span>
                </button>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50"
                    >
                        {isSaving ? <CloudUpload className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        <span>{isSaving ? 'ĐANG TÁCH & LƯU...' : '💾 LƯU DỮ LIỆU ĐA SIÊU THỊ'}</span>
                    </button>

                    <button
                        onClick={() => navigate('/bc-thang/tong-quan')}
                        className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                    >
                        <span>XEM BÁO CÁO</span>
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}