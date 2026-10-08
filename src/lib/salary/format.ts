// lib/salary/format.ts
// 금액 표시. 통화(KRW/CAD/USD)에 맞는 기호와 소수점 자리를 사용한다. (화면마다 "$"를 직접 붙이던 것을 대체)

const getCurrencyLocale = (currencyCode: string) => {
    switch (currencyCode) {
        case "KRW":
            return "ko-KR";
        case "USD":
            return "en-US";
        default:
            return "en-CA";
    }
};

export const formatCurrency = (value: number, currencyCode: string | null) => {
    const amount = Number(value);
    const safeAmount = Number.isFinite(amount) ? amount : 0;

    // 통화를 아직 모르면(프로필 로딩 중) 기호 없이 숫자만 보여준다
    if (!currencyCode) {
        return safeAmount.toFixed(2);
    }

    const fractionDigits = currencyCode === "KRW" ? 0 : 2;

    return new Intl.NumberFormat(getCurrencyLocale(currencyCode), {
        style: "currency",
        currency: currencyCode,
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    }).format(safeAmount);
};

// 입력란 앞에 붙이는 통화 기호 (KRW → ₩, CAD/USD → $). 통화를 모르면 빈 문자열.
export const getCurrencySymbol = (currencyCode: string | null) => {
    if (!currencyCode) {
        return "";
    }

    try {
        const parts = new Intl.NumberFormat(getCurrencyLocale(currencyCode), {
            style: "currency",
            currency: currencyCode,
            currencyDisplay: "narrowSymbol",
        }).formatToParts(0);

        return parts.find((part) => part.type === "currency")?.value ?? currencyCode;
    } catch {
        return currencyCode;
    }
};
