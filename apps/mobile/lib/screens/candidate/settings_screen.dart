import 'package:flutter/material.dart';
import '../../core/app_state.dart';
import '../../shells/role_switch.dart';
import 'package:carelink_field_ui/carelink_field_ui.dart';
import '../../models/candidate_models.dart';
/// SCR-110 마이페이지 · SCR-104 프로필 요약.
///
/// **FIELD 트랙은 ko/vi/ru/en 4개 언어입니다.** 러시아어는 고려인 세그먼트
/// 때문에 필수이고, i18n을 나중에 붙이면 전면 수정이 됩니다 (SCR-110 notes).
/// 그래서 언어 전환을 설정 목록 안쪽에 숨기지 않고 4개 버튼으로 펼쳐 둡니다 —
/// 한국어를 못 읽는 사용자가 '설정' 글자를 찾아 들어가야 하면 못 찾습니다.
///
/// 체류자격은 본인이 고칠 수 없습니다. 운영자가 확인한 결과만 기록됩니다
/// (§6-1 · §6-11). 화면에도 읽기 전용으로만 나옵니다.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  Candidate? _me;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final app = AppScope.of(context);
    try {
      final me = Candidate.fromJson(await app.api.get('/candidates/me') as Map<String, dynamic>);
      if (!mounted) return;
      setState(() { _me = me; _loading = false; });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
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
            child: Text(app.t('settings.logout'), style: const TextStyle(fontSize: CL.body)),
          ),
        ],
      ),
    );
    if (ok == true) await app.signOut();
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final me = _me;

    return Scaffold(
      appBar: AppBar(title: Text(app.t('settings.title'))),
      body: _loading
          ? Center(child: Text(app.t('common.loading'), style: const TextStyle(fontSize: CL.body)))
          : ListView(
              padding: const EdgeInsets.all(CL.s6),
              children: [
                if (me != null) ...[
                  FieldCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          me.name ?? me.displayCode,
                          style: const TextStyle(fontSize: CL.title, fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: CL.s2),
                        Text(
                          me.displayCode,
                          style: const TextStyle(
                            fontFamily: CL.monoFamily, fontSize: CL.caption, color: CL.textMuted,
                          ),
                        ),
                        if (me.tracks.isNotEmpty) ...[
                          const SizedBox(height: CL.s4),
                          Wrap(
                            spacing: CL.s2,
                            runSpacing: CL.s2,
                            children: [
                              for (final t in me.tracks)
                                StatusPill(tone: Tone.action, label: t.labelKo),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),

                  // 체류자격 — 읽기 전용. 만료는 카운트다운으로.
                  if (me.visaStatusCode != null) ...[
                    const SizedBox(height: CL.s5),
                    FieldCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                app.t('profile.visa'),
                                style: const TextStyle(fontSize: CL.caption, color: CL.textMuted),
                              ),
                              const Spacer(),
                              Text(
                                me.visaStatusCode!,
                                style: const TextStyle(
                                  fontFamily: CL.monoFamily, fontSize: CL.subtitle,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                          if (me.visaExpiresInDays != null) ...[
                            const SizedBox(height: CL.s4),
                            ExpiryCountdown(
                              expiredLabel: app.t('expiry.expired'),
                              days: me.visaExpiresInDays,
                              locale: app.locale,
                              date: me.visaExpiresOn,
                            ),
                          ],
                          const SizedBox(height: CL.s4),
                          Text(
                            app.t('profile.visa.readonly'),
                            style: const TextStyle(fontSize: CL.caption, color: CL.textMuted, height: 1.5),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],

                // 언어 — 목록에 묻지 않고 펼쳐 둡니다.
                const SizedBox(height: CL.s7),
                Text(
                  app.t('settings.language'),
                  style: const TextStyle(fontSize: CL.subtitle, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: CL.s4),
                LocaleSwitcher(
                  current: app.locale,
                  onChanged: app.setLocale,
                ),

                // 역할이 둘 이상인 계정에만 전환이 보입니다 (RoleSwitchSection).
                const SizedBox(height: CL.s7),
                const RoleSwitchSection(),

                const SizedBox(height: CL.s7),
                _SettingsRow(label: app.t('settings.notifications'), onTap: () {}),
                _SettingsRow(label: app.t('settings.consents'), onTap: () {}),
                _SettingsRow(label: app.t('settings.support'), onTap: () {}),

                const SizedBox(height: CL.s7),
                // 확인 한 단계를 둡니다. 다시 들어오려면 인증번호를 기다려야
                // 해서 오조작 비용이 큽니다 (간병사·보호자 화면과 동일).
                SecondaryButton(
                  label: app.t('settings.logout'),
                  onPressed: () => _confirmLogout(app),
                ),
              ],
            ),
    );
  }
}

/// 설정 행. 64px — 고령 사용자 기준 터치 타깃 (design/README §Candidate App 110).
class _SettingsRow extends StatelessWidget {
  const _SettingsRow({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        height: 64,
        decoration: const BoxDecoration(
          border: Border(bottom: BorderSide(color: CL.line)),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(label, style: const TextStyle(fontSize: CL.body)),
            ),
            const Icon(Icons.chevron_right, color: CL.textMuted, size: 24),
          ],
        ),
      ),
    );
  }
}
