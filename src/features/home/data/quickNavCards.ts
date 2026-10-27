import React from 'react';
import {
    CalendarDays,
    UserCheck,
    Trophy,
    UploadCloud,
    History,
    ShieldCheck,
    Target,
    TrendingUp,
    Zap,
    Award,
    Store,
    Users,
    Building2,
    Database,
    Ticket,
    Tag,
    BarChart3,
    HeartPulse,
    Music,
    Banknote,
    Coins
} from 'lucide-react';

export interface QuickCard {
    title: string;
    path: string;
    groupTitle: string;
    badge?: string;
    badgeColor?: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    gradient: string;
    iconBg: string;
    iconColor: string;
}

export const QUICK_NAV_CARDS: QuickCard[] = [
    // 1. BÁO CÁO KINH DOANH
    {
        title: 'Báo Cáo Cụm Siêu Thị',
        path: '/bao-cao-cum-sieu-thi',
        groupTitle: 'BÁO CÁO KINH DOANH',
        badge: '💎 11 Cột Mới',
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        description: 'Sức khỏe cụm siêu thị 11 cột: Doanh thu thực, DTQĐ, target vượt trội & trả góp',
        icon: Store,
        gradient: 'from-emerald-500/10 via-teal-500/5 to-transparent hover:border-emerald-300',
        iconBg: 'bg-emerald-100 text-emerald-700',
        iconColor: 'text-emerald-600'
    },
    {
        title: 'Báo Cáo Ngày (Realtime)',
        path: '/bc-ngay/tong-quan',
        groupTitle: 'BÁO CÁO KINH DOANH',
        badge: '⚡ Realtime',
        badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
        description: 'Doanh thu & sản lượng theo thời gian thực trong ngày, so sánh tiến độ & giờ bán',
        icon: Zap,
        gradient: 'from-amber-500/10 via-yellow-500/5 to-transparent hover:border-amber-300',
        iconBg: 'bg-amber-100 text-amber-700',
        iconColor: 'text-amber-600'
    },
    {
        title: 'Doanh Thu Nhân Viên Ngày',
        path: '/bc-ngay-nhan-vien',
        groupTitle: 'BÁO CÁO KINH DOANH',
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
        groupTitle: 'BÁO CÁO KINH DOANH',
        badge: 'Lũy Kế',
        badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        description: 'Tiến độ doanh thu lũy kế, dự kiến hoàn thành mục tiêu tháng & phân tích ngành hàng',
        icon: CalendarDays,
        gradient: 'from-blue-600/10 via-indigo-500/5 to-transparent hover:border-indigo-300',
        iconBg: 'bg-indigo-100 text-indigo-700',
        iconColor: 'text-indigo-600'
    },
    {
        title: 'Nhịp Doanh Thu',
        path: '/nhip-doanh-thu',
        groupTitle: 'BÁO CÁO KINH DOANH',
        badge: 'Biểu Đồ',
        badgeColor: 'bg-teal-100 text-teal-800 border-teal-200',
        description: 'Biểu đồ nhịp tăng trưởng doanh thu theo ngày và so sánh tiến độ các mốc thời gian',
        icon: TrendingUp,
        gradient: 'from-teal-500/10 via-emerald-500/5 to-transparent hover:border-teal-300',
        iconBg: 'bg-teal-100 text-teal-700',
        iconColor: 'text-teal-600'
    },

    // 2. SỨC KHỎE NHÂN VIÊN
    {
        title: 'Xếp Hạng DT Lũy Kế',
        path: '/xep-hang-doanh-thu-luy-ke',
        groupTitle: 'SỨC KHỎE NHÂN VIÊN',
        badge: '⭐ Mới',
        badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
        description: 'Xếp hạng doanh thu nhân viên lũy kế từ ngày A đến ngày B, số tổng lũy kế siêu thị',
        icon: Trophy,
        gradient: 'from-amber-500/10 via-indigo-500/5 to-transparent hover:border-amber-300',
        iconBg: 'bg-amber-100 text-amber-700',
        iconColor: 'text-amber-600'
    },
    {
        title: 'Hiệu Quả Nhân Viên Lũy Kế',
        path: '/bao-cao-hieu-qua-nhan-vien',
        groupTitle: 'SỨC KHỎE NHÂN VIÊN',
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
        groupTitle: 'SỨC KHỎE NHÂN VIÊN',
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
        groupTitle: 'SỨC KHỎE NHÂN VIÊN',
        badge: '⚡ Mới',
        badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
        description: 'Tiến độ các chương trình thi đua, lọc theo nhân viên & cảnh báo nguy cơ hụt target',
        icon: Target,
        gradient: 'from-rose-500/10 via-orange-500/5 to-transparent hover:border-rose-300',
        iconBg: 'bg-rose-100 text-rose-700',
        iconColor: 'text-rose-600'
    },
    {
        title: 'Tổng Hợp Thi Đua',
        path: '/tong-hop-thi-dua',
        groupTitle: 'SỨC KHỎE NHÂN VIÊN',
        badge: '🔥 Hot',
        badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
        description: 'Tổng hợp tiến độ hoàn thành các chương trình thi đua toàn hệ thống',
        icon: Award,
        gradient: 'from-rose-500/10 via-pink-500/5 to-transparent hover:border-rose-300',
        iconBg: 'bg-rose-100 text-rose-700',
        iconColor: 'text-rose-600'
    },

    // 3. DỮ LIỆU & PHIÊN LÀM VIỆC
    {
        title: 'Trạng Thái Dữ Liệu',
        path: '/trang-thai-du-lieu',
        groupTitle: 'DỮ LIỆU & PHIÊN LÀM VIỆC',
        badge: 'Live',
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        description: 'Tổng hợp tình trạng chốt phiên n-1 của dữ liệu doanh thu & thi đua',
        icon: ShieldCheck,
        gradient: 'from-emerald-500/10 via-teal-500/5 to-transparent hover:border-emerald-300',
        iconBg: 'bg-emerald-100 text-emerald-700',
        iconColor: 'text-emerald-600'
    },
    {
        title: 'Cập Nhật Số Liệu LK',
        path: '/cap-nhat',
        groupTitle: 'DỮ LIỆU & PHIÊN LÀM VIỆC',
        badge: 'Import',
        badgeColor: 'bg-sky-100 text-sky-800 border-sky-200',
        description: 'Tải lên file Excel số liệu doanh thu lũy kế siêu thị để cập nhật dữ liệu',
        icon: UploadCloud,
        gradient: 'from-sky-500/10 via-blue-500/5 to-transparent hover:border-sky-300',
        iconBg: 'bg-sky-100 text-sky-700',
        iconColor: 'text-sky-600'
    },
    {
        title: 'Cập Nhật Số Liệu NV',
        path: '/cap-nhat-luy-ke-nhan-vien',
        groupTitle: 'DỮ LIỆU & PHIÊN LÀM VIỆC',
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
        groupTitle: 'DỮ LIỆU & PHIÊN LÀM VIỆC',
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
        groupTitle: 'DỮ LIỆU & PHIÊN LÀM VIỆC',
        badge: 'Dữ Liệu',
        badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200',
        description: 'Tra cứu, lọc và dọn dẹp các bản ghi số liệu siêu thị trên hệ thống',
        icon: Database,
        gradient: 'from-cyan-500/10 via-blue-500/5 to-transparent hover:border-cyan-300',
        iconBg: 'bg-cyan-100 text-cyan-700',
        iconColor: 'text-cyan-600'
    },

    // 4. TIỆN ÍCH BÁN HÀNG
    {
        title: 'Cấp Mã Voucher',
        path: '/cap-ma-voucher',
        groupTitle: 'TIỆN ÍCH BÁN HÀNG',
        badge: '⚡ Phát Mã',
        badgeColor: 'bg-pink-100 text-pink-800 border-pink-200',
        description: 'Cấp phát mã giảm giá và voucher khuyến mãi tức thì cho khách hàng tại quầy',
        icon: Ticket,
        gradient: 'from-pink-500/10 via-rose-500/5 to-transparent hover:border-pink-300',
        iconBg: 'bg-pink-100 text-pink-700',
        iconColor: 'text-pink-600'
    },
    {
        title: 'Quản Lý Mã Giảm Giá',
        path: '/quan-ly-ma-giam-gia',
        groupTitle: 'TIỆN ÍCH BÁN HÀNG',
        badge: '🏷️ Voucher',
        badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
        description: 'Kho quản lý danh mục mã coupon, số lượng tồn và lịch sử sử dụng voucher',
        icon: Tag,
        gradient: 'from-rose-500/10 via-purple-500/5 to-transparent hover:border-rose-300',
        iconBg: 'bg-rose-100 text-rose-700',
        iconColor: 'text-rose-600'
    },
    {
        title: 'Xmusic Playlist',
        path: '/xmusic-playlist',
        groupTitle: 'TIỆN ÍCH BÁN HÀNG',
        badge: '🎵 Nhạc ST',
        badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
        description: 'Tự động hóa phát nhạc XMusicStation, tích hợp Userscript Tampermonkey và playlist',
        icon: Music,
        gradient: 'from-indigo-500/10 via-purple-500/5 to-transparent hover:border-indigo-300',
        iconBg: 'bg-indigo-100 text-indigo-700',
        iconColor: 'text-indigo-600'
    },

    // 5. HỆ THỐNG & CẤU HÌNH
    {
        title: 'Mục Tiêu & Sức Khỏe NV',
        path: '/muc-tieu-nhan-vien',
        groupTitle: 'HỆ THỐNG & CẤU HÌNH',
        badge: 'KPI',
        badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
        description: 'Quản lý chỉ tiêu khoán, theo dõi ma trận thi đua và độ phủ ngành hàng nhân sự',
        icon: Target,
        gradient: 'from-blue-500/10 via-cyan-500/5 to-transparent hover:border-blue-300',
        iconBg: 'bg-blue-100 text-blue-700',
        iconColor: 'text-blue-600'
    },
    {
        title: 'Cấu Hình Siêu Thị & NV',
        path: '/cau-hinh-sieu-thi-nhan-vien',
        groupTitle: 'HỆ THỐNG & CẤU HÌNH',
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
        groupTitle: 'HỆ THỐNG & CẤU HÌNH',
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
        groupTitle: 'HỆ THỐNG & CẤU HÌNH',
        badge: '🛡️ Admin',
        badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
        description: 'Quản trị danh sách người dùng, đặt lại mật khẩu và duyệt đăng ký tài khoản',
        icon: Users,
        gradient: 'from-slate-500/10 via-zinc-500/5 to-transparent hover:border-slate-300',
        iconBg: 'bg-slate-100 text-slate-700',
        iconColor: 'text-slate-600'
    },
    {
        title: 'Tài Khoản Trải Nghiệm',
        path: '/quan-tri-he-thong/tai-khoan-trai-nghiem',
        groupTitle: 'HỆ THỐNG & CẤU HÌNH',
        badge: '✨ Demo',
        badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
        description: 'Quản lý 1-3 tài khoản trải nghiệm quảng cáo cho khách & cấu hình hạn dùng theo ngày',
        icon: UserCheck,
        gradient: 'from-amber-500/10 via-orange-500/5 to-transparent hover:border-amber-300',
        iconBg: 'bg-amber-100 text-amber-700',
        iconColor: 'text-amber-600'
    },
    {
        title: 'Quản Trị Hệ Thống',
        path: '/quan-tri-he-thong',
        groupTitle: 'HỆ THỐNG & CẤU HÌNH',
        badge: '⚙️ Hệ Thống',
        badgeColor: 'bg-red-100 text-red-800 border-red-200',
        description: 'Quản lý trạng thái hoạt động & phân quyền các trang tiện ích toàn hệ thống',
        icon: ShieldCheck,
        gradient: 'from-red-500/10 via-rose-500/5 to-transparent hover:border-red-300',
        iconBg: 'bg-red-100 text-red-700',
        iconColor: 'text-red-600'
    },

    // 6. HỖ TRỢ CVST
    {
        title: 'Kiểm Quỹ - Kiểm Tiền',
        path: '/kiem-quy',
        groupTitle: 'HỖ TRỢ CVST',
        badge: '💵 Mới',
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        description: 'Đếm tiền ca trực, kiểm soát chênh lệch thừa thiếu, in bill nhiệt 80mm và lưu lịch sử quỹ',
        icon: Banknote,
        gradient: 'from-emerald-500/10 via-teal-500/5 to-transparent hover:border-emerald-300',
        iconBg: 'bg-emerald-100 text-emerald-700',
        iconColor: 'text-emerald-600'
    }
];

