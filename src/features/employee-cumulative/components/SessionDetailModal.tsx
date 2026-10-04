import type { EmployeeDataSession } from '../utils/sessionStorage';
import { X, FileSpreadsheet, DownloadCloud } from 'lucide-react';
import ExcelJS from 'exceljs';
import { formatDateTime } from '../../../core/lib/formatters';

interface Props {
    session: EmployeeDataSession;
    onClose: () => void;
    onRestore?: (session: EmployeeDataSession) => void;
}

export default function SessionDetailModal({ session, onClose, onRestore }: Props) {
    const isRevenue = session.session_type === 'REVENUE_CAMPAIGN';

    const handleExportExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Dữ Liệu Phiên');

        worksheet.columns = isRevenue
            ? [
                  { header: 'STT', key: 'stt', width: 8 },
                  { header: 'Mã NV', key: 'emp_id', width: 15 },
                  { header: 'Họ và tên', key: 'name', width: 25 },
                  { header: 'Số lượng đơn', key: 'qty', width: 15 },
                  { header: 'Doanh thu QĐ (tr)', key: 'rev_qd', width: 18 },
                  { header: 'Doanh thu Thực (tr)', key: 'rev_act', width: 18 },
                  { header: 'DT Trả góp (tr)', key: 'dt_tg', width: 15 },
                  { header: '% Trả góp', key: 'pct_tg', width: 12 }
              ]
            : [
                  { header: 'STT', key: 'stt', width: 8 },
                  { header: 'Mã NV', key: 'emp_id', width: 15 },
                  { header: 'Họ và tên', key: 'name', width: 25 },
                  { header: 'Giờ công (giờ)', key: 'hours', width: 18 }
              ];

        session.records.forEach((r, idx) => {
            if (isRevenue) {
                worksheet.addRow({
                    stt: idx + 1,
                    emp_id: r.employee_id,
                    name: r.full_name,
                    qty: r.quantity,
                    rev_qd: r.revenue_qd,
                    rev_act: r.revenue_actual,
                    dt_tg: r.installment_revenue,
                    pct_tg: `${r.installment_rate}%`
                });
            } else {
                worksheet.addRow({
                    stt: idx + 1,
                    emp_id: r.employee_id,
                    name: r.full_name,
                    hours: r.work_hours || 0
                });
            }
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Phien_${session.id}_${session.store_name}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
                {/* Header Modal */}
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <span
                                className={`px-2.5 py-0.5 rounded-lg text-[10px] font-extrabold uppercase ${
                                    isRevenue ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                                }`}
                            >
                                {session.session_type}
                            </span>
                            <span className="text-xs text-slate-400 font-mono">ID: {session.id}</span>
                        </div>
                        <h3 className="text-base font-extrabold text-slate-900 mt-1">{session.session_title}</h3>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Chi tiết Meta Info */}
                <div className="px-6 py-3 bg-white border-b border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Siêu thị</span>
                        <strong className="text-slate-800 line-clamp-1">{session.store_name}</strong>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Thời gian cập nhật</span>
                        <strong className="text-slate-800 font-mono">
                            {formatDateTime(session.created_at)}
                        </strong>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">Số lượng nhân sự</span>
                        <strong className="text-blue-700 font-mono">{session.employee_count} NV</strong>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-slate-400 block text-[10px] font-bold uppercase">
                            {isRevenue ? 'Tổng Doanh Thu Thực' : 'Tổng Giờ Công'}
                        </span>
                        <strong className="text-emerald-700 font-mono">
                            {isRevenue
                                ? `${session.total_revenue_actual.toLocaleString('vi-VN')} tr`
                                : `${session.total_work_hours.toLocaleString('vi-VN')} giờ`}
                        </strong>
                    </div>
                </div>

                {/* Bảng dữ liệu snapshot của phiên */}
                <div data-report-table="true" className="flex-1 overflow-y-auto p-6 font-avo">
                    <table className="w-full text-left text-xs border-collapse font-avo report-table">
                        <thead className="bg-slate-100 text-slate-600 font-bold sticky top-0">
                            <tr>
                                <th className="p-2.5 text-center w-12 border-b">STT</th>
                                <th className="p-2.5 w-24 border-b">Mã NV</th>
                                <th className="p-2.5 border-b">Họ và tên</th>
                                {isRevenue ? (
                                    <>
                                        <th className="p-2.5 text-right border-b">Số Lượng</th>
                                        <th className="p-2.5 text-right border-b text-blue-700">DT QĐ (tr)</th>
                                        <th className="p-2.5 text-right border-b text-emerald-700">DT Thực (tr)</th>
                                        <th className="p-2.5 text-right border-b">Trả Góp (tr)</th>
                                        <th className="p-2.5 text-right border-b">% Trả Góp</th>
                                    </>
                                ) : (
                                    <th className="p-2.5 text-right border-b text-blue-700">Giờ Công (giờ)</th>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                            {session.records.map((r, idx) => (
                                <tr key={r.employee_id} className="hover:bg-slate-50">
                                    <td className="p-2 text-center text-slate-400 font-mono">{idx + 1}</td>
                                    <td className="p-2 font-mono font-bold text-blue-700">{r.employee_id}</td>
                                    <td className="p-2 font-bold text-slate-800">{r.full_name}</td>
                                    {isRevenue ? (
                                        <>
                                            <td className="p-2 text-right font-mono">{r.quantity.toLocaleString('vi-VN')}</td>
                                            <td className="p-2 text-right font-mono font-bold text-blue-700">
                                                {r.revenue_qd.toLocaleString('vi-VN')}
                                            </td>
                                            <td className="p-2 text-right font-mono font-bold text-emerald-700">
                                                {r.revenue_actual.toLocaleString('vi-VN')}
                                            </td>
                                            <td className="p-2 text-right font-mono text-slate-600">
                                                {r.installment_revenue.toLocaleString('vi-VN')}
                                            </td>
                                            <td className="p-2 text-right font-mono text-slate-600">
                                                {r.installment_rate}%
                                            </td>
                                        </>
                                    ) : (
                                        <td className="p-2 text-right font-mono font-bold text-blue-700">
                                            {r.work_hours?.toLocaleString('vi-VN')}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Footer Modal */}
                <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <button
                        type="button"
                        onClick={handleExportExcel}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>Xuất File Excel Phiên Này</span>
                    </button>

                    <div className="flex items-center gap-2">
                        {onRestore && (
                            <button
                                type="button"
                                onClick={() => {
                                    onRestore(session);
                                    onClose();
                                }}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                                title="Nạp phiên này vào bảng cập nhật số liệu để chỉnh sửa tiếp"
                            >
                                <DownloadCloud className="w-4 h-4" />
                                <span>Nạp Vào Trang Cập Nhật</span>
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                            Đóng
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
