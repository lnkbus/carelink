import 'package:carelink_field_ui/carelink_field_ui.dart';

export 'package:carelink_field_ui/carelink_field_ui.dart' show AppLocale, AppLocaleInfo;

/// 문구 사전 — 후보자 · 간병사 · 보호자 공용.
///
/// **백엔드는 에러·상태 코드만 반환하고 문구는 클라이언트가 번역합니다** (§5.15).
/// 그래서 이 표가 화면 문구의 단일 출처입니다.
///
/// 앱을 셋으로 나눠 두었을 때는 사전도 셋이었고, 로그인·역할 선택처럼 똑같은
/// 화면의 문구가 세 벌 있었습니다. 한 곳을 고치면 나머지 둘은 잊혔습니다.
///
/// 역할별로 같은 뜻을 다르게 말해야 하는 자리는 키를 나눕니다 — 후보자의
/// '홈'은 간병사에게 '오늘'입니다 (`home.title` vs `tab.today`).
///
/// 그리고 **여기에 없는 것**이 중요합니다:
///   · 환자 실명·나이·성별·진단명 키가 없습니다 (docs/11 §3.2). 사전에
///     없으면 화면에 그릴 수도 없습니다.
///   · 간병사 국적·실명 키가 없습니다 (§6-21). 보호자 화면도 마찬가지입니다.
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
  'login.heroTitle': {
    AppLocale.ko: '휴대폰 번호로 시작',
    AppLocale.vi: 'Bắt đầu bằng số điện thoại',
    AppLocale.ru: 'Начните с номера телефона',
    AppLocale.en: 'Start with your phone number',
  },
  'login.heroSub': {
    AppLocale.ko: '번호를 입력하면 인증 문자를 보냅니다. 비밀번호는 없습니다.',
    AppLocale.vi: 'Nhập số, chúng tôi sẽ gửi mã xác minh. Không cần mật khẩu.',
    AppLocale.ru: 'Введите номер — пришлём код. Пароль не нужен.',
    AppLocale.en: 'Enter your number and we will text you a code. No password.',
  },
  'login.sendSms': {
    AppLocale.ko: '인증 문자 받기', AppLocale.vi: 'Nhận mã xác minh',
    AppLocale.ru: 'Получить код', AppLocale.en: 'Send me a code',
  },
  'login.spamNote': {
    AppLocale.ko: '문자가 오지 않으면 통신사 스팸 차단을 확인해 주세요.',
    AppLocale.vi: 'Không nhận được tin nhắn? Hãy kiểm tra bộ lọc spam của nhà mạng.',
    AppLocale.ru: 'Нет сообщения? Проверьте спам-фильтр оператора.',
    AppLocale.en: 'No text? Check your carrier’s spam filter.',
  },
  'login.needHelp': {
    AppLocale.ko: '도움이 필요해요', AppLocale.vi: 'Tôi cần trợ giúp',
    AppLocale.ru: 'Мне нужна помощь', AppLocale.en: 'I need help',
  },
  'login.dialCode': {
    AppLocale.ko: '국가번호', AppLocale.vi: 'Mã quốc gia',
    AppLocale.ru: 'Код страны', AppLocale.en: 'Country code',
  },
  'splash.tagline': {
    AppLocale.ko: '돌봄 인력과 현장을 잇습니다',
    AppLocale.vi: 'Kết nối nhân lực chăm sóc với hiện trường',
    AppLocale.ru: 'Соединяем персонал ухода и объекты',
    AppLocale.en: 'Connecting care workers and sites',
  },
  'splash.checking': {
    AppLocale.ko: '토큰 확인 중', AppLocale.vi: 'Đang kiểm tra phiên',
    AppLocale.ru: 'Проверка сессии', AppLocale.en: 'Checking session',
  },
  'brand.name': {
    AppLocale.ko: '케어링크', AppLocale.vi: 'CARELINK',
    AppLocale.ru: 'КЕАРЛИНК', AppLocale.en: 'CARELINK',
  },
  'role.subtitle': {
    AppLocale.ko: '나중에 언제든 바꿀 수 있습니다.',
    AppLocale.vi: 'Bạn có thể thay đổi bất cứ lúc nào.',
    AppLocale.ru: 'Это можно изменить в любой момент.',
    AppLocale.en: 'You can change this at any time.',
  },
  'role.start': {
    AppLocale.ko: '시작하기', AppLocale.vi: 'Bắt đầu',
    AppLocale.ru: 'Начать', AppLocale.en: 'Get started',
  },
  'role.caregiver': {
    AppLocale.ko: '간병 일을 해요', AppLocale.vi: 'Tôi làm chăm sóc',
    AppLocale.ru: 'Работаю по уходу', AppLocale.en: 'I do care work',
  },
  'role.caregiver.sub': {
    AppLocale.ko: '근무 일정 · 근무 기록', AppLocale.vi: 'Lịch ca · Bản ghi ca',
    AppLocale.ru: 'График · Записи смен', AppLocale.en: 'Shifts and records',
  },
  'role.family': {
    AppLocale.ko: '간병인이 필요해요', AppLocale.vi: 'Tôi cần người chăm sóc',
    AppLocale.ru: 'Мне нужен сиделка', AppLocale.en: 'I need a caregiver',
  },
  'role.family.sub': {
    AppLocale.ko: '환자 · 보호자', AppLocale.vi: 'Bệnh nhân · Người nhà',
    AppLocale.ru: 'Пациент · Родственник', AppLocale.en: 'Patient or family',
  },
  'role.otherApp': {
    // 이 앱에서 쓸 수 없는 역할을 골랐을 때. 역할은 부여되지만 화면은
    // 다른 앱에 있습니다 — 어디로 가야 하는지 말해 줘야 합니다.
    AppLocale.ko: '이 역할의 화면은 다른 앱에 있습니다. 담당자에게 주소를 문의해 주세요.',
    AppLocale.vi: 'Màn hình cho vai trò này nằm ở ứng dụng khác. Vui lòng hỏi người phụ trách.',
    AppLocale.ru: 'Экраны для этой роли — в другом приложении. Уточните адрес у менеджера.',
    AppLocale.en: 'Screens for this role live in another app. Ask your coordinator for the address.',
  },
  'home.greeting': {
    // `{name}`을 치환합니다. 호칭 위치가 언어마다 달라서(한국어는 뒤,
    // 나머지는 앞) 접미사 한 조각으로는 만들 수 없습니다.
    AppLocale.ko: '{name}님',
    AppLocale.vi: 'Chào {name}',
    AppLocale.ru: 'Здравствуйте, {name}',
    AppLocale.en: 'Hi {name}',
  },
  'home.stage': {
    AppLocale.ko: '취업 준비 단계', AppLocale.vi: 'Giai đoạn chuẩn bị',
    AppLocale.ru: 'Этап подготовки', AppLocale.en: 'Getting ready',
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

  // ── 보호자 (SCR-301~307) ────────────────────────────────────────────────
  //
  // 보호자는 대개 병원에서 링크로 들어옵니다. 설명이 길면 읽지 않고 전화를
  // 겁니다. 문장을 짧게, 질문 형태로 둡니다.
  'guardian.home.ask': {
    AppLocale.ko: '간병인이 필요하신가요?',
    AppLocale.vi: 'Bạn cần người chăm sóc?',
    AppLocale.ru: 'Нужна сиделка?',
    AppLocale.en: 'Do you need a caregiver?',
  },
  'guardian.home.askSub': {
    AppLocale.ko: '병원과 기간만 알려주시면 자격을 확인한 간병사를 연결해 드립니다.',
    AppLocale.vi: 'Chỉ cần cho biết bệnh viện và thời gian, chúng tôi kết nối người chăm sóc đã được xác minh.',
    AppLocale.ru: 'Укажите больницу и срок — подберём проверенную сиделку.',
    AppLocale.en: 'Tell us the hospital and dates; we will connect a verified caregiver.',
  },
  'guardian.home.newRequest': {
    AppLocale.ko: '간병 신청하기', AppLocale.vi: 'Đăng ký chăm sóc',
    AppLocale.ru: 'Оформить заявку', AppLocale.en: 'Request care',
  },
  'guardian.home.history': {
    AppLocale.ko: '지난 이용 내역', AppLocale.vi: 'Lịch sử sử dụng',
    AppLocale.ru: 'История заявок', AppLocale.en: 'Past requests',
  },
  'guardian.home.none': {
    AppLocale.ko: '진행 중인 간병이 없습니다.',
    AppLocale.vi: 'Không có yêu cầu nào đang diễn ra.',
    AppLocale.ru: 'Нет активных заявок.',
    AppLocale.en: 'No care in progress.',
  },
  'guardian.hospital.ask': {
    AppLocale.ko: '어느 병원인가요?', AppLocale.vi: 'Bệnh viện nào?',
    AppLocale.ru: 'Какая больница?', AppLocale.en: 'Which hospital?',
  },
  'guardian.hospital.search': {
    AppLocale.ko: '병원 이름 또는 지역',
    AppLocale.vi: 'Tên bệnh viện hoặc khu vực',
    AppLocale.ru: 'Название больницы или район',
    AppLocale.en: 'Hospital name or area',
  },
  'guardian.hospital.available': {
    AppLocale.ko: '배정 가능한 간병사', AppLocale.vi: 'Người chăm sóc sẵn sàng',
    AppLocale.ru: 'Доступные сиделки', AppLocale.en: 'Caregivers available',
  },
  'guardian.hospital.none': {
    AppLocale.ko: '해당하는 병원이 없습니다. 지금은 제휴 병원만 신청할 수 있습니다.',
    AppLocale.vi: 'Không tìm thấy bệnh viện. Hiện chỉ nhận bệnh viện liên kết.',
    AppLocale.ru: 'Больница не найдена. Пока доступны только партнёрские больницы.',
    AppLocale.en: 'No matching hospital. Only partner hospitals are available for now.',
  },
  'guardian.form.ask': {
    AppLocale.ko: '언제부터 필요하신가요?', AppLocale.vi: 'Bạn cần từ khi nào?',
    AppLocale.ru: 'С какого дня нужна помощь?', AppLocale.en: 'When do you need care?',
  },
  'guardian.form.ward': {
    AppLocale.ko: '병실', AppLocale.vi: 'Phòng bệnh',
    AppLocale.ru: 'Палата', AppLocale.en: 'Room',
  },
  'guardian.form.wardHint': {
    AppLocale.ko: '예: 703호', AppLocale.vi: 'VD: phòng 703',
    AppLocale.ru: 'Напр.: палата 703', AppLocale.en: 'e.g. Room 703',
  },
  'guardian.form.start': {
    AppLocale.ko: '간병 시작', AppLocale.vi: 'Bắt đầu chăm sóc',
    AppLocale.ru: 'Начало ухода', AppLocale.en: 'Care starts',
  },
  'guardian.form.shift': {
    AppLocale.ko: '교대 방식', AppLocale.vi: 'Kiểu ca làm',
    AppLocale.ru: 'Режим смен', AppLocale.en: 'Shift pattern',
  },
  'guardian.form.recommended': {
    AppLocale.ko: '권장', AppLocale.vi: 'Khuyến nghị',
    AppLocale.ru: 'Рекомендуем', AppLocale.en: 'Recommended',
  },
  // 24시간 상주가 목록에 없는 이유를 적어 둡니다. 없는 이유를 쓰지 않으면
  // '왜 안 보이냐'는 문의가 그대로 옵니다 (§5.12).
  'guardian.form.no24h': {
    AppLocale.ko: '24시간 내내 필요하시면 8시간 3교대를 고르세요. 세 분이 나눠 맡습니다. 한 분이 24시간 상주하는 방식은 운영하지 않습니다 — 잠을 못 자는 상태로는 안전을 담보할 수 없습니다.',
    AppLocale.vi: 'Nếu cần cả ngày, hãy chọn 3 ca 8 giờ — ba người thay nhau. Chúng tôi không vận hành hình thức ở lại 24 giờ: người không ngủ được thì không thể đảm bảo an toàn.',
    AppLocale.ru: 'Если помощь нужна круглосуточно, выберите три смены по 8 часов — работают трое. Круглосуточное пребывание одного человека мы не практикуем: без сна безопасность не обеспечить.',
    AppLocale.en: 'If you need round-the-clock care, choose three 8-hour shifts — three caregivers share it. We do not run 24-hour live-in care: safety cannot be assured without sleep.',
  },
  'guardian.form.mobility': {
    AppLocale.ko: '거동 정도', AppLocale.vi: 'Khả năng vận động',
    AppLocale.ru: 'Подвижность', AppLocale.en: 'Mobility',
  },
  'guardian.form.support': {
    AppLocale.ko: '필요한 도움', AppLocale.vi: 'Hỗ trợ cần thiết',
    AppLocale.ru: 'Нужная помощь', AppLocale.en: 'Support needed',
  },
  'guardian.form.cautions': {
    AppLocale.ko: '특이사항', AppLocale.vi: 'Lưu ý',
    AppLocale.ru: 'Особые замечания', AppLocale.en: 'Notes',
  },
  'guardian.form.cautionsHint': {
    AppLocale.ko: '간병사가 알아야 할 내용을 적어 주세요.',
    AppLocale.vi: 'Hãy ghi những điều người chăm sóc cần biết.',
    AppLocale.ru: 'Напишите, что важно знать сиделке.',
    AppLocale.en: 'Write anything the caregiver should know.',
  },
  // 의료행위는 항목으로 존재하지 않습니다 (§6-2). 자유 입력에 들어오면
  // 서버가 스캔해 운영자 검토로 보냅니다 — 자동 거절이 아닙니다 (§6-15).
  'guardian.form.medicalNote': {
    AppLocale.ko: '투약 · 주사 · 상처 처치 같은 의료행위는 간병사가 할 수 없습니다. 간호사에게 요청해 주세요.',
    AppLocale.vi: 'Người chăm sóc không được thực hiện hành vi y tế như cho thuốc, tiêm, xử lý vết thương. Hãy nhờ điều dưỡng.',
    AppLocale.ru: 'Сиделка не выполняет медицинские действия — приём лекарств, уколы, обработку ран. Обратитесь к медсестре.',
    AppLocale.en: 'Caregivers cannot perform medical acts such as medication, injections, or wound care. Please ask a nurse.',
  },
  'guardian.form.submit': {
    AppLocale.ko: '신청하기', AppLocale.vi: 'Gửi yêu cầu',
    AppLocale.ru: 'Отправить заявку', AppLocale.en: 'Submit request',
  },
  'guardian.match.ask': {
    AppLocale.ko: '어느 분께 부탁할까요?', AppLocale.vi: 'Bạn muốn nhờ ai?',
    AppLocale.ru: 'Кого выберете?', AppLocale.en: 'Whom would you like?',
  },
  'guardian.match.count': {
    AppLocale.ko: '조건에 맞는 간병사 {n}명',
    AppLocale.vi: '{n} người chăm sóc phù hợp',
    AppLocale.ru: 'Подходящих сиделок: {n}',
    AppLocale.en: '{n} matching caregivers',
  },
  'guardian.match.career': {
    AppLocale.ko: '경력 {y}년 · 완료 {n}건',
    AppLocale.vi: '{y} năm kinh nghiệm · {n} ca hoàn thành',
    AppLocale.ru: 'Стаж {y} лет · выполнено {n}',
    AppLocale.en: '{y} yrs experience · {n} completed',
  },
  'guardian.match.verified': {
    AppLocale.ko: '신원 확인', AppLocale.vi: 'Đã xác minh',
    AppLocale.ru: 'Личность проверена', AppLocale.en: 'Identity verified',
  },
  'guardian.match.senior': {
    AppLocale.ko: '경력 3년 이상', AppLocale.vi: 'Trên 3 năm kinh nghiệm',
    AppLocale.ru: 'Стаж от 3 лет', AppLocale.en: '3+ years experience',
  },
  'guardian.match.noRating': {
    AppLocale.ko: '평가 없음', AppLocale.vi: 'Chưa có đánh giá',
    AppLocale.ru: 'Нет оценок', AppLocale.en: 'No ratings',
  },
  'guardian.match.busy': {
    AppLocale.ko: '해당 기간 일정 없음', AppLocale.vi: 'Không rảnh trong kỳ này',
    AppLocale.ru: 'Занята в этот период', AppLocale.en: 'Not available then',
  },
  // 금액을 만들지 않습니다 (§6-8 · U6 미확정). 자리는 두되 무엇을
  // 기다리는지 씁니다 — 자리를 지우면 결정 후 레이아웃을 다시 짜야 합니다.
  'guardian.cost.staffGuided': {
    AppLocale.ko: '담당자 안내', AppLocale.vi: 'Nhân viên sẽ hướng dẫn',
    AppLocale.ru: 'Сообщит менеджер', AppLocale.en: 'Staff will advise',
  },
  'guardian.match.costNote': {
    AppLocale.ko: '비용은 담당자가 안내합니다',
    AppLocale.vi: 'Nhân viên sẽ báo chi phí',
    AppLocale.ru: 'О стоимости сообщит менеджер',
    AppLocale.en: 'Our staff will advise on cost',
  },
  'guardian.match.pick': {
    AppLocale.ko: '선택', AppLocale.vi: 'Chọn',
    AppLocale.ru: 'Выбрать', AppLocale.en: 'Choose',
  },
  // 고른 순간 끝났다고 생각하면 기다리는 동안 문의가 그대로 옵니다 (§6-4).
  'guardian.match.threeSteps': {
    AppLocale.ko: '제안하면 간병사가 수락한 뒤 담당자가 확인합니다. 확인이 끝나야 확정됩니다.',
    AppLocale.vi: 'Sau khi bạn đề nghị, người chăm sóc chấp nhận rồi nhân viên xác nhận. Chỉ khi đó mới chốt.',
    AppLocale.ru: 'После вашего выбора сиделка принимает заявку, затем подтверждает менеджер. Только тогда всё окончательно.',
    AppLocale.en: 'After you choose, the caregiver accepts and our staff confirms. It is final only then.',
  },
  'guardian.match.offered': {
    AppLocale.ko: '{code} 님에게 제안했습니다',
    AppLocale.vi: 'Đã đề nghị {code}',
    AppLocale.ru: 'Предложено {code}',
    AppLocale.en: 'Offered to {code}',
  },
  'guardian.match.waiting': {
    AppLocale.ko: '간병사가 확인하는 중입니다. 수락하면 알려 드립니다.',
    AppLocale.vi: 'Người chăm sóc đang xem. Chúng tôi sẽ báo khi họ nhận.',
    AppLocale.ru: 'Сиделка просматривает заявку. Сообщим, когда примет.',
    AppLocale.en: 'The caregiver is reviewing. We will let you know when they accept.',
  },
  'guardian.match.accepted': {
    AppLocale.ko: '간병사가 수락했습니다. 담당자 확인이 끝나면 확정 안내를 보내 드립니다.',
    AppLocale.vi: 'Người chăm sóc đã nhận. Chúng tôi sẽ báo khi nhân viên xác nhận xong.',
    AppLocale.ru: 'Сиделка приняла заявку. Сообщим после подтверждения менеджером.',
    AppLocale.en: 'The caregiver accepted. We will confirm once our staff completes the check.',
  },
  'guardian.match.none': {
    AppLocale.ko: '지금 배정 가능한 간병사가 없습니다. 담당자가 계속 찾고 있습니다.',
    AppLocale.vi: 'Hiện chưa có người chăm sóc. Nhân viên vẫn đang tìm.',
    AppLocale.ru: 'Сейчас свободных сиделок нет. Менеджер продолжает поиск.',
    AppLocale.en: 'No caregiver is available right now. Our staff keeps looking.',
  },
  'guardian.match.excluded': {
    AppLocale.ko: '{n}명이 후보에서 빠졌습니다. 검증이 끝나지 않았거나 해당 기간에 일정이 없는 분들입니다.',
    AppLocale.vi: '{n} người bị loại — chưa hoàn tất xác minh hoặc không rảnh trong kỳ này.',
    AppLocale.ru: 'Исключено: {n}. Не завершена проверка либо заняты в этот период.',
    AppLocale.en: '{n} were excluded — verification incomplete or unavailable in this period.',
  },
  'guardian.confirm.ask': {
    AppLocale.ko: '이대로 신청할까요?', AppLocale.vi: 'Gửi như thế này nhé?',
    AppLocale.ru: 'Отправляем так?', AppLocale.en: 'Submit as is?',
  },
  'guardian.confirm.cost': {
    AppLocale.ko: '비용', AppLocale.vi: 'Chi phí',
    AppLocale.ru: 'Стоимость', AppLocale.en: 'Cost',
  },
  'guardian.confirm.careCost': {
    AppLocale.ko: '간병 비용', AppLocale.vi: 'Phí chăm sóc',
    AppLocale.ru: 'Стоимость ухода', AppLocale.en: 'Care fee',
  },
  'guardian.confirm.platformFee': {
    AppLocale.ko: '플랫폼 이용료', AppLocale.vi: 'Phí nền tảng',
    AppLocale.ru: 'Сервисный сбор', AppLocale.en: 'Platform fee',
  },
  'guardian.confirm.noPayment': {
    AppLocale.ko: '간병사 확인 후 확정됩니다. 확정 전에는 결제되지 않습니다.',
    AppLocale.vi: 'Chốt sau khi người chăm sóc xác nhận. Chưa chốt thì chưa thanh toán.',
    AppLocale.ru: 'Заявка станет окончательной после подтверждения. До этого оплаты нет.',
    AppLocale.en: 'It is final after the caregiver confirms. Nothing is charged before that.',
  },
  'guardian.confirm.assigned': {
    AppLocale.ko: '배정된 간병사', AppLocale.vi: 'Người chăm sóc được phân công',
    AppLocale.ru: 'Назначенная сиделка', AppLocale.en: 'Assigned caregiver',
  },
  'guardian.confirm.progress': {
    AppLocale.ko: '진행 상황 보기', AppLocale.vi: 'Xem tiến trình',
    AppLocale.ru: 'Посмотреть ход', AppLocale.en: 'View progress',
  },
  // 업무범위 검토는 거절이 아닙니다 (§6-15). 그렇게 말해 주지 않으면
  // 보호자는 신청이 취소된 줄 압니다.
  'guardian.confirm.opsReview': {
    AppLocale.ko: '적어 주신 특이사항에 간병사가 할 수 없는 일이 포함된 것 같아 담당자가 확인하고 있습니다. 확인이 끝나면 다시 간병사를 찾습니다 — 신청이 취소된 것이 아닙니다.',
    AppLocale.vi: 'Trong phần lưu ý có thể có việc người chăm sóc không được làm, nhân viên đang kiểm tra. Xong sẽ tìm lại người chăm sóc — yêu cầu chưa bị huỷ.',
    AppLocale.ru: 'В замечаниях, возможно, есть то, что сиделке делать нельзя — менеджер проверяет. После проверки поиск продолжится: заявка не отменена.',
    AppLocale.en: 'Your notes may include something a caregiver cannot do, so our staff is checking. We will resume the search afterwards — your request is not cancelled.',
  },
  'guardian.live.title': {
    AppLocale.ko: '진행 중 간병', AppLocale.vi: 'Đang chăm sóc',
    AppLocale.ru: 'Уход в процессе', AppLocale.en: 'Care in progress',
  },
  'guardian.live.working': {
    AppLocale.ko: '근무 중', AppLocale.vi: 'Đang làm việc',
    AppLocale.ru: 'На смене', AppLocale.en: 'On shift',
  },
  'guardian.live.beforeStart': {
    AppLocale.ko: '시작 전', AppLocale.vi: 'Chưa bắt đầu',
    AppLocale.ru: 'До начала', AppLocale.en: 'Not started',
  },
  'guardian.live.ended': {
    AppLocale.ko: '근무 종료', AppLocale.vi: 'Đã kết thúc',
    AppLocale.ru: 'Смена окончена', AppLocale.en: 'Shift ended',
  },
  'guardian.live.startedAt': {
    AppLocale.ko: '시작 {t}', AppLocale.vi: 'Bắt đầu {t}',
    AppLocale.ru: 'Начало {t}', AppLocale.en: 'Started {t}',
  },
  'guardian.live.todayLog': {
    AppLocale.ko: '오늘 기록', AppLocale.vi: 'Ghi nhận hôm nay',
    AppLocale.ru: 'Записи за сегодня', AppLocale.en: 'Records today',
  },
  'guardian.live.noLog': {
    AppLocale.ko: '아직 기록이 없습니다.', AppLocale.vi: 'Chưa có ghi nhận nào.',
    AppLocale.ru: 'Записей пока нет.', AppLocale.en: 'No records yet.',
  },
  'guardian.live.corrected': {
    AppLocale.ko: '(수정됨)', AppLocale.vi: '(đã sửa)',
    AppLocale.ru: '(исправлено)', AppLocale.en: '(corrected)',
  },
  'guardian.live.call': {
    AppLocale.ko: '전화 상담', AppLocale.vi: 'Gọi tư vấn',
    AppLocale.ru: 'Позвонить', AppLocale.en: 'Call support',
  },
  // 중단 요청을 버튼으로 만들지 않습니다 — 되돌리기 어려운 동작입니다.
  'guardian.live.stopRequest': {
    AppLocale.ko: '간병 중단 요청', AppLocale.vi: 'Yêu cầu dừng chăm sóc',
    AppLocale.ru: 'Запросить прекращение', AppLocale.en: 'Request to stop care',
  },
  'guardian.live.slaNote': {
    AppLocale.ko: '불편한 점이 있으면 담당자에게 알려 주세요. 안전 · 부당대우 · 업무범위와 관련된 신고는 4시간 안에 1차 답변을 드립니다.',
    AppLocale.vi: 'Có vấn đề gì hãy báo nhân viên. Với an toàn, đối xử bất công, phạm vi công việc, chúng tôi phản hồi đầu tiên trong 4 giờ.',
    AppLocale.ru: 'Если что-то не так, сообщите менеджеру. По безопасности, некорректному обращению и объёму работ первый ответ — в течение 4 часов.',
    AppLocale.en: 'Tell our staff if anything is wrong. For safety, mistreatment, or scope issues we reply within 4 hours.',
  },
  'guardian.history.title': {
    AppLocale.ko: '이용 내역', AppLocale.vi: 'Lịch sử sử dụng',
    AppLocale.ru: 'История', AppLocale.en: 'History',
  },
  'guardian.history.thisYear': {
    AppLocale.ko: '올해 이용', AppLocale.vi: 'Sử dụng năm nay',
    AppLocale.ru: 'В этом году', AppLocale.en: 'This year',
  },
  'guardian.history.count': {
    AppLocale.ko: '이용 건수', AppLocale.vi: 'Số lần sử dụng',
    AppLocale.ru: 'Количество заявок', AppLocale.en: 'Requests',
  },
  'guardian.history.none': {
    AppLocale.ko: '완료된 간병이 없습니다.', AppLocale.vi: 'Chưa có ca chăm sóc hoàn thành.',
    AppLocale.ru: 'Завершённых заявок нет.', AppLocale.en: 'No completed care yet.',
  },
  'guardian.history.recordedStart': {
    AppLocale.ko: '기록된 시작', AppLocale.vi: 'Bắt đầu (đã ghi)',
    AppLocale.ru: 'Начало (по записи)', AppLocale.en: 'Recorded start',
  },
  'guardian.history.recordedEnd': {
    AppLocale.ko: '기록된 종료', AppLocale.vi: 'Kết thúc (đã ghi)',
    AppLocale.ru: 'Конец (по записи)', AppLocale.en: 'Recorded end',
  },
  'guardian.history.noRecord': {
    AppLocale.ko: '기록 없음', AppLocale.vi: 'Không có ghi nhận',
    AppLocale.ru: 'Нет записи', AppLocale.en: 'No record',
  },
  // 정정이 있었다는 사실을 숨기지 않습니다. 원본이 남아 있다는 것 자체가
  // 이견이 생겼을 때의 근거입니다 (§5.4).
  'guardian.history.correctedNote': {
    AppLocale.ko: '시각이 정정된 기록이 있습니다. 원본도 함께 보관됩니다.',
    AppLocale.vi: 'Có ghi nhận đã sửa giờ. Bản gốc vẫn được lưu.',
    AppLocale.ru: 'Есть записи с исправленным временем. Оригинал сохранён.',
    AppLocale.en: 'Some times were corrected. The originals are kept as well.',
  },
  'guardian.history.viewLogs': {
    AppLocale.ko: '기록 전체 보기', AppLocale.vi: 'Xem toàn bộ ghi nhận',
    AppLocale.ru: 'Все записи', AppLocale.en: 'View all records',
  },
  'guardian.history.costNote': {
    AppLocale.ko: '비용은 아직 이 화면에 나오지 않습니다. 간병 비용과 취소 규정이 확정되면 여기에 함께 표시됩니다. 근무 시간에 이견이 있으면 담당자에게 알려 주세요 — 위의 시작 · 종료 기록이 근거가 되고, 이 기록은 지워지거나 덮어써지지 않습니다.',
    AppLocale.vi: 'Chi phí chưa hiển thị ở đây. Khi phí chăm sóc và quy định huỷ được chốt, chúng sẽ xuất hiện. Nếu có ý kiến về giờ làm, hãy báo nhân viên — ghi nhận bắt đầu/kết thúc ở trên là căn cứ và không bị xoá hay ghi đè.',
    AppLocale.ru: 'Стоимость здесь пока не показывается. Она появится, когда утвердят тарифы и правила отмены. При разногласиях по часам сообщите менеджеру — записи начала и конца выше служат основанием и не удаляются и не перезаписываются.',
    AppLocale.en: 'Cost is not shown here yet. It will appear once fees and the cancellation policy are set. If you disagree about hours, tell our staff — the start and end records above are the evidence, and they are never deleted or overwritten.',
  },
  'guardian.me.title': {
    AppLocale.ko: '내 정보', AppLocale.vi: 'Thông tin của tôi',
    AppLocale.ru: 'Мои данные', AppLocale.en: 'My info',
  },
  'guardian.request.title': {
    AppLocale.ko: '간병 신청', AppLocale.vi: 'Đăng ký chăm sóc',
    AppLocale.ru: 'Заявка на уход', AppLocale.en: 'Care request',
  },
  'guardian.hospitalMissing': {
    AppLocale.ko: '병원 미지정', AppLocale.vi: 'Chưa chọn bệnh viện',
    AppLocale.ru: 'Больница не указана', AppLocale.en: 'Hospital not set',
  },

  // ── 역할 전환 ───────────────────────────────────────────────────────────
  //
  // 앱이 셋으로 나뉘어 있을 때는 필요 없던 것입니다. 하나로 합치면서
  // '지금 어느 역할로 보고 있는지'를 사용자가 알아야 하게 됐습니다.
  'role.switch': {
    AppLocale.ko: '역할 바꾸기', AppLocale.vi: 'Đổi vai trò',
    AppLocale.ru: 'Сменить роль', AppLocale.en: 'Switch role',
  },
  'role.alreadyHeld': {
    AppLocale.ko: '이미 가지고 있는 역할입니다.',
    AppLocale.vi: 'Bạn đã có vai trò này.',
    AppLocale.ru: 'Эта роль у вас уже есть.',
    AppLocale.en: 'You already have this role.',
  },
  'role.addAnother': {
    AppLocale.ko: '다른 역할 추가하기', AppLocale.vi: 'Thêm vai trò khác',
    AppLocale.ru: 'Добавить роль', AppLocale.en: 'Add another role',
  },
  'tab.today': {
    AppLocale.ko: '오늘', AppLocale.vi: 'Hôm nay', AppLocale.ru: 'Сегодня', AppLocale.en: 'Today',
  },
  'tab.schedule': {
    AppLocale.ko: '일정', AppLocale.vi: 'Lịch', AppLocale.ru: 'График', AppLocale.en: 'Schedule',
  },
  'tab.payout': {
    AppLocale.ko: '정산', AppLocale.vi: 'Thanh toán', AppLocale.ru: 'Расчёт', AppLocale.en: 'Pay',
  },
  'tab.profile': {
    AppLocale.ko: '내 정보', AppLocale.vi: 'Của tôi', AppLocale.ru: 'Профиль', AppLocale.en: 'My info',
  },
  'payout.notOpen': {
    AppLocale.ko: '정산 화면은 아직 열리지 않았습니다',
    AppLocale.vi: 'Màn hình thanh toán chưa mở',
    AppLocale.ru: 'Раздел расчёта пока не открыт',
    AppLocale.en: 'The pay screen is not open yet',
  },
  'payout.notOpen.why': {
    // 준비 중이라고만 쓰면 언제 열리냐는 문의가 옵니다. 무엇이 정해져야
    // 열리는지 말합니다.
    AppLocale.ko: '고용 형태(직접고용·위탁·중개)에 따라 정산 방식이 달라집니다. 확정되기 전에는 금액을 보여 드릴 수 없습니다. 근무 기록은 정상적으로 쌓이고 있습니다.',
    AppLocale.vi: 'Cách thanh toán thay đổi theo hình thức tuyển dụng. Trước khi xác định, chúng tôi không thể hiển thị số tiền. Bản ghi ca làm việc vẫn được lưu.',
    AppLocale.ru: 'Способ расчёта зависит от формы найма. До её определения суммы не показываются. Записи смен сохраняются.',
    AppLocale.en: 'How pay is calculated depends on the employment model. Until that is settled we cannot show amounts. Your shift records are still being saved.',
  },
  'home.todayShift': {
    AppLocale.ko: '오늘 근무', AppLocale.vi: 'Ca hôm nay',
    AppLocale.ru: 'Смена сегодня', AppLocale.en: "Today's shift",
  },
  'home.checkList': {
    AppLocale.ko: '오늘 확인할 것', AppLocale.vi: 'Cần kiểm tra hôm nay',
    AppLocale.ru: 'Проверить сегодня', AppLocale.en: 'Check today',
  },
  'home.weekSummary': {
    AppLocale.ko: '이번 주 근무', AppLocale.vi: 'Ca tuần này',
    AppLocale.ru: 'Смены на неделе', AppLocale.en: 'Shifts this week',
  },
  'home.nextShift': {
    AppLocale.ko: '다음 근무', AppLocale.vi: 'Ca tiếp theo',
    AppLocale.ru: 'Следующая смена', AppLocale.en: 'Next shift',
  },
  'home.offline': {
    AppLocale.ko: '인터넷이 끊겨도 기록은 저장됩니다',
    AppLocale.vi: 'Bản ghi vẫn được lưu khi mất mạng',
    AppLocale.ru: 'Записи сохраняются даже без интернета',
    AppLocale.en: 'Your records are saved even offline',
  },
  'home.beforeStart': {
    AppLocale.ko: '시작 전', AppLocale.vi: 'Chưa bắt đầu',
    AppLocale.ru: 'До начала', AppLocale.en: 'Not started',
  },
  'home.inService': {
    AppLocale.ko: '근무 중', AppLocale.vi: 'Đang làm', AppLocale.ru: 'В смене', AppLocale.en: 'On shift',
  },
  'home.count': {
    AppLocale.ko: '건', AppLocale.vi: 'ca', AppLocale.ru: 'смен', AppLocale.en: 'shifts',
  },
  'shift.wardUnknown': {
    AppLocale.ko: '병실 미지정', AppLocale.vi: 'Chưa có phòng',
    AppLocale.ru: 'Палата не указана', AppLocale.en: 'Room not set',
  },
  'schedule.shifts': {
    AppLocale.ko: '근무 일정', AppLocale.vi: 'Lịch ca làm',
    AppLocale.ru: 'График смен', AppLocale.en: 'My shifts',
  },
  'schedule.availability': {
    AppLocale.ko: '근무 가능 시간', AppLocale.vi: 'Thời gian có thể làm',
    AppLocale.ru: 'Доступное время', AppLocale.en: 'When I can work',
  },
  'schedule.thisWeek': {
    AppLocale.ko: '이번 주', AppLocale.vi: 'Tuần này',
    AppLocale.ru: 'Эта неделя', AppLocale.en: 'This week',
  },
  'schedule.hours': {
    AppLocale.ko: '시간', AppLocale.vi: 'giờ', AppLocale.ru: 'ч', AppLocale.en: 'hours',
  },
  'schedule.state.upcoming': {
    AppLocale.ko: '진행 예정', AppLocale.vi: 'Sắp tới',
    AppLocale.ru: 'Предстоит', AppLocale.en: 'Upcoming',
  },
  'schedule.state.recorded': {
    AppLocale.ko: '기록 완료', AppLocale.vi: 'Đã ghi',
    AppLocale.ru: 'Записано', AppLocale.en: 'Recorded',
  },
  'schedule.state.needsRecord': {
    // 이 상태가 이 화면의 존재 이유입니다. 기록이 없으면 근무시간이 집계되지
    // 않고, 그러면 분쟁에서 근거가 없습니다 (§5.4).
    AppLocale.ko: '기록 필요', AppLocale.vi: 'Cần ghi lại',
    AppLocale.ru: 'Нужна запись', AppLocale.en: 'Needs record',
  },
  'schedule.noShifts': {
    AppLocale.ko: '예정된 근무가 없습니다', AppLocale.vi: 'Không có ca nào',
    AppLocale.ru: 'Смен нет', AppLocale.en: 'No shifts scheduled',
  },
  'record.title': {
    AppLocale.ko: '근무 기록', AppLocale.vi: 'Bản ghi ca',
    AppLocale.ru: 'Запись смены', AppLocale.en: 'Shift record',
  },
  'record.didToday': {
    AppLocale.ko: '오늘 한 일', AppLocale.vi: 'Việc đã làm hôm nay',
    AppLocale.ru: 'Что сделано сегодня', AppLocale.en: 'What I did today',
  },
  'record.notes': {
    AppLocale.ko: '특이사항', AppLocale.vi: 'Ghi chú đặc biệt',
    AppLocale.ru: 'Особые заметки', AppLocale.en: 'Anything unusual',
  },
  'record.notesHint': {
    AppLocale.ko: '필요할 때만 적어주세요',
    AppLocale.vi: 'Chỉ ghi khi cần',
    AppLocale.ru: 'Пишите только при необходимости',
    AppLocale.en: 'Only if something came up',
  },
  'record.save': {
    AppLocale.ko: '저장하기', AppLocale.vi: 'Lưu lại',
    AppLocale.ru: 'Сохранить', AppLocale.en: 'Save',
  },
  'record.saved': {
    AppLocale.ko: '저장했습니다', AppLocale.vi: 'Đã lưu',
    AppLocale.ru: 'Сохранено', AppLocale.en: 'Saved',
  },
  'record.offlineQueued': {
    // 시안의 앰버 배너. 병실은 신호가 약하고, 기록이 날아갈까 봐 안 쓰는
    // 것이 가장 흔한 이탈 이유입니다. 쓰기 전에 말해 줘야 합니다.
    AppLocale.ko: '오프라인 · 저장 후 자동 전송',
    AppLocale.vi: 'Ngoại tuyến · Sẽ tự gửi sau khi lưu',
    AppLocale.ru: 'Оффлайн · Отправится автоматически',
    AppLocale.en: 'Offline · Will send automatically',
  },
  'record.pending': {
    AppLocale.ko: '전송 대기', AppLocale.vi: 'Chờ gửi',
    AppLocale.ru: 'Ожидает отправки', AppLocale.en: 'Waiting to send',
  },
  'record.photo': {
    AppLocale.ko: '사진', AppLocale.vi: 'Ảnh', AppLocale.ru: 'Фото', AppLocale.en: 'Photo',
  },
  'record.photoLater': {
    // 사진 업로드는 presigned URL 경로가 필요합니다 (§6-5). 지금은 화면만
    // 두고 눌렀을 때 무엇이 남았는지 말합니다 — 버튼이 아무 반응도 없으면
    // 앱이 고장 난 것으로 읽힙니다.
    AppLocale.ko: '사진 첨부는 준비 중입니다. 특이사항에 글로 적어 주세요.',
    AppLocale.vi: 'Đính kèm ảnh đang được chuẩn bị. Hãy ghi bằng chữ.',
    AppLocale.ru: 'Прикрепление фото готовится. Опишите словами.',
    AppLocale.en: 'Photo attachment is not ready yet. Please describe it in text.',
  },
  'detail.callHospital': {
    AppLocale.ko: '병원 연락', AppLocale.vi: 'Gọi bệnh viện',
    AppLocale.ru: 'Позвонить в больницу', AppLocale.en: 'Call hospital',
  },
  'detail.directions': {
    AppLocale.ko: '길찾기', AppLocale.vi: 'Chỉ đường',
    AppLocale.ru: 'Маршрут', AppLocale.en: 'Directions',
  },
  'detail.writeRecord': {
    AppLocale.ko: '근무 기록 작성', AppLocale.vi: 'Viết bản ghi ca',
    AppLocale.ru: 'Заполнить запись', AppLocale.en: 'Write shift record',
  },
  'detail.notStarted': {
    AppLocale.ko: '근무를 시작해야 기록할 수 있습니다',
    AppLocale.vi: 'Cần bắt đầu ca mới ghi được',
    AppLocale.ru: 'Записывать можно после начала смены',
    AppLocale.en: 'Start the shift before recording',
  },
  'common.save': {
    AppLocale.ko: '저장', AppLocale.vi: 'Lưu', AppLocale.ru: 'Сохранить', AppLocale.en: 'Save',
  },
  'common.logout': {
    AppLocale.ko: '로그아웃', AppLocale.vi: 'Đăng xuất', AppLocale.ru: 'Выйти', AppLocale.en: 'Log out',
  },
  'profile.phone': {
    AppLocale.ko: '휴대폰 번호', AppLocale.vi: 'Số điện thoại',
    AppLocale.ru: 'Номер телефона', AppLocale.en: 'Phone number',
  },
  'profile.language': {
    AppLocale.ko: '언어', AppLocale.vi: 'Ngôn ngữ',
    AppLocale.ru: 'Язык', AppLocale.en: 'Language',
  },
  'login.send': {
    AppLocale.ko: '인증번호 받기',
    AppLocale.vi: 'Nhận mã',
    AppLocale.ru: 'Получить код',
    AppLocale.en: 'Get code',
  },
  'login.verify': {
    AppLocale.ko: '확인', AppLocale.vi: 'Xác nhận', AppLocale.ru: 'Подтвердить', AppLocale.en: 'Confirm',
  },
  'home.noShift': {
    AppLocale.ko: '오늘은 근무가 없습니다',
    AppLocale.vi: 'Hôm nay không có ca làm',
    AppLocale.ru: 'Сегодня смен нет',
    AppLocale.en: 'No shift today',
  },
  'home.offerPending': {
    AppLocale.ko: '새 근무 제안이 있습니다',
    AppLocale.vi: 'Có đề nghị ca làm mới',
    AppLocale.ru: 'Есть новое предложение',
    AppLocale.en: 'You have a new offer',
  },
  'home.accept': {
    AppLocale.ko: '수락하기', AppLocale.vi: 'Chấp nhận', AppLocale.ru: 'Принять', AppLocale.en: 'Accept',
  },
  'home.decline': {
    AppLocale.ko: '거절', AppLocale.vi: 'Từ chối', AppLocale.ru: 'Отклонить', AppLocale.en: 'Decline',
  },
  'home.waitingConfirm': {
    AppLocale.ko: '담당자 확인을 기다리는 중입니다',
    AppLocale.vi: 'Đang chờ quản lý xác nhận',
    AppLocale.ru: 'Ожидается подтверждение координатора',
    AppLocale.en: 'Waiting for the coordinator to confirm',
  },
  'home.schedule': {
    AppLocale.ko: '일정 보기', AppLocale.vi: 'Xem lịch', AppLocale.ru: 'Расписание', AppLocale.en: 'Schedule',
  },
  'home.monthDone': {
    AppLocale.ko: '이번 달 완료',
    AppLocale.vi: 'Hoàn thành tháng này',
    AppLocale.ru: 'Завершено в этом месяце',
    AppLocale.en: 'Completed this month',
  },
  // ── SCR-402 일정 ────────────────────────────────────────────────────────
  'schedule.title': {
    AppLocale.ko: '일정', AppLocale.vi: 'Lịch làm việc', AppLocale.ru: 'Расписание', AppLocale.en: 'Schedule',
  },
  'schedule.available': {
    AppLocale.ko: '일할 수 있는 기간',
    AppLocale.vi: 'Thời gian có thể làm',
    AppLocale.ru: 'Доступное время',
    AppLocale.en: 'Available',
  },
  'schedule.blocked': {
    AppLocale.ko: '쉬는 기간',
    AppLocale.vi: 'Thời gian nghỉ',
    AppLocale.ru: 'Недоступное время',
    AppLocale.en: 'Unavailable',
  },
  'schedule.add': {
    AppLocale.ko: '기간 추가', AppLocale.vi: 'Thêm khoảng', AppLocale.ru: 'Добавить период', AppLocale.en: 'Add period',
  },
  'schedule.empty': {
    AppLocale.ko: '등록한 기간이 없습니다. 일할 수 있는 기간을 넣어야 배정을 받습니다.',
    AppLocale.vi: 'Chưa có khoảng nào. Hãy thêm thời gian có thể làm để được phân công.',
    AppLocale.ru: 'Периодов нет. Добавьте доступное время, чтобы получать назначения.',
    AppLocale.en: 'No periods yet. Add your available time to receive assignments.',
  },
  'schedule.from': {
    AppLocale.ko: '시작', AppLocale.vi: 'Bắt đầu', AppLocale.ru: 'Начало', AppLocale.en: 'From',
  },
  'schedule.to': {
    AppLocale.ko: '종료', AppLocale.vi: 'Kết thúc', AppLocale.ru: 'Конец', AppLocale.en: 'To',
  },
  // ── SCR-403 근무 상세 ───────────────────────────────────────────────────
  'detail.title': {
    AppLocale.ko: '근무 내용',
    AppLocale.vi: 'Chi tiết ca làm',
    AppLocale.ru: 'Детали смены',
    AppLocale.en: 'Shift details',
  },
  'detail.hospital': {
    AppLocale.ko: '병원', AppLocale.vi: 'Bệnh viện', AppLocale.ru: 'Больница', AppLocale.en: 'Hospital',
  },
  'detail.ward': {
    AppLocale.ko: '병실', AppLocale.vi: 'Phòng bệnh', AppLocale.ru: 'Палата', AppLocale.en: 'Room',
  },
  'detail.shift': {
    AppLocale.ko: '교대', AppLocale.vi: 'Ca làm', AppLocale.ru: 'Смена', AppLocale.en: 'Shift',
  },
  'detail.support': {
    AppLocale.ko: '필요한 지원',
    AppLocale.vi: 'Hỗ trợ cần thiết',
    AppLocale.ru: 'Требуемая помощь',
    AppLocale.en: 'Support needed',
  },
  'detail.mobility': {
    AppLocale.ko: '거동 정도',
    AppLocale.vi: 'Khả năng vận động',
    AppLocale.ru: 'Подвижность',
    AppLocale.en: 'Mobility',
  },
  'detail.cautions': {
    AppLocale.ko: '주의사항', AppLocale.vi: 'Lưu ý', AppLocale.ru: 'Примечания', AppLocale.en: 'Notes',
  },
  'detail.scopeWarning': {
    AppLocale.ko: '이 요청에는 간병사가 할 수 없는 일이 포함돼 있었습니다. 현장에서 같은 요구를 받으면 거절하고 담당자에게 알리세요.',
    AppLocale.vi: 'Yêu cầu này từng có việc mà người chăm sóc không được làm. Nếu bị yêu cầu tại chỗ, hãy từ chối và báo cho quản lý.',
    AppLocale.ru: 'В этой заявке были задачи, которые сиделке выполнять нельзя. Если попросят на месте — откажитесь и сообщите координатору.',
    AppLocale.en: 'This request included tasks a caregiver may not perform. If asked on site, refuse and tell the coordinator.',
  },
  // ── SCR-404 근무 시작·종료 ──────────────────────────────────────────────
  'shift.title': {
    AppLocale.ko: '근무 기록', AppLocale.vi: 'Ghi nhận ca làm', AppLocale.ru: 'Учёт смены', AppLocale.en: 'Shift record',
  },
  'shift.start': {
    AppLocale.ko: '근무 시작', AppLocale.vi: 'Bắt đầu ca', AppLocale.ru: 'Начать смену', AppLocale.en: 'Start shift',
  },
  'shift.end': {
    AppLocale.ko: '근무 종료', AppLocale.vi: 'Kết thúc ca', AppLocale.ru: 'Завершить смену', AppLocale.en: 'End shift',
  },
  'shift.scanQr': {
    AppLocale.ko: '병실 QR 코드를 입력하세요',
    AppLocale.vi: 'Nhập mã QR của phòng bệnh',
    AppLocale.ru: 'Введите QR-код палаты',
    AppLocale.en: 'Enter the room QR code',
  },
  'shift.qrHelp': {
    AppLocale.ko: '병실 문에 붙은 코드입니다. 없으면 담당자에게 연락하세요.',
    AppLocale.vi: 'Mã dán trên cửa phòng bệnh. Nếu không có, hãy liên hệ quản lý.',
    AppLocale.ru: 'Код на двери палаты. Если его нет — свяжитесь с координатором.',
    AppLocale.en: 'The code on the room door. If it is missing, contact the coordinator.',
  },
  'shift.started': {
    AppLocale.ko: '시작함', AppLocale.vi: 'Đã bắt đầu', AppLocale.ru: 'Начата', AppLocale.en: 'Started',
  },
  'shift.ended': {
    AppLocale.ko: '종료함', AppLocale.vi: 'Đã kết thúc', AppLocale.ru: 'Завершена', AppLocale.en: 'Ended',
  },
  'break.start': {
    AppLocale.ko: '휴게 시작', AppLocale.vi: 'Bắt đầu nghỉ',
    AppLocale.ru: 'Начать перерыв', AppLocale.en: 'Start break',
  },
  'break.end': {
    AppLocale.ko: '휴게 종료', AppLocale.vi: 'Kết thúc nghỉ',
    AppLocale.ru: 'Закончить перерыв', AppLocale.en: 'End break',
  },
  'break.onBreak': {
    AppLocale.ko: '휴게 중', AppLocale.vi: 'Đang nghỉ',
    AppLocale.ru: 'Перерыв', AppLocale.en: 'On break',
  },
  'break.help': {
    AppLocale.ko: '쉬실 때 눌러 주세요. 찍은 시간만 휴게로 처리되고, 찍지 않으면 임금에서 빠지지 않습니다.',
    AppLocale.vi: 'Hãy bấm khi bạn nghỉ. Chỉ thời gian đã ghi mới tính là nghỉ; nếu không ghi, lương không bị trừ.',
    AppLocale.ru: 'Нажмите, когда отдыхаете. Перерывом считается только отмеченное время; без отметки из зарплаты ничего не вычитается.',
    AppLocale.en: 'Tap when you take a break. Only recorded time counts as a break; if you do not record it, nothing is deducted from your pay.',
  },
  'break.total': {
    AppLocale.ko: '오늘 휴게', AppLocale.vi: 'Nghỉ hôm nay',
    AppLocale.ru: 'Перерыв сегодня', AppLocale.en: 'Break today',
  },
  'shift.logs': {
    AppLocale.ko: '기록', AppLocale.vi: 'Nhật ký', AppLocale.ru: 'Записи', AppLocale.en: 'Records',
  },
  'shift.addLog': {
    AppLocale.ko: '기록 남기기', AppLocale.vi: 'Thêm ghi chép', AppLocale.ru: 'Добавить запись', AppLocale.en: 'Add record',
  },
  'shift.appendOnly': {
    AppLocale.ko: '기록은 지우거나 고칠 수 없습니다. 잘못 적었으면 담당자에게 알리세요 — 정정 기록이 따로 남습니다.',
    AppLocale.vi: 'Không thể xóa hoặc sửa ghi chép. Nếu ghi sai, hãy báo quản lý — bản đính chính sẽ được lưu riêng.',
    AppLocale.ru: 'Записи нельзя удалить или изменить. Если ошиблись — сообщите координатору, исправление сохранится отдельно.',
    AppLocale.en: 'Records cannot be deleted or edited. If you made a mistake, tell the coordinator — a correction is saved separately.',
  },
  // ── 오류 ────────────────────────────────────────────────────────────────
  'error.network': {
    AppLocale.ko: '연결에 실패했습니다. 잠시 후 다시 시도해 주세요.',
    AppLocale.vi: 'Kết nối thất bại. Vui lòng thử lại sau.',
    AppLocale.ru: 'Не удалось подключиться. Попробуйте позже.',
    AppLocale.en: 'Connection failed. Please try again shortly.',
  },
  'error.qrMismatch': {
    AppLocale.ko: '다른 병실의 코드입니다. 배정된 병실의 코드를 확인하세요.',
    AppLocale.vi: 'Đây là mã của phòng khác. Hãy kiểm tra mã phòng được phân công.',
    AppLocale.ru: 'Это код другой палаты. Проверьте код назначенной палаты.',
    AppLocale.en: 'This code belongs to another room. Check the code of your assigned room.',
  },
  'error.qrRequired': {
    AppLocale.ko: '병실 QR 코드가 필요합니다.',
    AppLocale.vi: 'Cần mã QR của phòng bệnh.',
    AppLocale.ru: 'Требуется QR-код палаты.',
    AppLocale.en: 'The room QR code is required.',
  },
  'error.transition': {
    AppLocale.ko: '지금은 할 수 없습니다. 화면을 새로고침해 주세요.',
    AppLocale.vi: 'Hiện không thể thực hiện. Vui lòng làm mới màn hình.',
    AppLocale.ru: 'Сейчас это невозможно. Обновите экран.',
    AppLocale.en: 'Not possible right now. Please refresh the screen.',
  },
  'error.availabilityBooked': {
    AppLocale.ko: '이 기간에 배정이 있어 지울 수 없습니다.',
    AppLocale.vi: 'Không thể xóa vì đã có phân công trong khoảng này.',
    AppLocale.ru: 'Нельзя удалить: на этот период есть назначение.',
    AppLocale.en: 'Cannot remove: an assignment falls inside this period.',
  },
  'error.generic': {
    AppLocale.ko: '문제가 발생했습니다.',
    AppLocale.vi: 'Đã xảy ra sự cố.',
    AppLocale.ru: 'Произошла ошибка.',
    AppLocale.en: 'Something went wrong.',
  },
};

