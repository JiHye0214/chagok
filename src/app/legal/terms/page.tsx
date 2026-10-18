const KO = [
    { h: "서비스", p: "차곡은 급여, 생활비, 여행 지출을 기록하고 계산을 돕는 개인용 앱입니다." },
    { h: "계산 결과", p: "세금·급여 계산은 참고용 추정치이며 실제 금액과 다를 수 있습니다. 법률·세무·재무 자문이 아닙니다." },
    { h: "계정", p: "본인 계정으로만 이용해 주세요. 계정 보안은 이용자 본인이 관리합니다." },
    { h: "금지", p: "서비스를 방해하거나 타인의 데이터에 접근하려는 행위는 금지됩니다." },
    { h: "변경과 중단", p: "서비스 내용은 예고 없이 바뀌거나 중단될 수 있습니다." },
    { h: "문의", p: "qkrwlgp1526@gmail.com" },
];
const EN = [
    { h: "Service", p: "Chagok is a personal app for recording and estimating salary, living costs and trip spending." },
    { h: "Estimates", p: "Tax and pay figures are estimates for reference and may differ from actual amounts. This is not legal, tax or financial advice." },
    { h: "Accounts", p: "Use only your own account and keep it secure." },
    { h: "Prohibited", p: "Do not disrupt the service or try to access other people's data." },
    { h: "Changes", p: "The service may change or stop without notice." },
    { h: "Contact", p: "qkrwlgp1526@gmail.com" },
];

export const metadata = { title: "Terms of Service | Chagok" };

export default function Page() {
    return (
        <main style={{ maxWidth: 680, margin: "0 auto", padding: "32px 20px 64px", lineHeight: 1.7, color: "#111" }}>
            <h1 style={{ fontSize: 24, fontWeight: 800 }}>이용약관</h1>
            {KO.map((s) => (
                <section key={s.h} style={{ marginTop: 20 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 700 }}>{s.h}</h2>
                    <p style={{ color: "#444" }}>{s.p}</p>
                </section>
            ))}
            <hr style={{ margin: "40px 0", border: 0, borderTop: "1px solid #ddd" }} />
            <h1 style={{ fontSize: 24, fontWeight: 800 }}>Terms of Service</h1>
            {EN.map((s) => (
                <section key={s.h} style={{ marginTop: 20 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 700 }}>{s.h}</h2>
                    <p style={{ color: "#444" }}>{s.p}</p>
                </section>
            ))}
        </main>
    );
}
