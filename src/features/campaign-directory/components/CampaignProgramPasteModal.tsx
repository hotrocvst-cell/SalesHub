import React, { useState, useMemo } from 'react';
import { X, FileSpreadsheet, CheckCircle2, AlertCircle, ArrowRight, UploadCloud } from 'lucide-react';
import type { CampaignProgramItem, CampaignOrientation, CampaignCalculationMethod, ProductStatusType } from '../types';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onBatchSave: (items: CampaignProgramItem[], replaceAll: boolean) => Promise<boolean>;
    currentPrograms: CampaignProgramItem[];
}

export default function CampaignProgramPasteModal({
    isOpen,
    onClose,
    onBatchSave,
    currentPrograms
}: Props) {
    const [rawText, setRawText] = useState('');
    const [replaceAll, setReplaceAll] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // Bóc tách dữ liệu từ text dán
    const parsedItems = useMemo(() => {
        if (!rawText.trim()) return [];

        const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const result: CampaignProgramItem[] = [];

        lines.forEach((line, idx) => {
            // Bỏ qua dòng tiêu đề nếu người dùng copy cả header Excel
            const lower = line.toLowerCase();
            if (
                lower.includes('nhóm') &&
                (lower.includes('chương trình') || lower.includes('thể lệ') || lower.includes('cách tính'))
            ) {
                return;
            }

            // Tách theo tab (\t) hoặc dấu phẩy / chấm phẩy nếu không có tab
            let parts: string[];
            if (line.includes('\t')) {
                parts = line.split('\t').map(p => p.trim());
            } else if (line.includes(';')) {
                parts = line.split(';').map(p => p.trim());
            } else {
                parts = line.split(',').map(p => p.trim());
            }

            if (parts.length < 2) return;

            // Thứ tự các cột chuẩn:
            // Cột 0: Nhóm (ICT, CE, Dịch vụ...)
            // Cột 1: Tên chương trình thi đua
            // Cột 2: Định hướng (Chính, Phụ, Bán kèm)
            // Cột 3: Cách tính (Doanh thu, DTQĐ, Số lượng, SLQĐ)
            // Cột 4: Thể lệ
            // Cột 5: Trạng thái SP (Mới, Cũ, All)
            // Cột 6: Cơ hội (CTKM)
            const group_name = parts[0] || 'ICT';
            const program_name = parts[1] || `Chương trình ${idx + 1}`;
            const rawOrient = parts[2] || 'Chính';
            const rawCalc = parts[3] || 'Doanh thu';
            const rules = parts[4] || '';
            const rawStatus = parts[5] || 'Tất cả (All)';
            const opportunity = parts[6] || '';

            // Chuẩn hóa định hướng
            let orientation: CampaignOrientation = 'Chính';
            if (rawOrient.toLowerCase().includes('kèm')) orientation = 'Bán kèm';
            else if (rawOrient.toLowerCase().includes('phụ')) orientation = 'Phụ';
            else if (rawOrient.toLowerCase().includes('trọng tâm')) orientation = 'Trọng tâm';

            // Chuẩn hóa cách tính
            let calculation_method: CampaignCalculationMethod = 'Doanh thu';
            if (rawCalc.toLowerCase().includes('dtqđ') || rawCalc.toLowerCase().includes('dtqd')) calculation_method = 'DTQĐ';
            else if (rawCalc.toLowerCase().includes('slqđ') || rawCalc.toLowerCase().includes('slqd')) calculation_method = 'SLQĐ';
            else if (rawCalc.toLowerCase().includes('số lượng') || rawCalc.toLowerCase().includes('so luong') || rawCalc.toLowerCase().includes('sl')) calculation_method = 'Số lượng';

            // Chuẩn hóa trạng thái SP
            let product_status: ProductStatusType = 'Tất cả (All)';
            if (rawStatus.toLowerCase().includes('mới') || rawStatus.toLowerCase().includes('new')) product_status = 'Mới';
            else if (rawStatus.toLowerCase().includes('cũ') || rawStatus.toLowerCase().includes('old')) product_status = 'Cũ';
            else if (rawStatus.toLowerCase().includes('đổi trả')) product_status = 'Đổi trả';

            result.push({
                id: `cp-paste-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
                group_name,
                program_name,
                orientation,
                calculation_method,
                rules,
                product_status,
                opportunity,
                target_period: 'Tháng 10/2026',
                is_active: true,
                order_index: idx + 1
            });
        });

        return result;
    }, [rawText]);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (parsedItems.length === 0) {
            setErrorMsg('Chưa có dòng dữ liệu hợp lệ nào được bóc tách!');
            return;
        }

        setIsSaving(true);
        try {
            const finalItems = replaceAll ? parsedItems : [...parsedItems, ...currentPrograms];
            const success = await onBatchSave(finalItems, replaceAll);
            if (success) {
                setRawText('');
                onClose();
            }
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto font-avo animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
                            <FileSpreadsheet className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-900">
                                Dán Nhanh Chương Trình Thi Đua Từ Excel
                            </h3>
                            <p className="text-[11px] text-slate-400">
                                Copy các cột từ bảng tính Excel rồi dán trực tiếp vào ô bên dưới
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4 overflow-y-auto flex-1">
                    {/* Hướng dẫn thứ tự cột */}
                    <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-3 text-xs space-y-1.5 text-purple-950">
                        <div className="font-black uppercase tracking-wider text-[11px] text-purple-900 flex items-center gap-1.5">
                            <span>📋 Thứ tự các cột copy từ Excel (Ngăn cách bởi phím Tab):</span>
                        </div>
                        <div className="font-mono text-[11px] bg-white p-2 rounded-xl border border-purple-200 overflow-x-auto text-slate-800">
                            Nhóm [TAB] Tên Chương Trình [TAB] Định Hướng [TAB] Cách Tính [TAB] Thể Lệ [TAB] Trạng Thái SP [TAB] Cơ Hội (CTKM)
                        </div>
                        <p className="text-[10.5px] text-purple-800 leading-snug">
                            Hệ thống sẽ tự động bỏ qua dòng tiêu đề và chuẩn hóa các thông số.
                        </p>
                    </div>

                    {/* Textarea nhập liệu */}
                    <div className="space-y-1">
                        <label className="text-xs font-black text-slate-800 uppercase tracking-wide">
                            Nội dung dán (Ctrl + V)
                        </label>
                        <textarea
                            rows={6}
                            value={rawText}
                            onChange={e => {
                                setRawText(e.target.value);
                                setErrorMsg('');
                            }}
                            placeholder="Ví dụ dán:&#10;ICT	iPhone 16 Series Vượt Trội	Chính	DTQĐ	Thưởng 150k/máy...	Mới	Giảm 2.5tr qua VNPAY...&#10;Phụ kiện	Combo Sạc Cáp Tai Nghe	Bán kèm	Số lượng	Tỷ lệ kèm >= 45%...	Mới	Giảm 35% khi mua kèm máy..."
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500 shadow-inner"
                        />
                    </div>

                    {errorMsg && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {/* Xem trước kết quả bóc tách */}
                    {parsedItems.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    <span>Xem trước: Bóc tách thành công {parsedItems.length} chương trình</span>
                                </span>
                            </div>

                            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead className="bg-slate-100 text-slate-700 font-black text-[10px] uppercase sticky top-0">
                                        <tr>
                                            <th className="p-2 border-r">Nhóm</th>
                                            <th className="p-2 border-r">Tên CT</th>
                                            <th className="p-2 border-r">Định hướng</th>
                                            <th className="p-2 border-r">Cách tính</th>
                                            <th className="p-2 border-r">Thể lệ</th>
                                            <th className="p-2">Cơ hội CTKM</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium">
                                        {parsedItems.map((p, i) => (
                                            <tr key={i} className="hover:bg-slate-50">
                                                <td className="p-2 font-bold text-blue-700 border-r">{p.group_name}</td>
                                                <td className="p-2 font-extrabold text-slate-900 border-r">{p.program_name}</td>
                                                <td className="p-2 border-r">{p.orientation}</td>
                                                <td className="p-2 border-r font-mono">{p.calculation_method}</td>
                                                <td className="p-2 text-slate-600 truncate max-w-[150px] border-r" title={p.rules}>{p.rules}</td>
                                                <td className="p-2 text-amber-800 truncate max-w-[150px]" title={p.opportunity}>{p.opportunity || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Tùy chọn lưu */}
                    <div className="flex items-center gap-4 pt-1">
                        <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-slate-700">
                            <input
                                type="radio"
                                name="replaceMode"
                                checked={!replaceAll}
                                onChange={() => setReplaceAll(false)}
                                className="text-purple-600 focus:ring-purple-500"
                            />
                            <span>Thêm nối tiếp vào danh sách hiện có</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-rose-700">
                            <input
                                type="radio"
                                name="replaceMode"
                                checked={replaceAll}
                                onChange={() => setReplaceAll(true)}
                                className="text-rose-600 focus:ring-rose-500"
                            />
                            <span>Thay thế (Ghi đè) toàn bộ danh sách cũ</span>
                        </label>
                    </div>

                    {/* Actions */}
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                        >
                            Đóng
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving || parsedItems.length === 0}
                            className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                        >
                            <UploadCloud className="w-3.5 h-3.5" />
                            <span>{isSaving ? 'Đang lưu...' : `Áp Dụng (${parsedItems.length} CT)`}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
