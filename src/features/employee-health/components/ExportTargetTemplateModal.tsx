import React, { useState, useEffect, useMemo } from 'react';
import type { CampaignDictItem, EmployeeItem } from '../../../core/lib/storage';
import { getShortStoreName } from '../../../core/lib/formatters';
import {
    FileSpreadsheet,
    Download,
    Check,
    X,
    Store,
    Calendar,
    Target,
    Filter,
    Search,
    Sparkles,
    CheckSquare,
    Square
} from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    selectedStore: string;
    selectedMonth: number;
    selectedYear: number;
    campaigns: CampaignDictItem[];
    storeEligibleKeys: Set<string>;
    isLoadingStoreKeys?: boolean;
    employeesCount: number;
    onConfirmExport: (chosenCampaigns: CampaignDictItem[]) => Promise<void>;
}

export default function ExportTargetTemplateModal({
    isOpen,
    onClose,
    selectedStore,
    selectedMonth,
    selectedYear,
    campaigns,
    storeEligibleKeys,
    isLoadingStoreKeys = false,
    employeesCount,
    onConfirmExport
}: Props) {
    const isSpecificStore = selectedStore !== 'all';
    const storeLabel = isSpecificStore ? getShortStoreName(selectedStore) : 'Toàn Cụm ST';

    // Chế độ chọn: 'STORE_ONLY' (chỉ thi đua ST) | 'ALL' (toàn bộ) | 'CUSTOM' (tự chọn)
    const [exportMode, setExportMode] = useState<'STORE_ONLY' | 'ALL' | 'CUSTOM'>('STORE_ONLY');
    const [selectedRawKeys, setSelectedRawKeys] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [isExporting, setIsExporting] = useState<boolean>(false);

    // Khởi tạo các key được chọn khi mở modal hoặc khi storeEligibleKeys thay đổi
    useEffect(() => {
        if (!isOpen) return;

        if (isSpecificStore && storeEligibleKeys.size > 0) {
            setExportMode('STORE_ONLY');
            setSelectedRawKeys(new Set(storeEligibleKeys));
        } else {
            setExportMode('ALL');
            setSelectedRawKeys(new Set(campaigns.map(c => c.raw_key)));
        }
        setSearchQuery('');
    }, [isOpen, selectedStore, storeEligibleKeys, campaigns, isSpecificStore]);

    // Xử lý khi đổi chế độ
    const handleModeChange = (mode: 'STORE_ONLY' | 'ALL' | 'CUSTOM') => {
        setExportMode(mode);
        if (mode === 'STORE_ONLY') {
            if (storeEligibleKeys.size > 0) {
                setSelectedRawKeys(new Set(storeEligibleKeys));
            } else {
                setSelectedRawKeys(new Set(campaigns.map(c => c.raw_key)));
            }
        } else if (mode === 'ALL') {
            setSelectedRawKeys(new Set(campaigns.map(c => c.raw_key)));
        }
    };

    // Toggle 1 campaign
    const toggleCampaign = (rawKey: string) => {
        setExportMode('CUSTOM');
        setSelectedRawKeys(prev => {
            const next = new Set(prev);
            if (next.has(rawKey)) {
                next.delete(rawKey);
            } else {
                next.add(rawKey);
            }
            return next;
        });
    };

    // Chọn tất cả
    const handleSelectAll = () => {
        setExportMode('ALL');
        setSelectedRawKeys(new Set(campaigns.map(c => c.raw_key)));
    };

    // Chỉ chọn mục của ST
    const handleSelectStoreOnly = () => {
        setExportMode('STORE_ONLY');
        setSelectedRawKeys(new Set(storeEligibleKeys));
    };

    // Bỏ chọn tất cả
    const handleDeselectAll = () => {
        setExportMode('CUSTOM');
        setSelectedRawKeys(new Set());
    };

    // Danh sách lọc tìm kiếm
    const filteredCampaigns = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return campaigns;
        return campaigns.filter(c =>
            c.raw_key.toLowerCase().includes(q) ||
            c.display_name.toLowerCase().includes(q) ||
            (c.unit && c.unit.toLowerCase().includes(q))
        );
    }, [campaigns, searchQuery]);

    // Số lượng thi đua được chọn
    const selectedCount = selectedRawKeys.size;

    // Xác nhận tải file
    const handleDownload = async () => {
        if (selectedCount === 0) {
            const proceed = window.confirm(
                'Bạn chưa chọn cột thi đua nào, file Excel xuất ra sẽ chỉ có cột Doanh thu. Bạn có muốn tiếp tục tải không?'
            );
            if (!proceed) return;
        }
        setIsExporting(true);
        try {
            const chosenCampaigns = campaigns.filter(c => selectedRawKeys.has(c.raw_key));
            await onConfirmExport(chosenCampaigns);
            onClose();
        } finally {
            setIsExporting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-start justify-between border-b border-slate-100 pb-3 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-sm shrink-0">
                            <FileSpreadsheet className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-black text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md uppercase">
                                    Cài Đặt Xuất File Mẫu
                                </span>
                                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5 text-blue-600" /> Tháng {selectedMonth}/{selectedYear}
                                </span>
                            </div>
                            <h3 className="text-base font-black text-slate-800 mt-0.5">
                                Xuất File Excel Mẫu Giao Mục Tiêu
                            </h3>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                        title="Đóng"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Badge thông tin ST & Nhân sự */}
                <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-slate-50 border border-blue-200 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 shrink-0">
                    <div className="flex items-center gap-2">
                        <Store className="w-4 h-4 text-blue-700 shrink-0" />
                        <span className="text-xs font-bold text-slate-600">ST xuất mẫu:</span>
                        <span className="text-xs font-black text-blue-900 bg-white border border-blue-200 px-2 py-0.5 rounded-lg shadow-2xs">
                            {selectedStore === 'all' ? '🏢 Toàn Cụm ST' : selectedStore}
                        </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                        <span>Nhân sự:</span>
                        <span className="font-black text-indigo-700 bg-white border border-indigo-200 px-2 py-0.5 rounded-lg shadow-2xs">
                            {employeesCount} nhân viên
                        </span>
                    </div>
                </div>

                {/* Chọn Chế Độ Xuất */}
                <div className="space-y-2 shrink-0">
                    <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Filter className="w-3.5 h-3.5 text-blue-600" />
                        Lựa chọn cột thi đua trong file Excel:
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {/* Option 1: Chỉ thi đua của ST */}
                        <div
                            onClick={() => handleModeChange('STORE_ONLY')}
                            className={`p-3 rounded-2xl border-2 transition cursor-pointer flex items-start gap-2.5 ${
                                exportMode === 'STORE_ONLY'
                                    ? 'bg-blue-50/80 border-blue-500 shadow-xs'
                                    : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                            }`}
                        >
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                                exportMode === 'STORE_ONLY' ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-400 bg-white'
                            }`}>
                                {exportMode === 'STORE_ONLY' && <Check className="w-3 h-3" />}
                            </div>
                            <div className="text-xs">
                                <div className="font-black text-slate-800 flex items-center gap-1">
                                    <span>🎯 Chỉ thi đua của ST này</span>
                                    <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.2 rounded font-bold uppercase">
                                        Khuyên Dùng
                                    </span>
                                </div>
                                <p className="text-slate-500 mt-0.5 leading-snug">
                                    {isLoadingStoreKeys ? (
                                        'Đang quét mục tiêu của ST...'
                                    ) : storeEligibleKeys.size > 0 ? (
                                        `Chỉ gồm ${storeEligibleKeys.size} ngành hàng ST có target (gọn gàng, không bị tràn cột)`
                                    ) : (
                                        'Chưa phát hiện target riêng của ST trong tháng này'
                                    )}
                                </p>
                            </div>
                        </div>

                        {/* Option 2: Toàn bộ chương trình */}
                        <div
                            onClick={() => handleModeChange('ALL')}
                            className={`p-3 rounded-2xl border-2 transition cursor-pointer flex items-start gap-2.5 ${
                                exportMode === 'ALL'
                                    ? 'bg-indigo-50/80 border-indigo-500 shadow-xs'
                                    : 'bg-slate-50/60 border-slate-200 hover:border-slate-300'
                            }`}
                        >
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                                exportMode === 'ALL' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-400 bg-white'
                            }`}>
                                {exportMode === 'ALL' && <Check className="w-3 h-3" />}
                            </div>
                            <div className="text-xs">
                                <div className="font-black text-slate-800">
                                    🏢 Toàn bộ chương trình hệ thống
                                </div>
                                <p className="text-slate-500 mt-0.5 leading-snug">
                                    Xuất đầy đủ tất cả {campaigns.length} chương trình thi đua hiện có của Tháng {selectedMonth}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Thanh tìm kiếm & Tác vụ chọn nhanh */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shrink-0 pt-1">
                    <div className="relative flex-1 max-w-xs">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                            type="text"
                            placeholder="Lọc chương trình..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                            type="button"
                            onClick={handleSelectAll}
                            className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                        >
                            Chọn tất cả ({campaigns.length})
                        </button>
                        {isSpecificStore && storeEligibleKeys.size > 0 && (
                            <button
                                type="button"
                                onClick={handleSelectStoreOnly}
                                className="px-2.5 py-1 text-[11px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg transition cursor-pointer"
                            >
                                Chỉ mục ST ({storeEligibleKeys.size})
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleDeselectAll}
                            className="px-2.5 py-1 text-[11px] font-bold bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-lg transition cursor-pointer"
                        >
                            Bỏ chọn
                        </button>
                    </div>
                </div>

                {/* Danh sách các cột thi đua kèm Checkbox */}
                <div className="overflow-y-auto border border-slate-200 rounded-2xl p-2.5 max-h-[220px] divide-y divide-slate-100 flex-1">
                    {filteredCampaigns.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-400">
                            Không tìm thấy chương trình nào phù hợp!
                        </div>
                    ) : (
                        filteredCampaigns.map(camp => {
                            const isChecked = selectedRawKeys.has(camp.raw_key);
                            const hasStoreTarget = storeEligibleKeys.has(camp.raw_key);

                            return (
                                <label
                                    key={camp.id || camp.raw_key}
                                    className={`py-2 px-2.5 rounded-xl flex items-center justify-between gap-3 transition cursor-pointer select-none ${
                                        isChecked ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-slate-50'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => toggleCampaign(camp.raw_key)}
                                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                                        />
                                        <div className="truncate">
                                            <div className="text-xs font-bold text-slate-800 truncate">
                                                {camp.display_name || camp.raw_key}
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-mono truncate">
                                                {camp.raw_key}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {hasStoreTarget && (
                                            <span className="text-[10px] font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                                                🎯 Target ST
                                            </span>
                                        )}
                                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                            {camp.unit || 'Cái'}
                                        </span>
                                    </div>
                                </label>
                            );
                        })
                    )}
                </div>

                {/* Footer tóm tắt & Nút tải file */}
                <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                    <div className="text-xs text-slate-600">
                        File Excel sẽ có: <strong className="text-slate-800">4 cột chuẩn</strong> (Mã NV, Tên, ST, Doanh Thu) + <strong className="text-blue-700">{selectedCount} cột Thi đua</strong>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                        >
                            Đóng
                        </button>
                        <button
                            type="button"
                            onClick={handleDownload}
                            disabled={isExporting}
                            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md transition cursor-pointer disabled:opacity-50"
                        >
                            <Download className={`w-4 h-4 ${isExporting ? 'animate-spin' : ''}`} />
                            <span>{isExporting ? 'Đang tạo Excel...' : `📥 TẢI FILE MẪU (${selectedCount} THI ĐUA)`}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
