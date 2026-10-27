import React from 'react';
import { History, X, Trash2, RotateCcw, Printer, Calendar, FileText } from 'lucide-react';
import type { CashAuditRecord } from '../types';

interface CashHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    history: CashAuditRecord[];
    onLoadRecord: (record: CashAuditRecord) => void;
    onDeleteRecord: (id: string | number) => void;
    onClearAll: () => void;
    onPrintRecord: (record: CashAuditRecord) => void;
}

export const CashHistoryModal: React.FC<CashHistoryModalProps> = ({
    isOpen,
    onClose,
    history,
    onLoadRecord,
    onDeleteRecord,
    onClearAll,
    onPrintRecord
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-2xs z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                            <History className="w-4 h-4" />
                        </span>
                        <div>
                            <h3 className="text-xs sm:text-sm font-black text-slate-800 flex items-center gap-1.5">
                                Lịch Sử Kiểm Quỹ Ca Trực
                                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-full border border-indigo-200 font-bold">
                                    {history.length} bản ghi
                                </span>
                            </h3>
                            <p className="text-[10.5px] text-slate-500">
                                Lưu trữ phiên đếm tiền ca trực trên thiết bị (LocalStorage)
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* List Container */}
                <div className="p-3 sm:p-4 overflow-y-auto flex-1 space-y-2.5 bg-slate-50/50">
                    {history.length === 0 ? (
                        <div className="text-center py-10 space-y-2">
                            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                                <FileText className="w-6 h-6" />
                            </div>
                            <p className="text-xs text-slate-500 font-medium">Chưa có lịch sử kiểm tiền nào.</p>
                            <p className="text-[10.5px] text-slate-400">Các phiên kiểm quỹ được lưu lại sẽ hiển thị tại đây.</p>
                        </div>
                    ) : (
                        history.map(item => {
                            const isExact = item.diff === 0;
                            const isExcess = item.diff > 0;

                            return (
                                <div
                                    key={item.id}
                                    className="p-3 bg-white border border-slate-200 rounded-xl hover:border-indigo-300 hover:shadow-xs transition space-y-2"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-xs font-black text-indigo-950 flex items-center gap-1">
                                                    <Calendar className="w-3 h-3 text-slate-400" />
                                                    {item.time}
                                                </span>
                                                {item.store_name && (
                                                    <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                                        {item.store_name}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-[11px] text-slate-600 flex items-center gap-2 flex-wrap">
                                                {item.user_code && (
                                                    <span><b className="text-slate-700">Người kiểm:</b> {item.user_code}</span>
                                                )}
                                                {item.note && item.note !== 'Không có ghi chú' && (
                                                    <span><b className="text-slate-700">Ghi chú:</b> {item.note}</span>
                                                )}
                                                {!item.user_code && (!item.note || item.note === 'Không có ghi chú') && (
                                                    <span className="text-slate-400 italic">Không có ghi chú</span>
                                                )}
                                            </div>
                                        </div>

                                        <span className={`text-[10.5px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                                            isExact
                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                : (isExcess
                                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                                    : 'bg-rose-50 text-rose-700 border border-rose-200')
                                        }`}>
                                            {isExact
                                                ? 'Khớp (0 đ)'
                                                : (isExcess
                                                    ? `Dư +${item.diff.toLocaleString('vi-VN')} đ`
                                                    : `Thiếu ${item.diff.toLocaleString('vi-VN')} đ`)}
                                        </span>
                                    </div>

                                    {/* Sub details */}
                                    <div className="flex items-center justify-between text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-100">
                                        <div>
                                            <span className="text-slate-500">Thực tế đếm: </span>
                                            <b className="font-mono text-indigo-900 font-bold">
                                                {item.total.toLocaleString('vi-VN')} đ
                                            </b>
                                        </div>
                                        <div>
                                            <span className="text-slate-500">Cần nộp: </span>
                                            <b className="font-mono text-slate-800 font-bold">
                                                {item.target.toLocaleString('vi-VN')} đ
                                            </b>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex justify-end items-center gap-1.5 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => onPrintRecord(item)}
                                            className="px-2 py-1 text-[10.5px] font-bold text-emerald-700 hover:bg-emerald-50 rounded-lg border border-emerald-200 flex items-center gap-1 transition cursor-pointer"
                                            title="In lại phiếu 80mm"
                                        >
                                            <Printer className="w-3 h-3" />
                                            In Phiếu
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onLoadRecord(item)}
                                            className="px-2.5 py-1 text-[10.5px] font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-1 transition cursor-pointer shadow-2xs"
                                            title="Nạp dữ liệu vào bảng để xem hoặc sửa"
                                        >
                                            <RotateCcw className="w-3 h-3" />
                                            Nạp Lại
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onDeleteRecord(item.id)}
                                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                            title="Xóa bản ghi này"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="px-4 py-3 bg-white border-t border-slate-200 flex justify-between items-center">
                    {history.length > 0 ? (
                        <button
                            type="button"
                            onClick={onClearAll}
                            className="px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl flex items-center gap-1 transition cursor-pointer"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            Xóa Toàn Bộ
                        </button>
                    ) : <div />}

                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
};
