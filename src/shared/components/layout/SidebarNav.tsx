import React from 'react';
import { NavLink } from 'react-router-dom';
import { usePermissions } from '../../contexts/PermissionContext';
import {
    Home,
    Zap,
    CalendarDays,
    TrendingUp,
    UploadCloud,
    Database,
    BookOpenCheck,
    Target,
    Store,
    UserCheck,
    ChevronLeft,
    ChevronRight,
    Trophy,
    History,
    Award,
    ShieldCheck,
    Users,
    Building2,
    BarChart3,
    HeartPulse,
    Settings
} from 'lucide-react';

export interface NavItem {
    name: string;
    path: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
}

export interface NavGroup {
    groupTitle?: string;
    icon?: React.ComponentType<{ className?: string }>;
    colorClass?: string;
    bgClass?: string;
    items: NavItem[];
}

export const NAVIGATION_GROUPS: NavGroup[] = [
    {
        // Trang chủ hiển thị độc lập ở trên cùng, không đặt trong groupTitle
        items: [
            {
                name: 'Trang Chủ',
                path: '/',
                icon: Home,
                badge: '✨ Home'
            }
        ]
    },
    {
        groupTitle: 'BÁO CÁO KINH DOANH',
        icon: BarChart3,
        colorClass: 'text-blue-700',
        bgClass: 'bg-blue-100 text-blue-700',
        items: [
            {
                name: 'BC Ngày (Realtime)',
                path: '/bc-ngay/tong-quan',
                icon: Zap,
                badge: '⚡ RT'
            },
            {
                name: 'BC Doanh Thu NV',
                path: '/bc-ngay-nhan-vien',
                icon: UserCheck,
                badge: '⚡ Mới'
            },
            {
                name: 'BC Tháng (Lũy kế)',
                path: '/bc-thang/tong-quan',
                icon: CalendarDays
            },
            {
                name: 'Nhịp Doanh Thu',
                path: '/nhip-doanh-thu',
                icon: TrendingUp
            }
        ]
    },
    {
        groupTitle: 'SỨC KHỎE NHÂN VIÊN',
        icon: HeartPulse,
        colorClass: 'text-rose-700',
        bgClass: 'bg-rose-100 text-rose-700',
        items: [
            {
                name: 'Doanh thu lũy kế',
                path: '/bao-cao-hieu-qua-nhan-vien',
                icon: Trophy,
                badge: '⭐ Mới'
            },
            {
                name: 'Tiến độ thi đua',
                path: '/tien-do-thi-dua',
                icon: Target,
                badge: '⚡ Mới'
            },
            {
                name: 'Tổng hợp thi đua',
                path: '/tong-hop-thi-dua',
                icon: Award,
                badge: '🔥 Hot'
            },
            {
                name: 'Chi tiết nhân viên',
                path: '/chi-tiet-nhan-vien',
                icon: UserCheck,
                badge: '✨ Mới'
            }
        ]
    },
    {
        groupTitle: 'DỮ LIỆU & PHIÊN LÀM VIỆC',
        icon: Database,
        colorClass: 'text-emerald-700',
        bgClass: 'bg-emerald-100 text-emerald-700',
        items: [
            {
                name: 'Cập nhật số liệu LK',
                path: '/cap-nhat',
                icon: UploadCloud
            },
            {
                name: 'Cập nhật số liệu NV',
                path: '/cap-nhat-luy-ke-nhan-vien',
                icon: UserCheck,
                badge: '⚡ Mới'
            },
            {
                name: 'Phiên dữ liệu NV',
                path: '/quan-ly-phien-nhan-vien',
                icon: History
            },
            {
                name: 'Quản lý bản ghi ST',
                path: '/quan-ly-du-lieu',
                icon: Database
            }
        ]
    },
    {
        groupTitle: 'HỆ THỐNG & CẤU HÌNH',
        icon: Settings,
        colorClass: 'text-purple-700',
        bgClass: 'bg-purple-100 text-purple-700',
        items: [
            {
                name: 'Cấu hình Siêu thị & NV',
                path: '/cau-hinh-sieu-thi-nhan-vien',
                icon: Store,
                badge: '👑 Boss'
            },
            {
                name: 'Cấu hình thi đua',
                path: '/cau-hinh-thi-dua',
                icon: BookOpenCheck
            },
            {
                name: 'Mục tiêu nhân viên',
                path: '/muc-tieu-nhan-vien',
                icon: Target
            },
            {
                name: 'Quản lý tài khoản',
                path: '/quan-ly-tai-khoan',
                icon: Users,
                badge: '🛡️ Admin'
            },
            {
                name: 'Phân quyền siêu thị',
                path: '/phan-quyen-sieu-thi',
                icon: Building2,
                badge: '🏢 Mới'
            },
            {
                name: 'Quản trị hệ thống',
                path: '/quan-tri-he-thong',
                icon: ShieldCheck,
                badge: '⚙️ Cấu hình'
            }
        ]
    }
];

interface Props {
    isCollapsed: boolean;
    onToggleCollapse: () => void;
    onItemClick: () => void;
}

