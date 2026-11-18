import { useState, useEffect, useRef, useCallback } from 'react';
import type { GeoLocationInfo, VideoAudioRecordingMode, RecordedVideoResult } from '../types';
import {
    openPrimaryRearCameraStream,
    saveVerifiedPrimaryCamera,
    clearVerifiedPrimaryCamera,
    type CameraHardwareCaps,
    type RearCameraCandidate
} from '../utils/cameraSelector';
import { createRecordingAudioMix, type PromoAudioGraph } from '../utils/recordingAudioMixer';

interface RecorderProps {
    geoInfo: GeoLocationInfo;
    ensurePromoAudioGraph: () => Promise<PromoAudioGraph | null>;
    storeName: string;
    storeCode: string;
    employeeName: string;
    employeeId: string;
}

export function useWatermarkVideoRecorder({
    geoInfo,
    ensurePromoAudioGraph,
    storeName,
    storeCode,
    employeeName,
    employeeId
}: RecorderProps) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const animFrameRef = useRef<number | null>(null);
    const isMountedRef = useRef<boolean>(true);
    const startSeqRef = useRef<number>(0);
    const recordingStartedAtRef = useRef<number>(0);

    const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
    const [isStartingCamera, setIsStartingCamera] = useState<boolean>(false);
    const [activeCameraLabel, setActiveCameraLabel] = useState<string>('Camera chính');
    const [activeDeviceId, setActiveDeviceId] = useState<string>('');
    const [activeHardwareCaps, setActiveHardwareCaps] = useState<CameraHardwareCaps | null>(null);
    const [rearCameras, setRearCameras] = useState<RearCameraCandidate[]>([]);
    const [videoAspectRatio, setVideoAspectRatio] = useState<number>(3 / 4);
    const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
    const [hasTorch, setHasTorch] = useState<boolean>(false);
    const [cameraError, setCameraError] = useState<string | null>(null);

    const [recordingMode, setRecordingMode] = useState<VideoAudioRecordingMode>('microphone');
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
    const timerRef = useRef<number | null>(null);

    const [lastRecordedVideo, setLastRecordedVideo] = useState<RecordedVideoResult | null>(null);

    // Tắt hẳn camera, giải phóng phần cứng và xóa khung hình cũ trên canvas
    const stopCamera = useCallback(() => {
        startSeqRef.current += 1;
        if (videoRef.current?.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(t => t.stop());
            videoRef.current.srcObject = null;
        }
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
        setIsStartingCamera(false);
        setIsCameraActive(false);
        setHasTorch(false);
        setIsTorchOn(false);
        setCameraError(null);
    }, []);

    // Khởi động duy nhất Camera sau chính (1x), loại trừ camera tele/tiềm vọng/macro/ultra-wide/trước
    const startCamera = useCallback(async (preferredDeviceId?: string) => {
        const requestSeq = ++startSeqRef.current;
        setCameraError(null);
        setIsTorchOn(false);
        setIsStartingCamera(true);
        try {
            if (videoRef.current?.srcObject) {
                const oldStream = videoRef.current.srcObject as MediaStream;
                oldStream.getTracks().forEach(t => t.stop());
                videoRef.current.srcObject = null;
                await new Promise(resolve => window.setTimeout(resolve, 220));
            }

            const result = await openPrimaryRearCameraStream(preferredDeviceId);

            if (!isMountedRef.current || requestSeq !== startSeqRef.current) {
                result.stream.getTracks().forEach(t => t.stop());
                return;
            }

            if (videoRef.current) {
                videoRef.current.srcObject = result.stream;
                await videoRef.current.play();
                setIsCameraActive(true);
                setActiveCameraLabel(result.activeCameraLabel);
                setActiveDeviceId(result.activeDeviceId);
                setActiveHardwareCaps(result.hardwareCaps);
                setRearCameras(result.rearCameras);
                setHasTorch(result.hasTorch);
            } else {
                result.stream.getTracks().forEach(t => t.stop());
            }
        } catch (err: any) {
            if (!isMountedRef.current || requestSeq !== startSeqRef.current) return;
            setCameraError(
                err?.message && err.message.includes('HTTPS')
                    ? err.message
                    : 'Không thể mở camera chính. Vui lòng cấp quyền camera trong cài đặt trình duyệt.'
            );
            setIsCameraActive(false);
            setHasTorch(false);
        } finally {
            if (isMountedRef.current && requestSeq === startSeqRef.current) {
                setIsStartingCamera(false);
            }
        }
    }, []);

    // Cố định ống kính sau chính trên máy có nhiều camera (dành cho Admin hiệu chỉnh nếu OEM đảo ID)
    const pinPrimaryRearCamera = useCallback(
        async (deviceId: string) => {
            saveVerifiedPrimaryCamera(deviceId, rearCameras);
            await startCamera(deviceId);
        },
        [rearCameras, startCamera]
    );

    const resetAutoPrimaryCamera = useCallback(async () => {
        clearVerifiedPrimaryCamera();
        await startCamera();
    }, [startCamera]);

    // Mặc định KHÔNG tự bật camera khi mới vào trang; chỉ dọn dẹp tài nguyên khi rời trang
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            if (timerRef.current !== null) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            if (videoRef.current?.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(t => t.stop());
                videoRef.current.srcObject = null;
            }
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
            }
        };
    }, []);

    // Bật / Tắt đèn Flash
    const toggleTorch = useCallback(async () => {
        if (!videoRef.current?.srcObject) return;
        try {
            const stream = videoRef.current.srcObject as MediaStream;
            const track = stream.getVideoTracks()[0];
            const next = !isTorchOn;
            await (track as any).applyConstraints({
                advanced: [{ torch: next }]
            });
            setIsTorchOn(next);
        } catch (err) {
            console.warn('Lỗi bật đèn flash:', err);
        }
    }, [isTorchOn]);

    // Vòng lặp vẽ Canvas + Watermark thời gian thực (chỉ chạy khi camera đang bật để tiết kiệm pin)
    useEffect(() => {
        if (!isCameraActive) return;
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (!canvas || !video) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let active = true;

        const renderFrame = () => {
            if (!active) return;

            if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
                const w = video.videoWidth || 960;
                const h = video.videoHeight || 1280;

                if (canvas.width !== w || canvas.height !== h) {
                    canvas.width = w;
                    canvas.height = h;
                    if (w > 0 && h > 0) {
                        const nextRatio = w / h;
                        setVideoAspectRatio(prev => (Math.abs(prev - nextRatio) > 0.02 ? nextRatio : prev));
                    }
                }

                // 1. Vẽ khung hình camera gốc
                ctx.drawImage(video, 0, 0, w, h);

                // 2. Vẽ dải nền Watermark mờ đen ở đáy (3 lớp)
                const bannerHeight = Math.max(120, h * 0.16);
                const bannerY = h - bannerHeight;

                const gradient = ctx.createLinearGradient(0, bannerY - 30, 0, h);
                gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
                gradient.addColorStop(0.2, 'rgba(15, 23, 42, 0.88)');
                gradient.addColorStop(1, 'rgba(15, 23, 42, 0.96)');

                ctx.fillStyle = gradient;
                ctx.fillRect(0, bannerY - 30, w, bannerHeight + 30);

                // Dải viền sáng ngăn cách
                ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(16, bannerY);
                ctx.lineTo(w - 16, bannerY);
                ctx.stroke();

                // 3. Thông số hiển thị
                const now = new Date();
                const timeStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

                const latStr = geoInfo.latitude !== null ? `${geoInfo.latitude}°N` : 'Đang tìm...';
                const lonStr = geoInfo.longitude !== null ? `${geoInfo.longitude}°E` : 'Đang tìm...';
                const accStr = geoInfo.accuracy !== null ? `±${geoInfo.accuracy}m` : '±--m';
                const addrStr = geoInfo.streetAddress || storeName || 'Chưa xác định ST';
                const empStr = employeeName ? `${employeeId ? `[${employeeId}] ` : ''}${employeeName}` : 'Quản lý ST';

                const fontSize = Math.max(13, Math.round(w / 38));
                ctx.font = `bold ${fontSize}px 'Roboto', sans-serif`;

                // Dòng 1: Địa chỉ ST & Tên đường
                ctx.fillStyle = '#f8fafc';
                ctx.fillText(`📍 ${addrStr} (${storeCode ? `ST ${storeCode}` : 'ST'})`, 22, bannerY + fontSize * 1.5);

                // Dòng 2: Tọa độ Lat / Long + Bán kính sai số GPS
                ctx.fillStyle = '#38bdf8';
                ctx.fillText(`🌐 ${latStr}, ${lonStr} · Sai số GPS: ${accStr}`, 22, bannerY + fontSize * 3.0);

                // Dòng 3: Dấu thời gian thực + Nhân viên
                ctx.fillStyle = '#fbbf24';
                ctx.fillText(`🕒 ${timeStr} · NV: ${empStr}`, 22, bannerY + fontSize * 4.5);
            }

            animFrameRef.current = requestAnimationFrame(renderFrame);
        };

        renderFrame();

        return () => {
            active = false;
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        };
    }, [isCameraActive, geoInfo, storeName, storeCode, employeeName, employeeId]);

    // Bắt đầu quay video (yêu cầu camera đã được mở ở lần bấm 1)
    const startRecording = useCallback(async () => {
        if (!canvasRef.current || !isCameraActive || !videoRef.current?.srcObject) return;
        chunksRef.current = [];
        setRecordingSeconds(0);
        recordingStartedAtRef.current = Date.now();

        let audioMixCleanup: (() => void) | null = null;
        let canvasStream: MediaStream | null = null;

        try {
            canvasStream = canvasRef.current.captureStream(30);

            // Trộn nguồn âm thanh (Mic / Audio KM / Cả 2) thành 1 track duy nhất qua Web Audio API
            const mixedAudio = await createRecordingAudioMix(recordingMode, ensurePromoAudioGraph);
            audioMixCleanup = mixedAudio.cleanup;

            const tracks = [
                ...canvasStream.getVideoTracks(),
                ...mixedAudio.audioTracks
            ];
            const finalStream = new MediaStream(tracks);

            // Ưu tiên định dạng có khai báo rõ audio codec (AAC/Opus) để đảm bảo ghi đủ tiếng
            const preferredMimeTypes = [
                'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
                'video/mp4',
                'video/webm;codecs=vp9,opus',
                'video/webm;codecs=vp8,opus',
                'video/webm'
            ];
            const supportedMimeType =
                preferredMimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';

            const recorder = new MediaRecorder(finalStream, { mimeType: supportedMimeType });
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = e => {
                if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
            };

            recorder.onstop = () => {
                const actualMimeType = recorder.mimeType || supportedMimeType;
                const finalBlob = new Blob(chunksRef.current, { type: actualMimeType });
                const videoUrl = URL.createObjectURL(finalBlob);
                const elapsedSeconds = Math.max(
                    1,
                    Math.round((Date.now() - recordingStartedAtRef.current) / 1000)
                );

                setLastRecordedVideo({
                    blob: finalBlob,
                    url: videoUrl,
                    mimeType: actualMimeType,
                    durationSeconds: elapsedSeconds,
                    recordedAt: new Date(),
                    storeName,
                    storeCode,
                    employeeName,
                    employeeId
                });

                // Dọn dẹp nhánh trộn âm thanh & mic (giữ nguyên loa Audio KM), sau đó tắt camera hoàn toàn
                audioMixCleanup?.();
                audioMixCleanup = null;
                canvasStream?.getTracks().forEach(t => t.stop());
                stopCamera();
            };

            recorder.start(1000); // Lưu mỗi 1 giây
            setIsRecording(true);

            timerRef.current = window.setInterval(() => {
                setRecordingSeconds(s => s + 1);
            }, 1000);
        } catch (err: any) {
            audioMixCleanup?.();
            canvasStream?.getTracks().forEach(t => t.stop());
            console.error('Lỗi khi bắt đầu quay video:', err);
            setCameraError(err?.message || 'Không thể bắt đầu ghi hình');
        }
    }, [isCameraActive, recordingMode, ensurePromoAudioGraph, storeName, storeCode, employeeName, employeeId, stopCamera]);

    // Dừng quay video (camera sẽ tự tắt ngay khi MediaRecorder chốt xong tệp video)
    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            if (timerRef.current !== null) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        }
    }, [isRecording]);

    const openCamera = useCallback(() => {
        void startCamera();
    }, [startCamera]);

    return {
        videoRef,
        canvasRef,
        isCameraActive,
        isStartingCamera,
        videoAspectRatio,
        activeCameraLabel,
        activeDeviceId,
        activeHardwareCaps,
        rearCameras,
        hasTorch,
        isTorchOn,
        cameraError,
        recordingMode,
        setRecordingMode,
        isRecording,
        recordingSeconds,
        lastRecordedVideo,
        setLastRecordedVideo,
        openCamera,
        stopCamera,
        pinPrimaryRearCamera,
        resetAutoPrimaryCamera,
        toggleTorch,
        startRecording,
        stopRecording
    };
}
