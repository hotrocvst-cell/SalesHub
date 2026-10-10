import { useState } from 'react';
import { useDataStatus } from './hooks/useDataStatus';
import DataStatusHeader from './components/DataStatusHeader';
import DataReadinessScoreCard from './components/DataReadinessScoreCard';
import DataStreamCard from './components/DataStreamCard';
import StoreStatusMatrixTable from './components/StoreStatusMatrixTable';
import { Store, Users } from 'lucide-react';
import { formatDate } from '../../core/lib/formatters';

export default function DataStatusPage() {
    const [toastMessage, setToastMessage] = useState<string>('');

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(''), 3500);
    };

    const {
        selectedMonth,
        setSelectedMonth,
        selectedYear,
        setSelectedYear,
        selectedStore,
        setSelectedStore,
        expectedDate,
        setExpectedDate,
        todayDateStr,
        loading,
        refresh,
        stores,
        streams,
        matrix,
        summary,
        isLockedToSingleStore,
        canViewAllStores,
        currentUser,
        isAdmin
    } = useDataStatus();

    // Tách các nguồn dữ liệu theo nhóm
    const storeStreams = streams.filter(s => s.category === 'store');
    const employeeStreams = streams.filter(s => s.category === 'employee' || s.category === 'config');

    return (
        <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4 space-y-4">
            {/* Toast thông báo */}
            {toastMessage && (
                <div className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-xl border border-slate-700 animate-in fade-in slide-in-from-top-2 duration-200">
                    {toastMessage}
                </div>
            )}

            {/* Header điều khiển & bộ lọc */}
            <DataStatusHeader
                stores={stores}
                selectedStore={selectedStore}
                onSelectStore={setSelectedStore}
                selectedMonth={selectedMonth}
                onSelectMonth={setSelectedMonth}
                selectedYear={selectedYear}
                onSelectYear={setSelectedYear}
                expectedDate={expectedDate}
                onChangeExpectedDate={setExpectedDate}
                todayDate={todayDateStr}
                loading={loading}
                onRefresh={refresh}
                isLockedToSingleStore={isLockedToSingleStore}
                canViewAllStores={canViewAllStores}
                isAdmin={isAdmin}
            />

            {/* Thông báo phân quyền hiển thị theo tài khoản */}
            {isLockedToSingleStore && currentUser?.store_name && (
                <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl px-3.5 py-2.5 text-xs text-amber-900 flex items-center justify-between gap-2 shadow-2xs">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold flex items-center gap-1">
                            <span>🔒</span> Phân quyền Nhân viên:
                        </span>
                        <span>Trạng thái dữ liệu được tự động khóa và lọc hiển thị riêng cho siêu thị</span>
                        <strong className="bg-white px-2 py-0.5 rounded-lg border border-amber-300 text-amber-950 font-black">
                            {currentUser.store_name}
                        </strong>
                    </div>
                </div>
            )}

            {/* Danh sách dữ liệu trạng thái & Ma trận sẵn sàng */}
            <div className="space-y-4">
                {/* 1. Thẻ KPI Tổng hợp Sẵn Sàng Toàn Hệ Thống */}
                <DataReadinessScoreCard summary={summary} />

                {/* 2. Nhóm Dữ Liệu Doanh Thu & Thi Đua Siêu Thị */}
                <div className="space-y-2.5">
                    <div className="flex items-center gap-2 px-1">
                        <Store className="w-4 h-4 text-emerald-600" />
                        <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                            Dữ Liệu Doanh Thu & Thi Đua
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {storeStreams.map(stream => (
                            <DataStreamCard key={stream.id} stream={stream} />
                        ))}
                    </div>
                </div>

                {/* 3. Nhóm Dữ Liệu Doanh Thu, Thi Đua & Chỉ Tiêu Nhân Viên */}
                <div className="space-y-2.5">
                    <div className="flex items-center gap-2 px-1">
                        <Users className="w-4 h-4 text-emerald-600" />
                        <h2 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                            Dữ Liệu Nhân Viên & Chỉ Tiêu Tháng
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {employeeStreams.map(stream => (
                            <DataStreamCard key={stream.id} stream={stream} />
                        ))}
                    </div>
                </div>

                {/* 4. Bảng Ma Trận Sẵn Sàng Từng Siêu Thị */}
                {matrix.length > 0 && (
                    <div className="space-y-2.5 pt-1">
                        <StoreStatusMatrixTable
                            matrix={matrix}
                            expectedDate={expectedDate}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
