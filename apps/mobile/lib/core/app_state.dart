import 'dart:convert';

import 'package:flutter/widgets.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:carelink_field_ui/carelink_field_ui.dart';
import 'i18n/strings.dart';

/// 앱 전역 상태.
///
/// 상태 관리 패키지를 넣지 않았습니다. 배우는 비용이 더 크고, 여기서 관리할
/// 것은 세션·로케일·활성 역할 셋뿐입니다.
///
/// 토큰은 `flutter_secure_storage`에만 둡니다 — SharedPreferences는 평문이라
/// 루팅된 기기에서 그대로 읽힙니다. 이 토큰 하나로 후보자 본인의 실명·연락처·
/// 체류자격이 열리고, 간병사에게는 배정된 병실과 근무 기록이 열립니다.
/// 근무 기록은 정산 분쟁의 유일한 근거입니다 (docs/11 §5).
class AppState extends ChangeNotifier {
  AppState({required this.api, SecureStore? storage})
      : _storage = storage ?? const _DeviceStore();

  final ApiClient api;
  final SecureStore _storage;

  static const _kAccess = 'cl_access';
  static const _kRefresh = 'cl_refresh';
  static const _kLocale = 'cl_locale';
  static const _kRole = 'cl_active_role';

  AppLocale _locale = AppLocale.ko;
  AppLocale get locale => _locale;

  bool _ready = false;
  bool get ready => _ready;

  bool get signedIn => api.hasSession;

  /// 보유 역할. 비어 있으면 **SCR-003 역할 선택**으로 보냅니다.
  ///
  /// 종전에는 이 값을 보지 않고 바로 홈으로 보냈습니다. 그래서 처음
  /// 가입한 사람은 모든 API가 403을 돌려주는 화면을 만났습니다 —
  /// 오류가 가득한 홈이 첫인상이었습니다.
  List<String> _roles = const [];
  List<String> get roles => _roles;
  bool get needsRole => signedIn && _roles.isEmpty;

  /// 로그인한 번호. SCR-003 상단에 띄웁니다.
  String? _phone;
  String? get phone => _phone;

  // ── 활성 역할 ────────────────────────────────────────────────────────
  //
  // 앱이 셋으로 나뉘어 있을 때는 '설치한 앱'이 곧 역할이었습니다. 하나로
  // 합치면 그 단서가 없어지므로 여기서 들고 있습니다.
  //
  // 한 계정이 역할을 여러 개 갖는 것은 예외가 아니라 흔한 경우입니다 —
  // 요양보호사 자격을 딴 후보자가 간병사로 일을 시작하고, 그러면서도
  // 자기 서류 만료일은 계속 봐야 합니다. 그래서 '고른 역할 하나'를
  // 기억하되 언제든 바꿀 수 있게 둡니다.
  static const _fieldRoles = ['CANDIDATE', 'CAREGIVER', 'PATIENT_FAMILY'];

  /// 이 앱이 화면을 가진 역할만. 기관·운영자 역할을 겸한 계정이 들어와도
  /// 여기서는 앱이 아는 역할만 셉니다 (그쪽 화면은 웹에 있습니다).
  List<String> get fieldRoles => _roles.where(_fieldRoles.contains).toList();

  String? _activeRole;

  /// 지금 보고 있는 역할. 저장된 값이 더 이상 유효하지 않으면
  /// (운영자가 역할을 회수한 경우) 보유한 역할 중 첫 번째로 되돌립니다 —
  /// 없는 역할의 화면을 열면 모든 API가 403을 돌려줍니다.
  String? get activeRole {
    final held = fieldRoles;
    if (held.isEmpty) return null;
    if (_activeRole != null && held.contains(_activeRole)) return _activeRole;
    return held.first;
  }

  /// 역할을 둘 이상 가진 계정에만 전환 수단을 보여 줍니다. 하나뿐인
  /// 사용자에게 전환 버튼을 띄우면 '내가 뭘 잘못 골랐나' 하고 누릅니다.
  bool get canSwitchRole => fieldRoles.length > 1;

