import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:carelink_field_ui/carelink_field_ui.dart';
import '../core/app_state.dart';
/// 로그인 — 비밀번호 없음, 휴대폰 OTP만 (README §4-2 S1 확정).
///
/// 입력 필드 64px, 버튼 64px. 병원 복도에서 한 손으로 쓰는 화면입니다.
/// 상단에 언어 전환을 둡니다 — 로그인 전에 언어를 못 바꾸면 한국어를
/// 못 읽는 사용자는 여기서 막힙니다. 간병 인력의 상당수가 외국인입니다.
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

  /// 국가번호. 해외 거주 후보자가 여기를 바꿉니다 (docs/08 E·F 세그먼트).
  String _dial = '+82';
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
      final res = await app.api.post('/auth/otp/send', {'phone': _e164()});
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
        'phone': _e164(),
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


  /// 국가번호 + 숫자를 합쳐 서버로 보낼 형태를 만듭니다.
  ///
  /// 화면은 `010 4821 8821`처럼 띄어 쓰지만 그건 읽기 위한 것입니다.
  /// 국내 번호의 앞 0은 뗍니다 — `+82 010…`은 존재하지 않는 번호입니다.
  /// 최종 정규화는 서버가 E.164로 합니다.
  String _e164() {
    var digits = _phone.text.replaceAll(RegExp(r'\D'), '');
    if (digits.startsWith('0')) digits = digits.substring(1);
    return '$_dial$digits';
  }

  /// 국가번호 선택.
  ///
  /// 전체 국가 목록을 넣지 않았습니다. 지금 공급이 있는 나라만 둡니다
  /// (docs/08 세그먼트) — 200개짜리 목록에서 스크롤하게 하면 40~65세
  /// 사용자는 거기서 멈춥니다. 없는 나라는 운영자에게 문의로 옵니다.
  Future<void> _showDialSheet(BuildContext context, AppState app) async {
    const options = [
      ('+82', '대한민국'),
      ('+84', 'Việt Nam'),
      ('+998', "O'zbekiston"),
      ('+7', 'Россия · Қазақстан'),
      ('+95', 'Myanmar'),
      ('+855', 'កម្ពុជា'),
    ];
    final picked = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: CL.bg,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.all(CL.s6),
              child: Text(
                app.t('login.dialCode'),
                style: const TextStyle(fontSize: CL.subtitle, fontWeight: FontWeight.w700),
              ),
            ),
            for (final (code, name) in options)
              ListTile(
                minVerticalPadding: CL.s4,
                title: Text(name, style: const TextStyle(fontSize: CL.body)),
                trailing: Text(
                  code,
                  style: const TextStyle(
                    fontFamily: CL.monoFamily, fontSize: CL.body, fontWeight: FontWeight.w700,
                  ),
                ),
                onTap: () => Navigator.of(ctx).pop(code),
              ),
            const SizedBox(height: CL.s5),
          ],
        ),
      ),
    );
    if (picked != null && mounted) setState(() => _dial = picked);
  }

  /// 도움 안내. 전화 한 통이 유일하게 확실한 경로입니다.
  Future<void> _showHelp(BuildContext context, AppState app) async {
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: CL.bg,
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(CL.s6),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                app.t('login.needHelp'),
                style: const TextStyle(fontSize: CL.subtitle, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: CL.s4),
              Text(
                app.t('login.spamNote'),
                style: const TextStyle(fontSize: CL.body, color: CL.textSub, height: 1.6),
              ),
              const SizedBox(height: CL.s6),
              const Text(
                '1533-0000',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontFamily: CL.monoFamily, fontSize: CL.title,
                  fontWeight: FontWeight.w700, color: CL.actionText,
                ),
              ),
              const SizedBox(height: CL.s6),
              SecondaryButton(
                label: app.t('common.close'),
                onPressed: () => Navigator.of(ctx).pop(),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final app = AppScope.of(context);
    final canSubmit = _sent
        ? _code.text.length >= 6
        : _phone.text.replaceAll(RegExp(r'\D'), '').length >= 9;

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(CL.s6),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // 앱바 자리 — 언어 칩만 오른쪽에 (시안 SCR-002).
              Align(
                alignment: Alignment.centerRight,
                child: LocaleChip(
                  locale: app.locale,
                  onTap: () => _showLocaleSheet(context, app),
                ),
              ),
              const SizedBox(height: CL.s5),

              // 브랜드 마크 64px — 시안의 파란 타일 + 흰 하트.
              const Align(
                alignment: Alignment.centerLeft,
                child: BrandMark(
                  size: 64, tileColor: CL.actionStrong,
                  markColor: Colors.white, radius: 20,
                ),
              ),
              const SizedBox(height: CL.s6),

              Text(
                app.t('login.heroTitle'),
                style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w700, letterSpacing: -0.5),
              ),
              const SizedBox(height: CL.s3),
              Text(
                app.t('login.heroSub'),
                style: const TextStyle(fontSize: 17, color: CL.textMuted, height: 1.5),
              ),
              const SizedBox(height: CL.s6),

              Text(
                app.t('login.phone'),
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: CL.textSub),
              ),
              const SizedBox(height: CL.s3),
              PhoneField(
                controller: _phone,
                dialCode: _dial,
                enabled: !_sent,
                onChanged: (_) => setState(() {}),
                onDialTap: () => _showDialSheet(context, app),
              ),

              if (_sent) ...[
                const SizedBox(height: CL.s6),
                Text(app.t('login.code'), style: const TextStyle(fontSize: CL.caption, color: CL.textSub)),
                const SizedBox(height: CL.s3),
                _field(
                  controller: _code,
                  hint: '000000',
                  // 6자리를 넘기면 서버가 형식 오류를 돌려주는데, 화면에는
                  // '입력값을 다시 확인하세요'만 뜹니다. 무엇이 틀렸는지 알 수
                  // 없으므로 애초에 7자리가 들어가지 않게 막습니다.
                  maxLength: 6,
                  onChanged: (_) => setState(() {}),
                ),
                if (_devCode != null) ...[
                  const SizedBox(height: CL.s3),
                  Text(
                    'DEMO $_devCode',
                    style: const TextStyle(
                      fontFamily: CL.monoFamily, fontSize: CL.caption, color: CL.flag,
                    ),
                  ),
                ] else ...[
                  // 번호를 못 받는 상황에서 화면이 아무 말도 하지 않으면
                  // 사용자는 000000을 찍어 보다 포기합니다.
                  const SizedBox(height: CL.s3),
                  const Text(
                    '인증번호가 표시되지 않습니다. 데모 스택에는 SMS 발송이 없어\n'
                    '화면 표시가 유일한 전달 경로입니다 —\n'
                    'API를 AUTH_EXPOSE_OTP_CODE=true 로 띄웠는지 확인하세요.',
                    style: TextStyle(fontSize: CL.caption, color: CL.textMuted, height: 1.6),
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
                label: _sent ? app.t('login.verify') : app.t('login.sendSms'),
                onPressed: _busy || !canSubmit
                    ? null
                    : () => _sent ? _verify(app) : _sendCode(app),
              ),

              // 시안의 회색 안내 박스. 문자가 안 오는 가장 흔한 이유가
              // 통신사 스팸 차단이고, 그걸 모르면 앱이 고장 났다고 봅니다.
              if (!_sent) ...[
                const SizedBox(height: CL.s5),
                Container(
                  padding: const EdgeInsets.all(CL.s5),
                  decoration: BoxDecoration(
                    color: CL.bgSub,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Icon(Icons.info, size: 22, color: CL.textDisabled),
                      const SizedBox(width: CL.s3),
                      Expanded(
                        child: Text(
                          app.t('login.spamNote'),
                          style: const TextStyle(fontSize: 16, color: CL.textSub, height: 1.5),
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              if (_sent) ...[
                const SizedBox(height: CL.s4),
                SecondaryButton(
                  label: app.t('common.cancel'),
                  onPressed: () => setState(() {
                    _sent = false;
                    _code.clear();
                    _devCode = null;
                  }),
                ),
              ],

              // 시안 하단의 '도움이 필요해요'. 여기까지 와서 막히는 사람이
              // 갈 곳이 없으면 그냥 나갑니다.
              const SizedBox(height: CL.s6),
              SizedBox(
                height: 56,
                child: TextButton.icon(
                  onPressed: () => _showHelp(context, app),
                  icon: const Icon(Icons.help_outline, size: 22, color: CL.actionText),
                  label: Text(
                    app.t('login.needHelp'),
                    style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: CL.actionText),
                  ),
                ),
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
    bool allowPlus = false,
    int? maxLength,
    ValueChanged<String>? onChanged,
  }) {
    return SizedBox(
      height: CL.heroButtonHeight,
      child: TextField(
        controller: controller,
        enabled: enabled,
        onChanged: onChanged,
        keyboardType: allowPlus ? TextInputType.phone : TextInputType.number,
        // 카운터('0/6')를 띄우지 않습니다. FIELD 화면은 높이가 고정이라
        // 카운터가 붙으면 입력칸이 밀립니다.
        maxLength: maxLength,
        buildCounter: (_, {required currentLength, required isFocused, maxLength}) => null,
        inputFormatters: [
          allowPlus
              ? FilteringTextInputFormatter.allow(RegExp(r'[0-9+\s-]'))
              : FilteringTextInputFormatter.digitsOnly,
        ],
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
      'IAM_PHONE_INVALID' => switch (locale) {
          AppLocale.ko => '번호를 다시 확인해 주세요. 해외 번호는 국가번호(+84 등)가 필요합니다',
          AppLocale.vi => 'Vui lòng kiểm tra lại số. Số nước ngoài cần mã quốc gia (VD: +84)',
          AppLocale.ru => 'Проверьте номер. Для зарубежного номера нужен код страны (например, +998)',
          AppLocale.en => 'Please check the number. Overseas numbers need a country code (e.g. +84)',
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
              app.locale.nativeName,
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
