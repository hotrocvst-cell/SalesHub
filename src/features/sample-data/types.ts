export interface SampleDataItem {
    id: string;
    label: string;
    sample_text: string;
    note?: string;
    updated_at: string;
}

export interface SampleDataGroup {
    id: string;
    group_key: string;
    group_title: string;
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

