import { calculateFederalTax } from "./federal";
import { calculateOntarioTax } from "./ontario";

export type CanadaTaxInput = {
    annualIncome: number;
    annualCppBase?: number;
    annualEi?: number;
    province?: string;
};

export type CanadaTaxResult = {
    federalTax: number;
    provincialTax: number;
    totalTax: number;
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export const calculateCanadaTaxes = ({
    annualIncome,
    annualCppBase = 0,
    annualEi = 0,
    province = "ON",
}: CanadaTaxInput): CanadaTaxResult => {
    const safeIncome = Math.max(0, Number(annualIncome) || 0);

    const safeCppBase = Math.max(0, Number(annualCppBase) || 0);

    const safeEi = Math.max(0, Number(annualEi) || 0);

    const federalTax = calculateFederalTax({
        annualIncome: safeIncome,
        annualCppBase: safeCppBase,
        annualEi: safeEi,
    });

    /*
     * For the current Canada implementation,
     * Ontario is the supported province.
     *
     * Other provinces will be added explicitly later.
     */
    const provincialTax =
        province === "ON"
            ? calculateOntarioTax({
                  annualIncome: safeIncome,
                  annualCppBase: safeCppBase,
                  annualEi: safeEi,
              })
            : 0;

    return {
        federalTax: roundMoney(federalTax),
        provincialTax: roundMoney(provincialTax),
        totalTax: roundMoney(federalTax + provincialTax),
    };
};
