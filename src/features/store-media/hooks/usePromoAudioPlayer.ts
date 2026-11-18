import { useState, useEffect, useRef, useCallback } from 'react';
import type { PromoAudioItem } from '../types';
import type { PromoAudioGraph } from '../utils/recordingAudioMixer';
import {
    getCachedAudioBlob,
    cacheAudioBlobLocally,
    fetchCloudAudioPayloadById,
    dataUrlToBlob
} from '../services/promoAudioStorageService';

export function usePromoAudioPlayer(playlist: PromoAudioItem[] = []) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
    const activeObjectUrlRef = useRef<string | null>(null);
    const selectReqIdRef = useRef<number>(0);

    const [currentAudio, setCurrentAudio] = useState<PromoAudioItem | null>(null);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [isLooping, setIsLooping] = useState<boolean>(true);
    const [currentTime, setCurrentTime] = useState<number>(0);
    const [duration, setDuration] = useState<number>(0);
    const [volume, setVolume] = useState<number>(1);
    const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);
    const [audioError, setAudioError] = useState<string | null>(null);

    const playlistRef = useRef<PromoAudioItem[]>(playlist);
    playlistRef.current = playlist;
    const currentAudioRef = useRef<PromoAudioItem | null>(currentAudio);
    currentAudioRef.current = currentAudio;
    const isLoopingRef = useRef<boolean>(isLooping);
    isLoopingRef.current = isLooping;
    const selectAudioRef = useRef<(item: PromoAudioItem, autoPlay?: boolean) => Promise<void>>(async () => {});

    const revokeActiveObjectUrl = useCallback(() => {
        if (activeObjectUrlRef.current) {
            URL.revokeObjectURL(activeObjectUrlRef.current);
            activeObjectUrlRef.current = null;
        }
    }, []);

    useEffect(() => {
        const audio = new Audio();
        audio.crossOrigin = 'anonymous';
        audio.loop = false;
        audio.preload = 'auto';
        audioRef.current = audio;

        const onTimeUpdate = () => setCurrentTime(audio.currentTime);
        const onLoadedMetadata = () => {
            setDuration(audio.duration || 0);
            setIsLoadingAudio(false);
            setAudioError(null);
        };
        const onCanPlay = () => {
            setIsLoadingAudio(false);
            setAudioError(null);
        };
        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onEnded = () => {
            if (!isLoopingRef.current) {
                setIsPlaying(false);
                return;
            }
            const list = playlistRef.current;
            const cur = currentAudioRef.current;
            if (list.length > 1 && cur) {
                const idx = list.findIndex(p => p.id === cur.id);
                const nextItem = list[(idx + 1) % list.length];
                if (nextItem) {
                    selectAudioRef.current(nextItem, true);
                    return;
                }
            }
            audio.currentTime = 0;
            audio.play().catch(() => setIsPlaying(false));
        };
        const onError = () => {
            setIsLoadingAudio(false);
            setAudioError('Không thể phát tệp âm thanh này. Hãy kiểm tra lại định dạng (.mp3, .m4a, .wav).');
            setIsPlaying(false);
        };

        audio.addEventListener('timeupdate', onTimeUpdate);
        audio.addEventListener('loadedmetadata', onLoadedMetadata);
        audio.addEventListener('canplay', onCanPlay);
        audio.addEventListener('play', onPlay);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('error', onError);

        return () => {
            audio.pause();
            audio.removeEventListener('timeupdate', onTimeUpdate);
            audio.removeEventListener('loadedmetadata', onLoadedMetadata);
            audio.removeEventListener('canplay', onCanPlay);
            audio.removeEventListener('play', onPlay);
            audio.removeEventListener('pause', onPause);
            audio.removeEventListener('ended', onEnded);
            audio.removeEventListener('error', onError);
            revokeActiveObjectUrl();
            if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
                audioCtxRef.current.close().catch(() => {});
            }
        };
    }, [revokeActiveObjectUrl]);

    const initWebAudioRouting = useCallback((): PromoAudioGraph | null => {
        if (!audioRef.current) return null;
        try {
            if (!audioCtxRef.current) {
                const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
                if (!AudioCtxClass) return null;
                const ctx = new AudioCtxClass();
                audioCtxRef.current = ctx;

                const src = ctx.createMediaElementSource(audioRef.current);
                sourceNodeRef.current = src;
                src.connect(ctx.destination);
            }
            if (audioCtxRef.current.state === 'suspended') {
                audioCtxRef.current.resume().catch(() => {});
            }
            if (audioCtxRef.current && sourceNodeRef.current) {
                return {
                    audioContext: audioCtxRef.current,
                    sourceNode: sourceNodeRef.current
                };
            }
        } catch (err) {
            console.warn('Web Audio Routing init warning:', err);
        }
        return null;
    }, []);

    const ensureAudioGraph = useCallback(async (): Promise<PromoAudioGraph | null> => {
        const graph = initWebAudioRouting();
        if (!graph) return null;
        if (graph.audioContext.state === 'suspended') {
            await graph.audioContext.resume().catch(() => {});
        }
        return graph;
    }, [initWebAudioRouting]);

    const selectAudio = useCallback(async (item: PromoAudioItem, autoPlay: boolean = false) => {
        const audio = audioRef.current;
        if (!audio) return;

        const reqId = ++selectReqIdRef.current;
        audio.pause();
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        setAudioError(null);
        setIsLoadingAudio(true);
        setCurrentAudio(item);

        try {
            let finalUrl = item.blobUrl || '';

            // Nếu là bài Cloud Audio: ưu tiên IndexedDB (0 KB băng thông), chỉ tải lười 1 lần duy nhất
            if (!finalUrl && item.sourceType === 'cloud_audio') {
                const cachedBlob = await getCachedAudioBlob(item.id);
                if (reqId !== selectReqIdRef.current) return;

                if (cachedBlob && cachedBlob.size > 1000 && !cachedBlob.type.includes('text/html')) {
                    revokeActiveObjectUrl();
                    finalUrl = URL.createObjectURL(cachedBlob);
                    activeObjectUrlRef.current = finalUrl;
                } else {
                    const rawPayload = item.audioDataUrl || (await fetchCloudAudioPayloadById(item.id));
                    if (reqId !== selectReqIdRef.current) return;

                    if (rawPayload && rawPayload.startsWith('data:audio/')) {
                        const blob = dataUrlToBlob(rawPayload);
                        await cacheAudioBlobLocally(item.id, blob, item.title);
                        if (reqId !== selectReqIdRef.current) return;
                        revokeActiveObjectUrl();
                        finalUrl = URL.createObjectURL(blob);
                        activeObjectUrlRef.current = finalUrl;
                    } else if (rawPayload) {
                        finalUrl = rawPayload;
                    }
                }
            }

            if (reqId !== selectReqIdRef.current) return;

            if (!finalUrl) {
                setIsLoadingAudio(false);
                setAudioError('Không tìm thấy dữ liệu âm thanh cho bài phát thanh này.');
                return;
            }

            audio.crossOrigin = 'anonymous';
            audio.src = finalUrl;
            audio.load();
            initWebAudioRouting();
            if (autoPlay) {
                audio.play().catch(() => {});
            }
        } catch (err: any) {
            if (reqId !== selectReqIdRef.current) return;
            setIsLoadingAudio(false);
            setAudioError(err?.message || 'Lỗi nạp bài phát thanh');
        }
    }, [initWebAudioRouting, revokeActiveObjectUrl]);

    selectAudioRef.current = selectAudio;

    const clearCurrentAudio = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.removeAttribute('src');
            audioRef.current.load();
        }
        revokeActiveObjectUrl();
        setCurrentAudio(null);
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        setAudioError(null);
    }, [revokeActiveObjectUrl]);

    const togglePlay = useCallback(async () => {
        if (!audioRef.current) return;
        initWebAudioRouting();
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            try {
                await audioRef.current.play();
                setAudioError(null);
            } catch {
                setAudioError('Trình duyệt chặn tự phát âm thanh. Hãy bấm lại nút Phát để nghe.');
            }
        }
    }, [isPlaying, initWebAudioRouting]);

    const toggleLoop = useCallback(() => {
        setIsLooping(prev => !prev);
    }, []);

    const changeVolume = useCallback((val: number) => {
        if (!audioRef.current) return;
        const v = Math.max(0, Math.min(1, val));
        audioRef.current.volume = v;
        setVolume(v);
    }, []);

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
        ensureAudioGraph,
        selectAudio,
        clearCurrentAudio,
        togglePlay,
        toggleLoop,
        changeVolume,
        seek
    };
}
