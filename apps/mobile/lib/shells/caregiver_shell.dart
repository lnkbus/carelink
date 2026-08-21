import 'package:carelink_field_ui/carelink_field_ui.dart';
import 'package:flutter/material.dart';
import '../core/app_state.dart';
import '../screens/caregiver/home_screen.dart';
import '../screens/caregiver/payout_screen.dart';
import '../screens/caregiver/profile_screen.dart';
import '../screens/caregiver/schedule_screen.dart';

/// 간병사 하단 탭 4개 (시안 SCR-401~405 공통 하단바).
///
/// 간병사는 **병원 복도에서 한 손으로 몇 초 안에** 씁니다. 홈에 오늘 할 일
/// 하나와 큰 버튼 하나만 보이고 나머지는 전부 하위 화면입니다 (SCR-401 notes).
/// 그래서 본문 글꼴이 후보자(16px)보다 한 단계 위인 18px입니다.
///
/// IndexedStack을 쓰는 이유: 탭을 오갈 때마다 다시 불러오면 병실 앞에서
/// 매번 로딩을 봅니다. 상태를 살려 둡니다.
class CaregiverShell extends StatefulWidget {
  const CaregiverShell({super.key});

  @override
  State<CaregiverShell> createState() => _CaregiverShellState();
}

class _CaregiverShellState extends State<CaregiverShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);

    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: const [
          HomeScreen(),
          ScheduleScreen(embedded: true),
          PayoutScreen(),
          ProfileScreen(embedded: true),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        // 라벨은 러시아어에서 2.5배까지 늘어납니다. 높이를 넉넉히 둡니다.
        height: 76,
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.today_outlined, size: CLUp.icon),
            selectedIcon: const Icon(Icons.today, size: CLUp.icon),
            label: app.t('tab.today'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.calendar_month_outlined, size: CLUp.icon),
            selectedIcon: const Icon(Icons.calendar_month, size: CLUp.icon),
            label: app.t('tab.schedule'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.payments_outlined, size: CLUp.icon),
            selectedIcon: const Icon(Icons.payments, size: CLUp.icon),
            label: app.t('tab.payout'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.person_outline, size: CLUp.icon),
            selectedIcon: const Icon(Icons.person, size: CLUp.icon),
            label: app.t('tab.profile'),
          ),
        ],
      ),
    );
  }
}
