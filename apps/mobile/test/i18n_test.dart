import 'package:carelink_field/core/i18n/strings.dart';
import 'package:flutter_test/flutter_test.dart';

/// i18n은 처음부터 붙입니다 (§5.15). 나중에 붙이면 전면 수정입니다.
///
/// 사람이 눈으로 4개 언어를 맞추는 방식은 키가 100개를 넘는 순간 실패합니다.
/// 빠진 키는 화면에서 키 원문(`jobs.apply`)으로 보이는데, 그걸 발견하는 사람은
/// 그 언어를 쓰는 사용자뿐이고 그때는 이미 배포된 뒤입니다.
void main() {
  group('번역 사전', () {
    test('모든 키가 4개 언어를 전부 가진다', () {
      final missing = <String>[];
      for (final entry in translationTable.entries) {
        for (final locale in AppLocale.values) {
          if (!entry.value.containsKey(locale)) {
            missing.add('${entry.key} → ${locale.code}');
          }
        }
      }
      expect(missing, isEmpty, reason: '누락된 번역:\n${missing.join('\n')}');
    });

    test('빈 문자열인 번역이 없다', () {
      final blanks = <String>[];
      for (final entry in translationTable.entries) {
        for (final e in entry.value.entries) {
          if (e.value.trim().isEmpty) blanks.add('${entry.key} → ${e.key.code}');
        }
      }
      expect(blanks, isEmpty, reason: '빈 번역:\n${blanks.join('\n')}');
    });

    test('한국어 문구를 그대로 복사한 다른 언어가 없다', () {
      // 브랜드명처럼 번역하지 않는 것은 예외로 둡니다 (D-13).
      // 워드마크를 음차하면 그 표기로는 아무도 검색하지 못합니다.
      const untranslated = {'app.name', 'brand.name'};
      final copies = <String>[];
      for (final entry in translationTable.entries) {
        if (untranslated.contains(entry.key)) continue;
        final ko = entry.value[AppLocale.ko];
        for (final e in entry.value.entries) {
          if (e.key != AppLocale.ko && e.value == ko) {
            copies.add('${entry.key} → ${e.key.code}');
          }
        }
      }
      expect(copies, isEmpty, reason: '번역되지 않고 복사된 문구:\n${copies.join('\n')}');
    });

    test('러시아어는 고려인 세그먼트 때문에 필수다 — 목록에서 빠지지 않았는지', () {
      expect(AppLocale.values, contains(AppLocale.ru));
      expect(AppLocale.values.length, 4);
    });

    test('없는 키는 키 원문을 돌려준다 — 빈칸으로 뭉개지 않는다', () {
      expect(tr('no.such.key', AppLocale.ko), 'no.such.key');
    });

    test('확장률을 관측한다 — 고정폭 위젯을 쓰면 안 되는 이유', () {
      // SCR-110 notes는 "한국어 기준 길이의 2.5배를 수용하도록 설계하세요"라고
      // 합니다. **2.5배를 넘지 말라는 뜻이 아니라 넘는 것을 전제로 설계하라는 뜻**입니다.
      // 그래서 이 테스트는 실패시키지 않고 실제 배율을 기록만 합니다 —
      // 번역을 줄여서 통과시키면 사양이 요구한 방향과 반대로 갑니다.
      final ratios = <String, double>{};
      for (final entry in translationTable.entries) {
        final ko = entry.value[AppLocale.ko]!.length;
        if (ko < 6) continue; // 짧은 라벨은 비율이 산술 artifact다 ('홈' → 'Trang chủ')
        for (final e in entry.value.entries) {
          if (e.key == AppLocale.ko) continue;
          ratios['${entry.key}(${e.key.code})'] = e.value.length / ko;
        }
      }
      final worst = ratios.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
      // ignore: avoid_print
      print('확장률 상위 5: ${worst.take(5).map((e) => '${e.key} ×${e.value.toStringAsFixed(1)}').join(', ')}');
      expect(ratios, isNotEmpty);
    });

    test('버튼에 넣을 수 없을 만큼 긴 라벨이 없다', () {
      // 절대 길이가 진짜 제약입니다. 56px 버튼 한 줄에 들어가는 한계를
      // 넘으면 어느 언어든 잘리거나 줄바꿈됩니다.
      const buttonKeys = [
        'login.sendCode', 'login.submit', 'login.changeNumber',
        'jobs.apply', 'jobs.applied', 'track.select',
        'training.continue', 'training.enroll',
        'documents.upload', 'profile.save', 'settings.logout',
        'common.retry', 'common.next', 'common.close',
      ];
      final tooLong = <String>[];
      for (final key in buttonKeys) {
        final entry = translationTable[key];
        expect(entry, isNotNull, reason: '$key 가 사전에 없습니다');
        for (final e in entry!.entries) {
          if (e.value.length > 32) tooLong.add('$key(${e.key.code}) ${e.value.length}자');
        }
      }
      expect(tooLong, isEmpty, reason: '버튼 라벨이 너무 깁니다:\n${tooLong.join('\n')}');
    });

  });
}
