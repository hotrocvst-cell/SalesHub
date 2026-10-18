import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Sparkles, AlertCircle, Tag, Eye, ChevronDown } from 'lucide-react';
import type { CampaignProgramItem, CampaignOrientation, CampaignCalculationMethod, ProductStatusType } from '../types';
import type { CampaignDictItem } from '../../../core/lib/storage';
import TextFormatHelperToolbar from './TextFormatHelperToolbar';
import FormattedCampaignText from './FormattedCampaignText';
import { matchCampaignDictionary } from '../utils/campaignExcelHelper';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSave: (item: Partial<CampaignProgramItem>) => Promise<boolean>;
    editingItem: CampaignProgramItem | null;
    existingGroups: string[];
    campaignDict?: CampaignDictItem[];
}

const COMMON_ORIENTATIONS: CampaignOrientation[] = ['Chính', 'Bán kèm', 'Phụ', 'Trọng tâm'];
const COMMON_CALCS: CampaignCalculationMethod[] = ['Doanh thu', 'DTQĐ', 'Số lượng', 'SLQĐ'];
const COMMON_STATUSES: ProductStatusType[] = ['Tất cả (All)', 'Mới', 'Cũ', 'Đổi trả'];

export default function CampaignProgramEditModal({
    isOpen,
    onClose,
    onSave,
    editingItem,
    existingGroups,
    campaignDict = []
}: Props) {
    const rulesTextareaRef = useRef<HTMLTextAreaElement>(null);
    const oppTextareaRef = useRef<HTMLTextAreaElement>(null);

    const [groupName, setGroupName] = useState('ICT');
    const [customGroup, setCustomGroup] = useState('');
    const [programName, setProgramName] = useState('');
    const [shortName, setShortName] = useState('');
    const [mappedKey, setMappedKey] = useState('');
    const [orientation, setOrientation] = useState<CampaignOrientation>('Chính');
    const [calcMethod, setCalcMethod] = useState<CampaignCalculationMethod>('Doanh thu');
    const [rules, setRules] = useState('');
    const [productStatus, setProductStatus] = useState<ProductStatusType>('Tất cả (All)');
    const [opportunity, setOpportunity] = useState('');
    const [targetPeriod, setTargetPeriod] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // Toggle xem trước trực tiếp
    const [showPreview, setShowPreview] = useState(false);

    useEffect(() => {
        if (editingItem) {
            setGroupName(editingItem.group_name || 'ICT');
            setCustomGroup('');
            setProgramName(editingItem.program_name || '');
            setShortName(editingItem.short_name || '');
            setMappedKey(editingItem.mapped_key || '');
            setOrientation(editingItem.orientation || 'Chính');
            setCalcMethod(editingItem.calculation_method || 'Doanh thu');
            setRules(editingItem.rules || '');
            setProductStatus(editingItem.product_status || 'Tất cả (All)');
            setOpportunity(editingItem.opportunity || '');
            setTargetPeriod(editingItem.target_period || '');
            setIsActive(editingItem.is_active !== false);
        } else {
            setGroupName('ICT');
            setCustomGroup('');
            setProgramName('');
            setShortName('');
            setMappedKey('');
            setOrientation('Chính');
            setCalcMethod('Doanh thu');
            setRules('');
            setProductStatus('Tất cả (All)');
            setOpportunity('');
            setTargetPeriod('Tháng 10/2026');
            setIsActive(true);
        }
        setErrorMsg('');
        setShowPreview(false);
    }, [editingItem, isOpen]);

    if (!isOpen) return null;

    // Chọn từ điển thi đua từ dropdown
    const handleSelectDictionaryItem = (selectedRawKey: string) => {
        if (!selectedRawKey) {
            setShortName('');
            setMappedKey('');
            return;
        }

        const dictItem = campaignDict.find(d => d.raw_key === selectedRawKey);
        if (dictItem) {
            setShortName(dictItem.display_name);
            setMappedKey(dictItem.raw_key);
            // Nếu chưa có tên chương trình, tự động gợi ý tên
            if (!programName.trim()) {
                setProgramName(`Thi Đua ${dictItem.display_name}`);
            }
        }
    };

    // Tự động so khớp theo tên chương trình
    const handleAutoMatch = () => {
        if (!programName.trim()) {
            setErrorMsg('Vui lòng nhập tên chương trình trước khi tự động so khớp');
            return;
        }
        const matched = matchCampaignDictionary(programName, campaignDict);
        if (matched) {
            setShortName(matched.short_name);
            setMappedKey(matched.mapped_key);
            setErrorMsg('');
        } else {
            setErrorMsg('Không tìm thấy mục khớp trong Từ điển thi đua. Bạn có thể chọn thủ công trong danh sách.');
        }
    };

    // Chèn cú pháp định dạng vào ô textarea
    const insertTagToTextarea = (
        target: 'rules' | 'opportunity',
        prefix: string,
        suffix: string
    ) => {
        const textarea = target === 'rules' ? rulesTextareaRef.current : oppTextareaRef.current;
        const currentVal = target === 'rules' ? rules : opportunity;
        const setVal = target === 'rules' ? setRules : setOpportunity;

        if (!textarea) {
            setVal(currentVal + `${prefix}${suffix}`);
            return;
        }

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = currentVal.substring(start, end);
        const replacement = `${prefix}${selectedText || 'nội dung'}${suffix}`;
        const nextVal = currentVal.substring(0, start) + replacement + currentVal.substring(end);

        setVal(nextVal);

        setTimeout(() => {
            textarea.focus();
            const newCursorPos = start + prefix.length + (selectedText ? selectedText.length : 'nội dung'.length);
            textarea.setSelectionRange(newCursorPos, newCursorPos);
        }, 50);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const finalGroup = groupName === 'CUSTOM' ? customGroup.trim() : groupName.trim();
        if (!finalGroup) {
            setErrorMsg('Vui lòng chọn hoặc nhập nhóm thi đua');
            return;
        }
        if (!programName.trim()) {
            setErrorMsg('Vui lòng nhập tên chương trình thi đua');
            return;
        }

        setIsSaving(true);
        try {
            const success = await onSave({
                id: editingItem?.id,
                group_name: finalGroup,
                program_name: programName.trim(),
                short_name: shortName.trim() || undefined,
                mapped_key: mappedKey.trim() || undefined,
                orientation,
                calculation_method: calcMethod,
                rules: rules.trim(),
                product_status: productStatus,
                opportunity: opportunity.trim(),
                target_period: targetPeriod.trim(),
                is_active: isActive
            });
            if (success) {
                onClose();
            }
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-avo animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
                {/* Header Modal */}
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                            <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-900">
                                {editingItem ? 'Chỉnh Sửa Chương Trình Thi Đua' : 'Thêm Chương Trình Thi Đua Mới'}
                            </h3>
                            <p className="text-[11px] text-slate-400">
                                Cập nhật thể lệ, định hướng, liên kết Từ điển thi đua và các cơ hội bán hàng
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

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
                    {errorMsg && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {/* Hàng 1: Nhóm thi đua & Định hướng */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-xs font-black text-slate-800 uppercase tracking-wide">
                                Nhóm thi đua <span className="text-rose-500">*</span>
                            </label>
                            <select
                                value={groupName}
                                onChange={e => setGroupName(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                            >
                                {['ICT', 'CE', 'Dịch vụ', 'Phụ kiện', 'Gia dụng', ...existingGroups.filter(g => !['ICT', 'CE', 'Dịch vụ', 'Phụ kiện', 'Gia dụng'].includes(g))].map(g => (
                                    <option key={g} value={g}>{g}</option>
                                ))}
                                <option value="CUSTOM">+ Nhập nhóm mới...</option>
                            </select>
                            {groupName === 'CUSTOM' && (
                                <input
                                    type="text"
                                    placeholder="Nhập tên nhóm mới..."
                                    value={customGroup}
                                    onChange={e => setCustomGroup(e.target.value)}
                                    className="w-full mt-1.5 px-3 py-1.5 bg-white border border-blue-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                                />
                            )}
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-black text-slate-800 uppercase tracking-wide">
                                Định hướng
                            </label>
                            <select
                                value={orientation}
                                onChange={e => setOrientation(e.target.value as CampaignOrientation)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                            >
                                {COMMON_ORIENTATIONS.map(o => (
                                    <option key={o} value={o}>{o}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Hàng 2: Tên chương trình thi đua & Nút tự động so khớp */}
                    <div className="space-y-1">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-black text-slate-800 uppercase tracking-wide">
                                Tên chương trình thi đua <span className="text-rose-500">*</span>
                            </label>
                            {campaignDict.length > 0 && (
                                <button
                                    type="button"
                                    onClick={handleAutoMatch}
                                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 cursor-pointer"
                                    title="Tự động so khớp với Từ điển thi đua cấu hình admin"
                                >
                                    <Sparkles className="w-3 h-3 text-blue-500" />
                                    <span>⚡ Tự động so khớp Từ điển</span>
                                </button>
                            )}
                        </div>
                        <input
                            type="text"
                            placeholder="Ví dụ: Thi Đua iPhone 16 Series Vượt Trội..."
                            value={programName}
                            onChange={e => setProgramName(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* HÀNG 2B: LIÊN KẾT TỪ ĐIỂN THI ĐUA CỦA TRANG CẤU HÌNH ADMIN (YÊU CẦU 4) */}
                    <div className="bg-purple-50/60 border border-purple-200 rounded-2xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-black text-purple-900 uppercase tracking-wide">
                                <Tag className="w-3.5 h-3.5 text-purple-600" />
                                <span>Liên kết Từ Điển Thi Đua (Mapping Trang Cấu Hình)</span>
                            </div>
                            {shortName && (
                                <span className="px-2 py-0.5 rounded-md text-[10.5px] font-black bg-purple-100 text-purple-800 border border-purple-300">
                                    Viết tắt: {shortName}
                                </span>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-purple-900">
                                    Chọn từ danh mục cấu hình:
                                </label>
                                <select
                                    value={mappedKey}
                                    onChange={e => handleSelectDictionaryItem(e.target.value)}
                                    className="w-full px-2.5 py-1.5 bg-white border border-purple-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500 cursor-pointer"
                                >
                                    <option value="">— Chưa liên kết (Không bắt buộc) —</option>
                                    {campaignDict.map(dict => (
                                        <option key={dict.raw_key} value={dict.raw_key}>
                                            {dict.display_name} — [Nhập: {dict.raw_key}] ({dict.unit || 'Cái'})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[11px] font-bold text-purple-900">
                                    Tên viết tắt hiển thị:
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ví dụ: iPhone, Phụ kiện, SIM..."
                                    value={shortName}
                                    onChange={e => setShortName(e.target.value)}
                                    className="w-full px-2.5 py-1.5 bg-white border border-purple-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
                                />
                            </div>
                        </div>

                        <p className="text-[10px] text-purple-700 leading-tight">
                            * Khi liên kết, chương trình sẽ hiển thị đồng bộ mã viết tắt do admin cấu hình và tự động đồng bộ nhịp dữ liệu từ báo cáo mục tiêu.
                        </p>
                    </div>

                    {/* Hàng 3: Cách tính & Trạng thái sản phẩm & Kỳ áp dụng */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                            <label className="text-xs font-black text-slate-800 uppercase tracking-wide">
                                Cách tính
                            </label>
                            <select
                                value={calcMethod}
                                onChange={e => setCalcMethod(e.target.value as CampaignCalculationMethod)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                            >
                                {COMMON_CALCS.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-black text-slate-800 uppercase tracking-wide">
                                Trạng thái sản phẩm
                            </label>
                            <select
                                value={productStatus}
                                onChange={e => setProductStatus(e.target.value as ProductStatusType)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                            >
                                {COMMON_STATUSES.map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-black text-slate-800 uppercase tracking-wide">
                                Kỳ áp dụng
                            </label>
                            <input
                                type="text"
                                placeholder="Tháng 10/2026..."
                                value={targetPeriod}
                                onChange={e => setTargetPeriod(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {/* Hàng 4: Thể lệ thi đua (Kèm Toolbar chèn định dạng & Hướng dẫn) */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-black text-slate-800 uppercase tracking-wide">
                                Thể lệ & Điều kiện đạt
                            </label>
                            <button
                                type="button"
                                onClick={() => setShowPreview(!showPreview)}
                                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                            >
                                <Eye className="w-3.5 h-3.5" />
                                <span>{showPreview ? 'Ẩn xem trước' : 'Bật xem trước trực tiếp'}</span>
                            </button>
                        </div>

                        {/* Toolbar chèn định dạng */}
                        <TextFormatHelperToolbar
                            onInsertTag={(pre, suf) => insertTagToTextarea('rules', pre, suf)}
                        />

                        <textarea
                            ref={rulesTextareaRef}
                            rows={4}
                            placeholder="Mô tả thể lệ, điều kiện đạt, mức thưởng. Ví dụ:&#10;**Thưởng 150.000đ/máy** khi đạt 100% target.&#10;- [red]Nhân đôi điểm thi đua[/red] cho ca bán trên 3 máy.&#10;- Nhấn Enter để xuống dòng."
                            value={rules}
                            onChange={e => setRules(e.target.value)}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium leading-relaxed"
                        />

                        {/* Khối xem trước trực tiếp Thể Lệ nếu bật */}
                        {showPreview && rules && (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
                                <div className="text-[10px] font-black uppercase text-slate-400">Xem trước Thể lệ:</div>
                                <FormattedCampaignText text={rules} />
                            </div>
                        )}
                    </div>

                    {/* Hàng 5: Cơ hội (CTKM) */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-black text-slate-800 uppercase tracking-wide">
                                Cơ hội & Khuyến mãi (CTKM nếu có)
                            </label>
                        </div>

                        {/* Toolbar chèn định dạng cho CTKM */}
                        <TextFormatHelperToolbar
                            onInsertTag={(pre, suf) => insertTagToTextarea('opportunity', pre, suf)}
                        />

                        <textarea
                            ref={oppTextareaRef}
                            rows={3}
                            placeholder="Các chương trình khuyến mãi, quà tặng, trợ giá hỗ trợ tư vấn chốt đơn...&#10;Ví dụ: Giảm 2.5tr qua [blue]VNPAY[/blue], Trợ giá [green]thu cũ đổi mới[/green]..."
                            value={opportunity}
                            onChange={e => setOpportunity(e.target.value)}
                            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium leading-relaxed"
                        />

                        {/* Khối xem trước trực tiếp Cơ Hội nếu bật */}
                        {showPreview && opportunity && (
                            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-xs space-y-1">
                                <div className="text-[10px] font-black uppercase text-amber-600">Xem trước CTKM:</div>
                                <FormattedCampaignText text={opportunity} />
                            </div>
                        )}
                    </div>

                    {/* Hàng 6: Checkbox kích hoạt */}
                    <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
                        <input
                            type="checkbox"
                            checked={isActive}
                            onChange={e => setIsActive(e.target.checked)}
                            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                        />
                        <span className="text-xs font-bold text-slate-800">
                            Chương trình đang áp dụng (Hiển thị ưu tiên)
                        </span>
                    </label>

                    {/* Footer Actions */}
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
                        >
                            <Save className="w-3.5 h-3.5" />
                            <span>{isSaving ? 'Đang lưu...' : 'Lưu Chương Trình'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
