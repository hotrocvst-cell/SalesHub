import React from 'react';
import { AlertTriangle, Flame, ShieldAlert, Eye, UserCheck, ArrowRight } from 'lucide-react';
import type { VoucherHoardingAlert } from '../types';

interface Props {
    alerts: VoucherHoardingAlert[];
    onFilterEmployee?: (empId: string) => void;
}

export default function VoucherHoardingTable({ alerts, onFilterEmployee }: Props) {
    if (alerts.length === 0) {
        return (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 text-center font-avo">
                <ShieldAlert className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <div className="text-sm font-black text-slate-800">Không có dấu hiệu đầu cơ tích trữ</div>
                <p className="text-xs text-slate-500 mt-1">
                    Các nhân viên đều lấy số lượng mã hợp lý và gắn với đơn hàng thực tế.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden font-avo">
            <div className="bg-slate-900 px-4 py-3 text-white flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-rose-400" />
                    <span className="text-xs sm:text-sm font-black uppercase tracking-wide">
                        Theo Dõi & Cảnh Báo Đầu Cơ Tích Trữ
                    </span>
                </div>
                <span className="text-[11px] font-bold text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-600/40">
                    {alerts.filter(a => a.risk_level !== 'NORMAL').length} nhân sự cần lưu ý
                </span>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase text-slate-500">
                            <th className="py-2.5 px-3">Nhân Sự</th>
                            <th className="py-2.5 px-2 text-center">Hôm Nay</th>
                            <th className="py-2.5 px-2 text-center">Chưa Dùng</th>
                            <th className="py-2.5 px-3">Mức Độ Cảnh Báo</th>
                            <th className="py-2.5 px-3 hidden md:table-cell">Lý Do Đáng Ngờ</th>
                            <th className="py-2.5 px-2 text-right">Thao Tác</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {alerts.map((item) => {
                            const isCritical = item.risk_level === 'CRITICAL';
                            const isWarning = item.risk_level === 'WARNING';

                            return (
                                <tr
                                    key={item.employee_id}
                                    className={`hover:bg-slate-50/80 transition ${
                                        isCritical ? 'bg-rose-50/30' : isWarning ? 'bg-amber-50/20' : ''
                                    }`}
                                >
                                    {/* Nhân viên */}
                                    <td className="py-2.5 px-3">
                                        <div className="font-black text-slate-900 text-xs">
                                            {item.employee_name}
                                        </div>
                                        <div className="text-[10px] text-slate-500 font-mono">
                                            Mã: {item.employee_id} • {item.store_name}
                                        </div>
                                    </td>

                                    {/* Số mã hôm nay */}
                                    <td className="py-2.5 px-2 text-center font-mono">
                                        <span className={`inline-block px-2 py-0.5 rounded font-black text-xs ${
                                            item.claimed_today_count >= 5
                                                ? 'bg-rose-600 text-white shadow-xs'
                                                : item.claimed_today_count >= 3
                                                ? 'bg-amber-100 text-amber-800'
                                                : 'text-slate-700'
                                        }`}>
                                            {item.claimed_today_count} mã
                                        </span>
                                    </td>

                                    {/* Chưa dùng */}
                                    <td className="py-2.5 px-2 text-center font-mono">
                                        <span className={`inline-block px-2 py-0.5 rounded font-bold text-xs ${
                                            item.unspent_count >= 4
                                                ? 'bg-rose-100 text-rose-800 font-black'
                                                : item.unspent_count >= 2
                                                ? 'bg-amber-100 text-amber-800'
                                                : 'text-slate-600'
                                        }`}>
                                            {item.unspent_count} mã
                                        </span>
                                    </td>

                                    {/* Mức độ */}
                                    <td className="py-2.5 px-3">
                                        {isCritical ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white animate-pulse">
                                                <Flame className="w-3 h-3" /> Nghi Vấn Đầu Cơ
                                            </span>
                                        ) : isWarning ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                                                <AlertTriangle className="w-3 h-3 text-amber-600" /> Cần Lưu Ý
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                <UserCheck className="w-3 h-3 text-emerald-600" /> Bình Thường
                                            </span>
                                        )}
                                    </td>

                                    {/* Lý do */}
                                    <td className="py-2.5 px-3 hidden md:table-cell text-[11px] text-slate-600">
                                        {item.reasons.length > 0 ? (
                                            <span className="text-rose-700 font-medium">
                                                {item.reasons.join(', ')}
                                            </span>
                                        ) : (
                                            <span className="text-slate-400">Giao dịch trong ngưỡng an toàn</span>
                                        )}
                                    </td>

                                    {/* Thao tác */}
                                    <td className="py-2.5 px-2 text-right">
                                        {onFilterEmployee && (
                                            <button
                                                type="button"
                                                onClick={() => onFilterEmployee(item.employee_id)}
                                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10.5px] font-bold inline-flex items-center gap-1 transition cursor-pointer"
                                                title="Xem chi tiết các mã voucher mà nhân viên này đang giữ"
                                            >
                                                <span>Xem mã</span>
                                                <ArrowRight className="w-3 h-3" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
