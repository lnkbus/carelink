/**
 * 인트로 문구 — ko · vi · ru · en.
 *
 * **앱과 같은 규칙입니다** (CLAUDE.md §5.15). 한국어 기준 길이의 2.5배를
 * 수용해야 하고, 그래서 이 페이지에는 고정 높이 컨테이너가 없습니다 —
 * 러시아어에서 제목이 한 줄 더 늘어나도 레이아웃이 버팁니다.
 *
 * 러시아어가 필요한 이유는 고려인 세그먼트입니다 (docs/08). 장식이 아닙니다.
 *
 * 앱은 `packages/field_ui`의 `AppLocale`을 쓰고 여기는 별도 사전입니다.
 * 공개 페이지의 카피는 마케팅 문구라 앱의 기능 문구와 수명이 다릅니다 —
 * 한 사전에 넣으면 앱 배포 없이 못 고칩니다.
 */
export const LOCALES = ['ko', 'vi', 'ru', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABEL: Record<Locale, string> = {
  ko: 'KO', vi: 'VI', ru: 'RU', en: 'EN',
};

type Dict = Record<string, string>;

const ko: Dict = {
  'nav.service': '서비스',
  'nav.app': '앱 화면',
  'nav.flow': '진행 절차',
  'nav.stages': '전체 단계',
  'nav.login': '로그인',
  'nav.signup': '가입 신청',
  'nav.mine': '내 화면으로',

  'hero.badge': '서류 접수부터 근무 시작까지 평균 18일',
  'hero.title': '간병 인력, 입국부터 현장까지 한 번에',
  'hero.lead':
    'CareLink는 해외 간병 인력의 서류·비자·매칭·근무 관리를 하나의 흐름으로 연결합니다. 지금 어디에 해당하시는지 골라주세요.',

  'role.candidate.title': '간병인으로 지원',
  'role.candidate.body':
    '자격·서류를 등록하고 한국 병원·요양원 일자리에 지원합니다. 한국어·베트남어·러시아어 지원.',
  'role.candidate.cta': '지원 시작',
  'role.guardian.title': '간병인 찾기',
  'role.guardian.body':
    '환자·가족을 위한 신청. 필요한 돌봄 조건을 고르면 자격이 확인된 간병인을 추천합니다.',
  'role.guardian.cta': '신청하기',
  'role.org.title': '기관 채용',
  'role.org.body':
    '병원·요양원 담당자용. 공고 등록, 후보 검토, 비자·서류 진행 상황을 한 화면에서 관리합니다.',
  'role.org.cta': '공고 등록',

  // 숫자와 단위는 언어마다 다릅니다 — 자릿수 구분자도, 단위도.
  // `18일`을 러시아어 화면에 그대로 두면 그 사람에게는 읽히지 않는 글자입니다.
  'stat.workers.v': '1,240',
  'stat.orgs.v': '86',
  'stat.days.v': '18일',
  'stat.langs.v': '4개',
  'stat.workers': '등록된 간병 인력',
  'stat.orgs': '제휴 병원·요양원',
  'stat.days': '서류 접수부터 배치까지 평균',
  'stat.langs': '지원 언어 (KO·VI·RU·EN)',
  'stat.note': '목표 기준입니다. 파일럿 이후 실측치로 대체됩니다.',

  'app.title': '지금 내 서류가 어디까지 갔는지\n한 화면에서 봅니다',
  'app.lead':
    '지원·서류·심사·매칭·배치를 다섯 단계로 나누고, 다음에 할 일 하나만 크게 보여줍니다. 글을 다 읽지 않아도 색과 아이콘으로 상태가 읽힙니다.',
  'app.point1': '자격·서류는 운영팀이 직접 확인합니다',
  'app.point2': '체류자격 만료일은 남은 일수로 알려드립니다',
  'app.point3': '한국어·베트남어·러시아어로 같은 화면을 씁니다',
  'app.mock.todo': '지금 할 일',
  'app.mock.task': '건강검진 결과 올리기',
  'app.mock.upload': '사진 올리기',
  'app.mock.stage': '취업 준비 단계',
  'app.mock.visa': '체류자격 만료',
  'app.mock.role': '요양보호사',

  'flow.title': '다섯 단계, 각 단계마다 담당자가 있습니다',
  'flow.1.t': '지원', 'flow.1.b': '기본 정보와 자격증을 등록합니다.',
  'flow.2.t': '서류', 'flow.2.b': '여권·건강검진·범죄경력을 제출합니다.',
  'flow.3.t': '심사', 'flow.3.b': '운영팀이 서류 유효기간과 요건을 확인합니다.',
  'flow.4.t': '매칭', 'flow.4.b': '조건이 맞는 기관과 근무 조건을 확정합니다.',
  'flow.5.t': '입국·배치', 'flow.5.b': '비자 발급과 입국 일정을 안내하고 배치합니다.',

  'stages.title': '확보에서 근속까지, 여덟 단계를 한 기록으로',
  'stages.lead':
    '흩어져 있던 단계를 하나로 잇습니다. 지금 열려 있는 단계와 준비 중인 단계를 함께 표시합니다.',
  'stages.live': '운영 중',
  'stages.soon': '준비 중',
  'stages.1.t': '확보', 'stages.1.b': '채널·파트너·코호트로 인력을 모읍니다.',
  'stages.2.t': '검증', 'stages.2.b': '신원·범죄경력·건강·체류자격을 확인합니다.',
  'stages.3.t': '교육', 'stages.3.b': '필수 교육과 업무범위 교육을 이수합니다.',
  'stages.4.t': '자격', 'stages.4.b': '자격 취득 경로를 단계로 관리합니다.',
  'stages.5.t': '매칭', 'stages.5.b': '점수가 아니라 근거와 미충족 요건을 함께 냅니다.',
  'stages.6.t': '배치', 'stages.6.b': '고용 형태와 컴플라이언스를 배치 단위로 확정합니다.',
  'stages.7.t': '근무', 'stages.7.b': '병실 QR 체크인과 근무 기록을 남깁니다.',
  'stages.8.t': '근속', 'stages.8.b': '이탈 시점을 기록해 다음 기수를 고칩니다.',

  'verticals.title': '돌봄에서 시작해, 산업을 넓힙니다',
  'verticals.lead':
    '인력 운영의 뼈대는 산업과 무관합니다. 어느 산업이든 사람은 검증되고, 교육받고, 배치되고, 일하고, 정산됩니다. 새 산업은 코드 배포 없이 데이터로 엽니다.',
  'verticals.live': '운영 중',
  'verticals.planned': '확장 예정',
  'vertical.hospital': '병원 간병',
  'vertical.care': '요양보호',
  'vertical.medical': '의료지원',
  'vertical.agri': '농업',
  'vertical.beauty': '미용',
  'vertical.food': '요리·외식',
  'vertical.build': '건설',
  'vertical.logistics': '물류',

  'cta.title': '돌봄이 필요한 곳에, 준비된 사람을',
  'cta.lead': '지원부터 배치까지 CareLink가 처음부터 끝까지 관리합니다.',
  'cta.primary': '간병인으로 지원',
  'cta.secondary': '기관 · 파트너로 가입 신청',

  'foot.tagline': '국제 간병 인력 배치 플랫폼',
  'foot.support': '고객센터 1600-0000 · 평일 09:00–18:00',
  'foot.terms': '이용약관',
  'foot.privacy': '개인정보처리방침',
  'foot.careers': '채용',
  'foot.preview': '이 페이지는 서비스 소개용이며 일부 기능은 준비 중입니다.',
};

const vi: Dict = {
  'nav.service': 'Dịch vụ',
  'nav.app': 'Màn hình ứng dụng',
  'nav.flow': 'Quy trình',
  'nav.stages': 'Toàn bộ giai đoạn',
  'nav.login': 'Đăng nhập',
  'nav.signup': 'Đăng ký',
  'nav.mine': 'Vào màn hình của tôi',

  'hero.badge': 'Trung bình 18 ngày từ nộp hồ sơ đến bắt đầu làm việc',
  'hero.title': 'Nhân lực chăm sóc, từ nhập cảnh đến hiện trường',
  'hero.lead':
    'CareLink kết nối hồ sơ, visa, ghép việc và quản lý ca làm của nhân lực chăm sóc nước ngoài thành một dòng chảy. Bạn thuộc nhóm nào?',

  'role.candidate.title': 'Ứng tuyển làm người chăm sóc',
  'role.candidate.body':
    'Đăng ký chứng chỉ và hồ sơ để ứng tuyển vào bệnh viện, viện dưỡng lão tại Hàn Quốc. Hỗ trợ tiếng Hàn, Việt, Nga.',
  'role.candidate.cta': 'Bắt đầu ứng tuyển',
  'role.guardian.title': 'Tìm người chăm sóc',
  'role.guardian.body':
    'Dành cho bệnh nhân và gia đình. Chọn điều kiện chăm sóc, chúng tôi giới thiệu người đã được xác minh.',
  'role.guardian.cta': 'Gửi yêu cầu',
  'role.org.title': 'Tuyển dụng cho cơ sở',
  'role.org.body':
    'Dành cho bệnh viện, viện dưỡng lão. Đăng tin, xem ứng viên, theo dõi visa và hồ sơ trên một màn hình.',
  'role.org.cta': 'Đăng tin tuyển',

  'stat.workers.v': '1.240',
  'stat.orgs.v': '86',
  'stat.days.v': '18 ngày',
  'stat.langs.v': '4',
  'stat.workers': 'Nhân lực đã đăng ký',
  'stat.orgs': 'Bệnh viện · viện dưỡng lão liên kết',
  'stat.days': 'Trung bình từ nộp hồ sơ đến bố trí',
  'stat.langs': 'Ngôn ngữ hỗ trợ (KO·VI·RU·EN)',
  'stat.note': 'Đây là mục tiêu. Sẽ thay bằng số liệu thực sau giai đoạn thí điểm.',

  'app.title': 'Xem hồ sơ của bạn đang ở đâu\nchỉ trên một màn hình',
  'app.lead':
    'Chia ứng tuyển, hồ sơ, thẩm định, ghép việc và bố trí thành năm bước, và chỉ hiện thật to việc cần làm tiếp theo. Không cần đọc hết, màu sắc và biểu tượng đã nói lên trạng thái.',
  'app.point1': 'Chứng chỉ và hồ sơ do đội vận hành kiểm tra trực tiếp',
  'app.point2': 'Hạn tư cách lưu trú được báo bằng số ngày còn lại',
  'app.point3': 'Cùng một màn hình bằng tiếng Hàn, Việt, Nga',
  'app.mock.todo': 'Việc cần làm',
  'app.mock.task': 'Tải kết quả khám sức khỏe',
  'app.mock.upload': 'Tải ảnh lên',
  'app.mock.stage': 'Giai đoạn chuẩn bị việc làm',
  'app.mock.visa': 'Hạn tư cách lưu trú',
  'app.mock.role': 'Điều dưỡng viên',

  'flow.title': 'Năm bước, mỗi bước đều có người phụ trách',
  'flow.1.t': 'Ứng tuyển', 'flow.1.b': 'Đăng ký thông tin cơ bản và chứng chỉ.',
  'flow.2.t': 'Hồ sơ', 'flow.2.b': 'Nộp hộ chiếu, khám sức khỏe, lý lịch tư pháp.',
  'flow.3.t': 'Thẩm định', 'flow.3.b': 'Đội vận hành kiểm tra hạn hồ sơ và điều kiện.',
  'flow.4.t': 'Ghép việc', 'flow.4.b': 'Chốt cơ sở phù hợp và điều kiện làm việc.',
  'flow.5.t': 'Nhập cảnh · bố trí', 'flow.5.b': 'Hướng dẫn visa, lịch nhập cảnh và bố trí.',

  'stages.title': 'Từ tuyển mộ đến gắn bó lâu dài — tám giai đoạn, một hồ sơ',
  'stages.lead':
    'Nối các giai đoạn vốn rời rạc thành một. Chúng tôi ghi rõ giai đoạn nào đang mở và giai đoạn nào đang chuẩn bị.',
  'stages.live': 'Đang vận hành',
  'stages.soon': 'Đang chuẩn bị',
  'stages.1.t': 'Tuyển mộ', 'stages.1.b': 'Tập hợp nhân lực qua kênh, đối tác, khóa tuyển.',
  'stages.2.t': 'Xác minh', 'stages.2.b': 'Kiểm tra nhân thân, lý lịch, sức khỏe, tư cách lưu trú.',
  'stages.3.t': 'Đào tạo', 'stages.3.b': 'Hoàn thành đào tạo bắt buộc và phạm vi công việc.',
  'stages.4.t': 'Chứng chỉ', 'stages.4.b': 'Quản lý lộ trình lấy chứng chỉ theo từng bước.',
  'stages.5.t': 'Ghép việc', 'stages.5.b': 'Không chỉ đưa điểm, mà kèm lý do và điều kiện còn thiếu.',
  'stages.6.t': 'Bố trí', 'stages.6.b': 'Chốt hình thức tuyển dụng và tuân thủ theo từng lần bố trí.',
  'stages.7.t': 'Làm việc', 'stages.7.b': 'Chấm công bằng QR phòng bệnh và ghi nhận ca làm.',
  'stages.8.t': 'Gắn bó', 'stages.8.b': 'Ghi lại thời điểm nghỉ để sửa cho khóa sau.',

  'verticals.title': 'Bắt đầu từ chăm sóc, mở rộng sang các ngành khác',
  'verticals.lead':
    'Bộ khung vận hành nhân lực không phụ thuộc vào ngành. Ngành nào thì người ta cũng được xác minh, đào tạo, bố trí, làm việc và thanh toán. Ngành mới mở bằng dữ liệu, không cần triển khai mã.',
  'verticals.live': 'Đang vận hành',
  'verticals.planned': 'Dự kiến mở rộng',
  'vertical.hospital': 'Chăm sóc bệnh viện',
  'vertical.care': 'Điều dưỡng',
  'vertical.medical': 'Hỗ trợ y tế',
  'vertical.agri': 'Nông nghiệp',
  'vertical.beauty': 'Làm đẹp',
  'vertical.food': 'Nấu ăn · nhà hàng',
  'vertical.build': 'Xây dựng',
  'vertical.logistics': 'Logistics',

  'cta.title': 'Người đã sẵn sàng, đến nơi đang cần',
  'cta.lead': 'Từ ứng tuyển đến bố trí, CareLink lo từ đầu đến cuối.',
  'cta.primary': 'Ứng tuyển làm người chăm sóc',
  'cta.secondary': 'Đăng ký cho cơ sở · đối tác',

  'foot.tagline': 'Nền tảng bố trí nhân lực chăm sóc quốc tế',
  'foot.support': 'Tổng đài 1600-0000 · T2–T6 09:00–18:00',
  'foot.terms': 'Điều khoản sử dụng',
  'foot.privacy': 'Chính sách bảo mật',
  'foot.careers': 'Tuyển dụng',
  'foot.preview': 'Trang này giới thiệu dịch vụ; một số tính năng đang được chuẩn bị.',
};

const ru: Dict = {
  'nav.service': 'Сервис',
  'nav.app': 'Экраны приложения',
  'nav.flow': 'Как это работает',
  'nav.stages': 'Все этапы',
  'nav.login': 'Войти',
  'nav.signup': 'Подать заявку',
  'nav.mine': 'К моему экрану',

  'hero.badge': 'В среднем 18 дней от подачи документов до выхода на работу',
  'hero.title': 'Сиделки — от въезда до рабочего места в одном сервисе',
  'hero.lead':
    'CareLink соединяет документы, визу, подбор и учёт смен иностранных сиделок в один поток. С чем вы пришли?',

  'role.candidate.title': 'Подать заявку как сиделка',
  'role.candidate.body':
    'Загрузите документы и квалификацию, откликайтесь на вакансии больниц и пансионатов Кореи. Корейский, вьетнамский, русский.',
  'role.candidate.cta': 'Начать',
  'role.guardian.title': 'Найти сиделку',
  'role.guardian.body':
    'Для пациентов и семей. Выберите условия ухода — предложим проверенных сиделок.',
  'role.guardian.cta': 'Оставить заявку',
  'role.org.title': 'Подбор для учреждения',
  'role.org.body':
    'Для больниц и пансионатов. Публикация вакансий, отбор кандидатов, статус визы и документов — на одном экране.',
  'role.org.cta': 'Разместить вакансию',

  'stat.workers.v': '1 240',
  'stat.orgs.v': '86',
  'stat.days.v': '18 дней',
  'stat.langs.v': '4',
  'stat.workers': 'Зарегистрированных сиделок',
  'stat.orgs': 'Партнёрских больниц и пансионатов',
  'stat.days': 'В среднем от документов до размещения',
  'stat.langs': 'Языков интерфейса (KO·VI·RU·EN)',
  'stat.note': 'Это целевые значения. После пилота заменим фактическими.',

  'app.title': 'Где сейчас ваши документы —\nвидно на одном экране',
  'app.lead':
    'Заявка, документы, проверка, подбор и размещение разбиты на пять шагов, и крупно показан только следующий шаг. Даже не читая, состояние видно по цвету и значку.',
  'app.point1': 'Документы и квалификацию проверяет команда сервиса',
  'app.point2': 'Срок статуса пребывания показываем в днях',
  'app.point3': 'Один и тот же экран на корейском, вьетнамском и русском',
  'app.mock.todo': 'Что сделать сейчас',
  'app.mock.task': 'Загрузить результаты медосмотра',
  'app.mock.upload': 'Загрузить фото',
  'app.mock.stage': 'Этап подготовки к работе',
  'app.mock.visa': 'Истечение статуса',
  'app.mock.role': 'Соцработник по уходу',

  'flow.title': 'Пять шагов, у каждого есть ответственный',
  'flow.1.t': 'Заявка', 'flow.1.b': 'Регистрируете основные данные и сертификаты.',
  'flow.2.t': 'Документы', 'flow.2.b': 'Паспорт, медосмотр, справка о несудимости.',
  'flow.3.t': 'Проверка', 'flow.3.b': 'Команда сверяет сроки документов и требования.',
  'flow.4.t': 'Подбор', 'flow.4.b': 'Согласуем учреждение и условия работы.',
  'flow.5.t': 'Въезд и размещение', 'flow.5.b': 'Сопровождаем визу, даты въезда и выход на место.',

  'stages.title': 'От набора до удержания — восемь этапов, одна запись',
  'stages.lead':
    'Соединяем этапы, которые были разрозненными. Открытые и готовящиеся этапы отмечены отдельно.',
  'stages.live': 'Работает',
  'stages.soon': 'Готовится',
  'stages.1.t': 'Набор', 'stages.1.b': 'Собираем людей через каналы, партнёров и потоки.',
  'stages.2.t': 'Проверка', 'stages.2.b': 'Личность, судимость, здоровье, статус пребывания.',
  'stages.3.t': 'Обучение', 'stages.3.b': 'Обязательный курс и границы обязанностей.',
  'stages.4.t': 'Квалификация', 'stages.4.b': 'Ведём путь получения сертификата по шагам.',
  'stages.5.t': 'Подбор', 'stages.5.b': 'Не только балл — причины и чего не хватает.',
  'stages.6.t': 'Размещение', 'stages.6.b': 'Форма занятости и комплаенс — на каждое размещение.',
  'stages.7.t': 'Работа', 'stages.7.b': 'Отметка по QR в палате и журнал смен.',
  'stages.8.t': 'Удержание', 'stages.8.b': 'Фиксируем, на каком этапе уходят, и правим следующий поток.',

  'verticals.title': 'Начинаем с ухода и расширяем на другие отрасли',
  'verticals.lead':
    'Каркас управления персоналом не зависит от отрасли. Везде человека проверяют, обучают, размещают, он работает и получает расчёт. Новая отрасль открывается данными, без выката кода.',
  'verticals.live': 'Работает',
  'verticals.planned': 'В планах',
  'vertical.hospital': 'Уход в больнице',
  'vertical.care': 'Патронажный уход',
  'vertical.medical': 'Медицинская поддержка',
  'vertical.agri': 'Сельское хозяйство',
  'vertical.beauty': 'Красота',
  'vertical.food': 'Кухня и общепит',
  'vertical.build': 'Строительство',
  'vertical.logistics': 'Логистика',

  'cta.title': 'Туда, где нужен уход — подготовленные люди',
  'cta.lead': 'От заявки до размещения CareLink ведёт весь путь.',
  'cta.primary': 'Подать заявку как сиделка',
  'cta.secondary': 'Заявка для учреждения · партнёра',

  'foot.tagline': 'Платформа международного подбора сиделок',
  'foot.support': 'Поддержка 1600-0000 · будни 09:00–18:00',
  'foot.terms': 'Условия использования',
  'foot.privacy': 'Политика конфиденциальности',
  'foot.careers': 'Вакансии',
  'foot.preview': 'Эта страница знакомит с сервисом; часть функций готовится.',
};

const en: Dict = {
  'nav.service': 'Service',
  'nav.app': 'App screens',
  'nav.flow': 'How it works',
  'nav.stages': 'All stages',
  'nav.login': 'Sign in',
  'nav.signup': 'Apply',
  'nav.mine': 'Go to my screen',

  'hero.badge': '18 days on average from paperwork to first shift',
  'hero.title': 'Care workers, from arrival to the ward',
  'hero.lead':
    'CareLink joins documents, visas, matching and shift records for overseas care workers into a single flow. Which one are you?',

  'role.candidate.title': 'Apply as a care worker',
  'role.candidate.body':
    'Register your qualifications and documents, then apply to hospitals and care homes in Korea. Korean, Vietnamese and Russian supported.',
  'role.candidate.cta': 'Start applying',
  'role.guardian.title': 'Find a care worker',
  'role.guardian.body':
    'For patients and families. Choose the care you need and we suggest verified caregivers.',
  'role.guardian.cta': 'Request care',
  'role.org.title': 'Hire for your facility',
  'role.org.body':
    'For hospitals and care homes. Post openings, review candidates and track visa and document status on one screen.',
  'role.org.cta': 'Post an opening',

  'stat.workers.v': '1,240',
  'stat.orgs.v': '86',
  'stat.days.v': '18 days',
  'stat.langs.v': '4',
  'stat.workers': 'Care workers registered',
  'stat.orgs': 'Partner hospitals and care homes',
  'stat.days': 'Average from paperwork to placement',
  'stat.langs': 'Languages supported (KO·VI·RU·EN)',
  'stat.note': 'These are targets. Actuals will replace them after the pilot.',

  'app.title': 'See exactly where your paperwork is\non a single screen',
  'app.lead':
    'Application, documents, review, matching and placement are five steps, and only the next one is shown large. You can read the status from colour and icon without reading the words.',
  'app.point1': 'Our team checks every qualification and document',
  'app.point2': 'Visa expiry is shown as days remaining, not a date',
  'app.point3': 'The same screen in Korean, Vietnamese and Russian',
  'app.mock.todo': 'Next up',
  'app.mock.task': 'Upload your health check result',
  'app.mock.upload': 'Upload a photo',
  'app.mock.stage': 'Readiness',
  'app.mock.visa': 'Visa expires',
  'app.mock.role': 'Care worker',

  'flow.title': 'Five steps, each with someone responsible',
  'flow.1.t': 'Apply', 'flow.1.b': 'Register your basic details and certificates.',
  'flow.2.t': 'Documents', 'flow.2.b': 'Submit passport, health check and criminal record.',
  'flow.3.t': 'Review', 'flow.3.b': 'Our team checks validity dates and requirements.',
  'flow.4.t': 'Matching', 'flow.4.b': 'We settle the facility and the working terms.',
  'flow.5.t': 'Arrival', 'flow.5.b': 'We guide the visa and arrival dates, then place you.',

  'stages.title': 'From sourcing to retention — eight stages, one record',
  'stages.lead':
    'Stages that used to sit apart are joined here. What is open today and what is still being built are both marked.',
  'stages.live': 'Live',
  'stages.soon': 'In progress',
  'stages.1.t': 'Sourcing', 'stages.1.b': 'Channels, partners and cohorts bring people in.',
  'stages.2.t': 'Screening', 'stages.2.b': 'Identity, criminal record, health and visa status.',
  'stages.3.t': 'Training', 'stages.3.b': 'Mandatory training and scope-of-duty training.',
  'stages.4.t': 'Qualification', 'stages.4.b': 'The route to certification, tracked step by step.',
  'stages.5.t': 'Matching', 'stages.5.b': 'Not just a score — reasons and what is missing.',
  'stages.6.t': 'Placement', 'stages.6.b': 'Employment model and compliance, per placement.',
  'stages.7.t': 'Work', 'stages.7.b': 'Ward QR check-in and an append-only shift record.',
  'stages.8.t': 'Retention', 'stages.8.b': 'We record where people drop out and fix the next cohort.',

  'verticals.title': 'Starting with care, widening to other industries',
  'verticals.lead':
    'The workforce backbone is industry-neutral. Wherever they work, people are screened, trained, placed, work and get paid. A new industry opens with data, not a deployment.',
  'verticals.live': 'Live',
  'verticals.planned': 'Planned',
  'vertical.hospital': 'Hospital care',
  'vertical.care': 'Long-term care',
  'vertical.medical': 'Medical support',
  'vertical.agri': 'Agriculture',
  'vertical.beauty': 'Beauty',
  'vertical.food': 'Food service',
  'vertical.build': 'Construction',
  'vertical.logistics': 'Logistics',

  'cta.title': 'Prepared people, where care is needed',
  'cta.lead': 'From application to placement, CareLink runs the whole way.',
  'cta.primary': 'Apply as a care worker',
  'cta.secondary': 'Apply as a facility or partner',

  'foot.tagline': 'International care workforce platform',
  'foot.support': 'Support 1600-0000 · weekdays 09:00–18:00',
  'foot.terms': 'Terms of use',
  'foot.privacy': 'Privacy policy',
  'foot.careers': 'Careers',
  'foot.preview': 'This page introduces the service; some features are still being built.',
};

const DICT: Record<Locale, Dict> = { ko, vi, ru, en };

/** 키가 없으면 한국어로, 그것도 없으면 키 원문. 빈칸으로 뭉개지 않습니다. */
export function makeT(locale: Locale) {
  return (key: string): string => DICT[locale][key] ?? ko[key] ?? key;
}

/** 요청에서 로케일을 고릅니다. `?lang=` → 쿠키 → 기본 ko. */
export function pickLocale(raw?: string | string[]): Locale {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return LOCALES.includes(v as Locale) ? (v as Locale) : 'ko';
}

/**
 * 숫자 값은 번역이 아닙니다 — `86`은 네 언어에서 `86`입니다.
 * 복사 검사에서 빼되, 키 집합·빈 문자열 검사에는 그대로 걸립니다.
 */
export const NUMERIC_KEYS = Object.keys(ko).filter((k) => k.endsWith('.v'));

/** 테스트가 4개 언어 키 집합을 대조합니다. */
export const DICT_FOR_TEST = DICT;
