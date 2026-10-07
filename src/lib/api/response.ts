// lib/api/response.ts
// 라우트가 공통으로 쓰는 응답 도구. 서버 오류의 상세 내용(DB 오류 문구 등)은 로그에만 남기고 응답에는 담지 않는다.
import { ValidationError } from "@/lib/api/validate";

export const unauthorized = () => Response.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });

export const badRequest = (message: string, code = "BAD_REQUEST") => Response.json({ error: message, code }, { status: 400 });

export const forbidden = (message: string, code: string) => Response.json({ error: message, code }, { status: 403 });

export const notFound = (message: string) => Response.json({ error: message, code: "NOT_FOUND" }, { status: 404 });

export const conflict = (message: string, code: string) => Response.json({ error: message, code }, { status: 409 });

export const serverError = (label: string, error: unknown, message: string) => {
    console.error(label, error);

    return Response.json({ error: message, code: "SERVER_ERROR" }, { status: 500 });
};

// catch 블록에서 사용: 검증 오류는 400, 그 외는 500
export const handleRouteError = (label: string, error: unknown, fallbackMessage: string) =>
    error instanceof ValidationError ? badRequest(error.message) : serverError(label, error, fallbackMessage);

// PostgreSQL 유니크 제약 위반 (오류 코드 23505)
export const isUniqueViolation = (error: unknown) =>
    typeof error === "object" && error !== null && (error as { code?: unknown }).code === "23505";

// 본문이 비었거나 JSON이 아니거나 객체가 아니면 null
export const readJsonBody = async (request: Request): Promise<Record<string, unknown> | null> => {
    try {
        const body: unknown = await request.json();

        return typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
    } catch {
        return null;
    }
};

// DELETE는 ?id=123 을 우선 사용하고, 없으면 본문 { id } 를 사용 (기존 호출 방식도 그대로 동작)
export const readIdFromRequest = async (request: Request): Promise<unknown> => {
    const fromQuery = new URL(request.url).searchParams.get("id");

    if (fromQuery !== null) {
        return fromQuery;
    }

    const body = await readJsonBody(request);

    return body?.id;
};
