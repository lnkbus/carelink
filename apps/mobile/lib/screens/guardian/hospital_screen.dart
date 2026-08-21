import 'package:carelink_field_ui/carelink_field_ui.dart';
import 'package:flutter/material.dart';
import '../../core/app_state.dart';
import '../../core/i18n/strings.dart';
import '../../models/guardian_models.dart';
import 'common.dart';
import 'request_screen.dart';

/// SCR-302 병원 선택.
///
/// 제휴 병원만 신청할 수 있습니다. 목록에 없는 병원을 찾는 사람에게 빈 화면을
/// 주면 앱이 고장 났다고 생각하므로, **왜 없는지**를 같이 씁니다.
class HospitalScreen extends StatefulWidget {
  const HospitalScreen({super.key});

  @override
  State<HospitalScreen> createState() => _HospitalScreenState();
}

class _HospitalScreenState extends State<HospitalScreen> {
  List<CareHospital>? _all;
  String _q = '';
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final app = AppScope.of(context);
    try {
      final res = await app.api.get('/care-hospitals') as List<dynamic>;
      if (!mounted) return;
      setState(() => _all =
          res.map((e) => CareHospital.fromJson(e as Map<String, dynamic>)).toList());
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = errorKey(e.code));
    } catch (_) {
      if (mounted) setState(() => _error = 'error.network');
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final all = _all;
    final t = _q.trim();
    final shown = all == null
        ? const <CareHospital>[]
        : t.isEmpty
            ? all
            : all.where((h) => h.name.contains(t) || (h.region ?? '').contains(t)).toList();

    return Scaffold(
      appBar: AppBar(title: Text(app.t('guardian.request.title'))),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(CL.s6),
          children: [
            Ask(text: app.t('guardian.hospital.ask')),

            // 검색은 라벨 없이 한 줄입니다 — 위의 질문 문장이 이미 라벨입니다.
            TextField(
              onChanged: (v) => setState(() => _q = v),
              style: const TextStyle(fontSize: CLUp.subtitle, fontWeight: FontWeight.w600),
              decoration: InputDecoration(
                hintText: app.t('guardian.hospital.search'),
                prefixIcon: const Icon(Icons.search, size: CLUp.icon),
                constraints: const BoxConstraints(minHeight: CLUp.primaryButtonHeight),
              ),
            ),
            const SizedBox(height: CL.s5),

            if (_error != null) StateNotice(message: app.t(_error!), tone: Tone.alert),
            if (all == null && _error == null) StateNotice(message: app.t('common.loading')),
            if (all != null && shown.isEmpty)
              StateNotice(message: app.t('guardian.hospital.none')),

            for (final h in shown)
              FieldCard(
                onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                  builder: (_) => RequestScreen(hospitalId: h.id, hospitalName: h.name),
                )),
                child: Row(
                  children: [
                    const Icon(Icons.local_hospital_outlined, size: 32, color: CL.action),
                    const SizedBox(width: CL.s5),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            h.name,
                            style: const TextStyle(
                              fontSize: CLUp.subtitle, fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: CL.s2),
                          // 색이 아니라 문장으로 씁니다. 숫자만 있으면 무슨 뜻인지 모릅니다.
                          Text(
                            '${h.region == null ? '' : '${h.region} · '}'
                            '${app.t('guardian.hospital.available')} ${h.activeCaregivers}',
                            style: const TextStyle(fontSize: CLUp.caption, color: CL.textMuted),
                          ),
                        ],
                      ),
                    ),
                    const Icon(Icons.chevron_right, color: CL.textMuted),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
