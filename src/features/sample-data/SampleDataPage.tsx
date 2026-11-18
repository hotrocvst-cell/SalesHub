import React, { useState, useEffect, useMemo } from 'react';
import {
    Plus,
    Save,
    RotateCcw,
    Search,
    Camera,
    CheckCircle2,
    RefreshCw,
    ChevronDown,
    ChevronUp,
    Images,
    FolderKanban,
    ShieldCheck
} from 'lucide-react';
import { useAuth } from '../../shared/contexts/AuthContext';
import CloudDataSyncStatusBanner from '../../shared/components/report/CloudDataSyncStatusBanner';
import type { OcrToolCategory, SampleDataGroup, SampleDataSyncStatus, SampleImageAsset } from './types';
import {
    fetchSampleDataGroups,
    saveAllSampleDataGroups,
    resetToDefaultOcrGroups,
    deleteSampleDataGroup,
    SAMPLE_DATA_SQL_DDL
} from './services/sampleDataService';
import { OCR_CATEGORY_META, inferOcrToolCategory } from './utils/ocrSamplePresets';
import SampleDataGroupCard from './components/SampleDataGroupCard';
import SampleDataGroupModal from './components/SampleDataGroupModal';
import SampleImageLightboxModal from './components/SampleImageLightboxModal';

type FilterCategory = 'ALL' | Exclude<OcrToolCategory, 'other'>;

const FILTER_TABS: { key: FilterCategory; label: string }[] = [
    { key: 'ALL', label: 'Tất cả' },
    { key: 'cumulative_store', label: 'Lũy kế ST' },
    { key: 'cumulative_employee', label: 'Lũy kế NV' },
    { key: 'realtime_store', label: 'Realtime ST' },
    { key: 'realtime_employee', label: 'Realtime NV' }
];

