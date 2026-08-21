import 'package:carelink_field_ui/carelink_field_ui.dart';
import 'package:flutter/material.dart';
import '../core/app_state.dart';
import '../core/i18n/strings.dart';
import '../models/models.dart';

/// SCR-403 근무 상세 + SCR-404 근무 시작·종료.
///
/// 두 화면을 하나로 합쳤습니다. 간병사는 병실 앞에서 "여기가 맞나" 확인하고
/// 곧바로 시작을 누릅니다 — 그 사이에 화면을 한 번 더 넘기게 하면 아무도
/// 확인하지 않고 바로 시작만 누릅니다.
///
/// ── 환자 정보가 없습니다 ────────────────────────────────────────────────
/// 실명·나이·성별·진단명이 나오지 않습니다 (docs/11 §3.2 · SCR-403 notes).
/// API가 내려주지 않고 모델에도 필드가 없습니다. 간병사가 알아야 하는 것은
/// **어디서 무엇을 하는가**입니다 — 병실, 필요한 지원, 주의사항.
///
/// ── 출퇴근은 병실 QR입니다 ──────────────────────────────────────────────
/// GPS를 기본으로 두지 않았습니다 (§6-3). 위치정보 수집·이용 동의와 법규
/// 검토가 선행돼야 하고, QR은 동의 부담이 낮으면서 정확도는 더 높습니다 —
/// GPS는 병원 건물 안에서 수십 미터씩 틀립니다.
class ShiftScreen extends StatefulWidget {
  const ShiftScreen({super.key, required this.assignmentId});
  final String assignmentId;

  @override
  State<ShiftScreen> createState() => _ShiftScreenState();
}

class _ShiftScreenState extends State<ShiftScreen> {
  AssignmentDetail? _detail;
  List<ServiceLogEntry> _logs = const [];
  final _qr = TextEditingController();
  String? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _qr.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final app = AppScope.of(context);
    setState(() => _error = null);
    try {
      final d = await app.api.get('/care-assignments/${widget.assignmentId}/caregiver-view');
      final l = await app.api.get('/care-assignments/${widget.assignmentId}/logs') as List<dynamic>;
      if (!mounted) return;
      setState(() {
        _detail = AssignmentDetail.fromJson(d as Map<String, dynamic>);
        _logs = l.map((e) => ServiceLogEntry.fromJson(e as Map<String, dynamic>)).toList();
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = errorKey(e.code));
    } catch (_) {
      if (mounted) setState(() => _error = 'error.network');
    }
  }

