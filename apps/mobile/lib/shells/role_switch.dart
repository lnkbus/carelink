import 'package:carelink_field_ui/carelink_field_ui.dart';
import 'package:flutter/material.dart';
import '../core/app_state.dart';
import '../screens/role_screen.dart';

/// 역할 전환 — 내 정보 화면 안에 둡니다.
///
/// 앱이 셋으로 나뉘어 있을 때는 필요 없던 것입니다. 스토어에서 어느 앱을
/// 열었는지가 곧 역할이었으니까요. 하나로 합치면 그 단서가 사라집니다.
///
/// **역할이 하나뿐인 사용자에게는 아무것도 보이지 않습니다.** 전환 버튼을
/// 띄우면 '내가 뭘 잘못 골랐나' 하고 눌러 봅니다 — 이 앱의 사용자에게
/// 의미 없는 선택지는 그 자체로 불안 요인입니다.
///
/// 역할 추가는 별개입니다. 요양보호사 자격을 딴 후보자가 간병사로 일을
/// 시작하는 경로가 실제로 있고 (docs/08), 그때 다시 가입하게 두면 계정이
/// 둘로 갈라져 경력·서류가 이어지지 않습니다.
class RoleSwitchSection extends StatelessWidget {
  const RoleSwitchSection({super.key});

  static const _labels = {
    'CANDIDATE': 'role.candidate',
    'CAREGIVER': 'role.caregiver',
    'PATIENT_FAMILY': 'role.family',
  };

  static const _icons = {
    'CANDIDATE': Icons.work_outline,
    'CAREGIVER': Icons.volunteer_activism_outlined,
    'PATIENT_FAMILY': Icons.family_restroom_outlined,
  };

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final held = app.fieldRoles;
    final active = app.activeRole;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (app.canSwitchRole) ...[
          Text(
            app.t('role.switch'),
            style: const TextStyle(fontSize: CLUp.subtitle, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: CL.s4),
          for (final role in held)
            _RoleRow(
              icon: _icons[role] ?? Icons.person_outline,
              label: app.t(_labels[role] ?? role),
              selected: role == active,
              onTap: role == active ? null : () => app.setActiveRole(role),
            ),
          const SizedBox(height: CL.s6),
        ],

        // 역할 추가는 언제나 열어 둡니다. 셋을 다 가진 계정에도 보이지만,
        // 이미 가진 역할을 고르면 서버가 `IAM_ROLE_ALREADY_HELD`로
        // 알려 주고 화면이 그대로 문장으로 바꿔 보여 줍니다.
        SecondaryButton(
          up: true,
          label: app.t('role.addAnother'),
          onPressed: () => Navigator.of(context)
              .push(MaterialPageRoute<void>(builder: (_) => const RoleScreen())),
        ),
      ],
    );
  }
}

class _RoleRow extends StatelessWidget {
  const _RoleRow({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
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
            border: Border.all(color: selected ? CL.action : CL.line, width: selected ? 2 : 1),
            borderRadius: BorderRadius.circular(CL.rCard),
          ),
          child: Row(
            children: [
              Icon(icon, size: CLUp.icon, color: selected ? CL.action : CL.textMuted),
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
              // 색만으로 표시하지 않습니다 (docs/09 §4.2).
              if (selected) const Icon(Icons.check, size: CLUp.icon, color: CL.action),
            ],
          ),
        ),
      ),
    );
  }
}
