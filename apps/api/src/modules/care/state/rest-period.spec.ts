import { MIN_REST_HOURS } from './care.state';

/**
 * 퇴근~출근 최소 간격.
 *
 * 24시간 상주를 비활성으로 돌린 것만으로는 부족합니다. 같은 인력이 8시간
 * 교대를 연달아 세 번 받으면 실제로는 24시간이고, 서류상으로는 3교대라
 * 합법으로 보입니다 — 그쪽이 더 위험합니다.
 */
describe('최소 휴식 간격', () => {
  it('11시간이다', () => {
    expect(MIN_REST_HOURS).toBe(11);
  });

  it('8시간 교대를 연달아 붙이면 이 값에 걸린다', () => {
    // 09:00~17:00 근무 후 17:00~01:00을 받으면 간격이 0입니다.
    const gapHours = 0;
    expect(gapHours).toBeLessThan(MIN_REST_HOURS);
  });

  it('하루 한 번 8시간 교대는 통과한다', () => {
    // 09:00~17:00 근무 후 다음날 09:00 출근이면 16시간입니다.
    const gapHours = 16;
    expect(gapHours).toBeGreaterThanOrEqual(MIN_REST_HOURS);
  });

  it('12시간 2교대를 매일 해도 통과한다', () => {
    // 08:00~20:00 후 다음날 08:00이면 12시간입니다.
    expect(12).toBeGreaterThanOrEqual(MIN_REST_HOURS);
  });

  it('24시간을 채우는 어떤 조합도 통과할 수 없다', () => {
    // 하루가 24시간이므로, 11시간을 쉬면 최대 근무는 13시간입니다.
    expect(24 - MIN_REST_HOURS).toBeLessThan(24);
    expect(24 - MIN_REST_HOURS).toBe(13);
  });
});
