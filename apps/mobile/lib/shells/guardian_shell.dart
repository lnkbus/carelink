import 'package:carelink_field_ui/carelink_field_ui.dart';
import 'package:flutter/material.dart';
import '../core/app_state.dart';
import '../screens/guardian/history_screen.dart';
import '../screens/guardian/home_screen.dart';
import '../screens/guardian/me_screen.dart';

/// 보호자 하단 탭 3개 — 홈 · 이용 내역 · 내 정보.
///
/// 후보자(4개)·간병사(4개)보다 적습니다. 보호자가 이 앱에서 하는 일은
/// **신청 · 확인 · 지난 기록 조회** 셋이고, 탭을 늘리면 급한 사람이
/// 어디를 눌러야 할지 한 번 더 생각하게 됩니다.
///
/// 이 화면들은 종전에 별도 반응형 웹(:3400)이었습니다. 웹으로 둔 이유는
/// '보호자는 설치 의사가 낮고 대개 병원에서 링크로 들어온다'였는데
/// (SCR-301 notes), 이 앱은 웹으로도 빌드되므로 그 경로는 그대로 살아
/// 있습니다 — 링크로 들어오는 사람은 여전히 링크로 들어옵니다.
class GuardianShell extends StatefulWidget {
  const GuardianShell({super.key});

  @override
  State<GuardianShell> createState() => _GuardianShellState();
}

class _GuardianShellState extends State<GuardianShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);

    return Scaffold(
      // IndexedStack — 탭을 오갈 때마다 다시 불러오면 매번 로딩을 봅니다.
      body: IndexedStack(
        index: _index,
        children: const [
          GuardianHomeScreen(),
          HistoryScreen(),
          GuardianMeScreen(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        // 라벨은 러시아어에서 2.5배까지 늘어납니다. 높이를 넉넉히 둡니다.
        height: 76,
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.home_outlined, size: CLUp.icon),
            selectedIcon: const Icon(Icons.home, size: CLUp.icon),
            label: app.t('home.title'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.receipt_long_outlined, size: CLUp.icon),
            selectedIcon: const Icon(Icons.receipt_long, size: CLUp.icon),
            label: app.t('guardian.history.title'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.person_outline, size: CLUp.icon),
            selectedIcon: const Icon(Icons.person, size: CLUp.icon),
            label: app.t('guardian.me.title'),
          ),
        ],
      ),
    );
  }
}
