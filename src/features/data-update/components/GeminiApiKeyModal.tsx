import React, { useState, useEffect } from 'react';
import {
    X,
    Key,
    Check,
    ExternalLink,
    ShieldCheck,
    Sparkles,
    AlertCircle,
    AlertTriangle,
    Database,
    Trash2,
    Copy,
    CheckCircle2,
    User,
    Lock
} from 'lucide-react';
import {
    getUserGeminiKey,
    saveUserGeminiKey,
    clearUserGeminiKey,
    getAdminGeminiKeyLocal,
    fetchAdminGeminiKeyCloud,
    saveAdminGeminiKeyCloud,
    resolveActiveGeminiKey,
    testGeminiApiKey,
    SYSTEM_SETTINGS_SQL,
    type GeminiKeySource
} from '../services/geminiApiKeyService';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    isAdmin?: boolean;
    isQuotaExceeded?: boolean;
    onKeySaved?: (activeKey: string, source: GeminiKeySource) => void;
}

export default function GeminiApiKeyModal({
    isOpen,
    onClose,
    isAdmin = false,
    isQuotaExceeded = false,
    onKeySaved
}: Props) {
    // Tab chọn cho Admin ('ADMIN_KEY' | 'USER_KEY')
    const [activeTab, setActiveTab] = useState<'ADMIN_KEY' | 'USER_KEY'>('ADMIN_KEY');

    // State Key
    const [adminKey, setAdminKey] = useState<string>('');
    const [userKey, setUserKey] = useState<string>('');
    const [isTableReady, setIsTableReady] = useState<boolean>(true);

    // Trạng thái kiểm tra
    const [isTesting, setIsTesting] = useState<boolean>(false);
    const [testResult, setTestResult] = useState<{ success: boolean; msg: string; quotaExceeded?: boolean } | null>(null);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');

    // Modal SQL DDL cho Admin
    const [showSqlModal, setShowSqlModal] = useState<boolean>(false);
    const [isCopiedSql, setIsCopiedSql] = useState<boolean>(false);

    useEffect(() => {
        if (!isOpen) return;

        // Nếu kích hoạt vì lỗi Quota, tự động chuyển sang tab User Key để user nhập ngay
        if (isQuotaExceeded) {
            setActiveTab('USER_KEY');
        } else {
            setActiveTab(isAdmin ? 'ADMIN_KEY' : 'USER_KEY');
        }

        // Tải các key
        setUserKey(getUserGeminiKey());
        setAdminKey(getAdminGeminiKeyLocal());
        setTestResult(null);
        setSaveSuccessMsg('');

        // Tải Admin key từ Cloud
        fetchAdminGeminiKeyCloud().then(res => {
            if (res.key) setAdminKey(res.key);
            setIsTableReady(res.isTableReady);
        });
    }, [isOpen, isAdmin, isQuotaExceeded]);

    if (!isOpen) return null;

    // Lưu Admin Key (Dành cho Admin)
    const handleSaveAdminKey = async () => {
        setIsSaving(true);
        setTestResult(null);
        const res = await saveAdminGeminiKeyCloud(adminKey);
        setIsSaving(false);

        if (res.success) {
            setSaveSuccessMsg('✅ Đã lưu Key Quản trị lên Supabase Cloud thành công!');
            const resolved = resolveActiveGeminiKey();
            onKeySaved?.(resolved.key, resolved.source);
            setTimeout(() => {
                setSaveSuccessMsg('');
                onClose();
            }, 1200);
        } else {
            setIsTableReady(res.isTableReady);
            setSaveSuccessMsg(
                res.isTableReady
                    ? `⚠️ Đã lưu bộ nhớ đệm. Lỗi Cloud: ${res.error}`
                    : '⚠️ Bảng system_settings chưa được tạo trên Cloud Supabase.'
            );
        }
    };

    // Lưu User Key (Key cá nhân)
    const handleSaveUserKey = () => {
        const clean = userKey.trim();
        saveUserGeminiKey(clean);
        setSaveSuccessMsg('✅ Đã lưu Key cá nhân của bạn!');
        const resolved = resolveActiveGeminiKey();
        onKeySaved?.(resolved.key, resolved.source);
        setTimeout(() => {
            setSaveSuccessMsg('');
            onClose();
        }, 1200);
    };

    // Xóa User Key (Quay về dùng lại Key Admin)
    const handleClearUserKey = () => {
        clearUserGeminiKey();
        setUserKey('');
        setSaveSuccessMsg('🔄 Đã xóa Key cá nhân. Hệ thống quay về dùng Key mặc định của Admin.');
        const resolved = resolveActiveGeminiKey();
        onKeySaved?.(resolved.key, resolved.source);
        setTimeout(() => setSaveSuccessMsg(''), 2500);
    };

    // Kiểm tra kết nối API Key
    const handleTestKey = async (keyToTest: string) => {
        setIsTesting(true);
        setTestResult(null);
        const res = await testGeminiApiKey(keyToTest);
        setIsTesting(false);
        setTestResult({ success: res.success, msg: res.message, quotaExceeded: res.quotaExceeded });
    };

    const handleCopySql = () => {
        navigator.clipboard.writeText(SYSTEM_SETTINGS_SQL);
        setIsCopiedSql(true);
        setTimeout(() => setIsCopiedSql(false), 2000);
    };

    const currentResolution = resolveActiveGeminiKey(isTableReady);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
            <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
                {/* Header */}
                <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                            <Key className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-sm sm:text-base font-black">Cài Đặt Google Gemini API Key</h2>
                            <p className="text-[11px] text-slate-300">
                                {isAdmin ? 'Cấu hình Key Quản trị dùng chung hoặc Key cá nhân' : 'Key hệ thống mặc định & Key cá nhân dự phòng'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Banner Cảnh Báo Nếu Hết Request (Quota Exceeded) */}
                {isQuotaExceeded && (
                    <div className="bg-gradient-to-r from-amber-500 to-rose-600 text-white p-4 shrink-0 flex items-start gap-3 shadow-inner">
                        <AlertTriangle className="w-6 h-6 text-amber-200 shrink-0 mt-0.5 animate-bounce" />
                        <div className="text-xs space-y-1">
                            <div className="font-black text-sm uppercase tracking-wide">
                                ⚠️ Hạn ngạch API hệ thống đã hết lượt request!
                            </div>
                            <p className="text-amber-100 leading-relaxed font-medium">
                                Key mặc định của Admin đã đạt giới hạn request miễn phí trong ngày từ Google.
                                Để không bị gián đoạn công việc, <strong>bạn hãy đăng nhập Google để lấy 1 API Key cá nhân miễn phí</strong> (mất chưa đầy 30 giây) và dán vào bên dưới.
                            </p>
                        </div>
                    </div>
                )}

                {/* Tab Switcher (Chỉ hiển thị cho Admin) */}
                {isAdmin && (
                    <div className="flex border-b border-slate-200 bg-slate-50 px-5 pt-3 gap-2 shrink-0">
                        <button
                            onClick={() => { setActiveTab('ADMIN_KEY'); setTestResult(null); }}
                            className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all ${
                                activeTab === 'ADMIN_KEY'
                                    ? 'border-indigo-600 text-indigo-700'
                                    : 'border-transparent text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <ShieldCheck className="w-4 h-4" />
                            <span>1. Key Quản Trị Hệ Thống (Toàn Siêu Thị)</span>
                        </button>
                        <button
                            onClick={() => { setActiveTab('USER_KEY'); setTestResult(null); }}
                            className={`pb-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all ${
                                activeTab === 'USER_KEY'
                                    ? 'border-indigo-600 text-indigo-700'
                                    : 'border-transparent text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <User className="w-4 h-4" />
                            <span>2. Key Cá Nhân Của Bạn (Dự Phòng)</span>
                        </button>
                    </div>
                )}

                {/* Nội dung Modal (Scrollable) */}
                <div className="p-5 sm:p-6 space-y-4 overflow-y-auto text-xs">
                    {/* THÔNG BÁO KẾT QUẢ LƯU */}
                    {saveSuccessMsg && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-bold flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>{saveSuccessMsg}</span>
                        </div>
                    )}

                    {/* TAB 1: CẤU HÌNH KEY QUẢN TRỊ (CHỈ DÀNH CHO ADMIN) */}
                    {isAdmin && activeTab === 'ADMIN_KEY' && (
                        <div className="space-y-3.5">
                            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3.5 text-blue-900 space-y-1">
                                <div className="font-extrabold flex items-center gap-1.5">
                                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                                    <span>Key Quản Trị Hệ Thống (Mặc Định Toàn Bộ Siêu Thị)</span>
                                </div>
                                <p className="text-[11px] text-blue-700 leading-relaxed">
                                    Key này được lưu trên <strong>Supabase Cloud</strong>. Mọi quản lý và nhân viên khi vào trang OCR sẽ tự động sử dụng Key này mà không cần phải tự tạo hay cấu hình API Key.
                                </p>
                            </div>

                            {/* Trạng thái Cloud */}
                            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                                <span className="font-semibold text-slate-600">Trạng thái Cloud:</span>
                                {isTableReady ? (
                                    <span className="text-emerald-700 font-bold flex items-center gap-1">
                                        <Check className="w-3.5 h-3.5" />
                                        <span>Bảng system_settings sẵn sàng</span>
                                    </span>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span className="text-amber-700 font-bold flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            <span>Chưa tạo bảng system_settings</span>
                                        </span>
                                        <button
                                            onClick={() => setShowSqlModal(true)}
                                            className="px-2 py-0.5 bg-amber-600 text-white rounded font-bold text-[10px] hover:bg-amber-700"
                                        >
                                            Xem SQL DDL
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Ô nhập Admin Key */}
                            <div className="space-y-1.5">
                                <label className="font-bold text-slate-700 block">
                                    Google Gemini API Key (Admin Master Key):
                                </label>
                                <input
                                    type="password"
                                    value={adminKey}
                                    onChange={e => setAdminKey(e.target.value)}
                                    placeholder="Dán mã key bắt đầu bằng AIzaSy..."
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
                                />
                            </div>

                            {/* Nút hành động */}
                            <div className="flex items-center justify-between gap-2 pt-2">
                                <button
                                    onClick={() => handleTestKey(adminKey)}
                                    disabled={isTesting || !adminKey.trim()}
                                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all disabled:opacity-50"
                                >
                                    {isTesting ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}
                                </button>
                                <button
                                    onClick={handleSaveAdminKey}
                                    disabled={isSaving || !adminKey.trim()}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-md shadow-indigo-100 disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    <ShieldCheck className="w-4 h-4" />
                                    <span>{isSaving ? 'Đang lưu...' : 'Lưu Lên Cloud (Cho Toàn Hệ Thống)'}</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: KEY CÁ NHÂN CỦA USER (HOẶC GIAO DIỆN USER BÌNH THƯỜNG) */}
                    {(activeTab === 'USER_KEY' || !isAdmin) && (
                        <div className="space-y-4">
                            {/* Trạng thái Key hiện tại */}
                            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <span className="font-bold text-slate-700">Trạng thái Key đang áp dụng:</span>
                                    {currentResolution.source === 'USER' ? (
                                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-300">
                                            👤 Key Cá Nhân (Ưu tiên)
                                        </span>
                                    ) : currentResolution.source === 'ADMIN' ? (
                                        <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-blue-300">
                                            🛡️ Key Quản Trị Hệ Thống (Mặc định)
                                        </span>
                                    ) : (
                                        <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300">
                                            ⚠️ Chưa có Key nào hoạt động
                                        </span>
                                    )}
                                </div>
                                <p className="text-[11px] text-slate-500">
                                    {currentResolution.source === 'USER'
                                        ? 'Bạn đang sử dụng Key cá nhân của mình. Key này được lưu riêng trên trình duyệt của bạn.'
                                        : currentResolution.adminKeyConfigured
                                        ? 'Mặc định hệ thống tự động sử dụng Key chung của Admin. Khi hết lượt request, bạn hãy tạo Key cá nhân bên dưới.'
                                        : 'Quản trị viên chưa cấu hình Key hệ thống. Vui lòng đăng nhập Google để lấy Key cá nhân miễn phí.'}
                                </p>
                            </div>

                            {/* HƯỚNG DẪN ĐĂNG NHẬP GOOGLE LẤY KEY MIỄN PHÍ */}
                            <div className="border border-indigo-200 bg-gradient-to-br from-indigo-50/70 via-blue-50/50 to-slate-50 rounded-2xl p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="font-black text-indigo-950 text-xs flex items-center gap-1.5">
                                        <Sparkles className="w-4 h-4 text-indigo-600" />
                                        <span>Cách Lấy API Key Google Miễn Phí (100% Free):</span>
                                    </div>
                                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-md">
                                        Google AI Studio
                                    </span>
                                </div>

                                {/* NÚT MỞ GOOGLE AI STUDIO */}
                                <a
                                    href="https://aistudio.google.com/apikey"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-md shadow-indigo-100 transition-all cursor-pointer"
                                >
                                    <span>🌐 1. Đăng Nhập Google & Lấy API Key Tại Đây</span>
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </a>

                                <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 font-medium">
                                    <li>Nhấn nút màu xanh bên trên để đăng nhập tài khoản Google của bạn.</li>
                                    <li>Nhấn nút <strong>"Create API key"</strong> trên trang Google AI Studio.</li>
                                    <li>Sao chép mã Key (dạng <code className="bg-slate-200 px-1 py-0.2 rounded text-[10px]">AIzaSy...</code>), dán vào ô bên dưới và nhấn Lưu.</li>
                                </ol>
                            </div>

                            {/* Ô nhập Key Cá Nhân */}
                            <div className="space-y-1.5">
                                <label className="font-bold text-slate-700 block">
                                    Dán API Key cá nhân của bạn vào đây:
                                </label>
                                <input
                                    type="text"
                                    value={userKey}
                                    onChange={e => setUserKey(e.target.value)}
                                    placeholder="AIzaSy..."
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-xs"
                                />
                            </div>

                            {/* Các nút hành động */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleTestKey(userKey)}
                                        disabled={isTesting || !userKey.trim()}
                                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all disabled:opacity-50"
                                    >
                                        {isTesting ? 'Đang thử...' : 'Kiểm tra key'}
                                    </button>
                                    {getUserGeminiKey() && (
                                        <button
                                            onClick={handleClearUserKey}
                                            className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl transition-all flex items-center gap-1 border border-rose-200"
                                            title="Xóa key cá nhân để quay về dùng lại Key Admin"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            <span>Quay về dùng Key Admin</span>
                                        </button>
                                    )}
                                </div>
                                <button
                                    onClick={handleSaveUserKey}
                                    disabled={!userKey.trim()}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-md shadow-indigo-100 disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    <Check className="w-4 h-4" />
                                    <span>Lưu Key Cá Nhân & Tiếp Tục</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* KẾT QUẢ KIỂM TRA KEY */}
                    {testResult && (
                        <div
                            className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
                                testResult.success
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                    : 'bg-rose-50 text-rose-800 border-rose-300'
                            }`}
                        >
                            {testResult.success ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            ) : (
                                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                            )}
                            <div>{testResult.msg}</div>
                        </div>
                    )}
                </div>

                {/* Footer Modal */}
                <div className="px-5 sm:px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
                    <span className="flex items-center gap-1">
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                        <span>Bảo mật an toàn, không chia sẻ ra ngoài</span>
                    </span>
                    <button
                        onClick={onClose}
                        className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold transition-all"
                    >
                        Đóng
                    </button>
                </div>
            </div>

            {/* MODAL XEM MÃ SQL DDL (RULE 12: CHỈ HIỂN THỊ VỚI ADMIN) */}
            {showSqlModal && isAdmin && (
                <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
                    <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-5 space-y-3">
                        <div className="flex items-center justify-between border-b pb-2">
                            <div className="flex items-center gap-2 text-slate-800 font-extrabold text-sm">
                                <Database className="w-4 h-4 text-indigo-600" />
                                <span>Mã SQL Khởi Tạo Bảng system_settings</span>
                            </div>
                            <button onClick={() => setShowSqlModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-xs text-slate-600">
                            Chạy câu lệnh SQL này 1 lần duy nhất trong <strong>Supabase SQL Editor</strong> để khởi tạo bảng lưu cấu hình chung:
                        </p>
                        <pre className="bg-slate-900 text-emerald-300 p-3 rounded-xl font-mono text-[11px] overflow-x-auto max-h-48 border border-slate-800">
                            {SYSTEM_SETTINGS_SQL}
                        </pre>
                        <div className="flex items-center justify-between pt-2">
                            <span className="text-[11px] text-slate-500">Quy chuẩn bảo mật Rule 12</span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleCopySql}
                                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm"
                                >
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>{isCopiedSql ? 'Đã sao chép!' : 'Sao chép SQL'}</span>
                                </button>
                                <button
                                    onClick={() => setShowSqlModal(false)}
                                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-xs"
                                >
                                    Đóng
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
