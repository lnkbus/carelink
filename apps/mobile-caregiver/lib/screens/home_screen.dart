import 'package:carelink_field_ui/carelink_field_ui.dart';
import 'package:flutter/material.dart';
import '../core/app_state.dart';
import '../core/i18n/strings.dart';
import '../models/models.dart';
import 'login_screen.dart' show showLocaleSheet;
import 'schedule_screen.dart';
import 'shift_screen.dart';

/// SCR-401 간병사 대시보드.
///
/// **오늘 할 일 하나와 큰 버튼 하나.** 나머지는 전부 하위 화면입니다
/// (SCR-401 notes). 간병사는 앱 숙련도가 낮은 연령대가 많고, 이 화면을
/// 보는 순간은 대개 출근길이나 병실 앞입니다. 목록·탭·필터를 얹으면
/// 그 사람은 앱을 안 씁니다.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<Assignment>? _assignments;
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
      final res = await app.api.get('/caregivers/me/assignments') as List<dynamic>;
      if (!mounted) return;
      setState(() => _assignments =
          res.map((e) => Assignment.fromJson(e as Map<String, dynamic>)).toList());
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = errorKey(e.code));
    } catch (_) {
      // 네트워크 실패를 잡지 않으면 예외가 위젯 트리를 타고 올라가 화면이
      // 백지가 됩니다. 사용자는 앱이 고장 났다고 생각하고 다시 열지 않습니다.
      if (mounted) setState(() => _error = 'error.network');
    }
  }

  Future<void> _respond(Assignment a, String status) async {
    final app = AppScope.of(context);
    setState(() { _busy = true; _error = null; });
    try {
      await app.api.patch('/care-assignments/${a.id}/status', {'status': status});
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
    final list = _assignments;

    return Scaffold(
      appBar: AppBar(
        title: Text(app.t('home.title'), style: const TextStyle(fontSize: CL.subtitle)),
        backgroundColor: CL.bg,
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: CL.s4),
            child: LocaleChip(locale: app.locale, onTap: () => showLocaleSheet(context, app)),
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
            padding: const EdgeInsets.all(CL.s6),
            children: [
              if (_error != null) ...[
                StateNotice(tone: Tone.alert, message: app.t(_error!)),
                const SizedBox(height: CL.s5),
              ],
              if (list == null && _error == null)
                StateNotice(message: app.t('common.loading'))
              else ...[
                ..._offers(app, list ?? const []),
                ..._today(app, list ?? const []),
                const SizedBox(height: CL.s6),
                SecondaryButton(
                  label: app.t('home.schedule'),
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(builder: (_) => const ScheduleScreen()),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  /// 제안. 수락해도 **확정이 아닙니다** — 담당자 확인이 3단계의 마지막입니다
  /// (§6-4). 그 사실을 수락 직후 화면에 씁니다. 확정된 줄 알고 안 나오면
  /// 병실에 사람이 없습니다.
  List<Widget> _offers(AppState app, List<Assignment> list) {
    final offers = list.where((a) => a.isOffer).toList();
    final waiting = list.where((a) => a.isWaitingConfirm).toList();
    return [
      for (final a in offers)
        Padding(
          padding: const EdgeInsets.only(bottom: CL.s5),
          child: FieldCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(app.t('home.offerPending'),
                    style: const TextStyle(fontSize: CL.subtitle, fontWeight: FontWeight.w700)),
                const SizedBox(height: CL.s4),
                _ShiftLine(assignment: a),
                const SizedBox(height: CL.s5),
                PrimaryButton(
                  label: app.t('home.accept'),
                  onPressed: _busy ? null : () => _respond(a, 'ACCEPTED'),
                ),
                const SizedBox(height: CL.s3),
                SecondaryButton(
                  label: app.t('home.decline'),
                  onPressed: _busy ? null : () => _respond(a, 'DECLINED'),
                ),
              ],
            ),
          ),
        ),
      for (final a in waiting)
        Padding(
          padding: const EdgeInsets.only(bottom: CL.s5),
          child: FieldCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                StatusPill(tone: Tone.flag, label: app.t('home.waitingConfirm')),
                const SizedBox(height: CL.s4),
                _ShiftLine(assignment: a),
              ],
            ),
          ),
        ),
    ];
  }

  /// 오늘 근무. **하나만** 큰 버튼으로 보여줍니다.
  List<Widget> _today(AppState app, List<Assignment> list) {
    final today = list.where((a) => a.isToday).toList();
    if (today.isEmpty) {
      return [StateNotice(message: app.t('home.noShift'))];
    }
    final a = today.first;
    return [
      FieldCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _ShiftLine(assignment: a),
            const SizedBox(height: CL.s6),
            PrimaryButton(
              hero: true,
              label: app.t(a.status == 'IN_SERVICE' ? 'shift.end' : 'shift.start'),
              onPressed: () => Navigator.of(context)
                  .push(MaterialPageRoute<void>(builder: (_) => ShiftScreen(assignmentId: a.id)))
                  .then((_) => _load()),
            ),
          ],
        ),
      ),
      // 오늘 근무가 둘 이상이어도 카드를 늘리지 않습니다. 남은 건은
      // 일정 화면에서 봅니다 — 홈은 '지금 할 일' 한 가지만 말합니다.
      if (today.length > 1)
        Padding(
          padding: const EdgeInsets.only(top: CL.s4),
          child: Text(
            '+${today.length - 1}',
            style: const TextStyle(fontSize: CL.caption, color: CL.textMuted),
          ),
        ),
    ];
  }
}

class _ShiftLine extends StatelessWidget {
  const _ShiftLine({required this.assignment});
  final Assignment assignment;

  @override
  Widget build(BuildContext context) {
    final t = assignment.shiftStartTime;
    return Row(
      children: [
        const Icon(Icons.schedule, size: 20, color: CL.textMuted),
        const SizedBox(width: CL.s3),
        Text(
          t == null ? '—' : '$t${assignment.shiftEndTime == null ? '' : ' – ${assignment.shiftEndTime}'}',
          style: const TextStyle(fontSize: CL.body, fontFamily: CL.monoFamily),
        ),
      ],
    );
  }
}
