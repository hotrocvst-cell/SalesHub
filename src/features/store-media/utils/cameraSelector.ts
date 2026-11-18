/**
 * Bộ chọn Camera Sau Chính (Primary Rear 1x Camera) cho Smartphone nhiều ống kính
 * (OPPO Find X Ultra, Samsung S Ultra, Xiaomi Ultra, iPhone Pro...).
 *
 * Cơ chế 4 lớp chống chọn nhầm camera tiềm vọng (periscope 3x/6x/10x), tele, macro, góc siêu rộng:
 * 1. Kiểm tra `enumerateDevices()` TRƯỚC `getUserMedia()` nếu đã có quyền -> mở thẳng `deviceId` camera chính, tránh bug Chrome mở nhầm camera cuối (tiềm vọng 10x).
 * 2. Chờ giải phóng phần cứng Android Camera2 HAL (220ms) + retry chống `NotReadableError` trước khi chuyển ống kính, không vội fallback về `facingMode: 'environment'`.
 * 3. Lọc bằng cả `InputDeviceInfo.getCapabilities().facingMode` lẫn nhãn thiết bị (loại trừ tuyệt đối front, tele, periscope/tiềm vọng, macro, ultra-wide, depth).
 * 4. Xác minh năng lực phần cứng thực tế (`torch` đèn flash, `focusMode: continuous`, `focusDistance`, `zoom`) giữa các ống kính sau để tìm đúng cảm biến chính 1x, sau đó lưu nhớ `deviceId` trên thiết bị.
 */

export interface CameraHardwareCaps {
    hasTorch: boolean;
    hasContinuousFocus: boolean;
    minFocusDistance: number | null;
    zoomMin: number | null;
    zoomMax: number | null;
    currentZoom: number | null;
    streamWidth: number | null;
    streamHeight: number | null;
    maxWidth: number | null;
}

export interface RearCameraCandidate {
    deviceId: string;
    label: string;
    labelScore: number;
    hardwareCaps?: CameraHardwareCaps;
}

export interface PrimaryCameraResult {
    stream: MediaStream;
    activeCameraLabel: string;
    activeDeviceId: string;
    hasTorch: boolean;
    hardwareCaps: CameraHardwareCaps;
    rearCameras: RearCameraCandidate[];
}

interface ExtendedTrackCapabilities extends MediaTrackCapabilities {
    zoom?: { min: number; max: number; step?: number };
    focusMode?: string[];
    focusDistance?: { min: number; max: number; step?: number };
    torch?: boolean;
}

interface ExtendedConstraintSet extends MediaTrackConstraintSet {
    zoom?: number;
    focusMode?: string;
}

interface InputDeviceWithCaps extends MediaDeviceInfo {
    getCapabilities?: () => { facingMode?: string[] };
}

const STORAGE_KEY_VERIFIED_CAMERA = 'saleshub_primary_rear_camera_v2';
const HAL_RELEASE_DELAY_MS = 220;
const HAL_RETRY_DELAY_MS = 350;
const MAX_PROBE_CANDIDATES = 4;

const FRONT_CAMERA_PATTERN = /(\b(front|user|selfie|facetime|truedepth|truoc)\b|trước)/i;
const AUX_LENS_PATTERN =
    /(\b(tele|telephoto|periscope|macro|micro|ultra[\s_-]?wide|ultrawide|super[\s_-]?wide|0\.[56]x?|2x|3x|5x|6x|10x|depth|tof|lidar|mono|monochrome|ir|infrared|bokeh|portrait|aux|auxiliary|secondary|sub)\b|tiềm\s*vọng|tiem\s*vong|siêu\s*rộng|sieu\s*rong|cận\s*cảnh|can\s*canh)/i;
const REAR_CAMERA_PATTERN = /\b(back|rear|environment|sau|world|main|primary)\b/i;
const PRIMARY_MAIN_PATTERN = /(\b(main|primary|chinh)\b|chính)/i;
const LOGICAL_MULTI_LENS_PATTERN = /\b(triple|dual)\b/i;

const sleep = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));

export function isExcludedAuxiliaryOrFrontCamera(label: string): boolean {
    const normalized = label.trim().toLowerCase();
    if (!normalized) return false;
    return FRONT_CAMERA_PATTERN.test(normalized) || AUX_LENS_PATTERN.test(normalized);
}

function getDeviceFacingModes(device: MediaDeviceInfo): string[] {
    try {
        const caps = (device as InputDeviceWithCaps).getCapabilities?.();
        return Array.isArray(caps?.facingMode) ? caps.facingMode : [];
    } catch {
        return [];
    }
}