export const GROUP_CONFIGS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; colorClass: string; bgClass: string }> = {
    'BÁO CÁO KINH DOANH': {
        label: 'Báo Cáo Kinh Doanh',
        icon: BarChart3,
        colorClass: 'text-blue-700',
        bgClass: 'bg-blue-50 text-blue-700 border-blue-200'
    },
    'SỨC KHỎE NHÂN VIÊN': {
        label: 'Sức Khỏe Nhân Viên',
        icon: HeartPulse,
        colorClass: 'text-rose-700',
        bgClass: 'bg-rose-50 text-rose-700 border-rose-200'
    },
    'DỮ LIỆU & PHIÊN LÀM VIỆC': {
        label: 'Dữ Liệu & Phiên',
        icon: Database,
        colorClass: 'text-emerald-700',
        bgClass: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    },
    'TIỆN ÍCH BÁN HÀNG': {
        label: 'Tiện Ích Bán Hàng',
        icon: Ticket,
        colorClass: 'text-pink-700',
        bgClass: 'bg-pink-50 text-pink-700 border-pink-200'
    },
    'HỖ TRỢ CVST': {
        label: 'Hỗ Trợ CVST',
        icon: Coins,
        colorClass: 'text-teal-700',
        bgClass: 'bg-teal-50 text-teal-700 border-teal-200'
    },
    'HỆ THỐNG & CẤU HÌNH': {
        label: 'Hệ Thống & Cấu Hình',
        icon: ShieldCheck,
        colorClass: 'text-purple-700',
        bgClass: 'bg-purple-50 text-purple-700 border-purple-200'
    }
};
