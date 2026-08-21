import 'package:carelink_field_ui/carelink_field_ui.dart';
import 'package:flutter/material.dart';
import '../../core/app_state.dart';
import '../../core/i18n/strings.dart';
import '../../models/guardian_models.dart';
import 'common.dart';
import 'confirm_screen.dart';

/// SCR-304 간병사 매칭.
///
/// ── 카드에 없는 것 ─────────────────────────────────────────────────────
/// **국적·실명·연락처가 없습니다** (§6-21 · §5.10, 2026-08-21 확정).
/// API가 애초에 내려주지 않고 (`CaregiverCardDto`에 필드가 없음), 모델에도
/// 없어서 여기서 그리려 하면 컴파일이 실패합니다. 게이트를 세 겹으로 둔 것은
/// 화면이 늘어나면 어느 한 겹은 뚫리기 때문입니다.
///
/// 보호자가 국적으로 고르기 시작하면 그것이 배정 관행이 되고, 검증을 통과한
/// 인력이 국적 때문에 선택받지 못합니다. 플랫폼이 거르는 것은 국적이 아니라
/// 검증되지 않은 인력입니다.
///
/// ── 고른다고 끝이 아닙니다 ─────────────────────────────────────────────
/// 보호자 선택 → 간병사 수락 → **담당자 확인**의 3단계입니다 (§6-4).
/// 고른 순간 끝났다고 생각하면 기다리는 동안 문의가 그대로 옵니다.
class MatchScreen extends StatefulWidget {
  const MatchScreen({super.key, required this.requestId});

  final String requestId;

  @override
  State<MatchScreen> createState() => _MatchScreenState();
}

