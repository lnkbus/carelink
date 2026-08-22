import 'package:flutter/material.dart';
import '../../core/app_state.dart';
import '../../core/i18n/strings.dart';
import 'package:carelink_field_ui/carelink_field_ui.dart';
import '../../models/candidate_models.dart';
import '../login_screen.dart' show showLocaleSheet;

/// SCR-101 후보자 홈.
///
/// **홈의 성패는 "지금 뭘 해야 하는가"를 한 개만 보여주는 데 있습니다.**
/// 할 일을 나열하면 사용자는 아무것도 하지 않습니다 (SCR-101 notes).
///
/// 그래서 이 화면은 `nextAction` 하나만 큰 카드로 올립니다. 서버가 우선순위를
/// 이미 판정해서 하나만 보내주므로(`next-action.ts`), 화면에서 목록으로 펼칠
/// 방법이 없어야 합니다 — `_NextActionCard`는 단수만 받습니다.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.onNavigate});

  final void Function(String screen) onNavigate;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  Journey? _journey;
  Candidate? _me;
  List<Job> _recommended = const [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final app = AppScope.of(context);
    setState(() { _loading = true; _error = null; });
    try {
      final me = Candidate.fromJson(await app.api.get('/candidates/me') as Map<String, dynamic>);
      app.rememberCandidateId(me.id);
      final journey = Journey.fromJson(await app.api.get('/candidates/me/journey') as Map<String, dynamic>);
      final jobsRes = await app.api.get('/jobs', query: {'size': '3'}) as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        _me = me;
        _journey = journey;
        _recommended = (jobsRes['items'] as List<dynamic>? ?? [])
            .map((j) => Job.fromJson(j as Map<String, dynamic>))
            .toList();
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() { _error = '$e'; _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);

    return Scaffold(
      // 시안(SCR-101)의 앱바 — 26px 브랜드 타일 + 'CareLink' + 언어 칩.
      appBar: AppBar(
        toolbarHeight: 56,
        automaticallyImplyLeading: false,
        title: Row(
          children: [
            const BrandMark(size: 26, tileColor: CL.action, markColor: Colors.white, radius: 8),
            const SizedBox(width: CL.s3),
            Text(
              app.t('brand.name'),
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            ),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: CL.s5),
            child: LocaleChip(locale: app.locale, onTap: () => showLocaleSheet(context, app)),
          ),
        ],
      ),
      body: _loading
          ? Center(child: Text(app.t('common.loading'), style: const TextStyle(fontSize: CL.body)))
          : _error != null
              ? StateNotice(
                  message: _error!,
                  tone: Tone.alert,
                  action: SecondaryButton(label: app.t('common.retry'), onPressed: _load),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.all(CL.s6),
                    children: [
                      // 시안의 인사 블록 — 44px 아바타 + 이름 22px/700 +
                      // 표시코드·트랙 mono 14px. 자기 화면이라는 신호가
                      // 없으면 공용 안내판처럼 읽힙니다.
                      Row(
                        children: [
                          Container(
                            width: 44, height: 44,
                            decoration: const BoxDecoration(
                              color: CL.actionTint, shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.person, size: 24, color: CL.action),
                          ),
                          const SizedBox(width: CL.s4),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  app.t('home.greeting').replaceFirst(
                                        '{name}',
                                        _me?.name ?? _me?.displayCode ?? '',
                                      ),
                                  style: const TextStyle(
                                    fontSize: 22, fontWeight: FontWeight.w700, letterSpacing: -0.4,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  [
                                    _me?.displayCode,
                                    if ((_me?.tracks ?? const []).isNotEmpty) _me!.tracks.first.labelKo,
                                  ].whereType<String>().join(' · '),
                                  style: const TextStyle(
                                    fontFamily: CL.monoFamily, fontSize: CL.caption, color: CL.textMuted,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: CL.s6),

                      // 화면에서 가장 큰 요소. 하나뿐입니다.
                      _NextActionCard(
                        action: _journey?.nextAction,
                        locale: app.locale,
                        onTap: (screen) => widget.onNavigate(screen),
                      ),

                      // 시안의 '취업 준비 단계 3 / 5' 카드. 점만 있으면
                      // 몇 단계 중 몇 번째인지 세어 봐야 합니다.
                      if (_journey != null) ...[
                        const SizedBox(height: CL.s6),
                        FieldCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.baseline,
                                textBaseline: TextBaseline.alphabetic,
                                children: [
                                  Text(
                                    app.t('home.stage'),
                                    style: const TextStyle(fontSize: CL.subtitle, fontWeight: FontWeight.w700),
                                  ),
                                  const Spacer(),
                                  Text(
                                    '${_journey!.groups.where((g) => g.state == 'DONE').length} / ${_journey!.groups.length}',
                                    style: const TextStyle(
                                      fontFamily: CL.monoFamily, fontSize: 15,
                                      fontWeight: FontWeight.w700, color: CL.actionText,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: CL.s4),
                              _ProgressDots(journey: _journey!, locale: app.locale),
                            ],
                          ),
                        ),
                      ],

                      // 체류자격 만료는 서류 만료보다 무겁습니다 — 만료되면
                      // 자격 무효가 아니라 불법 취업이 됩니다 (§5.9).
                      if (_me?.visaExpiresInDays != null) ...[
                        const SizedBox(height: CL.s6),
                        ExpiryCountdown(
                          expiredLabel: app.t('expiry.expired'),
                          days: _me!.visaExpiresInDays,
                          locale: app.locale,
                          label: app.t('profile.visa'),
                          date: _me!.visaExpiresOn,
                        ),
                        if ((_me!.visaExpiresInDays ?? 999) <= 60) ...[
                          const SizedBox(height: CL.s3),
                          Text(
                            app.t('expiry.visaWarning'),
                            style: const TextStyle(fontSize: CL.caption, color: CL.alert, height: 1.5),
                          ),
                        ],
                      ],

                      const SizedBox(height: CL.s7),
                      Text(
                        app.t('home.recommended'),
                        style: const TextStyle(fontSize: CL.subtitle, fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: CL.s4),
                      if (_recommended.isEmpty)
                        StateNotice(message: app.t('common.empty'))
                      else
                        for (final job in _recommended) ...[
                          _JobCard(job: job, locale: app.locale, onTap: () => widget.onNavigate('SCR-107')),
                          const SizedBox(height: CL.s4),
                        ],
                    ],
                  ),
                ),
    );
  }
}

/// 진행 단계 점 표시 (S3 확정 — 커리어 여정 축).
class _ProgressDots extends StatelessWidget {
  const _ProgressDots({required this.journey, required this.locale});

  final Journey journey;
  final AppLocale locale;

  @override
  Widget build(BuildContext context) {
    final total = journey.progressTotal == 0 ? 1 : journey.progressTotal;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              tr('home.progress', locale),
              style: const TextStyle(fontSize: CL.caption, color: CL.textSub),
            ),
            const Spacer(),
            Text(
              '${journey.progressCurrent} / $total',
              style: const TextStyle(
                fontFamily: CL.monoFamily, fontSize: CL.caption, color: CL.textSub,
              ),
            ),
          ],
        ),
        const SizedBox(height: CL.s3),
        Row(
          children: [
            for (var i = 0; i < total; i++) ...[
              Expanded(
                child: Container(
                  height: 6,
                  decoration: BoxDecoration(
                    color: i < journey.progressCurrent ? CL.action : CL.bgSub,
                    borderRadius: BorderRadius.circular(CL.rPill),
                  ),
                ),
              ),
              if (i < total - 1) const SizedBox(width: CL.s1),
            ],
          ],
        ),
      ],
    );
  }
}

