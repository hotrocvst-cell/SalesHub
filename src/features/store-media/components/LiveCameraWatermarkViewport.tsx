import React, { useState } from 'react';
import {
    Camera,
    RotateCcw,
    Zap,
    ZapOff,
    MapPin,
    AlertTriangle,
    ShieldCheck,
    Check,
    X
} from 'lucide-react';
import type { GeoLocationInfo } from '../types';
import type { CameraHardwareCaps, RearCameraCandidate } from '../utils/cameraSelector';

interface Props {
    videoRef: React.RefObject<HTMLVideoElement>;
    canvasRef: React.RefObject<HTMLCanvasElement>;
    isCameraActive: boolean;
    activeCameraLabel: string;
    activeDeviceId: string;
    activeHardwareCaps: CameraHardwareCaps | null;
    rearCameras: RearCameraCandidate[];
    isAdmin: boolean;
    hasTorch: boolean;
    isTorchOn: boolean;
    cameraError: string | null;
    geoInfo: GeoLocationInfo;
    storeName: string;
    storeCode: string;
    onRetryCamera: () => void;
    onPinRearCamera: (deviceId: string) => void;
    onResetAutoCamera: () => void;
    onToggleTorch: () => void;
}

export default function LiveCameraWatermarkViewport({
    videoRef,
    canvasRef,
    activeCameraLabel,
    activeDeviceId,
    activeHardwareCaps,
    rearCameras,
    isAdmin,
    hasTorch,
    isTorchOn,
    cameraError,
    geoInfo,
    onRetryCamera,
    onPinRearCamera,
    onResetAutoCamera,
    onToggleTorch
}: Props) {
    const [showDiagnostics, setShowDiagnostics] = useState(false);

    return (
        <div className="relative w-full aspect-[9/14] sm:aspect-[9/13] max-h-[580px] bg-slate-950 rounded-3xl overflow-hidden border-2 border-slate-800 shadow-xl flex flex-col justify-between">
            {/* Video ngầm để feed hình ảnh vào canvas */}
            <video
                ref={videoRef}
                playsInline
                muted
                className="hidden"
            />

            {/* Canvas vẽ camera + Watermark thời gian thực */}
            <canvas
                ref={canvasRef}
                className="w-full h-full object-cover"
            />

            {/* Thông báo lỗi nếu camera bị chặn */}
            {cameraError && (
                <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center text-white space-y-3 z-20">
                    <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
                        <AlertTriangle className="w-6 h-6" aria-hidden="true" />
                    </div>
                    <p className="text-xs text-rose-200 font-bold max-w-xs">{cameraError}</p>
                    <button
                        type="button"
                        onClick={onRetryCamera}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-600 transition cursor-pointer"
                    >
                        <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Thử mở lại camera chính</span>
                    </button>
                </div>
            )}

            {/* Thanh công cụ nổi trên đầu khung hình */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 z-10">
                {/* Huy hiệu định vị GPS */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-white text-[10.5px] font-bold shadow-md">
                    {geoInfo.latitude !== null ? (
                        geoInfo.isWithinStoreRange ? (
                            <span className="flex items-center gap-1 text-emerald-400">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                                <span>Đúng ST ({geoInfo.accuracy ? `±${geoInfo.accuracy}m` : 'GPS'})</span>
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 text-amber-400">
                                <MapPin className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                                <span>Ngoài ST ({geoInfo.accuracy ? `±${geoInfo.accuracy}m` : 'GPS'})</span>
                            </span>
                        )
                    ) : (
                        <span className="flex items-center gap-1 text-slate-400">
                            <span className="w-2 h-2 rounded-full bg-slate-400 animate-pulse" />
                            <span>Đang định vị GPS...</span>
                        </span>
                    )}
                </div>

                {/* Chỉ báo Camera chính 1x & nút đèn Flash */}
                <div className="flex items-center gap-1.5">
                    {isAdmin ? (
                        <button
                            type="button"
                            onClick={() => setShowDiagnostics(prev => !prev)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900/80 hover:bg-slate-800 backdrop-blur-md border border-slate-700/60 text-sky-300 text-[10.5px] font-bold shadow-md cursor-pointer transition"
                            title={activeCameraLabel ? `Đang cố định camera chính: ${activeCameraLabel} (Chạm để xem chi tiết Admin)` : 'Camera chính (1x)'}
                        >
                            <Camera className="w-3.5 h-3.5 text-sky-400 shrink-0" aria-hidden="true" />
                            <span>Camera chính</span>
                        </button>
                    ) : (
                        <div
                            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-sky-300 text-[10.5px] font-bold shadow-md select-none"
                            title={activeCameraLabel ? `Đang cố định camera chính: ${activeCameraLabel}` : 'Mặc định duy nhất camera chính (1x)'}
                        >
                            <Camera className="w-3.5 h-3.5 text-sky-400 shrink-0" aria-hidden="true" />
                            <span>Camera chính</span>
                        </div>
                    )}

                    {hasTorch && (
                        <button
                            type="button"
                            onClick={onToggleTorch}
                            aria-label={isTorchOn ? 'Tắt đèn flash' : 'Bật đèn flash'}
                            className={`p-2 rounded-full backdrop-blur-md border transition cursor-pointer ${
                                isTorchOn
                                    ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md'
                                    : 'bg-slate-900/80 text-white border-slate-700 hover:bg-slate-800'
                            }`}
                            title={isTorchOn ? 'Tắt đèn flash' : 'Bật đèn flash'}
                        >
                            {isTorchOn ? <Zap className="w-4 h-4 fill-current" aria-hidden="true" /> : <ZapOff className="w-4 h-4" aria-hidden="true" />}
                        </button>
                    )}
                </div>
            </div>

            {/* Bảng chẩn đoán & hiệu chỉnh ống kính sau 1x (CHỈ dành cho Admin khi kiểm tra thiết bị nhiều camera) */}
            {isAdmin && showDiagnostics && (
                <div className="absolute top-12 right-3 left-3 sm:left-auto sm:w-80 bg-slate-950/95 backdrop-blur-md border border-slate-700 rounded-2xl p-3 text-white shadow-2xl z-30 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-black text-sky-300 uppercase tracking-wide">
                            Chẩn đoán Camera chính (Admin)
                        </span>
                        <button
                            type="button"
                            onClick={() => setShowDiagnostics(false)}
                            aria-label="Đóng chẩn đoán camera"
                            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                    </div>

                    <div className="text-[10.5px] bg-slate-900 rounded-xl p-2 border border-slate-800 space-y-0.5">
                        <p className="font-bold text-slate-200 truncate" title={activeCameraLabel}>
                            Đang mở: <span className="text-emerald-400">{activeCameraLabel}</span>
                        </p>
                        {activeHardwareCaps && (
                            <p className="text-slate-400 text-[10px]">
                                Flash: <strong className="text-slate-200">{activeHardwareCaps.hasTorch ? 'Có' : 'Không'}</strong>
                                {' · '}AF: <strong className="text-slate-200">{activeHardwareCaps.hasContinuousFocus ? 'Liên tục' : 'Cơ bản'}</strong>
                                {activeHardwareCaps.zoomMin !== null && activeHardwareCaps.zoomMax !== null && (
                                    <> · Zoom: <strong className="text-slate-200">{activeHardwareCaps.zoomMin}–{activeHardwareCaps.zoomMax}x</strong></>
                                )}
                            </p>
                        )}
                    </div>

                    {rearCameras.length > 0 && (
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                            <p className="text-[10px] font-bold text-slate-400">
                                Ống kính sau thiết bị báo ({rearCameras.length}):
                            </p>
                            {rearCameras.map((cam, idx) => {
                                const isActive = cam.deviceId === activeDeviceId;
                                return (
                                    <button
                                        key={cam.deviceId}
                                        type="button"
                                        onClick={() => {
                                            onPinRearCamera(cam.deviceId);
                                            setShowDiagnostics(false);
                                        }}
                                        className={`w-full text-left px-2.5 py-1.5 rounded-xl text-[10.5px] flex items-center justify-between gap-2 border transition cursor-pointer ${
                                            isActive
                                                ? 'bg-sky-500/20 border-sky-400/60 text-sky-200 font-bold'
                                                : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:bg-slate-800'
                                        }`}
                                    >
                                        <span className="truncate">
                                            #{idx + 1} · {cam.label}
                                        </span>
                                        {isActive && <Check className="w-3.5 h-3.5 text-sky-400 shrink-0" aria-hidden="true" />}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={() => {
                            onResetAutoCamera();
                            setShowDiagnostics(false);
                        }}
                        className="w-full py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10.5px] font-bold border border-slate-700 transition cursor-pointer"
                    >
                        Tự động dò lại Camera chính (1x)
                    </button>
                </div>
            )}

            {/* Thông báo watermark sống ở đáy canvas */}
            <div className="absolute bottom-2 left-3 text-[10px] text-slate-400 font-bold bg-slate-950/60 px-2 py-0.5 rounded backdrop-blur-xs pointer-events-none">
                Watermark thời gian thực được khắc trực tiếp vào video
            </div>
        </div>
    );
}
