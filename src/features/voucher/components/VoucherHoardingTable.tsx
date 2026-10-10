import { useState, useMemo } from 'react';
import {
    AlertTriangle,
    Flame,
    ShieldAlert,
    Eye,
    UserCheck,
    ArrowRight,
    ChevronDown,
    ChevronUp,
    ShieldCheck
} from 'lucide-react';
import type { VoucherHoardingAlert } from '../types';

interface Props {
    alerts: VoucherHoardingAlert[];
    onFilterEmployee?: (empId: string) => void;
    currentFilteredEmployeeId?: string;
}

export default function VoucherHoardingTable({ alerts, onFilterEmployee, currentFilteredEmployeeId }: Props) {
    // Mặc định tự động thu ẩn hiển thị, chỉ hiện tiêu đề và badge cảnh báo cho đến khi người dùng click để mở rộng
    const [isExpanded, setIsExpanded] = useState<boolean>(false);

    // Tính toán số nhân sự có dấu hiệu bất thường (CRITICAL hoặc WARNING)
    const abnormalAlerts = useMemo(() => {
        return alerts.filter(a => a.risk_level === 'CRITICAL' || a.risk_level === 'WARNING');
    }, [alerts]);

    const criticalCount = useMemo(() => {
        return alerts.filter(a => a.risk_level === 'CRITICAL').length;
    }, [alerts]);

    const warningCount = useMemo(() => {
        return alerts.filter(a => a.risk_level === 'WARNING').length;
    }, [alerts]);

    return (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden font-avo">
            {/* Header phân hệ: Click để mở rộng hoặc thu gọn */}
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                className={`p-4 sm:p-5 text-white flex items-center justify-between flex-wrap gap-3 cursor-pointer select-none transition ${
                    abnormalAlerts.length > 0
                        ? 'bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 hover:brightness-105'
                        : 'bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 hover:brightness-105'
                }`}
                title="Bấm để mở rộng hoặc thu ẩn bảng theo dõi đầu cơ tích trữ"
            >
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black shadow-md shrink-0 ${
                        abnormalAlerts.length > 0 ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'
                    }`}>
                        {abnormalAlerts.length > 0 ? <Flame className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                    </div>

                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-sm sm:text-base font-black uppercase tracking-wide text-white">
                                Theo Dõi & Cảnh Báo Đầu Cơ Tích Trữ
                            </h2>

                            {/* Badges cảnh báo trạng thái ngay trên tiêu đề */}
                            {criticalCount > 0 && (
                                <span className="bg-rose-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full animate-pulse border border-rose-300 flex items-center gap-1">
                                    🚨 {criticalCount} user nguy cơ cao gom mã
                                </span>
                            )}
                            {warningCount > 0 && (
                                <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300">
                                    ⚠️ {warningCount} user cần lưu ý
                                </span>
                            )}
                            {abnormalAlerts.length === 0 && (
                                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                                    🟢 An toàn: Không phát hiện bất thường ({alerts.length} nhân sự)
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-300 mt-0.5">
                            {abnormalAlerts.length > 0
                                ? `Phát hiện ${abnormalAlerts.length} nhân sự có dấu hiệu nhận nhiều mã hoặc tích trữ chưa gán đơn hàng.`
                                : 'Hệ thống tự động giám sát tần suất nhận mã và đối chiếu trạng thái gắn đơn hàng thực tế.'}
                        </p>
                    </div>
                </div>

                {/* Nút bấm chuyển đổi thu gọn / mở rộng */}
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-200 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-1.5 transition">
                        <span>{isExpanded ? 'Thu gọn bảng' : 'Bấm để mở rộng xem chi tiết'}</span>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-amber-300" /> : <ChevronDown className="w-4 h-4 text-amber-300" />}
                    </span>
                </div>
            </div>

            {/* VÙNG NỘI DUNG MỞ RỘNG */}
            {isExpanded && (
                <div className="animate-in fade-in duration-150">
                    {alerts.length === 0 ? (
                        <div className="p-8 text-center bg-slate-50/50">
                            <ShieldAlert className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                            <div className="text-sm font-black text-slate-800">Không có dấu hiệu đầu cơ tích trữ</div>
                            <p className="text-xs text-slate-500 mt-1">
                                Các nhân viên đều lấy số lượng mã hợp lý và gắn với đơn hàng thực tế.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase text-slate-600">
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
                                        const isCurrentlyFiltered = Boolean(currentFilteredEmployeeId && currentFilteredEmployeeId.trim() === item.employee_id.trim());

                                        return (
                                            <tr
                                                key={item.employee_id}
                                                className={`hover:bg-slate-50/80 transition ${
                                                    isCurrentlyFiltered
                                                        ? 'bg-indigo-50/70 border-l-4 border-l-indigo-600 font-bold'
                                                        : isCritical
                                                        ? 'bg-rose-50/30'
                                                        : isWarning
                                                        ? 'bg-amber-50/20'
                                                        : ''
                                                }`}
                                            >
                                                {/* Nhân viên */}
                                                <td className="py-2.5 px-3">
                                                    <div className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                                                        <span>{item.employee_name}</span>
                                                        {isCurrentlyFiltered && (
                                                            <span className="text-[9.5px] bg-indigo-600 text-white px-1.5 py-0.2 rounded font-black">
                                                                Đang xem
                                                            </span>
                                                        )}
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

                                                {/* Mức độ rủi ro */}
                                                <td className="py-2.5 px-3">
                                                    {isCritical ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white shadow-xs animate-pulse">
                                                            <Flame className="w-3 h-3" /> NGUY CƠ CAO
                                                        </span>
                                                    ) : isWarning ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                                                            <AlertTriangle className="w-3 h-3 text-amber-700" /> CẦN THEO DÕI
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
                                                            onClick={() => onFilterEmployee(isCurrentlyFiltered ? '' : item.employee_id)}
                                                            className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black inline-flex items-center gap-1 transition cursor-pointer shadow-2xs ${
                                                                isCurrentlyFiltered
                                                                    ? 'bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300'
                                                                    : 'bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 border border-slate-200'
                                                            }`}
                                                            title={isCurrentlyFiltered ? 'Bỏ lọc nhân viên này để xem tất cả mã' : 'Xem chi tiết các mã voucher mà nhân viên này đang giữ'}
                                                        >
                                                            <span>{isCurrentlyFiltered ? '✕ Bỏ lọc' : 'Xem mã'}</span>
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
                    )}
                </div>
            )}
        </div>
    );
}
