// lib/i18n/warnings.ts
// 급여 계산 라이브러리가 만든 안내 문구(한국어 원문)를 화면 언어로 바꾼다.
// 계산 코드는 화면과 무관하게 두기 위해, 표시하는 쪽에서 원문을 보고 알맞은 문구를 찾는다.
import type { MessageKey, TranslateParams } from "./index";

type TFn = (key: MessageKey, params?: TranslateParams) => string;

export const translateWarning = (warning: string, t: TFn): string => {
    const holiday = warning.match(/^(.+)의 공휴일 수당 규칙은 아직 지원하지 않아 계산에서 제외했어요\.$/);

    if (holiday) {
        const area = holiday[1] === "지역 미선택" ? t("warn.noRegionName") : holiday[1];

        return t("warn.holidayUnsupported", { area });
    }

    const province = warning.match(/^(.+) 주 소득세는 아직 지원하지 않아 계산에서 제외했어요\.$/);

    if (province) {
        return t("warn.provincialTaxUnsupported", { province: province[1] });
    }

    if (warning === "지역(주)이 선택되지 않아 주 소득세를 계산에서 제외했어요.") {
        return t("warn.provincialTaxNoRegion");
    }

    if (warning.startsWith("공휴일 수당은 직전 4주 급여를")) {
        return t("warn.holidayEstimateCa");
    }

    if (warning.startsWith("유급휴일 수당은 공휴일이")) {
        return t("warn.holidayEstimateKr");
    }

    return warning;
};
