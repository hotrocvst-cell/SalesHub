import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Banknote,
    RotateCcw,
    History,
    Save,
    Printer,
    Copy,
    Check,
    Download,
    Sparkles,
    Coins,
    Store,
    User,
    CheckCircle2,
    AlertTriangle,
    ArrowUpRight,
    TrendingUp,
    Image,
    CopyCheck,
    FileText
} from 'lucide-react';
import { useAuth } from '../../shared/contexts/AuthContext';
import {
    generateStandardReportCanvas,
    downloadReportCanvas,
    copyReportCanvasToClipboard
} from '../../shared/utils/exportImage';
import {
    DENOMINATIONS,
    type CashAuditRecord
} from './types';
import {
    getLocalCashHistory,
    saveCashAuditRecord,
    deleteCashAuditRecord,
    clearAllCashAuditHistory
} from './services/cashCounterService';
import { DenominationRow } from './components/DenominationRow';
import { CashReceiptPrintModal } from './components/CashReceiptPrintModal';
import { CashHistoryModal } from './components/CashHistoryModal';

export default function CashCounterPage() {
    const { currentUser } = useAuth();
    const reportCaptureRef = useRef<HTMLDivElement>(null);

    // Dữ liệu cấu hình & nhập liệu
    const [selectedStore, setSelectedStore] = useState<string>(currentUser.store_name || '');
    const [userNote, setUserNote] = useState<string>(
        currentUser.employee_id
            ? `${currentUser.employee_id} - ${currentUser.full_name}`
            : ''
    );
    const [targetCash, setTargetCash] = useState<number>(0);
    const [targetCashFormatted, setTargetCashFormatted] = useState<string>('0');
    const [auditNote, setAuditNote] = useState<string>('');

    // Chi tiết đếm số tờ theo từng mệnh giá (500k -> 1k)
    const [quantities, setQuantities] = useState<Record<number, number>>(() => {
        const initial: Record<number, number> = {};
        DENOMINATIONS.forEach(d => {
            initial[d.val] = 0;
        });
        return initial;
    });

    // Trạng thái Lịch sử (Thuần LocalStorage theo yêu cầu)
    const [history, setHistory] = useState<CashAuditRecord[]>([]);

    // Modal states
    const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
    const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
    const [printModalRecord, setPrintModalRecord] = useState<CashAuditRecord | null>(null);

    // UI feedback
    const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
    const [isExportingImage, setIsExportingImage] = useState<boolean>(false);
    const [isCopyingImage, setIsCopyingImage] = useState<boolean>(false);
    const [copiedImage, setCopiedImage] = useState<boolean>(false);
    const [copiedZalo, setCopiedZalo] = useState<boolean>(false);

    const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
        setToastMessage({ text, type });
        setTimeout(() => setToastMessage(null), 3000);
    };

    // Tải dữ liệu ban đầu thuần từ LocalStorage (key: cash_history_portal)
    useEffect(() => {
        const localRecords = getLocalCashHistory();
        setHistory(localRecords);
    }, []);

    // Tự động gán thông tin nhân viên & siêu thị nếu có
    useEffect(() => {
        if (!selectedStore && currentUser.store_name) {
            setSelectedStore(currentUser.store_name);
        }
        if (!userNote && currentUser.employee_id) {
            setUserNote(`NV_${currentUser.employee_id} (${currentUser.full_name})`);
        }
    }, [currentUser, selectedStore, userNote]);

    // Tính toán tổng số tiền thực đếm
    const totalCounted = useMemo(() => {
        return DENOMINATIONS.reduce((sum, item) => {
            const qty = quantities[item.val] || 0;
            return sum + qty * item.val;
        }, 0);
    }, [quantities]);

    // Tổng số tờ tiền
    const totalBanknotes = useMemo(() => {
        return DENOMINATIONS.reduce((sum, item) => {
            return sum + (quantities[item.val] || 0);
        }, 0);
    }, [quantities]);

    // Chênh lệch (Thừa / Thiếu / Khớp)
    const difference = useMemo(() => {
        return totalCounted - targetCash;
    }, [totalCounted, targetCash]);

    // Thay đổi số tờ của 1 mệnh giá
    const handleQtyChange = (denomVal: number, newQty: number) => {
        setQuantities(prev => ({
            ...prev,
            [denomVal]: Math.max(0, newQty)
        }));
    };

    // Tăng / giảm số tờ
    const handleAdjust = (denomVal: number, delta: number) => {
        setQuantities(prev => {
            const current = prev[denomVal] || 0;
            const updated = Math.max(0, current + delta);
            return {
                ...prev,
                [denomVal]: updated
            };
        });
    };

    // Định dạng tiền cần nộp khi gõ
    const handleTargetInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value.replace(/\D/g, '');
        const num = parseInt(rawValue, 10) || 0;
        setTargetCash(num);
        setTargetCashFormatted(num > 0 ? num.toLocaleString('vi-VN') : '0');
    };

    // Nút cộng nhanh tiền cần nộp (+1M, +2M, +5M, +10M)
    const handleQuickAddTarget = (amount: number) => {
        const updated = amount === 0 ? 0 : targetCash + amount;
        setTargetCash(updated);
        setTargetCashFormatted(updated > 0 ? updated.toLocaleString('vi-VN') : '0');
    };

    // Làm mới toàn bộ bảng đếm tiền
    const handleResetCounter = () => {
        const cleared: Record<number, number> = {};
        DENOMINATIONS.forEach(d => {
            cleared[d.val] = 0;
        });
        setQuantities(cleared);
        setTargetCash(0);
        setTargetCashFormatted('0');
        setAuditNote('');
        showToast('Đã làm mới bảng kiểm tiền về 0!', 'info');
    };

    // Lưu phiên kiểm tiền vào LocalStorage
    const handleSaveHistory = () => {
        if (totalCounted === 0 && targetCash === 0) {
            showToast('Vui lòng nhập số tờ hoặc số tiền cần nộp trước khi lưu!', 'error');
            return;
        }

        const now = new Date();
        const record: CashAuditRecord = {
            id: Date.now(),
            time: now.toLocaleString('vi-VN'),
            store_name: selectedStore.trim() || currentUser.store_name || 'Siêu thị',
            user_code: userNote.trim() || currentUser.employee_id || '',
            note: auditNote.trim() || 'Không có ghi chú',
            target: targetCash,
            total: totalCounted,
            diff: difference,
            details: { ...quantities },
            created_at: now.toISOString()
        };

        const updated = saveCashAuditRecord(record);
        setHistory(updated);
        showToast('Đã lưu lịch sử kiểm quỹ vào bộ nhớ máy (LocalStorage)!', 'success');
    };

    // Nạp lại dữ liệu từ 1 bản ghi lịch sử vào màn hình
    const handleLoadRecord = (record: CashAuditRecord) => {
        setTargetCash(record.target);
        setTargetCashFormatted(record.target.toLocaleString('vi-VN'));
        if (record.user_code) setUserNote(record.user_code);
        if (record.note) setAuditNote(record.note === 'Không có ghi chú' ? '' : record.note);
        if (record.store_name) setSelectedStore(record.store_name);

        const loadedQtys: Record<number, number> = {};
        DENOMINATIONS.forEach(d => {
            loadedQtys[d.val] = Number(record.details[d.val]) || 0;
        });
        setQuantities(loadedQtys);

        setIsHistoryOpen(false);
        showToast(`Đã nạp lại phiên kiểm tiền: ${record.time}!`, 'info');
    };

    // Xóa 1 bản ghi
    const handleDeleteRecord = (id: string | number) => {
        const updated = deleteCashAuditRecord(id);
        setHistory(updated);
        showToast('Đã xóa bản ghi kiểm tiền!', 'info');
    };

    // Xóa toàn bộ lịch sử
    const handleClearAllHistory = () => {
        if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử kiểm quỹ trên thiết bị không?')) {
            clearAllCashAuditHistory();
            setHistory([]);
            showToast('Đã xóa toàn bộ lịch sử kiểm quỹ!', 'info');
        }
    };

    // In lại từ lịch sử
    const handlePrintRecordFromHistory = (record: CashAuditRecord) => {
        setPrintModalRecord(record);
        setIsPrintModalOpen(true);
    };

    // Mở in phiếu hiện tại
    const handleOpenCurrentPrint = () => {
        setPrintModalRecord({
            id: 'current',
            time: new Date().toLocaleString('vi-VN'),
            store_name: selectedStore.trim() || currentUser.store_name || 'Siêu thị',
            user_code: userNote.trim() || 'N/A',
            note: auditNote.trim() || 'Không có ghi chú',
            target: targetCash,
            total: totalCounted,
            diff: difference,
            details: quantities
        });
        setIsPrintModalOpen(true);
    };

    // Sao chép báo cáo dạng text
    const handleCopyZaloReport = async () => {
        const activeRows = DENOMINATIONS.map(d => ({
            label: d.label,
            qty: quantities[d.val] || 0,
            sub: (quantities[d.val] || 0) * d.val
        })).filter(r => r.qty > 0);

        const diffStr = difference === 0
            ? '0 đ (Khớp hoàn toàn 🟢)'
            : (difference > 0
                ? `+${difference.toLocaleString('vi-VN')} đ (Dư / Thừa 🔵)`
                : `${difference.toLocaleString('vi-VN')} đ (Hụt / Thiếu 🔴)`);

        const lines = [
            `💵 [PHIẾU KIỂM QUỸ]`,
            `🏪 Siêu thị: ${selectedStore || currentUser.store_name || 'N/A'}`,
            `👤 Người kiểm: ${userNote || 'N/A'}`,
            ...(auditNote.trim() ? [`📝 Ghi chú: ${auditNote.trim()}`] : []),
            `⏰ Giờ kiểm: ${new Date().toLocaleString('vi-VN')}`,
            `----------------------------------`,
            ...activeRows.map(r => `• ${r.label}: ${r.qty} tờ = ${r.sub.toLocaleString('vi-VN')} đ`),
            `----------------------------------`,
            `📦 Tổng số tờ: ${totalBanknotes} tờ`,
            `💵 Thực tế đếm: ${totalCounted.toLocaleString('vi-VN')} đ`,
            `🎯 Cần nộp (Target): ${targetCash.toLocaleString('vi-VN')} đ`,
            `⚖️ Kết quả: ${diffStr}`
        ];

        try {
            await navigator.clipboard.writeText(lines.join('\n'));
            setCopiedZalo(true);
            showToast('Đã sao chép nội dung báo cáo kiểm quỹ!', 'success');
            setTimeout(() => setCopiedZalo(false), 2500);
        } catch {
            showToast('Không thể sao chép tự động, vui lòng thử lại!', 'error');
        }
    };

    // Sao chép TRỰC TIẾP HÌNH ẢNH PHIẾU THU vào Clipboard để dán Ctrl+V vào Zalo/Tin nhắn
    const handleCopyReceiptImage = async () => {
        if (!reportCaptureRef.current) return;
        setIsCopyingImage(true);
        try {
            const canvas = await generateStandardReportCanvas(reportCaptureRef.current, {
                targetWidth: 850
            });
            if (canvas) {
                const success = await copyReportCanvasToClipboard(canvas);
                if (success) {
                    setCopiedImage(true);
                    showToast('Đã sao chép ảnh phiếu vào clipboard! Bạn có thể dán (Ctrl+V) ngay vào Zalo.', 'success');
                    setTimeout(() => setCopiedImage(false), 2500);
                } else {
                    // Trình duyệt không hỗ trợ chép Blob image: tự động tải file ảnh về
                    showToast('Trình duyệt chưa hỗ trợ chép ảnh trực tiếp, đang tải file ảnh về máy...', 'info');
                    const nowStr = new Date().toISOString().slice(0, 10);
                    await downloadReportCanvas(canvas, `Phieu_Kiem_Quy_${nowStr}.png`);
                }
            } else {
                showToast('Không thể tạo ảnh phiếu kiểm, vui lòng thử lại!', 'error');
            }
        } catch (err) {
            console.error('Lỗi khi sao chép ảnh phiếu:', err);
            showToast('Đã xảy ra lỗi khi sao chép ảnh phiếu!', 'error');
        } finally {
            setIsCopyingImage(false);
        }
    };

    // Tải file ảnh phiếu thu PNG về máy
    const handleExportReceiptImage = async () => {
        if (!reportCaptureRef.current) return;
        setIsExportingImage(true);
        try {
            const canvas = await generateStandardReportCanvas(reportCaptureRef.current, {
                targetWidth: 850
            });
            if (canvas) {
                const nowStr = new Date().toISOString().slice(0, 10);
                await downloadReportCanvas(canvas, `Phieu_Kiem_Quy_${nowStr}.png`);
                showToast('Đã tải hình ảnh phiếu kiểm quỹ sắc nét về máy!', 'success');
            } else {
                showToast('Không thể tạo ảnh, vui lòng thử lại!', 'error');
            }
        } catch (err) {
            console.error('Lỗi khi xuất ảnh phiếu kiểm:', err);
            showToast('Đã xảy ra lỗi khi xuất ảnh!', 'error');
        } finally {
            setIsExportingImage(false);
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto px-2 sm:px-4 py-3 sm:py-6 space-y-3 sm:space-y-4 font-sans text-slate-800">
            {/* Vùng Báo Cáo & Kiểm Tiền (Toàn bộ chiều dọc tự nhiên, bao bọc bởi reportCaptureRef để xuất và copy ảnh) */}
            <div
                ref={reportCaptureRef}
                className="bg-white rounded-2xl shadow-sm border border-slate-200/90 overflow-hidden space-y-3 sm:space-y-4 p-3 sm:p-5"
            >
                {/* Header trang chức năng */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-200">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 sm:p-2.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl shadow-2xs shrink-0">
                            <Banknote className="w-5 h-5 sm:w-6 sm:h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                                    Kiểm Tiền & Kiểm Quỹ
                                </h1>
                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-emerald-600" />
                                    Hỗ trợ CVST
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                                Kiểm quỹ, Đếm số tờ tiền thực tế
                            </p>
                        </div>
                    </div>

                    {/* Nút thao tác đầu trang */}
                    <div className="flex items-center gap-1.5 flex-wrap self-end sm:self-auto" data-html2canvas-ignore="true" data-export-ignore="true">
                        <button
                            type="button"
                            onClick={handleCopyReceiptImage}
                            disabled={isCopyingImage}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 shadow-2xs flex items-center gap-1 transition cursor-pointer active:scale-95 disabled:opacity-50"
                            title="Sao chép hình ảnh phiếu để dán ngay (Ctrl+V) vào Zalo"
                        >
                            {copiedImage ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <CopyCheck className="w-3.5 h-3.5" />}
                            <span>{copiedImage ? 'Đã Chép Ảnh' : 'Copy Ảnh Phiếu'}</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setIsHistoryOpen(true)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-2xs flex items-center gap-1.5 transition cursor-pointer active:scale-95"
                            title="Xem lịch sử kiểm tiền đã lưu trên máy"
                        >
                            <History className="w-3.5 h-3.5" />
                            <span>Lịch Sử</span>
                            {history.length > 0 && (
                                <span className="text-[9.5px] bg-white/25 px-1 rounded-full font-mono">
                                    {history.length}
                                </span>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={handleResetCounter}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 shadow-2xs flex items-center gap-1.5 transition cursor-pointer active:scale-95"
                            title="Xóa toàn bộ số lượng tờ tiền về 0"
                        >
                            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                            <span>Làm Mới</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleCopyZaloReport}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 shadow-2xs flex items-center gap-1 transition cursor-pointer active:scale-95"
                            title="Sao chép nội dung báo cáo dạng chữ"
                        >
                            {copiedZalo ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedZalo ? 'Đã Chép' : 'Copy Text'}</span>
                        </button>
                    </div>
                </div>

                {/* Thông tin ca trực & Tiền cần nộp */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 bg-slate-50/70 p-3 rounded-xl border border-slate-200/80">
                    {/* Cột 1: Tiền cần nộp / doanh thu hệ thống */}
                    <div className="space-y-1">
                        <label className="text-[10.5px] font-bold text-slate-600 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3 text-indigo-600" />
                            Tiền Cần Nộp (VNĐ):
                        </label>
                        <div className="relative">
                            <input
                                type="text"
                                inputMode="numeric"
                                value={targetCashFormatted}
                                onChange={handleTargetInputChange}
                                onFocus={e => e.target.select()}
                                placeholder="0"
                                className="w-full h-10 px-3 pr-7 border border-slate-300 rounded-lg text-sm sm:text-base font-mono font-black text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-2xs"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                                đ
                            </span>
                        </div>
                    </div>

                    {/* Cột 2: Siêu thị */}
                    <div className="space-y-1">
                        <label className="text-[10.5px] font-bold text-slate-600 flex items-center gap-1">
                            <Store className="w-3 h-3 text-indigo-600" />
                            Siêu Thị:
                        </label>
                        <input
                            type="text"
                            value={selectedStore}
                            onChange={e => setSelectedStore(e.target.value)}
                            placeholder="Ví dụ: ĐMX Tân Bình"
                            className="w-full h-10 px-3 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-2xs"
                        />
                    </div>

                    {/* Cột 3: User Kiểm Quỹ */}
                    <div className="space-y-1">
                        <label className="text-[10.5px] font-bold text-slate-600 flex items-center gap-1">
                            <User className="w-3 h-3 text-indigo-600" />
                            User Kiểm Quỹ:
                        </label>
                        <input
                            type="text"
                            value={userNote}
                            onChange={e => setUserNote(e.target.value)}
                            placeholder="Ví dụ: 12345 - Nguyễn Văn A"
                            className="w-full h-10 px-3 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-2xs"
                        />
                    </div>

                    {/* Cột 4: Ghi chú (nếu có) */}
                    <div className="space-y-1">
                        <label className="text-[10.5px] font-bold text-slate-600 flex items-center gap-1">
                            <FileText className="w-3 h-3 text-indigo-600" />
                            Ghi Chú (nếu có):
                        </label>
                        <input
                            type="text"
                            value={auditNote}
                            onChange={e => setAuditNote(e.target.value)}
                            placeholder="Ví dụ: Bàn giao ca, tiền lẻ..."
                            className="w-full h-10 px-3 border border-slate-300 rounded-lg text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-2xs"
                        />
                    </div>
                </div>

                {/* Danh sách các mệnh giá tiền Việt Nam */}
                <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 px-2 pb-1 border-b border-slate-100">
                        <span>Mệnh giá</span>
                        <span className="text-center">Số tờ đếm được</span>
                        <span className="text-right">Thành tiền</span>
                    </div>

                    {DENOMINATIONS.map(denom => (
                        <DenominationRow
                            key={denom.val}
                            item={denom}
                            qty={quantities[denom.val] || 0}
                            onQtyChange={handleQtyChange}
                            onAdjust={handleAdjust}
                        />
                    ))}
                </div>

                {/* Khối Tổng kết & Chênh lệch (KPI Summary Card) */}
                <div className="pt-2 border-t border-slate-200 space-y-3">
                    <div className="bg-gradient-to-br from-indigo-50/90 via-slate-50 to-indigo-50/50 p-3.5 sm:p-4 rounded-xl border border-indigo-100 space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <span className="p-1 bg-indigo-600 text-white rounded-md">
                                    <Coins className="w-4 h-4" />
                                </span>
                                <span className="text-xs sm:text-sm font-black text-slate-800">
                                    Tổng Tiền Thực Tế Đếm Được:
                                </span>
                            </div>
                            <b className="text-base sm:text-xl font-mono font-black text-indigo-950">
                                {totalCounted.toLocaleString('vi-VN')} đ
                            </b>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-indigo-100/80">
                            <div className="flex justify-between items-center text-slate-600">
                                <span>Tiền cần nộp (Target):</span>
                                <b className="font-mono text-slate-800 font-bold">
                                    {targetCash.toLocaleString('vi-VN')} đ
                                </b>
                            </div>
                            <div className="flex justify-between items-center text-slate-600">
                                <span>Tổng số tờ tiền:</span>
                                <b className="font-mono text-slate-800 font-bold">
                                    {totalBanknotes.toLocaleString('vi-VN')} tờ
                                </b>
                            </div>
                        </div>

                        {/* Banner Trạng thái chênh lệch */}
                        <div className="pt-1.5 border-t border-indigo-100/80 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700">
                                Kết Quả Chênh Lệch (Thừa / Thiếu):
                            </span>
                            {difference === 0 ? (
                                <span className="inline-flex items-center gap-1 text-xs sm:text-sm font-black text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-lg border border-emerald-200 shadow-2xs">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    Khớp Hoàn Toàn (0 đ)
                                </span>
                            ) : difference > 0 ? (
                                <span className="inline-flex items-center gap-1 text-xs sm:text-sm font-black text-blue-700 bg-blue-100/80 px-2.5 py-1 rounded-lg border border-blue-200 shadow-2xs">
                                    <ArrowUpRight className="w-4 h-4 text-blue-600" />
                                    Dư / Thừa +{difference.toLocaleString('vi-VN')} đ
                                </span>
                            ) : (
                                <span className="inline-flex items-center gap-1 text-xs sm:text-sm font-black text-rose-700 bg-rose-100/80 px-2.5 py-1 rounded-lg border border-rose-200 shadow-2xs">
                                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                                    Hụt / Thiếu {difference.toLocaleString('vi-VN')} đ
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Các nút bấm hành động cốt lõi */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1" data-html2canvas-ignore="true" data-export-ignore="true">
                        <button
                            type="button"
                            onClick={handleSaveHistory}
                            className="py-2.5 sm:py-3 px-3 rounded-xl text-xs sm:text-sm font-black text-white bg-indigo-600 hover:bg-indigo-700 active:scale-98 shadow-sm flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                            <Save className="w-4 h-4 shrink-0" />
                            <span>Lưu Lịch Sử</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleOpenCurrentPrint}
                            className="py-2.5 sm:py-3 px-3 rounded-xl text-xs sm:text-sm font-black text-white bg-emerald-600 hover:bg-emerald-700 active:scale-98 shadow-sm flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                            <Printer className="w-4 h-4 shrink-0" />
                            <span>In Khổ 80mm</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleCopyReceiptImage}
                            disabled={isCopyingImage}
                            className="py-2.5 sm:py-3 px-3 rounded-xl text-xs sm:text-sm font-black text-indigo-700 bg-indigo-50 hover:bg-indigo-100 active:scale-98 border border-indigo-200 shadow-2xs flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                        >
                            {copiedImage ? <Check className="w-4 h-4 text-emerald-600 shrink-0" /> : <CopyCheck className="w-4 h-4 text-indigo-600 shrink-0" />}
                            <span>{isCopyingImage ? 'Đang Chép...' : (copiedImage ? 'Đã Chép Ảnh' : 'Copy Ảnh Phiếu')}</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleExportReceiptImage}
                            disabled={isExportingImage}
                            className="py-2.5 sm:py-3 px-3 rounded-xl text-xs sm:text-sm font-black text-slate-800 bg-slate-100 hover:bg-slate-200 active:scale-98 border border-slate-300 shadow-2xs flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                        >
                            <Download className="w-4 h-4 text-slate-600 shrink-0" />
                            <span>{isExportingImage ? 'Đang Tạo...' : 'Tải Ảnh Phiếu'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Toast thông báo nhanh */}
            {toastMessage && (
                <div className="fixed bottom-5 right-5 z-50 animate-bounce duration-300" data-html2canvas-ignore="true" data-export-ignore="true">
                    <div className={`px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold text-white flex items-center gap-2 ${toastMessage.type === 'success'
                        ? 'bg-emerald-600'
                        : (toastMessage.type === 'error' ? 'bg-rose-600' : 'bg-slate-800')
                        }`}>
                        {toastMessage.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                        <span>{toastMessage.text}</span>
                    </div>
                </div>
            )}

            {/* Modal Lịch Sử (Thuần LocalStorage) */}
            <CashHistoryModal
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
                history={history}
                onLoadRecord={handleLoadRecord}
                onDeleteRecord={handleDeleteRecord}
                onClearAll={handleClearAllHistory}
                onPrintRecord={handlePrintRecordFromHistory}
            />

            {/* Modal In Phiếu 80mm */}
            {printModalRecord && (
                <CashReceiptPrintModal
                    isOpen={isPrintModalOpen}
                    onClose={() => setIsPrintModalOpen(false)}
                    storeName={printModalRecord.store_name || selectedStore}
                    userNote={printModalRecord.user_code || userNote}
                    customNote={printModalRecord.note || auditNote}
                    targetCash={printModalRecord.target}
                    totalCounted={printModalRecord.total}
                    difference={printModalRecord.diff}
                    details={printModalRecord.details}
                    printTime={printModalRecord.time}
                />
            )}
        </div>
    );
}
