import React, { useState, useEffect } from 'react';
import {
    X,
    Camera,
    Edit3,
    Sparkles,
    CheckCircle2,
    AlertCircle,
    Save,
    KeyRound,
    RefreshCw,
    Database,
    Clock,
    AlertTriangle
} from 'lucide-react';
import OcrUploadZone from '../../data-update/components/OcrUploadZone';
import ManualDataEntryModule from '../../data-update/components/ManualDataEntryModule';
import GeminiApiKeyModal from '../../data-update/components/GeminiApiKeyModal';
import { extractAndMergeAllImages } from '../../data-update/services/geminiVisionOcrService';
import {
    resolveActiveGeminiKey,
    fetchAdminGeminiKeyCloud,
    GeminiQuotaExceededError,
    type ActiveKeyInfo
} from '../../data-update/services/geminiApiKeyService';
import { runClientTesseractOcr } from '../../data-update/services/tesseractOcrService';
import type { OcrEngineType, StoreReportingData } from '../../data-update/types/ocrTypes';
import type { StoreItem, CampaignDictItem } from '../../../core/lib/storage';
import { formatDate } from '../../../core/lib/formatters';
import {
    convertStoreReportingDataToSessions,
    saveRealtimeStoreSessions,
    type RealtimeStoreSessionRecord
} from '../services/realtimeSessionService';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSavedSuccessfully: (savedSessions: RealtimeStoreSessionRecord[]) => void;
    availableStores: StoreItem[];
    campaignDict: CampaignDictItem[];
    isAdmin: boolean;
    currentUserName?: string;
}

