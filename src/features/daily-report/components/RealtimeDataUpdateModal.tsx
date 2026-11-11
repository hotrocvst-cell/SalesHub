import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    X,
    Camera,
    Edit3,
    Sparkles,
    AlertCircle,
    Save,
    KeyRound,
    RefreshCw,
    Database,
    Clock
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
import type { StoreReportingData, EmulationUploadMode, SingleStoreEmulationEntry } from '../../data-update/types/ocrTypes';
import type { StoreItem, CampaignDictItem } from '../../../core/lib/storage';
import { formatDate, formatStoreDisplayName, getShortStoreName } from '../../../core/lib/formatters';
import { useAuth } from '../../../shared/contexts/AuthContext';
import {
    convertStoreReportingDataToSessions,
    convertSessionsToStoreReportingData,
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
    existingSessions?: RealtimeStoreSessionRecord[];
    initialTab?: 'ocr' | 'manual';
}

export default function RealtimeDataUpdateModal({
    isOpen,
    onClose,
    onSavedSuccessfully,
    availableStores,
    campaignDict,
    isAdmin,
    currentUserName = 'ADMIN',
    existingSessions = [],
    initialTab = 'ocr'
}: Props) {
    const { canAccessStore, isAdmin: authIsAdmin } = useAuth();
    const effectiveIsAdmin = Boolean(isAdmin || authIsAdmin);

    // Tab chuyển đổi: 'ocr' (Tải ảnh trích xuất) hoặc 'manual' (Rà soát & Nhập trực quan)
    const [activeTab, setActiveTab] = useState<'ocr' | 'manual'>(initialTab);
    const toastTimerRef = useRef<number | null>(null);
    const closeBtnRef = useRef<HTMLButtonElement | null>(null);

    // Đồng bộ tab khi mở modal
    useEffect(() => {
        if (isOpen && initialTab) {
            setActiveTab(initialTab);
        }
    }, [isOpen, initialTab]);

    // 1. Files upload
    const [qdFiles, setQdFiles] = useState<File[]>([]);
    const [installmentFiles, setInstallmentFiles] = useState<File[]>([]);
    const [emulationFiles, setEmulationFiles] = useState<File[]>([]);

    // 1b. Switch nạp thi đua: 'CLUSTER' (Cả cụm) | 'SINGLE_STORE' (Đích danh từng ST)
    const [emulationMode, setEmulationMode] = useState<EmulationUploadMode>('CLUSTER');

    // Danh sách các ST người dùng có quyền nạp số liệu
    const selectableStores = useMemo(() => {
        if (effectiveIsAdmin) {
            return availableStores;
        }
        const filtered = availableStores.filter(s =>
            canAccessStore(s.name) || canAccessStore(s.short_name || '') || canAccessStore(getShortStoreName(s.name))
        );
        return filtered.length > 0 ? filtered : availableStores;
    }, [availableStores, effectiveIsAdmin, canAccessStore]);

    const defaultStoreName = selectableStores[0]?.name || availableStores[0]?.name || '';

    const [singleStoreEmulations, setSingleStoreEmulations] = useState<SingleStoreEmulationEntry[]>([
        { storeName: defaultStoreName, files: [] }
    ]);

    // Cập nhật defaultStoreName khi selectableStores có dữ liệu
    useEffect(() => {
        if (selectableStores.length > 0) {
            setSingleStoreEmulations(prev => {
                if (prev.length === 1 && !prev[0].storeName) {
                    return [{ storeName: selectableStores[0].name, files: [] }];
                }
                return prev;
            });
        }
    }, [selectableStores]);

    // 2. Gemini Key
    const [keyInfo, setKeyInfo] = useState<ActiveKeyInfo>(() => resolveActiveGeminiKey());
    const [isKeyModalOpen, setIsKeyModalOpen] = useState<boolean>(false);
    const [isQuotaExceeded, setIsQuotaExceeded] = useState<boolean>(false);

    // 3. Tiến trình OCR
    const [isExtracting, setIsExtracting] = useState<boolean>(false);
    const [progressText, setProgressText] = useState<string>('');
    const [progressPercent, setProgressPercent] = useState<number>(0);
    const [ocrError, setOcrError] = useState<string>('');
    const [screenshotTimestamp, setScreenshotTimestamp] = useState<string>('');

    // 4. Dữ liệu ST sau trích xuất / nhập tay
    const [storesData, setStoresData] = useState<StoreReportingData[]>([]);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [modalToast, setModalToast] = useState<string>('');

    // Tự động nạp số liệu từ existingSessions khi mở modal ở tab rà soát & chỉnh sửa (manual)
    useEffect(() => {
        if (isOpen && initialTab === 'manual' && storesData.length === 0 && existingSessions && existingSessions.length > 0) {
            const converted = convertSessionsToStoreReportingData(existingSessions);
            setStoresData(converted);
            if (existingSessions[0]?.screenshot_time_str) {
                setScreenshotTimestamp(existingSessions[0].screenshot_time_str);
            }
        }
    }, [isOpen, initialTab, existingSessions, storesData.length]);

    // Nạp thủ công số liệu phiên Cloud hiện tại vào bảng chỉnh sửa
    const handleLoadFromCloudSession = () => {
        if (!existingSessions || existingSessions.length === 0) {
            showToast('⚠️ Không có phiên dữ liệu nào trên Cloud để nạp!');
            return;
        }
        const converted = convertSessionsToStoreReportingData(existingSessions);
        setStoresData(converted);
        if (existingSessions[0]?.screenshot_time_str) {
            setScreenshotTimestamp(existingSessions[0].screenshot_time_str);
        }
        showToast(`✅ Đã nạp thành công số liệu ${converted.length} ST từ phiên Cloud!`);
    };

    // Nạp key từ cloud khi mở modal
    useEffect(() => {
        if (!isOpen) return;
        fetchAdminGeminiKeyCloud().then(() => {
            setKeyInfo(resolveActiveGeminiKey());
        });
    }, [isOpen]);

    // Focus & Escape key handler
    useEffect(() => {
        if (!isOpen) return;
        closeBtnRef.current?.focus();
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isKeyModalOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isKeyModalOpen, onClose]);

    useEffect(() => {
        return () => {
            if (toastTimerRef.current) {
                window.clearTimeout(toastTimerRef.current);
            }
        };
    }, []);

    const showToast = (msg: string) => {
        setModalToast(msg);
        if (toastTimerRef.current) {
            window.clearTimeout(toastTimerRef.current);
        }
        toastTimerRef.current = window.setTimeout(() => setModalToast(''), 3500);
    };

    if (!isOpen) return null;

    // Chạy OCR trích xuất ảnh
    const handleRunOcr = async () => {
        const activeKey = keyInfo.key;
        if (!activeKey) {
            setIsKeyModalOpen(true);
            return;
        }

        const hasEmulation = emulationMode === 'CLUSTER'
            ? emulationFiles.length > 0
            : singleStoreEmulations.some(e => e.files.length > 0);

        if (qdFiles.length === 0 && installmentFiles.length === 0 && !hasEmulation) {
            showToast('⚠️ Vui lòng chọn ít nhất 1 ảnh (Doanh thu QĐ, % Tỷ trọng trả góp hoặc Thi đua)!');
            return;
        }

        setIsExtracting(true);
        setOcrError('');
        setProgressText('Đang kết nối mô hình Gemini Vision...');
        setProgressPercent(10);

        try {
            const result = await extractAndMergeAllImages(
                activeKey,
                {
                    qdFiles,
                    installmentFiles,
                    emulationFiles,
                    emulationMode,
                    singleStoreEmulations,
                    knownStores: availableStores
                },
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
            showToast(`✅ Đã bóc tách thành công số liệu ${result.stores.length} ST!`);
            setTimeout(() => {
                setIsExtracting(false);
                setActiveTab('manual');
            }, 900);
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
            showToast('⚠️ Chưa có dữ liệu ST để lưu!');
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

            // Kiểm tra phân quyền nạp và lưu dữ liệu ST
            if (!effectiveIsAdmin) {
                const unauthorizedStores = sessions.filter(s =>
                    !canAccessStore(s.store_name) &&
                    !canAccessStore(getShortStoreName(s.store_name))
                );
                if (unauthorizedStores.length > 0) {
                    const unauthorizedNames = unauthorizedStores.map(s => formatStoreDisplayName(s.store_name)).join(', ');
                    showToast(`❌ Bạn không có quyền nạp/lưu dữ liệu cho các ST: ${unauthorizedNames}. Vui lòng chỉ nạp cho ST bạn được phân quyền phụ trách!`);
                    setIsSaving(false);
                    return;
                }
            }

            const res = await saveRealtimeStoreSessions(sessions, currentUserName);

            if (!res.success) {
                if (res.isTableMissing) {
                    showToast('⚠️ Bảng realtime_store_sessions chưa được tạo trên cloud!');
                } else {
                    showToast(`⚠️ Lỗi lưu dữ liệu: ${res.error}`);
                }
                setIsSaving(false);
                return;
            }

            showToast(`🎉 Đã lưu thành công phiên Realtime cho ${sessions.length} ST lên Cloud!`);
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

    return createPortal(
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="realtime-update-modal-title"
            className="!mt-0 fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50"
        >
            <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
                {/* Header Modal */}
                <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-sm shrink-0">
                            <Sparkles className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <div>
                            <h2 id="realtime-update-modal-title" className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2 flex-wrap">
                                <span>{effectiveIsAdmin ? 'Nạp Dữ Liệu Realtime (Cả Cụm)' : 'Nạp Doanh Thu & Thi Đua Realtime'}</span>
                                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/40">
                                    Cloud Realtime
                                </span>
                            </h2>
                            <p className="text-xs text-slate-300 mt-0.5">
                                Mỗi ST lưu duy nhất 1 phiên mới nhất
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            aria-label="Cài đặt Gemini API Key"
                            onClick={() => setIsKeyModalOpen(true)}
                            className="p-2 hover:bg-slate-800 rounded-xl text-slate-200 hover:text-white transition cursor-pointer border border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                            title="Cài đặt Gemini API Key"
                        >
                            <KeyRound className="w-4 h-4 text-amber-400" aria-hidden="true" />
                        </button>
                        <button
                            ref={closeBtnRef}
                            type="button"
                            aria-label="Đóng hộp thoại nạp dữ liệu Realtime"
                            onClick={onClose}
                            className="p-2 hover:bg-slate-800 rounded-xl text-slate-300 hover:text-white transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                        >
                            <X className="w-5 h-5" aria-hidden="true" />
                        </button>
                    </div>
                </div>

                {/* Subheader & Tabs Chuyển đổi */}
                <div className="bg-slate-100 p-2.5 sm:px-5 flex items-center justify-between border-b border-slate-200 flex-wrap gap-2">
                    <div role="tablist" aria-label="Chế độ nhập liệu Realtime" className="flex items-center p-1 bg-white rounded-xl border border-slate-200 shadow-inner">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTab === 'ocr'}
                            onClick={() => setActiveTab('ocr')}
                            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${activeTab === 'ocr'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-slate-700 hover:text-slate-900'
                                }`}
                        >
                            <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>1. Tải Ảnh</span>
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTab === 'manual'}
                            onClick={() => setActiveTab('manual')}
                            className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${activeTab === 'manual'
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'text-slate-700 hover:text-slate-900'
                                }`}
                        >
                            <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>2. Rà Soát &amp; Nhập ({storesData.length} ST)</span>
                        </button>
                    </div>

                    {screenshotTimestamp && (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                            <Clock className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
                            <span>Giờ chụp ảnh: <strong className="text-blue-700 tabular-nums">{screenshotTimestamp}</strong></span>
                        </div>
                    )}
                </div>

                {/* Toast thông báo trong modal */}
                {modalToast && (
                    <div role="status" aria-live="polite" className="bg-slate-800 text-white px-4 py-2 text-xs font-bold text-center border-b border-slate-700">
                        {modalToast}
                    </div>
                )}

                {/* Nội dung cuộn chính */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
                    {/* Lỗi OCR nếu có */}
                    {ocrError && (
                        <div role="alert" className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
                            <div className="flex-1">
                                <strong className="block font-bold">Lỗi trích xuất:</strong>
                                <span>{ocrError}</span>
                            </div>
                        </div>
                    )}

                    {activeTab === 'ocr' ? (
                        <div className="space-y-4">
                            <OcrUploadZone
                                mode="STORE"
                                qdFiles={qdFiles}
                                onQdFilesChange={setQdFiles}
                                installmentFiles={installmentFiles}
                                onInstallmentFilesChange={setInstallmentFiles}
                                emulationFiles={emulationFiles}
                                onEmulationFilesChange={setEmulationFiles}
                                hasGeminiKey={Boolean(keyInfo.key)}
                                keySource={keyInfo.source}
                                isQuotaExceeded={isQuotaExceeded}
                                onOpenKeyModal={() => setIsKeyModalOpen(true)}
                                onRunOcr={handleRunOcr}
                                isExtracting={isExtracting}
                                progressText={progressText}
                                progressPercent={progressPercent}
                                emulationMode={emulationMode}
                                onEmulationModeChange={setEmulationMode}
                                selectableStores={selectableStores}
                                singleStoreEmulations={singleStoreEmulations}
                                onSingleStoreEmulationsChange={setSingleStoreEmulations}
                            />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {existingSessions && existingSessions.length > 0 && (
                                <div className="flex items-center justify-between p-3 sm:px-4 bg-blue-50/80 border border-blue-200 rounded-2xl flex-wrap gap-2.5 shadow-sm">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                                            <Database className="w-4 h-4" aria-hidden="true" />
                                        </div>
                                        <div>
                                            <span className="text-xs text-blue-950 font-bold block">
                                                Phiên Cloud hiện tại: <strong className="text-blue-700 tabular-nums">{existingSessions.length} ST</strong>
                                                {existingSessions[0]?.screenshot_time_str ? ` • Giờ chụp: ${existingSessions[0].screenshot_time_str}` : ''}
                                            </span>
                                            <span className="text-[11px] text-slate-600">
                                                Có thể nạp toàn bộ số liệu phiên Cloud vào bảng để rà soát hoặc điều chỉnh số liệu
                                            </span>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleLoadFromCloudSession}
                                        className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                        title="Nạp toàn bộ số liệu của các ST từ phiên Cloud vào giao diện để chỉnh sửa"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                                        <span>Nạp số liệu phiên Cloud</span>
                                    </button>
                                </div>
                            )}

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
                                isRealtime={true}
                                showMonthReportLink={false}
                            />
                        </div>
                    )}
                </div>

                {/* Footer Modal với nút Lưu Cloud */}
                <div className="bg-slate-50 p-3.5 sm:px-5 border-t border-slate-200 flex items-center justify-between flex-wrap gap-2">
                    <div className="text-xs text-slate-600 font-medium">
                        {storesData.length > 0
                            ? `Đã nạp ${storesData.length} ST sẵn sàng đẩy lên Cloud`
                            : 'Chưa có số liệu ST'}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-200 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                        >
                            Đóng
                        </button>

                        <button
                            type="button"
                            onClick={handleSaveToCloud}
                            disabled={isSaving || storesData.length === 0}
                            className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition shadow-sm cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                        >
                            {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Save className="w-3.5 h-3.5" aria-hidden="true" />}
                            <span>{isSaving ? 'Đang lưu Cloud...' : 'Lưu Phiên Realtime Lên Cloud'}</span>
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
        </div>,
        document.body
    );
}

