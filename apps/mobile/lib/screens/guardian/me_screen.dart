import 'package:carelink_field_ui/carelink_field_ui.dart';
import 'package:flutter/material.dart';
import '../../core/app_state.dart';
import '../../shells/role_switch.dart';
import 'common.dart';

/// 내 정보 — 보호자.
///
/// 세 역할 모두 **로그아웃은 이 화면 맨 아래**에 있습니다 (후보자 SCR-110이
/// 그렇게 설계돼 있고 나머지를 거기 맞췄습니다). 자리를 역할마다 바꾸면
/// 계정을 바꿔야 할 때마다 찾아 헤매게 됩니다.
///
/// 디자인(SCR-301)의 앱바 오른쪽은 '도움말'입니다. 그 의도는 여기 전화
/// 상담으로 살립니다 — 보호자에게 필요한 도움은 문서가 아니라 사람입니다.
class GuardianMeScreen extends StatefulWidget {
  const GuardianMeScreen({super.key});

  @override
  State<GuardianMeScreen> createState() => _GuardianMeScreenState();
}

class _GuardianMeScreenState extends State<GuardianMeScreen> {
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
        automaticallyImplyLeading: false,
        backgroundColor: CL.bg,
        title: Text(
          app.t('guardian.me.title'),
          style: const TextStyle(fontSize: CLUp.title, fontWeight: FontWeight.w700),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(CL.s6),
        children: [
          FieldCard(
            child: InfoRow(
              label: app.t('profile.phone'),
              value: _loading ? app.t('common.loading') : _phone,
              mono: true,
            ),
          ),

          const SizedBox(height: CL.s7),
          Text(
            app.t('profile.language'),
            style: const TextStyle(fontSize: CLUp.subtitle, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: CL.s4),
          LocaleSwitcher(current: app.locale, onChanged: app.setLocale),

          const SizedBox(height: CL.s7),
          const RoleSwitchSection(),

          const SizedBox(height: CL.s6),
          FieldCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CardTitle(app.t('guardian.live.call')),
                const Text(
                  '1533-0000',
                  style: TextStyle(
                    fontFamily: CL.monoFamily, fontSize: CLUp.title, fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),

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
