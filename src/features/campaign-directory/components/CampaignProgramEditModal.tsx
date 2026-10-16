import React, { useState, useEffect } from 'react';
import { X, Save, Sparkles, AlertCircle } from 'lucide-react';
import type { CampaignProgramItem, CampaignOrientation, CampaignCalculationMethod, ProductStatusType } from '../types';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSave: (item: Partial<CampaignProgramItem>) => Promise<boolean>;
    editingItem: CampaignProgramItem | null;
    existingGroups: string[];
}

const COMMON_ORIENTATIONS: CampaignOrientation[] = ['Chính', 'Bán kèm', 'Phụ', 'Trọng tâm'];
const COMMON_CALCS: CampaignCalculationMethod[] = ['Doanh thu', 'DTQĐ', 'Số lượng', 'SLQĐ'];
const COMMON_STATUSES: ProductStatusType[] = ['Tất cả (All)', 'Mới', 'Cũ', 'Đổi trả'];

export default function CampaignProgramEditModal({
    isOpen,
    onClose,
    onSave,
    editingItem,
    existingGroups
}: Props) {
    const [groupName, setGroupName] = useState('ICT');
    const [customGroup, setCustomGroup] = useState('');
    const [programName, setProgramName] = useState('');
    const [orientation, setOrientation] = useState<CampaignOrientation>('Chính');
    const [calcMethod, setCalcMethod] = useState<CampaignCalculationMethod>('Doanh thu');
    const [rules, setRules] = useState('');
    const [productStatus, setProductStatus] = useState<ProductStatusType>('Tất cả (All)');
    const [opportunity, setOpportunity] = useState('');
    const [targetPeriod, setTargetPeriod] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (editingItem) {
            setGroupName(editingItem.group_name || 'ICT');
            setCustomGroup('');
            setProgramName(editingItem.program_name || '');
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
            setOrientation('Chính');
            setCalcMethod('Doanh thu');
            setRules('');
            setProductStatus('Tất cả (All)');
            setOpportunity('');
            setTargetPeriod('Tháng 10/2026');
            setIsActive(true);
        }
        setErrorMsg('');
    }, [editingItem, isOpen]);

    if (!isOpen) return null;

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
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto font-avo animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
                {/* Header Modal */}
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                            <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-900">
                                {editingItem ? 'Chỉnh Sửa Chương Trình Thi Đua' : 'Thêm Chương Trình Thi Đua Mới'}
                            </h3>
                            <p className="text-[11px] text-slate-400">
                                Cập nhật thể lệ, định hướng và các cơ hội bán hàng cho toàn hệ thống
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

                    {/* Hàng 2: Tên chương trình thi đua */}
                    <div className="space-y-1">
                        <label className="text-xs font-black text-slate-800 uppercase tracking-wide">
                            Tên chương trình thi đua <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="text"
                            placeholder="Ví dụ: Thi Đua iPhone 16 Series Vượt Trội..."
                            value={programName}
                            onChange={e => setProgramName(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                        />
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

                    {/* Hàng 4: Thể lệ thi đua */}
                    <div className="space-y-1">
                        <label className="text-xs font-black text-slate-800 uppercase tracking-wide">
                            Thể lệ & Điều kiện đạt
                        </label>
                        <textarea
                            rows={3}
                            placeholder="Mô tả chi tiết thể lệ, điều kiện đạt, mức thưởng hoặc điểm thi đua..."
                            value={rules}
                            onChange={e => setRules(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
                        />
                    </div>

                    {/* Hàng 5: Cơ hội (CTKM) */}
                    <div className="space-y-1">
                        <label className="text-xs font-black text-slate-800 uppercase tracking-wide">
                            Cơ hội & Khuyến mãi (CTKM nếu có)
                        </label>
                        <textarea
                            rows={2}
                            placeholder="Các chương trình khuyến mãi, trợ giá, quà tặng bán kèm hỗ trợ chốt đơn..."
                            value={opportunity}
                            onChange={e => setOpportunity(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
                        />
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
                            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50"
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
