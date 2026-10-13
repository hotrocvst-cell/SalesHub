import React from 'react';
import {
    Music,
    ExternalLink,
    Copy,
    Download,
    Check,
    BookOpen,
    ListMusic,
    Code2,
    Settings,
    Sparkles
} from 'lucide-react';
import type { XMusicTabType } from '../types';

interface XmusicHeroHeaderProps {
    activeTab: XMusicTabType;
    setActiveTab: (tab: XMusicTabType) => void;
    onCopyCode: () => void;
    onDownloadCode: () => void;
    hasCopied: boolean;
}

export default function XmusicHeroHeader({
    activeTab,
    setActiveTab,
    onCopyCode,
    onDownloadCode,
    hasCopied
}: XmusicHeroHeaderProps) {
    const tabs: { key: XMusicTabType; label: string; icon: React.ComponentType<{ className?: string }>; badge?: string }[] = [
        { key: 'guide', label: 'Hướng Dẫn Cài Đặt', icon: BookOpen, badge: '4 Bước' },
        { key: 'playlists', label: 'Danh Sách Phát Mẫu', icon: ListMusic, badge: 'Nghe thử' },
        { key: 'code', label: 'Mã Userscript', icon: Code2, badge: 'v1.2.0' },
        { key: 'account', label: 'Cấu Hình Tài Khoản', icon: Settings }
    ];

    return (
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-6 mb-4 sm:mb-6">
            {/* Top row: Brand & Action Buttons */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                <div className="flex items-start sm:items-center gap-3.5">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-200">
                        <Music className="w-6 h-6 sm:w-7 sm:h-7" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                                Xmusic Playlist Automation
                            </h1>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 shadow-2xs">
                                <Sparkles className="w-3 h-3 text-indigo-500" />
                                <span>Userscript v1.2.0</span>
                            </span>
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Tiện ích siêu thị
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                            Tự động đăng nhập tài khoản <code className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded">tgd111</code>, tích hợp Sidebar bên trái và tự nạp danh sách bài hát vào hàng đợi <strong className="text-slate-700">player.xmusicstation.com</strong>.
                        </p>
                    </div>
                </div>

                {/* Main Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
                    <a
                        href="https://player.xmusicstation.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white shadow-xs transition hover:scale-[1.02] active:scale-[0.98]"
                    >
                        <ExternalLink className="w-3.5 h-3.5 text-indigo-300" />
                        <span>Mở Trình Phát Nhạc</span>
                    </a>

                    <button
                        type="button"
                        onClick={onCopyCode}
                        className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition shadow-xs hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                            hasCopied
                                ? 'bg-emerald-600 text-white'
                                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white'
                        }`}
                        title="Sao chép toàn bộ mã Userscript vào Clipboard"
                    >
                        {hasCopied ? (
                            <>
                                <Check className="w-3.5 h-3.5 text-emerald-200" />
                                <span>Đã Sao Chép!</span>
                            </>
                        ) : (
                            <>
                                <Copy className="w-3.5 h-3.5 text-indigo-200" />
                                <span>Sao Chép Script</span>
                            </>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={onDownloadCode}
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition shadow-2xs cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                        title="Tải file xmusic-auto-playlist.user.js về máy"
                    >
                        <Download className="w-3.5 h-3.5 text-slate-500" />
                        <span className="hidden sm:inline">Tải File .user.js</span>
                        <span className="sm:hidden">Tải .js</span>
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 sm:gap-2 mt-4 overflow-x-auto no-scrollbar pt-1">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.key;
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                                isActive
                                    ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-200'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 bg-slate-50/70 border border-transparent'
                            }`}
                        >
                            <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                            <span>{tab.label}</span>
                            {tab.badge && (
                                <span
                                    className={`text-[10px] font-black px-1.5 py-0.2 rounded-md ${
                                        isActive
                                            ? 'bg-indigo-700/80 text-white'
                                            : 'bg-slate-200/80 text-slate-600'
                                    }`}
                                >
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
