import { ConfigService } from '@nestjs/config';
import { PRESIGN_TTL_SECONDS, StorageService } from './storage.service';

function makeService(): StorageService {
  const config = { get: (k: string) => (k === 'JWT_SECRET' ? 'test-secret' : undefined) } as ConfigService;
  return new StorageService(config);
}

describe('StorageService — presigned URL', () => {
  const svc = makeService();

  it('만료는 5분이다 (docs/02 §13 · docs/11 §5)', () => {
    expect(PRESIGN_TTL_SECONDS).toBe(300);
    const { expiresAt } = svc.presign('candidates/c1/HEALTH/x.pdf', 'get');
    const deltaSeconds = Math.round((expiresAt.getTime() - Date.now()) / 1000);
    expect(deltaSeconds).toBeGreaterThan(290);
    expect(deltaSeconds).toBeLessThanOrEqual(300);
  });

  it('서명이 검증된다', () => {
    const key = 'candidates/c1/IDENTITY/p.jpg';
    const { url } = svc.presign(key, 'get');
    const q = new URL(url).searchParams;
    expect(svc.verify(key, 'get', Number(q.get('exp')), q.get('sig')!)).toBe(true);
  });

  it('키를 바꾸면 서명이 깨진다', () => {
    const { url } = svc.presign('candidates/c1/IDENTITY/p.jpg', 'get');
    const q = new URL(url).searchParams;
    expect(svc.verify('candidates/OTHER/IDENTITY/p.jpg', 'get', Number(q.get('exp')), q.get('sig')!)).toBe(false);
  });

  it('읽기 서명으로 쓰기를 할 수 없다', () => {
    const key = 'candidates/c1/IDENTITY/p.jpg';
    const { url } = svc.presign(key, 'get');
    const q = new URL(url).searchParams;
    expect(svc.verify(key, 'put', Number(q.get('exp')), q.get('sig')!)).toBe(false);
  });

  it('만료된 서명은 거부된다', () => {
    const key = 'candidates/c1/IDENTITY/p.jpg';
    const past = Math.floor(Date.now() / 1000) - 10;
    expect(svc.verify(key, 'get', past, 'whatever')).toBe(false);
  });

  it('파일 키에 후보자 id가 들어간다', () => {
    const key = svc.newFileKey('cand-1', 'CRIMINAL_RECORD', 'record.pdf');
    expect(key).toMatch(/^candidates\/cand-1\/CRIMINAL_RECORD\/.+\.pdf$/);
  });
});
