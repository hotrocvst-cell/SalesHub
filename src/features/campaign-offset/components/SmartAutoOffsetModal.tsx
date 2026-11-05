import React, { useState, useMemo, useEffect } from 'react';
import {
    Sparkles,
    ArrowRight,
    CheckCircle2,
    X,
    Users,
    PackageCheck,
    AlertCircle,
    Search,
    CheckSquare,
    Square,
    Filter
} from 'lucide-react';
import type { SmartOffsetSuggestion } from '../services/campaignOffsetService';
import { calculateSmartAutoOffsets } from '../services/campaignOffsetService';
import type { EmployeeItem, CampaignDictItem } from '../../../core/lib/storage';
import { cleanEmployeeName, getShortenedEmployeeName } from '../../../core/lib/formatters';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    employees: EmployeeItem[];
    campaignDict: CampaignDictItem[];
    campaignTargets: Record<string, Record<string, number>>;
    campaignActualsMap: Record<string, Record<string, number>>;
    onApply: (suggestions: SmartOffsetSuggestion[]) => void;
}

export default function SmartAutoOffsetModal({
    isOpen,
    onClose,
    employees,
    campaignDict,
    campaignTargets,
    campaignActualsMap,
    onApply
}: Props) {
    // Bộ lọc
    const [selectedEmpId, setSelectedEmpId] = useState<string>('ALL');
    const [selectedFromKey, setSelectedFromKey] = useState<string>('ALL');
    const [selectedToKey, setSelectedToKey] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Tập hợp các ID cặp được chọn (key: `${s.employee_id}::${s.from_campaign_key}::${s.to_campaign_key}`)
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

    // Giá trị cấn trừ tùy chỉnh (nếu người dùng chỉnh sửa trực tiếp)
    const [customQuantities, setCustomQuantities] = useState<Record<string, number>>({});

    // 1. Tính toán toàn bộ gợi ý cấn trừ
    const allSuggestions = useMemo(() => {
        if (!isOpen) return [];
        return calculateSmartAutoOffsets(
            employees,
            campaignTargets,
            campaignActualsMap,
            campaignDict
        );
    }, [isOpen, employees, campaignTargets, campaignActualsMap, campaignDict]);

    // Danh sách nhân sự có phát sinh cấn trừ
    const employeesWithSuggestions = useMemo(() => {
        const empIdSet = new Set(allSuggestions.map(s => s.employee_id.trim()));
        return employees.filter(e => empIdSet.has(e.employee_id.trim()));
    }, [allSuggestions, employees]);

    // Danh sách ngành dư (nguồn)
    const fromCampaignOptions = useMemo(() => {
        const map = new Map<string, string>();
        allSuggestions.forEach(s => map.set(s.from_campaign_key, s.from_campaign_name));
        return Array.from(map.entries()).map(([key, name]) => ({ key, name }));
    }, [allSuggestions]);

    // Danh sách ngành thiếu (đích)
    const toCampaignOptions = useMemo(() => {
        const map = new Map<string, string>();
        allSuggestions.forEach(s => map.set(s.to_campaign_key, s.to_campaign_name));
        return Array.from(map.entries()).map(([key, name]) => ({ key, name }));
    }, [allSuggestions]);

    // 2. Lọc danh sách gợi ý theo bộ lọc người dùng
    const filteredSuggestions = useMemo(() => {
        return allSuggestions.filter(s => {
            if (selectedEmpId !== 'ALL' && s.employee_id !== selectedEmpId) return false;
            if (selectedFromKey !== 'ALL' && s.from_campaign_key !== selectedFromKey) return false;
            if (selectedToKey !== 'ALL' && s.to_campaign_key !== selectedToKey) return false;

            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchEmp = s.employee_id.toLowerCase().includes(q) || s.employee_name.toLowerCase().includes(q);
                const matchFrom = s.from_campaign_name.toLowerCase().includes(q);
                const matchTo = s.to_campaign_name.toLowerCase().includes(q);
                if (!matchEmp && !matchFrom && !matchTo) return false;
            }
            return true;
        });
    }, [allSuggestions, selectedEmpId, selectedFromKey, selectedToKey, searchQuery]);

    // Tạo key định danh duy nhất cho từng cặp gợi ý
    const getSuggestionKey = (s: SmartOffsetSuggestion, idx: number) => {
        return `${s.employee_id}::${s.from_campaign_key}::${s.to_campaign_key}::${idx}`;
    };

    // Mặc định chọn tất cả khi danh sách gợi ý khởi tạo
    useEffect(() => {
        if (isOpen && allSuggestions.length > 0) {
            const initialSet = new Set<string>();
            allSuggestions.forEach((s, idx) => initialSet.add(getSuggestionKey(s, idx)));
            setSelectedKeys(initialSet);
            setCustomQuantities({});
        }
    }, [isOpen, allSuggestions]);

    if (!isOpen) return null;

    // Toggle chọn 1 cặp
    const handleToggleKey = (key: string) => {
        const next = new Set(selectedKeys);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        setSelectedKeys(next);
    };

    // Chọn tất cả các dòng đang lọc
    const handleSelectAllFiltered = () => {
        const next = new Set(selectedKeys);
        filteredSuggestions.forEach((s, idx) => next.add(getSuggestionKey(s, idx)));
        setSelectedKeys(next);
    };

    // Bỏ chọn tất cả các dòng đang lọc
    const handleDeselectAllFiltered = () => {
        const next = new Set(selectedKeys);
        filteredSuggestions.forEach((s, idx) => next.delete(getSuggestionKey(s, idx)));
        setSelectedKeys(next);
    };

    // Cập nhật số lượng cấn trừ tùy biến của 1 cặp
    const handleQuantityChange = (key: string, valStr: string, maxVal: number) => {
        const num = parseFloat(valStr.replace(',', '.'));
        if (isNaN(num) || num <= 0) {
            setCustomQuantities(prev => ({ ...prev, [key]: 0 }));
            return;
        }
        // Giới hạn không vượt quá số lượng tối đa có thể cấn
        const clamped = Math.round(Math.min(num, maxVal) * 1000) / 1000;
        setCustomQuantities(prev => ({ ...prev, [key]: clamped }));
    };

    // Đếm số lượng cặp được chọn trong bộ lọc hiện tại
    const selectedCountInFiltered = filteredSuggestions.filter((s, idx) =>
        selectedKeys.has(getSuggestionKey(s, idx))
    ).length;

    // Tổng số lượng / giá trị các cặp được chọn
    const totalSelectedQuantity = filteredSuggestions.reduce((sum, s, idx) => {
        const key = getSuggestionKey(s, idx);
        if (!selectedKeys.has(key)) return sum;
        const qty = customQuantities[key] !== undefined ? customQuantities[key] : s.offset_quantity;
        return sum + (Number(qty) || 0);
    }, 0);

    const handleConfirmApply = () => {
        const selectedList: SmartOffsetSuggestion[] = [];

        filteredSuggestions.forEach((s, idx) => {
            const key = getSuggestionKey(s, idx);
            if (selectedKeys.has(key)) {
                const finalQty = customQuantities[key] !== undefined ? customQuantities[key] : s.offset_quantity;
                if (finalQty > 0) {
                    selectedList.push({
                        ...s,
                        offset_quantity: finalQty,
                        reason: `Cấn ${finalQty} ${s.from_unit || ''} từ [${s.from_campaign_name}] bù thiếu cho [${s.to_campaign_name}]`.trim()
                    });
                }
            }
        });

        if (selectedList.length === 0) return;
        onApply(selectedList);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
                {/* Header */}
                <div className="px-5 py-3.5 bg-linear-to-r from-purple-900 via-indigo-900 to-purple-950 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center border border-amber-400/30">
                            <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold tracking-tight">Gợi Ý Cấn Trừ Thi Đua Tự Động (1 Đổi 1)</h3>
                            <p className="text-[11px] text-purple-200">
                                Lựa chọn nhân viên, ngành hàng và cặp cần cấn trừ trước khi áp dụng
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-purple-200 hover:text-white transition"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* THANH BỘ LỌC TÙY CHỌN: NHÂN VIÊN & CHƯƠNG TRÌNH */}
                <div className="p-3 bg-purple-50/50 border-b border-purple-100 text-xs space-y-2.5 shrink-0">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {/* Lọc Nhân viên */}
                        <div>
                            <label className="block text-[10.5px] font-bold text-slate-600 mb-1">
                                👤 Chọn Nhân viên:
                            </label>
                            <select
                                value={selectedEmpId}
                                onChange={e => setSelectedEmpId(e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-white border border-purple-200 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                            >
                                <option value="ALL">Tất cả nhân sự ({employeesWithSuggestions.length} NV có số dư)</option>
                                {employeesWithSuggestions.map(emp => (
                                    <option key={emp.employee_id} value={emp.employee_id}>
                                        {emp.employee_id} - {cleanEmployeeName(emp.full_name || '')}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Lọc Ngành nguồn (Dư) */}
                        <div>
                            <label className="block text-[10.5px] font-bold text-emerald-700 mb-1">
                                🟢 Ngành nguồn (Có dư):
                            </label>
                            <select
                                value={selectedFromKey}
                                onChange={e => setSelectedFromKey(e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-white border border-emerald-200 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                            >
                                <option value="ALL">Tất cả ngành dư ({fromCampaignOptions.length})</option>
                                {fromCampaignOptions.map(c => (
                                    <option key={c.key} value={c.key}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Lọc Ngành đích (Thiếu) */}
                        <div>
                            <label className="block text-[10.5px] font-bold text-rose-700 mb-1">
                                🔴 Ngành đích (Bù thiếu):
                            </label>
                            <select
                                value={selectedToKey}
                                onChange={e => setSelectedToKey(e.target.value)}
                                className="w-full px-2.5 py-1.5 bg-white border border-rose-200 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-rose-500 focus:outline-hidden"
                            >
                                <option value="ALL">Tất cả ngành thiếu ({toCampaignOptions.length})</option>
                                {toCampaignOptions.map(c => (
                                    <option key={c.key} value={c.key}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Dòng điều khiển: Search & Chọn tất cả */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-purple-100">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={handleSelectAllFiltered}
                                className="px-2.5 py-1 rounded-md bg-white border border-slate-300 text-slate-700 text-[11px] font-bold hover:bg-slate-50 transition flex items-center gap-1"
                            >
                                <CheckSquare className="w-3.5 h-3.5 text-purple-600" />
                                <span>Chọn tất cả ({filteredSuggestions.length})</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleDeselectAllFiltered}
                                className="px-2.5 py-1 rounded-md bg-white border border-slate-300 text-slate-700 text-[11px] font-bold hover:bg-slate-50 transition flex items-center gap-1"
                            >
                                <Square className="w-3.5 h-3.5 text-slate-400" />
                                <span>Bỏ chọn</span>
                            </button>
                            <span className="text-[11px] text-purple-900 font-bold ml-1">
                                Đã chọn: <b className="text-purple-700">{selectedCountInFiltered}</b> / {filteredSuggestions.length} cặp
                            </span>
                        </div>

                        <div className="relative w-full sm:w-56">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Tìm theo Mã NV hoặc ngành..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-7 pr-2.5 py-1 text-xs bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                            />
                        </div>
                    </div>
                </div>

                {/* Danh sách các cặp cấn trừ */}
                <div className="p-3 sm:p-4 overflow-y-auto space-y-2.5 flex-1 bg-slate-50/40">
                    {filteredSuggestions.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 italic text-xs space-y-2">
                            <AlertCircle className="w-8 h-8 mx-auto text-slate-300" />
                            <div>Không tìm thấy cặp cấn trừ nào phù hợp với bộ lọc hiện tại.</div>
                            <div className="text-[11px] text-slate-400">
                                Hãy thử thay đổi bộ lọc nhân viên hoặc ngành hàng ở trên.
                            </div>
                        </div>
                    ) : (
                        filteredSuggestions.map((s, idx) => {
                            const key = getSuggestionKey(s, idx);
                            const isChecked = selectedKeys.has(key);
                            const currentQty = customQuantities[key] !== undefined ? customQuantities[key] : s.offset_quantity;

                            return (
                                <div
                                    key={key}
                                    className={`p-3 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                        isChecked
                                            ? 'bg-white border-purple-300 shadow-2xs ring-1 ring-purple-100'
                                            : 'bg-slate-50/70 border-slate-200 opacity-60'
                                    }`}
                                >
                                    {/* Cột trái: Checkbox + Nhân viên */}
                                    <div className="flex items-center gap-2.5 shrink-0">
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => handleToggleKey(key)}
                                            className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300 cursor-pointer"
                                        />
                                        <span className="font-mono font-bold text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                            {s.employee_id}
                                        </span>
                                        <span className="font-bold text-slate-900 text-xs" title={cleanEmployeeName(s.employee_name)}>
                                            {getShortenedEmployeeName(s.employee_name)}
                                        </span>
                                    </div>

                                    {/* Cột giữa & phải: Dư -> Cấn -> Thiếu */}
                                    <div className="flex items-center gap-2 flex-wrap text-xs">
                                        {/* Ngành Dư */}
                                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold flex items-center gap-1">
                                            <span className="truncate max-w-[130px]" title={s.from_campaign_name}>
                                                {s.from_campaign_name}
                                            </span>
                                            <b className="text-emerald-900">+{s.from_surplus}</b>
                                            {s.from_unit && <span className="text-[10px] text-emerald-700 font-normal">({s.from_unit})</span>}
                                        </span>

                                        {/* Mũi tên & Input số lượng cấn trừ (hỗ trợ số thập phân) */}
                                        <div className="flex items-center gap-1.5 text-purple-700 font-bold font-mono">
                                            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                                            <div className="flex items-center gap-1">
                                                <span className="text-[11px] text-purple-800 font-sans font-bold">Cấn:</span>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    min="0.001"
                                                    max={s.from_surplus}
                                                    value={currentQty}
                                                    onChange={e => handleQuantityChange(key, e.target.value, s.from_surplus)}
                                                    disabled={!isChecked}
                                                    className="w-16 px-1.5 py-0.5 text-center font-mono font-black text-xs border border-purple-300 rounded bg-white text-purple-900 focus:ring-2 focus:ring-purple-500 focus:outline-hidden disabled:bg-slate-100"
                                                    title={`Mức tối đa có thể cấn: ${s.from_surplus}`}
                                                />
                                            </div>
                                            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                                        </div>

                                        {/* Ngành Thiếu */}
                                        <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-200 font-bold flex items-center gap-1">
                                            <span className="truncate max-w-[130px]" title={s.to_campaign_name}>
                                                {s.to_campaign_name}
                                            </span>
                                            <b className="text-rose-900">Thiếu -{s.to_deficit}</b>
                                            {s.to_unit && <span className="text-[10px] text-rose-700 font-normal">({s.to_unit})</span>}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                    <div className="text-xs font-bold text-slate-600">
                        Tổng lượng cấn trừ đã chọn: <b className="text-purple-900 font-mono text-sm">{Number(totalSelectedQuantity.toFixed(3)).toLocaleString('vi-VN')}</b>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-slate-300 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-100 transition"
                        >
                            Hủy Bỏ
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirmApply}
                            disabled={selectedCountInFiltered === 0}
                            className="px-4 py-2 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-xs"
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Áp Dụng {selectedCountInFiltered} Cặp Đã Chọn</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