  /// 휴게 시작·종료.
  ///
  /// QR을 요구하지 않습니다. 휴게는 병실 밖에서 일어나야 정상이고, 병실 QR을
  /// 찍으라고 하면 자리를 뜨지 말라는 뜻이 됩니다 — 그러면 그건 휴게가 아니라
  /// 대기시간입니다 (근로기준법 §50③).
  Future<void> _break(String type) async {
    final app = AppScope.of(context);
    setState(() { _busy = true; _error = null; });
    try {
      await app.api.post('/care-assignments/${widget.assignmentId}/logs', {'logType': type});
      await _load();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = errorKey(e.code));
    } catch (_) {
      if (mounted) setState(() => _error = 'error.network');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _boundary(String which) async {
    final app = AppScope.of(context);
    setState(() { _busy = true; _error = null; });
    try {
      await app.api.post('/care-assignments/${widget.assignmentId}/$which', {
        'checkMethod': 'QR',
        'qrToken': _qr.text.trim(),
      });
      _qr.clear();
      await _load();
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
    final d = _detail;
    final started = _logs.any((l) => l.logType == 'SHIFT_START');
    final ended = _logs.any((l) => l.logType == 'SHIFT_END');
    // 휴게 로그를 시각 순으로 훑어 지금 쉬는 중인지와 누적 분을 셉니다.
    final breaks = _logs.where((l) => l.logType.startsWith('BREAK_')).toList()
      ..sort((a, b) => a.occurredAt.compareTo(b.occurredAt));
    var breakMinutes = 0;
    DateTime? openedAt;
    for (final l in breaks) {
      if (l.logType == 'BREAK_START') {
        openedAt = l.occurredAt;
      } else if (openedAt != null) {
        breakMinutes += l.occurredAt.difference(openedAt).inMinutes;
        openedAt = null;
      }
    }
    final onBreak = openedAt != null;

    return Scaffold(
      appBar: AppBar(
        title: Text(app.t('detail.title'), style: const TextStyle(fontSize: CL.subtitle)),
        backgroundColor: CL.bg,
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(CL.s6),
          children: [
            if (_error != null) ...[
              StateNotice(tone: Tone.alert, message: app.t(_error!)),
              const SizedBox(height: CL.s5),
            ],
            if (d == null && _error == null)
              StateNotice(message: app.t('common.loading'))
            else if (d != null) ...[
              // 업무범위 경고를 맨 위에 둡니다. 아래에 두면 시작을 누르고 나서
              // 보게 되고, 그때는 이미 병실 안입니다.
              if (d.restrictedFlags.isNotEmpty) ...[
                FieldCard(
                  tone: Tone.alert,
                  child: Text(
                    app.t('detail.scopeWarning'),
                    style: const TextStyle(fontSize: CL.body, color: CL.alert, height: 1.5),
                  ),
                ),
                const SizedBox(height: CL.s5),
              ],

              FieldCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _Row(label: app.t('detail.hospital'), value: d.hospitalName ?? '—'),
                    _Row(label: app.t('detail.ward'), value: d.ward ?? '—', mono: true),
                    _Row(label: app.t('detail.shift'), value: codeLabel(d.shiftPatternCode, app.locale)),
                    _Row(label: app.t('detail.mobility'), value: codeLabel(d.mobilityLevel, app.locale)),
                  ],
                ),
              ),
              const SizedBox(height: CL.s5),

              if (d.supportItems.isNotEmpty) ...[
                FieldCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(app.t('detail.support'),
                          style: const TextStyle(fontSize: CL.caption, color: CL.textSub)),
                      const SizedBox(height: CL.s3),
                      // 진단명 대신 이것을 봅니다. 목록은 서버 카탈로그에서
                      // 오고, 카탈로그에 의료행위는 존재하지 않습니다 (§6-2).
                      for (final s in d.supportItems)
                        Padding(
                          padding: const EdgeInsets.only(bottom: CL.s2),
                          child: Text('· ${codeLabel(s, app.locale)}',
                              style: const TextStyle(fontSize: CL.body)),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: CL.s5),
              ],

              if ((d.cautions ?? '').isNotEmpty) ...[
                FieldCard(
                  tone: Tone.flag,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(app.t('detail.cautions'),
                          style: const TextStyle(fontSize: CL.caption, color: CL.flag)),
                      const SizedBox(height: CL.s3),
                      Text(d.cautions!,
                          style: const TextStyle(fontSize: CL.body, height: 1.5)),
                    ],
                  ),
                ),
                const SizedBox(height: CL.s5),
              ],

              // ── 휴게 (근로기준법 §54) ────────────────────────────────
              //
              // 근무를 시작한 뒤에만 보입니다. 시작 전에 휴게를 찍을 일은
              // 없고, 버튼이 있으면 잘못 눌립니다.
              if (started && !ended) ...[
                FieldCard(
                  tone: onBreak ? Tone.flag : null,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: [
                          if (onBreak)
                            StatusPill(tone: Tone.flag, label: app.t('break.onBreak'))
                          else
                            Text(app.t('break.total'),
                                style: const TextStyle(fontSize: CL.caption, color: CL.textSub)),
                          const Spacer(),
                          Text('$breakMinutes분',
                              style: const TextStyle(
                                  fontSize: CL.body, fontFamily: CL.monoFamily,
                                  fontWeight: FontWeight.w600)),
                        ],
                      ),
                      const SizedBox(height: CL.s4),
                      SecondaryButton(
                        label: app.t(onBreak ? 'break.end' : 'break.start'),
                        onPressed: _busy ? null : () => _break(onBreak ? 'BREAK_END' : 'BREAK_START'),
                      ),
                      const SizedBox(height: CL.s3),
                      // 찍지 않으면 손해가 아니라는 것을 명시합니다. 반대로
                      // 적으면 아무도 찍지 않습니다.
                      Text(app.t('break.help'),
                          style: const TextStyle(
                              fontSize: CL.caption, color: CL.textMuted, height: 1.4)),
                    ],
                  ),
                ),
                const SizedBox(height: CL.s5),
              ],

              // ── SCR-404 ──────────────────────────────────────────────
              if (!ended) ...[
                Text(app.t('shift.scanQr'),
                    style: const TextStyle(fontSize: CL.caption, color: CL.textSub)),
                const SizedBox(height: CL.s3),
                SizedBox(
                  height: CL.heroButtonHeight,
                  child: TextField(
                    controller: _qr,
                    // 이게 없으면 글자를 넣어도 버튼이 다시 그려지지 않아
                    // **영원히 비활성 상태로 남습니다.** 근무를 시작할 수 없습니다.
                    onChanged: (_) => setState(() {}),
                    style: const TextStyle(fontSize: CL.body, fontFamily: CL.monoFamily),
                    decoration: InputDecoration(
                      hintText: '••••',
                      filled: true,
                      fillColor: CL.bg,
                      contentPadding: const EdgeInsets.symmetric(horizontal: CL.s5),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(CL.rCard)),
                    ),
                  ),
                ),
                const SizedBox(height: CL.s3),
                Text(app.t('shift.qrHelp'),
                    style: const TextStyle(fontSize: CL.caption, color: CL.textMuted, height: 1.4)),
                const SizedBox(height: CL.s5),
                PrimaryButton(
                  hero: true,
                  label: app.t(started ? 'shift.end' : 'shift.start'),
                  onPressed: _busy || _qr.text.trim().isEmpty
                      ? null
                      : () => _boundary(started ? 'end' : 'start'),
                ),
                const SizedBox(height: CL.s6),
              ],

              Text(app.t('shift.logs'),
                  style: const TextStyle(fontSize: CL.subtitle, fontWeight: FontWeight.w700)),
              const SizedBox(height: CL.s4),
              if (_logs.isEmpty)
                const Text('—', style: TextStyle(fontSize: CL.body, color: CL.textMuted))
              else
                for (final l in _logs)
                  Padding(
                    padding: const EdgeInsets.only(bottom: CL.s3),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(_t(l.occurredAt),
                            style: const TextStyle(
                                fontSize: CL.caption, fontFamily: CL.monoFamily, color: CL.textMuted)),
                        const SizedBox(width: CL.s4),
                        Expanded(
                          child: Text(
                            app.t(switch (l.logType) {
                              'SHIFT_START' => 'shift.started',
                              'SHIFT_END' => 'shift.ended',
                              'BREAK_START' => 'break.start',
                              'BREAK_END' => 'break.end',
                              _ => 'shift.logs',
                            }),
                            style: const TextStyle(fontSize: CL.body),
                          ),
                        ),
                      ],
                    ),
                  ),
              const SizedBox(height: CL.s5),
              // append-only라는 사실을 화면에 적습니다. 고칠 수 있다고
              // 생각하면 대충 찍고 나중에 고치려 합니다 (§5.4).
              Text(app.t('shift.appendOnly'),
                  style: const TextStyle(fontSize: CL.caption, color: CL.textMuted, height: 1.5)),
            ],
          ],
        ),
      ),
    );
  }

  String _t(DateTime t) {
    final l = t.toLocal();
    return '${l.hour.toString().padLeft(2, '0')}:${l.minute.toString().padLeft(2, '0')}';
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value, this.mono = false});
  final String label;
  final String value;
  final bool mono;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: CL.s2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 96,
            child: Text(label, style: const TextStyle(fontSize: CL.caption, color: CL.textSub)),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                fontSize: CL.body,
                fontFamily: mono ? CL.monoFamily : null,
                fontWeight: mono ? FontWeight.w600 : FontWeight.w400,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