function scoreRearCameraLabel(device: MediaDeviceInfo, index: number): number {
    const label = (device.label || '').trim().toLowerCase();
    const facingModes = getDeviceFacingModes(device);

    if (facingModes.includes('user') && !facingModes.includes('environment')) return -1;
    if (label && isExcludedAuxiliaryOrFrontCamera(label)) return -1;

    const isRearByCaps = facingModes.includes('environment');
    const isRearByLabel = Boolean(label) && REAR_CAMERA_PATTERN.test(label);
    if (!isRearByCaps && !isRearByLabel) return -1;

    let score = 100;

    const camIdMatch = label.match(/\b(?:camera2?|cam|id)\s*(\d+)\b/i) || label.match(/^(\d+)\s*,/i);
    if (camIdMatch) {
        const camIndex = Number(camIdMatch[1]);
        if (camIndex === 0) score += 60;
        else score -= Math.min(45, camIndex * 10);
    }

    if (label === 'back camera' || label === 'rear camera' || label === 'camera sau') score += 55;
    if (PRIMARY_MAIN_PATTERN.test(label)) score += 45;
    if (/\bwide\b/i.test(label)) score += 25;
    if (LOGICAL_MULTI_LENS_PATTERN.test(label)) score -= 15;

    return score - index * 0.1;
}

export function getRankedRearCameras(devices: MediaDeviceInfo[]): RearCameraCandidate[] {
    const videoInputs = devices.filter(d => d.kind === 'videoinput' && Boolean(d.deviceId));
    const candidates: RearCameraCandidate[] = [];

    videoInputs.forEach((device, idx) => {
        const labelScore = scoreRearCameraLabel(device, idx);
        if (labelScore >= 0) {
            candidates.push({
                deviceId: device.deviceId,
                label: device.label || `Camera sau #${idx + 1}`,
                labelScore
            });
        }
    });

    return candidates.sort((a, b) => b.labelScore - a.labelScore);
}

function getIdealFullSensorVideoSize(): Pick<MediaTrackConstraints, 'width' | 'height' | 'aspectRatio'> {
    const isPortrait = typeof window !== 'undefined' && window.innerHeight >= window.innerWidth;
    if (isPortrait) {
        // Smartphone cầm dọc: dùng tỷ lệ gốc cảm biến 3:4 để lấy trọn góc nhìn 1x, không bị crop 16:9 gây zoom ~2x
        return {
            width: { ideal: 960 },
            height: { ideal: 1280 },
            aspectRatio: { ideal: 3 / 4 }
        };
    }
    return {
        width: { ideal: 1280 },
        height: { ideal: 960 },
        aspectRatio: { ideal: 4 / 3 }
    };
}

function readTrackHardwareCaps(track: MediaStreamTrack | undefined): CameraHardwareCaps {
    const caps = (track?.getCapabilities?.() as ExtendedTrackCapabilities | undefined) || {};
    const settings = (track?.getSettings?.() as (MediaTrackSettings & { zoom?: number }) | undefined) || {};
    return {
        hasTorch: Boolean(caps.torch),
        hasContinuousFocus: Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous'),
        minFocusDistance: typeof caps.focusDistance?.min === 'number' ? caps.focusDistance.min : null,
        zoomMin: typeof caps.zoom?.min === 'number' ? caps.zoom.min : null,
        zoomMax: typeof caps.zoom?.max === 'number' ? caps.zoom.max : null,
        currentZoom: typeof settings.zoom === 'number' ? Number(settings.zoom.toFixed(2)) : null,
        streamWidth: typeof settings.width === 'number' ? settings.width : null,
        streamHeight: typeof settings.height === 'number' ? settings.height : null,
        maxWidth: typeof caps.width?.max === 'number' ? caps.width.max : null
    };
}

function scoreHardwareCaps(caps: CameraHardwareCaps, labelScore: number): number {
    let total = labelScore;
    // Đèn Flash (torch) trên Android Camera2 hầu như luôn gắn vật lý với cảm biến chính 1x
    if (caps.hasTorch) total += 120;
    if (caps.hasContinuousFocus) total += 35;
    if (caps.minFocusDistance !== null) {
        if (caps.minFocusDistance > 0 && caps.minFocusDistance <= 0.25) total += 25;
        else if (caps.minFocusDistance >= 0.45) total -= 55; // Ống kính tele/tiềm vọng có khoảng lấy nét gần rất xa
    }
    if (caps.zoomMin !== null && caps.zoomMax !== null && caps.zoomMin <= 1 && caps.zoomMax >= 4) {
        total += 20;
    }
    if (caps.maxWidth !== null && caps.maxWidth >= 3000) total += 10;
    return total;
}

