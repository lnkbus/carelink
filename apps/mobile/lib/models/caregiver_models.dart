/// 간병사 · 보호자 모델.
///
/// **환자 실명·나이·성별·진단명 필드가 없습니다** (docs/11 §3.2 · SCR-403 notes).
/// API가 내려주지 않고, 여기에도 없어서 화면에서 그릴 수가 없습니다.
/// 간병사가 알아야 하는 것은 **어디서 무엇을 하는가**입니다 — 병실, 필요한
/// 지원, 주의사항. 필드를 추가할 때는 "이게 없으면 일을 못 하는가"를 먼저
/// 물어보세요.
class Assignment {
  Assignment({
    required this.id,
    required this.careRequestId,
    required this.status,
    required this.offeredAt,
    this.shiftStartTime,
    this.shiftEndTime,
    this.hospitalName,
    this.ward,
    this.startAt,
  });

  final String id;
  final String careRequestId;
  final String status;
  final DateTime offeredAt;
  final String? shiftStartTime;
  final String? shiftEndTime;

  /// 어디서 · 언제. **환자 신원이 아닙니다** — 병원과 병실은 일하러 갈 곳이고,
  /// 이게 없으면 홈에서 상세를 한 번 더 눌러야 합니다 (시안 SCR-401).
  final String? hospitalName;
  final String? ward;
  final DateTime? startAt;

  static Assignment fromJson(Map<String, dynamic> j) => Assignment(
        id: j['id'] as String,
        careRequestId: j['careRequestId'] as String,
        status: j['status'] as String,
        offeredAt: DateTime.parse(j['offeredAt'] as String),
        shiftStartTime: j['shiftStartTime'] as String?,
        shiftEndTime: j['shiftEndTime'] as String?,
        hospitalName: j['hospitalName'] as String?,
        ward: j['ward'] as String?,
        startAt: j['startAt'] == null ? null : DateTime.parse(j['startAt'] as String),
      );

  bool get isOffer => status == 'OFFERED';
  bool get isWaitingConfirm => status == 'ACCEPTED';
  bool get isToday => status == 'ASSIGNED' || status == 'IN_SERVICE';
}

/// SCR-403 근무 상세.
class AssignmentDetail {
  AssignmentDetail({
    required this.assignmentId,
    required this.status,
    required this.hospitalName,
    required this.ward,
    required this.shiftPatternCode,
    required this.startAt,
    required this.supportItems,
    required this.mobilityLevel,
    required this.cautions,
    required this.restrictedFlags,
  });

  final String assignmentId;
  final String status;
  final String? hospitalName;

  /// 환자 식별은 여기까지입니다. 실명 대신 병실을 씁니다.
  final String? ward;
  final String? shiftPatternCode;
  final DateTime startAt;

  /// 진단명 대신 이것으로 치환합니다 (SCR-403 notes).
  final List<String> supportItems;
  final String? mobilityLevel;
  final String? cautions;

  /// 업무범위 감지 이력. 현장에서 같은 요구를 받을 수 있고,
  /// 그때 거절할 근거가 됩니다.
  final List<String> restrictedFlags;

  static AssignmentDetail fromJson(Map<String, dynamic> j) => AssignmentDetail(
        assignmentId: j['assignmentId'] as String,
        status: j['status'] as String,
        hospitalName: j['hospitalName'] as String?,
        ward: j['ward'] as String?,
        shiftPatternCode: j['shiftPatternCode'] as String?,
        startAt: DateTime.parse(j['startAt'] as String),
        supportItems: ((j['supportItems'] as List?) ?? const []).cast<String>(),
        mobilityLevel: j['mobilityLevel'] as String?,
        cautions: j['cautions'] as String?,
        restrictedFlags: ((j['restrictedFlags'] as List?) ?? const []).cast<String>(),
      );
}

class ServiceLogEntry {
  ServiceLogEntry({
    required this.id,
    required this.logType,
    required this.occurredAt,
    required this.corrected,
    this.itemCode,
    this.memo,
  });

  final String id;
  final String logType;
  final DateTime occurredAt;
  final bool corrected;
  final String? itemCode;
  final String? memo;

  static ServiceLogEntry fromJson(Map<String, dynamic> j) => ServiceLogEntry(
        id: j['id'] as String,
        logType: j['logType'] as String,
        occurredAt: DateTime.parse(j['occurredAt'] as String),
        corrected: (j['corrected'] as bool?) ?? false,
        itemCode: j['itemCode'] as String?,
        memo: j['memo'] as String?,
      );
}

/// SCR-402 가용/차단 구간.
class AvailabilityBlock {
  AvailabilityBlock({
    required this.id,
    required this.startsAt,
    required this.endsAt,
    required this.kind,
  });

  final String id;
  final DateTime startsAt;
  final DateTime endsAt;
  final String kind;

  bool get isBlocked => kind == 'BLOCKED';

  static AvailabilityBlock fromJson(Map<String, dynamic> j) => AvailabilityBlock(
        id: j['id'] as String,
        startsAt: DateTime.parse(j['startsAt'] as String),
        endsAt: DateTime.parse(j['endsAt'] as String),
        kind: j['kind'] as String,
      );
}
