import React, { useState, useEffect } from 'react';
import type { StoreItem } from '../../../core/lib/storage';
import { Store, AlertTriangle, Check, X, ShieldAlert, Database, RefreshCw, PlusCircle } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (storeName: string, saveMode: 'update' | 'new') => Promise<void>;
    stores: StoreItem[];
    defaultStoreName: string;
    month: number;
    year: number;
    employeeCount: number;
    totalRevenueActual: number;
    campaignCount: number;
    isSaving: boolean;
    editingSession?: {
        id: string;
        session_title: string;
        session_type: string;
        store_name: string;
    } | null;
}

export default function StoreConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    stores,
    defaultStoreName,
    month,
    year,
    employeeCount,
    totalRevenueActual,
    campaignCount,
    isSaving,
    editingSession
}: Props) {
    const [selectedStore, setSelectedStore] = useState<string>(
        defaultStoreName !== 'all' ? defaultStoreName : (stores[0]?.name || '')
    );
    const [saveMode, setSaveMode] = useState<'update' | 'new'>('update');
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
        if (defaultStoreName && defaultStoreName !== 'all') {
            setSelectedStore(defaultStoreName);
        } else if (stores.length > 0 && (!selectedStore || selectedStore === 'all')) {
            setSelectedStore(stores[0].name);
        }
    }, [defaultStoreName, stores]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStore || selectedStore === 'all') {
            setErrorMsg('Vui lòng chọn đích danh một siêu thị cụ thể!');
            return;
        }
        setErrorMsg('');
        await onConfirm(selectedStore, saveMode);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 p-4 sm:p-5 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
                            <Store className="w-5 h-5 text-amber-300" />
                        </div>
                        <div>
                            <h3 className="font-extrabold text-base leading-tight">Xác Nhận Siêu Thị Cập Nhật</h3>
                            <p className="text-xs text-blue-200">Lũy kế Doanh thu & Thi đua áp dụng theo từng siêu thị</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {/* Tùy chọn cập nhật phiên cũ hay lưu phiên mới nếu đang ở chế độ sửa phiên */}
                    {editingSession && (
                        <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-950">
                                <Database className="w-4 h-4 text-blue-600" />
                                <span>Tùy chọn ghi nhận dữ liệu:</span>
                            </div>
                            <div className="space-y-2">
                                <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition cursor-pointer text-xs ${
                                    saveMode === 'update'
                                        ? 'bg-white border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                                        : 'bg-white/60 border-slate-200 hover:bg-white'
                                }`}>
                                    <input
                                        type="radio"
                                        name="saveMode"
                                        value="update"
                                        checked={saveMode === 'update'}
                                        onChange={() => setSaveMode('update')}
                                        className="mt-0.5 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    />
                                    <div>
                                        <div className="flex items-center gap-1.5">
                                            <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                                            <strong className="text-blue-900 font-extrabold">Cập nhật vào phiên đang sửa</strong>
                                        </div>
                                        <p className="text-[11px] text-slate-600 mt-0.5">
                                            Ghi đè số liệu trực tiếp vào: <b>{editingSession.session_title}</b> (Mã ID: <span className="font-mono text-slate-500">{editingSession.id}</span>)
                                        </p>
                                    </div>
                                </label>

                                <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition cursor-pointer text-xs ${
                                    saveMode === 'new'
                                        ? 'bg-white border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                                        : 'bg-white/60 border-slate-200 hover:bg-white'
                                }`}>
                                    <input
                                        type="radio"
                                        name="saveMode"
                                        value="new"
                                        checked={saveMode === 'new'}
                                        onChange={() => setSaveMode('new')}
                                        className="mt-0.5 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    />
                                    <div>
                                        <div className="flex items-center gap-1.5">
                                            <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                                            <strong className="text-slate-800 font-extrabold">Lưu thành phiên mới riêng biệt</strong>
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                            Giữ nguyên phiên cũ không thay đổi, tạo thêm một bản ghi phiên mới trên hệ thống
                                        </p>
                                    </div>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* Cảnh báo quy trình */}
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <span className="font-bold block">Quy chuẩn dữ liệu siêu thị:</span>
                            <span>
                                Báo cáo Doanh thu và Thi đua được xuất theo từng siêu thị riêng biệt. Vui lòng xác nhận chính xác siêu thị đích trước khi lưu.
                            </span>
                        </div>
                    </div>

                    {/* Lựa chọn siêu thị */}
                    <div>
                        <label className="text-xs font-bold text-slate-700 block mb-1.5">
                            Tên siêu thị được cập nhật số liệu: <span className="text-rose-500">*</span>
                        </label>
                        <select
                            value={selectedStore}
                            onChange={e => { setSelectedStore(e.target.value); setErrorMsg(''); }}
                            disabled={isSaving}
                            className="w-full text-xs font-bold px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900"
                        >
                            {stores.map(s => (
                                <option key={s.id || s.code} value={s.name}>
                                    🏢 {s.name} ({s.code})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Tóm tắt số liệu sắp cập nhật */}
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-1.5 text-xs">
                        <div className="flex justify-between text-slate-600">
                            <span>Kỳ báo cáo:</span>
                            <span className="font-bold text-slate-800">Tháng {month} / {year}</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                            <span>Số nhân sự nhận số liệu:</span>
                            <span className="font-bold text-blue-700">{employeeCount} nhân viên</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                            <span>Tổng DT thực lũy kế:</span>
                            <span className="font-bold text-emerald-700 font-mono">{totalRevenueActual.toLocaleString('vi-VN')} tr</span>
                        </div>
                        <div className="flex justify-between text-slate-600">
                            <span>Số lượng mục thi đua:</span>
                            <span className="font-bold text-amber-700">{campaignCount} chiến dịch</span>
                        </div>
                    </div>

                    {errorMsg && (
                        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700">
                            <ShieldAlert className="w-4 h-4 shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {/* Nút hành động */}
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
                            className="flex-1 py-2.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                            <Check className="w-4 h-4" />
                            <span>
                                {isSaving
                                    ? 'Đang Lưu...'
                                    : saveMode === 'update' && editingSession
                                        ? 'Xác Nhận Cập Nhật Phiên Này'
                                        : 'Xác Nhận Lưu Phiên Mới'}
                            </span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
