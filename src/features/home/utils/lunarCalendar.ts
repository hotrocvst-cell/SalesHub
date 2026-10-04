/**
 * Tiện ích chuyển đổi Dương Lịch sang Âm Lịch Việt Nam
 * Dựa trên thuật toán thiên văn học chính xác của Hồ Ngọc Đức (Múi giờ GMT+7)
 */

export interface LunarDate {
    day: number;
    month: number;
    year: number;
    isLeap: boolean;
    canChiYear: string;
    canChiDay?: string;
    lunarLabel: string;
}

const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];

function jdFromDate(dd: number, mm: number, yy: number): number {
    const a = Math.floor((14 - mm) / 12);
    const y = yy + 4800 - a;
    const m = mm + 12 * a - 3;
    let jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
    if (jd < 2299161) {
        jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
    }
    return jd;
}

function getNewMoonDay(k: number, timeZone = 7): number {
    const T = k / 1236.85;
    const T2 = T * T;
    const T3 = T2 * T;
    const dr = Math.PI / 180;
    let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
    Jd1 = Jd1 + 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
    const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
    const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
    const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
    let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * M * dr);
    C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(2 * Mpr * dr);
    C1 = C1 - 0.0004 * Math.sin(3 * Mpr * dr);
    C1 = C1 + 0.0104 * Math.sin(2 * F * dr) - 0.0051 * Math.sin((M + Mpr) * dr);
    C1 = C1 - 0.0074 * Math.sin((M - Mpr) * dr) + 0.0004 * Math.sin((2 * F + M) * dr);
    C1 = C1 - 0.0004 * Math.sin((2 * F - M) * dr) - 0.0006 * Math.sin((2 * F + Mpr) * dr);
    C1 = C1 + 0.0010 * Math.sin((2 * F - Mpr) * dr) + 0.0005 * Math.sin((M + 2 * Mpr) * dr);
    const JdNew = Jd1 + C1;
    return Math.floor(JdNew + 0.5 + timeZone / 24);
}

function getSunLongitude(jdn: number, timeZone = 7): number {
    const T = (jdn - 2451545.0 + 0.5 - timeZone / 24) / 36525;
    const T2 = T * T;
    const dr = Math.PI / 180;
    const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
    const M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
    let C = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(M * dr);
    C = C + (0.019993 - 0.000101 * T) * Math.sin(2 * M * dr) + 0.000290 * Math.sin(3 * M * dr);
    let theta = L0 + C;
    theta = theta - 360 * Math.floor(theta / 360);
    return Math.floor(theta / 30);
}

function getLunarMonth11(yy: number, timeZone = 7): number {
    const off = jdFromDate(31, 12, yy) - 2415021;
    const k = Math.floor(off / 29.530588853);
    let nm = getNewMoonDay(k, timeZone);
    const sunLong = getSunLongitude(nm, timeZone);
    if (sunLong >= 9) {
        nm = getNewMoonDay(k - 1, timeZone);
    }
    return nm;
}

/**
 * Chuyển ngày Dương Lịch (dd/mm/yyyy) sang ngày Âm Lịch Việt Nam
 */
export function getLunarDate(dd: number, mm: number, yy: number, timeZone = 7): LunarDate {
    const dayNumber = jdFromDate(dd, mm, yy);
    const k = Math.floor((dayNumber - 2415021.0769986) / 29.530588853);
    let monthStart = getNewMoonDay(k + 1, timeZone);
    if (monthStart > dayNumber) {
        monthStart = getNewMoonDay(k, timeZone);
    }
    let a11 = getLunarMonth11(yy, timeZone);
    let b11 = a11;
    let lunarYear: number;
    if (a11 >= monthStart) {
        lunarYear = yy;
        a11 = getLunarMonth11(yy - 1, timeZone);
    } else {
        lunarYear = yy + 1;
        b11 = getLunarMonth11(yy + 1, timeZone);
    }
    const lunarDay = dayNumber - monthStart + 1;
    const diff = Math.floor((monthStart - a11) / 29);
    let lunarLeap = 0;
    let lunarMonth = diff + 11;
    if (b11 - a11 > 365) {
        let leapMonthDiff = 0;
        const k11 = Math.floor((a11 - 2415021.0769986) / 29.530588853 + 0.5);
        let lastSunLong = getSunLongitude(a11, timeZone);
        for (let i = 1; i <= 13; i++) {
            const nm = getNewMoonDay(k11 + i, timeZone);
            const sl = getSunLongitude(nm, timeZone);
            if (sl === lastSunLong) {
                leapMonthDiff = i;
                break;
            }
            lastSunLong = sl;
        }
        if (diff >= leapMonthDiff) {
            lunarMonth = diff + 10;
            if (diff === leapMonthDiff) {
                lunarLeap = 1;
            }
        }
    }
    if (lunarMonth > 12) {
        lunarMonth = lunarMonth - 12;
    }
    if (lunarMonth >= 11 && diff < 4) {
        lunarYear -= 1;
    }

    const canYear = CAN[(lunarYear + 6) % 10];
    const chiYear = CHI[(lunarYear + 8) % 12];
    const canChiYear = `${canYear} ${chiYear}`;

    const canDay = CAN[(dayNumber + 9) % 10];
    const chiDay = CHI[(dayNumber + 1) % 12];
    const canChiDay = `${canDay} ${chiDay}`;

    // Nhãn ngắn: ngày mùng 1 sẽ hiển thị dạng "01/tháng" hoặc chỉ "dd"
    let lunarLabel = String(lunarDay);
    if (lunarDay === 1) {
        lunarLabel = `1/${lunarMonth}${lunarLeap ? 'N' : ''}`;
    } else if (lunarDay === 15) {
        lunarLabel = '15 (Rằm)';
    }

    return {
        day: lunarDay,
        month: lunarMonth,
        year: lunarYear,
        isLeap: lunarLeap === 1,
        canChiYear,
        canChiDay,
        lunarLabel
    };
}
