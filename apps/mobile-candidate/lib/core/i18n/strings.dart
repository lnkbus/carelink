import 'package:carelink_field_ui/carelink_field_ui.dart';

export 'package:carelink_field_ui/carelink_field_ui.dart' show AppLocale, AppLocaleInfo;

/// 문구 사전.
///
/// **백엔드는 에러·상태 코드만 반환하고 문구는 클라이언트가 번역합니다** (§5.15).
/// 그래서 이 표가 화면 문구의 단일 출처입니다.
///
/// 키가 한 언어라도 빠지면 그 언어 사용자에게 키 원문이 그대로 보입니다.
/// `test/i18n_test.dart`가 4개 언어의 키 집합이 정확히 같은지 강제합니다 —
/// 사람이 눈으로 맞추는 방식은 키가 200개를 넘는 순간 실패합니다.
///
/// 라벨은 한국어 기준 길이의 **2.5배**를 수용해야 합니다 (SCR-110 notes).
/// '여정'이 'Hành trình'이 되고 'Профессиональный путь'가 됩니다.
/// 고정폭 버튼에 텍스트를 넣지 마세요.
const Map<String, Map<AppLocale, String>> _dict = {
  // ── 공통 ────────────────────────────────────────────────────────────────
  'app.name': {
    AppLocale.ko: 'CARELINK', AppLocale.vi: 'CARELINK',
    AppLocale.ru: 'CARELINK', AppLocale.en: 'CARELINK',
  },
  'common.next': {
    AppLocale.ko: '다음', AppLocale.vi: 'Tiếp theo',
    AppLocale.ru: 'Далее', AppLocale.en: 'Next',
  },
  'common.retry': {
    AppLocale.ko: '다시 시도', AppLocale.vi: 'Thử lại',
    AppLocale.ru: 'Повторить', AppLocale.en: 'Retry',
  },
  'common.loading': {
    AppLocale.ko: '불러오는 중', AppLocale.vi: 'Đang tải',
    AppLocale.ru: 'Загрузка', AppLocale.en: 'Loading',
  },
  'common.empty': {
    AppLocale.ko: '아직 없습니다', AppLocale.vi: 'Chưa có',
    AppLocale.ru: 'Пока ничего нет', AppLocale.en: 'Nothing yet',
  },
  'common.close': {
    AppLocale.ko: '닫기', AppLocale.vi: 'Đóng',
    AppLocale.ru: 'Закрыть', AppLocale.en: 'Close',
  },

  // ── 로그인 (SCR-002) ────────────────────────────────────────────────────
  'login.title': {
    AppLocale.ko: '인증번호로 로그인', AppLocale.vi: 'Đăng nhập bằng mã xác minh',
    AppLocale.ru: 'Вход по коду', AppLocale.en: 'Sign in with a code',
  },
  'login.countryCode': {
    AppLocale.ko: '해외 번호는 국가번호를 붙여 주세요 (예: +84)',
    AppLocale.vi: 'Số nước ngoài: thêm mã quốc gia (VD: +84)',
    AppLocale.ru: 'Зарубежный номер — с кодом страны (например, +998)',
    AppLocale.en: 'For overseas numbers, include the country code (e.g. +84)',
  },
  'login.phone': {
    AppLocale.ko: '휴대전화 번호', AppLocale.vi: 'Số điện thoại',
    AppLocale.ru: 'Номер телефона', AppLocale.en: 'Phone number',
  },
  'login.sendCode': {
    AppLocale.ko: '인증번호 받기', AppLocale.vi: 'Nhận mã xác minh',
    AppLocale.ru: 'Получить код', AppLocale.en: 'Get code',
  },
  'login.code': {
    AppLocale.ko: '인증번호', AppLocale.vi: 'Mã xác minh',
    AppLocale.ru: 'Код подтверждения', AppLocale.en: 'Verification code',
  },
  'login.submit': {
    AppLocale.ko: '로그인', AppLocale.vi: 'Đăng nhập',
    AppLocale.ru: 'Войти', AppLocale.en: 'Sign in',
  },
  'login.changeNumber': {
    AppLocale.ko: '번호 다시 입력', AppLocale.vi: 'Nhập lại số',
    AppLocale.ru: 'Изменить номер', AppLocale.en: 'Change number',
  },
  'login.consent': {
    AppLocale.ko: '이용약관과 개인정보 처리방침에 동의합니다',
    AppLocale.vi: 'Tôi đồng ý với điều khoản dịch vụ và chính sách bảo mật',
    AppLocale.ru: 'Я согласен с условиями использования и политикой конфиденциальности',
    AppLocale.en: 'I agree to the terms of service and privacy policy',
  },

  // ── 역할 선택 (SCR-003) ─────────────────────────────────────────────────
  'role.title': {
    AppLocale.ko: '어떤 일로 오셨나요?', AppLocale.vi: 'Bạn đến với mục đích gì?',
    AppLocale.ru: 'Что вас привело?', AppLocale.en: 'What brings you here?',
  },
  'role.candidate': {
    AppLocale.ko: '일자리를 찾습니다', AppLocale.vi: 'Tôi đang tìm việc',
    AppLocale.ru: 'Ищу работу', AppLocale.en: 'I am looking for work',
  },
  'role.candidate.sub': {
    AppLocale.ko: '자격 취득부터 배치까지 함께합니다',
    AppLocale.vi: 'Đồng hành từ lấy chứng chỉ đến khi đi làm',
    AppLocale.ru: 'От получения квалификации до трудоустройства',
    AppLocale.en: 'From qualification to placement',
  },

  // ── 홈 (SCR-101) ────────────────────────────────────────────────────────
  'home.title': {
    AppLocale.ko: '홈', AppLocale.vi: 'Trang chủ',
    AppLocale.ru: 'Главная', AppLocale.en: 'Home',
  },
  'home.nextAction': {
    AppLocale.ko: '지금 할 일', AppLocale.vi: 'Việc cần làm ngay',
    AppLocale.ru: 'Что сделать сейчас', AppLocale.en: 'Do this next',
  },
  'home.allDone': {
    AppLocale.ko: '지금 하실 일이 없습니다',
    AppLocale.vi: 'Hiện chưa có việc cần làm',
    AppLocale.ru: 'Сейчас ничего делать не нужно',
    AppLocale.en: 'Nothing to do right now',
  },
  'home.allDone.sub': {
    AppLocale.ko: '추천 일자리를 확인해 보세요',
    AppLocale.vi: 'Hãy xem các việc làm được gợi ý',
    AppLocale.ru: 'Посмотрите рекомендованные вакансии',
    AppLocale.en: 'Check the recommended jobs',
  },
  'home.recommended': {
    AppLocale.ko: '추천 일자리', AppLocale.vi: 'Việc làm gợi ý',
    AppLocale.ru: 'Рекомендованные вакансии', AppLocale.en: 'Recommended jobs',
  },
  'home.progress': {
    AppLocale.ko: '진행 단계', AppLocale.vi: 'Tiến độ',
    AppLocale.ru: 'Этап', AppLocale.en: 'Progress',
  },

  // ── 여정 (SCR-102) ──────────────────────────────────────────────────────
  'journey.entries': {
    AppLocale.ko: '자세히 보기', AppLocale.vi: 'Xem chi tiết',
    AppLocale.ru: 'Подробнее', AppLocale.en: 'Details',
  },
  'journey.title': {
    AppLocale.ko: '커리어 여정', AppLocale.vi: 'Hành trình nghề nghiệp',
    AppLocale.ru: 'Профессиональный путь', AppLocale.en: 'Career journey',
  },
  'journey.career': {
    AppLocale.ko: '자격 · 취업 경로', AppLocale.vi: 'Lộ trình chứng chỉ và việc làm',
    AppLocale.ru: 'Квалификация и трудоустройство', AppLocale.en: 'Qualification and hiring',
  },
  'journey.visa': {
    AppLocale.ko: '체류자격 절차', AppLocale.vi: 'Thủ tục tư cách lưu trú',
    AppLocale.ru: 'Оформление статуса пребывания', AppLocale.en: 'Residence status process',
  },
  'journey.visa.notApplicable': {
    AppLocale.ko: '체류자격 절차가 필요하지 않습니다',
    AppLocale.vi: 'Không cần thủ tục tư cách lưu trú',
    AppLocale.ru: 'Оформление статуса не требуется',
    AppLocale.en: 'No residence process needed',
  },
  'journey.visa.pending': {
    AppLocale.ko: '운영자가 확인하고 있습니다',
    AppLocale.vi: 'Quản trị viên đang xác nhận',
    AppLocale.ru: 'Администратор проверяет',
    AppLocale.en: 'An operator is reviewing this',
  },
  'journey.two.axes': {
    AppLocale.ko: '두 절차는 따로 진행됩니다. 하나가 끝나야 다른 하나가 시작되는 것이 아닙니다.',
    AppLocale.vi: 'Hai thủ tục diễn ra song song, không phải xong cái này mới bắt đầu cái kia.',
    AppLocale.ru: 'Эти два процесса идут параллельно, а не один за другим.',
    AppLocale.en: 'These two run in parallel — one does not wait for the other.',
  },

  // ── 트랙 (SCR-103) ──────────────────────────────────────────────────────
  'track.title': {
    AppLocale.ko: '커리어 트랙', AppLocale.vi: 'Ngành nghề',
    AppLocale.ru: 'Направление', AppLocale.en: 'Career track',
  },
  'track.select': {
    AppLocale.ko: '이 트랙 선택', AppLocale.vi: 'Chọn ngành này',
    AppLocale.ru: 'Выбрать это направление', AppLocale.en: 'Choose this track',
  },
  'track.selected': {
    AppLocale.ko: '선택함', AppLocale.vi: 'Đã chọn',
    AppLocale.ru: 'Выбрано', AppLocale.en: 'Selected',
  },
  'track.requirements': {
    AppLocale.ko: '필요 조건', AppLocale.vi: 'Điều kiện cần',
    AppLocale.ru: 'Требования', AppLocale.en: 'Requirements',
  },

  // ── 프로필 (SCR-104) ────────────────────────────────────────────────────
  'profile.title': {
    AppLocale.ko: '내 프로필', AppLocale.vi: 'Hồ sơ của tôi',
    AppLocale.ru: 'Мой профиль', AppLocale.en: 'My profile',
  },
  'profile.name': {
    AppLocale.ko: '이름', AppLocale.vi: 'Họ tên',
    AppLocale.ru: 'Имя', AppLocale.en: 'Name',
  },
  'profile.birth': {
    AppLocale.ko: '생년월일', AppLocale.vi: 'Ngày sinh',
    AppLocale.ru: 'Дата рождения', AppLocale.en: 'Date of birth',
  },
  'profile.region': {
    AppLocale.ko: '희망 근무지역', AppLocale.vi: 'Khu vực mong muốn',
    AppLocale.ru: 'Желаемый регион', AppLocale.en: 'Preferred region',
  },
  'profile.availableFrom': {
    AppLocale.ko: '근무 가능일', AppLocale.vi: 'Ngày có thể bắt đầu',
    AppLocale.ru: 'Готов приступить', AppLocale.en: 'Available from',
  },
  'profile.visa': {
    AppLocale.ko: '체류자격', AppLocale.vi: 'Tư cách lưu trú',
    AppLocale.ru: 'Статус пребывания', AppLocale.en: 'Residence status',
  },
  'profile.visa.readonly': {
    AppLocale.ko: '체류자격은 운영자가 확인한 결과만 기록됩니다',
    AppLocale.vi: 'Tư cách lưu trú chỉ được ghi nhận sau khi quản trị viên xác nhận',
    AppLocale.ru: 'Статус пребывания вносится только после проверки администратором',
    AppLocale.en: 'Residence status is recorded only after an operator verifies it',
  },
  'profile.save': {
    AppLocale.ko: '저장', AppLocale.vi: 'Lưu',
    AppLocale.ru: 'Сохранить', AppLocale.en: 'Save',
  },

  // ── 서류 (SCR-105) ──────────────────────────────────────────────────────
  'documents.title': {
    AppLocale.ko: '서류', AppLocale.vi: 'Giấy tờ',
    AppLocale.ru: 'Документы', AppLocale.en: 'Documents',
  },
  'documents.upload': {
    AppLocale.ko: '서류 올리기', AppLocale.vi: 'Tải giấy tờ lên',
    AppLocale.ru: 'Загрузить документ', AppLocale.en: 'Upload a document',
  },
  'documents.expiring': {
    AppLocale.ko: '만료 임박', AppLocale.vi: 'Sắp hết hạn',
    AppLocale.ru: 'Скоро истекает', AppLocale.en: 'Expiring soon',
  },
  'documents.rejectReason': {
    AppLocale.ko: '반려 사유', AppLocale.vi: 'Lý do từ chối',
    AppLocale.ru: 'Причина отказа', AppLocale.en: 'Rejection reason',
  },

  // ── 교육 (SCR-106) ──────────────────────────────────────────────────────
  'training.title': {
    AppLocale.ko: '교육', AppLocale.vi: 'Đào tạo',
    AppLocale.ru: 'Обучение', AppLocale.en: 'Training',
  },
  'training.continue': {
    AppLocale.ko: '이어서 학습', AppLocale.vi: 'Học tiếp',
    AppLocale.ru: 'Продолжить обучение', AppLocale.en: 'Continue learning',
  },
  'training.enroll': {
    AppLocale.ko: '수강 신청', AppLocale.vi: 'Đăng ký học',
    AppLocale.ru: 'Записаться', AppLocale.en: 'Enroll',
  },
  'training.mandatory': {
    AppLocale.ko: '필수 과정', AppLocale.vi: 'Khóa bắt buộc',
    AppLocale.ru: 'Обязательный курс', AppLocale.en: 'Required course',
  },

  // ── 일자리 (SCR-107 · 108) ──────────────────────────────────────────────
  'jobs.title': {
    AppLocale.ko: '일자리', AppLocale.vi: 'Việc làm',
    AppLocale.ru: 'Вакансии', AppLocale.en: 'Jobs',
  },
  'jobs.matchScore': {
    AppLocale.ko: '적합도', AppLocale.vi: 'Độ phù hợp',
    AppLocale.ru: 'Соответствие', AppLocale.en: 'Match',
  },
  'jobs.reasons': {
    AppLocale.ko: '이 점수의 근거', AppLocale.vi: 'Căn cứ của điểm số',
    AppLocale.ru: 'Обоснование оценки', AppLocale.en: 'Why this score',
  },
  'jobs.missing': {
    AppLocale.ko: '부족한 요건', AppLocale.vi: 'Điều kiện còn thiếu',
    AppLocale.ru: 'Чего не хватает', AppLocale.en: 'What is missing',
  },
  'jobs.apply': {
    AppLocale.ko: '지원하기', AppLocale.vi: 'Ứng tuyển',
    AppLocale.ru: 'Откликнуться', AppLocale.en: 'Apply',
  },
  'jobs.applied': {
    AppLocale.ko: '지원함', AppLocale.vi: 'Đã ứng tuyển',
    AppLocale.ru: 'Отклик отправлен', AppLocale.en: 'Applied',
  },
  'jobs.salary': {
    AppLocale.ko: '급여', AppLocale.vi: 'Mức lương',
    AppLocale.ru: 'Зарплата', AppLocale.en: 'Salary',
  },
  'jobs.salary.afterMatch': {
    AppLocale.ko: '매칭 후 공개', AppLocale.vi: 'Công bố sau khi ghép việc',
    AppLocale.ru: 'Откроется после подбора', AppLocale.en: 'Shown after matching',
  },
  'jobs.salary.negotiable': {
    AppLocale.ko: '협의', AppLocale.vi: 'Thỏa thuận',
    AppLocale.ru: 'По договорённости', AppLocale.en: 'Negotiable',
  },
  'jobs.dorm': {
    AppLocale.ko: '기숙사 제공', AppLocale.vi: 'Có ký túc xá',
    AppLocale.ru: 'Есть общежитие', AppLocale.en: 'Dormitory provided',
  },
  'jobs.startDate': {
    AppLocale.ko: '근무 시작', AppLocale.vi: 'Ngày bắt đầu',
    AppLocale.ru: 'Начало работы', AppLocale.en: 'Start date',
  },

  // ── 지원 현황 (SCR-109) ─────────────────────────────────────────────────
  'applications.title': {
    AppLocale.ko: '지원 현황', AppLocale.vi: 'Tình trạng ứng tuyển',
    AppLocale.ru: 'Мои отклики', AppLocale.en: 'My applications',
  },
  'applications.resultNote': {
    AppLocale.ko: '결과 안내', AppLocale.vi: 'Thông báo kết quả',
    AppLocale.ru: 'Результат', AppLocale.en: 'Result',
  },
  'applications.noReason': {
    AppLocale.ko: '사유가 기록되지 않았습니다. 운영자에게 문의하세요.',
    AppLocale.vi: 'Chưa có lý do được ghi nhận. Hãy liên hệ quản trị viên.',
    AppLocale.ru: 'Причина не указана. Обратитесь к администратору.',
    AppLocale.en: 'No reason was recorded. Please contact an operator.',
  },

  // ── 내 정보 (SCR-110) ───────────────────────────────────────────────────
  'settings.title': {
    AppLocale.ko: '내 정보', AppLocale.vi: 'Thông tin của tôi',
    AppLocale.ru: 'Мои данные', AppLocale.en: 'My account',
  },
  'settings.language': {
    AppLocale.ko: '언어', AppLocale.vi: 'Ngôn ngữ',
    AppLocale.ru: 'Язык', AppLocale.en: 'Language',
  },
  'settings.notifications': {
    AppLocale.ko: '알림 설정', AppLocale.vi: 'Cài đặt thông báo',
    AppLocale.ru: 'Уведомления', AppLocale.en: 'Notifications',
  },
  'settings.consents': {
    AppLocale.ko: '동의 이력', AppLocale.vi: 'Lịch sử đồng ý',
    AppLocale.ru: 'История согласий', AppLocale.en: 'Consent history',
  },
  'settings.support': {
    AppLocale.ko: '문의하기', AppLocale.vi: 'Liên hệ hỗ trợ',
    AppLocale.ru: 'Поддержка', AppLocale.en: 'Contact support',
  },
  'settings.logout': {
    AppLocale.ko: '로그아웃', AppLocale.vi: 'Đăng xuất',
    AppLocale.ru: 'Выйти', AppLocale.en: 'Sign out',
  },
  'common.cancel': {
    AppLocale.ko: '취소', AppLocale.vi: 'Hủy', AppLocale.ru: 'Отмена', AppLocale.en: 'Cancel',
  },
  'logout.confirm': {
    AppLocale.ko: '로그아웃할까요?',
    AppLocale.vi: 'Bạn có muốn đăng xuất?',
    AppLocale.ru: 'Выйти из аккаунта?',
    AppLocale.en: 'Sign out?',
  },
  'logout.note': {
    // 무엇을 잃는지 알려 줍니다. 다시 로그인하면 되지만, 인증번호를
    // 기다려야 하므로 실수로 누르는 비용이 작지 않습니다.
    AppLocale.ko: '다시 로그인하려면 인증번호가 필요합니다.',
    AppLocale.vi: 'Bạn sẽ cần mã xác minh để đăng nhập lại.',
    AppLocale.ru: 'Для повторного входа понадобится код подтверждения.',
    AppLocale.en: 'You will need a verification code to sign in again.',
  },

  // ── 만료 (ExpiryCountdown) ──────────────────────────────────────────────
  'expiry.daysLeft': {
    AppLocale.ko: '남음', AppLocale.vi: 'còn lại',
    AppLocale.ru: 'осталось', AppLocale.en: 'left',
  },
  'expiry.expired': {
    AppLocale.ko: '만료됨', AppLocale.vi: 'Đã hết hạn',
    AppLocale.ru: 'Истёк', AppLocale.en: 'Expired',
  },
  'expiry.visaWarning': {
    AppLocale.ko: '체류기간이 만료되면 일할 수 없습니다. 미리 연장하세요.',
    AppLocale.vi: 'Hết hạn lưu trú thì không thể làm việc. Hãy gia hạn trước.',
    AppLocale.ru: 'После истечения статуса работать нельзя. Продлите заранее.',
    AppLocale.en: 'You cannot work once your status expires. Renew it in advance.',
  },
};

/// 문구 조회.
///
/// 키가 없으면 키 원문을 그대로 돌려줍니다. 빈 문자열이나 '???'로 뭉개면
/// 화면에서 사라져 버려서, 무엇이 빠졌는지 아무도 모른 채 배포됩니다.
String tr(String key, AppLocale locale) {
  final entry = _dict[key];
  if (entry == null) return key;
  return entry[locale] ?? entry[AppLocale.ko] ?? key;
}

/// 테스트가 키 집합을 검사할 수 있도록 노출합니다.
Map<String, Map<AppLocale, String>> get translationTable => _dict;
