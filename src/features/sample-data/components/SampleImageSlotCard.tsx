import React, { useRef, useState } from 'react';
import {
    Upload,
    Trash2,
    Check,
    Copy,
    Download,
    ZoomIn,
    Edit3,
    ImagePlus,
    Info,
    Loader2,
    Clipboard
} from 'lucide-react';
import type { SampleDataItem, SampleImageAsset } from '../types';
import {
    compressSampleImage,
    copySampleImageToClipboard,
    downloadSampleImage
} from '../utils/sampleImageUtils';

interface SampleImageSlotCardProps {
    item: SampleDataItem;
    index: number;
    onChange: (updatedItem: SampleDataItem) => void;
    onDelete: (itemId: string) => void;
    onOpenLightbox: (images: SampleImageAsset[], activeIndex: number, slotLabel: string) => void;
}

export default function SampleImageSlotCard({
    item,
    index,
    onChange,
    onDelete,
    onOpenLightbox
}: SampleImageSlotCardProps) {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [copiedImgId, setCopiedImgId] = useState<string | null>(null);
    const [isEditingMeta, setIsEditingMeta] = useState(false);
    const [labelInput, setLabelInput] = useState(item.label);
    const [noteInput, setNoteInput] = useState(item.note || '');
    const [uploadError, setUploadError] = useState('');

    const images = item.images || [];
    const totalSizeKb = images.reduce((acc, img) => acc + (img.size_kb || 0), 0);

    const handleFilesSelected = async (fileList: FileList | File[]) => {
        const imageFiles = Array.from(fileList).filter(f => f.type.startsWith('image/'));
        if (imageFiles.length === 0) {
            setUploadError('Vui lòng chỉ chọn tệp hình ảnh (PNG, JPG, WEBP).');
            setTimeout(() => setUploadError(''), 3500);
            return;
        }

        setUploadError('');
        setIsProcessing(true);
        try {
            const compressed: SampleImageAsset[] = [];
            for (const f of imageFiles) {
                const asset = await compressSampleImage(f);
                compressed.push(asset);
            }
            onChange({
                ...item,
                images: [...images, ...compressed],
                updated_at: new Date().toISOString()
            });
        } catch (err: any) {
            setUploadError(err?.message || 'Không thể xử lý ảnh vừa tải lên.');
        } finally {
            setIsProcessing(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handlePaste = async (e: React.ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        const pastedFiles: File[] = [];
        for (let i = 0; i < items.length; i++) {
            const clip = items[i];
            if (clip.kind === 'file' && clip.type.startsWith('image/')) {
                const f = clip.getAsFile();
                if (f) {
                    const named = new File([f], `screenshot_${Date.now()}_${i + 1}.png`, { type: f.type });
                    pastedFiles.push(named);
                }
            }
        }
        if (pastedFiles.length > 0) {
            e.preventDefault();
            await handleFilesSelected(pastedFiles);
        }
    };

    const handleRemoveImage = (imgId: string) => {
        onChange({
            ...item,
            images: images.filter(img => img.id !== imgId),
            updated_at: new Date().toISOString()
        });
    };

    const handleCaptionChange = (imgId: string, caption: string) => {
        onChange({
            ...item,
            images: images.map(img => (img.id === imgId ? { ...img, caption } : img)),
            updated_at: new Date().toISOString()
        });
    };

    const handleCopyImage = async (img: SampleImageAsset) => {
        const ok = await copySampleImageToClipboard(img.data_url);
        if (ok) {
            setCopiedImgId(img.id);
            setTimeout(() => setCopiedImgId(prev => (prev === img.id ? null : prev)), 2000);
        } else {
            alert('Trình duyệt hiện không hỗ trợ copy trực tiếp ảnh. Vui lòng bấm nút Tải về.');
        }
    };

    const handleSaveMeta = () => {
        onChange({
            ...item,
            label: labelInput.trim() || item.label,
            note: noteInput.trim(),
            updated_at: new Date().toISOString()
        });
        setIsEditingMeta(false);
    };

    return (
        <div
            onPaste={handlePaste}
            tabIndex={0}
            className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200/90 shadow-2xs space-y-3 focus:outline-hidden focus:ring-2 focus:ring-blue-500/40 transition-all"
        >
            {/* Header ô ảnh mẫu */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-800 border border-blue-200 text-xs font-black flex items-center justify-center shrink-0 tabular-nums mt-0.5">
                        {index + 1}
                    </span>

                    <div className="min-w-0 flex-1 space-y-1">
                        {isEditingMeta ? (
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                                <input
                                    type="text"
                                    value={labelInput}
                                    onChange={e => setLabelInput(e.target.value)}
                                    className="px-2.5 py-1 text-xs font-bold bg-white border border-blue-400 rounded-lg focus:outline-hidden flex-1"
                                    placeholder="Tên ô ảnh mẫu..."
                                />
                                <input
                                    type="text"
                                    value={noteInput}
                                    onChange={e => setNoteInput(e.target.value)}
                                    className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg focus:outline-hidden text-slate-600 flex-1"
                                    placeholder="Hướng dẫn chụp ảnh chuẩn..."
                                />
                                <button
                                    type="button"
                                    onClick={handleSaveMeta}
                                    className="px-3 py-1 text-xs font-bold bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 shrink-0"
                                >
                                    Lưu
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <h4 className="font-black text-xs sm:text-sm text-slate-900 leading-snug">
                                        {item.label}
                                    </h4>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setLabelInput(item.label);
                                            setNoteInput(item.note || '');
                                            setIsEditingMeta(true);
                                        }}
                                        aria-label="Đổi tên và ghi chú ô ảnh mẫu"
                                        className="p-1 rounded-md text-slate-400 hover:text-blue-700 hover:bg-blue-50 cursor-pointer transition"
                                        title="Đổi tên hoặc hướng dẫn chụp ảnh"
                                    >
                                        <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                                    </button>
                                </div>
                                {item.note && (
                                    <p className="text-[11px] text-slate-600 flex items-start gap-1 leading-relaxed">
                                        <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
                                        <span>{item.note}</span>
                                    </p>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Nút thao tác tải ảnh / xóa ô */}
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-start">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={e => {
                            if (e.target.files) handleFilesSelected(e.target.files);
                        }}
                    />

                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isProcessing}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer transition shadow-2xs disabled:opacity-50"
                    >
                        {isProcessing ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                            <ImagePlus className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                        <span>{isProcessing ? 'Đang nén...' : 'Tải ảnh lên'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => onDelete(item.id)}
                        aria-label={`Xóa ô mẫu ${item.label}`}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition"
                        title="Xóa hẳn ô ảnh mẫu này"
                    >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                </div>
            </div>

            {uploadError && (
                <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                    {uploadError}
                </div>
            )}

            {/* Vùng kéo thả / dán ảnh Ctrl+V */}
            <div
                onDragOver={e => {
                    e.preventDefault();
                    setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files?.length) {
                        handleFilesSelected(e.dataTransfer.files);
                    }
                }}
                onClick={() => {
                    if (images.length === 0) fileInputRef.current?.click();
                }}
                className={`rounded-xl border-2 border-dashed transition-all ${
                    isDragging
                        ? 'border-blue-500 bg-blue-50/70'
                        : images.length === 0
                            ? 'border-slate-300 bg-slate-50/80 hover:border-blue-400 hover:bg-blue-50/30 cursor-pointer'
                            : 'border-slate-200 bg-slate-50/50'
                } p-3`}
            >
                {images.length === 0 ? (
                    <div className="py-5 text-center space-y-1.5">
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-blue-600 flex items-center justify-center mx-auto shadow-2xs">
                            <Upload className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <p className="text-xs font-bold text-slate-700">
                            Chưa có hình ảnh mẫu — Bấm để chọn ảnh, kéo thả hoặc bấm vào khung rồi <kbd className="font-mono px-1.5 py-0.5 rounded bg-white border border-slate-300 text-[10.5px]">Ctrl + V</kbd>
                        </p>
                        <p className="text-[11px] text-slate-500">
                            Hỗ trợ nhiều ảnh chụp màn hình BI (tự động nén gọn ~150KB/ảnh và đồng bộ Cloud).
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                            {images.map((img, imgIdx) => (
                                <div
                                    key={img.id}
                                    className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs flex flex-col group"
                                >
                                    {/* Khung ảnh xem trước */}
                                    <div
                                        onClick={() => onOpenLightbox(images, imgIdx, item.label)}
                                        className="relative aspect-[4/3] bg-slate-100 cursor-zoom-in overflow-hidden"
                                        title="Bấm để xem phóng to ảnh mẫu"
                                    >
                                        <img
                                            src={img.data_url}
                                            alt={img.caption || img.file_name}
                                            loading="lazy"
                                            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                                        />
                                        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-slate-900/75 text-white text-[10px] font-bold tabular-nums">
                                            #{imgIdx + 1}
                                        </span>
                                        {img.size_kb && (
                                            <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-slate-900/75 text-white text-[10px] font-semibold tabular-nums">
                                                {img.size_kb} KB
                                            </span>
                                        )}
                                        <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/20 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                                            <span className="p-1.5 rounded-full bg-white/95 text-slate-800 shadow-sm">
                                                <ZoomIn className="w-4 h-4" aria-hidden="true" />
                                            </span>
                                        </div>
                                    </div>

                                    {/* Ghi chú ngắn + thanh công cụ ảnh */}
                                    <div className="p-2 space-y-1.5 flex-1 flex flex-col justify-between">
                                        <input
                                            type="text"
                                            value={img.caption || ''}
                                            onChange={e => handleCaptionChange(img.id, e.target.value)}
                                            placeholder="Ghi chú ảnh mẫu..."
                                            className="w-full px-2 py-1 text-[11px] bg-slate-50 border border-slate-200 rounded-md text-slate-700 focus:bg-white focus:outline-hidden focus:border-blue-400"
                                        />

                                        <div className="flex items-center justify-between gap-1 pt-0.5">
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyImage(img)}
                                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10.5px] font-bold cursor-pointer transition ${
                                                        copiedImgId === img.id
                                                            ? 'bg-emerald-600 text-white'
                                                            : 'bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700'
                                                    }`}
                                                    title="Copy ảnh để dán Ctrl+V vào công cụ OCR"
                                                >
                                                    {copiedImgId === img.id ? (
                                                        <Check className="w-3 h-3" aria-hidden="true" />
                                                    ) : (
                                                        <Copy className="w-3 h-3" aria-hidden="true" />
                                                    )}
                                                    <span>{copiedImgId === img.id ? 'Đã copy' : 'Copy'}</span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => downloadSampleImage(img, item.label)}
                                                    aria-label={`Tải về ảnh ${img.file_name}`}
                                                    className="p-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer transition"
                                                    title="Tải ảnh mẫu về máy"
                                                >
                                                    <Download className="w-3 h-3" aria-hidden="true" />
                                                </button>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleRemoveImage(img.id)}
                                                aria-label={`Xóa ảnh ${img.file_name}`}
                                                className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition"
                                                title="Xóa ảnh mẫu này"
                                            >
                                                <Trash2 className="w-3 h-3" aria-hidden="true" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 flex-wrap gap-2">
                            <span className="inline-flex items-center gap-1">
                                <Clipboard className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
                                <span>Kéo thả thêm ảnh hoặc bấm vào ô này rồi nhấn <kbd className="font-mono px-1 py-0.5 rounded bg-white border border-slate-300 text-[10px]">Ctrl + V</kbd> để dán nhanh.</span>
                            </span>
                            <span className="font-bold text-slate-700 tabular-nums">
                                {images.length} ảnh • {totalSizeKb.toLocaleString('vi-VN')} KB
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
