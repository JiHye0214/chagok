import { calculateFederalTax } from "./federal";
import { calculateOntarioTax } from "./ontario";

const provinceNames: Record<string, string> = {
    ON: "온타리오",
    BC: "브리티시컬럼비아",
    AB: "앨버타",
    SK: "서스캐처원",
    MB: "매니토바",
    QC: "퀘벡",
    NS: "노바스코샤",
    NB: "뉴브런즈윅",
    NL: "뉴펀들랜드 래브라도",
    PE: "프린스에드워드아일랜드",
    YT: "유콘",
    NT: "노스웨스트 준주",
    NU: "누나부트",
};

export const calculateCanadaTaxes = (annualGross: number, province: string) => {
    const federalTax = calculateFederalTax(annualGross);

    let provincialTax = 0;

    if (province === "ON") {
        provincialTax = calculateOntarioTax(annualGross);
    }

    // 2026 CPP
    const cpp = Math.min(Math.max(0, annualGross - 3500) * 0.0595, 4230.45);

    // 2026 CPP2
    const cpp2 = Math.min(Math.max(0, annualGross - 74600) * 0.04, 416);

    // 2026 EI
    const ei = Math.min(annualGross * 0.0163, 1123.07);

    return {
        deductions: [
            {
                key: "cpp",
                name: "CPP",
                amount: cpp,
            },
            {
                key: "cpp2",
                name: "CPP2",
                amount: cpp2,
            },
            {
                key: "ei",
                name: "EI",
                amount: ei,
            },
            {
                key: "federalTax",
                name: "Federal Tax",
                amount: federalTax,
            },
            {
                key: "provincialTax",
                name: provinceNames[province] ? `${provinceNames[province]} 세금` : "Provincial Tax",
                amount: provincialTax,
            },
        ],

        totalDeductions: cpp + cpp2 + ei + federalTax + provincialTax,
    };
};
