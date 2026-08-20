import 'package:flutter/material.dart';
import '../core/app_state.dart';
import '../core/i18n/strings.dart';
import '../core/theme/tokens.dart';
import '../models/models.dart';
import '../widgets/field_widgets.dart';

/// SCR-105 서류 / 증빙.
///
/// **만료일 관리가 핵심입니다.** 자격증·건강진단서가 만료되면 배치 중인 인력의
/// 자격이 조용히 무효화됩니다. 체류자격은 더 무겁습니다 — 만료되면 자격 무효가
/// 아니라 **불법 취업**이 됩니다 (SCR-105 notes · §5.9).
///
/// 그래서 만료일을 날짜로 쓰지 않고 카운트다운으로 보여줍니다. 사람은
/// `2026-09-10`을 보고 남은 날을 계산하지 않습니다.
///
/// 파일은 presigned URL로만 접근합니다 (§6-5). 이 화면에 파일 URL을 직접
/// 넣지 않는 이유입니다 — 열람은 항상 서버에 다시 물어봅니다.
class DocumentsScreen extends StatefulWidget {
  const DocumentsScreen({super.key});

  @override
  State<DocumentsScreen> createState() => _DocumentsScreenState();
}

class _DocumentsScreenState extends State<DocumentsScreen> {
  List<DocumentItem> _docs = const [];
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
      final res = await app.api.get('/candidates/me/documents');
      final list = res is List<dynamic> ? res : (res as Map<String, dynamic>)['items'] as List<dynamic>? ?? [];
      if (!mounted) return;
      setState(() {
        _docs = list.map((d) => DocumentItem.fromJson(d as Map<String, dynamic>)).toList();
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
    final verified = _docs.where((d) => d.status == 'VERIFIED').length;
    final review = _docs.where((d) => d.status == 'UNDER_REVIEW' || d.status == 'PENDING').length;
    final needsAction = _docs.where((d) => d.status == 'REJECTED' || d.status == 'EXPIRED').length;

    return Scaffold(
      appBar: AppBar(title: Text(app.t('documents.title'))),
      body: _loading
          ? Center(child: Text(app.t('common.loading'), style: const TextStyle(fontSize: CL.body)))
          : _error != null
              ? StateNotice(
                  message: _error!,
                  tone: Tone.alert,
                  action: SecondaryButton(label: app.t('common.retry'), onPressed: _load),
                )
              : Column(
                  children: [
                    // 상단 요약 3칩 (design/README §Candidate App 105)
                    Padding(
                      padding: const EdgeInsets.fromLTRB(CL.s6, CL.s5, CL.s6, 0),
                      child: Row(
                        children: [
                          Expanded(child: _SummaryChip(tone: Tone.signal, count: verified, locale: app.locale, kind: _ChipKind.verified)),
                          const SizedBox(width: CL.s2),
                          Expanded(child: _SummaryChip(tone: Tone.flag, count: review, locale: app.locale, kind: _ChipKind.review)),
                          const SizedBox(width: CL.s2),
                          Expanded(child: _SummaryChip(tone: Tone.alert, count: needsAction, locale: app.locale, kind: _ChipKind.action)),
                        ],
                      ),
                    ),
                    Expanded(
                      child: _docs.isEmpty
                          ? StateNotice(message: app.t('common.empty'))
                          : ListView.separated(
                              padding: const EdgeInsets.all(CL.s6),
                              itemCount: _docs.length,
                              separatorBuilder: (_, __) => const SizedBox(height: CL.s4),
                              itemBuilder: (context, i) => _DocumentTile(doc: _docs[i], locale: app.locale),
                            ),
                    ),
                    // 하단 고정 업로드 버튼 56px
                    SafeArea(
                      child: Padding(
                        padding: const EdgeInsets.all(CL.s6),
                        child: PrimaryButton(
                          label: app.t('documents.upload'),
                          onPressed: () {},
                        ),
                      ),
                    ),
                  ],
                ),
    );
  }
}

enum _ChipKind { verified, review, action }

class _SummaryChip extends StatelessWidget {
  const _SummaryChip({
    required this.tone,
    required this.count,
    required this.locale,
    required this.kind,
  });

  final Tone tone;
  final int count;
  final AppLocale locale;
  final _ChipKind kind;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(CL.s4),
      decoration: BoxDecoration(
        color: tone.bg,
        borderRadius: BorderRadius.circular(CL.rCard),
      ),
      child: Column(
        children: [
          Text(
            '$count',
            style: TextStyle(
              fontFamily: CL.monoFamily, fontSize: CL.display,
              fontWeight: FontWeight.w700, color: tone.fg,
            ),
          ),
          const SizedBox(height: CL.s1),
          Text(
            _chipLabel(kind, locale),
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: CL.caption, color: tone.fg),
          ),
        ],
      ),
    );
  }
}

