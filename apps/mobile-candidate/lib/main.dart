import 'package:flutter/material.dart';
import 'package:carelink_field_ui/carelink_field_ui.dart';
import 'core/i18n/strings.dart';
import 'core/app_state.dart';
import 'screens/applications_screen.dart';
import 'screens/documents_screen.dart';
import 'screens/home_screen.dart';
import 'screens/journey_screen.dart';
import 'screens/jobs_screen.dart';
import 'screens/login_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/track_screen.dart';

/// API 주소는 빌드 시점에 주입합니다.
///   flutter run --dart-define=CARELINK_API_URL=http://10.0.2.2:3000/api/v1
///
/// 안드로이드 에뮬레이터에서 호스트는 `10.0.2.2`입니다. `localhost`를 기본값으로
/// 두면 에뮬레이터에서 조용히 실패합니다.
const _apiUrl = String.fromEnvironment(
  'CARELINK_API_URL',
  defaultValue: 'http://10.0.2.2:3000/api/v1',
);

void main() {
  final api = ApiClient(baseUrl: _apiUrl);
  final state = AppState(api: api);
  runApp(CarelinkApp(state: state));
}

class CarelinkApp extends StatefulWidget {
  const CarelinkApp({super.key, required this.state});

  final AppState state;

  @override
  State<CarelinkApp> createState() => _CarelinkAppState();
}

class _CarelinkAppState extends State<CarelinkApp> {
  @override
  void initState() {
    super.initState();
    widget.state.boot();
  }

  @override
  Widget build(BuildContext context) {
    return AppScope(
      state: widget.state,
      child: AnimatedBuilder(
        animation: widget.state,
        builder: (context, _) => MaterialApp(
          title: 'CARELINK',
          theme: buildFieldTheme(),
          debugShowCheckedModeBanner: false,
          locale: widget.state.locale.flutterLocale,
          // 시스템 글꼴 확대 설정을 존중하되, 레이아웃이 깨지는 배율은 막습니다.
          // 최소 배율을 1.0으로 두어 축소는 허용하지 않습니다 — 16px 아래로
          // 내려가면 이 앱의 사용자에게는 없는 텍스트가 됩니다.
          builder: (context, child) => MediaQuery.withClampedTextScaling(
            minScaleFactor: 1.0,
            maxScaleFactor: 1.6,
            child: child ?? const SizedBox.shrink(),
          ),
          home: !widget.state.ready
              ? const _Splash()
              : widget.state.signedIn
                  ? const RootShell()
                  : const LoginScreen(),
        ),
      ),
    );
  }
}

/// SCR-001 스플래시. 토큰 상태를 확인하는 동안만 보입니다.
class _Splash extends StatelessWidget {
  const _Splash();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: CL.actionStrong,
      body: Center(
        child: Text(
          'CARELINK',
          style: TextStyle(
            color: Colors.white, fontSize: CL.title,
            fontWeight: FontWeight.w700, letterSpacing: 5,
          ),
        ),
      ),
    );
  }
}

/// 하단 탭 4개 (design/README §Candidate App 101).
///
/// 탭을 5개 이상 두지 않습니다 — FIELD에서 한 화면 한 과업이 원칙이고,
/// 탭이 늘어나면 홈의 next_action 카드가 여러 입구 중 하나로 격하됩니다.
class RootShell extends StatefulWidget {
  const RootShell({super.key});

  @override
  State<RootShell> createState() => _RootShellState();
}

class _RootShellState extends State<RootShell> {
  int _index = 0;

  void _goToScreen(String screenId) {
    // next_action이 가리키는 화면으로 이동합니다.
    switch (screenId) {
      case 'SCR-102':
        Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const JourneyScreen()));
      case 'SCR-103':
        Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const TrackScreen()));
      case 'SCR-105':
        Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const DocumentsScreen()));
      case 'SCR-104':
        setState(() => _index = 3);
      case 'SCR-107' || 'SCR-108':
        setState(() => _index = 1);
      default:
        setState(() => _index = 1);
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final pages = [
      HomeScreen(onNavigate: _goToScreen),
      const JobsScreen(),
      const ApplicationsScreen(),
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
            icon: const Icon(Icons.work_outline, size: 26),
            selectedIcon: const Icon(Icons.work, size: 26),
            label: app.t('jobs.title'),
          ),
          NavigationDestination(
            icon: const Icon(Icons.assignment_outlined, size: 26),
            selectedIcon: const Icon(Icons.assignment, size: 26),
            label: app.t('applications.title'),
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