export default function RealtimeDataUpdateModal({
    isOpen,
    onClose,
    onSavedSuccessfully,
    availableStores,
    campaignDict,
    isAdmin,
    currentUserName = 'ADMIN'
}: Props) {
    if (!isOpen) return null;

    // Tab chuyển đổi: 'ocr' (Tải ảnh trích xuất) hoặc 'manual' (Rà soát & Nhập trực quan)
    const [activeTab, setActiveTab] = useState<'ocr' | 'manual'>('ocr');

    // 1. Files upload
    const [qdFile, setQdFile] = useState<File | null>(null);
    const [realFile, setRealFile] = useState<File | null>(null);
    const [emulationFiles, setEmulationFiles] = useState<File[]>([]);

    // 2. Engine & Gemini Key
    const [engineType, setEngineType] = useState<OcrEngineType>('GEMINI_FLASH');
    const [keyInfo, setKeyInfo] = useState<ActiveKeyInfo>(() => resolveActiveGeminiKey());
    const [isKeyModalOpen, setIsKeyModalOpen] = useState<boolean>(false);
    const [isQuotaExceeded, setIsQuotaExceeded] = useState<boolean>(false);

    // 3. Tiến trình OCR
    const [isExtracting, setIsExtracting] = useState<boolean>(false);
    const [progressText, setProgressText] = useState<string>('');
    const [progressPercent, setProgressPercent] = useState<number>(0);
    const [ocrError, setOcrError] = useState<string>('');
    const [screenshotTimestamp, setScreenshotTimestamp] = useState<string>('');

    // 4. Dữ liệu siêu thị sau trích xuất / nhập tay
    const [storesData, setStoresData] = useState<StoreReportingData[]>([]);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [modalToast, setModalToast] = useState<string>('');

    // Nạp key từ cloud khi mở modal
    useEffect(() => {
        fetchAdminGeminiKeyCloud().then(() => {
            setKeyInfo(resolveActiveGeminiKey());
        });
    }, []);

    const showToast = (msg: string) => {
        setModalToast(msg);
        setTimeout(() => setModalToast(''), 3500);
    };

    // Chạy OCR trích xuất ảnh
    const handleRunOcr = async () => {
        const activeKey = keyInfo.key;
        if (engineType === 'GEMINI_FLASH' && !activeKey) {
            setIsKeyModalOpen(true);
            return;
        }

        if (!qdFile && !realFile && emulationFiles.length === 0) {
            showToast('⚠️ Vui lòng chọn ít nhất 1 ảnh (DT-QĐ, DT-THỰC hoặc Thi đua)!');
            return;
        }

        setIsExtracting(true);
        setOcrError('');
        setProgressText('Đang kết nối mô hình Gemini Vision...');
        setProgressPercent(10);

        try {
            if (engineType === 'GEMINI_FLASH') {
                const result = await extractAndMergeAllImages(
                    activeKey,
                    { qdFile, realFile, emulationFiles },
                    (msg, pct) => {
                        setProgressText(msg);
                        setProgressPercent(pct);
                    },
                    keyInfo.source
                );

                if (!result.success || result.stores.length === 0) {
                    setOcrError(result.errors?.join('; ') || 'Không thể trích xuất số liệu từ ảnh đã chọn.');
                    setIsExtracting(false);
                    return;
                }

                // Ghi nhận giờ chụp trên ảnh (nếu có)
                if (result.reportTime || result.reportDate) {
                    const timeInfo = [
                        result.reportTime,
                        result.reportDate ? formatDate(result.reportDate) : ''
                    ].filter(Boolean).join(' ');
                    setScreenshotTimestamp(timeInfo);
                } else {
                    setScreenshotTimestamp(`${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${formatDate(new Date())}`);
                }

                setStoresData(result.stores);
                setIsQuotaExceeded(false);
                setProgressPercent(100);
                setProgressText('Trích xuất hoàn tất! Đang chuyển sang bảng rà soát...');
                showToast(`✅ Đã bóc tách thành công số liệu ${result.stores.length} siêu thị!`);
                setTimeout(() => {
                    setIsExtracting(false);
                    setActiveTab('manual');
                }, 900);
            } else {
                // Tesseract fallback
                setProgressText('Đang quét chữ bằng Tesseract.js...');
                setProgressPercent(50);
                const target = qdFile || realFile || emulationFiles[0];
                if (target) {
                    await runClientTesseractOcr(target, (msg, pct) => {
                        setProgressText(msg);
                        setProgressPercent(pct);
                    });
                    showToast('✅ Đã quét xong chữ! Vui lòng hoàn thiện trong bảng nhập tay.');
                    setIsExtracting(false);
                    setActiveTab('manual');
                }
            }
        } catch (err: any) {
            console.error('Lỗi khi chạy OCR:', err);
            setIsExtracting(false);

            if (err instanceof GeminiQuotaExceededError) {
                setIsQuotaExceeded(true);
                setIsKeyModalOpen(true);
                setOcrError('Hạn mức API Key của hệ thống đã hết. Vui lòng nhập API Key cá nhân của bạn để tiếp tục.');
            } else {
                setOcrError(err?.message || 'Có lỗi xảy ra trong quá trình nhận diện hình ảnh.');
            }
        }
    };

    // Lưu phiên Realtime lên Supabase Cloud
    const handleSaveToCloud = async () => {
        if (!storesData || storesData.length === 0) {
            showToast('⚠️ Chưa có dữ liệu siêu thị để lưu!');
            return;
        }

        setIsSaving(true);
        try {
            const sessions = convertStoreReportingDataToSessions(
                storesData,
                screenshotTimestamp || `${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${formatDate(new Date())}`,
                campaignDict,
                currentUserName
            );

            const res = await saveRealtimeStoreSessions(sessions, currentUserName);

            if (!res.success) {
                if (res.isTableMissing) {
                    showToast('⚠️ Bảng realtime_store_sessions chưa được tạo trên Supabase!');
                } else {
                    showToast(`⚠️ Lỗi lưu dữ liệu: ${res.error}`);
                }
                setIsSaving(false);
                return;
            }

            showToast(`🎉 Đã lưu thành công phiên Realtime cho ${sessions.length} siêu thị lên Cloud!`);
            onSavedSuccessfully(sessions);
            setTimeout(() => {
                setIsSaving(false);
                onClose();
            }, 800);
        } catch (err: any) {
            console.error('Lỗi khi lưu phiên Realtime:', err);
            showToast(`⚠️ Lỗi khi lưu: ${err?.message || 'Không thể kết nối'}`);
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
                {/* Header Modal */}
                <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-xs shrink-0">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                                <span>Nạp Phiên Dữ Liệu Realtime Mới</span>
                                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                                    Cloud Realtime
                                </span>
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Trích xuất ảnh OCR tự động hoặc nhập trực quan • Mỗi siêu thị lưu duy nhất 1 phiên mới nhất
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setIsKeyModalOpen(true)}
                            className="p-2 hover:bg-slate-800 rounded-xl text-slate-300 hover:text-white transition cursor-pointer border border-slate-700"
                            title="Cài đặt Gemini API Key"
                        >
                            <KeyRound className="w-4 h-4 text-amber-400" />
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Subheader & Tabs Chuyển đổi */}
                <div className="bg-slate-100 p-2.5 sm:px-5 flex items-center justify-between border-b border-slate-200 flex-wrap gap-2">
                    <div className="flex items-center p-1 bg-white rounded-xl border border-slate-200 shadow-inner">
                        <button
                            type="button"
                            onClick={() => setActiveTab('ocr')}
                            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                                activeTab === 'ocr'
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Camera className="w-3.5 h-3.5" />
                            <span>1. Tải Ảnh OCR Tự Động</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('manual')}
                            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                                activeTab === 'manual'
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>2. Rà Soát & Nhập Trực Quan ({storesData.length} ST)</span>
                        </button>
                    </div>

                    {screenshotTimestamp && (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                            <Clock className="w-3.5 h-3.5 text-blue-600" />
                            <span>Giờ chụp ảnh: <strong className="text-blue-700">{screenshotTimestamp}</strong></span>
                        </div>
                    )}
                </div>

                {/* Toast thông báo trong modal */}
                {modalToast && (
                    <div className="bg-slate-800 text-white px-4 py-2 text-xs font-bold text-center border-b border-slate-700 animate-in fade-in">
                        {modalToast}
                    </div>
                )}

                {/* Nội dung cuộn chính */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                    {/* Lỗi OCR nếu có */}
                    {ocrError && (
                        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <strong className="block font-bold">Lỗi trích xuất:</strong>
                                <span>{ocrError}</span>
                            </div>
                        </div>
                    )}

                    {activeTab === 'ocr' ? (
                        <div className="space-y-4">
                            <OcrUploadZone
                                qdFile={qdFile}
                                onQdFileChange={setQdFile}
                                realFile={realFile}
                                onRealFileChange={setRealFile}
                                emulationFiles={emulationFiles}
                                onEmulationFilesChange={setEmulationFiles}
                                engineType={engineType}
                                onEngineTypeChange={setEngineType}
                                hasGeminiKey={Boolean(keyInfo.key)}
                                keySource={keyInfo.source}
                                isQuotaExceeded={isQuotaExceeded}
                                onOpenKeyModal={() => setIsKeyModalOpen(true)}
                                onRunOcr={handleRunOcr}
                                isExtracting={isExtracting}
                                progressText={progressText}
                                progressPercent={progressPercent}
                            />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <ManualDataEntryModule
                                storesData={storesData}
                                onChangeStoresData={setStoresData}
                                availableStores={availableStores}
                                campaignDict={campaignDict}
                                passedDays={new Date().getDate()}
                                totalDays={new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()}
                                reportDate={formatDate(new Date())}
                                onSaveToSupabase={handleSaveToCloud}
                                isSaving={isSaving}
                            />
                        </div>
                    )}
                </div>

                {/* Footer Modal với nút Lưu Cloud */}
                <div className="bg-slate-50 p-3.5 sm:px-5 border-t border-slate-200 flex items-center justify-between flex-wrap gap-2">
                    <div className="text-xs text-slate-500">
                        {storesData.length > 0
                            ? `Đã nạp ${storesData.length} siêu thị sẵn sàng đẩy lên Cloud`
                            : 'Chưa có số liệu siêu thị'}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition cursor-pointer"
                        >
                            Đóng
                        </button>

                        <button
                            type="button"
                            onClick={handleSaveToCloud}
                            disabled={isSaving || storesData.length === 0}
                            className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition shadow-sm cursor-pointer disabled:opacity-50"
                        >
                            {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            <span>{isSaving ? 'Đang lưu Cloud...' : '💾 Lưu Phiên Realtime Lên Cloud'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* MODAL CÀI ĐẶT GEMINI KEY */}
            <GeminiApiKeyModal
                isOpen={isKeyModalOpen}
                onClose={() => setIsKeyModalOpen(false)}
                isAdmin={isAdmin}
                onKeySaved={(source) => {
                    setKeyInfo(resolveActiveGeminiKey());
                    setIsQuotaExceeded(false);
                    showToast(`✅ Đã lưu cấu hình API Key (${source === 'ADMIN' ? 'Hệ Thống' : 'Cá Nhân'})!`);
                }}
            />
        </div>
    );
}

