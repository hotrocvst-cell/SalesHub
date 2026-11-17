import React, { useState } from 'react';
import {
    Circle,
    Square,
    Mic,
    Radio,
    Sliders,
    Download,
    X,
    CheckCircle,
    Share2,
    Film
} from 'lucide-react';
import type { VideoAudioRecordingMode, RecordedVideoResult } from '../types';

interface Props {
    isRecording: boolean;
    recordingSeconds: number;
    recordingMode: VideoAudioRecordingMode;
    lastRecordedVideo: RecordedVideoResult | null;
    storeCode: string;
    onStartRecording: () => void;
    onStopRecording: () => void;
    onChangeRecordingMode: (mode: VideoAudioRecordingMode) => void;
    onClearRecordedVideo: () => void;
}

function formatTimer(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function VideoRecorderActions({
    isRecording,
    recordingSeconds,
    recordingMode,
    lastRecordedVideo,
    storeCode,
    onStartRecording,
    onStopRecording,
    onChangeRecordingMode,
    onClearRecordedVideo
}: Props) {
    const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);

    const handleDownloadVideo = () => {
        if (!lastRecordedVideo) return;
        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
        const ext = lastRecordedVideo.mimeType.includes('mp4') ? 'mp4' : 'webm';
        const fileName = `Video_Kiem_Tra_ST_${storeCode || 'ST'}_${dateStr}_${timeStr}.${ext}`;

        const a = document.createElement('a');
        a.href = lastRecordedVideo.url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 shadow-md space-y-3">
            {/* Lựa chọn chế độ âm thanh video */}
            <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-800">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-blue-400" />
                    <span>Nguồn tiếng vào Video:</span>
                </span>

                <div className="flex items-center bg-slate-800 p-0.5 rounded-xl border border-slate-700">
                    <button
                        type="button"
                        onClick={() => onChangeRecordingMode('microphone')}
                        disabled={isRecording}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                            recordingMode === 'microphone'
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'text-slate-400 hover:text-white'
                        }`}
                        title="Thu âm thực tế qua Micro (thu tiếng loa ngoài + tiếng nhân viên)"
                    >
                        <Mic className="w-3 h-3" />
                        <span>Microphone</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => onChangeRecordingMode('digital_mix')}
                        disabled={isRecording}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                            recordingMode === 'digital_mix'
                                ? 'bg-purple-600 text-white shadow-xs'
                                : 'text-slate-400 hover:text-white'
                        }`}
                        title="Trộn trực tiếp luồng audio KM kỹ thuật số vào video"
                    >
                        <Radio className="w-3 h-3" />
                        <span>Trộn Nhạc KM</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => onChangeRecordingMode('both')}
                        disabled={isRecording}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                            recordingMode === 'both'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-slate-400 hover:text-white'
                        }`}
                        title="Kết hợp cả Micro và Nhạc KM"
                    >
                        <span>Cả hai</span>
                    </button>
                </div>
            </div>

            {/* Nút bấm Bắt đầu / Dừng quay */}
            <div className="flex items-center justify-center gap-4 py-2">
                {isRecording ? (
                    <div className="flex flex-col items-center gap-2">
                        <button
                            type="button"
                            onClick={onStopRecording}
                            className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 border-4 border-rose-300/40 text-white flex items-center justify-center transition cursor-pointer shadow-lg animate-pulse"
                            title="Dừng quay video"
                        >
                            <Square className="w-6 h-6 fill-current" />
                        </button>
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/80 border border-rose-800 text-rose-300 font-mono text-xs font-bold">
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                            <span>ĐANG QUAY: {formatTimer(recordingSeconds)}</span>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2">
                        <button
                            type="button"
                            onClick={onStartRecording}
                            className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-500 border-4 border-white/20 hover:border-white/40 text-white flex items-center justify-center transition cursor-pointer shadow-xl hover:scale-105 active:scale-95"
                            title="Bắt đầu quay video có watermark"
                        >
                            <Circle className="w-7 h-7 fill-current" />
                        </button>
                        <span className="text-xs font-bold text-slate-300">
                            Bấm để Bắt đầu Quay Video
                        </span>
                    </div>
                )}
            </div>

            {/* Video vừa quay xong */}
            {lastRecordedVideo && !isRecording && (
                <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                            <Film className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-xs font-bold text-white block">
                                Video hoàn tất ({formatTimer(lastRecordedVideo.durationSeconds)})
                            </span>
                            <span className="text-[10.5px] text-slate-400">
                                Đã khắc đầy đủ Timestamp &amp; GPS ST
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => setIsPreviewOpen(true)}
                            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                        >
                            Xem lại
                        </button>
                        <button
                            type="button"
                            onClick={handleDownloadVideo}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black transition flex items-center gap-1 cursor-pointer shadow-xs"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span>Tải về</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Modal Xem lại Video */}
            {isPreviewOpen && lastRecordedVideo && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5">
                    <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl space-y-3 p-4">
                        <div className="flex items-center justify-between text-white border-b border-slate-800 pb-2">
                            <span className="text-sm font-black flex items-center gap-1.5">
                                <CheckCircle className="w-4 h-4 text-emerald-400" />
                                <span>Xem Lại Video Có Watermark</span>
                            </span>
                            <button
                                type="button"
                                onClick={() => setIsPreviewOpen(false)}
                                className="text-slate-400 hover:text-white p-1"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <video
                            src={lastRecordedVideo.url}
                            controls
                            playsInline
                            className="w-full rounded-2xl bg-black aspect-[9/14] object-contain max-h-[60vh]"
                        />

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsPreviewOpen(false);
                                    onClearRecordedVideo();
                                }}
                                className="px-3 py-2 text-rose-400 hover:bg-rose-500/10 rounded-xl text-xs font-bold transition cursor-pointer"
                            >
                                Xóa video này
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    handleDownloadVideo();
                                    setIsPreviewOpen(false);
                                }}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-md"
                            >
                                <Download className="w-4 h-4" />
                                <span>Tải Video về máy</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
