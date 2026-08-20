import { errorLabel } from '@/lib/labels';

/**
 * 차단·실패 안내.
 *
 * **차단은 항상 사유와 함께**가 규칙입니다 (design/README §Interactions).
 * 코드만 던지거나 "실패했습니다"로 끝내면 운영자가 다음에 무엇을 해야 할지 모릅니다.
 */
export function ErrorNotice({ code, details }: { code: string; details?: Record<string, unknown> }) {
  return (
    <div
      style={{
        border: '1px solid var(--cl-alert-line)', background: 'var(--cl-alert-tint)',
        color: 'var(--cl-alert)', borderRadius: 'var(--cl-r-desk)',
        padding: 'var(--cl-s5)', fontSize: 'var(--cl-body)',
      }}
    >
      <strong style={{ display: 'block', marginBottom: 'var(--cl-s2)' }}>{errorLabel(code)}</strong>
      <span style={{ fontFamily: 'var(--cl-font-mono)', fontSize: 'var(--cl-micro)', opacity: 0.8 }}>{code}</span>
      {details && Object.keys(details).length > 0 && (
        <pre
          style={{
            margin: 'var(--cl-s3) 0 0', fontSize: 'var(--cl-caption)',
            fontFamily: 'var(--cl-font-mono)', whiteSpace: 'pre-wrap', opacity: 0.9,
          }}
        >
          {JSON.stringify(details, null, 2)}
        </pre>
      )}
    </div>
  );
}
