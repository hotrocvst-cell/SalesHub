import { useState, useEffect } from 'react';
import type { SystemPagePermission } from '../../../core/lib/permissions';
import type { UserRole } from '../../../shared/contexts/AuthContext';
import {
    FileSpreadsheet,
    Shield,
    Check,
    X,
    Sparkles,
    Lock,
    Unlock,
    Info,
    Crown,
    Briefcase,
    Star,
    Users
} from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    page: SystemPagePermission | null;
    onSave: (path: string, allowExcel: boolean, allowedRoles: UserRole[]) => void;
}

interface RoleConfigItem {
    role: UserRole;
    title: string;
    description: string;
    icon: any;
    color: string;
    bgColor: string;
    borderColor: string;
}

const ROLES_LIST: RoleConfigItem[] = [
    {
        role: 'ADMIN',
        title: 'Quản Trị Viên (Admin)',
        description: 'Toàn quyền kiểm soát và xuất báo cáo trên toàn bộ hệ thống',
        icon: Crown,
        color: 'text-amber-700',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-300'
    },
    {
        role: 'QUAN_LY',
        title: 'Quản Lý (QL Siêu Thị / Cụm)',
        description: 'Cho phép xuất dữ liệu trong phạm vi siêu thị hoặc cụm đang phụ trách',
        icon: Briefcase,
        color: 'text-indigo-700',
        bgColor: 'bg-indigo-50',
        borderColor: 'border-indigo-300'
    },
    {
        role: 'TRUONG_CA',
        title: 'Trưởng Ca (TC)',
        description: 'Cho phép trưởng ca xuất dữ liệu đối soát trong ca làm việc',
        icon: Star,
        color: 'text-blue-700',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-300'
    },
    {
        role: 'NHAN_VIEN',
        title: 'Nhân Viên (Bán Hàng)',
        description: 'Cho phép nhân viên tự xuất dữ liệu cá nhân (chỉ nên bật khi cần thiết)',
        icon: Users,
        color: 'text-slate-700',
        bgColor: 'bg-slate-50',
        borderColor: 'border-slate-300'
    }
];

