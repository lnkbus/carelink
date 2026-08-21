import 'package:flutter/material.dart';
import '../core/app_state.dart';
import '../screens/candidate/applications_screen.dart';
import '../screens/candidate/documents_screen.dart';
import '../screens/candidate/home_screen.dart';
import '../screens/candidate/jobs_screen.dart';
import '../screens/candidate/journey_screen.dart';
import '../screens/candidate/settings_screen.dart';
import '../screens/candidate/track_screen.dart';

/// 하단 탭 4개 (design/README §Candidate App 101).
///
/// 탭을 5개 이상 두지 않습니다 — FIELD에서 한 화면 한 과업이 원칙이고,
/// 탭이 늘어나면 홈의 next_action 카드가 여러 입구 중 하나로 격하됩니다.
class CandidateShell extends StatefulWidget {
  const CandidateShell({super.key});

  @override
  State<CandidateShell> createState() => _CandidateShellState();
}

class _CandidateShellState extends State<CandidateShell> {
  int _index = 0;

  void _goToScreen(String screenId) {
    // next_action이 가리키는 화면으로 이동합니다.
    switch (screenId) {
      case 'SCR-102':
        setState(() => _index = 1);
      case 'SCR-103':
        Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const TrackScreen()));
      case 'SCR-105':
        Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const DocumentsScreen()));
      case 'SCR-104':
        setState(() => _index = 3);
      case 'SCR-107' || 'SCR-108':
        setState(() => _index = 2);
      case 'SCR-109':
        Navigator.of(context)
            .push(MaterialPageRoute<void>(builder: (_) => const ApplicationsScreen()));
      default:
        setState(() => _index = 2);
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    // 시안(design/CareLink Candidate App)의 하단 탭은 **홈 · 여정 · 일자리 ·
    // 내 정보**입니다. 지원 현황(SCR-109)이 여정 자리를 차지하고 있었고,
    // 여정은 홈에서 눌러 들어가는 하위 화면이었습니다.
    //
    // 여정이 탭이어야 하는 이유: 이 앱의 사용자는 '지금 내가 어디까지 왔나'를
    // 가장 자주 확인합니다 (SCR-102). 지원 현황은 여정의 첫 단계일 뿐이라
    // 여정 화면 안에서 열립니다.
    final pages = [
      HomeScreen(onNavigate: _goToScreen),
      const JourneyScreen(),
      const JobsScreen(),
      const SettingsScreen(),
    ];

    return Scaffold(
      body: IndexedStack(index: _index, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        // 라벨은 러시아어에서 2.5배까지 늘어납니다. 높이를 넉넉히 둡니다.
        height: 72,
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.home_outlined, size: 26),
            selectedIcon: const Icon(Icons.home, size: 26),
            label: app.t('home.title'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.timeline_outlined, size: 26),
            selectedIcon: const Icon(Icons.timeline, size: 26),
            label: app.t('journey.title'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.work_outline, size: 26),
            selectedIcon: const Icon(Icons.work, size: 26),
            label: app.t('jobs.title'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.person_outline, size: 26),
            selectedIcon: const Icon(Icons.person, size: 26),
            label: app.t('settings.title'),
          ),
        ],
      ),
    );
  }
}
