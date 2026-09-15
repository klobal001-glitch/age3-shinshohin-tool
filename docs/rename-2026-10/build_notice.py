#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""修正のお知らせ（A4・1枚）を作る。

    python3 build_notice.py

  中身は master.json の "notice"。変わったところだけを1枚にまとめたもので、
  海外店・FCへの周知用。本体の資料（build.py）と同じ体裁にしてある。
"""
import json, os

from build import (Sheet, wrap, w, M, R, CW, PH,
                   DARK, MUTED, BEIGE, WHITE, RED, GOLD,
                   LEAD_Y, LEAD_LH)

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')

PAD = 14.1732            # カードの中の左右の余白（5mm）
CARD_H = 88.0
CARD_GAP = 5.67


def draw_change(s, top, ch):
    """1品ぶんの「前 → 後」のカード。"""
    x = M + PAD
    s.rect(M, top, CW, CARD_H, BEIGE, radius=8.5039)
    s.rect(M, top, 4.2520, CARD_H, GOLD, radius=2)

    s.text(x, top + 18.5, ch['ja'], 12, DARK, bold=True)
    if ch.get('where'):
        s.text(R - PAD, top + 18.0, ch['where'], 7.5, MUTED, align='right')

    s.text(x, top + 37.0, '修正前', 7.5, MUTED)
    old_x = x + 38
    s.text(old_x, top + 37.0, ch['from'], 10, MUTED)
    # 打ち消し線（太字を持たないフォントなので線は自分で引く）
    s.rect(old_x, top + 37.0 - 3.1, w(ch['from'], 10), 0.6, MUTED)

    s.text(x, top + 60.0, '修正後', 7.5, GOLD, bold=True)
    s.text(old_x, top + 61.5, ch['to'], 15, DARK, bold=True)

    s.text(x, top + 79.0, ch['why'], 8.5, MUTED)
    return CARD_H + CARD_GAP


def main():
    m = json.load(open(os.path.join(HERE, 'master.json'), encoding='utf-8'))
    n, meta = m['notice'], m['meta']
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, n['pdf_filename'])

    s = Sheet(path, n['pdf_title'])
    s.page({'title': n['title'],
            'header_right': meta['header_right'],
            'footer': n.get('footer', meta['footer'])},
           n['subtitle'], 1, 1, show_page_num=False)

    y = LEAD_Y + 4
    for line in n['lead']:
        s.text(M, y, line, 10, DARK)
        y += 14.5
    y += 18.0

    s.rect(M, y, CW, 36.0, RED, radius=4.2520)
    s.text(M + CW / 2, y + 23.6, n['banner'], 14, WHITE, bold=True, align='center')
    y += 36.0 + 19.0
    for line in wrap(n['banner_note'], 9.5, CW):
        s.text(M, y, line, 9.5, MUTED)
        y += 14.0
    y += 12.0

    for ch in n['changes']:
        y += draw_change(s, y, ch)

    y += 20.0
    s.text(M, y, n['closing'], 10, DARK)

    s.done()
    s.save()
    print('お知らせ:', os.path.basename(path))


if __name__ == '__main__':
    main()
