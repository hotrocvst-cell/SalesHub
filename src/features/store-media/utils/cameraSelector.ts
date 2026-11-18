/**
 * Bộ chọn Camera Chính (Primary Rear 1x Camera) dành riêng cho Smartphone nhiều ống kính.
 * Mục tiêu:
 * - Luôn chọn duy nhất camera sau chính (1x Wide / camera2 0 / Back Camera).
 * - Loại trừ tuyệt đối camera trước (selfie), tele/telephoto, macro, ultra-wide (0.5x), depth/mono.
 * - Khóa mức zoom về 1x và lấy nét tự động chuẩn (continuous) nếu trình duyệt hỗ trợ.
 */

interface ExtendedTrackCapabilities extends MediaTrackCapabilities {
    zoom?: { min: number; max: number; step?: number };
    focusMode?: string[];
    torch?: boolean;
}

interface ExtendedConstraintSet extends MediaTrackConstraintSet {
    zoom?: number;
    focusMode?: string;
}

export interface PrimaryCameraResult {
    stream: MediaStream;
    activeCameraLabel: string;
    hasTorch: boolean;
}

const FRONT_CAMERA_PATTERN = /(\b(front|user|selfie|facetime|truedepth|truoc)\b|trước)/i;

const AUX_LENS_PATTERN =
    /(\b(tele|telephoto|macro|micro|ultra[\s_-]?wide|ultrawide|super[\s_-]?wide|0\.[56]x?|2x|3x|5x|10x|periscope|depth|tof|lidar|mono|monochrome|ir|infrared|bokeh|portrait|aux|auxiliary|secondary|sub)\b|siêu\s*rộng|sieu\s*rong|cận\s*cảnh|can\s*canh)/i;

const REAR_CAMERA_PATTERN = /\b(back|rear|environment|sau|world|main|primary)\b/i;

const PRIMARY_MAIN_PATTERN = /(\b(main|primary|chinh)\b|chính)/i;

const LOGICAL_MULTI_LENS_PATTERN = /\b(triple|dual)\b/i;

/**
 * Kiểm tra xem nhãn camera có phải ống kính phụ (tele/macro/ultra-wide/depth) hoặc camera trước không.
 */
export function isExcludedAuxiliaryOrFrontCamera(label: string): boolean {
    const normalized = label.trim().toLowerCase();
    if (!normalized) return false;
    return FRONT_CAMERA_PATTERN.test(normalized) || AUX_LENS_PATTERN.test(normalized);
}

/**
 * Chấm điểm mức độ ưu tiên để xác định đúng camera sau chính (1x).
 * Điểm càng cao càng ưu tiên; trả về -1 nếu bị loại trừ.
 */
function scoreRearCamera(device: MediaDeviceInfo, index: number): number {
    const label = (device.label || '').trim().toLowerCase();
    if (!label) return -1;

    // Loại trừ tuyệt đối camera trước và toàn bộ ống kính phụ (tele, macro, ultra-wide, depth...)
    if (isExcludedAuxiliaryOrFrontCamera(label)) {
        return -1;
    }

    // Chỉ xét camera sau
    if (!REAR_CAMERA_PATTERN.test(label)) {
        return -1;
    }

    let score = 100;

    // Android Camera2 API: "camera2 0, facing back" hoặc "camera 0, facing back" luôn là cảm biến chính 1x
    const camIdMatch = label.match(/\b(?:camera2?|cam|id)\s*(\d+)\b/i) || label.match(/^(\d+)\s*,/i);
    if (camIdMatch) {
        const camIndex = Number(camIdMatch[1]);
        if (camIndex === 0) {
            score += 60;
        } else {
            // Các ID >= 2 trên Android đa số là ống kính phụ (ultra-wide, macro, tele, depth)
            score -= Math.min(40, camIndex * 10);
        }
    }

    // Nhãn tường minh của camera chính (iOS: "Back Camera" / "Back Wide Angle Camera", Android: "Back Main Camera")
    if (label === 'back camera' || label === 'rear camera' || label === 'camera sau') {
        score += 55;
    }
    if (PRIMARY_MAIN_PATTERN.test(label)) {
        score += 45;
    }
    // "Wide" không đi kèm "Ultra" (ultra-wide đã bị loại ở trên) là tiêu cự chính 1x trên iOS/Android
    if (/\bwide\b/i.test(label)) {
        score += 25;
    }

    // Trên iPhone Pro, camera logic Triple/Dual có thể tự nhảy sang macro khi đưa sát vật thể;
    // vẫn chấp nhận làm dự phòng nhưng xếp sau ống kính vật lý "Back Camera" / "Back Wide Angle Camera"
    if (LOGICAL_MULTI_LENS_PATTERN.test(label)) {
        score -= 15;
    }

    // Ưu tiên nhẹ thiết bị xuất hiện sớm hơn trong danh sách nếu điểm bằng nhau
    score -= index * 0.1;

    return score;
}

