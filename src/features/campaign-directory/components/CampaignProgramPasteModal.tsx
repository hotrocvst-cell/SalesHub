import React, { useState, useMemo, useRef } from 'react';
import {
    X,
    FileSpreadsheet,
    CheckCircle2,
    AlertCircle,
    UploadCloud,
    Download,
    FileUp,
    ClipboardPaste,
    Sparkles,
    Check,
    Tag,
    Info,
    HelpCircle,
    Sliders
} from 'lucide-react';
import type { CampaignProgramItem } from '../types';
import type { CampaignDictItem } from '../../../core/lib/storage';
import {
    exportCampaignProgramTemplate,
    parseCampaignExcelFile,
    parseCampaignTsvOrCsv
} from '../utils/campaignExcelHelper';
import { beautifyCampaignProgramItem } from '../utils/campaignTextBeautifier';
import FormattedCampaignText from './FormattedCampaignText';
import BeautifierConfigGuideModal from './BeautifierConfigGuideModal';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onBatchSave: (items: CampaignProgramItem[], replaceAll: boolean) => Promise<boolean>;
    currentPrograms: CampaignProgramItem[];
    campaignDict?: CampaignDictItem[];
}

export default function CampaignProgramPasteModal({
    isOpen,
    onClose,
    onBatchSave,
    currentPrograms,
    campaignDict = []
}: Props) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importMode, setImportMode] = useState<'excel' | 'paste'>('excel');

    // Tab 1: File Excel
    const [uploadedFileName, setUploadedFileName] = useState<string>('');
    const [isReadingFile, setIsReadingFile] = useState<boolean>(false);
    const [excelParsedItems, setExcelParsedItems] = useState<CampaignProgramItem[]>([]);

    // Tab 2: Text dán
    const [rawText, setRawText] = useState<string>('');

    // Shared state
    const [replaceAll, setReplaceAll] = useState<boolean>(false);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [isExportingTemplate, setIsExportingTemplate] = useState<boolean>(false);
    const [errorMsg, setErrorMsg] = useState<string>('');
    const [successNote, setSuccessNote] = useState<string>('');

    // Tự động định dạng văn bản thông minh (Smart Auto-Beautifier)
    const [autoBeautify, setAutoBeautify] = useState<boolean>(true);
    const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);

    // Bóc tách dữ liệu từ text dán qua state-machine parser
    const pasteParsedItems = useMemo(() => {
        if (!rawText.trim()) return [];
        return parseCampaignTsvOrCsv(rawText, campaignDict);
    }, [rawText, campaignDict]);

    // Danh sách hiển thị preview dựa trên tab hiện tại và tùy chọn tự động làm đẹp
    const activeParsedItems = useMemo(() => {
        const base = importMode === 'excel' ? excelParsedItems : pasteParsedItems;
        if (!autoBeautify) return base;
        return base.map(beautifyCampaignProgramItem);
    }, [importMode, excelParsedItems, pasteParsedItems, autoBeautify]);

    if (!isOpen) return null;

    // 1. Tải file Excel mẫu
    const handleDownloadTemplate = async () => {
        setIsExportingTemplate(true);
        try {
            await exportCampaignProgramTemplate(campaignDict);
        } catch (e: any) {
            console.error('Lỗi xuất file Excel mẫu:', e);
            setErrorMsg(`Không thể tạo file mẫu: ${e?.message || 'Lỗi xử lý'}`);
        } finally {
            setIsExportingTemplate(false);
        }
    };

    // 2. Xử lý tải file Excel lên
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setErrorMsg('');
        setSuccessNote('');
        setIsReadingFile(true);
        setUploadedFileName(file.name);

        try {
            const items = await parseCampaignExcelFile(file, campaignDict);
            if (items.length === 0) {
                setErrorMsg('Không tìm thấy dòng dữ liệu chương trình nào trong file Excel!');
                setExcelParsedItems([]);
            } else {
                setExcelParsedItems(items);
                setSuccessNote(`Đã đọc thành công ${items.length} chương trình từ file "${file.name}"!`);
            }
        } catch (err: any) {
            console.error('Lỗi đọc file Excel:', err);
            setErrorMsg(`Lỗi đọc file Excel: ${err?.message || 'Định dạng file không hợp lệ'}`);
            setExcelParsedItems([]);
        } finally {
            setIsReadingFile(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // 3. Áp dụng lưu dữ liệu
    const handleSave = async () => {
        if (activeParsedItems.length === 0) {
            setErrorMsg('Chưa có dòng dữ liệu hợp lệ nào được bóc tách!');
            return;
        }

        setIsSaving(true);
        try {
            const finalItems = replaceAll ? activeParsedItems : [...activeParsedItems, ...currentPrograms];
            const success = await onBatchSave(finalItems, replaceAll);
            if (success) {
                setRawText('');
                setExcelParsedItems([]);
                setUploadedFileName('');
                onClose();
            }
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-avo animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
                {/* Header Modal */}
                <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
                            <FileSpreadsheet className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                                <span>Nhập Chương Trình Thi Đua Từ Excel</span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                                    Mới & Khắc Phục Lỗi
                                </span>
                            </h3>
                            <p className="text-[11px] text-slate-400">
                                Hỗ trợ xuất file Excel mẫu chuẩn, nhập file trực tiếp hoặc dán nhanh an toàn với ô xuống hàng
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

                {/* Sub-Header Tabs */}
                <div className="flex items-center px-6 pt-3 border-b border-slate-200 bg-white gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            setImportMode('excel');
                            setErrorMsg('');
                        }}
                        className={`pb-2.5 px-3.5 text-xs font-black transition flex items-center gap-2 cursor-pointer border-b-2 ${
                            importMode === 'excel'
                                ? 'border-purple-600 text-purple-700 font-extrabold'
                                : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <FileUp className="w-4 h-4" />
                        <span>1. Nhập Bằng File Excel (.xlsx) [Khuyên dùng]</span>
                        {excelParsedItems.length > 0 && (
                            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-purple-100 text-purple-800">
                                {excelParsedItems.length}
                            </span>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setImportMode('paste');
                            setErrorMsg('');
                        }}
                        className={`pb-2.5 px-3.5 text-xs font-black transition flex items-center gap-2 cursor-pointer border-b-2 ${
                            importMode === 'paste'
                                ? 'border-purple-600 text-purple-700 font-extrabold'
                                : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        <ClipboardPaste className="w-4 h-4" />
                        <span>2. Dán Nhanh (Ctrl + V)</span>
                        {pasteParsedItems.length > 0 && (
                            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-purple-100 text-purple-800">
                                {pasteParsedItems.length}
                            </span>
                        )}
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
                    {/* TAB 1: NHẬP TỪ FILE EXCEL */}
                    {importMode === 'excel' && (
                        <div className="space-y-4">
                            {/* Khối tải file mẫu */}
                            <div className="bg-gradient-to-r from-purple-50/80 to-indigo-50/50 border border-purple-200/90 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-1.5 text-xs font-black text-purple-900 uppercase tracking-wide">
                                        <Sparkles className="w-4 h-4 text-purple-600" />
                                        <span>File Excel Mẫu Chuẩn SalesHub (.xlsx)</span>
                                    </div>
                                    <p className="text-[11px] text-purple-800 leading-relaxed max-w-xl">
                                        File mẫu gồm Sheet dữ liệu chuẩn 9 cột, Sheet tổng hợp toàn bộ các thẻ &amp; cách dùng định dạng text (chữ đậm, màu sắc, highlight, bullet gạch đầu dòng...), và Sheet từ điển thi đua cấu hình admin để tra cứu mapping.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleDownloadTemplate}
                                    disabled={isExportingTemplate}
                                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-xs shrink-0 disabled:opacity-50 active:scale-95"
                                >
                                    <Download className="w-4 h-4" />
                                    <span>{isExportingTemplate ? 'Đang tạo file...' : 'Tải File Excel Mẫu'}</span>
                                </button>
                            </div>

                            {/* Drop Zone chọn file Excel */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                                    <span>Tải Lên File Excel (.xlsx, .xls)</span>
                                </label>

                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-slate-300 hover:border-purple-500 hover:bg-purple-50/40 rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 bg-slate-50/60"
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".xlsx, .xls"
                                        onChange={handleFileUpload}
                                        className="hidden"
                                    />
                                    <div className="w-11 h-11 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-2xs">
                                        <FileUp className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-slate-800">
                                            {isReadingFile
                                                ? 'Đang đọc và phân tích file Excel...'
                                                : uploadedFileName
                                                ? `File đã chọn: ${uploadedFileName}`
                                                : 'Bấm vào đây để chọn file Excel từ máy tính của bạn'}
                                        </p>
                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                            Hỗ trợ định dạng .xlsx hoặc .xls, tự động nhận diện tiêu đề cột linh hoạt
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* TAB 2: DÁN NHANH BẰNG BỘ PHÂN TÍCH STATE-MACHINE */}
                    {importMode === 'paste' && (
                        <div className="space-y-3">
                            {/* Hướng dẫn thứ tự cột và tính năng chống lỗi xuống hàng */}
                            <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-3 text-xs space-y-1.5 text-purple-950">
                                <div className="font-black uppercase tracking-wider text-[11px] text-purple-900 flex items-center justify-between">
                                    <span className="flex items-center gap-1.5">
                                        <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                                        <span>Thứ tự các cột copy từ Excel (Ngăn cách bởi phím Tab):</span>
                                    </span>
                                    <span className="text-[10px] text-emerald-800 font-extrabold bg-emerald-100 px-2 py-0.5 rounded-md border border-emerald-300">
                                        ✓ An toàn 100% với ô xuống dòng
                                    </span>
                                </div>
                                <div className="font-mono text-[10.5px] bg-white p-2 rounded-xl border border-purple-200 overflow-x-auto text-slate-800 leading-relaxed">
                                    [Nhóm] [TAB] [Tên CT] [TAB] [Tên Viết Tắt] [TAB] [Định Hướng] [TAB] [Cách Tính] [TAB] [Trạng Thái SP] [TAB] [Kỳ] [TAB] [Thể Lệ] [TAB] [Cơ Hội]
                                </div>
                                <p className="text-[10.5px] text-purple-800 leading-snug">
                                    • Bộ bóc tách mới tự động xử lý các ô có dấu ngoặc kép hoặc nhấn <kbd className="font-mono font-bold bg-white px-1 rounded border">Alt+Enter</kbd> xuống hàng trong ô Excel, không còn bị xé dòng làm lệch bảng như trước.
                                </p>
                            </div>

                            {/* Textarea dán nội dung */}
                            <div className="space-y-1">
                                <label className="text-xs font-black text-slate-800 uppercase tracking-wide">
                                    Nội dung dán (Ctrl + V)
                                </label>
                                <textarea
                                    rows={5}
                                    value={rawText}
                                    onChange={e => {
                                        setRawText(e.target.value);
                                        setErrorMsg('');
                                    }}
                                    placeholder="Sao chép các dòng trong Excel rồi dán (Ctrl + V) vào đây... Hệ thống sẽ tự động bóc tách và bỏ qua dòng tiêu đề nếu có."
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-purple-500 shadow-inner"
                                />
                            </div>
                        </div>
                    )}

                    {/* Thông báo lỗi & thành công */}
                    {errorMsg && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {successNote && (
                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>{successNote}</span>
                        </div>
                    )}

                    {/* KHỐI CÔNG CỤ TỰ ĐỘNG ĐỊNH DẠNG THÔNG MINH & HƯỚNG DẪN CẤU HÌNH */}
                    <div className="bg-gradient-to-r from-purple-50 via-indigo-50/50 to-blue-50/60 border border-purple-200/90 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={autoBeautify}
                                onChange={e => setAutoBeautify(e.target.checked)}
                                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-purple-300 cursor-pointer shrink-0"
                            />
                            <div className="space-y-0.5">
                                <div className="text-xs font-black text-purple-950 flex items-center gap-1.5 flex-wrap">
                                    <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                    <span>Tự động định dạng văn bản thông minh (Auto Beautify)</span>
                                    <span className={`text-[10px] font-black px-1.5 py-0.2 rounded-md ${
                                        autoBeautify ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-700'
                                    }`}>
                                        {autoBeautify ? 'ĐANG BẬT' : 'ĐÃ TẮT'}
                                    </span>
                                </div>
                                <p className="text-[10.5px] text-purple-800 leading-tight">
                                    Tự động in đậm số tiền/target, gắn thẻ màu [red], [blue], [green] và gạch đầu dòng bullet cho văn bản thô.
                                </p>
                            </div>
                        </label>

                        {/* NÚT HƯỚNG DẪN CÁCH TỰ THAY ĐỔI & CẬP NHẬT CƠ CHẾ NHẬN DIỆN */}
                        <button
                            type="button"
                            onClick={() => setIsGuideOpen(true)}
                            className="px-3 py-1.5 bg-white hover:bg-purple-100/60 text-purple-900 border border-purple-300 hover:border-purple-400 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs shrink-0 active:scale-95"
                            title="Mở hướng dẫn vị trí file mã nguồn và cách cập nhật thêm từ khóa nhận diện"
                        >
                            <Sliders className="w-3.5 h-3.5 text-purple-600" />
                            <span>Hướng dẫn cập nhật cơ chế nhận diện</span>
                        </button>
                    </div>

                    {/* BẢNG XEM TRƯỚC KẾT QUẢ BÓC TÁCH */}
                    {activeParsedItems.length > 0 && (
                        <div className="space-y-2 pt-1">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    <span>Xem trước: Bóc tách thành công {activeParsedItems.length} chương trình</span>
                                </span>

                                <span className="text-[11px] text-slate-400 font-medium">
                                    Cuộn ngang/dọc để kiểm tra dữ liệu trước khi bấm áp dụng
                                </span>
                            </div>

                            <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-56 overflow-y-auto shadow-2xs">
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead className="bg-slate-900 text-white font-black text-[10px] uppercase sticky top-0 z-10 select-none">
                                        <tr>
                                            <th className="p-2 border-r border-slate-800 w-10 text-center">STT</th>
                                            <th className="p-2 border-r border-slate-800 w-20">Nhóm</th>
                                            <th className="p-2 border-r border-slate-800 min-w-[160px]">Tên Chương Trình</th>
                                            <th className="p-2 border-r border-slate-800 min-w-[130px]">Viết Tắt / Mapping</th>
                                            <th className="p-2 border-r border-slate-800 w-24">Định Hướng</th>
                                            <th className="p-2 border-r border-slate-800 w-20">Cách Tính</th>
                                            <th className="p-2 border-r border-slate-800 min-w-[200px]">Thể Lệ & Thưởng</th>
                                            <th className="p-2 min-w-[160px]">Cơ Hội (CTKM)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 font-medium bg-white">
                                        {activeParsedItems.map((p, i) => (
                                            <tr key={i} className="hover:bg-slate-50/80">
                                                <td className="p-2 text-center font-mono text-slate-400 border-r">{i + 1}</td>
                                                <td className="p-2 font-black text-blue-700 border-r">{p.group_name}</td>
                                                <td className="p-2 font-extrabold text-slate-900 border-r">{p.program_name}</td>
                                                <td className="p-2 border-r">
                                                    {p.short_name ? (
                                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10.5px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                                                            <Tag className="w-3 h-3 text-purple-600" />
                                                            <span>{p.short_name}</span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 italic text-[10.5px]">—</span>
                                                    )}
                                                </td>
                                                <td className="p-2 border-r">{p.orientation}</td>
                                                <td className="p-2 border-r font-mono font-bold text-blue-900">{p.calculation_method}</td>
                                                <td className="p-2 border-r max-w-[240px]">
                                                    <div className="line-clamp-2 text-[11px] leading-snug">
                                                        <FormattedCampaignText text={p.rules} />
                                                    </div>
                                                </td>
                                                <td className="p-2 max-w-[200px]">
                                                    <div className="line-clamp-2 text-[11px] leading-snug">
                                                        <FormattedCampaignText text={p.opportunity} fallback="—" />
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Tùy chọn lưu: Thêm nối tiếp hay Ghi đè */}
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
                            disabled={isSaving || activeParsedItems.length === 0}
                            className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
                        >
                            <UploadCloud className="w-3.5 h-3.5" />
                            <span>{isSaving ? 'Đang lưu...' : `Áp Dụng (${activeParsedItems.length} CT)`}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal Hướng dẫn cách tự thay đổi & cập nhật cơ chế nhận diện */}
            <BeautifierConfigGuideModal
                isOpen={isGuideOpen}
                onClose={() => setIsGuideOpen(false)}
            />
        </div>
    );
}
