import { useState, useEffect, useMemo } from 'react';
import { useAuth, type UserRole } from '../../contexts/AuthContext';
import { fetchStores, fetchEmployees, type StoreItem, type EmployeeItem } from '../../../core/lib/storage';
import { isStoreMatch, getShortStoreName } from '../../../core/lib/formatters';
import {
    FlaskConical,
    RotateCcw,
    X,
    ChevronDown,
    Shield,
    Crown,
    Star,
    User,
    Store,
    Users,
    Check,
    AlertCircle
} from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export default function AdminTestingBar({ isOpen, onClose }: Props) {
    const {
        currentUser,
        isActualAdmin,
        isImpersonating,
        impersonationState,
        setImpersonationRole,
        setImpersonationStore,
        setImpersonationEmployee,
        resetImpersonation
    } = useAuth();

    const [stores, setStores] = useState<StoreItem[]>([]);
    const [employees, setEmployees] = useState<EmployeeItem[]>([]);
    const [loadingData, setLoadingData] = useState<boolean>(false);

    // Tải danh sách Siêu thị và Nhân viên từ hệ thống để phục vụ giả lập
    useEffect(() => {
        if (!isActualAdmin) return;
        let isMounted = true;
        setLoadingData(true);

        Promise.all([fetchStores(), fetchEmployees()])
            .then(([storesRes, empsRes]) => {
                if (!isMounted) return;
                if (storesRes.success && storesRes.data) {
                    setStores(storesRes.data);
                }
                if (empsRes.success && empsRes.data) {
                    setEmployees(empsRes.data);
                }
            })
            .catch(err => {
                console.warn('Lỗi tải danh mục testing phân quyền:', err);
            })
            .finally(() => {
                if (isMounted) setLoadingData(false);
            });

        return () => {
            isMounted = false;
        };
    }, [isActualAdmin]);

    // Danh sách nhân viên được lọc theo siêu thị đang chọn mô phỏng
    const filteredEmployees = useMemo(() => {
        const currentStore = impersonationState.store_name || currentUser.store_name;
        if (!currentStore || currentStore === 'all') {
            return employees.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
        }
        return employees
            .filter(e => isStoreMatch(e.store_name, currentStore, stores))
            .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));
    }, [employees, impersonationState.store_name, currentUser.store_name, stores]);

    if (!isActualAdmin || !isOpen) return null;

    // Xử lý khi Admin đổi Siêu thị kiểm thử
    const handleStoreChange = (newStoreName: string) => {
        const storeVal = newStoreName === 'all' || !newStoreName ? undefined : newStoreName;
        setImpersonationStore(storeVal);

        // Nếu nhân viên đang chọn không thuộc siêu thị mới, reset nhân viên để tránh sai lệch dữ liệu
        if (storeVal && impersonationState.employee_id) {
            const currentEmp = employees.find(e => e.employee_id === impersonationState.employee_id);
            if (currentEmp && !isStoreMatch(currentEmp.store_name, storeVal, stores)) {
                setImpersonationEmployee(undefined);
            }
        }
    };

    // Xử lý khi Admin chọn đích danh một Nhân viên kiểm thử
    const handleEmployeeChange = (empId: string) => {
        if (!empId) {
            setImpersonationEmployee(undefined);
            return;
        }

        const foundEmp = employees.find(e => e.employee_id === empId);
        if (foundEmp) {
            // Xác định vai trò gợi ý theo chức danh của nhân viên (nếu muốn)
            let inferredRole: UserRole | undefined;
            const title = (foundEmp.role || foundEmp.job_title || '').toLowerCase();
            if (title.includes('quản lý') || title.includes('cụm')) {
                inferredRole = 'QUAN_LY';
            } else if (title.includes('trưởng ca') || title.includes('ca trưởng')) {
                inferredRole = 'TRUONG_CA';
            } else {
                inferredRole = 'NHAN_VIEN';
            }

            setImpersonationEmployee({
                employee_id: foundEmp.employee_id,
                full_name: foundEmp.full_name,
                store_name: foundEmp.store_name,
                // Nếu vai trò hiện tại vẫn là ADMIN, chuyển sang vai trò nhân viên tương ứng để Admin test ngay
                role: currentUser.role === 'ADMIN' ? inferredRole : undefined
            });

            // Tự động đồng bộ luôn Siêu thị của nhân viên đó nếu chưa khớp
            if (foundEmp.store_name) {
                setImpersonationStore(foundEmp.store_name);
            }
        }
    };

    const currentRole = currentUser.role;
    const currentStore = impersonationState.store_name || currentUser.store_name || '';
    const currentEmpId = impersonationState.employee_id || currentUser.employee_id || '';

    return (
        <div className="sticky top-14 z-35 bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white border-b border-indigo-500/40 shadow-xl transition-all duration-200">
            <div className="max-w-7xl mx-auto px-3 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                {/* 1. Tiêu đề & Chỉ báo trạng thái */}
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300 shadow-inner">
                        <FlaskConical className="w-4 h-4 animate-bounce" />
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5">
                            <span className="font-black text-amber-300 tracking-wider text-[11px] uppercase">
                                Testing Lab • Phân Quyền
                            </span>
                            {isImpersonating ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/30 border border-rose-400/60 text-rose-200 font-extrabold text-[10px] animate-pulse">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                                    <span>Đang Giả Lập</span>
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-bold text-[10px]">
                                    <span>Admin Gốc</span>
                                </span>
                            )}
                        </div>
                        <p className="text-[10px] text-slate-300 leading-tight hidden sm:block">
                            Chọn vai trò, siêu thị và nhân viên để kiểm thử giao diện & phân quyền dữ liệu tức thì
                        </p>
                    </div>
                </div>

                {/* 2. Bộ ba dropdown chọn nhanh: Vai trò, Siêu thị, Nhân viên */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Chọn Vai trò (Role) */}
                    <div className="flex items-center bg-slate-800/90 border border-slate-700 hover:border-indigo-400 rounded-xl px-2.5 py-1.5 transition">
                        <span className="text-slate-400 mr-1.5 shrink-0">
                            {currentRole === 'ADMIN' ? (
                                <Shield className="w-3.5 h-3.5 text-rose-400" />
                            ) : currentRole === 'QUAN_LY' ? (
                                <Crown className="w-3.5 h-3.5 text-amber-400" />
                            ) : currentRole === 'TRUONG_CA' ? (
                                <Star className="w-3.5 h-3.5 text-blue-400" />
                            ) : (
                                <User className="w-3.5 h-3.5 text-emerald-400" />
                            )}
                        </span>
                        <select
                            value={currentRole}
                            onChange={e => setImpersonationRole(e.target.value as UserRole)}
                            className="bg-transparent font-bold text-white text-xs outline-hidden cursor-pointer"
                            title="Chọn vai trò người dùng kiểm thử"
                        >
                            <option value="ADMIN" className="bg-slate-900 text-white">🛡️ Admin (Tối cao)</option>
                            <option value="QUAN_LY" className="bg-slate-900 text-white">👑 Quản Lý Siêu Thị</option>
                            <option value="TRUONG_CA" className="bg-slate-900 text-white">⭐ Trưởng Ca</option>
                            <option value="NHAN_VIEN" className="bg-slate-900 text-white">👤 Nhân Viên Bán Hàng</option>
                        </select>
                    </div>

                    {/* Chọn Siêu thị (Store) */}
                    <div className="flex items-center bg-slate-800/90 border border-slate-700 hover:border-indigo-400 rounded-xl px-2.5 py-1.5 transition max-w-[220px]">
                        <Store className="w-3.5 h-3.5 text-amber-400 mr-1.5 shrink-0" />
                        <select
                            value={currentStore}
                            onChange={e => handleStoreChange(e.target.value)}
                            className="bg-transparent font-bold text-white text-xs outline-hidden cursor-pointer w-full truncate"
                            title="Chọn siêu thị kiểm thử"
                        >
                            <option value="" className="bg-slate-900 text-white">🏢 Mọi siêu thị (Mặc định)</option>
                            {stores.map(s => (
                                <option key={s.id || s.name} value={s.name} className="bg-slate-900 text-white">
                                    {getShortStoreName(s.name)}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Chọn Nhân viên (Employee) */}
                    <div className="flex items-center bg-slate-800/90 border border-slate-700 hover:border-indigo-400 rounded-xl px-2.5 py-1.5 transition max-w-[250px]">
                        <Users className="w-3.5 h-3.5 text-emerald-400 mr-1.5 shrink-0" />
                        <select
                            value={currentEmpId}
                            onChange={e => handleEmployeeChange(e.target.value)}
                            className="bg-transparent font-bold text-white text-xs outline-hidden cursor-pointer w-full truncate"
                            title="Chọn nhân viên cụ thể để kiểm thử"
                        >
                            <option value="" className="bg-slate-900 text-white">
                                👤 Chưa chọn NV ({filteredEmployees.length} NV khả dụng)
                            </option>
                            {filteredEmployees.map(emp => (
                                <option key={emp.employee_id} value={emp.employee_id} className="bg-slate-900 text-white">
                                    {emp.employee_id} - {emp.full_name} {emp.job_title ? `(${emp.job_title})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* 3. Hành động: Khôi phục mặc định & Thu gọn thanh bar */}
                <div className="flex items-center gap-2">
                    {/* Nút Khôi phục mặc định 1-Click */}
                    {isImpersonating && (
                        <button
                            type="button"
                            onClick={() => resetImpersonation()}
                            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold flex items-center gap-1.5 shadow-sm transition cursor-pointer text-xs"
                            title="Xóa toàn bộ thiết lập mô phỏng và trở về tài khoản Admin gốc"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Về Admin Gốc</span>
                        </button>
                    )}

                    {/* Nút Thu gọn thanh bar */}
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition cursor-pointer"
                        title="Thu gọn thanh kiểm thử (Trạng thái mô phỏng vẫn được duy trì)"
                        aria-label="Đóng thanh kiểm thử"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
