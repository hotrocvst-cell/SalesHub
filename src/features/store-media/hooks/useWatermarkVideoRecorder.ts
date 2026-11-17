import { useState, useEffect, useRef, useCallback } from 'react';
import type { GeoLocationInfo, VideoAudioRecordingMode, RecordedVideoResult } from '../types';

interface RecorderProps {
    geoInfo: GeoLocationInfo;
    promoAudioStream: MediaStream | null;
    storeName: string;
    storeCode: string;
    employeeName: string;
    employeeId: string;
}

export function useWatermarkVideoRecorder({
    geoInfo,
    promoAudioStream,
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

    const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
    const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
    const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
    const [hasTorch, setHasTorch] = useState<boolean>(false);
    const [cameraError, setCameraError] = useState<string | null>(null);

    const [recordingMode, setRecordingMode] = useState<VideoAudioRecordingMode>('microphone');
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
    const timerRef = useRef<number | null>(null);

    const [lastRecordedVideo, setLastRecordedVideo] = useState<RecordedVideoResult | null>(null);

    // Khởi động Camera
    const startCamera = useCallback(async () => {
        setCameraError(null);
        try {
            if (videoRef.current?.srcObject) {
                const oldStream = videoRef.current.srcObject as MediaStream;
                oldStream.getTracks().forEach(t => t.stop());
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: facingMode },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false // Video preview không lấy mic để tránh feedback
            });

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
                setIsCameraActive(true);

                // Kiểm tra hỗ trợ đèn Flash/Torch
                const videoTrack = stream.getVideoTracks()[0];
                const caps = (videoTrack.getCapabilities?.() as any) || {};
                setHasTorch(Boolean(caps.torch));
            }
        } catch (err: any) {
            setCameraError('Không thể mở camera. Vui lòng cấp quyền camera trong cài đặt trình duyệt.');
            setIsCameraActive(false);
        }
    }, [facingMode]);

    // Bật camera khi hook mount
    useEffect(() => {
        startCamera();
        return () => {
            if (videoRef.current?.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(t => t.stop());
            }
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
            }
        };
    }, [startCamera]);

    // Đổi camera Trước / Sau
    const toggleCameraFacing = useCallback(() => {
        setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
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

    // Vòng lặp vẽ Canvas + Watermark thời gian thực
    useEffect(() => {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        if (!canvas || !video) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let active = true;

        const renderFrame = () => {
            if (!active) return;

            if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
                const w = video.videoWidth || 720;
                const h = video.videoHeight || 1280;

                if (canvas.width !== w || canvas.height !== h) {
                    canvas.width = w;
                    canvas.height = h;
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
    }, [geoInfo, storeName, storeCode, employeeName, employeeId]);

    // Bắt đầu quay video
    const startRecording = useCallback(async () => {
        if (!canvasRef.current) return;
        chunksRef.current = [];
        setRecordingSeconds(0);

        try {
            const canvasStream = canvasRef.current.captureStream(30);
            const combinedAudioStream = new MediaStream();

            // Xử lý nguồn âm thanh theo chế độ
            if (recordingMode === 'microphone' || recordingMode === 'both') {
                const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                micStream.getAudioTracks().forEach(track => combinedAudioStream.addTrack(track));
            }

            if ((recordingMode === 'digital_mix' || recordingMode === 'both') && promoAudioStream) {
                promoAudioStream.getAudioTracks().forEach(track => combinedAudioStream.addTrack(track));
            }

            // Gộp luồng video từ canvas và luồng âm thanh
            const tracks = [
                ...canvasStream.getVideoTracks(),
                ...combinedAudioStream.getAudioTracks()
            ];
            const finalStream = new MediaStream(tracks);

            // Ưu tiên mp4 nếu thiết bị hỗ trợ, nếu không dùng webm
            let mimeType = 'video/webm;codecs=vp8,opus';
            if (MediaRecorder.isTypeSupported('video/mp4')) {
                mimeType = 'video/mp4';
            } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
                mimeType = 'video/webm;codecs=vp9';
            }

            const recorder = new MediaRecorder(finalStream, { mimeType });
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = e => {
                if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
            };

            recorder.onstop = () => {
                const finalBlob = new Blob(chunksRef.current, { type: mimeType });
                const videoUrl = URL.createObjectURL(finalBlob);

                setLastRecordedVideo({
                    blob: finalBlob,
                    url: videoUrl,
                    mimeType,
                    durationSeconds: recordingSeconds,
                    recordedAt: new Date(),
                    storeName,
                    storeCode,
                    employeeName,
                    employeeId
                });

                // Tắt các track mic nếu có
                combinedAudioStream.getTracks().forEach(t => t.stop());
            };

            recorder.start(1000); // Lưu mỗi 1 giây
            setIsRecording(true);

            timerRef.current = window.setInterval(() => {
                setRecordingSeconds(s => s + 1);
            }, 1000);
        } catch (err: any) {
            console.error('Lỗi khi bắt đầu quay video:', err);
            setCameraError(err?.message || 'Không thể bắt đầu ghi hình');
        }
    }, [recordingMode, promoAudioStream, recordingSeconds, storeName, storeCode, employeeName, employeeId]);

    // Dừng quay video
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

    return {
        videoRef,
        canvasRef,
        isCameraActive,
        facingMode,
        hasTorch,
        isTorchOn,
        cameraError,
        recordingMode,
        setRecordingMode,
        isRecording,
        recordingSeconds,
        lastRecordedVideo,
        setLastRecordedVideo,
        toggleCameraFacing,
        toggleTorch,
        startRecording,
        stopRecording
    };
}
