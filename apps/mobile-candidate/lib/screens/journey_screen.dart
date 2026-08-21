import 'package:flutter/material.dart';
import '../core/app_state.dart';
import '../core/i18n/strings.dart';
import 'package:carelink_field_ui/carelink_field_ui.dart';
import '../models/models.dart';
import 'applications_screen.dart';
import 'documents_screen.dart';
import 'track_screen.dart';
import 'training_screen.dart';
/// SCR-102 커리어 여정.
///
/// **이 화면이 CARELINK의 차별점입니다.** 일반 구인구직은 "지원 상태"만
/// 보여주지만 여기는 자격 취득까지의 전 경로를 보여줍니다 (SCR-102 notes).
///
/// ── 두 축을 분리하는 이유 (S3 확정) ─────────────────────────────────────
/// 커리어 여정(지원→프로필→서류→교육→배치준비→매칭→면접→배치→근속)과
/// 체류자격 절차(계약→서류검토→신청→승인→입국)는 **대응 관계가 아닙니다.**
///
/// 한 축으로 합치면 두 가지가 동시에 망가집니다.
///   - 국내 체류자에게 '입국' 단계가 보입니다 (이미 한국에 있는 사람에게)
///   - 해외 신규 인력에게 비자 절차가 커리어 단계처럼 보여, 비자가 나와야
///     교육을 시작하는 것처럼 읽힙니다. 실제로는 병렬로 진행됩니다.
///
/// 그래서 섹션을 물리적으로 나누고, 사이에 "따로 진행됩니다"를 명시합니다.
class JourneyScreen extends StatefulWidget {
  const JourneyScreen({super.key});

  @override
  State<JourneyScreen> createState() => _JourneyScreenState();
}

class _JourneyScreenState extends State<JourneyScreen> {
  Journey? _journey;
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
      final j = Journey.fromJson(await app.api.get('/candidates/me/journey') as Map<String, dynamic>);
      if (!mounted) return;
      setState(() { _journey = j; _loading = false; });
    } catch (e) {
      if (!mounted) return;
      setState(() { _error = '$e'; _loading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final j = _journey;

    return Scaffold(
      appBar: AppBar(title: Text(app.t('journey.title'))),
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
                    // ── 축 1: 커리어 여정 ────────────────────────────────
                    _AxisHeader(
                      title: app.t('journey.career'),
                      icon: Icons.work_outline,
                    ),
                    const SizedBox(height: CL.s4),
                    if (j != null)
                      for (final g in j.groups) ...[
                        _StepTile(group: g, locale: app.locale),
                        const SizedBox(height: CL.s3),
                      ],

                    // ── 두 축 사이의 경계 ────────────────────────────────
                    const SizedBox(height: CL.s7),
                    Container(
                      padding: const EdgeInsets.all(CL.s5),
                      decoration: BoxDecoration(
                        color: CL.bgSub,
                        borderRadius: BorderRadius.circular(CL.rCard),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(Icons.info_outline, size: 20, color: CL.textMuted),
                          const SizedBox(width: CL.s3),
                          Expanded(
                            child: Text(
                              app.t('journey.two.axes'),
                              style: const TextStyle(fontSize: CL.caption, color: CL.textSub, height: 1.5),
                            ),
                          ),
                        ],
                      ),
                    ),

                    // ── 축 2: 체류자격 절차 ──────────────────────────────
                    const SizedBox(height: CL.s7),
                    _AxisHeader(
                      title: app.t('journey.visa'),
                      icon: Icons.badge_outlined,
                    ),
                    const SizedBox(height: CL.s4),
                    _VisaAxis(visa: j?.visaProcess, locale: app.locale),

                    // ── 하위 진입 ─────────────────────────────────────────
                    //
                    // 시안(SCR-102)의 하단 3카드입니다: 서류 · 교육 · 커리어 트랙.
                    // 여정은 '어디까지 왔나'를 보는 화면이고, 무언가를 하려면
                    // 여기서 갈라집니다.
                    //
                    // 지원 현황(SCR-109)을 여기 넣었습니다 — 하단 탭이 시안대로
                    // 홈·여정·일자리·내 정보 넷이 되면서 탭 자리를 잃었는데,
                    // 지원은 여정의 첫 단계이므로 여정 안이 제자리입니다.
                    const SizedBox(height: CL.s7),
                    Text(
                      app.t('journey.entries'),
                      style: const TextStyle(fontSize: CL.subtitle, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: CL.s4),
                    _EntryTile(
                      icon: Icons.folder_outlined,
                      label: app.t('documents.title'),
                      onTap: () => Navigator.of(context)
                          .push(MaterialPageRoute<void>(builder: (_) => const DocumentsScreen())),
                    ),
                    _EntryTile(
                      icon: Icons.school_outlined,
                      label: app.t('training.title'),
                      onTap: () => Navigator.of(context)
                          .push(MaterialPageRoute<void>(builder: (_) => const TrainingScreen())),
                    ),
                    _EntryTile(
                      icon: Icons.trending_up,
                      label: app.t('track.title'),
                      onTap: () => Navigator.of(context)
                          .push(MaterialPageRoute<void>(builder: (_) => const TrackScreen())),
                    ),
                    _EntryTile(
                      icon: Icons.assignment_outlined,
                      label: app.t('applications.title'),
                      onTap: () => Navigator.of(context)
                          .push(MaterialPageRoute<void>(builder: (_) => const ApplicationsScreen())),
                    ),
                  ],
                ),
    );
  }
}

