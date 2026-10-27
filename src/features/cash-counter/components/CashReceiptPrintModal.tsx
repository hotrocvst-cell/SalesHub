import React, { useState, useRef } from 'react';
import { Printer, X, Copy, Check, CopyCheck } from 'lucide-react';
import html2canvas from 'html2canvas';
import { DENOMINATIONS } from '../types';

interface CashReceiptPrintModalProps {
    isOpen: boolean;
    onClose: () => void;
    storeName: string;
    userNote: string;
    customNote?: string;
    targetCash: number;
    totalCounted: number;
    difference: number;
    details: Record<number | string, number>;
    printTime?: string;
}

export const CashReceiptPrintModal: React.FC<CashReceiptPrintModalProps> = ({
    isOpen,
    onClose,
    storeName,
    userNote,
    customNote,
    targetCash,
    totalCounted,
    difference,
    details,
    printTime = new Date().toLocaleString('vi-VN')
}) => {
    const [copied, setCopied] = useState(false);
    const [copiedBill, setCopiedBill] = useState(false);
    const [isCopyingBill, setIsCopyingBill] = useState(false);
    const billPaperRef = useRef<HTMLDivElement>(null);

    if (!isOpen) return null;

    const activeRows = DENOMINATIONS.map(d => ({
        label: d.label,
        val: d.val,
        qty: Number(details[d.val]) || 0,
        sub: (Number(details[d.val]) || 0) * d.val
    })).filter(r => r.qty > 0);

    const totalBanknotes = activeRows.reduce((sum, r) => sum + r.qty, 0);

    const diffText = difference === 0
        ? '0 đ (Khớp hoàn toàn)'
        : (difference > 0
            ? `+${difference.toLocaleString('vi-VN')} đ (Dư / Thừa)`
            : `${difference.toLocaleString('vi-VN')} đ (Hụt / Thiếu)`);

    const handlePrintDirect = () => {
        const rowsHtml = activeRows.length > 0
            ? activeRows.map(r => `
                <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                    <span style="width: 35%; text-align: left;">${r.label}</span>
                    <span style="width: 25%; text-align: center;">x${r.qty}</span>
                    <span style="width: 40%; text-align: right; font-weight: bold;">${r.sub.toLocaleString('vi-VN')} đ</span>
                </div>
            `).join('')
            : '<div style="text-align: center; color: #666;">Chưa có tờ tiền nào được ghi nhận</div>';

        const printHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8" />
                <title>Phiếu Kiểm Quỹ - ${storeName || 'SalesHub'}</title>
                <style>
                    @page {
                        size: 80mm auto;
                        margin: 0;
                    }
                    body {
                        margin: 0;
                        padding: 6mm 4mm;
                        font-family: 'Courier New', Courier, monospace, 'Roboto', sans-serif;
                        font-size: 11.5px;
                        color: #000000;
                        line-height: 1.35;
                        width: 72mm;
                        box-sizing: border-box;
                    }
                    .text-center { text-align: center; }
                    .text-right { text-align: right; }
                    .bold { font-weight: bold; }
                    .dashed-line { border-bottom: 1px dashed #000; margin: 5px 0; }
                    .flex-between { display: flex; justify-content: space-between; }
                </style>
            </head>
            <body>
                <div class="text-center bold" style="font-size: 14px; text-transform: uppercase;">PHIẾU KIỂM QUỸ CA TRỰC</div>
                <div class="text-center bold" style="font-size: 12px; margin-top: 1px;">${storeName || 'SIÊU THỊ SALES HUB'}</div>
                <div class="text-center" style="font-size: 10px; margin-top: 2px; color: #333;">Thời gian in: ${printTime}</div>
                
                <div class="dashed-line"></div>
                <div class="flex-between bold">
                    <span style="width: 35%;">Mệnh giá</span>
                    <span style="width: 25%; text-align: center;">Số tờ</span>
                    <span style="width: 40%; text-align: right;">Thành tiền</span>
                </div>
                <div class="dashed-line"></div>

                ${rowsHtml}

                <div class="dashed-line"></div>
                <div class="flex-between">
                    <span>Tổng số tờ:</span>
                    <b class="bold">${totalBanknotes.toLocaleString('vi-VN')} tờ</b>
                </div>
                <div class="flex-between" style="margin-top: 3px;">
                    <span>Tiền thực tế đếm:</span>
                    <b class="bold" style="font-size: 12.5px;">${totalCounted.toLocaleString('vi-VN')} đ</b>
                </div>
                <div class="flex-between" style="margin-top: 3px;">
                    <span>Tiền cần nộp (Target):</span>
                    <b class="bold">${targetCash.toLocaleString('vi-VN')} đ</b>
                </div>
                <div class="flex-between bold" style="margin-top: 5px; font-size: 12px;">
                    <span>➜ Kết quả chênh lệch:</span>
                    <span>${diffText}</span>
                </div>

                <div class="dashed-line"></div>
                <div style="font-size: 10.5px; margin-bottom: 14px;">
                    <div><b>Người kiểm:</b> ${userNote || 'N/A'}</div>
                    ${customNote && customNote !== 'Không có ghi chú' ? `<div style="margin-top: 2px;"><b>Ghi chú:</b> ${customNote}</div>` : ''}
                </div>

                <div style="display: flex; justify-content: space-between; text-align: center; font-size: 10.5px; margin-top: 10px;">
                    <div style="width: 48%;">
                        <b>Người kiểm quỹ</b><br/>
                        <span style="font-size: 9px; font-style: italic;">(Ký và ghi rõ họ tên)</span>
                        <div style="height: 38px;"></div>
                    </div>
                    <div style="width: 48%;">
                        <b>Quản lý / Trưởng ca</b><br/>
                        <span style="font-size: 9px; font-style: italic;">(Ký và ghi rõ họ tên)</span>
                        <div style="height: 38px;"></div>
                    </div>
                </div>
            </body>
            </html>
        `;

        const win = window.open('', '_blank', 'height=650,width=400');
        if (win) {
            win.document.open();
            win.document.write(printHtml);
            win.document.close();
            win.focus();
            setTimeout(() => {
                win.print();
                win.close();
            }, 350);
        } else {
            // Fallback nếu trình duyệt chặn popup: tạo iframe ẩn
            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = '0';
            document.body.appendChild(iframe);
            const doc = iframe.contentWindow?.document;
            if (doc) {
                doc.open();
                doc.write(printHtml);
                doc.close();
                iframe.contentWindow?.focus();
                setTimeout(() => {
                    iframe.contentWindow?.print();
                    document.body.removeChild(iframe);
                }, 350);
            }
        }
    };

    const handleCopyText = async () => {
        const textLines = [
            `💵 [PHIẾU KIỂM QUỸ CA TRỰC] - ${storeName || 'SalesHub'}`,
            `⏰ Thời gian: ${printTime}`,
            `👤 Người kiểm: ${userNote || 'Chưa ghi chú'}`,
            ...(customNote && customNote !== 'Không có ghi chú' ? [`📝 Ghi chú: ${customNote}`] : []),
            `-----------------------------------`,
            ...activeRows.map(r => `${r.label}: ${r.qty} tờ = ${r.sub.toLocaleString('vi-VN')} đ`),
            `-----------------------------------`,
            `💰 Tổng tờ: ${totalBanknotes} tờ`,
            `💵 Tiền thực tế: ${totalCounted.toLocaleString('vi-VN')} đ`,
            `🎯 Tiền cần nộp: ${targetCash.toLocaleString('vi-VN')} đ`,
            `⚖️ Chênh lệch: ${diffText}`
        ];
        try {
            await navigator.clipboard.writeText(textLines.join('\n'));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {}
    };

    const handleCopyBillImage = async () => {
        if (!billPaperRef.current) return;
        setIsCopyingBill(true);
        try {
            const canvas = await html2canvas(billPaperRef.current, {
                scale: 3,
                useCORS: true,
                backgroundColor: '#ffffff'
            });
            const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
            if (blob && navigator.clipboard && window.ClipboardItem) {
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                setCopiedBill(true);
                setTimeout(() => setCopiedBill(false), 2500);
            } else if (canvas) {
                const url = canvas.toDataURL('image/png');
                const a = document.createElement('a');
                a.download = `Phieu_Kiem_Quy_80mm_${Date.now()}.png`;
                a.href = url;
                a.click();
                setCopiedBill(true);
                setTimeout(() => setCopiedBill(false), 2500);
            }
        } catch (err) {
            console.error('Lỗi khi chép ảnh bill:', err);
        } finally {
            setIsCopyingBill(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
                {/* Modal Header */}
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                            <Printer className="w-4 h-4" />
                        </span>
                        <div>
                            <h3 className="text-xs sm:text-sm font-black text-slate-800">
                                Xem Trước Phiếu In Khổ 80mm
                            </h3>
                            <p className="text-[10px] text-slate-500">
                                Chuẩn in nhiệt POS 72mm-80mm (Khổ hoá đơn siêu thị)
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Bill Paper Preview */}
                <div className="p-4 overflow-y-auto flex-1 bg-slate-100/70 flex justify-center">
                    <div
                        ref={billPaperRef}
                        className="bg-white border border-slate-300 shadow-sm p-3.5 sm:p-4 w-[280px] sm:w-[310px] text-[11px] font-mono text-slate-900 leading-snug rounded-sm"
                    >
                        <div className="text-center font-bold text-xs uppercase text-slate-900">
                            PHIẾU KIỂM QUỸ CA TRỰC
                        </div>
                        <div className="text-center font-bold text-[11px] text-slate-800 mt-0.5">
                            {storeName || 'SIÊU THỊ SALES HUB'}
                        </div>
                        <div className="text-center text-[10px] text-slate-500 mt-0.5">
                            Ngày in: {printTime}
                        </div>

                        <div className="border-b border-dashed border-slate-400 my-2" />

                        <div className="flex justify-between font-bold text-[10.5px]">
                            <span className="w-1/3">Mệnh giá</span>
                            <span className="w-1/4 text-center">Số tờ</span>
                            <span className="w-5/12 text-right">Thành tiền</span>
                        </div>

                        <div className="border-b border-dashed border-slate-300 my-1" />

                        <div className="space-y-1">
                            {activeRows.length === 0 ? (
                                <div className="text-center py-2 text-slate-400 italic">
                                    Chưa có tờ tiền nào
                                </div>
                            ) : (
                                activeRows.map(r => (
                                    <div key={r.val} className="flex justify-between">
                                        <span className="w-1/3 text-slate-700">{r.label}</span>
                                        <span className="w-1/4 text-center font-bold text-slate-800">x{r.qty}</span>
                                        <span className="w-5/12 text-right font-bold text-slate-900">{r.sub.toLocaleString('vi-VN')}đ</span>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="border-b border-dashed border-slate-400 my-2" />

                        <div className="flex justify-between text-slate-600">
                            <span>Tổng số tờ:</span>
                            <b className="text-slate-900">{totalBanknotes} tờ</b>
                        </div>
                        <div className="flex justify-between text-slate-700 mt-1">
                            <span>Tiền thực tế:</span>
                            <b className="text-indigo-900 font-black text-xs">{totalCounted.toLocaleString('vi-VN')} đ</b>
                        </div>
                        <div className="flex justify-between text-slate-700 mt-1">
                            <span>Tiền cần nộp:</span>
                            <b className="text-slate-900">{targetCash.toLocaleString('vi-VN')} đ</b>
                        </div>
                        <div className="flex justify-between font-bold mt-1.5 pt-1 border-t border-slate-200">
                            <span>➜ Kết quả:</span>
                            <span className={difference === 0 ? 'text-emerald-700' : (difference > 0 ? 'text-blue-700' : 'text-rose-700')}>
                                {diffText}
                            </span>
                        </div>

                        <div className="border-t border-dashed border-slate-400 mt-2.5 pt-1.5 text-[10px] text-slate-600 space-y-0.5">
                            <div><b>Người kiểm:</b> {userNote || 'N/A'}</div>
                            {customNote && customNote !== 'Không có ghi chú' && (
                                <div><b>Ghi chú:</b> {customNote}</div>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-center text-[10px] mt-4 pt-1">
                            <div>
                                <b className="text-slate-800">Người kiểm</b>
                                <div className="text-[9px] text-slate-400 italic">(Ký ghi rõ họ tên)</div>
                                <div className="h-8"></div>
                            </div>
                            <div>
                                <b className="text-slate-800">Trưởng ca / QL</b>
                                <div className="text-[9px] text-slate-400 italic">(Ký ghi rõ họ tên)</div>
                                <div className="h-8"></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modal Actions */}
                <div className="px-4 py-3 bg-white border-t border-slate-200 flex flex-wrap justify-between items-center gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                            type="button"
                            onClick={handleCopyBillImage}
                            disabled={isCopyingBill}
                            className="px-3 py-2 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                        >
                            {copiedBill ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <CopyCheck className="w-3.5 h-3.5 text-indigo-600" />}
                            <span>{isCopyingBill ? 'Đang Chép...' : (copiedBill ? 'Đã Chép Ảnh' : 'Copy Ảnh Phiếu')}</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleCopyText}
                            className="px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 flex items-center gap-1.5 transition cursor-pointer"
                        >
                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copied ? 'Đã chép text' : 'Sao chép dạng Text'}</span>
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                        >
                            Đóng
                        </button>
                        <button
                            type="button"
                            onClick={handlePrintDirect}
                            className="px-4 py-2 rounded-xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm flex items-center gap-1.5 transition cursor-pointer"
                        >
                            <Printer className="w-3.5 h-3.5" />
                            In Ra Máy In Nhiệt
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