/// **단수만 받습니다.** List<NextAction>을 받는 생성자를 만들지 마세요 —
/// 만드는 순간 홈이 할 일 목록이 되고, 사용자는 아무것도 하지 않습니다.
class _NextActionCard extends StatelessWidget {
  const _NextActionCard({required this.action, required this.locale, required this.onTap});

  final NextAction? action;
  final AppLocale locale;
  final void Function(String screen) onTap;

  @override
  Widget build(BuildContext context) {
    final a = action;
    if (a == null) {
      return FieldCard(
        tone: Tone.signal,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              const Icon(Icons.check_circle_outline, color: CL.signal, size: 24),
              const SizedBox(width: CL.s3),
              Text(
                tr('home.allDone', locale),
                style: const TextStyle(fontSize: CL.subtitle, fontWeight: FontWeight.w700, color: CL.signal),
              ),
            ]),
            const SizedBox(height: CL.s3),
            Text(
              tr('home.allDone.sub', locale),
              style: const TextStyle(fontSize: CL.body, color: CL.textSub),
            ),
          ],
        ),
      );
    }

    return Material(
      color: CL.actionStrong,
      borderRadius: BorderRadius.circular(CL.rHero),
      child: InkWell(
        onTap: () => onTap(a.screen),
        borderRadius: BorderRadius.circular(CL.rHero),
        child: Padding(
          padding: const EdgeInsets.all(CL.s6),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                tr('home.nextAction', locale),
                style: const TextStyle(fontSize: CL.caption, color: Colors.white70),
              ),
              const SizedBox(height: CL.s3),
              Text(
                nextActionText(a.code, locale),
                style: const TextStyle(
                  fontSize: CL.title, fontWeight: FontWeight.w700, color: Colors.white, height: 1.4,
                ),
              ),
              const SizedBox(height: CL.s4),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      nextActionReason(a.reasonKey, locale),
                      style: const TextStyle(fontSize: CL.body, color: Colors.white70, height: 1.5),
                    ),
                  ),
                  const SizedBox(width: CL.s4),
                  const Icon(Icons.arrow_forward, color: Colors.white, size: 24),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _JobCard extends StatelessWidget {
  const _JobCard({required this.job, required this.locale, required this.onTap});

  final Job job;
  final AppLocale locale;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return FieldCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            job.title ?? job.organizationName,
            style: const TextStyle(fontSize: CL.subtitle, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: CL.s2),
          Text(
            '${job.organizationName} · ${job.region}',
            style: const TextStyle(fontSize: CL.body, color: CL.textSub),
          ),
          const SizedBox(height: CL.s4),
          Wrap(
            spacing: CL.s2,
            runSpacing: CL.s2,
            children: [
              StatusPill(tone: Tone.neutral, label: salaryText(job, locale)),
              if (job.dormProvided)
                StatusPill(tone: Tone.signal, label: tr('jobs.dorm', locale)),
              if (job.startDate != null)
                StatusPill(tone: Tone.neutral, label: '${tr('jobs.startDate', locale)} ${job.startDate}'),
            ],
          ),
        ],
      ),
    );
  }
}

