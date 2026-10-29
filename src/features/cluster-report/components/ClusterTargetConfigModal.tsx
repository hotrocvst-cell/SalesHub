import { useState, useEffect, useMemo } from 'react';
import {
    Target,
    X,
    Check,
    Sparkles,
    RefreshCw,
    Cloud,
    Sliders,
    TrendingUp,
    CheckCircle2,
    Calculator,
    Zap,
    Lock,
    ShieldCheck
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

    // Kiểm tra xem user có quyền sửa target của siêu thị cụ thể không
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

    // Nạp dữ liệu cấu hình khi modal mở
    useEffect(() => {
        if (!isOpen) return;

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
                    // Xác định Target Gốc tham chiếu (nếu r.revenueTarget có thì lấy, hoặc ước lượng)
                    const baseTarget = cfg?.baseTarget && cfg.baseTarget > 0
                        ? cfg.baseTarget
                        : (r.baseTarget && r.baseTarget > 0
                            ? r.baseTarget
                            : (r.revenueActual > 0 ? Number((r.revenueActual * 1.3).toFixed(3)) : 4.5));

                    // % Nhịp Target (mặc định theo cloudPace hoặc 100)
                    const targetRate = cfg?.targetRate && cfg.targetRate > 0
                        ? cfg.targetRate
                        : cloudPace;

                    // Target Vượt Trội
                    const targetOver = cfg?.targetOver && cfg.targetOver > 0
                        ? cfg.targetOver
                        : Number(((baseTarget * targetRate) / 100).toFixed(3));

                    // Doanh thu TB 3 tháng
                    const avg3Months = cfg?.avg3Months && cfg.avg3Months > 0
                        ? cfg.avg3Months
                        : (r.avg3Months > 0 ? r.avg3Months : Number(((r.revenueActual || 2.0) * 1.05).toFixed(3)));

                    initial[r.storeName] = {
                        baseTarget,
                        targetRate,
                        targetOver,
                        avg3Months
                    };
                });

                setConfigMap(initial);
            } catch (err) {
                console.error('Lỗi nạp config package:', err);
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

    // Áp dụng nhịp Target chung (chỉ áp dụng cho các siêu thị trong phạm vi phụ trách của user)
    const handleApplyPaceRateToAll = (pace: number) => {
        setSelectedPace(pace);
        let updatedCount = 0;
        setConfigMap(prev => {
            const next: Record<string, StoreItemState> = {};
            Object.entries(prev).forEach(([storeName, item]) => {
                if (isAdmin || isStoreEditable(storeName)) {
                    const calculatedTargetOver = Number(((item.baseTarget * pace) / 100).toFixed(3));
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
        setToastMsg(`⚡ Đã áp dụng nhịp ${pace}% cho ${updatedCount} siêu thị${isAdmin ? '' : ' bạn phụ trách'}!`);
        setTimeout(() => setToastMsg(''), 2500);
    };

    // Áp dụng nhịp tùy chỉnh từ ô input
    const handleApplyCustomPace = () => {
        const val = parseFloat(customPaceInput);
        if (isNaN(val) || val <= 0) {
            alert('Vui lòng nhập số % nhịp hợp lệ (ví dụ: 108, 112, 125...)');
            return;
        }
        handleApplyPaceRateToAll(val);
        setCustomPaceInput('');
    };

    // Tùy chỉnh riêng lẻ từng siêu thị (chỉ cho phép nếu user có quyền phụ trách siêu thị này)
    const handleItemChange = (storeName: string, field: keyof StoreItemState, value: number) => {
        if (!isAdmin && !isStoreEditable(storeName)) return;

        setConfigMap(prev => {
            const current = prev[storeName] || {
                baseTarget: 0,
                targetRate: selectedPace,
                targetOver: 0,
                avg3Months: 0
            };

            const updated = { ...current, [field]: value };

            // Tự động tính toán phụ thuộc
            if (field === 'targetRate') {
                // Đổi % nhịp -> tính lại Target Vượt Trội
                updated.targetOver = Number(((updated.baseTarget * value) / 100).toFixed(3));
            } else if (field === 'baseTarget') {
                // Đổi Target Gốc -> tính lại Target Vượt Trội theo % nhịp hiện tại của shop
                updated.targetOver = Number(((value * updated.targetRate) / 100).toFixed(3));
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

    // Lưu cấu hình lên Cloud (chỉ lưu các siêu thị thuộc quyền phụ trách để merge an toàn)
    const handleSave = async () => {
        setIsSaving(true);
        const configsToSave: ClusterTargetConfigItem[] = Object.entries(configMap)
            .filter(([storeName]) => isAdmin || isStoreEditable(storeName))
            .map(([storeName, val]) => ({
                storeName,
                month,
                year,
                baseTarget: val.baseTarget,
                targetRate: val.targetRate,
                targetOver: val.targetOver,
                avg3Months: val.avg3Months
            }));

        const res = await saveClusterTargetConfigs(month, year, configsToSave, selectedPace);
        setIsSaving(false);

        if (res.success) {
            onSaved();
            onClose();
        } else {
            alert('Không thể lưu cấu hình: ' + (res.error || 'Lỗi không xác định'));
        }
    };

    if (!isOpen) return null;

    return (
        <div
            style={{ fontFamily: "'UTM Avo', 'UTM-Avo', sans-serif" }}
            className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150"
        >
            <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[94vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
                {/* 1. HEADER MODAL */}
                <div className="p-4 sm:p-5 border-b border-slate-200 bg-gradient-to-r from-amber-50/70 via-white to-orange-50/50 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-md shadow-amber-200 shrink-0">
                            <Target className="w-5 h-5 stroke-[2.5]" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-black text-sm sm:text-base text-slate-800 uppercase tracking-tight">
                                    Cấu Hình Target Vượt Trội
                                </h3>
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                                    Kỳ {month}/{year}
                                </span>
                                {isAdmin ? (
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                        Toàn cụm ({rows.length} siêu thị)
                                    </span>
                                ) : (
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                                        {currentUser?.role_title || (currentUser?.role === 'QUAN_LY' ? 'Quản lý' : 'Trưởng ca')}: {rows.filter(r => isStoreEditable(r.storeName)).length} siêu thị phụ trách
                                    </span>
                                )}
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <Cloud className="w-3 h-3" />
                                    <span>Cloud Supabase</span>
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                                {isAdmin
                                    ? 'Tùy chỉnh Target Vượt Trội chung hoặc riêng lẻ cho toàn bộ siêu thị trong cụm.'
                                    : `Tùy chỉnh Target Vượt Trội cho các siêu thị trong phạm vi bạn phụ trách (${currentUser?.store_name || 'được phân quyền'}).`
                                }
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer shrink-0"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* 2. THANH CẤU HÌNH NHỊP CHUNG (100 - 105 - 110 - 115 - 120 & Tùy Chỉnh) */}
                <div className="p-3 sm:p-4 bg-slate-50/80 border-b border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                            <Sliders className="w-4 h-4 text-amber-600" />
                            <span className="text-xs font-black text-slate-700 uppercase tracking-wide">
                                Thiết Lập Target Vượt trội:
                            </span>
                        </div>
                        {cloudSyncedTime && (
                            <span className="text-[10px] text-slate-400 font-mono">
                                Đồng bộ lần cuối: {cloudSyncedTime}
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Các nút chọn nhịp nhanh: 100 (mặc định), 105, 110, 115, 120 */}
                        <div className="flex items-center gap-1.5 p-1 bg-white rounded-2xl border border-slate-200 shadow-2xs">
                            {[100, 105, 110, 115, 120].map((rate) => {
                                const isCurrent = selectedPace === rate;
                                return (
                                    <button
                                        key={rate}
                                        type="button"
                                        onClick={() => handleApplyPaceRateToAll(rate)}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1 ${isCurrent
                                            ? 'bg-amber-500 text-white shadow-xs'
                                            : 'text-slate-600 hover:bg-amber-50 hover:text-amber-800'
                                            }`}
                                    >
                                        <span>{rate}%</span>
                                        {rate === 100 && (
                                            <span className="text-[9px] opacity-80 font-normal hidden sm:inline">(Chuẩn)</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Ô nhập tùy chỉnh % nhịp */}
                        <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200 shadow-2xs">
                            <input
                                type="number"
                                step="1"
                                min="50"
                                max="300"
                                placeholder="Nhập % khác (VD: 108)"
                                value={customPaceInput}
                                onChange={(e) => setCustomPaceInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleApplyCustomPace();
                                }}
                                className="w-36 px-2.5 py-1 text-xs font-black font-mono text-slate-800 outline-none placeholder:text-slate-400 placeholder:font-normal"
                            />
                            <button
                                type="button"
                                onClick={handleApplyCustomPace}
                                className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1"
                                title="Áp dụng mức % nhịp này cho tất cả siêu thị"
                            >
                                <Zap className="w-3.5 h-3.5" />
                                <span>Áp Dụng</span>
                            </button>
                        </div>
                    </div>

                    {toastMsg && (
                        <div className="p-2 text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl font-bold flex items-center gap-1.5 animate-in fade-in">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>{toastMsg}</span>
                        </div>
                    )}
                </div>

                {/* 3. BẢNG DANH SÁCH SIÊU THỊ & TÙY CHỈNH TỪNG CỘT */}
                <div className="p-3 sm:p-5 overflow-y-auto flex-1">
                    <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-2xs bg-white">
                        <table className="w-full text-xs text-left border-collapse">
                            {/* THEAD */}
                            <thead>
                                <tr className="bg-slate-100/90 text-slate-700 font-black uppercase text-[10.5px] tracking-tight border-b border-slate-200">
                                    <th className="py-2.5 px-2 text-center w-12 border-r border-slate-200">
                                        STT
                                    </th>
                                    <th className="py-2.5 px-3 border-r border-slate-200 min-w-[180px]">
                                        SIÊU THỊ
                                    </th>
                                    <th className="py-2.5 px-2.5 text-right border-r border-slate-200 w-28 bg-slate-100 text-slate-800">
                                        <div className="flex items-center justify-end gap-1">
                                            <Lock className="w-3 h-3 text-slate-500" />
                                            <span>TARGET CHUẨN</span>
                                        </div>
                                        <div className="text-[9px] font-normal text-slate-500 lowercase">(cố định tỷ đ)</div>
                                    </th>
                                    <th className="py-2.5 px-2 text-center border-r border-slate-200 w-28 bg-amber-50/70 text-amber-900">
                                        % TARGET
                                        <div className="text-[9px] font-normal text-amber-700 lowercase">(tùy chỉnh riêng)</div>
                                    </th>
                                    <th className="py-2.5 px-2.5 text-right w-32 bg-orange-50/70 text-orange-900">
                                        TAR V.TRỘI
                                        <div className="text-[9px] font-normal text-orange-700 lowercase">(tự động = gốc * %)</div>
                                    </th>
                                </tr>
                            </thead>

                            {/* TBODY */}
                            <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
                                {rows.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                                            Không có dữ liệu siêu thị trong kỳ báo cáo này.
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
                                        const shortName = getCompactStoreName(row.storeName);
                                        const isCustomRate = item.targetRate !== selectedPace;
                                        const canEdit = isAdmin || isStoreEditable(row.storeName);

                                        return (
                                            <tr
                                                key={row.storeName}
                                                className={`transition group ${!canEdit ? 'bg-slate-50/70 opacity-75' : 'hover:bg-amber-50/20'}`}
                                            >
                                                {/* STT */}
                                                <td className="py-2 px-2 text-center border-r border-slate-100">
                                                    <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 font-black text-[10px] inline-flex items-center justify-center">
                                                        {idx + 1}
                                                    </span>
                                                </td>

                                                {/* SIÊU THỊ */}
                                                <td className="py-2 px-3 border-r border-slate-100">
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="font-black text-slate-900 text-xs truncate" title={row.storeName}>
                                                            {shortName}
                                                        </div>
                                                        {!canEdit && (
                                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 text-[9px] font-bold border border-slate-200 shrink-0" title="Chỉ đọc (Không thuộc siêu thị phụ trách của bạn)">
                                                                <Lock className="w-2.5 h-2.5" />
                                                                <span>Khóa</span>
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 truncate max-w-[220px]" title={row.storeName}>
                                                        {row.storeName}
                                                    </div>
                                                </td>

                                                {/* TARGET GỐC (CỐ ĐỊNH, KHÔNG CHO PHÉP CHỈNH SỬA) */}
                                                <td className="py-2 px-2.5 text-right border-r border-slate-100 bg-slate-50/70">
                                                    <div className="font-black text-slate-800 text-xs font-mono">
                                                        {item.baseTarget.toFixed(3)}
                                                    </div>
                                                    <div className="text-[9px] text-slate-400 font-medium">
                                                        Chuẩn LK
                                                    </div>
                                                </td>

                                                {/* % NHỊP TARGET (Chỉnh riêng lẻ) */}
                                                <td className="py-1.5 px-2 text-center border-r border-slate-100 bg-amber-50/20">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <input
                                                            type="number"
                                                            step="1"
                                                            disabled={!canEdit}
                                                            value={item.targetRate || ''}
                                                            onChange={(e) => handleItemChange(row.storeName, 'targetRate', parseFloat(e.target.value) || 0)}
                                                            className={`w-16 text-center px-1.5 py-1 rounded-lg text-xs font-black outline-none ${!canEdit
                                                                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                                                                : isCustomRate
                                                                    ? 'border-amber-400 bg-amber-50 text-amber-900 ring-1 ring-amber-300'
                                                                    : 'border-slate-200 group-hover:border-amber-300 text-slate-800 bg-white border'
                                                                }`}
                                                            placeholder="100"
                                                            title={!canEdit ? 'Chỉ quản lý phụ trách siêu thị này hoặc Admin mới có quyền điều chỉnh' : undefined}
                                                        />
                                                        <span className="text-[11px] font-bold text-slate-400">%</span>
                                                    </div>
                                                </td>

                                                {/* TAR V.TRỘI */}
                                                <td className="py-1.5 px-2 text-right bg-orange-50/20">
                                                    <input
                                                        type="number"
                                                        step="0.001"
                                                        disabled={!canEdit}
                                                        value={item.targetOver || ''}
                                                        onChange={(e) => handleItemChange(row.storeName, 'targetOver', parseFloat(e.target.value) || 0)}
                                                        className={`w-full text-right px-2 py-1 rounded-lg text-xs font-black outline-none ${!canEdit
                                                            ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                                                            : 'bg-white border border-slate-200 group-hover:border-orange-300 focus:border-orange-500 text-orange-900'
                                                            }`}
                                                        placeholder="0.000"
                                                        title={!canEdit ? 'Chỉ quản lý phụ trách siêu thị này hoặc Admin mới có quyền điều chỉnh' : undefined}
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>

                            {/* TFOOT DÒNG TỔNG CỘNG */}
                            <tfoot>
                                <tr className="bg-slate-100 text-slate-900 font-black text-xs border-t-2 border-slate-300">
                                    <td colSpan={2} className="py-2.5 px-3 text-left uppercase tracking-wider border-r border-slate-200">
                                        TỔNG CỤM ({totals.count} SIÊU THỊ)
                                    </td>
                                    <td className="py-2.5 px-2.5 text-right font-black text-blue-950 border-r border-slate-200">
                                        {totals.sumBase.toFixed(3)}
                                    </td>
                                    <td className="py-2.5 px-2 text-center font-black text-amber-900 border-r border-slate-200">
                                        {totals.avgRate.toFixed(1)}%
                                    </td>
                                    <td className="py-2.5 px-2.5 text-right font-black text-orange-950">
                                        {totals.sumOver.toFixed(3)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* 4. FOOTER CỦA MODAL */}
                <div className="p-3.5 sm:p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-slate-500 text-xs">
                        <Cloud className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Dữ liệu được lưu tự động qua Cloud.</span>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving || isLoadingCloud}
                            className="px-5 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-md shadow-amber-200 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                            {isSaving ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    <span>Đang Lưu Lên Cloud...</span>
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4 stroke-[3]" />
                                    <span>Lưu Cấu Hình Cloud</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
