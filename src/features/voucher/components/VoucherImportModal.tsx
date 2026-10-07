import React, { useState, useMemo } from 'react';
import { X, Plus, Upload, Check, AlertCircle, Layers, Calendar } from 'lucide-react';
import { importVouchers, getDefaultExpiryDate } from '../services/voucherService';
import { formatDate } from '../../../core/lib/formatters';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    currentStoreName?: string;
    currentUserDisplayName: string;
    existingCampaigns: string[];
    allowedStores?: Array<{ name: string; id?: string }>;
    onSuccess: (addedCount: number, duplicateCount: number, cloudWarning?: string) => void;
}

const COMMON_DENOMINATIONS = [20000, 30000, 50000, 100000, 200000, 500000, 1000000];

export default function VoucherImportModal({
    isOpen,
    onClose,
    currentUserDisplayName,
    existingCampaigns,
    onSuccess
}: Props) {
    const targetStore = 'Toàn Cụm Siêu Thị';
    const [campaignName, setCampaignName] = useState<string>('');
    const [customCampaign, setCustomCampaign] = useState<string>('');
    const [denomination, setDenomination] = useState<number>(50000);
    const [expiresAt, setExpiresAt] = useState<string>(getDefaultExpiryDate());
    const [rawCodesText, setRawCodesText] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMsg, setErrorMsg] = useState<string>('');

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

        setIsSubmitting(true);
        try {
            const res = await importVouchers({
                store_name: targetStore,
                campaign_name: effectiveCampaign,
                denomination,
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
                                Phân quyền: <strong>Toàn Cụm Siêu Thị</strong>
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

                    {/* 0. PHÂN QUYỀN SỬ DỤNG THEO CỤM */}
                    <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl p-3 flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black shrink-0 text-sm shadow-xs">
                            🏢
                        </div>
                        <div className="text-xs">
                            <div className="font-black text-emerald-950 flex items-center gap-1.5 flex-wrap">
                                <span>Phân Quyền Sử Dụng:</span>
                                <span className="bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full text-[10.5px] font-black">
                                    Toàn Cụm Siêu Thị
                                </span>
                            </div>
                            <p className="text-[11px] text-emerald-800 mt-1 leading-relaxed">
                                Kho mã dùng chung cho <strong>tất cả nhân viên trong cụm</strong>, không ràng riêng lẻ siêu thị. Mọi nhân viên các siêu thị trong cụm đều có thể lấy mã trong kho đang sẵn có.
                            </p>
                        </div>
                    </div>

                    {/* 1. Chọn Chương Trình */}
                    <div>
                        <label className="block text-[11px] font-black uppercase text-slate-700 mb-1.5">
                            1. Chương Trình Áp Dụng <span className="text-rose-500">*</span>
                        </label>
                        <select
                            value={campaignName}
                            onChange={(e) => setCampaignName(e.target.value)}
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
                                onChange={(e) => setCustomCampaign(e.target.value)}
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
                            {COMMON_DENOMINATIONS.map(d => (
                                <button
                                    key={d}
                                    type="button"
                                    onClick={() => setDenomination(d)}
                                    className={`px-2.5 py-1.5 rounded-xl font-mono text-xs font-black transition cursor-pointer border ${
                                        denomination === d
                                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                                             : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                    {d.toLocaleString('vi-VN')}đ
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-500 font-bold shrink-0">Tùy chỉnh:</span>
                            <input
                                type="number"
                                min={1000}
                                step={1000}
                                value={denomination}
                                onChange={(e) => setDenomination(Number(e.target.value))}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-mono font-bold text-slate-900 focus:outline-emerald-600"
                            />
                            <span className="font-bold text-slate-500">VNĐ</span>
                        </div>
                    </div>

                    {/* 3. Thời Hạn Sử Dụng (HSD) - Mặc định ngày cuối tháng */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[11px] font-black uppercase text-slate-700 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                                <span>3. Thời Hạn Sử Dụng (HSD)</span>
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
                                className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition border cursor-pointer ${
                                    expiresAt === getDefaultExpiryDate()
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

                    {/* 4. Textarea Nhập Mã */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[11px] font-black uppercase text-slate-700">
                                4. Danh Sách Mã Voucher <span className="text-rose-500">*</span>
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
