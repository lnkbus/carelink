import 'package:flutter/material.dart';

/// CARELINK FIELD 디자인 토큰.
///
/// `design/README.md`의 `## Design Tokens`가 유일한 기준입니다.
/// `docs/09` §5.1의 원본 팔레트(저채도 signal `#1F6F5C`)는 쓰지 않습니다.
///
/// 시그널 컬러는 3개(초록·앰버·적)뿐입니다. 상태를 늘릴 때 색을 늘리지 말고
/// 아이콘+텍스트로 구분하세요 — 색만으로 상태를 전달하는 구현은 반려 대상입니다.
class CL {
  const CL._();

  // ── 액션 ────────────────────────────────────────────────────────────────
  static const action = Color(0xFF2F6BFF);
  static const actionStrong = Color(0xFF2560E8);
  static const actionText = Color(0xFF1B57E0);
  static const actionTint = Color(0xFFEFF4FF);

  // ── 시그널 3종 ──────────────────────────────────────────────────────────
  static const signal = Color(0xFF00703A);
  static const signalTint = Color(0xFFE6F7EF);
  static const flag = Color(0xFF8A5300);
  static const flagIcon = Color(0xFFC77700);
  static const flagTint = Color(0xFFFFF6E5);
  static const flagLine = Color(0xFFEBD9A8);
  static const alert = Color(0xFFC7302A);
  static const alertTint = Color(0xFFFEECEA);
  static const alertLine = Color(0xFFFBD5D0);

  // ── 텍스트 ──────────────────────────────────────────────────────────────
  static const text = Color(0xFF191F28);
  static const textSub = Color(0xFF4E5968);
  static const textMuted = Color(0xFF6B7684);
  static const textDisabled = Color(0xFF8B95A1);

  // ── 면·선 ───────────────────────────────────────────────────────────────
  static const line = Color(0xFFE5E8EB);
  static const lineStrong = Color(0xFFC6CCD6);
  static const bg = Color(0xFFFFFFFF);
  static const bgSub = Color(0xFFF2F4F6);

  // ── 간격 스케일 ─────────────────────────────────────────────────────────
  // 4 · 6 · 8 · 10 · 14 · 20 · 28 · 40 외의 값을 쓰지 마세요.
  static const s1 = 4.0;
  static const s2 = 6.0;
  static const s3 = 8.0;
  static const s4 = 10.0;
  static const s5 = 14.0;
  static const s6 = 20.0;
  static const s7 = 28.0;
  static const s8 = 40.0;

  // ── radius ──────────────────────────────────────────────────────────────
  static const rChip = 4.0;
  static const rCard = 14.0; // FIELD 카드
  static const rHero = 18.0;
  static const rPill = 999.0;

  // ── 타이포 (FIELD) ──────────────────────────────────────────────────────
  //
  // design/README §타이포의 3단 스케일 중 **가운데(FIELD)** 입니다.
  // 웹의 `tokens.css` `--cf-*`와 같은 값이어야 합니다 — 한쪽만 고치면
  // 같은 화면이 앱과 웹에서 다르게 보입니다.
  //
  //            DESK   FIELD   FIELD 상향
  //   Display   24      26      28       ← CLUp.display
  //   Title     19      21      24
  //   Subtitle  15      17      19
  //   Body      14      16      18
  //   Caption   12      14      15
  //
  // **FIELD에는 Micro(10.5px)가 없습니다.** 12px 미만은 고령 사용자에게
  // 존재하지 않는 텍스트입니다. 그래서 이 클래스에 micro 상수를 두지 않았습니다 —
  // 쓸 수 없는 값은 있으면 언젠가 쓰입니다.
  static const display = 26.0;
  static const title = 21.0;
  static const subtitle = 17.0;
  static const body = 16.0;
  static const caption = 14.0;

  /// 본문 최소 크기. `CLAUDE.md` §9 완료 기준.
  static const minFontSize = 16.0;

  /// 터치 타깃 최소 크기. FIELD 48px, 주요 액션은 56px 이상.
  static const minTapTarget = 48.0;
  static const primaryButtonHeight = 56.0;
  static const heroButtonHeight = 64.0;

