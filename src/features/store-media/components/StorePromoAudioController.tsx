import React, { useRef } from 'react';
import {
    Play,
    Pause,
    Repeat,
    Volume2,
    VolumeX,
    UploadCloud,
    FolderPlus,
    Music,
    Radio,
    CheckCircle2,
    Loader2,
    AlertCircle,
    Trash2
} from 'lucide-react';
import type { PromoAudioItem } from '../types';

interface Props {
    playlist: PromoAudioItem[];
    currentAudio: PromoAudioItem | null;
    isPlaying: boolean;
    isLooping: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    isLoadingAudio: boolean;
    audioError?: string | null;
    selectedStoreName: string;
    canConfigureAudio: boolean;
    onSelectAudio: (item: PromoAudioItem) => void;
    onTogglePlay: () => void;
    onToggleLoop: () => void;
    onChangeVolume: (v: number) => void;
    onSeek: (seconds: number) => void;
    onAddLocalFiles: (files: File[]) => void;
    onRemoveLocalFile: (id: string) => void;
    onOpenConfigModal: () => void;
}

function formatDuration(sec: number): string {
    if (!sec || isNaN(sec)) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function StorePromoAudioController({
    playlist,
    currentAudio,
    isPlaying,
    isLooping,
    currentTime,
    duration,
    volume,
    isLoadingAudio,
    audioError,
    selectedStoreName,
    canConfigureAudio,
    onSelectAudio,
    onTogglePlay,
    onToggleLoop,
    onChangeVolume,
    onSeek,
    onAddLocalFiles,
    onRemoveLocalFile,
    onOpenConfigModal
}: Props) {
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files ? Array.from(e.target.files) : [];
        if (files.length > 0) {
            onAddLocalFiles(files);
            e.target.value = '';
        }
    };

    return (
        <div className="bg-slate-900 text-white rounded-2xl p-3 sm:p-4 border border-slate-800 shadow-md space-y-3">
            {/* Header Audio Controller */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0">
                        <Radio className={`w-4 h-4 ${isPlaying ? 'animate-pulse text-purple-300' : ''}`} aria-hidden="true" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-white uppercase tracking-wider">
                                Loa Phát KM
                            </span>
                            {isPlaying ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                                    Đang phát Bluetooth
                                </span>
                            ) : (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                                    Đang tạm dừng
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-slate-300 truncate max-w-[240px] sm:max-w-md font-medium">
                            {currentAudio ? currentAudio.title : 'Chưa chọn bài phát thanh'}
                        </p>
                    </div>
                </div>

                {/* Nút tác vụ tải file từ máy / Cấu hình Audio Cloud */}
                <div className="flex items-center gap-1.5">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="audio/*,.m4a,.mp3,.wav,.ogg"
                        multiple
                        className="hidden"
                        onChange={handleFileChange}
                    />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition flex items-center gap-1 cursor-pointer"
                        title="Chọn 1 hoặc nhiều file âm thanh từ điện thoại / máy tính (tự lưu offline, 0 KB băng thông Cloud)"
                    >
                        <UploadCloud className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
                        <span>Nạp file từ máy</span>
                    </button>

                    {canConfigureAudio && (
                        <button
                            type="button"
                            onClick={onOpenConfigModal}
                            className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold border border-purple-500 transition flex items-center gap-1 cursor-pointer shadow-xs"
                            title="Quản lý thư viện Audio Cloud cho các ST được phân quyền"
                        >
                            <FolderPlus className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                            <span>Cấu hình Cloud</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Trạng thái đang tải / báo lỗi nếu không mở được audio */}
            {isLoadingAudio && (
                <div className="px-3 py-2 rounded-xl bg-purple-950/60 border border-purple-500/30 text-purple-200 text-[11px] font-bold flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-300 shrink-0" aria-hidden="true" />
                    <span>Đang tải âm thanh từ Cloud về máy (chỉ tải 1 lần, tự lưu offline)...</span>
                </div>
            )}
            {audioError && !isLoadingAudio && (
                <div className="px-3 py-2 rounded-xl bg-rose-950/70 border border-rose-500/40 text-rose-200 text-[11px] font-semibold flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{audioError}</span>
                </div>
            )}

            {/* Thanh tiến độ bài hát */}
            <div className="space-y-1">
                <input
                    type="range"
                    aria-label="Tiến độ bài phát thanh"
                    min={0}
                    max={duration || 100}
                    value={currentTime}
                    onChange={e => onSeek(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono tabular-nums">
                    <span>{formatDuration(currentTime)}</span>
                    <span>{formatDuration(duration)}</span>
                </div>
            </div>

            {/* Điều khiển Play / Loop / Volume */}
            <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-800/80">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onTogglePlay}
                        disabled={!currentAudio || isLoadingAudio}
                        aria-label={isPlaying ? 'Tạm dừng phát loa' : 'Phát ra loa'}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer shadow-sm ${
                            isPlaying
                                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black'
                                : 'bg-purple-600 hover:bg-purple-500 text-white font-black'
                        } disabled:opacity-40`}
                        title={isPlaying ? 'Tạm dừng' : 'Bắt đầu phát ra loa'}
                    >
                        {isPlaying ? <Pause className="w-4 h-4" aria-hidden="true" /> : <Play className="w-4 h-4 ml-0.5" aria-hidden="true" />}
                    </button>

                    <button
                        type="button"
                        onClick={onToggleLoop}
                        className={`p-2 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center gap-1 ${
                            isLooping
                                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                        title={
                            isLooping
                                ? playlist.length > 1
                                    ? 'Đang bật phát liên tục & lặp cả danh sách'
                                    : 'Đang bật lặp lại liên tục'
                                : 'Tắt lặp lại'
                        }
                    >
                        <Repeat className={`w-3.5 h-3.5 ${isLooping ? 'text-purple-400' : ''}`} aria-hidden="true" />
                        <span className="text-[10px]">
                            {playlist.length > 1 ? 'Lặp danh sách' : 'Lặp lại'}
                        </span>
                    </button>
                </div>

                {/* Điều chỉnh âm lượng */}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => onChangeVolume(volume > 0 ? 0 : 0.8)}
                        aria-label={volume === 0 ? 'Bật âm lượng' : 'Tắt tiếng'}
                        className="text-slate-400 hover:text-white transition cursor-pointer"
                    >
                        {volume === 0 ? <VolumeX className="w-4 h-4" aria-hidden="true" /> : <Volume2 className="w-4 h-4" aria-hidden="true" />}
                    </button>
                    <input
                        type="range"
                        aria-label="Âm lượng loa"
                        min={0}
                        max={1}
                        step={0.05}
                        value={volume}
                        onChange={e => onChangeVolume(Number(e.target.value))}
                        className="w-16 sm:w-24 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-400"
                    />
                </div>
            </div>

            {/* Danh sách bài phát thanh hiện có cho ST này */}
            {playlist.length > 0 && (
                <div className="pt-2 border-t border-slate-800/80">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                        Danh sách phát ({playlist.length} bài) · {selectedStoreName}
                    </span>
                    <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                        {playlist.map((item, idx) => {
                            const isSelected = currentAudio?.id === item.id;
                            return (
                                <div
                                    key={item.id}
                                    className={`w-full px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between gap-2 transition ${
                                        isSelected
                                            ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40 font-bold'
                                            : 'bg-slate-800/70 hover:bg-slate-800 text-slate-300 border border-slate-700/60'
                                    }`}
                                >
                                    <button
                                        type="button"
                                        onClick={() => onSelectAudio(item)}
                                        className="flex items-center gap-1.5 truncate flex-1 text-left cursor-pointer"
                                    >
                                        <span className="text-[10px] text-slate-400 font-mono tabular-nums w-4 shrink-0">
                                            {idx + 1}.
                                        </span>
                                        <Music className="w-3.5 h-3.5 shrink-0 text-purple-400" aria-hidden="true" />
                                        <span className="truncate">{item.title}</span>
                                    </button>
                                    <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                                        {item.sourceType === 'cloud_audio' ? (
                                            <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-200 border border-purple-500/30">
                                                Cloud
                                            </span>
                                        ) : (
                                            <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                                Máy
                                            </span>
                                        )}
                                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" aria-hidden="true" />}
                                        {item.sourceType === 'local_file' && (
                                            <button
                                                type="button"
                                                onClick={() => onRemoveLocalFile(item.id)}
                                                aria-label={`Xóa file máy ${item.title}`}
                                                className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-950/60 transition cursor-pointer"
                                                title="Xóa file cục bộ này khỏi máy"
                                            >
                                                <Trash2 className="w-3 h-3" aria-hidden="true" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