/// 하위 진입 행. 64px — 고령 사용자 기준 터치 타깃 (design/README §Candidate App).
class _EntryTile extends StatelessWidget {
  const _EntryTile({required this.icon, required this.label, required this.onTap});

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        height: 64,
        decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: CL.line))),
        child: Row(
          children: [
            Icon(icon, size: 24, color: CL.textSub),
            const SizedBox(width: CL.s4),
            Expanded(child: Text(label, style: const TextStyle(fontSize: CL.body))),
            const Icon(Icons.chevron_right, color: CL.textMuted, size: 24),
          ],
        ),
      ),
    );
  }
}

class _AxisHeader extends StatelessWidget {
  const _AxisHeader({required this.title, required this.icon});

  final String title;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 24, color: CL.text),
        const SizedBox(width: CL.s3),
        Expanded(
          child: Text(
            title,
            style: const TextStyle(fontSize: CL.subtitle, fontWeight: FontWeight.w700),
          ),
        ),
      ],
    );
  }
}

class _StepTile extends StatelessWidget {
  const _StepTile({required this.group, required this.locale});

  final JourneyGroup group;
  final AppLocale locale;

  @override
  Widget build(BuildContext context) {
    final tone = switch (group.state) {
      'DONE' => Tone.signal,
      'CURRENT' => Tone.action,
      _ => Tone.neutral,
    };
    final isCurrent = group.state == 'CURRENT';

    return Container(
      padding: const EdgeInsets.all(CL.s5),
      decoration: BoxDecoration(
        color: isCurrent ? CL.actionTint : CL.bg,
        border: Border.all(color: isCurrent ? CL.action : CL.line),
        borderRadius: BorderRadius.circular(CL.rCard),
      ),
      child: Row(
        children: [
          Icon(tone.icon, size: 24, color: tone.fg),
          const SizedBox(width: CL.s4),
          Expanded(
            child: Text(
              journeyGroupLabel(group.key, locale),
              style: TextStyle(
                fontSize: CL.body,
                fontWeight: isCurrent ? FontWeight.w700 : FontWeight.w400,
                color: group.state == 'PENDING' ? CL.textMuted : CL.text,
              ),
            ),
          ),
          if (isCurrent)
            StatusPill(tone: Tone.action, label: _nowLabel(locale)),
        ],
      ),
    );
  }
}

