import React from 'react';
import {
    Camera,
    RefreshCw,
    Zap,
    ZapOff,
    MapPin,
    AlertTriangle,
    ShieldCheck
} from 'lucide-react';
import type { GeoLocationInfo } from '../types';

interface Props {
    videoRef: React.RefObject<HTMLVideoElement>;
    canvasRef: React.RefObject<HTMLCanvasElement>;
    isCameraActive: boolean;
    facingMode: 'environment' | 'user';
    hasTorch: boolean;
    isTorchOn: boolean;
    cameraError: string | null;
    geoInfo: GeoLocationInfo;
    storeName: string;
    storeCode: string;
    onToggleCameraFacing: () => void;
    onToggleTorch: () => void;
}

export default function LiveCameraWatermarkViewport({
    videoRef,
    canvasRef,
    isCameraActive,
    facingMode,
    hasTorch,
    isTorchOn,
    cameraError,
    geoInfo,
    storeName,
    storeCode,
    onToggleCameraFacing,
    onToggleTorch
}: Props) {
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
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <p className="text-xs text-rose-200 font-bold max-w-xs">{cameraError}</p>
                </div>
            )}

            {/* Thanh công cụ nổi trên đầu khung hình */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 z-10">
                {/* Huy hiệu định vị GPS */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-white text-[10.5px] font-bold shadow-md">
                    {geoInfo.latitude !== null ? (
                        geoInfo.isWithinStoreRange ? (
                            <span className="flex items-center gap-1 text-emerald-400">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Đúng ST ({geoInfo.accuracy ? `±${geoInfo.accuracy}m` : 'GPS'})</span>
                            </span>
                        ) : (
                            <span className="flex items-center gap-1 text-amber-400">
                                <MapPin className="w-3.5 h-3.5 text-amber-400" />
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

                {/* Các nút điều khiển camera */}
                <div className="flex items-center gap-1.5">
                    {hasTorch && (
                        <button
                            type="button"
                            onClick={onToggleTorch}
                            className={`p-2 rounded-full backdrop-blur-md border transition cursor-pointer ${
                                isTorchOn
                                    ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md'
                                    : 'bg-slate-900/80 text-white border-slate-700 hover:bg-slate-800'
                            }`}
                            title={isTorchOn ? 'Tắt đèn flash' : 'Bật đèn flash'}
                        >
                            {isTorchOn ? <Zap className="w-4 h-4 fill-current" /> : <ZapOff className="w-4 h-4" />}
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={onToggleCameraFacing}
                        className="p-2 rounded-full bg-slate-900/80 text-white border border-slate-700 hover:bg-slate-800 backdrop-blur-md transition cursor-pointer"
                        title="Đổi camera trước / sau"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Thông báo watermark sống ở đáy canvas */}
            <div className="absolute bottom-2 left-3 text-[10px] text-slate-400 font-bold bg-slate-950/60 px-2 py-0.5 rounded backdrop-blur-xs pointer-events-none">
                Watermark thời gian thực được khắc trực tiếp vào video
            </div>
        </div>
    );
}
