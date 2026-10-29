import React, { useState } from 'react';
import type { EmployeeItem, CampaignDictItem } from '../../../core/lib/storage';
import { cleanEmployeeName } from '../../../core/lib/formatters';
import type { CampaignOffsetItem } from '../services/campaignOffsetService';
import { Plus, X, ArrowRight, AlertCircle, Save } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    employees: EmployeeItem[];
    campaigns: CampaignDictItem[];
    storeName: string;
    month: number;
    year: number;
    onAdd: (newItem: CampaignOffsetItem) => void;
}

export default function ManualAddOffsetModal({
    isOpen,
    onClose,
    employees,
    campaigns,
    storeName,
    month,
    year,
    onAdd
}: Props) {
    const [employeeId, setEmployeeId] = useState('');
    const [fromCampaign, setFromCampaign] = useState('');
    const [toCampaign, setToCampaign] = useState('');
    const [quantity, setQuantity] = useState(1);
    const [note, setNote] = useState('');
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!employeeId) {
            setError('Vui lòng chọn nhân viên');
            return;
        }
        if (!fromCampaign) {
            setError('Vui lòng chọn ngành hàng có dư số (nguồn cấn)');
            return;
        }
        if (!toCampaign) {
            setError('Vui lòng chọn ngành hàng đang thiếu số (đích nhận)');
            return;
        }
        if (fromCampaign === toCampaign) {
            setError('Ngành hàng nguồn và ngành hàng đích không được trùng nhau');
            return;
        }
        if (quantity <= 0) {
            setError('Số lượng cấn trừ phải lớn hơn 0');
            return;
        }

        const newOffset: CampaignOffsetItem = {
            id: crypto.randomUUID(),
            store_name: storeName,
            month,
            year,
            employee_id: employeeId,
            from_campaign_key: fromCampaign,
            to_campaign_key: toCampaign,
            offset_quantity: Number(quantity),
            note: note.trim(),
            is_approved: true,
            created_at: new Date().toISOString()
        };

        onAdd(newOffset);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                            <Plus className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold tracking-tight">Thêm Cặp Cấn Trừ Thủ Công</h3>
                            <p className="text-[11px] text-slate-400">Quy tắc 1 đổi 1 giữa 2 ngành hàng của nhân sự</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs text-slate-800">
                    {error && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Chọn nhân viên */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Nhân viên: <span className="text-rose-500">*</span>
                        </label>
                        <select
                            value={employeeId}
                            onChange={e => setEmployeeId(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden font-bold"
                        >
                            <option value="">-- Chọn nhân viên thực hiện cấn trừ --</option>
                            {employees.map(emp => (
                                <option key={emp.employee_id} value={emp.employee_id}>
                                    {emp.employee_id} - {cleanEmployeeName(emp.full_name || '')}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Ngành nguồn & Ngành đích */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] font-bold text-emerald-700 mb-1">
                                Ngành hàng nguồn (Có dư): <span className="text-rose-500">*</span>
                            </label>
                            <select
                                value={fromCampaign}
                                onChange={e => setFromCampaign(e.target.value)}
                                className="w-full px-3 py-2 border border-emerald-300 rounded-lg text-xs bg-emerald-50/30 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium"
                            >
                                <option value="">-- Chọn ngành hàng dư --</option>
                                {campaigns.map(c => (
                                    <option key={c.raw_key} value={c.raw_key}>
                                        {c.display_name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-rose-700 mb-1">
                                Ngành hàng đích (Bị thiếu): <span className="text-rose-500">*</span>
                            </label>
                            <select
                                value={toCampaign}
                                onChange={e => setToCampaign(e.target.value)}
                                className="w-full px-3 py-2 border border-rose-300 rounded-lg text-xs bg-rose-50/30 focus:ring-2 focus:ring-rose-500 focus:outline-hidden font-medium"
                            >
                                <option value="">-- Chọn ngành hàng thiếu --</option>
                                {campaigns.map(c => (
                                    <option key={c.raw_key} value={c.raw_key}>
                                        {c.display_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Số lượng cấn trừ */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Số lượng sản phẩm cấn trừ (1 đổi 1): <span className="text-rose-500">*</span>
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min={1}
                                step={1}
                                value={quantity}
                                onChange={e => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                                className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-xs font-black font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                            />
                            <span className="text-slate-500 font-medium">sản phẩm thực tế</span>
                        </div>
                    </div>

                    {/* Ghi chú */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Ghi chú / Lý do điều chuyển:
                        </label>
                        <input
                            type="text"
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="Ví dụ: Đã xin ý kiến AM duyệt cấn bù cuối tháng..."
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                        />
                    </div>

                    {/* Footer */}
                    <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-slate-300 text-slate-700 font-bold rounded-xl text-xs hover:bg-slate-100 transition"
                        >
                            Hủy Bỏ
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-xs"
                        >
                            <Save className="w-4 h-4" />
                            <span>Xác Nhận Thêm</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

