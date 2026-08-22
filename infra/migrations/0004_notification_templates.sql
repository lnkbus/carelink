-- 알림 문구 (docs/02 §10 · CLAUDE.md §5.15).
--
-- ── 왜 지금까지 비어 있었나 ────────────────────────────────────────────
-- `notifications`에 넣는 곳이 11군데인데 표가 비어 있었습니다. 읽는
-- 엔드포인트도 없었으니 드러나지 않았을 뿐, 문구 없는 알림은 화면에
-- `TALENT_DOC_EXPIRING` 같은 코드가 그대로 뜬다는 뜻입니다.
--
-- ── 왜 코드가 아니라 표인가 ────────────────────────────────────────────
-- 오류 문구와 다릅니다. 오류는 클라이언트가 번역하지만 알림은 여기서
-- 옵니다. 같은 알림이 PUSH·SMS·알림톡으로 나갈 때 길이 제한이 다르고,
-- 문구는 운영 중에 자주 고쳐집니다 — 배포 없이 고칠 수 있어야 합니다.
--
-- ── 4개 언어 ─────────────────────────────────────────────────────────
-- ko · vi · ru · en. 수신자의 `users.locale`을 따릅니다. 없으면 ko로
-- 내려갑니다 — 문구가 없다고 알림을 감추면 사용자는 아무 일도 일어나지
-- 않은 줄 압니다.
--
-- `{key}`는 payload로 치환됩니다. 없는 키는 그대로 남습니다 (지우면
-- 말은 되는데 뜻이 없는 문장이 나갑니다).

INSERT INTO notification_templates (code, locale, channel, title, body) VALUES

-- ── 가입 승인 ─────────────────────────────────────────────────────────
('IAM_ROLE_APPROVED','ko','PUSH','신청이 승인되었습니다','{organizationName} 담당자로 승인되었습니다. 지금 로그인하면 바로 쓰실 수 있습니다.'),
('IAM_ROLE_APPROVED','vi','PUSH','Đơn đăng ký đã được duyệt','Bạn đã được duyệt làm người phụ trách của {organizationName}. Hãy đăng nhập để bắt đầu.'),
('IAM_ROLE_APPROVED','ru','PUSH','Заявка одобрена','Вы одобрены как ответственное лицо организации {organizationName}. Войдите в систему, чтобы начать.'),
('IAM_ROLE_APPROVED','en','PUSH','Your request was approved','You are approved as a contact for {organizationName}. Sign in to get started.'),

-- 반려는 **사유가 본문에 들어갑니다.** 행은 지워지므로 이것이 신청자에게
-- 사유가 닿는 유일한 경로입니다. 사유 없이 '반려되었습니다'만 보내면
-- 그 사람은 무엇을 고쳐야 하는지 모른 채 같은 신청을 다시 냅니다.
('IAM_ROLE_REJECTED','ko','PUSH','신청이 반려되었습니다','사유: {reason}. 확인 후 다시 신청하실 수 있습니다.'),
('IAM_ROLE_REJECTED','vi','PUSH','Đơn đăng ký bị từ chối','Lý do: {reason}. Bạn có thể nộp lại sau khi khắc phục.'),
('IAM_ROLE_REJECTED','ru','PUSH','Заявка отклонена','Причина: {reason}. Вы можете подать заявку снова после исправления.'),
('IAM_ROLE_REJECTED','en','PUSH','Your request was declined','Reason: {reason}. You can apply again once it is resolved.'),

-- ── 서류 · 체류자격 ───────────────────────────────────────────────────
('TALENT_DOC_EXPIRING','ko','PUSH','서류 만료가 다가옵니다','{documentType} 서류가 {daysLeft}일 후 만료됩니다. 갱신하지 않으면 새 배정을 받을 수 없습니다.'),
('TALENT_DOC_EXPIRING','vi','PUSH','Giấy tờ sắp hết hạn','Giấy tờ {documentType} sẽ hết hạn sau {daysLeft} ngày. Nếu không gia hạn, bạn sẽ không nhận được phân công mới.'),
('TALENT_DOC_EXPIRING','ru','PUSH','Срок действия документа истекает','Документ {documentType} истекает через {daysLeft} дн. Без продления новые назначения недоступны.'),
('TALENT_DOC_EXPIRING','en','PUSH','A document expires soon','Your {documentType} expires in {daysLeft} days. Without renewal you cannot receive new assignments.'),

