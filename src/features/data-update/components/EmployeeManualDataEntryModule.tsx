import React, { useState, useMemo, useRef } from 'react';
import {
    Users,
    Plus,
    Trash2,
    Save,
    Search,
    ChevronDown,
    ChevronUp,
    Sparkles,
    Trophy,
    Percent,
    DollarSign,
    Layers,
    AlertCircle,
    CheckCircle2,
    AlertTriangle,
    RotateCcw,
    RefreshCw,
    UploadCloud,
    UserCheck,
    X
} from 'lucide-react';
import type { EmployeeOcrParsedItem } from '../services/geminiEmployeeOcrService';
import { getShortenedEmployeeName, formatValue, formatDate, formatDateTime } from '../../../core/lib/formatters';
import type { EmployeeDataSession } from '../../employee-cumulative/utils/sessionStorage';
import type { EmployeeItem, CampaignDictItem } from '../../../core/lib/storage';
import type { CampaignMappingItem, KnownStoreCampaignTarget } from '../services/campaignTargetMappingService';
import CampaignMappingReviewBar from './CampaignMappingReviewBar';

interface Props {
    employees: EmployeeOcrParsedItem[];
    onChangeEmployees: (items: EmployeeOcrParsedItem[]) => void;
    storeName: string;
    reportDate: string;
    onSaveToSupabase: (options?: { overwriteSessionId?: string }) => void;
    isSaving: boolean;
    existingSession?: EmployeeDataSession | null;
    isCheckingExisting?: boolean;
    onRestoreExistingSession?: () => void;
    onScanAdditionalEmulation?: (files: File[]) => void;
    isScanningAdditional?: boolean;
    additionalProgressText?: string;
    storeEmployees?: EmployeeItem[];
    campaignMappings?: CampaignMappingItem[];
    knownStoreCampaigns?: KnownStoreCampaignTarget[];
    campaignDict?: CampaignDictItem[];
    onRemapCampaign?: (oldName: string, newName: string) => void;
}

