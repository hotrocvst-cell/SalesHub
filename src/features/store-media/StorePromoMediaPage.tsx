import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    RefreshCw,
    Building2,
    Lock
} from 'lucide-react';
import { useAuth } from '../../shared/contexts/AuthContext';
import { useUserStoreFilter } from '../../shared/hooks/useUserStoreFilter';
import { fetchStores, type StoreItem } from '../../core/lib/storage';
import { getShortStoreName, isStoreMatch } from '../../core/lib/formatters';
import CloudDataSyncStatusBanner from '../../shared/components/report/CloudDataSyncStatusBanner';
import type { PromoAudioItem } from './types';
import {
    fetchPromoAudioLibrary,
    checkPromoAudioTableReady,
    PROMO_AUDIO_SQL_DDL,
    cacheAudioBlobLocally,
    loadPersistedLocalAudioItems,
    removeCachedAudioBlob
} from './services/promoAudioStorageService';
import { useGeolocationTracker } from './hooks/useGeolocationTracker';
import { usePromoAudioPlayer } from './hooks/usePromoAudioPlayer';
import { useWatermarkVideoRecorder } from './hooks/useWatermarkVideoRecorder';
import StorePromoAudioController from './components/StorePromoAudioController';
import LiveCameraWatermarkViewport from './components/LiveCameraWatermarkViewport';
import VideoRecorderActions from './components/VideoRecorderActions';
import PromoAudioConfigModal from './components/PromoAudioConfigModal';

