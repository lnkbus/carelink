import 'package:carelink_field_ui/carelink_field_ui.dart';
import 'package:flutter/material.dart';
import 'core/app_state.dart';
import 'core/i18n/strings.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';

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
              // 본문 기본 16px. 고령·저숙련 사용자가 다수입니다 (SCR-401 notes).
              textTheme: const TextTheme(
                bodyMedium: TextStyle(fontSize: CL.body, color: CL.text),
              ),
            ),
            home: !widget.state.ready
                ? const _Splash()
                : widget.state.signedIn
                    ? const HomeScreen()
                    : const LoginScreen(),
          );
        },
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
