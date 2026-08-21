import 'package:carelink_field_ui/carelink_field_ui.dart';
import 'package:flutter/material.dart';
import '../core/app_state.dart';
import '../core/i18n/strings.dart';
import '../models/models.dart';

/// SCR-404 근무 기록.
///
/// **시안에 있는데 화면이 없었습니다.** 근무 상세(403) 안에 기록 목록만
/// 읽기 전용으로 붙어 있었고, 간병사가 '오늘 한 일'을 남길 방법이 없었습니다.
/// 기록이 없으면 근무시간이 집계되지 않고, 그러면 분쟁에서 근거가 없습니다.
///
/// 시안 규격: 앰버 오프라인 배너 · 체크 항목 72px · 특이사항 96px ·
/// 사진 96px · 저장 76px(하단 고정).
///
/// ── 오프라인 큐 ─────────────────────────────────────────────────────────
/// 병실은 신호가 약합니다. 저장이 실패하면 **기기에 넣어 두고 다음에 열 때
/// 다시 보냅니다.** 기록이 날아갈까 봐 안 쓰는 것이 가장 흔한 이탈 이유라,
/// 실패했다는 말 대신 '저장했고 자동으로 보낸다'고 말합니다.
///
/// 큐를 서버가 아니라 기기에 두는 이유: 서버에 못 닿는 상황이 문제이므로,
/// 해결책이 서버에 있으면 안 됩니다.
class RecordScreen extends StatefulWidget {
  const RecordScreen({super.key, required this.assignmentId, required this.detail});

  final String assignmentId;
  final AssignmentDetail detail;

  @override
  State<RecordScreen> createState() => _RecordScreenState();
}

class _RecordScreenState extends State<RecordScreen> {
  final _memo = TextEditingController();
  final Set<String> _done = {};
  bool _busy = false;
  bool _queued = false;
  String? _error;

  @override
  void dispose() {
    _memo.dispose();
    super.dispose();
  }