export default function SidebarNav({ isCollapsed, onToggleCollapse, onItemClick }: Props) {
    const { canAccessPage } = usePermissions();

    return (
        <div className="flex flex-col h-full justify-between">
            {/* Danh sách module */}
            <div className={`p-3 space-y-4 overflow-y-auto overflow-x-hidden flex-1 ${isCollapsed ? 'px-2' : 'px-3'}`}>
                {NAVIGATION_GROUPS.map((group, gIdx) => {
                    // Lọc chỉ các item được phép truy cập theo phân quyền và trạng thái Bật
                    const visibleItems = group.items.filter(item => canAccessPage(item.path).allowed);
                    if (visibleItems.length === 0) return null;

                    const GroupIcon = group.icon;

                    return (
                        <div key={gIdx} className="space-y-1.5">
                            {/* Tiêu đề nhóm */}
                            {isCollapsed ? (
                                group.groupTitle ? (
                                    <div className="border-t border-slate-200/80 my-2 mx-1" title={group.groupTitle} />
                                ) : null
                            ) : group.groupTitle ? (
                                <div className="flex items-center gap-2 px-2.5 pt-2 pb-0.5 select-none">
                                    {GroupIcon && (
                                        <span className={`p-1 rounded-lg ${group.bgClass || 'bg-slate-100 text-slate-600'} shrink-0 shadow-2xs`}>
                                            <GroupIcon className="w-3.5 h-3.5" />
                                        </span>
                                    )}
                                    <span className={`text-[10px] font-black uppercase tracking-wider ${group.colorClass || 'text-slate-500'}`}>
                                        {group.groupTitle}
                                    </span>
                                    <span className="flex-1 h-px bg-slate-200/60 ml-0.5" />
                                </div>
                            ) : null}

                            {/* Danh sách items */}
                            <div className="space-y-1">
                                {visibleItems.map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <NavLink
                                            key={item.path}
                                            to={item.path}
                                            end={true}
                                            onClick={onItemClick}
                                            title={isCollapsed ? item.name : undefined}
                                            className={({ isActive }) => `
                                            group relative flex items-center rounded-xl text-xs font-bold transition-all
                                            ${isCollapsed
                                                    ? 'justify-center p-2.5'
                                                    : 'justify-between px-3 py-2.5'
                                                }
                                            ${isActive
                                                    ? 'bg-blue-600 text-white shadow-xs'
                                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                                                }
                                        `}
                                        >
                                            {({ isActive }) => (
                                                <>
                                                    <div className={`flex items-center gap-2.5 ${isCollapsed ? 'justify-center' : 'truncate'}`}>
                                                        <Icon className="w-4 h-4 flex-shrink-0" />
                                                        {!isCollapsed && (
                                                            <span className="truncate">{item.name}</span>
                                                        )}
                                                    </div>

                                                    {/* Badge khi Mở rộng */}
                                                    {!isCollapsed && item.badge && (
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-black ${isActive ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700'
                                                            }`}>
                                                            {item.badge}
                                                        </span>
                                                    )}

                                                    {/* Dấu chấm chỉ báo nhỏ khi Thu gọn */}
                                                    {isCollapsed && item.badge && (
                                                        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-white" />
                                                    )}

                                                    {/* Tooltip khi hover ở chế độ thu gọn */}
                                                    {isCollapsed && (
                                                        <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50">
                                                            <div className="flex items-center gap-1.5">
                                                                <span>{item.name}</span>
                                                                {item.badge && (
                                                                    <span className="text-[10px] font-bold text-amber-300">
                                                                        ({item.badge})
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </NavLink>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer Sidebar & Nút toggle thu gọn / mở rộng */}
            <div className="p-3 border-t border-slate-200 bg-slate-50/70">
                {!isCollapsed && (
                    <div className="mb-2 px-1">
                        <div className="text-[11px] text-slate-600 font-bold truncate">
                            Tiện ích báo cáo Sales Hub
                        </div>
                        <div className="text-[10px] text-slate-400">
                            Phiên bản 2026
                        </div>
                    </div>
                )}

                {/* Nút bấm thu gọn / mở rộng ở chân Sidebar */}
                <button
                    type="button"
                    onClick={onToggleCollapse}
                    className={`w-full py-2 px-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 transition flex items-center cursor-pointer ${isCollapsed ? 'justify-center' : 'justify-between'
                        }`}
                    title={isCollapsed ? 'Mở rộng Sidebar' : 'Thu gọn Sidebar'}
                    aria-label={isCollapsed ? 'Mở rộng Sidebar' : 'Thu gọn Sidebar'}
                >
                    {!isCollapsed ? (
                        <>
                            <span className="text-[11px] font-semibold text-slate-500">Thu gọn thanh điều hướng</span>
                            <ChevronLeft className="w-4 h-4 text-slate-400" />
                        </>
                    ) : (
                        <ChevronRight className="w-4 h-4 text-slate-600" />
                    )}
                </button>
            </div>
        </div>
    );
}
