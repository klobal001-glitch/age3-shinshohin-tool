#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""レシピPDFから「北海道 / Hokkaido」を外した海外版を作る。

    python3 strip_hokkaido.py

  attach/anko-butter_recipe.pdf（日本用・原本）から
  attach/anko-butter_recipe_overseas.pdf（海外用）を作る。

  なぜ必要か：海外店は産地を北海道に限定できないので、商品名も材料名も
  「北海道」を付けない。原本は日本用としてそのまま残す。

  やっていること：PDFの中の「文字を描く命令」を1文字ずつ拾い、消したい文字の
  命令だけを取り除く。この資料の文字は1文字ごとに Type3 フォントで描かれていて、
  文字送りもフォント側が持っているので、**命令を消すと後ろが自動で詰まる**。
  （文字の位置を数値で持っている行は、その数値ごと消す）
"""
import os, re, sys
import pypdf

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'attach', 'anko-butter_recipe.pdf')
DST = os.path.join(HERE, 'attach', 'anko-butter_recipe_overseas.pdf')

# 消す文字列（この順に探して、見つかったぶんだけ消す）
TARGETS = ['北海道', 'Hokkaido ', 'Hokkaido']

TOKEN = re.compile(r'/(F\d+)\s+([\d.]+)\s+Tf|<([0-9A-Fa-f]+)>\s*Tj'
                   r'|(-?[\d.]+)\s+(-?[\d.]+)\s+Td')


def to_unicode_map(page):
    """フォントごとの「コード → 文字」表を作る。"""
    out = {}
    for name, ref in page['/Resources']['/Font'].items():
        f = ref.get_object()
        tu = f.get('/ToUnicode')
        if tu is None:
            continue
        data = tu.get_object().get_data().decode('latin-1')
        table = {}

        def u(h):
            try:
                return bytes.fromhex(h).decode('utf-16-be')
            except Exception:
                return None

        for block in re.findall(r'beginbfchar(.*?)endbfchar', data, re.S):
            for m in re.finditer(r'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>', block):
                ch = u(m.group(2))
                if ch:
                    table[int(m.group(1), 16)] = ch
        for block in re.findall(r'beginbfrange(.*?)endbfrange', data, re.S):
            for m in re.finditer(r'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(<([0-9A-Fa-f]+)>|\[(.*?)\])',
                                 block, re.S):
                lo, hi = int(m.group(1), 16), int(m.group(2), 16)
                if m.group(4):                       # 連番でまとめて割り当て
                    base = u(m.group(4))
                    if base:
                        for i, code in enumerate(range(lo, hi + 1)):
                            table[code] = base[:-1] + chr(ord(base[-1]) + i)
                else:                                 # 1つずつ並べてある
                    items = re.findall(r'<([0-9A-Fa-f]+)>', m.group(5))
                    for code, h in zip(range(lo, hi + 1), items):
                        ch = u(h)
                        if ch:
                            table[code] = ch
        out[name] = table
    return out


def scan(stream, cmap):
    """文字を描く命令を1文字ずつ拾う。"""
    glyphs, font, pending_td = [], None, None
    for m in TOKEN.finditer(stream):
        if m.group(1):                       # フォントの指定
            font = '/' + m.group(1)
            continue
        if m.group(4) is not None:           # 文字の位置ずらし
            pending_td = m.span()
            continue
        hexs = m.group(3)                    # 文字そのもの
        codes = [int(hexs[i:i + 2], 16) for i in range(0, len(hexs), 2)]
        table = cmap.get(font, {})
        for i, code in enumerate(codes):
            glyphs.append(dict(ch=table.get(code, '�'), span=m.span(),
                               hexs=hexs, index=i, n=len(codes),
                               td=pending_td if i == 0 else None))
        pending_td = None
    return glyphs


def cut(stream, glyphs, start, end):
    """glyphs[start:end] を描かないようにした差し替え指示を返す。"""
    edits = []
    by_span = {}
    for g in glyphs[start:end]:
        by_span.setdefault(g['span'], []).append(g['index'])
    # 位置ずらしの数値は「1つ前の文字の送り幅」なので、消す文字の“次”の数値まで消す。
    # こうすると、消したぶんだけ後ろがきっちり詰まる。
    for g in glyphs[start + 1:end + 1]:
        if g['td']:
            edits.append((g['td'], ''))
    for span, idxs in by_span.items():
        g = next(x for x in glyphs if x['span'] == span)
        keep = [g['hexs'][i * 2:i * 2 + 2] for i in range(g['n']) if i not in idxs]
        edits.append((span, ('<%s> Tj' % ''.join(keep)) if keep else ''))
    return edits


def main():
    if not os.path.exists(SRC):
        sys.exit('元のレシピPDFがありません: ' + SRC)
    writer = pypdf.PdfWriter(clone_from=SRC)
    page = writer.pages[0]
    cmap = to_unicode_map(page)
    stream = page.get_contents().get_data().decode('latin-1')

    glyphs = scan(stream, cmap)
    text = ''.join(g['ch'] for g in glyphs)

    edits, removed = [], []
    for target in TARGETS:
        pos = 0
        while True:
            pos = text.find(target, pos)
            if pos < 0:
                break
            edits += cut(stream, glyphs, pos, pos + len(target))
            removed.append((target, pos))
            text = text[:pos] + '\0' * len(target) + text[pos + len(target):]
            pos += len(target)

    if not removed:
        sys.exit('「北海道 / Hokkaido」が見つかりませんでした。')

    for span, rep in sorted(edits, key=lambda e: -e[0][0]):
        stream = stream[:span[0]] + rep + stream[span[1]:]

    obj = pypdf.generic.DecodedStreamObject()
    obj.set_data(stream.encode('latin-1'))
    page.replace_contents(obj)
    with open(DST, 'wb') as f:
        writer.write(f)
    print('作りました:', os.path.basename(DST))
    print('消したところ:', ' / '.join('%s(%d文字目)' % (t, p) for t, p in removed))


if __name__ == '__main__':
    main()
