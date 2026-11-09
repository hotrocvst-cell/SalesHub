import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
    Hash,
    Copy,
    Scissors,
    Sparkles,
    RefreshCw,
    Plus,
    Trash2,
    Check,
    Search,
    History,
    ArrowLeft,
    Sliders,
    Tag,
    FileText,
    CheckCircle2,
    AlertCircle,
    Info
} from 'lucide-react';
import {
    generateBatchOrderCodes,
    parseBaseOrderCode,
    type GeneratedOrderCode
} from './utils/orderCodeGenerator';

const STORAGE_KEYS = {
    BASE_CODE: 'saleshub_order_generator_base_code',
    COUNT: 'saleshub_order_generator_count',
    MIN_STEP: 'saleshub_order_generator_min_step',
    MAX_STEP: 'saleshub_order_generator_max_step',
    INCLUDE_BASE: 'saleshub_order_generator_include_base'
};

const DEFAULT_SAMPLE_CODE = '00111SO26110721539';

export default function OrderCodeGeneratorPage() {
    // 1. Cấu hình tham số sinh mã
    const [baseCode, setBaseCode] = useState<string>(() => {
        try {
            return localStorage.getItem(STORAGE_KEYS.BASE_CODE) || DEFAULT_SAMPLE_CODE;
        } catch {
            return DEFAULT_SAMPLE_CODE;
        }
    });

    const [count, setCount] = useState<number>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.COUNT);
            return saved ? Math.max(1, Math.min(Number(saved), 500)) : 20;
        } catch {
            return 20;
        }
    });

    const [minStep, setMinStep] = useState<number>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.MIN_STEP);
            return saved ? Number(saved) : 10;
        } catch {
            return 10;
        }
    });

    const [maxStep, setMaxStep] = useState<number>(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.MAX_STEP);
            return saved ? Number(saved) : 20;
        } catch {
            return 20;
        }
    });

    const [includeBaseCode, setIncludeBaseCode] = useState<boolean>(() => {
        try {
            return localStorage.getItem(STORAGE_KEYS.INCLUDE_BASE) === 'true';
        } catch {
            return false;
        }
    });

    // 2. Danh sách mã khả dụng & Lịch sử mã đã cắt
    const [codes, setCodes] = useState<GeneratedOrderCode[]>([]);
    const [cutCodes, setCutCodes] = useState<GeneratedOrderCode[]>([]);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [cutId, setCutId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [showCutHistory, setShowCutHistory] = useState<boolean>(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 2500);
    };

    // Lưu cấu hình vào localStorage
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEYS.BASE_CODE, baseCode);
            localStorage.setItem(STORAGE_KEYS.COUNT, String(count));
            localStorage.setItem(STORAGE_KEYS.MIN_STEP, String(minStep));
            localStorage.setItem(STORAGE_KEYS.MAX_STEP, String(maxStep));
            localStorage.setItem(STORAGE_KEYS.INCLUDE_BASE, String(includeBaseCode));
        } catch { }
    }, [baseCode, count, minStep, maxStep, includeBaseCode]);

    // Phân tích mã mẫu theo thời gian thực
    const parseResult = useMemo(() => {
        return parseBaseOrderCode(baseCode);
    }, [baseCode]);

    // Tự động sinh mã lần đầu tiên khi vào trang nếu chưa có mã nào
    useEffect(() => {
        if (codes.length === 0) {
            handleGenerateNew(false);
        }
    }, []);

    // Hàm sinh mã mới (ghi đè danh sách hiện tại)
    const handleGenerateNew = (notify = true) => {
        const res = generateBatchOrderCodes(baseCode, count, minStep, maxStep, includeBaseCode);
        if (!res.success) {
            showToast(`⚠️ ${res.error || 'Lỗi sinh mã'}`);
            return;
        }
        setCodes(res.codes);
        if (notify) {
            showToast(`⚡ Đã tạo thành công ${res.codes.length} mã đơn hàng mới!`);
        }
    };

    // Hàm sinh thêm mã nối tiếp vào đuôi danh sách hiện tại
    const handleAppendMore = () => {
        const lastCode = codes.length > 0 ? codes[codes.length - 1].code : baseCode;
        const res = generateBatchOrderCodes(lastCode, count, minStep, maxStep, false);
        if (!res.success) {
            showToast(`⚠️ ${res.error || 'Lỗi sinh mã tiếp nối'}`);
            return;
        }
        // Cập nhật lại chỉ số index nối tiếp
        const offsetIndex = codes.length;
        const reIndexed = res.codes.map((c, i) => ({
            ...c,
            index: offsetIndex + i + 1
        }));
        setCodes(prev => [...prev, ...reIndexed]);
        showToast(`➕ Đã tạo thêm ${reIndexed.length} mã đơn hàng nối tiếp!`);
    };

    // Copy 1 mã vào clipboard
    const handleCopyCode = async (item: GeneratedOrderCode) => {
        try {
            await navigator.clipboard.writeText(item.code);
            setCopiedId(item.id);
            showToast(`📋 Đã copy: ${item.code}`);
            setTimeout(() => setCopiedId(null), 1500);
        } catch {
            showToast('⚠️ Không thể truy cập clipboard');
        }
    };

    // Cut (Cắt): Copy vào clipboard đồng thời loại bỏ khỏi danh sách khả dụng
    const handleCutCode = async (item: GeneratedOrderCode) => {
        try {
            await navigator.clipboard.writeText(item.code);
            setCutId(item.id);

            // Chuyển sang danh sách đã cắt
            setCodes(prev => prev.filter(c => c.id !== item.id));
            setCutCodes(prev => [item, ...prev]);

            showToast(`✂️ Đã cắt mã ${item.code} vào Clipboard!`);
            setTimeout(() => setCutId(null), 800);
        } catch {
            showToast('⚠️ Không thể truy cập clipboard');
        }
    };

    // Khôi phục 1 mã đã cắt về danh sách khả dụng
    const handleRestoreCode = (item: GeneratedOrderCode) => {
        setCutCodes(prev => prev.filter(c => c.id !== item.id));
        setCodes(prev => [...prev, item]);
        showToast(`↺ Đã khôi phục mã ${item.code} vào danh sách!`);
    };

    // Khôi phục toàn bộ mã đã cắt
    const handleRestoreAllCutCodes = () => {
        if (cutCodes.length === 0) return;
        setCodes(prev => [...prev, ...cutCodes]);
        setCutCodes([]);
        showToast('↺ Đã khôi phục toàn bộ mã đã cắt vào danh sách!');
    };

    // Copy toàn bộ mã khả dụng còn lại (mỗi mã 1 dòng)
    const handleCopyAllCodes = async () => {
        if (codes.length === 0) {
            showToast('⚠️ Không có mã nào trong danh sách!');
            return;
        }
        const text = codes.map(c => c.code).join('\n');
        try {
            await navigator.clipboard.writeText(text);
            showToast(`📋 Đã copy toàn bộ ${codes.length} mã đơn hàng!`);
        } catch {
            showToast('⚠️ Lỗi khi copy toàn bộ');
        }
    };

    // Xóa trắng toàn bộ danh sách
    const handleClearAll = () => {
        if (codes.length === 0 && cutCodes.length === 0) return;
        if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ danh sách mã hiện tại?')) {
            setCodes([]);
            setCutCodes([]);
            showToast('Đã xóa sạch danh sách mã!');
        }
    };

    // Lọc theo tìm kiếm
    const filteredCodes = useMemo(() => {
        if (!searchQuery.trim()) return codes;
        const q = searchQuery.toLowerCase().trim();
        return codes.filter(c => c.code.toLowerCase().includes(q));
    }, [codes, searchQuery]);

    return (
        <div className="max-w-5xl mx-auto space-y-4 font-sans text-slate-800 pb-16">
            {/* 1. Header Trang & Điều Hướng Nhanh */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
                        <Hash className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-base sm:text-xl font-black text-slate-900 tracking-tight">
                                Công Cụ Sinh Mã Đơn Hàng Hàng Loạt
                            </h1>
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                                Tiện Ích Bán Hàng
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Tự động tăng lũy kế ngẫu nhiên 10 - 20 đơn vị • Hỗ trợ Copy &amp; Cut từng mã nhanh chóng
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                    <Link
                        to="/quan-ly-voucher"
                        className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                        title="Quay lại phân hệ Quản lý kho voucher"
                    >
                        <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
                        <span>Kho Voucher</span>
                    </Link>
                </div>
            </div>

            {/* Toast thông báo nhanh */}
            {toastMessage && (
                <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-2xl text-xs font-bold shadow-xl border border-slate-800 animate-in fade-in slide-in-from-top-2 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* 2. KHỐI THIẾT LẬP THAM SỐ SINH MÃ */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
                    <div className="flex items-center gap-2 text-xs font-black text-slate-900 uppercase tracking-wide">
                        <Sliders className="w-4 h-4 text-blue-600" />
                        <span>Cấu hình tham số sinh mã</span>
                    </div>

                    {parseResult.isValid && (
                        <div className="text-[11px] text-slate-500 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 flex items-center gap-1.5">
                            <span>Tiền tố: <strong className="font-mono text-blue-700 font-bold">{parseResult.prefix}</strong></span>
                            <span>•</span>
                            <span>Số đuôi: <strong className="font-mono text-emerald-700 font-bold">{parseResult.numericPart}</strong> ({parseResult.padLength} số)</span>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Ô 1: Mã Đơn Mẫu */}
                    <div className="space-y-1 sm:col-span-2">
                        <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                            <span>Mã Đơn Hàng Mẫu / Khởi Điểm:</span>
                            <button
                                type="button"
                                onClick={() => setBaseCode(DEFAULT_SAMPLE_CODE)}
                                className="text-[10px] text-blue-600 hover:underline font-semibold cursor-pointer"
                            >
                                Mặc định
                            </button>
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                value={baseCode}
                                onChange={e => setBaseCode(e.target.value.trim())}
                                placeholder="Ví dụ: 00111SO26110721539"
                                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 ${parseResult.isValid
                                    ? 'border-slate-300 focus:ring-blue-500 focus:bg-white'
                                    : 'border-rose-300 bg-rose-50/50 focus:ring-rose-500 text-rose-900'
                                    }`}
                            />
                            {baseCode && (
                                <button
                                    type="button"
                                    onClick={() => setBaseCode('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                        {!parseResult.isValid && baseCode && (
                            <p className="text-[10.5px] text-rose-600 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3 shrink-0" />
                                <span>{parseResult.error}</span>
                            </p>
                        )}
                    </div>

                    {/* Ô 2: Số Lượng Mã */}
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                            <span>Số lượng mã:</span>
                            <span className="text-[10px] text-slate-400">1 - 500</span>
                        </label>
                        <input
                            type="number"
                            min={1}
                            max={500}
                            value={count}
                            onChange={e => setCount(Math.max(1, Math.min(Number(e.target.value) || 1, 500)))}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                        />
                        <div className="flex items-center gap-1 pt-0.5">
                            {[10, 20, 50, 100].map(cnt => (
                                <button
                                    key={cnt}
                                    type="button"
                                    onClick={() => setCount(cnt)}
                                    className={`px-1.5 py-0.5 text-[10px] rounded-md font-bold cursor-pointer transition ${count === cnt
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                >
                                    {cnt}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Ô 3: Bước Nhảy Ngẫu Nhiên */}
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                            <span>Bước nhảy ngẫu nhiên:</span>
                            <span className="text-[10px] text-emerald-700 font-mono font-bold">+{minStep} ~ +{maxStep}</span>
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                            <input
                                type="number"
                                min={1}
                                max={maxStep}
                                value={minStep}
                                onChange={e => setMinStep(Math.max(1, Math.min(Number(e.target.value) || 1, maxStep)))}
                                className="w-full px-2 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-center text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                                title="Bước tăng tối thiểu"
                            />
                            <input
                                type="number"
                                min={minStep}
                                max={100}
                                value={maxStep}
                                onChange={e => setMaxStep(Math.max(minStep, Math.min(Number(e.target.value) || minStep, 100)))}
                                className="w-full px-2 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-center text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                                title="Bước tăng tối đa"
                            />
                        </div>
                        <div className="flex items-center gap-1 pt-0.5">
                            <button
                                type="button"
                                onClick={() => { setMinStep(10); setMaxStep(20); }}
                                className={`px-1.5 py-0.5 text-[10px] rounded-md font-bold cursor-pointer transition ${minStep === 10 && maxStep === 20
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                title="Bước nhảy mặc định: 10 - 20"
                            >
                                10-20 (Chuẩn)
                            </button>
                            <button
                                type="button"
                                onClick={() => { setMinStep(1); setMaxStep(5); }}
                                className={`px-1.5 py-0.5 text-[10px] rounded-md font-bold cursor-pointer transition ${minStep === 1 && maxStep === 5
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                title="Bước nhảy ngắn: 1 - 5"
                            >
                                1-5 (Ngắn)
                            </button>
                        </div>
                    </div>
                </div>

                {/* Tùy chọn phụ & Nhóm nút bấm tạo mã */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={includeBaseCode}
                            onChange={e => setIncludeBaseCode(e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                        />
                        <span>Bao gồm cả mã mẫu làm mã đầu tiên trong danh sách</span>
                    </label>

                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={() => handleGenerateNew(true)}
                            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black shadow-xs hover:shadow transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                            title="Tạo mới toàn bộ danh sách mã theo cấu hình"
                        >
                            <Sparkles className="w-4 h-4 text-amber-300" />
                            <span>⚡ Sinh {count} Mã Mới</span>
                        </button>

                        {codes.length > 0 && (
                            <button
                                type="button"
                                onClick={handleAppendMore}
                                className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                                title="Tạo thêm mã nối tiếp giá trị cao nhất hiện tại"
                            >
                                <Plus className="w-3.5 h-3.5 text-emerald-600" />
                                <span>+ Nối Thêm {count} Mã</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* 3. THANH THỐNG KÊ & TÁC VỤ DANH SÁCH */}
            <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                    <div className="px-3 py-1 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 font-bold flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-blue-600" />
                        <span>Khả dụng: <strong className="font-mono text-sm">{codes.length}</strong></span>
                    </div>

                    <div className="px-3 py-1 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 font-bold flex items-center gap-1.5">
                        <Scissors className="w-3.5 h-3.5 text-amber-600" />
                        <span>Đã cắt / lấy: <strong className="font-mono text-sm">{cutCodes.length}</strong></span>
                    </div>

                    {cutCodes.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setShowCutHistory(!showCutHistory)}
                            className="px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-blue-700 bg-slate-100 hover:bg-blue-50 rounded-lg transition cursor-pointer flex items-center gap-1"
                        >
                            <History className="w-3 h-3" />
                            <span>{showCutHistory ? 'Ẩn lịch sử cắt' : 'Xem lịch sử cắt'}</span>
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Ô tìm kiếm nhanh */}
                    {codes.length > 5 && (
                        <div className="relative flex-1 md:w-48">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Tìm mã..."
                                className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                            />
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={handleCopyAllCodes}
                        disabled={codes.length === 0}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                        title="Copy toàn bộ danh sách mã còn lại (mỗi mã 1 dòng)"
                    >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Toàn Bộ</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleClearAll}
                        disabled={codes.length === 0 && cutCodes.length === 0}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-xl transition cursor-pointer disabled:opacity-30"
                        title="Xóa trắng toàn bộ danh sách"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* 4. KHỐI LỊCH SỬ CÁC MÃ ĐÃ CẮT (COLLAPSIBLE) */}
            {showCutHistory && cutCodes.length > 0 && (
                <div className="bg-amber-50/60 border border-amber-200 rounded-3xl p-4 space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-black text-amber-950 uppercase tracking-wide">
                            <Scissors className="w-4 h-4 text-amber-600" />
                            <span>Danh sách {cutCodes.length} mã đã cắt (Đã dùng)</span>
                        </div>
                        <button
                            type="button"
                            onClick={handleRestoreAllCutCodes}
                            className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 bg-white hover:bg-emerald-50 border border-emerald-300 rounded-lg transition cursor-pointer"
                        >
                            ↺ Khôi phục tất cả
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                        {cutCodes.map(item => (
                            <div
                                key={item.id}
                                className="flex items-center justify-between p-2 bg-white rounded-xl border border-amber-200 text-xs font-mono shadow-2xs"
                            >
                                <span className="line-through text-slate-400 font-bold">{item.code}</span>
                                <button
                                    type="button"
                                    onClick={() => handleRestoreCode(item)}
                                    className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                                    title="Khôi phục mã này về danh sách khả dụng"
                                >
                                    Khôi phục
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 5. DANH SÁCH KẾT QUẢ MÃ ĐƠN HÀNG (CARD DỌC & TABLE) */}
            {codes.length === 0 ? (
                <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-8 text-center space-y-3">
                    <Hash className="w-10 h-10 text-slate-300 mx-auto" />
                    <p className="text-xs font-bold text-slate-600">
                        Chưa có mã đơn hàng nào trong danh sách.
                    </p>
                    <button
                        type="button"
                        onClick={() => handleGenerateNew(true)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Sinh {count} Mã Ngay</span>
                    </button>
                </div>
            ) : (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
                    {/* Bảng danh sách mã */}
                    <div className="divide-y divide-slate-100">
                        {filteredCodes.map((item, idx) => {
                            const isJustCopied = copiedId === item.id;
                            const isJustCut = cutId === item.id;

                            return (
                                <div
                                    key={item.id}
                                    className={`p-3 sm:px-4 sm:py-2.5 flex items-center justify-between gap-3 transition-colors ${isJustCut
                                        ? 'bg-rose-50 opacity-50'
                                        : isJustCopied
                                            ? 'bg-emerald-50/70'
                                            : 'hover:bg-slate-50/80'
                                        }`}
                                >
                                    {/* Cột trái: STT & Mã Đơn */}
                                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                                        <span className="w-7 text-center font-mono text-[11px] font-bold text-slate-400 shrink-0">
                                            #{String(item.index || idx + 1).padStart(2, '0')}
                                        </span>

                                        <div className="min-w-0 flex items-center gap-2 flex-wrap">
                                            <span className="font-mono text-xs sm:text-sm font-black text-blue-800 bg-blue-50/80 hover:bg-blue-100 border border-blue-200/90 px-2.5 py-1 rounded-xl tracking-wider select-all transition">
                                                {item.code}
                                            </span>

                                            {item.stepFromPrevious > 0 && (
                                                <span
                                                    className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md shrink-0"
                                                    title={`Tăng +${item.stepFromPrevious} đơn vị so với mã trước`}
                                                >
                                                    +{item.stepFromPrevious}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Cột phải: Nhóm nút COPY & CUT */}
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        {/* Nút COPY */}
                                        <button
                                            type="button"
                                            onClick={() => handleCopyCode(item)}
                                            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 ${isJustCopied
                                                ? 'bg-emerald-600 text-white shadow-2xs'
                                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                                }`}
                                            title="Sao chép mã này vào clipboard"
                                        >
                                            {isJustCopied ? (
                                                <>
                                                    <Check className="w-3.5 h-3.5 text-white" />
                                                    <span className="hidden sm:inline">Đã copy</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                                                    <span>Copy</span>
                                                </>
                                            )}
                                        </button>

                                        {/* Nút CUT */}
                                        <button
                                            type="button"
                                            onClick={() => handleCutCode(item)}
                                            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer active:scale-95"
                                            title="Sao chép vào clipboard và loại bỏ mã này khỏi danh sách"
                                        >
                                            <Scissors className="w-3.5 h-3.5 text-amber-600" />
                                            <span>Cut</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer thanh đếm */}
                    <div className="bg-slate-50 px-4 py-2 border-t border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
                        <span>Đang hiển thị {filteredCodes.length} / {codes.length} mã</span>
                        <span className="italic text-slate-400">Click &quot;Cut&quot; để lấy mã và tự động loại khỏi danh sách</span>
                    </div>
                </div>
            )}
        </div>
    );
}

