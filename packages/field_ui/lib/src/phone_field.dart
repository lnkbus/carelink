import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'tokens.dart';

/// SCR-002의 번호 입력칸.
///
/// 시안 그대로입니다: 국가번호 `+82`가 왼쪽에 고정되고, 세로 구분선, 그
/// 오른쪽에 `010 4821 8821`처럼 **세 덩어리로 띄어 쓴** 번호, 맨 끝에 지우기.
///
/// 국가번호를 밖으로 뺀 이유가 둘 있습니다.
///   · 사용자는 자기 번호를 `010…`으로 알고 있습니다. `+8210…`을 통째로
///     치라고 하면 매번 틀립니다.
///   · 해외 거주 후보자는 국가번호를 **바꿔야** 합니다 (docs/08 E·F 세그먼트).
///     칸 안에 섞여 있으면 어디까지가 국가번호인지 알 수 없습니다.
///
/// 띄어쓰기는 표시용입니다. 서버로는 국가번호와 숫자를 합쳐 보내고,
/// 정규화는 서버가 E.164로 합니다.
class PhoneField extends StatelessWidget {
  const PhoneField({
    super.key,
    required this.controller,
    required this.dialCode,
    required this.onChanged,
    required this.onDialTap,
    this.enabled = true,
  });

  final TextEditingController controller;

  /// `+82`. 탭하면 국가 목록이 열립니다.
  final String dialCode;
  final ValueChanged<String> onChanged;
  final VoidCallback onDialTap;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minHeight: 64),
      decoration: BoxDecoration(
        border: Border.all(color: enabled ? CL.action : CL.lineStrong, width: enabled ? 2 : 1),
        borderRadius: BorderRadius.circular(12),
        color: enabled ? CL.bg : CL.bgSub,
      ),
      padding: const EdgeInsets.symmetric(horizontal: CL.s5),
      child: Row(
        children: [
          // 국가번호는 48px 터치 타깃입니다 — 해외 후보자가 여기서 바꿉니다.
          InkWell(
            onTap: enabled ? onDialTap : null,
            child: SizedBox(
              height: 48,
              child: Center(
                child: Text(
                  dialCode,
                  style: const TextStyle(
                    fontFamily: CL.monoFamily, fontSize: 19,
                    fontWeight: FontWeight.w600, color: CL.textSub,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(width: CL.s3),
          Container(width: 1, height: 26, color: CL.line),
          const SizedBox(width: CL.s3),
          Expanded(
            child: TextField(
              controller: controller,
              enabled: enabled,
              onChanged: onChanged,
              keyboardType: TextInputType.phone,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                _GroupedPhoneFormatter(),
              ],
              style: const TextStyle(
                fontFamily: CL.monoFamily, fontSize: 19, fontWeight: FontWeight.w700,
              ),
              decoration: const InputDecoration(
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
                isDense: true,
                hintText: '010 0000 0000',
                counterText: '',
              ),
            ),
          ),
          if (enabled && controller.text.isNotEmpty)
            InkWell(
              onTap: () {
                controller.clear();
                onChanged('');
              },
              child: Container(
                width: 28,
                height: 28,
                decoration: const BoxDecoration(color: CL.bgSub, shape: BoxShape.circle),
                child: const Icon(Icons.close, size: 16, color: CL.textSub),
              ),
            ),
        ],
      ),
    );
  }
}

/// `01048218821` → `010 4821 8821`.
///
/// 11자리를 붙여 쓰면 읽으면서 확인할 수 없습니다. 자기 번호가 맞는지
/// 눈으로 확인하는 것이 이 화면에서 사용자가 하는 유일한 검증입니다.
class _GroupedPhoneFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue old, TextEditingValue next) {
    final digits = next.text.replaceAll(RegExp(r'\D'), '');
    final buf = StringBuffer();
    for (var i = 0; i < digits.length; i++) {
      // 3-4-4. 국내 휴대폰 기준이고, 국제번호에서도 읽기에 나쁘지 않습니다.
      if (i == 3 || i == 7) buf.write(' ');
      buf.write(digits[i]);
    }
    final text = buf.toString();
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}
