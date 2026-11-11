import React, { useState, useEffect, useMemo } from 'react';
import {
    Hash,
    Sparkles,
    Disc3,
    Gift,
    Users,
    Grid,
    Store,
    Lock,
    Volume2,
    VolumeX
} from 'lucide-react';
import { useAuth } from '../../shared/contexts/AuthContext';
import { useUserStoreFilter } from '../../shared/hooks/useUserStoreFilter';
import { fetchStores, fetchEmployees, type StoreItem, type EmployeeItem } from '../../core/lib/storage';
import { formatStoreDisplayName, getShortStoreName, isStoreMatch } from '../../core/lib/formatters';
import CloudDataSyncStatusBanner from '../../shared/components/report/CloudDataSyncStatusBanner';
import type { LuckyToolKey } from './types';
import { LUCKY_TOOLS_SQL_DDL } from './services/luckyToolCloudService';
import { useLuckyDrawHubState } from './hooks/useLuckyDrawHubState';
import { playFeedbackTone, unlockSoundEngine } from './utils/randomUtils';
import NumberRangeTool from './components/NumberRangeTool';
import NamePickerTool from './components/NamePickerTool';
import LuckyWheelTool from './components/LuckyWheelTool';
import GiftBoxDrawTool from './components/GiftBoxDrawTool';
import TeamSplitterTool from './components/TeamSplitterTool';
import MiniUtilitiesTool from './components/MiniUtilitiesTool';
import LuckyToolHistorySection from './components/LuckyToolHistorySection';

const TOOL_TABS: Array<{
    key: LuckyToolKey;
    shortLabel: string;
    icon: React.ComponentType<{ className?: string }>;
}> = [
    { key: 'number_range', shortLabel: 'Quay số', icon: Hash },
    { key: 'name_picker', shortLabel: 'Quay tên', icon: Sparkles },
    { key: 'lucky_wheel', shortLabel: 'Vòng quay', icon: Disc3 },
    { key: 'gift_box', shortLabel: 'Bốc thăm', icon: Gift },
    { key: 'team_splitter', shortLabel: 'Chia đội', icon: Users },
    { key: 'mini_tools', shortLabel: 'Tiện ích nhỏ', icon: Grid }
];

