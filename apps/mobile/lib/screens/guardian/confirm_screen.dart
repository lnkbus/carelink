import 'package:carelink_field_ui/carelink_field_ui.dart';
import 'package:flutter/material.dart';
import '../../core/app_state.dart';
import '../../core/i18n/strings.dart';
import '../../models/guardian_models.dart';
import 'common.dart';
import 'live_screen.dart';

/// SCR-305 예약 확인.
///
/// ── 결제가 없습니다 ────────────────────────────────────────────────────
/// SCREENS의 SCR-305는 `POST /pricing/quote`와 `POST /payments/authorize`를
/// 요구하지만, **정산·결제는 V3이고 착수 금지입니다** (CLAUDE.md §2).
/// 막혀 있는 것은 기술이 아니라 사업 결정입니다 —
///   · 간병사와의 법적 관계(직접고용/위탁/중개)에 따라 청구 구조가 다르고
///   · 4대보험·퇴직금을 반영한 청구 단가(U6)가 미확정이며
///   · 취소·환불 정책이 미확정입니다 (§10)
///
/// 그래서 금액을 계산해 보여주지 않습니다. 가짜 금액을 띄우면 그 숫자를 본
/// 보호자가 나중에 다른 금액을 청구받습니다. 자리는 두되 무엇을 기다리는지
/// 씁니다 — 자리를 지우면 결정이 난 뒤 레이아웃을 다시 짜야 합니다.
class ConfirmScreen extends StatefulWidget {
  const ConfirmScreen({super.key, required this.requestId});

  final String requestId;

  @override
  State<ConfirmScreen> createState() => _ConfirmScreenState();
}

class _ConfirmScreenState extends State<ConfirmScreen> {
  CareRequest? _request;
  CareAssignment? _confirmed;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final app = AppScope.of(context);
    setState(() => _error = null);
    try {
      final req = await app.api.get('/care-requests/${widget.requestId}') as Map<String, dynamic>;
      final assigns =
          await app.api.get('/care-requests/${widget.requestId}/assignments') as List<dynamic>;
      if (!mounted) return;
      final list = assigns.map((e) => CareAssignment.fromJson(e as Map<String, dynamic>)).toList();
      setState(() {
        _request = CareRequest.fromJson(req);
        _confirmed = list.where((a) => a.isFixed).firstOrNull;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = errorKey(e.code));
    } catch (_) {
      if (mounted) setState(() => _error = 'error.network');
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final r = _request;
    final a = _confirmed;

    return Scaffold(
      appBar: AppBar(title: Text(app.t('guardian.request.title'))),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(CL.s6),
          children: [
            Ask(text: app.t('guardian.confirm.ask')),

            if (_error != null) StateNotice(message: app.t(_error!), tone: Tone.alert),
            if (r == null && _error == null) StateNotice(message: app.t('common.loading')),

            if (r != null) ...[
              FieldCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CardTitle(r.hospitalName ?? app.t('guardian.hospitalMissing')),
                    InfoRow(label: app.t('guardian.form.ward'), value: r.ward),
                    InfoRow(label: app.t('guardian.form.start'), value: fmtKst(r.startAt)),
                    InfoRow(
                      label: app.t('guardian.form.shift'),
                      value: codeLabel(r.shiftPatternCode, app.locale),
                    ),
                    InfoRow(
                      label: app.t('guardian.form.mobility'),
                      value: codeLabel(r.mobilityLevel, app.locale),
                    ),
                    if (r.supportItems != null && r.supportItems!.isNotEmpty)
                      InfoRow(
                        label: app.t('guardian.form.support'),
                        value: r.supportItems!
                            .map((c) => codeLabel(c, app.locale))
                            .join(' · '),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: CL.s4),

              // 시안(SCR-305)에는 금액 3행이 있습니다 — 일당 × 일수 ·
              // 플랫폼 이용료 · 합계(mono 26px). **숫자를 만들지 않습니다.**
              FieldCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CardTitle(app.t('guardian.confirm.cost')),
                    InfoRow(
                      label: app.t('guardian.confirm.careCost'),
                      value: app.t('guardian.cost.staffGuided'),
                    ),
                    InfoRow(
                      label: app.t('guardian.confirm.platformFee'),
                      value: app.t('guardian.cost.staffGuided'),
                    ),
                    const SizedBox(height: CL.s3),
                    Text(
                      app.t('guardian.confirm.noPayment'),
                      style: const TextStyle(
                        fontSize: CLUp.caption, color: CL.textMuted, height: 1.6,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: CL.s4),

              if (a != null) ...[
                FieldCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      CardTitle(app.t('guardian.confirm.assigned')),
                      InfoRow(label: '', value: a.caregiverDisplayCode, mono: true),
                      const SizedBox(height: CL.s3),
                      StatusPill(tone: Tone.signal, label: codeLabel(a.status, app.locale)),
                    ],
                  ),
                ),
                const SizedBox(height: CL.s4),
                PrimaryButton(
                  label: app.t('guardian.confirm.progress'),
                  up: true,
                  onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
                    builder: (_) => LiveScreen(assignmentId: a.id),
                  )),
                ),
              ],

              // 업무범위 검토 중이면 무엇 때문인지 말합니다.
              // **감지는 거절이 아닙니다** (§6-15).
              if (r.inScopeReview) NoteBox(text: app.t('guardian.confirm.opsReview'), tone: Tone.flag),
            ],
          ],
        ),
      ),
    );
  }
}
