import 'package:flutter/material.dart';
import '../core/i18n/strings.dart';
import '../core/theme/tokens.dart';

/// 상태 배지.
///
/// **색 + 아이콘 + 텍스트 3중 표현이 규칙입니다** (docs/09 §4.2).
/// 색만으로, 또는 아이콘만으로 상태를 전달하는 구현은 반려 대상이라
/// `label`을 생략하는 생성자를 두지 않았습니다.
class StatusPill extends StatelessWidget {
  const StatusPill({super.key, required this.tone, required this.label});

  final Tone tone;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: CL.s3, vertical: CL.s1),
      decoration: BoxDecoration(
        color: tone.bg,
        borderRadius: BorderRadius.circular(CL.rChip),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(tone.icon, size: 16, color: tone.fg),
          const SizedBox(width: CL.s1),
          Text(
            label,
            style: TextStyle(fontSize: CL.caption, color: tone.fg, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}

/// 만료 임계값 (design/README §신규 컴포넌트 1).
/// D-90 이상 signal · D-89~D-31 flag · D-30 이하 alert.
Tone expiryTone(int? days) {
  if (days == null) return Tone.neutral;
  if (days <= 30) return Tone.alert;
  if (days <= 89) return Tone.flag;
  return Tone.signal;
}

/// `D-42` 형태의 만료 카운트다운.
///
/// **만료는 날짜만 노출하지 않습니다.** 사람은 `2026-09-10`을 보고 남은 날을
/// 계산하지 않습니다. 체류자격은 특히 그렇습니다 — 계산을 놓치면 자격 무효가
/// 아니라 **불법 취업**이 됩니다 (§5.9).
class ExpiryCountdown extends StatelessWidget {
  const ExpiryCountdown({
    super.key,
    required this.days,
    required this.locale,
    this.label,
    this.date,
  });

  final int? days;
  final AppLocale locale;
  final String? label;
  final String? date;

  @override
  Widget build(BuildContext context) {
    final tone = expiryTone(days);
    final d = days;
    final text = d == null ? '—' : (d < 0 ? 'D+${-d}' : 'D-$d');

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: CL.s4, vertical: CL.s3),
      decoration: BoxDecoration(
        color: tone.bg,
        borderRadius: BorderRadius.circular(CL.rChip),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.event_outlined, size: 20, color: tone.fg),
          const SizedBox(width: CL.s3),
          if (label != null) ...[
            Flexible(
              child: Text(
                label!,
                style: TextStyle(fontSize: CL.body, color: tone.fg),
              ),
            ),
            const SizedBox(width: CL.s3),
          ],
          Text(
            text,
            style: TextStyle(
              fontFamily: CL.monoFamily,
              fontSize: CL.subtitle,
              fontWeight: FontWeight.w700,
              color: tone.fg,
            ),
          ),
          if (d != null && d < 0) ...[
            const SizedBox(width: CL.s2),
            Text(
              tr('expiry.expired', locale),
              style: TextStyle(fontSize: CL.caption, color: tone.fg, fontWeight: FontWeight.w600),
            ),
          ],
        ],
      ),
    );
  }
}

/// FIELD 주요 버튼. 최소 높이 56px, 본문 16px.
///
/// 높이를 인자로 받지 않습니다 — 받으면 언젠가 작은 값이 들어옵니다.
class PrimaryButton extends StatelessWidget {
  const PrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.hero = false,
    this.tone = Tone.action,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool hero;
  final Tone tone;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: hero ? CL.heroButtonHeight : CL.primaryButtonHeight,
      child: FilledButton(
        onPressed: onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: tone == Tone.alert ? CL.alert : CL.actionStrong,
          disabledBackgroundColor: CL.bgSub,
          disabledForegroundColor: CL.textDisabled,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(CL.rCard)),
        ),
        child: Text(
          label,
          // 라벨은 한국어 기준 2.5배까지 늘어납니다 ('여정' → 'Профессиональный путь').
          // 줄바꿈을 허용하고 잘라내지 않습니다.
          textAlign: TextAlign.center,
          style: const TextStyle(fontSize: CL.body, fontWeight: FontWeight.w700),
        ),
      ),
    );
  }
}

