import { useState, useEffect } from 'react';
import {
    fetchStores,
    fetchEmployees,
    upsertStore,
    deleteStoreById,
    upsertEmployee,
    upsertEmployeesBatch,
    deleteEmployeeById,
    type StoreItem,
    type EmployeeItem
} from '../../core/lib/storage';
import { useAuth } from '../../shared/contexts/AuthContext';
import StoreListSection from './components/StoreListSection';
import EmployeeListSection from './components/EmployeeListSection';
import QuickPasteEmployeeModal from './components/QuickPasteEmployeeModal';
import RolePermissionModal from './components/RolePermissionModal';
import PermissionDeniedBanner from './components/PermissionDeniedBanner';
import {
    Store,
    Users,
    ShieldCheck,
    RefreshCw,
    Sparkles,
    CheckCircle2,
    AlertCircle
} from 'lucide-react';

export default function StoreEmployeeConfigPage() {
    const { currentUser, canConfigure, isManager, isActualAdmin } = useAuth();

    const [activeTab, setActiveTab] = useState<'stores' | 'employees'>('stores');
    const [stores, setStores] = useState<StoreItem[]>([]);
    const [employees, setEmployees] = useState<EmployeeItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [cloudError, setCloudError] = useState<string | null>(null);

    const [isQuickPasteOpen, setIsQuickPasteOpen] = useState(false);
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState('');

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 3500);
    };

    const loadData = async () => {
        setLoading(true);
        setCloudError(null);
        const [storesRes, empsRes] = await Promise.all([
            fetchStores(),
            fetchEmployees()
        ]);

        let hasErr = false;
        if (storesRes.success) {
            setStores(storesRes.data);
        } else {
            hasErr = true;
            setCloudError('Không thể tải danh sách siêu thị từ Supabase Cloud');
            showToast('⚠️ Không thể tải danh sách siêu thị!');
        }

        if (empsRes.success) {
            setEmployees(empsRes.data);
        } else {
            hasErr = true;
            setCloudError(prev => prev ? `${prev} & nhân viên` : 'Không thể tải danh sách nhân viên từ Supabase Cloud');
            showToast('⚠️ Không thể tải danh sách nhân viên!');
        }

        if (!hasErr) {
            setCloudError(null);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    // Lưu / Cập nhật Siêu thị
    const handleSaveStore = async (store: Partial<StoreItem>): Promise<boolean> => {
        if (!canConfigure || !isManager) {
            setIsRoleModalOpen(true);
            return false;
        }
        const res = await upsertStore(store);
        if (res.success) {
            showToast('✅ Đã lưu thông tin siêu thị thành công!');
            await loadData();
            return true;
        }
        return false;
    };

    // Xóa Siêu thị
    const handleDeleteStore = async (id: string, name: string): Promise<boolean> => {
        if (!canConfigure || !isManager) {
            if (isActualAdmin) {
                setIsRoleModalOpen(true);
            } else {
                showToast('⚠️ Bạn không có quyền xóa siêu thị!');
            }
            return false;
        }
        const res = await deleteStoreById(id);
        if (res.success) {
            showToast(`🗑️ Đã xóa siêu thị [${name}] thành công!`);
            await loadData();
            return true;
        }
        showToast('❌ Không thể xóa siêu thị! Vui lòng thử lại.');
        return false;
    };

    // Lưu / Cập nhật Nhân viên
    const handleSaveEmployee = async (emp: Partial<EmployeeItem>): Promise<boolean> => {
        if (!canConfigure) {
            if (isActualAdmin) {
                setIsRoleModalOpen(true);
            } else {
                showToast('⚠️ Bạn không có quyền chỉnh sửa nhân sự!');
            }
            return false;
        }
        const res = await upsertEmployee(emp);
        if (res.success) {
            showToast('✅ Đã lưu thông tin nhân viên thành công!');
            await loadData();
            return true;
        }
        return false;
    };

    // Xóa Nhân viên
    const handleDeleteEmployee = async (id: string, name: string): Promise<boolean> => {
        if (!canConfigure) {
            if (isActualAdmin) {
                setIsRoleModalOpen(true);
            } else {
                showToast('⚠️ Bạn không có quyền xóa nhân sự!');
            }
            return false;
        }
        const res = await deleteEmployeeById(id);
        if (res.success) {
            showToast(`🗑️ Đã xóa nhân viên [${name}] thành công!`);
            await loadData();
            return true;
        }
        showToast('❌ Không thể xóa nhân viên! Vui lòng thử lại.');
        return false;
    };

    // Nạp hàng loạt từ Quick Paste Modal
    const handleQuickPasteSuccess = async (count: number) => {
        showToast(`🎉 Đã nạp thành công ${count} nhân sự vào hệ thống!`);
        await loadData();
    };

    return (
        <div className="max-w-7xl mx-auto space-y-4 pb-12">
            {/* Header Phân hệ */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-blue-100 text-blue-700">
                            <Store className="w-5 h-5" />
                        </span>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                            Cấu Hình Siêu Thị & Nhân Sự
                        </h1>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                        Quản trị danh mục siêu thị trong cụm và danh sách nhân sự phụ trách theo từng cửa hàng.
                    </p>
                </div>

                {/* Badge vai trò hiện tại & Nút đổi vai trò */}
                <div className="flex items-center gap-2 self-stretch md:self-auto">
                    <button
                        onClick={() => setIsRoleModalOpen(true)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition shadow-2xs cursor-pointer ${
                            currentUser.role === 'QUAN_LY'
                                ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                                : currentUser.role === 'TRUONG_CA'
                                ? 'bg-blue-50 border-blue-300 text-blue-900 hover:bg-blue-100'
                                : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                        }`}
                        title="Bấm để đổi vai trò hoặc xác thực"
                    >
                        <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0" />
                        <div className="text-left">
                            <span className="block text-[10px] uppercase font-bold tracking-wider opacity-75">Vai trò hiện tại</span>
                            <span className="font-extrabold">{currentUser.role_title}</span>
                        </div>
                    </button>

                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-slate-50 transition cursor-pointer"
                        title="Làm mới dữ liệu"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Banner nếu không có quyền cấu hình */}
            {!canConfigure && (
                <PermissionDeniedBanner onOpenRoleModal={() => setIsRoleModalOpen(true)} />
            )}

            {/* Toast thông báo */}
            {toastMessage && (
                <div className="fixed top-16 right-5 z-50 animate-in slide-in-from-top-4 duration-200">
                    <div className="px-4 py-2.5 bg-slate-900 text-white rounded-xl shadow-xl flex items-center gap-2 text-xs font-bold border border-slate-700">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>{toastMessage}</span>
                    </div>
                </div>
            )}

            {/* BANNER TRẠNG THÁI ĐỒNG BỘ SUPABASE CLOUD */}
            {cloudError ? (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 shadow-xs animate-in fade-in duration-200">
                    <div className="flex items-center gap-2.5">
                        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                        <div>
                            <span className="font-extrabold block text-xs">⚠️ Mất kết nối Supabase Cloud!</span>
                            <span className="text-amber-800 text-[11px]">{cloudError}. Dữ liệu có thể chưa được đồng bộ từ máy chủ đám mây.</span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={loadData}
                        disabled={loading}
                        className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-xs disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        <span>Thử lại đồng bộ</span>
                    </button>
                </div>
            ) : !loading && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2 flex items-center justify-between text-xs text-emerald-800">
                    <div className="flex items-center gap-2 font-medium">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span><b>Supabase Cloud:</b> Đã đồng bộ trực tuyến ({stores.length} siêu thị, {employees.length} nhân sự trên đám mây).</span>
                    </div>
                    <button
                        type="button"
                        onClick={loadData}
                        disabled={loading}
                        className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold underline cursor-pointer"
                    >
                        Kiểm tra lại
                    </button>
                </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 bg-white rounded-t-2xl px-3 pt-2">
                <button
                    onClick={() => setActiveTab('stores')}
                    className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-extrabold transition cursor-pointer ${
                        activeTab === 'stores'
                            ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-xl'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <Store className="w-4 h-4" />
                    <span>Danh Sách Siêu Thị</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                        {stores.length}
                    </span>
                </button>

                <button
                    onClick={() => setActiveTab('employees')}
                    className={`flex items-center gap-2 px-4 py-2.5 border-b-2 text-xs font-extrabold transition cursor-pointer ${
                        activeTab === 'employees'
                            ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-xl'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <Users className="w-4 h-4" />
                    <span>Danh Sách Nhân Viên</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                        {employees.length}
                    </span>
                </button>
            </div>

            {/* Nội dung theo Tab */}
            {loading ? (
                <div className="bg-white rounded-b-2xl p-12 text-center text-slate-400 text-xs font-bold flex flex-col items-center justify-center gap-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                    <span>Đang nạp dữ liệu từ hệ thống...</span>
                </div>
            ) : activeTab === 'stores' ? (
                <StoreListSection
                    stores={stores}
                    employees={employees}
                    canConfigure={canConfigure}
                    isManager={isManager}
                    onSaveStore={handleSaveStore}
                    onDeleteStore={handleDeleteStore}
                    onOpenRoleModal={() => setIsRoleModalOpen(true)}
                />
            ) : (
                <EmployeeListSection
                    employees={employees}
                    stores={stores}
                    canConfigure={canConfigure}
                    onSaveEmployee={handleSaveEmployee}
                    onDeleteEmployee={handleDeleteEmployee}
                    onOpenQuickPaste={() => setIsQuickPasteOpen(true)}
                    onOpenRoleModal={() => setIsRoleModalOpen(true)}
                />
            )}

            {/* Modal Dán Nhanh */}
            <QuickPasteEmployeeModal
                isOpen={isQuickPasteOpen}
                onClose={() => setIsQuickPasteOpen(false)}
                stores={stores}
                defaultStoreName={stores[0]?.name || ''}
                onImportSuccess={handleQuickPasteSuccess}
            />

            {/* Modal Đổi Vai Trò & Mở Khóa (Chỉ cho Admin) */}
            {isActualAdmin && (
                <RolePermissionModal
                    isOpen={isRoleModalOpen}
                    onClose={() => setIsRoleModalOpen(false)}
                    onSuccess={() => showToast('✨ Đã cập nhật quyền thành công!')}
                />
            )}
        </div>
    );
}
