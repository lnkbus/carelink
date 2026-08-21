import 'package:carelink_field_ui/carelink_field_ui.dart';
import 'package:flutter/material.dart';
import '../core/app_state.dart';
import '../core/i18n/strings.dart';
import '../models/models.dart';

/// SCR-402 일정 · 가용 시간.
///
/// **간병사가 직접 관리해야 매칭 정확도가 올라갑니다** (SCR-402 notes).
/// 이 데이터가 없으면 운영자가 전화로 확인하게 되고, 그 순간 '매칭 시간
/// 단축'이라는 MVP 검증 목표가 무너집니다.
///
/// 달력을 그리지 않았습니다. 달력 위젯은 화면이 작을수록 터치 타깃이
/// 작아지고, 여기 사용자는 48px 아래를 누르지 못합니다. 기간 목록 + 큰
/// 버튼이 같은 일을 합니다.
class ScheduleScreen extends StatefulWidget {
  const ScheduleScreen({super.key, this.embedded = false});

  /// 하단 탭으로 열렸는가. 탭이면 뒤로가기 화살표를 띄우지 않습니다 —
  /// 돌아갈 곳이 없는데 화살표가 있으면 누르고 아무 일도 안 일어납니다.
  final bool embedded;

  @override
  State<ScheduleScreen> createState() => _ScheduleScreenState();
}

class _ScheduleScreenState extends State<ScheduleScreen> {
  List<AvailabilityBlock>? _blocks;
  List<Assignment>? _shifts;
  String? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final app = AppScope.of(context);
    setState(() => _error = null);
    try {
      final res = await app.api.get('/caregivers/me/availability') as List<dynamic>;
      final shifts = await app.api.get('/caregivers/me/assignments') as List<dynamic>;
      if (!mounted) return;
      setState(() {
        _blocks = res.map((e) => AvailabilityBlock.fromJson(e as Map<String, dynamic>)).toList();
        _shifts = shifts.map((e) => Assignment.fromJson(e as Map<String, dynamic>)).toList();
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = errorKey(e.code));
    } catch (_) {
      if (mounted) setState(() => _error = 'error.network');
    }
  }

