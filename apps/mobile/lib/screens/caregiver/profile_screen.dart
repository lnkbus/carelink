import 'package:carelink_field_ui/carelink_field_ui.dart';
import 'package:flutter/material.dart';
import '../../core/app_state.dart';
import '../../shells/role_switch.dart';

/// 내 정보 — 간병사.
///
/// 세 FIELD 앱에서 **로그아웃은 항상 이 화면 맨 아래**에 있습니다
/// (후보자 앱 SCR-110이 그렇게 설계돼 있고, 나머지를 거기 맞췄습니다).
/// 앱마다 다른 자리에 두면 계정을 바꿔야 할 때마다 찾아 헤매게 됩니다.
///
/// 간병사에게 보여 줄 것이 많지 않습니다 — 번호와 언어, 그리고 로그아웃.
/// 근무·일정은 홈에 있고, 여기에 또 두면 두 곳을 다 봐야 합니다.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key, this.embedded = false});

  /// 하단 탭으로 열렸는가. 탭이면 뒤로가기 화살표를 띄우지 않습니다.
  final bool embedded;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  String? _phone;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final app = AppScope.of(context);
    try {
      final me = await app.api.get('/auth/me') as Map<String, dynamic>;
      if (!mounted) return;
      setState(() { _phone = me['phone'] as String?; _loading = false; });
    } catch (_) {
      // 실패해도 화면을 막지 않습니다 — 로그아웃은 네트워크와 무관하게
      // 눌릴 수 있어야 합니다.
      if (mounted) setState(() => _loading = false);
    }
  }

  /// 확인 한 단계를 둡니다. 되돌릴 수 없는 동작은 아니지만, 다시 들어오려면
  /// 인증번호를 기다려야 해서 오조작 비용이 큽니다.
  Future<void> _confirmLogout(AppState app) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(app.t('logout.confirm'), style: const TextStyle(fontSize: CL.subtitle)),
        content: Text(app.t('logout.note'), style: const TextStyle(fontSize: CL.body)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(app.t('common.cancel'), style: const TextStyle(fontSize: CL.body)),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(app.t('common.logout'), style: const TextStyle(fontSize: CL.body)),
          ),
        ],
      ),
    );
    if (ok == true) await app.signOut();
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);

    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: !widget.embedded,
        backgroundColor: CL.bg,
        title: Text(
          app.t('tab.profile'),
          style: const TextStyle(fontSize: CLUp.title, fontWeight: FontWeight.w700),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(CL.s6),
        children: [
          FieldCard(
            child: Row(
              children: [
                Text(app.t('profile.phone'), style: const TextStyle(fontSize: CLUp.body, color: CL.textMuted)),
                const Spacer(),
                Text(
                  _loading ? app.t('common.loading') : (_phone ?? '—'),
                  style: const TextStyle(fontFamily: CL.monoFamily, fontSize: CLUp.subtitle, fontWeight: FontWeight.w700),
                ),
              ],
            ),
          ),

          // 언어는 목록에 묻지 않고 펼쳐 둡니다 — 한국어를 못 읽는 사용자가
          // '설정' 글자를 찾아 들어가야 하면 못 찾습니다 (후보자 앱과 동일).
          const SizedBox(height: CL.s7),
          Text(app.t('profile.language'), style: const TextStyle(fontSize: CLUp.subtitle, fontWeight: FontWeight.w700)),
          const SizedBox(height: CL.s4),
          LocaleSwitcher(current: app.locale, onChanged: app.setLocale),

          // 역할이 둘 이상인 계정에만 전환이 보입니다 (RoleSwitchSection).
          const SizedBox(height: CL.s7),
          const RoleSwitchSection(),

          const SizedBox(height: CL.s7),
          SecondaryButton(
            up: true,
            label: app.t('common.logout'),
            onPressed: () => _confirmLogout(app),
          ),
        ],
      ),
    );
  }
}
