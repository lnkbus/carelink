import 'package:carelink_field_ui/carelink_field_ui.dart';
import 'package:flutter/material.dart';
import 'core/app_state.dart';
import 'core/i18n/strings.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';
import 'screens/role_screen.dart';
import 'screens/payout_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/schedule_screen.dart';

/// CARELINK 간병사 앱 (SCR-401~404).
///
/// 후보자 앱과 별도 앱인 이유는 사용 맥락이 다르기 때문입니다. 후보자는
/// 집에서 천천히 서류를 올리고, 간병사는 **병원 복도에서 한 손으로 몇 초 안에**
/// 씁니다. 화면 수도 4개뿐입니다 — 홈에 오늘 할 일 하나와 큰 버튼 하나만
/// 보이고 나머지는 전부 하위 화면입니다 (SCR-401 notes).
void main() {
  const base = String.fromEnvironment('CARELINK_API_URL',
      defaultValue: 'http://127.0.0.1:3000/api/v1');
  final state = AppState(api: ApiClient(baseUrl: base));
  runApp(CaregiverApp(state: state));
}

class CaregiverApp extends StatefulWidget {
  const CaregiverApp({super.key, required this.state});
  final AppState state;

  @override
  State<CaregiverApp> createState() => _CaregiverAppState();
}

class _CaregiverAppState extends State<CaregiverApp> {
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
        builder: (context, _) {
          return MaterialApp(
            title: tr('app.name', widget.state.locale),
            debugShowCheckedModeBanner: false,
            locale: widget.state.locale.flutterLocale,
            theme: ThemeData(
              useMaterial3: true,
              scaffoldBackgroundColor: CL.bg,
              colorScheme: ColorScheme.fromSeed(seedColor: CL.action),
              // 본문 기본 **18px**. 40~65세가 병실 앞에서 한 손으로 봅니다 —
              // 후보자 앱(16px)보다 한 단계 위입니다 (design/README §타이포).
              textTheme: const TextTheme(
                bodyMedium: TextStyle(fontSize: CLUp.body, color: CL.text),
                bodyLarge: TextStyle(fontSize: CLUp.body, color: CL.text),
              ),
            ),
            home: !widget.state.ready
                ? const _Splash()
                : widget.state.signedIn
                    // 역할이 없으면 SCR-003으로. 홈으로 바로 보내면 모든
                    // API가 403을 돌려주고, 신규 가입자의 첫인상이 오류
                    // 화면이 됩니다.
                    ? (widget.state.needsRole ? const RoleScreen() : const CaregiverShell())
                    : const LoginScreen(),
          );
        },
      ),
    );
  }
}

/// 하단 탭 4개 (시안 SCR-401~405 공통 하단바).
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

class _Splash extends StatelessWidget {
  const _Splash();

  @override
  Widget build(BuildContext context) =>
      const Scaffold(body: Center(child: CircularProgressIndicator()));
}
