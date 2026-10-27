import React, { useState, useMemo } from 'react';
import { X, Eye, EyeOff, Search, Ban, CheckCircle2, AlertTriangle, ShieldCheck, Sparkles, Layers } from 'lucide-react';
import type { VoucherItem, VoucherCampaignStatusConfig } from '../types';
import { isCampaignHidden, isCampaignOrDenomEnded } from '../services/voucherService';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    vouchers: VoucherItem[];
    campaignStatuses: Record<string, VoucherCampaignStatusConfig>;
    onToggleHideCampaign: (campaignName: string, currentIsHidden: boolean) => Promise<void>;
    onBulkHideEndedCampaigns?: (campaignNames: string[]) => Promise<void>;
}

export default function VoucherHideCampaignModal({
    isOpen,
    onClose,
    vouchers,
    campaignStatuses,
    onToggleHideCampaign,
    onBulkHideEndedCampaigns
}: Props) {
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [filterTab, setFilterTab] = useState<'ALL' | 'ACTIVE' | 'HIDDEN' | 'EXPIRED_HAS'>('ALL');
    const [processingCampaign, setProcessingCampaign] = useState<string | null>(null);
    const [isBulkProcessing, setIsBulkProcessing] = useState<boolean>(false);

    const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

    // Tổng hợp thông tin của từng chương trình
    const campaignList = useMemo(() => {
        const map = new Map<string, {
            campaign_name: string;
            total: number;
            available: number;
            claimed: number;
            used: number;
            expired: number;
            is_ended: boolean;
            is_hidden: boolean;
        }>();

        vouchers.forEach(v => {
            const cName = v.campaign_name.trim();
            if (!map.has(cName)) {
                const isEnded = isCampaignOrDenomEnded(campaignStatuses, cName);
                const isHidden = isCampaignHidden(campaignStatuses, cName);
                map.set(cName, {
                    campaign_name: cName,
                    total: 0,
                    available: 0,
                    claimed: 0,
                    used: 0,
                    expired: 0,
                    is_ended: isEnded,
                    is_hidden: isHidden
                });
            }

            const item = map.get(cName)!;
            item.total++;

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
        });

        return Array.from(map.values()).sort((a, b) => {
            // Đưa các chương trình có mã hết hạn và chưa ẩn lên trước để tiện xử lý
            if (a.is_hidden !== b.is_hidden) return a.is_hidden ? 1 : -1;
            if (a.expired !== b.expired) return b.expired - a.expired;
            return a.campaign_name.localeCompare(b.campaign_name, 'vi');
        });
    }, [vouchers, campaignStatuses, todayStr]);

    // Các chương trình đang có mã hết hạn nhưng CHƯA ĐƯỢC ẨN
    const unhiddenExpiredCampaigns = useMemo(() => {
        return campaignList.filter(c => !c.is_hidden && (c.expired > 0 || c.is_ended));
    }, [campaignList]);

    // Lọc danh sách hiển thị trong modal
    const filteredCampaigns = useMemo(() => {
        let list = campaignList;

        if (filterTab === 'ACTIVE') {
            list = list.filter(c => !c.is_hidden);
        } else if (filterTab === 'HIDDEN') {
            list = list.filter(c => c.is_hidden);
        } else if (filterTab === 'EXPIRED_HAS') {
            list = list.filter(c => c.expired > 0);
        }

        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            list = list.filter(c => c.campaign_name.toLowerCase().includes(q));
        }

        return list;
    }, [campaignList, filterTab, searchQuery]);

    if (!isOpen) return null;

    const handleToggle = async (cName: string, currentIsHidden: boolean) => {
        setProcessingCampaign(cName);
        try {
            await onToggleHideCampaign(cName, currentIsHidden);
        } finally {
            setProcessingCampaign(null);
        }
    };

    const handleBulkHide = async () => {
        if (!onBulkHideEndedCampaigns || unhiddenExpiredCampaigns.length === 0) return;
        const confirmMsg = `Xác nhận ẩn ${unhiddenExpiredCampaigns.length} chương trình đang có mã hết hạn/đã kết thúc?\n\nDữ liệu các chương trình này sẽ được bảo toàn lưu trữ 100% trong kho, không bị mất dữ liệu và hệ thống sẽ không cảnh báo mã hết hạn nữa.`;
        if (!window.confirm(confirmMsg)) return;

        setIsBulkProcessing(true);
        try {
            const names = unhiddenExpiredCampaigns.map(c => c.campaign_name);
            await onBulkHideEndedCampaigns(names);
        } finally {
            setIsBulkProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs font-avo animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
                {/* Header modal */}
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-4 sm:p-5 text-white flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-md shrink-0">
                            <EyeOff className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-sm sm:text-base font-black uppercase tracking-wide text-amber-300 flex items-center gap-2">
                                <span>Quản Lý Ẩn / Hiện Chương Trình PMH</span>
                                <span className="text-[10px] font-bold bg-amber-400/20 text-amber-200 px-2 py-0.5 rounded-full border border-amber-400/30">
                                    Lưu Trữ Kho
                                </span>
                            </h2>
                            <p className="text-xs text-slate-300 mt-0.5">
                                Ẩn các chương trình đã kết thúc để lưu trữ an toàn, không mất dữ liệu và tránh cảnh báo quấy rầy
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer shrink-0"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Banner gợi ý tính năng */}
                <div className="bg-indigo-50/70 border-b border-indigo-100 p-3 sm:px-5 flex items-start justify-between gap-3 text-xs shrink-0 flex-wrap sm:flex-nowrap">
                    <div className="flex items-start gap-2 text-indigo-950 leading-relaxed">
                        <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <div>
                            <strong>Lợi ích khi chọn Ẩn Chương Trình:</strong> Vừa lưu trữ được 100% dữ liệu lịch sử voucher (không sợ mất data như khi xóa dọn kho), vừa tắt được cảnh báo hết hạn và rút gọn giao diện cấp mã của nhân viên.
                        </div>
                    </div>

                    {unhiddenExpiredCampaigns.length > 0 && onBulkHideEndedCampaigns && (
                        <button
                            type="button"
                            onClick={handleBulkHide}
                            disabled={isBulkProcessing}
                            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-black text-xs transition cursor-pointer shadow-xs inline-flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                            title="Ẩn tất cả các chương trình đã hết hạn chỉ bằng 1 cú nhấp chuột"
                        >
                            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                            <span>{isBulkProcessing ? 'Đang xử lý...' : `Ẩn nhanh ${unhiddenExpiredCampaigns.length} CT hết hạn`}</span>
                        </button>
                    )}
                </div>

                {/* Thanh tìm kiếm và bộ lọc tab */}
                <div className="p-3 sm:px-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-2.5 flex-wrap shrink-0">
                    <div className="relative flex-1 min-w-[180px]">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Tìm tên chương trình..."
                            className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 shadow-2xs"
                        />
                    </div>

                    <div className="flex items-center gap-1 flex-wrap text-xs">
                        <button
                            type="button"
                            onClick={() => setFilterTab('ALL')}
                            className={`px-2.5 py-1 rounded-xl font-bold transition cursor-pointer ${
                                filterTab === 'ALL'
                                    ? 'bg-slate-900 text-white shadow-2xs'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            Tất cả ({campaignList.length})
                        </button>

                        <button
                            type="button"
                            onClick={() => setFilterTab('ACTIVE')}
                            className={`px-2.5 py-1 rounded-xl font-bold transition cursor-pointer ${
                                filterTab === 'ACTIVE'
                                    ? 'bg-emerald-600 text-white shadow-2xs'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            Đang hiện ({campaignList.filter(c => !c.is_hidden).length})
                        </button>

                        <button
                            type="button"
                            onClick={() => setFilterTab('HIDDEN')}
                            className={`px-2.5 py-1 rounded-xl font-bold transition cursor-pointer ${
                                filterTab === 'HIDDEN'
                                    ? 'bg-amber-500 text-white shadow-2xs'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            Đã ẩn ({campaignList.filter(c => c.is_hidden).length})
                        </button>

                        <button
                            type="button"
                            onClick={() => setFilterTab('EXPIRED_HAS')}
                            className={`px-2.5 py-1 rounded-xl font-bold transition cursor-pointer ${
                                filterTab === 'EXPIRED_HAS'
                                    ? 'bg-rose-600 text-white shadow-2xs'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                        >
                            Có mã hết hạn ({campaignList.filter(c => c.expired > 0).length})
                        </button>
                    </div>
                </div>

                {/* Danh sách chương trình */}
                <div className="overflow-y-auto p-3 sm:p-5 divide-y divide-slate-100 space-y-2 flex-1">
                    {filteredCampaigns.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 font-bold text-xs space-y-2">
                            <Layers className="w-8 h-8 mx-auto text-slate-300" />
                            <div>Không tìm thấy chương trình nào phù hợp.</div>
                        </div>
                    ) : (
                        filteredCampaigns.map(c => {
                            const isProcessing = processingCampaign === c.campaign_name;

                            return (
                                <div
                                    key={c.campaign_name}
                                    className={`p-3 rounded-2xl border transition flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap ${
                                        c.is_hidden
                                            ? 'bg-slate-50/80 border-slate-200 opacity-80'
                                            : c.expired > 0
                                            ? 'bg-rose-50/30 border-rose-200'
                                            : 'bg-white border-slate-200'
                                    }`}
                                >
                                    <div className="space-y-1 min-w-[200px]">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-black text-slate-900 text-xs">
                                                {c.campaign_name}
                                            </span>
                                            {c.is_hidden && (
                                                <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 border border-slate-300 inline-flex items-center gap-1">
                                                    <EyeOff className="w-3 h-3 text-slate-500" />
                                                    <span>Đã Ẩn (Lưu trữ)</span>
                                                </span>
                                            )}
                                            {c.is_ended && !c.is_hidden && (
                                                <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200 inline-flex items-center gap-1">
                                                    <Ban className="w-3 h-3 text-rose-600" />
                                                    <span>Đã Kết Thúc</span>
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-3 text-[11px] text-slate-500 font-mono flex-wrap">
                                            <span>Tổng: <strong>{c.total}</strong></span>
                                            <span className="text-emerald-700">Khả dụng: <strong>{c.available}</strong></span>
                                            <span className="text-indigo-700">Đã cấp/dùng: <strong>{c.claimed + c.used}</strong></span>
                                            {c.expired > 0 && (
                                                <span className="text-rose-700 font-bold bg-rose-100/70 px-1.5 py-0.2 rounded border border-rose-200">
                                                    ⚠️ Quá hạn: {c.expired} mã
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Nút hành động Ẩn / Hiện */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        {c.is_hidden ? (
                                            <button
                                                type="button"
                                                onClick={() => handleToggle(c.campaign_name, true)}
                                                disabled={isProcessing}
                                                className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-black transition cursor-pointer inline-flex items-center gap-1.5 shadow-2xs active:scale-95 disabled:opacity-50"
                                                title="Mở lại hiển thị cho chương trình này"
                                            >
                                                <Eye className="w-3.5 h-3.5 text-emerald-600" />
                                                <span>{isProcessing ? 'Đang lưu...' : 'Mở Hiển Thị Lại'}</span>
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => handleToggle(c.campaign_name, false)}
                                                disabled={isProcessing}
                                                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-amber-100 text-slate-800 hover:text-amber-900 border border-slate-300 hover:border-amber-400 text-xs font-black transition cursor-pointer inline-flex items-center gap-1.5 shadow-2xs active:scale-95 disabled:opacity-50"
                                                title="Ẩn chương trình này để lưu trữ kho và tắt cảnh báo hết hạn"
                                            >
                                                <EyeOff className="w-3.5 h-3.5 text-slate-600" />
                                                <span>{isProcessing ? 'Đang lưu...' : 'Ẩn Chương Trình'}</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer modal */}
                <div className="p-3 sm:px-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 text-xs shrink-0">
                    <span className="text-slate-500 font-bold">
                        Đang hiển thị {filteredCampaigns.length}/{campaignList.length} chương trình
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white font-black text-xs transition cursor-pointer shadow-xs"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
}
