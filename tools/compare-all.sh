#!/usr/bin/env bash
# 시안과 캡처를 나란히: bash tools/compare-all.sh <캡처 폴더> <출력 폴더>
set -e
IN=${1:-docs/progress/2}; OUT=${2:-docs/progress/2/compare}
mkdir -p "$OUT"
pair() { [ -f "$IN/$2" ] && node tools/compare.mjs "docs/mockups/$1" "$IN/$2" "$OUT/${1%.png}.png" "${3:-760}" >/dev/null && echo "$OUT/${1%.png}.png"; }
pair 00-title.png phone-00-title.png
pair 00b-select.png phone-00b-select.png
pair 01-lobby-gate.png phone-01-lobby-gate.png
pair 01b-card-tapped.png phone-01b-card-tapped.png
pair 02-elevator.png phone-02-elevator.png
pair 03-office.png phone-03-office.png
pair 04-pc-todo.png phone-04-pc-todo.png
pair 05-dialog.png phone-05-dialog.png
pair 06-pantry.png phone-06-pantry.png
pair 07-board.png phone-07-board.png
pair 08-payslip.png phone-08-payslip.png
pair pc-01-lobby.png pc-01-lobby-gate.png 500
pair pc-03-office.png pc-03-office.png 500
