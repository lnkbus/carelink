import 'package:carelink_field_ui/carelink_field_ui.dart';
import 'package:flutter/material.dart';
import '../../core/app_state.dart';
import '../../core/i18n/strings.dart';
import '../../models/caregiver_models.dart';
import '../login_screen.dart' show showLocaleSheet;
import 'shift_screen.dart';

/// SCR-401 오늘 — 간병사 앱의 기본 진입.
///
/// **시안(design/CareLink 진입 + Caregiver App (FIELD))을 그대로 따릅니다.**
/// 앱바에 '오늘'과 날짜, 그 아래 파란 히어로 카드 하나, 출근 체크 76px,
/// '오늘 확인할 것', 주간 요약, 오프라인 안내. 하단 탭은 셸이 그립니다.
///
/// 화면에서 가장 큰 것이 오늘 근무 카드여야 합니다. 이 화면을 보는 순간은
/// 대개 출근길이나 병실 앞이고, 목록·탭·필터를 얹으면 그 사람은 앱을
/// 안 씁니다 (SCR-401 notes).
///
/// ── 시안과 일부러 다른 곳 ───────────────────────────────────────────────
/// 시안의 카드에는 `김영수 어르신`, `82세 · 남성`, `식사 후 투약 13:00`,
/// `당뇨`가 적혀 있습니다. **넷 다 넣지 않았습니다.**
///   · 환자 실명·나이·성별·진단명은 간병사에게 나가지 않습니다
///     (CLAUDE.md §5.2 · docs/11 §3.2). 모델에도 필드가 없습니다.
///   · '투약'은 의료행위라 카탈로그에 항목 자체가 없습니다 (§6-2).
/// 그 자리에 병실과 필요한 지원·주의사항이 들어갑니다 — 간병사가 알아야
/// 하는 것은 **어디서 무엇을 하는가**이지 환자가 누구인가가 아닙니다.
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
        automaticallyImplyLeading: false,
        backgroundColor: CL.bg,
        toolbarHeight: 64,
        title: Text(
          app.t('tab.today'),
          style: const TextStyle(fontSize: CLUp.title, fontWeight: FontWeight.w700),
        ),
        actions: [
          // 날짜는 mono입니다. 시각·날짜·ID는 이 시스템의 시각적 서명이고,
          // 본문 폰트로 대체하지 않습니다 (design/README §타이포).
          Padding(
            padding: const EdgeInsets.only(right: CL.s3),
            child: Center(
              child: Text(
                _todayLabel(app.locale),
                style: const TextStyle(
                  fontFamily: CL.monoFamily, fontSize: CLUp.subtitle,
                  fontWeight: FontWeight.w700, color: CL.textSub,
                ),
              ),
            ),
          ),
          LocaleChip(locale: app.locale, onTap: () => showLocaleSheet(context, app)),
          const SizedBox(width: CL.s3),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _load,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(CL.s6, CL.s2, CL.s6, CL.s6),
            children: [
              if (_error != null) ...[
                StateNotice(tone: Tone.alert, message: app.t(_error!)),
                const SizedBox(height: CL.s5),
              ],
              if (list == null && _error == null)
                StateNotice(message: app.t('common.loading'))
              else ...[
                ..._offers(app, list ?? const []),
                _todayCard(app, list ?? const []),
                const SizedBox(height: CL.s6),
                _weekSummary(app, list ?? const []),
                const SizedBox(height: CL.s6),
                _offlineNote(app),
              ],
            ],
          ),
        ),
      ),
    );
  }

  /// 오늘 근무 — 시안의 파란 히어로 카드.
  ///
  /// 카드 하나에 '어디서 · 언제 · 무엇을 누를 것인가'가 전부 들어갑니다.
  /// 스크롤하지 않고도 출근 체크를 누를 수 있어야 합니다.
  Widget _todayCard(AppState app, List<Assignment> list) {
    final today = list.where((a) => a.isToday).toList();
    if (today.isEmpty) return StateNotice(message: app.t('home.noShift'));

    final a = today.first;
    final running = a.status == 'IN_SERVICE';

    return Container(
      decoration: BoxDecoration(
        color: CL.actionStrong,
        borderRadius: BorderRadius.circular(CL.rHero),
      ),
      padding: const EdgeInsets.all(CL.s6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Text(
                app.t('home.todayShift'),
                style: const TextStyle(fontSize: CLUp.caption, fontWeight: FontWeight.w600, color: Color(0xFFE4EDFF)),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: CL.s4, vertical: CL.s2),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.22),
                  borderRadius: BorderRadius.circular(CL.rPill),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 9, height: 9,
                      decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
                    ),
                    const SizedBox(width: CL.s2),
                    Text(
                      app.t(running ? 'home.inService' : 'home.beforeStart'),
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Colors.white),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: CL.s5),
          Row(
            children: [
              Container(
                width: 64, height: 64,
                decoration: BoxDecoration(
                  color: CL.bg,
                  borderRadius: BorderRadius.circular(CL.rHero),
                ),
                child: const Icon(Icons.local_hospital, size: 34, color: CL.actionStrong),
              ),
              const SizedBox(width: CL.s5),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // 시안의 자리에는 환자 실명이 있었습니다. 병실로 대체합니다 —
                    // 간병사가 찾아가야 하는 것은 사람 이름이 아니라 방입니다.
                    Text(
                      a.ward ?? app.t('shift.wardUnknown'),
                      style: const TextStyle(
                        fontSize: CLUp.title, fontWeight: FontWeight.w700,
                        color: Colors.white, letterSpacing: -0.5,
                      ),
                    ),
                    const SizedBox(height: CL.s2),
                    Text(
                      a.hospitalName ?? '—',
                      style: const TextStyle(
                        fontFamily: CL.monoFamily, fontSize: CLUp.subtitle, color: Color(0xFFE4EDFF),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: CL.s5),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: CL.s5, vertical: CL.s4),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.16),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                const Icon(Icons.schedule, size: CLUp.icon, color: Colors.white),
                const SizedBox(width: CL.s4),
                Text(
                  _timeRange(a),
                  style: const TextStyle(
                    fontFamily: CL.monoFamily, fontSize: 22,
                    fontWeight: FontWeight.w700, color: Colors.white,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: CL.s5),
          // 출근 체크 76px. 화면에서 가장 큰 동작이고, 흰 배경에 파란 글씨라
          // 파란 카드 위에서 가장 먼저 눈에 들어옵니다 (시안 규격).
          SizedBox(
            height: CLUp.heroButtonHeight,
            child: FilledButton(
              onPressed: () => Navigator.of(context)
                  .push(MaterialPageRoute<void>(builder: (_) => ShiftScreen(assignmentId: a.id)))
                  .then((_) => _load()),
              style: FilledButton.styleFrom(
                backgroundColor: CL.bg,
                foregroundColor: CL.actionText,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(CL.rCard)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(running ? Icons.logout : Icons.check_circle, size: 30, color: CL.actionText),
                  const SizedBox(width: CL.s3),
                  Flexible(
                    child: Text(
                      app.t(running ? 'shift.end' : 'shift.start'),
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (today.length > 1) ...[
            const SizedBox(height: CL.s4),
            Text(
              '+${today.length - 1}',
              style: const TextStyle(fontSize: CLUp.caption, color: Color(0xFFE4EDFF)),
            ),
          ],
        ],
      ),
    );
  }

  /// 이번 주 요약 — 시안의 목록 아이콘 행.
  Widget _weekSummary(AppState app, List<Assignment> list) {
    final upcoming = list.where((a) => a.isToday || a.isWaitingConfirm).toList();
    final next = upcoming.where((a) => a.startAt != null).toList()
      ..sort((x, y) => x.startAt!.compareTo(y.startAt!));

    return FieldCard(
      child: Row(
        children: [
          Container(
            width: 48, height: 48,
            decoration: BoxDecoration(color: CL.bgSub, borderRadius: BorderRadius.circular(CL.rCard)),
            child: const Icon(Icons.list, size: CLUp.icon, color: CL.textSub),
          ),
          const SizedBox(width: CL.s4),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${app.t('home.weekSummary')} ${upcoming.length}${app.t('home.count')}',
                  style: const TextStyle(fontSize: CLUp.body, fontWeight: FontWeight.w700),
                ),
                if (next.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Text(
                        '${app.t('home.nextShift')} ',
                        style: const TextStyle(fontSize: CLUp.caption, color: CL.textMuted),
                      ),
                      Text(
                        _dateLabel(next.first.startAt!),
                        style: const TextStyle(
                          fontFamily: CL.monoFamily, fontSize: CLUp.caption,
                          fontWeight: FontWeight.w700, color: CL.textMuted,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// 오프라인 안내 — 시안에 있는 배너.
  ///
  /// 병실은 신호가 약합니다. 기록이 날아갈까 봐 안 쓰는 것이 가장 흔한
  /// 이탈 이유라, 쓰기 전에 말합니다.
  Widget _offlineNote(AppState app) => Row(
        children: [
          const Icon(Icons.cloud_off, size: 20, color: CL.textMuted),
          const SizedBox(width: CL.s3),
          Expanded(
            child: Text(
              app.t('home.offline'),
              style: const TextStyle(fontSize: CLUp.caption, color: CL.textMuted, height: 1.5),
            ),
          ),
        ],
      );

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
                    style: const TextStyle(fontSize: CLUp.subtitle, fontWeight: FontWeight.w700)),
                const SizedBox(height: CL.s4),
                _ShiftLine(assignment: a),
                const SizedBox(height: CL.s5),
                PrimaryButton(
                  up: true,
                  label: app.t('home.accept'),
                  onPressed: _busy ? null : () => _respond(a, 'ACCEPTED'),
                ),
                const SizedBox(height: CL.s3),
                SecondaryButton(
                  up: true,
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
}

String _timeRange(Assignment a) {
  final s = a.shiftStartTime, e = a.shiftEndTime;
  if (s == null) return '—';
  return e == null ? s : '$s ~ $e';
}

/// `8월 20일 목`. KST 기준입니다 — 화면은 전부 병원 벽시계를 씁니다.
String _todayLabel(AppLocale locale) {
  final now = DateTime.now().toUtc().add(const Duration(hours: 9));
  return locale == AppLocale.ko
      ? '${now.month}월 ${now.day}일 ${_weekdayKo(now.weekday)}'
      : '${now.month}/${now.day}';
}

String _dateLabel(DateTime utc) {
  final d = utc.toUtc().add(const Duration(hours: 9));
  return '${d.month}/${d.day}';
}

const _weekdaysKo = ['월', '화', '수', '목', '금', '토', '일'];
String _weekdayKo(int w) => _weekdaysKo[w - 1];

class _ShiftLine extends StatelessWidget {
  const _ShiftLine({required this.assignment});
  final Assignment assignment;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const Icon(Icons.schedule, size: 22, color: CL.textMuted),
        const SizedBox(width: CL.s3),
        Text(
          _timeRange(assignment),
          style: const TextStyle(fontSize: CLUp.body, fontFamily: CL.monoFamily),
        ),
        if (assignment.ward != null) ...[
          const SizedBox(width: CL.s4),
          Text(
            assignment.ward!,
            style: const TextStyle(fontSize: CLUp.body, color: CL.textSub),
          ),
        ],
      ],
    );
  }
}