/// 체류자격 절차 축.
///
/// 이 축은 **모든 후보자에게 나타나지 않습니다.** 국내에 있고 이미 취업 가능한
/// 체류자격이면 절차 자체가 없습니다 — 그때 빈 타임라인을 보여주면 "내가 뭘
/// 안 한 건가" 하고 불안해집니다. 그래서 해당 없음을 명시적으로 씁니다.
class _VisaAxis extends StatelessWidget {
  const _VisaAxis({required this.visa, required this.locale});

  final VisaProcess? visa;
  final AppLocale locale;

  @override
  Widget build(BuildContext context) {
    final v = visa;

    if (v == null || !v.applicable) {
      return Container(
        padding: const EdgeInsets.all(CL.s5),
        decoration: BoxDecoration(
          border: Border.all(color: CL.line),
          borderRadius: BorderRadius.circular(CL.rCard),
        ),
        child: Row(
          children: [
            const Icon(Icons.check_circle_outline, size: 24, color: CL.signal),
            const SizedBox(width: CL.s4),
            Expanded(
              child: Text(
                tr('journey.visa.notApplicable', locale),
                style: const TextStyle(fontSize: CL.body, color: CL.textSub, height: 1.5),
              ),
            ),
          ],
        ),
      );
    }

    // 적격성이 확정되지 않은 회색 영역. 시스템이 판정하지 않고 사람이 확인합니다
    // (§6-1 · §6-11). 그 사이 사용자에게는 '검토 중'으로 보여줍니다.
    if (v.currentStep == null && !v.complete) {
      return Container(
        padding: const EdgeInsets.all(CL.s5),
        decoration: BoxDecoration(
          color: CL.flagTint,
          border: Border.all(color: CL.flagLine),
          borderRadius: BorderRadius.circular(CL.rCard),
        ),
        child: Row(
          children: [
            const Icon(Icons.schedule, size: 24, color: CL.flag),
            const SizedBox(width: CL.s4),
            Expanded(
              child: Text(
                tr('journey.visa.pending', locale),
                style: const TextStyle(fontSize: CL.body, color: CL.flag, height: 1.5),
              ),
            ),
          ],
        ),
      );
    }

    // 입국이 필요 없는 경우(국내 자격 변경)에는 ENTERED 단계를 아예 그리지 않습니다.
    final steps = v.requiresEntry ? _visaSteps : _visaSteps.where((s) => s != 'ENTERED').toList();
    final currentIndex = steps.indexOf(v.currentStep ?? '');

    return Column(
      children: [
        if (v.targetVisaCode != null) ...[
          Align(
            alignment: Alignment.centerLeft,
            child: StatusPill(tone: Tone.action, label: v.targetVisaCode!),
          ),
          const SizedBox(height: CL.s4),
        ],
        for (var i = 0; i < steps.length; i++) ...[
          _VisaStepTile(
            step: steps[i],
            locale: locale,
            done: currentIndex >= 0 && i <= currentIndex,
            current: i == currentIndex,
          ),
          if (i < steps.length - 1) const SizedBox(height: CL.s3),
        ],
      ],
    );
  }
}

const _visaSteps = [
  'CONTRACT_SIGNED',
  'DOCUMENT_REVIEW',
  'APPLICATION_SUBMITTED',
  'APPROVED',
  'ENTERED',
];

class _VisaStepTile extends StatelessWidget {
  const _VisaStepTile({
    required this.step,
    required this.locale,
    required this.done,
    required this.current,
  });

  final String step;
  final AppLocale locale;
  final bool done;
  final bool current;

