import React, { useState, useMemo, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { usePermissions } from '../../contexts/PermissionContext';
import { getBadgeStyles, getBadgeDotColor } from '../../../core/lib/badgeConfig';
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
    ChevronDown,
    Trophy,
    History,
    Award,
    ShieldCheck,
    Users,
    Building2,
    BarChart3,
    HeartPulse,
    Settings,
    Ticket,
    Tag,
    Medal,
    Sparkles,
    Layers,
    Music
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
                name: 'BC Cụm Siêu Thị',
                path: '/bao-cao-cum-sieu-thi',
                icon: Store,
                badge: '💎 11 Cột'
            },
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
                name: 'Tổng hợp Xếp hạng',
                path: '/tong-hop-xep-hang-nhan-vien',
                icon: Medal,
                badge: '🏆 Mới'
            },
            {
                name: 'Xếp hạng DT lũy kế',
                path: '/xep-hang-doanh-thu-luy-ke',
                icon: Trophy,
                badge: '⭐ Mới'
            },
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
                name: 'Tra cứu thi đua',
                path: '/tra-cuu-thi-dua',
                icon: BookOpenCheck,
                badge: '✨ Mới'
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
                name: 'Trạng thái dữ liệu',
                path: '/trang-thai-du-lieu',
                icon: ShieldCheck,
                badge: '✨ Mới'
            },
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
        groupTitle: 'TIỆN ÍCH BÁN HÀNG',
        icon: Ticket,
        colorClass: 'text-amber-700',
        bgClass: 'bg-amber-100 text-amber-700',
        items: [
            {
                name: 'Cấp mã voucher',
                path: '/cap-ma-voucher',
                icon: Ticket,
                badge: '🎁 Hot'
            },
            {
                name: 'Quản lý kho voucher',
                path: '/quan-ly-voucher',
                icon: Tag,
                badge: '🔑 QL'
            },
            {
                name: 'Xmusic Playlist',
                path: '/xmusic-playlist',
                icon: Music,
                badge: '🎵 Mới'
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
    const location = useLocation();
    const { canAccessPage, permissions } = usePermissions();

    // Quản lý trạng thái thu gọn/mở rộng từng groupTitle do người dùng chủ động bấm
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
        try {
            const saved = localStorage.getItem('saleshub_collapsed_nav_groups');
            return saved ? JSON.parse(saved) : {};
        } catch {
            return {};
        }
    });

    // Kiểm tra xem nhóm có chứa route đang active hay không
    const isGroupActive = (items: NavItem[] = []) => {
        return items.some(item => {
            if (item.path === '/') {
                return location.pathname === '/';
            }
            return location.pathname === item.path || location.pathname.startsWith(item.path + '/');
        });
    };

    const toggleGroup = (title: string, currentlyCollapsed: boolean) => {
        setCollapsedGroups(prev => {
            const updated = {
                ...prev,
                [title]: !currentlyCollapsed
            };
            try {
                localStorage.setItem('saleshub_collapsed_nav_groups', JSON.stringify(updated));
            } catch {
                // ignore
            }
            return updated;
        });
    };

    // Xác định cấu hình badge thực tế từ permissions (hoặc fallback về item.badge)
    const resolveBadge = (item: NavItem) => {
        const pagePerm = permissions.find(p => p.path === item.path);

        if (!pagePerm) {
            return {
                enabled: Boolean(item.badge),
                text: item.badge || '',
                fullBadge: item.badge || '',
                color: 'blue'
            };
        }

        if (pagePerm.badge_enabled === false) {
            return {
                enabled: false,
                text: '',
                fullBadge: '',
                color: 'blue'
            };
        }

        const text = pagePerm.badge_text?.trim() ?? '';
        const icon = pagePerm.badge_icon?.trim() ?? '';
        const color = pagePerm.badge_color || 'blue';

        if (!text && !icon) {
            if (item.badge) {
                return {
                    enabled: true,
                    text: item.badge,
                    fullBadge: item.badge,
                    color
                };
            }
            return {
                enabled: false,
                text: '',
                fullBadge: '',
                color
            };
        }

        const fullBadge = [icon, text].filter(Boolean).join(' ');
        return {
            enabled: true,
            text,
            icon,
            fullBadge,
            color
        };
    };

    // Lọc danh sách các group và items mà user có quyền truy cập, sắp xếp theo order_index từ permissions
    const permittedGroups = useMemo(() => {
        const permMap = new Map(permissions.map(p => [p.path, p]));

        // 1. Bản đồ lưu metadata icon và badge mặc định của từng trang
        const staticItemMap = new Map<string, NavItem>();
        NAVIGATION_GROUPS.forEach(g => {
            g.items.forEach(it => {
                staticItemMap.set(it.path, it);
            });
        });

        // 2. Bản đồ lưu icon và màu sắc của từng nhóm mặc định
        const staticGroupStyleMap = new Map<string, { icon?: React.ComponentType<{ className?: string }>; colorClass?: string; bgClass?: string }>();
        NAVIGATION_GROUPS.forEach(g => {
            if (g.groupTitle) {
                staticGroupStyleMap.set(g.groupTitle, {
                    icon: g.icon,
                    colorClass: g.colorClass,
                    bgClass: g.bgClass
                });
            }
        });

        // 3. Gom tất cả các route thực tế cần hiển thị
        const allPaths = new Set<string>();
        // Ưu tiên các trang trong permissions
        permissions.forEach(p => allPaths.add(p.path));
        // Bổ sung các trang tĩnh nếu có
        NAVIGATION_GROUPS.forEach(g => g.items.forEach(it => allPaths.add(it.path)));

        // 4. Phân loại các trang theo groupTitle thực tế
        const groupItemsMap = new Map<string, NavItem[]>();
        const homeItems: NavItem[] = [];

        allPaths.forEach(path => {
            // Kiểm tra quyền truy cập
            if (!canAccessPage(path).allowed) return;

            const perm = permMap.get(path);
            const staticItem = staticItemMap.get(path);

            const name = perm?.page_name || staticItem?.name || path;
            const icon = staticItem?.icon || Sparkles;
            const badge = perm?.badge_text ? `${perm.badge_icon || ''} ${perm.badge_text}`.trim() : staticItem?.badge;

            const navItem: NavItem = {
                name,
                path,
                icon,
                badge
            };

            // Trang chủ luôn hiển thị độc lập ở trên cùng
            if (path === '/') {
                homeItems.push(navItem);
                return;
            }

            // Xác định nhóm chức năng: Ưu tiên permissions.group_title
            let targetGroup = perm?.group_title;
            if (!targetGroup) {
                // Fallback về nhóm tĩnh nếu permissions chưa có
                const staticGroup = NAVIGATION_GROUPS.find(g => g.items.some(it => it.path === path));
                targetGroup = staticGroup?.groupTitle || 'HỆ THỐNG & CẤU HÌNH';
            }

            const currentList = groupItemsMap.get(targetGroup) || [];
            currentList.push(navItem);
            groupItemsMap.set(targetGroup, currentList);
        });

        const resultGroups: (NavGroup & { visibleItems: NavItem[]; minGroupOrder: number })[] = [];

        // Thêm nhóm Trang Chủ (nếu được phép)
        if (homeItems.length > 0) {
            resultGroups.push({
                items: homeItems,
                visibleItems: homeItems,
                minGroupOrder: 0
            });
        }

        // Tạo các nhóm chức năng và sắp xếp các mục bên trong theo order_index
        groupItemsMap.forEach((items, gTitle) => {
            const sortedItems = [...items].sort((a, b) => {
                const orderA = permMap.get(a.path)?.order_index ?? 999;
                const orderB = permMap.get(b.path)?.order_index ?? 999;
                return orderA - orderB;
            });

            const minGroupOrder = sortedItems.reduce((min, it) => {
                const o = permMap.get(it.path)?.order_index ?? 999;
                return Math.min(min, o);
            }, 999);

            const style = staticGroupStyleMap.get(gTitle) || {
                icon: Layers,
                colorClass: 'text-indigo-700',
                bgClass: 'bg-indigo-100 text-indigo-700'
            };

            resultGroups.push({
                groupTitle: gTitle,
                icon: style.icon || Layers,
                colorClass: style.colorClass || 'text-indigo-700',
                bgClass: style.bgClass || 'bg-indigo-100 text-indigo-700',
                items: sortedItems,
                visibleItems: sortedItems,
                minGroupOrder
            });
        });

        // Sắp xếp thứ tự các nhóm: Trang Chủ đứng đầu, các nhóm khác theo minGroupOrder
        return resultGroups.sort((a, b) => {
            if (!a.groupTitle) return -1;
            if (!b.groupTitle) return 1;
            return a.minGroupOrder - b.minGroupOrder;
        });
    }, [canAccessPage, permissions]);

    // Đếm số lượng group có groupTitle mà user có quyền truy cập
    const permittedGroupTitlesCount = useMemo(() => {
        return permittedGroups.filter(g => Boolean(g.groupTitle)).length;
    }, [permittedGroups]);

    // Bật tính năng thu gọn/mở rộng khi user được phân quyền sử dụng từ 2 grouptitle trở lên
    const isCollapsible = permittedGroupTitlesCount >= 2;

    // Tự động mở rộng nhóm chứa trang đang truy cập khi chuyển route
    useEffect(() => {
        const activeGroup = permittedGroups.find(g => g.groupTitle && isGroupActive(g.visibleItems));
        if (activeGroup && activeGroup.groupTitle) {
            const title = activeGroup.groupTitle;
            if (collapsedGroups[title] === true) {
                setCollapsedGroups(prev => {
                    const updated = {
                        ...prev,
                        [title]: false
                    };
                    try {
                        localStorage.setItem('saleshub_collapsed_nav_groups', JSON.stringify(updated));
                    } catch {
                        // ignore
                    }
                    return updated;
                });
            }
        }
    }, [location.pathname, permittedGroups]);

    // Xác định xem một nhóm có đang bị thu gọn hay không
    // MẶC ĐỊNH: Thu gọn tất cả các nhóm, CHỈ mở nhóm đang chứa trang hiện tại
    const checkIsGroupCollapsed = (title?: string, items: NavItem[] = []) => {
        if (!title || !isCollapsible) return false;

        // Nếu người dùng đã từng bấm toggle nhóm này cụ thể thì tôn trọng lựa chọn đã lưu
        if (collapsedGroups[title] !== undefined) {
            return collapsedGroups[title];
        }

        // Mặc định: Thu gọn nếu không phải nhóm chứa trang đang truy cập
        return !isGroupActive(items);
    };

    return (
        <div className="flex flex-col h-full justify-between">
            {/* Danh sách module */}
            <div className={`p-3 space-y-4 overflow-y-auto overflow-x-hidden flex-1 ${isCollapsed ? 'px-2' : 'px-3'}`}>
                {permittedGroups.map((group, gIdx) => {
                    const visibleItems = group.visibleItems;
                    const GroupIcon = group.icon;
                    const isGroupCollapsed = checkIsGroupCollapsed(group.groupTitle, visibleItems);

                    return (
                        <div key={group.groupTitle || gIdx} className="space-y-1.5">
                            {/* Tiêu đề nhóm */}
                            {isCollapsed ? (
                                group.groupTitle ? (
                                    <div className="border-t border-slate-200/80 my-2 mx-1" title={group.groupTitle} />
                                ) : null
                            ) : group.groupTitle ? (
                                isCollapsible ? (
                                    <button
                                        type="button"
                                        onClick={() => group.groupTitle && toggleGroup(group.groupTitle, isGroupCollapsed)}
                                        className="w-full flex items-center justify-between gap-1.5 px-2 py-1.5 rounded-lg hover:bg-slate-100 active:bg-slate-200/70 transition-colors select-none text-left cursor-pointer group/title"
                                        title={`${isGroupCollapsed ? 'Mở rộng' : 'Thu gọn'} nhóm ${group.groupTitle}`}
                                        aria-expanded={!isGroupCollapsed}
                                    >
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            {GroupIcon && (
                                                <span className={`p-1 rounded-lg ${group.bgClass || 'bg-slate-100 text-slate-600'} shrink-0 shadow-2xs`}>
                                                    <GroupIcon className="w-3.5 h-3.5" />
                                                </span>
                                            )}
                                            <span className={`text-[10px] font-black uppercase tracking-wider truncate ${group.colorClass || 'text-slate-500'}`}>
                                                {group.groupTitle}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0 ml-1">
                                            {isGroupCollapsed && (
                                                <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200/70">
                                                    {visibleItems.length}
                                                </span>
                                            )}
                                            <ChevronDown
                                                className={`w-3.5 h-3.5 text-slate-400 group-hover/title:text-slate-600 transition-transform duration-200 ${
                                                    isGroupCollapsed ? '-rotate-90' : 'rotate-0'
                                                }`}
                                            />
                                        </div>
                                    </button>
                                ) : (
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
                                )
                            ) : null}

                            {/* Danh sách items */}
                            {(!isGroupCollapsed || isCollapsed) && (
                                <div className="space-y-1">
                                    {visibleItems.map((item) => {
                                        const Icon = item.icon;
                                        const badgeInfo = resolveBadge(item);

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
                                                    {!isCollapsed && badgeInfo.enabled && badgeInfo.fullBadge && (
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-black tracking-tight shrink-0 shadow-2xs ${
                                                            getBadgeStyles(badgeInfo.color, isActive)
                                                        }`}>
                                                            {badgeInfo.fullBadge}
                                                        </span>
                                                    )}

                                                    {/* Dấu chấm chỉ báo nhỏ khi Thu gọn */}
                                                    {isCollapsed && badgeInfo.enabled && badgeInfo.fullBadge && (
                                                        <span className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ring-2 ring-white ${
                                                            getBadgeDotColor(badgeInfo.color)
                                                        }`} />
                                                    )}

                                                    {/* Tooltip khi hover ở chế độ thu gọn */}
                                                    {isCollapsed && (
                                                        <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50">
                                                            <div className="flex items-center gap-1.5">
                                                                <span>{item.name}</span>
                                                                {badgeInfo.enabled && badgeInfo.fullBadge && (
                                                                    <span className="text-[10px] font-bold text-amber-300">
                                                                        ({badgeInfo.fullBadge})
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
                        )}
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
