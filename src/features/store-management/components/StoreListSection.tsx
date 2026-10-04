import { useState, useMemo } from 'react';
import type { StoreItem, EmployeeItem } from '../../../core/lib/storage';
import {
    Store,
    Plus,
    Search,
    Edit2,
    Trash2,
    CheckCircle2,
    XCircle,
    Users,
    MapPin,
    AlertCircle,
    X,
    Save,
    Clock,
    Calendar
} from 'lucide-react';
import {
    getStoreOperatingConfig,
    saveStoreOperatingConfig
} from '../../employee-performance/utils/performanceConfig';

interface Props {
    stores: StoreItem[];
    employees: EmployeeItem[];
    canConfigure: boolean;
    isManager: boolean;
    onSaveStore: (store: Partial<StoreItem>) => Promise<boolean>;
    onDeleteStore: (id: string, name: string) => Promise<boolean>;
    onOpenRoleModal: () => void;
}

export default function StoreListSection({
    stores,
    employees,
    canConfigure,
    isManager,
    onSaveStore,
    onDeleteStore,
    onOpenRoleModal
}: Props) {
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStore, setEditingStore] = useState<Partial<StoreItem> | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // Cấu hình giờ mở cửa & số ngày hoạt động
    const [openTime, setOpenTime] = useState('08:00');
    const [closeTime, setCloseTime] = useState('22:00');
    const [operatingDays, setOperatingDays] = useState(30);

    // Bản đồ đếm số lượng nhân viên theo siêu thị
    const employeeCountMap = useMemo(() => {
        const counts: Record<string, number> = {};
        employees.forEach(emp => {
            if (emp.store_name) {
                counts[emp.store_name] = (counts[emp.store_name] || 0) + 1;
            }
        });
        return counts;
    }, [employees]);

    // Lọc danh sách
    const filteredStores = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return stores;
        return stores.filter(
            s =>
                s.name.toLowerCase().includes(q) ||
                s.code.toLowerCase().includes(q) ||
                (s.address && s.address.toLowerCase().includes(q))
        );
    }, [stores, searchQuery]);

    const handleOpenAddModal = () => {
        if (!canConfigure || !isManager) {
            onOpenRoleModal();
            return;
        }
        setEditingStore({
            code: '',
            name: '',
            address: '',
            is_active: true
        });
        setOpenTime('08:00');
        setCloseTime('22:00');
        setOperatingDays(30);
        setErrorMsg('');
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (store: StoreItem) => {
        if (!canConfigure || !isManager) {
            onOpenRoleModal();
            return;
        }
        setEditingStore({ ...store });
        const now = new Date();
        const opCfg = getStoreOperatingConfig(store.name, now.getMonth() + 1, now.getFullYear());
        setOpenTime(opCfg.openTime);
        setCloseTime(opCfg.closeTime);
        setOperatingDays(opCfg.operatingDays);
        setErrorMsg('');
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingStore?.code?.trim() || !editingStore?.name?.trim()) {
            setErrorMsg('Vui lòng điền đầy đủ Mã siêu thị và Tên siêu thị!');
            return;
        }
        setIsSaving(true);
        setErrorMsg('');
        const ok = await onSaveStore(editingStore);
        setIsSaving(false);
        if (ok) {
            if (editingStore.name) {
                const now = new Date();
                saveStoreOperatingConfig(
                    editingStore.name,
                    now.getMonth() + 1,
                    now.getFullYear(),
                    {
                        openTime,
                        closeTime,
                        operatingDays: Number(operatingDays) || 30
                    }
                );
            }
            setIsModalOpen(false);
            setEditingStore(null);
        } else {
            setErrorMsg('Lưu thất bại! Mã siêu thị có thể đã tồn tại.');
        }
    };

    const handleDelete = async (store: StoreItem) => {
        if (!canConfigure || !isManager) {
            onOpenRoleModal();
            return;
        }
        const empCount = employeeCountMap[store.name] || 0;
        let confirmText = `Bạn có chắc chắn muốn xóa siêu thị [${store.name}]?`;
        if (empCount > 0) {
            confirmText = `⚠️ Siêu thị [${store.name}] hiện đang có ${empCount} nhân viên. Bạn vẫn muốn xóa siêu thị này?`;
        }
        if (window.confirm(confirmText)) {
            await onDeleteStore(store.id!, store.name);
        }
    };

    const handleToggleStatus = async (store: StoreItem) => {
        if (!canConfigure || !isManager) {
            onOpenRoleModal();
            return;
        }
        await onSaveStore({
            ...store,
            is_active: !store.is_active
        });
    };

    return (
        <div className="space-y-4">
            {/* Top Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Tìm theo mã, tên siêu thị, địa chỉ..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800"
                    />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleOpenAddModal}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Thêm Siêu Thị Mới</span>
                    </button>
                </div>
            </div>

            {/* Bảng Danh sách siêu thị */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-extrabold border-b border-slate-200">
                            <tr>
                                <th className="py-3 px-4 w-12 text-center">STT</th>
                                <th className="py-3 px-4 w-28">Mã ST</th>
                                <th className="py-3 px-4">Tên Siêu Thị</th>
                                <th className="py-3 px-4">Địa Chỉ</th>
                                <th className="py-3 px-4 w-28 text-center">Nhân Sự</th>
                                <th className="py-3 px-4 w-32 text-center">Trạng Thái</th>
                                <th className="py-3 px-4 w-24 text-right">Thao Tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredStores.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                                        Không tìm thấy siêu thị nào phù hợp.
                                    </td>
                                </tr>
                            ) : (
                                filteredStores.map((store, index) => {
                                    const empCount = employeeCountMap[store.name] || 0;
                                    return (
                                        <tr key={store.id || store.code} className="hover:bg-slate-50/80 transition">
                                            <td className="py-3 px-4 text-center font-mono text-slate-400 font-semibold">
                                                {index + 1}
                                            </td>
                                            <td className="py-3 px-4 font-mono font-bold text-blue-700">
                                                {store.code}
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                                                    <Store className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                                    <span>{store.name}</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-slate-600">
                                                {store.address ? (
                                                    <div className="flex items-center gap-1 text-slate-500 truncate max-w-xs">
                                                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                                        <span className="truncate">{store.address}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-300 italic">Chưa cập nhật</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                                    <Users className="w-3 h-3" />
                                                    <span>{empCount} NV</span>
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                <button
                                                    onClick={() => handleToggleStatus(store)}
                                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold cursor-pointer transition ${
                                                        store.is_active !== false
                                                            ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                    }`}
                                                >
                                                    {store.is_active !== false ? (
                                                        <>
                                                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                            <span>Hoạt động</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <XCircle className="w-3 h-3 text-slate-400" />
                                                            <span>Tạm ngừng</span>
                                                        </>
                                                    )}
                                                </button>
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        onClick={() => handleOpenEditModal(store)}
                                                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                                                        title="Sửa siêu thị"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(store)}
                                                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                                        title="Xóa siêu thị"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Thêm / Sửa siêu thị */}
            {isModalOpen && editingStore && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
                        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-4 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Store className="w-5 h-5 text-amber-300" />
                                <h3 className="font-extrabold text-sm">
                                    {editingStore.id ? 'Chỉnh Sửa Siêu Thị' : 'Thêm Siêu Thị Mới'}
                                </h3>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-5 space-y-3.5">
                            <div>
                                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                                    Mã Siêu Thị (Code) <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ví dụ: 10335, 111, 290TCD..."
                                    value={editingStore.code || ''}
                                    onChange={e => setEditingStore({ ...editingStore, code: e.target.value })}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono font-bold text-slate-900"
                                    required
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                                    Tên Siêu Thị <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ví dụ: AAR_BRV_VTA - 290 Trương Công Định"
                                    value={editingStore.name || ''}
                                    onChange={e => setEditingStore({ ...editingStore, name: e.target.value })}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-semibold text-slate-900"
                                    required
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-slate-600 block mb-1">Địa chỉ siêu thị</label>
                                <textarea
                                    rows={2}
                                    placeholder="Số nhà, tên đường, phường xã, quận huyện..."
                                    value={editingStore.address || ''}
                                    onChange={e => setEditingStore({ ...editingStore, address: e.target.value })}
                                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800"
                                />
                            </div>

                            {/* Cấu hình thời gian hoạt động & số ngày hoạt động */}
                            <div className="p-3 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-3">
                                <div className="text-[11px] font-extrabold text-blue-900 flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                                    <span>Thời gian hoạt động hàng ngày (Giờ bán hàng)</span>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Giờ mở cửa:</label>
                                        <input
                                            type="time"
                                            value={openTime}
                                            onChange={e => setOpenTime(e.target.value)}
                                            className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg outline-hidden focus:border-blue-600"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-semibold text-slate-500 block mb-0.5">Giờ đóng cửa:</label>
                                        <input
                                            type="time"
                                            value={closeTime}
                                            onChange={e => setCloseTime(e.target.value)}
                                            className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg outline-hidden focus:border-blue-600"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-semibold text-slate-500 block mb-0.5 flex items-center gap-1">
                                        <Calendar className="w-3 h-3 text-amber-600" />
                                        <span>Số ngày hoạt động trong tháng này (Mặc định 30 ngày):</span>
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min={1}
                                            max={31}
                                            value={operatingDays}
                                            onChange={e => setOperatingDays(Number(e.target.value))}
                                            className="w-24 px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-slate-200 rounded-lg outline-hidden focus:border-blue-600"
                                        />
                                        <span className="text-[11px] text-slate-500">ngày (Boss chỉnh tay nếu có đóng cửa)</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    type="checkbox"
                                    id="storeActiveCheck"
                                    checked={editingStore.is_active !== false}
                                    onChange={e => setEditingStore({ ...editingStore, is_active: e.target.checked })}
                                    className="rounded-sm text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                />
                                <label htmlFor="storeActiveCheck" className="text-xs font-semibold text-slate-700 cursor-pointer">
                                    Đang hoạt động (Kích hoạt cho hệ thống)
                                </label>
                            </div>

                            {errorMsg && (
                                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>{errorMsg}</span>
                                </div>
                            )}

                            <div className="flex gap-2 pt-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="flex-1 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                    <Save className="w-4 h-4" />
                                    <span>{isSaving ? 'Đang lưu...' : 'Lưu Siêu Thị'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
