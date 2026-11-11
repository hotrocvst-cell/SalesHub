import React, { useRef } from 'react';
import {
    Sparkles,
    Trash2,
    Layers,
    Key,
    Plus,
    X,
    Store
} from 'lucide-react';
import type { OcrEngineType, EmulationUploadMode, SingleStoreEmulationEntry } from '../types/ocrTypes';
import type { StoreItem } from '../../../core/lib/storage';
import { formatStoreDisplayName } from '../../../core/lib/formatters';
import ImageSlotCard from './ImageSlotCard';

interface Props {
    mode?: 'STORE' | 'EMPLOYEE';
    qdFile?: File | null;
    qdFiles?: File[];
    onQdFileChange?: (file: File | null) => void;
    onQdFilesChange?: (files: File[]) => void;

    // Ảnh % Tỷ trọng trả góp (thay thế hoàn toàn DT Thực cho cả ST và Nhân viên)
    installmentFile?: File | null;
    installmentFiles?: File[];
    onInstallmentFileChange?: (file: File | null) => void;
    onInstallmentFilesChange?: (files: File[]) => void;

    emulationFiles: File[];
    onEmulationFilesChange: (files: File[]) => void;
    engineType?: OcrEngineType;
    onEngineTypeChange?: (engine: OcrEngineType) => void;
    hasGeminiKey: boolean;
    keySource?: 'USER' | 'ADMIN' | 'NONE';
    isQuotaExceeded?: boolean;
    onOpenKeyModal: () => void;
    onRunOcr: () => void;
    onClearAllFiles?: () => void;
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
    installmentFile,
    installmentFiles,
    onInstallmentFileChange,
    onInstallmentFilesChange,
    emulationFiles,
    onEmulationFilesChange,
    keySource = 'NONE',
    isQuotaExceeded = false,
    onOpenKeyModal,
    onRunOcr,
    onClearAllFiles,
    isExtracting,
    progressText,
    progressPercent,
    emulationMode = 'CLUSTER',
    onEmulationModeChange,
    selectableStores = [],
    singleStoreEmulations = [],
    onSingleStoreEmulationsChange
}: Props) {
    const emuInputRef = useRef<HTMLInputElement>(null);

    const isMultiQd = Boolean(onQdFilesChange || qdFiles !== undefined);
    const currentQdFiles: File[] = qdFiles ?? (qdFile ? [qdFile] : []);

    const isMultiInstallment = Boolean(onInstallmentFilesChange || installmentFiles !== undefined);
    const currentInstallmentFiles: File[] = installmentFiles ?? (installmentFile ? [installmentFile] : []);

    const handleAddEmulationFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const newFiles = Array.from(e.target.files);
        onEmulationFilesChange([...emulationFiles, ...newFiles]);
        if (emuInputRef.current) emuInputRef.current.value = '';
    };

    const handleRemoveEmulationFile = (index: number) => {
        onEmulationFilesChange(emulationFiles.filter((_, idx) => idx !== index));
    };

    // Handlers cho chế độ nạp thi đua đích danh từng ST
    const handleAddSingleStoreFiles = (entryIdx: number, newFiles: FileList | null) => {
        if (!newFiles || !onSingleStoreEmulationsChange) return;
        const added = Array.from(newFiles);
        onSingleStoreEmulationsChange(
            singleStoreEmulations.map((entry, idx) =>
                idx === entryIdx ? { ...entry, files: [...entry.files, ...added] } : entry
            )
        );
    };

    const handleRemoveSingleStoreFile = (entryIdx: number, fileIdx: number) => {
        if (!onSingleStoreEmulationsChange) return;
        onSingleStoreEmulationsChange(
            singleStoreEmulations.map((entry, idx) =>
                idx === entryIdx ? { ...entry, files: entry.files.filter((_, fI) => fI !== fileIdx) } : entry
            )
        );
    };

    const handleUpdateEntryStoreName = (entryIdx: number, storeName: string) => {
        if (!onSingleStoreEmulationsChange) return;
        onSingleStoreEmulationsChange(
            singleStoreEmulations.map((entry, idx) =>
                idx === entryIdx ? { ...entry, storeName } : entry
            )
        );
    };

    const handleAddStoreEntry = () => {
        if (!onSingleStoreEmulationsChange) return;
        const currentStores = new Set(singleStoreEmulations.map(e => e.storeName));
        const nextStore = selectableStores.find(s => !currentStores.has(s.name));
        const nextName = nextStore ? nextStore.name : (selectableStores[0]?.name || '');
        onSingleStoreEmulationsChange([...singleStoreEmulations, { storeName: nextName, files: [] }]);
    };

    const handleRemoveStoreEntry = (entryIdx: number) => {
        if (!onSingleStoreEmulationsChange) return;
        onSingleStoreEmulationsChange(singleStoreEmulations.filter((_, idx) => idx !== entryIdx));
    };

    const hasEmulation = emulationMode === 'CLUSTER'
        ? emulationFiles.length > 0
        : singleStoreEmulations.some(e => e.files.length > 0);

    const hasQd = currentQdFiles.length > 0;
    const hasSecondBlock = currentInstallmentFiles.length > 0;
    const canExtract = Boolean(hasQd || hasSecondBlock || hasEmulation);

    const totalEmulationFiles = emulationMode === 'CLUSTER'
        ? emulationFiles.length
        : singleStoreEmulations.reduce((sum, e) => sum + e.files.length, 0);

    return (
        <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4 font-avo">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 uppercase tracking-wide">
                        <Sparkles className="w-4 h-4 text-purple-600" aria-hidden="true" />
                        <span>Tải Ảnh</span>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {canExtract && !isExtracting && onClearAllFiles && (
                        <button
                            type="button"
                            onClick={onClearAllFiles}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 transition cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                            title="Xóa toàn bộ ảnh đã chọn ở 3 mục để tải lại đợt ảnh mới"
                        >
                            <Trash2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span>Xóa hết ảnh</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={onOpenKeyModal}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer border shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${isQuotaExceeded
                            ? 'bg-rose-50 text-rose-900 border-rose-300 hover:bg-rose-100 animate-pulse'
                            : keySource === 'USER'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                : keySource === 'ADMIN'
                                    ? 'bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100'
                                    : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 animate-pulse'
                            }`}
                        title="Quản lý Google Gemini API Key"
                    >
                        <Key className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>
                            {isQuotaExceeded
                                ? '⚠️ Key hết lượt - Nhập key Google'
                                : keySource === 'USER'
                                    ? 'Key Cá Nhân (Ưu tiên)'
                                    : keySource === 'ADMIN'
                                        ? 'API Key'
                                        : 'Cần Cài Gemini API Key'}
                        </span>
                    </button>
                </div>
            </div>

            {/* 3 KHỐI TIẾP NHẬN ẢNH */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* 1. KHỐI DOANH THU QUY ĐỔI (DT-QĐ) */}
                <ImageSlotCard
                    title="1. Doanh Thu QĐ"
                    description={
                        mode === 'STORE'
                            ? 'Ảnh Thẻ Doanh thu hợp nhất • Lấy: Doanh thu QĐ, DT Trả góp QĐ, Target, TB 3 Tháng, % TT Doanh thu.'
                            : 'Ảnh Lưới Doanh thu hợp nhất • Lấy: Doanh thu QĐ, DT Trả góp QĐ (chọn nhiều ảnh nếu cuộn ngang/dọc).'
                    }
                    theme="blue"
                    files={currentQdFiles}
                    isMulti={isMultiQd}
                    emptyTitle="Chọn ảnh Doanh thu QĐ"
                    emptySubtitle="Chụp hoặc tải ảnh màn hình"
                    addMoreLabel="+ Thêm ảnh Doanh thu QĐ khác..."
                    addInitialLabel="Nạp ảnh Doanh thu QĐ (chọn 1 hoặc nhiều)"
                    onAddFiles={(added) => {
                        if (onQdFilesChange) onQdFilesChange([...currentQdFiles, ...added]);
                        else if (onQdFileChange) onQdFileChange(added[0] || null);
                    }}
                    onRemoveFile={(index) => {
                        if (onQdFilesChange) onQdFilesChange(currentQdFiles.filter((_, idx) => idx !== index));
                        else if (onQdFileChange) onQdFileChange(null);
                    }}
                    onClearAll={() => {
                        if (onQdFilesChange) onQdFilesChange([]);
                        if (onQdFileChange) onQdFileChange(null);
                    }}
                />

                {/* 2. KHỐI % TỶ TRỌNG TRẢ GÓP (THAY THẾ HOÀN TOÀN DT THỰC) */}
                <ImageSlotCard
                    title="2. % Tỷ Trọng Trả Góp"
                    description={
                        mode === 'STORE'
                            ? 'Ảnh Báo cáo trả chậm • Lấy: % Tỷ trọng trả góp theo từng ST.'
                            : 'Ảnh Báo cáo trả chậm • Lấy: % Tỷ trọng trả góp theo từng nhân viên.'
                    }
                    theme="emerald"
                    files={currentInstallmentFiles}
                    isMulti={isMultiInstallment}
                    emptyTitle="Chọn ảnh % Tỷ trọng trả góp"
                    emptySubtitle="Ảnh Báo cáo trả chậm"
                    addMoreLabel="+ Thêm ảnh % Tỷ trọng trả góp..."
                    addInitialLabel="Nạp ảnh % Tỷ trọng trả góp (chọn 1 hoặc nhiều)"
                    onAddFiles={(added) => {
                        if (onInstallmentFilesChange) {
                            onInstallmentFilesChange([...currentInstallmentFiles, ...added]);
                        } else if (onInstallmentFileChange) {
                            onInstallmentFileChange(added[0] || null);
                        }
                    }}
                    onRemoveFile={(index) => {
                        if (onInstallmentFilesChange) {
                            onInstallmentFilesChange(currentInstallmentFiles.filter((_, idx) => idx !== index));
                        } else if (onInstallmentFileChange) {
                            onInstallmentFileChange(null);
                        }
                    }}
                    onClearAll={() => {
                        if (onInstallmentFilesChange) onInstallmentFilesChange([]);
                        if (onInstallmentFileChange) onInstallmentFileChange(null);
                    }}
                />

                {/* 3. KHỐI THI ĐUA LŨY KẾ (GIỮ NGUYÊN NHƯ HIỆN TẠI) */}
                <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3.5 flex flex-col justify-between space-y-3">
                    <div>
                        <div className="flex items-center justify-between gap-1 flex-wrap">
                            <span className="text-xs font-black text-purple-900 uppercase tracking-wide flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-purple-600" aria-hidden="true" />
                                <span>3. Thi đua</span>
                            </span>

                            {/* Switch Chuyển Đổi Nạp Cả Cụm / Đích Danh Từng ST */}
                            {onEmulationModeChange && (
                                <div className="flex items-center bg-purple-100/90 p-0.5 rounded-lg border border-purple-200">
                                    <button
                                        type="button"
                                        onClick={() => onEmulationModeChange('CLUSTER')}
                                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer flex items-center gap-1 ${emulationMode === 'CLUSTER'
                                            ? 'bg-purple-700 text-white shadow-2xs font-black'
                                            : 'text-purple-900 hover:text-purple-950'
                                            }`}
                                        title="Nạp cả cụm (dữ liệu ảnh có đồng thời tên nhiều ST)"
                                    >
                                        <span>Cả Cụm</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onEmulationModeChange('SINGLE_STORE')}
                                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition cursor-pointer flex items-center gap-1 ${emulationMode === 'SINGLE_STORE'
                                            ? 'bg-purple-700 text-white shadow-2xs font-black'
                                            : 'text-purple-900 hover:text-purple-950'
                                            }`}
                                        title="Nạp đích danh theo từng ST có thể nạp"
                                    >
                                        <span>Từng ST</span>
                                    </button>
                                </div>
                            )}

                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 font-mono tabular-nums">
                                {totalEmulationFiles} ảnh
                            </span>
                        </div>

                        {emulationMode === 'CLUSTER' ? (
                            <p className="text-[10.5px] text-purple-900 bg-purple-50/80 border border-purple-200 px-2 py-1 rounded-lg mt-1.5 font-medium leading-relaxed">
                                {mode === 'STORE' ? (
                                    <>
                                        <strong>Ảnh bảng thi đua cụm:</strong> Dữ liệu có đồng thời tên nhiều ST.
                                    </>
                                ) : (
                                    <>
                                        <strong>Ảnh thi đua theo nhân viên:</strong> Ảnh bảng pivot (Hàng: Nhân viên · Cột: Chương trình) • Tự động lấy lũy kế &amp; đối chiếu Mã NV theo tên.
                                    </>
                                )}
                            </p>
                        ) : (
                            <p className="text-[10.5px] text-purple-900 bg-purple-50/90 border border-purple-200 px-2 py-1 rounded-lg mt-1.5 font-medium leading-relaxed">
                                <strong>Đích danh từng ST:</strong> Tải lên ảnh theo đúng ST cần nạp.
                            </p>
                        )}

                        {totalEmulationFiles >= 4 && (
                            <span className="text-[10px] text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md font-bold block mt-1">
                                Tự động quét an toàn theo từng đợt để tránh timeout
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
                                                key={`${file.name}-${idx}`}
                                                className="bg-white border border-purple-200 rounded-lg px-2 py-1 flex items-center justify-between gap-1 text-[11px] shadow-2xs"
                                            >
                                                <span className="truncate text-slate-800 font-medium" title={file.name}>
                                                    #{idx + 1}. {file.name}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveEmulationFile(idx)}
                                                    aria-label={`Xóa ảnh thi đua ${file.name}`}
                                                    className="text-slate-500 hover:text-rose-700 transition cursor-pointer p-0.5 rounded"
                                                >
                                                    <X className="w-3 h-3" aria-hidden="true" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <button
                                    type="button"
                                    onClick={() => emuInputRef.current?.click()}
                                    className="w-full py-2.5 px-3 border-2 border-dashed border-purple-200 hover:border-purple-400 hover:bg-purple-50/40 rounded-xl text-center cursor-pointer transition flex items-center justify-center gap-1.5 text-purple-800 text-xs font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                                >
                                    <Plus className="w-4 h-4 text-purple-600" aria-hidden="true" />
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
                                                <Store className="w-3.5 h-3.5 text-purple-600 shrink-0" aria-hidden="true" />
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
                                                    aria-label="Xóa ST khỏi danh sách nạp thi đua"
                                                    className="p-1 text-slate-500 hover:text-rose-700 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                                                    title="Xóa ST này"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
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
                                                        key={`${file.name}-${fIdx}`}
                                                        className="bg-purple-50/50 border border-purple-200 rounded-md px-2 py-0.5 flex items-center justify-between gap-1 text-[10.5px]"
                                                    >
                                                        <span className="truncate text-slate-800 font-medium" title={file.name}>
                                                            #{fIdx + 1}. {file.name}
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveSingleStoreFile(entryIdx, fIdx)}
                                                            aria-label={`Xóa ảnh ${file.name}`}
                                                            className="text-slate-500 hover:text-rose-700 transition cursor-pointer p-0.5"
                                                        >
                                                            <X className="w-3 h-3" aria-hidden="true" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <label
                                            htmlFor={inputId}
                                            className="w-full py-1.5 px-2 border border-dashed border-purple-300 hover:border-purple-500 hover:bg-purple-50 text-purple-800 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                                        >
                                            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
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
                                    className="w-full py-1.5 px-3 bg-purple-50 hover:bg-purple-100 border border-purple-300 text-purple-900 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                                >
                                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
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
                            <Sparkles className="w-4 h-4 text-purple-600 animate-spin" aria-hidden="true" />
                            <span>{progressText || 'Đang phân tích số liệu hình ảnh...'}</span>
                        </span>
                        <span className="font-mono font-bold text-purple-800 tabular-nums">{progressPercent}%</span>
                    </div>
                    <div className="w-full bg-purple-200 rounded-full h-2 overflow-hidden">
                        <div
                            className="bg-blue-700 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>
            ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                    <div className="text-[11px] text-slate-600">
                        {canExtract
                            ? mode === 'STORE'
                                ? 'Sẵn sàng trích xuất. Nhấn nút để AI quét số liệu và hợp nhất theo từng ST.'
                                : 'Sẵn sàng trích xuất. Nhấn nút để AI quét số liệu và hợp nhất theo từng nhân viên.'
                            : mode === 'STORE'
                                ? 'Mẹo: Bạn có thể chọn nhiều ảnh chụp màn hình cùng lúc cho từng mục nếu cụm có nhiều ST.'
                                : 'Mẹo: Có thể chọn nhiều ảnh cuộn ngang/dọc (ảnh lấy DOANH THU QĐ và ảnh lấy DT TRẢ GÓP QĐ), hệ thống sẽ tự hợp nhất theo Mã NV.'}
                    </div>

                    <button
                        type="button"
                        onClick={onRunOcr}
                        disabled={!canExtract || isExtracting}
                        className="px-6 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-2xl text-xs font-black transition cursor-pointer shadow-md flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    >
                        <Sparkles className="w-4 h-4" aria-hidden="true" />
                        <span>Bắt Đầu Trích Xuất Dữ Liệu (OCR)</span>
                    </button>
                </div>
            )}
        </div>
    );
}
