import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:carelink_field_ui/carelink_field_ui.dart';
import '../core/app_state.dart';
/// SCR-002 로그인 — 비밀번호 없음, 휴대폰 OTP만 (README §4-2 S1 확정).
///
/// 입력 필드 64px, 버튼 64px. 40~65세 사용자가 한 손으로 쓰는 화면입니다.
/// 상단에 LocaleSwitcher를 둡니다 — 로그인 전에 언어를 못 바꾸면
/// 한국어를 못 읽는 사용자는 여기서 막힙니다.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _phone = TextEditingController();
  final _code = TextEditingController();
  bool _sent = false;
  bool _busy = false;
  String? _devCode;
  String? _error;

  @override
  void dispose() {
    _phone.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _sendCode(AppState app) async {
    setState(() { _busy = true; _error = null; });
    try {
      final res = await app.api.post('/auth/otp/send', {'phone': _phone.text});
      setState(() {
        _sent = true;
        // 개발 환경에서만 내려옵니다. 운영에서는 null이라 화면에 아무것도 뜨지 않습니다.
        _devCode = (res as Map<String, dynamic>)['devCode'] as String?;
      });
    } on ApiException catch (e) {
      setState(() => _error = e.code);
    } catch (_) {
      // 네트워크 실패·CORS 차단은 ApiException이 아닙니다. 잡지 않으면
      // 예외가 위젯 트리를 타고 올라가 화면이 통째로 백지가 됩니다 —
      // 사용자는 앱이 고장 났다고 생각하고 다시 열지 않습니다.
      setState(() => _error = 'NETWORK');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _verify(AppState app) async {
    setState(() { _busy = true; _error = null; });
    try {
      final res = await app.api.post('/auth/otp/verify', {
        'phone': _phone.text,
        'code': _code.text,
        // 동의는 버전별로 적재해야 분쟁 시 방어됩니다 (SCR-110 notes · docs/11).
        'consents': [
          {'code': 'TOS', 'version': 'v1', 'agreed': true},
          {'code': 'PRIVACY', 'version': 'v1', 'agreed': true},
        ],
      }) as Map<String, dynamic>;
      await app.signIn(
        access: res['accessToken'] as String,
        refresh: res['refreshToken'] as String,
      );
    } on ApiException catch (e) {
      setState(() => _error = e.code);
    } catch (_) {
      setState(() => _error = 'NETWORK');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final canSubmit = _sent ? _code.text.length >= 4 : _phone.text.length >= 9;

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(CL.s6),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Align(
                alignment: Alignment.centerRight,
                child: LocaleChip(
                  locale: app.locale,
                  onTap: () => _showLocaleSheet(context, app),
                ),
              ),
              const SizedBox(height: CL.s8),
              const Text(
                'CARELINK',
                style: TextStyle(fontSize: CL.title, fontWeight: FontWeight.w700, letterSpacing: 4),
              ),
              const SizedBox(height: CL.s3),
              Text(
                app.t('login.title'),
                style: const TextStyle(fontSize: CL.body, color: CL.textMuted),
              ),
              const SizedBox(height: CL.s7),

              Text(app.t('login.phone'), style: const TextStyle(fontSize: CL.caption, color: CL.textSub)),
              const SizedBox(height: CL.s3),
              _field(
                controller: _phone,
                enabled: !_sent,
                hint: '01012345678',
                onChanged: (_) => setState(() {}),
              ),

              if (_sent) ...[
                const SizedBox(height: CL.s6),
                Text(app.t('login.code'), style: const TextStyle(fontSize: CL.caption, color: CL.textSub)),
                const SizedBox(height: CL.s3),
                _field(
                  controller: _code,
                  hint: '000000',
                  onChanged: (_) => setState(() {}),
                ),
                if (_devCode != null) ...[
                  const SizedBox(height: CL.s3),
                  Text(
                    'DEV $_devCode',
                    style: const TextStyle(
                      fontFamily: CL.monoFamily, fontSize: CL.caption, color: CL.flag,
                    ),
                  ),
                ],
              ],

              if (_error != null) ...[
                const SizedBox(height: CL.s5),
                Text(
                  _loginErrorText(_error!, app.locale),
                  style: const TextStyle(fontSize: CL.body, color: CL.alert),
                ),
              ],

              const SizedBox(height: CL.s6),
              PrimaryButton(
                hero: true,
                label: _sent ? app.t('login.submit') : app.t('login.sendCode'),
                onPressed: _busy || !canSubmit
                    ? null
                    : () => _sent ? _verify(app) : _sendCode(app),
              ),

              if (_sent) ...[
                const SizedBox(height: CL.s4),
                SecondaryButton(
                  label: app.t('login.changeNumber'),
                  onPressed: () => setState(() {
                    _sent = false;
                    _code.clear();
                    _devCode = null;
                  }),
                ),
              ],

              const SizedBox(height: CL.s6),
              Text(
                app.t('login.consent'),
                style: const TextStyle(fontSize: CL.caption, color: CL.textMuted, height: 1.5),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _field({
    required TextEditingController controller,
    required String hint,
    bool enabled = true,
    ValueChanged<String>? onChanged,
  }) {
    return SizedBox(
      height: CL.heroButtonHeight,
      child: TextField(
        controller: controller,
        enabled: enabled,
        onChanged: onChanged,
        keyboardType: TextInputType.number,
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        style: const TextStyle(fontSize: CL.body, fontFamily: CL.monoFamily),
        decoration: InputDecoration(
          hintText: hint,
          filled: true,
          fillColor: enabled ? CL.bg : CL.bgSub,
          contentPadding: const EdgeInsets.symmetric(horizontal: CL.s5),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(CL.rCard),
            borderSide: const BorderSide(color: CL.lineStrong),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(CL.rCard),
            borderSide: const BorderSide(color: CL.lineStrong),
          ),
        ),
      ),
    );
  }
}

/// 로그인 실패 문구. 코드별로 다르게 안내해야 사용자가 다음 행동을 압니다.
String _loginErrorText(String code, AppLocale locale) => switch (code) {
      'NETWORK' => switch (locale) {
          AppLocale.ko => '서버에 연결할 수 없습니다. 네트워크를 확인해 주세요.',
          AppLocale.vi => 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng.',
          AppLocale.ru => 'Не удаётся подключиться к серверу. Проверьте сеть.',
          AppLocale.en => 'Cannot reach the server. Please check your connection.',
        },
      'IAM_OTP_RATE_LIMITED' => switch (locale) {
          AppLocale.ko => '잠시 후 다시 시도해 주세요',
          AppLocale.vi => 'Vui lòng thử lại sau giây lát',
          AppLocale.ru => 'Повторите попытку чуть позже',
          AppLocale.en => 'Please try again in a moment',
        },
      'IAM_OTP_INVALID' => switch (locale) {
          AppLocale.ko => '인증번호가 맞지 않습니다',
          AppLocale.vi => 'Mã xác minh không đúng',
          AppLocale.ru => 'Неверный код',
          AppLocale.en => 'That code is not correct',
        },
      _ => code,
    };

Future<void> _showLocaleSheet(BuildContext context, AppState app) async {
  await showModalBottomSheet<void>(
    context: context,
    backgroundColor: CL.bg,
    builder: (sheetContext) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(CL.s6),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              app.t('settings.language'),
              style: const TextStyle(fontSize: CL.subtitle, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: CL.s6),
            for (final l in AppLocale.values)
              SizedBox(
                height: CL.primaryButtonHeight,
                width: double.infinity,
                child: TextButton(
                  onPressed: () {
                    app.setLocale(l);
                    Navigator.of(sheetContext).pop();
                  },
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          l.nativeName,
                          style: TextStyle(
                            fontSize: CL.body,
                            color: l == app.locale ? CL.actionText : CL.text,
                            fontWeight: l == app.locale ? FontWeight.w700 : FontWeight.w400,
                          ),
                        ),
                      ),
                      if (l == app.locale) const Icon(Icons.check, color: CL.actionText),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    ),
  );
}

/// 다른 화면에서도 언어 시트를 열 수 있게 공개합니다.
Future<void> showLocaleSheet(BuildContext context, AppState app) => _showLocaleSheet(context, app);
