import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AccountStatusLookupModal from './components/AccountStatusLookupModal';
import { Store, Search, ArrowLeft, ArrowRight, ShieldCheck, UserCheck, Clock } from 'lucide-react';

export default function AccountLookupPage() {
    const navigate = useNavigate();
    const [isModalOpen, setIsModalOpen] = useState(true);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute top-1/4 -right-20 w-80 h-80 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

            <div className="w-full max-w-md relative z-10 space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-xl shadow-blue-500/25 ring-4 ring-white/10">
                    <Store className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                    <h1 className="text-2xl font-black text-white tracking-tight">
                        SALES<span className="text-blue-400">HUB</span>
                    </h1>
                    <p className="text-xs text-slate-300 font-medium">
                        Cổng tra cứu tiến trình xét duyệt hồ sơ tài khoản
                    </p>
                </div>

                <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl border border-white/20 space-y-4 text-left">
                    <div className="space-y-2">
                        <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
                            <Search className="w-4 h-4 text-blue-600" />
                            <span>Kiểm tra trạng thái tài khoản</span>
                        </h2>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            Nhập địa chỉ Email, Mã nhân viên (ví dụ: 260732) hoặc Số điện thoại để kiểm tra xem tài khoản của bạn đang ở trạng thái nào (Đang chờ duyệt, Bị từ chối hoặc Đã kích hoạt).
                        </p>
                    </div>

                    <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100 text-xs text-blue-800 space-y-1.5">
                        <div className="font-bold flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-blue-600" />
                            <span>Quyền lợi &amp; Hỗ trợ:</span>
                        </div>
                        <ul className="list-disc pl-4 space-y-1 text-[11px] text-blue-700">
                            <li>Xem thông tin đơn vị và cấp phê duyệt của bạn</li>
                            <li>Xem lý do từ chối cụ thể nếu hồ sơ chưa đạt</li>
                            <li>Dễ dàng sửa lại thông tin cá nhân/siêu thị và gửi duyệt lại</li>
                        </ul>
                    </div>

                    <button
                        type="button"
                        onClick={() => setIsModalOpen(true)}
                        className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-500/25 transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                        <Search className="w-4 h-4" />
                        <span>Mở Cửa Sổ Tra Cứu Ngay</span>
                    </button>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                        <Link
                            to="/dang-nhap"
                            className="font-bold text-slate-600 hover:text-blue-600 flex items-center gap-1"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span>Đăng nhập</span>
                        </Link>
                        <Link
                            to="/dang-ky"
                            className="font-black text-blue-600 hover:text-blue-700 flex items-center gap-1"
                        >
                            <span>Đăng ký mới</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                </div>
            </div>

            {/* Modal Tra cứu */}
            <AccountStatusLookupModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onLoginRedirect={() => navigate('/dang-nhap')}
            />
        </div>
    );
}
