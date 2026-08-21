import 'package:carelink_field_ui/carelink_field_ui.dart';
import 'package:flutter/material.dart';
import '../../core/app_state.dart';
import '../../core/i18n/strings.dart';
import '../../models/guardian_models.dart';
import 'common.dart';
import 'confirm_screen.dart';
import 'match_screen.dart';

/// SCR-303 간병 신청.
///
/// ── 24시간 상주가 목록에 없습니다 ──────────────────────────────────────
/// §5.12 (2026-08-21 확정). 디자인 시안에는 '24시간 상주' 선택지가 있지만,
/// 그 시안 이후 운영하지 않기로 결정됐습니다. `shift_patterns.H24_LIVE_IN`은
/// `is_active = false`이고 서버가 요청 생성 자체를 막습니다.
///
/// 고를 수 없는 것을 보여 주고 나중에 거절하는 것보다 처음부터 없는 편이
/// 낫습니다 — 고른 사람은 왜 안 되는지 모른 채 전화를 겁니다.
///
/// ── 필요한 도움 목록은 서버 카탈로그입니다 ────────────────────────────
/// 화면에 상수 배열을 두면 그 배열이 곧 카탈로그가 되고, 의료행위가
/// 거기로 들어옵니다 (§6-2).
class RequestScreen extends StatefulWidget {
  const RequestScreen({super.key, required this.hospitalId, required this.hospitalName});

  final String hospitalId;
  final String hospitalName;

  @override
  State<RequestScreen> createState() => _RequestScreenState();
}

/// 교대 패턴. `H24_LIVE_IN`은 여기 없습니다 (§5.12).
const _shifts = ['H8_3SHIFT', 'H12_2SHIFT', 'DAY', 'NIGHT'];
const _mobility = ['INDEPENDENT', 'PARTIAL_ASSIST', 'FULL_ASSIST'];

