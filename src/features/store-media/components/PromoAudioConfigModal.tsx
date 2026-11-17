import React, { useState } from 'react';
import {
    X,
    FolderPlus,
    Save,
    Trash2,
    Link,
    Calendar,
    Building2,
    CheckCircle2,
    AlertCircle
} from 'lucide-react';
import type { PromoAudioItem } from '../types';
import type { StoreItem } from '../../../core/lib/storage';
import { extractDriveFileId, savePromoAudioItem, deletePromoAudioItem } from '../services/promoAudioStorageService';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    availableStores: StoreItem[];
    currentStoreCode: string;
    existingItems: PromoAudioItem[];
    onRefresh: () => void;
    userName: string;
}

export default function PromoAudioConfigModal({
    isOpen,
    onClose,
    availableStores,
    currentStoreCode,
    existingItems,
    onRefresh,
    userName
}: Props) {
    const [title, setTitle] = useState('');
    const [driveLink, setDriveLink] = useState('');
    const [targetStore, setTargetStore] = useState<string>(currentStoreCode || 'ALL');
    const [validUntil, setValidUntil] = useState('2030-12-31');
    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    if (!isOpen) return null;

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        setSuccessMsg('');

        const cleanTitle = title.trim();
        const fileId = extractDriveFileId(driveLink);

        if (!cleanTitle) {
            setErrorMsg('Vui lòng nhập tên bài phát thanh!');
            return;
        }
        if (!fileId) {
            setErrorMsg('Vui lòng dán link hoặc ID file Google Drive hợp lệ!');
            return;
        }

        setIsSaving(true);
        try {
            const storeCodes = targetStore === 'ALL' ? [] : [targetStore];
            const res = await savePromoAudioItem(
                {
                    title: cleanTitle,
                    driveFileId: fileId,
                    driveUrl: driveLink.trim(),
                    storeCodes,
                    validUntil,
                    isActive: true
                },
                userName
            );

            if (res.success) {
                setSuccessMsg('Đã lưu bài phát thanh lên Cloud!');
                setTitle('');
                setDriveLink('');
                onRefresh();
            } else {
                setErrorMsg(res.error || 'Lỗi khi lưu');
            }
        } catch (err: any) {
            setErrorMsg(err?.message || 'Có lỗi xảy ra');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Bạn có chắc muốn xóa bài phát thanh này?')) return;
        const res = await deletePromoAudioItem(id);
        if (res.success) {
            onRefresh();
        } else {
            alert(`Lỗi khi xóa: ${res.error}`);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5">
            <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] flex flex-col">
                {/* Header Modal */}
                <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center text-white font-bold">
                            <FolderPlus className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black">Cấu Hình Thư Viện Audio KM (Drive)</h3>
                            <p className="text-[11px] text-slate-300">Admin quản lý bài phát thanh theo từng ST</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-white p-1 rounded-lg"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form nạp bài mới */}
                <div className="p-4 overflow-y-auto space-y-4 flex-1">
                    {errorMsg && (
                        <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-1.5 font-bold">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}
                    {successMsg && (
                        <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-center gap-1.5 font-bold">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>{successMsg}</span>
                        </div>
                    )}

                    <form onSubmit={handleSave} className="space-y-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                        <span className="text-xs font-black text-slate-900 uppercase tracking-wide block">
                            + Thêm bài phát thanh mới
                        </span>

                        <div>
                            <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                Tên bài phát thanh (kèm tên ST nếu có):
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="Ví dụ: Phát thanh KM T11 - 290 Trương Công Định"
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-purple-500"
                            />
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                Link chia sẻ Google Drive (hoặc File ID):
                            </label>
                            <div className="relative">
                                <Link className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                                <input
                                    type="text"
                                    value={driveLink}
                                    onChange={e => setDriveLink(e.target.value)}
                                    placeholder="Dán link drive.google.com/file/d/..."
                                    className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                                />
                            </div>
                            <span className="text-[10px] text-slate-500 mt-0.5 block">
                                * Lưu ý: File Drive phải đặt quyền "Bất kỳ ai có đường liên kết đều có thể xem".
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                    Áp dụng cho ST:
                                </label>
                                <select
                                    value={targetStore}
                                    onChange={e => setTargetStore(e.target.value)}
                                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                                >
                                    <option value="ALL">Toàn Cụm (Tất cả ST)</option>
                                    {availableStores.map(s => (
                                        <option key={s.code} value={s.code}>
                                            ST {s.code} - {s.short_name || s.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                    Hạn áp dụng (Valid until):
                                </label>
                                <input
                                    type="date"
                                    value={validUntil}
                                    onChange={e => setValidUntil(e.target.value)}
                                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isSaving}
                            className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            <span>{isSaving ? 'Đang lưu Cloud...' : 'Lưu Vào Thư Viện Cloud'}</span>
                        </button>
                    </form>

                    {/* Danh sách bài hiện có */}
                    <div className="space-y-2">
                        <span className="text-xs font-black text-slate-800 uppercase tracking-wide block">
                            Danh mục bài đã lưu ({existingItems.length} bài)
                        </span>

                        {existingItems.length === 0 ? (
                            <p className="text-xs text-slate-400 italic text-center py-4 bg-slate-50 rounded-xl">
                                Chưa có bài phát thanh nào trên Cloud.
                            </p>
                        ) : (
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                {existingItems.map(item => (
                                    <div
                                        key={item.id}
                                        className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-2 text-xs shadow-2xs"
                                    >
                                        <div className="truncate">
                                            <span className="font-bold text-slate-900 block truncate">
                                                {item.title}
                                            </span>
                                            <span className="text-[10px] text-slate-500 font-mono">
                                                {item.storeCodes.length === 0
                                                    ? 'Toàn Cụm'
                                                    : `ST: ${item.storeCodes.join(', ')}`}{' '}
                                                · Hạn: {item.validUntil}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(item.id)}
                                            className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg transition"
                                            title="Xóa bài này"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