/// 급여 표시. **값이 없는 것과 0원은 다릅니다.**
///
/// 서버는 공개 범위가 PUBLIC이 아니면 금액 키 자체를 보내지 않습니다.
/// 여기서 0으로 채우면 "월 0원"이 화면에 뜹니다.
String salaryText(Job job, AppLocale locale) {
  if (job.salaryMin == null && job.salaryMax == null) {
    return switch (job.salaryVisibility) {
      'AFTER_MATCH' => tr('jobs.salary.afterMatch', locale),
      _ => tr('jobs.salary.negotiable', locale),
    };
  }
  final min = job.salaryMin ?? job.salaryMax!;
  final max = job.salaryMax ?? job.salaryMin!;
  return '${_man(min)}~${_man(max)}';
}

String _man(int won) => '${(won / 10000).round()}만';

/// next_action 코드 → 행동 문장. 백엔드는 코드만 줍니다 (§5.15).
String nextActionText(String code, AppLocale locale) => switch (code) {
      'action.track.select' => switch (locale) {
          AppLocale.ko => '커리어 트랙을 선택하세요',
          AppLocale.vi => 'Hãy chọn ngành nghề',
          AppLocale.ru => 'Выберите направление',
          AppLocale.en => 'Choose your career track',
        },
      'action.document.upload' => switch (locale) {
          AppLocale.ko => '서류를 올려 주세요',
          AppLocale.vi => 'Hãy tải giấy tờ lên',
          AppLocale.ru => 'Загрузите документы',
          AppLocale.en => 'Upload your documents',
        },
      'action.document.resubmit' => switch (locale) {
          AppLocale.ko => '반려된 서류를 다시 올려 주세요',
          AppLocale.vi => 'Hãy nộp lại giấy tờ bị từ chối',
          AppLocale.ru => 'Загрузите отклонённый документ заново',
          AppLocale.en => 'Re-upload the rejected document',
        },
      'action.document.renew' => switch (locale) {
          AppLocale.ko => '만료된 서류를 갱신하세요',
          AppLocale.vi => 'Hãy gia hạn giấy tờ đã hết hạn',
          AppLocale.ru => 'Обновите просроченный документ',
          AppLocale.en => 'Renew the expired document',
        },
      'action.training.enroll' => switch (locale) {
          AppLocale.ko => '필수 교육을 신청하세요',
          AppLocale.vi => 'Hãy đăng ký khóa đào tạo bắt buộc',
          AppLocale.ru => 'Запишитесь на обязательное обучение',
          AppLocale.en => 'Enroll in the required training',
        },
      'action.training.continue' => switch (locale) {
          AppLocale.ko => '교육을 이어서 들으세요',
          AppLocale.vi => 'Hãy tiếp tục khóa học',
          AppLocale.ru => 'Продолжите обучение',
          AppLocale.en => 'Continue your training',
        },
      'action.visa.renew' => switch (locale) {
          AppLocale.ko => '체류기간을 연장하세요',
          AppLocale.vi => 'Hãy gia hạn thời gian lưu trú',
          AppLocale.ru => 'Продлите срок пребывания',
          AppLocale.en => 'Extend your residence period',
        },
      'action.visa.expired' => switch (locale) {
          AppLocale.ko => '체류기간이 만료되었습니다',
          AppLocale.vi => 'Thời gian lưu trú đã hết hạn',
          AppLocale.ru => 'Срок пребывания истёк',
          AppLocale.en => 'Your residence period has expired',
        },
      'action.visaProcess.advance' => switch (locale) {
          AppLocale.ko => '체류자격 절차를 확인하세요',
          AppLocale.vi => 'Hãy kiểm tra thủ tục tư cách lưu trú',
          AppLocale.ru => 'Проверьте оформление статуса',
          AppLocale.en => 'Check your residence process',
        },
      'action.profile.complete' => switch (locale) {
          AppLocale.ko => '프로필을 완성하세요',
          AppLocale.vi => 'Hãy hoàn thiện hồ sơ',
          AppLocale.ru => 'Заполните профиль',
          AppLocale.en => 'Complete your profile',
        },
      _ => code,
    };

/// 왜 이 행동이 필요한지. 이유 없는 지시는 따르지 않습니다.
String nextActionReason(String key, AppLocale locale) => switch (key) {
      'reason.track.notSelected' => switch (locale) {
          AppLocale.ko => '트랙을 정해야 필요한 서류와 교육이 정해집니다',
          AppLocale.vi => 'Chọn ngành thì mới biết cần giấy tờ và khóa học nào',
          AppLocale.ru => 'От направления зависят нужные документы и обучение',
          AppLocale.en => 'Your track decides which documents and training you need',
        },
      _ => '',
    };