async function applyPrimaryLensSafeguards(track: MediaStreamTrack | undefined): Promise<CameraHardwareCaps> {
    const hwCaps = readTrackHardwareCaps(track);
    if (!track) return hwCaps;

    // Áp dụng khóa zoom 1x và focusMode tách biệt nhau để lỗi focusMode không làm hỏng việc reset zoom về 1x
    if (hwCaps.zoomMin !== null && hwCaps.zoomMax !== null) {
        const targetZoom = Math.min(hwCaps.zoomMax, Math.max(hwCaps.zoomMin, 1));
        try {
            const zoomSet: ExtendedConstraintSet = { zoom: targetZoom };
            await track.applyConstraints({ advanced: [zoomSet as MediaTrackConstraintSet] });
        } catch {
            // Bỏ qua an toàn nếu trình duyệt không hỗ trợ applyConstraints zoom
        }
    }

    if (hwCaps.hasContinuousFocus) {
        try {
            const focusSet: ExtendedConstraintSet = { focusMode: 'continuous' };
            await track.applyConstraints({ advanced: [focusSet as MediaTrackConstraintSet] });
        } catch {
            // Bỏ qua an toàn nếu trình duyệt không hỗ trợ focusMode
        }
    }

    return readTrackHardwareCaps(track);
}

async function stopStreamAndReleaseHal(stream: MediaStream | null): Promise<void> {
    if (!stream) return;
    stream.getTracks().forEach(t => t.stop());
    await sleep(HAL_RELEASE_DELAY_MS);
}

async function openStreamByDeviceId(deviceId: string): Promise<MediaStream> {
    const idealSize = getIdealFullSensorVideoSize();
    const tryOpen = (withSize: boolean) =>
        navigator.mediaDevices.getUserMedia({
            video: withSize
                ? { deviceId: { exact: deviceId }, ...idealSize }
                : { deviceId: { exact: deviceId } },
            audio: false
        });

    try {
        return await tryOpen(true);
    } catch (err: any) {
        if (err?.name === 'OverconstrainedError') {
            return await tryOpen(false);
        }
        // Chờ thêm 350ms nếu Android Camera2 HAL chưa nhả tài nguyên kịp (NotReadableError / AbortError)
        await sleep(HAL_RETRY_DELAY_MS);
        try {
            return await tryOpen(true);
        } catch {
            return await tryOpen(false);
        }
    }
}

function buildRearSignature(rearCameras: RearCameraCandidate[]): string {
    return rearCameras.map(c => c.deviceId).sort().join('|');
}

function loadCachedRearDeviceId(rearCameras: RearCameraCandidate[]): string | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_VERIFIED_CAMERA);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { deviceId?: string; signature?: string };
        if (!parsed.deviceId) return null;
        if (parsed.signature && parsed.signature !== buildRearSignature(rearCameras)) return null;
        return rearCameras.some(c => c.deviceId === parsed.deviceId) ? parsed.deviceId : null;
    } catch {
        return null;
    }
}

export function saveVerifiedPrimaryCamera(deviceId: string, rearCameras: RearCameraCandidate[]): void {
    try {
        localStorage.setItem(
            STORAGE_KEY_VERIFIED_CAMERA,
            JSON.stringify({ deviceId, signature: buildRearSignature(rearCameras) })
        );
    } catch {
        // Bỏ qua nếu trình duyệt chặn localStorage
    }
}

export function clearVerifiedPrimaryCamera(): void {
    try {
        localStorage.removeItem(STORAGE_KEY_VERIFIED_CAMERA);
    } catch {
        // Bỏ qua
    }
}

