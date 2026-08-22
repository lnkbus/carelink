import 'package:carelink_field_ui/carelink_field_ui.dart';
import 'package:flutter/material.dart';

/// FIELD 화면을 **폰 폭 안에** 가둡니다.
///
/// 이 앱은 웹으로도 뜹니다 (검증용 :3300, 그리고 보호자는 대개 병원에서
/// 링크로 들어옵니다 — SCR-301 notes). 그런데 데스크톱 브라우저에서 열면
/// 폭이 2000px까지 늘어나고, 그러면:
///
///   · 카드 한 장이 화면을 가로질러 라벨과 값이 30cm 떨어집니다
///   · 하단 탭 4개가 창 전체에 흩어져 무엇이 묶인 것인지 안 보입니다
///   · 56~76px로 잡아 둔 터치 타깃이 마우스 기준으로는 과하게 큽니다
///
/// FIELD 규격(16px 하한 · 48px 타깃)은 **한 손으로 쓰는 폰**을 전제로
/// 정한 값입니다. 그 전제가 깨진 폭에서 같은 값을 쓰면 규격이 아니라
/// 그냥 큰 글씨가 됩니다.
///
/// 그래서 넓은 창에서는 폰 폭으로 가두고 가운데에 둡니다. 실제 폰에서는
/// `maxWidth`에 닿지 않으므로 아무 일도 일어나지 않습니다 — 반응형이라는
/// 말은 '모든 폭에 늘어난다'가 아니라 '폭마다 맞는 모양을 쓴다'입니다.
class FieldViewport extends StatelessWidget {
  const FieldViewport({super.key, required this.child});

  final Widget child;

  /// 폰 폭 상한. 큰 폰(430px)과 작은 태블릿 세로(600px) 사이입니다 —
  /// 태블릿에서도 한 손 조작 레이아웃이 그대로 통합니다.
  static const maxWidth = 520.0;

  @override
  Widget build(BuildContext context) {
    final w = MediaQuery.sizeOf(context).width;
    if (w <= maxWidth) return child;

    return ColoredBox(
      // 폰 폭 바깥은 배경입니다. 흰색으로 두면 앱이 어디서 끝나는지
      // 보이지 않아 레이아웃이 깨진 것처럼 읽힙니다.
      color: CL.bgSub,
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: maxWidth),
          child: DecoratedBox(
            decoration: const BoxDecoration(
              color: CL.bg,
              border: Border.symmetric(vertical: BorderSide(color: CL.line)),
            ),
            child: child,
          ),
        ),
      ),
    );
  }
}
