import { useState, useEffect } from 'react';
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
    Compass,
    MapPin,
    RefreshCw,
    Umbrella
} from 'lucide-react';

interface CityOption {
    name: string;
    lat: number;
    lon: number;
}

const POPULAR_CITIES: CityOption[] = [
    { name: 'Bà Rịa - Vũng Tàu', lat: 10.346, lon: 107.084 },
    { name: 'TP. Hồ Chí Minh', lat: 10.823, lon: 106.63 },
    { name: 'Hà Nội', lat: 21.028, lon: 105.854 },
    { name: 'Đà Nẵng', lat: 16.054, lon: 108.202 },
    { name: 'Cần Thơ', lat: 10.045, lon: 105.747 },
    { name: 'Bình Dương', lat: 11.166, lon: 106.65 }
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

export default function WeatherWidget() {
    const [selectedCity, setSelectedCity] = useState<CityOption>(POPULAR_CITIES[0]);
    const [weather, setWeather] = useState<WeatherData>({
        temperature: 28,
        apparentTemperature: 31,
        humidity: 78,
        windspeed: 6.5,
        precipitationProb: 15,
        weatherCode: 1,
        isDay: true,
        updatedAt: 'Vừa xong'
    });
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const fetchWeather = async (city: CityOption) => {
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
            console.warn('Lỗi lấy thời tiết, dùng dữ liệu ước tính:', e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchWeather(selectedCity);
    }, [selectedCity]);

    // Dịch mã thời tiết WMO
    const getWeatherInfo = (code: number, isDay: boolean) => {
        if (code === 0) {
            return {
                label: isDay ? 'Trời nắng quang' : 'Đêm trời quang',
                icon: isDay ? Sun : Sun,
                color: 'text-amber-500',
                bgGradient: 'from-amber-500/10 via-orange-500/5 to-transparent'
            };
        }
        if (code === 1 || code === 2) {
            return {
                label: 'Có mây rải rác',
                icon: isDay ? CloudSun : Cloud,
                color: 'text-blue-500',
                bgGradient: 'from-sky-500/10 via-blue-500/5 to-transparent'
            };
        }
        if (code === 3) {
            return {
                label: 'Nhiều mây',
                icon: Cloud,
                color: 'text-slate-500',
                bgGradient: 'from-slate-500/10 via-slate-600/5 to-transparent'
            };
        }
        if (code === 45 || code === 48) {
            return {
                label: 'Có sương mù',
                icon: CloudFog,
                color: 'text-slate-400',
                bgGradient: 'from-slate-400/10 to-transparent'
            };
        }
        if (code >= 51 && code <= 67) {
            return {
                label: 'Có mưa rào',
                icon: CloudRain,
                color: 'text-blue-600',
                bgGradient: 'from-blue-500/15 to-transparent'
            };
        }
        if (code >= 80 && code <= 82) {
            return {
                label: 'Mưa to từng đợt',
                icon: CloudRain,
                color: 'text-indigo-600',
                bgGradient: 'from-indigo-500/20 to-transparent'
            };
        }
        if (code >= 95) {
            return {
                label: 'Mưa dông, sấm chớp',
                icon: CloudLightning,
                color: 'text-purple-600',
                bgGradient: 'from-purple-500/20 to-transparent'
            };
        }
        return {
            label: 'Thời tiết êm dịu',
            icon: CloudSun,
            color: 'text-amber-500',
            bgGradient: 'from-blue-500/10 to-transparent'
        };
    };

    const weatherInfo = getWeatherInfo(weather.weatherCode, weather.isDay);
    const WeatherIconComponent = weatherInfo.icon;

    return (
        <div className={`bg-white rounded-3xl p-5 border border-slate-200 shadow-xs relative overflow-hidden flex flex-col justify-between transition hover:shadow-md bg-gradient-to-br ${weatherInfo.bgGradient}`}>
            {/* Header: Vị trí & Nút làm mới */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100/80 gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                    <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                    <select
                        value={selectedCity.name}
                        onChange={(e) => {
                            const found = POPULAR_CITIES.find(c => c.name === e.target.value);
                            if (found) setSelectedCity(found);
                        }}
                        className="font-extrabold text-xs text-slate-800 bg-transparent outline-none cursor-pointer hover:text-blue-600 truncate"
                        title="Chọn thành phố / khu vực"
                    >
                        {POPULAR_CITIES.map(c => (
                            <option key={c.name} value={c.name}>{c.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 text-[11px] text-slate-400">
                    <span>{weather.updatedAt}</span>
                    <button
                        type="button"
                        onClick={() => fetchWeather(selectedCity)}
                        disabled={isLoading}
                        className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-blue-600 cursor-pointer transition"
                        title="Cập nhật thời tiết mới nhất"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Nhiệt độ & Trạng thái lớn */}
            <div className="py-4 flex items-center justify-between">
                <div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-4xl sm:text-5xl font-black text-slate-900 font-mono tracking-tight">
                            {weather.temperature}°
                        </span>
                        <span className="text-xs font-black text-slate-400">C</span>
                    </div>

                    <div className="flex items-center gap-1.5 mt-1 font-bold text-xs text-slate-700">
                        <span className={`w-2 h-2 rounded-full ${weather.isDay ? 'bg-amber-400 animate-pulse' : 'bg-indigo-400'}`} />
                        <span>{weatherInfo.label}</span>
                    </div>
                </div>

                {/* Icon thời tiết lớn */}
                <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white shadow-xs border border-slate-100 flex items-center justify-center ${weatherInfo.color}`}>
                    <WeatherIconComponent className="w-8 h-8 sm:w-10 sm:h-10 animate-pulse" />
                </div>
            </div>

            {/* 4 Chỉ số phụ (Độ ẩm, Gió, Cảm giác như, Xác suất mưa) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-100 text-xs">
                <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100/80">
                    <Droplets className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <div>
                        <div className="text-[10px] text-slate-400 font-medium">Độ ẩm</div>
                        <div className="font-bold text-slate-800 font-mono text-[11px]">{weather.humidity}%</div>
                    </div>
                </div>

                <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100/80">
                    <Wind className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                    <div>
                        <div className="text-[10px] text-slate-400 font-medium">Tốc độ gió</div>
                        <div className="font-bold text-slate-800 font-mono text-[11px]">{weather.windspeed} km/h</div>
                    </div>
                </div>

                <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100/80">
                    <Thermometer className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <div>
                        <div className="text-[10px] text-slate-400 font-medium">Cảm giác</div>
                        <div className="font-bold text-slate-800 font-mono text-[11px]">{weather.apparentTemperature}°C</div>
                    </div>
                </div>

                <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100/80">
                    <Umbrella className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <div>
                        <div className="text-[10px] text-slate-400 font-medium">Khả năng mưa</div>
                        <div className="font-bold text-slate-800 font-mono text-[11px]">{weather.precipitationProb}%</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
