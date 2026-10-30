import React, { useState, useMemo } from 'react';
import {
    Store,
    Plus,
    Trash2,
    Save,
    Calculator,
    Sparkles,
    Trophy,
    TrendingUp,
    CheckCircle2,
    AlertCircle,
    ChevronDown,
    Building2,
    Calendar,
    Copy,
    Check,
    RefreshCw
} from 'lucide-react';
import type { StoreReportingData, EmulationOcrItem } from '../types/ocrTypes';
import type { StoreItem, CampaignDictItem } from '../../../core/lib/storage';
import { getShortStoreName, normalizeToMillion, formatDate } from '../../../core/lib/formatters';

interface Props {
    storesData: StoreReportingData[];
    onChangeStoresData: (data: StoreReportingData[]) => void;
    availableStores: StoreItem[];
    campaignDict?: CampaignDictItem[];
    passedDays: number;
    totalDays: number;
    reportDate: string;
    onSaveToSupabase: () => void;
    isSaving: boolean;
    existingRecordCount?: number;
}

export default function ManualDataEntryModule({
    storesData,
    onChangeStoresData,
    availableStores,
    campaignDict = [],
    passedDays,
    totalDays,
    reportDate,
    onSaveToSupabase,
    isSaving,
    existingRecordCount = 0
}: Props) {
    const [selectedStoreIndex, setSelectedStoreIndex] = useState<number>(0);
    const [newProgramName, setNewProgramName] = useState('');
    const [newProgramUnit, setNewProgramUnit] = useState<'DOANH THU' | 'SỐ LƯỢNG'>('DOANH THU');
    const [isCopied, setIsCopied] = useState(false);

    // Siêu thị đang chọn để xem / sửa
    const activeStore = storesData[selectedStoreIndex] || storesData[0];

    // Cập nhật trường Doanh thu của siêu thị đang chọn
    const handleUpdateStoreField = (field: keyof StoreReportingData, value: any) => {
        if (!activeStore) return;
        const updated = [...storesData];
        const current = { ...updated[selectedStoreIndex] };

        (current as any)[field] = value;

        // Tự động tính toán lại tỷ lệ trả góp nếu đổi doanh thu hoặc trả góp thực
        if (field === 'revenueReal' || field === 'installmentReal') {
            const rev = field === 'revenueReal' ? Number(value) || 0 : current.revenueReal;
            const inst = field === 'installmentReal' ? Number(value) || 0 : current.installmentReal;
            current.installmentRateReal = rev > 0 ? Number(((inst / rev) * 100).toFixed(2)) : 0;
        }

        updated[selectedStoreIndex] = current;
        onChangeStoresData(updated);
    };

    // Cập nhật số liệu của 1 chương trình thi đua
    const handleUpdateEmulation = (
        progKey: string,
        field: keyof EmulationOcrItem,
        value: any
    ) => {
        if (!activeStore) return;
        const updated = [...storesData];
        const current = { ...updated[selectedStoreIndex] };
        const emus = { ...(current.emulations || {}) };

        if (!emus[progKey]) return;

        const emuItem = { ...emus[progKey], [field]: value };

        // Tự tính % Hoàn thành
        const act = field === 'actual' ? Number(value) || 0 : Number(emuItem.actual) || 0;
        const tg = field === 'target' ? Number(value) || 0 : Number(emuItem.target) || 0;
        emuItem.completionRate = tg > 0 ? Number(((act / tg) * 100).toFixed(1)) : 0;

        // Tự tính % Dự kiến bán
        if (tg > 0 && passedDays > 0) {
            emuItem.forecastRate = Number((((act / passedDays) * totalDays / tg) * 100).toFixed(1));
        }

        emus[progKey] = emuItem;
        current.emulations = emus;
        updated[selectedStoreIndex] = current;
        onChangeStoresData(updated);
    };

    // Xóa 1 chương trình thi đua
    const handleDeleteEmulation = (progKey: string) => {
        if (!activeStore) return;
        const updated = [...storesData];
        const current = { ...updated[selectedStoreIndex] };
        const emus = { ...(current.emulations || {}) };
        delete emus[progKey];
        current.emulations = emus;
        updated[selectedStoreIndex] = current;
        onChangeStoresData(updated);
    };

    // Thêm chương trình thi đua mới
    const handleAddEmulation = () => {
        const name = newProgramName.trim();
        if (!name || !activeStore) return;

        const updated = [...storesData];
        const current = { ...updated[selectedStoreIndex] };
        const emus = { ...(current.emulations || {}) };

        emus[name] = {
            programName: name,
            unit: newProgramUnit,
            actual: 0,
            target: 0,
            completionRate: 0,
            forecastRate: 0
        };

        current.emulations = emus;
        updated[selectedStoreIndex] = current;
        onChangeStoresData(updated);
        setNewProgramName('');
    };

    // Thêm 1 siêu thị mới vào danh sách nhập liệu
    const handleAddStore = (storeName: string, storeCode?: string) => {
        if (!storeName.trim()) return;
        const short = getShortStoreName(storeName);
        if (storesData.some(s => s.storeShortName === short)) {
            alert(`Siêu thị ${short} đã có trong danh sách!`);
            return;
        }

        const newStore: StoreReportingData = {
            storeCode: storeCode || '',
            storeRawName: storeName.trim(),
            storeShortName: short,
            revenueQd: 0,
            targetQd: 0,
            quantityQd: 0,
            revenueReal: 0,
            targetReal: 0,
            quantityReal: 0,
            installmentReal: 0,
            installmentRateReal: 0,
            emulations: {}
        };

        const next = [...storesData, newStore];
        onChangeStoresData(next);
        setSelectedStoreIndex(next.length - 1);
    };

    // Xóa siêu thị khỏi danh sách
    const handleDeleteStore = (idx: number) => {
        if (storesData.length <= 1) {
            alert('Cần giữ lại ít nhất 1 siêu thị!');
            return;
        }
        const storeToDelete = storesData[idx];
        if (!window.confirm(`Bạn có chắc chắn muốn xóa siêu thị "${storeToDelete.storeShortName}" không?`)) {
            return;
        }
        const next = storesData.filter((_, i) => i !== idx);
        onChangeStoresData(next);
        setSelectedStoreIndex(Math.max(0, idx - 1));
    };

    // Copy text dạng bảng để dán dự phòng
    const handleCopySummaryText = () => {
        let text = `BÁO CÁO KINH DOANH NGÀY ${reportDate} (Nhịp ${passedDays}/${totalDays})\n`;
        storesData.forEach(st => {
            text += `\n🏢 SIÊU THỊ: ${st.storeRawName}\n`;
            text += `- DT Quy Đổi: ${st.revenueQd} tr / Target: ${st.targetQd} tr (SL: ${st.quantityQd})\n`;
            text += `- DT Thực: ${st.revenueReal} tr / Target: ${st.targetReal} tr (Trả góp: ${st.installmentReal} tr - ${st.installmentRateReal}%)\n`;
            const emuList = Object.values(st.emulations || {});
            if (emuList.length > 0) {
                text += `* Thi đua (${emuList.length} CT):\n`;
                emuList.forEach(e => {
                    text += `  + ${e.programName} (${e.unit}): Thực đạt ${e.actual} / Target ${e.target} (%HT: ${e.completionRate}%)\n`;
                });
            }
        });
        navigator.clipboard.writeText(text);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    // Tính toán các tỷ lệ tự động cho siêu thị đang chọn
    const activeStats = useMemo(() => {
        if (!activeStore) return { htQd: 0, dkQd: 0, htReal: 0, dkReal: 0 };

        const htQd = activeStore.targetQd > 0
            ? Number(((activeStore.revenueQd / activeStore.targetQd) * 100).toFixed(1))
            : 0;
        const dkQd = (activeStore.targetQd > 0 && passedDays > 0)
            ? Number((((activeStore.revenueQd / passedDays) * totalDays / activeStore.targetQd) * 100).toFixed(1))
            : 0;

        const htReal = activeStore.targetReal > 0
            ? Number(((activeStore.revenueReal / activeStore.targetReal) * 100).toFixed(1))
            : 0;
        const dkReal = (activeStore.targetReal > 0 && passedDays > 0)
            ? Number((((activeStore.revenueReal / passedDays) * totalDays / activeStore.targetReal) * 100).toFixed(1))
            : 0;

        return { htQd, dkQd, htReal, dkReal };
    }, [activeStore, passedDays, totalDays]);

    return (
        <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4 font-avo">
            {/* Header Module */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 uppercase tracking-wide">
                            <Store className="w-4 h-4 text-emerald-600" />
                            <span>Bảng Nhập Liệu &amp; Đối Soát ({storesData.length} Siêu Thị)</span>
                        </div>
                        <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 font-mono font-bold text-[11px] px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Kỳ chốt: {formatDate(reportDate)} (Nhịp {passedDays}/{totalDays})</span>
                        </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                        Số liệu lưu trữ lũy kế tính đến ngày <strong>{formatDate(reportDate)}</strong>. Đơn vị doanh thu &amp; target tính theo <strong>Triệu VNĐ</strong>.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleCopySummaryText}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1"
                    >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{isCopied ? 'Đã copy text!' : 'Sao chép dạng text'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={onSaveToSupabase}
                        disabled={isSaving || storesData.length === 0}
                        className={`px-4 py-1.5 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50 active:scale-95 ${
                            existingRecordCount > 0
                                ? 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500'
                                : 'bg-emerald-600 hover:bg-emerald-700'
                        }`}
                        title={existingRecordCount > 0 ? `Ngày ${formatDate(reportDate)} đã có số liệu ${existingRecordCount} siêu thị, bấm để ghi đè và làm mới số liệu` : ''}
                    >
                        {existingRecordCount > 0 ? (
                            <RefreshCw className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
                        ) : (
                            <Save className="w-3.5 h-3.5" />
                        )}
                        <span>
                            {isSaving
                                ? 'Đang lưu...'
                                : existingRecordCount > 0
                                ? `🔄 Ghi Đè & Lưu Ngày ${formatDate(reportDate)}`
                                : `Lưu Chốt Ngày ${formatDate(reportDate)}`}
                        </span>
                    </button>
                </div>
            </div>

            {/* TAB CHUYỂN ĐỔI SIÊU THỊ & NÚT THÊM SIÊU THỊ */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {storesData.map((st, idx) => (
                    <button
                        key={st.storeShortName || idx}
                        type="button"
                        onClick={() => setSelectedStoreIndex(idx)}
                        className={`px-3 py-2 rounded-2xl text-xs font-black transition flex items-center gap-2 cursor-pointer shrink-0 border ${
                            selectedStoreIndex === idx
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                    >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>{st.storeShortName || st.storeRawName || `Siêu thị #${idx + 1}`}</span>
                        {storesData.length > 1 && (
                            <span
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteStore(idx);
                                }}
                                className="hover:text-rose-300 transition p-0.5 rounded"
                                title="Xóa siêu thị này"
                            >
                                <Trash2 className="w-3 h-3" />
                            </span>
                        )}
                    </button>
                ))}

                {/* Dropdown Thêm Siêu thị mới từ danh mục */}
                <select
                    onChange={e => {
                        if (e.target.value) {
                            const found = availableStores.find(s => s.name === e.target.value);
                            handleAddStore(e.target.value, found?.code);
                            e.target.value = '';
                        }
                    }}
                    className="px-2.5 py-2 bg-slate-100 border border-slate-300 rounded-2xl text-xs font-bold text-slate-700 cursor-pointer hover:bg-slate-200 transition shrink-0"
                    defaultValue=""
                >
                    <option value="" disabled>+ Thêm Siêu Thị...</option>
                    {availableStores.map(s => (
                        <option key={s.id || s.code} value={s.name}>
                            {s.name} ({s.code})
                        </option>
                    ))}
                </select>
            </div>

            {activeStore && (
                <div className="space-y-4 pt-1">
                    {/* TÊN ĐẦY ĐỦ SIÊU THỊ */}
                    <div className="bg-slate-50/90 border border-slate-200 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-0.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                                Tên đầy đủ trên hệ thống:
                            </span>
                            <input
                                type="text"
                                value={activeStore.storeRawName}
                                onChange={e => handleUpdateStoreField('storeRawName', e.target.value)}
                                className="w-full bg-transparent font-black text-slate-900 text-sm focus:outline-hidden border-b border-dashed border-slate-300 focus:border-emerald-500"
                            />
                        </div>

                        <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-600">
                            <span>Mã ST: <strong>{activeStore.storeCode || '—'}</strong></span>
                        </div>
                    </div>

                    {/* KHỐI 1: DOANH THU QUY ĐỔI (DTQĐ) & DOANH THU THỰC */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* 1A: DOANH THU QUY ĐỔI */}
                        <div className="bg-blue-50/60 border border-blue-200 rounded-2xl p-3.5 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-blue-900 uppercase tracking-wide flex items-center gap-1.5">
                                    <Calculator className="w-4 h-4 text-blue-600" />
                                    <span>Doanh Thu Quy Đổi (DTQĐ)</span>
                                </span>
                                <span className="text-[10.5px] font-black text-blue-800 bg-blue-100 px-2 py-0.5 rounded-md">
                                    %HT: {activeStats.htQd}% • %DK: {activeStats.dkQd}%
                                </span>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-1">
                                    <label className="text-[10.5px] font-bold text-slate-600">DTQĐ (tr):</label>
                                    <input
                                        type="number"
                                        value={activeStore.revenueQd || ''}
                                        onChange={e => handleUpdateStoreField('revenueQd', Number(e.target.value) || 0)}
                                        className="w-full px-2.5 py-1.5 bg-white border border-blue-200 rounded-xl text-xs font-mono font-black text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10.5px] font-bold text-slate-600">Target QĐ (tr):</label>
                                    <input
                                        type="number"
                                        value={activeStore.targetQd || ''}
                                        onChange={e => handleUpdateStoreField('targetQd', Number(e.target.value) || 0)}
                                        className="w-full px-2.5 py-1.5 bg-white border border-blue-200 rounded-xl text-xs font-mono font-black text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10.5px] font-bold text-slate-600">Số lượng:</label>
                                    <input
                                        type="number"
                                        value={activeStore.quantityQd || ''}
                                        onChange={e => handleUpdateStoreField('quantityQd', Number(e.target.value) || 0)}
                                        className="w-full px-2.5 py-1.5 bg-white border border-blue-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 1B: DOANH THU THỰC & TRẢ GÓP */}
                        <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-3.5 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-emerald-900 uppercase tracking-wide flex items-center gap-1.5">
                                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                                    <span>Doanh Thu Thực &amp; Trả Góp</span>
                                </span>
                                <span className="text-[10.5px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                                    %TG: {activeStore.installmentRateReal || 0}%
                                </span>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-1">
                                    <label className="text-[10.5px] font-bold text-slate-600">DT Thực (tr):</label>
                                    <input
                                        type="number"
                                        value={activeStore.revenueReal || ''}
                                        onChange={e => handleUpdateStoreField('revenueReal', Number(e.target.value) || 0)}
                                        className="w-full px-2.5 py-1.5 bg-white border border-emerald-200 rounded-xl text-xs font-mono font-black text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10.5px] font-bold text-slate-600">Target Thực (tr):</label>
                                    <input
                                        type="number"
                                        value={activeStore.targetReal || ''}
                                        onChange={e => handleUpdateStoreField('targetReal', Number(e.target.value) || 0)}
                                        className="w-full px-2.5 py-1.5 bg-white border border-emerald-200 rounded-xl text-xs font-mono font-black text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                                        placeholder="0"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10.5px] font-bold text-slate-600">Trả Góp Thực (tr):</label>
                                    <input
                                        type="number"
                                        value={activeStore.installmentReal || ''}
                                        onChange={e => handleUpdateStoreField('installmentReal', Number(e.target.value) || 0)}
                                        className="w-full px-2.5 py-1.5 bg-white border border-emerald-200 rounded-xl text-xs font-mono font-black text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* KHỐI 2: CÁC CHƯƠNG TRÌNH THI ĐUA LŨY KẾ CỦA SIÊU THỊ NÀY */}
                    <div className="border border-slate-200 rounded-2xl p-3.5 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                            <div className="flex items-center gap-1.5 text-xs font-black text-purple-900 uppercase tracking-wide">
                                <Trophy className="w-4 h-4 text-purple-600" />
                                <span>Chương Trình Thi Đua Lũy Kế ({Object.keys(activeStore.emulations || {}).length} Chương Trình)</span>
                            </div>

                            <span className="text-[11px] text-slate-400">
                                Nhập Chỉ Tiêu và Thực Đạt, hệ thống tự động tính % Hoàn thành &amp; % Dự kiến bán
                            </span>
                        </div>

                        {/* Bảng danh sách các chương trình */}
                        <div className="overflow-x-auto max-h-72 overflow-y-auto border border-slate-200 rounded-xl">
                            <table className="w-full text-xs text-left border-collapse">
                                <thead className="bg-slate-900 text-white font-black text-[10.5px] uppercase sticky top-0 z-10">
                                    <tr>
                                        <th className="p-2 border-r border-slate-800 w-10 text-center">STT</th>
                                        <th className="p-2 border-r border-slate-800 min-w-[200px]">Tên Chương Trình Thi Đua</th>
                                        <th className="p-2 border-r border-slate-800 w-28 text-center">Cách Tính</th>
                                        <th className="p-2 border-r border-slate-800 w-28 text-right">Chỉ Tiêu (Target)</th>
                                        <th className="p-2 border-r border-slate-800 w-28 text-right">Thực Đạt</th>
                                        <th className="p-2 border-r border-slate-800 w-24 text-right">% Hoàn Thành</th>
                                        <th className="p-2 border-r border-slate-800 w-24 text-right">% Dự Kiến</th>
                                        <th className="p-2 w-12 text-center">Xóa</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {Object.entries(activeStore.emulations || {}).length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="p-6 text-center text-slate-400 italic">
                                                Chưa có chương trình thi đua nào. Hãy thêm ở ô bên dưới hoặc trích xuất từ ảnh OCR.
                                            </td>
                                        </tr>
                                    ) : (
                                        Object.entries(activeStore.emulations).map(([key, emu], idx) => (
                                            <tr key={key} className="hover:bg-slate-50 transition">
                                                <td className="p-2 text-center font-bold text-slate-400 border-r border-slate-100">
                                                    {idx + 1}
                                                </td>
                                                <td className="p-2 font-bold text-slate-900 border-r border-slate-100">
                                                    <input
                                                        type="text"
                                                        value={emu.programName}
                                                        onChange={e => handleUpdateEmulation(key, 'programName', e.target.value)}
                                                        className="w-full bg-transparent font-bold text-slate-900 text-xs focus:outline-hidden border-b border-transparent hover:border-slate-300 focus:border-purple-500"
                                                    />
                                                </td>
                                                <td className="p-2 text-center border-r border-slate-100">
                                                    <select
                                                        value={emu.unit}
                                                        onChange={e => handleUpdateEmulation(key, 'unit', e.target.value)}
                                                        className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10.5px] font-bold text-slate-800"
                                                    >
                                                        <option value="DOANH THU">Doanh thu</option>
                                                        <option value="SỐ LƯỢNG">Số lượng</option>
                                                    </select>
                                                </td>
                                                <td className="p-2 text-right border-r border-slate-100">
                                                    <input
                                                        type="number"
                                                        value={emu.target || ''}
                                                        onChange={e => handleUpdateEmulation(key, 'target', Number(e.target.value) || 0)}
                                                        className="w-24 px-1.5 py-0.5 text-right font-mono font-bold text-slate-900 bg-white border border-slate-200 rounded"
                                                        placeholder="0"
                                                    />
                                                </td>
                                                <td className="p-2 text-right border-r border-slate-100">
                                                    <input
                                                        type="number"
                                                        value={emu.actual || ''}
                                                        onChange={e => handleUpdateEmulation(key, 'actual', Number(e.target.value) || 0)}
                                                        className="w-24 px-1.5 py-0.5 text-right font-mono font-black text-slate-900 bg-white border border-slate-200 rounded"
                                                        placeholder="0"
                                                    />
                                                </td>
                                                <td className="p-2 text-right font-mono font-black border-r border-slate-100 text-emerald-600">
                                                    {emu.completionRate ?? 0}%
                                                </td>
                                                <td className="p-2 text-right font-mono font-black border-r border-slate-100 text-blue-600">
                                                    {emu.forecastRate ?? 0}%
                                                </td>
                                                <td className="p-2 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteEmulation(key)}
                                                        className="text-slate-400 hover:text-rose-600 transition p-1 rounded"
                                                        title="Xóa chương trình này"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* HÀNG THÊM CHƯƠNG TRÌNH THI ĐUA MỚI */}
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center gap-2">
                            <div className="flex-1">
                                <input
                                    type="text"
                                    value={newProgramName}
                                    onChange={e => setNewProgramName(e.target.value)}
                                    placeholder="Nhập tên chương trình thi đua mới (ví dụ: T10 - iPhone 16 Series)..."
                                    className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddEmulation();
                                        }
                                    }}
                                />
                            </div>

                            <select
                                value={newProgramUnit}
                                onChange={e => setNewProgramUnit(e.target.value as any)}
                                className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-700 cursor-pointer"
                            >
                                <option value="DOANH THU">Doanh Thu</option>
                                <option value="SỐ LƯỢNG">Số Lượng</option>
                            </select>

                            {/* Dropdown gợi ý từ từ điển thi đua */}
                            {campaignDict.length > 0 && (
                                <select
                                    onChange={e => {
                                        if (e.target.value) {
                                            setNewProgramName(e.target.value);
                                            e.target.value = '';
                                        }
                                    }}
                                    className="px-2.5 py-1.5 bg-purple-50 border border-purple-200 rounded-xl text-xs font-bold text-purple-900 cursor-pointer"
                                    defaultValue=""
                                >
                                    <option value="" disabled>💡 Gợi ý từ điển...</option>
                                    {campaignDict.map(d => (
                                        <option key={d.raw_key} value={d.display_name || d.raw_key}>
                                            {d.display_name} ({d.raw_key})
                                        </option>
                                    ))}
                                </select>
                            )}

                            <button
                                type="button"
                                onClick={handleAddEmulation}
                                disabled={!newProgramName.trim()}
                                className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
                            >
                                + Thêm CT
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

