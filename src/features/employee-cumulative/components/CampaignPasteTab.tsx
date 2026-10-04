import { useState, useEffect } from 'react';
import { parseEmployeeCampaignText, type ParsedCampaignBlock } from '../utils/employeeParsers';
import { formatEmployeeCampaignToRawText } from '../utils/sessionStorage';
import { Trophy, CheckCircle2, AlertCircle, Trash2, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
    onApply: (campaigns: ParsedCampaignBlock[], matrix: Record<string, Record<string, number>>) => void;
    initialCampaigns?: ParsedCampaignBlock[];
    initialMatrix?: Record<string, Record<string, number>>;
}

export default function CampaignPasteTab({
    onApply,
    initialCampaigns = [],
    initialMatrix = {}
}: Props) {
    const [rawText, setRawText] = useState('');
    const [campaignList, setCampaignList] = useState<ParsedCampaignBlock[]>(initialCampaigns);
    const [matrix, setMatrix] = useState<Record<string, Record<string, number>>>(initialMatrix);
    const [errorMsg, setErrorMsg] = useState('');

    const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);

    useEffect(() => {
        if (initialCampaigns && initialCampaigns.length > 0) {
            setCampaignList(initialCampaigns);
            if (!rawText) {
                setRawText(formatEmployeeCampaignToRawText(initialCampaigns));
            }
        }
        if (initialMatrix && Object.keys(initialMatrix).length > 0) {
            setMatrix(initialMatrix);
        }
    }, [initialCampaigns, initialMatrix]);

    // Cho phép sửa trực tiếp điểm thi đua của nhân viên
    const handleUpdateCampaignValue = (campaignName: string, empId: string, val: number) => {
        const nextList = campaignList.map(c => {
            if (c.campaign_name === campaignName) {
                return {
                    ...c,
                    employee_values: {
                        ...c.employee_values,
                        [empId]: val
                    }
                };
            }
            return c;
        });

        const nextMatrix = {
            ...matrix,
            [empId]: {
                ...(matrix[empId] || {}),
                [campaignName]: val
            }
        };

        setCampaignList(nextList);
        setMatrix(nextMatrix);
        onApply(nextList, nextMatrix);
    };

    const handleParse = (text: string) => {
        setRawText(text);
        setErrorMsg('');
        if (!text.trim()) {
            setCampaignList([]);
            setMatrix({});
            return;
        }

        const { campaigns, employee_campaign_matrix } = parseEmployeeCampaignText(text);
        if (campaigns.length === 0) {
            setErrorMsg('Không tìm thấy khối chiến dịch thi đua nào hợp lệ! Hãy kiểm tra định dạng text.');
            setCampaignList([]);
            setMatrix({});
        } else {
            setCampaignList(campaigns);
            setMatrix(employee_campaign_matrix);
        }
    };

    const handleConfirm = () => {
        if (campaignList.length === 0) return;
        onApply(campaignList, matrix);
    };

    const totalEmpsCount = Object.keys(matrix).length;

    return (
        <div className="space-y-4">
            {/* Header hướng dẫn */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <Trophy className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-extrabold text-amber-900 text-sm">Dán Báo Cáo Thi Đua Nhân Viên (Lũy Kế)</h3>
                        <p className="text-xs text-amber-700/80">
                            Copy toàn bộ bảng thi đua (gồm các khối: <code>Bảo hiểm, VAS, Trả chậm, Phụ kiện...</code>)
                        </p>
                    </div>
                </div>

                {campaignList.length > 0 && (
                    <button
                        type="button"
                        onClick={handleConfirm}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                        <span>Áp Dụng {campaignList.length} Chiến Dịch ({totalEmpsCount} NV)</span>
                        <ArrowRight className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Ô nhập liệu textarea */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                    <span>Dán nội dung từ báo cáo Thi đua vào đây:</span>
                    {rawText && (
                        <button
                            type="button"
                            onClick={() => { setRawText(''); setCampaignList([]); setMatrix({}); }}
                            className="text-rose-600 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                        >
                            <Trash2 className="w-3.5 h-3.5" /> Xóa trắng
                        </button>
                    )}
                </div>
                <textarea
                    rows={6}
                    value={rawText}
                    onChange={e => handleParse(e.target.value)}
                    placeholder="Ví dụ:&#10;Bảo hiểm tổng&#9;DOANH THU&#9;HẠNG TRONG ST&#9;TOP/BOTTOM ST&#9;BỘ PHẬN&#10;TỔNG&#9;319.90&#9;&#9;-&#10;27560 - Bùi Minh Lãm&#9;93.53&#9;1&#9;TOP&#10;260732 - Nguyễn Thị Hồng Loan&#9;70.10&#9;2&#9;-&#10;&#10;VAS&#9;SỐ LƯỢNG&#9;HẠNG TRONG ST&#9;TOP/BOTTOM ST&#9;BỘ PHẬN..."
                    className="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500 text-slate-800"
                />
            </div>

            {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                </div>
            )}

            {/* Bảng xem trước các chiến dịch bóc tách được */}
            {campaignList.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Nhận diện thành công {campaignList.length} chiến dịch thi đua cho {totalEmpsCount} nhân sự</span>
                        </span>
                    </div>

                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-96 overflow-y-auto">
                        {campaignList.map((c, idx) => {
                            const empCount = Object.keys(c.employee_values).length;
                            const totalVal = Object.values(c.employee_values).reduce((a, b) => a + b, 0);
                            const isExpanded = expandedCampaign === c.campaign_name;

                            return (
                                <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden transition">
                                    <div
                                        onClick={() => setExpandedCampaign(isExpanded ? null : c.campaign_name)}
                                        className="p-3 space-y-1 cursor-pointer hover:bg-slate-100/70 transition"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="font-extrabold text-slate-800 text-xs truncate max-w-[180px]" title={c.campaign_name}>
                                                {c.campaign_name}
                                            </span>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-black uppercase ${
                                                c.unit_type === 'DOANH THU'
                                                    ? 'bg-blue-100 text-blue-700'
                                                    : 'bg-amber-100 text-amber-700'
                                            }`}>
                                                {c.unit_type}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold pt-1 border-t border-slate-200/60">
                                            <span className="flex items-center gap-1">
                                                <span>{empCount} nhân viên</span>
                                                {isExpanded ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
                                            </span>
                                            <span className="font-mono font-bold text-slate-800">
                                                Tổng: {totalVal.toLocaleString('vi-VN')}
                                            </span>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="p-2.5 bg-white border-t border-slate-200 space-y-1.5 max-h-52 overflow-y-auto">
                                            <div className="text-[10px] text-slate-400 font-bold uppercase">Sửa điểm thi đua nhân sự:</div>
                                            {Object.entries(c.employee_values).map(([empId, val]) => (
                                                <div key={empId} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-0">
                                                    <span className="font-mono font-bold text-blue-700">{empId}</span>
                                                    <input
                                                        type="number"
                                                        step={0.01}
                                                        value={val || ''}
                                                        onChange={e => handleUpdateCampaignValue(c.campaign_name, empId, parseFloat(e.target.value) || 0)}
                                                        className="w-24 text-right font-mono font-extrabold text-amber-700 bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-xs outline-hidden focus:bg-white focus:border-amber-500"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