  Future<void> setActiveRole(String role) async {
    if (!fieldRoles.contains(role)) return;
    _activeRole = role;
    await _storage.write(key: _kRole, value: role);
    notifyListeners();
  }

  /// `/auth/me`로 역할을 새로 읽습니다. 실패하면 기존 값을 유지합니다 —
  /// 네트워크 한 번 끊겼다고 역할 선택 화면으로 되돌리면 안 됩니다.
  Future<void> refreshMe() async {
    try {
      final me = await api.get('/auth/me') as Map<String, dynamic>;
      _roles = ((me['roles'] as List?) ?? const [])
          .map((r) => (r as Map<String, dynamic>)['role'] as String)
          .toList();
      _phone = me['phone'] as String?;
      notifyListeners();
    } catch (_) {
      // 무시. 화면은 지금 아는 값으로 그립니다.
    }
  }

  /// 역할을 부여하고 즉시 반영합니다.
  Future<void> chooseRole(String role) async {
    await api.post('/auth/roles', {'role': role, 'makePrimary': true});
    // 토큰에 역할이 박혀 있으므로 재발급해야 권한이 붙습니다.
    await api.refreshSession();
    await persistTokens();
    await refreshMe();
  }

  String? _candidateId;
  String? get candidateId => _candidateId;

  String? _caregiverId;
  String? get caregiverId => _caregiverId;

  Future<void> boot() async {
    final access = await _storage.read(key: _kAccess);
    final refresh = await _storage.read(key: _kRefresh);
    final savedLocale = await _storage.read(key: _kLocale);
    _activeRole = await _storage.read(key: _kRole);

    if (savedLocale != null) {
      _locale = AppLocale.values.firstWhere(
        (l) => l.code == savedLocale,
        orElse: () => AppLocale.ko,
      );
    }
    if (access != null && refresh != null) {
      api.setTokens(access: access, refresh: refresh);
    }
    api.onSessionExpired = signOut;
    // 저장된 토큰으로 들어온 경우에도 역할을 확인합니다.
    if (api.hasSession) {
      await refreshMe();
      // 지난번에 못 보낸 기록을 먼저 보냅니다. 실패해도 큐에 남습니다.
      await flushLogQueue();
    }
    _ready = true;
    notifyListeners();
  }

  Future<void> setLocale(AppLocale next) async {
    _locale = next;
    await _storage.write(key: _kLocale, value: next.code);
    notifyListeners();
  }

  Future<void> signIn({required String access, required String refresh}) async {
    api.setTokens(access: access, refresh: refresh);
    await _storage.write(key: _kAccess, value: access);
    await _storage.write(key: _kRefresh, value: refresh);
    // 역할을 먼저 읽습니다 — 없으면 SCR-003으로 가야 하고,
    // 그 판단을 홈에 도착한 뒤에 하면 오류 화면이 한 번 스칩니다.
    await refreshMe();
    notifyListeners();
  }

  /// 세션 갱신 후 토큰을 다시 저장합니다.
  Future<void> persistTokens() async {
    final a = api.accessToken, r = api.refreshToken;
    if (a != null) await _storage.write(key: _kAccess, value: a);
    if (r != null) await _storage.write(key: _kRefresh, value: r);
  }

  Future<void> signOut() async {
    _roles = const [];
    _phone = null;
    // 기기에서 지우기 **전에** 서버 토큰을 폐기합니다. 순서를 바꾸면
    // 폐기에 쓸 토큰이 이미 없습니다.
    await api.revokeSession();
    api.clear();
    _candidateId = null;
    _caregiverId = null;
    _activeRole = null;
    await _storage.delete(key: _kRole);
    await _storage.delete(key: _kAccess);
    await _storage.delete(key: _kRefresh);
    notifyListeners();
  }

