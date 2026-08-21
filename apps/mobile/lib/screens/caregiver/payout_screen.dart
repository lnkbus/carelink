import 'package:carelink_field_ui/carelink_field_ui.dart';
import 'package:flutter/material.dart';
import '../../core/app_state.dart';

/// SCR-405 정산 — **V3. 화면만 있고 계산은 없습니다.**
///
/// 시안(design/CareLink 진입 + Caregiver App)의 하단 탭 4개에 '정산'이
/// 있어서 탭은 둡니다. 탭을 빼면 시안과 IA가 어긋나고, 나중에 넣을 때
/// 하단 탭 개수가 바뀌어 사용자가 익힌 위치가 전부 밀립니다.
///
/// **금액은 계산하지 않습니다** (CLAUDE.md §2 · §6-8). 간병사와의 법적
/// 관계(직접고용 / 위탁 / 순수중개)가 확정되기 전에는 세 경우의 정산 구조가
/// 서로 호환되지 않아 스키마조차 만들 수 없습니다.
///
/// 그래서 '준비 중'이라고만 쓰지 않고 **무엇이 정해져야 열리는지**를 씁니다 —
/// 그 말이 없으면 "언제 열리냐"는 문의가 그대로 옵니다.
class PayoutScreen extends StatelessWidget {
  const PayoutScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(app.t('tab.payout'), style: const TextStyle(fontSize: CLUp.title, fontWeight: FontWeight.w700)),
        backgroundColor: CL.bg,
      ),
      body: ListView(
        padding: const EdgeInsets.all(CL.s6),
        children: [
          StateNotice(tone: Tone.flag, message: app.t('payout.notOpen')),
          const SizedBox(height: CL.s5),
          FieldCard(
            child: Text(
              app.t('payout.notOpen.why'),
              style: const TextStyle(fontSize: CLUp.body, height: 1.6, color: CL.textSub),
            ),
          ),
        ],
      ),
    );
  }
}
