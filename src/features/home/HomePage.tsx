import { useEffect } from 'react';
import ClockWidget from './components/ClockWidget';
import WeatherAndQuoteWidget from './components/WeatherAndQuoteWidget';
import CalendarWidget from './components/CalendarWidget';
import QuickNavigationGrid from './components/QuickNavigationGrid';

export default function HomePage() {
    useEffect(() => {
        document.title = 'Trang Chủ | Hệ Thống Bán Hàng SalesHub';
    }, []);

    return (
        <div className="space-y-6 pb-12 animate-in fade-in duration-300 max-w-7xl mx-auto">
            {/* 1. Hero Clock & Lời chào người dùng thời gian thực */}
            <ClockWidget />

            {/* 2. Thẻ Thời Tiết Thời Gian Thực (GPS Vị Trí) & Quote Động Lực Mỗi Ngày */}
            <WeatherAndQuoteWidget />

            {/* 3. Phân Hệ Tiến Độ & Đếm Ngược + Việc Cần Làm Trong Ngày & Lịch Tháng (2 cột trên PC, ưu tiên To-Do trên mobile) */}
            <CalendarWidget />

            {/* 4. Lối Tắt Nhanh Đến Các Phân Hệ Báo Cáo & Quản Trị */}
            <QuickNavigationGrid />
        </div>
    );
}
