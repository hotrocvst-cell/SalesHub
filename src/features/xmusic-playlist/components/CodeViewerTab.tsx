import React, { useState, useMemo } from 'react';
import {
    Copy,
    Download,
    Check,
    Search,
    FileCode,
    Sparkles,
    CheckCircle2
} from 'lucide-react';
import {
    XMUSIC_USER_SCRIPT_CODE,
    XMUSIC_USER_SCRIPT_VERSION,
    XMUSIC_USER_SCRIPT_FILENAME
} from '../data/userScriptCode';

interface CodeViewerTabProps {
    onCopyCode: () => void;
    onDownloadCode: () => void;
    hasCopied: boolean;
}

export default function CodeViewerTab({
    onCopyCode,
    onDownloadCode,
    hasCopied
}: CodeViewerTabProps) {
    const [searchKeyword, setSearchKeyword] = useState<string>('');

    const lines = useMemo(() => {
        return XMUSIC_USER_SCRIPT_CODE.split('\n');
    }, []);

    const filteredCode = useMemo(() => {
        if (!searchKeyword.trim()) return XMUSIC_USER_SCRIPT_CODE;
        const kw = searchKeyword.toLowerCase();
        return lines
            .filter(line => line.toLowerCase().includes(kw))
            .join('\n');
    }, [searchKeyword, lines]);

    return (
        <div className="space-y-4">
            {/* Header with File Meta & Actions */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                            <FileCode className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-xs sm:text-sm font-black text-slate-900 font-mono">
                                    {XMUSIC_USER_SCRIPT_FILENAME}
                                </h3>
                                <span className="text-[10px] font-extrabold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                                    v{XMUSIC_USER_SCRIPT_VERSION}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Left Sidebar • Quy mô {lines.length} dòng mã • Tự động nạp Playlist
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={onCopyCode}
                            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${
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
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition shadow-2xs cursor-pointer"
                        >
                            <Download className="w-3.5 h-3.5 text-slate-500" />
                            <span>Tải Về (.user.js)</span>
                        </button>
                    </div>
                </div>

                {/* Search in Code */}
                <div className="mt-3 relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                        type="text"
                        value={searchKeyword}
                        onChange={(e) => setSearchKeyword(e.target.value)}
                        placeholder="Tìm kiếm hàm hoặc từ khóa trong mã nguồn (vd: autoLogin, default_auth, robustClick)..."
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-indigo-400 text-slate-700"
                    />
                </div>
            </div>

            {/* Code Box */}
            <div className="rounded-2xl sm:rounded-3xl bg-slate-950 border border-slate-800 shadow-md overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
                        <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
                        <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
                        <span className="ml-2 text-slate-300 font-semibold">{XMUSIC_USER_SCRIPT_FILENAME}</span>
                    </div>
                    <span>{searchKeyword ? `Kết quả lọc (${filteredCode.split('\n').length} dòng)` : `${lines.length} dòng`}</span>
                </div>

                <div className="p-4 max-h-[550px] overflow-auto font-mono text-xs text-slate-300 leading-relaxed select-text">
                    <pre className="whitespace-pre">
                        <code>{filteredCode}</code>
                    </pre>
                </div>
            </div>
        </div>
    );
}
