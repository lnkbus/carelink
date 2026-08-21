import 'package:flutter/widgets.dart';

/// 지원 로케일. FIELD는 4개 전부입니다 (DESK는 ko 전용).
///
/// 러시아어는 고려인 세그먼트 때문에 필수입니다 (SCR-110 notes · docs/08).
/// 빼도 되는 언어가 아니라 목표 인력 풀의 한 축입니다.
enum AppLocale { ko, vi, ru, en }

extension AppLocaleInfo on AppLocale {
  String get code => name;
  String get short => switch (this) {
        AppLocale.ko => 'KO',
        AppLocale.vi => 'VI',
        AppLocale.ru => 'RU',
        AppLocale.en => 'EN',
      };
  String get nativeName => switch (this) {
        AppLocale.ko => '한국어',
        AppLocale.vi => 'Tiếng Việt',
        AppLocale.ru => 'Русский',
        AppLocale.en => 'English',
      };
  Locale get flutterLocale => Locale(code);
}
