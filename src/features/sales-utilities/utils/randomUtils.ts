/**
 * Sinh số nguyên ngẫu nhiên công bằng trong đoạn [min, max] bằng crypto.getRandomValues
 * Sử dụng rejection sampling để loại bỏ hoàn toàn sai lệch chia lấy dư (modulo bias).
 */
export function secureRandomInt(minInclusive: number, maxInclusive: number): number {
    const min = Math.ceil(Math.min(minInclusive, maxInclusive));
    const max = Math.floor(Math.max(minInclusive, maxInclusive));
    const range = max - min + 1;
    if (range <= 1) return min;

    if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
        const maxUint32 = 0xffffffff;
        const limit = maxUint32 - (maxUint32 % range);
        const buf = new Uint32Array(1);
        let candidate = 0;
        do {
            window.crypto.getRandomValues(buf);
            candidate = buf[0];
        } while (candidate >= limit);
        return min + (candidate % range);
    }

    return min + Math.floor(Math.random() * range);
}

/**
 * Xáo trộn ngẫu nhiên Fisher–Yates dùng bộ sinh crypto
 */
export function secureShuffle<T>(items: readonly T[]): T[] {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = secureRandomInt(0, i);
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
    }
    return arr;
}

/**
 * Quay N số trong khoảng [min, max]
 */
export function drawNumbersInRange(
    min: number,
    max: number,
    count: number,
    allowDuplicate: boolean
): number[] {
    const lo = Math.ceil(Math.min(min, max));
    const hi = Math.floor(Math.max(min, max));
    const totalRange = hi - lo + 1;
    const safeCount = Math.max(1, Math.min(count, allowDuplicate ? 200 : Math.min(200, totalRange)));

    if (allowDuplicate) {
        const out: number[] = [];
        for (let i = 0; i < safeCount; i++) {
            out.push(secureRandomInt(lo, hi));
        }
        return out;
    }

    // Nếu khoảng nhỏ (<= 10,000), dùng Fisher–Yates trực tiếp trên mảng hoặc Set nếu khoảng lớn
    if (totalRange <= 5000) {
        const pool: number[] = [];
        for (let v = lo; v <= hi; v++) {
            pool.push(v);
        }
        for (let i = 0; i < safeCount; i++) {
            const j = secureRandomInt(i, pool.length - 1);
            const tmp = pool[i];
            pool[i] = pool[j];
            pool[j] = tmp;
        }
        return pool.slice(0, safeCount);
    }

    const picked = new Set<number>();
    while (picked.size < safeCount) {
        picked.add(secureRandomInt(lo, hi));
    }
    return Array.from(picked);
}

/**
 * Tách danh sách dòng văn bản sạch (bỏ dòng trống & trim)
 */
export function parseLinesList(rawText: string): string[] {
    return (rawText || '')
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);
}

/**
 * Chia danh sách thành N đội cân bằng ngẫu nhiên (chênh tối đa 1 thành viên)
 */
export function splitIntoBalancedTeams(members: string[], teamCount: number): string[][] {
    const safeTeams = Math.max(1, Math.min(teamCount, Math.max(1, members.length)));
    const shuffled = secureShuffle(members);
    const teams: string[][] = Array.from({ length: safeTeams }, () => []);
    shuffled.forEach((member, idx) => {
        teams[idx % safeTeams].push(member);
    });
    return teams;
}

export {
    type SpinSoundKind,
    unlockSoundEngine,
    playFeedbackTone,
    createSpinTicker
} from './soundEffects';

