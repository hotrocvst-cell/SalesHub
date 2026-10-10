import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Zap, Camera, Copy, CheckCircle2, Sparkles } from 'lucide-react';
import type { CampaignProgressItem } from '../types';
import { formatRemainingTarget } from '../../../core/lib/formatters';
import CampaignProgressRemarkModal from './CampaignProgressRemarkModal';

interface Props {
    item: CampaignProgressItem;
    reportDateDisplay: string;
    storeName?: string;
}

// Hàm format số theo chuẩn Tiếng Việt (dấu chấm phân cách hàng nghìn, dấu phẩy phân cách thập phân)
function formatVnComma(num: number, forceDecimals: boolean): string {
    if (num === undefined || num === null || isNaN(num)) {
        return forceDecimals ? '0,0' : '0';
    }
    const isNeg = num < 0;
    const abs = Math.abs(num);
    const formattedStr = forceDecimals
        ? abs.toFixed(1)
        : (abs % 1 !== 0 ? abs.toFixed(1) : abs.toString());
    const [intPart, decPart] = formattedStr.split('.');
    const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const result = decPart !== undefined ? `${formattedInt},${decPart}` : formattedInt;
    return isNeg ? `-${result}` : result;
}

export default function CampaignProgressCard({ item, reportDateDisplay, storeName = 'Toàn Cụm' }: Props) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [isExportingSingle, setIsExportingSingle] = useState<boolean>(false);
    const [isCopyingImage, setIsCopyingImage] = useState<boolean>(false);
    const [copySuccess, setCopySuccess] = useState<boolean>(false);
    const [isRemarkModalOpen, setIsRemarkModalOpen] = useState<boolean>(false);

    // Tự động nhận diện nếu dữ liệu có số thập phân (như trong ảnh mẫu: 100,5; 56,9; 0,0)
    const hasDecimals =
        item.totalTarget % 1 !== 0 ||
        item.totalActual % 1 !== 0 ||
        item.employees.some(e => e.target % 1 !== 0 || e.actual % 1 !== 0);

    // 1. Sao chép hình ảnh báo cáo của riêng bảng này vào Clipboard
    const handleCopyCardImage = async () => {
        if (!cardRef.current) return;
        setIsCopyingImage(true);

        try {
            const canvas = await html2canvas(cardRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                ignoreElements: (el) =>
                    el.getAttribute('data-html2canvas-ignore') === 'true' ||
                    el.getAttribute('data-export-ignore') === 'true' ||
                    el.getAttribute('data-freshness-bar') === 'true',
                onclone: (clonedDoc) => {
                    clonedDoc.querySelectorAll('[data-html2canvas-ignore="true"], [data-export-ignore="true"], [data-freshness-bar="true"]').forEach(el => {
                        (el as HTMLElement).remove();
                    });
                    clonedDoc.documentElement.style.height = 'auto';
                    clonedDoc.body.style.height = 'auto';
                }
            });

            canvas.toBlob(async (blob) => {
                if (!blob) throw new Error('Không thể tạo hình ảnh từ bảng');
                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    setCopySuccess(true);
                    setTimeout(() => setCopySuccess(false), 2500);
                } catch (clipErr) {
                    console.warn('Clipboard write image failed, falling back to download:', clipErr);
                    const link = document.createElement('a');
                    const cleanName = item.displayName.replace(/[^a-zA-Z0-9\u00C0-\u1EF9]/g, '_').slice(0, 35);
                    link.download = `Tien_Do_${cleanName}_${reportDateDisplay}.png`;
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                    setCopySuccess(true);
                    setTimeout(() => setCopySuccess(false), 2500);
                }
            }, 'image/png');
        } catch (err) {
            console.error('Lỗi sao chép ảnh riêng bảng:', err);
            alert('Không thể sao chép ảnh cho bảng này. Vui lòng thử lại.');
        } finally {
            setIsCopyingImage(false);
        }
    };

    // 2. Xuất hình ảnh báo cáo riêng lẻ cho bảng thi đua này tải về máy (Tuân thủ triệt để GEMINI.md)
    const handleExportSingle = async () => {
        if (!cardRef.current) return;
        setIsExportingSingle(true);

        try {
            const canvas = await html2canvas(cardRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                ignoreElements: (el) =>
                    el.getAttribute('data-html2canvas-ignore') === 'true' ||
                    el.getAttribute('data-export-ignore') === 'true' ||
                    el.getAttribute('data-freshness-bar') === 'true',
                onclone: (clonedDoc) => {
                    clonedDoc.querySelectorAll('[data-html2canvas-ignore="true"], [data-export-ignore="true"], [data-freshness-bar="true"]').forEach(el => {
                        (el as HTMLElement).remove();
                    });
                    clonedDoc.documentElement.style.height = 'auto';
                    clonedDoc.body.style.height = 'auto';
                }
            });

            const link = document.createElement('a');
            const cleanName = item.displayName.replace(/[^a-zA-Z0-9\u00C0-\u1EF9]/g, '_').slice(0, 35);
            link.download = `Tien_Do_${cleanName}_${reportDateDisplay}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            console.error('Lỗi xuất ảnh riêng lẻ:', err);
            alert('Không thể xuất ảnh cho bảng này. Vui lòng thử lại.');
        } finally {
            setIsExportingSingle(false);
        }
    };

    return (
        <div
            ref={cardRef}
            data-campaign-card-key={item.campaignKey}
            className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-5 shadow-xs max-w-4xl mx-auto transition-all font-avo"
        >
            {/* Thanh công cụ phụ: Nút Nhận xét, Copy ảnh, Tải ảnh (Ẩn khi chụp ảnh html2canvas) */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5" data-html2canvas-ignore="true">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">
                    Bảng theo dõi nhóm hàng
                </span>

                <div className="flex items-center gap-1.5 flex-wrap ml-auto">
                    {/* Nút 1: Nhận xét kết quả riêng bảng này */}
                    <button
                        type="button"
                        data-html2canvas-ignore="true"
                        onClick={() => setIsRemarkModalOpen(true)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 text-purple-800 border border-purple-200 text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
                        title="Phân tích, đánh giá và soạn tin nhắn nhận xét riêng cho nhóm hàng này gửi Messaging App"
                    >
                        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                        <span>Nhận xét</span>
                    </button>

                    {/* Nút 2: Copy ảnh vào clipboard */}
                    <button
                        type="button"
                        data-html2canvas-ignore="true"
                        onClick={handleCopyCardImage}
                        disabled={isCopyingImage}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50 ${
                            copySuccess
                                ? 'bg-emerald-600 text-white border border-emerald-600'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                        title="Sao chép ảnh bảng này vào bộ nhớ tạm để dán nhanh (Ctrl+V) vào nhóm chat Messaging App"
                    >
                        {copySuccess ? (
                            <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                                <span>Đã copy ảnh!</span>
                            </>
                        ) : (
                            <>
                                <Copy className="w-3.5 h-3.5 text-slate-600" />
                                <span>{isCopyingImage ? 'Đang copy...' : 'Copy ảnh'}</span>
                            </>
                        )}
                    </button>

                    {/* Nút 3: Tải ảnh riêng lẻ */}
                    <button
                        type="button"
                        data-html2canvas-ignore="true"
                        onClick={handleExportSingle}
                        disabled={isExportingSingle}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#005e43] border border-emerald-300 text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50"
                        title="Tải ảnh riêng lẻ của bảng thi đua này về máy"
                    >
                        <Camera className="w-3.5 h-3.5 text-emerald-700" />
                        <span>{isExportingSingle ? 'Đang tải...' : 'Tải ảnh'}</span>
                    </button>
                </div>
            </div>

            {/* 1. Header Banner Xanh Emerald với Tiêu Đề Vàng Rực Rỡ */}
            <div className="bg-[#057a55] rounded-2xl py-3.5 px-4 text-center shadow-xs">
                <h2 className="text-amber-300 font-black text-base sm:text-xl uppercase tracking-wide leading-tight">
                    {item.displayName}
                </h2>
                <p className="text-white font-semibold text-xs sm:text-sm mt-1 flex items-center justify-center gap-1.5 opacity-95">
                    <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300 shrink-0" />
                    <span>
                        Luỹ kế đến ngày: {reportDateDisplay} | NV Đạt: {item.achievedEmployees}/{item.totalEmployees} ({item.employeeAchieveRate}%)
                    </span>
                </p>
            </div>

            {/* 2. Bảng Tiến Độ Nhân Viên Tinh Gọn Chuẩn Mẫu */}
            <div className="mt-3.5 sm:mt-4 rounded-xl overflow-hidden border border-[#005e43] shadow-2xs">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm border-collapse font-avo">
                        {/* Table Header Xanh Đậm */}
                        <thead>
                            <tr className="bg-[#005e43] text-white uppercase font-black text-[11px] sm:text-xs tracking-wider select-none">
                                <th className="text-center py-2.5 px-2 w-12 sm:w-14">STT</th>
                                <th className="text-left py-2.5 px-3 min-w-[150px]">NHÂN VIÊN</th>
                                <th className="text-right py-2.5 px-3 w-20 sm:w-24">TARGET</th>
                                <th className="text-right py-2.5 px-3 w-20 sm:w-24">LUỸ KẾ</th>
                                <th className="text-center py-2.5 px-3 w-24 sm:w-28">%HT (DK)</th>
                                <th className="text-right py-2.5 px-3 w-20 sm:w-24">C.LẠI</th>
                            </tr>
                        </thead>

                        {/* Table Body */}
                        <tbody className="divide-y divide-slate-100 bg-white">
                            {/* ========================================================================= */}
                            {/* HÀNG TỔNG NẰM TRÊN ĐẦU */}
                            {/* ========================================================================= */}
                            <tr className="bg-[#005e43] text-white font-black text-xs sm:text-sm select-none border-b-2 border-emerald-950">
                                <td colSpan={2} className="py-2.5 px-3 text-center uppercase font-black tracking-widest text-amber-300">
                                    TỔNG CỘNG
                                </td>
                                <td className="py-2.5 px-3 text-right font-black text-white font-mono">
                                    {formatVnComma(item.totalTarget, hasDecimals)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-black text-white font-mono">
                                    {formatVnComma(item.totalActual, hasDecimals)}
                                </td>
                                <td className="py-2.5 px-3 text-center font-black text-white font-mono">
                                    <span className={`inline-block px-2.5 py-0.5 rounded-full font-black text-xs sm:text-sm min-w-[58px] text-center shadow-2xs ${item.forecastRate >= 100
                                            ? 'bg-[#d1fae5] text-[#065f46]'
                                            : 'bg-[#ffe4e6] text-[#be123c]'
                                        }`}>
                                        {item.forecastRate}%
                                    </span>
                                </td>
                                <td className="py-2.5 px-3 text-right font-black text-white font-mono">
                                    <span className={`inline-block px-2.5 py-0.5 rounded-full font-black text-xs sm:text-sm min-w-[62px] text-right shadow-2xs ${item.totalRemaining === 0
                                            ? 'bg-[#d1fae5] text-[#065f46]'
                                            : 'bg-[#ffe4e6] text-[#be123c]'
                                        }`}>
                                        {formatRemainingTarget(item.totalRemaining, false, hasDecimals)}
                                    </span>
                                </td>
                            </tr>

                            {/* DANH SÁCH CHI TIẾT TỪNG NHÂN VIÊN */}
                            {item.employees.map((emp, idx) => {
                                const isAchieved = emp.forecastRate >= 100;
                                const isTargetMet = emp.remaining === 0;

                                return (
                                    <tr
                                        key={emp.employeeId}
                                        className="hover:bg-emerald-50/20 transition-colors"
                                    >
                                        {/* STT */}
                                        <td className="text-center font-black text-slate-800 py-2.5 px-2 font-mono text-xs sm:text-sm">
                                            #{idx + 1}
                                        </td>

                                        {/* TÊN NHÂN VIÊN THEO CẤU HÌNH VIẾT TẮT */}
                                        <td className="text-left py-2.5 px-3">
                                            <span
                                                title={`Họ và tên: ${emp.fullName}`}
                                                className={`font-black text-xs sm:text-sm uppercase tracking-tight cursor-default ${
                                                    isAchieved ? 'text-slate-900' : 'text-rose-600'
                                                }`}
                                            >
                                                {emp.displayName}
                                            </span>
                                        </td>

                                        {/* TARGET */}
                                        <td className="text-right font-black text-slate-900 py-2.5 px-3 font-mono">
                                            {formatVnComma(emp.target, hasDecimals)}
                                        </td>

                                        {/* LUỸ KẾ */}
                                        <td className="text-right font-black text-rose-600 py-2.5 px-3 font-mono">
                                            {formatVnComma(emp.actual, hasDecimals)}
                                        </td>

                                        {/* %HT (DK) */}
                                        <td className="text-center py-2.5 px-3 font-mono">
                                            <span className={`inline-block px-2.5 py-0.5 rounded-full font-black text-xs sm:text-sm min-w-[58px] text-center shadow-2xs ${isAchieved
                                                    ? 'bg-[#d1fae5] text-[#065f46]'
                                                    : 'bg-[#ffe4e6] text-[#be123c]'
                                                }`}>
                                                {emp.forecastRate}%
                                            </span>
                                        </td>

                                        {/* C.LẠI */}
                                        <td className="text-right py-2.5 px-3 font-mono">
                                            <span className={`inline-block px-2.5 py-0.5 rounded-full font-black text-xs sm:text-sm min-w-[62px] text-right shadow-2xs ${isTargetMet
                                                    ? 'bg-[#d1fae5] text-[#065f46]'
                                                    : 'bg-[#ffe4e6] text-[#be123c]'
                                                }`}>
                                                {formatRemainingTarget(emp.remaining, false, hasDecimals)}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Nhận Xét Chi Tiết Bảng Thi Đua */}
            {isRemarkModalOpen && (
                <CampaignProgressRemarkModal
                    isOpen={isRemarkModalOpen}
                    onClose={() => setIsRemarkModalOpen(false)}
                    item={item}
                    reportDateDisplay={reportDateDisplay}
                    storeName={storeName}
                />
            )}
        </div>
    );
}
