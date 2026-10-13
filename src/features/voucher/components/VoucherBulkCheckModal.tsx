import React, { useState, useMemo } from 'react';
import {
    X,
    Search,
    CheckCircle2,
    AlertCircle,
    Copy,
    Check,
    Upload,
    Trash2,
    Calendar,
    Ticket,
    Filter,
    ArrowRight,
    Tag,
    Clock,
    UserCheck,
    Store
} from 'lucide-react';
import type { VoucherItem } from '../types';
import { formatCurrency, getDenominationHotStyle } from '../voucherFormatters';
import { formatDate } from '../../../core/lib/formatters';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    allVouchers: VoucherItem[];
    onOpenImportWithCodes?: (codes: string[]) => void;
}

export default function VoucherBulkCheckModal({
    isOpen,
    onClose,
    allVouchers,
    onOpenImportWithCodes
}: Props) {
    const [rawInput, setRawInput] = useState<string>('');
    const [filterTab, setFilterTab] = useState<'ALL' | 'EXISTING' | 'NEW'>('ALL');
    const [searchTableQuery, setSearchTableQuery] = useState<string>('');
    const [isCopied, setIsCopied] = useState<string>('');

    // Bản đồ tra cứu nhanh theo mã (in hoa, bỏ khoảng trắng)
    const voucherMap = useMemo(() => {
        const map = new Map<string, VoucherItem>();
        allVouchers.forEach(v => {
            const clean = v.code.trim().toUpperCase();
            if (clean) map.set(clean, v);
        });
        return map;
    }, [allVouchers]);

    // Phân tách các mã từ ô nhập liệu (hỗ trợ xuống dòng, phẩy, khoảng trắng, tab, chấm phẩy)
    const parsedCodes = useMemo(() => {
        if (!rawInput.trim()) return [];
        // Phân tách bởi ký tự xuống dòng, dấu phẩy, chấm phẩy, khoảng trắng
        const tokens = rawInput
            .split(/[\r\n,;\s]+/)
            .map(t => t.trim().toUpperCase())
            .filter(t => t.length > 0);

        // Giữ thứ tự xuất hiện và lọc trùng lặp trong input
        const seen = new Set<string>();
        const unique: string[] = [];
        tokens.forEach(t => {
            if (!seen.has(t)) {
                seen.add(t);
                unique.push(t);
            }
        });
        return unique;
    }, [rawInput]);

    // Đối chiếu từng mã với kho
    const checkResults = useMemo(() => {
        return parsedCodes.map((code, index) => {
            const matched = voucherMap.get(code);
            return {
                index: index + 1,
                code,
                exists: Boolean(matched),
                voucher: matched || null
            };
        });
    }, [parsedCodes, voucherMap]);

    // Thống kê
    const existingList = useMemo(() => checkResults.filter(r => r.exists), [checkResults]);
    const newList = useMemo(() => checkResults.filter(r => !r.exists), [checkResults]);

    const totalExistingValue = useMemo(() => {
        return existingList.reduce((sum, item) => sum + (Number(item.voucher?.denomination) || 0), 0);
    }, [existingList]);

    // Lọc hiển thị trong bảng
    const displayedResults = useMemo(() => {
        let list = checkResults;
        if (filterTab === 'EXISTING') list = list.filter(r => r.exists);
        if (filterTab === 'NEW') list = list.filter(r => !r.exists);

        if (searchTableQuery.trim()) {
            const q = searchTableQuery.trim().toUpperCase();
            list = list.filter(r =>
                r.code.includes(q) ||
                (r.voucher?.campaign_name && r.voucher.campaign_name.toUpperCase().includes(q)) ||
                (r.voucher?.order_id && r.voucher.order_id.toUpperCase().includes(q)) ||
                (r.voucher?.claimed_by_name && r.voucher.claimed_by_name.toUpperCase().includes(q))
            );
        }
        return list;
    }, [checkResults, filterTab, searchTableQuery]);

    if (!isOpen) return null;

    const copyToClipboard = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setIsCopied(key);
        setTimeout(() => setIsCopied(''), 2500);
    };

    const handleCopyExistingCodes = () => {
        const text = existingList.map(r => r.code).join('\n');
        copyToClipboard(text, 'EXISTING');
    };

    const handleCopyNewCodes = () => {
        const text = newList.map(r => r.code).join('\n');
        copyToClipboard(text, 'NEW');
    };

    const handlePasteFromClipboard = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (text) {
                setRawInput(prev => prev ? `${prev}\n${text}` : text);
            }
        } catch {
            // Không cấp quyền clipboard
        }
    };

    const handleImportNewCodes = () => {
        if (newList.length === 0) return;
        const codesToImport = newList.map(r => r.code);
        onClose();
        if (onOpenImportWithCodes) {
            onOpenImportWithCodes(codesToImport);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs font-avo animate-in fade-in duration-200">
            <div
                className="bg-white rounded-3xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-5 py-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 text-white flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-amber-300 font-black shadow-inner">
                            <Search className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="font-black text-sm sm:text-base uppercase tracking-wide flex items-center gap-2">
                                <span>Kiểm Tra Hàng Loạt Mã Voucher</span>
                                <span className="text-[10px] bg-blue-500/40 text-blue-100 border border-blue-400/30 px-2 py-0.5 rounded-full font-bold">
                                    Kho: {allVouchers.length} mã
                                </span>
                            </h2>
                            <p className="text-[11px] text-blue-200 mt-0.5">
                                Đối soát nhanh danh sách mã xem đã tồn tại trong kho hay chưa, chi tiết chương trình & mệnh giá
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-xl hover:bg-white/15 flex items-center justify-center text-white/80 hover:text-white transition cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs flex-1 no-scrollbar">
                    {/* Khu vực Nhập mã */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <label className="font-extrabold text-slate-800 flex items-center gap-1.5">
                                <Ticket className="w-4 h-4 text-blue-600" />
                                <span>Dán danh sách mã voucher cần kiểm tra:</span>
                            </label>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                    type="button"
                                    onClick={handlePasteFromClipboard}
                                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-700 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                                    title="Dán từ Clipboard"
                                >
                                    <Copy className="w-3 h-3 text-blue-600" />
                                    <span>Dán từ clipboard</span>
                                </button>
                                {rawInput.trim() && (
                                    <button
                                        type="button"
                                        onClick={() => setRawInput('')}
                                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-rose-600 text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                        <span>Xóa ô nhập</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        <textarea
                            rows={4}
                            value={rawInput}
                            onChange={(e) => setRawInput(e.target.value)}
                            placeholder="Dán hoặc nhập danh sách mã tại đây (mỗi mã 1 dòng hoặc cách nhau bởi dấu phẩy, khoảng trắng):&#10;VD:&#10;VOUCHER-50K-ABC1&#10;VOUCHER-100K-XYZ2&#10;VOUCHER-200K-MNP3"
                            className="w-full bg-white border border-slate-200 rounded-xl p-3 font-mono text-xs text-slate-900 focus:outline-blue-600 placeholder:text-slate-400 font-bold"
                        />

                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>* Tự động nhận diện, in hoa và loại trừ trùng lặp trong danh sách nhập vào.</span>
                            <span className="font-extrabold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                                Đã nhập: {parsedCodes.length} mã duy nhất
                            </span>
                        </div>
                    </div>

                    {/* Khối Thống kê Kết quả */}
                    {parsedCodes.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {/* Tổng số mã kiểm tra */}
                            <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs flex items-center justify-between">
                                <div>
                                    <div className="text-[10px] font-black uppercase text-slate-400">
                                        Tổng Mã Kiểm Tra
                                    </div>
                                    <div className="text-xl font-black text-slate-800 mt-0.5">
                                        {parsedCodes.length} mã
                                    </div>
                                    <div className="text-[10px] text-slate-500">
                                        100% đã được quét đối chiếu
                                    </div>
                                </div>
                                <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-black">
                                    <Search className="w-5 h-5" />
                                </div>
                            </div>

                            {/* Mã ĐÃ TỒN TRONG KHO */}
                            <div className={`border rounded-2xl p-3.5 shadow-2xs flex items-center justify-between ${
                                existingList.length > 0
                                    ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                                    : 'bg-white border-slate-200 text-slate-800'
                            }`}>
                                <div>
                                    <div className="text-[10px] font-black uppercase text-rose-600">
                                        Đã Tồn Trong Kho
                                    </div>
                                    <div className="text-xl font-black text-rose-700 mt-0.5">
                                        {existingList.length} mã
                                    </div>
                                    <div className="text-[10px] text-rose-600 font-bold">
                                        {existingList.length > 0 ? `Tổng mệnh giá: ${formatCurrency(totalExistingValue)}` : 'Không có mã trùng'}
                                    </div>
                                </div>
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${
                                    existingList.length > 0 ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-400'
                                }`}>
                                    <AlertCircle className="w-5 h-5" />
                                </div>
                            </div>

                            {/* Mã CHƯA CÓ TRONG KHO */}
                            <div className={`border rounded-2xl p-3.5 shadow-2xs flex items-center justify-between ${
                                newList.length > 0
                                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                                    : 'bg-white border-slate-200 text-slate-800'
                            }`}>
                                <div>
                                    <div className="text-[10px] font-black uppercase text-emerald-600">
                                        Chưa Có Trong Kho (Mới)
                                    </div>
                                    <div className="text-xl font-black text-emerald-700 mt-0.5">
                                        {newList.length} mã
                                    </div>
                                    <div className="text-[10px] text-emerald-600 font-bold">
                                        {newList.length > 0 ? 'Khả dụng sẵn sàng nạp mới' : 'Không có mã mới'}
                                    </div>
                                </div>
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${
                                    newList.length > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                                }`}>
                                    <CheckCircle2 className="w-5 h-5" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Bộ lọc tab & Thanh tìm kiếm bảng kết quả */}
                    {parsedCodes.length > 0 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-1">
                            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                                <button
                                    type="button"
                                    onClick={() => setFilterTab('ALL')}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                                        filterTab === 'ALL'
                                            ? 'bg-slate-900 text-white shadow-2xs'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    Tất Cả ({checkResults.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterTab('EXISTING')}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                                        filterTab === 'EXISTING'
                                            ? 'bg-rose-600 text-white shadow-2xs'
                                            : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                                    }`}
                                >
                                    <span>⚠️ Đã Tồn Kho ({existingList.length})</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFilterTab('NEW')}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                                        filterTab === 'NEW'
                                            ? 'bg-emerald-600 text-white shadow-2xs'
                                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                                    }`}
                                >
                                    <span>✓ Chưa Có ({newList.length})</span>
                                </button>
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <div className="relative w-full sm:w-48">
                                    <input
                                        type="text"
                                        placeholder="Lọc mã hoặc CT..."
                                        value={searchTableQuery}
                                        onChange={(e) => setSearchTableQuery(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1 text-xs font-bold outline-none focus:bg-white focus:border-blue-400"
                                    />
                                    {searchTableQuery && (
                                        <button
                                            type="button"
                                            onClick={() => setSearchTableQuery('')}
                                            className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* BẢNG KẾT QUẢ ĐỐI SOÁT CHI TIẾT */}
                    {parsedCodes.length > 0 && (
                        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs bg-white">
                            <div className="overflow-x-auto max-h-[380px] no-scrollbar">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-slate-100 text-slate-700 font-black uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-200">
                                        <tr>
                                            <th className="py-2.5 px-3 w-12 text-center">STT</th>
                                            <th className="py-2.5 px-3">MÃ VOUCHER</th>
                                            <th className="py-2.5 px-3 w-32 text-center">TRẠNG THÁI KHO</th>
                                            <th className="py-2.5 px-3">CHƯƠNG TRÌNH</th>
                                            <th className="py-2.5 px-3 text-right">MỆNH GIÁ</th>
                                            <th className="py-2.5 px-3">TRẠNG THÁI SỬ DỤNG</th>
                                            <th className="py-2.5 px-3">HẠN DÙNG (HSD)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                                        {displayedResults.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="py-8 text-center text-slate-400 font-bold">
                                                    Không có mã nào phù hợp với bộ lọc.
                                                </td>
                                            </tr>
                                        ) : (
                                            displayedResults.map((item) => {
                                                const v = item.voucher;
                                                const denom = v?.denomination || 0;
                                                const hotStyle = denom > 0 ? getDenominationHotStyle(denom) : '';

                                                let statusBadge = (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
                                                        <span>✨ Chưa Có</span>
                                                    </span>
                                                );

                                                if (item.exists) {
                                                    statusBadge = (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 inline-flex items-center gap-1">
                                                            <span>⚠️ Đã Tồn Kho</span>
                                                        </span>
                                                    );
                                                }

                                                let usageBadge = <span className="text-slate-400 text-[11px]">-</span>;
                                                if (v) {
                                                    if (v.status === 'AVAILABLE') {
                                                        usageBadge = (
                                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                                🟢 Trong Kho (Chờ cấp)
                                                            </span>
                                                        );
                                                    } else if (v.status === 'CLAIMED') {
                                                        usageBadge = (
                                                            <div className="text-[11px]">
                                                                <span className="px-2 py-0.5 rounded-md font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                                                    🟡 Đã Cấp NV
                                                                </span>
                                                                <div className="text-[10px] text-slate-500 mt-0.5 font-mono truncate max-w-[160px]">
                                                                    Đơn: {v.order_id || 'N/A'} • {v.claimed_by_name || v.claimed_by_id || ''}
                                                                </div>
                                                            </div>
                                                        );
                                                    } else if (v.status === 'USED') {
                                                        usageBadge = (
                                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                                                ⚪ Đã Dùng Xong
                                                            </span>
                                                        );
                                                    } else if (v.status === 'EXPIRED') {
                                                        usageBadge = (
                                                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                                🔴 Hết Hạn
                                                            </span>
                                                        );
                                                    }
                                                }

                                                return (
                                                    <tr
                                                        key={item.code}
                                                        className={`hover:bg-slate-50 transition ${
                                                            item.exists ? 'bg-rose-50/20' : 'bg-emerald-50/15'
                                                        }`}
                                                    >
                                                        <td className="py-2.5 px-3 text-center font-mono text-slate-400 font-bold">
                                                            {item.index}
                                                        </td>
                                                        <td className="py-2.5 px-3 font-mono font-black text-slate-900">
                                                            <span className={item.exists ? 'text-rose-700' : 'text-emerald-700'}>
                                                                {item.code}
                                                            </span>
                                                        </td>
                                                        <td className="py-2.5 px-3 text-center">
                                                            {statusBadge}
                                                        </td>
                                                        <td className="py-2.5 px-3 font-bold text-slate-800">
                                                            {v ? (
                                                                <div>
                                                                    <div className="truncate max-w-[180px]">{v.campaign_name}</div>
                                                                    <div className="text-[10px] text-slate-400 truncate max-w-[180px]">
                                                                        {v.store_name}
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-400 italic text-[11px]">Chưa xác định (Mã mới)</span>
                                                            )}
                                                        </td>
                                                        <td className="py-2.5 px-3 text-right font-mono font-black">
                                                            {v ? (
                                                                <span className={`px-2 py-0.5 rounded-lg border text-[11px] ${hotStyle || 'bg-slate-50 text-slate-800 border-slate-200'}`}>
                                                                    {formatCurrency(v.denomination)}
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-400 text-[11px]">-</span>
                                                            )}
                                                        </td>
                                                        <td className="py-2.5 px-3">
                                                            {usageBadge}
                                                        </td>
                                                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                                                            {v?.expires_at ? formatDate(v.expires_at) : <span className="text-slate-400">-</span>}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Modal với các tác vụ nhanh */}
                <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                        {existingList.length > 0 && (
                            <button
                                type="button"
                                onClick={handleCopyExistingCodes}
                                className="px-3 py-2 rounded-xl bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-rose-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                title="Sao chép toàn bộ danh sách các mã đã tồn trong kho"
                            >
                                {isCopied === 'EXISTING' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                <span>{isCopied === 'EXISTING' ? 'Đã chép mã trùng!' : `Copy ${existingList.length} Mã Trùng`}</span>
                            </button>
                        )}
                        {newList.length > 0 && (
                            <button
                                type="button"
                                onClick={handleCopyNewCodes}
                                className="px-3 py-2 rounded-xl bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-emerald-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                title="Sao chép toàn bộ danh sách các mã mới chưa có trong kho"
                            >
                                {isCopied === 'NEW' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                <span>{isCopied === 'NEW' ? 'Đã chép mã mới!' : `Copy ${newList.length} Mã Mới`}</span>
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/80 transition cursor-pointer"
                        >
                            Đóng
                        </button>
                        {newList.length > 0 && onOpenImportWithCodes && (
                            <button
                                type="button"
                                onClick={handleImportNewCodes}
                                className="px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md shadow-emerald-200 transition flex items-center gap-1.5 cursor-pointer"
                            >
                                <Upload className="w-3.5 h-3.5" />
                                <span>Nạp {newList.length} Mã Mới Này Vào Kho</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
