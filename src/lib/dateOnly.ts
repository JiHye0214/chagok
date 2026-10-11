/**
 * 날짜만 있는 값("2025-10-01" 또는 "2025-10-01T00:00:00.000Z")을 다루는 도우미.
 *
 * new Date("2025-10-01")은 UTC 자정으로 해석돼서, 토론토처럼 UTC보다 늦은 시간대에서는
 * getDate()가 하루 전 날짜를 돌려준다. 날짜 부분(앞 10글자)만 떼어서 로컬 날짜로 만든다.
 */

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;

/** "2025-10-01T..." 같은 값에서 "2025-10-01"만 꺼낸다. 형식이 다르면 빈 문자열. */
export const toDateOnly = (value: string | null | undefined): string => {
    const matched = DATE_ONLY_PATTERN.exec(value ?? "");

    return matched ? `${matched[1]}-${matched[2]}-${matched[3]}` : "";
};

/** 날짜 문자열을 로컬 시간대 자정의 Date로 바꾼다. (하루 밀리지 않음) */
export const parseDateOnly = (value: string | null | undefined): Date => {
    const matched = DATE_ONLY_PATTERN.exec(value ?? "");

    if (!matched) {
        return new Date(NaN);
    }

    return new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]));
};

/** Date를 로컬 기준 "YYYY-MM-DD"로 바꾼다. toISOString()은 UTC라서 쓰면 안 된다. */
export const toLocalDateString = (date: Date): string =>
    [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");

/** 오늘 날짜(로컬 기준) */
export const todayDateString = (): string => toLocalDateString(new Date());

/** 어제 날짜(로컬 기준) */
export const yesterdayDateString = (): string => {
    const date = new Date();
    date.setDate(date.getDate() - 1);

    return toLocalDateString(date);
};

/**
 * 두 날짜 사이의 일수. DB에서 온 값이 문자열이든 Date든 날짜 부분만 보고 계산해서
 * 서버 시간대나 서머타임에 영향을 받지 않는다. 읽을 수 없는 값이면 0.
 */
export const daysBetween = (from: string | Date | null | undefined, to: string | Date | null | undefined): number => {
    const toKey = (value: string | Date | null | undefined) =>
        value instanceof Date ? toLocalDateString(value) : toDateOnly(value);

    const a = DATE_ONLY_PATTERN.exec(toKey(from));
    const b = DATE_ONLY_PATTERN.exec(toKey(to));

    if (!a || !b) {
        return 0;
    }

    const start = Date.UTC(Number(a[1]), Number(a[2]) - 1, Number(a[3]));
    const end = Date.UTC(Number(b[1]), Number(b[2]) - 1, Number(b[3]));

    return Math.round((end - start) / 86400000);
};
