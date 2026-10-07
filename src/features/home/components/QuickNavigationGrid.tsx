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
    Sparkles,
    Zap,
    Award,
    Store,
    Users,
    Building2,
    Database
} from 'lucide-react';
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
}

export default function QuickNavigationGrid() {
    const { canAccessPage } = usePermissions();

    const CARDS: QuickCard[] = [
        {
            title: 'Báo Cáo Ngày (Realtime)',
            path: '/bc-ngay/tong-quan',
            badge: '⚡ Realtime',
            badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
            description: 'Báo cáo doanh thu & sản lượng theo thời gian thực trong ngày, so sánh tiến độ & giờ bán',
            icon: Zap,
            gradient: 'from-amber-500/10 via-yellow-500/5 to-transparent hover:border-amber-300',
            iconBg: 'bg-amber-100 text-amber-700',
            iconColor: 'text-amber-600'
        },
        {
            title: 'Doanh Thu Nhân Viên Ngày',
            path: '/bc-ngay-nhan-vien',
            badge: '⚡ Mới',
            badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
            description: 'Theo dõi xếp hạng doanh số nhân viên trong ngày, Top 30% và cảnh báo tăng tốc',
            icon: UserCheck,
            gradient: 'from-blue-500/10 via-cyan-500/5 to-transparent hover:border-blue-300',
            iconBg: 'bg-blue-100 text-blue-700',
            iconColor: 'text-blue-600'
        },
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
            title: 'Chi Tiết Nhân Viên',
            path: '/chi-tiet-nhan-vien',
            badge: '✨ Chi Tiết',
            badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
            description: 'Báo cáo chi tiết luỹ kế doanh thu, tiến độ thi đua & ngành hàng từng nhân sự',
            icon: UserCheck,
            gradient: 'from-emerald-500/10 via-teal-500/5 to-transparent hover:border-emerald-300',
            iconBg: 'bg-emerald-100 text-emerald-700',
            iconColor: 'text-emerald-600'
        },
        {
            title: 'Tiến Độ Thi Đua',
            path: '/tien-do-thi-dua',
            badge: '⚡ Mới',
            badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
            description: 'Báo cáo tiến độ các chương trình thi đua, lọc theo nhân viên & cảnh báo nguy cơ hụt target',
            icon: Target,
            gradient: 'from-rose-500/10 via-orange-500/5 to-transparent hover:border-rose-300',
            iconBg: 'bg-rose-100 text-rose-700',
            iconColor: 'text-rose-600'
        },
        {
            title: 'Tổng Hợp Thi Đua',
            path: '/tong-hop-thi-dua',
            badge: '🔥 Hot',
            badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
            description: 'Tổng hợp tiến độ hoàn thành các chương trình thi đua toàn hệ thống',
            icon: Award,
            gradient: 'from-rose-500/10 via-pink-500/5 to-transparent hover:border-rose-300',
            iconBg: 'bg-rose-100 text-rose-700',
            iconColor: 'text-rose-600'
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
        },
        {
            title: 'Trạng Thái Dữ Liệu',
            path: '/trang-thai-du-lieu',
            badge: 'Live',
            badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
            description: 'Tổng hợp và kiểm soát tình trạng chốt phiên n-1 của dữ liệu doanh thu, thi đua siêu thị và nhân viên',
            icon: ShieldCheck,
            gradient: 'from-emerald-500/10 via-teal-500/5 to-transparent hover:border-emerald-300',
            iconBg: 'bg-emerald-100 text-emerald-700',
            iconColor: 'text-emerald-600'
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
            title: 'Phiên Dữ Liệu NV',
            path: '/quan-ly-phien-nhan-vien',
            badge: 'Phiên NV',
            badgeColor: 'bg-violet-100 text-violet-800 border-violet-200',
            description: 'Lịch sử và danh sách các phiên cập nhật dữ liệu nhân sự kinh doanh theo ngày',
            icon: History,
            gradient: 'from-violet-500/10 via-purple-500/5 to-transparent hover:border-violet-300',
            iconBg: 'bg-violet-100 text-violet-700',
            iconColor: 'text-violet-600'
        },
        {
            title: 'Quản Lý Bản Ghi ST',
            path: '/quan-ly-du-lieu',
            badge: 'Dữ Liệu',
            badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200',
            description: 'Tra cứu, tìm kiếm lọc và dọn dẹp các bản ghi số liệu siêu thị trên hệ thống',
            icon: Database,
            gradient: 'from-cyan-500/10 via-blue-500/5 to-transparent hover:border-cyan-300',
            iconBg: 'bg-cyan-100 text-cyan-700',
            iconColor: 'text-cyan-600'
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
            title: 'Cấu Hình Siêu Thị & NV',
            path: '/cau-hinh-sieu-thi-nhan-vien',
            badge: '👑 Boss',
            badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
            description: 'Khai báo danh mục siêu thị, nhân sự và phân ca làm việc của đội ngũ bán hàng',
            icon: Store,
            gradient: 'from-amber-500/10 via-orange-500/5 to-transparent hover:border-amber-300',
            iconBg: 'bg-amber-100 text-amber-700',
            iconColor: 'text-amber-600'
        },
        {
            title: 'Phân Quyền Siêu Thị',
            path: '/phan-quyen-sieu-thi',
            badge: '🔑 Phân Quyền',
            badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
            description: 'Cấu hình danh sách siêu thị được phép xem của Quản lý / Trưởng ca phụ trách đa shop',
            icon: Building2,
            gradient: 'from-rose-500/10 via-red-500/5 to-transparent hover:border-rose-300',
            iconBg: 'bg-rose-100 text-rose-700',
            iconColor: 'text-rose-600'
        },
        {
            title: 'Quản Lý Tài Khoản',
            path: '/quan-ly-tai-khoan',
            badge: '🛡️ Admin',
            badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
            description: 'Quản trị danh sách người dùng, đặt lại mật khẩu và duyệt đăng ký tài khoản',
            icon: Users,
            gradient: 'from-slate-500/10 via-zinc-500/5 to-transparent hover:border-slate-300',
            iconBg: 'bg-slate-100 text-slate-700',
            iconColor: 'text-slate-600'
        },
        {
            title: 'Quản Trị Hệ Thống',
            path: '/quan-tri-he-thong',
            badge: '⚙️ Hệ Thống',
            badgeColor: 'bg-red-100 text-red-800 border-red-200',
            description: 'Quản lý trạng thái hoạt động & phân quyền các trang tiện ích toàn hệ thống',
            icon: ShieldCheck,
            gradient: 'from-red-500/10 via-rose-500/5 to-transparent hover:border-red-300',
            iconBg: 'bg-red-100 text-red-700',
            iconColor: 'text-red-600'
        }
    ];

    // Lọc chỉ hiển thị các trang mà người dùng hiện tại được phép truy cập theo phân quyền
    const visibleCards = CARDS.filter(card => canAccessPage(card.path).allowed);

    if (visibleCards.length === 0) {
        return null;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                        Lối Tắt Phân Hệ Nhanh
                    </h2>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
                        {visibleCards.length} lối tắt khả dụng
                    </span>
                </div>
                <span className="text-xs text-slate-400 font-semibold hidden sm:inline">
                    Truy cập nhanh vào các màn hình làm việc được phân quyền
                </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {visibleCards.map((card) => {
                    const IconComponent = card.icon;

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