const Map<String, Map<AppLocale, String>> _codes = {
  'H8_3SHIFT': {
    AppLocale.ko: '8시간 3교대', AppLocale.vi: '3 ca 8 giờ',
    AppLocale.ru: '3 смены по 8 ч', AppLocale.en: '8h · 3 shifts',
  },
  'H12_2SHIFT': {
    AppLocale.ko: '12시간 2교대', AppLocale.vi: '2 ca 12 giờ',
    AppLocale.ru: '2 смены по 12 ч', AppLocale.en: '12h · 2 shifts',
  },
  'H24_LIVE_IN': {
    AppLocale.ko: '24시간 상주', AppLocale.vi: 'Ở lại 24 giờ',
    AppLocale.ru: 'Круглосуточно', AppLocale.en: '24h live-in',
  },
  'INDEPENDENT': {
    AppLocale.ko: '스스로 가능', AppLocale.vi: 'Tự làm được',
    AppLocale.ru: 'Самостоятельно', AppLocale.en: 'Independent',
  },
  'PARTIAL_ASSIST': {
    AppLocale.ko: '부분 도움 필요', AppLocale.vi: 'Cần hỗ trợ một phần',
    AppLocale.ru: 'Частичная помощь', AppLocale.en: 'Partial assistance',
  },
  'FULL_ASSIST': {
    AppLocale.ko: '전적인 도움 필요', AppLocale.vi: 'Cần hỗ trợ hoàn toàn',
    AppLocale.ru: 'Полная помощь', AppLocale.en: 'Full assistance',
  },
  'MEAL_SUPPORT': {
    AppLocale.ko: '식사 도움', AppLocale.vi: 'Hỗ trợ ăn uống',
    AppLocale.ru: 'Помощь с питанием', AppLocale.en: 'Meal support',
  },
  'MOBILITY': {
    AppLocale.ko: '이동 · 보행 보조', AppLocale.vi: 'Hỗ trợ di chuyển',
    AppLocale.ru: 'Помощь при передвижении', AppLocale.en: 'Mobility support',
  },
  'HYGIENE': {
    AppLocale.ko: '세면 · 위생 지원', AppLocale.vi: 'Hỗ trợ vệ sinh',
    AppLocale.ru: 'Гигиена', AppLocale.en: 'Hygiene support',
  },
  'POSITION_CHANGE': {
    AppLocale.ko: '체위 변경', AppLocale.vi: 'Thay đổi tư thế',
    AppLocale.ru: 'Смена положения', AppLocale.en: 'Repositioning',
  },
  'COMPANION': {
    AppLocale.ko: '말벗 · 정서 지원', AppLocale.vi: 'Trò chuyện · hỗ trợ tinh thần',
    AppLocale.ru: 'Общение и поддержка', AppLocale.en: 'Companionship',
  },
  'DAILY_SUPPORT': {
    AppLocale.ko: '일상생활 지원', AppLocale.vi: 'Hỗ trợ sinh hoạt',
    AppLocale.ru: 'Помощь в быту', AppLocale.en: 'Daily living support',
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

/// 같은 표를 가리키는 다른 이름. 후보자 앱 테스트는 `translationTable`을,
/// 간병사 앱 테스트는 `dictForTest`를 썼고 합치면서 둘 다 남겼습니다 —
/// 이름 하나 때문에 검증을 지우는 것이 더 나쁩니다.
Map<String, Map<AppLocale, String>> get dictForTest => _dict;

/// 테스트에서 코드 사전도 4개 언어를 채웠는지 확인합니다.
Map<String, Map<AppLocale, String>> get codesForTest => _codes;

String codeLabel(String? code, AppLocale locale) {
  if (code == null || code.isEmpty) return '—';
  return _codes[code]?[locale] ?? code;
}

/// 도메인 코드 → 문구 키.
///
/// 백엔드 코드를 화면에 그대로 띄우지 않습니다. 간병사에게
/// `CARE_QR_TOKEN_MISMATCH`는 아무 의미도 없고 앱이 고장 난 것처럼 보입니다.
String errorKey(String? code) => switch (code) {
      'CARE_QR_TOKEN_MISMATCH' => 'error.qrMismatch',
      'CARE_QR_TOKEN_REQUIRED' => 'error.qrRequired',
      'COMMON_INVALID_TRANSITION' => 'error.transition',
      'CARE_AVAILABILITY_BOOKED' => 'error.availabilityBooked',
      null => 'error.network',
      _ => 'error.generic',
    };
