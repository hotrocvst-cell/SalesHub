import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    X,
    Trash2,
    Search,
    AlertTriangle,
    Ban,
    Clock,
    EyeOff,
    CheckSquare,
    Square,
    Layers,
    Sparkles,
    ShieldAlert
} from 'lucide-react';
import type { VoucherItem, VoucherCampaignStatusConfig } from '../types';
import {
    isCampaignOrDenomEnded,
    isCampaignHidden,
    deleteCampaignsBatch,
    isVoucherInUserCluster
} from '../services/voucherService';
import { formatDate } from '../../../core/lib/formatters';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    vouchers: VoucherItem[];
    campaignStatuses: Record<string, VoucherCampaignStatusConfig>;
    currentStoreName: string;
    accessibleStores?: string[];
    currentUserDisplayName?: string;
    isAdmin?: boolean;
    onSuccess: (deletedCount: number, message: string) => void;
}

type TabType = 'ENDED_OR_EXPIRED' | 'ENDED_ONLY' | 'EXPIRED_ONLY' | 'HIDDEN_ONLY' | 'ALL';

interface CampaignSummary {
    campaign_name: string;
    total: number;
    available: number;
    claimed: number;
    used: number;
    expired: number;
    totalValue: number;
    denominations: number[];
    is_ended: boolean;
    is_hidden: boolean;
    latestExpiry: string | null;
    isExpiredAll: boolean;
    isEndedOrExpired: boolean;
}

