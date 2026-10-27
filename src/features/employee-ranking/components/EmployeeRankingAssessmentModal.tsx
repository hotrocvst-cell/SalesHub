import { useState, useEffect } from 'react';
import { MessageSquare, X, Check, Wand2, Lightbulb, Trophy, AlertTriangle, Sparkles, RefreshCw, Smartphone, Flame, Target } from 'lucide-react';
import type { EmployeeRankingRow, EmployeeRankingSummary } from '../types';
import { saveEmployeeRankingAssessment, type EmployeeRankingAssessmentData } from '../services/employeeRankingAssessmentService';
import { getShortStoreName } from '../../../core/lib/formatters';

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
    const [activeTemplateIdx, setActiveTemplateIdx] = useState<number | null>(null);

    const displayName = storeName === 'all' ? 'Toàn Cụm' : getShortStoreName(storeName);

    useEffect(() => {
        if (!isOpen) return;
        setComment(initialData?.comment || '');
        setLocalShowOnReport(showAssessment);
        setActiveTemplateIdx(null);
    }, [isOpen, initialData, showAssessment]);

    if (!isOpen) return null;

    // Tìm Top 1 & Top 2 Doanh thu
    const topRev1 = rows.find(r => r.revenue_rank === 1);
    const topRev2 = rows.find(r => r.revenue_rank === 2);

    // Tìm Top 1 & Top 2 Thi đua
    const topEmu1 = [...rows].sort((a, b) => a.emulation_rank - b.emulation_rank)[0];

    // Tìm nhóm Bot Doanh thu và Bot Thi đua
    const botRevs = rows.filter(r => r.revenue_top_bot_status === 'BOT');
    const botEmus = rows.filter(r => r.emulation_top_bot_status === 'BOT');

    // 1. MẪU 1: TOÀN DIỆN & VINH DANH (Comprehensive & Recognition)
    const generateTemplate1 = () => {
        const lines: string[] = [];
        lines.push(`🌟 BÁO CÁO XẾP HẠNG NHÂN SỰ T${month}/${year} - ${displayName.toUpperCase()}:`);
        lines.push(`• Tổng quan: ${summary.totalEmployees} nhân sự | DTQĐ: ${(summary.totalRevenueQd).toLocaleString('vi-VN')} tr | %DKHT TB: ${summary.avgForecastRate.toFixed(1)}% | Thi đua TB: ${summary.avgEmulationRate.toFixed(1)}%.`);
        
        if (topRev1) {
            lines.push(`🥇 Dẫn đầu Doanh thu: ${topRev1.short_name} (Top #1 DTQĐ ${topRev1.revenue_qd.toLocaleString('vi-VN')}tr - DKHT ${topRev1.forecast_completion_rate.toFixed(1)}%)${topRev2 ? `, kế tiếp là ${topRev2.short_name} (Top #2)` : ''}.`);
        }

        if (topEmu1) {
            lines.push(`⭐ Quán quân Thi đua: ${topEmu1.short_name} (Top #1 - Đạt ${topEmu1.emulation_display} ~ ${topEmu1.emulation_rate.toFixed(0)}%).`);
        }

        if (botRevs.length > 0 || botEmus.length > 0) {
            const botNames = Array.from(new Set([...botRevs, ...botEmus].map(r => r.short_name))).slice(0, 3).join(', ');
            lines.push(`🚨 Tăng tốc & Hỗ trợ: Các bạn nhóm Bot (${botNames}) cần chủ động bám nhịp khách, tối ưu trả góp và tư vấn chéo sản phẩm phụ kiện.`);
        }

        lines.push(`🎯 Hướng dẫn: Toàn đội giữ vững nhịp ca cao điểm, dồn sức hoàn thành 100% mục tiêu tháng!`);
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
        
        if (botRevs.length > 0) {
            const needPaceNames = botRevs.slice(0, 3).map(r => r.short_name).join(', ');
            lines.push(`4. Kèm cặp sát sao: Quản lý/Trưởng ca kèm riêng nhóm (${needPaceNames}) trong ca chiều/tối để về đích an toàn.`);
        }
        return lines.join('\n');
    };

    // 3. MẪU 3: SÚC TÍCH (Quick Chat & Mobile Friendly)
    const generateTemplate3 = () => {
        const lines: string[] = [];
        lines.push(`📢 [KẾT QUẢ XẾP HẠNG NV T${month}/${year} - ${displayName}]`);
        lines.push(`📊 Toàn shop: ${summary.totalEmployees} NV • DTQĐ: ${(summary.totalRevenueQd).toLocaleString('vi-VN')} tr (%DKHT TB: ${summary.avgForecastRate.toFixed(1)}%) • Thi đua TB: ${summary.avgEmulationRate.toFixed(1)}%`);
        if (topRev1) lines.push(`🏆 Top 1 DT: ${topRev1.short_name} (${topRev1.revenue_qd.toLocaleString('vi-VN')} tr - ${topRev1.forecast_completion_rate.toFixed(1)}%)`);
        if (topEmu1) lines.push(`⭐ Top 1 Thi đua: ${topEmu1.short_name} (${topEmu1.emulation_display})`);
        lines.push(`💪 Toàn đội đồng lòng giữ vững phong độ và tăng tốc ca tối!`);
        return lines.join('\n');
    };

    const handleApplyTemplate = (idx: number) => {
        setActiveTemplateIdx(idx);
        if (idx === 1) setComment(generateTemplate1());
        else if (idx === 2) setComment(generateTemplate2());
        else if (idx === 3) setComment(generateTemplate3());
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

    return (
        <div
            style={{ fontFamily: "'UTM Avo', 'UTM-Avo', sans-serif" }}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
        >
            <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-slate-200 bg-gradient-to-r from-purple-50/80 via-white to-indigo-50/50 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-200 shrink-0">
                            <MessageSquare className="w-5 h-5 stroke-[2.5]" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-extrabold text-sm sm:text-base text-slate-800">
                                    Nhận Xét Tóm Tắt Xếp Hạng Nhân Viên
                                </h3>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800">
                                    {displayName} • T{month}/{year}
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                                Đánh giá kết quả kinh doanh, vinh danh Top cá nhân và hướng dẫn nhóm cần tăng tốc
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer shrink-0"
                    >
                        <X className="w-4 h-4" />
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
                                className={`p-2.5 rounded-xl border text-left transition cursor-pointer select-none ${
                                    activeTemplateIdx === 1
                                        ? 'bg-purple-100/70 border-purple-400 text-purple-950 shadow-xs ring-1 ring-purple-400'
                                        : 'bg-purple-50/40 hover:bg-purple-50 border-purple-200 text-purple-900'
                                }`}
                            >
                                <div className="flex items-center gap-1 text-[11px] font-black mb-0.5">
                                    <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                    <span>Mẫu 1: Toàn diện</span>
                                </div>
                                <div className="text-[10px] text-slate-600 font-medium leading-tight line-clamp-2">
                                    Vinh danh Top 1, Top 2 DT & Thi đua, nhắc nhở nhóm Bot tăng tốc.
                                </div>
                            </button>

                            {/* Mẫu 2 */}
                            <button
                                type="button"
                                onClick={() => handleApplyTemplate(2)}
                                className={`p-2.5 rounded-xl border text-left transition cursor-pointer select-none ${
                                    activeTemplateIdx === 2
                                        ? 'bg-indigo-100/70 border-indigo-400 text-indigo-950 shadow-xs ring-1 ring-indigo-400'
                                        : 'bg-indigo-50/40 hover:bg-indigo-50 border-indigo-200 text-indigo-900'
                                }`}
                            >
                                <div className="flex items-center gap-1 text-[11px] font-black mb-0.5">
                                    <Flame className="w-3.5 h-3.5 text-rose-500 shrink-0" />
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
                                className={`p-2.5 rounded-xl border text-left transition cursor-pointer select-none ${
                                    activeTemplateIdx === 3
                                        ? 'bg-blue-100/70 border-blue-400 text-blue-950 shadow-xs ring-1 ring-blue-400'
                                        : 'bg-blue-50/40 hover:bg-blue-50 border-blue-200 text-blue-900'
                                }`}
                            >
                                <div className="flex items-center gap-1 text-[11px] font-black mb-0.5">
                                    <Smartphone className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                    <span>Mẫu 3: Zalo ngắn</span>
                                </div>
                                <div className="text-[10px] text-slate-600 font-medium leading-tight line-clamp-2">
                                    Siêu ngắn gọn 4 dòng, tối ưu đọc lướt trên điện thoại & nhóm chat.
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* VÙNG NHẬP NỘI DUNG NHẬN XÉT */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-slate-700">
                                Nội dung nhận xét:
                            </span>
                            <span className="text-[10.5px] text-slate-400 font-medium">
                                Có thể chỉnh sửa trực tiếp bên dưới
                            </span>
                        </div>
                        <textarea
                            rows={8}
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            placeholder="Chọn 1 trong 3 mẫu gợi ý ở trên hoặc tự gõ nội dung nhận xét tóm tắt tại đây..."
                            className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs leading-relaxed text-slate-800 focus:bg-white focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none resize-none font-medium"
                        />
                    </div>

                    {/* CHECKBOX HIỂN THỊ TRÊN BÁO CÁO */}
                    <div className="flex items-center gap-2.5 bg-purple-50/70 border border-purple-200 rounded-2xl p-3">
                        <input
                            type="checkbox"
                            id="toggle-show-ranking-assessment"
                            checked={localShowOnReport}
                            onChange={(e) => setLocalShowOnReport(e.target.checked)}
                            className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                        />
                        <label htmlFor="toggle-show-ranking-assessment" className="text-xs font-bold text-purple-950 cursor-pointer select-none">
                            Hiển thị khối nhận xét này trong báo cáo & ảnh xuất Zalo
                        </label>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-[11.5px] text-slate-600 flex items-start gap-2.5">
                        <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                            <b>Lưu ý:</b> Nhận xét được lưu trữ Cloud Supabase và đồng bộ đa thiết bị. Khối nhận xét sẽ xuất hiện ở đáy bảng xếp hạng khi được tick chọn.
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                    <span className="text-[11px] text-slate-500 hidden sm:inline">
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
                            className="px-5 py-2 rounded-xl text-xs font-extrabold bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-200 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            <span>{isSaving ? 'Đang lưu...' : 'Lưu Nhận Xét'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
