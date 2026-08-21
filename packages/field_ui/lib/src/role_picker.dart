import 'package:flutter/material.dart';
import 'field_widgets.dart';
import 'tokens.dart';

/// 역할 선택지 하나.
class RoleOption {
  const RoleOption({
    required this.role,
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  /// `CANDIDATE` · `CAREGIVER` · `PATIENT_FAMILY`.
  final String role;
  final IconData icon;
  final String title;
  final String subtitle;
}

/// SCR-003 역할 선택.
///
/// **이 화면이 아예 없었습니다.** 로그인 직후 바로 홈으로 보냈고, 역할이
/// 없는 계정은 모든 API가 403을 돌려줘서 화면이 오류로 가득 찼습니다.
/// 처음 가입한 사람이 정확히 그 상태가 됩니다.
///
/// 시안대로 카드 3개(104px)와 '시작하기' 버튼입니다. 카드는 라디오가
/// 아니라 **큰 타일**입니다 — 40~65세 사용자에게 라디오 버튼은 누르기
/// 어렵고, 무엇이 선택됐는지도 잘 안 보입니다.
///
/// USERS와 USER_ROLES를 분리했으므로 한 계정이 역할을 여러 개 가질 수
/// 있습니다. 요양보호사가 간병사로도 일하는 경우가 실제로 흔합니다
/// (SCR-003 notes).
class RolePickerView extends StatefulWidget {
  const RolePickerView({
    super.key,
    required this.phone,
    required this.title,
    required this.subtitle,
    required this.submitLabel,
    required this.options,
    required this.onSubmit,
    this.busy = false,
    this.error,
  });

  /// 지금 로그인한 번호. 시안은 상단에 이걸 띄웁니다 —
  /// 계정이 여러 개인 사람이 어느 계정으로 들어왔는지 알 수 있어야 합니다.
  final String phone;
  final String title;
  final String subtitle;
  final String submitLabel;
  final List<RoleOption> options;
  final Future<void> Function(String role) onSubmit;
  final bool busy;
  final String? error;

  @override
  State<RolePickerView> createState() => _RolePickerViewState();
}

class _RolePickerViewState extends State<RolePickerView> {
  String? _picked;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(CL.s6),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Align(
                alignment: Alignment.centerRight,
                child: Text(
                  widget.phone,
                  style: const TextStyle(
                    fontFamily: CL.monoFamily, fontSize: CL.caption, color: CL.textMuted,
                  ),
                ),
              ),
              const SizedBox(height: CL.s7),
              Text(
                widget.title,
                style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700, letterSpacing: -0.5),
              ),
              const SizedBox(height: CL.s3),
              Text(
                widget.subtitle,
                style: const TextStyle(fontSize: 17, color: CL.textMuted, height: 1.5),
              ),
              const SizedBox(height: CL.s6),

              for (final o in widget.options) ...[
                _RoleCard(
                  option: o,
                  selected: _picked == o.role,
                  onTap: () => setState(() => _picked = o.role),
                ),
                const SizedBox(height: CL.s3),
              ],

              if (widget.error != null) ...[
                const SizedBox(height: CL.s4),
                StateNotice(tone: Tone.alert, message: widget.error!),
              ],

              const Spacer(),
              PrimaryButton(
                hero: true,
                label: widget.submitLabel,
                onPressed: _picked == null || widget.busy
                    ? null
                    : () => widget.onSubmit(_picked!),
              ),
              const SizedBox(height: CL.s5),
            ],
          ),
        ),
      ),
    );
  }
}

/// 역할 카드 104px (시안 규격).
class _RoleCard extends StatelessWidget {
  const _RoleCard({required this.option, required this.selected, required this.onTap});

  final RoleOption option;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(CL.rHero),
      child: Container(
        constraints: const BoxConstraints(minHeight: 104),
        padding: const EdgeInsets.all(CL.s5),
        decoration: BoxDecoration(
          border: Border.all(
            color: selected ? CL.action : CL.line,
            width: selected ? 2 : 1,
          ),
          borderRadius: BorderRadius.circular(CL.rHero),
          color: selected ? CL.actionTint : CL.bg,
        ),
        child: Row(
          children: [
            Container(
              width: 52, height: 52,
              decoration: BoxDecoration(
                color: selected ? CL.bg : CL.bgSub,
                borderRadius: BorderRadius.circular(CL.rCard),
              ),
              child: Icon(option.icon, size: 28, color: selected ? CL.action : CL.textSub),
            ),
            const SizedBox(width: CL.s5),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    option.title,
                    style: TextStyle(
                      fontSize: 19, fontWeight: FontWeight.w700,
                      color: selected ? CL.actionText : CL.text,
                    ),
                  ),
                  const SizedBox(height: CL.s2),
                  Text(
                    option.subtitle,
                    style: const TextStyle(fontSize: 16, color: CL.textMuted),
                  ),
                ],
              ),
            ),
            if (selected)
              Container(
                width: 28, height: 28,
                decoration: const BoxDecoration(color: CL.action, shape: BoxShape.circle),
                child: const Icon(Icons.check, size: 18, color: Colors.white),
              ),
          ],
        ),
      ),
    );
  }
}
