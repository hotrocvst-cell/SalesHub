import { useState, useEffect } from 'react';
import { MessageSquare, X, Check, Sparkles, RefreshCw, Wand2, Lightbulb, Trophy, AlertTriangle } from 'lucide-react';
import { type ClusterStoreRow, type ClusterSummaryData, type ClusterAssessmentData } from '../types';
import { saveClusterAssessment } from '../services/clusterTargetService';
import { getShortStoreName } from '../../../core/lib/formatters';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    summary: ClusterSummaryData;
    rows: ClusterStoreRow[];
    month: number;
    year: number;
    initialData: ClusterAssessmentData | null;
    showAssessment?: boolean;
    onToggleShowAssessment?: (show: boolean) => void;
    onSaved: () => void;
}

export default function ClusterAssessmentModal({
    isOpen,
    onClose,
    summary,
    rows,
    month,
    year,
    initialData,
    showAssessment = false,
    onToggleShowAssessment,
    onSaved
}: Props) {
    const [comment, setComment] = useState<string>('');
    const [localShowOnReport, setLocalShowOnReport] = useState<boolean>(showAssessment);
    const [isSaving, setIsSaving] = useState<boolean>(false);

    useEffect(() => {
        if (!isOpen) return;
        setComment(initialData?.comment || '');
        setLocalShowOnReport(showAssessment);
    }, [isOpen, initialData, showAssessment]);

    if (!isOpen) return null;

    // Tự động sinh nhận xét phân tích thông minh tóm tắt ngắn gọn
    const handleGenerateAiInsights = () => {
        if (rows.length === 0) return;

        // Tìm siêu thị %HT Vượt trội cao nhất
        const topPctHt = [...rows].sort((a, b) => b.pctHtOver - a.pctHtOver)[0];
        // Tìm siêu thị cần tăng tốc (%HT thấp nhất)
        const lowPctHt = [...rows].sort((a, b) => a.pctHtOver - b.pctHtOver)[0];

        const lines: string[] = [];

        lines.push(`📊 ĐÁNH GIÁ SỨC KHỎE CỤM T${month}/${year}:`);
        lines.push(`• DTQĐ: ${summary.totalRevenueQd.toFixed(3)} tỷ (+${summary.avgPctQd.toFixed(1)}% QĐ) • %HT: ${summary.avgPctHtOver.toFixed(1)}% • Trả góp: ${summary.avgInstallmentRate.toFixed(1)}%.`);

        if (topPctHt) {
            lines.push(`🌟 Dẫn đầu: [${getShortStoreName(topPctHt.storeName)}] đạt ${topPctHt.pctHtOver.toFixed(1)}% target vượt trội.`);
        }

        if (lowPctHt && lowPctHt.pctHtOver < 100) {
            lines.push(`🚨 Tăng tốc: [${getShortStoreName(lowPctHt.storeName)}] đạt ${lowPctHt.pctHtOver.toFixed(1)}%, tập trung dồn lực ca tối & trả chậm.`);
        }

        lines.push(`🎯 Hướng dẫn: Bám sát nhịp ca, tối ưu trả chậm và DTQĐ để toàn cụm cán đích.`);

        setComment(lines.join('\n'));
    };

    const handleSave = async () => {
        setIsSaving(true);
        const res = await saveClusterAssessment({
            month,
            year,
            comment: comment.trim()
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
                <div className="p-4 sm:p-5 border-b border-slate-200 bg-gradient-to-r from-blue-50/60 via-white to-indigo-50/40 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-200 shrink-0">
                            <MessageSquare className="w-5 h-5 stroke-[2.5]" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-extrabold text-sm sm:text-base text-slate-800">
                                    Nhận Xét & Hướng Dẫn Sức Khỏe Cụm
                                </h3>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800">
                                    Tháng {month}/{year}
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                                Ghi chú đánh giá hiệu quả kinh doanh, vinh danh shop vượt trội và hướng dẫn hành động
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
                <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-600">
                            Nội dung nhận xét:
                        </span>
                        <button
                            type="button"
                            onClick={handleGenerateAiInsights}
                            className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                            <Wand2 className="w-3.5 h-3.5" />
                            <span>⚡ Tự Động Tóm Tắt</span>
                        </button>
                    </div>

                    <textarea
                        rows={7}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Nhập nhận xét đánh giá ngắn gọn hoặc bấm nút '⚡ Tự Động Tóm Tắt' để hệ thống tóm tắt súc tích..."
                        className="w-full p-3.5 bg-slate-50 border border-slate-300 rounded-2xl text-xs leading-relaxed text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none font-medium"
                    />

                    {/* Tùy chọn hiển thị nhận xét trên báo cáo */}
                    <div className="flex items-center gap-2.5 bg-blue-50/70 border border-blue-200 rounded-2xl p-3">
                        <input
                            type="checkbox"
                            id="toggle-show-assessment-checkbox"
                            checked={localShowOnReport}
                            onChange={(e) => setLocalShowOnReport(e.target.checked)}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <label htmlFor="toggle-show-assessment-checkbox" className="text-xs font-bold text-blue-950 cursor-pointer select-none">
                            Hiển thị khối nhận xét này trong báo cáo & ảnh xuất (Mặc định: Ẩn)
                        </label>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-[11.5px] text-slate-600 flex items-start gap-2.5">
                        <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                            <b>Lưu ý:</b> Nhận xét được mặc định ẩn để báo cáo tinh gọn. Nếu tick chọn ô trên, nhận xét sẽ xuất hiện ở cuối báo cáo và trong ảnh chụp gửi Messaging App.
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                    <span className="text-[11px] text-slate-500 hidden sm:inline">
                        Nhận xét được lưu trữ Cloud và đồng bộ cho tất cả Quản lý trong cụm.
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
                            className="px-5 py-2 rounded-xl text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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