class _MatchScreenState extends State<MatchScreen> {
  CareRequest? _request;
  CareMatchResult? _match;
  CareAssignment? _pending;
  String? _error;
  String? _busyId;

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
      // 매칭은 POST입니다 — 실행할 때마다 match_logs에 판단 근거가 쌓입니다.
      final match = await app.api.post('/care-requests/${widget.requestId}/match', const {})
          as Map<String, dynamic>;
      final assigns =
          await app.api.get('/care-requests/${widget.requestId}/assignments') as List<dynamic>;
      if (!mounted) return;
      final list = assigns.map((e) => CareAssignment.fromJson(e as Map<String, dynamic>)).toList();
      setState(() {
        _request = CareRequest.fromJson(req);
        _match = CareMatchResult.fromJson(match);
        _pending = list.where((a) => a.isPending).firstOrNull;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = errorKey(e.code));
    } catch (_) {
      if (mounted) setState(() => _error = 'error.network');
    }
  }

  Future<void> _choose(String caregiverId) async {
    final app = AppScope.of(context);
    setState(() { _busyId = caregiverId; _error = null; });
    try {
      await app.api.post('/care-requests/${widget.requestId}/assign', {'caregiverId': caregiverId});
      await _load();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = errorKey(e.code));
    } catch (_) {
      if (mounted) setState(() => _error = 'error.network');
    } finally {
      if (mounted) setState(() => _busyId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final r = _request;
    final m = _match;
    final pending = _pending;

    return Scaffold(
      appBar: AppBar(
        title: Text(app.t('guardian.request.title')),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).push(MaterialPageRoute<void>(
              builder: (_) => ConfirmScreen(requestId: widget.requestId),
            )),
            child: Text(app.t('guardian.confirm.progress')),
          ),
        ],
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(CL.s6),
          children: [
            Ask(
              text: app.t('guardian.match.ask'),
              sub: r == null ? null : '${r.hospitalName ?? ''} ${r.ward ?? ''}'.trim(),
            ),

            if (_error != null) StateNotice(message: app.t(_error!), tone: Tone.alert),
            if (m == null && _error == null) StateNotice(message: app.t('common.loading')),

            if (pending != null)
              FieldCard(
                tone: Tone.action,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CardTitle(app
                        .t('guardian.match.offered')
                        .replaceAll('{code}', pending.caregiverDisplayCode)),
                    Text(
                      pending.status == 'ACCEPTED'
                          ? app.t('guardian.match.accepted')
                          : app.t('guardian.match.waiting'),
                      style: const TextStyle(fontSize: CLUp.body, color: CL.textSub, height: 1.6),
                    ),
                    const SizedBox(height: CL.s4),
                    StatusPill(
                      tone: pending.status == 'ACCEPTED' ? Tone.signal : Tone.flag,
                      label: codeLabel(pending.status, app.locale),
                    ),
                  ],
                ),
              )
            else if (m != null) ...[
              if (m.candidates.isEmpty)
                StateNotice(message: app.t('guardian.match.none'))
              else
                Text(
                  app.t('guardian.match.count').replaceAll('{n}', '${m.candidates.length}'),
                  style: const TextStyle(fontSize: CLUp.subtitle, color: CL.textMuted),
                ),
              const SizedBox(height: CL.s4),

              for (final c in m.candidates) _CaregiverCardTile(
                card: c,
                busy: _busyId != null,
                busyThis: _busyId == c.caregiverId,
                onChoose: () => _choose(c.caregiverId),
              ),

              if (m.excludedCount > 0)
                NoteBox(
                  text: app.t('guardian.match.excluded').replaceAll('{n}', '${m.excludedCount}'),
                  tone: Tone.flag,
                ),

              Text(
                app.t('guardian.match.threeSteps'),
                style: const TextStyle(fontSize: CLUp.caption, color: CL.textMuted, height: 1.6),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// 간병사 카드.
///
/// 보여 주는 것은 **표시 코드 · 경력 · 완료 건수 · 평점 · 자격 칩**뿐입니다.
/// `CaregiverCard` 모델에 국적도 실명도 없어서 여기서 그릴 수가 없습니다.
class _CaregiverCardTile extends StatelessWidget {
  const _CaregiverCardTile({
    required this.card,
    required this.busy,
    required this.busyThis,
    required this.onChoose,
  });

  final CaregiverCard card;
  final bool busy;
  final bool busyThis;
  final VoidCallback onChoose;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    return FieldCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              // 시안의 64px 원형 아바타. 사진이 아니라 도형입니다 —
              // 간병사 얼굴 사진은 보호자에게 나가지 않습니다.
              Container(
                width: 60, height: 60,
                decoration: const BoxDecoration(color: CL.actionTint, shape: BoxShape.circle),
                alignment: Alignment.center,
                child: const Icon(Icons.person, size: 30, color: CL.action),
              ),
              const SizedBox(width: CL.s5),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      card.displayCode,
                      style: const TextStyle(
                        fontFamily: CL.monoFamily, fontSize: CLUp.subtitle,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: CL.s1),
                    Text(
                      app.t('guardian.match.career')
                          .replaceAll('{y}', '${card.experienceYrs}')
                          .replaceAll('{n}', '${card.completedCount}'),
                      style: const TextStyle(fontSize: CLUp.caption, color: CL.textMuted),
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    card.ratingAvg?.toStringAsFixed(1) ?? '—',
                    style: const TextStyle(
                      fontFamily: CL.monoFamily, fontSize: CLUp.subtitle,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  if (card.ratingAvg == null)
                    Text(
                      app.t('guardian.match.noRating'),
                      style: const TextStyle(fontSize: CL.caption, color: CL.textMuted),
                    ),
                ],
              ),
            ],
          ),
          const SizedBox(height: CL.s4),

          Wrap(
            spacing: CL.s2,
            runSpacing: CL.s2,
            children: [
              StatusPill(tone: Tone.signal, label: app.t('guardian.match.verified')),
              if (card.experienceYrs >= 3)
                StatusPill(tone: Tone.signal, label: app.t('guardian.match.senior')),
              if (!card.available)
                StatusPill(tone: Tone.neutral, label: app.t('guardian.match.busy')),
            ],
          ),
          const SizedBox(height: CL.s5),

          Row(
            children: [
              // 시안에는 `₩128,000 / 일`이 있습니다. **금액을 계산하지 않습니다** —
              // 4대보험·퇴직금을 반영한 청구 단가(U6)가 확정되기 전에 숫자를
              // 띄우면 그 숫자가 곧 약속이 됩니다 (§6-8).
              Expanded(
                child: Text(
                  app.t('guardian.match.costNote'),
                  style: const TextStyle(fontSize: CLUp.caption, color: CL.textMuted),
                ),
              ),
              SecondaryButton(
                up: true,
                label: busyThis ? app.t('common.loading') : app.t('guardian.match.pick'),
                onPressed: (busy || !card.available) ? null : onChoose,
              ),
            ],
          ),
        ],
      ),
    );
  }
}
