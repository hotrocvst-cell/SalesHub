import React, { useRef } from 'react';
import {
    UploadCloud,
    FileImage,
    Sparkles,
    Trash2,
    CheckCircle2,
    Layers,
    Key,
    Plus,
    X,
    Cpu
} from 'lucide-react';
import type { OcrEngineType } from '../types/ocrTypes';

interface Props {
    qdFile: File | null;
    onQdFileChange: (file: File | null) => void;
    realFile: File | null;
    onRealFileChange: (file: File | null) => void;
    emulationFiles: File[];
    onEmulationFilesChange: (files: File[]) => void;
    engineType: OcrEngineType;
    onEngineTypeChange: (engine: OcrEngineType) => void;
    hasGeminiKey: boolean;
    keySource?: 'USER' | 'ADMIN' | 'NONE';
    isQuotaExceeded?: boolean;
    onOpenKeyModal: () => void;
    onRunOcr: () => void;
    isExtracting: boolean;
    progressText: string;
    progressPercent: number;
}

export default function OcrUploadZone({
    qdFile,
    onQdFileChange,
    realFile,
    onRealFileChange,
    emulationFiles,
    onEmulationFilesChange,
    engineType,
    onEngineTypeChange,
    hasGeminiKey,
    keySource = 'NONE',
    isQuotaExceeded = false,
    onOpenKeyModal,
    onRunOcr,
    isExtracting,
    progressText,
    progressPercent
}: Props) {
    const qdInputRef = useRef<HTMLInputElement>(null);
    const realInputRef = useRef<HTMLInputElement>(null);
    const emuInputRef = useRef<HTMLInputElement>(null);

    const handleAddEmulationFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const newFiles = Array.from(e.target.files);
        onEmulationFilesChange([...emulationFiles, ...newFiles]);
        if (emuInputRef.current) emuInputRef.current.value = '';
    };

    const handleRemoveEmulationFile = (index: number) => {
        const next = emulationFiles.filter((_, idx) => idx !== index);
        onEmulationFilesChange(next);
    };

    const canExtract = Boolean(qdFile || realFile || emulationFiles.length > 0);

    return (
        <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4 font-avo">
            {/* Header và Động cơ */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 uppercase tracking-wide">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        <span>Nạp Ảnh Chụp Màn Hình Báo Cáo BI Để Trích Xuất Dữ Liệu</span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                        Hệ thống tự động lọc bỏ hình mờ (watermark), thanh điều hướng, chỉ trích xuất số liệu các siêu thị thực tế
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Nút cài đặt API Key */}
                    <button
                        type="button"
                        onClick={onOpenKeyModal}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer border shadow-2xs ${
                            isQuotaExceeded
                                ? 'bg-rose-50 text-rose-900 border-rose-300 hover:bg-rose-100 animate-pulse'
                                : keySource === 'USER'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                : keySource === 'ADMIN'
                                ? 'bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100'
                                : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 animate-pulse'
                        }`}
                        title="Quản lý Google Gemini API Key"
                    >
                        <Key className="w-3.5 h-3.5 shrink-0" />
                        <span>
                            {isQuotaExceeded
                                ? '⚠️ Key hết lượt - Nhập key Google'
                                : keySource === 'USER'
                                ? '👤 Key Cá Nhân (Ưu tiên)'
                                : keySource === 'ADMIN'
                                ? '🛡️ Key Hệ Thống (Admin)'
                                : '🟡 Cần Cài Gemini API Key'}
                        </span>
                    </button>
                </div>
            </div>

            {/* 3 KHỐI TIẾP NHẬN ẢNH */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 1. KHỐI DOANH THU QUY ĐỔI (DT-QĐ) */}
                <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3.5 flex flex-col justify-between space-y-3">
                    <div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-blue-900 uppercase tracking-wide flex items-center gap-1.5">
                                <FileImage className="w-3.5 h-3.5 text-blue-600" />
                                <span>1. Ảnh Doanh Thu QĐ</span>
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                                1 file
                            </span>
                        </div>
                        <p className="text-[10.5px] text-slate-500 mt-1">
                            Ảnh màn hình "Doanh thu hợp nhất" sắp xếp <strong>DOANH THU QĐ</strong>
                        </p>
                    </div>

                    <input
                        ref={qdInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => onQdFileChange(e.target.files?.[0] || null)}
                    />

                    {qdFile ? (
                        <div className="bg-white border border-blue-200 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-2xs">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                                    <CheckCircle2 className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-800 truncate" title={qdFile.name}>
                                        {qdFile.name}
                                    </p>
                                    <p className="text-[10px] text-slate-400">
                                        {(qdFile.size / 1024).toFixed(1)} KB
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => onQdFileChange(null)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                                title="Xóa ảnh này"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => qdInputRef.current?.click()}
                            className="w-full py-4 px-3 border-2 border-dashed border-blue-200 hover:border-blue-400 hover:bg-blue-50/40 rounded-xl text-center cursor-pointer transition flex flex-col items-center justify-center gap-1 text-blue-700"
                        >
                            <UploadCloud className="w-5 h-5 text-blue-500" />
                            <span className="text-xs font-black">Chọn ảnh DT-QĐ</span>
                            <span className="text-[10px] text-slate-400">Chụp hoặc tải ảnh màn hình</span>
                        </button>
                    )}
                </div>

                {/* 2. KHỐI DOANH THU THỰC (DT-THỰC) */}
                <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3.5 flex flex-col justify-between space-y-3">
                    <div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-emerald-900 uppercase tracking-wide flex items-center gap-1.5">
                                <FileImage className="w-3.5 h-3.5 text-emerald-600" />
                                <span>2. Ảnh Doanh Thu Thực</span>
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800">
                                1 file
                            </span>
                        </div>
                        <p className="text-[10.5px] text-slate-500 mt-1">
                            Ảnh màn hình "Doanh thu hợp nhất" sắp xếp <strong>DOANH THU</strong>
                        </p>
                    </div>

                    <input
                        ref={realInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => onRealFileChange(e.target.files?.[0] || null)}
                    />

                    {realFile ? (
                        <div className="bg-white border border-emerald-200 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-2xs">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                    <CheckCircle2 className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-800 truncate" title={realFile.name}>
                                        {realFile.name}
                                    </p>
                                    <p className="text-[10px] text-slate-400">
                                        {(realFile.size / 1024).toFixed(1)} KB
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => onRealFileChange(null)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                                title="Xóa ảnh này"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => realInputRef.current?.click()}
                            className="w-full py-4 px-3 border-2 border-dashed border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/40 rounded-xl text-center cursor-pointer transition flex flex-col items-center justify-center gap-1 text-emerald-700"
                        >
                            <UploadCloud className="w-5 h-5 text-emerald-500" />
                            <span className="text-xs font-black">Chọn ảnh DT Thực</span>
                            <span className="text-[10px] text-slate-400">Lấy DT thực &amp; Trả góp</span>
                        </button>
                    )}
                </div>

                {/* 3. KHỐI THI ĐUA LŨY KẾ (NHIỀU ẢNH BATCH) */}
                <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3.5 flex flex-col justify-between space-y-3">
                    <div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-purple-900 uppercase tracking-wide flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-purple-600" />
                                <span>3. Bộ Ảnh Thi Đua Lũy Kế</span>
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 font-mono">
                                {emulationFiles.length} ảnh
                            </span>
                        </div>
                        <p className="text-[10.5px] text-slate-500 mt-1">
                            Hỗ trợ nạp <strong>nhiều ảnh cùng lúc</strong> (20-30 chương trình thi đua)
                        </p>
                        {emulationFiles.length >= 4 && (
                            <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md font-bold block mt-1">
                                ⚡ Tự động chia thành các đợt 3 ảnh để quét tuần tự an toàn &amp; không timeout
                            </span>
                        )}
                    </div>

                    <input
                        ref={emuInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleAddEmulationFiles}
                    />

                    <div className="space-y-1.5">
                        {emulationFiles.length > 0 && (
                            <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                                {emulationFiles.map((file, idx) => (
                                    <div
                                        key={idx}
                                        className="bg-white border border-purple-200 rounded-lg px-2 py-1 flex items-center justify-between gap-1 text-[11px] shadow-2xs"
                                    >
                                        <span className="truncate text-slate-800 font-medium" title={file.name}>
                                            #{idx + 1}. {file.name}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveEmulationFile(idx)}
                                            className="text-slate-400 hover:text-rose-600 transition cursor-pointer p-0.5"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={() => emuInputRef.current?.click()}
                            className="w-full py-2.5 px-3 border-2 border-dashed border-purple-200 hover:border-purple-400 hover:bg-purple-50/40 rounded-xl text-center cursor-pointer transition flex items-center justify-center gap-1.5 text-purple-700 text-xs font-black"
                        >
                            <Plus className="w-4 h-4 text-purple-600" />
                            <span>{emulationFiles.length > 0 ? '+ Thêm ảnh thi đua khác...' : 'Nạp bộ ảnh thi đua (chọn nhiều)'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* THANH TIẾN TRÌNH & NÚT TRÍCH XUẤT OCR */}
            {isExtracting ? (
                <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between text-xs">
                        <span className="font-black text-purple-900 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-purple-600 animate-spin" />
                            <span>{progressText || 'Đang phân tích số liệu hình ảnh...'}</span>
                        </span>
                        <span className="font-mono font-bold text-purple-800">{progressPercent}%</span>
                    </div>
                    <div className="w-full bg-purple-200 rounded-full h-2 overflow-hidden">
                        <div
                            className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>
            ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                    <div className="text-[11px] text-slate-500">
                        {canExtract
                            ? '✨ Sẵn sàng trích xuất. Nhấn nút để AI quét số liệu và hợp nhất theo từng cá nhân / siêu thị.'
                            : '💡 Mẹo: Ảnh ghép/cuộn chứa cả 2 bảng DT-QĐ và DT-THỰC chỉ cần nạp vào 1 trong 2 ô, AI sẽ tự động phân tích cả 2.'}
                    </div>

                    <button
                        type="button"
                        onClick={onRunOcr}
                        disabled={!canExtract || isExtracting}
                        className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-black transition cursor-pointer shadow-md flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
                    >
                        <Sparkles className="w-4 h-4" />
                        <span>⚡ Bắt Đầu Trích Xuất Dữ Liệu (OCR)</span>
                    </button>
                </div>
            )}
        </div>
    );
}

