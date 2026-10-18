import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { calculate8KScale } from '../../../shared/utils/exportImage';
import {
    Sparkles,
    Check,
    Copy,
    Download,
    Edit3,
    Trash2,
    Tag,
    Calculator,
    Compass,
    Gift,
    FileText,
    Boxes,
    Calendar,
    CheckCircle2
} from 'lucide-react';
import type { CampaignProgramItem } from '../types';
import FormattedCampaignText from './FormattedCampaignText';

interface Props {
    item: CampaignProgramItem;
    isSelected: boolean;
    showOpportunity?: boolean;
    onToggleSelect: (id: string) => void;
    onEdit: (item: CampaignProgramItem) => void;
    onDelete: (id: string, name: string) => void;
    canManage: boolean;
}

export default function CampaignProgramCard({
    item,
    isSelected,
    showOpportunity = true,
    onToggleSelect,
    onEdit,
    onDelete,
    canManage
}: Props) {
    const cardCaptureRef = useRef<HTMLDivElement>(null);
    const [isCopyingImage, setIsCopyingImage] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);
    const [copyTextSuccess, setCopyTextSuccess] = useState(false);

    // Huy hiệu nhóm thi đua
    const getGroupBadge = (group: string) => {
        const g = group.toUpperCase();
        if (g.includes('ICT')) return 'bg-blue-600 text-white';
        if (g.includes('CE')) return 'bg-amber-600 text-white';
        if (g.includes('DỊCH VỤ') || g.includes('DICH VU')) return 'bg-emerald-600 text-white';
        if (g.includes('PHỤ KIỆN') || g.includes('PHU KIEN')) return 'bg-purple-600 text-white';
        if (g.includes('GIA DỤNG') || g.includes('GIA DUNG')) return 'bg-teal-600 text-white';
        return 'bg-slate-700 text-white';
    };

    // Huy hiệu định hướng
    const getOrientationBadge = (orient: string) => {
        if (orient === 'Chính' || orient === 'Trọng tâm') {
            return 'bg-rose-100 text-rose-800 border-rose-300 font-black';
        }
        if (orient === 'Bán kèm') {
            return 'bg-purple-100 text-purple-800 border-purple-300 font-extrabold';
        }
        return 'bg-amber-100 text-amber-900 border-amber-300 font-bold';
    };

    // Huy hiệu cách tính
    const getCalcBadge = (calc: string) => {
        if (calc === 'DTQĐ' || calc === 'SLQĐ') {
            return 'bg-blue-50 text-blue-900 border-blue-200 font-black';
        }
        return 'bg-slate-100 text-slate-800 border-slate-300 font-bold';
    };

    // 1. Sao chép ảnh riêng thẻ này vào Clipboard chuẩn 8K (Tối ưu Mobile Portrait, không watermark)
    const handleCopyCardImage = async () => {
        if (!cardCaptureRef.current) return;
        setIsCopyingImage(true);
        try {
            const scale = calculate8KScale(cardCaptureRef.current, 720);
            const canvas = await html2canvas(cardCaptureRef.current, {
                scale: scale,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                ignoreElements: (el) =>
                    el.getAttribute('data-export-ignore') === 'true' ||
                    el.getAttribute('data-html2canvas-ignore') === 'true',
                onclone: (clonedDoc) => {
                    clonedDoc.documentElement.style.height = 'auto';
                    clonedDoc.body.style.height = 'auto';
                    const targetEl = clonedDoc.querySelector(`[data-card-id="${item.id}"]`) as HTMLElement;
                    if (targetEl) {
                        targetEl.style.height = 'auto';
                        targetEl.style.maxHeight = 'none';
                        targetEl.style.overflow = 'visible';
                        targetEl.style.width = '720px';
                        targetEl.style.maxWidth = '720px';
                        targetEl.style.margin = '0 auto';
                    }
                }
            });

            canvas.toBlob(async (blob) => {
                if (!blob) throw new Error('Không thể tạo blob ảnh');
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                setCopySuccess(true);
                setTimeout(() => setCopySuccess(false), 2500);
            }, 'image/png');
        } catch (e) {
            console.error('Lỗi copy card image:', e);
            // Fallback tải ảnh nếu trình duyệt chặn ClipboardItem
            handleDownloadCardImage();
        } finally {
            setIsCopyingImage(false);
        }
    };

    // 2. Tải ảnh riêng thẻ này về máy chuẩn 8K
    const handleDownloadCardImage = async () => {
        if (!cardCaptureRef.current) return;
        setIsDownloading(true);
        try {
            const scale = calculate8KScale(cardCaptureRef.current, 720);
            const canvas = await html2canvas(cardCaptureRef.current, {
                scale: scale,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                ignoreElements: (el) =>
                    el.getAttribute('data-export-ignore') === 'true' ||
                    el.getAttribute('data-html2canvas-ignore') === 'true',
                onclone: (clonedDoc) => {
                    clonedDoc.documentElement.style.height = 'auto';
                    clonedDoc.body.style.height = 'auto';
                    const targetEl = clonedDoc.querySelector(`[data-card-id="${item.id}"]`) as HTMLElement;
                    if (targetEl) {
                        targetEl.style.height = 'auto';
                        targetEl.style.maxHeight = 'none';
                        targetEl.style.overflow = 'visible';
                        targetEl.style.width = '720px';
                        targetEl.style.maxWidth = '720px';
                        targetEl.style.margin = '0 auto';
                    }
                }
            });

            const link = document.createElement('a');
            const cleanName = item.program_name.replace(/[^a-zA-Z0-9\u00C0-\u1EF9]/g, '_').slice(0, 35);
            link.download = `ThiDua_${cleanName}_8K.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2500);
        } catch (e) {
            console.error('Lỗi tải ảnh:', e);
            alert('Không thể tạo ảnh. Vui lòng thử lại!');
        } finally {
            setIsDownloading(false);
        }
    };

    // 3. Sao chép text tóm tắt gửi Zalo
    const handleCopyZaloText = async () => {
        const oppSection = showOpportunity && item.opportunity
            ? `----------------------------------------\n🎁 CƠ HỘI & CTKM:\n${item.opportunity}`
            : '';
        const text = `📢 [CHƯƠNG TRÌNH THI ĐUA: ${item.program_name.toUpperCase()}]
🏷️ Nhóm: ${item.group_name} • Định hướng: ${item.orientation}
📊 Cách tính: ${item.calculation_method} • Trạng thái SP: ${item.product_status}
----------------------------------------
📜 THỂ LỆ THI ĐUA:
${item.rules}${oppSection ? `\n${oppSection}` : ''}`;

        try {
            await navigator.clipboard.writeText(text);
            setCopyTextSuccess(true);
            setTimeout(() => setCopyTextSuccess(false), 2500);
        } catch (e) {
            console.error('Lỗi copy text:', e);
        }
    };

    return (
        <div
            ref={cardCaptureRef}
            data-card-id={item.id}
            className={`rounded-2xl sm:rounded-3xl border transition-all duration-200 overflow-hidden bg-white shadow-xs font-avo flex flex-col justify-between ${
                isSelected
                    ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
            }`}
        >
            {/* Header Thẻ: Nhóm, Tên, Checkbox & Badges */}
            <div className="p-3.5 sm:p-4.5 space-y-3">
                <div className="flex items-start justify-between gap-2.5">
                    {/* Checkbox và Tiêu đề */}
                    <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <div className="pt-0.5 shrink-0" data-export-ignore="true">
                            <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => onToggleSelect(item.id)}
                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                                title="Chọn để xuất ảnh hoặc lọc"
                            />
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className={`px-2 py-0.5 rounded-md text-[10.5px] font-black uppercase tracking-wider ${getGroupBadge(item.group_name)}`}>
                                     {item.group_name}
                                </span>
                                {item.short_name && (
                                    <span
                                        className="px-2 py-0.5 rounded-md text-[10.5px] font-black bg-purple-50 text-purple-900 border border-purple-200 inline-flex items-center gap-1"
                                        title={`Tên viết tắt theo cấu hình admin • Khóa nhập: ${item.mapped_key || item.short_name}`}
                                    >
                                        <Tag className="w-3 h-3 text-purple-600" />
                                        <span>{item.short_name}</span>
                                    </span>
                                )}
                                <span className={`px-2 py-0.5 rounded-md text-[10.5px] border ${getOrientationBadge(item.orientation)}`}>
                                     {item.orientation}
                                </span>
                                <span className={`px-2 py-0.5 rounded-md text-[10.5px] border ${getCalcBadge(item.calculation_method)}`}>
                                     {item.calculation_method}
                                </span>
                                {!item.is_active && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                                        Đã dừng
                                    </span>
                                )}
                            </div>

                            <h3 className="text-sm sm:text-base font-black text-slate-900 leading-snug tracking-tight hover:text-blue-700 transition">
                                {item.program_name}
                            </h3>
                        </div>
                    </div>
                </div>

                {/* Khối Thể Lệ Thi Đua */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-2.5 sm:p-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-slate-700 text-xs font-black uppercase tracking-wider">
                        <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>Thể lệ & Điều kiện đạt</span>
                    </div>
                    <div className="text-xs text-slate-800 leading-relaxed font-medium pl-5">
                        <FormattedCampaignText text={item.rules} fallback="Chưa cập nhật thể lệ chi tiết." />
                    </div>
                </div>

                {/* Khối Cơ Hội / CTKM (Nếu có và đang bật hiển thị) */}
                {showOpportunity && item.opportunity && (
                    <div className="bg-gradient-to-r from-amber-50/90 to-amber-50/40 border border-amber-200/90 rounded-xl p-2.5 sm:p-3 space-y-1">
                        <div className="flex items-center gap-1.5 text-amber-900 text-xs font-black uppercase tracking-wider">
                            <Gift className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>Cơ hội & Khuyến mãi (CTKM)</span>
                        </div>
                        <div className="text-xs text-amber-950 leading-relaxed font-medium pl-5">
                            <FormattedCampaignText text={item.opportunity} />
                        </div>
                    </div>
                )}

                {/* Thuộc tính bổ sung: Trạng thái sản phẩm & Kỳ áp dụng */}
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100 flex-wrap gap-2">
                    <div className="flex items-center gap-1.5">
                        <Boxes className="w-3 h-3 text-slate-400" />
                        <span>Sản phẩm: <strong className="text-slate-800 font-bold">{item.product_status}</strong></span>
                    </div>
                    {item.target_period && (
                        <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>Kỳ: <strong className="text-slate-700">{item.target_period}</strong></span>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer Thẻ: Các nút hành động (Ẩn khi chụp ảnh) */}
            <div
                data-export-ignore="true"
                className="bg-slate-50/80 border-t border-slate-100 px-3.5 py-2.5 flex items-center justify-between gap-1.5 flex-wrap"
            >
                <div className="flex items-center gap-1">
                    {/* Nút copy ảnh */}
                    <button
                        type="button"
                        onClick={handleCopyCardImage}
                        disabled={isCopyingImage}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer ${
                            copySuccess
                                ? 'bg-emerald-600 text-white'
                                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                        title="Copy ảnh thẻ này vào Clipboard để dán Zalo"
                    >
                        {copySuccess ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3 text-slate-500" />}
                        <span>{copySuccess ? 'Đã copy!' : 'Ảnh'}</span>
                    </button>

                    {/* Nút tải ảnh */}
                    <button
                        type="button"
                        onClick={handleDownloadCardImage}
                        disabled={isDownloading}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition shadow-2xs cursor-pointer"
                        title="Tải ảnh PNG về máy"
                    >
                        <Download className="w-3 h-3 text-slate-500" />
                    </button>

                    {/* Nút copy text */}
                    <button
                        type="button"
                        onClick={handleCopyZaloText}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition shadow-2xs cursor-pointer ${
                            copyTextSuccess
                                ? 'bg-blue-600 text-white'
                                : 'bg-white hover:bg-slate-100 text-blue-700 border border-blue-200'
                        }`}
                        title="Sao chép nội dung tóm tắt để dán nhanh vào nhóm chat"
                    >
                        <span>{copyTextSuccess ? 'Đã chép text!' : 'Text Zalo'}</span>
                    </button>
                </div>

                {/* Sửa / Xóa cho người có quyền */}
                {canManage && (
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => onEdit(item)}
                            className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                            title="Chỉnh sửa chương trình thi đua này"
                        >
                            <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => onDelete(item.id, item.program_name)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Xóa chương trình thi đua"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
