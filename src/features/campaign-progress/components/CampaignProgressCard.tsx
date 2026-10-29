import React, { useRef, useState, useMemo } from 'react';
import html2canvas from 'html2canvas';
import { calculate8KScale } from '../../../shared/utils/exportImage';
import { Zap, Camera, Copy, CheckCircle2, Sparkles } from 'lucide-react';
import type { CampaignProgressItem } from '../types';
import { formatRemainingTarget, cleanEmployeeName, getShortenedEmployeeName } from '../../../core/lib/formatters';
import ReportActionButtons, { type AssessmentTemplate } from '../../../shared/components/report/ReportActionButtons';

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

    // Chiều rộng badge mã nhân viên tự động thích ứng theo mã dài nhất trong bảng để thẳng cột thẳng lề
    const maxIdLength = useMemo(() => {
        if (!item.employees || item.employees.length === 0) return 6;
        return Math.max(6, ...item.employees.map(e => String(e.employeeId || '').trim().length));
    }, [item.employees]);

    // Tự động nhận diện nếu dữ liệu có số thập phân (như trong ảnh mẫu: 100,5; 56,9; 0,0)
    const hasDecimals =
        item.totalTarget % 1 !== 0 ||
        item.totalActual % 1 !== 0 ||
        item.employees.some(e => e.target % 1 !== 0 || e.actual % 1 !== 0);

    // 1. Sao chép hình ảnh báo cáo của riêng bảng này vào Clipboard chuẩn 8K
    const handleCopyCardImage = async () => {
        if (!cardRef.current) return;
        setIsCopyingImage(true);

        try {
            const scale = calculate8KScale(cardRef.current);
            const canvas = await html2canvas(cardRef.current, {
                scale: scale,
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
                    link.download = `Tien_Do_${cleanName}_${reportDateDisplay}_8K.png`;
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

    // 2. Xuất hình ảnh báo cáo riêng lẻ cho bảng thi đua này tải về máy chuẩn 8K
    const handleExportSingle = async () => {
        if (!cardRef.current) return;
        setIsExportingSingle(true);

        try {
            const scale = calculate8KScale(cardRef.current);
            const canvas = await html2canvas(cardRef.current, {
                scale: scale,
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
            link.download = `Tien_Do_${cleanName}_${reportDateDisplay}_8K.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        } catch (err) {
            console.error('Lỗi xuất ảnh riêng lẻ:', err);
            alert('Không thể xuất ảnh cho bảng này. Vui lòng thử lại.');
        } finally {
            setIsExportingSingle(false);
        }
    };

    // 3 Mẫu nhận xét chuẩn tự động cho bảng thi đua này
    const assessmentTemplates = useMemo<AssessmentTemplate[]>(() => {
        const storeDisplay = storeName === 'all' ? 'Toàn Cụm Siêu Thị' : storeName;
        const sorted = [...(item.employees || [])].sort((a, b) => b.forecastRate - a.forecastRate || b.actual - a.actual);
        const topEmployees = sorted.filter(e => e.isAchieved || e.forecastRate >= 100).slice(0, 3);
        const underperformingEmployees = [...(item.employees || [])]
            .filter(e => e.forecastRate < 80)
            .sort((a, b) => a.forecastRate - b.forecastRate || a.actual - b.actual);

        // Mẫu 1: Tổng quan tiến độ
        const m1 = [
            `📢 [TIẾN ĐỘ THI ĐUA: ${item.displayName.toUpperCase()}]`,
            `📅 Luỹ kế: ${reportDateDisplay} • 🏢 ${storeDisplay}`,
            `----------------------------------------`,
            `🎯 SIÊU THỊ:`,
            `• Target: ${item.totalTarget.toLocaleString('vi-VN')} ${item.unit}`,
            `• Lũy kế: ${item.totalActual.toLocaleString('vi-VN')} ${item.unit}`,
            `• %DKHT: ${item.forecastRate}% [${item.isAchieved ? '🟢 ĐÃ ĐẠT TIẾN ĐỘ' : '🔴 CHƯA ĐẠT - CẦN TĂNG TỐC'}]`,
            `• Tỷ lệ NV đạt: ${item.achievedEmployees}/${item.totalEmployees} bạn (${item.employeeAchieveRate}%)`,
            `----------------------------------------`,
            item.isAchieved ? `💪 Duy trì phong độ để về đích trọn vẹn!` : `🔥 Toàn team tập trung đẩy số nhóm này!`
        ].join('\n');

        // Mẫu 2: Top & Cần tăng tốc
        const m2Lines = [
            `🌟 [VINH DANH & CẢNH BÁO TIẾN ĐỘ: ${item.displayName.toUpperCase()}]`,
            `🏢 ${storeDisplay} • 📅 ${reportDateDisplay}`,
            `----------------------------------------`
        ];
        if (topEmployees.length > 0) {
            m2Lines.push(`🥇 TOP NHÂN VIÊN XUẤT SẮC:`);
            topEmployees.forEach((emp, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
                m2Lines.push(`${medal} ${emp.displayName}: ${emp.actual}/${emp.target} (${emp.forecastRate}%)`);
            });
            m2Lines.push(``);
        }
        if (underperformingEmployees.length > 0) {
            m2Lines.push(`🚨 CÁC BẠN CẦN TĂNG TỐC GẤP:`);
            underperformingEmployees.forEach(emp => {
                m2Lines.push(`⚠️ ${emp.displayName}: ${emp.actual}/${emp.target} (${emp.forecastRate}% • Thiếu ${emp.remaining} ${item.unit})`);
            });
            m2Lines.push(``);
        }
        m2Lines.push(`👉 Các bạn chưa đạt chủ động tư vấn khách để hoàn thành chỉ tiêu!`);

        // Mẫu 3: Kế hoạch hành động
        const remainingGap = Math.max(0, item.totalTarget - item.totalActual);
        const m3 = [
            `⚡ [KẾ HOẠCH HÀNH ĐỘNG HỐI SỐ: ${item.displayName.toUpperCase()}]`,
            `🎯 Mục tiêu còn thiếu: ${remainingGap.toLocaleString('vi-VN')} ${item.unit}`,
            `----------------------------------------`,
            `1. Rà soát từng khách hàng tiềm năng trong ngày.`,
            `2. Giới thiệu kèm CTKM khi tư vấn sản phẩm chính.`,
            `3. Quản lý kèm cặp trực tiếp các bạn còn thiếu số.`,
            `----------------------------------------`,
            `🚀 Quyết tâm 100% nhân viên về đích nhóm hàng ${item.displayName}!`
        ].join('\n');

        return [
            {
                id: 'template_progress',
                label: 'Mẫu 1: Tổng quan tiến độ',
                description: 'Tóm tắt chỉ tiêu, tỷ lệ dự kiến và tỷ lệ nhân viên đạt',
                content: m1
            },
            {
                id: 'template_top_acceleration',
                label: 'Mẫu 2: Top & Tăng tốc',
                description: 'Vinh danh Top dẫn đầu và nhắc nhở nhân sự cần hỗ trợ',
                content: m2Lines.join('\n')
            },
            {
                id: 'template_action_plan',
                label: 'Mẫu 3: Kế hoạch hành động',
                description: 'Checklist hành động hối số và đôn đốc tư vấn',
                content: m3
            }
        ];
    }, [item, reportDateDisplay, storeName]);

    return (
        <div
            ref={cardRef}
            data-campaign-card-key={item.campaignKey}
            className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-5 shadow-xs max-w-4xl mx-auto transition-all font-avo"
        >
            {/* Thanh công cụ phụ: Cụm button chuẩn ReportActionButtons (Ẩn khi chụp ảnh html2canvas) */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5" data-html2canvas-ignore="true">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">
                    Bảng theo dõi nhóm hàng
                </span>

                <div className="flex items-center gap-1.5 flex-wrap ml-auto">
                    <ReportActionButtons
                        onExportImage={handleExportSingle}
                        onCopyImage={handleCopyCardImage}
                        isExporting={isExportingSingle}
                        isCopyingImage={isCopyingImage}
                        copySuccess={copySuccess}
                        assessmentTemplates={assessmentTemplates}
                        reportTitle={`Tiến độ thi đua: ${item.displayName}`}
                        periodLabel={reportDateDisplay}
                        storeName={storeName}
                        exportLabel="Tải ảnh"
                        copyLabel="Copy ảnh"
                    />
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

                                        {/* TÊN NHÂN VIÊN */}
                                        <td className="text-left py-2.5 px-3 whitespace-nowrap">
                                            <div className="flex items-center gap-2 whitespace-nowrap">
                                                <span
                                                    style={{ minWidth: `${maxIdLength + 2.2}ch`, width: `${maxIdLength + 2.2}ch` }}
                                                    className="font-mono font-bold text-xs px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 inline-block text-center leading-normal shrink-0"
                                                >
                                                    {emp.employeeId}
                                                </span>
                                                <span
                                                    title={`Mã NV: ${emp.employeeId} - ${cleanEmployeeName(emp.fullName || emp.displayName)}`}
                                                    className={`font-bold text-xs sm:text-sm tracking-tight cursor-default ${
                                                        isAchieved ? 'text-slate-900' : 'text-rose-600'
                                                    }`}
                                                >
                                                    {getShortenedEmployeeName(emp.fullName || emp.displayName)}
                                                </span>
                                            </div>
                                        </td>

                                        {/* TARGET */}
                                        <td className="text-right font-black text-slate-900 py-2.5 px-3 font-mono">
                                            {formatVnComma(emp.target, hasDecimals)}
                                        </td>

                                        {/* LUỸ KẾ */}
                                        <td className="text-right font-black text-rose-600 py-2.5 px-3 font-mono">
                                            <div className="flex items-center justify-end gap-1">
                                                <span>{formatVnComma(emp.actual, hasDecimals)}</span>
                                                {emp.offsetAdjustment ? (
                                                    <span
                                                        className={`text-[9.5px] px-1 py-0.2 rounded font-bold shrink-0 ${
                                                            emp.offsetAdjustment > 0
                                                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                                                        }`}
                                                        title={
                                                            emp.offsetAdjustment > 0
                                                                ? `Gốc: ${emp.rawActual ?? emp.actual} • Được cấn bù +${emp.offsetAdjustment} từ ngành khác`
                                                                : `Gốc: ${emp.rawActual ?? emp.actual} • Đã chuyển bớt ${emp.offsetAdjustment} sang ngành khác`
                                                        }
                                                    >
                                                        {emp.offsetAdjustment > 0 ? `+${emp.offsetAdjustment}` : emp.offsetAdjustment}
                                                    </span>
                                                ) : null}
                                            </div>
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
        </div>
    );
}
