import { useState } from 'react';
import { X, Sparkles, Copy, Check, MessageSquare, ExternalLink } from 'lucide-react';
import type { UserProfile } from '../../../../core/lib/authService';
import { generateTrialShareMessage, calculateRemainingDays } from '../../services/guestTrialService';

interface Props {
    user: UserProfile | null;
    onClose: () => void;
}

export default function GuestShareModal({ user, onClose }: Props) {
    const [isCopied, setIsCopied] = useState(false);

    if (!user) return null;

    const shareText = generateTrialShareMessage(user);
    const remaining = calculateRemainingDays(user.guest_expires_at);

    const handleCopy = () => {
        navigator.clipboard.writeText(shareText);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2500);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-2xs animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 p-5 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
                            <Sparkles className="w-5 h-5 text-amber-300" />
                        </div>
                        <div>
                            <h3 className="text-base font-black">MẪU TIN NHẮN QUẢNG CÁO GỬI KHÁCH</h3>
                            <p className="text-[11px] text-blue-100">
                                Định dạng chuẩn gửi qua Zalo / Facebook Messenger
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 space-y-4 text-xs">
                    <div className="flex items-center justify-between text-slate-500">
                        <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-700">Khách nhận:</span>
                            <span className="font-semibold text-blue-600">{user.full_name}</span>
                            <span className="text-slate-400">({user.email})</span>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10.5px]">
                            {remaining.label}
                        </span>
                    </div>

                    {/* Text Box Preview */}
                    <div className="relative">
                        <textarea
                            readOnly
                            rows={12}
                            value={shareText}
                            className="w-full p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 font-sans text-xs leading-relaxed focus:outline-hidden resize-none select-all shadow-inner"
                        />
                        <button
                            type="button"
                            onClick={handleCopy}
                            className="absolute top-2.5 right-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-blue-700 font-black text-xs border border-slate-200 shadow-xs transition cursor-pointer"
                        >
                            {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-blue-600" />}
                            <span>{isCopied ? 'Đã sao chép!' : 'Sao chép tin nhắn'}</span>
                        </button>
                    </div>

                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-[11px] flex items-start gap-2">
                        <MessageSquare className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <b>Mẹo gửi tin nhắn:</b> Quý Admin bấm nút <b>"Sao chép tin nhắn"</b> rồi mở Zalo hoặc ứng dụng nhắn tin và dán (Ctrl+V) gửi cho khách hàng. Tin nhắn đã bao gồm đầy đủ link đăng nhập, mật khẩu và thời hạn sử dụng.
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                        <a
                            href={`${window.location.origin}/dang-nhap`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-blue-600 font-medium"
                        >
                            <span>Xem trang đăng nhập</span>
                            <ExternalLink className="w-3 h-3" />
                        </a>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold transition cursor-pointer"
                            >
                                Đóng
                            </button>
                            <button
                                type="button"
                                onClick={handleCopy}
                                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-xs cursor-pointer"
                            >
                                {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                <span>{isCopied ? 'Đã sao chép!' : 'Sao Chép Ngay'}</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