('TALENT_DOC_EXPIRED','ko','PUSH','서류가 만료되었습니다','{documentType} 서류가 만료되어 새 배정이 중단되었습니다. 갱신 서류를 올려 주세요.'),
('TALENT_DOC_EXPIRED','vi','PUSH','Giấy tờ đã hết hạn','Giấy tờ {documentType} đã hết hạn nên việc phân công mới đã dừng. Vui lòng tải lên giấy tờ mới.'),
('TALENT_DOC_EXPIRED','ru','PUSH','Срок действия документа истёк','Документ {documentType} истёк, новые назначения приостановлены. Загрузите обновлённый документ.'),
('TALENT_DOC_EXPIRED','en','PUSH','A document has expired','Your {documentType} expired and new assignments are paused. Please upload a renewed document.'),

-- 체류자격은 서류 만료와 무게가 다릅니다. 서류가 만료되면 자격이 무효가
-- 되지만, 체류자격이 만료되면 **불법 취업**입니다 (CLAUDE.md §5.9).
('TALENT_VISA_EXPIRING','ko','PUSH','체류기간 만료가 다가옵니다','체류기간이 {daysLeft}일 후 만료됩니다. 연장하지 않고 근무하면 불법 취업이 됩니다. 지금 확인해 주세요.'),
('TALENT_VISA_EXPIRING','vi','PUSH','Thời hạn cư trú sắp hết','Thời hạn cư trú của bạn hết sau {daysLeft} ngày. Làm việc mà không gia hạn là lao động bất hợp pháp. Vui lòng kiểm tra ngay.'),
('TALENT_VISA_EXPIRING','ru','PUSH','Срок пребывания истекает','Срок вашего пребывания истекает через {daysLeft} дн. Работа без продления считается нелегальной. Проверьте сейчас.'),
('TALENT_VISA_EXPIRING','en','PUSH','Your stay permit expires soon','Your stay permit expires in {daysLeft} days. Working without an extension is illegal employment. Please check now.'),

-- ── 지원 상태 (SCR-109) ───────────────────────────────────────────────
('MATCHING_APPLICATION_UNDER_REVIEW','ko','PUSH','지원서를 검토 중입니다','{organizationName}의 {jobTitle} 지원서를 검토하고 있습니다.'),
('MATCHING_APPLICATION_UNDER_REVIEW','vi','PUSH','Hồ sơ đang được xem xét','Hồ sơ ứng tuyển {jobTitle} tại {organizationName} đang được xem xét.'),
('MATCHING_APPLICATION_UNDER_REVIEW','ru','PUSH','Заявка на рассмотрении','Ваша заявка на «{jobTitle}» в {organizationName} рассматривается.'),
('MATCHING_APPLICATION_UNDER_REVIEW','en','PUSH','Your application is under review','Your application for {jobTitle} at {organizationName} is being reviewed.'),

('MATCHING_APPLICATION_INTERVIEW_REQUESTED','ko','PUSH','면접 요청이 왔습니다','{organizationName}이 {jobTitle} 면접을 요청했습니다. 수락하면 실명과 연락처가 전달됩니다.'),
('MATCHING_APPLICATION_INTERVIEW_REQUESTED','vi','PUSH','Có yêu cầu phỏng vấn','{organizationName} đề nghị phỏng vấn cho {jobTitle}. Nếu bạn đồng ý, họ tên và số liên lạc sẽ được chia sẻ.'),
('MATCHING_APPLICATION_INTERVIEW_REQUESTED','ru','PUSH','Приглашение на собеседование','{organizationName} приглашает на собеседование по «{jobTitle}». При согласии будут переданы ваше имя и контакты.'),
('MATCHING_APPLICATION_INTERVIEW_REQUESTED','en','PUSH','Interview requested','{organizationName} requested an interview for {jobTitle}. Accepting shares your name and contact details.'),

('MATCHING_APPLICATION_INTERVIEW_DONE','ko','PUSH','면접이 끝났습니다','{organizationName}의 {jobTitle} 면접이 완료로 기록되었습니다.'),
('MATCHING_APPLICATION_INTERVIEW_DONE','vi','PUSH','Đã hoàn tất phỏng vấn','Buổi phỏng vấn {jobTitle} tại {organizationName} đã được ghi nhận hoàn tất.'),
('MATCHING_APPLICATION_INTERVIEW_DONE','ru','PUSH','Собеседование завершено','Собеседование по «{jobTitle}» в {organizationName} отмечено как завершённое.'),
('MATCHING_APPLICATION_INTERVIEW_DONE','en','PUSH','Interview completed','Your interview for {jobTitle} at {organizationName} was marked complete.'),

