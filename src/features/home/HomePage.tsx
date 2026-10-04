import { useEffect } from 'react';
import ClockWidget from './components/ClockWidget';
import WeatherWidget from './components/WeatherWidget';
import CalendarWidget from './components/CalendarWidget';
import MonthProgressWidget from './components/MonthProgressWidget';
import QuickNavigationGrid from './components/QuickNavigationGrid';

export default function HomePage() {
    useEffect(() => {
        document.title = 'Trang Chủ | Hệ Thống Bán Hàng SalesHub';
    }, []);

    return (
        <div className="space-y-6 pb-12 animate-in fade-in duration-300 max-w-7xl mx-auto">
            {/* 1. Hero Clock & Lời chào người dùng thời gian thực */}
            <ClockWidget />

            {/* 2. Hàng Thời Tiết & Đếm Ngược Tiến Độ Tháng */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-4 flex flex-col">
                    <WeatherWidget />
                </div>
                <div className="lg:col-span-8 flex flex-col justify-between">
                    <MonthProgressWidget />
                </div>
            </div>

            {/* 3. Lịch Tháng Toàn Diện (Tất Cả Các Ngày Trong Tháng, Chuyển Tháng, Âm Lịch & Ghi Chú) */}
            <CalendarWidget />

            {/* 4. Lối Tắt Nhanh Đến Các Phân Hệ Báo Cáo & Quản Trị */}
            <QuickNavigationGrid />
        </div>
    );
}
