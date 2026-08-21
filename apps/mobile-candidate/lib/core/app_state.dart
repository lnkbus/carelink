import 'package:flutter/widgets.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:carelink_field_ui/carelink_field_ui.dart';
import 'i18n/strings.dart';

/// 앱 전역 상태.
///
/// 상태 관리 패키지를 넣지 않았습니다. 화면 10개에 얹으면 배우는 비용이 더 크고,
/// 여기서 관리할 것은 세션·로케일 둘뿐입니다.
///
/// 토큰은 `flutter_secure_storage`에만 둡니다 — SharedPreferences는 평문이라
/// 루팅된 기기에서 그대로 읽힙니다. 이 토큰 하나로 후보자 본인의 실명·연락처·
/// 체류자격이 전부 열립니다 (docs/11 §5).
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

  String? _candidateId;
  String? get candidateId => _candidateId;

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
    notifyListeners();
  }

  /// 세션 갱신 후 토큰을 다시 저장합니다.
  Future<void> persistTokens() async {
    final a = api.accessToken, r = api.refreshToken;
    if (a != null) await _storage.write(key: _kAccess, value: a);
    if (r != null) await _storage.write(key: _kRefresh, value: r);
  }

  Future<void> signOut() async {
    // 기기에서 지우기 **전에** 서버 토큰을 폐기합니다. 순서를 바꾸면
    // 폐기에 쓸 토큰이 이미 없습니다.
    await api.revokeSession();
    api.clear();
    _candidateId = null;
    await _storage.delete(key: _kAccess);
    await _storage.delete(key: _kRefresh);
    notifyListeners();
  }

  void rememberCandidateId(String id) {
    _candidateId = id;
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
