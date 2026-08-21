import { LogoutLink } from '@/components/SessionBox';

/**
 * 로그인은 됐는데 볼 화면이 없는 계정.
 *
 * 빈 대시보드를 보여주지 않습니다 — 데이터가 없는 것과 권한이 없는 것을
 * 구분하지 못하면 사용자는 시스템이 고장 났다고 생각합니다.
 *
 * 통합 전에는 이 상태가 '로그인 화면으로 되돌아감'으로 보였습니다.
 * 방금 인증에 성공한 사람이 로그인 화면을 다시 보면 인증이 실패한 줄 압니다.
 */
export default function NoAccessPage() {
  return (
    <div
      style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--cl-bg-sub)',
      }}
    >
      <div
        style={{
          width: 460, background: 'var(--cl-bg)', border: '1px solid var(--cl-line)',
          borderRadius: 'var(--cl-r-hero)', padding: 'var(--cl-s7)',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 'var(--cl-title)', fontWeight: 700 }}>
          아직 사용할 수 있는 화면이 없습니다
        </h1>
        <p style={{ margin: 'var(--cl-s5) 0 0', color: 'var(--cl-text-sub)', lineHeight: 1.7 }}>
          로그인은 됐지만 이 계정에 운영자 권한도, 승인된 기관 소속도 없습니다.
          기관을 아직 등록하지 않았다면 운영자에게 기관 등록을, 이미 등록돼 있다면
          소속 승인을 요청하세요.
        </p>
        <p style={{ margin: 'var(--cl-s5) 0 0', fontSize: 'var(--cl-caption)', color: 'var(--cl-text-muted)', lineHeight: 1.7 }}>
          후보자 · 간병사 · 보호자 계정이라면 여기가 아니라 앱을 쓰세요.
          이 주소는 운영자와 기관 담당자를 위한 화면입니다.
        </p>
        <p style={{ margin: 'var(--cl-s5) 0 0', fontSize: 'var(--cl-caption)', color: 'var(--cl-text-muted)' }}>
          소속 승인과 사업자 검증은 별개입니다. 승인을 받아도 사업자 검증이 끝나기 전에는
          후보자가 익명 ID로만 표시됩니다.
        </p>
        <div style={{ marginTop: 'var(--cl-s6)' }}>
          <LogoutLink />
        </div>
      </div>
    </div>
  );
}
