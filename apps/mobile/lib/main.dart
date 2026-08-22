import 'package:carelink_field_ui/carelink_field_ui.dart';
import 'package:flutter/material.dart';
import 'core/app_state.dart';
import 'core/i18n/strings.dart';
import 'screens/login_screen.dart';
import 'screens/role_screen.dart';
import 'shells/candidate_shell.dart';
import 'shells/caregiver_shell.dart';
import 'shells/guardian_shell.dart';
import 'shells/viewport.dart';

/// CARELINK FIELD 앱 — 후보자 · 간병사 · 보호자.
///
/// 앱을 셋으로 나눠 두었던 이유는 사용 맥락이 다르기 때문이었습니다. 후보자는
/// 집에서 천천히 서류를 올리고, 간병사는 병실 앞에서 몇 초 안에 씁니다.
/// 그 차이는 여전히 유효하지만, **앱을 나누는 것으로 풀 문제가 아니었습니다.**
///
/// 한 계정이 역할을 여러 개 갖는 것은 예외가 아니라 흔한 경우입니다 —
/// 요양보호사 자격을 딴 후보자가 간병사로 일을 시작하고, 그러면서도 자기
/// 서류 만료일은 계속 봐야 합니다 (docs/08). 앱이 갈라져 있으면 그 사람은
/// 스토어에서 다른 앱을 찾아 설치해야 하고, 실제로는 다시 가입합니다.
/// 계정이 둘로 갈라지면 경력도 서류도 이어지지 않습니다.
///
/// 그래서 앱은 하나이고, **역할이 셸을 정합니다.** 맥락 차이는 셸 안에서
/// 다룹니다 — 간병사·보호자 화면은 CLUp(18px) 스케일을, 후보자 화면은
/// CL(16px)을 씁니다.
///
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
          title: tr('app.name', widget.state.locale),
          theme: buildFieldTheme(),
          debugShowCheckedModeBanner: false,
          locale: widget.state.locale.flutterLocale,
          // 시스템 글꼴 확대 설정을 존중하되, 레이아웃이 깨지는 배율은 막습니다.
          // 최소 배율을 1.0으로 두어 축소는 허용하지 않습니다 — 16px 아래로
          // 내려가면 이 앱의 사용자에게는 없는 텍스트가 됩니다.
          builder: (context, child) => MediaQuery.withClampedTextScaling(
            minScaleFactor: 1.0,
            maxScaleFactor: 1.6,
            // 넓은 창에서는 폰 폭으로 가둡니다. FIELD 규격은 한 손으로 쓰는
            // 폰을 전제로 정한 값이라, 2000px로 늘리면 규격이 아니라 그냥
            // 큰 글씨가 됩니다 (shells/viewport.dart).
            child: FieldViewport(child: child ?? const SizedBox.shrink()),
          ),
          home: _home(widget.state),
        ),
      ),
    );
  }

  /// 무엇을 띄울지.
  ///
  /// 순서가 중요합니다. 역할이 없는데 홈으로 보내면 모든 API가 403을 돌려주고,
  /// 신규 가입자의 첫인상이 오류 화면이 됩니다 (실제로 그랬습니다).
  Widget _home(AppState state) {
    if (!state.ready) return _Splash(state: state);
    if (!state.signedIn) return const LoginScreen();
    if (state.needsRole) return const RoleScreen();

    return switch (state.activeRole) {
      'CAREGIVER' => const CaregiverShell(),
      'PATIENT_FAMILY' => const GuardianShell(),
      'CANDIDATE' => const CandidateShell(),
      // 이 앱이 화면을 가진 역할이 하나도 없는 계정 — 기관 담당자나 운영자가
      // 앱으로 로그인한 경우입니다. 빈 홈을 띄우면 고장으로 읽히므로
      // 역할 선택으로 보냅니다. 거기서 무엇을 하러 왔는지 고르면 됩니다.
      _ => const RoleScreen(),
    };
  }
}

/// SCR-001 스플래시. 토큰 상태를 확인하는 동안만 보입니다.
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