export default function EmployeeManualDataEntryModule({
    employees,
    onChangeEmployees,
    storeName,
    reportDate,
    onSaveToSupabase,
    isSaving,
    existingSession,
    isCheckingExisting,
    onRestoreExistingSession,
    onScanAdditionalEmulation,
    isScanningAdditional = false,
    additionalProgressText = '',
    storeEmployees = [],
    campaignMappings = [],
    knownStoreCampaigns = [],
    campaignDict = [],
    onRemapCampaign
}: Props) {
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);
    const addEmuInputRef = useRef<HTMLInputElement>(null);

    // Danh sách tên các chương trình đang phát sinh trong phiên
    const activeCampaignNames = useMemo(() => {
        const set = new Set<string>();
        employees.forEach(e => {
            Object.keys(e.campaigns || {}).forEach(c => set.add(c));
        });
        return Array.from(set);
    }, [employees]);

    // Modal thêm nhân viên từ danh bạ ST
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [selectedEmpToAdd, setSelectedEmpToAdd] = useState<string>('');
    const [manualEmpIdInput, setManualEmpIdInput] = useState<string>('');
    const [addError, setAddError] = useState<string>('');

    // Danh sách nhân sự trong danh bạ ST chưa có trong phiên này
    const availableEmployees = useMemo(() => {
        if (!storeEmployees || storeEmployees.length === 0) return [];
        const currentIds = new Set(employees.map(e => String(e.employeeId).trim().toLowerCase()));
        return storeEmployees.filter(e => !currentIds.has(String(e.employee_id || '').trim().toLowerCase()));
    }, [storeEmployees, employees]);

    // Tính toán chiều rộng chuẩn badge theo Quy chuẩn 11
    const maxIdLength = useMemo(() => {
        if (!employees || employees.length === 0) return 6;
        return Math.max(6, ...employees.map(r => String(r.employeeId || '').trim().length));
    }, [employees]);

    // Thống kê tổng quan KPI
    const kpiSummary = useMemo(() => {
        const totalEmployees = employees.length;
        const totalQd = employees.reduce((sum, e) => sum + (Number(e.revenueQd) || 0), 0);
        const totalReal = employees.reduce((sum, e) => sum + (Number(e.revenueReal) || 0), 0);
        const totalInstallment = employees.reduce((sum, e) => sum + (Number(e.installmentReal) || 0), 0);
        const avgInstallmentRate = totalReal > 0 ? (totalInstallment / totalReal) * 100 : 0;

        return {
            totalEmployees,
            totalQd,
            totalReal,
            totalInstallment,
            avgInstallmentRate
        };
    }, [employees]);

    // Lọc theo từ khóa tìm kiếm
    const filteredEmployees = useMemo(() => {
        if (!searchTerm.trim()) return employees;
        const q = searchTerm.toLowerCase().trim();
        return employees.filter(e =>
            e.employeeId.toLowerCase().includes(q) ||
            e.fullName.toLowerCase().includes(q)
        );
    }, [employees, searchTerm]);

    // Cập nhật trường Doanh thu nhân viên
    const handleUpdateField = (
        empId: string,
        field: 'revenueQd' | 'revenueReal' | 'installmentReal' | 'fullName',
        val: any
    ) => {
        const updated = employees.map(e => {
            if (e.employeeId !== empId) return e;
            const item = { ...e };

            if (field === 'fullName') {
                item.fullName = String(val);
            } else {
                const numVal = Number(val) || 0;
                item[field] = numVal;

                // Tự tính lại tỷ lệ trả góp
                if (field === 'revenueReal' || field === 'installmentReal') {
                    const rev = field === 'revenueReal' ? numVal : item.revenueReal;
                    const inst = field === 'installmentReal' ? numVal : item.installmentReal;
                    item.installmentRate = rev > 0 ? Number(((inst / rev) * 100).toFixed(2)) : 0;
                }
            }
            return item;
        });

        onChangeEmployees(updated);
    };

    // Xóa nhân viên
    const handleRemoveEmployee = (empId: string) => {
        if (!window.confirm(`Bạn có chắc muốn xóa nhân viên mã ${empId}?`)) return;
        onChangeEmployees(employees.filter(e => e.employeeId !== empId));
    };

    // Thêm nhân viên từ danh bạ ST
    const handleAddSingleEmployeeFromDirectory = (empId: string) => {
        setAddError('');
        const cleanId = empId.trim();
        if (!cleanId) return;

        if (employees.some(e => e.employeeId.toLowerCase() === cleanId.toLowerCase())) {
            setAddError(`Nhân viên mã [${cleanId}] đã có trong phiên này!`);
            return;
        }

        const found = storeEmployees.find(e => String(e.employee_id || '').trim().toLowerCase() === cleanId.toLowerCase());
        if (!found) {
            setAddError(`Mã [${cleanId}] KHÔNG CÓ TRONG DANH BẠ của ST ${storeName}! Chỉ được nhập nhân sự có trong danh bạ.`);
            return;
        }

        const newEmp: EmployeeOcrParsedItem = {
            employeeId: String(found.employee_id).trim(),
            fullName: found.full_name?.trim() || `Nhân viên ${cleanId}`,
            revenueQd: 0,
            revenueReal: 0,
            installmentReal: 0,
            installmentRate: 0,
            campaigns: {},
            campaignDetails: []
        };

        onChangeEmployees([newEmp, ...employees]);
        setSelectedEmpToAdd('');
        setManualEmpIdInput('');
        setIsAddModalOpen(false);
    };

    // Thêm toàn bộ nhân sự còn thiếu trong danh bạ ST vào phiên
    const handleAddAllMissingEmployees = () => {
        if (availableEmployees.length === 0) return;
        if (!window.confirm(`Bạn có chắc muốn thêm toàn bộ ${availableEmployees.length} nhân sự còn thiếu trong danh bạ ST ${storeName} vào phiên này?`)) return;

        const newItems: EmployeeOcrParsedItem[] = availableEmployees.map(e => ({
            employeeId: String(e.employee_id).trim(),
            fullName: e.full_name?.trim() || `Nhân viên ${e.employee_id}`,
            revenueQd: 0,
            revenueReal: 0,
            installmentReal: 0,
            installmentRate: 0,
            campaigns: {},
            campaignDetails: []
        }));

        onChangeEmployees([...newItems, ...employees]);
        setIsAddModalOpen(false);
    };

    // Mở modal thêm nhân viên
    const handleOpenAddModal = () => {
        setAddError('');
        setSelectedEmpToAdd(availableEmployees.length > 0 ? String(availableEmployees[0].employee_id).trim() : '');
        setManualEmpIdInput('');
        setIsAddModalOpen(true);
    };

    // Cập nhật giá trị chương trình thi đua
    const handleUpdateCampaignValue = (empId: string, cName: string, val: number) => {
        const updated = employees.map(e => {
            if (e.employeeId !== empId) return e;
            const campaigns = { ...e.campaigns, [cName]: val };
            const details = (e.campaignDetails || []).map(d =>
                d.campaignName === cName ? { ...d, value: val } : d
            );
            return { ...e, campaigns, campaignDetails: details };
        });
        onChangeEmployees(updated);
    };

    return (
        <div className="space-y-4">
            {/* THẺ CHỈ SỐ KPI TỔNG HỢP PHIÊN */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="bg-blue-50/70 border-l-4 border-blue-500 rounded-xl p-3 shadow-xs">
                    <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">TỔNG NHÂN VIÊN</span>
                    <span className="text-lg font-black text-slate-800 font-mono">
                        {kpiSummary.totalEmployees}
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium block mt-0.5">nhân sự có số liệu</span>
                </div>

                <div className="bg-amber-50/70 border-l-4 border-amber-500 rounded-xl p-3 shadow-xs">
                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">TỔNG DTQĐ</span>
                    <span className="text-lg font-black text-amber-700 font-mono">
                        {formatValue(kpiSummary.totalQd)} tr
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium block mt-0.5">doanh thu quy đổi</span>
                </div>

                <div className="bg-emerald-50/70 border-l-4 border-emerald-500 rounded-xl p-3 shadow-xs">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">TỔNG DT THỰC</span>
                    <span className="text-lg font-black text-emerald-700 font-mono">
                        {formatValue(kpiSummary.totalReal)} tr
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium block mt-0.5">doanh thu thực tế</span>
                </div>

                <div className="bg-purple-50/70 border-l-4 border-purple-500 rounded-xl p-3 shadow-xs">
                    <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">TRẢ GÓP & %TG</span>
                    <span className="text-lg font-black text-purple-700 font-mono">
                        {formatValue(kpiSummary.totalInstallment)} tr
                    </span>
                    <span className="text-[10px] text-purple-600 font-bold block mt-0.5">
                        Tỷ lệ: {kpiSummary.avgInstallmentRate.toFixed(1)}%
                    </span>
                </div>
            </div>

            {/* THÔNG BÁO CHƯA CÓ PHIÊN MỚI NHẤT (TONE MÀU NÓNG) */}
            {!existingSession && !isCheckingExisting && (
                <div className="bg-gradient-to-r from-rose-50 via-orange-50 to-amber-50 border border-rose-300 rounded-2xl p-3.5 sm:p-4 text-xs shadow-xs space-y-1.5 animate-in fade-in">
                    <div className="flex items-center gap-2.5">
                        <span className="p-1.5 rounded-xl bg-rose-600 text-white font-black shadow-xs shrink-0 animate-pulse">
                            <AlertCircle className="w-4 h-4" />
                        </span>
                        <div>
                            <span className="font-extrabold text-rose-950 text-xs sm:text-sm block">
                                Chưa Có Phiên Dữ Liệu Ngày {formatDate(reportDate)} Cho ST Này!
                            </span>
                            <span className="text-[11px] text-rose-800">
                                Đơn vị: <strong>{storeName}</strong> • Chưa ghi nhận phiên dữ liệu nào cho ngày này trên Cloud. Vui lòng rà soát danh sách nhân sự bên dưới và bấm nút <strong className="text-rose-950">"LƯU PHIÊN MỚI LÊN CLOUD"</strong> để hoàn tất.
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* CẢNH BÁO TRÙNG PHIÊN KHI ĐÃ CÓ DỮ LIỆU CỦA NGÀY NÀY */}
            {existingSession && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-2xl p-3.5 sm:p-4 text-xs shadow-xs space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/70 pb-2.5">
                        <div className="flex items-center gap-2.5">
                            <span className="p-1.5 rounded-xl bg-amber-500 text-white font-bold shadow-xs">
                                <AlertTriangle className="w-4 h-4" />
                            </span>
                            <div>
                                <span className="font-extrabold text-amber-950 text-xs sm:text-sm block">
                                    Đã Có Phiên Dữ Liệu Ngày {formatDate(reportDate)} Cho ST Này!
                                </span>
                                <span className="text-[11px] text-amber-800">
                                    Tiêu đề: <strong>{existingSession.session_title}</strong>
                                </span>
                            </div>
                        </div>

                        {onRestoreExistingSession && (
                            <button
                                type="button"
                                onClick={onRestoreExistingSession}
                                className="px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs cursor-pointer self-start sm:self-auto shrink-0"
                                title="Nạp lại số liệu phiên này vào bảng để xem hoặc bổ sung"
                            >
                                <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                                <span>Xem Lại Số Liệu Cũ</span>
                            </button>
                        )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-amber-900 font-medium">
                        <span>👤 Người nạp: <strong>{existingSession.created_by || 'Chưa rõ'}</strong></span>
                        <span>⏰ Lúc: <strong>{formatDateTime(existingSession.created_at)}</strong></span>
                        <span>👥 Quy mô: <strong>{existingSession.employee_count}</strong> nhân viên</span>
                        <span>💰 DT Thực: <strong>{formatValue(existingSession.total_revenue_actual)} tr</strong></span>
                        <span>🎯 DTQĐ: <strong>{formatValue(existingSession.total_revenue_qd)} tr</strong></span>
                    </div>

                    <p className="text-[11px] text-amber-800 leading-relaxed">
                        💡 <strong>Khuyên dùng:</strong> Hãy bấm nút <span className="font-bold text-indigo-700">"Ghi Đè & Cập Nhật"</span> để cập nhật số liệu mới nhất mà không tạo thêm phiên trùng lặp.
                    </p>
                </div>
            )}

            {/* THANH RÀ SOÁT & MAPPING THI ĐUA THEO TARGET ST */}
            {(campaignMappings.length > 0 || activeCampaignNames.length > 0) && onRemapCampaign && (
                <CampaignMappingReviewBar
                    campaignMappings={campaignMappings}
                    knownStoreCampaigns={knownStoreCampaigns}
                    campaignDict={campaignDict}
                    onRemapCampaign={onRemapCampaign}
                    activeCampaignNames={activeCampaignNames}
                />
            )}

            {/* THANH CÔNG CỤ TÌM KIẾM & NÚT THAO TÁC */}
            <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Tìm theo Mã NV hoặc Tên nhân viên..."
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <div className="flex items-center gap-2 flex-wrap justify-end">
                    {/* Nút quét bổ sung ảnh thi đua theo từng đợt */}
                    {onScanAdditionalEmulation && (
                        <>
                            <input
                                type="file"
                                ref={addEmuInputRef}
                                multiple
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                    if (e.target.files && e.target.files.length > 0) {
                                        onScanAdditionalEmulation(Array.from(e.target.files));
                                        e.target.value = '';
                                    }
                                }}
                            />
                            <button
                                type="button"
                                onClick={() => addEmuInputRef.current?.click()}
                                disabled={isScanningAdditional}
                                className="px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs disabled:opacity-50"
                                title="Nạp thêm ảnh thi đua để AI quét và chèn thêm vào danh sách nhân viên hiện tại"
                            >
                                <Sparkles className={`w-3.5 h-3.5 text-purple-600 ${isScanningAdditional ? 'animate-spin' : ''}`} />
                                <span>{isScanningAdditional ? 'Đang quét thi đua...' : '➕ Quét Thêm Thi Đua'}</span>
                            </button>
                        </>
                    )}

                    <button
                        type="button"
                        onClick={handleOpenAddModal}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                        title="Thêm nhân viên từ danh bạ ST vào phiên"
                    >
                        <Plus className="w-3.5 h-3.5 text-blue-600" />
                        <span>Thêm NV</span>
                    </button>

                    {existingSession ? (
                        <>
                            {/* Nút 1: Ghi đè & Cập nhật phiên cũ */}
                            <button
                                type="button"
                                onClick={() => onSaveToSupabase({ overwriteSessionId: existingSession.id })}
                                disabled={isSaving || employees.length === 0}
                                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition shadow-sm cursor-pointer disabled:opacity-50"
                                title="Cập nhật trực tiếp số liệu vào phiên đã có, không sinh phiên rác"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${isSaving ? 'animate-spin' : ''}`} />
                                <span>{isSaving ? 'Đang cập nhật...' : '🔄 Ghi Đè & Cập Nhật Phiên Này'}</span>
                            </button>

                            {/* Nút 2: Lưu thành phiên mới */}
                            <button
                                type="button"
                                onClick={() => onSaveToSupabase()}
                                disabled={isSaving || employees.length === 0}
                                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                                title="Lưu thêm một phiên độc lập mới cho ngày này"
                            >
                                <Plus className="w-3.5 h-3.5 text-slate-500" />
                                <span>Lưu Phiên Mới</span>
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            onClick={() => onSaveToSupabase()}
                            disabled={isSaving || employees.length === 0}
                            className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition shadow-sm cursor-pointer disabled:opacity-50"
                        >
                            <Save className="w-3.5 h-3.5" />
                            <span>{isSaving ? 'Đang lưu...' : '💾 Lưu Phiên Lên Cloud'}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* TIẾN TRÌNH QUÉT BỔ SUNG THI ĐUA NẾU ĐANG CHẠY */}
            {isScanningAdditional && (
                <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs text-purple-900 animate-pulse">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-600 animate-spin shrink-0" />
                        <span className="font-bold">{additionalProgressText || 'Đang quét và hợp nhất các ảnh thi đua bổ sung...'}</span>
                    </div>
                    <span className="text-[11px] font-mono text-purple-700 bg-white px-2 py-0.5 rounded-lg border border-purple-200 font-bold shrink-0">
                        ⚡ Đợt 3 ảnh/lần
                    </span>
                </div>
            )}

            {/* BẢNG RÀ SOÁT DANH SÁCH NHÂN VIÊN (QUY CHUẨN 1 & 11) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-800 text-slate-200 font-bold uppercase text-[10px] tracking-wider border-b border-slate-700">
                                <th className="px-2.5 py-2.5 text-center w-10">STT</th>
                                {/* CỘT GỘP NHÂN VIÊN DUY NHẤT THEO QUY CHUẨN 11 */}
                                <th className="px-3 py-2.5">NHÂN VIÊN</th>
                                <th className="px-2 py-2.5 text-right w-24">DTQĐ (Tr)</th>
                                <th className="px-2 py-2.5 text-right w-24">DT Thực (Tr)</th>
                                <th className="px-2 py-2.5 text-right w-24">DT Trả Góp</th>
                                <th className="px-2 py-2.5 text-right w-16">% TG</th>
                                <th className="px-2.5 py-2.5 text-center w-28">Thi Đua</th>
                                <th className="px-2 py-2.5 text-center w-12">Xóa</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredEmployees.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-8 text-slate-400 text-xs">
                                        Không tìm thấy nhân viên nào phù hợp.
                                    </td>
                                </tr>
                            ) : (
                                filteredEmployees.map((emp, index) => {
                                    const shortenedName = getShortenedEmployeeName(emp.fullName);
                                    const isExpanded = expandedEmployeeId === emp.employeeId;
                                    const campaignsCount = Object.keys(emp.campaigns || {}).length;

                                    return (
                                        <React.Fragment key={emp.employeeId}>
                                            <tr className="hover:bg-blue-50/40 transition">
                                                {/* STT */}
                                                <td className="px-2.5 py-2 text-center text-slate-400 font-mono text-[11px]">
                                                    {index + 1}
                                                </td>

                                                {/* CỘT GỘP NHÂN VIÊN THEO QUY CHUẨN 11 */}
                                                <td className="px-3 py-2">
                                                    <div className="flex items-center gap-1.5">
                                                        {/* Badge mã NV tự động tính chiều rộng */}
                                                        <span
                                                            style={{
                                                                minWidth: `${maxIdLength + 2.2}ch`,
                                                                width: `${maxIdLength + 2.2}ch`
                                                            }}
                                                            className="font-mono font-bold text-xs px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 inline-block text-center leading-normal shrink-0"
                                                        >
                                                            {emp.employeeId}
                                                        </span>

                                                        {/* Tên rút gọn với tooltip đầy đủ */}
                                                        <span
                                                            title={`Mã NV: ${emp.employeeId} - ${emp.fullName}`}
                                                            className="font-extrabold text-slate-800 text-xs truncate max-w-[140px] sm:max-w-none"
                                                        >
                                                            {shortenedName}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* DTQĐ */}
                                                <td className="px-2 py-2 text-right">
                                                    <input
                                                        type="number"
                                                        value={emp.revenueQd || ''}
                                                        onChange={(e) => handleUpdateField(emp.employeeId, 'revenueQd', e.target.value)}
                                                        className="w-full text-right font-mono font-extrabold text-amber-700 bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-xs outline-none focus:ring-1 focus:ring-amber-500"
                                                    />
                                                </td>

                                                {/* DT Thực */}
                                                <td className="px-2 py-2 text-right">
                                                    <input
                                                        type="number"
                                                        value={emp.revenueReal || ''}
                                                        onChange={(e) => handleUpdateField(emp.employeeId, 'revenueReal', e.target.value)}
                                                        className="w-full text-right font-mono font-extrabold text-emerald-700 bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                                                    />
                                                </td>

                                                {/* DT Trả góp */}
                                                <td className="px-2 py-2 text-right">
                                                    <input
                                                        type="number"
                                                        value={emp.installmentReal || ''}
                                                        onChange={(e) => handleUpdateField(emp.employeeId, 'installmentReal', e.target.value)}
                                                        className="w-full text-right font-mono font-bold text-purple-700 bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-xs outline-none focus:ring-1 focus:ring-purple-500"
                                                    />
                                                </td>

                                                {/* % Trả góp */}
                                                <td className="px-2 py-2 text-right">
                                                    <span className={`font-mono font-bold text-xs px-1.5 py-0.5 rounded ${
                                                        emp.installmentRate >= 40
                                                            ? 'bg-emerald-100 text-emerald-800'
                                                            : emp.installmentRate >= 25
                                                            ? 'bg-amber-100 text-amber-800'
                                                            : 'bg-rose-100 text-rose-800'
                                                    }`}>
                                                        {emp.installmentRate.toFixed(1)}%
                                                    </span>
                                                </td>

                                                {/* Nút xem Thi đua */}
                                                <td className="px-2.5 py-2 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedEmployeeId(isExpanded ? null : emp.employeeId)}
                                                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition cursor-pointer inline-flex items-center gap-1 ${
                                                            isExpanded
                                                                ? 'bg-blue-600 text-white border-blue-600'
                                                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                                                        }`}
                                                    >
                                                        <Trophy className="w-3 h-3 text-amber-500" />
                                                        <span>{campaignsCount} mục</span>
                                                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                    </button>
                                                </td>

                                                {/* Xóa */}
                                                <td className="px-2.5 py-2 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveEmployee(emp.employeeId)}
                                                        className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                                                        title="Xóa nhân viên khỏi phiên"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </td>
                                            </tr>

                                            {/* DÒNG MỞ RỘNG CHI TIẾT THI ĐUA */}
                                            {isExpanded && (
                                                <tr className="bg-slate-50/90 border-y border-blue-100">
                                                    <td colSpan={8} className="p-3 sm:px-6">
                                                        <div className="space-y-2">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                                                                    <Trophy className="w-3.5 h-3.5 text-amber-500" />
                                                                    <span>Chi tiết chỉ tiêu thi đua: {emp.fullName}</span>
                                                                </span>
                                                                <span className="text-[10px] text-slate-500">
                                                                    Đơn vị: Triệu VNĐ (hoặc Số Lượng)
                                                                </span>
                                                            </div>

                                                            {campaignsCount === 0 ? (
                                                                <div className="text-xs text-slate-400 italic py-1">
                                                                    Chưa có mục thi đua nào được ghi nhận cho nhân sự này.
                                                                </div>
                                                            ) : (
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                                                    {Object.entries(emp.campaigns).map(([cName, cVal]) => {
                                                                        const detail = (emp.campaignDetails || []).find(d => d.campaignName === cName);
                                                                        return (
                                                                            <div
                                                                                key={cName}
                                                                                className="bg-white border border-slate-200 rounded-xl p-2.5 shadow-xs flex items-center justify-between gap-2"
                                                                            >
                                                                                <div className="min-w-0 flex-1">
                                                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                                                        <span className="font-bold text-slate-800 text-xs truncate max-w-[150px] sm:max-w-none" title={cName}>
                                                                                            {cName}
                                                                                        </span>
                                                                                        {detail?.unit && (
                                                                                            <span className={`text-[9px] font-black px-1 py-0.2 rounded shrink-0 ${
                                                                                                detail.unit === 'SL' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                                                                                            }`}>
                                                                                                {detail.unit}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>

                                                                                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-500 flex-wrap">
                                                                                        {detail?.ratioPercent !== undefined && (
                                                                                            <span className="font-bold text-purple-700 bg-purple-50 px-1 py-0.2 rounded border border-purple-200">
                                                                                                Tỉ trọng: {detail.ratioPercent}%
                                                                                            </span>
                                                                                        )}
                                                                                        {detail?.storeActual !== undefined && detail.storeActual !== 0 && (
                                                                                            <span className="text-slate-600">
                                                                                                ST: <strong className="font-mono">{formatValue(detail.storeActual)}</strong>
                                                                                            </span>
                                                                                        )}
                                                                                        {detail?.storeTarget !== undefined && detail.storeTarget !== 0 && (
                                                                                            <span className="text-slate-400">
                                                                                                (Target: {formatValue(detail.storeTarget)})
                                                                                            </span>
                                                                                        )}
                                                                                        {detail?.isAutoMatched && (
                                                                                            <span className="text-emerald-700 font-bold" title={detail.mappedReason}>
                                                                                                🟢 Đã khớp
                                                                                            </span>
                                                                                        )}
                                                                                        {detail?.rank && (
                                                                                            <span className="font-bold text-blue-600">
                                                                                                Hạng #{detail.rank}
                                                                                            </span>
                                                                                        )}
                                                                                        {detail?.badge && (
                                                                                            <span className={`px-1 rounded text-[9px] font-bold ${
                                                                                                detail.badge === 'TOP'
                                                                                                    ? 'bg-emerald-100 text-emerald-800'
                                                                                                    : 'bg-rose-100 text-rose-800'
                                                                                            }`}>
                                                                                                {detail.badge}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>

                                                                                <input
                                                                                    type="number"
                                                                                    value={cVal || ''}
                                                                                    onChange={(e) => handleUpdateCampaignValue(emp.employeeId, cName, Number(e.target.value) || 0)}
                                                                                    className="w-20 text-right font-mono font-bold text-xs bg-slate-50 border border-slate-200 rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-blue-500"
                                                                                />
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL THÊM NHÂN VIÊN TỪ DANH BẠ ST (CHỈ CHO PHÉP NHÂN SỰ TRONG DANH BẠ ST) */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white rounded-3xl max-w-[520px] w-full p-5 sm:p-6 space-y-4 shadow-2xl border border-slate-200">
                        {/* Header Modal */}
                        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2.5">
                                <span className="p-2 rounded-xl bg-blue-100 text-blue-700 font-bold">
                                    <UserCheck className="w-5 h-5" />
                                </span>
                                <div>
                                    <h3 className="font-extrabold text-base text-slate-900">
                                        Thêm Nhân Viên Vào Phiên
                                    </h3>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Đơn vị: <strong className="text-blue-700">{storeName}</strong> • Chỉ nhập nhân sự có trong danh bạ ST
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsAddModalOpen(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Thông báo lỗi nếu có */}
                        {addError && (
                            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                <span>{addError}</span>
                            </div>
                        )}

                        {storeEmployees.length === 0 ? (
                            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
                                <p className="font-bold flex items-center gap-1.5">
                                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                                    <span>Danh bạ ST {storeName} chưa có nhân sự nào!</span>
                                </p>
                                <p className="text-amber-800">
                                    Hệ thống chỉ cho phép nhập số liệu của nhân sự có trong danh bạ ST. Vui lòng vào trang <strong>Cấu hình ST &amp; Nhân viên</strong> để cập nhật danh bạ nhân sự trước.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Cách 1: Chọn từ danh sách nhân sự chưa có */}
                                <div className="space-y-2">
                                    <label className="block text-xs font-bold text-slate-700">
                                        1. Chọn nhân sự từ danh bạ ST ({availableEmployees.length} nhân sự chưa có trong phiên):
                                    </label>
                                    {availableEmployees.length > 0 ? (
                                        <div className="space-y-2">
                                            <select
                                                value={selectedEmpToAdd}
                                                onChange={(e) => setSelectedEmpToAdd(e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                            >
                                                {availableEmployees.map(emp => (
                                                    <option key={emp.employee_id} value={emp.employee_id}>
                                                        [{emp.employee_id}] {emp.full_name} {emp.job_title ? `• ${emp.job_title}` : ''}
                                                    </option>
                                                ))}
                                            </select>

                                            <div className="flex items-center gap-2 pt-1 flex-wrap">
                                                <button
                                                    type="button"
                                                    onClick={() => handleAddSingleEmployeeFromDirectory(selectedEmpToAdd)}
                                                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition cursor-pointer"
                                                >
                                                    <Plus className="w-3.5 h-3.5" />
                                                    <span>Thêm nhân viên đã chọn</span>
                                                </button>

                                                {availableEmployees.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={handleAddAllMissingEmployees}
                                                        className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                                                    >
                                                        <span>Thêm tất cả ({availableEmployees.length} NV)</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-xs text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl">
                                            ✅ Toàn bộ {storeEmployees.length} nhân sự trong danh bạ ST đã có mặt trong phiên này!
                                        </p>
                                    )}
                                </div>

                                {/* Cách 2: Nhập nhanh theo Mã NV (Đối chiếu danh bạ) */}
                                <div className="space-y-2 pt-3 border-t border-slate-100">
                                    <label className="block text-xs font-bold text-slate-700">
                                        2. Hoặc nhập nhanh Mã NV (Hệ thống sẽ đối chiếu danh bạ ST):
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            placeholder="Nhập mã nhân viên..."
                                            value={manualEmpIdInput}
                                            onChange={(e) => setManualEmpIdInput(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleAddSingleEmployeeFromDirectory(manualEmpIdInput);
                                                }
                                            }}
                                            className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleAddSingleEmployeeFromDirectory(manualEmpIdInput)}
                                            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer shrink-0"
                                        >
                                            Kiểm tra &amp; Thêm
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Footer Modal */}
                        <div className="pt-2 border-t border-slate-100 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setIsAddModalOpen(false)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

