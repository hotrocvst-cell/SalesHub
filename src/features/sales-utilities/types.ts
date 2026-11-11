export type LuckyToolKey =
    | 'number_range'
    | 'name_picker'
    | 'lucky_wheel'
    | 'gift_box'
    | 'team_splitter'
    | 'mini_tools';

export type PersistentToolKey = Exclude<LuckyToolKey, 'mini_tools'>;

export interface NumberRangeConfig {
    min: number;
    max: number;
    count: number;
    allowDuplicate: boolean;
}

export interface NamePickerConfig {
    rawItemsText: string;
    removeWinnerAfterDraw: boolean;
    excludedWinners: string[];
}

export interface LuckyWheelConfig {
    rawItemsText: string;
    removeWinnerAfterSpin: boolean;
    excludedWinners: string[];
}

export interface GiftBoxRewardItem {
    id: string;
    name: string;
    quantity: number;
}

export interface GiftBoxInstance {
    boxNumber: number;
    rewardId: string;
    rewardName: string;
    isOpened: boolean;
    openedAt?: string;
}

export interface GiftBoxConfig {
    rewards: GiftBoxRewardItem[];
    boxes: GiftBoxInstance[];
    hideSettingsDuringDraw: boolean;
}

export interface TeamSplitterConfig {
    rawMembersText: string;
    teamCount: number;
    teamPrefix: string;
}

export type ToolConfigPayloadMap = {
    number_range: NumberRangeConfig;
    name_picker: NamePickerConfig;
    lucky_wheel: LuckyWheelConfig;
    gift_box: GiftBoxConfig;
    team_splitter: TeamSplitterConfig;
};

export interface LuckyToolConfigRecord {
    id?: string;
    store_name: string;
    tool_key: PersistentToolKey;
    config_json: ToolConfigPayloadMap[PersistentToolKey];
    updated_by?: string;
    updated_at?: string;
}

export interface LuckyToolLogRecord {
    id?: string;
    store_name: string;
    tool_key: LuckyToolKey;
    result_summary: string;
    result_payload: Record<string, unknown>;
    created_by?: string;
    created_at: string;
}

