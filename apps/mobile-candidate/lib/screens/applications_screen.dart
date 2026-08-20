import 'package:flutter/material.dart';
import '../core/app_state.dart';
import '../core/i18n/strings.dart';
import '../core/theme/tokens.dart';
import '../models/models.dart';
import '../widgets/field_widgets.dart';

/// SCR-109 지원 현황.
///
/// **불합격에는 사유가 필수입니다** (design/README §Candidate App 109).
/// 지원자가 "연락이 없다"고 느끼는 순간 이탈합니다 (SCR-109 notes).
/// 사유가 비어 있으면 화면이 그 사실을 숨기지 않고 드러냅니다 — 빈칸으로 두면
/// 운영자도 누락을 발견하지 못합니다.
class ApplicationsScreen extends StatefulWidget {
  const ApplicationsScreen({super.key});

  @override
  State<ApplicationsScreen> createState() => _ApplicationsScreenState();
}

class _ApplicationsScreenState extends State<ApplicationsScreen> {
  List<Application> _apps = const [];
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
      final res = await app.api.get('/candidates/me/applications');
      final list = res is List<dynamic> ? res : const <dynamic>[];
      if (!mounted) return;
      setState(() {
        _apps = list.map((a) => Application.fromJson(a as Map<String, dynamic>)).toList();
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
      appBar: AppBar(title: Text(app.t('applications.title'))),
      body: _loading
          ? Center(child: Text(app.t('common.loading'), style: const TextStyle(fontSize: CL.body)))
          : _error != null
              ? StateNotice(
                  message: _error!,
                  tone: Tone.alert,
                  action: SecondaryButton(label: app.t('common.retry'), onPressed: _load),
                )
              : _apps.isEmpty
                  ? StateNotice(message: app.t('common.empty'))
                  : ListView.separated(
                      padding: const EdgeInsets.all(CL.s6),
                      itemCount: _apps.length,
                      separatorBuilder: (_, __) => const SizedBox(height: CL.s4),
                      itemBuilder: (context, i) => _ApplicationTile(item: _apps[i], locale: app.locale),
                    ),
    );
  }
}

/// 진행 4단계 스텝 바. 진행 중인 건에만 펼칩니다.
const _steps = ['APPLIED', 'SCREENING', 'INTERVIEW_SCHEDULED', 'OFFERED'];

class _ApplicationTile extends StatelessWidget {
  const _ApplicationTile({required this.item, required this.locale});

  final Application item;
  final AppLocale locale;

  @override
  Widget build(BuildContext context) {
    final rejected = item.status == 'REJECTED';
    final withdrawn = item.status == 'WITHDRAWN';
    final finished = rejected || withdrawn || item.status == 'HIRED';
    final stepIndex = _steps.indexOf(item.status);

    return FieldCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  item.jobTitle ?? item.organizationName,
                  style: const TextStyle(fontSize: CL.subtitle, fontWeight: FontWeight.w700),
                ),
              ),
              const SizedBox(width: CL.s3),
              StatusPill(
                tone: rejected ? Tone.alert : (item.status == 'HIRED' ? Tone.signal : Tone.action),
                label: applicationStatusLabel(item.status, locale),
              ),
            ],
          ),
          const SizedBox(height: CL.s2),
          Text(item.organizationName, style: const TextStyle(fontSize: CL.body, color: CL.textSub)),

          // 진행 중인 건만 스텝 바를 펼칩니다 — 끝난 건까지 펼치면
          // 목록이 길어져 정작 진행 중인 것이 묻힙니다.
          if (!finished && stepIndex >= 0) ...[
            const SizedBox(height: CL.s5),
            Row(
              children: [
                for (var i = 0; i < _steps.length; i++) ...[
                  Expanded(
                    child: Container(
                      height: 6,
                      decoration: BoxDecoration(
                        color: i <= stepIndex ? CL.action : CL.bgSub,
                        borderRadius: BorderRadius.circular(CL.rPill),
                      ),
                    ),
                  ),
                  if (i < _steps.length - 1) const SizedBox(width: CL.s1),
                ],
              ],
            ),
            const SizedBox(height: CL.s3),
            Text(
              applicationStatusLabel(_steps[stepIndex], locale),
              style: const TextStyle(fontSize: CL.caption, color: CL.actionText, fontWeight: FontWeight.w600),
            ),
          ],

          // 불합격은 사유 필수.
          if (rejected) ...[
            const SizedBox(height: CL.s5),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(CL.s4),
              decoration: BoxDecoration(
                color: CL.alertTint,
                borderRadius: BorderRadius.circular(CL.rChip),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    tr('applications.resultNote', locale),
                    style: const TextStyle(fontSize: CL.caption, color: CL.alert, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: CL.s2),
                  Text(
                    item.resultNote ?? tr('applications.noReason', locale),
                    style: const TextStyle(fontSize: CL.body, color: CL.alert, height: 1.5),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

String applicationStatusLabel(String status, AppLocale locale) => switch (status) {
      'APPLIED' => switch (locale) {
          AppLocale.ko => '지원 접수',
          AppLocale.vi => 'Đã nộp đơn',
          AppLocale.ru => 'Отклик отправлен',
          AppLocale.en => 'Applied',
        },
      'SCREENING' => switch (locale) {
          AppLocale.ko => '검토 중',
          AppLocale.vi => 'Đang xét duyệt',
          AppLocale.ru => 'Рассматривается',
          AppLocale.en => 'Under review',
        },
      'INTERVIEW_REQUESTED' => switch (locale) {
          AppLocale.ko => '면접 요청 받음',
          AppLocale.vi => 'Nhận lời mời phỏng vấn',
          AppLocale.ru => 'Приглашение на собеседование',
          AppLocale.en => 'Interview requested',
        },
      'INTERVIEW_SCHEDULED' => switch (locale) {
          AppLocale.ko => '면접 예정',
          AppLocale.vi => 'Sắp phỏng vấn',
          AppLocale.ru => 'Назначено собеседование',
          AppLocale.en => 'Interview scheduled',
        },
      'OFFERED' => switch (locale) {
          AppLocale.ko => '채용 제안',
          AppLocale.vi => 'Được đề nghị tuyển',
          AppLocale.ru => 'Получено предложение',
          AppLocale.en => 'Offer received',
        },
      'HIRED' => switch (locale) {
          AppLocale.ko => '채용 확정',
          AppLocale.vi => 'Đã được tuyển',
          AppLocale.ru => 'Принят на работу',
          AppLocale.en => 'Hired',
        },
      'REJECTED' => switch (locale) {
          AppLocale.ko => '불합격',
          AppLocale.vi => 'Không trúng tuyển',
          AppLocale.ru => 'Отказ',
          AppLocale.en => 'Not selected',
        },
      'WITHDRAWN' => switch (locale) {
          AppLocale.ko => '철회함',
          AppLocale.vi => 'Đã rút đơn',
          AppLocale.ru => 'Отклик отозван',
          AppLocale.en => 'Withdrawn',
        },
      _ => status,
    };
