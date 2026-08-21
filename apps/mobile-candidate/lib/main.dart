import 'package:flutter/material.dart';
import 'package:carelink_field_ui/carelink_field_ui.dart';
import 'core/app_state.dart';
import 'core/i18n/strings.dart';
import 'screens/applications_screen.dart';
import 'screens/documents_screen.dart';
import 'screens/home_screen.dart';
import 'screens/journey_screen.dart';
import 'screens/jobs_screen.dart';
import 'screens/login_screen.dart';
import 'screens/role_screen.dart';
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
              ? _Splash(state: widget.state)
              : widget.state.signedIn
                  // 역할이 없으면 SCR-003으로. 홈으로 바로 보내면 모든
                  // API가 403을 돌려주고, 신규 가입자의 첫인상이 오류
                  // 화면이 됩니다.
                  ? (widget.state.needsRole ? const RoleScreen() : const RootShell())
                  : const LoginScreen(),
        ),
      ),
    );
  }
}

/// SCR-001 스플래시. 토큰 상태를 확인하는 동안만 보입니다.
/// SCR-001 스플래시.
///
/// 시안대로 **파란 전면 + 하트 마크 96px + 케어링크 + 태그라인 + 점 세 개**.
/// 종전에는 파란 배경에 'CARELINK' 글자 하나였습니다. 앱을 여는 첫 순간이
/// 브랜드를 만나는 유일한 지점이라, 여기가 비면 나머지가 아무리 정돈돼도
/// 조립품처럼 보입니다.
class _Splash extends StatelessWidget {
  const _Splash({required this.state});

  final AppState state;

  @override
  Widget build(BuildContext context) => SplashView(
        title: tr('brand.name', state.locale),
        tagline: tr('splash.tagline', state.locale),
        status: 'v1.0.0 · ${tr('splash.checking', state.locale)}',
      );
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