String _chipLabel(_ChipKind kind, AppLocale locale) => switch (kind) {
      _ChipKind.verified => switch (locale) {
          AppLocale.ko => '승인',
          AppLocale.vi => 'Đã duyệt',
          AppLocale.ru => 'Принято',
          AppLocale.en => 'Approved',
        },
      _ChipKind.review => switch (locale) {
          AppLocale.ko => '검토 중',
          AppLocale.vi => 'Đang xét',
          AppLocale.ru => 'На проверке',
          AppLocale.en => 'In review',
        },
      _ChipKind.action => switch (locale) {
          AppLocale.ko => '조치 필요',
          AppLocale.vi => 'Cần xử lý',
          AppLocale.ru => 'Нужно действие',
          AppLocale.en => 'Action needed',
        },
    };

class _DocumentTile extends StatelessWidget {
  const _DocumentTile({required this.doc, required this.locale});

  final DocumentItem doc;
  final AppLocale locale;

  @override
  Widget build(BuildContext context) {
    final tone = switch (doc.status) {
      'VERIFIED' => Tone.signal,
      'REJECTED' || 'EXPIRED' => Tone.alert,
      _ => Tone.flag,
    };

    return FieldCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  docTypeLabel(doc.docType, locale),
                  style: const TextStyle(fontSize: CL.subtitle, fontWeight: FontWeight.w700),
                ),
              ),
              const SizedBox(width: CL.s3),
              StatusPill(tone: tone, label: docStatusLabel(doc.status, locale)),
            ],
          ),

          if (doc.expiresAt != null) ...[
            const SizedBox(height: CL.s4),
            ExpiryCountdown(
              days: doc.expiresInDays,
              locale: locale,
              date: doc.expiresAt,
            ),
          ],

          // 반려 사유가 없으면 후보자는 무엇을 고쳐야 할지 모릅니다.
          if (doc.status == 'REJECTED') ...[
            const SizedBox(height: CL.s4),
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
                    tr('documents.rejectReason', locale),
                    style: const TextStyle(fontSize: CL.caption, color: CL.alert, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(height: CL.s2),
                  Text(
                    doc.rejectReason ?? tr('applications.noReason', locale),
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

String docTypeLabel(String type, AppLocale locale) => switch (type) {
      'IDENTITY' => switch (locale) {
          AppLocale.ko => '신분증 · 외국인등록증',
          AppLocale.vi => 'Giấy tờ tùy thân / thẻ cư trú',
          AppLocale.ru => 'Удостоверение личности / карта иностранца',
          AppLocale.en => 'ID or residence card',
        },
      'CRIMINAL_RECORD' => switch (locale) {
          AppLocale.ko => '범죄경력 회보서',
          AppLocale.vi => 'Phiếu lý lịch tư pháp',
          AppLocale.ru => 'Справка о несудимости',
          AppLocale.en => 'Criminal record certificate',
        },
      'HEALTH' => switch (locale) {
          AppLocale.ko => '건강진단서',
          AppLocale.vi => 'Giấy khám sức khỏe',
          AppLocale.ru => 'Медицинская справка',
          AppLocale.en => 'Health check certificate',
        },
      'QUALIFICATION' => switch (locale) {
          AppLocale.ko => '자격증',
          AppLocale.vi => 'Chứng chỉ nghề',
          AppLocale.ru => 'Свидетельство о квалификации',
          AppLocale.en => 'Qualification certificate',
        },
      'EDUCATION' => switch (locale) {
          AppLocale.ko => '학력 증명',
          AppLocale.vi => 'Bằng cấp học vấn',
          AppLocale.ru => 'Документ об образовании',
          AppLocale.en => 'Education certificate',
        },
      'CAREER' => switch (locale) {
          AppLocale.ko => '경력 증명',
          AppLocale.vi => 'Xác nhận kinh nghiệm',
          AppLocale.ru => 'Подтверждение стажа',
          AppLocale.en => 'Career certificate',
        },
      _ => switch (locale) {
          AppLocale.ko => '기타 서류',
          AppLocale.vi => 'Giấy tờ khác',
          AppLocale.ru => 'Прочие документы',
          AppLocale.en => 'Other document',
        },
    };

String docStatusLabel(String status, AppLocale locale) => switch (status) {
      'VERIFIED' => switch (locale) {
          AppLocale.ko => '승인',
          AppLocale.vi => 'Đã duyệt',
          AppLocale.ru => 'Принято',
          AppLocale.en => 'Approved',
        },
      'UNDER_REVIEW' => switch (locale) {
          AppLocale.ko => '검토 중',
          AppLocale.vi => 'Đang xét',
          AppLocale.ru => 'На проверке',
          AppLocale.en => 'In review',
        },
      'REJECTED' => switch (locale) {
          AppLocale.ko => '반려',
          AppLocale.vi => 'Bị từ chối',
          AppLocale.ru => 'Отклонено',
          AppLocale.en => 'Rejected',
        },
      'EXPIRED' => switch (locale) {
          AppLocale.ko => '만료',
          AppLocale.vi => 'Hết hạn',
          AppLocale.ru => 'Истёк',
          AppLocale.en => 'Expired',
        },
      _ => switch (locale) {
          AppLocale.ko => '미제출',
          AppLocale.vi => 'Chưa nộp',
          AppLocale.ru => 'Не подано',
          AppLocale.en => 'Not submitted',
        },
    };
