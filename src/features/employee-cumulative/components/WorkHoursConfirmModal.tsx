import React, { useState } from 'react';
import { Clock, Check, X, Database, RefreshCw, PlusCircle, Split, Store, Layers } from 'lucide-react';
import type { StoreItem } from '../../../core/lib/storage';
import { getShortStoreName } from '../../../core/lib/formatters';

export type WorkHoursSaveScope = 'split_by_store' | 'single_store' | 'all';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (payload: {
        saveMode: 'update' | 'new';
        scope: WorkHoursSaveScope;
        selectedStoreName?: string;
    }) => Promise<void>;
    month: number;
    year: number;
    employeeCount: number;
    totalHours: number;
    isSaving: boolean;
    stores: StoreItem[];
    currentSelectedStore?: string;
    storeBreakdown?: Array<{ storeName: string; employeeCount: number; hours: number }>;
    editingSession?: {
        id: string;
        session_title: string;
        session_type: string;
        store_name: string;
    } | null;
}

export default function WorkHoursConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    month,
    year,
    employeeCount,
    totalHours,
    isSaving,
    stores,
    currentSelectedStore = 'all',
    storeBreakdown = [],
    editingSession
}: Props) {
    const [saveMode, setSaveMode] = useState<'update' | 'new'>('update');
    // Mặc định: nếu phát hiện nhiều siêu thị thì chọn tách riêng theo siêu thị, nếu đang chọn 1 siêu thị cụ thể thì chọn single_store
    const [scope, setScope] = useState<WorkHoursSaveScope>(() => {
        if (currentSelectedStore && currentSelectedStore !== 'all') {
            return 'single_store';
        }
        return storeBreakdown.length > 1 ? 'split_by_store' : 'split_by_store';
    });

    const [selectedStoreName, setSelectedStoreName] = useState<string>(() => {
        if (currentSelectedStore && currentSelectedStore !== 'all') {
            return currentSelectedStore;
        }
        return stores[0]?.name || '';
    });

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onConfirm({
            saveMode,
            scope,
            selectedStoreName: scope === 'single_store' ? selectedStoreName : undefined
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-emerald-900 p-4 sm:p-5 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
                            <Clock className="w-5 h-5 text-emerald-200" />
                        </div>
                        <div>
                            <h3 className="font-extrabold text-base leading-tight">Xác Nhận Lưu Giờ Công Nhân Viên</h3>
                            <p className="text-xs text-emerald-100">Lựa chọn phạm vi lưu theo siêu thị hoặc tự động tách riêng</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
                    {/* KHỐI 1: TÙY CHỌN PHẠM VI LƯU THEO SIÊU THỊ */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                            <Store className="w-4 h-4 text-emerald-600" />
                            <span>Phạm vi lưu phiên giờ công:</span>
                        </div>

                        <div className="space-y-2">
                            {/* Option 1: Tự động tách theo từng siêu thị */}
                            <label className={`block p-3 rounded-xl border transition cursor-pointer text-xs ${
                                scope === 'split_by_store'
                                    ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                                    : 'bg-white border-slate-200 hover:bg-slate-50'
                            }`}>
                                <div className="flex items-start gap-2.5">
                                    <input
                                        type="radio"
                                        name="workHoursScope"
                                        value="split_by_store"
                                        checked={scope === 'split_by_store'}
                                        onChange={() => setScope('split_by_store')}
                                        className="mt-0.5 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <Split className="w-3.5 h-3.5 text-emerald-700" />
                                            <strong className="text-emerald-950 font-extrabold">
                                                Tách riêng phiên theo từng Siêu thị (Khuyên dùng)
                                            </strong>
                                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-200 text-emerald-800 font-bold">
                                                Tối ưu trạng thái dữ liệu
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                                            Hệ thống tự động nhóm nhân viên theo siêu thị thực tế và tạo các phiên giờ công riêng tương ứng. Giúp trang <b>Trạng thái dữ liệu</b> và báo cáo hiệu quả siêu thị hiển thị chính xác 100%.
                                        </p>

                                        {/* Danh sách các siêu thị được phát hiện */}
                                        {storeBreakdown.length > 0 && (
                                            <div className="mt-2 pt-2 border-t border-emerald-200/60 flex flex-wrap gap-1.5">
                                                <span className="text-[10px] font-bold text-emerald-900 block w-full">
                                                    Phát hiện {storeBreakdown.length} siêu thị từ danh sách nhân sự:
                                                </span>
                                                {storeBreakdown.map(sb => (
                                                    <span
                                                        key={sb.storeName}
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-emerald-300 text-[10px] text-emerald-900 font-semibold"
                                                    >
                                                        <span>{getShortStoreName(sb.storeName)}:</span>
                                                        <strong className="text-emerald-700">{sb.employeeCount} NV ({sb.hours}h)</strong>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </label>

                            {/* Option 2: Lưu riêng cho 1 siêu thị cụ thể */}
                            <label className={`block p-3 rounded-xl border transition cursor-pointer text-xs ${
                                scope === 'single_store'
                                    ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                                    : 'bg-white border-slate-200 hover:bg-slate-50'
                            }`}>
                                <div className="flex items-start gap-2.5">
                                    <input
                                        type="radio"
                                        name="workHoursScope"
                                        value="single_store"
                                        checked={scope === 'single_store'}
                                        onChange={() => setScope('single_store')}
                                        className="mt-0.5 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <Store className="w-3.5 h-3.5 text-blue-600" />
                                            <strong className="text-slate-800 font-extrabold">
                                                Lưu cho 1 siêu thị cụ thể
                                            </strong>
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                            Ghi nhận toàn bộ số giờ công này cho 1 siêu thị được chọn bên dưới
                                        </p>

                                        {scope === 'single_store' && (
                                            <div className="mt-2.5">
                                                <select
                                                    value={selectedStoreName}
                                                    onChange={e => setSelectedStoreName(e.target.value)}
                                                    className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                                >
                                                    {stores.map(s => (
                                                        <option key={s.id || s.code} value={s.name}>
                                                            {s.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </label>

                            {/* Option 3: Lưu gộp chung toàn cụm */}
                            <label className={`block p-3 rounded-xl border transition cursor-pointer text-xs ${
                                scope === 'all'
                                    ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                                    : 'bg-white border-slate-200 hover:bg-slate-50'
                            }`}>
                                <div className="flex items-start gap-2.5">
                                    <input
                                        type="radio"
                                        name="workHoursScope"
                                        value="all"
                                        checked={scope === 'all'}
                                        onChange={() => setScope('all')}
                                        className="mt-0.5 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-1.5">
                                            <Layers className="w-3.5 h-3.5 text-slate-600" />
                                            <strong className="text-slate-800 font-extrabold">
                                                Lưu chung toàn cụm (1 phiên gộp)
                                            </strong>
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                            Lưu 1 phiên duy nhất với tên &quot;Toàn Cụm Siêu Thị&quot; cho toàn bộ nhân sự
                                        </p>
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* KHỐI 2: TÙY CHỌN CẬP NHẬT PHIÊN CŨ HAY TẠO PHIÊN MỚI (NẾU ĐANG SỬA) */}
                    {editingSession && scope !== 'split_by_store' && (
                        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                            <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                <Database className="w-4 h-4 text-emerald-600" />
                                <span>Tùy chọn ghi nhận dữ liệu:</span>
                            </div>
                            <div className="space-y-2">
                                <label className={`flex items-start gap-2.5 p-2 rounded-lg border transition cursor-pointer ${
                                    saveMode === 'update'
                                        ? 'bg-white border-emerald-500 ring-1 ring-emerald-500/30'
                                        : 'bg-white/60 border-slate-200 hover:bg-white'
                                }`}>
                                    <input
                                        type="radio"
                                        name="saveModeHours"
                                        value="update"
                                        checked={saveMode === 'update'}
                                        onChange={() => setSaveMode('update')}
                                        className="mt-0.5 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                    />
                                    <div>
                                        <div className="flex items-center gap-1.5">
                                            <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                                            <strong className="text-slate-800 font-bold">Cập nhật vào phiên đang sửa</strong>
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-xs">
                                            Ghi đè: <b>{editingSession.session_title}</b>
                                        </p>
                                    </div>
                                </label>

                                <label className={`flex items-start gap-2.5 p-2 rounded-lg border transition cursor-pointer ${
                                    saveMode === 'new'
                                        ? 'bg-white border-emerald-500 ring-1 ring-emerald-500/30'
                                        : 'bg-white/60 border-slate-200 hover:bg-white'
                                }`}>
                                    <input
                                        type="radio"
                                        name="saveModeHours"
                                        value="new"
                                        checked={saveMode === 'new'}
                                        onChange={() => setSaveMode('new')}
                                        className="mt-0.5 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                    />
                                    <div>
                                        <div className="flex items-center gap-1.5">
                                            <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                                            <strong className="text-slate-800 font-bold">Lưu thành phiên mới riêng biệt</strong>
                                        </div>
                                    </div>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* TÓM TẮT SỐ LIỆU */}
                    <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-1.5 text-xs">
                        <div className="flex justify-between text-slate-600">
                            <span>Kỳ báo cáo:</span>
                            <span className="font-bold text-slate-800">Tháng {month} / {year}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                            <span>Số nhân sự có giờ công:</span>
                            <span className="font-bold text-blue-700">{employeeCount} nhân viên</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                            <span>Tổng giờ công lũy kế:</span>
                            <span className="font-bold text-emerald-700 font-mono">{totalHours.toLocaleString('vi-VN')} giờ</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                            <span>Kết quả dự kiến:</span>
                            <span className="font-bold text-slate-800">
                                {scope === 'split_by_store'
                                    ? `Tạo ${storeBreakdown.length || 1} phiên riêng theo từng siêu thị`
                                    : scope === 'single_store'
                                    ? `Lưu cho: ${getShortStoreName(selectedStoreName)}`
                                    : 'Lưu 1 phiên toàn cụm'}
                            </span>
                        </div>
                    </div>

                    {/* NÚT HÀNH ĐỘNG */}
                    <div className="flex gap-2 pt-2 border-t border-slate-100">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSaving}
                            className="flex-1 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                        >
                            Hủy Bỏ
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex-1 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                            <Check className="w-4 h-4" />
                            <span>
                                {isSaving
                                    ? 'Đang Lưu...'
                                    : scope === 'split_by_store'
                                    ? `Xác Nhận Tách ${storeBreakdown.length || ''} Siêu Thị`
                                    : 'Xác Nhận Lưu Giờ Công'}
                            </span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
