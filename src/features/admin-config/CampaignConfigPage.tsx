import { useState, useEffect, useMemo } from 'react';
import {
    fetchCampaignDictionary,
    upsertCampaignDictionary,
    deleteCampaignDictItem,
    checkCampaignDictUsage,
    archiveCampaignDictItem,
    fetchStores,
    type CampaignDictItem,
    type StoreItem
} from '../../core/lib/storage';
import { useAuth } from '../../shared/contexts/AuthContext';
import StoreCampaignScoreTab from './components/StoreCampaignScoreTab';
import {
    syncStoreCampaignScoresFromCloud,
    checkSupabaseCampaignConnection
} from '../../core/lib/storeCampaignScoreService';
import SupabaseSyncStatusBar, { type CloudSyncStatus } from './components/SupabaseSyncStatusBar';
import {
    BookOpen,
    Plus,
    Save,
    RefreshCw,
    Search,
    Trash2,
    UploadCloud,
    AlertCircle,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    SlidersHorizontal,
    Archive,
    AlertTriangle,
    X,
    CheckCircle2,
    Check,
    Hash,
    Trophy,
    Award
} from 'lucide-react';

const COMMON_UNITS = ['Cái', 'Sim', 'HĐ', 'Thẻ', 'Tr.đ', 'Lượt'];

type SortField = 'order_index' | 'raw_key' | 'display_name' | 'unit' | 'is_active';
type SortDirection = 'asc' | 'desc';
type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

