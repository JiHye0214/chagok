const KO = [
    { h: "수집하는 정보", p: "로그인 시 Google 또는 Kakao가 제공하는 이름, 이메일(카카오는 내부용 식별 주소), 프로필 사진. 앱에서 직접 입력한 급여·근무 일정·팁·생활비·여행 기록. 알림을 켠 경우 브라우저 푸시 구독 정보." },
    { h: "이용 목적", p: "로그인과 계정 구분, 입력하신 기록의 저장과 계산, 알림 발송. 광고나 판매 목적으로 사용하지 않습니다." },
    { h: "보관과 보호", p: "데이터는 Neon(PostgreSQL)에 저장되고 Vercel에서 서비스됩니다. 비밀번호는 저장하지 않으며, 모든 통신은 HTTPS로 이루어집니다." },
    { h: "제3자 제공", p: "법령에 따른 요구가 있는 경우를 제외하고 제3자에게 제공하지 않습니다. 로그인(Google/Kakao), 호스팅(Vercel), 데이터베이스(Neon)가 서비스 운영에 쓰입니다." },
    { h: "삭제", p: "설정에서 계정을 삭제하면 저장된 기록이 삭제됩니다." },
    { h: "문의", p: "devstudio.hey@gmail.com" },
];
const EN = [
    { h: "What we collect", p: "Name, email (Kakao uses an internal placeholder address) and profile photo from Google or Kakao sign-in; salary, schedule, tips, living and trip records you enter; and a browser push subscription if you enable alerts." },
    { h: "How we use it", p: "To sign you in, store and calculate your records, and send alerts. We do not sell your data or use it for ads." },
    { h: "Storage and protection", p: "Data is stored in Neon (PostgreSQL) and served by Vercel. We never store passwords, and all traffic uses HTTPS." },
    { h: "Sharing", p: "We do not share data with third parties except as required by law. Google/Kakao (sign-in), Vercel (hosting) and Neon (database) are used to run the service." },
    { h: "Deletion", p: "Deleting your account in Settings removes your stored records." },
    { h: "Contact", p: "devstudio.hey@gmail.com" },
];

export const metadata = { title: "Privacy Policy | Chagok" };

export default function Page() {
    return (
        <main style={{ maxWidth: 680, margin: "0 auto", padding: "32px 20px 64px", lineHeight: 1.7, color: "#111" }}>
            <h1 style={{ fontSize: 24, fontWeight: 800 }}>개인정보처리방침</h1>
            {KO.map((s) => (
                <section key={s.h} style={{ marginTop: 20 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 700 }}>{s.h}</h2>
                    <p style={{ color: "#444" }}>{s.p}</p>
                </section>
            ))}
            <hr style={{ margin: "40px 0", border: 0, borderTop: "1px solid #ddd" }} />
            <h1 style={{ fontSize: 24, fontWeight: 800 }}>Privacy Policy</h1>
            {EN.map((s) => (
                <section key={s.h} style={{ marginTop: 20 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 700 }}>{s.h}</h2>
                    <p style={{ color: "#444" }}>{s.p}</p>
                </section>
            ))}
        </main>
    );
}
