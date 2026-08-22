import 'dart:convert';

import 'package:carelink_field/core/app_state.dart';
import 'package:carelink_field/main.dart';
import 'package:carelink_field/shells/candidate_shell.dart';
import 'package:carelink_field/shells/caregiver_shell.dart';
import 'package:carelink_field/shells/guardian_shell.dart';
import 'package:carelink_field/shells/viewport.dart';
import 'package:carelink_field/screens/role_screen.dart';
import 'package:carelink_field_ui/carelink_field_ui.dart';
import 'package:flutter/material.dart' show Size;
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;

/// **역할이 셸을 정합니다.** 앱을 하나로 합치면서 생긴 규칙이고,
/// 이 테스트가 그 규칙의 유일한 방어선입니다.
///
/// 왜 필요했나: 보호자로 로그인했는데 '추천 일자리'가 보였습니다. 일자리는
/// 후보자 화면입니다. 보호자에게 채용 공고를 보여 주면 이 사람이 무엇을
/// 하는 서비스인지 자체가 흐려지고, 실제로 지원 버튼을 누릅니다.
///
/// 셸을 눈으로 확인하는 방식은 화면이 늘어나면 반드시 뚫립니다.

/// 지정한 역할만 돌려주는 가짜 서버. 실제 `AppState.refreshMe()` 경로를
/// 그대로 태웁니다 — 상태를 손으로 밀어 넣으면 정작 파싱이 틀려도 통과합니다.
http.Client _serverWithRoles(List<String> roles) {
  return _StubClient((req) {
    if (req.url.path.endsWith('/auth/me')) {
      return http.Response(
        jsonEncode({
          'id': 'u1',
          'phone': '01000000000',
          'locale': 'ko',
          'status': 'ACTIVE',
          'roles': [
            for (final r in roles)
              {'role': r, 'organizationId': null, 'isPrimary': true, 'approved': true},
          ],
        }),
        200,
        headers: {'content-type': 'application/json; charset=utf-8'},
      );
    }
    // 나머지 화면 데이터는 비워 둡니다. 셸이 무엇인지만 보면 됩니다.
    return http.Response('[]', 200, headers: {'content-type': 'application/json; charset=utf-8'});
  });
}

class _StubClient extends http.BaseClient {
  _StubClient(this.handler);
  final http.Response Function(http.BaseRequest) handler;

  @override
  Future<http.StreamedResponse> send(http.BaseRequest request) async {
    final res = handler(request);
    return http.StreamedResponse(
      Stream.value(res.bodyBytes), res.statusCode, headers: res.headers,
    );
  }
}

/// 토큰을 기기에 쓰지 않는 저장소. 테스트에 플랫폼 채널을 끌어들이지 않습니다.
class _MemoryStore implements SecureStore {
  final _m = <String, String>{};
  @override
  Future<String?> read({required String key}) async => _m[key];
  @override
  Future<void> write({required String key, required String? value}) async {
    if (value == null) { _m.remove(key); } else { _m[key] = value; }
  }
  @override
  Future<void> delete({required String key}) async => _m.remove(key);
}

Future<AppState> _bootedWith(WidgetTester tester, List<String> roles) async {
  final state = AppState(
    api: ApiClient(baseUrl: 'http://test/api/v1', inner: _serverWithRoles(roles)),
    storage: _MemoryStore(),
  );
  state.api.setTokens(access: 'a', refresh: 'r');
  await tester.pumpWidget(CarelinkApp(state: state));
  await tester.pumpAndSettle();
  return state;
}

