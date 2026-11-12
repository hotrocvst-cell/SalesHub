import React, { useRef } from 'react';
import { UploadCloud, FileImage, Trash2, CheckCircle2, Plus, X } from 'lucide-react';

export interface ImageSlotCardProps {
    title: string;
    description?: string;
    theme: 'blue' | 'emerald' | 'teal';
    files: File[];
    isMulti: boolean;
    emptyTitle: string;
    emptySubtitle: string;
    addMoreLabel: string;
    addInitialLabel: string;
    onAddFiles: (newFiles: File[]) => void;
    onRemoveFile: (index: number) => void;
    onClearAll: () => void;
}

const THEME_STYLES = {
    blue: {
        title: 'text-blue-900',
        icon: 'text-blue-600',
        badgeActive: 'bg-blue-600 text-white',
        badgeIdle: 'bg-blue-100 text-blue-800',
        hintBox: 'text-blue-900 bg-blue-50/80 border-blue-200',
        fileBorder: 'border-blue-200',
        singleIconBox: 'bg-blue-100 text-blue-700',
        dropButton: 'border-blue-200 hover:border-blue-400 hover:bg-blue-50/40 text-blue-800',
        dropIcon: 'text-blue-600'
    },
    emerald: {
        title: 'text-emerald-900',
        icon: 'text-emerald-600',
        badgeActive: 'bg-emerald-700 text-white',
        badgeIdle: 'bg-emerald-100 text-emerald-800',
        hintBox: 'text-emerald-900 bg-emerald-50/80 border-emerald-200',
        fileBorder: 'border-emerald-200',
        singleIconBox: 'bg-emerald-100 text-emerald-700',
        dropButton: 'border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/40 text-emerald-800',
        dropIcon: 'text-emerald-600'
    },
    teal: {
        title: 'text-teal-900',
        icon: 'text-teal-700',
        badgeActive: 'bg-teal-700 text-white',
        badgeIdle: 'bg-teal-100 text-teal-900',
        hintBox: 'text-teal-950 bg-teal-50/80 border-teal-200',
        fileBorder: 'border-teal-200',
        singleIconBox: 'bg-teal-100 text-teal-800',
        dropButton: 'border-teal-200 hover:border-teal-500 hover:bg-teal-50/50 text-teal-900',
        dropIcon: 'text-teal-700'
    }
};

/**
 * Thẻ tiếp nhận ảnh chụp BI cho 1 nhóm dữ liệu (hỗ trợ 1 hoặc nhiều ảnh cuộn màn hình)
 */
export default function ImageSlotCard({
    title,
    description,
    theme,
    files,
    isMulti,
    emptyTitle,
    emptySubtitle,
    addMoreLabel,
    addInitialLabel,
    onAddFiles,
    onRemoveFile,
    onClearAll
}: ImageSlotCardProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const styles = THEME_STYLES[theme];

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const added = Array.from(e.target.files);
        if (added.length > 0) {
            onAddFiles(added);
        }
        if (inputRef.current) inputRef.current.value = '';
    };

    const singleFile = files[0] || null;

    return (
        <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3.5 flex flex-col justify-between space-y-3">
            <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-black uppercase tracking-wide flex items-center gap-1.5 ${styles.title}`}>
                        <FileImage className={`w-3.5 h-3.5 shrink-0 ${styles.icon}`} aria-hidden="true" />
                        <span>{title}</span>
                    </span>
                    <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono tabular-nums shrink-0 ${
                            files.length > 0 ? styles.badgeActive : styles.badgeIdle
                        }`}
                    >
                        {isMulti ? `${files.length} ảnh` : (singleFile ? '1 file' : '0 file')}
                    </span>
                </div>

                {description && (
                    <p className={`text-[10.5px] border px-2 py-1 rounded-lg font-medium leading-relaxed ${styles.hintBox}`}>
                        {description}
                    </p>
                )}
            </div>

            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                multiple={isMulti}
                className="hidden"
                onChange={handleChange}
            />

            {isMulti ? (
                <div className="space-y-1.5">
                    {files.length > 0 && (
                        <div className="space-y-1">
                            <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                                {files.map((file, idx) => (
                                    <div
                                        key={`${file.name}-${idx}`}
                                        className={`bg-white border ${styles.fileBorder} rounded-lg px-2 py-1 flex items-center justify-between gap-1 text-[11px] shadow-2xs`}
                                    >
                                        <span className="truncate text-slate-800 font-medium" title={file.name}>
                                            #{idx + 1}. {file.name}
                                        </span>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <span className="text-[10px] text-slate-500 font-mono tabular-nums">
                                                {(file.size / 1024).toFixed(0)} KB
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => onRemoveFile(idx)}
                                                aria-label={`Xóa ảnh ${file.name}`}
                                                className="text-slate-500 hover:text-rose-700 transition cursor-pointer p-0.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                                                title="Xóa ảnh này"
                                            >
                                                <X className="w-3 h-3" aria-hidden="true" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {files.length > 1 && (
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={onClearAll}
                                        className="text-[10px] text-rose-700 hover:text-rose-900 font-bold transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded px-1"
                                    >
                                        Xóa tất cả ({files.length} ảnh)
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        className={`w-full py-2.5 px-3 border-2 border-dashed rounded-xl text-center cursor-pointer transition flex items-center justify-center gap-1.5 text-xs font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${styles.dropButton}`}
                    >
                        <Plus className={`w-4 h-4 shrink-0 ${styles.dropIcon}`} aria-hidden="true" />
                        <span>{files.length > 0 ? addMoreLabel : addInitialLabel}</span>
                    </button>
                </div>
            ) : singleFile ? (
                <div className={`bg-white border ${styles.fileBorder} rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-2xs`}>
                    <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${styles.singleIconBox}`}>
                            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate" title={singleFile.name}>
                                {singleFile.name}
                            </p>
                            <p className="text-[10px] text-slate-500 tabular-nums">
                                {(singleFile.size / 1024).toFixed(1)} KB
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => onRemoveFile(0)}
                        aria-label={`Xóa ảnh ${singleFile.name}`}
                        className="p-1 text-slate-500 hover:text-rose-700 rounded-lg hover:bg-rose-50 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                        title="Xóa ảnh này"
                    >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className={`w-full py-4 px-3 border-2 border-dashed rounded-xl text-center cursor-pointer transition flex flex-col items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${styles.dropButton}`}
                >
                    <UploadCloud className={`w-5 h-5 ${styles.dropIcon}`} aria-hidden="true" />
                    <span className="text-xs font-black">{emptyTitle}</span>
                    <span className="text-[10px] text-slate-600">{emptySubtitle}</span>
                </button>
            )}
        </div>
    );
}

