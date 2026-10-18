import { useState, useMemo, useEffect } from 'react';
import {
    AlertTriangle,
    Flame,
    ShieldAlert,
    UserCheck,
    ArrowRight,
    ChevronDown,
    ChevronUp,
    ShieldCheck,
    Filter,
    Layers,
    Search
} from 'lucide-react';
import type { VoucherHoardingAlert } from '../types';
import { cleanEmployeeName, getShortenedEmployeeName } from '../../../core/lib/formatters';

interface Props {
    alerts: VoucherHoardingAlert[];
    onFilterEmployee?: (empId: string) => void;
    currentFilteredEmployeeId?: string;
    defaultExpanded?: boolean;
    defaultRiskFilter?: 'CRITICAL' | 'WARNING' | 'RISK' | 'ALL' | 'NORMAL';
}

export default function VoucherHoardingTable({
    alerts,
    onFilterEmployee,
    currentFilteredEmployeeId,
    defaultExpanded = true,
    defaultRiskFilter = 'CRITICAL'
}: Props) {
    // Mặc định tự động mở rộng hiển thị để người dùng thấy ngay danh sách nhân viên có nguy cơ
    const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);
    // Bộ lọc hiển thị theo mức độ cảnh báo: mặc định hiển thị user đang có 'CRITICAL' (Nguy cơ cao)
    const [filterRisk, setFilterRisk] = useState<'CRITICAL' | 'WARNING' | 'RISK' | 'ALL' | 'NORMAL'>(defaultRiskFilter);
    const [hasUserChangedFilter, setHasUserChangedFilter] = useState<boolean>(false);
    const [searchKeyword, setSearchKeyword] = useState<string>('');

    // Tính toán số nhân sự có dấu hiệu bất thường (CRITICAL hoặc WARNING)
    const criticalCount = useMemo(() => {
        return alerts.filter(a => a.risk_level === 'CRITICAL').length;
    }, [alerts]);

    const warningCount = useMemo(() => {
        return alerts.filter(a => a.risk_level === 'WARNING').length;
    }, [alerts]);

    const riskCount = criticalCount + warningCount;

    const normalCount = useMemo(() => {
        return alerts.filter(a => a.risk_level === 'NORMAL').length;
    }, [alerts]);

    // Đồng bộ mức lọc mặc định khi alerts nạp vào:
    // Nếu có user nguy cơ cao (CRITICAL) -> hiển thị CRITICAL
    // Nếu không có CRITICAL nhưng có WARNING -> hiển thị WARNING
    // Nếu hoàn toàn an toàn (không có nguy cơ) -> hiển thị ALL
    useEffect(() => {
        if (!hasUserChangedFilter && alerts.length > 0) {
            if (criticalCount > 0) {
                setFilterRisk('CRITICAL');
            } else if (warningCount > 0) {
                setFilterRisk('WARNING');
            } else {
                setFilterRisk('ALL');
            }
        }
    }, [alerts, criticalCount, warningCount, hasUserChangedFilter]);

    // Đồng bộ chiều rộng badge mã nhân viên theo Rule 11
    const maxIdLength = useMemo(() => {
        if (!alerts || alerts.length === 0) return 6;
        return Math.max(6, ...alerts.map(r => String(r.employee_id || '').trim().length));
    }, [alerts]);

    // Lọc danh sách nhân viên theo mức độ cảnh báo và từ khóa tìm kiếm
    const filteredAlerts = useMemo(() => {
        let list = alerts;

        if (filterRisk === 'CRITICAL') {
            list = list.filter(a => a.risk_level === 'CRITICAL');
        } else if (filterRisk === 'WARNING') {
            list = list.filter(a => a.risk_level === 'WARNING');
        } else if (filterRisk === 'RISK') {
            list = list.filter(a => a.risk_level === 'CRITICAL' || a.risk_level === 'WARNING');
        } else if (filterRisk === 'NORMAL') {
            list = list.filter(a => a.risk_level === 'NORMAL');
        }

        if (searchKeyword.trim()) {
            const q = searchKeyword.trim().toLowerCase();
            list = list.filter(a =>
                a.employee_name.toLowerCase().includes(q) ||
                a.employee_id.toLowerCase().includes(q) ||
                (a.store_name && a.store_name.toLowerCase().includes(q))
            );
        }

        return list;
    }, [alerts, filterRisk, searchKeyword]);

    return (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden font-avo">
            {/* Header phân hệ: Click để mở rộng hoặc thu gọn */}
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                className={`p-4 sm:p-5 text-white flex items-center justify-between flex-wrap gap-3 cursor-pointer select-none transition ${
                    riskCount > 0
                        ? 'bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 hover:brightness-105'
                        : 'bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 hover:brightness-105'
                }`}
                title="Bấm để mở rộng hoặc thu ẩn bảng theo dõi đầu cơ tích trữ"
            >
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black shadow-md shrink-0 ${
                        riskCount > 0 ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'
                    }`}>
                        {riskCount > 0 ? <Flame className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
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
                            {riskCount === 0 && (
                                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                                    🟢 An toàn: Không phát hiện bất thường ({alerts.length} nhân sự)
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-300 mt-0.5">
                            {riskCount > 0
                                ? `Phát hiện ${riskCount} nhân sự nhận nhiều mã nhưng chưa dùng đủ đơn hàng đối ứng.`
                                : 'Hệ thống tự động đối chiếu số lượng mã đã lấy với mã chưa dùng theo ngưỡng an toàn.'}
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
                    {/* Thanh lọc mức độ cảnh báo & tìm kiếm nhanh */}
                    <div className="bg-slate-900/95 px-4 py-2.5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5 shrink-0">
                                <Filter className="w-3.5 h-3.5 text-amber-400" />
                                <span>Mức độ cảnh báo:</span>
                            </span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {/* 1. Nguy cơ cao (Mặc định) */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setHasUserChangedFilter(true);
                                        setFilterRisk('CRITICAL');
                                    }}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                                        filterRisk === 'CRITICAL'
                                            ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-400'
                                            : 'bg-slate-800/80 text-rose-300 hover:bg-rose-950/50'
                                    }`}
                                >
                                    <Flame className="w-3.5 h-3.5" />
                                    <span>Nguy Cơ Cao ({criticalCount})</span>
                                </button>

                                {/* 2. Cần theo dõi */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setHasUserChangedFilter(true);
                                        setFilterRisk('WARNING');
                                    }}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                                        filterRisk === 'WARNING'
                                            ? 'bg-amber-500 text-slate-950 shadow-xs ring-2 ring-amber-300'
                                            : 'bg-slate-800/80 text-amber-300 hover:bg-amber-950/50'
                                    }`}
                                >
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    <span>Cần Theo Dõi ({warningCount})</span>
                                </button>

                                {/* 3. Tất cả nguy cơ (khi có cả 2 nhóm) */}
                                {criticalCount > 0 && warningCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setHasUserChangedFilter(true);
                                            setFilterRisk('RISK');
                                        }}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                                            filterRisk === 'RISK'
                                                ? 'bg-gradient-to-r from-rose-600 to-amber-600 text-white shadow-xs'
                                                : 'bg-slate-800/80 text-orange-300 hover:bg-slate-800'
                                        }`}
                                    >
                                        <ShieldAlert className="w-3.5 h-3.5" />
                                        <span>Tất Cả Nguy Cơ ({riskCount})</span>
                                    </button>
                                )}

                                {/* 4. Tất cả */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setHasUserChangedFilter(true);
                                        setFilterRisk('ALL');
                                    }}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                                        filterRisk === 'ALL'
                                            ? 'bg-white text-slate-900 shadow-xs'
                                            : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                                    }`}
                                >
                                    <Layers className="w-3.5 h-3.5" />
                                    <span>Tất Cả ({alerts.length})</span>
                                </button>

                                {/* 5. Bình thường */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setHasUserChangedFilter(true);
                                        setFilterRisk('NORMAL');
                                    }}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                                        filterRisk === 'NORMAL'
                                            ? 'bg-emerald-600 text-white shadow-xs'
                                            : 'bg-slate-800/80 text-emerald-300 hover:bg-emerald-950/50'
                                    }`}
                                >
                                    <UserCheck className="w-3.5 h-3.5" />
                                    <span>Bình Thường ({normalCount})</span>
                                </button>
                            </div>
                        </div>

                        {/* Ô tìm kiếm nhanh */}
                        <div className="relative min-w-[150px] max-w-[210px]">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={searchKeyword}
                                onChange={(e) => setSearchKeyword(e.target.value)}
                                placeholder="Tìm tên, mã NV, kho..."
                                className="w-full pl-8 pr-6 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-amber-400"
                            />
                            {searchKeyword && (
                                <button
                                    type="button"
                                    onClick={() => setSearchKeyword('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
                                    title="Xóa tìm kiếm"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>

                    {filteredAlerts.length === 0 ? (
                        <div className="p-8 text-center bg-slate-50/50">
                            <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                            <div className="text-sm font-black text-slate-800">
                                {filterRisk === 'CRITICAL'
                                    ? 'Không có nhân sự nào trong nhóm nguy cơ cao gom mã'
                                    : filterRisk === 'WARNING'
                                    ? 'Không có nhân sự nào trong nhóm cần theo dõi'
                                    : filterRisk === 'RISK'
                                    ? 'Không có nhân sự nào trong nhóm nguy cơ đầu cơ gom mã'
                                    : filterRisk === 'NORMAL'
                                    ? 'Không có nhân sự nào trong nhóm bình thường'
                                    : 'Không có nhân sự nào phù hợp với bộ lọc'}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                                {filterRisk === 'CRITICAL' || filterRisk === 'RISK'
                                    ? 'Tuyệt vời! Tất cả nhân viên đều gắn mã vào đơn hàng thực tế theo đúng ngưỡng an toàn.'
                                    : 'Các giao dịch nhận voucher đều nằm trong giới hạn an toàn.'}
                            </p>
                            {filterRisk !== 'ALL' && alerts.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setHasUserChangedFilter(true);
                                        setFilterRisk('ALL');
                                    }}
                                    className="mt-3 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                                >
                                    <Layers className="w-3.5 h-3.5" />
                                    <span>Xem tất cả ({alerts.length} nhân sự)</span>
                                </button>
                            )}
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
                                    {filteredAlerts.map((item) => {
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
                                                {/* Nhân viên theo Rule 11 */}
                                                <td className="py-2.5 px-3">
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            className="font-mono font-bold text-xs px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 inline-block text-center leading-normal shrink-0"
                                                            style={{ minWidth: `${maxIdLength + 2.2}ch`, width: `${maxIdLength + 2.2}ch` }}
                                                        >
                                                            {item.employee_id}
                                                        </span>
                                                        <div className="min-w-0">
                                                            <div
                                                                className="font-black text-slate-900 text-xs flex items-center gap-1.5 truncate"
                                                                title={`Mã NV: ${item.employee_id} - ${cleanEmployeeName(item.employee_name)}`}
                                                            >
                                                                <span>{getShortenedEmployeeName(item.employee_name)}</span>
                                                                {isCurrentlyFiltered && (
                                                                    <span className="text-[9.5px] bg-indigo-600 text-white px-1.5 py-0.2 rounded font-black shrink-0">
                                                                        Đang xem
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="text-[10px] text-slate-500 truncate" title={item.store_name}>
                                                                {item.store_name}
                                                            </div>
                                                        </div>
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
                                                        isCritical
                                                            ? 'bg-rose-100 text-rose-800 font-black'
                                                            : isWarning
                                                            ? 'bg-amber-100 text-amber-800 font-bold'
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
