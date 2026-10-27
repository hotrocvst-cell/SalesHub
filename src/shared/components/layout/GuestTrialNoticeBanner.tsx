import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { calculateRemainingDays } from '../../../features/admin-config/services/guestTrialService';
import { Sparkles, Clock, AlertTriangle, PhoneCall, ChevronRight, X, ShieldCheck } from 'lucide-react';

export default function GuestTrialNoticeBanner() {
    const { currentUser } = useAuth();
    const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);

    // Chỉ hiển thị đối với tài khoản trải nghiệm (is_guest)
    if (!currentUser?.is_guest || isDismissed) {
        return null;
    }

    const remaining = calculateRemainingDays(currentUser.guest_expires_at);

    return (
        <>
            <div
                data-html2canvas-ignore="true"
                data-export-ignore="true"
                className={`w-full text-white px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 shadow-sm transition-all text-xs font-medium z-30 ${
                    remaining.isExpired
                        ? 'bg-gradient-to-r from-rose-600 via-red-600 to-rose-700'
                        : remaining.days <= 2
                        ? 'bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600'
                        : 'bg-gradient-to-r from-indigo-700 via-blue-600 to-indigo-800'
                }`}
            >
                {/* Left Side Info */}
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-xs text-[10.5px] font-black uppercase tracking-wider text-amber-200 border border-white/25">
                        <Sparkles className="w-3 h-3 text-amber-300 animate-pulse" />
                        Tài Khoản Trải Nghiệm
                    </span>

                    <div className="flex items-center gap-1.5 font-semibold text-white/95">
                        {remaining.isExpired ? (
                            <span className="flex items-center gap-1 text-white font-black bg-rose-900/60 px-2 py-0.5 rounded-md">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-300" />
                                Hạn trải nghiệm đã kết thúc ({remaining.formattedDate})
                            </span>
                        ) : (
                            <span className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-amber-300" />
                                <span>Thời hạn còn lại:</span>
                                <b className="text-amber-200 underline font-black">{remaining.label}</b>
                                <span className="text-white/80 text-[11px] hidden md:inline">
                                    (Hết hạn vào {remaining.formattedDate})
                                </span>
                            </span>
                        )}
                    </div>
                </div>

                {/* Right Side Actions */}
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setIsUpgradeModalOpen(true)}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[11px] transition shadow-xs hover:scale-102 cursor-pointer"
                    >
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-900" />
                        <span>Nâng Cấp Gói Premium</span>
                        <ChevronRight className="w-3 h-3" />
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsDismissed(true)}
                        className="p-1 text-white/60 hover:text-white rounded-md hover:bg-white/10 transition cursor-pointer"
                        title="Tạm ẩn thanh thông báo"
                        aria-label="Tắt thông báo"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Modal Giới thiệu & Đăng ký gói Premium */}
            {isUpgradeModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 p-6 text-white text-center relative">
                            <button
                                type="button"
                                onClick={() => setIsUpgradeModalOpen(false)}
                                className="absolute top-4 right-4 text-white/80 hover:text-white p-1 rounded-full hover:bg-white/15 transition cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md mb-2 shadow-inner ring-2 ring-white/30">
                                <Sparkles className="w-6 h-6 text-amber-300" />
                            </div>
                            <h3 className="text-xl font-black">NÂNG CẤP GÓI SALES HUB PREMIUM</h3>
                            <p className="text-xs text-blue-100 mt-1">
                                Mở khóa trọn bộ tính năng điều hành &amp; quản trị kinh doanh không giới hạn
                            </p>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-4">
                            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2 text-xs">
                                <div className="font-bold text-slate-800 flex items-center gap-1.5 text-sm">
                                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                    Đặc quyền khi tham gia gói Premium:
                                </div>
                                <ul className="space-y-1.5 text-slate-600 pl-5 list-disc">
                                    <li>Thời gian sử dụng <b>không giới hạn</b> cho toàn bộ nhân sự siêu thị.</li>
                                    <li>Báo cáo doanh thu &amp; sản lượng <b>Realtime 100%</b> tự động.</li>
                                    <li>Tự động xếp hạng hiệu quả, vinh danh Top 30% và nhắc nhở tăng tốc.</li>
                                    <li>Hỗ trợ kỹ thuật 24/7 &amp; đồng bộ dữ liệu thời gian thực trên Supabase Cloud.</li>
                                </ul>
                            </div>

                            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
                                <div className="font-bold flex items-center gap-1.5">
                                    <Clock className="w-4 h-4 text-amber-700" />
                                    Tình trạng tài khoản hiện tại:
                                </div>
                                <p className="text-[11.5px] leading-relaxed">
                                    Tài khoản: <b>{currentUser.email}</b>
                                    <br />
                                    Trạng thái: <span className="font-bold text-amber-800">{remaining.label}</span> (Hạn dùng: {remaining.formattedDate})
                                </p>
                            </div>

                            <div className="text-center pt-2">
                                <p className="text-xs text-slate-500 mb-3">
                                    Liên hệ trực tiếp Quản trị viên (Admin) để kích hoạt tài khoản chính thức:
                                </p>
                                <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-50 text-blue-800 font-black text-sm border border-blue-200">
                                    <PhoneCall className="w-4 h-4 text-blue-600" />
                                    <span>Hotline / Zalo Admin: 0988.xxx.xxx</span>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setIsUpgradeModalOpen(false)}
                                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition cursor-pointer"
                            >
                                Đã hiểu
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