('MATCHING_APPLICATION_OFFERED','ko','PUSH','채용 제안이 왔습니다','{organizationName}이 {jobTitle} 채용을 제안했습니다.'),
('MATCHING_APPLICATION_OFFERED','vi','PUSH','Bạn nhận được lời mời làm việc','{organizationName} mời bạn vào vị trí {jobTitle}.'),
('MATCHING_APPLICATION_OFFERED','ru','PUSH','Вам сделали предложение','{organizationName} предлагает вам должность «{jobTitle}».'),
('MATCHING_APPLICATION_OFFERED','en','PUSH','You received an offer','{organizationName} offered you the {jobTitle} position.'),

('MATCHING_APPLICATION_ACCEPTED','ko','PUSH','채용이 확정되었습니다','{organizationName}의 {jobTitle}로 확정되었습니다.'),
('MATCHING_APPLICATION_ACCEPTED','vi','PUSH','Đã xác nhận tuyển dụng','Bạn đã được xác nhận cho vị trí {jobTitle} tại {organizationName}.'),
('MATCHING_APPLICATION_ACCEPTED','ru','PUSH','Трудоустройство подтверждено','Вы приняты на должность «{jobTitle}» в {organizationName}.'),
('MATCHING_APPLICATION_ACCEPTED','en','PUSH','Your placement is confirmed','You are confirmed for {jobTitle} at {organizationName}.'),

-- 지원 반려도 사유가 필수입니다 (SCR-109). 문구에 사유 자리를 둡니다.
('MATCHING_APPLICATION_REJECTED','ko','PUSH','지원 결과를 알려드립니다','{organizationName}의 {jobTitle}은 이번에 함께하지 못하게 되었습니다. 사유: {note}'),
('MATCHING_APPLICATION_REJECTED','vi','PUSH','Kết quả ứng tuyển','Rất tiếc, vị trí {jobTitle} tại {organizationName} chưa phù hợp lần này. Lý do: {note}'),
('MATCHING_APPLICATION_REJECTED','ru','PUSH','Результат заявки','К сожалению, по «{jobTitle}» в {organizationName} в этот раз не сложилось. Причина: {note}'),
('MATCHING_APPLICATION_REJECTED','en','PUSH','Application result','Unfortunately {jobTitle} at {organizationName} did not work out this time. Reason: {note}'),

('MATCHING_APPLICATION_WITHDRAWN','ko','PUSH','지원이 취소되었습니다','{organizationName}의 {jobTitle} 지원이 취소 처리되었습니다.'),
('MATCHING_APPLICATION_WITHDRAWN','vi','PUSH','Đã huỷ ứng tuyển','Hồ sơ ứng tuyển {jobTitle} tại {organizationName} đã được huỷ.'),
('MATCHING_APPLICATION_WITHDRAWN','ru','PUSH','Заявка отозвана','Ваша заявка на «{jobTitle}» в {organizationName} отозвана.'),
('MATCHING_APPLICATION_WITHDRAWN','en','PUSH','Application withdrawn','Your application for {jobTitle} at {organizationName} was withdrawn.'),

('MATCHING_APPLICATION_STALE','ko','PUSH','지원 진행이 멈춰 있습니다','{jobTitle} 지원이 {daysStale}일째 응답을 기다리고 있습니다. 운영자가 확인하고 있습니다.'),
('MATCHING_APPLICATION_STALE','vi','PUSH','Hồ sơ đang bị đình trệ','Hồ sơ {jobTitle} đã chờ phản hồi {daysStale} ngày. Quản trị viên đang kiểm tra.'),
('MATCHING_APPLICATION_STALE','ru','PUSH','Заявка без движения','Заявка «{jobTitle}» ждёт ответа {daysStale} дн. Оператор уже проверяет.'),
('MATCHING_APPLICATION_STALE','en','PUSH','Your application is stalled','Your {jobTitle} application has been waiting {daysStale} days. An operator is looking into it.'),

-- ── 클리어런스 (CLAUDE.md §5.11) ──────────────────────────────────────
('QUALITY_CLEARANCE_EXPIRING','ko','PUSH','검증 항목 만료가 다가옵니다','{clearanceType} 검증이 {daysLeft}일 후 만료됩니다. 만료되면 새 배정이 중단됩니다.'),
('QUALITY_CLEARANCE_EXPIRING','vi','PUSH','Mục kiểm tra sắp hết hạn','Kiểm tra {clearanceType} hết hạn sau {daysLeft} ngày. Khi hết hạn, phân công mới sẽ dừng.'),
('QUALITY_CLEARANCE_EXPIRING','ru','PUSH','Проверка скоро истекает','Проверка {clearanceType} истекает через {daysLeft} дн. После этого новые назначения прекратятся.'),
('QUALITY_CLEARANCE_EXPIRING','en','PUSH','A clearance expires soon','Your {clearanceType} clearance expires in {daysLeft} days. New assignments stop once it does.'),

