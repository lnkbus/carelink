import 'package:carelink_field/core/i18n/strings.dart';
import 'package:carelink_field/models/caregiver_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('문구 사전', () {
    test('모든 키가 4개 언어를 전부 가진다', () {
      // 키가 한 언어라도 빠지면 그 언어 사용자에게 키 원문이 그대로 보입니다.
      // 간병 인력의 상당수가 외국인이라 이 앱에서는 특히 그렇습니다.
      final missing = <String>[];
      dictForTest.forEach((key, byLocale) {
        for (final l in AppLocale.values) {
          if (!byLocale.containsKey(l) || (byLocale[l] ?? '').isEmpty) {
            missing.add('$key/${l.code}');
          }
        }
      });
      expect(missing, isEmpty, reason: '빠진 번역: ${missing.join(', ')}');
    });

    test('환자 신원에 해당하는 키가 존재하지 않는다', () {
      // 사전에 없으면 화면에 그릴 수도 없습니다 (docs/11 §3.2).
      // 여기에 키를 추가하고 싶어지면 "이게 없으면 일을 못 하는가"를 먼저 물으세요.
      const banned = [
        'patient.name', 'patient.age', 'patient.gender',
        'patient.diagnosis', 'detail.diagnosis', 'detail.patientName',
      ];
      for (final k in banned) {
        expect(dictForTest.containsKey(k), isFalse, reason: '$k 키가 생겼습니다');
      }
    });

    test('도메인 코드도 4개 언어를 전부 가진다', () {
      // H8_3SHIFT를 그대로 띄우면 한국어 사용자에게도 읽히지 않고,
      // 외국인 인력에게는 아무 의미도 없습니다 (§5.15).
      final missing = <String>[];
      codesForTest.forEach((code, byLocale) {
        for (final l in AppLocale.values) {
          if ((byLocale[l] ?? '').isEmpty) missing.add('$code/${l.code}');
        }
      });
      expect(missing, isEmpty, reason: '빠진 코드 번역: ${missing.join(", ")}');
    });

    test('서비스 카탈로그 코드가 전부 사전에 있다', () {
      // docs/03의 care_service_items 시드와 같아야 합니다. 빠지면 화면에
      // 코드 원문이 뜹니다. 의료행위는 카탈로그에 없으므로 여기에도 없습니다 (§6-2).
      const catalog = [
        'COMPANION', 'DAILY_SUPPORT', 'HYGIENE',
        'MEAL_SUPPORT', 'MOBILITY', 'POSITION_CHANGE',
      ];
      for (final c in catalog) {
        expect(codesForTest.containsKey(c), isTrue, reason: '$c 라벨이 없습니다');
      }
      // 반대 방향 — 사전에 의료행위가 들어오면 안 됩니다.
      const banned = ['MEDICATION', 'INJECTION', 'SUCTION', 'WOUND_CARE', 'BLOOD_SUGAR'];
      for (final c in banned) {
        expect(codesForTest.containsKey(c), isFalse, reason: '$c 가 카탈로그 라벨에 생겼습니다');
      }
    });

    test('알 수 없는 코드는 원문을 돌려준다 — 화면이 비지 않는다', () {
      expect(codeLabel('NEW_ITEM_FROM_SERVER', AppLocale.ko), 'NEW_ITEM_FROM_SERVER');
      expect(codeLabel(null, AppLocale.ko), '—');
    });

    test('오류 코드가 사람이 읽을 문구로 바뀐다', () {
      // 간병사에게 CARE_QR_TOKEN_MISMATCH는 아무 의미도 없고
      // 앱이 고장 난 것처럼 보입니다.
      expect(errorKey('CARE_QR_TOKEN_MISMATCH'), 'error.qrMismatch');
      expect(errorKey('CARE_AVAILABILITY_BOOKED'), 'error.availabilityBooked');
      expect(errorKey(null), 'error.network');
      expect(errorKey('무언가_처음_보는_코드'), 'error.generic');
      // 매핑된 키는 전부 사전에 있어야 합니다 — 없으면 키 원문이 화면에 뜹니다.
      for (final code in ['CARE_QR_TOKEN_MISMATCH', 'CARE_QR_TOKEN_REQUIRED',
                          'COMMON_INVALID_TRANSITION', 'CARE_AVAILABILITY_BOOKED', null]) {
        expect(dictForTest.containsKey(errorKey(code)), isTrue, reason: '$code');
      }
      expect(dictForTest.containsKey(errorKey('X')), isTrue);
    });
  });

  group('근무 상세 모델', () {
    test('환자 신원 필드를 내려줘도 모델이 받지 않는다', () {
      // API가 실수로 필드를 늘려도 앱은 그리지 않습니다. 게이트를 두 겹
      // 두는 이유는, 한 겹만 두면 그 한 겹이 뚫렸을 때 곧바로 노출되기 때문입니다.
      final d = AssignmentDetail.fromJson({
        'assignmentId': 'a1',
        'status': 'ASSIGNED',
        'hospitalName': '○○병원',
        'ward': '703호',
        'shiftPatternCode': 'H8_3SHIFT',
        'startAt': '2026-09-10T00:00:00.000Z',
        'supportItems': ['MEAL_SUPPORT'],
        'mobilityLevel': 'PARTIAL_ASSIST',
        'cautions': '밤에 자주 깨십니다',
        'restrictedFlags': <String>[],
        // 아래는 있어서는 안 되는 값들입니다.
        'patientName': '김영수',
        'diagnosis': '뇌경색',
        'age': 82,
      });
      expect(d.ward, '703호');
      // 모델에 필드가 없으므로 접근 자체가 불가능합니다. 런타임에도
      // 어디에도 담기지 않는지 확인합니다.
      expect(d.toString().contains('김영수'), isFalse);
      expect(d.cautions, '밤에 자주 깨십니다');
    });

    test('업무범위 감지 이력이 간병사에게 전달된다', () {
      // 현장에서 같은 요구를 받을 수 있고, 그때 거절할 근거가 됩니다.
      final d = AssignmentDetail.fromJson({
        'assignmentId': 'a1', 'status': 'ASSIGNED', 'hospitalName': null,
        'ward': '502호', 'shiftPatternCode': null,
        'startAt': '2026-09-10T00:00:00.000Z',
        'supportItems': <String>[], 'mobilityLevel': null, 'cautions': null,
        'restrictedFlags': ['MEDICATION', 'WOUND_CARE'],
      });
      expect(d.restrictedFlags, ['MEDICATION', 'WOUND_CARE']);
    });
  });

  group('배정 상태', () {
    Assignment make(String status) => Assignment.fromJson({
          'id': 'a', 'careRequestId': 'r', 'status': status,
          'offeredAt': '2026-09-01T00:00:00.000Z',
        });

    test('수락은 확정이 아니다 — 담당자 확인이 남는다 (§6-4)', () {
      expect(make('ACCEPTED').isWaitingConfirm, isTrue);
      expect(make('ACCEPTED').isToday, isFalse);
    });

    test('확정된 배정만 오늘 근무로 잡힌다', () {
      expect(make('ASSIGNED').isToday, isTrue);
      expect(make('IN_SERVICE').isToday, isTrue);
      expect(make('OFFERED').isToday, isFalse);
      expect(make('DECLINED').isToday, isFalse);
    });
  });

  group('가용 구간', () {
    test('AVAILABLE과 BLOCKED를 구분한다', () {
      AvailabilityBlock b(String kind) => AvailabilityBlock.fromJson({
            'id': 'x', 'startsAt': '2026-09-01T00:00:00.000Z',
            'endsAt': '2026-09-10T00:00:00.000Z', 'kind': kind,
          });
      expect(b('BLOCKED').isBlocked, isTrue);
      expect(b('AVAILABLE').isBlocked, isFalse);
    });
  });
}