export default function LuckyDrawHubPage() {
    const { currentUser, isAdmin } = useAuth();

    const [stores, setStores] = useState<StoreItem[]>([]);
    const [systemEmployees, setSystemEmployees] = useState<EmployeeItem[]>([]);
    const [selectedStore, setSelectedStore] = useState<string>('');
    const { allowedStores, isLockedToSingleStore, canViewAllStores } = useUserStoreFilter(
        stores,
        selectedStore,
        setSelectedStore
    );

    useEffect(() => {
        if (!selectedStore) {
            if (canViewAllStores) setSelectedStore('all');
            else if (allowedStores.length > 0) setSelectedStore(allowedStores[0].name);
        }
    }, [allowedStores, canViewAllStores, selectedStore]);

    useEffect(() => {
        Promise.all([fetchStores(), fetchEmployees()]).then(([sRes, eRes]) => {
            if (sRes.success && sRes.data) setStores(sRes.data);
            if (eRes.success && eRes.data) setSystemEmployees(eRes.data);
        });
    }, []);

    const activeStoreScope = selectedStore || (allowedStores[0]?.name ?? 'GLOBAL');
    const storeDisplayLabel = activeStoreScope === 'all' ? 'Toàn Cụm ST' : getShortStoreName(activeStoreScope);

    const storeEmployees = useMemo(() => {
        const activeOnly = systemEmployees.filter(e => e.is_active !== false);
        if (!activeStoreScope || activeStoreScope === 'all' || activeStoreScope === 'GLOBAL') {
            return activeOnly;
        }
        return activeOnly.filter(e => isStoreMatch(e.store_name, activeStoreScope, stores));
    }, [systemEmployees, activeStoreScope, stores]);

    const [activeTool, setActiveTool] = useState<LuckyToolKey>('number_range');
    const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

    const userLabel = currentUser?.full_name
        ? (currentUser.employee_id ? `${currentUser.full_name} (${currentUser.employee_id})` : currentUser.full_name)
        : (currentUser?.email || 'Nhân sự ST');

    const {
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
    } = useLuckyDrawHubState(activeStoreScope, userLabel);

    return (
        <div className="p-3 sm:p-6 max-w-5xl mx-auto space-y-4 pb-14">
            {toastMessage && (
                <div
                    role="status"
                    aria-live="polite"
                    className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-2 rounded-full text-xs font-bold shadow-lg"
                >
                    {toastMessage}
                </div>
            )}

            <CloudDataSyncStatusBanner
                storageType={storageType}
                syncStatus={syncStatus}
                tableReady={tableReady}
                tableName="sales_lucky_tool_configs"
                sqlDdl={isAdmin ? LUCKY_TOOLS_SQL_DDL : undefined}
                lastSyncTime={lastSyncTime}
                customMessage={`Cấu hình & lịch sử quay số ST [${storeDisplayLabel}]`}
                compact={true}
            />

            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                        <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                            Quay Số &amp; Bốc Thăm
                        </h1>
                        <p className="text-xs text-slate-600 mt-0.5">
                            Bộ công cụ quay số ngẫu nhiên công bằng, vòng quay may mắn, hộp quà bí ẩn và tiện ích quầy ST
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            const nextState = !soundEnabled;
                            setSoundEnabled(nextState);
                            if (nextState) {
                                unlockSoundEngine();
                                playFeedbackTone('flip');
                            }
                        }}
                        aria-label={soundEnabled ? 'Tắt âm thanh thông báo' : 'Bật âm thanh thông báo'}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border inline-flex items-center gap-1.5 transition cursor-pointer ${
                            soundEnabled
                                ? 'bg-sky-50 hover:bg-sky-100 text-[#0066ab] border-sky-200'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                        }`}
                    >
                        {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-[#0066ab]" aria-hidden="true" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />}
                        <span>{soundEnabled ? 'Âm thanh: Bật' : 'Âm thanh: Tắt'}</span>
                    </button>
                </div>

                {/* Dòng lọc ST độc lập đầu tiên */}
                <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 shrink-0">
                        {isLockedToSingleStore ? (
                            <Lock className="w-3.5 h-3.5 text-amber-700" aria-hidden="true" />
                        ) : (
                            <Store className="w-3.5 h-3.5 text-[#0066ab]" aria-hidden="true" />
                        )}
                        <label htmlFor="lucky-store-select">Đơn vị / ST áp dụng:</label>
                    </div>

                    <select
                        id="lucky-store-select"
                        value={selectedStore}
                        disabled={isLockedToSingleStore}
                        onChange={e => setSelectedStore(e.target.value)}
                        className="flex-1 bg-slate-50 border border-slate-300 text-slate-900 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-[#0066ab] disabled:opacity-65 cursor-pointer"
                    >
                        {canViewAllStores && <option value="all">Toàn Cụm ST</option>}
                        {allowedStores.map(st => (
                            <option key={st.id || st.code || st.name} value={st.name}>
                                {formatStoreDisplayName(st.name)}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <nav aria-label="Chọn công cụ quay số và bốc thăm" className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 bg-[#f4f9fd] p-1.5 rounded-2xl border border-sky-100">
                {TOOL_TABS.map(tab => {
                    const Icon = tab.icon;
                    const active = activeTool === tab.key;
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveTool(tab.key)}
                            className={`px-2 py-2.5 rounded-xl text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1.5 transition cursor-pointer ${
                                active
                                    ? 'bg-gradient-to-r from-[#0066ab] to-[#0369a1] text-white shadow-sm'
                                    : 'text-slate-700 hover:bg-white hover:text-[#0066ab]'
                            }`}
                        >
                            <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                            <span className="truncate max-w-full text-[11px] sm:text-xs">{tab.shortLabel}</span>
                        </button>
                    );
                })}
            </nav>

            {activeTool === 'number_range' && (
                <NumberRangeTool
                    config={numberConfig}
                    soundEnabled={soundEnabled}
                    onChangeConfig={setNumberConfig}
                    onSaveConfig={cfg => handleSaveToolConfig('number_range', cfg)}
                    onRecordResult={(summary, payload) => handleRecordLog('number_range', summary, payload)}
                />
            )}
            {activeTool === 'name_picker' && (
                <NamePickerTool
                    config={pickerConfig}
                    storeEmployees={storeEmployees}
                    storeLabel={storeDisplayLabel}
                    soundEnabled={soundEnabled}
                    onChangeConfig={setPickerConfig}
                    onSaveConfig={cfg => handleSaveToolConfig('name_picker', cfg)}
                    onRecordResult={(summary, payload) => handleRecordLog('name_picker', summary, payload)}
                />
            )}
            {activeTool === 'lucky_wheel' && (
                <LuckyWheelTool
                    config={wheelConfig}
                    storeEmployees={storeEmployees}
                    storeLabel={storeDisplayLabel}
                    soundEnabled={soundEnabled}
                    onChangeConfig={setWheelConfig}
                    onSaveConfig={cfg => handleSaveToolConfig('lucky_wheel', cfg)}
                    onRecordResult={(summary, payload) => handleRecordLog('lucky_wheel', summary, payload)}
                />
            )}
            {activeTool === 'gift_box' && (
                <GiftBoxDrawTool
                    config={giftConfig}
                    soundEnabled={soundEnabled}
                    onChangeConfig={setGiftConfig}
                    onSaveConfig={cfg => handleSaveToolConfig('gift_box', cfg)}
                    onRecordResult={(summary, payload) => handleRecordLog('gift_box', summary, payload)}
                />
            )}
            {activeTool === 'team_splitter' && (
                <TeamSplitterTool
                    config={teamConfig}
                    storeEmployees={storeEmployees}
                    storeLabel={storeDisplayLabel}
                    soundEnabled={soundEnabled}
                    onChangeConfig={setTeamConfig}
                    onSaveConfig={cfg => handleSaveToolConfig('team_splitter', cfg)}
                    onRecordResult={(summary, payload) => handleRecordLog('team_splitter', summary, payload)}
                />
            )}
            {activeTool === 'mini_tools' && (
                <MiniUtilitiesTool soundEnabled={soundEnabled} />
            )}

            <LuckyToolHistorySection logs={logs} storeDisplayLabel={storeDisplayLabel} />
        </div>
    );
}