('QUALITY_CLEARANCE_EXPIRED','ko','PUSH','검증이 만료되었습니다','{clearanceType} 검증이 만료되어 새 배정이 중단되었습니다. 재검사가 필요합니다.'),
('QUALITY_CLEARANCE_EXPIRED','vi','PUSH','Kiểm tra đã hết hạn','Kiểm tra {clearanceType} đã hết hạn nên phân công mới đã dừng. Cần kiểm tra lại.'),
('QUALITY_CLEARANCE_EXPIRED','ru','PUSH','Проверка истекла','Проверка {clearanceType} истекла, новые назначения приостановлены. Требуется повторная проверка.'),
('QUALITY_CLEARANCE_EXPIRED','en','PUSH','A clearance has expired','Your {clearanceType} clearance expired and new assignments are paused. A re-check is required.'),

-- ── 파견 한도 (CLAUDE.md §5.7-1) ──────────────────────────────────────
('ENGAGEMENT_DISPATCH_LIMIT_NEAR','ko','PUSH','파견 기간 한도가 가까워집니다','{organizationName} 파견이 {daysLeft}일 후 2년 한도에 도달합니다. 교체 또는 직접고용 전환 절차가 시작됩니다.'),
('ENGAGEMENT_DISPATCH_LIMIT_NEAR','vi','PUSH','Sắp đến giới hạn thời gian phái cử','Việc phái cử tại {organizationName} sẽ đạt giới hạn 2 năm sau {daysLeft} ngày. Quy trình thay thế hoặc chuyển sang tuyển dụng trực tiếp sẽ bắt đầu.'),
('ENGAGEMENT_DISPATCH_LIMIT_NEAR','ru','PUSH','Приближается лимит срока направления','Направление в {organizationName} достигнет двухлетнего лимита через {daysLeft} дн. Начнётся процедура замены или перевода в штат.'),
('ENGAGEMENT_DISPATCH_LIMIT_NEAR','en','PUSH','Dispatch limit approaching','Your dispatch to {organizationName} reaches the two-year limit in {daysLeft} days. A replacement or direct-hire process will begin.'),

-- ── 간병 · 사건 ───────────────────────────────────────────────────────
('CARE_SLA_BREACHED','ko','PUSH','간병 요청 배정이 지연되고 있습니다','요청하신 간병이 아직 배정되지 않았습니다. 운영자가 직접 확인하고 있습니다.'),
('CARE_SLA_BREACHED','vi','PUSH','Việc phân công chăm sóc bị chậm','Yêu cầu chăm sóc của bạn chưa được phân công. Quản trị viên đang trực tiếp xử lý.'),
('CARE_SLA_BREACHED','ru','PUSH','Назначение сиделки задерживается','Ваш запрос пока не назначен. Оператор занимается этим лично.'),
('CARE_SLA_BREACHED','en','PUSH','Your care request is delayed','Your request has not been assigned yet. An operator is handling it directly.'),

('TICKET_SLA_BREACHED','ko','PUSH','접수하신 건의 대응이 지연되었습니다','{ticketType} 건이 기준 시간을 넘겼습니다. 담당자가 배정되었습니다.'),
('TICKET_SLA_BREACHED','vi','PUSH','Xử lý phản ánh bị chậm','Vụ việc {ticketType} đã quá thời hạn xử lý. Đã có người phụ trách.'),
('TICKET_SLA_BREACHED','ru','PUSH','Обращение обработано с задержкой','Обращение «{ticketType}» превысило срок. Назначен ответственный.'),
('TICKET_SLA_BREACHED','en','PUSH','Your report is overdue','Your {ticketType} case passed its response deadline. A handler has been assigned.'),

('TICKET_ESCALATED','ko','PUSH','접수하신 건이 상위로 전달되었습니다','{ticketType} 건이 책임자에게 전달되었습니다.'),
('TICKET_ESCALATED','vi','PUSH','Vụ việc đã được chuyển lên cấp trên','Vụ việc {ticketType} đã được chuyển cho người phụ trách cấp cao.'),
('TICKET_ESCALATED','ru','PUSH','Обращение передано выше','Обращение «{ticketType}» передано руководителю.'),
('TICKET_ESCALATED','en','PUSH','Your report was escalated','Your {ticketType} case was escalated to a manager.')

ON CONFLICT (code, locale, channel) DO UPDATE
  SET title = EXCLUDED.title, body = EXCLUDED.body;
