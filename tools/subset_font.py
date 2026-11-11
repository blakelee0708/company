# Pretendard 글꼴을 자주 쓰는 한글 2,350자(KS X 1001) + 소스에 쓰인 글자 + 영문·숫자·기호로 줄인다.
# 사용: python3 tools/subset_font.py
import os, re, glob
from fontTools import subset
from fontTools.ttLib import TTFont
chars = set(chr(c) for c in range(0x20, 0x7f))
for hi in range(0xB0, 0xC9):
    for lo in range(0xA1, 0xFF):
        try: chars.add(bytes([hi, lo]).decode('euc-kr'))
        except Exception: pass
for f in glob.glob('src/**/*.*', recursive=True) + ['index.html']:
    if f.endswith(('.ts', '.css', '.html')):
        chars.update(open(f, encoding='utf-8').read())
chars.update('·…“”‘’→←↑↓★☕✔✓✏️🪪∞○●◯×—–~₩%')
chars = {c for c in chars if ord(c) >= 0x20 and ord(c) < 0x10000}
opts = subset.Options(); opts.flavor = 'woff2'; opts.layout_features = ['*']; opts.notdef_outline = True
font = TTFont('docs/reference-code/PretendardVariable.woff2')
s = subset.Subsetter(opts); s.populate(text=''.join(chars)); s.subset(font)
font.flavor = 'woff2'
os.makedirs('public/fonts', exist_ok=True)
font.save('public/fonts/Pretendard-subset.woff2')
print(len(chars), 'chars', os.path.getsize('public/fonts/Pretendard-subset.woff2'), 'bytes')
