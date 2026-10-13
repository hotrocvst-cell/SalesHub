import { useState, useMemo, useEffect } from 'react';
import { type SystemPagePermission } from '../../../core/lib/permissions';
import { type StoreItem } from '../../../core/lib/storage';
import { getShortStoreName, isStoreMatch } from '../../../core/lib/formatters';
import {
    Building2,
    Globe,
    Search,
    Check,
    CheckSquare,
    Square,
    X,
    Shield,
    Layers,
    Sparkles,
    AlertCircle
} from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    page: SystemPagePermission | null;
    stores: StoreItem[];
    onSave: (path: string, allowedStores?: string[]) => void;
}

export default function StorePermissionConfigModal({
    isOpen,
    onClose,
    page,
    stores,
    onSave
}: Props) {
    const [mode, setMode] = useState<'ALL' | 'SPECIFIC'>('ALL');
    const [selectedStores, setSelectedStores] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Khởi tạo state khi mở modal với trang cụ thể
    useEffect(() => {
        if (!page) return;
        const currentAllowed = page.allowed_stores || [];
        if (currentAllowed.length === 0 || currentAllowed.includes('ALL')) {
            setMode('ALL');
            setSelectedStores([]);
        } else {
            setMode('SPECIFIC');
            setSelectedStores([...currentAllowed]);
        }
        setSearchQuery('');
    }, [page, isOpen]);

    // Danh sách siêu thị sau khi lọc tìm kiếm
    const filteredStores = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return stores;
        return stores.filter(s =>
            s.name.toLowerCase().includes(query) ||
            (s.code && s.code.toLowerCase().includes(query)) ||
            getShortStoreName(s.name).toLowerCase().includes(query)
        );
    }, [stores, searchQuery]);

    if (!isOpen || !page) return null;

    const handleToggleStore = (storeName: string) => {
        setSelectedStores(prev => {
            const exists = prev.some(s => isStoreMatch(s, storeName, stores));
            if (exists) {
                return prev.filter(s => !isStoreMatch(s, storeName, stores));
            } else {
                return [...prev, storeName];
            }
        });
    };

    const handleSelectAllFiltered = () => {
        const namesToAdd = filteredStores.map(s => s.name);
        setSelectedStores(prev => {
            const set = new Set(prev);
            namesToAdd.forEach(n => set.add(n));
            return Array.from(set);
        });
    };

    const handleDeselectAllFiltered = () => {
        const namesToRemove = filteredStores.map(s => s.name);
        setSelectedStores(prev => prev.filter(s => !namesToRemove.some(n => isStoreMatch(n, s, stores))));
    };

    const handleConfirm = () => {
        if (mode === 'ALL') {
            onSave(page.path, undefined);
        } else {
            onSave(page.path, selectedStores);
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
                {/* Header Modal */}
                <div className="p-4 sm:p-5 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-indigo-50/40 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200 shrink-0">
                            <Building2 className="w-5 h-5 stroke-[2.5]" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-extrabold text-sm sm:text-base text-slate-800">
                                    Phân Quyền Siêu Thị Sử Dụng
                                </h3>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-700">
                                    {page.page_name}
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                                {page.path}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer shrink-0"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Nội dung cấu hình */}
                <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
                    {/* Hướng dẫn ngắn */}
                    <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-blue-900">
                        <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <div className="text-[11.5px] leading-relaxed">
                            <span className="font-extrabold">Cơ chế quản trị theo đơn vị:</span> Cho phép mở hoặc giới hạn tính năng chỉ cho các siêu thị cụ thể (tương đương phân quyền theo gói chi nhánh/tài khoản trả phí). <b>Admin</b> luôn có toàn quyền truy cập bất kể thiết lập này.
                        </div>
                    </div>

                    {/* Lựa chọn Chế độ phân quyền */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Option 1: Tất cả siêu thị */}
                        <div
                            onClick={() => setMode('ALL')}
                            className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3 ${mode === 'ALL'
                                ? 'border-indigo-600 bg-indigo-50/40 text-slate-900 shadow-2xs'
                                : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                                }`}
                        >
                            <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${mode === 'ALL' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                                }`}>
                                {mode === 'ALL' && <div className="w-2 h-2 rounded-full bg-white" />}
                            </div>
                            <div>
                                <div className="font-extrabold text-xs flex items-center gap-1.5">
                                    <Globe className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>Tất cả Siêu Thị</span>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                                    Mọi siêu thị trên toàn hệ thống đều có thể xem và sử dụng trang này (Mặc định).
                                </div>
                            </div>
                        </div>

                        {/* Option 2: Giới hạn theo siêu thị */}
                        <div
                            onClick={() => setMode('SPECIFIC')}
                            className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3 ${mode === 'SPECIFIC'
                                ? 'border-indigo-600 bg-indigo-50/40 text-slate-900 shadow-2xs'
                                : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                                }`}
                        >
                            <div className={`w-5 h-5 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0 ${mode === 'SPECIFIC' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                                }`}>
                                {mode === 'SPECIFIC' && <div className="w-2 h-2 rounded-full bg-white" />}
                            </div>
                            <div>
                                <div className="font-extrabold text-xs flex items-center gap-1.5">
                                    <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>Chỉ định Siêu Thị</span>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                                    Chỉ các siêu thị được chọn mới nhìn thấy trên menu và được quyền truy cập.
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Vùng chọn danh sách siêu thị nếu mode === 'SPECIFIC' */}
                    {mode === 'SPECIFIC' && (
                        <div className="space-y-3 pt-1 animate-in fade-in duration-200">
                            {/* Toolbar tìm kiếm & Tác vụ chọn */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                                <div className="relative flex-1">
                                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                                    <input
                                        type="text"
                                        placeholder="Tìm tên hoặc mã siêu thị..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                    {searchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => setSearchQuery('')}
                                            className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>

                                <div className="flex items-center gap-1.5 justify-end">
                                    <button
                                        type="button"
                                        onClick={handleSelectAllFiltered}
                                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 rounded-xl text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                                    >
                                        <CheckSquare className="w-3.5 h-3.5" />
                                        <span>Chọn tất cả ({filteredStores.length})</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleDeselectAllFiltered}
                                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 rounded-xl text-[11px] font-bold transition cursor-pointer flex items-center gap-1"
                                    >
                                        <Square className="w-3.5 h-3.5" />
                                        <span>Bỏ chọn</span>
                                    </button>
                                </div>
                            </div>

                            {/* Thống kê đã chọn */}
                            <div className="flex items-center justify-between text-xs px-1">
                                <span className="text-slate-500 font-medium">
                                    Đang chọn:{' '}
                                    <b className="text-indigo-600 font-extrabold">{selectedStores.length}</b> / {stores.length} siêu thị
                                </span>
                                {selectedStores.length === 0 && (
                                    <span className="text-rose-600 font-bold text-[11px] flex items-center gap-1">
                                        <AlertCircle className="w-3.5 h-3.5" />
                                        Chưa chọn siêu thị nào (Chỉ Admin truy cập)
                                    </span>
                                )}
                            </div>

                            {/* Danh sách siêu thị dạng Checkbox Grid */}
                            <div className="border border-slate-200 rounded-2xl p-2.5 max-h-64 sm:max-h-72 overflow-y-auto space-y-1 bg-slate-50/50">
                                {filteredStores.length === 0 ? (
                                    <div className="py-8 text-center text-xs text-slate-400 italic">
                                        Không tìm thấy siêu thị phù hợp với từ khóa "{searchQuery}"
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                        {filteredStores.map(store => {
                                            const isChecked = selectedStores.some(s => isStoreMatch(s, store.name, stores));
                                            const shortName = getShortStoreName(store.name);

                                            return (
                                                <div
                                                    key={store.id || store.code || store.name}
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => handleToggleStore(store.name)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === ' ' || e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleToggleStore(store.name);
                                                        }
                                                    }}
                                                    className={`p-2.5 rounded-xl border text-xs flex items-center gap-2.5 transition cursor-pointer select-none ${isChecked
                                                        ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-bold shadow-2xs ring-1 ring-indigo-400'
                                                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50'
                                                        }`}
                                                >
                                                    <div
                                                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition ${isChecked
                                                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xs'
                                                            : 'border-slate-300 bg-white hover:border-indigo-400'
                                                            }`}
                                                    >
                                                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="truncate text-xs font-extrabold flex items-center gap-1.5">
                                                            <span>{shortName}</span>
                                                            {store.code && (
                                                                <span className="text-[9.5px] px-1 py-0.2 rounded bg-slate-100 text-slate-500 font-mono font-normal">
                                                                    #{store.code}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 truncate mt-0.2" title={store.name}>
                                                            {store.name}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Modal */}
                <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                    <span className="text-[11px] text-slate-500 hidden sm:inline">
                        {mode === 'ALL' ? '🌍 Áp dụng cho mọi siêu thị' : `🏢 Giới hạn cho ${selectedStores.length} siêu thị`}
                    </span>
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            className="px-5 py-2 rounded-xl text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200 transition flex items-center gap-1.5 cursor-pointer"
                        >
                            <Check className="w-4 h-4" />
                            <span>Xác Nhận Thiết Lập</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
