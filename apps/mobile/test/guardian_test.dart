import 'package:carelink_field/core/i18n/strings.dart';
import 'package:carelink_field/models/guardian_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('간병사 카드 — 보호자에게 나가는 것', () {
    test('국적·실명을 내려줘도 모델이 받지 않는다 (§6-21 · §5.10)', () {
      // 게이트를 세 겹으로 둡니다: API가 안 주고 · 모델에 필드가 없고 ·
      // 화면이 그리지 않습니다. 화면이 늘어나면 어느 한 겹은 뚫립니다.
      //
      // 보호자가 국적으로 고르기 시작하면 그것이 배정 관행이 되고,
      // 검증을 통과한 인력이 국적 때문에 선택받지 못합니다.
      final c = CaregiverCard.fromJson({
        'caregiverId': 'cg1',
        'displayCode': 'CG-2001',
        'experienceYrs': 4,
        'completedCount': 37,
        'available': true,
        'ratingAvg': 4.8,
        // 아래는 있어서는 안 되는 값들입니다.
        'name': '응우옌 티 흐엉',
        'nationality': '베트남',
        'phone': '01044440001',
        'visaStatusCode': 'E-9',
      });
      expect(c.displayCode, 'CG-2001');
      final dumped = c.toString();
      expect(dumped.contains('응우옌'), isFalse);
      expect(dumped.contains('베트남'), isFalse);
      expect(dumped.contains('01044440001'), isFalse);
    });

    test('금액 필드가 모델에 없다 (§6-8 · U6 미확정)', () {
      // 자리를 만들면 화면이 채우려 들고, 그렇게 뜬 숫자는 보호자에게
      // 약속으로 읽힙니다. 4대보험·퇴직금을 반영한 청구 단가가 확정되기
      // 전에는 숫자를 만들지 않습니다.
      final c = CaregiverCard.fromJson({
        'caregiverId': 'cg1', 'displayCode': 'CG-2001',
        'experienceYrs': 1, 'completedCount': 0, 'available': true,
        'dailyRate': 128000, 'totalAmount': 1024000,
      });
      expect(c.toString().contains('128000'), isFalse);
      expect(c.toString().contains('1024000'), isFalse);
    });
  });

  group('간병 요청 상태', () {
    CareRequest make(String status) => CareRequest.fromJson({
          'id': 'r1', 'status': status, 'serviceType': 'DAY',
          'startAt': '2026-09-10T00:00:00.000Z',
        });

    test('진행 중과 완료를 구분한다 — 홈은 진행 중만 크게 띄운다', () {
      expect(make('IN_SERVICE').isLive, isTrue);
      expect(make('OPS_REVIEW').isLive, isTrue);
      expect(make('COMPLETED').isLive, isFalse);
      expect(make('COMPLETED').isDone, isTrue);
      expect(make('CANCELLED').isDone, isTrue);
    });

    test('업무범위 검토는 별도로 식별된다 — 거절이 아니다 (§6-15)', () {
      // 거절로 처리하면 표현만 바꿔서 다시 씁니다. 사람이 확인하고
      // 설명해야 하고, 그동안 보호자에게는 '취소가 아니다'라고 말해야 합니다.
      expect(make('OPS_REVIEW').inScopeReview, isTrue);
      expect(make('MATCHING').inScopeReview, isFalse);
    });
  });

  group('배정 상태', () {
    CareAssignment make(String status) => CareAssignment.fromJson({
          'id': 'a1', 'careRequestId': 'r1',
          'caregiverDisplayCode': 'CG-2001', 'status': status,
        });

    test('제안·수락은 확정이 아니다 — 담당자 확인이 남는다 (§6-4)', () {
      expect(make('OFFERED').isPending, isTrue);
      expect(make('ACCEPTED').isPending, isTrue);
      expect(make('ACCEPTED').isFixed, isFalse);
      expect(make('ASSIGNED').isFixed, isTrue);
    });
  });

  group('보호자 문구', () {
    test('24시간 상주를 고를 수 있다고 말하는 문구가 없다 (§5.12)', () {
      // 목록에서 뺀 것만으로는 부족합니다. 문구 어딘가에 '24시간 상주'가
      // 선택지처럼 적혀 있으면 보호자는 그것을 찾다가 전화를 겁니다.
      final ko = dictForTest['guardian.form.no24h']?[AppLocale.ko] ?? '';
      expect(ko.contains('운영하지 않습니다'), isTrue);
      expect(ko.contains('3교대'), isTrue);
    });

    test('보호자 문구에 환자·간병사 신원 키가 없다', () {
      const banned = [
        'guardian.caregiver.name', 'guardian.caregiver.nationality',
        'guardian.patient.name', 'guardian.patient.diagnosis',
      ];
      for (final k in banned) {
        expect(dictForTest.containsKey(k), isFalse, reason: '$k 키가 생겼습니다');
      }
    });

    test('비용 자리는 남기되 숫자가 아니라 안내 문구다 (§6-8)', () {
      for (final l in AppLocale.values) {
        final v = dictForTest['guardian.cost.staffGuided']?[l] ?? '';
        expect(v, isNotEmpty);
        expect(RegExp(r'[0-9]').hasMatch(v), isFalse, reason: '$l 에 숫자가 들어갔습니다');
      }
    });
  });
}
