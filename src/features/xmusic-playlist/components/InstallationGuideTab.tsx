import React from 'react';
import {
    ExternalLink,
    Copy,
    Download,
    Check,
    Sparkles,
    CheckCircle2,
    Compass,
    Sliders,
    Lightbulb
} from 'lucide-react';
import type { BrowserDownloadLink } from '../types';

interface InstallationGuideTabProps {
    onCopyCode: () => void;
    onDownloadCode: () => void;
    hasCopied: boolean;
    onViewCodeTab: () => void;
}

export default function InstallationGuideTab({
    onCopyCode,
    onDownloadCode,
    hasCopied,
    onViewCodeTab
}: InstallationGuideTabProps) {
    const browsers: BrowserDownloadLink[] = [
        {
            name: 'Google Chrome',
            store: 'Chrome Web Store',
            icon: '🌐',
            url: 'https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo',
            badgeColor: 'bg-blue-50 text-blue-700 border-blue-200'
        },
        {
            name: 'Microsoft Edge',
            store: 'Edge Add-ons Store',
            icon: '🌊',
            url: 'https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd',
            badgeColor: 'bg-sky-50 text-sky-700 border-sky-200'
        },
        {
            name: 'Cốc Cốc',
            store: 'Cài từ Chrome Store',
            icon: '🟢',
            url: 'https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo',
            badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200'
        },
        {
            name: 'Mozilla Firefox',
            store: 'Firefox Add-ons',
            icon: '🦊',
            url: 'https://addons.mozilla.org/firefox/addon/tampermonkey/',
            badgeColor: 'bg-orange-50 text-orange-700 border-orange-200'
        }
    ];

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* Callout Feature Highlight Banner */}
            <div className="bg-gradient-to-r from-indigo-50/90 via-purple-50/70 to-pink-50/50 border border-indigo-100 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-xs">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-indigo-200 mt-0.5">
                        <Sparkles className="w-5 h-5 text-indigo-100" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-black text-indigo-950 uppercase tracking-wide">
                                Tính năng cải tiến nổi bật trong bản Userscript v1.2.0
                            </h3>
                            <span className="text-[10px] font-bold bg-indigo-200/70 text-indigo-800 px-2 py-0.5 rounded-full">
                                Siêu thị tối ưu
                            </span>
                        </div>
                        <ul className="text-xs text-slate-700 mt-2 space-y-1.5 leading-relaxed font-medium">
                            <li className="flex items-start gap-1.5">
                                <span className="text-indigo-600 font-bold">✓</span>
                                <span><strong>Sidebar Menu góc trái (480px)</strong>: Giao diện rộng rãi, dễ dàng xem trước và chọn danh sách phát mà không che khuất trình phát chính.</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                                <span className="text-indigo-600 font-bold">✓</span>
                                <span><strong>Tự động đăng nhập ngầm</strong>: Tự động nạp tài khoản <code className="bg-white px-1 py-0.5 rounded border border-indigo-200 font-bold text-indigo-700">tgd111</code> / <code className="bg-white px-1 py-0.5 rounded border border-indigo-200 font-bold text-indigo-700">mwg2025</code> khi truy cập web.</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                                <span className="text-indigo-600 font-bold">✓</span>
                                <span><strong>Tự động nạp hàng đợi phát</strong>: Tool tự tìm kiếm tên từng bài và chọn chuẩn xác nút Thêm (+) bài số 1 vào queue của XMusicStation.</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* BƯỚC 1: Cài đặt Tampermonkey */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-6">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                    <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm shadow-xs">
                        1
                    </div>
                    <div>
                        <h2 className="text-sm sm:text-base font-black text-slate-900">
                            Cài đặt tiện ích mở rộng Tampermonkey
                        </h2>
                        <p className="text-xs text-slate-500">
                            Tiện ích quản lý Userscript an toàn, tương thích mọi trình duyệt hiện đại
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
                    {browsers.map(b => (
                        <a
                            key={b.name}
                            href={b.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group p-3.5 rounded-2xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition shadow-2xs hover:shadow-xs flex items-center gap-3"
                        >
                            <span className="text-2xl group-hover:scale-110 transition shrink-0">{b.icon}</span>
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 truncate flex items-center gap-1">
                                    <span>{b.name}</span>
                                    <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition" />
                                </div>
                                <div className="text-[11px] text-slate-500 truncate">{b.store}</div>
                            </div>
                        </a>
                    ))}
                </div>
            </div>

            {/* BƯỚC 2: Tạo Userscript mới */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-6">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                    <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black text-sm shadow-xs">
                        2
                    </div>
                    <div>
                        <h2 className="text-sm sm:text-base font-black text-slate-900">
                            Tạo Userscript mới trong Tampermonkey
                        </h2>
                        <p className="text-xs text-slate-500">
                            Khởi tạo một script mới để dán mã tự động hóa vào trình duyệt
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-4">
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                        <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 font-extrabold text-xs flex items-center justify-center">1</span>
                            <span className="text-xs font-bold text-slate-900">Mở Tampermonkey</span>
                        </div>
                        <p className="text-[12px] text-slate-600 leading-relaxed">
                            Bấm vào biểu tượng tiện ích mảnh ghép (hoặc icon Tampermonkey) ở góc trên bên phải thanh công cụ trình duyệt.
                        </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                        <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 font-extrabold text-xs flex items-center justify-center">2</span>
                            <span className="text-xs font-bold text-slate-900">Tạo script mới</span>
                        </div>
                        <p className="text-[12px] text-slate-600 leading-relaxed">
                            Trong menu thả xuống, nhấn vào dòng <strong>"Tạo script mới..."</strong> (hoặc <em>Create a new script...</em>) để mở tab code.
                        </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                        <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-pink-100 text-pink-700 font-extrabold text-xs flex items-center justify-center">3</span>
                            <span className="text-xs font-bold text-slate-900">Dán mã & Lưu</span>
                        </div>
                        <p className="text-[12px] text-slate-600 leading-relaxed">
                            Xóa toàn bộ nội dung mẫu ban đầu trong ô soạn thảo, sao chép mã ở <strong>Bước 3</strong> dán vào rồi nhấn <kbd className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-300 text-[11px] font-bold text-slate-800">Ctrl</kbd> + <kbd className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-300 text-[11px] font-bold text-slate-800">S</kbd> để lưu.
                        </p>
                    </div>
                </div>
            </div>

            {/* BƯỚC 3: Lấy mã nguồn Userscript */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-pink-600 text-white flex items-center justify-center font-black text-sm shadow-xs">
                            3
                        </div>
                        <div>
                            <h2 className="text-sm sm:text-base font-black text-slate-900">
                                Lấy Mã Nguồn Userscript (v1.2.0)
                            </h2>
                            <p className="text-xs text-slate-500">
                                Sao chép 1 chạm vào bộ nhớ tạm hoặc tải trực tiếp file <code className="font-mono font-bold text-slate-700">.user.js</code>
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onCopyCode}
                            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${
                                hasCopied
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                            }`}
                        >
                            {hasCopied ? (
                                <>
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Đã Sao Chép!</span>
                                </>
                            ) : (
                                <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>Sao Chép Toàn Bộ Mã</span>
                                </>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={onDownloadCode}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition shadow-2xs cursor-pointer"
                        >
                            <Download className="w-3.5 h-3.5 text-slate-500" />
                            <span>Tải File .user.js</span>
                        </button>

                        <button
                            type="button"
                            onClick={onViewCodeTab}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                        >
                            <span>Xem Code Đầy Đủ</span>
                        </button>
                    </div>
                </div>

                <div className="mt-4 p-3.5 rounded-2xl bg-slate-950 text-slate-300 font-mono text-xs overflow-x-auto shadow-inner border border-slate-800">
                    <div className="text-slate-500 select-none">// ==UserScript==</div>
                    <div className="text-slate-400">// @name         XMusicStation - Tự Động Đăng Nhập &amp; Tạo Playlist Phát Nhạc (Left Sidebar)</div>
                    <div className="text-slate-400">// @version      1.2.0</div>
                    <div className="text-slate-400">// @match        https://player.xmusicstation.com/*</div>
                    <div className="text-slate-500">// ==/UserScript==</div>
                    <div className="text-indigo-400 mt-2">// Nhấn nút "Sao Chép Toàn Bộ Mã" ở trên để copy hơn 1000 dòng mã tự động hóa!</div>
                </div>
            </div>

            {/* BƯỚC 4: Mở và sử dụng */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-6">
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                    <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-sm shadow-xs">
                        4
                    </div>
                    <div>
                        <h2 className="text-sm sm:text-base font-black text-slate-900">
                            Mở và trải nghiệm trên XMusicStation
                        </h2>
                        <p className="text-xs text-slate-500">
                            Tận hưởng âm nhạc siêu thị tự động hoàn toàn chỉ với một cú nhấp chuột
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-4">
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                        <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 font-extrabold text-xs flex items-center justify-center">1</span>
                            <span className="text-xs font-bold text-slate-900">Vào trang phát nhạc</span>
                        </div>
                        <p className="text-[12px] text-slate-600 leading-relaxed">
                            Truy cập <a href="https://player.xmusicstation.com/" target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-bold hover:underline">player.xmusicstation.com</a>. Userscript sẽ tự động đăng nhập ngầm tài khoản MWG.
                        </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                        <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 font-extrabold text-xs flex items-center justify-center">2</span>
                            <span className="text-xs font-bold text-slate-900">Bấm nút trợ lý góc trái</span>
                        </div>
                        <p className="text-[12px] text-slate-600 leading-relaxed">
                            Ở góc trên bên trái màn hình, bạn sẽ thấy nút nổi gradient <strong className="text-indigo-600">🎵 Danh Sách Phát</strong>. Bấm vào để mở Sidebar điều khiển.
                        </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                        <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 font-extrabold text-xs flex items-center justify-center">3</span>
                            <span className="text-xs font-bold text-slate-900">Nạp vào danh sách phát</span>
                        </div>
                        <p className="text-[12px] text-slate-600 leading-relaxed">
                            Chọn Playlist mong muốn, bấm nút màu xanh lá <strong>"NẠP PLAYLIST VÀO DANH SÁCH PHÁT"</strong>. Tool sẽ tự động thêm từng bài vào hàng đợi!
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
