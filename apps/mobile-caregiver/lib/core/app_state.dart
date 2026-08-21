import 'package:flutter/widgets.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:carelink_field_ui/carelink_field_ui.dart';
import 'i18n/strings.dart';

/// 앱 전역 상태.
///
/// 상태 관리 패키지를 넣지 않았습니다. 화면 4개에 얹으면 배우는 비용이 더 크고,
/// 여기서 관리할 것은 세션·로케일 둘뿐입니다.
///
/// 토큰은 `flutter_secure_storage`에만 둡니다 — SharedPreferences는 평문이라
/// 루팅된 기기에서 그대로 읽힙니다. 이 토큰 하나로 배정된 병실과 근무 기록이
/// 열리고, 근무 기록은 정산 분쟁의 근거입니다 (docs/11 §5).
class AppState extends ChangeNotifier {
  AppState({required this.api, FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  final ApiClient api;
  final FlutterSecureStorage _storage;

  static const _kAccess = 'cl_access';
  static const _kRefresh = 'cl_refresh';
  static const _kLocale = 'cl_locale';

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

  String? _caregiverId;
  String? get caregiverId => _caregiverId;

  Future<void> boot() async {
    final access = await _storage.read(key: _kAccess);
    final refresh = await _storage.read(key: _kRefresh);
    final savedLocale = await _storage.read(key: _kLocale);

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
    if (api.hasSession) await refreshMe();
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
    _caregiverId = null;
    await _storage.delete(key: _kAccess);
    await _storage.delete(key: _kRefresh);
    notifyListeners();
  }

  void rememberCaregiverId(String id) {
    _caregiverId = id;
  }

  String t(String key) => tr(key, _locale);
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
