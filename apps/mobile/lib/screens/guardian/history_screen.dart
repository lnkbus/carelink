import 'package:carelink_field_ui/carelink_field_ui.dart';
import 'package:flutter/material.dart';
import '../../core/app_state.dart';
import '../../core/i18n/strings.dart';
import '../../models/caregiver_models.dart' show ServiceLogEntry;
import '../../models/guardian_models.dart';
import 'common.dart';
import 'live_screen.dart';

/// SCR-307 이용 내역.
///
/// ── 정산 금액이 없습니다 ────────────────────────────────────────────────
/// SCREENS는 `GET /assignments/{id}/settlement`과 `GET /invoices/{id}`를
/// 요구하지만 **정산·결제는 V3이고 착수 금지입니다** (CLAUDE.md §2).
/// 임의 금액을 띄우면 그 숫자를 본 보호자가 나중에 다른 금액을 청구받습니다.
///
/// ── 그래서 무엇을 보여주는가 ────────────────────────────────────────────
/// **기록된 시작·종료 시각**입니다. SCR-307 notes의 요점이 여기입니다 —
/// 근무시간 이견은 반드시 발생하고, 그때 유일한 근거가 `service_logs`의
/// 원본 기록입니다. 로그는 append-only이고 정정은 별도 행으로 남습니다 (§5.4).
///
/// 시간을 곱해서 금액을 만들지 않습니다. 금액을 만드는 순간 그것이 청구서가
/// 되고, 그 계산은 아직 확정되지 않았습니다.
class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _Row {
  _Row(this.request, this.assignment, this.logs);
  final CareRequest request;
  final CareAssignment? assignment;
  final List<ServiceLogEntry> logs;
}

class _HistoryScreenState extends State<HistoryScreen> {
  List<_Row>? _rows;
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
      final res = await app.api.get('/care-requests/me/list') as List<dynamic>;
      final done = res
          .map((e) => CareRequest.fromJson(e as Map<String, dynamic>))
          .where((r) => r.isDone)
          .toList();

      // 완료 건마다 배정과 기록을 붙입니다. 건수가 많지 않아 순차로 충분합니다.
      final rows = <_Row>[];
      for (final r in done) {
        CareAssignment? a;
        var logs = const <ServiceLogEntry>[];
        try {
          final list = await app.api.get('/care-requests/${r.id}/assignments') as List<dynamic>;
          a = list
              .map((e) => CareAssignment.fromJson(e as Map<String, dynamic>))
              .where((x) => x.isFixed)
              .firstOrNull;
        } catch (_) {
          a = null;
        }
        if (a != null) {
          try {
            final l = await app.api.get('/care-assignments/${a.id}/logs') as List<dynamic>;
            logs = l.map((e) => ServiceLogEntry.fromJson(e as Map<String, dynamic>)).toList();
          } catch (_) {
            logs = const [];
          }
        }
        rows.add(_Row(r, a, logs));
      }
      if (mounted) setState(() => _rows = rows);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = errorKey(e.code));
    } catch (_) {
      if (mounted) setState(() => _error = 'error.network');
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final rows = _rows;

    return Scaffold(
      appBar: AppBar(title: Text(app.t('guardian.history.title'))),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(CL.s6),
          children: [
            if (_error != null) StateNotice(message: app.t(_error!), tone: Tone.alert),
            if (rows == null && _error == null) StateNotice(message: app.t('common.loading')),

            if (rows != null) ...[
              // 시안(SCR-307)의 올해 요약. 금액(`₩3,412,000`)은 넣지 않습니다 —
              // 청구 단가가 미확정이라 합계를 만들면 그 숫자가 청구서가 됩니다.
              FieldCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CardTitle(app.t('guardian.history.thisYear')),
                    InfoRow(
                      label: app.t('guardian.history.count'),
                      value: '${rows.length}${app.t('home.count')}',
                      mono: true,
                    ),
                    InfoRow(
                      label: app.t('guardian.confirm.cost'),
                      value: app.t('guardian.cost.staffGuided'),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: CL.s4),

              if (rows.isEmpty) StateNotice(message: app.t('guardian.history.none')),

              for (final row in rows) _HistoryCard(row: row),

              NoteBox(text: app.t('guardian.history.costNote')),
            ],
          ],
        ),
      ),
    );
  }
}

class _HistoryCard extends StatelessWidget {
  const _HistoryCard({required this.row});

  final _Row row;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final started = row.logs.where((l) => l.logType == 'SHIFT_START').firstOrNull;
    final ended = row.logs.where((l) => l.logType == 'SHIFT_END').firstOrNull;
    final corrected = row.logs.any((l) => l.corrected);
    final a = row.assignment;

    return Padding(
      padding: const EdgeInsets.only(bottom: CL.s4),
      child: FieldCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    row.request.hospitalName ?? app.t('guardian.hospitalMissing'),
                    style: const TextStyle(fontSize: CLUp.subtitle, fontWeight: FontWeight.w700),
                  ),
                ),
                StatusPill(
                  tone: row.request.status == 'COMPLETED' ? Tone.signal : Tone.neutral,
                  label: codeLabel(row.request.status, app.locale),
                ),
              ],
            ),
            const SizedBox(height: CL.s3),
            InfoRow(label: app.t('guardian.form.ward'), value: row.request.ward),
            InfoRow(
              label: app.t('guardian.history.recordedStart'),
              value: started == null ? app.t('guardian.history.noRecord') : fmtKst(started.occurredAt),
            ),
            InfoRow(
              label: app.t('guardian.history.recordedEnd'),
              value: ended == null ? app.t('guardian.history.noRecord') : fmtKst(ended.occurredAt),
            ),
            if (a != null) InfoRow(label: '', value: a.caregiverDisplayCode, mono: true),

            // 정정이 있었다는 사실을 숨기지 않습니다. 원본이 남아 있다는 것
            // 자체가 이견이 생겼을 때의 근거입니다 (§5.4).
            if (corrected) ...[
              const SizedBox(height: CL.s3),
              Text(
                app.t('guardian.history.correctedNote'),
                style: const TextStyle(fontSize: CL.caption, color: CL.flag, height: 1.5),
              ),
            ],

            if (a != null) ...[
              const SizedBox(height: CL.s4),
              SecondaryButton(
                up: true,
                label: app.t('guardian.history.viewLogs'),
                onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
                  builder: (_) => LiveScreen(assignmentId: a.id),
                )),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