/**
 * Chọn ra duy nhất 1 camera sau chính từ danh sách thiết bị videoinput.
 * Trả về null nếu thiết bị không có camera sau (ví dụ PC/Laptop chỉ có webcam).
 */
export function selectPrimaryRearCamera(devices: MediaDeviceInfo[]): MediaDeviceInfo | null {
    const videoInputs = devices.filter(d => d.kind === 'videoinput' && Boolean(d.deviceId));
    if (videoInputs.length === 0) return null;

    let bestDevice: MediaDeviceInfo | null = null;
    let bestScore = -1;

    videoInputs.forEach((device, idx) => {
        const score = scoreRearCamera(device, idx);
        if (score > bestScore) {
            bestScore = score;
            bestDevice = device;
        }
    });

    return bestDevice;
}

/**
 * Khóa cấu hình tiêu cự về mức chuẩn 1x và lấy nét tự động liên tục (nếu phần cứng hỗ trợ)
 * để tránh trình duyệt tự chuyển sang zoom tele hoặc chế độ macro.
 */
async function applyPrimaryLensSafeguards(track: MediaStreamTrack): Promise<boolean> {
    const caps = (track.getCapabilities?.() as ExtendedTrackCapabilities | undefined) || {};
    const advanced: ExtendedConstraintSet = {};
    let hasConstraintToApply = false;

    if (caps.zoom && typeof caps.zoom.min === 'number' && typeof caps.zoom.max === 'number') {
        const targetZoom = Math.min(caps.zoom.max, Math.max(caps.zoom.min, 1));
        advanced.zoom = targetZoom;
        hasConstraintToApply = true;
    }

    if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
        advanced.focusMode = 'continuous';
        hasConstraintToApply = true;
    }

    if (hasConstraintToApply) {
        try {
            await track.applyConstraints({
                advanced: [advanced as MediaTrackConstraintSet]
            });
        } catch {
            // Một số trình duyệt di động không hỗ trợ applyConstraints cho zoom/focusMode -> bỏ qua an toàn
        }
    }

    return Boolean(caps.torch);
}

/**
 * Mở duy nhất luồng camera sau chính (1x) cho smartphone nhiều camera.
 */
export async function openPrimaryRearCameraStream(): Promise<PrimaryCameraResult> {
    if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Trình duyệt không hỗ trợ truy cập camera. Vui lòng mở bằng Chrome/Safari trên HTTPS.');
    }

    const baseVideoConstraints: MediaTrackConstraints = {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 }
    };

    // Bước 1: Xin quyền và mở luồng ban đầu với ưu tiên camera sau để trình duyệt cung cấp đầy đủ nhãn thiết bị
    let activeStream = await navigator.mediaDevices.getUserMedia({
        video: baseVideoConstraints,
        audio: false
    });

    let activeTrack = activeStream.getVideoTracks()[0];
    const currentDeviceId = activeTrack?.getSettings?.().deviceId || '';
    const currentLabel = activeTrack?.label || '';

    // Bước 2: Liệt kê toàn bộ ống kính camera trên thiết bị và xác định đúng camera sau chính (1x)
    if (navigator.mediaDevices.enumerateDevices) {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const primaryRear = selectPrimaryRearCamera(devices);

            if (primaryRear && primaryRear.deviceId && primaryRear.deviceId !== currentDeviceId) {
                // Giải phóng luồng cũ trước khi mở luồng camera chính (tránh lỗi NotReadableError trên Android HAL)
                activeStream.getTracks().forEach(t => t.stop());

                try {
                    activeStream = await navigator.mediaDevices.getUserMedia({
                        video: {
                            deviceId: { exact: primaryRear.deviceId },
                            width: { ideal: 1280 },
                            height: { ideal: 720 }
                        },
                        audio: false
                    });
                    activeTrack = activeStream.getVideoTracks()[0];
                } catch {
                    // Dự phòng an toàn nếu trình duyệt từ chối exact deviceId
                    activeStream = await navigator.mediaDevices.getUserMedia({
                        video: baseVideoConstraints,
                        audio: false
                    });
                    activeTrack = activeStream.getVideoTracks()[0];
                }
            }
        } catch {
            // Giữ nguyên luồng ban đầu nếu enumerateDevices bị hạn chế
        }
    }

    // Bước 3: Áp dụng khóa zoom 1x và lấy nét liên tục, đồng thời kiểm tra đèn Flash/Torch
    const hasTorch = activeTrack ? await applyPrimaryLensSafeguards(activeTrack) : false;
    const finalLabel = activeTrack?.label || currentLabel || 'Camera chính';

    return {
        stream: activeStream,
        activeCameraLabel: finalLabel,
        hasTorch
    };
}
