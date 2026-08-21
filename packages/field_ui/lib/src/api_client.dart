import 'dart:convert';
import 'package:http/http.dart' as http;

/// 도메인 에러. 백엔드는 코드만 주고 문구는 클라이언트가 붙입니다 (§5.15).
class ApiException implements Exception {
  ApiException(this.status, this.code, this.details);
  final int status;
  final String code;
  final Map<String, dynamic>? details;

  @override
  String toString() => 'ApiException($status, $code)';
}

/// CARELINK API 클라이언트.
///
/// Access 15분 / Refresh 14일 (docs/02 §9.1). 401을 받으면 한 번 refresh 하고
/// 원 요청을 재시도합니다 — 재시도를 두 번 이상 하지 않는 이유는, refresh가
/// 실패했는데 계속 도는 것보다 로그인 화면으로 보내는 편이 낫기 때문입니다.
class ApiClient {
  ApiClient({required this.baseUrl, http.Client? inner}) : _http = inner ?? http.Client();

  final String baseUrl;
  final http.Client _http;

  String? _accessToken;
  String? _refreshToken;
  Future<void> Function()? onSessionExpired;

  void setTokens({required String access, required String refresh}) {
    _accessToken = access;
    _refreshToken = refresh;
  }

  void clear() {
    _accessToken = null;
    _refreshToken = null;
  }

  /// 서버에서 refresh 토큰을 폐기합니다.
  ///
  /// 기기에서 지우는 것만으로는 **로그아웃한 척**입니다. refresh는 14일짜리라,
  /// 그 사이 어디선가 새어 나간 값이 그대로 로그인에 쓰입니다.
  ///
  /// 실패해도 삼킵니다 — 비행기 모드에서 로그아웃을 눌렀다고 기기에 세션이
  /// 남으면 그게 더 나쁩니다. 서버 토큰은 어차피 만료로 죽습니다.
  Future<void> revokeSession() async {
    final token = _refreshToken;
    if (token == null) return;
    try {
      await http.post(
        Uri.parse('$baseUrl/auth/logout'),
        headers: {'content-type': 'application/json'},
        body: jsonEncode({'refreshToken': token}),
      );
    } catch (_) {
      // 무시. 아래에서 기기 토큰은 반드시 지웁니다.
    }
  }

  bool get hasSession => _refreshToken != null;
  String? get accessToken => _accessToken;
  String? get refreshToken => _refreshToken;

  Future<dynamic> get(String path, {Map<String, String>? query}) =>
      _send('GET', path, query: query);

  Future<dynamic> post(String path, [Object? body]) => _send('POST', path, body: body);

  Future<dynamic> patch(String path, [Object? body]) => _send('PATCH', path, body: body);

  Future<dynamic> delete(String path) => _send('DELETE', path);

  Future<dynamic> _send(
    String method,
    String path, {
    Object? body,
    Map<String, String>? query,
    bool retried = false,
  }) async {
    final uri = Uri.parse('$baseUrl$path').replace(
      queryParameters: query?.isEmpty ?? true ? null : query,
    );
    final headers = <String, String>{
      'content-type': 'application/json',
      if (_accessToken != null) 'authorization': 'Bearer $_accessToken',
    };

    final res = switch (method) {
      'POST' => await _http.post(uri, headers: headers, body: body == null ? null : jsonEncode(body)),
      'PATCH' => await _http.patch(uri, headers: headers, body: body == null ? null : jsonEncode(body)),
      'DELETE' => await _http.delete(uri, headers: headers),
      _ => await _http.get(uri, headers: headers),
    };

    if (res.statusCode == 401 && !retried && _refreshToken != null) {
      final refreshed = await _refresh();
      if (refreshed) {
        return _send(method, path, body: body, query: query, retried: true);
      }
      await onSessionExpired?.call();
    }

    final decoded = res.body.isEmpty ? null : jsonDecode(res.body);
    if (res.statusCode >= 400) {
      final map = decoded is Map<String, dynamic> ? decoded : <String, dynamic>{};
      throw ApiException(
        res.statusCode,
        map['code'] as String? ?? 'COMMON_INTERNAL_ERROR',
        map['details'] as Map<String, dynamic>?,
      );
    }
    return decoded;
  }

  /// 토큰을 다시 발급받습니다.
  ///
  /// 역할을 새로 받은 직후에 필요합니다 — 권한은 access 토큰에 박혀 있어서,
  /// 재발급하지 않으면 방금 받은 역할이 15분 동안 붙지 않습니다.
  Future<bool> refreshSession() => _refresh();

  Future<bool> _refresh() async {
    try {
      final res = await _http.post(
        Uri.parse('$baseUrl/auth/refresh'),
        headers: {'content-type': 'application/json'},
        body: jsonEncode({'refreshToken': _refreshToken}),
      );
      if (res.statusCode >= 400) return false;
      final map = jsonDecode(res.body) as Map<String, dynamic>;
      _accessToken = map['accessToken'] as String?;
      _refreshToken = map['refreshToken'] as String? ?? _refreshToken;
      return _accessToken != null;
    } catch (_) {
      return false;
    }
  }
}
