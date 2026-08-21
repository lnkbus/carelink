/// 보호자 모델 (SCR-301~307).
///
/// **간병사 실명·국적·연락처 필드가 없습니다** (§6-21 · §5.10, 2026-08-21 확정).
/// API가 내려주지 않고 (`CaregiverCardDto`), 여기에도 없어서 화면에서 그릴 수가
/// 없습니다. 게이트를 세 겹으로 둔 것은 화면이 늘어나면 어느 한 겹은 뚫리기
/// 때문입니다.
///
/// 보호자가 국적으로 고르기 시작하면 그것이 배정 관행이 되고, 검증을 통과한
/// 인력이 국적 때문에 선택받지 못합니다. 플랫폼이 거르는 것은 국적이 아니라
/// 검증되지 않은 인력입니다.
///
/// **금액 필드도 없습니다** (§6-8 · §2). 4대보험·퇴직금을 반영한 청구 단가(U6)와
/// 취소·환불 정책이 미확정입니다. 모델에 자리를 만들면 화면이 채우려 들고,
/// 그렇게 뜬 숫자는 보호자에게 약속으로 읽힙니다.
library;

/// 제휴 병원. `activeCaregivers`는 '지금 이 병원에 배정 가능한 인원'입니다 —
/// 숫자만 두면 무슨 뜻인지 모르므로 화면에서 문장으로 씁니다.
class CareHospital {
  CareHospital({
    required this.id,
    required this.name,
    required this.activeCaregivers,
    this.region,
  });

  final String id;
  final String name;
  final int activeCaregivers;
  final String? region;

  static CareHospital fromJson(Map<String, dynamic> j) => CareHospital(
        id: j['id'] as String,
        name: j['name'] as String,
        activeCaregivers: (j['activeCaregivers'] as int?) ?? 0,
        region: j['region'] as String?,
      );
}

/// 간병 서비스 카탈로그 항목.
///
/// **화면에 상수 배열을 두지 않습니다** (§6-2). 배열을 두는 순간 그것이
/// 카탈로그가 되고, 의료행위가 거기로 들어옵니다. 서버가 관리합니다.
class CareServiceItem {
  CareServiceItem({required this.code, required this.labelKo});

  final String code;
  final String labelKo;

  static CareServiceItem fromJson(Map<String, dynamic> j) => CareServiceItem(
        code: j['code'] as String,
        labelKo: j['labelKo'] as String,
      );
}

/// 간병 요청 (SCR-302·303).
class CareRequest {
  CareRequest({
    required this.id,
    required this.status,
    required this.startAt,
    required this.serviceType,
    this.hospitalName,
    this.ward,
    this.shiftPatternCode,
    this.mobilityLevel,
    this.supportItems,
    this.cautions,
  });

  final String id;
  final String status;
  final DateTime startAt;
  final String serviceType;
  final String? hospitalName;
  final String? ward;
  final String? shiftPatternCode;
  final String? mobilityLevel;
  final List<String>? supportItems;
  final String? cautions;

  /// 아직 끝나지 않은 건. 홈에서 이것만 큰 카드로 띄웁니다 —
  /// 보호자가 가장 많이 하는 행동은 "잘 있나 확인"입니다 (SCR-306 notes).
  bool get isLive => const [
        'SUBMITTED', 'MATCHING', 'OFFER_SENT', 'ASSIGNED',
        'IN_SERVICE', 'OPS_REVIEW', 'ISSUE',
      ].contains(status);

  bool get isDone => const ['COMPLETED', 'CANCELLED'].contains(status);

  /// 업무범위 검토 중. **거절이 아닙니다** (§6-15) — 그렇게 말해 주지 않으면
  /// 보호자는 신청이 취소된 줄 압니다.
  bool get inScopeReview => status == 'OPS_REVIEW';

  static CareRequest fromJson(Map<String, dynamic> j) => CareRequest(
        id: j['id'] as String,
        status: j['status'] as String,
        startAt: DateTime.parse(j['startAt'] as String),
        serviceType: (j['serviceType'] as String?) ?? 'DAY',
        hospitalName: j['hospitalName'] as String?,
        ward: j['ward'] as String?,
        shiftPatternCode: j['shiftPatternCode'] as String?,
        mobilityLevel: j['mobilityLevel'] as String?,
        supportItems: (j['supportItems'] as List<dynamic>?)?.cast<String>(),
        cautions: j['cautions'] as String?,
      );
}

/// 매칭 후보 카드 (SCR-304).
///
/// 실명도 국적도 없습니다 — 위 라이브러리 주석 참고. 여기 필드를 추가하고
/// 싶어지면 "보호자가 이걸 보고 무엇을 결정하는가"를 먼저 물어보세요.
class CaregiverCard {
  CaregiverCard({
    required this.caregiverId,
    required this.displayCode,
    required this.experienceYrs,
    required this.completedCount,
    required this.available,
    this.ratingAvg,
  });

  final String caregiverId;
  final String displayCode;
  final int experienceYrs;
  final int completedCount;
  final bool available;
  final double? ratingAvg;

  static CaregiverCard fromJson(Map<String, dynamic> j) => CaregiverCard(
        caregiverId: j['caregiverId'] as String,
        displayCode: j['displayCode'] as String,
        experienceYrs: (j['experienceYrs'] as num?)?.toInt() ?? 0,
        completedCount: (j['completedCount'] as num?)?.toInt() ?? 0,
        available: (j['available'] as bool?) ?? false,
        ratingAvg: (j['ratingAvg'] as num?)?.toDouble(),
      );
}

/// 매칭 결과. `excludedReasons`는 운영자 전용이라 보호자 응답에는 키 자체가
/// 없습니다 — 건수만으로도 '사람이 없다'와 '조건이 맞는 사람이 적다'는
/// 구분됩니다.
class CareMatchResult {
  CareMatchResult({required this.candidates, required this.excludedCount});

  final List<CaregiverCard> candidates;
  final int excludedCount;

  static CareMatchResult fromJson(Map<String, dynamic> j) => CareMatchResult(
        candidates: ((j['candidates'] as List<dynamic>?) ?? const [])
            .map((e) => CaregiverCard.fromJson(e as Map<String, dynamic>))
            .toList(),
        excludedCount: (j['excludedCount'] as num?)?.toInt() ?? 0,
      );
}

/// 배정 (SCR-305·306).
class CareAssignment {
  CareAssignment({
    required this.id,
    required this.careRequestId,
    required this.caregiverDisplayCode,
    required this.status,
  });

  final String id;
  final String careRequestId;
  final String caregiverDisplayCode;
  final String status;

  /// 제안했고 아직 확정 전. 보호자에게는 '기다리는 중'입니다.
  bool get isPending => const ['OFFERED', 'ACCEPTED'].contains(status);

  /// 확정됐거나 진행 중이거나 끝난 건.
  bool get isFixed => const ['ASSIGNED', 'IN_SERVICE', 'COMPLETED'].contains(status);

  static CareAssignment fromJson(Map<String, dynamic> j) => CareAssignment(
        id: j['id'] as String,
        careRequestId: j['careRequestId'] as String,
        caregiverDisplayCode: (j['caregiverDisplayCode'] as String?) ?? '—',
        status: j['status'] as String,
      );
}
