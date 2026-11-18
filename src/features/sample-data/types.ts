export type OcrToolCategory =
    | 'cumulative_store'
    | 'cumulative_employee'
    | 'realtime_store'
    | 'realtime_employee'
    | 'other';

export interface SampleImageAsset {
    id: string;
    file_name: string;
    mime_type: string;
    data_url: string;
    width?: number;
    height?: number;
    size_kb?: number;
    caption?: string;
    uploaded_at: string;
}

export interface SampleDataItem {
    id: string;
    label: string;
    note?: string;
    images: SampleImageAsset[];
    updated_at: string;
}

export interface SampleDataGroup {
    id: string;
    group_key: string;
    group_title: string;
    tool_category?: OcrToolCategory;
    tool_path?: string;
    description?: string;
    order_index: number;
    items: SampleDataItem[];
    created_at?: string;
    updated_at?: string;
    updated_by?: string;
}

export interface SampleDataSyncStatus {
    isCloudConnected: boolean;
    isTableReady: boolean;
    isSyncing: boolean;
    lastSyncedAt: Date | null;
    source: 'SUPABASE_CLOUD' | 'LOCAL_CACHE';
    pendingChangesCount: number;
    errorMessage?: string;
}
