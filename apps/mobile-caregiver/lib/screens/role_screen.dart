import 'package:carelink_field_ui/carelink_field_ui.dart';
import 'package:flutter/material.dart';
import '../core/app_state.dart';
import '../core/i18n/strings.dart';

/// SCR-003 역할 선택 — 간병사 앱.
///
/// **이 화면이 없어서 신규 가입자가 오류 화면을 만났습니다.** 로그인 직후
/// 바로 홈으로 보냈고, 역할이 없으면 모든 API가 403을 돌려줍니다.
///
/// 시안대로 카드 3개를 다 보여 줍니다. 이 앱에서 쓰지 않는 역할을 골라도
/// 역할은 부여하고, 화면이 다른 앱에 있다는 사실을 알려 줍니다 — 한 계정이
/// 역할을 여러 개 갖는 것이 정상이고(요양보호사가 간병사로도 일합니다),
/// 여기서 막으면 그 사람은 다시 가입하려 듭니다.
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
          if (role != 'CAREGIVER' && mounted) {
            setState(() => _error = app.t('role.otherApp'));
          }
        } on ApiException catch (e) {
          if (mounted) setState(() => _error = app.t(errorKey(e.code)));
        } catch (_) {
          if (mounted) setState(() => _error = app.t('error.network'));
        } finally {
          if (mounted) setState(() => _busy = false);
        }
      },
    );
  }
}
