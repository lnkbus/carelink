import 'package:flutter/material.dart';
import '../core/app_state.dart';
import '../core/theme/tokens.dart';
import '../models/models.dart';
import '../widgets/field_widgets.dart';

/// SCR-104 프로필.
///
/// 기본정보 행은 56px, 아바타 88px (design/README §Candidate App 104).
///
/// **국적과 체류자격은 이 화면에서 수정할 수 없습니다.** 플랫폼은 판정하지
/// 않고 운영자가 확인한 결과만 기록합니다 (§6-1 · §6-11). 그래서 입력 필드가
/// 아니라 읽기 전용 행으로 나오고, 편집 폼(`UpdateCandidateDto`)에도
/// 해당 필드가 없습니다.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Candidate? _me;
  bool _loading = true;
  bool _saving = false;

  final _name = TextEditingController();
  final _location = TextEditingController();
  final _regions = TextEditingController();

  @override
  void dispose() {
    _name.dispose();
    _location.dispose();
    _regions.dispose();
    super.dispose();
  }

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
      setState(() {
        _me = me;
        _name.text = me.name ?? '';
        _location.text = me.currentLocation ?? '';
        _regions.text = me.preferredRegions?.join(', ') ?? '';
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _loading = false);
    }
  }

  Future<void> _save() async {
    final app = AppScope.of(context);
    setState(() => _saving = true);
    try {
      await app.api.patch('/candidates/me', {
        if (_name.text.isNotEmpty) 'name': _name.text,
        if (_location.text.isNotEmpty) 'currentLocation': _location.text,
        if (_regions.text.isNotEmpty)
          'preferredRegions': _regions.text.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList(),
      });
      await _load();
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final me = _me;

    return Scaffold(
      appBar: AppBar(title: Text(app.t('profile.title'))),
      body: _loading
          ? Center(child: Text(app.t('common.loading'), style: const TextStyle(fontSize: CL.body)))
          : ListView(
              padding: const EdgeInsets.all(CL.s6),
              children: [
                Center(
                  child: Container(
                    width: 88,
                    height: 88,
                    decoration: BoxDecoration(
                      color: CL.actionTint,
                      borderRadius: BorderRadius.circular(CL.rHero),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      me?.displayCode.replaceFirst(RegExp(r'^C-0*'), '#') ?? '#',
                      style: const TextStyle(
                        fontFamily: CL.monoFamily, fontSize: CL.subtitle,
                        fontWeight: FontWeight.w700, color: CL.actionText,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: CL.s7),

                _EditRow(label: app.t('profile.name'), controller: _name),
                _EditRow(label: app.t('profile.region'), controller: _location),
                _EditRow(
                  label: app.t('profile.region'),
                  controller: _regions,
                  hint: '경기 안산시, 서울 구로구',
                ),

                // 읽기 전용 — 본인이 고칠 수 없는 값.
                if (me?.visaStatusCode != null) ...[
                  const SizedBox(height: CL.s6),
                  Container(
                    padding: const EdgeInsets.all(CL.s5),
                    decoration: BoxDecoration(
                      color: CL.bgSub,
                      borderRadius: BorderRadius.circular(CL.rCard),
                    ),
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
                              me!.visaStatusCode!,
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

                const SizedBox(height: CL.s7),
                PrimaryButton(
                  label: app.t('profile.save'),
                  onPressed: _saving ? null : _save,
                ),
              ],
            ),
    );
  }
}

/// 편집 행. 56px — 고령 사용자 기준입니다.
class _EditRow extends StatelessWidget {
  const _EditRow({required this.label, required this.controller, this.hint});

  final String label;
  final TextEditingController controller;
  final String? hint;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: CL.s5),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: CL.caption, color: CL.textSub)),
          const SizedBox(height: CL.s2),
          SizedBox(
            height: CL.primaryButtonHeight,
            child: TextField(
              controller: controller,
              style: const TextStyle(fontSize: CL.body),
              decoration: InputDecoration(
                hintText: hint,
                contentPadding: const EdgeInsets.symmetric(horizontal: CL.s5),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(CL.rCard),
                  borderSide: const BorderSide(color: CL.lineStrong),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(CL.rCard),
                  borderSide: const BorderSide(color: CL.lineStrong),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
