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
