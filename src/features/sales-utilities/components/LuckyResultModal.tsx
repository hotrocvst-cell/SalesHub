import React, { useEffect } from 'react';
import { Award, X, Play } from 'lucide-react';

interface Props {
    isOpen: boolean;
    badgeLabel: string;
    titleLabel: string;
    resultText: string;
    primaryActionLabel?: string;
    onPrimaryAction?: () => void;
    onClose: () => void;
}

export default function LuckyResultModal({
    isOpen,
    badgeLabel,
    titleLabel,
    resultText,
    primaryActionLabel,
    onPrimaryAction,
    onClose
}: Props) {
    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="lucky-result-modal-title"
            className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center p-4"
            onClick={e => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className="modal-pop relative w-full max-w-md bg-white rounded-3xl border border-slate-200 p-6 shadow-2xl text-center space-y-4">
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Đóng thông báo kết quả"
                    className="absolute top-3.5 right-3.5 p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                >
                    <X className="w-4 h-4" aria-hidden="true" />
                </button>

                <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-[#0066ab] to-[#0284c7] text-white flex items-center justify-center shadow-lg">
                    <Award className="w-8 h-8" aria-hidden="true" />
                </div>

                <div className="space-y-1.5">
                    <span className="inline-block px-3 py-1 rounded-full bg-sky-50 border border-sky-200 text-[11px] font-extrabold uppercase tracking-wider text-[#0066ab]">
                        {badgeLabel}
                    </span>
                    <p id="lucky-result-modal-title" className="text-xs font-bold text-slate-600">
                        {titleLabel}
                    </p>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900 break-words leading-snug pt-1">
                        {resultText}
                    </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                    {primaryActionLabel && onPrimaryAction && (
                        <button
                            type="button"
                            onClick={onPrimaryAction}
                            className="flex-1 py-3 px-4 bg-gradient-to-r from-[#0066ab] to-[#0369a1] hover:from-[#005591] hover:to-[#0284c7] text-white rounded-xl text-sm font-black inline-flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer active:scale-[0.99]"
                        >
                            <Play className="w-4 h-4" aria-hidden="true" />
                            <span>{primaryActionLabel}</span>
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        className={`${primaryActionLabel ? '' : 'flex-1'} py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-xl text-sm font-bold transition cursor-pointer`}
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
}

