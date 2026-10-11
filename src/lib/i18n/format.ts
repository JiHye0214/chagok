// lib/i18n/format.ts
// 여러 화면에서 같은 모양으로 쓰는 문구 조합.
import type { MessageKey, TranslateParams } from "./index";

type TFn = (key: MessageKey, params?: TranslateParams) => string;

/** "2박 3일 · 4명" / "Day trip · 1 traveler" 처럼 여행 길이와 인원을 한 줄로 */
export const formatTripLength = (t: TFn, nights: number, people: number) => {
    const peopleText = t(people === 1 ? "trip.people.one" : "trip.people.other", { people });

    return nights === 0
        ? t("trip.length.day", { people: peopleText })
        : t("trip.length.nights", { nights, days: nights + 1, people: peopleText });
};
