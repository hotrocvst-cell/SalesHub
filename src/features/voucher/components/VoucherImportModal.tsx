import React, { useState, useMemo } from 'react';
import { X, Plus, Upload, Check, AlertCircle, Layers, Calendar, Store, Shield, Sparkles } from 'lucide-react';
import { importVouchers, getDefaultExpiryDate } from '../services/voucherService';
import { formatDate, getShortStoreName } from '../../../core/lib/formatters';
import { getDenominationHotStyle, formatCurrency, parseCurrencyInput } from '../voucherFormatters';
import type { VoucherItem } from '../types';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    currentStoreName?: string;
    currentUserDisplayName: string;
    existingCampaigns: string[];
    existingVouchers?: VoucherItem[];
    allowedStores?: Array<{ name: string; id?: string }>;
    accessibleStores?: string[];
    isAdmin?: boolean;
    onSuccess: (addedCount: number, duplicateCount: number, cloudWarning?: string) => void;
    presetCampaignName?: string;
    presetDenomination?: number;
    presetDescription?: string;
}

const COMMON_DENOMINATIONS = [50000, 100000, 200000, 500000, 1000000, 2000000, 3000000];

export default function VoucherImportModal({
    isOpen,
    onClose,
    currentUserDisplayName,
    existingCampaigns,
    existingVouchers = [],
    allowedStores = [],
    accessibleStores = [],
    isAdmin = false,
    onSuccess,
    presetCampaignName,
    presetDenomination,
    presetDescription
}: Props) {
    // Phạm vi áp dụng: 'CLUSTER' (toàn cụm của user), hoặc tên một siêu thị cụ thể
    const [scopeType, setScopeType] = useState<string>('CLUSTER');
    const [campaignName, setCampaignName] = useState<string>('');
    const [customCampaign, setCustomCampaign] = useState<string>('');
    const [denomination, setDenomination] = useState<number>(50000);
    const [description, setDescription] = useState<string>('');
    const [expiresAt, setExpiresAt] = useState<string>(getDefaultExpiryDate());
    const [rawCodesText, setRawCodesText] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMsg, setErrorMsg] = useState<string>('');

    // Xây dựng bản đồ cấu hình diễn giải đã có từ lịch sử voucher đã cấu hình trước đó
    const { configByCampaignAndDenom, configByCampaignOnly } = useMemo(() => {
        const byBoth = new Map<string, string>();
        const byCamp = new Map<string, string>();

        if (existingVouchers && existingVouchers.length > 0) {
            // Sắp xếp các voucher mới nhất lên đầu để lấy mô tả cập nhật gần nhất
            const sorted = [...existingVouchers].sort((a, b) => {
                const tA = a.created_at ? new Date(a.created_at).getTime() : 0;
                const tB = b.created_at ? new Date(b.created_at).getTime() : 0;
                return tB - tA;
            });

            sorted.forEach(v => {
                const desc = v.description?.trim();
                if (!desc) return;

                const cName = v.campaign_name.trim().toLowerCase();
                const denom = Number(v.denomination) || 0;
                const bothKey = `${cName}___${denom}`;

                if (!byBoth.has(bothKey)) {
                    byBoth.set(bothKey, desc);
                }
                if (!byCamp.has(cName)) {
                    byCamp.set(cName, desc);
                }
            });
        }

        return { configByCampaignAndDenom: byBoth, configByCampaignOnly: byCamp };
    }, [existingVouchers]);

    // Tự động tìm kiếm và cập nhật diễn giải theo chương trình và mệnh giá đã cấu hình trước đó
    const autoFillDescription = React.useCallback((targetCamp: string, targetDenom: number) => {
        const cleanCamp = targetCamp.trim().toLowerCase();
        if (!cleanCamp) return;

        const bothKey = `${cleanCamp}___${targetDenom}`;
        const matched = configByCampaignAndDenom.get(bothKey) || configByCampaignOnly.get(cleanCamp);
        if (matched) {
            setDescription(matched);
        }
    }, [configByCampaignAndDenom, configByCampaignOnly]);

    React.useEffect(() => {
        if (isOpen) {
            let initialCamp = '';
            let initialDenom = presetDenomination && presetDenomination > 0 ? presetDenomination : denomination;

            if (presetCampaignName) {
                if (existingCampaigns.includes(presetCampaignName)) {
                    setCampaignName(presetCampaignName);
                    setCustomCampaign('');
                    initialCamp = presetCampaignName;
                } else {
                    setCampaignName('NEW');
                    setCustomCampaign(presetCampaignName);
                    initialCamp = presetCampaignName;
                }
            }
            if (presetDenomination && presetDenomination > 0) {
                setDenomination(presetDenomination);
            }

            if (presetDescription) {
                setDescription(presetDescription);
            } else if (initialCamp) {
                // Tự động tìm và điền diễn giải theo cấu hình trước đó của chương trình & mệnh giá
                autoFillDescription(initialCamp, initialDenom);
            }
        }
    }, [isOpen, presetCampaignName, presetDenomination, presetDescription, existingCampaigns, autoFillDescription]);

    // Danh sách siêu thị trong cụm của người dùng
    const clusterStoreNames = useMemo(() => {
        if (allowedStores && allowedStores.length > 0) {
            return allowedStores.map(s => s.name);
        }
        if (accessibleStores && accessibleStores.length > 0) {
            return accessibleStores;
        }
        return [];
    }, [allowedStores, accessibleStores]);

    // Tách và chuẩn hóa danh sách mã
    const parsedCodes = useMemo(() => {
        if (!rawCodesText.trim()) return [];
        const lines = rawCodesText.split('\n');
        const set = new Set<string>();
        lines.forEach(l => {
            const clean = l.trim().toUpperCase();
            if (clean) set.add(clean);
        });
        return Array.from(set);
    }, [rawCodesText]);

    const currentActiveCampaign = (campaignName === 'NEW' ? customCampaign : campaignName).trim().toLowerCase();
    const isAutoMatchedConfig = useMemo(() => {
        if (!currentActiveCampaign || !description.trim()) return false;
        const bothKey = `${currentActiveCampaign}___${denomination}`;
        const prev = configByCampaignAndDenom.get(bothKey) || configByCampaignOnly.get(currentActiveCampaign);
        return Boolean(prev && prev === description.trim());
    }, [currentActiveCampaign, denomination, description, configByCampaignAndDenom, configByCampaignOnly]);

    if (!isOpen) return null;

    const effectiveCampaign = (campaignName === 'NEW' ? customCampaign : campaignName).trim();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');

        if (!effectiveCampaign) {
            setErrorMsg('Vui lòng chọn hoặc nhập tên chương trình áp dụng mã voucher!');
            return;
        }

        if (denomination <= 0) {
            setErrorMsg('Mệnh giá voucher phải lớn hơn 0đ!');
            return;
        }

        if (!expiresAt) {
            setErrorMsg('Vui lòng chọn ngày hết hạn sử dụng cho mã voucher!');
            return;
        }

        if (parsedCodes.length === 0) {
            setErrorMsg('Vui lòng nhập ít nhất 1 mã voucher vào ô danh sách!');
            return;
        }

        // Xác định store_name và cluster_stores
        let targetStoreName: string;
        let targetClusterStores: string[] | undefined;

        if (scopeType === 'CLUSTER') {
            // Nạp cho Toàn Cụm của Quản lý: Lấy shop đầu tiên làm đại diện và gắn danh sách cả Cụm
            targetStoreName = clusterStoreNames[0] || 'Toàn Cụm Siêu Thị';
            targetClusterStores = clusterStoreNames.length > 0 ? clusterStoreNames : undefined;
        } else if (scopeType === 'ALL_GLOBAL' && isAdmin) {
            // Chỉ dành cho Admin tối cao nạp toàn quốc
            targetStoreName = 'Toàn Cụm Siêu Thị';
            targetClusterStores = undefined;
        } else {
            // Nạp riêng cho 1 shop cụ thể
            targetStoreName = scopeType;
            targetClusterStores = undefined;
        }

        setIsSubmitting(true);
        try {
            const res = await importVouchers({
                store_name: targetStoreName,
                cluster_stores: targetClusterStores,
                campaign_name: effectiveCampaign,
                denomination,
                description: description.trim() || undefined,
                expires_at: expiresAt,
                codes: parsedCodes,
                created_by: currentUserDisplayName
            });

            if (!res.success) {
                setErrorMsg(res.error || 'Lỗi khi nạp mã');
                return;
            }

            onSuccess(res.addedCount, res.duplicateCount, res.cloudWarning);
            setRawCodesText('');
            onClose();
        } catch (err: any) {
            setErrorMsg(err.message || 'Lỗi không xác định');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs font-avo animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
                {/* Header */}
                <div className="bg-emerald-700 px-5 py-4 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Plus className="w-5 h-5 text-amber-300" />
                        <div>
                            <h3 className="font-black text-sm uppercase tracking-wide">
                                Nạp Mã Voucher Mới Vào Kho
                            </h3>
                            <div className="text-[11px] text-emerald-200">
                                Quản lý: <strong>{currentUserDisplayName}</strong>
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-xl hover:bg-emerald-800 text-white transition cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
                    {errorMsg && (
                        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2 font-bold">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {/* 0. PHÂN QUYỀN SỬ DỤNG THEO CỤM (BẢO VỆ RIÊNG TƯ) */}
                    <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-black text-emerald-950 flex items-center gap-1.5">
                                <Shield className="w-4 h-4 text-emerald-700" />
                                <span>Phạm Vi Phân Quyền Cụm & Riêng Tư:</span>
                            </span>
                            <span className="text-[10px] bg-emerald-200/90 text-emerald-900 px-2 py-0.5 rounded-full font-bold">
                                Bảo Vệ Dữ Liệu
                            </span>
                        </div>

                        <select
                            value={scopeType}
                            onChange={(e) => setScopeType(e.target.value)}
                            className="w-full bg-white border border-emerald-300 rounded-xl p-2 font-bold text-slate-900 focus:outline-emerald-600 cursor-pointer text-xs"
                        >
                            {clusterStoreNames.length > 1 && (
                                <option value="CLUSTER">
                                    🏢 Toàn Cụm Của Tôi ({clusterStoreNames.length} shop - Dùng chung nội bộ cụm)
                                </option>
                            )}
                            {clusterStoreNames.map(name => (
                                <option key={name} value={name}>
                                    🏪 Riêng shop: {getShortStoreName(name)}
                                </option>
                            ))}
                            {isAdmin && (
                                <option value="ALL_GLOBAL">
                                    🌐 Toàn Hệ Thống (Tất Cả Cụm - Dành riêng Admin)
                                </option>
                            )}
                        </select>

                        <p className="text-[10.5px] text-emerald-800 leading-relaxed">
                            {scopeType === 'CLUSTER'
                                ? `Mã chỉ cấp cho nhân viên thuộc ${clusterStoreNames.length} siêu thị trong cụm của bạn. Các cụm khác hoàn toàn không thể xem hoặc lấy mã.`
                                : scopeType === 'ALL_GLOBAL'
                                    ? 'Mã dùng chung cho toàn bộ nhân viên trên toàn quốc.'
                                    : `Mã chỉ dành riêng cho nhân viên tại siêu thị ${getShortStoreName(scopeType)}.`}
                        </p>
                    </div>

                    {/* 1. Chọn Chương Trình */}
                    <div>
                        <label className="block text-[11px] font-black uppercase text-slate-700 mb-1.5">
                            1. Chương Trình Áp Dụng <span className="text-rose-500">*</span>
                        </label>
                        <select
                            value={campaignName}
                            onChange={(e) => {
                                const val = e.target.value;
                                setCampaignName(val);
                                if (val && val !== 'NEW') {
                                    autoFillDescription(val, denomination);
                                }
                            }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-slate-800 focus:outline-emerald-600 cursor-pointer"
                        >
                            <option value="">-- Chọn chương trình --</option>
                            {existingCampaigns.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                            <option value="NEW">➕ Thêm chương trình mới...</option>
                        </select>

                        {campaignName === 'NEW' && (
                            <input
                                type="text"
                                value={customCampaign}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setCustomCampaign(val);
                                    if (val.trim()) {
                                        autoFillDescription(val, denomination);
                                    }
                                }}
                                placeholder="Nhập tên chương trình mới (vd: Đồng Hồ Thông Minh, Gia Dụng Sunhouse...)"
                                className="mt-2 w-full bg-white border border-emerald-300 rounded-xl p-2.5 font-bold text-slate-900 focus:outline-emerald-600"
                                autoFocus
                            />
                        )}
                    </div>

                    {/* 2. Chọn Mệnh Giá */}
                    <div>
                        <label className="block text-[11px] font-black uppercase text-slate-700 mb-1.5">
                            2. Mệnh Giá Voucher <span className="text-rose-500">*</span>
                        </label>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                            {COMMON_DENOMINATIONS.map(d => {
                                const hot = getDenominationHotStyle(d);
                                const isSelected = denomination === d;
                                return (
                                    <button
                                        key={d}
                                        type="button"
                                        onClick={() => {
                                            setDenomination(d);
                                            const activeCamp = (campaignName === 'NEW' ? customCampaign : campaignName).trim();
                                            if (activeCamp) {
                                                autoFillDescription(activeCamp, d);
                                            }
                                        }}
                                        className={`px-2.5 py-1.5 rounded-xl font-mono text-xs font-black transition cursor-pointer border flex items-center gap-1 ${isSelected
                                            ? hot.activeClass
                                            : `${hot.bgClass} ${hot.textClass} ${hot.borderClass} hover:opacity-90`
                                            }`}
                                    >
                                        <span className="text-[10px]">{hot.tagIcon}</span>
                                        <span>{formatCurrency(d)}</span>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-500 font-bold shrink-0 text-xs">Mệnh giá tùy chỉnh:</span>
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={denomination > 0 ? denomination.toLocaleString('vi-VN') : ''}
                                    onChange={(e) => {
                                        const parsed = parseCurrencyInput(e.target.value);
                                        setDenomination(parsed);
                                        const activeCamp = (campaignName === 'NEW' ? customCampaign : campaignName).trim();
                                        if (activeCamp && parsed > 0) {
                                            autoFillDescription(activeCamp, parsed);
                                        }
                                    }}
                                    placeholder="Nhập mệnh giá (VD: 50.000)..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-3 pr-12 font-mono font-black text-sm text-slate-900 focus:bg-white focus:outline-emerald-600"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">
                                    VNĐ
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 3. Diễn Giải / Điều Kiện Sử Dụng Mệnh Giá (Nhiều dòng) */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                            <label className="text-[11px] font-black uppercase text-slate-700">
                                3. Diễn Giải / Điều Kiện Sử Dụng (Nhiều dòng)
                            </label>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {isAutoMatchedConfig && (
                                    <span className="text-[10px] text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                        <Sparkles className="w-3 h-3 text-emerald-600" />
                                        <span>Tự động theo cấu hình đã có</span>
                                    </span>
                                )}
                                <span className="text-[10px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                                    Nhấn Enter để xuống dòng
                                </span>
                            </div>
                        </div>
                        <textarea
                            rows={3}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Nhập các điều kiện áp dụng, mỗi dòng 1 điều kiện:&#10;• Áp dụng cho đơn từ 500.000đ&#10;• Chỉ áp dụng nhóm Gia Dụng & Phụ Kiện&#10;• Không áp dụng cùng CTKM khác"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-bold text-xs text-slate-900 focus:bg-white focus:outline-emerald-600 placeholder:text-slate-400 font-sans leading-relaxed"
                        />
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                            <span>Bấm để thêm nhanh điều kiện xuống dòng:</span>
                            {description.trim() && (
                                <button
                                    type="button"
                                    onClick={() => setDescription('')}
                                    className="text-rose-600 hover:underline font-bold cursor-pointer"
                                >
                                    Xóa hết
                                </button>
                            )}
                        </div>
                        {/* Gợi ý điều kiện mẫu - tự động thêm xuống dòng */}
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                            {['Đơn từ 300.000đ', 'Đơn từ 500.000đ', 'Đơn từ 1.000.000đ', 'Áp dụng ngành Phụ Kiện', 'Áp dụng ngành Gia Dụng', 'Không áp dụng kèm KM khác', 'HSD trong 7 ngày từ khi cấp'].map(preset => (
                                <button
                                    key={preset}
                                    type="button"
                                    onClick={() => setDescription(prev => {
                                        const clean = prev.trim();
                                        return clean ? `${clean}\n• ${preset}` : `• ${preset}`;
                                    })}
                                    className="text-[10px] font-semibold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-600 px-2 py-0.5 rounded-lg border border-slate-200 transition cursor-pointer"
                                >
                                    + {preset}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 4. Thời Hạn Sử Dụng (HSD) - Mặc định ngày cuối tháng */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[11px] font-black uppercase text-slate-700 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                                <span>4. Thời Hạn Sử Dụng (HSD)</span>
                                <span className="text-rose-500">*</span>
                            </label>
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                Mặc định: Cuối tháng hiện tại
                            </span>
                        </div>
                        <input
                            type="date"
                            value={expiresAt}
                            onChange={(e) => setExpiresAt(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono font-bold text-slate-900 focus:outline-emerald-600 cursor-pointer"
                            required
                        />
                        {/* Gợi ý chọn nhanh hạn dùng */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            <button
                                type="button"
                                onClick={() => setExpiresAt(getDefaultExpiryDate())}
                                className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition border cursor-pointer ${expiresAt === getDefaultExpiryDate()
                                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                    }`}
                            >
                                📅 Cuối tháng này ({formatDate(getDefaultExpiryDate())})
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const now = new Date();
                                    const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);
                                    const yyyy = nextMonthEnd.getFullYear();
                                    const mm = String(nextMonthEnd.getMonth() + 1).padStart(2, '0');
                                    const dd = String(nextMonthEnd.getDate()).padStart(2, '0');
                                    setExpiresAt(`${yyyy}-${mm}-${dd}`);
                                }}
                                className="px-2.5 py-1 rounded-lg text-[10.5px] font-bold bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition cursor-pointer"
                            >
                                📅 Cuối tháng sau
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const now = new Date();
                                    const threeMonthsEnd = new Date(now.getFullYear(), now.getMonth() + 4, 0);
                                    const yyyy = threeMonthsEnd.getFullYear();
                                    const mm = String(threeMonthsEnd.getMonth() + 1).padStart(2, '0');
                                    const dd = String(threeMonthsEnd.getDate()).padStart(2, '0');
                                    setExpiresAt(`${yyyy}-${mm}-${dd}`);
                                }}
                                className="px-2.5 py-1 rounded-lg text-[10.5px] font-bold bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100 transition cursor-pointer"
                            >
                                📅 3 tháng tới
                            </button>
                        </div>
                    </div>

                    {/* 5. Textarea Nhập Mã */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[11px] font-black uppercase text-slate-700">
                                5. Danh Sách Mã Voucher <span className="text-rose-500">*</span>
                            </label>
                            <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                                {parsedCodes.length} mã hợp lệ
                            </span>
                        </div>
                        <textarea
                            rows={6}
                            value={rawCodesText}
                            onChange={(e) => setRawCodesText(e.target.value)}
                            placeholder="Dán hoặc nhập danh sách mã tại đây, mỗi mã 1 dòng:&#10;VD:&#10;VOUCHER-50K-ABC1&#10;VOUCHER-50K-ABC2&#10;VOUCHER-50K-ABC3"
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 font-mono text-xs text-slate-900 focus:bg-white focus:outline-emerald-600 placeholder:text-slate-400"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">
                            * Hệ thống tự động in hoa, xóa khoảng cách thừa và loại trừ các mã đã có trong kho siêu thị.
                        </p>
                    </div>

                    {/* Submit Button */}
                    <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold transition cursor-pointer"
                        >
                            Hủy Bỏ
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || parsedCodes.length === 0}
                            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black transition cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                        >
                            <Upload className="w-4 h-4" />
                            <span>{isSubmitting ? 'Đang Nạp...' : `Xác Nhận Nạp ${parsedCodes.length} Mã`}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
