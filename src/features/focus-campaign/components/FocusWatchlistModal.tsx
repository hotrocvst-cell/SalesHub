import React, { useState, useMemo, useEffect } from 'react';
import { X, Plus, Trash2, Check, Edit2, Save, Search } from 'lucide-react';
import type { CampaignWatchlist } from '../types';
import type { StoreItem, CampaignDictItem } from '../../../core/lib/storage';
import { upsertWatchlist, deleteWatchlist } from '../services/campaignWatchlistService';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    watchlists: CampaignWatchlist[];
    onWatchlistsChanged: () => void;
    stores: StoreItem[];
    campaignDict: CampaignDictItem[];
    periodActiveCampaigns: CampaignDictItem[];
    currentStore: string;
    currentMonth: number;
    currentYear: number;
}

export default function FocusWatchlistModal({
    isOpen,
    onClose,
    watchlists,
    onWatchlistsChanged,
    stores,
    campaignDict,
    periodActiveCampaigns,
    currentStore,
    currentMonth,
    currentYear
}: Props) {
    const [editingItem, setEditingItem] = useState<Partial<CampaignWatchlist> | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [actionError, setActionError] = useState<string>('');
    const [searchCampaignText, setSearchCampaignText] = useState('');
    const [onlyPeriodActive, setOnlyPeriodActive] = useState(true);

    useEffect(() => {
        if (!isOpen) return;
        setActionError('');
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen, onClose]);

    const displayedCampaigns = useMemo(() => {
        const baseList = (onlyPeriodActive && periodActiveCampaigns.length > 0)
            ? periodActiveCampaigns
            : campaignDict;

        if (!searchCampaignText.trim()) return baseList;
        const q = searchCampaignText.trim().toLowerCase();
        return baseList.filter(d => d.display_name.toLowerCase().includes(q) || d.raw_key.toLowerCase().includes(q));
    }, [onlyPeriodActive, periodActiveCampaigns, campaignDict, searchCampaignText]);

    if (!isOpen) return null;

    const handleCreateNew = () => {
        setSearchCampaignText('');
        setOnlyPeriodActive(true);
        const defaultKeys = periodActiveCampaigns.length > 0
            ? periodActiveCampaigns.slice(0, 5).map(d => d.raw_key)
            : campaignDict.slice(0, 5).map(d => d.raw_key);

        setEditingItem({
            list_name: '',
            description: '',
            store_name: currentStore === 'all' ? 'ALL' : currentStore,
            month: currentMonth,
            year: currentYear,
            campaign_keys: defaultKeys,
            is_default: watchlists.length === 0
        });
    };

    const handleToggleKey = (key: string) => {
        if (!editingItem) return;
        const current = editingItem.campaign_keys || [];
        const next = current.includes(key) ? current.filter(k => k !== key) : [...current, key];
        setEditingItem({ ...editingItem, campaign_keys: next });
    };

    const handleSave = async () => {
        if (!editingItem || !editingItem.list_name?.trim()) return;
        setIsSaving(true);
        setActionError('');
        try {
            await upsertWatchlist(editingItem);
            setEditingItem(null);
            onWatchlistsChanged();
        } catch (e: any) {
            console.error('Lỗi lưu watchlist:', e);
            setActionError(e?.message || 'Không thể lưu danh sách theo dõi. Vui lòng thử lại.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Bạn có chắc chắn muốn xóa danh sách theo dõi này?')) return;
        setActionError('');
        try {
            await deleteWatchlist(id);
            onWatchlistsChanged();
        } catch (e: any) {
            console.error('Lỗi xóa watchlist:', e);
            setActionError(e?.message || 'Không thể xóa danh sách theo dõi.');
        }
    };

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="focus-watchlist-modal-title"
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-sans"
        >
            <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
                {/* Header */}
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div>
                        <h3 id="focus-watchlist-modal-title" className="text-base font-black text-slate-900">Quản Lý Danh Sách Thi Đua Trọng Tâm</h3>
                        <p className="text-xs text-slate-600">Cấu hình nhóm hàng trọng điểm theo ST và kỳ thi đua</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Đóng cửa sổ quản lý danh sách"
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
                    >
                        <X className="w-5 h-5" aria-hidden="true" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 overflow-y-auto flex-1 space-y-4">
                    {actionError && (
                        <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800">
                            {actionError}
                        </div>
                    )}
                    {editingItem ? (
                        <div className="space-y-3.5 bg-indigo-50/40 p-4 rounded-2xl border border-indigo-100">
                            <h4 className="text-xs font-black uppercase text-indigo-900">
                                {editingItem.id ? 'Chỉnh Sửa Danh Sách' : 'Thêm Danh Sách Trọng Tâm Mới'}
                            </h4>

                            <div className="space-y-1">
                                <label htmlFor="watchlist-name-input" className="text-xs font-bold text-slate-700">Tên Danh Sách (*):</label>
                                <input
                                    id="watchlist-name-input"
                                    type="text"
                                    placeholder="Ví dụ: Top 5 Trọng Tâm Tháng 11..."
                                    value={editingItem.list_name || ''}
                                    onChange={(e) => setEditingItem({ ...editingItem, list_name: e.target.value })}
                                    className="w-full bg-white border border-slate-300 px-3 py-2 text-xs font-bold rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label htmlFor="watchlist-store-select" className="text-xs font-bold text-slate-700">Phạm Vi ST:</label>
                                    <select
                                        id="watchlist-store-select"
                                        value={editingItem.store_name || 'ALL'}
                                        onChange={(e) => setEditingItem({ ...editingItem, store_name: e.target.value })}
                                        className="w-full bg-white border border-slate-300 px-3 py-2 text-xs font-medium rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                    >
                                        <option value="ALL">Toàn Cụm ST (Tất cả)</option>
                                        {stores.map(s => <option key={s.id || s.name} value={s.name}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div className="flex items-center gap-2 pt-4">
                                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={Boolean(editingItem.is_default)}
                                            onChange={(e) => setEditingItem({ ...editingItem, is_default: e.target.checked })}
                                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                                        />
                                        Đặt làm mặc định
                                    </label>
                                </div>
                            </div>

                            {/* Bộ chọn nhóm hàng kèm ô tìm kiếm và toggle lọc kỳ (Yêu cầu 3 & 5) */}
                            <div className="space-y-2">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                                    <label className="text-xs font-bold text-slate-700">
                                        Chọn Nhóm hàng ({editingItem.campaign_keys?.length || 0} đã chọn):
                                    </label>
                                    <label className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-700 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={onlyPeriodActive}
                                            onChange={(e) => setOnlyPeriodActive(e.target.checked)}
                                            className="w-3.5 h-3.5 rounded text-indigo-600"
                                        />
                                        <span>Chỉ hiện nhóm hàng trong kỳ T{currentMonth}</span>
                                    </label>
                                </div>

                                {/* Ô TÌM KIẾM NHÓM HÀNG THI ĐUA (YÊU CẦU 3) */}
                                <div className="relative">
                                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                                    <input
                                        type="text"
                                        aria-label="Tìm tên nhóm hàng thi đua"
                                        placeholder="Tìm tên nhóm hàng thi đua..."
                                        value={searchCampaignText}
                                        onChange={(e) => setSearchCampaignText(e.target.value)}
                                        className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 text-xs rounded-xl focus-visible:ring-2 focus-visible:ring-indigo-500 outline-none"
                                    />
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-44 overflow-y-auto p-2 bg-white rounded-xl border border-slate-200">
                                    {displayedCampaigns.map((d) => {
                                        const isChecked = editingItem.campaign_keys?.includes(d.raw_key);
                                        return (
                                            <button
                                                key={d.raw_key}
                                                type="button"
                                                onClick={() => handleToggleKey(d.raw_key)}
                                                className={`text-left px-2 py-1.5 rounded-lg text-xs truncate flex items-center justify-between border cursor-pointer ${
                                                    isChecked
                                                        ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold'
                                                        : 'bg-slate-50/50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                                }`}
                                            >
                                                <span className="truncate">{d.display_name}</span>
                                                {isChecked && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0 ml-1" aria-hidden="true" />}
                                            </button>
                                        );
                                    })}
                                    {displayedCampaigns.length === 0 && (
                                        <div className="col-span-full py-4 text-center text-xs text-slate-600">
                                            Không tìm thấy nhóm hàng thi đua phù hợp.
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-1">
                                <button type="button" onClick={() => setEditingItem(null)} className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer">
                                    Hủy
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={isSaving || !editingItem.list_name?.trim()}
                                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm disabled:opacity-50 cursor-pointer"
                                >
                                    <Save className="w-3.5 h-3.5" aria-hidden="true" />
                                    <span>{isSaving ? 'Đang lưu...' : 'Lưu Danh Sách'}</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-slate-600 uppercase">Danh Sách Đang Lưu ({watchlists.length})</span>
                                <button
                                    type="button"
                                    onClick={handleCreateNew}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm cursor-pointer"
                                >
                                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                                    <span>Thêm Danh Sách Mới</span>
                                </button>
                            </div>

                            {watchlists.length === 0 ? (
                                <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl space-y-1.5">
                                    <p className="text-xs font-bold text-slate-700">Chưa có danh sách thi đua trọng tâm nào.</p>
                                    <p className="text-[11px] text-slate-600">Bấm nút &quot;Thêm Danh Sách Mới&quot; ở trên để chọn các nhóm hàng cần theo dõi.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {watchlists.map((w) => (
                                        <div key={w.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex items-center justify-between gap-3 hover:border-slate-300 transition">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h5 className="text-xs font-black text-slate-800">{w.list_name}</h5>
                                                    {w.is_default && <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-md">Mặc định</span>}
                                                    <span className="text-[10px] bg-slate-200 text-slate-700 font-semibold px-1.5 py-0.5 rounded-md">ST: {w.store_name}</span>
                                                </div>
                                                <p className="text-[11px] text-slate-600 line-clamp-1 pt-0.5">Gồm {w.campaign_keys?.length || 0} NH: {w.campaign_keys?.join(', ')}</p>
                                            </div>

                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => { setEditingItem(w); setSearchCampaignText(''); }}
                                                    className="p-1.5 text-slate-600 hover:text-indigo-700 hover:bg-slate-200/60 rounded-lg cursor-pointer"
                                                    title="Sửa danh sách"
                                                    aria-label={`Sửa danh sách ${w.list_name}`}
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(w.id)}
                                                    className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-slate-200/60 rounded-lg cursor-pointer"
                                                    title="Xóa danh sách"
                                                    aria-label={`Xóa danh sách ${w.list_name}`}
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl cursor-pointer">
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
}
