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
  const ScheduleScreen({super.key});

  @override
  State<ScheduleScreen> createState() => _ScheduleScreenState();
}

class _ScheduleScreenState extends State<ScheduleScreen> {
  List<AvailabilityBlock>? _blocks;
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
      if (!mounted) return;
      setState(() => _blocks =
          res.map((e) => AvailabilityBlock.fromJson(e as Map<String, dynamic>)).toList());
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = errorKey(e.code));
    } catch (_) {
      if (mounted) setState(() => _error = 'error.network');
    }
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
        title: Text(app.t('schedule.title'), style: const TextStyle(fontSize: CL.subtitle)),
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
                            style: const TextStyle(fontSize: CL.body, fontFamily: CL.monoFamily),
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
              label: '${app.t('schedule.add')} · ${app.t('schedule.available')}',
              onPressed: _busy ? null : () => _pick('AVAILABLE'),
            ),
            const SizedBox(height: CL.s3),
            SecondaryButton(
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