  Future<void> _save(AppState app) async {
    setState(() { _busy = true; _error = null; _queued = false; });

    // 체크한 항목 하나가 기록 한 줄입니다. append-only라 묶어서 한 줄로
    // 만들지 않습니다 — 나중에 '어느 항목을 언제 했나'를 물어보면
    // 묶인 기록으로는 답할 수 없습니다 (§5.4).
    final entries = [
      for (final code in _done) {'logType': 'SUPPORT', 'itemCode': code},
      if (_memo.text.trim().isNotEmpty) {'logType': 'NOTE', 'memo': _memo.text.trim()},
    ];
    if (entries.isEmpty) { setState(() => _busy = false); return; }

    try {
      for (final e in entries) {
        await app.api.post('/care-assignments/${widget.assignmentId}/logs', e);
      }
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = errorKey(e.code));
    } catch (_) {
      // 네트워크 실패 — 기기에 넣어 두고 다음에 보냅니다.
      await app.queueLogs(widget.assignmentId, entries);
      if (mounted) setState(() => _queued = true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final items = widget.detail.supportItems;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: CL.bg,
        toolbarHeight: 64,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(app.t('record.title'),
                style: const TextStyle(fontSize: CLUp.title, fontWeight: FontWeight.w700)),
            Text(
              widget.detail.ward ?? app.t('shift.wardUnknown'),
              style: const TextStyle(
                fontFamily: CL.monoFamily, fontSize: 15, color: CL.textMuted,
              ),
            ),
          ],
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // 오프라인 배너 — 시안 규격(앰버 tint · radius 12 · 17px/600).
            if (_queued)
              Padding(
                padding: const EdgeInsets.fromLTRB(CL.s6, 0, CL.s6, CL.s4),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: CL.s5, vertical: CL.s4),
                  decoration: BoxDecoration(
                    color: CL.flagTint,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.cloud_off, size: 22, color: CL.flagIcon),
                      const SizedBox(width: CL.s3),
                      Expanded(
                        child: Text(
                          app.t('record.offlineQueued'),
                          style: const TextStyle(
                            fontSize: 17, fontWeight: FontWeight.w600, color: CL.flag,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(CL.s6, 0, CL.s6, CL.s6),
                children: [
                  if (_error != null) ...[
                    StateNotice(tone: Tone.alert, message: app.t(_error!)),
                    const SizedBox(height: CL.s5),
                  ],

                  Text(app.t('record.didToday'),
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                  const SizedBox(height: CL.s4),

                  // 항목은 서버 카탈로그에서 옵니다. 화면에 상수 배열을 두면
                  // 그 배열이 곧 카탈로그가 되고, 거기엔 의료행위가 들어갈 수
                  // 있습니다 (§6-2).
                  if (items.isEmpty)
                    StateNotice(message: app.t('detail.support'))
                  else
                    for (final code in items) ...[
                      _CheckTile(
                        label: codeLabel(code, app.locale),
                        checked: _done.contains(code),
                        onTap: () => setState(() {
                          _done.contains(code) ? _done.remove(code) : _done.add(code);
                        }),
                      ),
                      const SizedBox(height: CL.s3),
                    ],

                  const SizedBox(height: CL.s5),
                  Text(app.t('record.notes'),
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
                  const SizedBox(height: CL.s4),
                  // 자유 입력은 막지 않습니다. 서버가 업무범위 키워드를
                  // 스캔하고 감지되면 OPS_REVIEW로 보냅니다 — 자동 거절하면
                  // 표현을 바꿔 우회합니다 (§6-15).
                  Container(
                    constraints: const BoxConstraints(minHeight: 96),
                    decoration: BoxDecoration(
                      border: Border.all(color: CL.line),
                      borderRadius: BorderRadius.circular(CL.rCard),
                    ),
                    padding: const EdgeInsets.all(CL.s5),
                    child: TextField(
                      controller: _memo,
                      maxLines: null,
                      style: const TextStyle(fontSize: 18),
                      decoration: InputDecoration(
                        border: InputBorder.none,
                        isDense: true,
                        hintText: app.t('record.notesHint'),
                        hintStyle: const TextStyle(fontSize: 18, color: CL.textDisabled),
                      ),
                    ),
                  ),

                  const SizedBox(height: CL.s5),
                  Row(
                    children: [
                      // 사진 96px — 시안 자리입니다. 업로드는 presigned URL
                      // 경로가 필요해서(§6-5) 아직 열지 않았습니다.
                      InkWell(
                        onTap: () => ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(app.t('record.photoLater'))),
                        ),
                        child: Container(
                          width: 96, height: 96,
                          decoration: BoxDecoration(
                            color: CL.bgSub,
                            borderRadius: BorderRadius.circular(CL.rCard),
                          ),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.photo_camera_outlined, size: 28, color: CL.textSub),
                              const SizedBox(height: CL.s2),
                              Text(app.t('record.photo'),
                                  style: const TextStyle(
                                      fontSize: 15, fontWeight: FontWeight.w600, color: CL.textSub)),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // 저장 76px — 하단 고정 (시안).
            Container(
              padding: const EdgeInsets.fromLTRB(CL.s6, CL.s5, CL.s6, CL.s6),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: CL.line)),
              ),
              child: PrimaryButton(
                up: true,
                hero: true,
                label: app.t('record.save'),
                onPressed: _busy ? null : () => _save(app),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 체크 항목 72px (시안 규격). 선택되면 파란 2px 테두리 + tint.
class _CheckTile extends StatelessWidget {
  const _CheckTile({required this.label, required this.checked, required this.onTap});

  final String label;
  final bool checked;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(CL.rCard),
      child: Container(
        constraints: const BoxConstraints(minHeight: 72),
        padding: const EdgeInsets.all(CL.s5),
        decoration: BoxDecoration(
          border: Border.all(color: checked ? CL.action : CL.line, width: checked ? 2 : 1),
          borderRadius: BorderRadius.circular(CL.rCard),
          color: checked ? CL.actionTint : CL.bg,
        ),
        child: Row(
          children: [
            Container(
              width: 32, height: 32,
              decoration: BoxDecoration(
                color: checked ? CL.action : null,
                border: checked ? null : Border.all(color: CL.lineStrong, width: 2),
                borderRadius: BorderRadius.circular(8),
              ),
              child: checked ? const Icon(Icons.check, size: 20, color: Colors.white) : null,
            ),
            const SizedBox(width: CL.s4),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 19,
                  fontWeight: FontWeight.w600,
                  color: checked ? CL.text : CL.textSub,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
