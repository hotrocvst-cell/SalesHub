import React from 'react';
import {
    X,
    Camera,
    Sparkles,
    RotateCcw,
    Clipboard,
    TrendingUp,
    Percent
} from 'lucide-react';

interface Props {
    pasteTarget: 'QD' | 'INSTALLMENT';
    onChangePasteTarget: (target: 'QD' | 'INSTALLMENT') => void;
    qdFiles: File[];
    installmentFiles: File[];
    isDraggingQD: boolean;
    isDraggingInstallment: boolean;
    onDragStateChange: (category: 'QD' | 'INSTALLMENT', dragging: boolean) => void;
    onDropCategory: (e: React.DragEvent, category: 'QD' | 'INSTALLMENT') => void;
    onFileInputChange: (e: React.ChangeEvent<HTMLInputElement>, category: 'QD' | 'INSTALLMENT') => void;
    onRemoveFile: (category: 'QD' | 'INSTALLMENT', index: number) => void;
    qdInputRef: React.RefObject<HTMLInputElement>;
    installmentInputRef: React.RefObject<HTMLInputElement>;
    hasModalWorkingData: boolean;
    isExtracting: boolean;
    isSavingCloud: boolean;
    progressText: string;
    progressPercent: number;
    onClearAllFiles: () => void;
    onRunOcr: () => void;
}

