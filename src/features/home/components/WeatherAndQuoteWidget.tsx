import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Sun,
    Cloud,
    CloudSun,
    CloudRain,
    CloudLightning,
    CloudFog,
    Droplets,
    Wind,
    Thermometer,
    MapPin,
    Navigation,
    RefreshCw,
    Umbrella,
    Sparkles,
    Quote,
    RotateCw
} from 'lucide-react';

interface CityOption {
    name: string;
    lat: number;
    lon: number;
    isCurrentLocation?: boolean;
}

const POPULAR_CITIES: CityOption[] = [
    { name: 'Bà Rịa - Vũng Tàu', lat: 10.346, lon: 107.084 },
    { name: 'TP. Hồ Chí Minh', lat: 10.823, lon: 106.63 },
    { name: 'Hà Nội', lat: 21.028, lon: 105.854 },
    { name: 'Đà Nẵng', lat: 16.054, lon: 108.202 },
    { name: 'Cần Thơ', lat: 10.045, lon: 105.747 },
    { name: 'Bình Dương', lat: 11.166, lon: 106.65 },
    { name: 'Đồng Nai', lat: 10.957, lon: 106.842 },
    { name: 'Khánh Hòa (Nha Trang)', lat: 12.238, lon: 109.196 },
    { name: 'Hải Phòng', lat: 20.844, lon: 106.688 }
];

const MOTIVATIONAL_QUOTES = [
    {
        quote: 'Thành công trong bán hàng không đến từ may mắn, mà đến từ sự thấu hiểu sâu sắc nhu cầu khách hàng và kiên trì phục vụ tận tâm.',
        author: 'Nguyên lý bán lẻ hiện đại'
    },
    {
        quote: 'Mỗi lời từ chối của khách hàng là một bước đệm giúp bạn tiến gần hơn đến một giao dịch thành công rực rỡ.',
        author: 'Kỹ năng kinh doanh thực chiến'
    },
    {
        quote: 'Chất lượng phục vụ vượt trội chính là vũ khí cạnh tranh mạnh mẽ nhất của một người làm kinh doanh xuất sắc.',
        author: 'Văn hóa phục vụ khách hàng'
    },
    {
        quote: 'Mục tiêu tháng không tự nhiên hoàn thành; nó được tạo nên từ sự bứt phá và kỷ luật trong từng ca làm việc mỗi ngày.',
        author: 'Động lực bứt phá doanh số'
    },
    {
        quote: 'Hãy làm việc hôm nay với sự đam mê để ngày mai tự hào về những cột mốc doanh thu mới đã chinh phục!',
        author: 'Tinh thần chiến binh'
    },
    {
        quote: 'Khách hàng có thể quên những gì bạn nói, nhưng họ sẽ không bao giờ quên cảm xúc tuyệt vời bạn mang lại cho họ.',
        author: 'Nghệ thuật chăm sóc khách hàng'
    },
    {
        quote: 'Năng lượng tạo ra ngân lượng. Giữ vững nụ cười và tinh thần nhiệt huyết trong từng cuộc tư vấn!',
        author: 'Bí quyết bứt phá doanh thu'
    }
];

interface WeatherData {
    temperature: number;
    apparentTemperature: number;
    humidity: number;
    windspeed: number;
    precipitationProb: number;
    weatherCode: number;
    isDay: boolean;
    updatedAt: string;
}

const LOCAL_STORAGE_WEATHER_LOC = 'saleshub_weather_current_location_v1';

