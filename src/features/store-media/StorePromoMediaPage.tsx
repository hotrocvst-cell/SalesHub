import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Radio,
    Camera,
    RefreshCw,
    Building2,
    Shield,
    Music,
    Sliders
} from 'lucide-react';
import { useAuth } from '../../shared/contexts/AuthContext';
import { fetchStores, type StoreItem } from '../../core/lib/storage';
import { getShortStoreName, isStoreMatch } from '../../core/lib/formatters';
import CloudDataSyncStatusBanner from '../../shared/components/report/CloudDataSyncStatusBanner';
import type { PromoAudioItem } from './types';
import {
    fetchPromoAudioLibrary,
    checkPromoAudioTableReady,
    PROMO_AUDIO_SQL_DDL,
    cacheAudioBlobLocally
} from './services/promoAudioStorageService';
import { useGeolocationTracker } from './hooks/useGeolocationTracker';
import { usePromoAudioPlayer } from './hooks/usePromoAudioPlayer';
import { useWatermarkVideoRecorder } from './hooks/useWatermarkVideoRecorder';
import StorePromoAudioController from './components/StorePromoAudioController';
import LiveCameraWatermarkViewport from './components/LiveCameraWatermarkViewport';
import VideoRecorderActions from './components/VideoRecorderActions';
import PromoAudioConfigModal from './components/PromoAudioConfigModal';

export default function StorePromoMediaPage() {
    const { currentUser, isAdmin, canAccessStore } = useAuth();

    // 1. Danh sách ST & Chọn ST (Quy chuẩn #10)
    const [availableStores, setAvailableStores] = useState<StoreItem[]>([]);
    const [selectedStoreName, setSelectedStoreName] = useState<string>('');

    // 2. Trạng thái Cloud & SQL Banner (Quy chuẩn #8 & #12)
    const [tableReady, setTableReady] = useState<boolean>(true);
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

    // 3. Thư viện Audio
    const [cloudPlaylist, setCloudPlaylist] = useState<PromoAudioItem[]>([]);
    const [localPlaylist, setLocalPlaylist] = useState<PromoAudioItem[]>([]);
    const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);

    // Tải danh sách ST
    useEffect(() => {
        fetchStores().then(res => {
            if (res.success && res.data && res.data.length > 0) {
                setAvailableStores(res.data);
                const firstAllowed = res.data.find(s => isAdmin || canAccessStore(s.name) || canAccessStore(s.code));
                if (firstAllowed) {
                    setSelectedStoreName(firstAllowed.name);
                } else {
                    setSelectedStoreName(res.data[0].name);
                }
            }
        });
    }, [isAdmin, canAccessStore]);

    // ST hiện tại được chọn
    const currentStore = useMemo(() => {
        return availableStores.find(s => isStoreMatch(s.name, selectedStoreName, availableStores)) || null;
    }, [availableStores, selectedStoreName]);

    const currentStoreCode = currentStore?.code || '';

    // Tải thư viện Audio từ Cloud theo ST
    const loadAudioLibrary = useCallback(async () => {
        const ready = await checkPromoAudioTableReady();
        setTableReady(ready);

        if (ready) {
            const res = await fetchPromoAudioLibrary(currentStoreCode);
            if (res.success) {
                setCloudPlaylist(res.data);
                setLastSyncTime(new Date());
            }
        }
    }, [currentStoreCode]);

    useEffect(() => {
        loadAudioLibrary();
    }, [loadAudioLibrary]);

    // Gộp playlist Cloud và bài nạp từ máy
    const combinedPlaylist = useMemo(() => {
        return [...localPlaylist, ...cloudPlaylist];
    }, [localPlaylist, cloudPlaylist]);

    // 4. Hook Định vị GPS & Đối soát ST
    const geoInfo = useGeolocationTracker(currentStore);

    // 5. Hook Trình phát Audio Loa KM
    const audioPlayer = usePromoAudioPlayer();

    // 6. Hook Ghi hình Video có Watermark 3 lớp
    const recorder = useWatermarkVideoRecorder({
        geoInfo,
        promoAudioStream: audioPlayer.audioStream,
        storeName: currentStore?.name || selectedStoreName,
        storeCode: currentStoreCode,
        employeeName: currentUser?.full_name || '',
        employeeId: currentUser?.employee_id || ''
    });

    // Xử lý nạp file âm thanh cục bộ từ máy
    const handleAddLocalFile = useCallback(async (file: File) => {
        const localId = `local_${Date.now()}`;
        const blobUrl = URL.createObjectURL(file);
        const newItem: PromoAudioItem = {
            id: localId,
            title: file.name.replace(/\.[^/.]+$/, ''),
            sourceType: 'local_file',
            storeCodes: currentStoreCode ? [currentStoreCode] : [],
            blobUrl,
            isActive: true
        };

        setLocalPlaylist(prev => [newItem, ...prev]);
        audioPlayer.selectAudio(newItem);
        await cacheAudioBlobLocally(localId, file, newItem.title);
    }, [currentStoreCode, audioPlayer]);

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
                        <Building2 className="w-5 h-5 text-purple-600 shrink-0" />
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                Chọn ST phát loa &amp; ghi hình:
                            </label>
                            <select
                                value={selectedStoreName}
                                onChange={e => setSelectedStoreName(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-300 text-slate-900 font-bold py-1.5 px-2.5 rounded-xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                            >
                                {availableStores.map(s => {
                                    const allowed = isAdmin || canAccessStore(s.name) || canAccessStore(s.code);
                                    if (!allowed) return null;
                                    return (
                                        <option key={s.code} value={s.name}>
                                            ST {s.code} - {s.short_name || s.name}
                                        </option>
                                    );
                                })}
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
                selectedStoreName={getShortStoreName(selectedStoreName)}
                isAdmin={isAdmin}
                onSelectAudio={audioPlayer.selectAudio}
                onTogglePlay={audioPlayer.togglePlay}
                onToggleLoop={audioPlayer.toggleLoop}
                onChangeVolume={audioPlayer.changeVolume}
                onSeek={audioPlayer.seek}
                onAddLocalFile={handleAddLocalFile}
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

            {/* Modal Cấu hình Drive dành cho Admin */}
            {isAdmin && (
                <PromoAudioConfigModal
                    isOpen={isConfigModalOpen}
                    onClose={() => setIsConfigModalOpen(false)}
                    availableStores={availableStores}
                    currentStoreCode={currentStoreCode}
                    existingItems={cloudPlaylist}
                    onRefresh={loadAudioLibrary}
                    userName={currentUser?.full_name || 'ADMIN'}
                />
            )}
        </div>
    );
}