  void rememberCandidateId(String id) {
    _candidateId = id;
  }

  void rememberCaregiverId(String id) {
    _caregiverId = id;
  }

  // ── 오프라인 큐 ──────────────────────────────────────────────────────
  //
  // 병실은 신호가 약합니다. 저장이 실패한 기록을 **기기에** 넣어 두고
  // 앱을 다시 열 때 보냅니다.
  //
  // 큐를 서버에 두지 않은 이유: 서버에 못 닿는 상황이 문제입니다.
  // 해결책이 서버에 있으면 아무것도 해결하지 못합니다.
  static const _kQueue = 'cl_log_queue';

  /// 기록을 큐에 넣습니다. 화면은 '저장했다'고 말합니다 — 실패했다고 하면
  /// 사용자는 같은 것을 다시 입력하고, 그러면 중복이 쌓입니다.
  Future<void> queueLogs(String assignmentId, List<Map<String, dynamic>> entries) async {
    final raw = await _storage.read(key: _kQueue);
    final list = raw == null ? <dynamic>[] : jsonDecode(raw) as List<dynamic>;
    for (final e in entries) {
      list.add({'assignmentId': assignmentId, 'body': e});
    }
    await _storage.write(key: _kQueue, value: jsonEncode(list));
    notifyListeners();
  }

  /// 큐에 남은 건수. 화면에 띄워 '아직 안 갔다'를 알립니다.
  Future<int> pendingLogCount() async {
    final raw = await _storage.read(key: _kQueue);
    if (raw == null) return 0;
    return (jsonDecode(raw) as List<dynamic>).length;
  }

  /// 큐를 비웁니다. **한 건씩 보내고 성공한 것만 제거합니다** —
  /// 통째로 보내고 통째로 지우면 중간에 끊겼을 때 전부 잃습니다.
  Future<void> flushLogQueue() async {
    final raw = await _storage.read(key: _kQueue);
    if (raw == null) return;
    final list = (jsonDecode(raw) as List<dynamic>).toList();
    final left = <dynamic>[];
    for (final item in list) {
      final m = item as Map<String, dynamic>;
      try {
        await api.post('/care-assignments/${m['assignmentId']}/logs', m['body']);
      } catch (_) {
        left.add(item);
      }
    }
    if (left.isEmpty) {
      await _storage.delete(key: _kQueue);
    } else {
      await _storage.write(key: _kQueue, value: jsonEncode(left));
    }
    notifyListeners();
  }

  String t(String key) => tr(key, _locale);
}

/// 토큰 저장소.
///
/// `FlutterSecureStorage`를 직접 들고 있으면 상태를 테스트할 수 없습니다 —
/// 플랫폼 채널이 필요해서 위젯 테스트가 통째로 못 뜹니다. 그래서 얇게
/// 한 겹 둡니다. **구현은 여전히 시큐어 스토리지 하나뿐입니다** —
/// SharedPreferences는 평문이라 루팅된 기기에서 그대로 읽힙니다.
abstract class SecureStore {
  Future<String?> read({required String key});
  Future<void> write({required String key, required String? value});
  Future<void> delete({required String key});
}

class _DeviceStore implements SecureStore {
  const _DeviceStore();
  static const _inner = FlutterSecureStorage();

  @override
  Future<String?> read({required String key}) => _inner.read(key: key);
  @override
  Future<void> write({required String key, required String? value}) =>
      _inner.write(key: key, value: value);
  @override
  Future<void> delete({required String key}) => _inner.delete(key: key);
}

/// 화면들이 상태와 문구에 접근하는 통로.
class AppScope extends InheritedNotifier<AppState> {
  const AppScope({super.key, required AppState state, required super.child})
      : super(notifier: state);

  static AppState of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AppScope>();
    assert(scope != null, 'AppScope가 위젯 트리에 없습니다');
    return scope!.notifier!;
  }
}
