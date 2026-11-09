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
    Cpu,
    Store
} from 'lucide-react';
import type { OcrEngineType, EmulationUploadMode, SingleStoreEmulationEntry } from '../types/ocrTypes';
import type { StoreItem } from '../../../core/lib/storage';
import { formatStoreDisplayName } from '../../../core/lib/formatters';

interface Props {
    mode?: 'STORE' | 'EMPLOYEE';
    qdFile?: File | null;
    qdFiles?: File[];
    onQdFileChange?: (file: File | null) => void;
    onQdFilesChange?: (files: File[]) => void;
    realFile?: File | null;
    realFiles?: File[];
    onRealFileChange?: (file: File | null) => void;
    onRealFilesChange?: (files: File[]) => void;
    emulationFiles: File[];
    onEmulationFilesChange: (files: File[]) => void;
    engineType?: OcrEngineType;
    onEngineTypeChange?: (engine: OcrEngineType) => void;
    hasGeminiKey: boolean;
    keySource?: 'USER' | 'ADMIN' | 'NONE';
    isQuotaExceeded?: boolean;
    onOpenKeyModal: () => void;
    onRunOcr: () => void;
    isExtracting: boolean;
    progressText: string;
    progressPercent: number;

    // Switch chế độ nạp thi đua: 'CLUSTER' (Cả cụm) | 'SINGLE_STORE' (Đích danh từng ST)
    emulationMode?: EmulationUploadMode;
    onEmulationModeChange?: (mode: EmulationUploadMode) => void;
    selectableStores?: StoreItem[];
    singleStoreEmulations?: SingleStoreEmulationEntry[];
    onSingleStoreEmulationsChange?: (entries: SingleStoreEmulationEntry[]) => void;
}