class _RequestScreenState extends State<RequestScreen> {
  final _ward = TextEditingController();
  final _cautions = TextEditingController();
  DateTime? _startAt;
  String _shift = 'H8_3SHIFT';
  String _mob = 'PARTIAL_ASSIST';
  final Set<String> _items = {};
  List<CareServiceItem>? _catalog;
  String? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _ward.dispose();
    _cautions.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final app = AppScope.of(context);
    try {
      final res = await app.api.get('/care-services/catalog') as List<dynamic>;
      if (!mounted) return;
      setState(() => _catalog =
          res.map((e) => CareServiceItem.fromJson(e as Map<String, dynamic>)).toList());
    } catch (_) {
      if (mounted) setState(() => _catalog = const []);
    }
  }

  /// 보호자가 입력하는 시각은 언제나 **병원 벽시계**입니다.
  ///
  /// 기기 시간대로 해석하면 시차가 있는 기기에서 09:00을 넣고 18:00으로
  /// 확인받게 됩니다. KST로 못 박고 UTC ISO로 보냅니다.
  String? _startIso() {
    final s = _startAt;
    if (s == null) return null;
    return DateTime.utc(s.year, s.month, s.day, s.hour, s.minute)
        .subtract(const Duration(hours: 9))
        .toIso8601String();
  }

  Future<void> _pickStart() async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: now,
      firstDate: now.subtract(const Duration(days: 1)),
      lastDate: now.add(const Duration(days: 365)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(context: context, initialTime: TimeOfDay.now());
    if (time == null || !mounted) return;
    setState(() => _startAt =
        DateTime(date.year, date.month, date.day, time.hour, time.minute));
  }

  Future<void> _submit() async {
    final app = AppScope.of(context);
    final iso = _startIso();
    if (iso == null) return;
    setState(() { _busy = true; _error = null; });
    try {
      final res = await app.api.post('/care-requests', {
        'hospitalId': widget.hospitalId,
        'ward': _ward.text.trim().isEmpty ? null : _ward.text.trim(),
        'serviceType': _shift == 'NIGHT' ? 'NIGHT' : 'DAY',
        'shiftPatternCode': _shift,
        'startAt': iso,
        'supportItems': _items.toList(),
        'mobilityLevel': _mob,
        'cautions': _cautions.text.trim().isEmpty ? null : _cautions.text.trim(),
      }) as Map<String, dynamic>;
      if (!mounted) return;
      final created = CareRequest.fromJson(res);
      // 업무범위 검토로 넘어간 요청은 매칭 화면으로 보내지 않습니다 —
      // 고를 수 있는 것이 없는 화면을 여는 셈입니다 (§6-15).
      Navigator.of(context).pushReplacement(MaterialPageRoute<void>(
        builder: (_) => created.inScopeReview
            ? ConfirmScreen(requestId: created.id)
            : MatchScreen(requestId: created.id),
      ));
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = errorKey(e.code));
    } catch (_) {
      if (mounted) setState(() => _error = 'error.network');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final catalog = _catalog;

    return Scaffold(
      appBar: AppBar(title: Text(app.t('guardian.request.title'))),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(CL.s6),
          children: [
            Ask(text: app.t('guardian.form.ask'), sub: widget.hospitalName),

            FieldCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextField(
                    controller: _ward,
                    style: const TextStyle(fontSize: CLUp.body),
                    decoration: InputDecoration(
                      labelText: app.t('guardian.form.ward'),
                      hintText: app.t('guardian.form.wardHint'),
                    ),
                  ),
                  const SizedBox(height: CL.s5),
                  // 날짜·시간은 직접 입력받지 않습니다. 키보드로 치게 하면
                  // 형식이 틀리고, 틀린 값은 조용히 다른 시각이 됩니다.
                  SecondaryButton(
                    up: true,
                    label: _startAt == null
                        ? app.t('guardian.form.start')
                        : '${app.t('guardian.form.start')} · ${fmtKst(_startAt!.toUtc().subtract(const Duration(hours: 9)))}',
                    onPressed: _pickStart,
                  ),
                ],
              ),
            ),
            const SizedBox(height: CL.s4),

            FieldCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  CardTitle(app.t('guardian.form.shift')),
                  for (final code in _shifts)
                    PickTile(
                      label: codeLabel(code, app.locale),
                      selected: _shift == code,
                      note: code == 'H8_3SHIFT' ? app.t('guardian.form.recommended') : null,
                      onTap: () => setState(() => _shift = code),
                    ),
                  // 24시간 상주가 왜 없는지 적어 두지 않으면 "왜 안 보이냐"는
                  // 문의가 그대로 옵니다.
                  NoteBox(text: app.t('guardian.form.no24h')),
                ],
              ),
            ),
            const SizedBox(height: CL.s4),

            FieldCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  CardTitle(app.t('guardian.form.mobility')),
                  for (final code in _mobility)
                    PickTile(
                      label: codeLabel(code, app.locale),
                      selected: _mob == code,
                      onTap: () => setState(() => _mob = code),
                    ),
                ],
              ),
            ),
            const SizedBox(height: CL.s4),

            FieldCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  CardTitle(app.t('guardian.form.support')),
                  if (catalog == null)
                    StateNotice(message: app.t('common.loading'))
                  else
                    for (final c in catalog)
                      PickTile(
                        label: c.labelKo,
                        selected: _items.contains(c.code),
                        onTap: () => setState(() =>
                            _items.contains(c.code) ? _items.remove(c.code) : _items.add(c.code)),
                      ),
                ],
              ),
            ),
            const SizedBox(height: CL.s4),

            FieldCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  CardTitle(app.t('guardian.form.cautions')),
                  TextField(
                    controller: _cautions,
                    maxLines: 4,
                    style: const TextStyle(fontSize: CLUp.body),
                    decoration: InputDecoration(hintText: app.t('guardian.form.cautionsHint')),
                  ),
                  const SizedBox(height: CL.s3),
                  // 자유 입력은 서버가 `scope-keyword-scan`으로 훑고, 걸리면
                  // 운영자 검토로 보냅니다. **자동 거절하지 않습니다** (§6-15) —
                  // 거절하면 표현만 바꿔서 다시 씁니다.
                  Text(
                    app.t('guardian.form.medicalNote'),
                    style: const TextStyle(fontSize: CLUp.caption, color: CL.textMuted, height: 1.55),
                  ),
                ],
              ),
            ),
            const SizedBox(height: CL.s6),

            if (_error != null) StateNotice(message: app.t(_error!), tone: Tone.alert),

            PrimaryButton(
              label: app.t('guardian.form.submit'),
              up: true,
              onPressed: (_busy || _startAt == null) ? null : _submit,
            ),
          ],
        ),
      ),
    );
  }
}
