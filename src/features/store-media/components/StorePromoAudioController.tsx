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
    Sparkles,
    CheckCircle2
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
    selectedStoreName: string;
    isAdmin: boolean;
    onSelectAudio: (item: PromoAudioItem) => void;
    onTogglePlay: () => void;
    onToggleLoop: () => void;
    onChangeVolume: (v: number) => void;
    onSeek: (seconds: number) => void;
    onAddLocalFile: (file: File) => void;
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
    selectedStoreName,
    isAdmin,
    onSelectAudio,
    onTogglePlay,
    onToggleLoop,
    onChangeVolume,
    onSeek,
    onAddLocalFile,
    onOpenConfigModal
}: Props) {
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onAddLocalFile(file);
            e.target.value = '';
        }
    };

    return (
        <div className="bg-slate-900 text-white rounded-2xl p-3 sm:p-4 border border-slate-800 shadow-md space-y-3">
            {/* Header Audio Controller */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-purple-600/30 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0">
                        <Radio className={`w-4 h-4 ${isPlaying ? 'animate-pulse text-purple-300' : ''}`} />
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

                {/* Nút tác vụ tải file / Cấu hình */}
                <div className="flex items-center gap-1.5">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={handleFileChange}
                    />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-700 transition flex items-center gap-1 cursor-pointer"
                        title="Tự nạp file âm thanh từ điện thoại / máy tính"
                    >
                        <UploadCloud className="w-3.5 h-3.5 text-blue-400" />
                        <span className="hidden sm:inline">Nạp file</span> từ máy
                    </button>

                    {isAdmin && (
                        <button
                            type="button"
                            onClick={onOpenConfigModal}
                            className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold border border-purple-500 transition flex items-center gap-1 cursor-pointer shadow-xs"
                            title="Quản lý thư viện Google Drive chung cho các ST"
                        >
                            <FolderPlus className="w-3.5 h-3.5 text-amber-300" />
                            <span>Cấu hình Drive</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Thanh tiến độ bài hát */}
            <div className="space-y-1">
                <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    value={currentTime}
                    onChange={e => onSeek(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
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
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer shadow-sm ${
                            isPlaying
                                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black'
                                : 'bg-purple-600 hover:bg-purple-500 text-white font-black'
                        } disabled:opacity-40`}
                        title={isPlaying ? 'Tạm dừng' : 'Bắt đầu phát ra loa'}
                    >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                    </button>

                    <button
                        type="button"
                        onClick={onToggleLoop}
                        className={`p-2 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center gap-1 ${
                            isLooping
                                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                        title={isLooping ? 'Đang bật lặp lại liên tục' : 'Tắt lặp lại'}
                    >
                        <Repeat className={`w-3.5 h-3.5 ${isLooping ? 'text-purple-400' : ''}`} />
                        <span className="text-[10px]">Lặp lại</span>
                    </button>
                </div>

                {/* Điều chỉnh âm lượng */}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => onChangeVolume(volume > 0 ? 0 : 0.8)}
                        className="text-slate-400 hover:text-white transition"
                    >
                        {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                    <input
                        type="range"
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
                        Danh sách bài phát thanh ({playlist.length} bài) · {selectedStoreName}
                    </span>
                    <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                        {playlist.map(item => {
                            const isSelected = currentAudio?.id === item.id;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => onSelectAudio(item)}
                                    className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between gap-2 transition cursor-pointer ${
                                        isSelected
                                            ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40 font-bold'
                                            : 'bg-slate-800/70 hover:bg-slate-800 text-slate-300 border border-slate-700/60'
                                    }`}
                                >
                                    <div className="flex items-center gap-1.5 truncate">
                                        <Music className="w-3.5 h-3.5 shrink-0 text-purple-400" />
                                        <span className="truncate">{item.title}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                                        {item.sourceType === 'google_drive' ? (
                                            <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                                Drive
                                            </span>
                                        ) : (
                                            <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                                Máy
                                            </span>
                                        )}
                                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
