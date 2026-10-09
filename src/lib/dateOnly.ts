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
