import React, { useState } from 'react';
import type { EmployeeItem } from '../../../core/lib/storage';
import {
    saveEmployeeRescueConfig,
    type EmployeeRescueConfig,
    type SpecialExemptionItem,
    type ExemptionReason
} from '../services/employeeRescueService';
import {
    ShieldCheck,
    Save,
    X,
    Plus,
    Trash2,
    Baby,
    HeartPulse,
    UserCheck,
    Award,
    AlertCircle,
    Percent,
    Trophy,
    CheckCircle2
} from 'lucide-react';
import { cleanEmployeeName, getShortenedEmployeeName } from '../../../core/lib/formatters';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    config: EmployeeRescueConfig;
    employees: EmployeeItem[];
    onSaved: (newConfig: EmployeeRescueConfig) => void;
}

export default function EmployeeRescueConfigModal({
    isOpen,
    onClose,
    config,
    employees,
    onSaved
}: Props) {
    const [activeTab, setActiveTab] = useState<'CRITERIA' | 'EXEMPTIONS'>('CRITERIA');

    // State cấu hình
    const [rescueByRev, setRescueByRev] = useState<boolean>(config.rescue_by_revenue_enabled);
    const [revenueMinRate, setRevenueMinRate] = useState<number>(config.revenue_min_rate || 100);
    const [rescueByEmu, setRescueByEmu] = useState<boolean>(config.rescue_by_emulation_enabled);
    const [emuMinPoints, setEmuMinPoints] = useState<number>(config.emulation_min_points || 10);
    const [emuMinCampaigns, setEmuMinCampaigns] = useState<number>(config.emulation_min_campaigns || 3);
    const [exemptions, setExemptions] = useState<SpecialExemptionItem[]>(config.special_exemptions || []);

    // State thêm nhân viên miễn trừ
    const [selectedEmpId, setSelectedEmpId] = useState<string>('');
    const [selectedReason, setSelectedReason] = useState<ExemptionReason>('THAI_SAN');
    const [exemptionNote, setExemptionNote] = useState<string>('');
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [errorMsg, setErrorMsg] = useState<string>('');

    if (!isOpen) return null;

    const handleAddExemption = () => {
        if (!selectedEmpId) {
            setErrorMsg('Vui lòng chọn nhân viên');
            return;
        }

        const trimmedId = selectedEmpId.trim();
        if (exemptions.some(e => e.employee_id.trim() === trimmedId)) {
            setErrorMsg('Nhân viên này đã có trong danh sách chế độ đặc thù');
            return;
        }

        const emp = employees.find(e => e.employee_id.trim() === trimmedId);
        const newExemption: SpecialExemptionItem = {
            employee_id: trimmedId,
            full_name: emp ? emp.full_name : trimmedId,
            reason: selectedReason,
            note: exemptionNote.trim(),
            created_at: new Date().toISOString()
        };

        setExemptions([...exemptions, newExemption]);
        setSelectedEmpId('');
        setExemptionNote('');
        setErrorMsg('');
    };

    const handleRemoveExemption = (empId: string) => {
        setExemptions(exemptions.filter(e => e.employee_id.trim() !== empId.trim()));
    };

    const handleSave = async () => {
        setIsSaving(true);
        setErrorMsg('');

        const updatedConfig: EmployeeRescueConfig = {
            ...config,
            rescue_by_revenue_enabled: rescueByRev,
            revenue_min_rate: Number(revenueMinRate) || 100,
            rescue_by_emulation_enabled: rescueByEmu,
            emulation_min_points: Number(emuMinPoints) || 10,
            emulation_min_campaigns: Number(emuMinCampaigns) || 3,
            special_exemptions: exemptions
        };

        const res = await saveEmployeeRescueConfig(updatedConfig);
        setIsSaving(false);

        if (res.success) {
            onSaved(updatedConfig);
            onClose();
        } else {
            setErrorMsg(res.error || 'Không thể lưu cấu hình lên Supabase');
        }
    };

    const getReasonBadge = (reason: ExemptionReason) => {
        switch (reason) {
            case 'THAI_SAN':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-pink-50 text-pink-700 border border-pink-200">
                        <Baby className="w-3 h-3 text-pink-600" />
                        Thai sản
                    </span>
                );
            case 'NGHI_OM':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        <HeartPulse className="w-3 h-3 text-blue-600" />
                        Nghỉ ốm/phép
                    </span>
                );
            case 'THU_VIEC':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        <UserCheck className="w-3 h-3 text-amber-600" />
                        Thử việc
                    </span>
                );
            case 'DAC_CACH':
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                        <Award className="w-3 h-3 text-purple-600" />
                        Đặc cách
                    </span>
                );
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-5 py-4 bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                            <ShieldCheck className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-base font-black tracking-tight flex items-center gap-2">
                                Cấu Hình Tiêu Chí Cứu & Chế Độ
                            </h3>
                            <p className="text-xs text-indigo-200 font-medium">
                                Tháng {config.month}/{config.year} • {config.store_name === 'all' ? 'Toàn bộ siêu thị' : config.store_name}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 bg-slate-50/70 shrink-0 px-5 pt-2">
                    <button
                        onClick={() => setActiveTab('CRITERIA')}
                        className={`py-2.5 px-4 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                            activeTab === 'CRITERIA'
                                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg'
                                : 'border-transparent text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <ShieldCheck className="w-4 h-4" />
                        <span>Tiêu Chí Cứu Tự Động</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('EXEMPTIONS')}
                        className={`py-2.5 px-4 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                            activeTab === 'EXEMPTIONS'
                                ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg'
                                : 'border-transparent text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Baby className="w-4 h-4" />
                        <span>Thai Sản & Chế Độ ({exemptions.length})</span>
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 overflow-y-auto space-y-5 text-slate-800 text-xs">
                    {errorMsg && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {activeTab === 'CRITERIA' ? (
                        <div className="space-y-4">
                            {/* Tiêu chí 1: Cứu theo Doanh thu */}
                            <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/30 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                                            <Percent className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="font-black text-slate-900 text-xs">
                                                Cứu BOT Thi đua khi Doanh thu Đạt Chỉ Tiêu
                                            </div>
                                            <div className="text-[11px] text-slate-500">
                                                Nếu nhân viên bị BOT Thi đua nhưng Doanh thu đạt mốc quy định sẽ được tự động CỨU
                                            </div>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={rescueByRev}
                                            onChange={e => setRescueByRev(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                    </label>
                                </div>

                                {rescueByRev && (
                                    <div className="pt-2 border-t border-indigo-100/60 flex items-center justify-between">
                                        <span className="text-slate-600 font-bold">
                                            Ngưỡng %DKHT Doanh thu tối thiểu để cứu:
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                type="number"
                                                min={50}
                                                max={200}
                                                step={1}
                                                value={revenueMinRate}
                                                onChange={e => setRevenueMinRate(Number(e.target.value))}
                                                className="w-20 px-2.5 py-1 text-right font-black font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-hidden bg-white"
                                            />
                                            <span className="font-black text-slate-700">%</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Tiêu chí 2: Cứu theo Thi đua */}
                            <div className="p-4 rounded-xl border border-purple-100 bg-purple-50/30 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                                            <Trophy className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="font-black text-slate-900 text-xs">
                                                Cứu BOT Doanh thu khi Thi đua Đạt Xuất Sắc
                                            </div>
                                            <div className="text-[11px] text-slate-500">
                                                Nếu nhân viên bị BOT Doanh thu nhưng cày thi đua đạt điểm cao sẽ được tự động CỨU
                                            </div>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={rescueByEmu}
                                            onChange={e => setRescueByEmu(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                                    </label>
                                </div>

                                {rescueByEmu && (
                                    <div className="pt-2 border-t border-purple-100/60 space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-600 font-bold">
                                                Ngưỡng điểm thi đua tối thiểu (nếu tính điểm):
                                            </span>
                                            <div className="flex items-center gap-1.5">
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={50}
                                                    step={0.5}
                                                    value={emuMinPoints}
                                                    onChange={e => setEmuMinPoints(Number(e.target.value))}
                                                    className="w-20 px-2.5 py-1 text-right font-black font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-hidden bg-white"
                                                />
                                                <span className="font-black text-purple-800">điểm</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <span className="text-slate-600 font-bold">
                                                Số ngành hàng đạt tối thiểu (nếu tính nhóm):
                                            </span>
                                            <div className="flex items-center gap-1.5">
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={20}
                                                    step={1}
                                                    value={emuMinCampaigns}
                                                    onChange={e => setEmuMinCampaigns(Number(e.target.value))}
                                                    className="w-20 px-2.5 py-1 text-right font-black font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-hidden bg-white"
                                                />
                                                <span className="font-black text-purple-800">nhóm</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Form thêm nhân viên thai sản/chế độ */}
                            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                                <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                                    <Plus className="w-4 h-4 text-indigo-600" />
                                    <span>Thêm nhân viên vào diện thai sản / chế độ đặc thù</span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {/* Chọn nhân viên */}
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                            Chọn nhân viên:
                                        </label>
                                        <select
                                            value={selectedEmpId}
                                            onChange={e => setSelectedEmpId(e.target.value)}
                                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                                        >
                                            <option value="">-- Chọn nhân viên --</option>
                                            {employees.map(emp => (
                                                <option key={emp.employee_id} value={emp.employee_id}>
                                                    {emp.employee_id} - {cleanEmployeeName(emp.full_name || '')}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Chọn lý do */}
                                    <div>
                                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                            Chế độ / Lý do:
                                        </label>
                                        <select
                                            value={selectedReason}
                                            onChange={e => setSelectedReason(e.target.value as ExemptionReason)}
                                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                                        >
                                            <option value="THAI_SAN">🤰 Thai sản / Nuôi con nhỏ</option>
                                            <option value="NGHI_OM">🩺 Nghỉ ốm / Phép dài hạn</option>
                                            <option value="THU_VIEC">🔰 Nhân viên mới / Thử việc</option>
                                            <option value="DAC_CACH">⭐ Đặc cách quản lý</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Ghi chú */}
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                                        Ghi chú chi tiết (nếu có):
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={exemptionNote}
                                            onChange={e => setExemptionNote(e.target.value)}
                                            placeholder="Ví dụ: Nghỉ sinh từ ngày 10/10, đi làm lại tháng sau..."
                                            className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAddExemption}
                                            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            <span>Thêm</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Bảng danh sách nhân viên chế độ */}
                            <div className="rounded-xl border border-slate-200 overflow-hidden">
                                <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 font-bold text-slate-700 text-xs flex items-center justify-between">
                                    <span>Danh sách nhân viên hưởng chế độ ({exemptions.length})</span>
                                    <span className="text-[10.5px] text-slate-500">
                                        Được tự động cứu khỏi BOT trong kỳ này
                                    </span>
                                </div>

                                {exemptions.length === 0 ? (
                                    <div className="py-6 text-center text-slate-400 italic">
                                        Chưa có nhân viên nào trong danh sách chế độ đặc thù tháng này.
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                                        {exemptions.map(ex => {
                                            const emp = employees.find(e => e.employee_id.trim() === ex.employee_id.trim());
                                            const displayName = emp ? getShortenedEmployeeName(emp.full_name || '') : ex.full_name || ex.employee_id;

                                            return (
                                                <div
                                                    key={ex.employee_id}
                                                    className="p-2.5 flex items-center justify-between hover:bg-slate-50 transition"
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className="font-mono text-xs font-bold text-indigo-700 px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-100">
                                                            {ex.employee_id}
                                                        </span>
                                                        <span className="font-bold text-slate-800 text-xs truncate">
                                                            {displayName}
                                                        </span>
                                                        {getReasonBadge(ex.reason)}
                                                        {ex.note && (
                                                            <span className="text-[11px] text-slate-500 truncate max-w-[160px] italic">
                                                                ({ex.note})
                                                            </span>
                                                        )}
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveExemption(ex.employee_id)}
                                                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition shrink-0 ml-2"
                                                        title="Xóa khỏi danh sách"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
                    <div className="text-[11px] text-slate-500">
                        Cấu hình sẽ tự động đồng bộ lên Supabase Cloud
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition text-xs"
                        >
                            Đóng
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition text-xs flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            <span>{isSaving ? 'Đang lưu...' : 'Lưu Cấu Hình'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

