/**
 * 소속 승인이 없는 사용자.
 *
 * 빈 대시보드를 보여주지 않습니다 — 데이터가 없는 것과 권한이 없는 것을
 * 구분하지 못하면 사용자는 시스템이 고장 났다고 생각합니다.
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
          승인된 기관 소속이 없습니다
        </h1>
        <p style={{ margin: 'var(--cl-s5) 0 0', color: 'var(--cl-text-sub)', lineHeight: 1.7 }}>
          기관 웹은 승인된 담당자만 사용할 수 있습니다. 기관을 아직 등록하지 않았다면
          운영자에게 기관 등록을, 이미 등록돼 있다면 소속 승인을 요청하세요.
        </p>
        <p style={{ margin: 'var(--cl-s5) 0 0', fontSize: 'var(--cl-caption)', color: 'var(--cl-text-muted)' }}>
          소속 승인과 사업자 검증은 별개입니다. 승인을 받아도 사업자 검증이 끝나기 전에는
          후보자가 익명 ID로만 표시됩니다.
        </p>
      </div>
    </div>
  );
}
