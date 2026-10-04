import React, { useState, useMemo, useRef } from 'react';
import type { EmployeeItem, CampaignDictItem } from '../../../core/lib/storage';
import { parseExcelFile, type ParsedTargetRow } from '../utils/excelHelper';
import { parseClipboardTargetText } from '../utils/textParser';
import {
    UploadCloud,
    FileSpreadsheet,
    ClipboardPaste,
    CheckCircle2,
    AlertCircle,
    X,
    Download,
    Trash2,
    ArrowRight
} from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    employees: EmployeeItem[];
    campaigns: CampaignDictItem[];
    onApplyTargets: (parsedRows: ParsedTargetRow[]) => void;
    onDownloadTemplate: () => void;
}

export default function ImportTargetModal({
    isOpen,
    onClose,
    employees,
    campaigns,
    onApplyTargets,
    onDownloadTemplate
}: Props) {
    const [activeTab, setActiveTab] = useState<'excel' | 'paste'>('excel');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [rawPasteText, setRawPasteText] = useState('');
    const [isParsing, setIsParsing] = useState(false);
    const [parsedData, setParsedData] = useState<ParsedTargetRow[]>([]);
    const [errorMsg, setErrorMsg] = useState('');
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Tạo bản đồ tra cứu nhân viên nhanh
    const empMap = useMemo(() => {
        const map = new Map<string, EmployeeItem>();
        employees.forEach(e => map.set(e.employee_id.trim().toLowerCase(), e));
        return map;
    }, [employees]);

    if (!isOpen) return null;

    // Xử lý chọn file Excel
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setSelectedFile(file);
        setErrorMsg('');
        setIsParsing(true);
        try {
            const rows = await parseExcelFile(file, campaigns);
            setParsedData(rows);
            if (rows.length === 0) {
                setErrorMsg('Không tìm thấy dòng dữ liệu nào trong file Excel!');
            }
        } catch (err: any) {
            console.error(err);
            setErrorMsg(err.message || 'Lỗi khi đọc file Excel! Vui lòng kiểm tra định dạng.');
            setParsedData([]);
        } finally {
            setIsParsing(false);
        }
    };

    // Xử lý dán text
    const handlePasteChange = (text: string) => {
        setRawPasteText(text);
        setErrorMsg('');
        if (!text.trim()) {
            setParsedData([]);
            return;
        }
        const rows = parseClipboardTargetText(text, campaigns);
        setParsedData(rows);
        if (rows.length === 0) {
            setErrorMsg('Chưa nhận diện được cấu trúc cột hợp lệ!');
        }
    };

    // Đếm số dòng hợp lệ
    const validCount = parsedData.filter(r => empMap.has(r.employee_id.toLowerCase())).length;

    const handleConfirmApply = () => {
        if (parsedData.length === 0) return;
        onApplyTargets(parsedData);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-100 flex flex-col max-h-[92vh]">
                {/* Header Modal */}
                <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 p-4 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                            <UploadCloud className="w-5 h-5 text-amber-300" />
                        </div>
                        <div>
                            <h3 className="font-extrabold text-base leading-tight">Nhập Liệu Mục Tiêu Nhân Viên</h3>
                            <p className="text-xs text-blue-200">Import từ file Excel hoặc dán bảng trực tiếp từ clipboard</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tab Switcher & Template Button */}
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => { setActiveTab('excel'); setParsedData([]); setErrorMsg(''); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                                activeTab === 'excel'
                                    ? 'bg-white text-blue-700 shadow-2xs border border-slate-200'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                            <span>1. File Excel (.xlsx)</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => { setActiveTab('paste'); setParsedData([]); setErrorMsg(''); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                                activeTab === 'paste'
                                    ? 'bg-white text-blue-700 shadow-2xs border border-slate-200'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            <ClipboardPaste className="w-4 h-4 text-blue-600" />
                            <span>2. Dán Văn Bản (Parse Text)</span>
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={onDownloadTemplate}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition"
                        title="Tải mẫu Excel theo đúng các cột hiện tại"
                    >
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Tải File Excel Mẫu</span>
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
                    {/* TAB 1: EXCEL UPLOAD */}
                    {activeTab === 'excel' && (
                        <div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx, .xls, .csv"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/60 hover:bg-blue-50/30 rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2.5"
                            >
                                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
                                    <FileSpreadsheet className="w-6 h-6" />
                                </div>
                                <div>
                                    <span className="text-xs font-bold text-slate-800 block">
                                        {selectedFile ? selectedFile.name : 'Bấm để chọn file Excel hoặc kéo thả vào đây'}
                                    </span>
                                    <span className="text-[11px] text-slate-500 mt-0.5 block">
                                        Hỗ trợ các định dạng .xlsx, .xls, .csv theo cấu trúc cột chuẩn của hệ thống
                                    </span>
                                </div>
                                {isParsing && (
                                    <span className="text-xs font-semibold text-blue-600 animate-pulse">
                                        Đang đọc dữ liệu từ file Excel...
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB 2: TEXT PASTE */}
                    {activeTab === 'paste' && (
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-xs font-bold text-slate-700">
                                    Dán bảng từ Excel / Google Sheets vào đây:
                                </label>
                                {rawPasteText && (
                                    <button
                                        onClick={() => { setRawPasteText(''); setParsedData([]); }}
                                        className="text-[11px] text-rose-600 hover:underline flex items-center gap-1"
                                    >
                                        <Trash2 className="w-3 h-3" /> Xóa trắng
                                    </button>
                                )}
                            </div>
                            <textarea
                                rows={5}
                                value={rawPasteText}
                                onChange={e => handlePasteChange(e.target.value)}
                                placeholder="Copy các cột (Mã NV [tab] Họ tên [tab] Siêu thị [tab] Target Doanh thu [tab] Thi đua 1 [tab]...) và dán vào đây"
                                className="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-800"
                            />
                        </div>
                    )}

                    {/* Error Message */}
                    {errorMsg && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {/* BẢNG XEM TRƯỚC (PREVIEW) */}
                    {parsedData.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-slate-700 flex items-center gap-1.5">
                                    <span>Xem trước kết quả nhận diện:</span>
                                    <span className="text-blue-600 font-extrabold">{parsedData.length} dòng</span>
                                    <span>({validCount} mã khớp nhân sự)</span>
                                </span>
                                {validCount > 0 && (
                                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Sẵn sàng áp dụng
                                    </span>
                                )}
                            </div>

                            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
                                        <tr>
                                            <th className="p-2 border-b w-10 text-center">STT</th>
                                            <th className="p-2 border-b w-24">Mã NV</th>
                                            <th className="p-2 border-b">Họ và tên</th>
                                            <th className="p-2 border-b text-right">Target Doanh Thu</th>
                                            {campaigns.slice(0, 3).map(c => (
                                                <th key={c.raw_key} className="p-2 border-b text-right truncate max-w-[100px]">
                                                    {c.display_name}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {parsedData.slice(0, 50).map((row, idx) => {
                                            const matchedEmp = empMap.get(row.employee_id.toLowerCase());
                                            return (
                                                <tr key={idx} className="hover:bg-slate-50">
                                                    <td className="p-2 text-center text-slate-400 font-mono">{idx + 1}</td>
                                                    <td className="p-2 font-mono font-bold text-blue-700 flex items-center gap-1">
                                                        <span>{row.employee_id}</span>
                                                        {matchedEmp ? (
                                                            <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                                                        ) : (
                                                            <span title="Mã NV chưa có trong danh mục">
                                                                <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-2 font-semibold text-slate-800">
                                                        {matchedEmp ? matchedEmp.full_name : (row.full_name || '—')}
                                                    </td>
                                                    <td className="p-2 text-right font-mono font-bold text-slate-900">
                                                        {row.target_revenue !== undefined ? row.target_revenue.toLocaleString('vi-VN') : '—'}
                                                    </td>
                                                    {campaigns.slice(0, 3).map(c => (
                                                        <td key={c.raw_key} className="p-2 text-right font-mono text-slate-700">
                                                            {row.campaign_targets[c.raw_key] !== undefined
                                                                ? row.campaign_targets[c.raw_key].toLocaleString('vi-VN')
                                                                : '—'}
                                                        </td>
                                                    ))}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Modal */}
                <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                        {parsedData.length > 0 ? `Đã nhận diện ${parsedData.length} nhân sự` : 'Chưa chọn dữ liệu'}
                    </span>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                        >
                            Đóng
                        </button>
                        <button
                            type="button"
                            disabled={parsedData.length === 0}
                            onClick={handleConfirmApply}
                            className="px-5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
                        >
                            <span>Áp Dụng Vào Bảng Mục Tiêu</span>
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
