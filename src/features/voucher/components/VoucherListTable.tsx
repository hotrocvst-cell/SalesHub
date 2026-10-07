import React, { useState, useMemo, useEffect } from 'react';
import {
    Search,
    Filter,
    Copy,
    Check,
    RotateCcw,
    CheckCircle2,
    Clock,
    Store,
    QrCode,
    Zap,
    CheckSquare,
    Square,
    Trash2
} from 'lucide-react';
import type { VoucherItem } from '../types';
import { formatDate, getShortStoreName, isStoreMatch } from '../../../core/lib/formatters';

interface Props {
    vouchers: VoucherItem[];
    onResetVoucher: (code: string) => void;
    onMarkUsed?: (code: string) => void;
    onDeleteVoucher?: (code: string) => void;
    onDeleteMultiple?: (codes: string[]) => void;
    onOpenCleanModal?: () => void;
    prefilterEmployeeId?: string;
    prefilterStatus?: string;
    onOpenQrModal?: (selectedVouchers: VoucherItem[]) => void;
}

export default function VoucherListTable({
    vouchers,
    onResetVoucher,
    onMarkUsed,
    onDeleteVoucher,
    onDeleteMultiple,
    onOpenCleanModal,
    prefilterEmployeeId,
    prefilterStatus,
    onOpenQrModal
}: Props) {
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [filterStatus, setFilterStatus] = useState<string>(prefilterStatus || 'ALL');
    const [filterCampaign, setFilterCampaign] = useState<string>('ALL');
    const [filterDenomination, setFilterDenomination] = useState<string>('ALL');
    const [filterStore, setFilterStore] = useState<string>('ALL');
    const [copiedCode, setCopiedCode] = useState<string>('');
    const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (prefilterStatus) {
            setFilterStatus(prefilterStatus);
        }
    }, [prefilterStatus]);

    // Danh sách chương trình duy nhất
    const campaignOptions = useMemo(() => {
        const set = new Set<string>();
        vouchers.forEach(v => set.add(v.campaign_name.trim()));
        return Array.from(set).sort();
    }, [vouchers]);

    // Danh sách mệnh giá duy nhất
    const denominationOptions = useMemo(() => {
        const set = new Set<number>();
        vouchers.forEach(v => set.add(Number(v.denomination)));
        return Array.from(set).sort((a, b) => a - b);
    }, [vouchers]);

    // Danh sách siêu thị của các nhân viên đã thao tác lấy mã
    const storeOptions = useMemo(() => {
        const set = new Set<string>();
        vouchers.forEach(v => {
            if (v.claimed_by_store) set.add(v.claimed_by_store.trim());
        });
        return Array.from(set).sort();
    }, [vouchers]);

    // Lọc danh sách
    const filteredList = useMemo(() => {
        let list = vouchers;

        if (prefilterEmployeeId) {
            list = list.filter(v => (v.claimed_by_id || '').trim() === prefilterEmployeeId.trim());
        }

        const todayStr = new Date().toISOString().slice(0, 10);
        const threeDaysLater = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

        if (filterStatus === 'EXPIRED') {
            list = list.filter(v => v.expires_at && v.expires_at < todayStr && v.status !== 'USED');
        } else if (filterStatus === 'NEAR_EXPIRY') {
            list = list.filter(v => v.expires_at && v.expires_at >= todayStr && v.expires_at <= threeDaysLater && v.status === 'AVAILABLE');
        } else if (filterStatus === 'AVAILABLE') {
            list = list.filter(v => v.status === 'AVAILABLE' && (!v.expires_at || v.expires_at >= todayStr));
        } else if (filterStatus !== 'ALL') {
            list = list.filter(v => v.status === filterStatus);
        }

        if (filterCampaign !== 'ALL') {
            list = list.filter(v => v.campaign_name.trim() === filterCampaign);
        }

        if (filterDenomination !== 'ALL') {
            const dVal = Number(filterDenomination);
            list = list.filter(v => Number(v.denomination) === dVal);
        }

        if (filterStore !== 'ALL') {
            list = list.filter(v => v.claimed_by_store && isStoreMatch(v.claimed_by_store, filterStore));
        }

        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            list = list.filter(v =>
                v.code.toLowerCase().includes(q) ||
                (v.order_id && v.order_id.toLowerCase().includes(q)) ||
                (v.claimed_by_name && v.claimed_by_name.toLowerCase().includes(q)) ||
                (v.claimed_by_id && v.claimed_by_id.toLowerCase().includes(q)) ||
                (v.claimed_by_store && v.claimed_by_store.toLowerCase().includes(q)) ||
                (v.store_name && v.store_name.toLowerCase().includes(q)) ||
                (v.created_by && v.created_by.toLowerCase().includes(q))
            );
        }

        return list;
    }, [vouchers, prefilterEmployeeId, filterStatus, filterCampaign, filterDenomination, filterStore, searchQuery]);

    // Các mã CLAIMED (chưa double check) trong danh sách đang lọc
    const unclaimedFilteredCodes = useMemo(() => {
        return filteredList.filter(v => v.status === 'CLAIMED').map(v => v.code);
    }, [filteredList]);

    // Checkbox toggle
    const toggleSelectCode = (code: string) => {
        setSelectedCodes(prev => {
            const next = new Set(prev);
            if (next.has(code)) next.delete(code);
            else next.add(code);
            return next;
        });
    };

    // Chọn tất cả mã đang hiển thị
    const isAllFilteredSelected = filteredList.length > 0 && filteredList.every(v => selectedCodes.has(v.code));
    const toggleSelectAllFiltered = () => {
        if (isAllFilteredSelected) {
            setSelectedCodes(prev => {
                const next = new Set(prev);
                filteredList.forEach(v => next.delete(v.code));
                return next;
            });
        } else {
            setSelectedCodes(prev => {
                const next = new Set(prev);
                filteredList.forEach(v => next.add(v.code));
                return next;
            });
        }
    };

    // Chọn nhanh tất cả mã CLAIMED (Chưa Double Check)
    const handleSelectClaimedOnly = () => {
        setSelectedCodes(new Set(unclaimedFilteredCodes));
    };

    // Xóa lựa chọn
    const handleClearSelection = () => {
        setSelectedCodes(new Set());
    };

    // Kích hoạt mở Modal tạo QR Code
    const handleLaunchQrModal = () => {
        if (!onOpenQrModal) return;

        if (selectedCodes.size > 0) {
            const targets = vouchers.filter(v => selectedCodes.has(v.code));
            onOpenQrModal(targets);
            return;
        }

        // Nếu chưa tích chọn thủ công: ưu tiên lấy các mã CLAIMED (chưa double check)
        const claimedList = filteredList.filter(v => v.status === 'CLAIMED');
        if (claimedList.length > 0) {
            onOpenQrModal(claimedList);
        } else {
            onOpenQrModal(filteredList);
        }
    };

    const handleCopy = async (code: string) => {
        try {
            await navigator.clipboard.writeText(code);
            setCopiedCode(code);
            setTimeout(() => setCopiedCode(''), 2000);
        } catch {}
    };

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden font-avo">
            {/* Thanh Công Cụ & Bộ Lọc Đa Chiều */}
            <div className="p-3 sm:p-4 border-b border-slate-200 space-y-3 bg-slate-50/50">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
                        {/* Tìm kiếm */}
                        <div className="relative flex-1 min-w-[150px] max-w-xs">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Tìm mã, đơn, NV, siêu thị..."
                                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-emerald-600"
                            />
                        </div>

                        {/* Lọc Trạng thái (Hỗ trợ Double-Check & Cảnh báo hết hạn) */}
                        {(() => {
                            const todayStr = new Date().toISOString().slice(0, 10);
                            const threeDaysLater = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
                            const availableCount = vouchers.filter(v => v.status === 'AVAILABLE' && (!v.expires_at || v.expires_at >= todayStr)).length;
                            const claimedCount = vouchers.filter(v => v.status === 'CLAIMED').length;
                            const usedCount = vouchers.filter(v => v.status === 'USED').length;
                            const expiredCount = vouchers.filter(v => Boolean(v.expires_at && v.expires_at < todayStr && v.status !== 'USED')).length;
                            const nearExpiryCount = vouchers.filter(v => Boolean(v.expires_at && v.expires_at >= todayStr && v.expires_at <= threeDaysLater && v.status === 'AVAILABLE')).length;

                            return (
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 cursor-pointer"
                                >
                                    <option value="ALL">📋 Tất cả TT ({vouchers.length})</option>
                                    <option value="AVAILABLE">✅ Khả dụng ({availableCount})</option>
                                    <option value="CLAIMED">⏳ Đang giữ / Chưa dùng ({claimedCount})</option>
                                    <option value="USED">🎉 Đã dùng ({usedCount})</option>
                                    <option value="EXPIRED">⚠️ Đã hết hạn ({expiredCount})</option>
                                    {nearExpiryCount > 0 && (
                                        <option value="NEAR_EXPIRY">⏰ Sắp hết hạn 3 ngày ({nearExpiryCount})</option>
                                    )}
                                </select>
                            );
                        })()}

                        {/* Lọc Chương trình */}
                        <select
                            value={filterCampaign}
                            onChange={(e) => setFilterCampaign(e.target.value)}
                            className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 cursor-pointer max-w-[160px] truncate"
                        >
                            <option value="ALL">🎁 Tất cả CT</option>
                            {campaignOptions.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>

                        {/* Lọc Mệnh giá */}
                        <select
                            value={filterDenomination}
                            onChange={(e) => setFilterDenomination(e.target.value)}
                            className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 cursor-pointer max-w-[140px] truncate font-mono"
                        >
                            <option value="ALL">💵 Tất cả mệnh giá</option>
                            {denominationOptions.map(d => (
                                <option key={d} value={d}>{d.toLocaleString('vi-VN')}đ</option>
                            ))}
                        </select>

                        {/* Lọc Siêu thị thao tác của user */}
                        {storeOptions.length > 0 && (
                            <select
                                value={filterStore}
                                onChange={(e) => setFilterStore(e.target.value)}
                                className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-700 cursor-pointer max-w-[170px] truncate"
                            >
                                <option value="ALL">🏪 Tất cả siêu thị nhận</option>
                                {storeOptions.map(st => (
                                    <option key={st} value={st}>{getShortStoreName(st)}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div className="text-xs font-black text-slate-500 shrink-0">
                        Hiển thị <span className="text-emerald-700">{filteredList.length}</span>/{vouchers.length} mã
                    </div>
                </div>

                {/* THANH TÁC VỤ CHỌN NHANH & TẠO QR DOUBLE CHECK */}
                <div className="pt-2 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                        {/* Nút Chọn nhanh mã CLAIMED */}
                        {unclaimedFilteredCodes.length > 0 && (
                            <button
                                type="button"
                                onClick={handleSelectClaimedOnly}
                                className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                                title="Chọn nhanh các mã đang giữ chưa double check"
                            >
                                <Zap className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                                <span>Chọn mã Chưa Dùng ({unclaimedFilteredCodes.length})</span>
                            </button>
                        )}

                        {/* Nút Chọn tất cả mã hiển thị */}
                        <button
                            type="button"
                            onClick={toggleSelectAllFiltered}
                            className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer flex items-center gap-1"
                        >
                            {isAllFilteredSelected ? (
                                <>
                                    <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Bỏ chọn tất cả</span>
                                </>
                            ) : (
                                <>
                                    <Square className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Chọn tất cả ({filteredList.length})</span>
                                </>
                            )}
                        </button>

                        {/* Badge số mã đang chọn */}
                        {selectedCodes.size > 0 && (
                            <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 text-indigo-900 px-2.5 py-1 rounded-xl text-xs font-bold">
                                <span>Đã chọn: <strong>{selectedCodes.size}</strong> mã</span>
                                <button
                                    type="button"
                                    onClick={handleClearSelection}
                                    className="text-slate-500 hover:text-slate-700 font-bold cursor-pointer text-[11px] underline"
                                >
                                    Bỏ chọn
                                </button>
                            </div>
                        )}

                        {/* Nút Xóa các mã đã chọn */}
                        {selectedCodes.size > 0 && onDeleteMultiple && (
                            <button
                                type="button"
                                onClick={() => {
                                    const list = Array.from(selectedCodes);
                                    if (window.confirm(`⚠️ XÁC NHẬN XÓA:\nBạn có chắc chắn muốn XÓA VĨNH VIỄN ${list.length} mã voucher đã chọn khỏi kho? Thao tác này sẽ làm sạch dữ liệu và không thể hoàn tác.`)) {
                                        onDeleteMultiple(list);
                                        setSelectedCodes(new Set());
                                    }
                                }}
                                className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-700 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
                                title="Xóa vĩnh viễn các mã đang chọn khỏi hệ thống"
                            >
                                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                <span>Xóa ({selectedCodes.size}) mã</span>
                            </button>
                        )}

                        {/* Nút Làm sạch kho mã */}
                        {onOpenCleanModal && (
                            <button
                                type="button"
                                onClick={onOpenCleanModal}
                                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:border-rose-200 border border-slate-200 text-slate-700 hover:text-rose-700 text-xs font-bold transition cursor-pointer flex items-center gap-1"
                                title="Làm sạch dữ liệu tồn kho quá hạn"
                            >
                                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                <span>Làm sạch kho</span>
                            </button>
                        )}
                    </div>

                    {/* NÚT TẠO QR CODE DOUBLE CHECK */}
                    {onOpenQrModal && (
                        <button
                            type="button"
                            onClick={handleLaunchQrModal}
                            disabled={filteredList.length === 0}
                            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 active:scale-[0.99] text-white text-xs font-black transition cursor-pointer shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Tạo mã QR code quét trên máy POS để double check"
                        >
                            <QrCode className="w-4 h-4 text-amber-300" />
                            <span>
                                {selectedCodes.size > 0
                                    ? `Tạo QR Double Check (${selectedCodes.size} mã)`
                                    : unclaimedFilteredCodes.length > 0
                                    ? `Tạo QR Double Check (${unclaimedFilteredCodes.length} mã Chưa Dùng)`
                                    : `Tạo QR Double Check (${filteredList.length} mã)`}
                            </span>
                        </button>
                    )}
                </div>
            </div>

            {/* Bảng Dữ Liệu Tinh Gọn */}
            <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                    <thead>
                        <tr className="bg-slate-100/80 border-b border-slate-200 text-[10.5px] font-black uppercase text-slate-600">
                            <th className="py-2 px-2 text-center" style={{ width: '36px' }}>
                                <input
                                    type="checkbox"
                                    checked={isAllFilteredSelected}
                                    onChange={toggleSelectAllFiltered}
                                    className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                    title="Chọn/Bỏ chọn tất cả"
                                />
                            </th>
                            <th className="py-2 px-1 text-center" style={{ width: '36px' }}>STT</th>
                            <th className="py-2 px-2.5">Mã Voucher</th>
                            <th className="py-2 px-2">Chương Trình</th>
                            <th className="py-2 px-2 text-right">Mệnh Giá</th>
                            <th className="py-2 px-2 text-center" style={{ width: '90px' }}>Hạn Dùng</th>
                            <th className="py-2 px-2 text-center">Trạng Thái</th>
                            <th className="py-2 px-2.5">Người Thao Tác & Siêu Thị</th>
                            <th className="py-2 px-2 text-right">Thao Tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {filteredList.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="py-8 text-center text-slate-400 font-bold">
                                    Không có mã voucher nào thỏa mãn điều kiện lọc.
                                </td>
                            </tr>
                        ) : (
                            filteredList.map((item, idx) => {
                                const isAvailable = item.status === 'AVAILABLE';
                                const isClaimed = item.status === 'CLAIMED';
                                const isUsed = item.status === 'USED';
                                const isSelected = selectedCodes.has(item.code);

                                const todayStr = new Date().toISOString().slice(0, 10);
                                const isExpired = item.expires_at ? item.expires_at < todayStr : false;
                                const isNearExpiry = item.expires_at && !isExpired ? (
                                    new Date(item.expires_at).getTime() - new Date(todayStr).getTime() <= 3 * 24 * 60 * 60 * 1000
                                ) : false;

                                return (
                                    <tr key={item.id} className={`hover:bg-slate-50/70 transition ${isSelected ? 'bg-indigo-50/50' : ''}`}>
                                        {/* Checkbox chọn dòng */}
                                        <td className="py-2 px-2 text-center">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleSelectCode(item.code)}
                                                className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                            />
                                        </td>

                                        <td className="py-2 px-1 text-center font-mono text-[11px] text-slate-400">
                                            #{idx + 1}
                                        </td>

                                        {/* Mã voucher + click copy */}
                                        <td className="py-2 px-2.5">
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopy(item.code)}
                                                    className="font-mono font-black text-xs text-slate-900 hover:text-emerald-700 transition cursor-pointer flex items-center gap-1 group"
                                                    title="Bấm để copy mã"
                                                >
                                                    <span>{item.code}</span>
                                                    {copiedCode === item.code ? (
                                                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                                    ) : (
                                                        <Copy className="w-3 h-3 text-slate-300 group-hover:text-slate-600 shrink-0" />
                                                    )}
                                                </button>
                                            </div>
                                        </td>

                                        {/* Chương trình */}
                                        <td className="py-2 px-2 font-bold text-slate-700 max-w-[140px] truncate" title={item.campaign_name}>
                                            {item.campaign_name}
                                        </td>

                                        {/* Mệnh giá */}
                                        <td className="py-2 px-2 text-right font-mono font-black text-rose-600">
                                            {Number(item.denomination).toLocaleString('vi-VN')}đ
                                        </td>

                                        {/* Hạn Dùng */}
                                        <td className="py-2 px-2 text-center whitespace-nowrap">
                                            {item.expires_at ? (
                                                <div className="space-y-0.5">
                                                    <span className={`inline-block font-mono text-[10.5px] font-bold px-1.5 py-0.5 rounded ${
                                                        isExpired
                                                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                                            : isNearExpiry
                                                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                                            : 'bg-slate-100 text-slate-700'
                                                    }`}>
                                                        {formatDate(item.expires_at)}
                                                    </span>
                                                    {isExpired && item.status !== 'USED' && (
                                                        <div className="text-[9px] font-black text-rose-600 uppercase">Quá hạn</div>
                                                    )}
                                                    {!isExpired && isNearExpiry && item.status !== 'USED' && (
                                                        <div className="text-[9px] font-bold text-amber-600">Sắp hết hạn</div>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 text-[10.5px]">-</span>
                                            )}
                                        </td>

                                        {/* Trạng thái */}
                                        <td className="py-2 px-2 text-center">
                                            {isAvailable ? (
                                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                                    Khả Dụng
                                                </span>
                                            ) : isClaimed ? (
                                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                                    Đã Cấp (Chưa Dùng)
                                                </span>
                                            ) : isUsed ? (
                                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                                                    Đã Dùng
                                                </span>
                                            ) : (
                                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                                                    Hết Hạn
                                                </span>
                                            )}
                                        </td>

                                        {/* Thông Tin Thao Tác & Người Nhận (Kèm Tên Siêu Thị của User) */}
                                        <td className="py-2 px-2.5">
                                            {item.claimed_by_name ? (
                                                <div className="text-[11px] space-y-1">
                                                    {/* Tên nhân viên & Mã NV */}
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="font-black text-slate-900">{item.claimed_by_name}</span>
                                                        <span className="text-slate-400 font-mono text-[10px]">({item.claimed_by_id})</span>
                                                    </div>

                                                    {/* Tên siêu thị của user thao tác */}
                                                    {item.claimed_by_store ? (
                                                        <div
                                                            className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded max-w-[190px] truncate"
                                                            title={`Siêu thị thao tác: ${item.claimed_by_store}`}
                                                        >
                                                            <span className="shrink-0">🏪</span>
                                                            <span className="truncate">{getShortStoreName(item.claimed_by_store)}</span>
                                                        </div>
                                                    ) : (
                                                        <div className="text-[10px] text-slate-400 italic">Chưa rõ siêu thị</div>
                                                    )}

                                                    {/* Mã đơn hàng & Thời gian thao tác */}
                                                    <div className="flex items-center gap-2 flex-wrap text-[10.5px]">
                                                        {item.order_id && (
                                                            <span className="text-indigo-700 font-mono font-bold">
                                                                Đơn: {item.order_id}
                                                            </span>
                                                        )}
                                                        {item.claimed_at && (
                                                            <span className="text-slate-400 text-[10px] flex items-center gap-0.5">
                                                                <Clock className="w-3 h-3 text-slate-400 inline shrink-0" />
                                                                <span>
                                                                    {new Date(item.claimed_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} {formatDate(item.claimed_at)}
                                                                </span>
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-[11px] text-slate-400 space-y-0.5">
                                                    <span className="inline-block text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                                        🏢 {item.store_name === 'Toàn Cụm' || item.store_name === 'Toàn Cụm Siêu Thị' ? 'Kho Toàn Cụm' : getShortStoreName(item.store_name)}
                                                    </span>
                                                    {item.created_by && (
                                                        <div className="text-[9.5px] text-slate-400">
                                                            Nạp bởi: {item.created_by}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </td>

                                        {/* Thao tác */}
                                        <td className="py-2 px-2 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {isClaimed && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onResetVoucher(item.code)}
                                                        className="px-2 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-800 text-[10px] font-black transition cursor-pointer flex items-center gap-1 shadow-2xs"
                                                        title="Reset mã này về danh sách chờ khả dụng"
                                                    >
                                                        <RotateCcw className="w-3 h-3" />
                                                        <span>Reset</span>
                                                    </button>
                                                )}
                                                {isClaimed && onMarkUsed && (
                                                    <button
                                                        type="button"
                                                        onClick={() => onMarkUsed(item.code)}
                                                        className="px-2 py-1 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[10px] font-bold transition cursor-pointer flex items-center gap-1"
                                                        title="Xác nhận mã đã thanh toán xong"
                                                    >
                                                        <CheckCircle2 className="w-3 h-3" />
                                                        <span>Đã Dùng</span>
                                                    </button>
                                                )}
                                                {onDeleteVoucher && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            if (window.confirm(`Bạn có chắc muốn XÓA VĨNH VIỄN mã voucher "${item.code}" (${item.campaign_name} - ${Number(item.denomination).toLocaleString('vi-VN')}đ) khỏi kho?`)) {
                                                                onDeleteVoucher(item.code);
                                                            }
                                                        }}
                                                        className="p-1 rounded bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                                                        title="Xóa mã voucher này khỏi hệ thống"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
