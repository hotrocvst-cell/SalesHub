import { useState, useEffect, useRef } from 'react';
import type { StoreItem } from '../../../core/lib/storage';
import type { GeoLocationInfo } from '../types';

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // metres
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
}

export function useGeolocationTracker(selectedStore?: StoreItem | null) {
    const [geoInfo, setGeoInfo] = useState<GeoLocationInfo>({
        latitude: null,
        longitude: null,
        accuracy: null,
        streetAddress: selectedStore?.address || selectedStore?.name || '',
        storeAddress: selectedStore?.address || selectedStore?.name || '',
        distanceToStoreMeters: null,
        isWithinStoreRange: true,
        error: null,
        timestamp: new Date()
    });

    const watchIdRef = useRef<number | null>(null);

    useEffect(() => {
        const storeAddr = selectedStore?.address || selectedStore?.name || '';

        if (!navigator.geolocation) {
            setGeoInfo(prev => ({
                ...prev,
                streetAddress: storeAddr,
                storeAddress: storeAddr,
                error: 'Thiết bị không hỗ trợ định vị GPS'
            }));
            return;
        }

        const handleSuccess = (pos: GeolocationPosition) => {
            const { latitude, longitude, accuracy } = pos.coords;

            // Nếu ST có tọa độ lat/long gắn kèm (ví dụ lưu trong ghi chú hoặc metadata), tính cự ly
            let distance: number | null = null;
            let withinRange = true;

            const storeLatMatch = selectedStore?.address?.match(/lat:([0-9.-]+)/i);
            const storeLonMatch = selectedStore?.address?.match(/lon:([0-9.-]+)/i);

            if (storeLatMatch && storeLonMatch) {
                const sLat = parseFloat(storeLatMatch[1]);
                const sLon = parseFloat(storeLonMatch[1]);
                if (!isNaN(sLat) && !isNaN(sLon)) {
                    distance = calculateDistanceMeters(latitude, longitude, sLat, sLon);
                    withinRange = distance <= 150; // Cho phép bán kính 150m
                }
            }

            setGeoInfo({
                latitude: Number(latitude.toFixed(5)),
                longitude: Number(longitude.toFixed(5)),
                accuracy: Math.round(accuracy),
                streetAddress: storeAddr,
                storeAddress: storeAddr,
                distanceToStoreMeters: distance,
                isWithinStoreRange: withinRange,
                error: null,
                timestamp: new Date()
            });
        };

        const handleError = (err: GeolocationPositionError) => {
            let msg = 'Không thể lấy định vị GPS';
            if (err.code === err.PERMISSION_DENIED) msg = 'Vui lòng cấp quyền vị trí cho trình duyệt';
            else if (err.code === err.POSITION_UNAVAILABLE) msg = 'Tín hiệu GPS yếu';
            else if (err.code === err.TIMEOUT) msg = 'Hết thời gian tìm tín hiệu GPS';

            setGeoInfo(prev => ({
                ...prev,
                streetAddress: storeAddr,
                storeAddress: storeAddr,
                error: msg
            }));
        };

        // Bắt đầu theo dõi vị trí GPS với độ chính xác cao
        watchIdRef.current = navigator.geolocation.watchPosition(handleSuccess, handleError, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 5000
        });

        return () => {
            if (watchIdRef.current !== null) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
        };
    }, [selectedStore?.code, selectedStore?.address, selectedStore?.name]);

    return geoInfo;
}
