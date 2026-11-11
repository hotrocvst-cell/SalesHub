import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

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

    return createPortal(
        <div
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm"
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="rescue-config-modal-title"
                className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
            >
                {/* Header */}
                <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 shrink-0">
                            <ShieldCheck className="w-5 h-5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                            <h3 id="rescue-config-modal-title" className="text-base font-black tracking-tight flex items-center gap-2">
                                Cấu Hình Tiêu Chí Cứu & Chế Độ
                            </h3>
                            <p className="text-xs text-slate-300 font-medium truncate">
                                Tháng {config.month}/{config.year} • {config.store_name === 'all' ? 'Toàn bộ ST' : config.store_name}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Đóng hộp thoại tiêu chí cứu"
                        className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition cursor-pointer shrink-0"
                    >
                        <X className="w-5 h-5" aria-hidden="true" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 bg-slate-50/80 shrink-0 px-5 pt-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab('CRITERIA')}
                        className={`py-2.5 px-4 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'CRITERIA'
                                ? 'border-blue-700 text-blue-800 bg-white rounded-t-lg'
                                : 'border-transparent text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                        <span>Tiêu Chí Cứu Tự Động</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('EXEMPTIONS')}
                        className={`py-2.5 px-4 text-xs font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
                            activeTab === 'EXEMPTIONS'
                                ? 'border-blue-700 text-blue-800 bg-white rounded-t-lg'
                                : 'border-transparent text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Baby className="w-4 h-4" aria-hidden="true" />
                        <span>Thai Sản & Chế Độ ({exemptions.length})</span>
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 overflow-y-auto space-y-5 text-slate-800 text-xs">
                    {errorMsg && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" aria-hidden="true" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {activeTab === 'CRITERIA' ? (
                        <div className="space-y-4">
                            {/* Tiêu chí 1: Cứu theo Doanh thu */}
                            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0">
                                            <Percent className="w-4 h-4" aria-hidden="true" />
                                        </div>
                                        <div>
                                            <div className="font-black text-slate-900 text-xs">
                                                Cứu BOT Thi đua khi Doanh thu Đạt Chỉ Tiêu
                                            </div>
                                            <div className="text-[11px] text-slate-600">
                                                Nếu nhân viên bị BOT Thi đua nhưng Doanh thu đạt mốc quy định sẽ được tự động CỨU
                                            </div>
                                        </div>
                                    </div>
                                    <label
                                        htmlFor="rescue-rev-toggle"
                                        aria-label="Bật tự động cứu BOT thi đua khi doanh thu đạt chỉ tiêu"
                                        className="relative inline-flex items-center cursor-pointer shrink-0"
                                    >
                                        <input
                                            id="rescue-rev-toggle"
                                            name="rescue_by_revenue"
                                            type="checkbox"
                                            checked={rescueByRev}
                                            onChange={e => setRescueByRev(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-700"></div>
                                    </label>
                                </div>

                                {rescueByRev && (
                                    <div className="pt-2 border-t border-blue-200/70 flex items-center justify-between gap-2">
                                        <label htmlFor="rescue-rev-min-rate" className="text-slate-700 font-bold">
                                            Ngưỡng %DKHT Doanh thu tối thiểu để cứu:
                                        </label>
                                        <div className="flex items-center gap-1.5">
                                            <input
                                                id="rescue-rev-min-rate"
                                                name="revenue_min_rate"
                                                type="number"
                                                min={50}
                                                max={200}
                                                step={1}
                                                value={revenueMinRate}
                                                onChange={e => setRevenueMinRate(Number(e.target.value))}
                                                className="w-20 px-2.5 py-1 text-right font-black font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white"
                                            />
                                            <span className="font-black text-slate-700">%</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Tiêu chí 2: Cứu theo Thi đua */}
                            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40 space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                                            <Trophy className="w-4 h-4" aria-hidden="true" />
                                        </div>
                                        <div>
                                            <div className="font-black text-slate-900 text-xs">
                                                Cứu BOT Doanh thu khi Thi đua Đạt Xuất Sắc
                                            </div>
                                            <div className="text-[11px] text-slate-600">
                                                Nếu nhân viên bị BOT Doanh thu nhưng cày thi đua đạt điểm cao sẽ được tự động CỨU
                                            </div>
                                        </div>
                                    </div>
                                    <label
                                        htmlFor="rescue-emu-toggle"
                                        aria-label="Bật tự động cứu BOT doanh thu khi thi đua đạt xuất sắc"
                                        className="relative inline-flex items-center cursor-pointer shrink-0"
                                    >
                                        <input
                                            id="rescue-emu-toggle"
                                            name="rescue_by_emulation"
                                            type="checkbox"
                                            checked={rescueByEmu}
                                            onChange={e => setRescueByEmu(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-700"></div>
                                    </label>
                                </div>

                                {rescueByEmu && (
                                    <div className="pt-2 border-t border-emerald-200/70 space-y-2.5">
                                        <div className="flex items-center justify-between gap-2">
                                            <label htmlFor="rescue-emu-min-points" className="text-slate-700 font-bold">
                                                Ngưỡng điểm thi đua tối thiểu (nếu tính điểm):
                                            </label>
                                            <div className="flex items-center gap-1.5">
                                                <input
                                                    id="rescue-emu-min-points"
                                                    name="emulation_min_points"
                                                    type="number"
                                                    min={1}
                                                    max={50}
                                                    step={0.5}
                                                    value={emuMinPoints}
                                                    onChange={e => setEmuMinPoints(Number(e.target.value))}
                                                    className="w-20 px-2.5 py-1 text-right font-black font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none bg-white"
                                                />
                                                <span className="font-black text-emerald-800">điểm</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between gap-2">
                                            <label htmlFor="rescue-emu-min-campaigns" className="text-slate-700 font-bold">
                                                Số ngành hàng đạt tối thiểu (nếu tính nhóm):
                                            </label>
                                            <div className="flex items-center gap-1.5">
                                                <input
                                                    id="rescue-emu-min-campaigns"
                                                    name="emulation_min_campaigns"
                                                    type="number"
                                                    min={1}
                                                    max={20}
                                                    step={1}
                                                    value={emuMinCampaigns}
                                                    onChange={e => setEmuMinCampaigns(Number(e.target.value))}
                                                    className="w-20 px-2.5 py-1 text-right font-black font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:outline-none bg-white"
                                                />
                                                <span className="font-black text-emerald-800">nhóm</span>
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
                                    <Plus className="w-4 h-4 text-blue-700" aria-hidden="true" />
                                    <span>Thêm nhân viên vào diện thai sản / chế độ đặc thù</span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {/* Chọn nhân viên */}
                                    <div>
                                        <label htmlFor="rescue-exemption-emp" className="block text-[11px] font-bold text-slate-700 mb-1">
                                            Chọn nhân viên:
                                        </label>
                                        <select
                                            id="rescue-exemption-emp"
                                            name="rescue_exemption_emp"
                                            value={selectedEmpId}
                                            onChange={e => setSelectedEmpId(e.target.value)}
                                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
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
                                        <label htmlFor="rescue-exemption-reason" className="block text-[11px] font-bold text-slate-700 mb-1">
                                            Chế độ / Lý do:
                                        </label>
                                        <select
                                            id="rescue-exemption-reason"
                                            name="rescue_exemption_reason"
                                            value={selectedReason}
                                            onChange={e => setSelectedReason(e.target.value as ExemptionReason)}
                                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
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
                                    <label htmlFor="rescue-exemption-note" className="block text-[11px] font-bold text-slate-700 mb-1">
                                        Ghi chú chi tiết (nếu có):
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            id="rescue-exemption-note"
                                            name="rescue_exemption_note"
                                            type="text"
                                            value={exemptionNote}
                                            onChange={e => setExemptionNote(e.target.value)}
                                            placeholder="Ví dụ: Nghỉ sinh từ ngày 10/10, đi làm lại tháng sau..."
                                            className="flex-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-600 focus:outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAddExemption}
                                            className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer"
                                        >
                                            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                                            <span>Thêm</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Bảng danh sách nhân viên chế độ */}
                            <div className="rounded-xl border border-slate-200 overflow-hidden">
                                <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 font-bold text-slate-700 text-xs flex items-center justify-between gap-2">
                                    <span>Danh sách nhân viên hưởng chế độ ({exemptions.length})</span>
                                    <span className="text-[10.5px] text-slate-600">
                                        Được tự động cứu khỏi BOT trong kỳ này
                                    </span>
                                </div>

                                {exemptions.length === 0 ? (
                                    <div className="py-6 text-center text-slate-500 italic">
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
                                                        <span className="font-mono text-xs font-bold text-blue-800 px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200">
                                                            {ex.employee_id}
                                                        </span>
                                                        <span className="font-bold text-slate-800 text-xs truncate">
                                                            {displayName}
                                                        </span>
                                                        {getReasonBadge(ex.reason)}
                                                        {ex.note && (
                                                            <span className="text-[11px] text-slate-600 truncate max-w-[160px] italic">
                                                                ({ex.note})
                                                            </span>
                                                        )}
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveExemption(ex.employee_id)}
                                                        aria-label={`Xóa nhân viên ${displayName} khỏi danh sách`}
                                                        className="p-1 rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50 transition shrink-0 ml-2 cursor-pointer"
                                                        title="Xóa khỏi danh sách"
                                                    >
                                                        <Trash2 className="w-4 h-4" aria-hidden="true" />
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
                <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
                    <div className="text-[11px] text-slate-600">
                        Cấu hình sẽ tự động đồng bộ lên Supabase Cloud
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 transition text-xs cursor-pointer"
                        >
                            Đóng
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold transition text-xs flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" aria-hidden="true" />
                            <span>{isSaving ? 'Đang lưu...' : 'Lưu Cấu Hình'}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}