/// 부가 버튼. 그래도 48px 아래로 내려가지 않습니다.
class SecondaryButton extends StatelessWidget {
  const SecondaryButton({super.key, required this.label, required this.onPressed});

  final String label;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: CL.minTapTarget,
      child: OutlinedButton(
        onPressed: onPressed,
        style: OutlinedButton.styleFrom(
          foregroundColor: CL.textSub,
          side: const BorderSide(color: CL.lineStrong),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(CL.rCard)),
        ),
        child: Text(label, style: const TextStyle(fontSize: CL.body)),
      ),
    );
  }
}

/// FIELD 카드. 그림자 없이 1px 라인.
class FieldCard extends StatelessWidget {
  const FieldCard({super.key, required this.child, this.onTap, this.tone});

  final Widget child;
  final VoidCallback? onTap;
  final Tone? tone;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: tone?.bg ?? CL.bg,
      borderRadius: BorderRadius.circular(CL.rCard),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(CL.rCard),
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.all(CL.s6),
          decoration: BoxDecoration(
            border: Border.all(color: tone == null ? CL.line : tone!.bg),
            borderRadius: BorderRadius.circular(CL.rCard),
          ),
          child: child,
        ),
      ),
    );
  }
}

/// 로케일 전환. FIELD는 4개 언어 전부, 버튼 52px (design/README §신규 컴포넌트 5).
class LocaleSwitcher extends StatelessWidget {
  const LocaleSwitcher({super.key, required this.current, required this.onChanged});

  final AppLocale current;
  final ValueChanged<AppLocale> onChanged;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        for (final l in AppLocale.values) ...[
          Expanded(
            child: SizedBox(
              height: 52,
              child: OutlinedButton(
                onPressed: () => onChanged(l),
                style: OutlinedButton.styleFrom(
                  backgroundColor: l == current ? CL.actionTint : CL.bg,
                  foregroundColor: l == current ? CL.actionText : CL.textSub,
                  side: BorderSide(color: l == current ? CL.action : CL.lineStrong),
                  padding: EdgeInsets.zero,
                ),
                child: Text(
                  l.nativeName,
                  style: TextStyle(
                    fontSize: CL.body,
                    fontWeight: l == current ? FontWeight.w700 : FontWeight.w400,
                  ),
                ),
              ),
            ),
          ),
          if (l != AppLocale.values.last) const SizedBox(width: CL.s2),
        ],
      ],
    );
  }
}

/// 앱바용 축약 로케일 표시. 48px 필.
class LocaleChip extends StatelessWidget {
  const LocaleChip({super.key, required this.locale, required this.onTap});

  final AppLocale locale;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(CL.rPill),
      child: Container(
        height: CL.minTapTarget,
        padding: const EdgeInsets.symmetric(horizontal: CL.s5),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: CL.bgSub,
          borderRadius: BorderRadius.circular(CL.rPill),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.language, size: 20, color: CL.textSub),
            const SizedBox(width: CL.s2),
            Text(
              locale.short,
              style: const TextStyle(
                fontFamily: CL.monoFamily, fontSize: CL.body,
                fontWeight: FontWeight.w700, color: CL.textSub,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 화면 상태 안내. 로딩·빈 목록·에러를 같은 형태로 보여줍니다.
class StateNotice extends StatelessWidget {
  const StateNotice({super.key, required this.message, this.action, this.tone = Tone.neutral});

  final String message;
  final Widget? action;
  final Tone tone;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(CL.s7),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(tone.icon, size: 40, color: tone == Tone.neutral ? CL.textDisabled : tone.fg),
          const SizedBox(height: CL.s5),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: CL.body, color: CL.textSub, height: 1.5),
          ),
          if (action != null) ...[const SizedBox(height: CL.s6), action!],
        ],
      ),
    );
  }
}
