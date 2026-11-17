import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquare, X, Check, Copy, Lightbulb, Trophy, Sparkles, RefreshCw, Smartphone, Flame } from 'lucide-react';
import type { EmployeeRankingRow, EmployeeRankingSummary } from '../types';
import { saveEmployeeRankingAssessment, type EmployeeRankingAssessmentData } from '../services/employeeRankingAssessmentService';
import { getShortStoreName } from '../../../core/lib/formatters';

export type EmployeeBotCategory = 'BOT_DT' | 'BOT_EMU' | 'BOT_KEP' | null;

/**
 * Phân loại nhân sự thuộc nhóm BOT cảnh báo theo cột "Đánh giá sức khỏe"
 * Trả về:
 * - 'BOT_DT': Bot Doanh thu (không thỏa điều kiện cứu)
 * - 'BOT_EMU': Bot Thi đua (không thỏa điều kiện cứu)
 * - 'BOT_KEP': Bot Kép cả DT & Thi đua (không thỏa điều kiện cứu)
 * - null: An toàn, Thai sản hoặc Đã được cứu (RESCUED)
 */
export function getEmployeeHealthBotCategory(row: EmployeeRankingRow): EmployeeBotCategory {
    // 1. Nếu có đánh giá sức khỏe và thuộc diện An toàn, Thai sản hoặc Đã Cứu -> KHÔNG thuộc nhóm Bot cảnh báo
    if (
        row.rescue_status === 'SAFE' ||
        row.rescue_status === 'RESCUED' ||
        row.badge_variant === 'safe' ||
        row.badge_variant === 'rescued_rev' ||
        row.badge_variant === 'rescued_emu' ||
        row.badge_variant === 'thai_san'
    ) {
        return null;
    }

    // 2. Nếu được đánh giá là BOT_WARNING hoặc badge_variant là warning
    if (row.rescue_status === 'BOT_WARNING' || row.badge_variant === 'warning') {
        const label = (row.rescue_label || '').toLowerCase();
        if (label.includes('kép') || label.includes('kep')) {
            return 'BOT_KEP';
        }
        if (label.includes('dt') || label.includes('doanh thu')) {
            return 'BOT_DT';
        }
        if (label.includes('thi đua') || label.includes('tđ') || label.includes('td')) {
            return 'BOT_EMU';
        }

        // Fallback dựa trên cờ TOP/BOT
        if (row.revenue_top_bot_status === 'BOT' && row.emulation_top_bot_status === 'BOT') {
            return 'BOT_KEP';
        }
        if (row.revenue_top_bot_status === 'BOT') {
            return 'BOT_DT';
        }
        if (row.emulation_top_bot_status === 'BOT') {
            return 'BOT_EMU';
        }
        return 'BOT_DT';
    }

    // 3. Fallback khi chưa có trường rescue (chỉ dựa trên trạng thái BOT)
    if (row.revenue_top_bot_status === 'BOT' && row.emulation_top_bot_status === 'BOT') {
        return 'BOT_KEP';
    }
    if (row.revenue_top_bot_status === 'BOT') {
        return 'BOT_DT';
    }
    if (row.emulation_top_bot_status === 'BOT') {
        return 'BOT_EMU';
    }

    return null;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    rows: EmployeeRankingRow[];
    summary: EmployeeRankingSummary;
    storeName: string;
    month: number;
    year: number;
    initialData: EmployeeRankingAssessmentData | null;
    showAssessment?: boolean;
    onToggleShowAssessment?: (show: boolean) => void;
    onSaved: () => void;
}