export default function SampleDataPage() {
    const { currentUser } = useAuth();
    const [groups, setGroups] = useState<SampleDataGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [activeCategory, setActiveCategory] = useState<FilterCategory>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [editingGroup, setEditingGroup] = useState<SampleDataGroup | null>(null);
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [statusToast, setStatusToast] = useState('');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

    const [lightboxState, setLightboxState] = useState<{
        images: SampleImageAsset[];
        activeIndex: number;
        slotLabel: string;
    } | null>(null);

    const [syncStatus, setSyncStatus] = useState<SampleDataSyncStatus>({
        isCloudConnected: false,
        isTableReady: true,
        isSyncing: false,
        lastSyncedAt: null,
        source: 'LOCAL_CACHE',
        pendingChangesCount: 0
    });

    const showToast = (msg: string) => {
        setStatusToast(msg);
        setTimeout(() => setStatusToast(''), 3500);
    };

    const loadData = async () => {
        setIsLoading(true);
        try {
            const res = await fetchSampleDataGroups();
            setGroups(res.groups);
            setHasUnsavedChanges(false);
            setSyncStatus({
                isCloudConnected: res.source === 'SUPABASE_CLOUD',
                isTableReady: res.isTableReady,
                isSyncing: false,
                lastSyncedAt: new Date(),
                source: res.source,
                pendingChangesCount: 0,
                errorMessage: res.error
            });
            if (res.migratedFromLegacyText) {
                showToast('Đã tự động chuyển đổi sang bộ 4 nhóm hình ảnh mẫu OCR (Lũy kế / Realtime / ST / NV).');
            }
        } catch (e: any) {
            console.error('Lỗi tải kho hình ảnh mẫu OCR:', e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleSaveAll = async () => {
        setIsSaving(true);
        try {
            const res = await saveAllSampleDataGroups(groups, currentUser?.email || currentUser?.full_name);
            if (res.success) {
                setHasUnsavedChanges(false);
                showToast('Đã lưu toàn bộ hình ảnh mẫu OCR lên Supabase Cloud!');
                setSyncStatus(prev => ({
                    ...prev,
                    isCloudConnected: true,
                    isTableReady: true,
                    lastSyncedAt: new Date(),
                    source: 'SUPABASE_CLOUD',
                    pendingChangesCount: 0
                }));
            } else {
                showToast(`Đã lưu tạm cục bộ (Cloud: ${res.error || 'chưa sẵn sàng'})`);
            }
        } catch (e: any) {
            alert('Lỗi lưu dữ liệu: ' + e?.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleUpdateGroup = (updatedGroup: SampleDataGroup) => {
        setGroups(prev => prev.map(g => (g.group_key === updatedGroup.group_key ? updatedGroup : g)));
        setHasUnsavedChanges(true);
    };

    const handleDeleteGroup = async (groupKey: string) => {
        if (!confirm('Bạn có chắc chắn muốn xóa toàn bộ nhóm hình ảnh mẫu này?')) return;
        setGroups(prev => prev.filter(g => g.group_key !== groupKey));
        await deleteSampleDataGroup(groupKey);
        showToast('Đã xóa nhóm hình ảnh mẫu.');
    };

    const handleSaveGroupModal = (groupData: Partial<SampleDataGroup>) => {
        if (editingGroup) {
            setGroups(prev =>
                prev.map(g =>
                    g.group_key === editingGroup.group_key
                        ? {
                              ...g,
                              group_title: groupData.group_title || g.group_title,
                              tool_category: groupData.tool_category || g.tool_category,
                              tool_path: groupData.tool_path !== undefined ? groupData.tool_path : g.tool_path,
                              description: groupData.description !== undefined ? groupData.description : g.description
                          }
                        : g
                )
            );
        } else {
            const newGroup: SampleDataGroup = {
                id: 'grp-' + Date.now(),
                group_key: groupData.group_key || 'ocr_group_' + Date.now(),
                group_title: groupData.group_title || 'Nhóm công cụ OCR mới',
                tool_category: groupData.tool_category || 'other',
                tool_path: groupData.tool_path || '',
                description: groupData.description || '',
                order_index: groups.length + 1,
                items: [],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            setGroups(prev => [...prev, newGroup]);
            setExpandedGroups(prev => new Set(prev).add(newGroup.group_key));
        }
        setHasUnsavedChanges(true);
        setEditingGroup(null);
    };

    const handleResetDefaults = async () => {
        if (
            !confirm(
                'Khôi phục lại bộ 4 nhóm công cụ OCR chuẩn (Lũy kế ST, Lũy kế NV, Realtime ST, Realtime NV)? Các nhóm hiện tại sẽ được thay thế.'
            )
        ) {
            return;
        }
        setIsSaving(true);
        try {
            const res = await resetToDefaultOcrGroups(groups, currentUser?.email || currentUser?.full_name);
            setGroups(res.groups);
            setHasUnsavedChanges(false);
            setActiveCategory('ALL');
            setExpandedGroups(new Set(res.groups.map(g => g.group_key)));
            showToast('Đã khôi phục bộ 4 nhóm hình ảnh mẫu OCR chuẩn!');
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleExpandGroup = (groupKey: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupKey)) next.delete(groupKey);
            else next.add(groupKey);
            return next;
        });
    };

    const filteredGroups = useMemo(() => {
        return groups.filter(g => {
            const cat = g.tool_category || inferOcrToolCategory(g.group_key, g.group_title);
            const matchCat = activeCategory === 'ALL' || cat === activeCategory;
            if (!matchCat) return false;

            const q = searchQuery.toLowerCase().trim();
            if (!q) return true;
            return (
                g.group_title.toLowerCase().includes(q) ||
                (g.description || '').toLowerCase().includes(q) ||
                g.items.some(
                    it =>
                        it.label.toLowerCase().includes(q) ||
                        (it.note || '').toLowerCase().includes(q) ||
                        it.images.some(
                            img =>
                                img.file_name.toLowerCase().includes(q) ||
                                (img.caption || '').toLowerCase().includes(q)
                        )
                )
            );
        });
    }, [groups, activeCategory, searchQuery]);

    // Tự động mở rộng nhóm khi lọc cụ thể 1 công cụ hoặc đang tìm kiếm
    useEffect(() => {
        if (searchQuery.trim() || activeCategory !== 'ALL') {
            setExpandedGroups(new Set(filteredGroups.map(g => g.group_key)));
        }
    }, [searchQuery, activeCategory, filteredGroups]);

    const stats = useMemo(() => {
        let totalSlots = 0;
        let totalImages = 0;
        groups.forEach(g => {
            totalSlots += g.items?.length || 0;
            g.items?.forEach(it => {
                totalImages += it.images?.length || 0;
            });
        });
        return { totalGroups: groups.length, totalSlots, totalImages };
    }, [groups]);

    const isAllExpanded =
        filteredGroups.length > 0 && filteredGroups.every(g => expandedGroups.has(g.group_key));

    return (
        <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 font-roboto">
            {/* Header Trang */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
                            <Camera className="w-4 h-4" aria-hidden="true" />
                        </span>
                        <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                            KHO HÌNH ẢNH MẪU OCR
                        </h1>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Admin</span>
                        </span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        Quản trị hình ảnh chụp màn hình BI chuẩn theo từng công cụ nhập liệu OCR (Lũy kế ST, Lũy kế NV, Realtime ST, Realtime NV) để kiểm thử và hướng dẫn chụp ảnh đúng chuẩn.
                    </p>
                </div>

                {/* Các nút hành động chính */}
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        type="button"
                        onClick={handleResetDefaults}
                        disabled={isSaving}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer transition disabled:opacity-50"
                        title="Khôi phục bộ 4 nhóm công cụ OCR chuẩn"
                    >
                        <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                        <span className="hidden sm:inline">4 nhóm OCR chuẩn</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setEditingGroup(null);
                            setIsGroupModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 cursor-pointer transition shadow-2xs"
                    >
                        <Plus className="w-4 h-4" aria-hidden="true" />
                        <span>Thêm nhóm</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleSaveAll}
                        disabled={isSaving}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black text-white shadow-xs cursor-pointer transition disabled:opacity-50 ${
                            hasUnsavedChanges
                                ? 'bg-amber-600 hover:bg-amber-700 ring-2 ring-amber-400/40'
                                : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                    >
                        {isSaving ? (
                            <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
                        ) : (
                            <Save className="w-4 h-4" aria-hidden="true" />
                        )}
                        <span>
                            {isSaving
                                ? 'Đang lưu...'
                                : hasUnsavedChanges
                                    ? 'Lưu thay đổi lên Cloud *'
                                    : 'Lưu lên Cloud'}
                        </span>
                    </button>
                </div>
            </div>

            {statusToast && (
                <div className="p-3 bg-emerald-50 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
                    <span>{statusToast}</span>
                </div>
            )}

            {/* Banner trạng thái lưu trữ Supabase Cloud (Quy chuẩn 8 & 12) */}
            <div data-html2canvas-ignore="true" data-export-ignore="true">
                <CloudDataSyncStatusBanner
                    storageType={syncStatus.source === 'SUPABASE_CLOUD' ? 'cloud' : 'local'}
                    syncStatus={
                        hasUnsavedChanges
                            ? 'unsynced'
                            : syncStatus.isCloudConnected
                                ? 'synced'
                                : 'unsynced'
                    }
                    tableReady={syncStatus.isTableReady}
                    tableName="sample_data_groups"
                    unsyncedCount={hasUnsavedChanges ? 1 : 0}
                    sqlDdl={SAMPLE_DATA_SQL_DDL}
                    lastSyncTime={syncStatus.lastSyncedAt}
                    onSyncNow={handleSaveAll}
                    customMessage={
                        !syncStatus.isTableReady
                            ? 'Chưa tạo bảng sample_data_groups trên Supabase. Ảnh mẫu đang lưu tạm cục bộ.'
                            : hasUnsavedChanges
                                ? 'Bạn vừa thay đổi danh sách ảnh mẫu — hãy bấm "Lưu thay đổi lên Cloud" để đồng bộ.'
                                : undefined
                    }
                />
            </div>

            {/* Bộ lọc theo 4 công cụ OCR & Tìm kiếm */}
            <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs space-y-3">
                {/* Hàng 1: Lọc theo công cụ OCR (Lũy kế / Realtime / ST / NV) */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div role="tablist" aria-label="Lọc theo công cụ OCR" className="flex items-center gap-1.5 flex-wrap">
                        {FILTER_TABS.map(tab => {
                            const isActive = activeCategory === tab.key;
                            const countInTab =
                                tab.key === 'ALL'
                                    ? stats.totalImages
                                    : groups
                                          .filter(
                                              g =>
                                                  (g.tool_category || inferOcrToolCategory(g.group_key, g.group_title)) ===
                                                  tab.key
                                          )
                                          .reduce((acc, g) => acc + g.items.reduce((s, it) => s + it.images.length, 0), 0);

                            const activeClass =
                                tab.key === 'ALL'
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : OCR_CATEGORY_META[tab.key].pillActiveClass;

                            return (
                                <button
                                    key={tab.key}
                                    type="button"
                                    role="tab"
                                    aria-selected={isActive}
                                    onClick={() => setActiveCategory(tab.key)}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                                        isActive
                                            ? activeClass
                                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                                    }`}
                                >
                                    <span>{tab.label}</span>
                                    <span
                                        className={`px-1.5 py-0.2 rounded-md text-[10.5px] font-black tabular-nums ${
                                            isActive ? 'bg-white/20 text-white' : 'bg-white text-slate-600 border border-slate-200'
                                        }`}
                                    >
                                        {countInTab}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex items-center gap-2 text-xs font-bold text-slate-600 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 rounded-lg border border-slate-200 tabular-nums">
                            <FolderKanban className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
                            <span>{stats.totalGroups} công cụ</span>
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-800 rounded-lg border border-blue-200 tabular-nums">
                            <Images className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
                            <span>{stats.totalImages} ảnh mẫu</span>
                        </span>
                    </div>
                </div>

                {/* Hàng 2: Ô tìm kiếm & Mở rộng/Thu gọn tất cả */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
                    <div className="relative flex-1 max-w-md">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                        <input
                            id="sample-ocr-search-input"
                            name="sample_ocr_search"
                            aria-label="Tìm kiếm công cụ OCR, ô ảnh mẫu hoặc ghi chú"
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Tìm tên công cụ OCR, ô ảnh mẫu hoặc ghi chú..."
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500 focus:bg-white"
                        />
                    </div>

                    {filteredGroups.length > 0 && (
                        <button
                            type="button"
                            onClick={() =>
                                setExpandedGroups(
                                    isAllExpanded ? new Set() : new Set(filteredGroups.map(g => g.group_key))
                                )
                            }
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs cursor-pointer transition shrink-0"
                        >
                            {isAllExpanded ? (
                                <>
                                    <ChevronUp className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
                                    <span>Thu gọn tất cả</span>
                                </>
                            ) : (
                                <>
                                    <ChevronDown className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
                                    <span>Mở rộng tất cả</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Danh sách các nhóm công cụ OCR */}
            {isLoading ? (
                <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center space-y-2">
                    <RefreshCw className="w-7 h-7 text-blue-600 animate-spin mx-auto" aria-hidden="true" />
                    <p className="text-xs font-bold text-slate-600">Đang tải kho hình ảnh mẫu OCR từ Cloud...</p>
                </div>
            ) : filteredGroups.length === 0 ? (
                <div className="bg-white rounded-2xl p-10 border border-dashed border-slate-300 text-center space-y-2">
                    <Images className="w-10 h-10 text-slate-300 mx-auto" aria-hidden="true" />
                    <p className="text-sm font-black text-slate-700">Không tìm thấy nhóm hình ảnh mẫu phù hợp</p>
                    <p className="text-xs text-slate-500">
                        Hãy chọn bộ lọc khác, xóa từ khóa tìm kiếm hoặc bấm &ldquo;Thêm nhóm&rdquo; để tạo mới.
                    </p>
                </div>
            ) : (
                <div className="space-y-3.5">
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
                            onOpenLightbox={(images, activeIndex, slotLabel) =>
                                setLightboxState({ images, activeIndex, slotLabel })
                            }
                        />
                    ))}
                </div>
            )}

            {/* Modal Tạo / Sửa nhóm công cụ OCR */}
            <SampleDataGroupModal
                isOpen={isGroupModalOpen}
                onClose={() => {
                    setIsGroupModalOpen(false);
                    setEditingGroup(null);
                }}
                onSave={handleSaveGroupModal}
                editingGroup={editingGroup}
            />

            {/* Lightbox phóng to xem ảnh mẫu */}
            {lightboxState && (
                <SampleImageLightboxModal
                    images={lightboxState.images}
                    activeIndex={lightboxState.activeIndex}
                    slotLabel={lightboxState.slotLabel}
                    onClose={() => setLightboxState(null)}
                    onChangeIndex={nextIdx =>
                        setLightboxState(prev => (prev ? { ...prev, activeIndex: nextIdx } : null))
                    }
                />
            )}
        </div>
    );
}