  /// 근무 카드 (시안 SCR-402).
  ///
  /// 지난 근무 중 기록이 없는 건은 **맨 위로** 올립니다. 그 건이 밀리면
  /// 잊히고, 잊힌 근무는 집계되지 않습니다.
  List<Widget> _shiftCards(AppState app) {
    final shifts = _shifts;
    if (shifts == null) return [StateNotice(message: app.t('common.loading'))];

    final relevant = shifts.where((a) => !a.isOffer).toList()
      ..sort((x, y) {
        final ax = _needsRecord(x) ? 0 : 1;
        final ay = _needsRecord(y) ? 0 : 1;
        if (ax != ay) return ax - ay;
        final sx = x.startAt, sy = y.startAt;
        if (sx == null || sy == null) return 0;
        return sy.compareTo(sx);
      });
    if (relevant.isEmpty) return [StateNotice(message: app.t('schedule.noShifts'))];

    final hours = relevant.where((a) => a.isToday).length * 8;
    return [
      Row(
        children: [
          Text(app.t('schedule.thisWeek'),
              style: const TextStyle(fontSize: CLUp.caption, color: CL.textMuted)),
          const SizedBox(width: CL.s3),
          Text(
            '${relevant.length}${app.t('home.count')} · $hours${app.t('schedule.hours')}',
            style: const TextStyle(
              fontFamily: CL.monoFamily, fontSize: CLUp.caption, fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
      const SizedBox(height: CL.s4),
      for (final a in relevant)
        Padding(
          padding: const EdgeInsets.only(bottom: CL.s4),
          child: FieldCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      a.startAt == null ? '—' : _dayLabel(a.startAt!),
                      style: const TextStyle(
                        fontFamily: CL.monoFamily, fontSize: CLUp.caption, color: CL.textMuted,
                      ),
                    ),
                    const Spacer(),
                    StatusPill(tone: _tone(a), label: app.t(_stateKey(a))),
                  ],
                ),
                const SizedBox(height: CL.s4),
                Text(
                  a.ward ?? app.t('shift.wardUnknown'),
                  style: const TextStyle(fontSize: CLUp.body, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 2),
                Text(
                  '${a.hospitalName ?? '—'} · ${a.shiftStartTime ?? '—'}~${a.shiftEndTime ?? '—'}',
                  style: const TextStyle(
                    fontFamily: CL.monoFamily, fontSize: CLUp.caption, color: CL.textSub,
                  ),
                ),
              ],
            ),
          ),
        ),
    ];
  }

  /// 시작 시각이 지났는데 아직 IN_SERVICE도 완료도 아니면 기록이 빠진 것입니다.
  bool _needsRecord(Assignment a) {
    final start = a.startAt;
    if (start == null) return false;
    return start.isBefore(DateTime.now().toUtc()) && a.status == 'ASSIGNED';
  }

  String _stateKey(Assignment a) {
    if (_needsRecord(a)) return 'schedule.state.needsRecord';
    if (a.status == 'COMPLETED') return 'schedule.state.recorded';
    return 'schedule.state.upcoming';
  }

  Tone _tone(Assignment a) {
    if (_needsRecord(a)) return Tone.flag;
    if (a.status == 'COMPLETED') return Tone.signal;
    return Tone.action;
  }

  Future<void> _add(DateTimeRange range, String kind) async {
    final app = AppScope.of(context);
    setState(() { _busy = true; _error = null; });
    try {
      await app.api.post('/caregivers/me/availability', {
        'startsAt': range.start.toUtc().toIso8601String(),
        // 종료일은 그날 끝까지입니다. 날짜만 고르게 해놓고 00:00으로 보내면
        // 마지막 날이 통째로 빠집니다.
        'endsAt': range.end.add(const Duration(days: 1)).toUtc().toIso8601String(),
        'kind': kind,
      });
      await _load();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = errorKey(e.code));
    } catch (_) {
      if (mounted) setState(() => _error = 'error.network');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _remove(AvailabilityBlock b) async {
    final app = AppScope.of(context);
    setState(() { _busy = true; _error = null; });
    try {
      await app.api.delete('/caregivers/me/availability/${b.id}');
      await _load();
    } on ApiException catch (e) {
      // 배정이 걸린 기간은 지워지지 않습니다. 지워지면 화면에서는 사라지지만
      // 배정은 남고, 그 상태로 안 나오면 병실에 사람이 없습니다.
      if (mounted) setState(() => _error = errorKey(e.code));
    } catch (_) {
      if (mounted) setState(() => _error = 'error.network');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _pick(String kind) async {
    final now = DateTime.now();
    final range = await showDateRangePicker(
      context: context,
      firstDate: now.subtract(const Duration(days: 1)),
      lastDate: now.add(const Duration(days: 365)),
    );
    if (range != null) await _add(range, kind);
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final blocks = _blocks;

    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: !widget.embedded,
        title: Text(
          app.t('schedule.title'),
          style: const TextStyle(fontSize: CLUp.title, fontWeight: FontWeight.w700),
        ),
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

            // ── 근무 일정 (시안 SCR-402) ──────────────────────────────
            // 주간 요약 한 줄 + 근무 카드. 상태는 세 가지뿐입니다:
            // 진행 예정 · 기록 완료 · **기록 필요**. 마지막 것이 이 화면의
            // 존재 이유입니다 — 기록이 없으면 근무시간이 집계되지 않고,
            // 그러면 분쟁에서 근거가 없습니다 (§5.4).
            Text(app.t('schedule.shifts'),
                style: const TextStyle(fontSize: CLUp.subtitle, fontWeight: FontWeight.w700)),
            const SizedBox(height: CL.s4),
            ..._shiftCards(app),
            const SizedBox(height: CL.s7),

            // ── 근무 가능 시간 ────────────────────────────────────────
            // 시안에는 없지만 남깁니다. 간병사가 직접 관리해야 매칭 정확도가
            // 올라가고, 없으면 운영자가 전화로 확인하게 됩니다 (SCR-402 notes).
            Text(app.t('schedule.availability'),
                style: const TextStyle(fontSize: CLUp.subtitle, fontWeight: FontWeight.w700)),
            const SizedBox(height: CL.s4),
            if (blocks == null && _error == null)
              StateNotice(message: app.t('common.loading'))
            else if ((blocks ?? const []).isEmpty)
              StateNotice(message: app.t('schedule.empty'))
            else
              for (final b in blocks!)
                Padding(
                  padding: const EdgeInsets.only(bottom: CL.s4),
                  child: FieldCard(
                    child: Row(
                      children: [
                        StatusPill(
                          tone: b.isBlocked ? Tone.neutral : Tone.signal,
                          label: app.t(b.isBlocked ? 'schedule.blocked' : 'schedule.available'),
                        ),
                        const SizedBox(width: CL.s4),
                        Expanded(
                          child: Text(
                            '${_d(b.startsAt)} – ${_d(b.endsAt)}',
                            style: const TextStyle(fontSize: CLUp.body, fontFamily: CL.monoFamily),
                          ),
                        ),
                        // 48px 타깃. 아이콘만 두면 누르기 어렵습니다.
                        SizedBox(
                          width: CL.minTapTarget,
                          height: CL.minTapTarget,
                          child: IconButton(
                            onPressed: _busy ? null : () => _remove(b),
                            icon: const Icon(Icons.close, color: CL.textMuted),
                            tooltip: app.t('common.cancel'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            const SizedBox(height: CL.s6),
            PrimaryButton(
              up: true,
              label: '${app.t('schedule.add')} · ${app.t('schedule.available')}',
              onPressed: _busy ? null : () => _pick('AVAILABLE'),
            ),
            const SizedBox(height: CL.s3),
            SecondaryButton(
              up: true,
              label: '${app.t('schedule.add')} · ${app.t('schedule.blocked')}',
              onPressed: _busy ? null : () => _pick('BLOCKED'),
            ),
          ],
        ),
      ),
    );
  }

  /// 현지 벽시계로 씁니다. UTC를 그대로 보여주면 근무일이 하루씩 밀립니다.
  String _d(DateTime t) {
    final l = t.toLocal();
    return '${l.month}/${l.day}';
  }
}

/// `08-20 목`. KST 기준입니다 — 화면은 전부 병원 벽시계를 씁니다.
String _dayLabel(DateTime utc) {
  const w = ['월', '화', '수', '목', '금', '토', '일'];
  final d = utc.toUtc().add(const Duration(hours: 9));
  final mm = d.month.toString().padLeft(2, '0');
  final dd = d.day.toString().padLeft(2, '0');
  return '$mm-$dd ${w[d.weekday - 1]}';
}
