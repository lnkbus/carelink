import 'package:carelink_field_ui/carelink_field_ui.dart';
import 'package:flutter/material.dart';
import '../core/app_state.dart';

/// SCR-003 역할 선택.
///
/// **이 화면이 없어서 신규 가입자가 오류 화면을 만났습니다.** 로그인 직후
/// 바로 홈으로 보냈고, 역할이 없으면 모든 API가 403을 돌려줍니다.
///
/// 앱을 셋으로 나눠 두었을 때는 여기서 '다른 역할은 다른 앱에 있다'고
/// 안내해야 했습니다. 한 계정이 역할을 여러 개 갖는 것이 정상인데
/// (요양보호사가 간병사로도 일합니다) 앱이 갈라져 있으니 스토어를 다시
/// 찾아 설치하라는 뜻이었고, 실제로는 다시 가입하는 사람이 생깁니다.
///
/// 이제 한 앱입니다. 무엇을 고르든 그 자리에서 해당 화면이 열리고,
/// 역할이 둘 이상이면 홈에서 전환할 수 있습니다.
class RoleScreen extends StatefulWidget {
  const RoleScreen({super.key});

  @override
  State<RoleScreen> createState() => _RoleScreenState();
}

class _RoleScreenState extends State<RoleScreen> {
  bool _busy = false;
  String? _error;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);

    return RolePickerView(
      phone: app.phone ?? '',
      title: app.t('role.title'),
      subtitle: app.t('role.subtitle'),
      submitLabel: app.t('role.start'),
      busy: _busy,
      error: _error,
      options: [
        RoleOption(
          role: 'CANDIDATE',
          icon: Icons.work_outline,
          title: app.t('role.candidate'),
          subtitle: app.t('role.candidate.sub'),
        ),
        RoleOption(
          role: 'CAREGIVER',
          icon: Icons.volunteer_activism_outlined,
          title: app.t('role.caregiver'),
          subtitle: app.t('role.caregiver.sub'),
        ),
        RoleOption(
          role: 'PATIENT_FAMILY',
          icon: Icons.family_restroom_outlined,
          title: app.t('role.family'),
          subtitle: app.t('role.family.sub'),
        ),
      ],
      onSubmit: (role) async {
        setState(() { _busy = true; _error = null; });
        try {
          await app.chooseRole(role);
          // 고른 역할로 바로 들어갑니다. 앱이 하나라 안내할 것이 없습니다.
        } on ApiException catch (e) {
          // 코드를 그대로 두면 화면에 IAM_…이 뜹니다. 아는 것만 문장으로
          // 바꾸고 나머지는 네트워크 문구로 흡수합니다.
          if (mounted) {
            setState(() => _error = e.code == 'IAM_ROLE_ALREADY_HELD'
                ? app.t('role.alreadyHeld')
                : app.t('error.network'));
          }
        } catch (_) {
          if (mounted) setState(() => _error = app.t('error.network'));
        } finally {
          if (mounted) setState(() => _busy = false);
        }
      },
    );
  }
}
