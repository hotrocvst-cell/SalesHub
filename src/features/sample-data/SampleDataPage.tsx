import React, { useState, useEffect, useMemo } from 'react';
import {
    Plus,
    Save,
    RotateCcw,
    Search,
    Layers,
    Sparkles,
    CheckCircle2,
    RefreshCw,
    Database,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { useAuth } from '../../shared/contexts/AuthContext';
import CloudDataSyncStatusBanner from '../../shared/components/report/CloudDataSyncStatusBanner';
import type { SampleDataGroup, SampleDataSyncStatus } from './types';
import {
    fetchSampleDataGroups,
    saveAllSampleDataGroups,
    deleteSampleDataGroup,
    SAMPLE_DATA_SQL_DDL,
    DEFAULT_SEED_SAMPLE_GROUPS
} from './services/sampleDataService';
import SampleDataGroupCard from './components/SampleDataGroupCard';
import SampleDataGroupModal from './components/SampleDataGroupModal';

export default function SampleDataPage() {
    const { currentUser, isAdmin } = useAuth();
    const [groups, setGroups] = useState<SampleDataGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingGroup, setEditingGroup] = useState<SampleDataGroup | null>(null);
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
    // Mặc định Accordion Card là thu gọn (empty Set)
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const [syncStatus, setSyncStatus] = useState<SampleDataSyncStatus>({
        isCloudConnected: false,
        isTableReady: true,
        isSyncing: false,
        lastSyncedAt: null,
        source: 'LOCAL_CACHE',
        pendingChangesCount: 0
    });

    // Tải dữ liệu ban đầu
    const loadData = async () => {
        setIsLoading(true);
        try {
            const res = await fetchSampleDataGroups();
            setGroups(res.groups);
            setSyncStatus({
                isCloudConnected: res.source === 'SUPABASE_CLOUD',
                isTableReady: res.isTableReady,
                isSyncing: false,
                lastSyncedAt: new Date(),
                source: res.source,
                pendingChangesCount: 0,
                errorMessage: res.error
            });
        } catch (e: any) {
            console.error('Lỗi tải dữ liệu mẫu:', e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Lưu toàn bộ lên Cloud
    const handleSaveAll = async () => {
        setIsSaving(true);
        try {
            const res = await saveAllSampleDataGroups(groups, currentUser?.email || currentUser?.full_name);
            if (res.success) {
                setSaveSuccessMsg('Đã lưu thành công lên Supabase Cloud!');
                setSyncStatus(prev => ({
                    ...prev,
                    isCloudConnected: true,
                    isTableReady: true,
                    lastSyncedAt: new Date(),
                    source: 'SUPABASE_CLOUD'
                }));
            } else {
                setSaveSuccessMsg('Đã lưu vào bộ nhớ đệm (Cloud: ' + (res.error || 'chưa tạo bảng') + ')');
            }
            setTimeout(() => setSaveSuccessMsg(''), 3000);
        } catch (e: any) {
            alert('Lỗi lưu dữ liệu: ' + e?.message);
        } finally {
            setIsSaving(false);
        }
    };

    // Cập nhật 1 nhóm
    const handleUpdateGroup = (updatedGroup: SampleDataGroup) => {
        setGroups(prev => prev.map(g => g.group_key === updatedGroup.group_key ? updatedGroup : g));
    };

    // Xóa 1 nhóm
    const handleDeleteGroup = async (groupKey: string) => {
        if (!confirm('Bạn có chắc chắn muốn xóa toàn bộ nhóm dữ liệu này?')) return;
        setGroups(prev => prev.filter(g => g.group_key !== groupKey));
        await deleteSampleDataGroup(groupKey);
    };

    // Tạo mới hoặc cập nhật thông tin nhóm
    const handleSaveGroupModal = (groupData: Partial<SampleDataGroup>) => {
        if (editingGroup) {
            setGroups(prev => prev.map(g => g.group_key === editingGroup.group_key ? {
                ...g,
                group_title: groupData.group_title || g.group_title,
                description: groupData.description !== undefined ? groupData.description : g.description
            } : g));
        } else {
            const newGroup: SampleDataGroup = {
                id: 'grp-' + Date.now(),
                group_key: groupData.group_key || ('group_' + Date.now()),
                group_title: groupData.group_title || 'Nhóm mới',
                description: groupData.description || '',
                order_index: groups.length + 1,
                items: [],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            setGroups(prev => [...prev, newGroup]);
        }
        setEditingGroup(null);
    };

    // Khôi phục bộ dữ liệu mặc định
    const handleResetDefaults = async () => {
        if (confirm('Khôi phục lại toàn bộ dữ liệu mẫu mặc định của hệ thống? Các nhóm hiện tại sẽ được thay thế.')) {
            setGroups(DEFAULT_SEED_SAMPLE_GROUPS);
            await saveAllSampleDataGroups(DEFAULT_SEED_SAMPLE_GROUPS, currentUser?.email || currentUser?.full_name);
            setSaveSuccessMsg('Đã khôi phục dữ liệu mẫu hệ thống chuẩn!');
            setTimeout(() => setSaveSuccessMsg(''), 3000);
        }
    };

    // Đóng/Mở từng nhóm
    const handleToggleExpandGroup = (groupKey: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupKey)) {
                next.delete(groupKey);
            } else {
                next.add(groupKey);
            }
            return next;
        });
    };

    // Mở rộng tất cả
    const handleExpandAll = () => {
        setExpandedGroups(new Set(groups.map(g => g.group_key)));
    };

    // Thu gọn tất cả
    const handleCollapseAll = () => {
        setExpandedGroups(new Set());
    };

    const isAllExpanded = groups.length > 0 && groups.every(g => expandedGroups.has(g.group_key));

    // Lọc theo tìm kiếm
    const filteredGroups = useMemo(() => {
        if (!searchQuery.trim()) return groups;
        const q = searchQuery.toLowerCase().trim();
        return groups.filter(g =>
            g.group_title.toLowerCase().includes(q) ||
            (g.description || '').toLowerCase().includes(q) ||
            g.items.some(it => it.label.toLowerCase().includes(q) || it.sample_text.toLowerCase().includes(q))
        );
    }, [groups, searchQuery]);

    // Khi tìm kiếm, tự động mở rộng các nhóm có kết quả
    useEffect(() => {
        if (searchQuery.trim()) {
            setExpandedGroups(new Set(filteredGroups.map(g => g.group_key)));
        }
    }, [searchQuery, filteredGroups]);

    const totalItemsCount = useMemo(() => {
        return groups.reduce((acc, g) => acc + (g.items?.length || 0), 0);
    }, [groups]);

    return (
        <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 font-roboto">
            {/* Header Trang */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black">
                            <Database className="w-4 h-4" />
                        </span>
                        <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                            KHO DỮ LIỆU MẪU THAM CHIẾU
                        </h1>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                            👑 Dành riêng Admin
                        </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                        Kho lưu trữ raw text mẫu cho các báo cáo (Realtime, Lũy kế, Chấm công, Tồn kho) phục vụ kiểm thử và cập nhật tính năng.
                    </p>
                </div>

                {/* Các nút hành động chính */}
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        type="button"
                        onClick={handleResetDefaults}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer transition"
                        title="Khôi phục bộ mẫu chuẩn của SalesHub"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Mẫu mặc định</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setEditingGroup(null);
                            setIsGroupModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 cursor-pointer transition shadow-2xs"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Thêm nhóm</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleSaveAll}
                        disabled={isSaving}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer transition disabled:opacity-50"
                    >
                        {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        <span>{isSaving ? 'Đang lưu...' : 'Lưu tất cả'}</span>
                    </button>
                </div>
            </div>

            {/* Thông báo lưu thành công */}
            {saveSuccessMsg && (
                <div className="p-3 bg-emerald-50 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{saveSuccessMsg}</span>
                </div>
            )}

            {/* Banner trạng thái lưu trữ Supabase Cloud (Quy chuẩn 8 & 12) */}
            <div data-html2canvas-ignore="true" data-export-ignore="true">
                <CloudDataSyncStatusBanner
                    storageType={syncStatus.source === 'SUPABASE_CLOUD' ? 'cloud' : 'local'}
                    syncStatus={syncStatus.isCloudConnected ? 'synced' : 'unsynced'}
                    tableReady={syncStatus.isTableReady}
                    tableName="sample_data_groups"
                    sqlDdl={SAMPLE_DATA_SQL_DDL}
                    lastSyncTime={syncStatus.lastSyncedAt}
                    onSyncNow={handleSaveAll}
                    customMessage={!syncStatus.isTableReady ? 'Chưa tạo bảng sample_data_groups trên Supabase. Dữ liệu đang lưu tạm tại LocalStorage.' : undefined}
                />
            </div>

            {/* Thanh tìm kiếm & Thống kê nhanh */}
            <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Tìm kiếm nhóm, tên ô hoặc nội dung..."
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    />
                </div>

                <div className="flex items-center gap-2 text-xs font-bold text-slate-600 flex-wrap">
                    <span className="px-2.5 py-1 bg-slate-100 rounded-lg border border-slate-200">
                        📁 {groups.length} nhóm
                    </span>
                    <span className="px-2.5 py-1 bg-blue-50 text-blue-800 rounded-lg border border-blue-200">
                        📝 {totalItemsCount} ô dữ liệu
                    </span>

                    {groups.length > 0 && (
                        <button
                            type="button"
                            onClick={isAllExpanded ? handleCollapseAll : handleExpandAll}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs cursor-pointer transition"
                            title={isAllExpanded ? 'Thu gọn tất cả nhóm' : 'Mở rộng tất cả nhóm'}
                        >
                            {isAllExpanded ? (
                                <>
                                    <ChevronUp className="w-3.5 h-3.5 text-slate-600" />
                                    <span>Thu gọn tất cả</span>
                                </>
                            ) : (
                                <>
                                    <ChevronDown className="w-3.5 h-3.5 text-blue-600" />
                                    <span>Mở rộng tất cả</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Danh sách các nhóm dữ liệu mẫu */}
            {isLoading ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
                    <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-600">Đang tải kho dữ liệu mẫu...</p>
                </div>
            ) : filteredGroups.length === 0 ? (
                <div className="text-center py-12 px-4 bg-white rounded-2xl border border-dashed border-slate-300">
                    <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    <h3 className="font-bold text-sm text-slate-700">Không tìm thấy nhóm dữ liệu nào</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                        Hãy thử từ khóa tìm kiếm khác hoặc bấm "Thêm nhóm" để tạo nhóm dữ liệu mẫu mới.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredGroups.map(group => (
                        <SampleDataGroupCard
                            key={group.group_key}
                            group={group}
                            isExpanded={expandedGroups.has(group.group_key)}
                            onToggleExpand={() => handleToggleExpandGroup(group.group_key)}
                            onUpdateGroup={handleUpdateGroup}
                            onDeleteGroup={handleDeleteGroup}
                            onEditGroupInfo={g => {
                                setEditingGroup(g);
                                setIsGroupModalOpen(true);
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Modal tạo / sửa nhóm */}
            <SampleDataGroupModal
                isOpen={isGroupModalOpen}
                editingGroup={editingGroup}
                onClose={() => {
                    setIsGroupModalOpen(false);
                    setEditingGroup(null);
                }}
                onSave={handleSaveGroupModal}
            />
        </div>
    );
}