void main() {
  group('역할이 셸을 정한다', () {
    testWidgets('보호자에게는 보호자 셸 — 일자리 탭이 없다', (t) async {
      await _bootedWith(t, ['PATIENT_FAMILY']);

      expect(find.byType(GuardianShell), findsOneWidget);
      expect(find.byType(CandidateShell), findsNothing);
      expect(find.byType(CaregiverShell), findsNothing);

      // 보호자에게 채용 공고를 보여 주면 이 서비스가 무엇인지 흐려집니다.
      expect(find.text('일자리'), findsNothing);
      expect(find.text('여정'), findsNothing);
      // 대신 보호자가 하는 일이 보입니다.
      expect(find.text('이용 내역'), findsOneWidget);
    });

    testWidgets('후보자에게는 후보자 셸 — 정산 탭이 없다', (t) async {
      await _bootedWith(t, ['CANDIDATE']);

      expect(find.byType(CandidateShell), findsOneWidget);
      expect(find.byType(GuardianShell), findsNothing);
      // 정산은 간병사 화면입니다. 아직 일하지 않는 사람에게 줄 것이 없습니다.
      expect(find.text('정산'), findsNothing);
      expect(find.text('일자리'), findsOneWidget);
    });

    testWidgets('간병사에게는 간병사 셸 — 일자리 탭이 없다', (t) async {
      await _bootedWith(t, ['CAREGIVER']);

      expect(find.byType(CaregiverShell), findsOneWidget);
      expect(find.byType(CandidateShell), findsNothing);
      expect(find.text('일자리'), findsNothing);
      // '오늘'은 탭 라벨과 홈 제목에 함께 나옵니다 — 개수를 세지 않습니다.
      expect(find.text('오늘'), findsWidgets);
    });

    testWidgets('앱에 화면이 없는 역할(기관·운영자)은 역할 선택으로 보낸다', (t) async {
      // 빈 홈을 띄우면 고장으로 읽힙니다. 기관·운영자 화면은 웹에 있습니다.
      await _bootedWith(t, ['ORG_MEMBER']);

      expect(find.byType(RoleScreen), findsOneWidget);
      expect(find.byType(CandidateShell), findsNothing);
      expect(find.byType(GuardianShell), findsNothing);
      expect(find.byType(CaregiverShell), findsNothing);
    });

    testWidgets('역할이 없으면 역할 선택 (SCR-003)', (t) async {
      await _bootedWith(t, const []);
      expect(find.byType(RoleScreen), findsOneWidget);
    });
  });

  group('역할이 둘일 때', () {
    testWidgets('첫 역할로 들어가고, 바꾸면 셸이 따라 바뀐다', (t) async {
      final state = await _bootedWith(t, ['CANDIDATE', 'CAREGIVER']);

      expect(find.byType(CandidateShell), findsOneWidget);
      expect(state.canSwitchRole, isTrue);

      await state.setActiveRole('CAREGIVER');
      await t.pumpAndSettle();

      expect(find.byType(CaregiverShell), findsOneWidget);
      expect(find.byType(CandidateShell), findsNothing);
    });

    testWidgets('역할이 하나면 전환 수단을 내보내지 않는다', (t) async {
      // 의미 없는 선택지는 그 자체로 '내가 뭘 잘못 골랐나'를 만듭니다.
      final state = await _bootedWith(t, ['PATIENT_FAMILY']);
      expect(state.canSwitchRole, isFalse);
    });

    testWidgets('보유하지 않은 역할로는 전환되지 않는다', (t) async {
      // 없는 역할의 화면을 열면 모든 API가 403을 돌려줍니다.
      final state = await _bootedWith(t, ['PATIENT_FAMILY']);
      await state.setActiveRole('CANDIDATE');
      await t.pumpAndSettle();

      expect(state.activeRole, 'PATIENT_FAMILY');
      expect(find.byType(GuardianShell), findsOneWidget);
    });

    testWidgets('역할이 회수되면 저장된 활성 역할을 버린다', (t) async {
      // 운영자가 간병사 역할을 회수했는데 기기에 남은 값으로 그 화면을
      // 계속 열면, 사용자는 오류만 가득한 화면을 봅니다.
      final store = _MemoryStore();
      await store.write(key: 'cl_active_role', value: 'CAREGIVER');

      final state = AppState(
        api: ApiClient(
          baseUrl: 'http://test/api/v1',
          inner: _serverWithRoles(['PATIENT_FAMILY']),
        ),
        storage: store,
      );
      state.api.setTokens(access: 'a', refresh: 'r');
      await t.pumpWidget(CarelinkApp(state: state));
      await t.pumpAndSettle();

      expect(state.activeRole, 'PATIENT_FAMILY');
      expect(find.byType(GuardianShell), findsOneWidget);
    });
  });

  _viewportTests();
}

/// 웹으로 열었을 때 폭 처리.

/// 웹으로 열었을 때 폭 처리.
///
/// FIELD 규격(16px 하한 · 48px 타깃)은 **한 손으로 쓰는 폰**을 전제로 정한
/// 값입니다. 데스크톱에서 2000px로 늘어나면 그 전제가 깨집니다 — 카드 한 장이
/// 화면을 가로질러 라벨과 값이 멀리 떨어지고, 하단 탭이 창 전체에 흩어집니다.
void _viewportTests() {
  group('폭', () {
    testWidgets('넓은 창에서는 폰 폭으로 가둔다', (t) async {
      t.view.physicalSize = const Size(2000, 1200);
      t.view.devicePixelRatio = 1.0;
      addTearDown(t.view.reset);

      await _bootedWith(t, ['PATIENT_FAMILY']);

      final shell = t.getSize(find.byType(GuardianShell));
      expect(shell.width, lessThanOrEqualTo(FieldViewport.maxWidth));
    });

    testWidgets('폰 폭에서는 아무것도 하지 않는다 — 전체를 씁니다', (t) async {
      t.view.physicalSize = const Size(390, 844);
      t.view.devicePixelRatio = 1.0;
      addTearDown(t.view.reset);

      await _bootedWith(t, ['PATIENT_FAMILY']);

      final shell = t.getSize(find.byType(GuardianShell));
      expect(shell.width, 390);
    });
  });
}