  /// ID·시각·금액·카운트다운·날짜 전용. 이 시스템의 시각적 서명입니다.
  static const monoFamily = 'monospace';
}

/// 간병사·보호자 화면의 **상향 스케일** (design/README §타이포).
///
/// 웹의 `tokens.css` `--cu-*`와 같은 값입니다. 보호자 웹(`field.css`)이
/// 이 스케일을 쓰고, 간병사 앱이 이 클래스를 씁니다 — 두 화면은 같은
/// 사용자층이라 크기가 같아야 합니다.
///
/// 같은 FIELD여도 후보자 앱과 간병사 앱은 사용자가 다릅니다. 후보자는
/// 대개 조용한 곳에서 시간을 들여 보지만, 간병사는 40~65세이고 병실 앞에서
/// 한 손으로 급하게 봅니다. 그래서 시안이 한 단계 위 값을 지정했습니다.
///
/// `CL`을 통째로 키우지 않은 이유: 후보자 앱이 같은 패키지를 씁니다.
/// 한 벌만 두면 어느 한쪽은 반드시 시안과 어긋납니다.
class CLUp {
  const CLUp._();

  static const display = 28.0;
  static const title = 24.0;
  static const subtitle = 19.0;
  static const body = 18.0;
  static const caption = 16.0;

  /// 주요 버튼 76px. 출근 체크·근무 기록 저장처럼 **한 화면에 하나뿐인**
  /// 큰 동작에 씁니다 (시안 SCR-401 · 403 · 404).
  static const heroButtonHeight = 76.0;
  static const primaryButtonHeight = 64.0;

  /// 아이콘 26px 이상. 시안이 명시한 값입니다.
  static const icon = 26.0;
}

/// 상태 표현 3종. 색·아이콘·텍스트가 항상 함께 갑니다.
enum Tone { signal, flag, alert, action, neutral }

extension ToneStyle on Tone {
  Color get fg => switch (this) {
        Tone.signal => CL.signal,
        Tone.flag => CL.flag,
        Tone.alert => CL.alert,
        Tone.action => CL.actionText,
        Tone.neutral => CL.textSub,
      };

  Color get bg => switch (this) {
        Tone.signal => CL.signalTint,
        Tone.flag => CL.flagTint,
        Tone.alert => CL.alertTint,
        Tone.action => CL.actionTint,
        Tone.neutral => CL.bgSub,
      };

  /// 색맹·저조도에서도 구분되도록 아이콘을 함께 붙입니다.
  IconData get icon => switch (this) {
        Tone.signal => Icons.check_circle_outline,
        Tone.flag => Icons.schedule,
        Tone.alert => Icons.error_outline,
        Tone.action => Icons.arrow_forward,
        Tone.neutral => Icons.circle_outlined,
      };
}

ThemeData buildFieldTheme() {
  const base = TextStyle(color: CL.text, height: 1.5);
  return ThemeData(
    useMaterial3: true,
    scaffoldBackgroundColor: CL.bg,
    colorScheme: ColorScheme.fromSeed(seedColor: CL.action, primary: CL.actionStrong),
    // 그림자 없음. 경계는 1px 라인.
    cardTheme: const CardTheme(elevation: 0, color: CL.bg),
    appBarTheme: const AppBarTheme(
      elevation: 0,
      backgroundColor: CL.bg,
      foregroundColor: CL.text,
      titleTextStyle: TextStyle(
        color: CL.text, fontSize: CL.subtitle, fontWeight: FontWeight.w700,
      ),
    ),
    textTheme: const TextTheme(
      displayMedium: TextStyle(fontSize: CL.display, fontWeight: FontWeight.w700, color: CL.text),
      titleLarge: TextStyle(fontSize: CL.title, fontWeight: FontWeight.w700, color: CL.text),
      titleMedium: TextStyle(fontSize: CL.subtitle, fontWeight: FontWeight.w700, color: CL.text),
      bodyLarge: TextStyle(fontSize: CL.body, color: CL.text, height: 1.5),
      bodyMedium: TextStyle(fontSize: CL.body, color: CL.text, height: 1.5),
      bodySmall: TextStyle(fontSize: CL.caption, color: CL.textSub, height: 1.5),
    ).apply(bodyColor: base.color),
  );
}
