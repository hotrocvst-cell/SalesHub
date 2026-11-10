import React from 'react';
import { X, Download, Image as ImageIcon } from 'lucide-react';
import type { ChatAttachmentImage } from '../types/aiAssistantTypes';

interface Props {
    image: ChatAttachmentImage | null;
    onClose: () => void;
}

export default function ImageLightboxModal({ image, onClose }: Props) {
    if (!image) return null;

    const handleDownload = async () => {
        try {
            const res = await fetch(image.signedUrl);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${(image.documentTitle || 'tai-lieu').replace(/\s+/g, '_')}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {
            window.open(image.signedUrl, '_blank', 'noopener,noreferrer');
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xs flex flex-col items-center justify-center p-2 sm:p-4 animate-in fade-in"
            onClick={onClose}
        >
            {/* Header công cụ */}
            <div
                className="w-full max-w-4xl flex items-center justify-between gap-2 text-white mb-2 px-1"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-2 min-w-0">
                    <ImageIcon className="w-4 h-4 text-blue-400 shrink-0" />
                    <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-bold truncate">{image.documentTitle}</div>
                        <div className="text-[11px] text-slate-300 truncate">{image.caption}</div>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={handleDownload}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                    >
                        <Download className="w-3.5 h-3.5" />
                        <span>Tải ảnh gốc</span>
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                        title="Đóng xem ảnh"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Khung ảnh phóng to */}
            <div
                className="max-w-4xl w-full max-h-[82vh] flex items-center justify-center overflow-auto rounded-2xl bg-slate-900/60 border border-slate-800 p-2"
                onClick={(e) => e.stopPropagation()}
            >
                <img
                    src={image.signedUrl}
                    alt={image.caption}
                    className="max-w-full max-h-[78vh] object-contain rounded-xl shadow-2xl"
                />
            </div>
        </div>
    );
}

