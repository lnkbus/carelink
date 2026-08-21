import 'package:carelink_field_ui/carelink_field_ui.dart';

export 'package:carelink_field_ui/carelink_field_ui.dart' show AppLocale, AppLocaleInfo;

/// 간병사 앱 문구 사전.
///
/// **백엔드는 코드만 반환하고 문구는 클라이언트가 번역합니다** (§5.15).
///
/// 후보자 앱과 별도 사전인 이유는, 같은 코드라도 간병사에게는 다르게 말해야
/// 하기 때문입니다. 그리고 여기에 **없는 것**이 중요합니다 — 환자 실명·진단명·
/// 나이·성별에 해당하는 키가 아예 없습니다 (docs/11 §3.2). 사전에 없으면
/// 화면에 그릴 수도 없습니다.
///
/// 4개 언어입니다. 간병 인력의 상당수가 외국인이고, 러시아어는 고려인
/// 세그먼트 때문에 필수입니다 (docs/08).
const Map<String, Map<AppLocale, String>> _dict = {
  'app.name': {
    AppLocale.ko: 'CARELINK 간병',
    AppLocale.vi: 'CARELINK Chăm sóc',
    AppLocale.ru: 'CARELINK Уход',
    AppLocale.en: 'CARELINK Care',
  },
  'common.loading': {
    AppLocale.ko: '불러오는 중',
    AppLocale.vi: 'Đang tải',
    AppLocale.ru: 'Загрузка',
    AppLocale.en: 'Loading',
  },
  'common.retry': {
    AppLocale.ko: '다시 시도',
    AppLocale.vi: 'Thử lại',
    AppLocale.ru: 'Повторить',
    AppLocale.en: 'Retry',
  },
  'common.close': {
    AppLocale.ko: '닫기', AppLocale.vi: 'Đóng', AppLocale.ru: 'Закрыть', AppLocale.en: 'Close',
  },
  'common.cancel': {
    AppLocale.ko: '취소', AppLocale.vi: 'Hủy', AppLocale.ru: 'Отмена', AppLocale.en: 'Cancel',
  },
  'common.save': {
    AppLocale.ko: '저장', AppLocale.vi: 'Lưu', AppLocale.ru: 'Сохранить', AppLocale.en: 'Save',
  },
  'common.logout': {
    AppLocale.ko: '로그아웃', AppLocale.vi: 'Đăng xuất', AppLocale.ru: 'Выйти', AppLocale.en: 'Log out',
  },
  'logout.confirm': {
    AppLocale.ko: '로그아웃할까요?',
    AppLocale.vi: 'Bạn có muốn đăng xuất?',
    AppLocale.ru: 'Выйти из аккаунта?',
    AppLocale.en: 'Log out?',
  },
  'logout.note': {
    // 근무 중 실수로 눌렀을 때 무엇을 잃는지 알려 줍니다. 다시 로그인하면
    // 되지만, 병실 앞에서 인증번호를 기다리는 상황은 만들지 않는 편이 낫습니다.
    AppLocale.ko: '다시 로그인하려면 인증번호가 필요합니다.',
    AppLocale.vi: 'Bạn sẽ cần mã xác minh để đăng nhập lại.',
    AppLocale.ru: 'Для повторного входа понадобится код подтверждения.',
    AppLocale.en: 'You will need a verification code to sign in again.',
  },
  'expiry.expired': {
    AppLocale.ko: '만료됨', AppLocale.vi: 'Đã hết hạn', AppLocale.ru: 'Истёк', AppLocale.en: 'Expired',
  },

  // ── 로그인 ──────────────────────────────────────────────────────────────
  'login.phone': {
    AppLocale.ko: '휴대폰 번호',
    AppLocale.vi: 'Số điện thoại',
    AppLocale.ru: 'Номер телефона',
    AppLocale.en: 'Phone number',
  },
  'login.code': {
    AppLocale.ko: '인증번호',
    AppLocale.vi: 'Mã xác minh',
    AppLocale.ru: 'Код',
    AppLocale.en: 'Code',
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

  // ── SCR-401 대시보드 ────────────────────────────────────────────────────
  'home.title': {
    AppLocale.ko: '오늘', AppLocale.vi: 'Hôm nay', AppLocale.ru: 'Сегодня', AppLocale.en: 'Today',
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

String tr(String key, AppLocale locale) => _dict[key]?[locale] ?? key;

/// 도메인 코드 → 라벨.
///
/// **백엔드는 코드만 반환합니다** (§5.15). `H8_3SHIFT`나 `MEAL_SUPPORT`를
/// 그대로 띄우면 한국어 사용자에게도 읽히지 않고, 외국인 인력에게는
/// 아무 의미도 없습니다.
///
/// 새 지원 항목은 서버 카탈로그에서 옵니다. 여기 없는 코드는 원문을
/// 돌려주므로 화면이 비지는 않지만, 그런 코드가 보이면 사전에 넣으세요.
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

String codeLabel(String? code, AppLocale locale) {
  if (code == null || code.isEmpty) return '—';
  return _codes[code]?[locale] ?? code;
}

/// 테스트에서 코드 사전도 4개 언어를 채웠는지 확인합니다.
Map<String, Map<AppLocale, String>> get codesForTest => _codes;

/// 테스트에서 4개 언어 키 집합이 같은지 확인합니다.
Map<String, Map<AppLocale, String>> get dictForTest => _dict;

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
