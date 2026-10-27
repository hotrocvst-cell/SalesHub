import { useMemo, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { StoreItem } from '../../core/lib/storage';
import { isStoreMatch } from '../../core/lib/formatters';
import { GUEST_DEMO_STORE, GUEST_DEMO_STORE_CODE, getGuestDemoStoreItem } from '../../core/lib/guestDemoStoreService';

export function useUserStoreFilter(
    stores: StoreItem[],
    selectedStore: string,
    setSelectedStore: (store: string) => void
) {
    const { currentUser, isAdmin } = useAuth();
    const isGuest = Boolean(currentUser?.is_guest);

    // Danh sách siêu thị khả dụng theo phân quyền của tài khoản hiện tại
    const allowedStores = useMemo<StoreItem[]>(() => {
        if (!stores || stores.length === 0) {
            return isGuest ? [getGuestDemoStoreItem()] : [];
        }
        if (isAdmin) return stores;

        // TÀI KHOẢN TRẢI NGHIỆM: CỐ ĐỊNH DUY NHẤT SIÊU THỊ 838679 - DEMO STORE
        if (isGuest) {
            const guestTarget = currentUser.store_name || GUEST_DEMO_STORE;
            const matched = stores.filter(s =>
                isStoreMatch(s.name, guestTarget, stores) ||
                s.code === GUEST_DEMO_STORE_CODE ||
                s.name.includes(GUEST_DEMO_STORE_CODE) ||
                s.name.includes('Demo Store')
            );
            if (matched.length > 0) return matched;
            return [getGuestDemoStoreItem()];
        }

        if (currentUser.role === 'NHAN_VIEN') {
            // Nhân viên: CHỈ ĐƯỢC XEM SIÊU THỊ ĐÃ ĐĂNG KÝ
            if (!currentUser.store_name) return [];
            const matched = stores.filter(s => isStoreMatch(s.name, currentUser.store_name, stores));
            // Nếu không tìm thấy trong stores list nhưng có store_name thì tạo dummy
            if (matched.length === 0) {
                return [{ id: 'my_store', name: currentUser.store_name, code: '', address: '' }];
            }
            return matched;
        }

        // Quản lý hoặc Trưởng ca
        const accessible = currentUser.accessible_stores && currentUser.accessible_stores.length > 0
            ? currentUser.accessible_stores
            : (currentUser.store_name ? [currentUser.store_name] : []);

        if (accessible.length === 0) return stores;
        return stores.filter(s => accessible.some(acc => isStoreMatch(s.name, acc, stores)));
    }, [stores, currentUser, isAdmin, isGuest]);

    // Tự động kiểm soát selectedStore nếu người dùng không có quyền xem siêu thị hiện tại
    useEffect(() => {
        if (isAdmin) return; // Admin được xem mọi thứ kể cả 'all'

        if (isGuest) {
            // Tài khoản trải nghiệm: BẮT BUỘC CHỌN SHOP 838679 - DEMO STORE
            const guestStore = allowedStores[0]?.name || GUEST_DEMO_STORE;
            if (guestStore && selectedStore !== guestStore) {
                setSelectedStore(guestStore);
            }
            return;
        }

        if (currentUser.role === 'NHAN_VIEN') {
            // Nhân viên: BẮT BUỘC CHỌN SHOP CỦA MÌNH, KHÔNG ĐƯỢC CHỌN 'all' HOẶC SHOP KHÁC
            const myStore = allowedStores[0]?.name || currentUser.store_name;
            if (myStore && selectedStore !== myStore) {
                setSelectedStore(myStore);
            }
            return;
        }

        // Quản lý / Trưởng ca:
        // Nếu đang chọn 'all' nhưng chỉ phụ trách 1 shop -> chọn luôn shop đó
        if (allowedStores.length === 1 && selectedStore === 'all') {
            setSelectedStore(allowedStores[0].name);
            return;
        }

        // Nếu shop đang chọn không nằm trong danh sách được phép
        if (selectedStore !== 'all') {
            const isPermitted = allowedStores.some(s => isStoreMatch(s.name, selectedStore, stores));
            if (!isPermitted && allowedStores.length > 0) {
                setSelectedStore(allowedStores[0].name);
            }
        }
    }, [allowedStores, selectedStore, currentUser, isAdmin, isGuest, setSelectedStore, stores]);

    const isLockedToSingleStore = (!isAdmin && currentUser.role === 'NHAN_VIEN') || isGuest;

    return {
        allowedStores,
        isLockedToSingleStore,
        canViewAllStores: !isGuest && (isAdmin || (currentUser.role !== 'NHAN_VIEN' && allowedStores.length > 1))
    };
}