export default function ExcelExportPermissionModal({
    isOpen,
    onClose,
    page,
    onSave
}: Props) {
    const [allowExcel, setAllowExcel] = useState<boolean>(false);
    const [selectedRoles, setSelectedRoles] = useState<UserRole[]>(['ADMIN']);

    useEffect(() => {
        if (!page) return;
        setAllowExcel(Boolean(page.allow_excel_export));
        const roles: UserRole[] = Array.isArray(page.allowed_excel_roles) && page.allowed_excel_roles.length > 0
            ? (page.allowed_excel_roles as UserRole[])
            : ['ADMIN'];
        setSelectedRoles(roles);
    }, [page, isOpen]);

    if (!isOpen || !page) return null;

    const handleToggleRole = (role: UserRole) => {
        // Admin luôn có quyền mặc định
        if (role === 'ADMIN') return;

        setSelectedRoles(prev => {
            if (prev.includes(role)) {
                return prev.filter(r => r !== role);
            } else {
                return [...prev, role];
            }
        });
    };

    const handleApplyPreset = (roles: UserRole[]) => {
        setSelectedRoles(roles);
    };

    const handleConfirm = () => {
        // Đảm bảo luôn có ADMIN trong danh sách nếu bật xuất
        const finalRoles: UserRole[] = Array.from(new Set(['ADMIN' as UserRole, ...selectedRoles]));
        onSave(page.path, allowExcel, allowExcel ? finalRoles : ['ADMIN']);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden font-avo flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-md shrink-0">
                            <FileSpreadsheet className="w-5 h-5 text-emerald-200" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-sm sm:text-base font-black uppercase tracking-wide text-white">
                                    Cấu Hình Phân Quyền Xuất Excel
                                </h3>
                                <span className="text-[10px] bg-emerald-500/30 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/40">
                                    Rule #9
                                </span>
                            </div>
                            <p className="text-xs text-slate-300 mt-0.5">
                                Phân hệ: <strong className="text-white">{page.page_name}</strong> (<code className="font-mono text-emerald-300">{page.path}</code>)
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Nội dung cấu hình */}
                <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1">
                    {/* 1. Switch Bật / Tắt chức năng Xuất Excel */}
                    <div className={`p-4 rounded-2xl border transition-all ${
                        allowExcel
                            ? 'bg-emerald-50/70 border-emerald-300 shadow-2xs'
                            : 'bg-slate-50 border-slate-200'
                    }`}>
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                                    allowExcel ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
                                }`}>
                                    {allowExcel ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                                </div>
                                <div>
                                    <div className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-2">
                                        <span>Trạng Thái Tính Năng Xuất Excel</span>
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                            allowExcel
                                                ? 'bg-emerald-600 text-white shadow-2xs'
                                                : 'bg-slate-200 text-slate-600'
                                        }`}>
                                            {allowExcel ? '✓ ĐANG BẬT' : '🔒 ĐANG KHÓA'}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                                        {allowExcel
                                            ? 'Nút xuất Excel sẽ hiển thị cho các vai trò được cấp phép bên dưới.'
                                            : 'Nút xuất Excel bị khóa và ẩn hoàn toàn đối với mọi người dùng.'}
                                    </p>
                                </div>
                            </div>

                            {/* Nút Toggle Switch */}
                            <button
                                type="button"
                                onClick={() => setAllowExcel(!allowExcel)}
                                className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer p-0.5 shrink-0 ${
                                    allowExcel ? 'bg-emerald-600' : 'bg-slate-300'
                                }`}
                                title={allowExcel ? 'Nhấn để khóa chức năng xuất Excel' : 'Nhấn để mở chức năng xuất Excel'}
                            >
                                <div className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform transform ${
                                    allowExcel ? 'translate-x-6' : 'translate-x-0'
                                }`} />
                            </button>
                        </div>
                    </div>

                    {/* 2. Cấu hình các vai trò được phép xuất Excel */}
                    {allowExcel && (
                        <div className="space-y-3 animate-in fade-in duration-200">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                    <Shield className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Vai trò được phép tải dữ liệu Excel</span>
                                </div>
                                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                                    Đã chọn: {selectedRoles.length} vai trò
                                </span>
                            </div>

                            {/* Các nút preset chọn nhanh */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[11px] font-bold text-slate-400 mr-1">Mẫu nhanh:</span>
                                <button
                                    type="button"
                                    onClick={() => handleApplyPreset(['ADMIN'])}
                                    className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition cursor-pointer border ${
                                        selectedRoles.length === 1 && selectedRoles.includes('ADMIN')
                                            ? 'bg-amber-100 text-amber-900 border-amber-300 font-black'
                                            : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                                    }`}
                                >
                                    👑 Chỉ Admin (Mặc định)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleApplyPreset(['ADMIN', 'QUAN_LY'])}
                                    className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition cursor-pointer border ${
                                        selectedRoles.length === 2 && selectedRoles.includes('ADMIN') && selectedRoles.includes('QUAN_LY')
                                            ? 'bg-indigo-100 text-indigo-900 border-indigo-300 font-black'
                                            : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                                    }`}
                                >
                                    👔 Admin + Quản Lý
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleApplyPreset(['ADMIN', 'QUAN_LY', 'TRUONG_CA'])}
                                    className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition cursor-pointer border ${
                                        selectedRoles.length === 3 && selectedRoles.includes('ADMIN') && selectedRoles.includes('QUAN_LY') && selectedRoles.includes('TRUONG_CA')
                                            ? 'bg-blue-100 text-blue-900 border-blue-300 font-black'
                                            : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                                    }`}
                                >
                                    ⭐ Cả Quản Lý & Trưởng Ca
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleApplyPreset(['ADMIN', 'QUAN_LY', 'TRUONG_CA', 'NHAN_VIEN'])}
                                    className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition cursor-pointer border ${
                                        selectedRoles.length === 4
                                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300 font-black'
                                            : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
                                    }`}
                                >
                                    👥 Mọi Vai Trò
                                </button>
                            </div>

                            {/* Danh sách 4 vai trò */}
                            <div className="space-y-2 pt-1">
                                {ROLES_LIST.map((rItem) => {
                                    const isSelected = selectedRoles.includes(rItem.role);
                                    const isLockedAdmin = rItem.role === 'ADMIN';
                                    const IconComponent = rItem.icon;

                                    return (
                                        <div
                                            key={rItem.role}
                                            onClick={() => handleToggleRole(rItem.role)}
                                            className={`p-3 rounded-2xl border transition flex items-center justify-between gap-3 ${
                                                isLockedAdmin
                                                    ? 'bg-amber-50/40 border-amber-200 cursor-not-allowed opacity-90'
                                                    : isSelected
                                                    ? `${rItem.bgColor} ${rItem.borderColor} cursor-pointer shadow-2xs`
                                                    : 'bg-white hover:bg-slate-50 border-slate-200 cursor-pointer'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                                                    isSelected ? `${rItem.bgColor} ${rItem.color} border ${rItem.borderColor}` : 'bg-slate-100 text-slate-400'
                                                }`}>
                                                    <IconComponent className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <div className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                                                        <span>{rItem.title}</span>
                                                        {isLockedAdmin && (
                                                            <span className="text-[9px] font-black bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded">
                                                                Mặc định có quyền
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 mt-0.5">
                                                        {rItem.description}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className={`w-5 h-5 rounded-lg flex items-center justify-center border transition shrink-0 ${
                                                isSelected
                                                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs'
                                                    : 'border-slate-300 bg-white'
                                            }`}>
                                                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Ghi chú bảo mật Rule 9 */}
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[11px] text-slate-600 flex items-start gap-2">
                                <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                <p className="leading-relaxed">
                                    Quy định <strong>Rule #9</strong>: Nút Xuất Excel chỉ hiển thị khi trang được mở khóa và tài khoản của người dùng nằm trong danh sách vai trò được tích chọn ở đây.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 transition cursor-pointer"
                    >
                        Hủy
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className="px-5 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white transition cursor-pointer shadow-sm flex items-center gap-1.5"
                    >
                        <Sparkles className="w-4 h-4 text-emerald-200" />
                        <span>Áp Dụng Phân Quyền</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
