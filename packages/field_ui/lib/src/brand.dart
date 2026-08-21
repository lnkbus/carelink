import 'package:flutter/material.dart';
import 'tokens.dart';

/// 케어링크 마크.
///
/// 시안(SCR-001 · 002)의 하트입니다. 스플래시에서는 흰 타일 위 파란 하트,
/// 로그인에서는 파란 타일 위 흰 하트로 색만 뒤집힙니다.
class BrandMark extends StatelessWidget {
  const BrandMark({
    super.key,
    required this.size,
    required this.tileColor,
    required this.markColor,
    required this.radius,
  });

  /// 스플래시 96 · 로그인 64 (시안 규격).
  final double size;
  final Color tileColor;
  final Color markColor;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: tileColor,
        borderRadius: BorderRadius.circular(radius),
      ),
      child: Icon(Icons.favorite, size: size * 0.58, color: markColor),
    );
  }
}

/// SCR-001 스플래시.
///
/// **파란 전면입니다** (`#2560E8`). 흰 배경에 스피너 하나를 돌리던 것을
/// 시안대로 바꿨습니다 — 앱을 여는 첫 순간이 브랜드를 만나는 유일한
/// 지점이고, 여기가 비어 있으면 나머지 화면이 아무리 정돈돼도 조립품처럼
/// 보입니다.
///
/// 점 세 개는 진행 표시가 아니라 시안의 리듬 요소입니다. 첫 점만 불투명하고
/// 나머지는 45%입니다.
class SplashView extends StatelessWidget {
  const SplashView({
    super.key,
    required this.title,
    required this.tagline,
    required this.status,
  });

  final String title;
  final String tagline;

  /// `v1.0.0 · 토큰 확인 중`. mono로 씁니다 — 버전과 상태는 데이터입니다.
  final String status;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: CL.actionStrong,
      body: Stack(
        children: [
          Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const BrandMark(
                  size: 96,
                  tileColor: Colors.white,
                  markColor: CL.actionStrong,
                  radius: 28,
                ),
                const SizedBox(height: 24),
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 30, fontWeight: FontWeight.w700,
                    color: Colors.white, letterSpacing: -0.6,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  tagline,
                  style: const TextStyle(fontSize: 17, color: Color(0xFFC9DAFF)),
                ),
                const SizedBox(height: 32),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    for (var i = 0; i < 3; i++) ...[
                      Container(
                        width: 10,
                        height: 10,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: i == 0 ? Colors.white : Colors.white.withOpacity(0.45),
                        ),
                      ),
                      if (i < 2) const SizedBox(width: 8),
                    ],
                  ],
                ),
              ],
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            bottom: 32,
            child: Text(
              status,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontFamily: CL.monoFamily, fontSize: 14, color: Color(0xFFC9DAFF),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
