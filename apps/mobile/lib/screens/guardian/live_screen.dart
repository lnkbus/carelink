import 'package:carelink_field_ui/carelink_field_ui.dart';
import 'package:flutter/material.dart';
import '../../core/app_state.dart';
import '../../core/i18n/strings.dart';
import '../../models/caregiver_models.dart' show ServiceLogEntry;
import '../../models/guardian_models.dart';
import 'common.dart';

/// SCR-306 진행 중 서비스.
///
/// ── 이 화면이 문의를 줄입니다 ──────────────────────────────────────────
/// 보호자가 가장 많이 하는 행동은 "잘 있나 확인"입니다 (SCR-306 notes).
/// 근무 시작·종료 기록만 보여줘도 전화가 크게 줍니다.
///
/// ── 환자 상태를 기록하지 않습니다 ──────────────────────────────────────
/// 서술형 메모는 여기 나오지 않습니다 — API의 scope가 잘라 냅니다. 서술형
/// 기록을 보호자에게 보여주면 의료기록과 혼동되고, 그 순간 간병사가 쓴 문장이
/// 진료 판단의 근거처럼 읽힙니다. 정형 항목만 씁니다.
///
/// ── 간병사 연락처가 없습니다 ───────────────────────────────────────────
/// 시안의 전화·메시지 버튼 자리에는 **담당자 전화**가 들어갑니다. 직접 연락이
/// 열리면 플랫폼을 우회한 직거래가 생기고, 사고가 났을 때 책임 주체가
/// 사라집니다.
class LiveScreen extends StatefulWidget {
  const LiveScreen({super.key, required this.assignmentId});

  final String assignmentId;

  @override
  State<LiveScreen> createState() => _LiveScreenState();
}

class _LiveScreenState extends State<LiveScreen> {
  CareAssignment? _assignment;
  List<ServiceLogEntry>? _logs;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final app = AppScope.of(context);
    setState(() => _error = null);
    try {
      final a = await app.api.get('/care-assignments/${widget.assignmentId}') as Map<String, dynamic>;
      final l = await app.api.get('/care-assignments/${widget.assignmentId}/logs') as List<dynamic>;
      if (!mounted) return;
      setState(() {
        _assignment = CareAssignment.fromJson(a);
        _logs = l.map((e) => ServiceLogEntry.fromJson(e as Map<String, dynamic>)).toList();
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = errorKey(e.code));
    } catch (_) {
      if (mounted) setState(() => _error = 'error.network');
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final a = _assignment;
    final logs = _logs;

    // 시작/종료가 짝을 이루는지 봅니다 — 종료 기록이 없으면 근무 중입니다.
    final started = logs?.where((l) => l.logType == 'SHIFT_START').firstOrNull;
    final ended = logs?.where((l) => l.logType == 'SHIFT_END').firstOrNull;
    final working = started != null && ended == null;

    return Scaffold(
      appBar: AppBar(title: Text(app.t('guardian.live.title'))),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
            padding: const EdgeInsets.all(CL.s6),
            children: [
              if (_error != null) StateNotice(message: app.t(_error!), tone: Tone.alert),
              if (a == null && _error == null) StateNotice(message: app.t('common.loading')),

              if (a != null) ...[
                FieldCard(
                  tone: Tone.action,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              app.t('guardian.live.title'),
                              style: const TextStyle(
                                fontSize: CLUp.caption, fontWeight: FontWeight.w700,
                                color: CL.actionText,
                              ),
                            ),
                          ),
                          StatusPill(
                            tone: working ? Tone.signal : Tone.neutral,
                            label: ended != null
                                ? app.t('guardian.live.ended')
                                : working
                                    ? app.t('guardian.live.working')
                                    : app.t('guardian.live.beforeStart'),
                          ),
                        ],
                      ),
                      const SizedBox(height: CL.s5),
                      Row(
                        children: [
                          Container(
                            width: 56, height: 56,
                            decoration: const BoxDecoration(
                              color: CL.actionTint, shape: BoxShape.circle,
                            ),
                            alignment: Alignment.center,
                            child: const Icon(Icons.person, size: 28, color: CL.action),
                          ),
                          const SizedBox(width: CL.s5),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  a.caregiverDisplayCode,
                                  style: const TextStyle(
                                    fontFamily: CL.monoFamily, fontSize: CLUp.subtitle,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                const SizedBox(height: CL.s1),
                                Text(
                                  started == null
                                      ? app.t('guardian.live.beforeStart')
                                      : app.t('guardian.live.startedAt')
                                          .replaceAll('{t}', fmtKst(started.occurredAt)),
                                  style: const TextStyle(
                                    fontSize: CLUp.caption, color: CL.textMuted,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: CL.s4),
              ],

              FieldCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CardTitle(app.t('guardian.live.todayLog')),
                    if (logs == null)
                      StateNotice(message: app.t('common.loading'))
                    else if (logs.isEmpty)
                      StateNotice(message: app.t('guardian.live.noLog'))
                    else
                      for (final l in logs)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: CL.s2),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              SizedBox(
                                width: 132,
                                child: Text(
                                  fmtKst(l.occurredAt),
                                  style: const TextStyle(
                                    fontFamily: CL.monoFamily, fontSize: CL.caption,
                                    color: CL.textMuted,
                                  ),
                                ),
                              ),
                              Expanded(
                                child: Text(
                                  '${codeLabel(l.logType, app.locale)}'
                                  '${l.itemCode == null ? '' : ' · ${codeLabel(l.itemCode, app.locale)}'}'
                                  // 정정된 기록은 표시합니다. 원본이 남아 있다는
                                  // 사실 자체가 분쟁에서 근거가 됩니다 (§5.4).
                                  '${l.corrected ? ' ${app.t('guardian.live.corrected')}' : ''}',
                                  style: const TextStyle(fontSize: CLUp.caption),
                                ),
                              ),
                            ],
                          ),
                        ),
                  ],
                ),
              ),
              const SizedBox(height: CL.s6),

              Text(
                app.t('guardian.live.slaNote'),
                style: const TextStyle(fontSize: CLUp.caption, color: CL.textMuted, height: 1.6),
              ),
              const SizedBox(height: CL.s4),

              // 중단 요청을 버튼으로 만들지 않습니다 — 누르기 쉬워지고,
              // 중단은 되돌리기 어려운 동작입니다. 담당자를 거칩니다
              // (안전·부당대우 신고 4시간 SLA와 같은 경로).
              Text(
                '${app.t('guardian.live.stopRequest')} · ${app.t('guardian.live.call')} 1533-0000',
                style: const TextStyle(
                  fontSize: CLUp.caption, color: CL.alert, fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
