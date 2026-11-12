import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    Target,
    X,
    Check,
    RefreshCw,
    Cloud,
    Sliders,
    CheckCircle2,
    AlertCircle,
    Zap,
    Lock
} from 'lucide-react';
import { type ClusterStoreRow, type ClusterTargetConfigItem } from '../types';
import { saveClusterTargetConfigs, fetchClusterTargetConfigPackage } from '../services/clusterTargetService';
import { getCompactStoreName } from '../ClusterReportPage';
import { useAuth } from '../../../shared/contexts/AuthContext';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    rows: ClusterStoreRow[];
    month: number;
    year: number;
    currentConfigs: ClusterTargetConfigItem[];
    initialGlobalPace?: number;
    onSaved: () => void;
}

interface StoreItemState {
    baseTarget: number;
    targetRate: number;
    targetOver: number;
    avg3Months: number;
}

const cleanTargetPrecision = (val: number, isMillionScale: boolean): number => {
    if (!Number.isFinite(val)) return 0;
    return isMillionScale ? Number(val.toFixed(1)) : Number(val.toFixed(3));
};

export default function ClusterTargetConfigModal({
    isOpen,
    onClose,
    rows,
    month,
    year,
    currentConfigs,
    initialGlobalPace = 100,
    onSaved
}: Props) {
    const { currentUser, isAdmin, canAccessStore } = useAuth();

    // Kiểm tra xem user có quyền sửa target của ST cụ thể không
    const isStoreEditable = (storeName: string): boolean => {
        if (isAdmin) return true;
        return canAccessStore(storeName) || canAccessStore(getCompactStoreName(storeName));
    };

    const [configMap, setConfigMap] = useState<Record<string, StoreItemState>>({});
    const [selectedPace, setSelectedPace] = useState<number>(initialGlobalPace || 100);
    const [customPaceInput, setCustomPaceInput] = useState<string>('');
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [isLoadingCloud, setIsLoadingCloud] = useState<boolean>(false);
    const [cloudSyncedTime, setCloudSyncedTime] = useState<string | null>(null);
    const [toastMsg, setToastMsg] = useState<string>('');
    const [errorMsg, setErrorMsg] = useState<string>('');

    const isMillionScale = useMemo(() => {
        if (rows.some(r => r.baseTarget > 100)) return true;
        return Object.values(configMap).some(v => v.baseTarget > 100);
    }, [rows, configMap]);

    // Hỗ trợ đóng modal bằng phím Esc
    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isSaving) onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen, isSaving, onClose]);

    // Nạp dữ liệu cấu hình khi modal mở
    useEffect(() => {
        if (!isOpen) return;
        setErrorMsg('');

        const loadData = async () => {
            setIsLoadingCloud(true);
            try {
                // Tải trực tiếp gói config từ Cloud để đồng bộ đa thiết bị
                const pkg = await fetchClusterTargetConfigPackage(month, year);
                const loadedConfigs = pkg.items.length > 0 ? pkg.items : currentConfigs;
                const cloudPace = pkg.globalPaceRate || 100;
                setSelectedPace(cloudPace);
                if (pkg.updatedAt) {
                    setCloudSyncedTime(new Date(pkg.updatedAt).toLocaleTimeString('vi-VN'));
                }

                const initial: Record<string, StoreItemState> = {};
                rows.forEach(r => {
                    const cfg = loadedConfigs.find(c => c.storeName === r.storeName);
                    // Xác định Target Gốc tham chiếu (LUÔN LẤY TARGET DTQĐ TỪ r.baseTarget)
                    const baseTarget = r.baseTarget && r.baseTarget > 0
                        ? r.baseTarget
                        : (cfg?.baseTarget && cfg.baseTarget > 0
                            ? cfg.baseTarget
                            : (r.revenueQd > 0 ? r.revenueQd : 4.5));

                    const rowIsMillion = baseTarget > 100;

                    // % Nhịp Target (mặc định theo cloudPace hoặc 100)
                    const targetRate = cfg?.targetRate && cfg.targetRate > 0
                        ? cfg.targetRate
                        : cloudPace;

                    // Target Vượt Trội
                    let targetOver = cfg?.targetOver && cfg.targetOver > 0
                        ? cfg.targetOver
                        : cleanTargetPrecision((baseTarget * targetRate) / 100, rowIsMillion);

                    if (cfg?.targetOver && cfg?.targetRate) {
                        const impliedBase = (cfg.targetOver / cfg.targetRate) * 100;
                        if (Math.abs(impliedBase - baseTarget) > (rowIsMillion ? 50 : 0.5)) {
                            // Target Vượt Trội cũ bị tính theo targetReal sai lệch, tự động tính lại theo baseTarget DTQĐ
                            targetOver = cleanTargetPrecision((baseTarget * targetRate) / 100, rowIsMillion);
                        }
                    }

                    targetOver = cleanTargetPrecision(targetOver, rowIsMillion);

                    // Doanh thu TB 3 tháng
                    const avg3Months = cfg?.avg3Months && cfg.avg3Months > 0
                        ? cfg.avg3Months
                        : (r.avg3Months > 0 ? r.avg3Months : cleanTargetPrecision((r.revenueQd || r.baseTarget || 2.0) * 1.05, rowIsMillion));

                    initial[r.storeName] = {
                        baseTarget: cleanTargetPrecision(baseTarget, rowIsMillion),
                        targetRate,
                        targetOver,
                        avg3Months
                    };
                });

                setConfigMap(initial);
            } catch (err) {
                console.error('Lỗi nạp config package:', err);
                setErrorMsg('Không thể đồng bộ cấu hình mới nhất từ Cloud, đang hiển thị dữ liệu hiện tại.');
            } finally {
                setIsLoadingCloud(false);
            }
        };

        loadData();
    }, [isOpen, rows, currentConfigs, month, year]);

    // Thống kê tổng hợp footer bảng (Luôn gọi Hook trước mọi điều kiện return để tuân thủ Rules of Hooks)
    const totals = useMemo(() => {
        let sumBase = 0;
        let sumOver = 0;
        let sumAvg3M = 0;
        const count = rows.length;

        Object.values(configMap).forEach(v => {
            sumBase += v.baseTarget || 0;
            sumOver += v.targetOver || 0;
            sumAvg3M += v.avg3Months || 0;
        });

        const avgRate = sumBase > 0 ? (sumOver / sumBase) * 100 : selectedPace;

        return {
            sumBase,
            sumOver,
            sumAvg3M,
            avgRate,
            count
        };
    }, [configMap, rows, selectedPace]);

    // Áp dụng nhịp Target chung (chỉ áp dụng cho các ST trong phạm vi phụ trách của user)
    const handleApplyPaceRateToAll = (pace: number) => {
        setErrorMsg('');
        setSelectedPace(pace);
        let updatedCount = 0;
        setConfigMap(prev => {
            const next: Record<string, StoreItemState> = {};
            Object.entries(prev).forEach(([storeName, item]) => {
                if (isAdmin || isStoreEditable(storeName)) {
                    const rowIsMillion = item.baseTarget > 100;
                    const calculatedTargetOver = cleanTargetPrecision((item.baseTarget * pace) / 100, rowIsMillion);
                    next[storeName] = {
                        ...item,
                        targetRate: pace,
                        targetOver: calculatedTargetOver
                    };
                    updatedCount++;
                } else {
                    next[storeName] = item;
                }
            });
            return next;
        });
        setToastMsg(`Đã áp dụng nhịp ${pace}% cho ${updatedCount} ST${isAdmin ? '' : ' bạn phụ trách'}.`);
        setTimeout(() => setToastMsg(''), 2500);
    };

    // Áp dụng nhịp tùy chỉnh từ ô input
    const handleApplyCustomPace = () => {
        const val = parseFloat(customPaceInput);
        if (isNaN(val) || val <= 0 || val > 300) {
            setErrorMsg('Vui lòng nhập mức % nhịp hợp lệ (từ 1 đến 300, ví dụ: 108, 112, 125).');
            return;
        }
        handleApplyPaceRateToAll(val);
        setCustomPaceInput('');
    };

    // Tùy chỉnh riêng lẻ từng ST (chỉ cho phép nếu user có quyền phụ trách ST này)
    const handleItemChange = (storeName: string, field: keyof StoreItemState, value: number) => {
        if (!isAdmin && !isStoreEditable(storeName)) return;
        setErrorMsg('');

        setConfigMap(prev => {
            const current = prev[storeName] || {
                baseTarget: 0,
                targetRate: selectedPace,
                targetOver: 0,
                avg3Months: 0
            };

            const rowIsMillion = current.baseTarget > 100;
            const updated = { ...current, [field]: value };

            // Tự động tính toán phụ thuộc
            if (field === 'targetRate') {
                // Đổi % nhịp -> tính lại Target Vượt Trội
                updated.targetOver = cleanTargetPrecision((updated.baseTarget * value) / 100, rowIsMillion);
            } else if (field === 'baseTarget') {
                // Đổi Target Gốc -> tính lại Target Vượt Trội theo % nhịp hiện tại của shop
                updated.targetOver = cleanTargetPrecision((value * updated.targetRate) / 100, value > 100);
            } else if (field === 'targetOver') {
                // Đổi trực tiếp Target Vượt Trội -> tự tính ngược % nhịp tương ứng
                if (updated.baseTarget > 0) {
                    updated.targetRate = Number(((value / updated.baseTarget) * 100).toFixed(1));
                }
            }

            return {
                ...prev,
                [storeName]: updated
            };
        });
    };

    // Lưu cấu hình lên Cloud (chỉ lưu các ST thuộc quyền phụ trách để merge an toàn)
    const handleSave = async () => {
        setErrorMsg('');
        setIsSaving(true);
        const configsToSave: ClusterTargetConfigItem[] = Object.entries(configMap)
            .filter(([storeName]) => isAdmin || isStoreEditable(storeName))
            .map(([storeName, val]) => ({
                storeName,
                month,
                year,
                baseTarget: val.baseTarget,
                targetRate: val.targetRate,
                targetOver: cleanTargetPrecision(val.targetOver, val.baseTarget > 100),
                avg3Months: val.avg3Months
            }));

        const res = await saveClusterTargetConfigs(month, year, configsToSave, selectedPace);
        setIsSaving(false);

        if (res.success) {
            onSaved();
            onClose();
        } else {
            setErrorMsg('Không thể lưu cấu hình: ' + (res.error || 'Lỗi kết nối Cloud.'));
        }
    };

    if (!isOpen) return null;

    const unitLabelShort = isMillionScale ? 'triệu đ' : 'tỷ đ';

    return createPortal(
        <div
            onClick={(e) => {
                if (e.target === e.currentTarget && !isSaving) onClose();
            }}
            className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150"
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="cluster-target-modal-title"
                className="bg-white rounded-3xl max-w-4xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150"
            >
                {/* 1. HEADER MODAL */}
                <div className="p-4 sm:p-5 border-b border-slate-200 bg-amber-50/40 flex items-start justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-amber-600 text-white flex items-center justify-center shadow-sm shrink-0">
                            <Target className="w-5 h-5 stroke-[2.4]" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 id="cluster-target-modal-title" className="font-black text-sm sm:text-base text-slate-900 uppercase tracking-tight">
                                    Cấu Hình Target Vượt Trội
                                </h3>
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                                    Kỳ {month}/{year}
                                </span>
                                {isAdmin ? (
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                        Toàn cụm ({rows.length} ST)
                                    </span>
                                ) : (
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                                        {currentUser?.role_title || (currentUser?.role === 'QUAN_LY' ? 'Quản lý' : 'Trưởng ca')}: {rows.filter(r => isStoreEditable(r.storeName)).length} ST phụ trách
                                    </span>
                                )}
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    <Cloud className="w-3 h-3" aria-hidden="true" />
                                    <span>Cloud</span>
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-600 mt-0.5">
                                {isAdmin
                                    ? 'Tùy chỉnh Target Vượt Trội chung hoặc riêng lẻ cho toàn bộ ST trong cụm.'
                                    : `Tùy chỉnh Target Vượt Trội cho các ST trong phạm vi bạn phụ trách (${currentUser?.store_name || 'được phân quyền'}).`
                                }
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        aria-label="Đóng hộp thoại cấu hình target"
                        className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
                    >
                        <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                </div>

                {/* 2. THANH CẤU HÌNH NHỊP CHUNG (100 - 105 - 110 - 115 - 120 & Tùy Chỉnh) */}
                <div className="p-3 sm:p-4 bg-slate-50/80 border-b border-slate-200 space-y-2.5 shrink-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                            <Sliders className="w-4 h-4 text-amber-600" aria-hidden="true" />
                            <span className="text-xs font-black text-slate-700 uppercase tracking-wide">
                                Thiết lập nhịp Target Vượt Trội:
                            </span>
                        </div>
                        {cloudSyncedTime && (
                            <span className="text-[10.5px] text-slate-500 font-mono tabular-nums">
                                Đồng bộ lúc: {cloudSyncedTime}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Các nút chọn nhịp nhanh: 100 (mặc định), 105, 110, 115, 120 */}
                        <div className="flex items-center flex-wrap gap-1 p-1 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                            {[100, 105, 110, 115, 120].map((rate) => {
                                const isCurrent = selectedPace === rate;
                                return (
                                    <button
                                        key={rate}
                                        type="button"
                                        onClick={() => handleApplyPaceRateToAll(rate)}
                                        className={`px-2.5 sm:px-3 py-1.5 min-h-[34px] rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 ${isCurrent
                                            ? 'bg-amber-600 text-white shadow-xs'
                                            : 'text-slate-700 hover:bg-amber-50 hover:text-amber-900'
                                            }`}
                                    >
                                        <span className="tabular-nums">{rate}%</span>
                                        {rate === 100 && (
                                            <span className="text-[9px] opacity-85 font-normal hidden sm:inline">(Chuẩn)</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Ô nhập tùy chỉnh % nhịp */}
                        <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200 shadow-2xs">
                            <input
                                id="custom-pace-input"
                                name="custom_pace_rate"
                                type="number"
                                step="1"
                                min="1"
                                max="300"
                                aria-label="Nhập mức phần trăm nhịp target khác"
                                placeholder="% khác (VD: 108)"
                                value={customPaceInput}
                                onChange={(e) => setCustomPaceInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleApplyCustomPace();
                                }}
                                className="w-36 sm:w-40 px-2.5 py-1 min-h-[34px] text-xs font-black font-mono tabular-nums text-slate-800 outline-none placeholder:text-slate-400 placeholder:font-normal"
                            />
                            <button
                                type="button"
                                onClick={handleApplyCustomPace}
                                className="px-3 py-1.5 min-h-[34px] bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700"
                                title="Áp dụng mức % nhịp này cho tất cả ST"
                            >
                                <Zap className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>Áp dụng</span>
                            </button>
                        </div>
                    </div>

                    {errorMsg && (
                        <div role="alert" className="p-2 text-xs bg-rose-50 text-rose-800 border border-rose-200 rounded-xl font-bold flex items-center gap-1.5 animate-in fade-in">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" aria-hidden="true" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {toastMsg && (
                        <div role="status" className="p-2 text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl font-bold flex items-center gap-1.5 animate-in fade-in">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                            <span>{toastMsg}</span>
                        </div>
                    )}
                </div>

                {/* 3. BẢNG DANH SÁCH ST & TÙY CHỈNH TỪNG CỘT */}
                <div className="p-3 sm:p-5 overflow-y-auto flex-1 space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium md:hidden px-0.5">
                        <span>Vuốt ngang bảng để sửa % Target &amp; Tar V.Trội →</span>
                    </div>
                    <div className="rounded-2xl border border-slate-200 overflow-x-auto shadow-2xs bg-white">
                        <table className="table-fixed w-full min-w-[482px] sm:min-w-[586px] text-xs text-left border-collapse">
                            {/* THEAD */}
                            <thead>
                                <tr className="bg-slate-100 text-slate-700 font-black uppercase text-[10.5px] tracking-tight border-b border-slate-200">
                                    <th className="py-2.5 px-1.5 text-center w-10 border-r border-slate-200">
                                        STT
                                    </th>
                                    <th className="sticky left-0 z-10 bg-slate-100 py-2.5 px-2 border-r border-slate-200 w-[116px] sm:w-[190px] shadow-[2px_0_4px_-2px_rgba(15,23,42,0.08)]">
                                        ST
                                    </th>
                                    <th className="py-2.5 px-2 text-right border-r border-slate-200 w-[118px] sm:w-[116px] bg-slate-100 text-slate-800">
                                        <div className="flex items-center justify-end gap-1">
                                            <Lock className="w-3 h-3 text-slate-500 shrink-0" aria-hidden="true" />
                                            <span>TARGET CHUẨN</span>
                                        </div>
                                        <div className="text-[9px] font-normal text-slate-500 lowercase">(cố định {unitLabelShort})</div>
                                    </th>
                                    <th className="py-2.5 px-1.5 sm:px-2 text-center border-r border-slate-200 w-[96px] sm:w-[110px] bg-amber-50/70 text-amber-900">
                                        % TARGET
                                        <div className="text-[9px] font-normal text-amber-800 lowercase">(tùy chỉnh)</div>
                                    </th>
                                    <th className="py-2.5 px-2 text-right w-[112px] sm:w-[130px] bg-orange-50/70 text-orange-900">
                                        TAR V.TRỘI
                                        <div className="text-[9px] font-normal text-orange-800 lowercase">({unitLabelShort} = gốc × %)</div>
                                    </th>
                                </tr>
                            </thead>

                            {/* TBODY */}
                            <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
                                {rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-8 text-center text-slate-500 italic">
                                            Không có dữ liệu ST trong kỳ báo cáo này.
                                        </td>
                                    </tr>
                                ) : (
                                    rows.map((row, idx) => {
                                        const item = configMap[row.storeName] || {
                                            baseTarget: 0,
                                            targetRate: selectedPace,
                                            targetOver: 0,
                                            avg3Months: 0
                                        };
                                        const rowIsMillion = item.baseTarget > 100;
                                        const shortName = getCompactStoreName(row.storeName);
                                        const isCustomRate = item.targetRate !== selectedPace;
                                        const canEdit = isAdmin || isStoreEditable(row.storeName);

                                        return (
                                            <tr
                                                key={row.storeName}
                                                className={`transition group ${!canEdit ? 'bg-slate-50/90 opacity-80' : 'bg-white hover:bg-amber-50/20'}`}
                                            >
                                                {/* STT */}
                                                <td className="py-2 px-2 text-center border-r border-slate-100 tabular-nums">
                                                    <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 font-black text-[10px] inline-flex items-center justify-center">
                                                        {idx + 1}
                                                    </span>
                                                </td>

                                                {/* ST (Sticky on narrow scroll) */}
                                                <td className={`sticky left-0 z-10 py-2 px-2 border-r border-slate-100 w-[118px] sm:w-[190px] shadow-[2px_0_4px_-2px_rgba(15,23,42,0.08)] ${!canEdit ? 'bg-slate-50' : 'bg-white group-hover:bg-amber-50'}`}>
                                                    <div className="flex items-center gap-1 min-w-0">
                                                        <div className="font-black text-slate-900 text-xs truncate flex-1 min-w-0" title={row.storeName}>
                                                            {shortName}
                                                        </div>
                                                        {!canEdit && (
                                                            <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-slate-100 text-slate-600 text-[9px] font-bold border border-slate-200 shrink-0" title="Chỉ đọc (Không thuộc ST phụ trách của bạn)">
                                                                <Lock className="w-2.5 h-2.5" aria-hidden="true" />
                                                                <span>Khóa</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 truncate" title={row.storeName}>
                                                        {row.storeName}
                                                    </div>
                                                </td>

                                                {/* TARGET GỐC (CỐ ĐỊNH, KHÔNG CHO PHÉP CHỈNH SỬA) */}
                                                <td className="py-2 px-2.5 text-right border-r border-slate-100 bg-slate-50/70 tabular-nums">
                                                    <div className="font-black text-slate-800 text-xs font-mono">
                                                        {rowIsMillion
                                                            ? Math.round(item.baseTarget).toLocaleString('en-US')
                                                            : item.baseTarget.toFixed(3)}
                                                    </div>
                                                    <div className="text-[9px] text-slate-500 font-medium">
                                                        Chuẩn LK
                                                    </div>
                                                </td>

                                                {/* % NHỊP TARGET (Chỉnh riêng lẻ) */}
                                                <td className="py-1.5 px-2 text-center border-r border-slate-100 bg-amber-50/20 tabular-nums">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <input
                                                            id={`store-rate-${idx}`}
                                                            name={`store_rate_${idx}`}
                                                            aria-label={`Phần trăm target cho ${shortName}`}
                                                            type="number"
                                                            step="1"
                                                            disabled={!canEdit}
                                                            value={item.targetRate || ''}
                                                            onChange={(e) => handleItemChange(row.storeName, 'targetRate', parseFloat(e.target.value) || 0)}
                                                            className={`w-16 text-center px-1.5 py-1.5 min-h-[34px] rounded-lg text-xs font-black outline-none tabular-nums focus-visible:ring-2 focus-visible:ring-amber-500 ${!canEdit
                                                                ? 'bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed'
                                                                : isCustomRate
                                                                    ? 'border border-amber-400 bg-amber-50 text-amber-900 ring-1 ring-amber-300'
                                                                    : 'border-slate-300 group-hover:border-amber-400 text-slate-800 bg-white border'
                                                                }`}
                                                            placeholder="100"
                                                            title={!canEdit ? 'Chỉ quản lý phụ trách ST này hoặc Admin mới có quyền điều chỉnh' : undefined}
                                                        />
                                                        <span className="text-[11px] font-bold text-slate-500">%</span>
                                                    </div>
                                                </td>

                                                {/* TAR V.TRỘI */}
                                                <td className="py-1.5 px-2 text-right bg-orange-50/20 tabular-nums">
                                                    <input
                                                        id={`store-target-over-${idx}`}
                                                        name={`store_target_over_${idx}`}
                                                        aria-label={`Target vượt trội cho ${shortName}`}
                                                        type="number"
                                                        step={rowIsMillion ? '1' : '0.001'}
                                                        disabled={!canEdit}
                                                        value={item.targetOver ? cleanTargetPrecision(item.targetOver, rowIsMillion) : ''}
                                                        onChange={(e) => handleItemChange(row.storeName, 'targetOver', parseFloat(e.target.value) || 0)}
                                                        className={`w-full text-right px-2 py-1.5 min-h-[34px] rounded-lg text-xs font-black font-mono tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${!canEdit
                                                            ? 'bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed'
                                                            : 'bg-white border border-slate-300 group-hover:border-orange-400 focus:border-orange-500 text-orange-950'
                                                            }`}
                                                        placeholder={rowIsMillion ? '0' : '0.000'}
                                                        title={!canEdit ? 'Chỉ quản lý phụ trách ST này hoặc Admin mới có quyền điều chỉnh' : undefined}
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>

                            {/* TFOOT DÒNG TỔNG CỘNG */}
                            <tfoot>
                                <tr className="bg-slate-100 text-slate-900 font-black text-xs border-t-2 border-slate-300 tabular-nums">
                                    <td className="py-2.5 px-1.5 text-center border-r border-slate-200 text-slate-500">
                                        Σ
                                    </td>
                                    <td className="sticky left-0 z-10 bg-slate-100 py-2.5 px-2 text-left uppercase tracking-wider border-r border-slate-200 shadow-[2px_0_4px_-2px_rgba(15,23,42,0.08)] text-[11px] truncate" title={`TỔNG CỤM (${totals.count} ST)`}>
                                        TỔNG ({totals.count} ST)
                                    </td>
                                    <td className="py-2.5 px-2 text-right font-mono font-black text-blue-950 border-r border-slate-200">
                                        {isMillionScale
                                            ? Math.round(totals.sumBase).toLocaleString('en-US')
                                            : totals.sumBase.toFixed(3)}
                                    </td>
                                    <td className="py-2.5 px-1.5 text-center font-black text-amber-900 border-r border-slate-200">
                                        {totals.avgRate.toFixed(1)}%
                                    </td>
                                    <td className="py-2.5 px-2 text-right font-mono font-black text-orange-950">
                                        {isMillionScale
                                            ? cleanTargetPrecision(totals.sumOver, true).toLocaleString('en-US')
                                            : totals.sumOver.toFixed(3)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* 4. FOOTER CỦA MODAL */}
                <div className="p-3.5 sm:p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
                    <div className="flex items-center gap-2 text-slate-600 text-xs">
                        <Cloud className="w-4 h-4 text-emerald-700 shrink-0" aria-hidden="true" />
                        <span>Dữ liệu được lưu đồng bộ qua Cloud.</span>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSaving}
                            className="flex-1 sm:flex-initial justify-center px-4 py-2 min-h-[38px] rounded-xl text-xs font-bold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving || isLoadingCloud}
                            className="flex-1 sm:flex-initial justify-center px-5 py-2 min-h-[38px] rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600"
                        >
                            {isSaving ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
                                    <span>Đang Lưu Lên Cloud...</span>
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4 stroke-[3]" aria-hidden="true" />
                                    <span>Lưu Cấu Hình Cloud</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
