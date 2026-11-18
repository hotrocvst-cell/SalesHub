import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    X,
    FolderPlus,
    Save,
    Trash2,
    UploadCloud,
    CheckCircle2,
    AlertCircle,
    Copy,
    Check,
    Music,
    CheckSquare,
    Square,
    Globe
} from 'lucide-react';
import type { PromoAudioItem } from '../types';
import type { StoreItem } from '../../../core/lib/storage';
import {
    savePromoAudioItem,
    deletePromoAudioItem,
    readAudioFileAsDataUrl,
    PROMO_AUDIO_RLS_FIX_SQL
} from '../services/promoAudioStorageService';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    isAdmin: boolean;
    availableStores: StoreItem[];
    currentStoreCode: string;
    existingItems: PromoAudioItem[];
    onRefresh: () => void;
    userName: string;
}

const MAX_CLOUD_AUDIO_MB = 5;

export default function PromoAudioConfigModal({
    isOpen,
    onClose,
    isAdmin,
    availableStores,
    currentStoreCode,
    existingItems,
    onRefresh,
    userName
}: Props) {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [title, setTitle] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [applyAllCluster, setApplyAllCluster] = useState<boolean>(false);
    const [selectedStoreCodes, setSelectedStoreCodes] = useState<string[]>([]);
    const [validUntil, setValidUntil] = useState('2030-12-31');
    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [isRlsError, setIsRlsError] = useState(false);
    const [sqlCopied, setSqlCopied] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');

    const allowedStoreCodeList = useMemo(
        () => availableStores.map(s => s.code).filter(Boolean),
        [availableStores]
    );
    const allowedCodeSet = useMemo(() => new Set(allowedStoreCodeList), [allowedStoreCodeList]);

    // Khởi tạo phạm vi ST mặc định khi mở modal
    useEffect(() => {
        if (!isOpen) return;
        setErrorMsg('');
        setIsRlsError(false);
        setSuccessMsg('');
        setApplyAllCluster(false);

        if (currentStoreCode && allowedCodeSet.has(currentStoreCode)) {
            setSelectedStoreCodes([currentStoreCode]);
        } else if (allowedStoreCodeList.length > 0) {
            setSelectedStoreCodes([allowedStoreCodeList[0]]);
        } else {
            setSelectedStoreCodes([]);
        }
    }, [isOpen, currentStoreCode, allowedCodeSet, allowedStoreCodeList]);

    if (!isOpen) return null;

    const toggleStoreCode = (code: string) => {
        setApplyAllCluster(false);
        setSelectedStoreCodes(prev =>
            prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
        );
    };

    const handleSelectAllMyStores = () => {
        setApplyAllCluster(false);
        setSelectedStoreCodes([...allowedStoreCodeList]);
    };

    const handleCopyRlsSql = async () => {
        try {
            await navigator.clipboard.writeText(PROMO_AUDIO_RLS_FIX_SQL);
            setSqlCopied(true);
            setTimeout(() => setSqlCopied(false), 2500);
        } catch {
            // ignore
        }
    };

    const handlePickAudioFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setErrorMsg('');

        if (!file.type.startsWith('audio/') && !/\.(mp3|m4a|wav|ogg|aac)$/i.test(file.name)) {
            setErrorMsg('Vui lòng chọn tệp âm thanh hợp lệ (.mp3, .m4a, .wav, .ogg).');
            e.target.value = '';
            return;
        }
        if (file.size > MAX_CLOUD_AUDIO_MB * 1024 * 1024) {
            setErrorMsg(`Tệp vượt quá ${MAX_CLOUD_AUDIO_MB} MB (${(file.size / 1024 / 1024).toFixed(1)} MB). Hãy nén nhỏ dưới ${MAX_CLOUD_AUDIO_MB} MB hoặc nạp trực tiếp từ máy ST.`);
            e.target.value = '';
            return;
        }

        setSelectedFile(file);
        if (!title.trim()) {
            setTitle(file.name.replace(/\.[^/.]+$/, ''));
        }
        e.target.value = '';
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        setIsRlsError(false);
        setSuccessMsg('');

        const cleanTitle = title.trim();
        if (!cleanTitle) {
            setErrorMsg('Vui lòng nhập tên bài phát thanh!');
            return;
        }
        if (!selectedFile) {
            setErrorMsg('Vui lòng chọn tệp âm thanh (.m4a, .mp3, .wav) từ thiết bị!');
            return;
        }

        const finalStoreCodes = isAdmin && applyAllCluster ? [] : selectedStoreCodes;
        if (!(isAdmin && applyAllCluster) && finalStoreCodes.length === 0) {
            setErrorMsg('Vui lòng chọn ít nhất 1 ST áp dụng bài phát thanh này!');
            return;
        }

        setIsSaving(true);
        try {
            const audioDataUrl = await readAudioFileAsDataUrl(selectedFile);
            const res = await savePromoAudioItem(
                {
                    title: cleanTitle,
                    sourceType: 'cloud_audio',
                    audioDataUrl,
                    storeCodes: finalStoreCodes,
                    validUntil,
                    isActive: true
                },
                userName
            );
            if (res.success) {
                const scopeText =
                    finalStoreCodes.length === 0
                        ? 'Toàn Cụm'
                        : `${finalStoreCodes.length} ST (${finalStoreCodes.join(', ')})`;
                setSuccessMsg(`Đã lưu bài phát thanh dùng chung cho ${scopeText}! Các máy sẽ tự tải 1 lần và lưu offline.`);
                setTitle('');
                setSelectedFile(null);
                onRefresh();
            } else {
                setErrorMsg(
                    res.isRlsError && !isAdmin
                        ? 'Hệ thống chưa mở quyền ghi dữ liệu. Vui lòng liên hệ Quản trị viên (Admin) hỗ trợ.'
                        : res.error || 'Lỗi khi lưu file âm thanh lên Cloud'
                );
                setIsRlsError(Boolean(res.isRlsError));
            }
        } catch (err: any) {
            setErrorMsg(err?.message || 'Có lỗi xảy ra');
        } finally {
            setIsSaving(false);
        }
    };

    const canDeleteItem = (item: PromoAudioItem): boolean => {
        if (isAdmin) return true;
        if (!item.storeCodes || item.storeCodes.length === 0) return false;
        return item.storeCodes.every(code => allowedCodeSet.has(code));
    };

    const handleDelete = async (item: PromoAudioItem) => {
        if (!canDeleteItem(item)) return;
        if (!window.confirm(`Bạn có chắc muốn xóa bài "${item.title}" khỏi Cloud?`)) return;
        const res = await deletePromoAudioItem(item.id);
        if (res.success) {
            onRefresh();
        } else {
            setErrorMsg(
                res.isRlsError && !isAdmin
                    ? 'Hệ thống chưa mở quyền xóa dữ liệu. Vui lòng liên hệ Quản trị viên (Admin).'
                    : `Lỗi khi xóa: ${res.error}`
            );
            setIsRlsError(Boolean(res.isRlsError));
        }
    };

    const isAllMyStoresSelected =
        !applyAllCluster &&
        allowedStoreCodeList.length > 0 &&
        allowedStoreCodeList.every(code => selectedStoreCodes.includes(code));

    return (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5">
            <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col">
                {/* Header Modal */}
                <div className="bg-slate-900 text-white p-4 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-purple-600 flex items-center justify-center text-white font-bold">
                            <FolderPlus className="w-4 h-4" aria-hidden="true" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black">Cấu Hình Thư Viện Audio KM (Cloud)</h3>
                            <p className="text-[11px] text-slate-300">
                                {isAdmin
                                    ? 'Admin nạp & phân phối bài phát thanh cho 1, nhiều ST hoặc Toàn Cụm'
                                    : `Quản lý / Trưởng ca nạp bài phát thanh dùng chung cho các ST phụ trách (${availableStores.length} ST)`}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Đóng cấu hình audio"
                        className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
                    >
                        <X className="w-5 h-5" aria-hidden="true" />
                    </button>
                </div>

                {/* Nội dung chính */}
                <div className="p-4 overflow-y-auto space-y-4 flex-1">
                    {errorMsg && (
                        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs space-y-2">
                            <div className="flex items-start gap-1.5 font-bold">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" aria-hidden="true" />
                                <span>{errorMsg}</span>
                            </div>
                            {/* Quy chuẩn #12: Mã lệnh SQL CHỈ hiển thị với ADMIN */}
                            {isRlsError && isAdmin && (
                                <div className="bg-white border border-rose-200 rounded-xl p-2.5 space-y-2 text-[11px] text-slate-700">
                                    <p className="font-semibold text-rose-900">
                                        Chính sách RLS cũ trên bảng <code>promo_audio_library</code> đang chặn ghi dữ liệu. Hãy copy đoạn SQL bên dưới và chạy 1 lần trong <b>Supabase → SQL Editor</b>:
                                    </p>
                                    <pre className="bg-slate-900 text-emerald-300 p-2 rounded-lg text-[10px] overflow-x-auto font-mono leading-relaxed">
                                        {PROMO_AUDIO_RLS_FIX_SQL}
                                    </pre>
                                    <button
                                        type="button"
                                        onClick={handleCopyRlsSql}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer transition"
                                    >
                                        {sqlCopied ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
                                        <span>{sqlCopied ? 'Đã copy SQL sửa RLS!' : 'Copy lệnh SQL sửa RLS'}</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {successMsg && (
                        <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-1.5 font-bold">
                            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" aria-hidden="true" />
                            <span>{successMsg}</span>
                        </div>
                    )}

                    <form onSubmit={handleSave} className="space-y-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                        <div>
                            <label htmlFor="promo-audio-title" className="text-[11px] font-bold text-slate-700 block mb-1">
                                Tên bài phát thanh:
                            </label>
                            <input
                                id="promo-audio-title"
                                name="promo_audio_title"
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="Ví dụ: Phát thanh KM T11 - Cụm 290 Trương Công Định"
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-purple-500"
                            />
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-slate-700 block mb-1">
                                Chọn tệp âm thanh từ máy (≤ {MAX_CLOUD_AUDIO_MB} MB — .m4a, .mp3, .wav):
                            </label>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="audio/*,.m4a,.mp3,.wav,.ogg"
                                className="hidden"
                                onChange={handlePickAudioFile}
                            />
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full py-3 px-3 rounded-xl border-2 border-dashed border-purple-300 bg-white hover:bg-purple-50/50 text-xs font-bold text-purple-800 flex items-center justify-center gap-2 cursor-pointer transition"
                            >
                                {selectedFile ? (
                                    <>
                                        <Music className="w-4 h-4 text-purple-600 shrink-0" aria-hidden="true" />
                                        <span className="truncate">
                                            {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <UploadCloud className="w-4 h-4 text-purple-600 shrink-0" aria-hidden="true" />
                                        <span>Bấm để chọn tệp âm thanh (.m4a, .mp3)...</span>
                                    </>
                                )}
                            </button>
                            <span className="text-[10.5px] text-emerald-700 font-medium mt-1 block">
                                Chỉ tải 1 file duy nhất lên Cloud cho nhiều ST dùng chung — tiết kiệm dung lượng &amp; tự lưu offline trên máy ST.
                            </span>
                        </div>

                        {/* Chọn nhiều ST áp dụng (Multi-Select Checkbox) */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className="text-[11px] font-bold text-slate-700">
                                    Áp dụng cho ST (chọn 1 hoặc nhiều ST dùng chung):
                                </span>
                                <div className="flex items-center gap-1.5">
                                    {availableStores.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={handleSelectAllMyStores}
                                            className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md border transition cursor-pointer ${
                                                isAllMyStoresSelected
                                                    ? 'bg-purple-600 text-white border-purple-600'
                                                    : 'bg-white hover:bg-purple-50 text-purple-700 border-purple-200'
                                            }`}
                                        >
                                            Chọn cả {availableStores.length} ST
                                        </button>
                                    )}
                                    {isAdmin && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setApplyAllCluster(prev => !prev);
                                                if (!applyAllCluster) setSelectedStoreCodes([]);
                                            }}
                                            className={`inline-flex items-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-md border transition cursor-pointer ${
                                                applyAllCluster
                                                    ? 'bg-slate-900 text-white border-slate-900'
                                                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                                            }`}
                                        >
                                            <Globe className="w-3 h-3" aria-hidden="true" />
                                            <span>Toàn Cụm</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {applyAllCluster && isAdmin ? (
                                <div className="p-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center justify-between">
                                    <span className="flex items-center gap-1.5">
                                        <Globe className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                                        <span>Đang chọn: Toàn Cụm (Tất cả ST trong hệ thống)</span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setApplyAllCluster(false);
                                            if (currentStoreCode) setSelectedStoreCodes([currentStoreCode]);
                                        }}
                                        className="text-[10.5px] underline text-slate-300 hover:text-white cursor-pointer"
                                    >
                                        Chọn từng ST
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-0.5">
                                    {availableStores.map(s => {
                                        const isChecked = selectedStoreCodes.includes(s.code);
                                        return (
                                            <button
                                                key={s.code || s.id}
                                                type="button"
                                                onClick={() => toggleStoreCode(s.code)}
                                                className={`text-left px-2.5 py-2 rounded-xl border text-xs flex items-center gap-2 transition cursor-pointer ${
                                                    isChecked
                                                        ? 'bg-purple-50 border-purple-400 text-purple-950 font-bold shadow-2xs'
                                                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                                                }`}
                                            >
                                                {isChecked ? (
                                                    <CheckSquare className="w-4 h-4 text-purple-600 shrink-0" aria-hidden="true" />
                                                ) : (
                                                    <Square className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                                                )}
                                                <span className="truncate">
                                                    ST {s.code} - {s.short_name || s.name}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div>
                            <label htmlFor="promo-valid-until" className="text-[11px] font-bold text-slate-700 block mb-1">
                                Hạn áp dụng (Valid until):
                            </label>
                            <input
                                id="promo-valid-until"
                                name="promo_valid_until"
                                type="date"
                                value={validUntil}
                                onChange={e => setValidUntil(e.target.value)}
                                className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSaving}
                            className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" aria-hidden="true" />
                            <span>
                                {isSaving
                                    ? 'Đang tải lên Cloud...'
                                    : applyAllCluster && isAdmin
                                        ? 'Lưu Dùng Chung Toàn Cụm'
                                        : selectedStoreCodes.length > 1
                                            ? `Lưu Dùng Chung Cho ${selectedStoreCodes.length} ST`
                                            : 'Lưu Vào Thư Viện Cloud'}
                            </span>
                        </button>
                    </form>

                    {/* Danh sách bài hiện có */}
                    <div className="space-y-2">
                        <span className="text-xs font-black text-slate-800 uppercase tracking-wide block">
                            Danh mục bài Cloud trong phạm vi ({existingItems.length} bài)
                        </span>

                        {existingItems.length === 0 ? (
                            <p className="text-xs text-slate-400 italic text-center py-4 bg-slate-50 rounded-xl">
                                Chưa có bài phát thanh nào trên Cloud.
                            </p>
                        ) : (
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                {existingItems.map(item => {
                                    const deletable = canDeleteItem(item);
                                    return (
                                        <div
                                            key={item.id}
                                            className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-2 text-xs shadow-2xs"
                                        >
                                            <div className="truncate">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-bold text-slate-900 truncate">
                                                        {item.title}
                                                    </span>
                                                    <span className="text-[9.5px] font-bold px-1.5 py-0.2 rounded shrink-0 bg-purple-100 text-purple-800">
                                                        Cloud
                                                    </span>
                                                </div>
                                                <span className="text-[10px] text-slate-500 font-mono">
                                                    {item.storeCodes.length === 0
                                                        ? 'Toàn Cụm'
                                                        : `ST: ${item.storeCodes.join(', ')}`}{' '}
                                                    · Hạn: {item.validUntil}
                                                </span>
                                            </div>
                                            {deletable ? (
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(item)}
                                                    aria-label={`Xóa bài ${item.title}`}
                                                    className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg transition cursor-pointer shrink-0"
                                                    title="Xóa bài này khỏi Cloud"
                                                >
                                                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                                                </button>
                                            ) : (
                                                <span className="text-[10px] font-semibold text-slate-400 px-1.5 shrink-0">
                                                    Admin
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
