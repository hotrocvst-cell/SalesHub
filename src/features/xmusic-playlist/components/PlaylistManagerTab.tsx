import React, { useState, useRef } from 'react';
import {
    Play,
    Pause,
    Copy,
    Download,
    Check,
    Music,
    Clock,
    FileJson,
    Headphones,
    Volume2
} from 'lucide-react';
import type { XMusicPlaylist, XMusicSong } from '../types';
import { DEFAULT_SAMPLE_PLAYLISTS } from '../data/defaultPlaylists';

interface PlaylistManagerTabProps {
    onShowToast: (msg: string) => void;
}

export default function PlaylistManagerTab({ onShowToast }: PlaylistManagerTabProps) {
    const [playlists] = useState<XMusicPlaylist[]>(DEFAULT_SAMPLE_PLAYLISTS);
    const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>(playlists[0]?.id || '');
    const [playingSongKey, setPlayingSongKey] = useState<string | null>(null);
    const [hasCopiedJson, setHasCopiedJson] = useState<boolean>(false);

    const audioRef = useRef<HTMLAudioElement | null>(null);

    const currentPlaylist = playlists.find(p => p.id === selectedPlaylistId) || playlists[0];

    const formatDuration = (seconds: number): string => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const handlePlayPause = (song: XMusicSong) => {
        if (playingSongKey === song.key) {
            if (audioRef.current) {
                audioRef.current.pause();
            }
            setPlayingSongKey(null);
            return;
        }

        if (!song.streamUrl) {
            onShowToast('Bài hát này không có link stream khả dụng.');
            return;
        }

        if (!audioRef.current) {
            audioRef.current = new Audio();
            audioRef.current.onended = () => setPlayingSongKey(null);
            audioRef.current.onerror = () => {
                onShowToast('Không thể phát trực tiếp bài hát này.');
                setPlayingSongKey(null);
            };
        }

        audioRef.current.src = song.streamUrl;
        audioRef.current.play().then(() => {
            setPlayingSongKey(song.key);
        }).catch(() => {
            onShowToast('Trình duyệt chặn tự động phát hoặc link hết hạn.');
            setPlayingSongKey(null);
        });
    };

    const handleCopyJson = () => {
        const jsonStr = JSON.stringify(playlists, null, 2);
        navigator.clipboard.writeText(jsonStr).then(() => {
            setHasCopiedJson(true);
            onShowToast('Đã sao chép cấu trúc JSON Playlist vào Clipboard!');
            setTimeout(() => setHasCopiedJson(false), 2500);
        });
    };

    const handleDownloadJson = () => {
        const jsonStr = JSON.stringify(playlists, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sample-playlists.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        onShowToast('Đã tải xuống file sample-playlists.json!');
    };

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Playlist Selection & Action Bar */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Playlist selector buttons */}
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 sm:pb-0">
                        {playlists.map(pl => {
                            const isSelected = pl.id === currentPlaylist?.id;
                            return (
                                <button
                                    key={pl.id}
                                    type="button"
                                    onClick={() => {
                                        setSelectedPlaylistId(pl.id);
                                        if (audioRef.current) audioRef.current.pause();
                                        setPlayingSongKey(null);
                                    }}
                                    className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                                        isSelected
                                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xs'
                                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80'
                                    }`}
                                >
                                    <span>{pl.name}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-extrabold ${isSelected ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'}`}>
                                        {pl.songs.length} bài
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Export / Copy JSON buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={handleCopyJson}
                            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer ${
                                hasCopiedJson
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                        >
                            {hasCopiedJson ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                            <span>Sao chép JSON</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleDownloadJson}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition shadow-2xs cursor-pointer"
                        >
                            <Download className="w-3.5 h-3.5 text-slate-500" />
                            <span>Tải JSON Playlist</span>
                        </button>
                    </div>
                </div>

                {/* Playlist description */}
                {currentPlaylist && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <p className="italic">{currentPlaylist.description}</p>
                        <span className="font-semibold text-slate-400">Tổng cộng: {currentPlaylist.songs.length} bài hát</span>
                    </div>
                )}
            </div>

            {/* Song List */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Music className="w-4 h-4 text-indigo-600" />
                        <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide">
                            Danh Sách Bài Hát: {currentPlaylist?.name}
                        </h3>
                    </div>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Headphones className="w-3 h-3" />
                        <span>Bấm nút Play để nghe thử</span>
                    </span>
                </div>

                <div className="divide-y divide-slate-100">
                    {currentPlaylist?.songs.map((song, idx) => {
                        const isPlaying = playingSongKey === song.key;
                        return (
                            <div
                                key={song.key}
                                className={`p-3.5 sm:p-4 flex items-center justify-between gap-3 transition ${
                                    isPlaying ? 'bg-indigo-50/50' : 'hover:bg-slate-50/70'
                                }`}
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    {/* Number / Play Button */}
                                    <button
                                        type="button"
                                        onClick={() => handlePlayPause(song)}
                                        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 transition shadow-xs cursor-pointer ${
                                            isPlaying
                                                ? 'bg-indigo-600 text-white animate-pulse'
                                                : 'bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-700'
                                        }`}
                                        title={isPlaying ? 'Tạm dừng nghe thử' : 'Nghe thử bài này'}
                                    >
                                        {isPlaying ? (
                                            <Pause className="w-4 h-4 text-white" />
                                        ) : (
                                            <Play className="w-4 h-4 ml-0.5" />
                                        )}
                                    </button>

                                    {/* Thumbnail */}
                                    {song.image ? (
                                        <img
                                            src={song.image}
                                            alt={song.title}
                                            className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg object-cover border border-slate-200/80 shrink-0"
                                            onError={(e) => {
                                                (e.target as HTMLElement).style.display = 'none';
                                            }}
                                        />
                                    ) : null}

                                    {/* Song Info */}
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                                                {song.title}
                                            </span>
                                            {isPlaying && (
                                                <span className="text-[10px] font-black px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-700 flex items-center gap-1 shrink-0">
                                                    <Volume2 className="w-2.5 h-2.5 animate-bounce" />
                                                    <span>Đang phát</span>
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                                            {song.artists.join(', ')} • {song.kbit} kbps
                                        </div>
                                    </div>
                                </div>

                                {/* Right Side: Duration & Key */}
                                <div className="flex items-center gap-3 shrink-0 text-right">
                                    <div className="hidden sm:block text-[11px] font-mono text-slate-400">
                                        ID: {song.key}
                                    </div>
                                    <div className="flex items-center gap-1 text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
                                        <Clock className="w-3 h-3 text-slate-400" />
                                        <span>{formatDuration(song.duration)}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