export default function EmployeeRankingAssessmentModal({
    isOpen,
    onClose,
    rows,
    summary,
    storeName,
    month,
    year,
    initialData,
    showAssessment = true,
    onToggleShowAssessment,
    onSaved
}: Props) {
    const [comment, setComment] = useState<string>('');
    const [localShowOnReport, setLocalShowOnReport] = useState<boolean>(showAssessment);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [isCopied, setIsCopied] = useState<boolean>(false);
    const [activeTemplateIdx, setActiveTemplateIdx] = useState<number | null>(null);

    const displayName = storeName === 'all' ? 'Toàn Cụm' : getShortStoreName(storeName);

    useEffect(() => {
        if (!isOpen) return;
        setComment(initialData?.comment || '');
        setLocalShowOnReport(showAssessment);
        setActiveTemplateIdx(null);
        setIsCopied(false);
    }, [isOpen, initialData, showAssessment]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    // Tìm Top 1 & Top 2 Doanh thu
    const topRev1 = rows.find(r => r.revenue_rank === 1);
    const topRev2 = rows.find(r => r.revenue_rank === 2);

    // Tìm Top 1 & Top 2 Thi đua
    const topEmu1 = [...rows].sort((a, b) => a.emulation_rank - b.emulation_rank)[0];

    // 1. MẪU 1: TOÀN DIỆN & VINH DANH (Comprehensive & Recognition)
    const generateTemplate1 = () => {
        const lines: string[] = [];
        lines.push(`🌟 BÁO CÁO XẾP HẠNG NHÂN SỰ T${month}/${year}\n🏠 ${displayName.toUpperCase()}:`);
        lines.push(`• Tổng quan: ${summary.totalEmployees} nhân sự\n• DTQĐ: ${(summary.totalRevenueQd).toLocaleString('vi-VN')} tr\n• %DKHT TB: ${summary.avgForecastRate.toFixed(1)}%\n• Thi đua TB: ${summary.avgEmulationRate.toFixed(1)}%.`);

        if (topRev1) {
            lines.push(`\n🥇 TOP Doanh thu:\n• ${topRev1.short_name} (Top #1 DTQĐ ${topRev1.revenue_qd.toLocaleString('vi-VN')}tr - DKHT ${topRev1.forecast_completion_rate.toFixed(1)}%)${topRev2 ? `\n• ${topRev2.short_name} (Top #2)` : ''}.`);
        }

        if (topEmu1) {
            lines.push(`\n⭐ TOP Thi đua: ${topEmu1.short_name} (Top #1 - Đạt ${topEmu1.emulation_display} ~ ${topEmu1.emulation_rate.toFixed(0)}%).`);
        }

        // Lấy danh sách nhân viên Bottom theo dữ liệu cột "Đánh giá sức khỏe nhân viên"
        const botDtList = rows.filter(r => getEmployeeHealthBotCategory(r) === 'BOT_DT');
        const botEmuList = rows.filter(r => getEmployeeHealthBotCategory(r) === 'BOT_EMU');
        const botKepList = rows.filter(r => getEmployeeHealthBotCategory(r) === 'BOT_KEP');

        const botLines: string[] = [];
        if (botDtList.length > 0) {
            botLines.push(`• Bot DT: ${botDtList.map(r => r.short_name).join(', ')}`);
        }
        if (botEmuList.length > 0) {
            botLines.push(`• Bot thi đua: ${botEmuList.map(r => r.short_name).join(', ')}`);
        }
        if (botKepList.length > 0) {
            botLines.push(`• Bot kép: ${botKepList.map(r => r.short_name).join(', ')}`);
        }

        if (botLines.length > 0) {
            lines.push(`\n🚨 Bottom (Đánh giá sức khỏe):\n${botLines.join('\n')}`);
        } else {
            lines.push(`\n🎉 Bottom: 100% nhân sự đạt chuẩn an toàn, không có Bot cảnh báo.`);
        }

        lines.push(`\n🎯 Hướng dẫn: Toàn đội giữ vững nhịp ca cao điểm, dồn sức hoàn thành 100% mục tiêu tháng!`);
        return lines.join('\n');
    };

    // 2. MẪU 2: TĂNG TỐC & HÀNH ĐỘNG (Action-Oriented & Solutions)
    const generateTemplate2 = () => {
        const lines: string[] = [];
        lines.push(`🔥 KẾ HOẠCH HÀNH ĐỘNG BỨT PHÁ T${month}/${year} - ${displayName}:`);
        lines.push(`1. Hiện trạng: Đạt ${summary.avgForecastRate.toFixed(1)}% chỉ tiêu doanh thu và ${summary.avgEmulationRate.toFixed(1)}% tiến độ thi đua.`);

        if (topRev1) {
            lines.push(`2. Đầu tàu kéo nhịp: Nhân rộng mô hình chốt đơn xuất sắc của ${topRev1.short_name} (Top #1) cho toàn bộ ca trực.`);
        }

        lines.push(`3. Trọng tâm bứt phá:`);
        lines.push(`   • Đẩy mạnh đơn hàng trả góp/trả chậm để gia tăng DTQĐ.`);
        lines.push(`   • Tập trung nhóm thi đua trọng điểm chưa đạt để lấy trọn vẹn điểm thưởng.`);

        const warningEmps = rows.filter(r => getEmployeeHealthBotCategory(r) !== null);
        if (warningEmps.length > 0) {
            const needPaceNames = warningEmps.slice(0, 4).map(r => r.short_name).join(', ');
            lines.push(`4. Kèm cặp sát sao: Quản lý/Trưởng ca kèm riêng nhóm (${needPaceNames}) trong ca chiều/tối để về đích an toàn.`);
        }
        return lines.join('\n');
    };

    // 3. MẪU 3: SÚC TÍCH (Quick Chat & Mobile Friendly)
    const generateTemplate3 = () => {
        const lines: string[] = [];
        lines.push(`📢 [KẾT QUẢ XẾP HẠNG NV T${month}/${year} - ${displayName}]`);
        lines.push(`📊 Toàn ST: ${summary.totalEmployees} NV • DTQĐ: ${(summary.totalRevenueQd).toLocaleString('vi-VN')} tr (%DKHT TB: ${summary.avgForecastRate.toFixed(1)}%) • Thi đua TB: ${summary.avgEmulationRate.toFixed(1)}%`);
        if (topRev1) lines.push(`🏆 Top 1 DT: ${topRev1.short_name} (${topRev1.revenue_qd.toLocaleString('vi-VN')} tr - ${topRev1.forecast_completion_rate.toFixed(1)}%)`);
        if (topEmu1) lines.push(`⭐ Top 1 Thi đua: ${topEmu1.short_name} (${topEmu1.emulation_display})`);

        const warningEmps = rows.filter(r => getEmployeeHealthBotCategory(r) !== null);
        if (warningEmps.length > 0) {
            lines.push(`⚠️ Cần tăng tốc: ${warningEmps.map(r => r.short_name).join(', ')}`);
        }

        lines.push(`💪 Toàn đội đồng lòng giữ vững phong độ và tăng tốc ca tối!`);
        return lines.join('\n');
    };

    const handleApplyTemplate = (idx: number) => {
        setActiveTemplateIdx(idx);
        if (idx === 1) setComment(generateTemplate1());
        else if (idx === 2) setComment(generateTemplate2());
        else if (idx === 3) setComment(generateTemplate3());
    };

    const handleCopyComment = async () => {
        if (!comment.trim()) return;
        try {
            await navigator.clipboard.writeText(comment.trim());
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            console.error('Lỗi sao chép:', err);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        const res = await saveEmployeeRankingAssessment({
            store_name: storeName,
            month,
            year,
            comment: comment.trim(),
            show_on_report: localShowOnReport
        });
        setIsSaving(false);

        if (res.success) {
            if (onToggleShowAssessment) {
                onToggleShowAssessment(localShowOnReport);
            }
            onSaved();
            onClose();
        } else {
            alert('Lỗi lưu nhận xét: ' + res.error);
        }
    };

    return createPortal(
        <div
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="ranking-assessment-modal-title"
                className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden"
            >
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/90 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-700 text-white flex items-center justify-center shadow-sm shrink-0">
                            <MessageSquare className="w-5 h-5 stroke-[2.2]" aria-hidden="true" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 id="ranking-assessment-modal-title" className="font-extrabold text-sm sm:text-base text-slate-900">
                                    Nhận Xét Tóm Tắt Xếp Hạng Nhân Viên
                                </h3>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800">
                                    {displayName} • T{month}/{year}
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-600 mt-0.5">
                                Đánh giá kết quả kinh doanh, vinh danh Top cá nhân và hướng dẫn nhóm cần tăng tốc
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Đóng hộp thoại nhận xét"
                        className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition cursor-pointer shrink-0"
                    >
                        <X className="w-4 h-4" aria-hidden="true" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
                    {/* KHỐI 3 MẪU GỢI Ý NHANH */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                <span>Gợi ý 3 mẫu nhận xét tự động:</span>
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                                Bấm để áp dụng mẫu nhanh
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {/* Mẫu 1 */}
                            <button
                                type="button"
                                onClick={() => handleApplyTemplate(1)}
                                className={`p-2.5 rounded-xl border text-left transition cursor-pointer select-none ${activeTemplateIdx === 1
                                    ? 'bg-blue-50 border-blue-500 text-blue-950 shadow-sm ring-1 ring-blue-500'
                                    : 'bg-slate-50/80 hover:bg-blue-50/50 border-slate-200 text-slate-800'
                                    }`}
                            >
                                <div className="flex items-center gap-1 text-[11px] font-black mb-0.5">
                                    <Trophy className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />
                                    <span>Mẫu 1: Toàn diện</span>
                                </div>
                                <div className="text-[10px] text-slate-600 font-medium leading-tight line-clamp-2">
                                    Vinh danh Top 1, Top 2 DT &amp; Thi đua, phân loại Bot DT, Bot thi đua, Bot kép.
                                </div>
                            </button>

                            {/* Mẫu 2 */}
                            <button
                                type="button"
                                onClick={() => handleApplyTemplate(2)}
                                className={`p-2.5 rounded-xl border text-left transition cursor-pointer select-none ${activeTemplateIdx === 2
                                    ? 'bg-amber-50 border-amber-500 text-amber-950 shadow-sm ring-1 ring-amber-500'
                                    : 'bg-slate-50/80 hover:bg-amber-50/50 border-slate-200 text-slate-800'
                                    }`}
                            >
                                <div className="flex items-center gap-1 text-[11px] font-black mb-0.5">
                                    <Flame className="w-3.5 h-3.5 text-rose-600 shrink-0" aria-hidden="true" />
                                    <span>Mẫu 2: Tăng tốc</span>
                                </div>
                                <div className="text-[10px] text-slate-600 font-medium leading-tight line-clamp-2">
                                    Tập trung hành động, bám sát nhịp ca, tối ưu trả góp và chốt đơn.
                                </div>
                            </button>

                            {/* Mẫu 3 */}
                            <button
                                type="button"
                                onClick={() => handleApplyTemplate(3)}
                                className={`p-2.5 rounded-xl border text-left transition cursor-pointer select-none ${activeTemplateIdx === 3
                                    ? 'bg-emerald-50 border-emerald-500 text-emerald-950 shadow-sm ring-1 ring-emerald-500'
                                    : 'bg-slate-50/80 hover:bg-emerald-50/50 border-slate-200 text-slate-800'
                                    }`}
                            >
                                <div className="flex items-center gap-1 text-[11px] font-black mb-0.5">
                                    <Smartphone className="w-3.5 h-3.5 text-emerald-700 shrink-0" aria-hidden="true" />
                                    <span>Mẫu 3: Zalo ngắn</span>
                                </div>
                                <div className="text-[10px] text-slate-600 font-medium leading-tight line-clamp-2">
                                    Siêu ngắn gọn 4 dòng, tối ưu đọc lướt trên điện thoại &amp; nhóm chat.
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* VÙNG NHẬP NỘI DUNG NHẬN XÉT */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label htmlFor="ranking-assessment-textarea" className="text-xs font-bold text-slate-700">
                                Nội dung nhận xét:
                            </label>
                            <div className="flex items-center gap-2">
                                {comment.trim() && (
                                    <button
                                        type="button"
                                        onClick={handleCopyComment}
                                        className="text-[11px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer transition px-2 py-0.5 rounded-lg hover:bg-blue-50"
                                        title="Sao chép toàn bộ nội dung nhận xét vào bộ nhớ tạm"
                                    >
                                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                        <span>{isCopied ? 'Đã sao chép!' : 'Sao chép'}</span>
                                    </button>
                                )}
                                <span className="text-[10.5px] text-slate-500 font-medium hidden sm:inline">
                                    Có thể chỉnh sửa trực tiếp bên dưới
                                </span>
                            </div>
                        </div>
                        <textarea
                            id="ranking-assessment-textarea"
                            name="ranking_assessment_comment"
                            rows={8}
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Chọn 1 trong 3 mẫu gợi ý ở trên hoặc tự gõ nội dung nhận xét tóm tắt tại đây..."
                            className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs leading-relaxed text-slate-800 focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none resize-none font-medium"
                        />
                    </div>

                    {/* CHECKBOX HIỂN THỊ TRÊN BÁO CÁO */}
                    <div className="flex items-center gap-2.5 bg-blue-50/70 border border-blue-200 rounded-2xl p-3">
                        <input
                            type="checkbox"
                            id="toggle-show-ranking-assessment"
                            name="show_ranking_assessment_on_report"
                            checked={localShowOnReport}
                            onChange={(e) => setLocalShowOnReport(e.target.checked)}
                            className="w-4 h-4 rounded text-blue-700 focus:ring-blue-600 cursor-pointer"
                        />
                        <label htmlFor="toggle-show-ranking-assessment" className="text-xs font-bold text-slate-800 cursor-pointer select-none">
                            Hiển thị khối nhận xét này trong báo cáo & ảnh xuất Zalo
                        </label>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-[11.5px] text-slate-600 flex items-start gap-2.5">
                        <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                        <div>
                            <b>Lưu ý:</b> Nhận xét được lưu trữ Cloud Supabase và đồng bộ đa thiết bị. Khối nhận xét sẽ xuất hiện ở đáy bảng xếp hạng khi được tick chọn.
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                    <span className="text-[11px] text-slate-600 hidden sm:inline">
                        Lưu trữ an toàn trên Supabase Cloud
                    </span>
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-5 py-2 rounded-xl text-xs font-extrabold bg-blue-700 hover:bg-blue-800 text-white shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Check className="w-4 h-4" aria-hidden="true" />}
                            <span>{isSaving ? 'Đang lưu...' : 'Lưu Nhận Xét'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
