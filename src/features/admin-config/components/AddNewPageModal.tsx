import { useState } from 'react';
import { type SystemPagePermission } from '../../../core/lib/permissions';
import { type UserRole } from '../../../shared/contexts/AuthContext';
import { type BadgeColorTheme } from '../../../core/lib/badgeConfig';
import {
    X,
    Plus,
    Check,
    Layers,
    FileText,
    Link2,
    Shield,
    Tag,
    AlertCircle
} from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    existingPages: SystemPagePermission[];
    onAddPage: (newPage: SystemPagePermission) => void;
}

const DEFAULT_GROUPS = [
    'BÁO CÁO KINH DOANH',
    'SỨC KHỎE NHÂN VIÊN',
    'DỮ LIỆU & PHIÊN LÀM VIỆC',
    'TIỆN ÍCH BÁN HÀNG',
    'HỆ THỐNG & CẤU HÌNH'
];

export default function AddNewPageModal({ isOpen, onClose, existingPages, onAddPage }: Props) {
    const [pageName, setPageName] = useState('');
    const [path, setPath] = useState('');
    const [pageKey, setPageKey] = useState('');
    const [groupTitle, setGroupTitle] = useState(DEFAULT_GROUPS[0]);
    const [customGroup, setCustomGroup] = useState('');
    const [description, setDescription] = useState('');
    const [allowedRoles, setAllowedRoles] = useState<UserRole[]>(['ADMIN', 'QUAN_LY']);
    const [badgeEnabled, setBadgeEnabled] = useState(false);
    const [badgeIcon, setBadgeIcon] = useState('✨');
    const [badgeText, setBadgeText] = useState('Mới');
    const [badgeColor, setBadgeColor] = useState<BadgeColorTheme>('blue');
    const [errorMsg, setErrorMsg] = useState('');

    if (!isOpen) return null;

    // Tự sinh page_key khi gõ path hoặc tên
    const handlePathChange = (val: string) => {
        setPath(val);
        if (!pageKey || pageKey.startsWith('trang_')) {
            const cleanKey = val.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase().replace(/^_+|_+$/g, '');
            setPageKey(cleanKey || 'trang_moi');
        }
    };

    const handleToggleRole = (role: UserRole) => {
        setAllowedRoles(prev =>
            prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');

        const trimmedName = pageName.trim();
        let trimmedPath = path.trim();
        const trimmedKey = (pageKey.trim() || trimmedPath.replace(/[^a-zA-Z0-9]/g, '_')).toLowerCase();
        const finalGroup = customGroup.trim() ? customGroup.trim() : groupTitle;

        if (!trimmedName) {
            setErrorMsg('Vui lòng nhập tên trang / phân hệ!');
            return;
        }

        if (!trimmedPath) {
            setErrorMsg('Vui lòng nhập đường dẫn URL của trang!');
            return;
        }

        if (!trimmedPath.startsWith('/')) {
            trimmedPath = '/' + trimmedPath;
        }

        // Kiểm tra trùng lặp
        const duplicatePath = existingPages.find(p => p.path === trimmedPath);
        if (duplicatePath) {
            setErrorMsg(`Đường dẫn "${trimmedPath}" đã tồn tại trên trang "${duplicatePath.page_name}"!`);
            return;
        }

        const duplicateKey = existingPages.find(p => p.page_key === trimmedKey);
        if (duplicateKey) {
            setErrorMsg(`Mã page_key "${trimmedKey}" đã tồn tại! Vui lòng chọn mã khác.`);
            return;
        }

        // Tính order_index mới
        const maxOrder = existingPages.reduce((max, p) => Math.max(max, p.order_index ?? 0), 0);

        const newPage: SystemPagePermission = {
            page_key: trimmedKey,
            page_name: trimmedName,
            path: trimmedPath,
            group_title: finalGroup,
            description: description.trim() || undefined,
            is_enabled: true,
            allowed_roles: allowedRoles.length > 0 ? allowedRoles : ['ADMIN'],
            order_index: maxOrder + 1,
            badge_enabled: badgeEnabled,
            badge_icon: badgeEnabled ? badgeIcon : undefined,
            badge_text: badgeEnabled ? badgeText : undefined,
            badge_color: badgeEnabled ? badgeColor : 'blue'
        };

        onAddPage(newPage);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
                    <div className="flex items-center gap-2.5">
                        <span className="p-2 rounded-xl bg-blue-100 text-blue-700">
                            <Plus className="w-5 h-5" />
                        </span>
                        <div>
                            <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                                Thêm Trang / Phân Hệ Mới
                            </h3>
                            <p className="text-xs text-slate-500 font-medium">
                                Đăng ký trang mới vào hệ thống quản trị và phân quyền Sidebar
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body Form */}
                <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
                    {errorMsg && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{errorMsg}</span>
                        </div>
                    )}

                    {/* Tên trang */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                            Tên Trang / Phân Hệ <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={pageName}
                            onChange={(e) => setPageName(e.target.value)}
                            placeholder="Ví dụ: Báo Cáo Tiếp Thị & CSKH"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
                            required
                        />
                    </div>

                    {/* Đường dẫn URL & Page Key */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                Đường Dẫn URL (Route) <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={path}
                                onChange={(e) => handlePathChange(e.target.value)}
                                placeholder="/bao-cao-tiep-thi"
                                className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none text-indigo-700"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                                Mã Duy Nhất (page_key)
                            </label>
                            <input
                                type="text"
                                value={pageKey}
                                onChange={(e) => setPageKey(e.target.value)}
                                placeholder="bc_tiep_thi"
                                className="w-full px-3 py-2 font-mono bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none text-slate-600"
                            />
                        </div>
                    </div>

                    {/* Nhóm chức năng */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                            Nhóm Chức Năng (Group Title)
                        </label>
                        <select
                            value={groupTitle}
                            onChange={(e) => setGroupTitle(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            {DEFAULT_GROUPS.map(grp => (
                                <option key={grp} value={grp}>{grp}</option>
                            ))}
                            <option value="__CUSTOM__">➕ Nhập nhóm mới khác...</option>
                        </select>
                        {groupTitle === '__CUSTOM__' && (
                            <input
                                type="text"
                                value={customGroup}
                                onChange={(e) => setCustomGroup(e.target.value)}
                                placeholder="Nhập tên nhóm mới (viết in hoa)"
                                className="w-full mt-2 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                        )}
                    </div>

                    {/* Mô tả */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                            Mô Tả Chức Năng
                        </label>
                        <textarea
                            rows={2}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Mô tả ngắn gọn về phân hệ để nhân viên dễ nắm bắt..."
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                        />
                    </div>

                    {/* Phân quyền vai trò ban đầu */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                            Vai Trò Được Phép Truy Cập Ban Đầu
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {(['ADMIN', 'QUAN_LY', 'TRUONG_CA', 'NHAN_VIEN'] as UserRole[]).map(role => {
                                const checked = allowedRoles.includes(role);
                                return (
                                    <label
                                        key={role}
                                        className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-bold cursor-pointer transition select-none ${
                                            checked
                                                ? 'bg-blue-50 text-blue-800 border-blue-300'
                                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => handleToggleRole(role)}
                                            className="rounded text-blue-600"
                                        />
                                        <span>{role}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    {/* Cấu hình Badge Sidebar */}
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800">
                                Gắn Badge Nổi Bật Trên Sidebar
                            </span>
                            <input
                                type="checkbox"
                                checked={badgeEnabled}
                                onChange={(e) => setBadgeEnabled(e.target.checked)}
                                className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                            />
                        </div>

                        {badgeEnabled && (
                            <div className="grid grid-cols-3 gap-2 pt-1 animate-in fade-in duration-200">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Icon</label>
                                    <input
                                        type="text"
                                        value={badgeIcon}
                                        onChange={(e) => setBadgeIcon(e.target.value)}
                                        placeholder="✨"
                                        className="w-full px-2 py-1 text-xs border rounded-lg bg-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Chữ hiển thị</label>
                                    <input
                                        type="text"
                                        value={badgeText}
                                        onChange={(e) => setBadgeText(e.target.value)}
                                        placeholder="Mới"
                                        className="w-full px-2 py-1 text-xs border rounded-lg bg-white font-bold"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Màu sắc</label>
                                    <select
                                        value={badgeColor}
                                        onChange={(e) => setBadgeColor(e.target.value as BadgeColorTheme)}
                                        className="w-full px-2 py-1 text-xs border rounded-lg bg-white font-bold"
                                    >
                                        <option value="blue">Xanh Dương</option>
                                        <option value="emerald">Xanh Lá</option>
                                        <option value="amber">Vàng Cam</option>
                                        <option value="rose">Đỏ Hồng</option>
                                        <option value="purple">Tím</option>
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Buttons */}
                    <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Thêm Trang Mới</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
