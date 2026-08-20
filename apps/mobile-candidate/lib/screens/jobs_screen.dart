import 'package:flutter/material.dart';
import '../core/api/api_client.dart';
import '../core/app_state.dart';
import '../core/i18n/strings.dart';
import '../core/theme/tokens.dart';
import '../models/models.dart';
import '../widgets/field_widgets.dart';
import 'home_screen.dart' show salaryText;

/// SCR-107 일자리 목록 · SCR-108 상세.
///
/// 급여는 기관이 입력하더라도 후보자 노출 범위를 별도로 통제합니다
/// (SCR-107 notes). 서버가 공개 범위에 따라 금액 키 자체를 빼고 보내므로
/// 화면은 '없는 값'을 그대로 안내로 바꿉니다 — 0으로 채우면 "월 0원"이 뜹니다.
class JobsScreen extends StatefulWidget {
  const JobsScreen({super.key});

  @override
  State<JobsScreen> createState() => _JobsScreenState();
}

class _JobsScreenState extends State<JobsScreen> {
  List<Job> _jobs = const [];
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
      final res = await app.api.get('/jobs', query: {'size': '20'}) as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        _jobs = (res['items'] as List<dynamic>? ?? [])
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
      appBar: AppBar(title: Text(app.t('jobs.title'))),
      body: _loading
          ? Center(child: Text(app.t('common.loading'), style: const TextStyle(fontSize: CL.body)))
          : _error != null
              ? StateNotice(
                  message: _error!,
                  tone: Tone.alert,
                  action: SecondaryButton(label: app.t('common.retry'), onPressed: _load),
                )
              : _jobs.isEmpty
                  ? StateNotice(message: app.t('common.empty'))
                  : ListView.separated(
                      padding: const EdgeInsets.all(CL.s6),
                      itemCount: _jobs.length,
                      separatorBuilder: (_, __) => const SizedBox(height: CL.s4),
                      itemBuilder: (context, i) {
                        final job = _jobs[i];
                        return FieldCard(
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute<void>(
                              builder: (_) => JobDetailScreen(job: job),
                            ),
                          ),
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
                                  StatusPill(tone: Tone.neutral, label: salaryText(job, app.locale)),
                                  if (job.dormProvided)
                                    StatusPill(tone: Tone.signal, label: app.t('jobs.dorm')),
                                ],
                              ),
                            ],
                          ),
                        );
                      },
                    ),
    );
  }
}

/// SCR-108 일자리 상세.
///
/// **점수 단독 노출은 금지입니다** (§5.6). 이 화면은 매칭 API를 부르지 않고
/// 일자리 정보만 보여줍니다 — 후보자 시점의 점수·근거는 지원 이후 매칭
/// 결과에서 나오고, 여기서 점수만 띄우면 근거 없는 숫자가 됩니다.
class JobDetailScreen extends StatefulWidget {
  const JobDetailScreen({super.key, required this.job});

  final Job job;

  @override
  State<JobDetailScreen> createState() => _JobDetailScreenState();
}

class _JobDetailScreenState extends State<JobDetailScreen> {
  bool _applying = false;
  String? _result;

  Future<void> _apply(AppState app) async {
    setState(() { _applying = true; _result = null; });
    try {
      await app.api.post('/jobs/${widget.job.id}/apply');
      if (!mounted) return;
      setState(() => _result = 'APPLIED');
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _result = e.code);
    } finally {
      if (mounted) setState(() => _applying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final job = widget.job;
    final applied = _result == 'APPLIED' || _result == 'MATCHING_ALREADY_APPLIED';

    return Scaffold(
      appBar: AppBar(title: Text(job.title ?? app.t('jobs.title'))),
      body: ListView(
        padding: const EdgeInsets.all(CL.s6),
        children: [
          Text(
            job.title ?? job.organizationName,
            style: const TextStyle(fontSize: CL.title, fontWeight: FontWeight.w700, height: 1.4),
          ),
          const SizedBox(height: CL.s3),
          Text(job.organizationName, style: const TextStyle(fontSize: CL.body, color: CL.textSub)),

          const SizedBox(height: CL.s7),
          _Row(label: app.t('jobs.salary'), value: salaryText(job, app.locale)),
          _Row(label: app.t('profile.region'), value: job.region),
          _Row(label: app.t('jobs.startDate'), value: job.startDate ?? '—', mono: true),
          _Row(
            label: app.t('jobs.dorm'),
            value: job.dormProvided ? '✓' : '—',
          ),

          if (_result != null && !applied) ...[
            const SizedBox(height: CL.s6),
            Container(
              padding: const EdgeInsets.all(CL.s5),
              decoration: BoxDecoration(
                color: CL.alertTint,
                border: Border.all(color: CL.alertLine),
                borderRadius: BorderRadius.circular(CL.rCard),
              ),
              child: Text(
                applyErrorText(_result!, app.locale),
                style: const TextStyle(fontSize: CL.body, color: CL.alert, height: 1.5),
              ),
            ),
          ],

          const SizedBox(height: CL.s7),
          PrimaryButton(
            label: applied ? app.t('jobs.applied') : app.t('jobs.apply'),
            onPressed: _applying || applied ? null : () => _apply(app),
          ),
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const _Row({required this.label, required this.value, this.mono = false});

  final String label;
  final String value;
  final bool mono;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minHeight: CL.minTapTarget),
      padding: const EdgeInsets.symmetric(vertical: CL.s3),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: CL.line)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 120,
            child: Text(label, style: const TextStyle(fontSize: CL.body, color: CL.textMuted)),
          ),
          const SizedBox(width: CL.s4),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                fontSize: CL.body,
                fontFamily: mono ? CL.monoFamily : null,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// 지원 실패 사유. 차단은 항상 사유와 함께 보여줍니다.
String applyErrorText(String code, AppLocale locale) => switch (code) {
      'MATCHING_JOB_NOT_OPEN' => switch (locale) {
          AppLocale.ko => '지금은 지원할 수 없는 일자리입니다',
          AppLocale.vi => 'Hiện không thể ứng tuyển vị trí này',
          AppLocale.ru => 'Сейчас на эту вакансию откликнуться нельзя',
          AppLocale.en => 'This job is not open for applications',
        },
      'MATCHING_NOT_ELIGIBLE' => switch (locale) {
          AppLocale.ko => '아직 요건을 충족하지 않았습니다. 여정 화면에서 확인하세요.',
          AppLocale.vi => 'Bạn chưa đủ điều kiện. Hãy xem ở màn hình hành trình.',
          AppLocale.ru => 'Условия ещё не выполнены. Проверьте на экране пути.',
          AppLocale.en => 'You do not meet the requirements yet. Check your journey.',
        },
      'QUALITY_CLEARANCE_INCOMPLETE' => switch (locale) {
          AppLocale.ko => '검증이 아직 끝나지 않았습니다',
          AppLocale.vi => 'Việc xác minh chưa hoàn tất',
          AppLocale.ru => 'Проверка ещё не завершена',
          AppLocale.en => 'Your verification is not complete yet',
        },
      _ => code,
    };
