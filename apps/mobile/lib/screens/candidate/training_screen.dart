import 'package:flutter/material.dart';
import '../../core/app_state.dart';
import '../../core/i18n/strings.dart';
import 'package:carelink_field_ui/carelink_field_ui.dart';
/// SCR-106 교육.
///
/// 수강 중 과정을 히어로로 올리고 필수 과정을 그 아래 둡니다
/// (design/README §Candidate App 106).
///
/// 필수 교육 수료는 배치 전 클리어런스 6종 중 하나(`MANDATORY_TRAINING`)와
/// 연결됩니다. 여기서 진도만 보여주고 통과 판정은 하지 않습니다 —
/// 판정은 사람이 하고 시스템은 기록만 합니다 (§6-1).
class TrainingScreen extends StatefulWidget {
  const TrainingScreen({super.key});

  @override
  State<TrainingScreen> createState() => _TrainingScreenState();
}

class _TrainingScreenState extends State<TrainingScreen> {
  List<Map<String, dynamic>> _programs = const [];
  List<Map<String, dynamic>> _enrollments = const [];
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
      final programs = (await app.api.get('/training-programs') as List<dynamic>).cast<Map<String, dynamic>>();
      final enrollments = (await app.api.get('/candidates/me/enrollments') as List<dynamic>).cast<Map<String, dynamic>>();
      if (!mounted) return;
      setState(() {
        _programs = programs;
        _enrollments = enrollments;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() { _error = '$e'; _loading = false; });
    }
  }

  Future<void> _enroll(String programId) async {
    final app = AppScope.of(context);
    await app.api.post('/candidates/me/enrollments', {'programId': programId});
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final byProgram = {
      for (final e in _enrollments) e['programId'] as String: e,
    };
    final inProgress = _enrollments
        .where((e) => e['status'] == 'IN_PROGRESS')
        .toList();

    return Scaffold(
      appBar: AppBar(title: Text(app.t('training.title'))),
      body: _loading
          ? Center(child: Text(app.t('common.loading'), style: const TextStyle(fontSize: CL.body)))
          : _error != null
              ? StateNotice(
                  message: _error!,
                  tone: Tone.alert,
                  action: SecondaryButton(label: app.t('common.retry'), onPressed: _load),
                )
              : ListView(
                  padding: const EdgeInsets.all(CL.s6),
                  children: [
                    // 수강 중 과정 — 히어로. 하나만 올립니다.
                    if (inProgress.isNotEmpty) ...[
                      _HeroCourse(
                        enrollment: inProgress.first,
                        programName: _nameOf(inProgress.first['programId'] as String),
                        locale: app.locale,
                      ),
                      const SizedBox(height: CL.s7),
                    ],

                    Text(
                      app.t('training.mandatory'),
                      style: const TextStyle(fontSize: CL.subtitle, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: CL.s4),
                    if (_programs.isEmpty)
                      StateNotice(message: app.t('common.empty'))
                    else
                      for (final p in _programs) ...[
                        _ProgramTile(
                          program: p,
                          enrollment: byProgram[p['id'] as String],
                          locale: app.locale,
                          onEnroll: () => _enroll(p['id'] as String),
                        ),
                        const SizedBox(height: CL.s4),
                      ],
                  ],
                ),
    );
  }

  String _nameOf(String programId) {
    for (final p in _programs) {
      if (p['id'] == programId) return p['name'] as String? ?? '';
    }
    return '';
  }
}

class _HeroCourse extends StatelessWidget {
  const _HeroCourse({
    required this.enrollment,
    required this.programName,
    required this.locale,
  });

  final Map<String, dynamic> enrollment;
  final String programName;
  final AppLocale locale;

  @override
  Widget build(BuildContext context) {
    final progress = (enrollment['progressPct'] as num?)?.toDouble() ?? 0;
    return Container(
      padding: const EdgeInsets.all(CL.s6),
      decoration: BoxDecoration(
        color: CL.actionStrong,
        borderRadius: BorderRadius.circular(CL.rHero),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            programName,
            style: const TextStyle(
              fontSize: CL.title, fontWeight: FontWeight.w700,
              color: Colors.white, height: 1.4,
            ),
          ),
          const SizedBox(height: CL.s5),
          ClipRRect(
            borderRadius: BorderRadius.circular(CL.rPill),
            child: LinearProgressIndicator(
              value: progress / 100,
              minHeight: 8,
              backgroundColor: Colors.white24,
              valueColor: const AlwaysStoppedAnimation(Colors.white),
            ),
          ),
          const SizedBox(height: CL.s3),
          Text(
            '${progress.round()}%',
            style: const TextStyle(
              fontFamily: CL.monoFamily, fontSize: CL.body,
              color: Colors.white70, fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: CL.s5),
          SizedBox(
            width: double.infinity,
            height: CL.primaryButtonHeight,
            child: FilledButton(
              onPressed: () {},
              style: FilledButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: CL.actionStrong,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(CL.rCard)),
              ),
              child: Text(
                tr('training.continue', locale),
                style: const TextStyle(fontSize: CL.body, fontWeight: FontWeight.w700),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ProgramTile extends StatelessWidget {
  const _ProgramTile({
    required this.program,
    required this.enrollment,
    required this.locale,
    required this.onEnroll,
  });

  final Map<String, dynamic> program;
  final Map<String, dynamic>? enrollment;
  final AppLocale locale;
  final VoidCallback onEnroll;

  @override
  Widget build(BuildContext context) {
    final status = enrollment?['status'] as String?;
    final done = status == 'COMPLETED';
    final mandatory = program['isMandatory'] as bool? ?? false;

    return FieldCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  program['name'] as String? ?? '',
                  style: const TextStyle(fontSize: CL.subtitle, fontWeight: FontWeight.w700),
                ),
              ),
              if (done)
                StatusPill(tone: Tone.signal, label: _completedLabel(locale))
              else if (mandatory)
                StatusPill(tone: Tone.flag, label: tr('training.mandatory', locale)),
            ],
          ),
          if (program['hours'] != null) ...[
            const SizedBox(height: CL.s3),
            Text(
              '${program['hours']}h',
              style: const TextStyle(
                fontFamily: CL.monoFamily, fontSize: CL.caption, color: CL.textMuted,
              ),
            ),
          ],
          if (enrollment == null) ...[
            const SizedBox(height: CL.s5),
            PrimaryButton(label: tr('training.enroll', locale), onPressed: onEnroll),
          ],
        ],
      ),
    );
  }
}

String _completedLabel(AppLocale locale) => switch (locale) {
      AppLocale.ko => '수료',
      AppLocale.vi => 'Đã hoàn thành',
      AppLocale.ru => 'Завершено',
      AppLocale.en => 'Completed',
    };
