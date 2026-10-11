// lib/i18n/categories.ts
// 기본 카테고리의 이름은 DB 에 한국어로 저장돼 있다. (코드·집계·"기타"로 합치기 등이 이 이름에 기대고 있어서 그대로 둔다)
// 화면에 보여줄 때만 선택한 언어로 바꾸고, 사용자가 직접 만든 카테고리 이름은 적은 그대로 보여준다.
import type { MessageKey } from "@/lib/i18n";

const CATEGORY_LABEL_KEYS: Record<string, MessageKey> = {
    주거: "category.housing",
    통신: "category.telecom",
    식비: "category.food",
    교통: "category.transport",
    쇼핑: "category.shopping",
    여행: "category.travel",
    생활: "category.living",
    기타: "category.other",
    급여: "category.salary",
    용돈: "category.allowance",
    부수입: "category.sideIncome",
    환급: "category.refund",
    "이자/배당": "category.interest",
    항공: "category.flights",
    숙소: "category.lodging",
    "새 카테고리": "category.newOne",
};

type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

export const getCategoryLabel = (name: string, t: Translate) => {
    const key = CATEGORY_LABEL_KEYS[name];

    return key ? t(key) : name;
};
