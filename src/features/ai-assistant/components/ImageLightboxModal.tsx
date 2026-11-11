import React, { useEffect, useState } from 'react';
import { X, Download, Image as ImageIcon, ExternalLink, AlertTriangle } from 'lucide-react';
import type { ChatAttachmentImage } from '../types/aiAssistantTypes';

interface Props {
    image: ChatAttachmentImage | null;
    onClose: () => void;
}

export default function ImageLightboxModal({ image, onClose }: Props) {
    const [imgError, setImgError] = useState(false);

    useEffect(() => {
        setImgError(false);
    }, [image?.signedUrl]);

    useEffect(() => {
        if (!image) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [image, onClose]);

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
            role="dialog"
            aria-modal="true"
            aria-labelledby="lightbox-image-title"
            className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex flex-col items-center justify-center p-2 sm:p-4"
            onClick={onClose}
        >
            {/* Header công cụ */}
            <div
                className="w-full max-w-4xl flex items-center justify-between gap-2 text-white mb-2 px-1"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-2 min-w-0">
                    <ImageIcon className="w-4 h-4 text-blue-400 shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                        <h2 id="lightbox-image-title" className="text-xs sm:text-sm font-bold truncate">{image.documentTitle}</h2>
                        <div className="text-[11px] text-slate-300 truncate">{image.caption}</div>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={handleDownload}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    >
                        <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>Tải ảnh gốc</span>
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Đóng xem ảnh"
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        title="Đóng xem ảnh"
                    >
                        <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                </div>
            </div>

            {/* Khung ảnh phóng to */}
            <div
                className="max-w-4xl w-full max-h-[82vh] flex items-center justify-center overflow-auto rounded-2xl bg-slate-900/60 border border-slate-800 p-2"
                onClick={(e) => e.stopPropagation()}
            >
                {imgError ? (
                    <div className="py-12 px-4 text-center space-y-3 text-slate-200">
                        <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" aria-hidden="true" />
                        <p className="text-xs font-semibold">Không thể tải trực tiếp ảnh gốc (liên kết có thể đã hết hạn).</p>
                        <a
                            href={image.signedUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white border border-slate-700"
                        >
                            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Mở ảnh ở tab mới</span>
                        </a>
                    </div>
                ) : (
                    <img
                        src={image.signedUrl}
                        alt={image.caption || image.documentTitle}
                        onError={() => setImgError(true)}
                        className="max-w-full max-h-[78vh] object-contain rounded-xl shadow-2xl"
                    />
                )}
            </div>
        </div>
    );
}

