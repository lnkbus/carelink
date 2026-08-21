import 'package:carelink_field_ui/carelink_field_ui.dart';
import 'package:flutter/material.dart';

/// 보호자 화면 공용 조각.
///
/// 보호자는 대개 병원에서 링크로 들어옵니다 (SCR-301 notes). 앱을 배우러 온
/// 것이 아니라 사람이 급해서 들어온 것이고, 화면마다 구조가 다르면 그때마다
/// 다시 읽어야 합니다. 그래서 **질문 한 줄 + 카드 목록**으로 고정합니다.

/// 화면 맨 위의 큰 질문. 시안(§Patient Web)의 여백과 크기를 따릅니다.
class Ask extends StatelessWidget {
  const Ask({super.key, required this.text, this.sub});

  final String text;
  final String? sub;

  @override
  Widget build(BuildContext context) {
    final s = sub;
    return Padding(
      padding: const EdgeInsets.only(bottom: CL.s5),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            text,
            style: const TextStyle(
              fontSize: CLUp.display, fontWeight: FontWeight.w700,
              height: 1.3, letterSpacing: -0.5, color: CL.text,
            ),
          ),
          if (s != null) ...[
            const SizedBox(height: CL.s3),
            Text(
              s,
              style: const TextStyle(fontSize: CLUp.body, color: CL.textMuted, height: 1.55),
            ),
          ],
        ],
      ),
    );
  }
}

/// `라벨 ─ 값` 한 줄. 값이 없으면 '—'를 씁니다 — 빈칸으로 두면 로딩 중인지
/// 값이 없는 것인지 구분되지 않습니다.
class InfoRow extends StatelessWidget {
  const InfoRow({super.key, required this.label, required this.value, this.mono = false});

  final String label;
  final String? value;
  final bool mono;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: CL.s2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: CLUp.caption, color: CL.textMuted)),
          const SizedBox(width: CL.s4),
          Expanded(
            child: Text(
              (value == null || value!.isEmpty) ? '—' : value!,
              textAlign: TextAlign.right,
              style: TextStyle(
                fontSize: CLUp.body,
                fontWeight: FontWeight.w600,
                fontFamily: mono ? CL.monoFamily : null,
                color: CL.text,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// 카드 안의 소제목.
class CardTitle extends StatelessWidget {
  const CardTitle(this.text, {super.key});

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: CL.s3),
        child: Text(
          text,
          style: const TextStyle(fontSize: CLUp.subtitle, fontWeight: FontWeight.w700, color: CL.text),
        ),
      );
}

/// 고를 수 있는 타일. 48px 이상 · 선택은 색 + 테두리 + 체크 3중 표현입니다 —
/// 색만으로 표시하면 색각 이상 사용자에게 아무 변화가 없습니다 (docs/09 §4.2).
class PickTile extends StatelessWidget {
  const PickTile({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.note,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;
  final String? note;

  @override
  Widget build(BuildContext context) {
    final n = note;
    return Semantics(
      selected: selected,
      button: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(CL.rCard),
        child: Container(
          constraints: const BoxConstraints(minHeight: CL.minTapTarget),
          padding: const EdgeInsets.symmetric(horizontal: CL.s5, vertical: CL.s4),
          margin: const EdgeInsets.only(bottom: CL.s3),
          decoration: BoxDecoration(
            color: selected ? CL.actionTint : CL.bg,
            border: Border.all(
              color: selected ? CL.action : CL.line,
              width: selected ? 2 : 1,
            ),
            borderRadius: BorderRadius.circular(CL.rCard),
          ),
          child: Row(
            children: [
              Icon(
                selected ? Icons.check_circle : Icons.circle_outlined,
                size: CLUp.icon,
                color: selected ? CL.action : CL.textDisabled,
              ),
              const SizedBox(width: CL.s4),
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: CLUp.body,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                    color: selected ? CL.actionText : CL.text,
                  ),
                ),
              ),
              if (n != null)
                Text(n, style: const TextStyle(fontSize: CLUp.caption, color: CL.textMuted)),
            ],
          ),
        ),
      ),
    );
  }
}

/// 안내 상자. 차단·대기·설명에 씁니다.
class NoteBox extends StatelessWidget {
  const NoteBox({super.key, required this.text, this.tone = Tone.neutral});

  final String text;
  final Tone tone;

  @override
  Widget build(BuildContext context) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(CL.s5),
        margin: const EdgeInsets.only(bottom: CL.s4),
        decoration: BoxDecoration(
          color: tone.bg,
          borderRadius: BorderRadius.circular(CL.rCard),
        ),
        child: Text(
          text,
          style: TextStyle(fontSize: CLUp.caption, color: tone.fg, height: 1.6),
        ),
      );
}

/// KST 기준 `9월 12일 (금) 09:00`.
///
/// 기기 시간대로 그리지 않습니다. 보호자가 보는 시각은 언제나 **병원 벽시계**라
/// 시차가 있는 기기에서 09:00을 18:00으로 읽으면 안 됩니다.
String fmtKst(DateTime? t) {
  if (t == null) return '—';
  final k = t.toUtc().add(const Duration(hours: 9));
  const dow = ['월', '화', '수', '목', '금', '토', '일'];
  String two(int v) => v.toString().padLeft(2, '0');
  return '${k.month}월 ${k.day}일 (${dow[k.weekday - 1]}) ${two(k.hour)}:${two(k.minute)}';
}