export default function VoucherDeleteCampaignModal({
    isOpen,
    onClose,
    vouchers,
    campaignStatuses,
    currentStoreName,
    accessibleStores,
    currentUserDisplayName,
    isAdmin,
    onSuccess
}: Props) {
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [filterTab, setFilterTab] = useState<TabType>('ENDED_OR_EXPIRED');
    const [selectedCampaigns, setSelectedCampaigns] = useState<Set<string>>(new Set());
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [singleDeletingCamp, setSingleDeletingCamp] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isProcessing && !singleDeletingCamp) onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isProcessing, singleDeletingCamp, onClose]);

    const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

    const clusterContext = useMemo(() => ({
        userStoreName: currentStoreName,
        accessibleStores,
        currentUserDisplayName,
        isAdmin
    }), [currentStoreName, accessibleStores, currentUserDisplayName, isAdmin]);

    // Tổng hợp danh sách chương trình PMH
    const campaignList = useMemo<CampaignSummary[]>(() => {
        const map = new Map<string, {
            campaign_name: string;
            total: number;
            available: number;
            claimed: number;
            used: number;
            expired: number;
            totalValue: number;
            denominations: Set<number>;
            latestExpiry: string | null;
            is_ended: boolean;
            is_hidden: boolean;
        }>();

        // 1. Quét voucher thuộc cụm của người dùng
        vouchers.forEach(v => {
            if (!isAdmin || (currentStoreName && currentStoreName !== 'all')) {
                if (!isVoucherInUserCluster(v, currentStoreName, accessibleStores, currentUserDisplayName, isAdmin)) {
                    return;
                }
            }

            const cName = (v.campaign_name || '').trim();
            if (!cName) return;

            if (!map.has(cName)) {
                map.set(cName, {
                    campaign_name: cName,
                    total: 0,
                    available: 0,
                    claimed: 0,
                    used: 0,
                    expired: 0,
                    totalValue: 0,
                    denominations: new Set(),
                    latestExpiry: null,
                    is_ended: isCampaignOrDenomEnded(campaignStatuses, cName),
                    is_hidden: isCampaignHidden(campaignStatuses, cName)
                });
            }

            const item = map.get(cName)!;
            item.total++;
            item.totalValue += Number(v.denomination) || 0;
            if (v.denomination) item.denominations.add(Number(v.denomination));

            const isExpired = Boolean(v.expires_at && v.expires_at < todayStr && v.status !== 'USED');
            if (isExpired) {
                item.expired++;
            }

            if (v.status === 'AVAILABLE' && !isExpired) {
                item.available++;
            } else if (v.status === 'CLAIMED') {
                item.claimed++;
            } else if (v.status === 'USED') {
                item.used++;
            }

            if (v.expires_at) {
                if (!item.latestExpiry || v.expires_at > item.latestExpiry) {
                    item.latestExpiry = v.expires_at;
                }
            }
        });

        // 2. Bổ sung các chương trình có trong campaignStatuses nhưng kho hiện đã hết mã (0 mã)
        Object.values(campaignStatuses).forEach(status => {
            if (!status || !status.campaign_name) return;
            const cName = status.campaign_name.trim();
            if (!cName || map.has(cName)) return;

            map.set(cName, {
                campaign_name: cName,
                total: 0,
                available: 0,
                claimed: 0,
                used: 0,
                expired: 0,
                totalValue: 0,
                denominations: new Set(status.denomination ? [status.denomination] : []),
                latestExpiry: null,
                is_ended: Boolean(status.is_ended),
                is_hidden: Boolean(status.is_hidden)
            });
        });

        return Array.from(map.values()).map(item => {
            const isExpiredAll = (item.total > 0 && item.available === 0) || Boolean(item.latestExpiry && item.latestExpiry < todayStr);
            const isEndedOrExpired = item.is_ended || item.expired > 0 || isExpiredAll;

            return {
                ...item,
                denominations: Array.from(item.denominations).sort((a, b) => a - b),
                isExpiredAll,
                isEndedOrExpired
            };
        }).sort((a, b) => {
            // Đưa các chương trình đã kết thúc / hết hạn lên trước
            if (a.isEndedOrExpired !== b.isEndedOrExpired) {
                return a.isEndedOrExpired ? -1 : 1;
            }
            if (a.is_ended !== b.is_ended) return a.is_ended ? -1 : 1;
            return b.expired - a.expired;
        });
    }, [vouchers, campaignStatuses, currentStoreName, accessibleStores, currentUserDisplayName, isAdmin, todayStr]);

    // Lọc danh sách chương trình hiển thị theo tab và tìm kiếm
    const filteredCampaigns = useMemo(() => {
        let list = campaignList;

        if (filterTab === 'ENDED_OR_EXPIRED') {
            list = list.filter(c => c.isEndedOrExpired);
        } else if (filterTab === 'ENDED_ONLY') {
            list = list.filter(c => c.is_ended);
        } else if (filterTab === 'EXPIRED_ONLY') {
            list = list.filter(c => c.expired > 0 || c.isExpiredAll);
        } else if (filterTab === 'HIDDEN_ONLY') {
            list = list.filter(c => c.is_hidden);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            list = list.filter(c => c.campaign_name.toLowerCase().includes(q));
        }

        return list;
    }, [campaignList, filterTab, searchQuery]);

    // Thống kê số lượng theo từng tab
    const tabCounts = useMemo(() => {
        return {
            endedOrExpired: campaignList.filter(c => c.isEndedOrExpired).length,
            endedOnly: campaignList.filter(c => c.is_ended).length,
            expiredOnly: campaignList.filter(c => c.expired > 0 || c.isExpiredAll).length,
            hiddenOnly: campaignList.filter(c => c.is_hidden).length,
            all: campaignList.length
        };
    }, [campaignList]);

    // Thống kê dữ liệu các chương trình đang được chọn
    const selectedStats = useMemo(() => {
        let count = 0;
        let totalVouchers = 0;
        let totalValue = 0;

        campaignList.forEach(c => {
            if (selectedCampaigns.has(c.campaign_name)) {
                count++;
                totalVouchers += c.total;
                totalValue += c.totalValue;
            }
        });

        return { count, totalVouchers, totalValue };
    }, [campaignList, selectedCampaigns]);

    if (!isOpen) return null;

    // Toggle chọn 1 chương trình
    const handleToggleSelect = (campName: string) => {
        setSelectedCampaigns(prev => {
            const next = new Set(prev);
            if (next.has(campName)) {
                next.delete(campName);
            } else {
                next.add(campName);
            }
            return next;
        });
    };

    // Toggle chọn tất cả các chương trình đang lọc
    const handleToggleSelectAll = () => {
        const displayedNames = filteredCampaigns.map(c => c.campaign_name);
        const allSelected = displayedNames.every(name => selectedCampaigns.has(name));

        setSelectedCampaigns(prev => {
            const next = new Set(prev);
            if (allSelected) {
                displayedNames.forEach(name => next.delete(name));
            } else {
                displayedNames.forEach(name => next.add(name));
            }
            return next;
        });
    };

    // Thực thi xóa hàng loạt các chương trình đã chọn
    const handleExecuteDeleteBatch = async () => {
        if (selectedStats.count === 0) return;

        const names = Array.from(selectedCampaigns);
        const previewNames = names.slice(0, 5).map(n => `  • ${n}`).join('\n');
        const moreSuffix = names.length > 5 ? `\n  ... và còn ${names.length - 5} chương trình khác` : '';

        const confirmMsg = `⚠️ CẢNH BÁO XÓA VĨNH VIỄN CHƯƠNG TRÌNH PMH:\n\nBạn đang chọn XÓA VĨNH VIỄN ${selectedStats.count} chương trình PMH:\n${previewNames}${moreSuffix}\n\n• Toàn bộ ${selectedStats.totalVouchers} mã voucher (${selectedStats.totalValue.toLocaleString('vi-VN')}đ) sẽ bị xóa sạch khỏi kho CLOUD và máy này.\n• Trạng thái kết thúc/ẩn của các chương trình này sẽ bị dọn dẹp.\n• THAO TÁC NÀY KHÔNG THỂ HOÀN TÁC!\n\nBạn có chắc chắn muốn tiến hành xóa?`;

        if (!window.confirm(confirmMsg)) return;

        setIsProcessing(true);
        try {
            const res = await deleteCampaignsBatch(names, clusterContext);
            if (res.success) {
                onSuccess(
                    res.deletedVoucherCount,
                    `🗑️ Đã xóa vĩnh viễn ${res.deletedCampaignCount} chương trình PMH (${res.deletedVoucherCount} mã voucher) khỏi kho!`
                );
                setSelectedCampaigns(new Set());
                onClose();
            } else {
                alert(`Lỗi khi xóa: ${res.error}`);
            }
        } finally {
            setIsProcessing(false);
        }
    };

    // Thực thi xóa riêng 1 chương trình
    const handleExecuteDeleteSingle = async (camp: CampaignSummary) => {
        const confirmMsg = `⚠️ XÁC NHẬN XÓA VĨNH VIỄN CHƯƠNG TRÌNH PMH:\n\nBạn có chắc chắn muốn XÓA HOÀN TOÀN chương trình:\n"${camp.campaign_name}"?\n\n• Số lượng: ${camp.total} mã voucher\n• Tổng trị giá: ${camp.totalValue.toLocaleString('vi-VN')}đ\n• Thao tác này sẽ xóa sạch dữ liệu trên CLOUD và không thể hoàn tác!`;

        if (!window.confirm(confirmMsg)) return;

        setSingleDeletingCamp(camp.campaign_name);
        try {
            const res = await deleteCampaignsBatch([camp.campaign_name], clusterContext);
            if (res.success) {
                onSuccess(
                    res.deletedVoucherCount,
                    `🗑️ Đã xóa vĩnh viễn chương trình "${camp.campaign_name}" (${res.deletedVoucherCount} mã)!`
                );
                setSelectedCampaigns(prev => {
                    const next = new Set(prev);
                    next.delete(camp.campaign_name);
                    return next;
                });
            } else {
                alert(`Lỗi khi xóa: ${res.error}`);
            }
        } finally {
            setSingleDeletingCamp(null);
        }
    };

    const isAllDisplayedSelected = filteredCampaigns.length > 0 &&
        filteredCampaigns.every(c => selectedCampaigns.has(c.campaign_name));

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="voucher-delete-camp-modal-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/75 backdrop-blur-sm"
            onClick={() => !isProcessing && !singleDeletingCamp && onClose()}
        >
            <div
                className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header modal */}
                <div className="bg-gradient-to-r from-rose-900 via-rose-950 to-slate-950 p-4 sm:p-5 text-white flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center font-black shadow-md shrink-0">
                            <Trash2 className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <div>
                            <h2 id="voucher-delete-camp-modal-title" className="text-sm sm:text-base font-black uppercase tracking-wide text-rose-200 flex items-center gap-2 flex-wrap">
                                <span>Lựa Chọn Xóa Chương Trình PMH</span>
                                <span className="text-[10px] font-bold bg-rose-500/30 text-rose-200 px-2 py-0.5 rounded-full border border-rose-400/30">
                                    Đã Kết Thúc / Hết Hạn
                                </span>
                            </h2>
                            <p className="text-xs text-rose-200 mt-0.5">
                                Phạm vi: <strong>{currentStoreName === 'all' ? 'Toàn Cụm ST' : currentStoreName}</strong>
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isProcessing}
                        aria-label="Đóng hộp thoại xóa chương trình"
                        className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-rose-200 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0 disabled:opacity-50"
                    >
                        <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                </div>

                {/* Banner cảnh báo an toàn */}
                <div className="bg-gradient-to-r from-rose-50 to-orange-50 border-b border-rose-100 p-3 sm:px-5 flex items-start gap-2.5 text-xs text-rose-950 shrink-0">
                    <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="leading-relaxed">
                        <strong className="text-rose-900">Lưu ý quan trọng:</strong> Thao tác xóa sẽ loại bỏ vĩnh viễn toàn bộ mã voucher và trạng thái của chương trình được chọn khỏi kho Cloud &amp; máy này. Nếu bạn chỉ muốn thu gọn giao diện mà vẫn giữ lịch sử, hãy dùng tính năng <strong>Ẩn Chương Trình</strong>.
                    </div>
                </div>

                {/* Thanh tìm kiếm và bộ lọc tab */}
                <div className="p-3 sm:px-5 border-b border-slate-200 bg-slate-50 space-y-2.5 shrink-0">
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                        <input
                            id="delete-campaign-search"
                            name="delete_campaign_search"
                            type="text"
                            aria-label="Tìm kiếm theo tên chương trình PMH"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Tìm kiếm theo tên chương trình PMH..."
                            className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-500 focus:outline-none focus:border-rose-500 shadow-sm"
                        />
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex items-center gap-1.5 flex-wrap text-xs">
                        <button
                            type="button"
                            onClick={() => setFilterTab('ENDED_OR_EXPIRED')}
                            className={`px-2.5 py-1 rounded-xl font-black transition cursor-pointer text-xs ${
                                filterTab === 'ENDED_OR_EXPIRED'
                                    ? 'bg-rose-600 text-white shadow-sm'
                                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                        >
                            Đã Kết Thúc / Hết Hạn ({tabCounts.endedOrExpired})
                        </button>

                        <button
                            type="button"
                            onClick={() => setFilterTab('ENDED_ONLY')}
                            className={`px-2.5 py-1 rounded-xl font-bold transition cursor-pointer text-xs ${
                                filterTab === 'ENDED_ONLY'
                                    ? 'bg-rose-700 text-white shadow-sm'
                                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                        >
                            Đã Kết Thúc ({tabCounts.endedOnly})
                        </button>

                        <button
                            type="button"
                            onClick={() => setFilterTab('EXPIRED_ONLY')}
                            className={`px-2.5 py-1 rounded-xl font-bold transition cursor-pointer text-xs ${
                                filterTab === 'EXPIRED_ONLY'
                                    ? 'bg-amber-400 text-slate-950 border border-amber-500 shadow-sm'
                                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                        >
                            Có Mã Quá Hạn ({tabCounts.expiredOnly})
                        </button>

                        <button
                            type="button"
                            onClick={() => setFilterTab('HIDDEN_ONLY')}
                            className={`px-2.5 py-1 rounded-xl font-bold transition cursor-pointer text-xs ${
                                filterTab === 'HIDDEN_ONLY'
                                    ? 'bg-slate-800 text-white shadow-sm'
                                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                        >
                            Đã Ẩn ({tabCounts.hiddenOnly})
                        </button>

                        <button
                            type="button"
                            onClick={() => setFilterTab('ALL')}
                            className={`px-2.5 py-1 rounded-xl font-bold transition cursor-pointer text-xs ${
                                filterTab === 'ALL'
                                    ? 'bg-slate-900 text-white shadow-sm'
                                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                        >
                            Tất Cả ({tabCounts.all})
                        </button>
                    </div>

                    {/* Dòng chọn tất cả và tóm tắt */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/60 text-xs">
                        <button
                            type="button"
                            onClick={handleToggleSelectAll}
                            className="inline-flex items-center gap-1.5 font-black text-slate-700 hover:text-rose-600 transition cursor-pointer"
                        >
                            {isAllDisplayedSelected ? (
                                <CheckSquare className="w-4 h-4 text-rose-600" />
                            ) : (
                                <Square className="w-4 h-4 text-slate-400" />
                            )}
                            <span>Chọn tất cả ({filteredCampaigns.length} CT đang lọc)</span>
                        </button>

                        {selectedCampaigns.size > 0 && (
                            <button
                                type="button"
                                onClick={() => setSelectedCampaigns(new Set())}
                                className="text-[11px] text-slate-500 hover:text-slate-800 underline font-medium cursor-pointer"
                            >
                                Bỏ chọn tất cả ({selectedCampaigns.size})
                            </button>
                        )}
                    </div>
                </div>

                {/* Danh sách các chương trình PMH */}
                <div className="overflow-y-auto p-3 sm:p-5 divide-y divide-slate-100 space-y-2 flex-1">
                    {filteredCampaigns.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 font-bold text-xs space-y-2">
                            <Layers className="w-8 h-8 mx-auto text-slate-300" />
                            <div>Không tìm thấy chương trình nào phù hợp với bộ lọc.</div>
                        </div>
                    ) : (
                        filteredCampaigns.map(camp => {
                            const isSelected = selectedCampaigns.has(camp.campaign_name);
                            const isDeletingSingle = singleDeletingCamp === camp.campaign_name;

                            return (
                                <div
                                    key={camp.campaign_name}
                                    className={`p-3 rounded-2xl border transition flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap ${
                                        isSelected
                                            ? 'bg-rose-50/80 border-rose-300 shadow-sm ring-1 ring-rose-300'
                                            : camp.is_ended
                                            ? 'bg-rose-50/30 border-rose-200/80 hover:bg-rose-50/50'
                                            : camp.expired > 0
                                            ? 'bg-amber-50/30 border-amber-200/80 hover:bg-amber-50/50'
                                            : 'bg-white border-slate-200 hover:bg-slate-50'
                                    }`}
                                >
                                    {/* Cột chọn Checkbox + Thông tin CT */}
                                    <div className="flex items-start gap-3 flex-1 min-w-[220px]">
                                        <button
                                            type="button"
                                            onClick={() => handleToggleSelect(camp.campaign_name)}
                                            aria-label={isSelected ? `Bỏ chọn ${camp.campaign_name}` : `Chọn ${camp.campaign_name} để xóa`}
                                            className="mt-0.5 text-slate-500 hover:text-rose-600 transition cursor-pointer shrink-0"
                                            title={isSelected ? 'Bỏ chọn' : 'Chọn để xóa'}
                                        >
                                            {isSelected ? (
                                                <CheckSquare className="w-4 h-4 text-rose-600" aria-hidden="true" />
                                            ) : (
                                                <Square className="w-4 h-4 text-slate-500" aria-hidden="true" />
                                            )}
                                        </button>

                                        <div className="space-y-1">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span
                                                    onClick={() => handleToggleSelect(camp.campaign_name)}
                                                    className="font-black text-slate-900 text-xs cursor-pointer hover:text-rose-600"
                                                >
                                                    {camp.campaign_name}
                                                </span>

                                                {camp.is_ended && (
                                                    <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 inline-flex items-center gap-0.5">
                                                        <Ban className="w-3 h-3 text-rose-600" aria-hidden="true" />
                                                        <span>Đã Kết Thúc</span>
                                                    </span>
                                                )}

                                                {camp.is_hidden && (
                                                    <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 border border-slate-300 inline-flex items-center gap-0.5">
                                                        <EyeOff className="w-3 h-3 text-slate-600" aria-hidden="true" />
                                                        <span>Đã Ẩn</span>
                                                    </span>
                                                )}

                                                {camp.expired > 0 && (
                                                    <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-0.5">
                                                        <Clock className="w-3 h-3 text-amber-700" aria-hidden="true" />
                                                        <span>{camp.expired} mã quá hạn</span>
                                                    </span>
                                                )}
                                            </div>

                                            {/* Chi tiết số liệu */}
                                            <div className="flex items-center gap-2.5 text-[11px] text-slate-500 font-mono flex-wrap">
                                                <span>Tổng: <strong className="text-slate-800">{camp.total}</strong> mã</span>
                                                <span className="text-emerald-700">Khả dụng: <strong>{camp.available}</strong></span>
                                                <span className="text-indigo-700">Đã dùng: <strong>{camp.used}</strong></span>
                                                <span className="text-rose-700 font-bold">
                                                    Trị giá: {camp.totalValue.toLocaleString('vi-VN')}đ
                                                </span>
                                                {camp.latestExpiry && (
                                                    <span className="text-slate-500 text-[10px]">
                                                        Hạn: {formatDate(camp.latestExpiry)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Nút xóa đơn lẻ từng chương trình */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => handleExecuteDeleteSingle(camp)}
                                            disabled={isProcessing || isDeletingSingle}
                                            className="p-1.5 sm:px-2.5 sm:py-1 rounded-xl bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800 border border-rose-200 hover:border-rose-400 text-xs font-bold transition cursor-pointer inline-flex items-center gap-1 shadow-sm active:scale-95 disabled:opacity-50"
                                            title={`Xóa riêng chương trình "${camp.campaign_name}" khỏi hệ thống`}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                            <span className="hidden sm:inline">
                                                {isDeletingSingle ? 'Đang xóa...' : 'Xóa CT'}
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer Modal: Thống kê và Nút Xóa Hàng Loạt */}
                <div className="p-3 sm:px-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 text-xs shrink-0 flex-wrap sm:flex-nowrap">
                    <div>
                        {selectedStats.count > 0 ? (
                            <div className="space-y-0.5">
                                <div className="font-black text-rose-700 flex items-center gap-1.5">
                                    <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                                    <span>Đang chọn {selectedStats.count} chương trình ({selectedStats.totalVouchers} mã)</span>
                                </div>
                                <div className="text-[11px] text-slate-600 font-mono">
                                    Tổng trị giá: <strong>{selectedStats.totalValue.toLocaleString('vi-VN')}đ</strong>
                                </div>
                            </div>
                        ) : (
                            <span className="text-slate-600 font-bold">
                                Chưa chọn chương trình nào để xóa ({filteredCampaigns.length} CT hiển thị)
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isProcessing}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-200/80 transition cursor-pointer disabled:opacity-50"
                        >
                            Đóng
                        </button>

                        <button
                            type="button"
                            onClick={handleExecuteDeleteBatch}
                            disabled={isProcessing || selectedStats.count === 0}
                            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white font-black text-xs transition cursor-pointer shadow-sm flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                            title={selectedStats.count > 0 ? `Xóa vĩnh viễn ${selectedStats.count} chương trình đã chọn` : 'Vui lòng tích chọn chương trình cần xóa'}
                        >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>
                                {isProcessing
                                    ? 'Đang tiến hành xóa...'
                                    : `Xóa Vĩnh Viễn (${selectedStats.count} CT)`}
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}

