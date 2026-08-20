import 'package:carelink_candidate/core/i18n/strings.dart';
import 'package:carelink_candidate/core/theme/tokens.dart';
import 'package:carelink_candidate/widgets/field_widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// FIELD 제약을 코드로 강제합니다.
///
/// `CLAUDE.md` §9 완료 기준: "모바일 화면은 최소 폰트 16px, 터치 타겟 48px
/// (고령 사용자 기준)". 이 테스트가 없으면 규칙은 리뷰어의 기억에만 남고,
/// 화면이 20개가 되는 순간 지켜지지 않습니다.
void main() {
  group('FIELD 토큰', () {
    test('본문 최소 16px — 12px 미만은 고령 사용자에게 없는 텍스트다', () {
      expect(CL.body, greaterThanOrEqualTo(CL.minFontSize));
      expect(CL.caption, greaterThanOrEqualTo(14.0));
      expect(CL.subtitle, greaterThan(CL.body));
    });

    test('FIELD에는 Micro(10.5px)가 없다', () {
      // DESK 토큰에는 있지만 여기엔 상수 자체를 두지 않았습니다.
      // 쓸 수 없는 값은 있으면 언젠가 쓰입니다.
      const fieldSizes = [CL.display, CL.title, CL.subtitle, CL.body, CL.caption];
      for (final size in fieldSizes) {
        expect(size, greaterThanOrEqualTo(14.0), reason: '$size px는 FIELD에 너무 작습니다');
      }
    });

    test('터치 타깃 48px 이상, 주요 액션은 56px 이상', () {
      expect(CL.minTapTarget, greaterThanOrEqualTo(48.0));
      expect(CL.primaryButtonHeight, greaterThanOrEqualTo(56.0));
      expect(CL.heroButtonHeight, greaterThanOrEqualTo(CL.primaryButtonHeight));
    });

    test('시그널 컬러는 3개뿐 — 상태를 늘릴 때 색을 늘리지 않는다', () {
      final signalColors = {CL.signal, CL.flag, CL.alert};
      expect(signalColors.length, 3);
    });
  });

  group('만료 임계값', () {
    // design/README §신규 컴포넌트 1 — D-90 이상 signal / D-89~D-31 flag / D-30 이하 alert
    test('D-90 이상은 signal', () {
      expect(expiryTone(90), Tone.signal);
      expect(expiryTone(365), Tone.signal);
    });

    test('D-89~D-31은 flag', () {
      expect(expiryTone(89), Tone.flag);
      expect(expiryTone(31), Tone.flag);
    });

    test('D-30 이하는 alert', () {
      expect(expiryTone(30), Tone.alert);
      expect(expiryTone(0), Tone.alert);
    });

    test('이미 만료된 것도 alert', () {
      expect(expiryTone(-1), Tone.alert);
      expect(expiryTone(-100), Tone.alert);
    });

    test('만료일이 없으면 neutral — 없는 것과 여유 있는 것은 다르다', () {
      expect(expiryTone(null), Tone.neutral);
    });
  });

  group('위젯 렌더', () {
    Widget wrap(Widget child) => MaterialApp(
          theme: buildFieldTheme(),
          home: Scaffold(body: SingleChildScrollView(child: child)),
        );

    testWidgets('StatusPill은 색·아이콘·텍스트 3중으로 표현한다', (tester) async {
      await tester.pumpWidget(wrap(const StatusPill(tone: Tone.alert, label: '만료')));

      // 텍스트가 있고
      expect(find.text('만료'), findsOneWidget);
      // 아이콘도 함께 있어야 합니다 — 색만으로 전달하면 반려 대상입니다.
      expect(find.byIcon(Tone.alert.icon), findsOneWidget);
    });

    testWidgets('ExpiryCountdown은 날짜가 아니라 D-day를 보여준다', (tester) async {
      await tester.pumpWidget(wrap(
        const ExpiryCountdown(days: 42, locale: AppLocale.ko, date: '2026-10-01'),
      ));

      expect(find.text('D-42'), findsOneWidget);
      // 날짜 원문은 화면에 직접 나오지 않습니다 (툴팁·상세에만).
      expect(find.text('2026-10-01'), findsNothing);
    });

    testWidgets('이미 만료됐으면 D+n과 만료 표시가 함께 나온다', (tester) async {
      await tester.pumpWidget(wrap(
        const ExpiryCountdown(days: -5, locale: AppLocale.ko),
      ));

      expect(find.text('D+5'), findsOneWidget);
      expect(find.text('만료됨'), findsOneWidget);
    });

    testWidgets('PrimaryButton은 56px 아래로 내려가지 않는다', (tester) async {
      await tester.pumpWidget(wrap(
        PrimaryButton(label: '지원하기', onPressed: () {}),
      ));

      final size = tester.getSize(find.byType(PrimaryButton));
      expect(size.height, greaterThanOrEqualTo(CL.primaryButtonHeight));
    });

    testWidgets('SecondaryButton도 48px 아래로 내려가지 않는다', (tester) async {
      await tester.pumpWidget(wrap(
        SecondaryButton(label: '다시 시도', onPressed: () {}),
      ));

      final size = tester.getSize(find.byType(SecondaryButton));
      expect(size.height, greaterThanOrEqualTo(CL.minTapTarget));
    });

    testWidgets('LocaleSwitcher는 4개 언어를 모두 보여준다', (tester) async {
      await tester.pumpWidget(wrap(
        LocaleSwitcher(current: AppLocale.ko, onChanged: (_) {}),
      ));

      expect(find.text('한국어'), findsOneWidget);
      expect(find.text('Tiếng Việt'), findsOneWidget);
      expect(find.text('Русский'), findsOneWidget);
      expect(find.text('English'), findsOneWidget);
    });

    testWidgets('러시아어 라벨이 들어가도 버튼이 넘치지 않는다', (tester) async {
      // 'Профессиональный путь' — 한국어 '커리어 여정'의 3.5배
      await tester.pumpWidget(wrap(
        SizedBox(
          width: 320,
          child: PrimaryButton(
            label: tr('journey.title', AppLocale.ru),
            onPressed: () {},
          ),
        ),
      ));

      // 오버플로 예외가 나면 이 시점에 테스트가 실패합니다.
      expect(tester.takeException(), isNull);
    });
  });
}
