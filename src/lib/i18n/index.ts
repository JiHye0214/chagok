// lib/i18n/index.ts
// 화면 문구 번역. 서버·클라이언트 어디서나 쓸 수 있는 순수 함수만 둔다.
import { ko, type MessageKey } from "./messages/ko";
import { en } from "./messages/en";

// 선택한 언어에 문구가 없을 때 대신 보여줄 언어 (앱의 기본 언어와 같다)
const FALLBACK_LANGUAGE = "en";

export type { MessageKey };

export type TranslateParams = Record<string, string | number>;

const DICTIONARIES: Record<string, Record<MessageKey, string>> = { ko, en };

/*
 * 문구를 찾아 {이름} 자리를 채운다.
 * 선택한 언어에 없으면 영어, 영어에도 없으면 키 자체를 돌려준다. (화면이 비지 않게)
 */
export const translate = (language: string, key: MessageKey, params?: TranslateParams): string => {
    const template = DICTIONARIES[language]?.[key] ?? DICTIONARIES[FALLBACK_LANGUAGE]?.[key] ?? key;

    if (!params) {
        return template;
    }

    return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
};

// 날짜·숫자·통화 표시에 쓰는 지역 코드
export const getLocale = (language: string) => (language === "en" ? "en-CA" : "ko-KR");
