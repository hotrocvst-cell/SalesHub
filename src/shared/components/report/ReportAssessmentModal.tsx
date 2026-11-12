import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    MessageSquareText,
    X,
    Check,
    Copy,
    Sparkles,
    RefreshCw,
    Lightbulb,
    FileText
} from 'lucide-react';

export interface AssessmentTemplate {
    id: number | string;
    title?: string;          // e.g. "1. Tổng quan", "2. Trọng tâm", "3. Chi tiết"
    label?: string;          // alias for title
    badge?: string;          // e.g. "Súc tích", "Phân loại", "Hành động"
    content: string;         // Nội dung mẫu
    description?: string;    // Gợi ý mục đích sử dụng
}

export interface ReportAssessmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    reportTitle?: string;
    periodLabel?: string;
    templates?: AssessmentTemplate[];
    initialComment?: string;
    showAssessmentOnReport?: boolean;
    onToggleShowAssessment?: (show: boolean) => void;
    onSaveComment?: (comment: string, showOnReport: boolean) => void | Promise<boolean | void>;
    isSaving?: boolean;
}

export default function ReportAssessmentModal({
    isOpen,
    onClose,
    reportTitle = 'Báo Cáo Kinh Doanh',
    periodLabel,
    templates = [],
    initialComment = '',
    showAssessmentOnReport = false,
    onToggleShowAssessment,
    onSaveComment,
    isSaving = false
}: ReportAssessmentModalProps) {
    // Luôn đảm bảo có từ 1 đến 3 mẫu nhận xét tạo sẵn
    const resolvedTemplates: AssessmentTemplate[] = React.useMemo(() => {
        if (templates && templates.length > 0) {
            return templates.slice(0, 3);
        }

        const dateStr = new Date().toLocaleDateString('vi-VN');
        const periodStr = periodLabel ? ` - Kỳ ${periodLabel}` : '';

        return [
            {
                id: 1,
                title: 'Mẫu 1: Tổng quan',
                badge: 'Súc tích',
                description: 'Đánh giá nhanh 2-3 câu gửi nhóm chat Zalo',
                content: `📢 [TỔNG HỢP NHANH - ${reportTitle.toUpperCase()}${periodStr}]\n• Ngày cập nhật: ${dateStr}\n• Tiến độ kinh doanh: Đang bám sát nhịp độ chỉ tiêu đề ra.\n• Trọng tâm: Toàn đội tập trung tối ưu doanh thu quy đổi và trả chậm trong các ca trọng điểm.\n🎯 Cán đích thắng lợi!`
            },
            {
                id: 2,
                title: 'Mẫu 2: Trọng tâm',
                badge: 'Phân loại',
                description: 'Phân loại các mục đạt vs cần tăng tốc',
                content: `📊 [ĐÁNH GIÁ TRỌNG TÂM - ${reportTitle.toUpperCase()}${periodStr}]\n• Cập nhật ngày: ${dateStr}\n\n🌟 NHÓM VƯỢT TRỘI / ĐẠT CHUẨN:\n- Duy trì xuất sắc nhịp bán hàng và tỷ lệ hoàn thành mục tiêu.\n\n🚨 NHÓM CẦN TĂNG TỐC BỨT PHÁ:\n- Bám sát chỉ tiêu từng ca, chủ động tư vấn sản phẩm giá trị và trả chậm.\n\n🔥 Quyết tâm bứt phá cán đích!`
            },
            {
                id: 3,
                title: 'Mẫu 3: Chi tiết',
                badge: 'Hành động',
                description: 'Hướng dẫn hành động và giải pháp thực chiến',
                content: `📋 [KẾ HOẠCH HÀNH ĐỘNG CHI TIẾT - ${reportTitle.toUpperCase()}${periodStr}]\n• Ngày: ${dateStr}\n\n1. ĐÁNH GIÁ THỰC TRẠNG:\n- Tiến độ lũy kế cần thêm lực đẩy để đảm bảo 100% cán đích.\n\n2. HƯỚNG DẪN HÀNH ĐỘNG CỤ THỂ:\n- Ca sáng: Khai thác khách hàng tiềm năng, tư vấn chương trình thi đua hiện hành.\n- Ca tối (Giờ vàng): Dồn toàn lực chốt đơn, đẩy mạnh doanh thu quy đổi & trả góp 0%.\n- Quản lý / Trưởng ca: Bám sát bảng xếp hạng realtime, đôn đốc và hỗ trợ nhân sự kịp thời.\n\n💪 Toàn đội đồng lòng quyết thắng!`
            }
        ];
    }, [templates, reportTitle, periodLabel]);

    const [activeTemplateIndex, setActiveTemplateIndex] = useState<number>(0);
    const [comment, setComment] = useState<string>('');
    const [localShowOnReport, setLocalShowOnReport] = useState<boolean>(showAssessmentOnReport);
    const [copySuccess, setCopySuccess] = useState<boolean>(false);
    const [savingInternal, setSavingInternal] = useState<boolean>(false);

    // Đồng bộ khi modal mở
    useEffect(() => {
        if (!isOpen) return;

        // Nếu có comment ban đầu được lưu thì dùng comment đó, ngược lại lấy Mẫu 1
        if (initialComment && initialComment.trim()) {
            setComment(initialComment);
        } else if (resolvedTemplates.length > 0) {
            setComment(resolvedTemplates[0].content);
            setActiveTemplateIndex(0);
        }

        setLocalShowOnReport(showAssessmentOnReport);
        setCopySuccess(false);
    }, [isOpen, initialComment, showAssessmentOnReport, resolvedTemplates]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    // Chọn chuyển đổi giữa 1-3 mẫu tạo sẵn
    const handleSelectTemplate = (idx: number) => {
        setActiveTemplateIndex(idx);
        if (resolvedTemplates[idx]) {
            setComment(resolvedTemplates[idx].content);
        }
    };

    // Khôi phục lại mẫu gốc đang chọn
    const handleResetToCurrentTemplate = () => {
        if (resolvedTemplates[activeTemplateIndex]) {
            setComment(resolvedTemplates[activeTemplateIndex].content);
        }
    };

    // Sao chép nội dung vào Clipboard
    const handleCopyZalo = async () => {
        if (!comment.trim()) return;
        try {
            await navigator.clipboard.writeText(comment.trim());
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2500);
        } catch {
            alert('Không thể sao chép văn bản vào bộ nhớ tạm.');
        }
    };

    // Lưu nhận xét
    const handleSave = async () => {
        setSavingInternal(true);
        try {
            if (onToggleShowAssessment) {
                onToggleShowAssessment(localShowOnReport);
            }
            if (onSaveComment) {
                await onSaveComment(comment.trim(), localShowOnReport);
            }
            onClose();
        } finally {
            setSavingInternal(false);
        }
    };

    const isBusy = isSaving || savingInternal;

    return createPortal(
        <div
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 antialiased"
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="report-assessment-modal-title"
                className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden"
            >
                {/* Header Modal */}
                <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/90 flex items-start justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-2xl bg-blue-700 text-white flex items-center justify-center shadow-sm shrink-0">
                            <MessageSquareText className="w-5 h-5 stroke-[2.2]" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 id="report-assessment-modal-title" className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight">
                                    Nhận Xét & Tóm Tắt Báo Cáo
                                </h3>
                                {periodLabel && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800">
                                        {periodLabel}
                                    </span>
                                )}
                            </div>
                            <p className="text-[11px] text-slate-600 mt-0.5 font-medium">
                                Đánh giá kết quả kinh doanh với 1-3 mẫu tạo sẵn, dễ dàng sao chép gửi nhóm chat
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Đóng hộp thoại nhận xét"
                        className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                        title="Đóng"
                    >
                        <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                </div>

                {/* Body Modal */}
                <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
                    {/* BỘ CHUYỂN ĐỔI 1 ĐẾN 3 MẪU NHẬN XÉT TẠO SẴN */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs gap-2">
                            <span className="font-extrabold text-slate-700 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
                                <span>Tùy chọn mẫu nhận xét ({resolvedTemplates.length} mẫu có sẵn):</span>
                            </span>
                            <button
                                type="button"
                                onClick={handleResetToCurrentTemplate}
                                className="text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer transition hover:underline shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
                                title="Khôi phục lại nội dung mẫu ban đầu"
                            >
                                <RefreshCw className="w-3 h-3" aria-hidden="true" />
                                <span>Tải lại mẫu gốc</span>
                            </button>
                        </div>

                        {/* Các nút Tab Mẫu 1, 2, 3 */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {resolvedTemplates.map((tpl, idx) => {
                                const isSelected = activeTemplateIndex === idx;
                                return (
                                    <button
                                        key={tpl.id}
                                        type="button"
                                        onClick={() => handleSelectTemplate(idx)}
                                        className={`p-2.5 rounded-2xl text-left border transition cursor-pointer relative flex flex-col justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                                            isSelected
                                                ? 'bg-blue-50/90 border-blue-500 ring-1 ring-blue-500 shadow-sm'
                                                : 'bg-slate-50/80 hover:bg-slate-100 border-slate-200 text-slate-700'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-1 mb-1">
                                            <span className={`text-xs font-black ${isSelected ? 'text-blue-950' : 'text-slate-800'}`}>
                                                {tpl.title || tpl.label || `Mẫu ${idx + 1}`}
                                            </span>
                                            {tpl.badge && (
                                                <span className={`px-1.5 py-0.5 rounded-md text-[9.5px] font-black uppercase ${
                                                    isSelected
                                                        ? 'bg-blue-700 text-white'
                                                        : 'bg-slate-200 text-slate-700'
                                                }`}>
                                                    {tpl.badge}
                                                </span>
                                            )}
                                        </div>
                                        {tpl.description && (
                                            <p className="text-[10.5px] text-slate-600 leading-snug font-medium">
                                                {tpl.description}
                                            </p>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* VÙNG CHỈNH SỬA TEXTAREA */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                            <label htmlFor="report-assessment-textarea" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-blue-700" aria-hidden="true" />
                                <span>Nội dung nhận xét (Có thể chỉnh sửa trước khi sao chép/xuất):</span>
                            </label>
                            <span className="text-[11px] text-slate-600 font-mono shrink-0">
                                {comment.length} ký tự
                            </span>
                        </div>

                        <textarea
                            id="report-assessment-textarea"
                            name="report_assessment_comment"
                            rows={5}
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Nhập nội dung nhận xét hoặc chọn 1 trong 3 mẫu tạo sẵn ở trên..."
                            className="w-full min-h-[124px] sm:min-h-[172px] p-3.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs leading-relaxed text-slate-800 focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 outline-none resize-y font-medium transition"
                        />
                    </div>

                    {/* TÙY CHỌN HIỂN THỊ TRÊN BÁO CÁO (NẾU ĐƯỢC HỖ TRỢ) */}
                    {onToggleShowAssessment && (
                        <div className="flex items-center gap-2.5 bg-blue-50/70 border border-blue-200 rounded-2xl p-3">
                            <input
                                type="checkbox"
                                id="toggle-show-assessment-checkbox"
                                name="toggle_show_assessment"
                                checked={localShowOnReport}
                                onChange={(e) => setLocalShowOnReport(e.target.checked)}
                                className="w-4 h-4 rounded text-blue-700 focus:ring-blue-600 cursor-pointer"
                            />
                            <label htmlFor="toggle-show-assessment-checkbox" className="text-xs font-bold text-slate-800 cursor-pointer select-none">
                                Hiển thị khối nhận xét này trên báo cáo & hình ảnh xuất (Mặc định: Ẩn)
                            </label>
                        </div>
                    )}

                    {/* GHI CHÚ HƯỚNG DẪN */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-[11.5px] text-slate-600 flex items-start gap-2.5">
                        <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                        <div>
                            <b>Gợi ý:</b> Chọn nhanh 1 trong 3 mẫu nhận xét tạo sẵn, bổ sung ý kiến cá nhân nếu cần, sau đó bấm <b>"Sao Chép Zalo"</b> để gửi tin nhắn vào nhóm chat
                            {onToggleShowAssessment ? ' hoặc tick chọn để đưa trực tiếp vào ảnh báo cáo.' : '.'}
                        </div>
                    </div>
                </div>

                {/* Footer Modal */}
                <div className="p-3.5 sm:p-5 border-t border-slate-200 bg-slate-50 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2.5 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full sm:w-auto px-4 py-2 min-h-[38px] rounded-xl text-xs font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                    >
                        Đóng
                    </button>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        {/* Nút Sao Chép Zalo */}
                        <button
                            type="button"
                            onClick={handleCopyZalo}
                            className={`flex-1 sm:flex-initial justify-center px-3.5 sm:px-4 py-2 min-h-[38px] rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                                copySuccess
                                    ? 'bg-emerald-700 text-white'
                                    : 'bg-white hover:bg-slate-100 text-blue-700 border border-blue-200'
                            }`}
                            title="Sao chép toàn bộ văn bản nhận xét vào Clipboard"
                        >
                            {copySuccess ? <Check className="w-4 h-4 text-white" aria-hidden="true" /> : <Copy className="w-4 h-4 text-blue-700" aria-hidden="true" />}
                            <span>{copySuccess ? 'Đã copy!' : 'Sao Chép Zalo'}</span>
                        </button>

                        {/* Nút Lưu Nhận Xét (Nếu trang có hàm lưu) */}
                        {onSaveComment && (
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={isBusy}
                                className="flex-1 sm:flex-initial justify-center px-4 sm:px-5 py-2 min-h-[38px] rounded-xl text-xs font-extrabold bg-blue-700 hover:bg-blue-800 text-white shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700"
                            >
                                {isBusy ? <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Check className="w-4 h-4" aria-hidden="true" />}
                                <span>{isBusy ? 'Đang lưu...' : 'Lưu Nhận Xét'}</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