export async function openPrimaryRearCameraStream(preferredDeviceId?: string): Promise<PrimaryCameraResult> {
    if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Trình duyệt không hỗ trợ truy cập camera. Vui lòng mở bằng Chrome/Safari trên HTTPS.');
    }

    const baseConstraints: MediaTrackConstraints = {
        facingMode: { ideal: 'environment' },
        ...getIdealFullSensorVideoSize()
    };

    // Bước 1: Kiểm tra enumerateDevices() trước — nếu trình duyệt đã có quyền, mở thẳng camera chính ngay lần đầu
    let devices: MediaDeviceInfo[] = [];
    if (navigator.mediaDevices.enumerateDevices) {
        try {
            devices = await navigator.mediaDevices.enumerateDevices();
        } catch {
            devices = [];
        }
    }

    const hasReadableLabels = devices.some(d => d.kind === 'videoinput' && Boolean(d.label));
    let activeStream: MediaStream | null = null;

    if (!hasReadableLabels) {
        activeStream = await navigator.mediaDevices.getUserMedia({ video: baseConstraints, audio: false });
        if (navigator.mediaDevices.enumerateDevices) {
            try {
                devices = await navigator.mediaDevices.enumerateDevices();
            } catch {
                // Giữ luồng hiện tại
            }
        }
    }

    const rearCameras = getRankedRearCameras(devices);

    // PC / Laptop hoặc thiết bị không có camera sau
    if (rearCameras.length === 0) {
        const fallbackStream =
            activeStream || (await navigator.mediaDevices.getUserMedia({ video: baseConstraints, audio: false }));
        const track = fallbackStream.getVideoTracks()[0];
        const hwCaps = await applyPrimaryLensSafeguards(track);
        return {
            stream: fallbackStream,
            activeCameraLabel: track?.label || 'Camera chính',
            activeDeviceId: track?.getSettings?.().deviceId || '',
            hasTorch: hwCaps.hasTorch,
            hardwareCaps: hwCaps,
            rearCameras: []
        };
    }

    // Xác định ứng viên ưu tiên (chỉ định thủ công -> đã lưu trên thiết bị -> điểm nhãn cao nhất)
    const cachedId = preferredDeviceId || loadCachedRearDeviceId(rearCameras);
    const targetCandidate =
        (cachedId ? rearCameras.find(c => c.deviceId === cachedId) : null) || rearCameras[0];

    const currentTrackId = activeStream?.getVideoTracks()[0]?.getSettings?.().deviceId || '';
    if (!activeStream || currentTrackId !== targetCandidate.deviceId) {
        await stopStreamAndReleaseHal(activeStream);
        try {
            activeStream = await openStreamByDeviceId(targetCandidate.deviceId);
        } catch {
            activeStream = await navigator.mediaDevices.getUserMedia({ video: baseConstraints, audio: false });
        }
    }

    let activeTrack = activeStream.getVideoTracks()[0];
    let activeDeviceId = activeTrack?.getSettings?.().deviceId || targetCandidate.deviceId;
    let activeHwCaps = readTrackHardwareCaps(activeTrack);

    // Bước 2: Nếu máy có nhiều camera sau & chưa cố định thủ công, kiểm tra phần cứng nếu ống kính đầu thiếu Flash hoặc là tiềm vọng
    const isSuspiciousLens =
        !activeHwCaps.hasTorch ||
        (activeHwCaps.minFocusDistance !== null && activeHwCaps.minFocusDistance >= 0.45);

    if (!cachedId && rearCameras.length > 1 && isSuspiciousLens) {
        let bestId = activeDeviceId;
        let bestScore = scoreHardwareCaps(activeHwCaps, targetCandidate.labelScore);
        targetCandidate.hardwareCaps = activeHwCaps;

        const othersToProbe = rearCameras
            .filter(c => c.deviceId !== activeDeviceId)
            .slice(0, MAX_PROBE_CANDIDATES - 1);

        for (const candidate of othersToProbe) {
            await stopStreamAndReleaseHal(activeStream);
            activeStream = null;
            try {
                const probeStream = await openStreamByDeviceId(candidate.deviceId);
                const probeTrack = probeStream.getVideoTracks()[0];
                const probeCaps = readTrackHardwareCaps(probeTrack);
                candidate.hardwareCaps = probeCaps;
                const probeScore = scoreHardwareCaps(probeCaps, candidate.labelScore);

                activeStream = probeStream;
                activeTrack = probeTrack;
                activeDeviceId = probeTrack?.getSettings?.().deviceId || candidate.deviceId;
                activeHwCaps = probeCaps;

                if (probeScore > bestScore) {
                    bestScore = probeScore;
                    bestId = candidate.deviceId;
                    // Nếu tìm thấy ống kính có Flash + lấy nét liên tục + khoảng lấy nét gần chuẩn -> chốt ngay
                    if (
                        probeCaps.hasTorch &&
                        probeCaps.hasContinuousFocus &&
                        (probeCaps.minFocusDistance === null || probeCaps.minFocusDistance < 0.45)
                    ) {
                        break;
                    }
                }
            } catch {
                // Bỏ qua ống kính lỗi khi dò
            }
        }

        if (!activeStream || activeDeviceId !== bestId) {
            await stopStreamAndReleaseHal(activeStream);
            try {
                activeStream = await openStreamByDeviceId(bestId);
            } catch {
                activeStream = await navigator.mediaDevices.getUserMedia({ video: baseConstraints, audio: false });
            }
            activeTrack = activeStream.getVideoTracks()[0];
            activeDeviceId = activeTrack?.getSettings?.().deviceId || bestId;
        }
    }

    // Bước 3: Khóa zoom về 1x & continuous AF, lưu cache cho lần mở sau
    activeHwCaps = await applyPrimaryLensSafeguards(activeTrack);
    const matched = rearCameras.find(c => c.deviceId === activeDeviceId);
    if (matched) matched.hardwareCaps = activeHwCaps;
    if (activeDeviceId) saveVerifiedPrimaryCamera(activeDeviceId, rearCameras);

    return {
        stream: activeStream,
        activeCameraLabel: activeTrack?.label || matched?.label || 'Camera chính',
        activeDeviceId,
        hasTorch: activeHwCaps.hasTorch,
        hardwareCaps: activeHwCaps,
        rearCameras
    };
}
