import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    getLocalDraft,
    saveLocalDraft,
    clearLocalDraft,
    syncBatchDailyRecordsToSupabase,
    fetchBusinessRecordsByDate,
    type BusinessDayRecord
} from '../../core/lib/storage';
import { getYesterdayDateString, getShortStoreName, getCampaignLabel, formatDate, formatDateTime } from '../../core/lib/formatters';
import { Save, Trash2, Calendar, RefreshCw, CheckCircle2, ArrowRight, CloudUpload, Store, RotateCcw, AlertCircle, AlertTriangle, X } from 'lucide-react';

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

    // Quản lý kiểm tra trùng phiên trên Cloud
    const [existingSessionRecords, setExistingSessionRecords] = useState<BusinessDayRecord[]>([]);
    const [isCheckingExisting, setIsCheckingExisting] = useState<boolean>(false);
    const [showOverwriteModal, setShowOverwriteModal] = useState<boolean>(false);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 3000);
    };

    // Kiểm tra dữ liệu phiên trên Cloud khi ngày chốt thay đổi
    const checkExistingSession = useCallback(async (date: string) => {
        if (!date) {
            setExistingSessionRecords([]);
            return;
        }
        setIsCheckingExisting(true);
        const res = await fetchBusinessRecordsByDate(date);
        if (res.success && res.data) {
            setExistingSessionRecords(res.data);
        } else {
            setExistingSessionRecords([]);
        }
        setIsCheckingExisting(false);
    }, []);

    useEffect(() => {
        checkExistingSession(reportDate);
    }, [reportDate, checkExistingSession]);

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

    // Bắt đầu thao tác lưu: kiểm tra trùng phiên trước khi thực thi
    const handleSaveClick = () => {
        if (!emulationRaw.trim() && !revenueRaw.trim()) {
            showToast('⚠️ Vui lòng nhập dữ liệu trước khi lưu!');
            return;
        }

        const storeRecordsMap = parseRevenueRawToMap();
        if (Object.keys(storeRecordsMap).length === 0) {
            showToast('⚠️ Chưa nhận diện được số liệu siêu thị hợp lệ!');
            return;
        }

        // Nếu trên Cloud đã có dữ liệu của ngày chốt này -> Mở Modal xác nhận ghi đè
        if (existingSessionRecords.length > 0) {
            setShowOverwriteModal(true);
        } else {
            executeSave(false);
        }
    };

    // Thực thi lưu và đồng bộ lên Supabase Cloud (hỗ trợ ghi đè sạch phiên)
    const executeSave = async (isOverwrite: boolean) => {
        setIsSaving(true);
        setShowOverwriteModal(false);

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

        // 5. Lưu batch lên Supabase (Ghi đè làm sạch phiên nếu trùng ngày chốt)
        let saveResult = { success: false, count: 0 };
        if (finalRecords.length > 0) {
            saveResult = await syncBatchDailyRecordsToSupabase(finalRecords, { overwrite: isOverwrite });
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

            // Tải lại danh sách bản ghi hiện có của phiên ngày này
            await checkExistingSession(reportDate);

            if (isOverwrite) {
                showToast(`🎉 Đã ghi đè & làm sạch ${finalRecords.length} siêu thị cho phiên ngày ${formatDate(reportDate)} lên CLOUD!`);
            } else {
                showToast(`💾 Đã bóc tách & lưu ${finalRecords.length} siêu thị thành công lên CLOUD!`);
            }
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
                                <span>⚠️ Bản nháp dữ liệu kinh doanh chưa đồng bộ lên CLOUD!</span>
                            </h3>
                            <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                                {savedTime ? `Đã lưu bản nháp cục bộ lúc ${savedTime}. ` : 'Dữ liệu mới nhập chưa được lưu. '}
                                Dữ liệu chưa được đồng bộ lên CLOUD. Báo cáo tổng thể và biểu đồ cụm sẽ chưa có số liệu này.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={handleSaveClick}
                            disabled={isSaving}
                            className={`px-4 py-2 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50 ${existingSessionRecords.length > 0
                                ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700'
                                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700'
                            }`}
                        >
                            <CloudUpload className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
                            <span>
                                {isSaving
                                    ? 'ĐANG ĐỒNG BỘ...'
                                    : existingSessionRecords.length > 0
                                        ? '⚡ ĐỒNG BỘ & GHI ĐÈ CLOUD'
                                        : '⚡ ĐỒNG BỘ LÊN CLOUD NGAY'
                                }
                            </span>
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
                        <span><b>CLOUD:</b> Bản ghi dữ liệu ngày <b>{formatDate(reportDate)}</b> ({detectedStores.length} siêu thị) đã đồng bộ trực tuyến.</span>
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

                {/* BANNER CẢNH BÁO TRÙNG PHIÊN NGÀY CHỐT NẾU ĐÃ CÓ DỮ LIỆU TRÊN CLOUD */}
                {existingSessionRecords.length > 0 && (
                    <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 border-2 border-amber-400 rounded-2xl p-4 shadow-xs animate-in fade-in duration-200">
                        <div className="flex items-start gap-3">
                            <div className="p-2.5 rounded-xl bg-amber-500 text-slate-950 font-black shrink-0 shadow-xs">
                                <AlertTriangle className="w-5 h-5 text-slate-950 stroke-[2.5]" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-black uppercase tracking-wider text-amber-950 bg-amber-300/90 px-2 py-0.5 rounded-md">
                                        ⚠️ Trùng phiên ngày chốt: {formatDate(reportDate)}
                                    </span>
                                    <span className="text-xs text-slate-600 font-medium">
                                        Đã có <b className="text-amber-950">{existingSessionRecords.length} siêu thị</b> trên Cloud
                                    </span>
                                    {isCheckingExisting && (
                                        <span className="text-[10px] text-amber-700 italic animate-pulse">Đang rà soát...</span>
                                    )}
                                </div>
                                <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                                    Phiên ngày <b>{formatDate(reportDate)}</b> đã từng được cập nhật{existingSessionRecords[0]?.updatedAt ? ` (lần gần nhất lúc ${formatDateTime(existingSessionRecords[0].updatedAt)})` : ''}. 
                                    Khi lưu, hệ thống sẽ <b className="text-amber-900 underline">TỰ ĐỘNG GHI ĐÈ & LÀM SẠCH</b> toàn bộ số liệu cũ của ngày này để khắc phục dữ liệu bị lỗi và đảm bảo không bị nhân bản nhiều dòng.
                                </p>
                                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                                    <span className="font-bold text-slate-700">Dữ liệu hiện có:</span>
                                    {existingSessionRecords.slice(0, 6).map((r, i) => (
                                        <span key={r.id || `${r.storeName}_${i}`} className="px-1.5 py-0.5 bg-white border border-amber-300 rounded font-bold text-slate-800 shadow-2xs">
                                            {getShortStoreName(r.storeName)}
                                        </span>
                                    ))}
                                    {existingSessionRecords.length > 6 && (
                                        <span className="text-slate-500 font-bold bg-amber-100/60 px-1.5 py-0.5 rounded">
                                            +{existingSessionRecords.length - 6} ST khác
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
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
                        onClick={handleSaveClick}
                        disabled={isSaving}
                        className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50 ${existingSessionRecords.length > 0
                            ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700'
                            : 'bg-emerald-600 hover:bg-emerald-700'
                        }`}
                    >
                        {isSaving ? (
                            <CloudUpload className="w-4 h-4 animate-spin" />
                        ) : existingSessionRecords.length > 0 ? (
                            <RotateCcw className="w-4 h-4" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        <span>
                            {isSaving
                                ? (existingSessionRecords.length > 0 ? 'ĐANG GHI ĐÈ...' : 'ĐANG TÁCH & LƯU...')
                                : (existingSessionRecords.length > 0 ? '🔄 LƯU & GHI ĐÈ PHIÊN NÀY' : '💾 LƯU DỮ LIỆU ĐA SIÊU THỊ')
                            }
                        </span>
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

            {/* MODAL XÁC NHẬN GHI ĐÈ TRÙNG PHIÊN NGÀY CHỐT */}
            {showOverwriteModal && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
                    <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-150">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-2xl bg-amber-100 border border-amber-300 text-amber-700 flex items-center justify-center shrink-0">
                                    <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                                        Xác Nhận Ghi Đè Phiên
                                    </h3>
                                    <p className="text-xs text-amber-800 font-bold font-mono">
                                        Ngày chốt: {formatDate(reportDate)}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowOverwriteModal(false)}
                                className="p-1 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-3.5 text-xs text-amber-950 space-y-2">
                            <p className="font-medium leading-relaxed">
                                Phiên ngày <b>{formatDate(reportDate)}</b> hiện đã có <b>{existingSessionRecords.length} siêu thị</b> trên Cloud. Bạn đang chuẩn bị lưu mới cho <b>{detectedStores.length} siêu thị</b>.
                            </p>
                            <div className="space-y-1.5 pt-1 text-[11.5px] border-t border-amber-200/70 text-slate-700 font-medium">
                                <div className="flex items-start gap-1.5 text-emerald-800">
                                    <span className="font-bold shrink-0">✓</span>
                                    <span><b>Khắc phục dữ liệu lỗi:</b> Xóa sạch số liệu cũ của ngày này để nạp dữ liệu chuẩn mới nhất.</span>
                                </div>
                                <div className="flex items-start gap-1.5 text-blue-800">
                                    <span className="font-bold shrink-0">✓</span>
                                    <span><b>Tránh trùng lặp:</b> Đảm bảo 1 phiên ngày chỉ có 1 dòng dữ liệu duy nhất cho mỗi siêu thị.</span>
                                </div>
                            </div>
                        </div>

                        <p className="text-xs text-slate-500 font-medium">
                            Bạn có chắc chắn muốn tiến hành ghi đè dữ liệu phiên ngày <b>{formatDate(reportDate)}</b> không?
                        </p>

                        <div className="flex items-center justify-end gap-2.5 pt-1">
                            <button
                                type="button"
                                onClick={() => setShowOverwriteModal(false)}
                                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
                            >
                                Hủy Bỏ
                            </button>
                            <button
                                type="button"
                                onClick={() => executeSave(true)}
                                disabled={isSaving}
                                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-amber-600/30 transition cursor-pointer disabled:opacity-50"
                            >
                                <RotateCcw className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
                                <span>{isSaving ? 'ĐANG GHI ĐÈ...' : 'XÁC NHẬN GHI ĐÈ & LƯU CLOUD'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}