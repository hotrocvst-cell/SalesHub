import { Link } from 'react-router-dom';
import {
    CalendarDays,
    UserCheck,
    Trophy,
    UploadCloud,
    History,
    ShieldCheck,
    Target,
    TrendingUp,
    ArrowRight,
    Sparkles
} from 'lucide-react';
import { useAuth } from '../../../shared/contexts/AuthContext';
import { usePermissions } from '../../../shared/contexts/PermissionContext';

interface QuickCard {
    title: string;
    path: string;
    badge?: string;
    badgeColor?: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    gradient: string;
    iconBg: string;
    iconColor: string;
    minRole?: 'ADMIN' | 'QUAN_LY' | 'TRUONG_CA' | 'ALL';
}

export default function QuickNavigationGrid() {
    const { currentUser, isActualAdmin } = useAuth();
    const { canAccessPage } = usePermissions();

    const CARDS: QuickCard[] = [
        {
            title: 'Báo Cáo Tháng (Lũy Kế)',
            path: '/bc-thang/tong-quan',
            badge: 'Lũy Kế',
            badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
            description: 'Tiến độ doanh thu lũy kế, dự kiến hoàn thành mục tiêu tháng & phân tích ngành hàng',
            icon: CalendarDays,
            gradient: 'from-blue-600/10 via-indigo-500/5 to-transparent hover:border-indigo-300',
            iconBg: 'bg-indigo-100 text-indigo-700',
            iconColor: 'text-indigo-600'
        },
        {
            title: 'Doanh Thu Nhân Viên Ngày',
            path: '/bc-ngay-nhan-vien',
            badge: '⚡ Mới',
            badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
            description: 'Theo dõi xếp hạng doanh số nhân viên trong ngày, Top 30% và cảnh báo tăng tốc',
            icon: UserCheck,
            gradient: 'from-amber-500/10 via-orange-500/5 to-transparent hover:border-amber-300',
            iconBg: 'bg-amber-100 text-amber-700',
            iconColor: 'text-amber-600'
        },
        {
            title: 'Hiệu Quả Nhân Viên Lũy Kế',
            path: '/bao-cao-hieu-qua-nhan-vien',
            badge: '⭐ Thi Đua',
            badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
            description: 'Đánh giá năng suất, thi đua nhân viên, tỷ lệ trả chậm và xuất file báo cáo 4K',
            icon: Trophy,
            gradient: 'from-purple-500/10 via-pink-500/5 to-transparent hover:border-purple-300',
            iconBg: 'bg-purple-100 text-purple-700',
            iconColor: 'text-purple-600'
        },
        {
            title: 'Cập Nhật Số Liệu LK',
            path: '/cap-nhat',
            badge: 'Import',
            badgeColor: 'bg-sky-100 text-sky-800 border-sky-200',
            description: 'Tải lên file Excel số liệu doanh thu lũy kế siêu thị để cập nhật dữ liệu toàn hệ thống',
            icon: UploadCloud,
            gradient: 'from-sky-500/10 via-blue-500/5 to-transparent hover:border-sky-300',
            iconBg: 'bg-sky-100 text-sky-700',
            iconColor: 'text-sky-600'
        },
        {
            title: 'Cập Nhật Số Liệu NV',
            path: '/cap-nhat-luy-ke-nhan-vien',
            badge: 'Theo Ca',
            badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
            description: 'Nhập số liệu lũy kế và doanh số của từng nhân sự kinh doanh theo từng ca làm việc',
            icon: History,
            gradient: 'from-emerald-500/10 via-teal-500/5 to-transparent hover:border-emerald-300',
            iconBg: 'bg-emerald-100 text-emerald-700',
            iconColor: 'text-emerald-600'
        },
        {
            title: 'Phân Quyền Siêu Thị',
            path: '/phan-quyen-sieu-thi',
            badge: '🔑 Quản Trị',
            badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
            description: 'Cấu hình danh sách siêu thị được phép xem của Quản lý / Trưởng ca phụ trách đa shop',
            icon: ShieldCheck,
            gradient: 'from-rose-500/10 via-red-500/5 to-transparent hover:border-rose-300',
            iconBg: 'bg-rose-100 text-rose-700',
            iconColor: 'text-rose-600',
            minRole: 'QUAN_LY'
        },
        {
            title: 'Mục Tiêu & Sức Khỏe NV',
            path: '/muc-tieu-nhan-vien',
            badge: 'KPI',
            badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
            description: 'Quản lý chỉ tiêu khoán, theo dõi ma trận thi đua và độ phủ ngành hàng của nhân sự',
            icon: Target,
            gradient: 'from-blue-500/10 via-cyan-500/5 to-transparent hover:border-blue-300',
            iconBg: 'bg-blue-100 text-blue-700',
            iconColor: 'text-blue-600'
        },
        {
            title: 'Nhịp Doanh Thu',
            path: '/nhip-doanh-thu',
            badge: 'Biểu Đồ',
            badgeColor: 'bg-teal-100 text-teal-800 border-teal-200',
            description: 'Biểu đồ nhịp tăng trưởng doanh thu theo ngày và so sánh tiến độ các mốc thời gian',
            icon: TrendingUp,
            gradient: 'from-teal-500/10 via-emerald-500/5 to-transparent hover:border-teal-300',
            iconBg: 'bg-teal-100 text-teal-700',
            iconColor: 'text-teal-600'
        }
    ];

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                        Lối Tắt Phân Hệ Nhanh
                    </h2>
                </div>
                <span className="text-xs text-slate-400 font-semibold">
                    Truy cập nhanh vào các màn hình làm việc
                </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {CARDS.map((card) => {
                    const IconComponent = card.icon;
                    const access = canAccessPage(card.path);
                    const isVisible = !card.minRole || isActualAdmin || currentUser.role === 'ADMIN' || currentUser.role === 'QUAN_LY';

                    if (!isVisible) return null;

                    return (
                        <Link
                            key={card.path}
                            to={card.path}
                            className={`group relative p-4 sm:p-5 rounded-3xl bg-white border border-slate-200 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden bg-gradient-to-br ${card.gradient}`}
                        >
                            <div>
                                <div className="flex items-start justify-between gap-2 mb-3">
                                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black shrink-0 transition group-hover:scale-105 ${card.iconBg}`}>
                                        <IconComponent className="w-5 h-5" />
                                    </div>

                                    {card.badge && (
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${card.badgeColor}`}>
                                            {card.badge}
                                        </span>
                                    )}
                                </div>

                                <h3 className="font-extrabold text-slate-900 text-sm group-hover:text-blue-600 transition leading-snug">
                                    {card.title}
                                </h3>

                                <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                                    {card.description}
                                </p>
                            </div>

                            <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-400 group-hover:text-blue-600 transition">
                                <span>Truy cập</span>
                                <ArrowRight className="w-3.5 h-3.5 transition group-hover:translate-x-1" />
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
