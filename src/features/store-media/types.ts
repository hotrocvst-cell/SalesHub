export interface PromoAudioItem {
    id: string;
    title: string;
    description?: string;
    sourceType: 'google_drive' | 'local_file';
    driveFileId?: string;
    driveUrl?: string;
    storeCodes: string[]; // ['10335'] hoặc [] (toàn cụm)
    durationSec?: number;
    validUntil?: string; // YYYY-MM-DD
    isActive: boolean;
    blobUrl?: string;
    isCachedLocally?: boolean;
    createdAt?: string;
    createdBy?: string;
}

export interface GeoLocationInfo {
    latitude: number | null;
    longitude: number | null;
    accuracy: number | null; // meters
    streetAddress: string;
    storeAddress: string;
    distanceToStoreMeters: number | null;
    isWithinStoreRange: boolean; // within 100m
    error: string | null;
    timestamp: Date;
}

export type VideoAudioRecordingMode = 'microphone' | 'digital_mix' | 'both';

export interface RecordedVideoResult {
    blob: Blob;
    url: string;
    mimeType: string;
    durationSeconds: number;
    recordedAt: Date;
    storeName: string;
    storeCode: string;
    employeeName: string;
    employeeId: string;
}
