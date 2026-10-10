import {
    Activity,
    RefreshCw,
    Store,
    Calendar,
    CheckCircle2,
    Clock,
    Lock
} from 'lucide-react';
import type { StoreItem } from '../../../core/lib/storage';
import { getShortStoreName, formatDate } from '../../../core/lib/formatters';

interface DataStatusHeaderProps {
    stores: StoreItem[];
    selectedStore: string;
    onSelectStore: (store: string) => void;
    selectedMonth: number;
    onSelectMonth: (month: number) => void;
    selectedYear: number;
    onSelectYear: (year: number) => void;
    expectedDate: string;
    onChangeExpectedDate: (date: string) => void;
    todayDate: string;
    loading: boolean;
    onRefresh: () => void;
    isLockedToSingleStore?: boolean;
    canViewAllStores?: boolean;
    isAdmin?: boolean;
}

export default function DataStatusHeader({
    stores,
    selectedStore,
    onSelectStore,
    selectedMonth,
    onSelectMonth,
    selectedYear,
    onSelectYear,
    expectedDate,
    onChangeExpectedDate,
    todayDate,
    loading,
    onRefresh,
    isLockedToSingleStore = false,
    canViewAllStores = true,
    isAdmin = false
}: DataStatusHeaderProps) {
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const years = [2024, 2025, 2026, 2027];

    return (
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs space-y-3.5">
            {/* Hàng 1: Tiêu đề trang & Nút làm mới */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/25 shrink-0">
                        <Activity className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-lg sm:text-2xl font-black text-slate-900 uppercase tracking-tight">
                                Trạng Thái Dữ Liệu
                            </h1>
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 uppercase tracking-wider shadow-2xs">
                                Live
                            </span>
                        </div>
                        <p className="text-xs text-slate-600 font-medium mt-0.5">
                            Giám sát tiến độ cập nhật dữ liệu doanh thu & thi đua
                        </p>
                    </div>
                </div>

                {/* Nút làm mới */}
                <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                        onClick={onRefresh}
                        disabled={loading}
                        className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
                        title="Tải lại số liệu mới nhất"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-600' : 'text-slate-500'}`} />
                        <span>Làm mới dữ liệu</span>
                    </button>
                </div>
            </div>

            {/* Phân cách nhẹ nhàng */}
            <div className="h-px bg-slate-100" />

            {/* Hàng 2: Bộ lọc Tháng/Năm, Siêu thị & Ngày kiểm tra */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-0.5">
                {/* Bộ lọc Siêu thị */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border transition-all ${
                        isLockedToSingleStore
                            ? 'bg-amber-50/90 border-amber-200 text-amber-900 shadow-2xs'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}>
                        {isLockedToSingleStore ? (
                            <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        ) : (
                            <Store className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        )}
                        <span className="text-xs font-medium text-slate-600">Siêu thị:</span>
                        <select
                            value={selectedStore}
                            onChange={e => onSelectStore(e.target.value)}
                            disabled={isLockedToSingleStore}
                            title={isLockedToSingleStore ? 'Tài khoản nhân viên được cố định theo siêu thị đã đăng ký' : undefined}
                            className={`bg-transparent text-xs font-bold focus:outline-none ${
                                isLockedToSingleStore
                                    ? 'cursor-not-allowed text-amber-950 font-black'
                                    : 'cursor-pointer text-slate-900'
                            }`}
                        >
                            {canViewAllStores && (
                                <option value="all">
                                    {isAdmin
                                        ? `🏢 Toàn Cụm (${stores.length} ST)`
                                        : `🏢 Cụm Phụ Trách (${stores.length} ST)`
                                    }
                                </option>
                            )}
                            {stores.map(s => (
                                <option key={s.id || s.code} value={s.name}>
                                    {getShortStoreName(s.name)}
                                </option>
                            ))}
                        </select>
                        {isLockedToSingleStore && (
                            <span className="text-[10px] bg-amber-200/80 text-amber-900 px-1.5 py-0.2 rounded font-extrabold uppercase tracking-wider hidden sm:inline">
                                Khóa
                            </span>
                        )}
                    </div>

                    {/* Bộ lọc Tháng & Năm */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
                        <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="text-xs font-medium text-slate-600">Tháng:</span>
                        <select
                            value={selectedMonth}
                            onChange={e => onSelectMonth(Number(e.target.value))}
                            className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
                        >
                            {months.map(m => (
                                <option key={m} value={m}>
                                    T{m}
                                </option>
                            ))}
                        </select>

                        <span className="text-slate-300">/</span>

                        <select
                            value={selectedYear}
                            onChange={e => onSelectYear(Number(e.target.value))}
                            className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none cursor-pointer"
                        >
                            {years.map(y => (
                                <option key={y} value={y}>
                                    {y}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Khung chỉ định phiên n-1 & ngày n */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="text-[11px] text-slate-500 font-medium">
                        Hôm nay: <strong className="text-slate-800 font-bold">{formatDate(todayDate)} (n)</strong>
                    </span>

                    <span className="text-slate-300">➔</span>

                    <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl">
                        <span className="text-[11px] text-emerald-800 font-bold">
                            Phiên chuẩn (n-1):
                        </span>
                        <input
                            type="date"
                            value={expectedDate}
                            onChange={e => onChangeExpectedDate(e.target.value)}
                            className="bg-transparent text-emerald-900 font-extrabold text-xs focus:outline-none cursor-pointer"
                            title="Có thể đổi ngày nếu muốn kiểm tra lịch sử các ngày trước"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