export default function StorePromoMediaPage() {
    const { currentUser, isAdmin } = useAuth();

    // 1. Danh sách ST & Chọn ST theo phân quyền tài khoản (Quy chuẩn #10)
    const [availableStores, setAvailableStores] = useState<StoreItem[]>([]);
    const [selectedStoreName, setSelectedStoreName] = useState<string>('');

    const { allowedStores, isLockedToSingleStore } = useUserStoreFilter(
        availableStores,
        selectedStoreName,
        setSelectedStoreName
    );
    const isStoreSelectLocked = isLockedToSingleStore || (!isAdmin && allowedStores.length <= 1);

    // 2. Trạng thái Cloud & SQL Banner (Quy chuẩn #8 & #12)
    const [tableReady, setTableReady] = useState<boolean>(true);
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

    // 3. Thư viện Audio (lưu toàn bộ metadata Cloud < 2KB để lọc mượt theo từng ST không gọi lại mạng)
    const [allCloudItems, setAllCloudItems] = useState<PromoAudioItem[]>([]);
    const [localPlaylist, setLocalPlaylist] = useState<PromoAudioItem[]>([]);
    const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);

    // Quyền mở cấu hình Audio Cloud: ADMIN, QUAN_LY, TRUONG_CA (khóa với NHAN_VIEN và tài khoản trải nghiệm)
    const canConfigureAudio =
        !currentUser?.is_guest &&
        (isAdmin || currentUser?.role === 'QUAN_LY' || currentUser?.role === 'TRUONG_CA');

    // Tải danh sách ST hệ thống
    useEffect(() => {
        fetchStores().then(res => {
            if (res.success && res.data && res.data.length > 0) {
                setAvailableStores(res.data);
            }
        });
    }, []);

    // Tự động chọn ST đầu tiên nằm trong phạm vi phân quyền của user
    useEffect(() => {
        if (allowedStores.length === 0) return;
        const stillAllowed = selectedStoreName && allowedStores.some(s => isStoreMatch(s.name, selectedStoreName, allowedStores));
        if (!stillAllowed) {
            setSelectedStoreName(allowedStores[0].name);
        }
    }, [allowedStores, selectedStoreName]);

    // ST hiện tại được chọn (chỉ nằm trong phạm vi allowedStores)
    const currentStore = useMemo(() => {
        return allowedStores.find(s => isStoreMatch(s.name, selectedStoreName, allowedStores)) || allowedStores[0] || null;
    }, [allowedStores, selectedStoreName]);

    const currentStoreCode = currentStore?.code || '';

    // Tải thư viện Audio từ Cloud (chỉ metadata nhẹ < 2KB)
    const loadAudioLibrary = useCallback(async () => {
        const ready = await checkPromoAudioTableReady();
        setTableReady(ready);

        if (ready) {
            const res = await fetchPromoAudioLibrary();
            if (res.success) {
                setAllCloudItems(res.data);
                setLastSyncTime(new Date());
            }
        }
    }, []);

    useEffect(() => {
        loadAudioLibrary();
    }, [loadAudioLibrary]);

    // Danh sách bài Cloud áp dụng cho ST đang xem
    const cloudPlaylist = useMemo(() => {
        if (!currentStoreCode) return allCloudItems;
        return allCloudItems.filter(
            item => item.storeCodes.length === 0 || item.storeCodes.includes(currentStoreCode)
        );
    }, [allCloudItems, currentStoreCode]);

    // Danh sách bài Cloud hiển thị trong Modal Cấu hình (Admin: toàn bộ; QL/TC: các bài thuộc phạm vi ST phụ trách)
    const manageableCloudItems = useMemo(() => {
        if (isAdmin) return allCloudItems;
        const allowedCodeSet = new Set(allowedStores.map(s => s.code).filter(Boolean));
        return allCloudItems.filter(
            item =>
                item.storeCodes.length === 0 ||
                item.storeCodes.some(code => allowedCodeSet.has(code))
        );
    }, [allCloudItems, allowedStores, isAdmin]);

    // Nạp lại danh sách file âm thanh đã lưu cục bộ trên máy (IndexedDB) theo ST hiện tại
    useEffect(() => {
        let active = true;
        loadPersistedLocalAudioItems(currentStoreCode).then(items => {
            if (active) setLocalPlaylist(items);
        });
        return () => {
            active = false;
        };
    }, [currentStoreCode]);

    // Gộp playlist Cloud và bài nạp từ máy
    const combinedPlaylist = useMemo(() => {
        return [...localPlaylist, ...cloudPlaylist];
    }, [localPlaylist, cloudPlaylist]);

    // 4. Hook Định vị GPS & Đối soát ST
    const geoInfo = useGeolocationTracker(currentStore);

    // 5. Hook Trình phát Audio Loa KM (hỗ trợ phát liên tục & lặp cả danh sách nhiều file)
    const audioPlayer = usePromoAudioPlayer(combinedPlaylist);

    // 6. Hook Ghi hình Video có Watermark 3 lớp
    const recorder = useWatermarkVideoRecorder({
        geoInfo,
        promoAudioStream: audioPlayer.audioStream,
        storeName: currentStore?.name || selectedStoreName,
        storeCode: currentStoreCode,
        employeeName: currentUser?.full_name || '',
        employeeId: currentUser?.employee_id || ''
    });

    // Xử lý nạp 1 hoặc nhiều file âm thanh cục bộ từ máy (lưu vĩnh viễn vào IndexedDB, 0 KB Cloud)
    const handleAddLocalFiles = useCallback(async (files: File[]) => {
        if (files.length === 0) return;
        const createdItems: PromoAudioItem[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const localId = `local_${Date.now()}_${i}`;
            const blobUrl = URL.createObjectURL(file);
            const title = file.name.replace(/\.[^/.]+$/, '');
            const newItem: PromoAudioItem = {
                id: localId,
                title,
                sourceType: 'local_file',
                storeCodes: currentStoreCode ? [currentStoreCode] : [],
                blobUrl,
                isCachedLocally: true,
                isActive: true
            };
            createdItems.push(newItem);
            await cacheAudioBlobLocally(localId, file, title, currentStoreCode);
        }

        setLocalPlaylist(prev => [...createdItems, ...prev]);
        if (createdItems[0]) {
            audioPlayer.selectAudio(createdItems[0]);
        }
    }, [currentStoreCode, audioPlayer]);

    const handleRemoveLocalFile = useCallback(async (id: string) => {
        setLocalPlaylist(prev => {
            const target = prev.find(item => item.id === id);
            if (target?.blobUrl) URL.revokeObjectURL(target.blobUrl);
            return prev.filter(item => item.id !== id);
        });
        if (audioPlayer.currentAudio?.id === id) {
            audioPlayer.clearCurrentAudio();
        }
        await removeCachedAudioBlob(id);
    }, [audioPlayer]);

    return (
        <div className="space-y-4 max-w-4xl mx-auto pb-12 px-2 sm:px-4">
            {/* Banner Báo cáo trạng thái lưu trữ dữ liệu (Quy chuẩn #8 & #12) */}
            <CloudDataSyncStatusBanner
                storageType={tableReady ? 'cloud' : 'local'}
                syncStatus={tableReady ? 'synced' : 'unsynced'}
                tableReady={tableReady}
                tableName="promo_audio_library"
                sqlDdl={isAdmin ? PROMO_AUDIO_SQL_DDL : undefined}
                lastSyncTime={lastSyncTime}
                customMessage={`Thư viện bài phát thanh KM ST [${getShortStoreName(selectedStoreName) || 'ST'}]`}
                compact={true}
            />

            {/* QUY CHUẨN #10: BỘ LỌC CHỌN ST Ở DÒNG ĐẦU TIÊN & NẰM RIÊNG LẺ 1 DÒNG */}
            <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-xs">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                        <Building2 className="w-5 h-5 text-purple-600 shrink-0" aria-hidden="true" />
                        <div className="flex-1">
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                                <label htmlFor="promo-media-store-select" className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                    Chọn ST phát loa &amp; ghi hình:
                                </label>
                                {isStoreSelectLocked && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded-md">
                                        <Lock className="w-2.5 h-2.5" aria-hidden="true" />
                                        <span>Theo phân quyền ST</span>
                                    </span>
                                )}
                            </div>
                            <select
                                id="promo-media-store-select"
                                name="promo_media_store"
                                value={selectedStoreName}
                                disabled={isStoreSelectLocked}
                                onChange={e => setSelectedStoreName(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-300 text-slate-900 font-bold py-1.5 px-2.5 rounded-xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
                            >
                                {allowedStores.map(s => (
                                    <option key={s.code || s.id} value={s.name}>
                                        {s.code ? `ST ${s.code} - ` : ''}{s.short_name || s.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => loadAudioLibrary()}
                            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                            title="Làm mới thư viện audio"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Khối 1: Trình phát Audio Loa KM */}
            <StorePromoAudioController
                playlist={combinedPlaylist}
                currentAudio={audioPlayer.currentAudio}
                isPlaying={audioPlayer.isPlaying}
                isLooping={audioPlayer.isLooping}
                currentTime={audioPlayer.currentTime}
                duration={audioPlayer.duration}
                volume={audioPlayer.volume}
                isLoadingAudio={audioPlayer.isLoadingAudio}
                audioError={audioPlayer.audioError}
                selectedStoreName={getShortStoreName(selectedStoreName)}
                canConfigureAudio={canConfigureAudio}
                onSelectAudio={audioPlayer.selectAudio}
                onTogglePlay={audioPlayer.togglePlay}
                onToggleLoop={audioPlayer.toggleLoop}
                onChangeVolume={audioPlayer.changeVolume}
                onSeek={audioPlayer.seek}
                onAddLocalFiles={handleAddLocalFiles}
                onRemoveLocalFile={handleRemoveLocalFile}
                onOpenConfigModal={() => setIsConfigModalOpen(true)}
            />

            {/* Khối 2: Khung ngắm Camera & Watermark trực quan */}
            <LiveCameraWatermarkViewport
                videoRef={recorder.videoRef}
                canvasRef={recorder.canvasRef}
                isCameraActive={recorder.isCameraActive}
                facingMode={recorder.facingMode}
                hasTorch={recorder.hasTorch}
                isTorchOn={recorder.isTorchOn}
                cameraError={recorder.cameraError}
                geoInfo={geoInfo}
                storeName={currentStore?.name || selectedStoreName}
                storeCode={currentStoreCode}
                onToggleCameraFacing={recorder.toggleCameraFacing}
                onToggleTorch={recorder.toggleTorch}
            />

            {/* Khối 3: Bảng điều khiển Quay Video & Nguồn âm thanh */}
            <VideoRecorderActions
                isRecording={recorder.isRecording}
                recordingSeconds={recorder.recordingSeconds}
                recordingMode={recorder.recordingMode}
                lastRecordedVideo={recorder.lastRecordedVideo}
                storeCode={currentStoreCode}
                onStartRecording={recorder.startRecording}
                onStopRecording={recorder.stopRecording}
                onChangeRecordingMode={recorder.setRecordingMode}
                onClearRecordedVideo={() => recorder.setLastRecordedVideo(null)}
            />

            {/* Modal Cấu hình Audio Cloud dành cho Admin / Quản lý / Trưởng ca */}
            {canConfigureAudio && (
                <PromoAudioConfigModal
                    isOpen={isConfigModalOpen}
                    onClose={() => setIsConfigModalOpen(false)}
                    isAdmin={isAdmin}
                    availableStores={allowedStores}
                    currentStoreCode={currentStoreCode}
                    existingItems={manageableCloudItems}
                    onRefresh={loadAudioLibrary}
                    userName={currentUser?.full_name || currentUser?.employee_id || 'Quản lý'}
                />
            )}
        </div>
    );
}
