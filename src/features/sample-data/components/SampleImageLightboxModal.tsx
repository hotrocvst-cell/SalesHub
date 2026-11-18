import React, { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Download, Copy, Check } from 'lucide-react';
import type { SampleImageAsset } from '../types';
import { copySampleImageToClipboard, downloadSampleImage } from '../utils/sampleImageUtils';

interface SampleImageLightboxModalProps {
    images: SampleImageAsset[];
    activeIndex: number;
    slotLabel: string;
    onClose: () => void;
    onChangeIndex: (nextIndex: number) => void;
}

export default function SampleImageLightboxModal({
    images,
    activeIndex,
    slotLabel,
    onClose,
    onChangeIndex
}: SampleImageLightboxModalProps) {
    const [copied, setCopied] = useState(false);

    const activeImage = images[activeIndex];
    const hasPrev = activeIndex > 0;
    const hasNext = activeIndex < images.length - 1;

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft' && hasPrev) onChangeIndex(activeIndex - 1);
            if (e.key === 'ArrowRight' && hasNext) onChangeIndex(activeIndex + 1);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [activeIndex, hasPrev, hasNext, onClose, onChangeIndex]);

    if (!activeImage) return null;

    const handleCopy = async () => {
        const ok = await copySampleImageToClipboard(activeImage.data_url);
        if (ok) {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } else {
            alert('Trình duyệt không hỗ trợ copy trực tiếp ảnh vào Clipboard. Hãy dùng nút Tải về.');
        }
    };

    return (
        <div
            onClick={onClose}
            className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex flex-col p-3 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label={`Xem phóng to ảnh mẫu ${slotLabel}`}
        >
            {/* Thanh công cụ trên cùng */}
            <div
                onClick={e => e.stopPropagation()}
                className="flex items-center justify-between gap-3 text-white pb-3 border-b border-white/15 shrink-0"
            >
                <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-black truncate">{slotLabel}</div>
                    <div className="text-[11px] text-slate-300 flex items-center gap-2 flex-wrap tabular-nums">
                        <span className="truncate max-w-[220px] sm:max-w-md">{activeImage.file_name}</span>
                        {activeImage.width && activeImage.height && (
                            <span>{activeImage.width} × {activeImage.height}px</span>
                        )}
                        {activeImage.size_kb && <span>{activeImage.size_kb} KB</span>}
                        <span className="font-bold text-blue-300">
                            {activeIndex + 1} / {images.length}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    <button
                        type="button"
                        onClick={handleCopy}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/15 cursor-pointer transition"
                    >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
                        <span className="hidden sm:inline">{copied ? 'Đã copy ảnh' : 'Copy ảnh'}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => downloadSampleImage(activeImage, slotLabel)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white cursor-pointer transition"
                    >
                        <Download className="w-3.5 h-3.5" aria-hidden="true" />
                        <span className="hidden sm:inline">Tải về</span>
                    </button>

                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Đóng xem phóng to"
                        className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer transition"
                    >
                        <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                </div>
            </div>

            {/* Khung hiển thị ảnh chính */}
            <div
                onClick={e => e.stopPropagation()}
                className="relative flex-1 min-h-0 flex items-center justify-center py-4"
            >
                {hasPrev && (
                    <button
                        type="button"
                        onClick={() => onChangeIndex(activeIndex - 1)}
                        aria-label="Ảnh trước"
                        className="absolute left-1 sm:left-3 z-10 p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-white/20 cursor-pointer transition shadow-lg"
                    >
                        <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                    </button>
                )}

                <img
                    src={activeImage.data_url}
                    alt={activeImage.caption || activeImage.file_name}
                    className="max-h-full max-w-full object-contain rounded-xl shadow-2xl border border-white/10 bg-white"
                />

                {hasNext && (
                    <button
                        type="button"
                        onClick={() => onChangeIndex(activeIndex + 1)}
                        aria-label="Ảnh tiếp theo"
                        className="absolute right-1 sm:right-3 z-10 p-2.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-white/20 cursor-pointer transition shadow-lg"
                    >
                        <ChevronRight className="w-5 h-5" aria-hidden="true" />
                    </button>
                )}
            </div>

            {activeImage.caption && (
                <div
                    onClick={e => e.stopPropagation()}
                    className="text-center text-xs text-slate-200 bg-white/10 border border-white/15 rounded-xl px-3 py-2 max-w-2xl mx-auto shrink-0"
                >
                    {activeImage.caption}
                </div>
            )}
        </div>
    );
}
