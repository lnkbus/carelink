import 'package:carelink_field_ui/carelink_field_ui.dart';
import 'package:flutter/material.dart';
import '../../core/app_state.dart';
import '../../core/i18n/strings.dart';
import '../../models/guardian_models.dart';
import 'common.dart';
import 'confirm_screen.dart';
import 'history_screen.dart';
import 'hospital_screen.dart';
import 'live_screen.dart';
import 'match_screen.dart';

/// SCR-301 보호자 홈.
///
/// 진행 중인 건이 하나라도 있으면 그것이 화면의 전부입니다. 보호자가 가장
/// 많이 하는 행동은 "잘 있나 확인"이고 (SCR-306 notes), 신규 신청은 그 다음입니다.
///
/// 하단 고정 버튼을 쓰지 않았습니다. 보호자 홈은 대개 카드 한두 장이라
/// 스크롤이 없고, 그럴 때 하단 고정은 화면 아래에 붕 뜬 버튼으로 보입니다.
class GuardianHomeScreen extends StatefulWidget {
  const GuardianHomeScreen({super.key});

  @override
  State<GuardianHomeScreen> createState() => _GuardianHomeScreenState();
}

class _GuardianHomeScreenState extends State<GuardianHomeScreen> {
  List<CareRequest>? _requests;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => load());
  }

  Future<void> load() async {
    final app = AppScope.of(context);
    setState(() => _error = null);
    try {
      final res = await app.api.get('/care-requests/me/list') as List<dynamic>;
      if (!mounted) return;
      setState(() => _requests = res
          .map((e) => CareRequest.fromJson(e as Map<String, dynamic>))
          .toList());
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = errorKey(e.code));
    } catch (_) {
      if (mounted) setState(() => _error = 'error.network');
    }
  }

  /// 상태에 따라 갈 곳이 다릅니다.
  ///
  /// 배정이 끝난 건을 매칭 화면으로 보내면 안 됩니다 — 이미 정해진 것을
  /// 다시 고르는 화면이 열리면 보호자는 무언가 잘못됐다고 생각합니다.
  void _open(CareRequest r) {
    final page = const ['MATCHING', 'OFFER_SENT'].contains(r.status)
        ? MatchScreen(requestId: r.id)
        : ConfirmScreen(requestId: r.id);
    Navigator.of(context)
        .push(MaterialPageRoute<void>(builder: (_) => page))
        .then((_) => load());
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final all = _requests;
    final live = all?.where((r) => r.isLive).toList() ?? const <CareRequest>[];
    final past = all?.where((r) => !r.isLive).toList() ?? const <CareRequest>[];

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: load,
          child: ListView(
            padding: const EdgeInsets.all(CL.s6),
            children: [
              Ask(text: app.t('guardian.home.ask'), sub: app.t('guardian.home.askSub')),

              PrimaryButton(
                label: app.t('guardian.home.newRequest'),
                hero: true,
                up: true,
                onPressed: () => Navigator.of(context)
                    .push(MaterialPageRoute<void>(builder: (_) => const HospitalScreen()))
                    .then((_) => load()),
              ),
              const SizedBox(height: CL.s6),

              if (_error != null) StateNotice(message: app.t(_error!), tone: Tone.alert),
              if (all == null && _error == null) StateNotice(message: app.t('common.loading')),
              if (all != null && live.isEmpty && past.isEmpty)
                StateNotice(message: app.t('guardian.home.none')),

              for (final r in live) ...[
                FieldCard(
                  tone: Tone.action,
                  onTap: () => _open(r),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              r.hospitalName ?? app.t('guardian.hospitalMissing'),
                              style: const TextStyle(
                                fontSize: CLUp.subtitle, fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          StatusPill(tone: _tone(r.status), label: codeLabel(r.status, app.locale)),
                        ],
                      ),
                      const SizedBox(height: CL.s3),
                      InfoRow(label: app.t('guardian.form.ward'), value: r.ward),
                      InfoRow(label: app.t('guardian.form.start'), value: fmtKst(r.startAt)),
                      InfoRow(
                        label: app.t('guardian.form.shift'),
                        value: codeLabel(r.shiftPatternCode, app.locale),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: CL.s4),
              ],

              if (past.isNotEmpty)
                FieldCard(
                  onTap: () => Navigator.of(context)
                      .push(MaterialPageRoute<void>(builder: (_) => const HistoryScreen())),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          app.t('guardian.home.history'),
                          style: const TextStyle(
                            fontSize: CLUp.subtitle, fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                      Text(
                        '${past.length}${app.t('home.count')}',
                        style: const TextStyle(fontSize: CLUp.caption, color: CL.textMuted),
                      ),
                      const Icon(Icons.chevron_right, color: CL.textMuted),
                    ],
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 진행 중인 건에도 단계가 있습니다. 색 하나로 뭉치면 '접수됨'과
/// '문제 발생'이 같아 보입니다.
Tone _tone(String status) => switch (status) {
      'IN_SERVICE' || 'ASSIGNED' => Tone.signal,
      'ISSUE' => Tone.alert,
      'OPS_REVIEW' => Tone.flag,
      _ => Tone.action,
    };

/// 진행 중 배정으로 바로 들어가는 경로. 홈 카드에서 상태가 `IN_SERVICE`면
/// 보호자가 원하는 것은 신청 내역이 아니라 **오늘 기록**입니다.
Route<void> liveRoute(String assignmentId) =>
    MaterialPageRoute<void>(builder: (_) => LiveScreen(assignmentId: assignmentId));
