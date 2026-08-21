import 'package:flutter/material.dart';
import '../core/app_state.dart';
import 'package:carelink_field_ui/carelink_field_ui.dart';
/// SCR-103 커리어 트랙.
///
/// **트랙은 ENUM이 아니라 테이블입니다** (§5.8). 화면은 하나이고 데이터만
/// 다릅니다 — 농업·미용·요리 같은 신규 산업은 `tracks` 행 추가로 열리고,
/// 이 화면은 코드 배포 없이 그대로 씁니다.
///
/// 그래서 여기에 트랙 코드를 하드코딩한 분기가 없습니다.
class TrackScreen extends StatefulWidget {
  const TrackScreen({super.key});

  @override
  State<TrackScreen> createState() => _TrackScreenState();
}

class _TrackScreenState extends State<TrackScreen> {
  List<Map<String, dynamic>> _tracks = const [];
  Set<String> _selected = {};
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
      final tracks = (await app.api.get('/tracks') as List<dynamic>)
          .cast<Map<String, dynamic>>();
      final me = await app.api.get('/candidates/me') as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        _tracks = tracks;
        _selected = ((me['tracks'] as List<dynamic>? ?? [])
                .map((t) => (t as Map<String, dynamic>)['trackId'] as String))
            .toSet();
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() { _error = '$e'; _loading = false; });
    }
  }

  Future<void> _select(String trackId) async {
    final app = AppScope.of(context);
    await app.api.post('/candidates/me/tracks', {'trackId': trackId, 'isPrimary': _selected.isEmpty});
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(app.t('track.title'))),
      body: _loading
          ? Center(child: Text(app.t('common.loading'), style: const TextStyle(fontSize: CL.body)))
          : _error != null
              ? StateNotice(
                  message: _error!,
                  tone: Tone.alert,
                  action: SecondaryButton(label: app.t('common.retry'), onPressed: _load),
                )
              : ListView.separated(
                  padding: const EdgeInsets.all(CL.s6),
                  itemCount: _tracks.length,
                  separatorBuilder: (_, __) => const SizedBox(height: CL.s4),
                  itemBuilder: (context, i) {
                    final t = _tracks[i];
                    final id = t['id'] as String;
                    final chosen = _selected.contains(id);
                    return FieldCard(
                      tone: chosen ? Tone.action : null,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  t['labelKo'] as String? ?? '',
                                  style: const TextStyle(fontSize: CL.subtitle, fontWeight: FontWeight.w700),
                                ),
                              ),
                              if (chosen)
                                StatusPill(tone: Tone.signal, label: app.t('track.selected')),
                            ],
                          ),
                          if (t['description'] != null) ...[
                            const SizedBox(height: CL.s3),
                            Text(
                              t['description'] as String,
                              style: const TextStyle(fontSize: CL.body, color: CL.textSub, height: 1.5),
                            ),
                          ],
                          if (!chosen) ...[
                            const SizedBox(height: CL.s5),
                            PrimaryButton(
                              label: app.t('track.select'),
                              onPressed: () => _select(id),
                            ),
                          ],
                        ],
                      ),
                    );
                  },
                ),
    );
  }
}
