import { ShieldAlert, KeyRound, Lock } from 'lucide-react';
import { useAuth } from '../../../shared/contexts/AuthContext';

interface Props {
    onOpenRoleModal: () => void;
}

export default function PermissionDeniedBanner({ onOpenRoleModal }: Props) {
    const { currentUser } = useAuth();

    return (
        <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-rose-500/10 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Lock className="w-5 h-5" />
                </div>
                <div>
                    <div className="flex items-center gap-2">
                        <span className="font-extrabold text-amber-900 text-sm">
                            Chế độ Chỉ Xem (Giới Hạn Quyền)
                        </span>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-200 text-amber-900">
                            {currentUser.role_title}
                        </span>
                    </div>
                    <p className="text-xs text-amber-800/90 mt-0.5">
                        Chỉ <span className="font-bold underline">Quản lý</span> hoặc <span className="font-bold underline">Trưởng Ca</span> mới có quyền thêm, sửa, xóa siêu thị và nhân sự.
                    </p>
                </div>
            </div>

            <button
                type="button"
                onClick={onOpenRoleModal}
                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
            >
                <KeyRound className="w-4 h-4" />
                <span>Mở Khóa Quyền Quản Lý</span>
            </button>
        </div>
    );
}
