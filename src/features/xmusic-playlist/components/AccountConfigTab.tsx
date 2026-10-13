import React, { useState, useEffect } from 'react';
import {
    KeyRound,
    User,
    Lock,
    Save,
    Check,
    RotateCcw,
    ExternalLink,
    HelpCircle,
    Info,
    ShieldCheck
} from 'lucide-react';
import type { XMusicAuthConfig } from '../types';

interface AccountConfigTabProps {
    onShowToast: (msg: string) => void;
}

const DEFAULT_AUTH: XMusicAuthConfig = {
    username: 'tgd111',
    password: 'mwg2025',
    autoLogin: true
};

const STORAGE_KEY = 'xmusic_auth_config';

export default function AccountConfigTab({ onShowToast }: AccountConfigTabProps) {
    const [auth, setAuth] = useState<XMusicAuthConfig>(DEFAULT_AUTH);
    const [hasSaved, setHasSaved] = useState<boolean>(false);

    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                setAuth(Object.assign({}, DEFAULT_AUTH, JSON.parse(saved)));
            }
        } catch {
            // ignore
        }
    }, []);

    const handleSave = () => {
        if (!auth.username.trim() || !auth.password.trim()) {
            onShowToast('Vui lòng nhập đầy đủ tên tài khoản và mật khẩu!');
            return;
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
        setHasSaved(true);
        onShowToast('Đã lưu cấu hình tài khoản XMusicStation!');
        setTimeout(() => setHasSaved(false), 2500);
    };

    const handleReset = () => {
        setAuth(DEFAULT_AUTH);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_AUTH));
        onShowToast('Đã đặt lại về tài khoản mặc định MWG (tgd111)');
    };

    return (
        <div className="space-y-4 sm:space-y-6 max-w-3xl">
            {/* Account Settings Card */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-6">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0">
                        <KeyRound className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-sm sm:text-base font-black text-slate-900">
                            Cấu Hình Tài Khoản XMusicStation
                        </h2>
                        <p className="text-xs text-slate-500">
                            Userscript sẽ đọc thông tin cấu hình này để tự động đăng nhập khi mở trang phát nhạc
                        </p>
                    </div>
                </div>

                <div className="mt-5 space-y-4">
                    {/* Username */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                            Tài khoản đăng nhập (Username)
                        </label>
                        <div className="relative">
                            <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={auth.username}
                                onChange={(e) => setAuth({ ...auth, username: e.target.value })}
                                placeholder="Ví dụ: tgd111"
                                className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-indigo-400 text-slate-800 font-semibold"
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                            Mật khẩu (Password)
                        </label>
                        <div className="relative">
                            <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="password"
                                value={auth.password}
                                onChange={(e) => setAuth({ ...auth, password: e.target.value })}
                                placeholder="Ví dụ: mwg2025"
                                className="w-full pl-9 pr-3 py-2.5 text-xs sm:text-sm rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-indigo-400 text-slate-800 font-semibold"
                            />
                        </div>
                    </div>

                    {/* Auto Login Checkbox */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-indigo-600" />
                            <div>
                                <span className="text-xs font-bold text-slate-800">Tự Động Đăng Nhập (Auto Login)</span>
                                <p className="text-[11px] text-slate-500">Tự động nạp token và chuyển sang trang nghe nhạc khi vào trang login</p>
                            </div>
                        </div>
                        <input
                            type="checkbox"
                            checked={auth.autoLogin}
                            onChange={(e) => setAuth({ ...auth, autoLogin: e.target.checked })}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                    </div>

                    {/* Action buttons */}
                    <div className="pt-2 flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={handleSave}
                            className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${
                                hasSaved
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                            }`}
                        >
                            {hasSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                            <span>{hasSaved ? 'Đã Lưu Cấu Hình' : 'Lưu Cấu Hình'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleReset}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition cursor-pointer"
                        >
                            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                            <span>Đặt Lại Mặc Định</span>
                        </button>

                        <a
                            href="https://player.xmusicstation.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-auto inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold text-indigo-600 hover:bg-indigo-50 transition"
                        >
                            <span>Mở player.xmusicstation.com</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                    </div>
                </div>
            </div>

            {/* Note & FAQ */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-4 space-y-2 text-xs text-slate-600 leading-relaxed">
                <div className="flex items-center gap-2 font-bold text-slate-800">
                    <Info className="w-4 h-4 text-indigo-500" />
                    <span>Lưu ý quan trọng về tài khoản XMusicStation</span>
                </div>
                <p>
                    • Tài khoản chuẩn dùng cho các siêu thị trong chuỗi là <code className="font-bold text-slate-800">tgd111</code> với mật khẩu <code className="font-bold text-slate-800">mwg2025</code>.
                </p>
                <p>
                    • Nếu siêu thị của bạn được cấp tài khoản riêng, bạn có thể nhập vào ô trên rồi nhấn <strong>"Lưu Cấu Hình"</strong> hoặc thay đổi trực tiếp trong Sidebar khi mở trang phát nhạc.
                </p>
                <p>
                    • Nếu bị đăng xuất bất ngờ, hãy bấm vào nút <strong>"Đăng Nhập Lại"</strong> ở tab Cấu Hình trong Sidebar để khôi phục phiên làm việc ngay lập tức mà không cần tải lại trang.
                </p>
            </div>
        </div>
    );
}
