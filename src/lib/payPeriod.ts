export type PayFrequency =
    | "weekly"
    | "biweekly"
    | "semi-monthly"
    | "monthly"
    | "custom";

export type SemiMonthlyType =
    | "first-fifteenth"
    | "fifteenth-end";

const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

export const getPayPeriodEndDate = (
    startDate: string,
    frequency: PayFrequency,
    semiMonthlyType?: SemiMonthlyType,
    customPayDays?: number,
) => {
    if (!startDate) {
        return "";
    }

    const date = new Date(startDate + "T00:00:00");

    // 날짜가 잘못 들어온 경우
    if (Number.isNaN(date.getTime())) {
        return "";
    }

    switch (frequency) {
        case "weekly":
            date.setDate(date.getDate() + 6);
            break;

        case "biweekly":
            date.setDate(date.getDate() + 13);
            break;

        case "monthly":
            date.setMonth(date.getMonth() + 1);
            date.setDate(date.getDate() - 1);
            break;

        case "semi-monthly":
            if (semiMonthlyType === "first-fifteenth") {
                if (date.getDate() <= 15) {
                    date.setDate(15);
                } else {
                    date.setMonth(date.getMonth() + 1);
                    date.setDate(0);
                }
            } else {
                if (date.getDate() <= 15) {
                    date.setDate(15);
                } else {
                    date.setMonth(date.getMonth() + 1);
                    date.setDate(15);
                }
            }
            break;

        case "custom":
            date.setDate(
                date.getDate() + (Number(customPayDays) || 14) - 1,
            );
            break;

        default:
            return "";
    }

    return formatDate(date);
};