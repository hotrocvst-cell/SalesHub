import { useState, useEffect, useCallback } from 'react';
import type {
    GiftBoxConfig,
    LuckyToolKey,
    LuckyToolLogRecord,
    LuckyWheelConfig,
    NamePickerConfig,
    NumberRangeConfig,
    PersistentToolKey,
    TeamSplitterConfig,
    ToolConfigPayloadMap
} from '../types';
import {
    appendStoreLuckyLog,
    fetchStoreLuckyConfigs,
    fetchStoreLuckyLogs,
    upsertStoreLuckyConfig
} from '../services/luckyToolCloudService';
import { buildShuffledGiftBoxes } from '../components/GiftBoxDrawTool';

const DEFAULT_NUMBER_CONFIG: NumberRangeConfig = { min: 1, max: 100, count: 1, allowDuplicate: false };
const DEFAULT_PICKER_CONFIG: NamePickerConfig = {
    rawItemsText: 'Giải Nhất\nGiải Nhì\nGiải Ba\nKhuyến khích',
    removeWinnerAfterDraw: true,
    excludedWinners: []
};
const DEFAULT_WHEEL_CONFIG: LuckyWheelConfig = {
    rawItemsText: 'Voucher 100k\nVoucher 50k\nQuà bí mật\nThêm 1 lượt\nChúc may mắn\nQuà đặc biệt',
    removeWinnerAfterSpin: false,
    excludedWinners: []
};
const DEFAULT_REWARDS = [
    { id: 'rw_1', name: 'Giải Nhất', quantity: 1 },
    { id: 'rw_2', name: 'Giải Nhì', quantity: 2 },
    { id: 'rw_3', name: 'Giải Ba', quantity: 3 },
    { id: 'rw_4', name: 'Chúc bạn may mắn lần sau', quantity: 4 }
];
const createDefaultGiftConfig = (): GiftBoxConfig => ({
    rewards: DEFAULT_REWARDS,
    boxes: buildShuffledGiftBoxes(DEFAULT_REWARDS),
    hideSettingsDuringDraw: false
});
const DEFAULT_TEAM_CONFIG: TeamSplitterConfig = { rawMembersText: '', teamCount: 2, teamPrefix: 'Đội' };

export function useLuckyDrawHubState(activeStoreScope: string, userLabel: string) {
    const [storageType, setStorageType] = useState<'cloud' | 'local'>('cloud');
    const [tableReady, setTableReady] = useState<boolean>(true);
    const [syncStatus, setSyncStatus] = useState<'synced' | 'unsynced' | 'syncing' | 'error'>('synced');
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
    const [toastMessage, setToastMessage] = useState<string>('');

    const [numberConfig, setNumberConfig] = useState<NumberRangeConfig>(DEFAULT_NUMBER_CONFIG);
    const [pickerConfig, setPickerConfig] = useState<NamePickerConfig>(DEFAULT_PICKER_CONFIG);
    const [wheelConfig, setWheelConfig] = useState<LuckyWheelConfig>(DEFAULT_WHEEL_CONFIG);
    const [giftConfig, setGiftConfig] = useState<GiftBoxConfig>(() => createDefaultGiftConfig());
    const [teamConfig, setTeamConfig] = useState<TeamSplitterConfig>(DEFAULT_TEAM_CONFIG);
    const [logs, setLogs] = useState<LuckyToolLogRecord[]>([]);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        window.setTimeout(() => setToastMessage(''), 2800);
    };

    useEffect(() => {
        let mounted = true;
        setSyncStatus('syncing');

        Promise.all([
            fetchStoreLuckyConfigs(activeStoreScope),
            fetchStoreLuckyLogs(activeStoreScope, 20)
        ]).then(([cfgRes, logRes]) => {
            if (!mounted) return;
            setNumberConfig((cfgRes.configs.number_range as NumberRangeConfig) || DEFAULT_NUMBER_CONFIG);
            setPickerConfig((cfgRes.configs.name_picker as NamePickerConfig) || DEFAULT_PICKER_CONFIG);
            setWheelConfig((cfgRes.configs.lucky_wheel as LuckyWheelConfig) || DEFAULT_WHEEL_CONFIG);
            setGiftConfig((cfgRes.configs.gift_box as GiftBoxConfig) || createDefaultGiftConfig());
            setTeamConfig((cfgRes.configs.team_splitter as TeamSplitterConfig) || DEFAULT_TEAM_CONFIG);
            setLogs(logRes.logs);

            const ready = cfgRes.tableReady && logRes.tableReady;
            setTableReady(ready);
            setStorageType(ready && cfgRes.source === 'cloud' ? 'cloud' : 'local');
            setSyncStatus('synced');
            setLastSyncTime(new Date());
        });

        return () => {
            mounted = false;
        };
    }, [activeStoreScope]);

    const handleSaveToolConfig = useCallback(
        async <K extends PersistentToolKey>(toolKey: K, payload: ToolConfigPayloadMap[K]) => {
            setSyncStatus('syncing');
            const res = await upsertStoreLuckyConfig(activeStoreScope, toolKey, payload, userLabel);
            setTableReady(res.tableReady);
            setStorageType(res.source);
            setSyncStatus(res.tableReady ? 'synced' : 'unsynced');
            setLastSyncTime(new Date());
            if (toolKey === 'name_picker' || toolKey === 'lucky_wheel' || toolKey === 'team_splitter') {
                showToast(res.source === 'cloud' ? 'Đã lưu cấu hình lên Cloud.' : 'Đã lưu tạm trên máy.');
            }
        },
        [activeStoreScope, userLabel]
    );

    const handleRecordLog = useCallback(
        async (toolKey: LuckyToolKey, summary: string, payload: Record<string, unknown>) => {
            const res = await appendStoreLuckyLog({
                store_name: activeStoreScope,
                tool_key: toolKey,
                result_summary: summary,
                result_payload: payload,
                created_by: userLabel
            });
            setLogs(prev => [res.record, ...prev].slice(0, 20));
            setTableReady(res.tableReady);
            setStorageType(res.source);
            setLastSyncTime(new Date());
        },
        [activeStoreScope, userLabel]
    );

    return {
        storageType,
        tableReady,
        syncStatus,
        lastSyncTime,
        toastMessage,
        numberConfig,
        setNumberConfig,
        pickerConfig,
        setPickerConfig,
        wheelConfig,
        setWheelConfig,
        giftConfig,
        setGiftConfig,
        teamConfig,
        setTeamConfig,
        logs,
        handleSaveToolConfig,
        handleRecordLog
    };
}

