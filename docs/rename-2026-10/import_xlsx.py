#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Excel で直した一覧を master.json に取り込む。

    python3 import_xlsx.py out/商品名リネーム（2026年10月\\ 全店改変）.xlsx

  Excel にしか無い項目（No・大分類・ジャンル帯・英語名・日本語名・現行英語名・
  変更区分・英語説明文・備考）を master.json に書き戻す。
  Excel に無い項目（PDFの理由書き note・写真 image・並び順 card_seq・HP用の
  ファイル名 hp）は、元の商品の設定をそのまま引き継ぐ。

  引き継ぎ先は「No が同じ行」→「日本語名が同じ行」→「英語名が同じ行」の順に探す。
  見つからなかった行は新しい商品として足し、Excel から消えた商品は落とす。
  どちらも最後に一覧で出すので、必ず目で確かめること。
"""
import json, os, sys, collections
import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
MASTER = os.path.join(HERE, 'master.json')
CARRY = ('note', 'footnote', 'card_seq', 'image', 'hp', 'reprint_row')


def main(path):
    m = json.load(open(MASTER, encoding='utf-8'))
    old = m['items']
    by_no = {i['no']: i for i in old if i.get('no')}
    by_ja = collections.defaultdict(list)
    by_en = collections.defaultdict(list)
    for i in old:
        by_ja[i['ja']].append(i)
        by_en[i['en']].append(i)

    ws = openpyxl.load_workbook(path)['商品名マスタ']
    items, used, added = [], set(), []
    for row in ws.iter_rows(min_row=2, values_only=True):
        no, group, genre, en, ja, old_en, kind, desc, remark = \
            [('' if v is None else str(v).strip()) for v in row[:9]]
        if not en:
            continue
        src = None
        if no and int(no) in by_no:
            src = by_no[int(no)]
        elif len(by_ja.get(ja, [])) == 1:
            src = by_ja[ja][0]
        elif len(by_en.get(en, [])) == 1:
            src = by_en[en][0]

        it = collections.OrderedDict()
        it['no'] = int(no) if no else None
        it['group'] = group
        it['genre'] = genre
        it['en'] = en
        it['ja'] = ja
        it['old_en'] = old_en
        it['kind'] = kind
        if desc:
            it['desc_en'] = desc
        if src and src.get('note'):
            it['note'] = src['note']
        if remark:
            it['remark'] = remark
        for key in CARRY:
            if key != 'note' and src and src.get(key) is not None:
                it[key] = src[key]
        items.append(it)
        if src is None:
            added.append(en)
        else:
            used.add(id(src))

    removed = [i['en'] for i in old if id(i) not in used]
    m['items'] = items
    json.dump(m, open(MASTER, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

    print('master.json を更新しました（%d品）' % len(items))
    if added:
        print('  ＋ 新しく入った商品（写真・並び順は未設定）:', '／'.join(added))
    if removed:
        print('  － Excel から消えていた商品:', '／'.join(removed))
    print('  つづけて python3 build.py で3点を作り直してください。')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
