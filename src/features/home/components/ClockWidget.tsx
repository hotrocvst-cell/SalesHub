import { useState, useEffect } from 'react';
import { Clock, Calendar, Sparkles, User, Store, Shield, Crown, Star } from 'lucide-react';
import { useAuth } from '../../../shared/contexts/AuthContext';
import { ROLE_LABELS } from '../../../core/lib/authService';

export default function ClockWidget() {
    const { currentUser, isAuthenticated } = useAuth();
    const [currentTime, setCurrentTime] = useState<Date>(new Date());
    const [use24Hour, setUse24Hour] = useState<boolean>(true);

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const seconds = currentTime.getSeconds();

    // Lời chào thời gian thông minh
    const getGreeting = () => {
        if (hours >= 5 && hours < 12) return { text: 'Chào buổi sáng', icon: '🌅', sub: 'Chúc bạn một ngày mới tràn đầy năng lượng & bứt phá doanh số!' };
        if (hours >= 12 && hours < 14) return { text: 'Chào buổi trưa', icon: '☀️', sub: 'Nghỉ trưa tái tạo năng lượng cho ca chiều bùng nổ nhé!' };
        if (hours >= 14 && hours < 18) return { text: 'Chào buổi chiều', icon: '🌤️', sub: 'Tăng tốc hoàn thành các chỉ tiêu trọng tâm trong ngày!' };
        if (hours >= 18 && hours < 23) return { text: 'Chào buổi tối', icon: '🌙', sub: 'Tổng kết doanh số ca tối và chốt số liệu xuất sắc!' };
        return { text: 'Đêm muộn rồi', icon: '✨', sub: 'Hãy nghỉ ngơi thật tốt để chuẩn bị cho ngày làm việc mới nhé!' };
    };

    const greeting = getGreeting();

    // Định dạng thứ ngày tháng tiếng Việt
    const DAYS_OF_WEEK = [
        'Chủ Nhật',
        'Thứ Hai',
        'Thứ Ba',
        'Thứ Tư',
        'Thứ Năm',
        'Thứ Sáu',
        'Thứ Bảy'
    ];
    const dayOfWeekStr = DAYS_OF_WEEK[currentTime.getDay()];
    const dateStr = `ngày ${String(currentTime.getDate()).padStart(2, '0')} tháng ${String(currentTime.getMonth() + 1).padStart(2, '0')} năm ${currentTime.getFullYear()}`;

    // Giờ hiển thị
    const displayHours = use24Hour ? hours : hours % 12 || 12;
    const ampm = hours >= 12 ? 'PM' : 'AM';

    // Tính tuần trong năm & ngày trong năm
    const startOfYear = new Date(currentTime.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((currentTime.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const weekOfYear = Math.ceil(dayOfYear / 7);
    const daysInYear = (currentTime.getFullYear() % 4 === 0 && currentTime.getFullYear() % 100 !== 0) || currentTime.getFullYear() % 400 === 0 ? 366 : 365;
    const yearProgress = Math.round((dayOfYear / daysInYear) * 100);

    return (
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-white/10 relative overflow-hidden flex flex-col justify-between min-h-[220px]">
            {/* Vệt sáng trang trí nền */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-72 h-72 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

            {/* Header Lời chào & Người dùng */}
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-blue-200 text-xs font-black uppercase tracking-wider border border-white/10">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>Hệ Thống Quản Trị & Bán Hàng SalesHub</span>
                    </div>

                    <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                        <span>{greeting.text}, {isAuthenticated ? currentUser.full_name : 'Bạn'}!</span>
                        <span className="text-2xl select-none">{greeting.icon}</span>
                    </h1>

                    <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
                        {greeting.sub}
                    </p>

                    {/* Huy hiệu thông tin người dùng & Siêu thị */}
                    {isAuthenticated && (
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 text-white font-bold backdrop-blur-xs border border-white/15">
                                {currentUser.role === 'ADMIN' ? (
                                    <Crown className="w-3.5 h-3.5 text-amber-400" />
                                ) : currentUser.role === 'QUAN_LY' ? (
                                    <Star className="w-3.5 h-3.5 text-blue-400" />
                                ) : currentUser.role === 'TRUONG_CA' ? (
                                    <Shield className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                    <User className="w-3.5 h-3.5 text-slate-300" />
                                )}
                                <span>{ROLE_LABELS[currentUser.role] || currentUser.role_title}</span>
                            </span>

                            {currentUser.store_name && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-500/20 text-blue-200 font-bold backdrop-blur-xs border border-blue-400/30 truncate max-w-md" title={currentUser.store_name}>
                                    <Store className="w-3.5 h-3.5 text-blue-300 shrink-0" />
                                    <span className="truncate">{currentUser.store_name}</span>
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Đồng hồ số thời gian thực */}
                <div className="relative z-10 flex flex-col items-start md:items-end justify-center shrink-0">
                    {/* Hộp số Digital Clock */}
                    <div className="bg-black/35 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/15 shadow-inner flex items-baseline gap-2">
                        <div className="flex items-center font-mono font-black text-3xl sm:text-4xl lg:text-5xl text-white tracking-wider">
                            <span>{String(displayHours).padStart(2, '0')}</span>
                            <span className="animate-pulse mx-0.5 text-blue-400">:</span>
                            <span>{String(minutes).padStart(2, '0')}</span>
                            <span className="animate-pulse mx-0.5 text-blue-400">:</span>
                            <span className="text-blue-300 text-2xl sm:text-3xl lg:text-4xl">{String(seconds).padStart(2, '0')}</span>
                        </div>

                        {!use24Hour && (
                            <span className="text-xs font-black text-amber-400 uppercase tracking-widest pl-1 font-mono">
                                {ampm}
                            </span>
                        )}

                        {/* Nút đổi 12h / 24h */}
                        <button
                            type="button"
                            onClick={() => setUse24Hour(!use24Hour)}
                            className="ml-2 px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] text-slate-300 hover:text-white font-mono cursor-pointer transition"
                            title="Chuyển đổi định dạng 12H / 24H"
                        >
                            {use24Hour ? '24H' : '12H'}
                        </button>
                    </div>

                    {/* Dòng thứ ngày tháng năm */}
                    <div className="flex items-center gap-1.5 mt-2 text-xs font-bold text-slate-300">
                        <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span className="text-amber-300 font-extrabold">{dayOfWeekStr}</span>
                        <span>•</span>
                        <span>{dateStr}</span>
                    </div>

                    {/* Tiến độ năm & Tuần */}
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
                        <span>Tuần thứ <b className="text-white font-mono">{weekOfYear}</b> / 52</span>
                        <span>•</span>
                        <span>Ngày <b className="text-white font-mono">{dayOfYear}</b> / {daysInYear}</span>
                        <span>•</span>
                        <span className="text-emerald-400 font-mono font-bold">Năm {yearProgress}%</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