export default function CampaignConfigPage() {
    const { currentUser, isAdmin, canAccessStore } = useAuth();
    const [activeMainTab, setActiveMainTab] = useState<'store_scores' | 'dictionary'>('store_scores');
    const [stores, setStores] = useState<StoreItem[]>([]);

    const [campaignList, setCampaignList] = useState<any[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [hasChanges, setHasChanges] = useState<boolean>(false);
    const [hasScoreChanges, setHasScoreChanges] = useState<boolean>(false);
    const [saveScoreTrigger, setSaveScoreTrigger] = useState<number>(0);
    const [toastMessage, setToastMessage] = useState<string>('');

    // Trạng thái kết nối & đồng bộ Supabase Cloud
    const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus>('CHECKING');
    const [lastCheckedTime, setLastCheckedTime] = useState<string>('');
    const [cloudError, setCloudError] = useState<string | undefined>(undefined);
    const [dictCloudCount, setDictCloudCount] = useState<number>(0);
    const [scoresCloudCount, setScoresCloudCount] = useState<number>(0);
    const [isCheckingCloud, setIsCheckingCloud] = useState<boolean>(false);
    const [isSyncingAll, setIsSyncingAll] = useState<boolean>(false);

    // Bộ lọc & Sắp xếp
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
    const [sortField, setSortField] = useState<SortField>('order_index');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

    // Modal dán danh sách nhanh
    const [isPasteModalOpen, setIsPasteModalOpen] = useState<boolean>(false);
    const [pasteRawText, setPasteRawText] = useState<string>('');

    // Modal Xóa thông minh (Smart Delete / Archive Modal)
    const [deleteModalState, setDeleteModalState] = useState<{
        isOpen: boolean;
        item: any | null;
        isChecking: boolean;
        linkedCount: number;
        confirmText: string;
        isActionRunning: boolean;
    }>({
        isOpen: false,
        item: null,
        isChecking: false,
        linkedCount: 0,
        confirmText: '',
        isActionRunning: false
    });

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 3500);
    };

    const handleCheckCloudConnection = async () => {
        setIsCheckingCloud(true);
        try {
            const res = await checkSupabaseCampaignConnection();
            setLastCheckedTime(res.checkedAt);
            setDictCloudCount(res.campaignDictCount);
            setScoresCloudCount(res.storeScoresCount);
            if (res.isConnected) {
                setCloudStatus('READY');
                setCloudError(undefined);
                showToast('🟢 Kết nối Cloud: Sẵn sàng và ổn định!');
            } else {
                setCloudStatus('OFFLINE');
                setCloudError(res.error || 'Không thể kết nối Cloud');
                showToast(`⚠️ Không thể kết nối Cloud: ${res.error || 'Lỗi mạng'}`);
            }
        } catch (err: any) {
            setCloudStatus('OFFLINE');
            setCloudError(err?.message || 'Lỗi kiểm tra kết nối');
        } finally {
            setIsCheckingCloud(false);
        }
    };

    const loadData = async () => {
        setLoading(true);
        setIsCheckingCloud(true);
        try {
            const [dictRes, storesRes, connRes] = await Promise.all([
                fetchCampaignDictionary(),
                fetchStores(),
                checkSupabaseCampaignConnection()
            ]);
            if (dictRes.success && dictRes.data) {
                setCampaignList(dictRes.data);
            } else {
                showToast('⚠️ Không thể tải từ điển thi đua!');
            }
            if (storesRes.success && storesRes.data) {
                setStores(storesRes.data);
            }

            // Cập nhật trạng thái Supabase Cloud
            setLastCheckedTime(connRes.checkedAt);
            setDictCloudCount(connRes.campaignDictCount);
            setScoresCloudCount(connRes.storeScoresCount);
            if (connRes.isConnected) {
                setCloudStatus('READY');
                setCloudError(undefined);
            } else {
                setCloudStatus('OFFLINE');
                setCloudError(connRes.error);
            }

            // Đồng bộ ngầm cấu hình điểm từ Supabase nếu có
            syncStoreCampaignScoresFromCloud().catch(() => { });
        } finally {
            setHasChanges(false);
            setIsCheckingCloud(false);
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Danh sách đã lọc và sắp xếp
    const filteredAndSortedList = useMemo(() => {
        // 1. Lọc theo tìm kiếm và trạng thái
        const list = campaignList.filter(item => {
            const q = searchQuery.toLowerCase().trim();
            const matchesSearch = (
                q === '' ||
                (item.raw_key && item.raw_key.toLowerCase().includes(q)) ||
                (item.display_name && item.display_name.toLowerCase().includes(q)) ||
                (item.unit && item.unit.toLowerCase().includes(q))
            );

            const matchesStatus = (
                statusFilter === 'ALL' ||
                (statusFilter === 'ACTIVE' && item.is_active) ||
                (statusFilter === 'INACTIVE' && !item.is_active)
            );

            return matchesSearch && matchesStatus;
        });

        // 2. Sắp xếp
        return [...list].sort((a, b) => {
            let res = 0;
            if (sortField === 'order_index') {
                const orderA = a.order_index ?? 99999;
                const orderB = b.order_index ?? 99999;
                res = orderA - orderB;
            } else if (sortField === 'raw_key') {
                const keyA = (a.raw_key || '').toString();
                const keyB = (b.raw_key || '').toString();
                res = keyA.localeCompare(keyB, 'vi', { sensitivity: 'base' });
            } else if (sortField === 'display_name') {
                const nameA = (a.display_name || '').toString();
                const nameB = (b.display_name || '').toString();
                res = nameA.localeCompare(nameB, 'vi', { sensitivity: 'base' });
            } else if (sortField === 'unit') {
                const unitA = (a.unit || '').toString();
                const unitB = (b.unit || '').toString();
                res = unitA.localeCompare(unitB, 'vi', { sensitivity: 'base' });
            } else if (sortField === 'is_active') {
                const activeA = a.is_active ? 1 : 0;
                const activeB = b.is_active ? 1 : 0;
                res = activeB - activeA;
            }

            return sortDirection === 'asc' ? res : -res;
        });
    }, [campaignList, searchQuery, statusFilter, sortField, sortDirection]);

    // Xử lý chuyển đổi chiều sắp xếp khi bấm tiêu đề cột
    const handleSortToggle = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    // Helper render icon sắp xếp trên tiêu đề bảng
    const renderSortIcon = (field: SortField) => {
        if (sortField !== field) {
            return <ArrowUpDown className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition inline ml-1" />;
        }
        return sortDirection === 'asc' ? (
            <ArrowUp className="w-3.5 h-3.5 text-indigo-600 inline ml-1" />
        ) : (
            <ArrowDown className="w-3.5 h-3.5 text-indigo-600 inline ml-1" />
        );
    };

    // Thêm dòng mới thủ công
    const handleAddNewRow = () => {
        const newRow = {
            id: `temp_${Date.now()}`,
            raw_key: '',
            display_name: '',
            unit: 'Cái',
            is_active: true,
            order_index: campaignList.length + 1,
            isNew: true
        };
        setCampaignList(prev => [newRow, ...prev]);
        setHasChanges(true);
        showToast('✨ Đã thêm 1 dòng trống mới!');
    };

    // Đánh lại số thứ tự tự động 1, 2, 3... theo danh sách đang sắp xếp
    const handleAutoReindex = () => {
        if (filteredAndSortedList.length === 0) return;
        if (!window.confirm(`Bạn có muốn đánh lại số thứ tự (từ 1 đến ${filteredAndSortedList.length}) theo danh sách đang hiển thị trên bảng?`)) return;

        const orderMap = new Map<string, number>();
        filteredAndSortedList.forEach((item, index) => {
            orderMap.set(item.id, index + 1);
        });

        setCampaignList(prev => prev.map(item => {
            if (orderMap.has(item.id)) {
                return { ...item, order_index: orderMap.get(item.id) };
            }
            return item;
        }));

        setSortField('order_index');
        setSortDirection('asc');
        setHasChanges(true);
        showToast('⚡ Đã đánh lại số thứ tự! Hãy bấm "LƯU CẤU HÌNH THI ĐUA" để ghi nhận.');
    };

    // Cập nhật trường dữ liệu trên bảng
    const handleFieldChange = (id: string, field: string, val: any) => {
        setCampaignList(prev => prev.map(item => {
            if (item.id === id) {
                return { ...item, [field]: val };
            }
            return item;
        }));
        setHasChanges(true);
    };

    // Lưu theo đợt
    const handleBatchSave = async () => {
        for (const item of campaignList) {
            if (!item.raw_key || !item.raw_key.trim()) {
                showToast('⚠️ Vui lòng nhập đầy đủ Mã gốc (Raw Key)!');
                return;
            }
            if (!item.display_name || !item.display_name.trim()) {
                showToast(`⚠️ Vui lòng nhập Tên hiển thị cho mã [${item.raw_key}]!`);
                return;
            }
        }

        // Kiểm tra trùng lặp mã gốc
        const seenKeys = new Set<string>();
        for (const item of campaignList) {
            const k = item.raw_key.trim().toLowerCase();
            if (seenKeys.has(k)) {
                showToast(`⚠️ Trùng lặp Mã gốc: [${item.raw_key}]. Mỗi mã chỉ xuất hiện 1 lần!`);
                return;
            }
            seenKeys.add(k);
        }

        setIsSaving(true);
        const payloads: CampaignDictItem[] = campaignList.map((item, idx) => ({
            id: (item.id && !String(item.id).startsWith('temp_')) ? item.id : undefined,
            raw_key: item.raw_key.trim(),
            display_name: item.display_name.trim(),
            unit: item.unit ? item.unit.trim() : 'Cái',
            is_active: Boolean(item.is_active),
            order_index: Number(item.order_index) || idx + 1
        }));

        const res = await upsertCampaignDictionary(payloads);
        setIsSaving(false);

        if (res.success) {
            setHasChanges(false);
            showToast(`💾 Đã lưu thành công ${payloads.length} mục từ điển thi đua!`);
            loadData();
        } else {
            showToast(`⚠️ Lỗi khi lưu cấu hình lên Supabase: ${res.error || 'Vui lòng thử lại!'}`);
        }
    };

    // Khi người dùng bấm nút Xóa ở dòng thi đua
    const handleDeleteClick = async (item: any) => {
        if (item.isNew || String(item.id).startsWith('temp_')) {
            setCampaignList(prev => prev.filter(x => x.id !== item.id));
            showToast('🗑️ Đã xóa dòng nháp mới tạo!');
            return;
        }

        setDeleteModalState({
            isOpen: true,
            item,
            isChecking: true,
            linkedCount: 0,
            confirmText: '',
            isActionRunning: false
        });

        // Kiểm tra dữ liệu liên kết ở các tháng cũ
        const checkRes = await checkCampaignDictUsage(item.id || item.raw_key);
        setDeleteModalState(prev => ({
            ...prev,
            isChecking: false,
            linkedCount: checkRes.count
        }));
    };

    // Thực hiện Tạm ẩn (Soft Archive) từ Modal
    const handleConfirmArchive = async () => {
        const item = deleteModalState.item;
        if (!item) return;

        setDeleteModalState(prev => ({ ...prev, isActionRunning: true }));
        const res = await archiveCampaignDictItem(item.id);
        setDeleteModalState(prev => ({ ...prev, isActionRunning: false, isOpen: false }));

        if (res.success) {
            showToast(`📦 Đã chuyển [${item.display_name || item.raw_key}] sang Tạm ẩn! Báo cáo cũ vẫn giữ nguyên.`);
            loadData();
        } else {
            showToast(`Lỗi: ${res.error || 'Không thể tạm ẩn'}`);
        }
    };

    // Thực hiện Xóa vĩnh viễn (Force Cascade Delete) từ Modal
    const handleConfirmForceDelete = async () => {
        const item = deleteModalState.item;
        if (!item) return;

        setDeleteModalState(prev => ({ ...prev, isActionRunning: true }));
        const res = await deleteCampaignDictItem(item.id, { force: true });
        setDeleteModalState(prev => ({ ...prev, isActionRunning: false, isOpen: false }));

        if (res.success) {
            showToast(`🗑️ Đã xóa vĩnh viễn mã thi đua [${item.raw_key}] cùng toàn bộ chỉ tiêu liên quan!`);
            setCampaignList(prev => prev.filter(x => x.id !== item.id));
        } else {
            showToast(`Lỗi khi xóa: ${res.error || 'Vui lòng thử lại!'}`);
        }
    };

    // Dán danh sách nhanh từ Excel
    const handleProcessPastedData = async () => {
        if (!pasteRawText.trim()) return;

        const lines = pasteRawText.split('\n').map(l => l.trim()).filter(Boolean);
        const newItems: CampaignDictItem[] = [];

        lines.forEach((line, idx) => {
            const p = line.split(/\t|\s{2,}/).map(x => x.trim()).filter(Boolean);
            if (p.length >= 2) {
                const rawKey = p[0];
                const displayName = p[1];
                const unit = p[2] || 'Cái';

                newItems.push({
                    raw_key: rawKey,
                    display_name: displayName,
                    unit,
                    is_active: true,
                    order_index: campaignList.length + idx + 1
                });
            }
        });

        if (newItems.length > 0) {
            const res = await upsertCampaignDictionary(newItems);
            if (res.success) {
                showToast(`✅ Đã nạp thành công ${newItems.length} mục thi đua mới!`);
                setIsPasteModalOpen(false);
                setPasteRawText('');
                loadData();
            } else {
                showToast(`Lỗi khi lưu dữ liệu import: ${res.error || ''}`);
            }
        } else {
            showToast('⚠️ Không tìm thấy dòng dữ liệu hợp lệ! Vui lòng kiểm tra định dạng.');
        }
    };

    // Đồng bộ toàn bộ lên Supabase Cloud hoặc làm mới dữ liệu
    const handleSyncAllToCloud = async () => {
        setIsSyncingAll(true);
        try {
            let didSave = false;
            if (hasChanges) {
                await handleBatchSave();
                didSave = true;
            }
            if (hasScoreChanges) {
                setSaveScoreTrigger(prev => prev + 1);
                didSave = true;
            }
            if (!didSave) {
                // Nếu không có thay đổi chưa lưu, nạp lại dữ liệu mới nhất từ Cloud
                await Promise.all([
                    loadData(),
                    syncStoreCampaignScoresFromCloud()
                ]);
                await handleCheckCloudConnection();
                showToast('⚡ Đã kiểm tra và đồng bộ dữ liệu mới nhất từ Cloud!');
            }
        } finally {
            setIsSyncingAll(false);
        }
    };

    const countActive = campaignList.filter(x => x.is_active).length;
    const countInactive = campaignList.filter(x => !x.is_active).length;

    return (
        <div className="p-4 sm:p-6 space-y-5 max-w-[1300px] mx-auto w-full">
            {toastMessage && (
                <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* Header & Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                    <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-amber-500" />
                        <span>Cấu Hình Thi Đua & Tính Điểm Hiệu Quả</span>
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Thiết lập điểm số theo từng siêu thị và quản lý từ điển viết tắt chương trình thi đua
                    </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Compact Cloud Status Chip */}
                    <button
                        type="button"
                        onClick={handleCheckCloudConnection}
                        disabled={isCheckingCloud}
                        title={`Bấm để kiểm tra lại kết nối Cloud. Lần kiểm tra cuối: ${lastCheckedTime || 'Chưa kiểm tra'}`}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-2xs ${(hasChanges || hasScoreChanges)
                                ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100 ring-1 ring-amber-400/50'
                                : cloudStatus === 'READY'
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100'
                                    : cloudStatus === 'OFFLINE'
                                        ? 'bg-rose-50 border-rose-300 text-rose-900 hover:bg-rose-100'
                                        : 'bg-blue-50 border-blue-300 text-blue-900 hover:bg-blue-100'
                            }`}
                    >
                        <span className="relative flex h-2 w-2">
                            {(hasChanges || hasScoreChanges) ? (
                                <>
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                </>
                            ) : cloudStatus === 'READY' ? (
                                <>
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </>
                            ) : cloudStatus === 'OFFLINE' ? (
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                            ) : (
                                <span className="animate-spin relative inline-flex rounded-full h-2 w-2 border border-blue-600 border-t-transparent"></span>
                            )}
                        </span>
                        <span>
                            {isCheckingCloud
                                ? 'Đang kiểm tra...'
                                : (hasChanges || hasScoreChanges)
                                    ? 'Có thay đổi chưa lưu'
                                    : cloudStatus === 'READY'
                                        ? 'Cloud: Sẵn sàng'
                                        : cloudStatus === 'OFFLINE'
                                            ? 'Mất kết nối Cloud'
                                            : 'Đang kết nối...'}
                        </span>
                    </button>

                    {/* Chuyển đổi Tab */}
                    <div className="flex items-center p-1 bg-slate-100 rounded-2xl border border-slate-200">
                        <button
                            type="button"
                            onClick={() => setActiveMainTab('store_scores')}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${activeMainTab === 'store_scores'
                                    ? 'bg-white text-amber-900 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            <Award className="w-4 h-4 text-amber-600" />
                            <span>🎯 Điểm thi đua Siêu thị</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveMainTab('dictionary')}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer ${activeMainTab === 'dictionary'
                                    ? 'bg-white text-indigo-900 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                        >
                            <BookOpen className="w-4 h-4 text-indigo-600" />
                            <span>📖 Từ điển viết tắt ({campaignList.length})</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* THANH TRẠNG THÁI KẾT NỐI SUPABASE & ĐỒNG BỘ */}
            <SupabaseSyncStatusBar
                status={cloudStatus}
                lastCheckedTime={lastCheckedTime}
                hasDictChanges={hasChanges}
                hasScoreChanges={hasScoreChanges}
                isSyncing={isCheckingCloud || isSyncingAll}
                dictCount={dictCloudCount || campaignList.length}
                scoresCount={scoresCloudCount}
                errorMessage={cloudError}
                isAdmin={isAdmin}
                onCheckConnection={handleCheckCloudConnection}
                onSyncNow={handleSyncAllToCloud}
            />

            {/* NỘI DUNG THEO TAB */}
            {activeMainTab === 'store_scores' ? (
                <StoreCampaignScoreTab
                    campaigns={campaignList}
                    stores={stores}
                    currentUser={currentUser}
                    isAdmin={isAdmin}
                    canAccessStore={canAccessStore}
                    showToast={showToast}
                    onHasChangesChange={setHasScoreChanges}
                    onSavedSuccess={() => {
                        setHasScoreChanges(false);
                        handleCheckCloudConnection();
                    }}
                    saveTrigger={saveScoreTrigger}
                />
            ) : (
                <div className="space-y-5 animate-in fade-in duration-200">
                    {/* Header phụ của Từ điển thi đua */}
                    <div className="flex items-center justify-between gap-3 flex-wrap bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                        <div>
                            <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
                                <BookOpen className="w-4 h-4 text-indigo-600" />
                                <span>DANH MỤC TỪ ĐIỂN MÃ THI ĐUA TOÀN HỆ THỐNG</span>
                            </h2>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Quản lý mã gốc, tên viết tắt, đơn vị tính và trạng thái áp dụng
                            </p>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            {hasChanges && (
                                <span className="text-[11px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-xl flex items-center gap-1 animate-pulse">
                                    <AlertCircle className="w-3.5 h-3.5" /> Có thay đổi chưa lưu!
                                </span>
                            )}

                            <button
                                onClick={handleAddNewRow}
                                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                            >
                                <Plus className="w-4 h-4 text-indigo-600" />
                                <span>+ Thêm dòng thi đua</span>
                            </button>

                            <button
                                onClick={() => setIsPasteModalOpen(true)}
                                className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition cursor-pointer"
                            >
                                <UploadCloud className="w-4 h-4 text-slate-600" />
                                <span>Dán danh sách</span>
                            </button>

                            <button
                                onClick={handleBatchSave}
                                disabled={isSaving}
                                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50 ${hasChanges
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-400'
                                    : 'bg-slate-800 hover:bg-slate-900 text-white'
                                    }`}
                            >
                                <Save className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
                                <span>{isSaving ? 'ĐANG LƯU...' : '💾 LƯU TỪ ĐIỂN THI ĐUA'}</span>
                            </button>
                        </div>
                    </div>

                    {/* BANNER CẢNH BÁO THAY ĐỔI CHƯA LƯU */}
                    {hasChanges && (
                        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 shadow-xs animate-in fade-in duration-200">
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded-xl bg-amber-100 text-amber-700 shrink-0">
                                    <AlertCircle className="w-5 h-5 text-amber-600" />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-xs uppercase tracking-wider text-amber-900 flex items-center gap-2">
                                        <span>⚠️ Có thay đổi về từ điển thi đua chưa được đồng bộ lên Cloud!</span>
                                    </h3>
                                    <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                                        Bạn vừa sửa đổi thông tin, trạng thái hoặc sắp xếp lại thứ tự. Hãy bấm nút lưu để cập nhật vào hệ thống.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    type="button"
                                    onClick={handleBatchSave}
                                    disabled={isSaving}
                                    className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50"
                                >
                                    <Save className={`w-4 h-4 ${isSaving ? 'animate-spin' : ''}`} />
                                    <span>{isSaving ? 'ĐANG ĐỒNG BỘ...' : '⚡ ĐỒNG BỘ LÊN CLOUD NGAY'}</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* THANH ĐIỀU KHIỂN: TÌM KIẾM, BỘ LỌC TRẠNG THÁI & SẮP XẾP */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                            {/* Ô Tìm kiếm */}
                            <div className="relative flex-1 max-w-md">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                                <input
                                    type="text"
                                    placeholder="Tìm theo Mã gốc, Tên hiển thị viết tắt hoặc Đơn vị..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>

                            {/* Bộ lọc trạng thái dạng Tabs / Pills */}
                            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
                                <button
                                    onClick={() => setStatusFilter('ALL')}
                                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${statusFilter === 'ALL'
                                        ? 'bg-white text-slate-800 shadow-xs'
                                        : 'text-slate-500 hover:text-slate-800'
                                        }`}
                                >
                                    Tất cả ({campaignList.length})
                                </button>
                                <button
                                    onClick={() => setStatusFilter('ACTIVE')}
                                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${statusFilter === 'ACTIVE'
                                        ? 'bg-white text-emerald-700 shadow-xs'
                                        : 'text-slate-500 hover:text-emerald-700'
                                        }`}
                                >
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                                    Đang áp dụng ({countActive})
                                </button>
                                <button
                                    onClick={() => setStatusFilter('INACTIVE')}
                                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${statusFilter === 'INACTIVE'
                                        ? 'bg-white text-slate-700 shadow-xs'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
                                    Tạm ẩn ({countInactive})
                                </button>
                            </div>

                            {/* Bộ chọn Sắp xếp nhanh */}
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                                    <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Sắp xếp:</span>
                                </div>
                                <select
                                    value={`${sortField}_${sortDirection}`}
                                    onChange={(e) => {
                                        const [field, dir] = e.target.value.split('_') as [SortField, SortDirection];
                                        setSortField(field);
                                        setSortDirection(dir);
                                    }}
                                    className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-300 bg-slate-50 text-slate-700 outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="order_index_asc">🔢 Thứ tự mặc định (1 → N)</option>
                                    <option value="order_index_desc">🔢 Thứ tự ngược (N → 1)</option>
                                    <option value="raw_key_asc">🔤 Tên gốc báo cáo (A → Z)</option>
                                    <option value="raw_key_desc">🔤 Tên gốc báo cáo (Z → A)</option>
                                    <option value="display_name_asc">🏷️ Tên viết tắt (A → Z)</option>
                                    <option value="display_name_desc">🏷️ Tên viết tắt (Z → A)</option>
                                    <option value="unit_asc">📏 Đơn vị tính (A → Z)</option>
                                    <option value="is_active_desc">✅ Đang áp dụng lên trước</option>
                                    <option value="is_active_asc">📦 Tạm ẩn lên trước</option>
                                </select>
                            </div>
                        </div>

                        {/* Hàng công cụ phụ: Đánh lại số thứ tự và nút Tải lại */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
                            <div className="flex items-center gap-2">
                                <span>Hiển thị: <b>{filteredAndSortedList.length}</b> / {campaignList.length} mục</span>
                                <span>•</span>
                                <span className="text-slate-400">
                                    Mẹo: Bấm trực tiếp vào tiêu đề cột bên dưới để sắp xếp nhanh (A-Z hoặc Z-A).
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleAutoReindex}
                                    title="Tự động gán lại thứ tự 1, 2, 3... theo đúng thứ tự đang sắp xếp hiện tại"
                                    className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center gap-1 transition cursor-pointer border border-indigo-200"
                                >
                                    <Hash className="w-3 h-3 text-indigo-600" />
                                    <span>Đánh lại số thứ tự (1, 2, 3...)</span>
                                </button>

                                <button
                                    onClick={loadData}
                                    disabled={loading}
                                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition cursor-pointer"
                                    title="Tải lại từ điển từ máy chủ"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Bảng Từ Điển Thi Đua */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                        <div className="overflow-x-auto no-scrollbar">
                            <table className="w-full text-xs text-left min-w-[880px]">
                                <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-black tracking-wider border-b border-slate-200 select-none">
                                    <tr>
                                        {/* Cột Thứ tự */}
                                        <th
                                            onClick={() => handleSortToggle('order_index')}
                                            className="py-3 px-3 w-20 text-center cursor-pointer hover:bg-slate-200/70 transition group"
                                            title="Bấm để sắp xếp theo Thứ tự"
                                        >
                                            <div className="flex items-center justify-center gap-1">
                                                <span>THỨ TỰ</span>
                                                {renderSortIcon('order_index')}
                                            </div>
                                        </th>

                                        {/* Cột Mã gốc báo cáo */}
                                        <th
                                            onClick={() => handleSortToggle('raw_key')}
                                            className="py-3 px-3 w-72 cursor-pointer hover:bg-slate-200/70 transition group"
                                            title="Bấm để sắp xếp theo Mã gốc báo cáo"
                                        >
                                            <div className="flex items-center gap-1">
                                                <span>MÃ GỐC BÁO CÁO (RAW KEY)</span>
                                                {renderSortIcon('raw_key')}
                                            </div>
                                        </th>

                                        {/* Cột Tên hiển thị viết tắt */}
                                        <th
                                            onClick={() => handleSortToggle('display_name')}
                                            className="py-3 px-3 cursor-pointer hover:bg-slate-200/70 transition group"
                                            title="Bấm để sắp xếp theo Tên hiển thị viết tắt"
                                        >
                                            <div className="flex items-center gap-1">
                                                <span>TÊN HIỂN THỊ VIẾT TẮT</span>
                                                {renderSortIcon('display_name')}
                                            </div>
                                        </th>

                                        {/* Cột Đơn vị */}
                                        <th
                                            onClick={() => handleSortToggle('unit')}
                                            className="py-3 px-3 w-32 cursor-pointer hover:bg-slate-200/70 transition group"
                                            title="Bấm để sắp xếp theo Đơn vị tính"
                                        >
                                            <div className="flex items-center gap-1">
                                                <span>ĐƠN VỊ</span>
                                                {renderSortIcon('unit')}
                                            </div>
                                        </th>

                                        {/* Cột Trạng thái */}
                                        <th
                                            onClick={() => handleSortToggle('is_active')}
                                            className="py-3 px-3 w-36 text-center cursor-pointer hover:bg-slate-200/70 transition group"
                                            title="Bấm để sắp xếp theo Trạng thái áp dụng"
                                        >
                                            <div className="flex items-center justify-center gap-1">
                                                <span>TRẠNG THÁI</span>
                                                {renderSortIcon('is_active')}
                                            </div>
                                        </th>

                                        {/* Cột Xóa / Tạm ẩn */}
                                        <th className="py-3 px-3 w-16 text-center">XÓA</th>
                                    </tr>
                                </thead>

                                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={6} className="py-12 text-center text-slate-400 font-semibold">
                                                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                                                Đang nạp từ điển thi đua...
                                            </td>
                                        </tr>
                                    ) : filteredAndSortedList.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="py-12 text-center text-slate-400 font-semibold">
                                                Không tìm thấy mục thi đua nào phù hợp với điều kiện lọc!
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredAndSortedList.map((item, idx) => (
                                            <tr
                                                key={item.id || idx}
                                                className={`hover:bg-indigo-50/30 transition ${item.isNew
                                                    ? 'bg-amber-50/50'
                                                    : !item.is_active
                                                        ? 'bg-slate-50/60 opacity-80'
                                                        : ''
                                                    }`}
                                            >
                                                {/* Thứ tự hiển thị */}
                                                <td className="py-2 px-3 text-center">
                                                    <input
                                                        type="number"
                                                        value={item.order_index ?? idx + 1}
                                                        onChange={(e) => handleFieldChange(item.id, 'order_index', parseInt(e.target.value) || 0)}
                                                        className="w-14 bg-slate-50 border border-slate-300 rounded-md py-1 text-center font-mono text-xs font-bold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
                                                    />
                                                </td>

                                                {/* Mã gốc (RAW KEY) */}
                                                <td className="py-2 px-3">
                                                    <input
                                                        type="text"
                                                        value={item.raw_key}
                                                        placeholder="VD: Điện thoại Vivo"
                                                        onChange={(e) => handleFieldChange(item.id, 'raw_key', e.target.value)}
                                                        className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 focus:border-indigo-500 rounded-lg px-2.5 py-1 font-mono font-bold text-indigo-700 outline-none"
                                                    />
                                                </td>

                                                {/* Tên hiển thị viết tắt */}
                                                <td className="py-2 px-3">
                                                    <input
                                                        type="text"
                                                        value={item.display_name}
                                                        placeholder="VD: Bảo hiểm ĐMX"
                                                        onChange={(e) => handleFieldChange(item.id, 'display_name', e.target.value)}
                                                        className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 focus:border-emerald-500 rounded-lg px-2.5 py-1 font-bold text-slate-800 outline-none"
                                                    />
                                                </td>

                                                {/* Đơn vị tính */}
                                                <td className="py-2 px-3">
                                                    <div className="relative">
                                                        <input
                                                            type="text"
                                                            list={`units_${item.id}`}
                                                            value={item.unit || 'Cái'}
                                                            onChange={(e) => handleFieldChange(item.id, 'unit', e.target.value)}
                                                            className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500"
                                                        />
                                                        <datalist id={`units_${item.id}`}>
                                                            {COMMON_UNITS.map(u => (
                                                                <option key={u} value={u} />
                                                            ))}
                                                        </datalist>
                                                    </div>
                                                </td>

                                                {/* Trạng thái Bật/Tắt */}
                                                <td className="py-2 px-3 text-center">
                                                    <button
                                                        onClick={() => handleFieldChange(item.id, 'is_active', !item.is_active)}
                                                        className={`px-3 py-1 rounded-full text-[11px] font-bold transition cursor-pointer flex items-center justify-center gap-1 mx-auto ${item.is_active
                                                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                                            : 'bg-slate-100 text-slate-500 border border-slate-300 hover:bg-slate-200'
                                                            }`}
                                                        title={item.is_active ? 'Bấm để Tạm ẩn mục này' : 'Bấm để Áp dụng lại mục này'}
                                                    >
                                                        {item.is_active ? (
                                                            <>
                                                                <Check className="w-3 h-3 text-emerald-600" />
                                                                <span>Áp dụng</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Archive className="w-3 h-3 text-slate-400" />
                                                                <span>Tạm ẩn</span>
                                                            </>
                                                        )}
                                                    </button>
                                                </td>

                                                {/* Nút Xóa */}
                                                <td className="py-2 px-3 text-center">
                                                    <button
                                                        onClick={() => handleDeleteClick(item)}
                                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                                        title="Xóa hoặc Tạm ẩn mục này"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL XÓA THÔNG MINH (SMART DELETE / ARCHIVE MODAL) */}
            {deleteModalState.isOpen && deleteModalState.item && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white rounded-3xl max-w-[560px] w-full p-6 space-y-5 shadow-2xl border border-slate-200">
                        {/* Header Modal */}
                        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-3">
                                <div className={`p-2.5 rounded-2xl ${deleteModalState.linkedCount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                                    {deleteModalState.linkedCount > 0 ? (
                                        <AlertTriangle className="w-6 h-6 text-amber-600" />
                                    ) : (
                                        <Trash2 className="w-6 h-6 text-rose-600" />
                                    )}
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-base text-slate-900">
                                        {deleteModalState.linkedCount > 0
                                            ? 'Mục này đang có dữ liệu liên kết cũ'
                                            : 'Xác nhận xóa mã thi đua'}
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        Mã gốc: <b className="font-mono text-indigo-700">{deleteModalState.item.raw_key}</b>
                                        {deleteModalState.item.display_name && (
                                            <> — Tên: <b className="text-slate-800">{deleteModalState.item.display_name}</b></>
                                        )}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setDeleteModalState(prev => ({ ...prev, isOpen: false }))}
                                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Nội dung kiểm tra */}
                        {deleteModalState.isChecking ? (
                            <div className="py-8 text-center text-slate-500 text-xs font-semibold">
                                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                                Đang kiểm tra dữ liệu liên kết trong hệ thống...
                            </div>
                        ) : deleteModalState.linkedCount > 0 ? (
                            /* TRƯỜNG HỢP CÓ DỮ LIỆU LIÊN KẾT: CUNG CẤP 2 LỰA CHỌN TỐI ƯU */
                            <div className="space-y-4">
                                <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-1.5">
                                    <p className="font-bold flex items-center gap-1.5 text-amber-800">
                                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                        <span>Phát hiện <b>{deleteModalState.linkedCount}</b> chỉ tiêu nhân viên liên kết ở các tháng trước!</span>
                                    </p>
                                    <p className="text-[11px] text-amber-700 leading-relaxed">
                                        Nếu xóa vĩnh viễn, các báo cáo tổng kết và lịch sử chỉ tiêu của các tháng cũ (ví dụ Tháng 8, Tháng 9) sẽ bị mất tên thi đua hoặc sai lệch số liệu đối soát.
                                    </p>
                                </div>

                                {/* LỰA CHỌN 1: TẠM ẨN (KHUYẾN NGHỊ TỐI ƯU) */}
                                <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-2xl space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-extrabold text-indigo-900 flex items-center gap-1.5">
                                            <Archive className="w-4 h-4 text-indigo-600" />
                                            <span>LỰA CHỌN 1: CHUYỂN SANG "TẠM ẨN" (KHUYẾN NGHỊ)</span>
                                        </span>
                                        <span className="text-[10px] font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                                            Tối ưu nhất
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-indigo-800 leading-relaxed">
                                        Mục này sẽ <b>không xuất hiện</b> trong bảng nhập chỉ tiêu và báo cáo của các tháng mới nữa, nhưng <b>vẫn giữ nguyên 100% tên và số liệu</b> của các tháng cũ.
                                    </p>
                                    <div className="pt-1">
                                        <button
                                            type="button"
                                            onClick={handleConfirmArchive}
                                            disabled={deleteModalState.isActionRunning}
                                            className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-50"
                                        >
                                            <Archive className="w-4 h-4" />
                                            <span>Chuyển Sang Tạm Ẩn Ngay (Bảo Toàn Báo Cáo Cũ)</span>
                                        </button>
                                    </div>
                                </div>

                                {/* LỰA CHỌN 2: XÓA VĨNH VIỄN CƯỠNG BỨC (FORCE CASCADE DELETE) */}
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                                    <span className="text-xs font-extrabold text-rose-700 flex items-center gap-1.5">
                                        <Trash2 className="w-4 h-4 text-rose-600" />
                                        <span>LỰA CHỌN 2: XÓA VĨNH VIỄN CẢ MỤC VÀ DỮ LIỆU CŨ</span>
                                    </span>
                                    <p className="text-[11px] text-slate-600 leading-relaxed">
                                        Chỉ dùng khi đây là dữ liệu tạo nhầm hoặc rác. Hành động này sẽ <b>xóa sạch</b> cả từ điển và toàn bộ {deleteModalState.linkedCount} bản ghi chỉ tiêu liên kết.
                                    </p>
                                    <div className="space-y-2 pt-1">
                                        <p className="text-[11px] font-bold text-slate-700">
                                            Nhập chữ <span className="font-mono text-rose-600 font-extrabold bg-rose-50 px-1 py-0.5 rounded border border-rose-200">XÓA</span> hoặc nhập đúng mã <span className="font-mono text-slate-800">{deleteModalState.item.raw_key}</span> để xác nhận:
                                        </p>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={deleteModalState.confirmText}
                                                onChange={(e) => setDeleteModalState(prev => ({ ...prev, confirmText: e.target.value }))}
                                                placeholder="Nhập XÓA..."
                                                className="flex-1 px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold outline-none focus:border-rose-500"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleConfirmForceDelete}
                                                disabled={
                                                    deleteModalState.isActionRunning ||
                                                    (deleteModalState.confirmText.trim().toUpperCase() !== 'XÓA' &&
                                                        deleteModalState.confirmText.trim() !== deleteModalState.item.raw_key)
                                                }
                                                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:hover:bg-rose-600 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                <span>Xóa Vĩnh Viễn</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* TRƯỜNG HỢP KHÔNG CÓ DỮ LIỆU LIÊN KẾT: XÓA AN TOÀN */
                            <div className="space-y-4">
                                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                                    <span>Mục này chưa có bất kỳ chỉ tiêu hay số liệu nào liên kết. Bạn có thể xóa vĩnh viễn an toàn!</span>
                                </div>

                                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                    <button
                                        type="button"
                                        onClick={() => setDeleteModalState(prev => ({ ...prev, isOpen: false }))}
                                        className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                                    >
                                        HỦY BỎ
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleConfirmForceDelete}
                                        disabled={deleteModalState.isActionRunning}
                                        className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        <span>XÁC NHẬN XÓA</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Modal dán danh sách nhanh */}
            {isPasteModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-[600px] w-full p-5 space-y-4 shadow-2xl border border-slate-200">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                            <div className="flex items-center gap-2">
                                <UploadCloud className="w-5 h-5 text-indigo-600" />
                                <h3 className="font-extrabold text-sm text-slate-800 uppercase">Dán danh sách từ điển thi đua</h3>
                            </div>
                            <button
                                onClick={() => setIsPasteModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="text-[11px] text-slate-500 space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <p className="font-bold text-slate-700">📌 Định dạng cột copy từ Excel (Cách nhau bằng Tab):</p>
                            <p className="font-mono text-indigo-700">Mã Gốc [tab] Tên Hiển Thị Viết Tắt [tab] Đơn Vị</p>
                        </div>

                        <textarea
                            rows={8}
                            value={pasteRawText}
                            onChange={(e) => setPasteRawText(e.target.value)}
                            placeholder={`BẢO_HIỂM_ĐMX\tBảo hiểm ĐMX\tTr.đ\nTHẺ_TP_VPBANK\tThẻ VPBank\tThẻ\nPIN_SDP\tPin sạc dự phòng\tCái`}
                            className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 resize-none text-slate-800"
                        />

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                            <button
                                onClick={() => setIsPasteModalOpen(false)}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                            >
                                HỦY BỎ
                            </button>
                            <button
                                onClick={handleProcessPastedData}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                            >
                                <Plus className="w-4 h-4" />
                                <span>NẠP VÀO TỪ ĐIỂN</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}