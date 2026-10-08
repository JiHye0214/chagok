// lib/countries.ts
// 앱이 지원하는 나라·지역·언어를 정의하는 단 하나의 목록.
// 온보딩(국가·지역·닉네임), 로그인, 설정, 프로필 API가 모두 이 목록을 읽는다.
// 새 나라를 추가할 때는 COUNTRIES에 한 항목만 추가하면 화면과 서버 검증에 함께 나타난다.
// 급여 계산 지원 여부는 여기 적지 않고 급여 엔진(payroll, tax)에서 읽어 온다. (규칙이 없는데 "지원"으로 표시되는 일 방지)
import { isPayrollCountry } from "@/lib/payroll/calculatePayroll";
import { PROVINCIAL_TAX_RULES } from "@/lib/tax/ca/provinces";

export type LanguageConfig = {
    code: string;
    label: string;
    englishLabel: string;
};

export const LANGUAGES: readonly LanguageConfig[] = [
    { code: "ko", label: "한국어", englishLabel: "Korean" },
    { code: "en", label: "English", englishLabel: "English" },
];

export const DEFAULT_LANGUAGE = "ko";

export const isSupportedLanguage = (code: unknown): code is string =>
    typeof code === "string" && LANGUAGES.some((language) => language.code === code);

export type LoginProvider = "google" | "kakao";

type RegionDefinition = {
    code: string;
    name: string;
    // IANA 시간대
    timezone: string;
    // 화면에 보여주는 시간대 이름과 UTC 차이
    timezoneName: string;
    timezoneOffset: string;
    // 이 지역의 지방세 규칙이 있는지
    payrollSupported: boolean;
};

export type RegionConfig = RegionDefinition;

type CountryDefinition = {
    code: string;
    nameKo: string;
    // 설정 화면처럼 짧게 쓰는 이름. 없으면 nameKo
    shortNameKo?: string;
    nameEn: string;
    currency: string;
    // 지역이 없는 나라, 또는 지역을 고르기 전의 시간대
    defaultTimezone: string;
    // 지역을 골라야 하는 나라만 채운다
    regions: RegionDefinition[];
    loginProviders: LoginProvider[];
};

export type CountryConfig = CountryDefinition & {
    // 이 나라의 급여 계산 규칙이 있는지
    payrollSupported: boolean;
    hasRegions: boolean;
};

const DEFINITIONS: CountryDefinition[] = [
    {
        code: "KR",
        nameKo: "대한민국",
        shortNameKo: "한국",
        nameEn: "South Korea",
        currency: "KRW",
        defaultTimezone: "Asia/Seoul",
        regions: [],
        loginProviders: ["google", "kakao"],
    },
    {
        code: "CA",
        nameKo: "캐나다",
        nameEn: "Canada",
        currency: "CAD",
        defaultTimezone: "America/Toronto",
        regions: [
            {
                code: "BC",
                name: "British Columbia",
                timezone: "America/Vancouver",
                timezoneName: "Pacific Time",
                timezoneOffset: "(GMT-7)",
                payrollSupported: Boolean(PROVINCIAL_TAX_RULES.BC),
            },
            {
                code: "ON",
                name: "Ontario",
                timezone: "America/Toronto",
                timezoneName: "Eastern Time",
                timezoneOffset: "(GMT-4)",
                payrollSupported: Boolean(PROVINCIAL_TAX_RULES.ON),
            },
        ],
        loginProviders: ["google"],
    },
];

export const COUNTRIES: readonly CountryConfig[] = DEFINITIONS.map((definition) => ({
    ...definition,
    payrollSupported: isPayrollCountry(definition.code),
    hasRegions: definition.regions.length > 0,
}));

export const getCountry = (code: string | null | undefined): CountryConfig | undefined =>
    code ? COUNTRIES.find((country) => country.code === code.toUpperCase()) : undefined;

export const getRegion = (countryCode: string | null | undefined, regionCode: string | null | undefined) =>
    regionCode ? getCountry(countryCode)?.regions.find((region) => region.code === regionCode.toUpperCase()) : undefined;

// 설정 등에서 나라 이름을 보여줄 때. 목록에 없는 코드는 코드 그대로.
export const getCountryLabel = (code: string | null | undefined, options?: { short?: boolean }) => {
    const country = getCountry(code);

    if (!country) {
        return code ?? "";
    }

    return options?.short ? (country.shortNameKo ?? country.nameKo) : country.nameKo;
};

export const getRegionLabel = (countryCode: string | null | undefined, regionCode: string | null | undefined) =>
    getRegion(countryCode, regionCode)?.name ?? regionCode ?? "";

/*
 * 온보딩 단계 번호. 지역을 고르는 나라는 한 단계가 더 있다.
 * 언어 01 → 국가 02 → (지역 03) → 로그인 → 닉네임
 */
export type OnboardingStep = "language" | "country" | "region" | "login" | "nickname";

export const getOnboardingStepNumber = (step: OnboardingStep, countryCode: string | null | undefined) => {
    const regionStep = getCountry(countryCode)?.hasRegions ? 1 : 0;

    const number =
        step === "language" ? 1 : step === "country" ? 2 : step === "region" ? 3 : step === "login" ? 3 + regionStep : 4 + regionStep;

    return String(number).padStart(2, "0");
};

export type ResolvedLocation = {
    countryCode: string;
    provinceCode: string | null;
    currency: string;
    timezone: string;
};

/*
 * 프로필 저장 시 국가·지역을 검증하고, 통화와 시간대를 목록에서 정한다.
 * 통화·시간대를 화면이 보낸 값으로 믿지 않는다. (한국인데 USD, 임의의 시간대 같은 조합 방지)
 */
export const resolveLocation = (
    countryCode: unknown,
    provinceCode: unknown,
): { ok: true; value: ResolvedLocation } | { ok: false; error: string } => {
    const country = typeof countryCode === "string" ? getCountry(countryCode) : undefined;

    if (!country) {
        return { ok: false, error: "지원하지 않는 국가예요." };
    }

    if (!country.hasRegions) {
        return {
            ok: true,
            value: { countryCode: country.code, provinceCode: null, currency: country.currency, timezone: country.defaultTimezone },
        };
    }

    const region = typeof provinceCode === "string" ? getRegion(country.code, provinceCode) : undefined;

    if (!region) {
        return { ok: false, error: `${country.nameKo}의 지역 정보를 확인할 수 없어요. 지역을 선택해 주세요.` };
    }

    return {
        ok: true,
        value: { countryCode: country.code, provinceCode: region.code, currency: country.currency, timezone: region.timezone },
    };
};
