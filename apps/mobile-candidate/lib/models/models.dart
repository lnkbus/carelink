/// API 응답 모델.
///
/// **scope로 가려지는 필드는 전부 nullable입니다.** 서버는 권한이 없으면 값을
/// 비우는 것이 아니라 **키 자체를 지웁니다** (마스킹이 아니라 삭제 —
/// `core/scope/scope.serializer.ts`). 필수로 선언하면 그런 응답에서 파싱이
/// 터지고, 터지는 곳이 하필 개인정보 게이트가 정상 동작한 경우입니다.
library;

class Candidate {
  Candidate({
    required this.id,
    required this.displayCode,
    required this.status,
    required this.tracks,
    this.name,
    this.birthDate,
    this.phone,
    this.nationality,
    this.visaStatusCode,
    this.visaExpiresOn,
    this.visaExpiresInDays,
    this.currentLocation,
    this.preferredRegions,
    this.availableFrom,
    this.dormRequired = false,
  });

  final String id;
  final String displayCode;
  final String status;
  final List<CandidateTrack> tracks;
  final String? name;
  final String? birthDate;
  final String? phone;
  final String? nationality;
  final String? visaStatusCode;
  final String? visaExpiresOn;
  final int? visaExpiresInDays;
  final String? currentLocation;
  final List<String>? preferredRegions;
  final String? availableFrom;
  final bool dormRequired;

  static Candidate fromJson(Map<String, dynamic> j) => Candidate(
        id: j['id'] as String,
        displayCode: j['displayCode'] as String? ?? '',
        status: j['status'] as String? ?? 'DRAFT',
        tracks: (j['tracks'] as List<dynamic>? ?? [])
            .map((t) => CandidateTrack.fromJson(t as Map<String, dynamic>))
            .toList(),
        name: j['name'] as String?,
        birthDate: j['birthDate'] as String?,
        phone: j['phone'] as String?,
        nationality: j['nationality'] as String?,
        visaStatusCode: j['visaStatusCode'] as String?,
        visaExpiresOn: j['visaExpiresOn'] as String?,
        visaExpiresInDays: j['visaExpiresInDays'] as int?,
        currentLocation: j['currentLocation'] as String?,
        preferredRegions: (j['preferredRegions'] as List<dynamic>?)?.cast<String>(),
        availableFrom: j['availableFrom'] as String?,
        dormRequired: j['dormRequired'] as bool? ?? false,
      );
}

class CandidateTrack {
  CandidateTrack({
    required this.trackId,
    required this.trackCode,
    required this.labelKo,
    required this.isPrimary,
    required this.qualificationState,
  });

  final String trackId;
  final String trackCode;
  final String labelKo;
  final bool isPrimary;
  final String qualificationState;

  static CandidateTrack fromJson(Map<String, dynamic> j) => CandidateTrack(
        trackId: j['trackId'] as String,
        trackCode: j['trackCode'] as String? ?? '',
        labelKo: j['labelKo'] as String? ?? '',
        isPrimary: j['isPrimary'] as bool? ?? false,
        qualificationState: j['qualificationState'] as String? ?? 'NOT_SELECTED',
      );
}

/// SCR-101의 단일 카드. **목록이 아니라 하나입니다.**
class NextAction {
  NextAction({required this.code, required this.screen, required this.reasonKey, required this.params});
  final String code;
  final String screen;
  final String reasonKey;
  final Map<String, dynamic> params;

  static NextAction fromJson(Map<String, dynamic> j) => NextAction(
        code: j['code'] as String,
        screen: j['screen'] as String? ?? '',
        reasonKey: j['reasonKey'] as String? ?? '',
        params: (j['params'] as Map<String, dynamic>?) ?? const {},
      );
}

class JourneyGroup {
  JourneyGroup({required this.key, required this.labelKey, required this.state});
  final String key;
  final String labelKey;
  final String state;

  static JourneyGroup fromJson(Map<String, dynamic> j) => JourneyGroup(
        key: j['key'] as String,
        labelKey: j['labelKey'] as String? ?? '',
        state: j['state'] as String? ?? 'PENDING',
      );
}

/// 체류자격 절차 — 커리어 여정과 **별개의 축**입니다 (S3 확정).
///
/// 하나가 끝나야 다른 하나가 시작되는 관계가 아닙니다. 한 축으로 합치면
/// 국내 체류자에게 존재하지 않는 단계가 보이고, 해외 신규 인력에게는
/// 입국 절차가 커리어 단계처럼 표시됩니다.
class VisaProcess {
  VisaProcess({
    required this.applicable,
    required this.requiresEntry,
    required this.complete,
    required this.reasonKey,
    this.targetVisaCode,
    this.currentStep,
    this.history = const [],
  });

  final bool applicable;
  final bool requiresEntry;
  final bool complete;
  final String reasonKey;
  final String? targetVisaCode;
  final String? currentStep;
  final List<String> history;

