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
    Music,
    MessageSquareText,
    Boxes,
    Banknote,
    Coins
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
            },
            {
                name: 'Hỗ Trợ & Góp Ý',
                path: '/ho-tro-gop-y',
                icon: MessageSquareText,
                badge: '💬 Mới'
            },
            {
                name: 'Cân tồn kho',
                path: '/can-ton-kho',
                icon: Boxes,
                badge: '📦 Mới'
            }
        ]
    },
    {
        groupTitle: 'HỖ TRỢ CVST',
        icon: Coins,
        colorClass: 'text-emerald-700',
        bgClass: 'bg-emerald-100 text-emerald-700',
        items: [
            {
                name: 'Kiểm quỹ - Kiểm tiền',
                path: '/kiem-quy',
                icon: Banknote,
                badge: '💵 Mới'
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
                name: 'Tài khoản trải nghiệm',
                path: '/quan-tri-he-thong/tai-khoan-trai-nghiem',
                icon: UserCheck,
                badge: '✨ Demo'
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

    // Kiểm tra xem nhóm có chứa route đang active hay không
    const isGroupActive = (items: NavItem[] = []) => {
        return items.some(item => {
            if (item.path === '/') {
                return location.pathname === '/';
            }
            return location.pathname === item.path || location.pathname.startsWith(item.path + '/');
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
            // Loại bỏ hoàn toàn các trang đã cũ, chuyển hướng hoặc không hiển thị trên sidebar
            if (path === '/bc-realtime-con-lai') return;

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

    // Trạng thái nhóm mở rộng khi có từ 3 grouptitle trở lên (mặc định thu gọn, chỉ mở nhóm chứa trang active)
    const [expandedGroupInMultiMode, setExpandedGroupInMultiMode] = useState<string | null>(() => {
        for (const g of NAVIGATION_GROUPS) {
            if (g.groupTitle && g.items.some(item => location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path + '/')))) {
                return g.groupTitle;
            }
        }
        return null;
    });

    // Trạng thái thu gọn thủ công khi có ít hơn 3 grouptitle (mặc định mở rộng hết, user có thể bấm thu gọn thủ công nếu muốn)
    const [collapsedInSmallMode, setCollapsedInSmallMode] = useState<Record<string, boolean>>({});

    // Tự động mở rộng nhóm chứa trang đang truy cập khi chuyển route (khi có từ 3 grouptitle trở lên)
    useEffect(() => {
        if (permittedGroupTitlesCount >= 3) {
            const activeGroup = permittedGroups.find(g => g.groupTitle && isGroupActive(g.visibleItems));
            setExpandedGroupInMultiMode(activeGroup?.groupTitle || null);
        }
    }, [location.pathname, permittedGroups, permittedGroupTitlesCount]);

    // Xử lý đóng/mở nhóm khi người dùng bấm vào tiêu đề nhóm (grouptitle)
    const toggleGroup = (title: string) => {
        if (permittedGroupTitlesCount >= 3) {
            // Khi từ 3 grouptitle: Bấm nhóm đang mở -> thu gọn; bấm nhóm khác -> mở nhóm đó và thu gọn các nhóm còn lại
            setExpandedGroupInMultiMode(prev => (prev === title ? null : title));
        } else {
            // Khi dưới 3 grouptitle: Mặc định mở rộng hết, bấm để chuyển đổi trạng thái riêng của nhóm
            setCollapsedInSmallMode(prev => ({
                ...prev,
                [title]: !prev[title]
            }));
        }
    };

    // Kiểm tra xem nhóm có đang bị thu gọn hay không
    const checkIsGroupCollapsed = (title?: string) => {
        if (!title) return false;
        if (permittedGroupTitlesCount < 3) {
            // Dưới 3 grouptitle: Mặc định mở rộng hết (không thu gọn)
            return Boolean(collapsedInSmallMode[title]);
        } else {
            // Từ 3 grouptitle trở lên: Mặc định thu gọn, chỉ mở nhóm được chọn / nhóm active
            return expandedGroupInMultiMode !== title;
        }
    };

    // Xử lý khi user chọn trang chức năng: gọi onItemClick và cuộn hiển thị về đầu trang
    const handleItemClick = () => {
        onItemClick();
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        const mainEl = document.querySelector('main');
        if (mainEl) {
            mainEl.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        }
    };

    return (
        <div className="flex flex-col h-full justify-between">
            {/* Danh sách module */}
            <div className={`p-3 space-y-3 overflow-y-auto overflow-x-hidden flex-1 ${isCollapsed ? 'px-2' : 'px-3'}`}>
                {permittedGroups.map((group, gIdx) => {
                    const visibleItems = group.visibleItems;
                    const GroupIcon = group.icon;
                    const isGroupCollapsed = checkIsGroupCollapsed(group.groupTitle);
                    const hasActiveChild = isGroupActive(visibleItems);

                    return (
                        <div key={group.groupTitle || gIdx} className="space-y-1">
                            {/* Tiêu đề nhóm */}
                            {isCollapsed ? (
                                group.groupTitle ? (
                                    <div className="border-t border-slate-200/80 my-2 mx-1" title={group.groupTitle} />
                                ) : null
                            ) : group.groupTitle ? (
                                <button
                                    type="button"
                                    onClick={() => group.groupTitle && toggleGroup(group.groupTitle)}
                                    className={`w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg transition-all select-none text-left cursor-pointer group/title ${
                                        !isGroupCollapsed
                                            ? 'bg-slate-100/90 text-slate-800 font-extrabold shadow-2xs'
                                            : 'hover:bg-slate-100/70 text-slate-600'
                                    }`}
                                    title={`${isGroupCollapsed ? 'Mở rộng' : 'Thu gọn'} nhóm ${group.groupTitle}`}
                                    aria-expanded={!isGroupCollapsed}
                                >
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        {GroupIcon && (
                                            <span className={`p-1 rounded-md ${group.bgClass || 'bg-slate-100 text-slate-600'} shrink-0 shadow-2xs ${
                                                !isGroupCollapsed ? 'ring-1 ring-slate-300/70' : ''
                                            }`}>
                                                <GroupIcon className="w-3.5 h-3.5" />
                                            </span>
                                        )}
                                        <span className={`text-[10.5px] font-black uppercase tracking-wider truncate ${group.colorClass || 'text-slate-600'}`}>
                                            {group.groupTitle}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0 ml-1">
                                        {isGroupCollapsed && (
                                            <span className="text-[9px] font-bold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200/80 shadow-2xs">
                                                {visibleItems.length}
                                            </span>
                                        )}
                                        <ChevronDown
                                            className={`w-3.5 h-3.5 text-slate-400 group-hover/title:text-slate-600 transition-transform duration-200 ${
                                                isGroupCollapsed ? '-rotate-90' : 'rotate-0 text-slate-600'
                                            }`}
                                        />
                                    </div>
                                </button>
                            ) : null}

                            {/* Danh sách items: Thụt lề và có viền cây thư mục dọc để dễ phân biệt giữa nhóm chính và các trang chức năng */}
                            {(!isGroupCollapsed || isCollapsed) && (
                                <div
                                    className={
                                        group.groupTitle && !isCollapsed
                                            ? `ml-3.5 pl-2.5 border-l-2 ${
                                                  hasActiveChild ? 'border-blue-400/80' : 'border-slate-200/80'
                                              } space-y-1 my-1 transition-colors duration-200`
                                            : 'space-y-1'
                                    }
                                >
                                    {visibleItems.map((item) => {
                                        const Icon = item.icon;
                                        const badgeInfo = resolveBadge(item);

                                        return (
                                            <NavLink
                                                key={item.path}
                                                to={item.path}
                                                end={true}
                                                onClick={handleItemClick}
                                                title={isCollapsed ? item.name : undefined}
                                                className={({ isActive }) => `
                                                group relative flex items-center rounded-lg text-xs font-bold transition-all
                                                ${
                                                    isCollapsed
                                                        ? 'justify-center p-2.5'
                                                        : group.groupTitle
                                                            ? 'justify-between px-2.5 py-2'
                                                            : 'justify-between px-3 py-2.5 rounded-xl'
                                                }
                                                ${
                                                    isActive
                                                        ? 'bg-blue-600 text-white shadow-xs'
                                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                                                }
                                            `}
                                            >
                                                {({ isActive }) => (
                                                    <>
                                                        <div className={`flex items-center gap-2.5 ${isCollapsed ? 'justify-center' : 'truncate'}`}>
                                                            <Icon className={`${group.groupTitle && !isCollapsed ? 'w-3.5 h-3.5' : 'w-4 h-4'} flex-shrink-0`} />
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