export default function WeatherAndQuoteWidget() {
    // Thành phố được chọn (mặc định lấy từ cache hoặc Bà Rịa - Vũng Tàu)
    const [selectedCity, setSelectedCity] = useState<CityOption>(() => {
        try {
            const cached = localStorage.getItem(LOCAL_STORAGE_WEATHER_LOC);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed.lat && parsed.lon) return parsed;
            }
        } catch { }
        return POPULAR_CITIES[0];
    });

    const [weather, setWeather] = useState<WeatherData>({
        temperature: 29,
        apparentTemperature: 32,
        humidity: 76,
        windspeed: 6.8,
        precipitationProb: 15,
        weatherCode: 1,
        isDay: true,
        updatedAt: 'Vừa xong'
    });

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isLocating, setIsLocating] = useState<boolean>(false);
    const [locationNotice, setLocationNotice] = useState<string>('');

    // Quản lý Quote động lực
    const today = new Date();
    const [quoteIndex, setQuoteIndex] = useState<number>(() => {
        return today.getDate() % MOTIVATIONAL_QUOTES.length;
    });

    const currentQuote = MOTIVATIONAL_QUOTES[quoteIndex];

    const handleNextQuote = () => {
        setQuoteIndex(prev => (prev + 1) % MOTIVATIONAL_QUOTES.length);
    };

    // Tải dữ liệu thời tiết
    const fetchWeather = useCallback(async (city: CityOption) => {
        setIsLoading(true);
        try {
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current_weather=true&hourly=relativehumidity_2m,apparent_temperature,precipitation_probability&timezone=Asia%2FBangkok`;
            const res = await fetch(url);
            if (!res.ok) throw new Error('Weather API error');
            const data = await res.json();

            const current = data.current_weather;
            const currentHourIndex = new Date().getHours();
            const hourlyHum = data.hourly?.relativehumidity_2m?.[currentHourIndex] ?? 75;
            const hourlyApparent = data.hourly?.apparent_temperature?.[currentHourIndex] ?? Math.round(current.temperature + 2.5);
            const hourlyPrecip = data.hourly?.precipitation_probability?.[currentHourIndex] ?? 10;

            setWeather({
                temperature: Math.round(current.temperature),
                apparentTemperature: Math.round(hourlyApparent),
                humidity: Math.round(hourlyHum),
                windspeed: Math.round(current.windspeed),
                precipitationProb: Math.round(hourlyPrecip),
                weatherCode: current.weathercode,
                isDay: current.is_day === 1,
                updatedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
            });
        } catch (e) {
            console.warn('Lỗi lấy thời tiết, dùng dữ liệu dự phòng:', e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchWeather(selectedCity);
    }, [selectedCity, fetchWeather]);

    // Định vị vị trí hiện tại qua GPS / Geolocation trình duyệt
    const handleDetectCurrentLocation = () => {
        if (!navigator.geolocation) {
            setLocationNotice('Trình duyệt không hỗ trợ định vị GPS.');
            setTimeout(() => setLocationNotice(''), 3000);
            return;
        }

        setIsLocating(true);
        setLocationNotice('Đang xác định tọa độ GPS...');

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;

                let locationName = 'Vị trí hiện tại của bạn';

                try {
                    // Gọi Reverse Geocoding miễn phí từ BigDataCloud Client API
                    const geoRes = await fetch(
                        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=vi`
                    );
                    if (geoRes.ok) {
                        const geoData = await geoRes.json();
                        const locality = geoData.locality || geoData.city || geoData.principalSubdivision || '';
                        const province = geoData.principalSubdivision || geoData.countryName || '';
                        if (locality && province && locality !== province) {
                            locationName = `${locality}, ${province}`;
                        } else if (locality || province) {
                            locationName = locality || province;
                        }
                    }
                } catch {
                    // Nếu lỗi reverse geocode, vẫn tiếp tục với tọa độ
                }

                const currentLocOption: CityOption = {
                    name: `📍 ${locationName}`,
                    lat,
                    lon,
                    isCurrentLocation: true
                };

                try {
                    localStorage.setItem(LOCAL_STORAGE_WEATHER_LOC, JSON.stringify(currentLocOption));
                } catch { }

                setSelectedCity(currentLocOption);
                setIsLocating(false);
                setLocationNotice(`✅ Đã cập nhật theo vị trí hiện tại: ${locationName}`);
                setTimeout(() => setLocationNotice(''), 4000);
            },
            (error) => {
                setIsLocating(false);
                let msg = 'Không thể lấy vị trí hiện tại.';
                if (error.code === error.PERMISSION_DENIED) {
                    msg = 'Bạn đã từ chối quyền truy cập vị trí trên trình duyệt.';
                } else if (error.code === error.TIMEOUT) {
                    msg = 'Quá thời gian lấy định vị GPS.';
                }
                setLocationNotice(`⚠️ ${msg}`);
                setTimeout(() => setLocationNotice(''), 4000);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000
            }
        );
    };

    // Dịch mã thời tiết WMO
    const weatherInfo = useMemo(() => {
        const code = weather.weatherCode;
        const isDay = weather.isDay;

        if (code === 0) {
            return {
                label: isDay ? 'Trời nắng quang' : 'Đêm trời quang',
                icon: Sun,
                color: 'text-amber-500',
                badgeBg: 'bg-amber-100 text-amber-800 border-amber-200'
            };
        }
        if (code === 1 || code === 2) {
            return {
                label: 'Có mây rải rác',
                icon: isDay ? CloudSun : Cloud,
                color: 'text-blue-500',
                badgeBg: 'bg-blue-100 text-blue-800 border-blue-200'
            };
        }
        if (code === 3) {
            return {
                label: 'Nhiều mây',
                icon: Cloud,
                color: 'text-slate-500',
                badgeBg: 'bg-slate-100 text-slate-700 border-slate-200'
            };
        }
        if (code === 45 || code === 48) {
            return {
                label: 'Có sương mù',
                icon: CloudFog,
                color: 'text-slate-400',
                badgeBg: 'bg-slate-100 text-slate-600 border-slate-200'
            };
        }
        if (code >= 51 && code <= 67) {
            return {
                label: 'Có mưa rào',
                icon: CloudRain,
                color: 'text-blue-600',
                badgeBg: 'bg-blue-100 text-blue-800 border-blue-200'
            };
        }
        if (code >= 80 && code <= 82) {
            return {
                label: 'Mưa to từng đợt',
                icon: CloudRain,
                color: 'text-indigo-600',
                badgeBg: 'bg-indigo-100 text-indigo-800 border-indigo-200'
            };
        }
        if (code >= 95) {
            return {
                label: 'Mưa dông, sấm chớp',
                icon: CloudLightning,
                color: 'text-purple-600',
                badgeBg: 'bg-purple-100 text-purple-800 border-purple-200'
            };
        }
        return {
            label: 'Nắng nhẹ & có mây',
            icon: CloudSun,
            color: 'text-amber-500',
            badgeBg: 'bg-amber-100 text-amber-800 border-amber-200'
        };
    }, [weather.weatherCode, weather.isDay]);

    const WeatherIconComponent = weatherInfo.icon;

    return (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col justify-between">
            {/* THÔNG BÁO VỊ TRÍ NẾU CÓ */}
            {locationNotice && (
                <div className="px-4 py-2 bg-indigo-50 border-b border-indigo-100 text-indigo-900 text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in duration-200">
                    <div className="flex items-center gap-1.5 truncate">
                        <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span className="truncate">{locationNotice}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setLocationNotice('')}
                        className="text-[11px] text-indigo-600 hover:text-indigo-900 font-bold shrink-0 cursor-pointer"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* BỐ CỤC GỘP: 2 CỘT (THỜI TIẾT + QUOTE ĐỘNG LỰC) */}
            <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-100">
                {/* PHẦN 1: THỜI TIẾT THỜI GIAN THỰC & VỊ TRÍ (CỘT TRÁI) */}
                <div className="md:col-span-6 p-5 sm:p-6 flex flex-col justify-between space-y-4">
                    {/* Header chọn vị trí & Nút định vị GPS */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                            <select
                                value={selectedCity.name}
                                onChange={(e) => {
                                    const found = POPULAR_CITIES.find(c => c.name === e.target.value);
                                    if (found) setSelectedCity(found);
                                }}
                                className="font-extrabold text-xs text-slate-800 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-1.5 outline-none cursor-pointer max-w-[190px] truncate transition"
                            >
                                {selectedCity.isCurrentLocation && (
                                    <option value={selectedCity.name}>
                                        {selectedCity.name}
                                    </option>
                                )}
                                {POPULAR_CITIES.map((c) => (
                                    <option key={c.name} value={c.name}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Bộ nút: Lấy vị trí GPS & Nút làm mới */}
                        <div className="flex items-center gap-1 shrink-0">
                            <button
                                type="button"
                                onClick={handleDetectCurrentLocation}
                                disabled={isLocating}
                                className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs ${
                                    selectedCity.isCurrentLocation
                                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:text-blue-700'
                                }`}
                                title="Lấy vị trí thực tế hiện tại của bạn qua GPS"
                            >
                                <Navigation className={`w-3 h-3 ${isLocating ? 'animate-spin text-blue-600' : 'text-blue-500'}`} />
                                <span className="hidden sm:inline">Vị trí hiện tại</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => fetchWeather(selectedCity)}
                                disabled={isLoading}
                                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                                title="Cập nhật lại thời tiết"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
                            </button>
                        </div>
                    </div>

                    {/* Nhiệt độ lớn & Trạng thái thời tiết */}
                    <div className="flex items-center justify-between gap-3 pt-1">
                        <div className="space-y-1">
                            <div className="flex items-baseline gap-1">
                                <span className="font-mono font-black text-4xl sm:text-5xl text-slate-900 tracking-tight">
                                    {weather.temperature}
                                </span>
                                <span className="font-extrabold text-2xl text-slate-400">°C</span>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${weatherInfo.badgeBg}`}>
                                    {weatherInfo.label}
                                </span>
                                <span className="text-[11px] text-slate-500 font-medium">
                                    Cảm giác: <b>{weather.apparentTemperature}°C</b>
                                </span>
                            </div>
                        </div>

                        <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-3xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center shrink-0 shadow-inner">
                            <WeatherIconComponent className={`w-10 h-10 ${weatherInfo.color} transition-transform hover:scale-110 duration-200`} />
                        </div>
                    </div>

                    {/* Chỉ số phụ (Độ ẩm, Sức gió, Mưa) */}
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
                        <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                            <div className="flex items-center justify-center gap-1 text-blue-500 mb-0.5">
                                <Droplets className="w-3 h-3" />
                                <span className="text-[10px] uppercase font-bold text-slate-500">Độ ẩm</span>
                            </div>
                            <span className="font-mono font-black text-xs text-slate-800">
                                {weather.humidity}%
                            </span>
                        </div>

                        <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                            <div className="flex items-center justify-center gap-1 text-cyan-600 mb-0.5">
                                <Wind className="w-3 h-3" />
                                <span className="text-[10px] uppercase font-bold text-slate-500">Sức gió</span>
                            </div>
                            <span className="font-mono font-black text-xs text-slate-800">
                                {weather.windspeed} <span className="text-[10px] font-normal text-slate-500">km/h</span>
                            </span>
                        </div>

                        <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
                            <div className="flex items-center justify-center gap-1 text-indigo-500 mb-0.5">
                                <Umbrella className="w-3 h-3" />
                                <span className="text-[10px] uppercase font-bold text-slate-500">Tỷ lệ mưa</span>
                            </div>
                            <span className="font-mono font-black text-xs text-slate-800">
                                {weather.precipitationProb}%
                            </span>
                        </div>
                    </div>
                </div>

                {/* PHẦN 2: THẺ QUOTE ĐỘNG LỰC MỖI NGÀY (CỘT PHẢI) */}
                <div className="md:col-span-6 p-5 sm:p-6 flex flex-col justify-between space-y-3 bg-gradient-to-br from-amber-50/50 via-white to-orange-50/30">
                    <div className="space-y-2.5">
                        {/* Header Thẻ Quote */}
                        <div className="flex items-center justify-between">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200/80 text-xs font-black uppercase tracking-wider">
                                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                                <span>Động Lực Mỗi Ngày</span>
                            </span>

                            <button
                                type="button"
                                onClick={handleNextQuote}
                                className="px-2.5 py-1 rounded-xl bg-white hover:bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-800 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                                title="Đổi câu trích dẫn truyền cảm hứng khác"
                            >
                                <RotateCw className="w-3 h-3 text-amber-600" />
                                <span>Đổi câu khác</span>
                            </button>
                        </div>

                        {/* Nội dung câu Quote */}
                        <div className="relative pt-1">
                            <Quote className="w-6 h-6 text-amber-300 absolute -top-1 -left-1 opacity-40 pointer-events-none" />
                            <p className="text-xs sm:text-sm font-semibold text-slate-800 italic leading-relaxed pl-4">
                                "{currentQuote.quote}"
                            </p>
                        </div>
                    </div>

                    {/* Nguồn / Tác giả & Cam kết phục vụ */}
                    <div className="pt-2 border-t border-amber-100/80 flex items-center justify-between text-xs">
                        <div className="text-[11px] text-amber-900/80 font-bold truncate">
                            — {currentQuote.author}
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 font-extrabold border border-amber-200/60 shrink-0">
                            🔥 Quyết tâm bứt phá
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
