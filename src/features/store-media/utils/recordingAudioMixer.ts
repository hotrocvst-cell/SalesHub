import type { VideoAudioRecordingMode } from '../types';

export interface PromoAudioGraph {
    audioContext: AudioContext;
    sourceNode: MediaElementAudioSourceNode;
}

export interface MixedRecordingAudio {
    audioTracks: MediaStreamTrack[];
    cleanup: () => void;
}

/**
 * Trộn nguồn âm thanh ghi hình video bằng Web Audio API trên CÙNG một AudioContext:
 * - Chế độ `microphone`: Chỉ ghi từ Mic.
 * - Chế độ `digital_mix`: Chỉ ghi luồng Audio phát thanh KM nội bộ.
 * - Chế độ `both`: Trộn Mic + Audio phát thanh KM thành 1 track âm thanh duy nhất
 *   (MediaRecorder trên Chrome/Safari chỉ ghi track audio đầu tiên, không tự trộn 2 track rời).
 */
export async function createRecordingAudioMix(
    recordingMode: VideoAudioRecordingMode,
    ensurePromoAudioGraph: () => Promise<PromoAudioGraph | null>
): Promise<MixedRecordingAudio> {
    let micStream: MediaStream | null = null;
    let micSource: MediaStreamAudioSourceNode | null = null;
    let micGain: GainNode | null = null;
    let promoGain: GainNode | null = null;
    let mixerNode: DynamicsCompressorNode | null = null;
    let recordDest: MediaStreamAudioDestinationNode | null = null;
    let activeGraph: PromoAudioGraph | null = null;

    const cleanup = () => {
        if (activeGraph && promoGain) {
            try {
                // Chỉ ngắt nhánh ghi hình, giữ nguyên kết nối ra loa (ctx.destination)
                activeGraph.sourceNode.disconnect(promoGain);
            } catch {
                // Bỏ qua nếu đã ngắt trước đó
            }
        }
        try {
            promoGain?.disconnect();
        } catch {
            // Bỏ qua
        }
        try {
            micSource?.disconnect();
        } catch {
            // Bỏ qua
        }
        try {
            micGain?.disconnect();
        } catch {
            // Bỏ qua
        }
        try {
            mixerNode?.disconnect();
        } catch {
            // Bỏ qua
        }
        micStream?.getTracks().forEach(t => t.stop());
        recordDest?.stream.getTracks().forEach(t => t.stop());
    };

    try {
        // 1. Lấy luồng Mic TRƯỚC (trên Android Chrome, mở mic có thể tạm ngưng AudioContext nên cần resume sau bước này)
        if (recordingMode === 'microphone' || recordingMode === 'both') {
            micStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
        }

        // Chế độ chỉ dùng Mic: trả thẳng track mic không cần qua Web Audio mixer
        if (recordingMode === 'microphone') {
            return {
                audioTracks: micStream ? micStream.getAudioTracks() : [],
                cleanup
            };
        }

        // 2. Lấy đồ thị Web Audio của trình phát Audio KM (trên cùng AudioContext tránh lỗi im lặng của Chrome)
        activeGraph = await ensurePromoAudioGraph();
        if (!activeGraph) {
            return {
                audioTracks: micStream ? micStream.getAudioTracks() : [],
                cleanup
            };
        }

        const { audioContext, sourceNode } = activeGraph;
        if (audioContext.state === 'suspended') {
            await audioContext.resume().catch(() => {});
        }

        recordDest = audioContext.createMediaStreamDestination();
        mixerNode = audioContext.createDynamicsCompressor();
        mixerNode.connect(recordDest);

        // Nhánh Audio phát thanh KM -> mixerNode -> recordDest
        promoGain = audioContext.createGain();
        promoGain.gain.value = 1.0;
        sourceNode.connect(promoGain);
        promoGain.connect(mixerNode);

        // Nhánh Mic -> mixerNode -> recordDest (tuyệt đối KHÔNG nối ra audioContext.destination để tránh hú loa)
        if (recordingMode === 'both' && micStream) {
            micSource = audioContext.createMediaStreamSource(micStream);
            micGain = audioContext.createGain();
            micGain.gain.value = 1.0;
            micSource.connect(micGain);
            micGain.connect(mixerNode);
        }

        return {
            audioTracks: recordDest.stream.getAudioTracks(),
            cleanup
        };
    } catch (err) {
        cleanup();
        throw err;
    }
}
