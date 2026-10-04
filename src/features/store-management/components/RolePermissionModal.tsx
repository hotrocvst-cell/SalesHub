import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, type UserRole } from '../../../shared/contexts/AuthContext';
import ApprovalModal from '../../auth/components/ApprovalModal';
import { ShieldCheck, ShieldAlert, KeyRound, Check, X, Users } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export default function RolePermissionModal({ isOpen, onClose, onSuccess }: Props) {
    const navigate = useNavigate();
    const { currentUser, switchRole, verifyPasscode, logout, isActualAdmin } = useAuth();
    const [pin, setPin] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [isApprovalOpen, setIsApprovalOpen] = useState(false);

    if (!isOpen || !isActualAdmin) return null;

    const handleVerifyPin = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        const ok = verifyPasscode(pin);
        if (ok) {
            setPin('');
            onSuccess?.();
            onClose();
        } else {
            setErrorMsg('Mã xác thực không đúng! Vui lòng thử lại (Gợi ý: 6868 hoặc 1234 cho Quản lý, 5678 cho Trưởng ca).');
        }
    };

    const handleQuickSelect = (role: UserRole) => {
        switchRole(role);
        onSuccess?.();
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 p-5 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
                            <ShieldCheck className="w-5 h-5 text-amber-300" />
                        </div>
                        <div>
                            <h3 className="font-extrabold text-base leading-tight">Phân Quyền Hệ Thống</h3>
                            <p className="text-xs text-blue-200">Chuyển đổi vai trò & Mở khóa quyền cấu hình</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    {/* Thông tin vai trò hiện tại & Siêu thị */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Vai trò hiện tại</span>
                                <span className="text-sm font-extrabold text-slate-800">{currentUser.role_title}</span>
                                <span className="text-xs text-slate-500 block">({currentUser.full_name} - {currentUser.employee_id || currentUser.email})</span>
                            </div>
                            <span className={`text-xs px-2.5 py-1 rounded-full font-black uppercase ${
                                currentUser.role === 'ADMIN'
                                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                    : currentUser.role === 'QUAN_LY'
                                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                    : currentUser.role === 'TRUONG_CA'
                                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                    : 'bg-slate-200 text-slate-700'
                            }`}>
                                {currentUser.role}
                            </span>
                        </div>

                        {currentUser.store_name && (
                            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                                <span className="text-slate-500 font-medium">Siêu thị làm việc:</span>
                                <span className="font-extrabold text-blue-700 truncate max-w-[200px]">{currentUser.store_name}</span>
                            </div>
                        )}
                    </div>

                    {/* Chọn nhanh vai trò để kiểm thử & làm việc */}
                    <div>
                        <label className="text-xs font-bold text-slate-700 block mb-2">
                            ⚡ Chọn nhanh vai trò làm việc:
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <button
                                type="button"
                                onClick={() => handleQuickSelect('ADMIN')}
                                className={`p-2 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                                    currentUser.role === 'ADMIN'
                                        ? 'bg-rose-50 border-rose-500 text-rose-900 ring-2 ring-rose-400/30'
                                        : 'bg-white border-slate-200 hover:border-rose-400 text-slate-700'
                                }`}
                            >
                                <span className="text-base">🛡️</span>
                                <span>Admin</span>
                                <span className="text-[9px] font-normal text-rose-700">Tối cao</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleQuickSelect('QUAN_LY')}
                                className={`p-2 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                                    currentUser.role === 'QUAN_LY'
                                        ? 'bg-amber-50 border-amber-500 text-amber-900 ring-2 ring-amber-400/30'
                                        : 'bg-white border-slate-200 hover:border-amber-400 text-slate-700'
                                }`}
                            >
                                <span className="text-base">👑</span>
                                <span>Quản Lý</span>
                                <span className="text-[9px] font-normal text-amber-700">Toàn quyền</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleQuickSelect('TRUONG_CA')}
                                className={`p-2 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                                    currentUser.role === 'TRUONG_CA'
                                        ? 'bg-blue-50 border-blue-500 text-blue-900 ring-2 ring-blue-400/30'
                                        : 'bg-white border-slate-200 hover:border-blue-400 text-slate-700'
                                }`}
                            >
                                <span className="text-base">⭐</span>
                                <span>Trưởng Ca</span>
                                <span className="text-[9px] font-normal text-blue-700">QL Ca</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleQuickSelect('NHAN_VIEN')}
                                className={`p-2 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition cursor-pointer ${
                                    currentUser.role === 'NHAN_VIEN'
                                        ? 'bg-slate-100 border-slate-500 text-slate-900 ring-2 ring-slate-400/30'
                                        : 'bg-white border-slate-200 hover:border-slate-400 text-slate-700'
                                }`}
                            >
                                <span className="text-base">👤</span>
                                <span>Nhân Viên</span>
                                <span className="text-[9px] font-normal text-slate-500">Chỉ xem</span>
                            </button>
                        </div>
                    </div>

                    <div className="relative flex py-1 items-center">
                        <div className="flex-grow border-t border-slate-200"></div>
                        <span className="flex-shrink mx-2 text-[10px] font-black uppercase text-slate-400 tracking-wider">hoặc nhập mã bảo vệ</span>
                        <div className="flex-grow border-t border-slate-200"></div>
                    </div>

                    {/* Xác thực bằng mã PIN bảo vệ */}
                    <form onSubmit={handleVerifyPin} className="space-y-3">
                        <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">
                                Nhập mã PIN Admin / Quản lý / Trưởng ca
                            </label>
                            <div className="relative">
                                <KeyRound className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                                <input
                                    type="password"
                                    placeholder="Nhập mã PIN (vd: 6868)"
                                    value={pin}
                                    onChange={e => setPin(e.target.value)}
                                    maxLength={10}
                                    className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono tracking-widest text-slate-900"
                                />
                            </div>
                        </div>

                        {errorMsg && (
                            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700">
                                <ShieldAlert className="w-4 h-4 shrink-0" />
                                <span>{errorMsg}</span>
                            </div>
                        )}

                        <div className="flex gap-2 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                            >
                                Đóng
                            </button>
                            <button
                                type="submit"
                                className="flex-1 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                            >
                                <Check className="w-4 h-4" />
                                <span>Xác Thực Mở Khóa</span>
                            </button>
                        </div>
                    </form>

                    {/* Đăng xuất & Quản lý xét duyệt & Quản lý User */}
                    <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                onClose();
                                logout();
                            }}
                            className="text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline transition cursor-pointer"
                        >
                            Đăng xuất
                        </button>

                        <div className="flex items-center gap-3">
                            {currentUser.role === 'ADMIN' && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        onClose();
                                        navigate('/quan-ly-tai-khoan');
                                    }}
                                    className="text-xs font-bold text-slate-700 hover:text-blue-600 transition flex items-center gap-1 cursor-pointer"
                                >
                                    <Users className="w-3.5 h-3.5 text-blue-600" />
                                    <span>Quản lý User</span>
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => {
                                    onClose();
                                    setIsApprovalOpen(true);
                                }}
                                className="text-xs font-bold text-blue-600 hover:text-blue-700 transition cursor-pointer"
                            >
                                Xét duyệt &rarr;
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal Xét duyệt */}
            <ApprovalModal
                isOpen={isApprovalOpen}
                onClose={() => setIsApprovalOpen(false)}
            />
        </div>
    );
}