  static VisaProcess fromJson(Map<String, dynamic> j) => VisaProcess(
        applicable: j['applicable'] as bool? ?? false,
        requiresEntry: j['requiresEntry'] as bool? ?? false,
        complete: j['complete'] as bool? ?? false,
        reasonKey: j['reasonKey'] as String? ?? '',
        targetVisaCode: j['targetVisaCode'] as String?,
        currentStep: j['currentStep'] as String?,
        history: (j['history'] as List<dynamic>? ?? [])
            .map((h) => (h as Map<String, dynamic>)['step'] as String)
            .toList(),
      );
}

class Journey {
  Journey({
    required this.currentStep,
    required this.progressCurrent,
    required this.progressTotal,
    required this.groups,
    this.nextAction,
    this.visaProcess,
  });

  final String currentStep;
  final int progressCurrent;
  final int progressTotal;
  final List<JourneyGroup> groups;
  final NextAction? nextAction;
  final VisaProcess? visaProcess;

  static Journey fromJson(Map<String, dynamic> j) {
    final progress = (j['progress'] as Map<String, dynamic>?) ?? const {};
    return Journey(
      currentStep: j['currentStep'] as String? ?? '',
      progressCurrent: progress['current'] as int? ?? 0,
      progressTotal: progress['total'] as int? ?? 0,
      groups: (j['groups'] as List<dynamic>? ?? [])
          .map((g) => JourneyGroup.fromJson(g as Map<String, dynamic>))
          .toList(),
      nextAction: j['nextAction'] == null
          ? null
          : NextAction.fromJson(j['nextAction'] as Map<String, dynamic>),
      visaProcess: j['visaProcess'] == null
          ? null
          : VisaProcess.fromJson(j['visaProcess'] as Map<String, dynamic>),
    );
  }
}

class Job {
  Job({
    required this.id,
    required this.organizationName,
    required this.trackCode,
    required this.region,
    required this.headcount,
    required this.status,
    required this.salaryVisibility,
    required this.dormProvided,
    this.title,
    this.startDate,
    this.employmentType,
    this.salaryMin,
    this.salaryMax,
  });

  final String id;
  final String organizationName;
  final String trackCode;
  final String region;
  final int headcount;
  final String status;
  final String salaryVisibility;
  final bool dormProvided;
  final String? title;
  final String? startDate;
  final String? employmentType;
  /// 공개 범위에 따라 서버가 아예 보내지 않습니다 — 마스킹이 아니라 미포함.
  final int? salaryMin;
  final int? salaryMax;

  static Job fromJson(Map<String, dynamic> j) => Job(
        id: j['id'] as String,
        organizationName: j['organizationName'] as String? ?? '',
        trackCode: j['trackCode'] as String? ?? '',
        region: j['region'] as String? ?? '',
        headcount: j['headcount'] as int? ?? 1,
        status: j['status'] as String? ?? 'OPEN',
        salaryVisibility: j['salaryVisibility'] as String? ?? 'NEGOTIABLE',
        dormProvided: j['dormProvided'] as bool? ?? false,
        title: j['title'] as String?,
        startDate: j['startDate'] as String?,
        employmentType: j['employmentType'] as String?,
        salaryMin: j['salaryMin'] as int?,
        salaryMax: j['salaryMax'] as int?,
      );
}

class Application {
  Application({
    required this.id,
    required this.jobId,
    required this.organizationName,
    required this.status,
    required this.appliedAt,
    this.jobTitle,
    this.resultNote,
  });

  final String id;
  final String jobId;
  final String organizationName;
  final String status;
  final String appliedAt;
  final String? jobTitle;
  /// 불합격에는 사유가 있어야 합니다 — 없으면 화면이 그 사실을 드러냅니다.
  final String? resultNote;

  static Application fromJson(Map<String, dynamic> j) => Application(
        id: j['id'] as String,
        jobId: j['jobId'] as String? ?? '',
        organizationName: j['organizationName'] as String? ?? '',
        status: j['status'] as String? ?? 'APPLIED',
        appliedAt: j['appliedAt'] as String? ?? '',
        jobTitle: j['jobTitle'] as String?,
        resultNote: j['resultNote'] as String?,
      );
}

class DocumentItem {
  DocumentItem({
    required this.id,
    required this.docType,
    required this.status,
    this.expiresAt,
    this.expiresInDays,
    this.rejectReason,
  });

  final String id;
  final String docType;
  final String status;
  final String? expiresAt;
  final int? expiresInDays;
  final String? rejectReason;

  static DocumentItem fromJson(Map<String, dynamic> j) => DocumentItem(
        id: j['id'] as String,
        docType: j['docType'] as String? ?? 'OTHER',
        status: j['status'] as String? ?? 'PENDING',
        expiresAt: j['expiresAt'] as String?,
        expiresInDays: j['expiresInDays'] as int?,
        rejectReason: j['rejectReason'] as String?,
      );
}