  @override
  Widget build(BuildContext context) {
    final tone = current ? Tone.action : (done ? Tone.signal : Tone.neutral);
    return Container(
      padding: const EdgeInsets.all(CL.s5),
      decoration: BoxDecoration(
        color: current ? CL.actionTint : CL.bg,
        border: Border.all(color: current ? CL.action : CL.line),
        borderRadius: BorderRadius.circular(CL.rCard),
      ),
      child: Row(
        children: [
          Icon(tone.icon, size: 24, color: tone.fg),
          const SizedBox(width: CL.s4),
          Expanded(
            child: Text(
              visaStepLabel(step, locale),
              style: TextStyle(
                fontSize: CL.body,
                fontWeight: current ? FontWeight.w700 : FontWeight.w400,
                color: done || current ? CL.text : CL.textMuted,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

String _nowLabel(AppLocale locale) => switch (locale) {
      AppLocale.ko => '지금',
      AppLocale.vi => 'Hiện tại',
      AppLocale.ru => 'Сейчас',
      AppLocale.en => 'Now',
    };

/// 커리어 여정 단계 라벨.
String journeyGroupLabel(String key, AppLocale locale) => switch (key) {
      'APPLY' => switch (locale) {
          AppLocale.ko => '지원 · 프로필 등록',
          AppLocale.vi => 'Ứng tuyển và tạo hồ sơ',
          AppLocale.ru => 'Заявка и профиль',
          AppLocale.en => 'Apply and create profile',
        },
      'VERIFY' => switch (locale) {
          AppLocale.ko => '서류 검증',
          AppLocale.vi => 'Xác minh giấy tờ',
          AppLocale.ru => 'Проверка документов',
          AppLocale.en => 'Document verification',
        },
      'TRAIN' => switch (locale) {
          AppLocale.ko => '교육 · 자격 취득',
          AppLocale.vi => 'Đào tạo và lấy chứng chỉ',
          AppLocale.ru => 'Обучение и квалификация',
          AppLocale.en => 'Training and qualification',
        },
      'MATCH' => switch (locale) {
          AppLocale.ko => '매칭 · 면접',
          AppLocale.vi => 'Ghép việc và phỏng vấn',
          AppLocale.ru => 'Подбор и собеседование',
          AppLocale.en => 'Matching and interview',
        },
      'WORK' => switch (locale) {
          AppLocale.ko => '배치 · 근속',
          AppLocale.vi => 'Đi làm và gắn bó',
          AppLocale.ru => 'Работа и стаж',
          AppLocale.en => 'Placement and retention',
        },
      _ => key,
    };

/// 체류자격 절차 단계 라벨.
String visaStepLabel(String step, AppLocale locale) => switch (step) {
      'CONTRACT_SIGNED' => switch (locale) {
          AppLocale.ko => '근로계약 체결',
          AppLocale.vi => 'Ký hợp đồng lao động',
          AppLocale.ru => 'Подписание трудового договора',
          AppLocale.en => 'Employment contract signed',
        },
      'DOCUMENT_REVIEW' => switch (locale) {
          AppLocale.ko => '제출 서류 검토',
          AppLocale.vi => 'Xét duyệt hồ sơ nộp',
          AppLocale.ru => 'Проверка поданных документов',
          AppLocale.en => 'Submitted documents under review',
        },
      'APPLICATION_SUBMITTED' => switch (locale) {
          AppLocale.ko => '체류자격 신청 접수',
          AppLocale.vi => 'Đã nộp đơn xin tư cách lưu trú',
          AppLocale.ru => 'Заявление на статус подано',
          AppLocale.en => 'Residence application submitted',
        },
      'APPROVED' => switch (locale) {
          AppLocale.ko => '승인',
          AppLocale.vi => 'Được chấp thuận',
          AppLocale.ru => 'Одобрено',
          AppLocale.en => 'Approved',
        },
      'ENTERED' => switch (locale) {
          AppLocale.ko => '입국',
          AppLocale.vi => 'Nhập cảnh',
          AppLocale.ru => 'Въезд в страну',
          AppLocale.en => 'Entered the country',
        },
      _ => step,
    };
