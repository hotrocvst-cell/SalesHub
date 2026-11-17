import { useState, useEffect, useRef, useCallback } from 'react';
import type { PromoAudioItem } from '../types';
import { getDriveStreamUrl, getCachedAudioBlob, cacheAudioBlobLocally } from '../services/promoAudioStorageService';

export function usePromoAudioPlayer() {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const streamDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
    const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

    const [currentAudio, setCurrentAudio] = useState<PromoAudioItem | null>(null);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [isLooping, setIsLooping] = useState<boolean>(true);
    const [currentTime, setCurrentTime] = useState<number>(0);
    const [duration, setDuration] = useState<number>(0);
    const [volume, setVolume] = useState<number>(1);
    const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);
    const [audioError, setAudioError] = useState<string | null>(null);
    const [audioStream, setAudioStream] = useState<MediaStream | null>(null);

    // Khởi tạo HTMLAudioElement một lần duy nhất
    useEffect(() => {
        const audio = new Audio();
        audio.crossOrigin = 'anonymous';
        audio.loop = true;
        audio.preload = 'auto';
        audioRef.current = audio;

        const onTimeUpdate = () => setCurrentTime(audio.currentTime);
        const onLoadedMetadata = () => {
            setDuration(audio.duration || 0);
            setIsLoadingAudio(false);
        };
        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onError = () => {
            setIsLoadingAudio(false);
            setAudioError('Không thể phát file âm thanh này');
            setIsPlaying(false);
        };

        audio.addEventListener('timeupdate', onTimeUpdate);
        audio.addEventListener('loadedmetadata', onLoadedMetadata);
        audio.addEventListener('play', onPlay);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('error', onError);

        return () => {
            audio.pause();
            audio.removeEventListener('timeupdate', onTimeUpdate);
            audio.removeEventListener('loadedmetadata', onLoadedMetadata);
            audio.removeEventListener('play', onPlay);
            audio.removeEventListener('pause', onPause);
            audio.removeEventListener('error', onError);
            if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
                audioCtxRef.current.close().catch(() => {});
            }
        };
    }, []);

    // Khởi tạo Web Audio routing để hỗ trợ Digital Mix vào Video
    const initWebAudioRouting = useCallback(() => {
        if (!audioRef.current) return;
        try {
            if (!audioCtxRef.current) {
                const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
                if (!AudioCtxClass) return;
                const ctx = new AudioCtxClass();
                audioCtxRef.current = ctx;

                const dest = ctx.createMediaStreamDestination();
                streamDestRef.current = dest;
                setAudioStream(dest.stream);

                const src = ctx.createMediaElementSource(audioRef.current);
                sourceNodeRef.current = src;

                // Xuất âm thanh ra 2 hướng đồng thời:
                // 1) Ra loa ngoài / Loa Bluetooth (ctx.destination)
                // 2) Ra luồng ghi âm MediaStream cho video (dest)
                src.connect(ctx.destination);
                src.connect(dest);
            }
            if (audioCtxRef.current.state === 'suspended') {
                audioCtxRef.current.resume();
            }
        } catch (err) {
            console.warn('Web Audio Routing init warning:', err);
        }
    }, []);

    // Chọn và nạp bài phát thanh
    const selectAudio = useCallback(async (item: PromoAudioItem) => {
        if (!audioRef.current) return;
        setAudioError(null);
        setIsLoadingAudio(true);
        setCurrentAudio(item);

        try {
            let finalUrl = item.blobUrl || '';

            // Nếu là bài Google Drive, kiểm tra xem đã cache trong IndexedDB chưa
            if (!finalUrl && item.driveFileId) {
                const cachedBlob = await getCachedAudioBlob(item.id);
                if (cachedBlob) {
                    finalUrl = URL.createObjectURL(cachedBlob);
                } else {
                    finalUrl = getDriveStreamUrl(item.driveFileId);
                    // Tự động tải ngầm và lưu vào IndexedDB
                    fetch(finalUrl)
                        .then(r => r.blob())
                        .then(b => cacheAudioBlobLocally(item.id, b, item.title))
                        .catch(() => {});
                }
            }

            audioRef.current.src = finalUrl;
            audioRef.current.load();
            initWebAudioRouting();
        } catch (err: any) {
            setIsLoadingAudio(false);
            setAudioError(err?.message || 'Lỗi nạp bài phát thanh');
        }
    }, [initWebAudioRouting]);

    // Bật / Dừng phát
    const togglePlay = useCallback(async () => {
        if (!audioRef.current) return;
        initWebAudioRouting();
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            try {
                await audioRef.current.play();
            } catch (err: any) {
                setAudioError('Nhấn để cho phép trình duyệt phát âm thanh');
            }
        }
    }, [isPlaying, initWebAudioRouting]);

    // Bật / Tắt Lặp lại
    const toggleLoop = useCallback(() => {
        if (!audioRef.current) return;
        const next = !isLooping;
        audioRef.current.loop = next;
        setIsLooping(next);
    }, [isLooping]);

    // Thay đổi âm lượng
    const changeVolume = useCallback((val: number) => {
        if (!audioRef.current) return;
        const v = Math.max(0, Math.min(1, val));
        audioRef.current.volume = v;
        setVolume(v);
    }, []);

    // Tua bài
    const seek = useCallback((seconds: number) => {
        if (!audioRef.current) return;
        audioRef.current.currentTime = seconds;
        setCurrentTime(seconds);
    }, []);

    return {
        currentAudio,
        isPlaying,
        isLooping,
        currentTime,
        duration,
        volume,
        isLoadingAudio,
        audioError,
        audioStream,
        selectAudio,
        togglePlay,
        toggleLoop,
        changeVolume,
        seek
    };
}