export default function DailyOcrUploadSection({
    pasteTarget,
    onChangePasteTarget,
    qdFiles,
    installmentFiles,
    isDraggingQD,
    isDraggingInstallment,
    onDragStateChange,
    onDropCategory,
    onFileInputChange,
    onRemoveFile,
    qdInputRef,
    installmentInputRef,
    hasModalWorkingData,
    isExtracting,
    isSavingCloud,
    progressText,
    progressPercent,
    onClearAllFiles,
    onRunOcr
}: Props) {
    const totalImages = qdFiles.length + installmentFiles.length;

    return (
        <div className="space-y-3">
            {/* Khung nạp ảnh 2 nhóm: Doanh Thu QĐ & % Tỷ Trọng Trả Góp */}
            <div className="bg-slate-50/70 border border-slate-200/90 rounded-2xl p-3.5 space-y-3">
                {/* Thanh chỉ định mục tiêu dán ảnh Ctrl + V & Nút xóa trắng */}
                <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200/80">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                            <Clipboard className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
                            <span>
                                Dán nhanh <kbd className="font-mono bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded border border-blue-200 font-bold">Ctrl + V</kbd> vào:
                            </span>
                        </span>
                        <div role="tablist" aria-label="Chọn nhóm ảnh dán nhanh" className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100 text-xs font-bold flex-wrap gap-0.5">
                            <button
                                type="button"
                                role="tab"
                                aria-selected={pasteTarget === 'QD'}
                                onClick={() => onChangePasteTarget('QD')}
                                className={`px-2.5 py-1.5 rounded-md transition cursor-pointer flex items-center gap-1 ${
                                    pasteTarget === 'QD'
                                        ? 'bg-emerald-700 text-white shadow-sm font-black'
                                        : 'text-slate-700 hover:text-slate-900'
                                }`}
                            >
                                <TrendingUp className="w-3 h-3" aria-hidden="true" />
                                <span>1. Doanh Thu QĐ ({qdFiles.length})</span>
                            </button>
                            <button
                                type="button"
                                role="tab"
                                aria-selected={pasteTarget === 'INSTALLMENT'}
                                onClick={() => onChangePasteTarget('INSTALLMENT')}
                                className={`px-2.5 py-1.5 rounded-md transition cursor-pointer flex items-center gap-1 ${
                                    pasteTarget === 'INSTALLMENT'
                                        ? 'bg-blue-700 text-white shadow-sm font-black'
                                        : 'text-slate-700 hover:text-slate-900'
                                }`}
                            >
                                <Percent className="w-3 h-3" aria-hidden="true" />
                                <span>2. % Tỷ Trọng TG ({installmentFiles.length})</span>
                            </button>
                        </div>
                    </div>

                    {hasModalWorkingData && (
                        <button
                            type="button"
                            onClick={onClearAllFiles}
                            disabled={isExtracting || isSavingCloud}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 font-bold cursor-pointer disabled:opacity-50"
                        >
                            <RotateCcw className="w-3 h-3" aria-hidden="true" />
                            <span>Xóa trắng</span>
                        </button>
                    )}
                </div>

                {/* 2 Khung con tải ảnh riêng biệt */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* KHUNG 1: DOANH THU QĐ & DT TRẢ GÓP QĐ */}
                    <div
                        onDragOver={e => { e.preventDefault(); onDragStateChange('QD', true); }}
                        onDragLeave={() => onDragStateChange('QD', false)}
                        onDrop={e => onDropCategory(e, 'QD')}
                        className={`border-2 border-dashed rounded-2xl p-3.5 flex flex-col justify-between transition-all bg-white ${
                            isDraggingQD
                                ? 'border-emerald-500 bg-emerald-50/70 scale-[0.99]'
                                : pasteTarget === 'QD'
                                    ? 'border-emerald-400 ring-2 ring-emerald-100'
                                    : 'border-slate-200'
                        }`}
                    >
                        <input
                            ref={qdInputRef}
                            type="file"
                            aria-label="Chọn ảnh bảng Doanh Thu QĐ"
                            multiple
                            accept="image/*"
                            onChange={e => onFileInputChange(e, 'QD')}
                            className="hidden"
                        />

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                                        <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-black text-emerald-950 uppercase tracking-tight">
                                            1. Doanh Thu QĐ
                                        </div>
                                        <div className="text-[10px] text-slate-600 font-medium">
                                            Ảnh Lưới: DOANH THU QĐ, DT TRẢ GÓP QĐ, SL
                                        </div>
                                    </div>
                                </div>
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 tabular-nums">
                                    {qdFiles.length} ảnh
                                </span>
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    onChangePasteTarget('QD');
                                    qdInputRef.current?.click();
                                }}
                                className="w-full py-2 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
                            >
                                <Camera className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
                                <span>Tải Ảnh Doanh Thu QĐ (+nhiều ảnh)</span>
                            </button>

                            <div className="min-h-[44px] max-h-24 overflow-y-auto pt-1">
                                {qdFiles.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-center p-1.5 text-[10.5px] text-slate-600 italic">
                                        Hỗ trợ chọn nhiều ảnh cuộn ngang/dọc (hợp nhất theo Mã NV)
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-1">
                                        {qdFiles.map((f, i) => (
                                            <span key={`${f.name}-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-md text-[10.5px] font-medium">
                                                <span className="truncate max-w-[130px]" title={f.name}>{f.name}</span>
                                                <button
                                                    type="button"
                                                    aria-label={`Xóa ảnh ${f.name}`}
                                                    onClick={() => onRemoveFile('QD', i)}
                                                    className="text-slate-600 hover:text-rose-700 cursor-pointer"
                                                >
                                                    <X className="w-3 h-3" aria-hidden="true" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* KHUNG 2: % TỶ TRỌNG TRẢ GÓP */}
                    <div
                        onDragOver={e => { e.preventDefault(); onDragStateChange('INSTALLMENT', true); }}
                        onDragLeave={() => onDragStateChange('INSTALLMENT', false)}
                        onDrop={e => onDropCategory(e, 'INSTALLMENT')}
                        className={`border-2 border-dashed rounded-2xl p-3.5 flex flex-col justify-between transition-all bg-white ${
                            isDraggingInstallment
                                ? 'border-blue-500 bg-blue-50/70 scale-[0.99]'
                                : pasteTarget === 'INSTALLMENT'
                                    ? 'border-blue-400 ring-2 ring-blue-100'
                                    : 'border-slate-200'
                        }`}
                    >
                        <input
                            ref={installmentInputRef}
                            type="file"
                            aria-label="Chọn ảnh Báo cáo trả chậm (% Tỷ trọng trả góp)"
                            multiple
                            accept="image/*"
                            onChange={e => onFileInputChange(e, 'INSTALLMENT')}
                            className="hidden"
                        />

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
                                        <Percent className="w-3.5 h-3.5" aria-hidden="true" />
                                    </div>
                                    <div>
                                        <div className="text-xs font-black text-blue-950 uppercase tracking-tight">
                                            2. % Tỷ Trọng Trả Góp
                                        </div>
                                        <div className="text-[10px] text-slate-600 font-medium">
                                            Ảnh Báo cáo trả chậm (tự khớp Mã NV theo tên)
                                        </div>
                                    </div>
                                </div>
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-900 tabular-nums">
                                    {installmentFiles.length} ảnh
                                </span>
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    onChangePasteTarget('INSTALLMENT');
                                    installmentInputRef.current?.click();
                                }}
                                className="w-full py-2 px-3 bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-900 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
                            >
                                <Camera className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
                                <span>Tải Ảnh % Tỷ Trọng TG (+nhiều ảnh)</span>
                            </button>

                            <div className="min-h-[44px] max-h-24 overflow-y-auto pt-1">
                                {installmentFiles.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-center p-1.5 text-[10.5px] text-slate-600 italic">
                                        Ảnh Báo cáo trả chậm (chỉ có tên NV, tự đối chiếu danh bạ)
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap gap-1">
                                        {installmentFiles.map((f, i) => (
                                            <span key={`${f.name}-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded-md text-[10.5px] font-medium">
                                                <span className="truncate max-w-[130px]" title={f.name}>{f.name}</span>
                                                <button
                                                    type="button"
                                                    aria-label={`Xóa ảnh ${f.name}`}
                                                    onClick={() => onRemoveFile('INSTALLMENT', i)}
                                                    className="text-slate-600 hover:text-rose-700 cursor-pointer"
                                                >
                                                    <X className="w-3 h-3" aria-hidden="true" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Thanh tiến trình HOẶC Nút xử lý OCR luôn hiển thị rõ ràng */}
            {isExtracting ? (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl space-y-2 text-center">
                    <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                        <span>{progressText}</span>
                        <span className="tabular-nums">{progressPercent}%</span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                        <div
                            className="bg-blue-700 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>
            ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-blue-50/60 border border-blue-200/90 rounded-2xl p-3">
                    <span className="text-[11px] font-medium text-slate-700">
                        {totalImages > 0
                            ? `Đã nạp ${totalImages} ảnh (${qdFiles.length} QĐ · ${installmentFiles.length} Tỷ trọng TG). Nhấn nút để trích xuất số liệu.`
                            : 'Vui lòng tải lên hoặc dán (Ctrl+V) ít nhất 1 ảnh ở trên rồi bấm xử lý OCR.'}
                    </span>

                    <button
                        type="button"
                        onClick={onRunOcr}
                        disabled={totalImages === 0 || isSavingCloud}
                        className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-sm transition shrink-0 ${
                            totalImages > 0 && !isSavingCloud
                                ? 'bg-blue-700 hover:bg-blue-800 text-white cursor-pointer'
                                : 'bg-slate-200 text-slate-600 border border-slate-300 cursor-not-allowed'
                        }`}
                    >
                        <Sparkles
                            className={`w-4 h-4 shrink-0 ${totalImages > 0 && !isSavingCloud ? 'text-amber-300' : 'text-slate-500'}`}
                            aria-hidden="true"
                        />
                        <span>
                            {totalImages > 0
                                ? `Xử Lý OCR ${totalImages} Ảnh (Gemini AI)`
                                : 'Xử Lý OCR Hình Ảnh'}
                        </span>
                    </button>
                </div>
            )}
        </div>
    );
}