export default function OcrUploadZone({
    mode = 'STORE',
    qdFile,
    qdFiles,
    onQdFileChange,
    onQdFilesChange,
    realFile,
    realFiles,
    onRealFileChange,
    onRealFilesChange,
    emulationFiles,
    onEmulationFilesChange,
    hasGeminiKey,
    keySource = 'NONE',
    isQuotaExceeded = false,
    onOpenKeyModal,
    onRunOcr,
    isExtracting,
    progressText,
    progressPercent,
    emulationMode = 'CLUSTER',
    onEmulationModeChange,
    selectableStores = [],
    singleStoreEmulations = [],
    onSingleStoreEmulationsChange
}: Props) {
    const qdInputRef = useRef<HTMLInputElement>(null);
    const realInputRef = useRef<HTMLInputElement>(null);
    const emuInputRef = useRef<HTMLInputElement>(null);

    const isMultiQd = Boolean(onQdFilesChange || qdFiles !== undefined);
    const isMultiReal = Boolean(onRealFilesChange || realFiles !== undefined);

    const currentQdFiles: File[] = qdFiles ?? (qdFile ? [qdFile] : []);
    const currentRealFiles: File[] = realFiles ?? (realFile ? [realFile] : []);

    const handleAddQdFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const newFiles = Array.from(e.target.files);
        if (onQdFilesChange) {
            onQdFilesChange([...currentQdFiles, ...newFiles]);
        } else if (onQdFileChange) {
            onQdFileChange(newFiles[0] || null);
        }
        if (qdInputRef.current) qdInputRef.current.value = '';
    };

    const handleRemoveQdFile = (index: number) => {
        if (onQdFilesChange) {
            onQdFilesChange(currentQdFiles.filter((_, idx) => idx !== index));
        } else if (onQdFileChange) {
            onQdFileChange(null);
        }
    };

    const handleClearAllQdFiles = () => {
        if (onQdFilesChange) onQdFilesChange([]);
        if (onQdFileChange) onQdFileChange(null);
    };

    const handleAddRealFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const newFiles = Array.from(e.target.files);
        if (onRealFilesChange) {
            onRealFilesChange([...currentRealFiles, ...newFiles]);
        } else if (onRealFileChange) {
            onRealFileChange(newFiles[0] || null);
        }
        if (realInputRef.current) realInputRef.current.value = '';
    };

    const handleRemoveRealFile = (index: number) => {
        if (onRealFilesChange) {
            onRealFilesChange(currentRealFiles.filter((_, idx) => idx !== index));
        } else if (onRealFileChange) {
            onRealFileChange(null);
        }
    };

    const handleClearAllRealFiles = () => {
        if (onRealFilesChange) onRealFilesChange([]);
        if (onRealFileChange) onRealFileChange(null);
    };

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

    // Handlers cho chế độ nạp thi đua đích danh từng ST
    const handleAddSingleStoreFiles = (entryIdx: number, newFiles: FileList | null) => {
        if (!newFiles || !onSingleStoreEmulationsChange) return;
        const added = Array.from(newFiles);
        const updated = singleStoreEmulations.map((entry, idx) => {
            if (idx === entryIdx) {
                return { ...entry, files: [...entry.files, ...added] };
            }
            return entry;
        });
        onSingleStoreEmulationsChange(updated);
    };

    const handleRemoveSingleStoreFile = (entryIdx: number, fileIdx: number) => {
        if (!onSingleStoreEmulationsChange) return;
        const updated = singleStoreEmulations.map((entry, idx) => {
            if (idx === entryIdx) {
                return { ...entry, files: entry.files.filter((_, fI) => fI !== fileIdx) };
            }
            return entry;
        });
        onSingleStoreEmulationsChange(updated);
    };

    const handleUpdateEntryStoreName = (entryIdx: number, storeName: string) => {
        if (!onSingleStoreEmulationsChange) return;
        const updated = singleStoreEmulations.map((entry, idx) => {
            if (idx === entryIdx) {
                return { ...entry, storeName };
            }
            return entry;
        });
        onSingleStoreEmulationsChange(updated);
    };

    const handleAddStoreEntry = () => {
        if (!onSingleStoreEmulationsChange) return;
        const currentStores = new Set(singleStoreEmulations.map(e => e.storeName));
        const nextStore = selectableStores.find(s => !currentStores.has(s.name));
        const nextName = nextStore ? nextStore.name : (selectableStores[0]?.name || '');
        onSingleStoreEmulationsChange([
            ...singleStoreEmulations,
            { storeName: nextName, files: [] }
        ]);
    };

    const handleRemoveStoreEntry = (entryIdx: number) => {
        if (!onSingleStoreEmulationsChange) return;
        const updated = singleStoreEmulations.filter((_, idx) => idx !== entryIdx);
        onSingleStoreEmulationsChange(updated);
    };

    const hasEmulation = emulationMode === 'CLUSTER'
        ? emulationFiles.length > 0
        : singleStoreEmulations.some(e => e.files.length > 0);

    const hasQd = currentQdFiles.length > 0;
    const hasReal = currentRealFiles.length > 0;
    const canExtract = Boolean(hasQd || hasReal || hasEmulation);

    const totalEmulationFiles = emulationMode === 'CLUSTER'
        ? emulationFiles.length
        : singleStoreEmulations.reduce((sum, e) => sum + e.files.length, 0);

    return (
        <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4 font-avo">
            {/* Header và Động cơ */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 uppercase tracking-wide">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        <span>Tải Ảnh</span>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Nút cài đặt API Key */}
                    <button
                        type="button"
                        onClick={onOpenKeyModal}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer border shadow-2xs ${isQuotaExceeded
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
                                        ? '🛡️ API Key'
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
                                <span>1. Doanh Thu QĐ</span>
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${currentQdFiles.length > 0 ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800'
                                }`}>
                                {isMultiQd ? `${currentQdFiles.length} ảnh` : (qdFile ? '1 file' : '0 file')}
                            </span>
                        </div>
                    </div>

                    <input
                        ref={qdInputRef}
                        type="file"
                        accept="image/*"
                        multiple={isMultiQd}
                        className="hidden"
                        onChange={handleAddQdFiles}
                    />

                    {isMultiQd ? (
                        <div className="space-y-1.5">
                            {currentQdFiles.length > 0 && (
                                <div className="space-y-1">
                                    <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                                        {currentQdFiles.map((file, idx) => (
                                            <div
                                                key={idx}
                                                className="bg-white border border-blue-200 rounded-lg px-2 py-1 flex items-center justify-between gap-1 text-[11px] shadow-2xs"
                                            >
                                                <span className="truncate text-slate-800 font-medium" title={file.name}>
                                                    #{idx + 1}. {file.name}
                                                </span>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <span className="text-[10px] text-slate-400 font-mono">
                                                        {(file.size / 1024).toFixed(0)} KB
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveQdFile(idx)}
                                                        className="text-slate-400 hover:text-rose-600 transition cursor-pointer p-0.5"
                                                        title="Xóa ảnh này"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {currentQdFiles.length > 1 && (
                                        <div className="flex justify-end">
                                            <button
                                                type="button"
                                                onClick={handleClearAllQdFiles}
                                                className="text-[10px] text-rose-500 hover:text-rose-700 font-bold transition cursor-pointer"
                                            >
                                                Xóa tất cả ({currentQdFiles.length} ảnh)
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={() => qdInputRef.current?.click()}
                                className="w-full py-2.5 px-3 border-2 border-dashed border-blue-200 hover:border-blue-400 hover:bg-blue-50/40 rounded-xl text-center cursor-pointer transition flex items-center justify-center gap-1.5 text-blue-700 text-xs font-black"
                            >
                                <Plus className="w-4 h-4 text-blue-600" />
                                <span>{currentQdFiles.length > 0 ? '+ Thêm ảnh DT-QĐ khác...' : 'Nạp ảnh DT-QĐ (chọn 1 hoặc nhiều)'}</span>
                            </button>
                        </div>
                    ) : (
                        qdFile ? (
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
                                    onClick={() => onQdFileChange?.(null)}
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
                        )
                    )}
                </div>

                {/* 2. KHỐI DOANH THU THỰC (DT-THỰC) */}
                <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3.5 flex flex-col justify-between space-y-3">
                    <div>
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-emerald-900 uppercase tracking-wide flex items-center gap-1.5">
                                <FileImage className="w-3.5 h-3.5 text-emerald-600" />
                                <span>2. Doanh Thu Thực</span>
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${currentRealFiles.length > 0 ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                {isMultiReal ? `${currentRealFiles.length} ảnh` : (realFile ? '1 file' : '0 file')}
                            </span>
                        </div>
                    </div>

                    <input
                        ref={realInputRef}
                        type="file"
                        accept="image/*"
                        multiple={isMultiReal}
                        className="hidden"
                        onChange={handleAddRealFiles}
                    />

                    {isMultiReal ? (
                        <div className="space-y-1.5">
                            {currentRealFiles.length > 0 && (
                                <div className="space-y-1">
                                    <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                                        {currentRealFiles.map((file, idx) => (
                                            <div
                                                key={idx}
                                                className="bg-white border border-emerald-200 rounded-lg px-2 py-1 flex items-center justify-between gap-1 text-[11px] shadow-2xs"
                                            >
                                                <span className="truncate text-slate-800 font-medium" title={file.name}>
                                                    #{idx + 1}. {file.name}
                                                </span>
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <span className="text-[10px] text-slate-400 font-mono">
                                                        {(file.size / 1024).toFixed(0)} KB
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveRealFile(idx)}
                                                        className="text-slate-400 hover:text-rose-600 transition cursor-pointer p-0.5"
                                                        title="Xóa ảnh này"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {currentRealFiles.length > 1 && (
                                        <div className="flex justify-end">
                                            <button
                                                type="button"
                                                onClick={handleClearAllRealFiles}
                                                className="text-[10px] text-rose-500 hover:text-rose-700 font-bold transition cursor-pointer"
                                            >
                                                Xóa tất cả ({currentRealFiles.length} ảnh)
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={() => realInputRef.current?.click()}
                                className="w-full py-2.5 px-3 border-2 border-dashed border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/40 rounded-xl text-center cursor-pointer transition flex items-center justify-center gap-1.5 text-emerald-700 text-xs font-black"
                            >
                                <Plus className="w-4 h-4 text-emerald-600" />
                                <span>{currentRealFiles.length > 0 ? '+ Thêm ảnh DT Thực khác...' : 'Nạp ảnh DT Thực (chọn 1 hoặc nhiều)'}</span>
                            </button>
                        </div>
                    ) : (
                        realFile ? (
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
                                    onClick={() => onRealFileChange?.(null)}
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
                        )
                    )}
                </div>

                {/* 3. KHỐI THI ĐUA LŨY KẾ (HỖ TRỢ SWITCH: CẢ CỤM / ĐÍCH DANH TỪNG ST) */}
                <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3.5 flex flex-col justify-between space-y-3">
                    <div>
                        <div className="flex items-center justify-between gap-1 flex-wrap">
                            <span className="text-xs font-black text-purple-900 uppercase tracking-wide flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-purple-600" />
                                <span>3. Thi đua</span>
                            </span>

                            {/* Switch Chuyển Đổi Nạp Cả Cụm / Đích Danh Từng ST */}
                            {onEmulationModeChange && (
                                <div className="flex items-center bg-purple-100/90 p-0.5 rounded-lg border border-purple-200">
                                    <button
                                        type="button"
                                        onClick={() => onEmulationModeChange('CLUSTER')}
                                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer flex items-center gap-1 ${emulationMode === 'CLUSTER'
                                            ? 'bg-purple-600 text-white shadow-2xs font-black'
                                            : 'text-purple-800 hover:text-purple-950'
                                            }`}
                                        title="Nạp cả cụm (dữ liệu ảnh có đồng thời tên nhiều ST)"
                                    >
                                        <span>🌐 Cả Cụm</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onEmulationModeChange('SINGLE_STORE')}
                                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer flex items-center gap-1 ${emulationMode === 'SINGLE_STORE'
                                            ? 'bg-purple-600 text-white shadow-2xs font-black'
                                            : 'text-purple-800 hover:text-purple-950'
                                            }`}
                                        title="Nạp đích danh theo từng ST có thể nạp"
                                    >
                                        <span>🏪 Từng ST</span>
                                    </button>
                                </div>
                            )}

                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 font-mono">
                                {totalEmulationFiles} ảnh
                            </span>
                        </div>

                        {emulationMode === 'CLUSTER' ? (
                            <p className="text-[10px] text-purple-800 bg-purple-50/80 border border-purple-200 px-2 py-1 rounded-lg mt-1 font-medium leading-relaxed">
                                {mode === 'STORE' ? (
                                    <>
                                        🌐 <strong>Ảnh bảng thi đua cụm:</strong> Dữ liệu có đồng thời tên nhiều ST.
                                    </>
                                ) : (
                                    <>
                                        🌐 <strong>Ảnh thi đua theo ST:</strong> AI tự động tính số liệu NV từ % tỉ trọng &amp; mapping tên đầy đủ qua Target ST.
                                    </>
                                )}
                            </p>
                        ) : (
                            <p className="text-[10px] text-purple-900 bg-purple-50/90 border border-purple-200 px-2 py-1 rounded-lg mt-1 font-medium leading-relaxed">
                                🏪 <strong>Đích danh từng ST:</strong> Tải lên ảnh theo đúng ST cần nạp.
                            </p>
                        )}

                        {totalEmulationFiles >= 4 && (
                            <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md font-bold block mt-1">
                                ⚡ Tự động chia thành các đợt 3 ảnh để quét tuần tự an toàn &amp; không timeout
                            </span>
                        )}
                    </div>

                    {/* VÙNG NẠP ẢNH TÙY THEO CHẾ ĐỘ SWITCH */}
                    {emulationMode === 'CLUSTER' ? (
                        <>
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
                                    <span>{emulationFiles.length > 0 ? '+ Thêm ảnh thi đua cụm khác...' : 'Nạp bộ ảnh thi đua cả cụm (chọn nhiều)'}</span>
                                </button>
                            </div>
                        </>
                    ) : (
                        /* CHẾ ĐỘ: ĐÍCH DANH THEO TỪNG ST CÓ THỂ NẠP */
                        <div className="space-y-2.5">
                            {(singleStoreEmulations || []).map((entry, entryIdx) => {
                                const inputId = `single-store-file-input-${entryIdx}`;
                                return (
                                    <div key={entryIdx} className="bg-white border border-purple-200/90 rounded-xl p-2.5 space-y-2 shadow-2xs">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                <Store className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                                <span className="text-[11px] font-bold text-slate-700 shrink-0">ST:</span>
                                                <select
                                                    value={entry.storeName}
                                                    onChange={e => handleUpdateEntryStoreName(entryIdx, e.target.value)}
                                                    className="text-xs font-bold text-purple-950 bg-purple-50/60 border border-purple-300 rounded-lg px-2 py-1 w-full focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer truncate"
                                                >
                                                    {selectableStores.length > 0 ? (
                                                        selectableStores.map(st => (
                                                            <option key={st.id || st.code || st.name} value={st.name}>
                                                                {formatStoreDisplayName(st.name)}
                                                            </option>
                                                        ))
                                                    ) : (
                                                        <option value={entry.storeName || ''}>
                                                            {entry.storeName ? formatStoreDisplayName(entry.storeName) : 'Chọn ST...'}
                                                        </option>
                                                    )}
                                                </select>
                                            </div>

                                            {singleStoreEmulations.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveStoreEntry(entryIdx)}
                                                    className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                                                    title="Xóa ST này"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>

                                        <input
                                            id={inputId}
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            className="hidden"
                                            onChange={e => {
                                                handleAddSingleStoreFiles(entryIdx, e.target.files);
                                                e.target.value = '';
                                            }}
                                        />

                                        {entry.files && entry.files.length > 0 && (
                                            <div className="max-h-20 overflow-y-auto space-y-1 pr-1">
                                                {entry.files.map((file, fIdx) => (
                                                    <div
                                                        key={fIdx}
                                                        className="bg-purple-50/50 border border-purple-200 rounded-md px-2 py-0.5 flex items-center justify-between gap-1 text-[10.5px]"
                                                    >
                                                        <span className="truncate text-slate-800 font-medium" title={file.name}>
                                                            #{fIdx + 1}. {file.name}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveSingleStoreFile(entryIdx, fIdx)}
                                                            className="text-slate-400 hover:text-rose-600 transition cursor-pointer p-0.5"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <label
                                            htmlFor={inputId}
                                            className="w-full py-1.5 px-2 border border-dashed border-purple-300 hover:border-purple-500 hover:bg-purple-50 text-purple-700 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            <span>
                                                {entry.files && entry.files.length > 0
                                                    ? `Thêm ảnh thi đua (${entry.files.length} ảnh)...`
                                                    : 'Tải ảnh thi đua cho ST này'}
                                            </span>
                                        </label>
                                    </div>
                                );
                            })}

                            {selectableStores.length > singleStoreEmulations.length && (
                                <button
                                    type="button"
                                    onClick={handleAddStoreEntry}
                                    className="w-full py-1.5 px-3 bg-purple-50 hover:bg-purple-100 border border-purple-300 text-purple-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>+ Thêm ST khác để nạp thi đua</span>
                                </button>
                            )}
                        </div>
                    )}
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
                            ? '✨ Sẵn sàng trích xuất. Nhấn nút để AI quét số liệu và hợp nhất theo từng cá nhân / ST.'
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

