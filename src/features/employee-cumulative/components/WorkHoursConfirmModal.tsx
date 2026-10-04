import { useState } from 'react';
import { Clock, Check, X, Database, RefreshCw, PlusCircle } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (saveMode: 'update' | 'new') => Promise<void>;
    month: number;
    year: number;
    employeeCount: number;
    totalHours: number;
    isSaving: boolean;
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
    editingSession
}: Props) {
    const [saveMode, setSaveMode] = useState<'update' | 'new'>('update');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onConfirm(saveMode);
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
                            <h3 className="font-extrabold text-base leading-tight">Xác Nhận Lưu Giờ Công Toàn Cụm</h3>
                            <p className="text-xs text-emerald-100">Dữ liệu giờ công áp dụng chung cho toàn cụm siêu thị</p>
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

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {/* Tùy chọn cập nhật phiên cũ hay lưu phiên mới nếu đang ở chế độ sửa phiên */}
                    {editingSession && (
                        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950">
                                <Database className="w-4 h-4 text-emerald-600" />
                                <span>Tùy chọn ghi nhận dữ liệu:</span>
                            </div>
                            <div className="space-y-2">
                                <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition cursor-pointer text-xs ${
                                    saveMode === 'update'
                                        ? 'bg-white border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
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
                                            <strong className="text-emerald-900 font-extrabold">Cập nhật vào phiên đang sửa</strong>
                                        </div>
                                        <p className="text-[11px] text-slate-600 mt-0.5">
                                            Ghi đè số liệu trực tiếp vào: <b>{editingSession.session_title}</b> (Mã ID: <span className="font-mono text-slate-500">{editingSession.id}</span>)
                                        </p>
                                    </div>
                                </label>

                                <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition cursor-pointer text-xs ${
                                    saveMode === 'new'
                                        ? 'bg-white border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
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
                                            <strong className="text-slate-800 font-extrabold">Lưu thành phiên mới riêng biệt</strong>
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                            Giữ nguyên phiên cũ không thay đổi, tạo thêm một bản ghi phiên giờ công mới trên hệ thống
                                        </p>
                                    </div>
                                </label>
                            </div>
                        </div>
                    )}

                    {/* Tóm tắt số liệu sắp cập nhật */}
                    <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-2 text-xs">
                        <div className="flex justify-between text-slate-600">
                            <span>Phạm vi cập nhật:</span>
                            <span className="font-bold text-slate-800">Toàn Cụm Siêu Thị (Hỗn Hợp)</span>
                        </div>
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
                    </div>

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
                            className="flex-1 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
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
