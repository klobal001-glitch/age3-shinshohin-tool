#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""master.json から 3点の資料を作り直す。

    python3 build.py

  出力先は out/ 。
    ・商品名リネーム（2026年10月 全店改変）.pdf   … 決裁用の4ページ
    ・商品名リネーム（2026年10月 全店改変）.xlsx  … 全55品の一覧
    ・HP更新用マスタ（2026年10月）.md              … 公式HPに渡す36品

  直すのは master.json だけ。このファイルは「見た目」を持っているだけなので、
  文言・商品・区分を変えたいときに開く必要はない。
"""
import json, os, sys

from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
IMG = os.path.join(HERE, 'images')
ATTACH = os.path.join(HERE, 'attach')   # 資料の最後に足すPDF（レシピなど）

# ── 紙とフォント ────────────────────────────────────────────────
PW, PH = 595.2756, 841.8898          # A4 縦
M, R = 39.6850, 555.5906             # 左余白 14mm / 右端
CW = R - M                           # 本文の幅

FONT = 'JP'                          # 日本語・英数字。元のPDFと同じ IPA Pゴシック
FONT_CANDIDATES = [
    '/usr/share/fonts/opentype/ipafont-gothic/ipagp.ttf',   # IPA Pゴシック（元のPDFと同じ）
    '/usr/share/fonts/truetype/fonts-japanese-gothic.ttf',
    '/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc',
    '/Library/Fonts/Arial Unicode.ttf',
]
# タイ語（Loma）は CFF なので reportlab が読めない。初回だけ TrueType に変換して .fontcache に置く。
TH_CANDIDATES = ['/usr/share/fonts/opentype/tlwg/Loma.otf',
                 '/usr/share/fonts/truetype/tlwg/Loma.ttf']
ZH_CANDIDATES = [('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', 0),
                 ('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', 2)]
FONTCACHE = os.path.join(HERE, '.fontcache')

# ── 色 ──────────────────────────────────────────────────────────
DARK   = (0.133333, 0.133333, 0.133333)   # #222222 文字・帯
MUTED  = (0.4, 0.4, 0.4)                  # #666666 補足
FAINT  = (0.866667, 0.866667, 0.866667)   # #DDDDDD 帯の中の補足
BEIGE  = (0.956863, 0.945098, 0.917647)   # #F4F1EA 面
WHITE  = (1, 1, 1)
RED    = (0.784314, 0.211765, 0.168627)   # #C8362B 変更するもの
GOLD   = (0.788235, 0.635294, 0.152941)   # #C9A227 印・罫
NAVY   = (0.184314, 0.282353, 0.345098)   # #2F4858 和名維持
RED_BG = (0.980392, 0.929412, 0.921569)   # #FAEDEB 注意の枠の地

BADGE = {                                  # 変更区分 → （ラベル, 色）
    '和名維持':     ('和名維持',   NAVY),
    '英語名変更':   ('英語名を変更', RED),
    '再販時に修正': ('再販時に修正', GOLD),
}
XLSX_FILL = {
    '和名維持': 'DCE6F1', '英語名変更': 'F8D7D3',
    '変更不要': 'F2F2F2', '再販時に修正': 'FFF2CC',
}

# ── ページ内の位置（元のPDFから実測。pt） ──────────────────────
BAR_H, GOLD_H = 62.3622, 2.8346            # 上の黒帯と金の線
TITLE_Y, SUB_Y, FOOT_Y = 34.0157, 51.0236, 819.2126
LEAD_Y, LEAD_LH = 94.5600, 13.7750         # リード文の1行目と行送り

CARD_X, CARD_W = M, CW
CARD_H_DESC, CARD_H_PLAIN = 85.0394, 65.1969
CARD_GAP_DESC, CARD_GAP_PLAIN = 91.3386 - 85.0394, 70.8661 - 65.1969
IMG_CX, IMG_BOTTOM_PAD = 96.3780, 8.5039   # 写真の中心と、カード下端からの余白
IMG_H_DESC, IMG_H_PLAIN = 68.0315, 48.1890
BADGE_X, BADGE_W, BADGE_H = 158.7402, 56.6929, 14.1732
NAME_X = 223.9370
JA_GAP = 10.4                              # 英語名と「／ 日本語名」の間
BOX_X, BOX_W, BOX_H = 158.7402, 385.5118, 28.3465
BOX_PAD_X = 170.0787 - 158.7402
BAR_W = 4.2520                             # 説明文の左の金の線

# カード上端からの相対位置
DY_GENRE, DY_BADGE, DY_NAME, DY_JA = 11.40, 11.94, 24.99, 24.46
DY_OLD, DY_NOTE, DY_FOOT = 44.34, 57.14, 77.00
DY_BOX, DY_BOX_NO_OLD = 49.14, 36.84
DY_BOX_LABEL, DY_BOX_BODY = 11.36, 23.60

NOTICE_PAD, NOTICE_LH = 16.5, 11.6         # 注意の枠：ラベルぶんの高さと行送り
NOTICE_STEPS_H = 32.5                      # 注意の枠：手順の帯ぶんの高さ
TBL_PAD_X = 5.6693                         # 表の左右の内側余白
CALLOUT_X = M + 14.1732                    # 囲みの中の文字の左
WRAP_W = 490.0                             # 囲みの中の折り返し幅
PAGE_LIMIT = 795.0                         # ここより下にはカードを置かない

ASCENT = 0.8795                            # 字上端 → ベースライン（IPAゴシック）


def _find_font():
    for p in FONT_CANDIDATES:
        if os.path.exists(p):
            return p
    sys.exit('日本語フォントが見つかりません。IPAゴシックを入れてください：\n'
             '  apt-get install fonts-ipafont-gothic')


pdfmetrics.registerFont(TTFont(FONT, _find_font()))
_CMAP = {FONT: set(pdfmetrics.getFont(FONT).face.charToGlyph)}
LANG = 'ja'                          # main() が言語を入れる


def _otf_to_ttf(src, dst):
    """CFF の OTF を TrueType に変換する（reportlab は CFF を読めないため）。"""
    from fontTools.ttLib import TTFont as FT, newTable
    from fontTools.pens.ttGlyphPen import TTGlyphPen
    from fontTools.pens.cu2quPen import Cu2QuPen
    f = FT(src)
    gs = f.getGlyphSet()
    glyf = newTable('glyf')
    glyf.glyphOrder = f.getGlyphOrder()
    glyf.glyphs = {}
    for name in f.getGlyphOrder():
        pen = TTGlyphPen(gs)
        gs[name].draw(Cu2QuPen(pen, 1.0, reverse_direction=True))
        glyf.glyphs[name] = pen.glyph()
    f['glyf'] = glyf
    for g in glyf.glyphs.values():
        g.recalcBounds(glyf)
    f['loca'] = newTable('loca')
    maxp = newTable('maxp')
    maxp.tableVersion = 0x00010000
    for k, v in dict(maxZones=1, maxTwilightPoints=0, maxStorage=0, maxFunctionDefs=0,
                     maxInstructionDefs=0, maxStackElements=0, maxSizeOfInstructions=0,
                     maxComponentElements=0, maxComponentDepth=0).items():
        setattr(maxp, k, v)
    f['maxp'] = maxp
    maxp.recalc(f)
    f['head'].indexToLocFormat = 0
    f['head'].glyphDataFormat = 0
    for t in ('CFF ', 'VORG'):
        if t in f:
            del f[t]
    f.sfntVersion = '\000\001\000\000'
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    f.save(dst)


def _register(name, path, index=None):
    try:
        pdfmetrics.registerFont(TTFont(name, path) if index is None
                                else TTFont(name, path, subfontIndex=index))
    except Exception:
        return False
    _CMAP[name] = set(pdfmetrics.getFont(name).face.charToGlyph)
    return True


def use_language(lang):
    """必要な言語のフォントをそろえる。"""
    global LANG
    LANG = lang
    if lang == 'th' and 'TH' not in _CMAP:
        for src in TH_CANDIDATES:
            if not os.path.exists(src):
                continue
            path = src
            if src.endswith('.otf'):
                path = os.path.join(FONTCACHE, 'Loma.ttf')
                if not os.path.exists(path):
                    _otf_to_ttf(src, path)
            if _register('TH', path):
                break
        else:
            sys.exit('タイ語フォントが見つかりません： apt-get install fonts-tlwg-loma-otf')
    if lang == 'zh' and 'ZH' not in _CMAP:
        for src, idx in ZH_CANDIDATES:
            if os.path.exists(src) and _register('ZH', src, idx):
                break
        else:
            sys.exit('中国語フォントが見つかりません： apt-get install fonts-wqy-zenhei')


def font_of(ch):
    """1文字ごとに使うフォントを決める（英数字はどの言語でも IPA ＝元の資料と同じ見た目）。"""
    o = ord(ch)
    if 0x0E00 <= o <= 0x0E7F and 'TH' in _CMAP:
        return 'TH'
    if LANG == 'zh' and o >= 0x2E80 and 'ZH' in _CMAP:
        return 'ZH'
    if o in _CMAP[FONT]:
        return FONT
    for name in ('ZH', 'TH'):
        if name in _CMAP and o in _CMAP[name]:
            return name
    return FONT


def runs(s):
    """文字列を「同じフォントで書けるかたまり」に分ける。"""
    out = []
    for ch in s:
        f = font_of(ch)
        if out and out[-1][0] == f:
            out[-1][1] += ch
        else:
            out.append([f, ch])
    return out


def w(s, size):
    if not s:
        return 0
    return sum(pdfmetrics.stringWidth(t, f, size) for f, t in runs(s))


class Sheet:
    """上端からの y（pt）で書ける薄いラッパー。"""

    def __init__(self, path, title, size=None):
        self.pw, self.ph = size or (PW, PH)
        self.c = canvas.Canvas(path, pagesize=(self.pw, self.ph))
        self.c.setTitle(title)
        self.c.setAuthor('株式会社ANCHOR／Age.3')
        self.c.setSubject('商品名リネーム')

    # --- 描くもの -------------------------------------------------
    def text(self, x, y, s, size, color=DARK, bold=False, align='left'):
        if not s:
            return
        if align == 'right':
            x -= w(s, size)
        elif align == 'center':
            x -= w(s, size) / 2
        self.c.setFillColorRGB(*color)
        for font, part in runs(s):     # 言語ごとにフォントが変わるので、かたまりごとに書く
            self.c.setFont(font, size)
            self.c.drawString(x, self.ph - y, part)
            if bold:                   # 太字を持たないフォントなので0.25ptずらして二度打ち
                self.c.drawString(x + 0.25, self.ph - y, part)
            x += pdfmetrics.stringWidth(part, font, size)

    def rect(self, x, y, width, height, color, radius=0):
        self.c.setFillColorRGB(*color)
        if radius:
            self.c.roundRect(x, self.ph - y - height, width, height, radius, stroke=0, fill=1)
        else:
            self.c.rect(x, self.ph - y - height, width, height, stroke=0, fill=1)

    def image(self, name, cx, bottom, height, max_w=None):
        """cx を中心に、下端 bottom で描く。max_w を超えるときは縮める。"""
        path = os.path.join(IMG, name)
        if not os.path.exists(path):
            return False
        img = ImageReader(path)
        iw, ih = img.getSize()
        width = iw * height / ih
        if max_w and width > max_w:
            height *= max_w / width
            width = max_w
        self.c.drawImage(img, cx - width / 2, self.ph - bottom, width, height, mask='auto')
        return True

    def image_file(self, path, x, top, size):
        """正方形の絵（QRコードなど）を左上から置く。"""
        self.c.drawImage(ImageReader(path), x, self.ph - top - size, size, size)

    def missing_image(self, cx, bottom, height, width, label):
        """画像がまだ無いとき、置き場所だけ分かるように灰色の枠を出す。"""
        self.c.setFillColorRGB(0.898, 0.894, 0.886)
        self.c.roundRect(cx - width / 2, self.ph - bottom, width, height, 3, stroke=0, fill=1)
        self.text(cx, bottom - height / 2 + 3, label, 6, MUTED, align='center')

    # --- ページ ---------------------------------------------------
    def page(self, meta, subtitle, num, total, show_page_num=True):
        self.rect(0, 0, PW, BAR_H, DARK)
        self.rect(0, BAR_H, PW, GOLD_H, GOLD)
        self.text(M, TITLE_Y, meta['title'], 14, WHITE, bold=True)
        self.text(M, SUB_Y, subtitle, 8.5, FAINT)
        self.text(R, SUB_Y, meta['header_right'], 8, FAINT, align='right')
        self.text(M, FOOT_Y, meta['footer'], 7.5, MUTED)
        if show_page_num:
            self.text(R, FOOT_Y, '%d / %d' % (num, total), 7.5, MUTED, align='right')

    def done(self):
        self.c.showPage()

    def save(self):
        self.c.save()


def wrap(s, size, width):
    """空白で区切って折り返し、空白のない和文のかたまりは幅のところで割る。"""
    lines, cur = [], ''
    for word in s.split(' '):
        cand = word if not cur else cur + ' ' + word
        if w(cand, size) <= width:
            cur = cand
            continue
        if cur:
            lines.append(cur)
            cur = ''
        while w(word, size) > width:
            n = 1
            while n < len(word) and w(word[:n + 1], size) <= width:
                n += 1
            lines.append(word[:n])
            word = word[n:]
        cur = word
    if cur:
        lines.append(cur)
    return lines or ['']


def find_recipe(m):
    """資料の最後に足すレシピ（いまは海外版のあんバターだけ）。"""
    for it in m['items']:
        rec = (it.get('overseas') or {}).get('recipe')
        if rec:
            return rec
    return None


def attach_recipe(path, rec, lang):
    """レシピのPDFを最後に足し、作り方動画のQRコードを重ねる。"""
    import io
    import qrcode
    from pypdf import PdfReader, PdfWriter

    src = os.path.join(ATTACH, rec['pdf'])
    if not os.path.exists(src):
        print('  ※ レシピPDFが見つかりません:', src)
        return
    page = PdfReader(src).pages[0]
    pw = float(page.mediabox.width)
    ph = float(page.mediabox.height)

    # QRコードを作る
    q = qrcode.QRCode(border=1, box_size=10,
                      error_correction=qrcode.constants.ERROR_CORRECT_M)
    q.add_data(rec['video'])
    q.make(fit=True)
    qr_png = os.path.join(FONTCACHE, 'qr.png')
    os.makedirs(FONTCACHE, exist_ok=True)
    q.make_image(fill_color='black', back_color='white').convert('RGB').save(qr_png)

    # 重ねる紙（レシピの右下の空きに置く）
    tmp = os.path.join(OUT, '_overlay.tmp.pdf')
    o = Sheet(tmp, 'overlay', size=(pw, ph))
    bx, by, bw, bh = 292.0, 641.0, 264.0, 94.0
    o.rect(bx, by, bw, bh, BEIGE, radius=6)
    o.rect(bx, by, 4.2520, bh, GOLD, radius=2)
    o.image_file(qr_png, bx + 14, by + 16, 62)
    tx = bx + 88
    o.text(tx, by + 24, rec['label'].get(lang, rec['label']['ja']), 8, GOLD, bold=True)
    o.text(tx, by + 42, 'youtu.be/' + rec['video'].rstrip('/').split('/')[-1], 10, DARK, bold=True)
    o.text(tx, by + 58, rec['hint'].get(lang, rec['hint']['ja']), 7.5, MUTED)
    o.done()
    o.save()

    page.merge_page(PdfReader(tmp).pages[0])
    out = PdfWriter()
    for p_ in PdfReader(path).pages:
        out.add_page(p_)
    out.add_page(page)
    with open(path, 'wb') as f:
        out.write(f)
    os.remove(tmp)


# ── 言語ごとの文言 ──────────────────────────────────────────────
class Words:
    """master.json の i18n から文言を取る。無ければ日本語に戻す。"""

    def __init__(self, m, lang):
        self.lang = lang
        self.d = {} if lang == 'ja' else m.get('i18n', {}).get(lang, {})
        self.ja = dict(m['meta'], **m['sections'])

    def __call__(self, key, default=None):
        if key in self.d:
            return self.d[key]
        if key in self.ja:
            return self.ja[key]
        return default

    def badge(self, kind):
        return self.d.get('badge', {}).get(kind, BADGE[kind][0])

    def item(self, it, key):
        """note / footnote は商品ごとに note_en のような形で持っている。"""
        return it.get('%s_%s' % (key, self.lang), it.get(key) if self.lang == 'ja' else '')


# ── 1〜2ページ目・4ページ目のカード ────────────────────────────
def card_parts(it, t=None):
    """カードの中身と高さを先に決める（ページ割りにも使う）。"""
    # 海外版だけ名前が変わる商品がある（北海道あんバター → Anko & Butter）
    ov = it.get('overseas') if (t and t.lang != 'ja') else None
    lang = t.lang if t else 'ja'
    has_desc = bool(it.get('desc_en'))
    en_name = ov['en'] if ov else it['en']
    old = it.get('old_en')
    show_old = bool(old and old != en_name)
    foot = (ov.get('note_%s' % lang) or ov.get('note')) if ov else (
        t.item(it, 'footnote') if t else it.get('footnote'))
    notice = ov.get('notice') if ov else None
    n_lines = notice['lines'].get(lang, notice['lines']['ja']) if notice else []
    n_steps = (notice.get('steps') or {}).get(lang, (notice.get('steps') or {}).get('ja', [])) \
        if notice else []
    # 「現行」の行と脚注が両方あると説明文の枠と重なるので、その分だけカードを伸ばす
    extra = 12.3 if (has_desc and show_old and foot) else 0
    h = (CARD_H_DESC + extra) if has_desc else CARD_H_PLAIN
    if notice:
        h += NOTICE_PAD + len(n_lines) * NOTICE_LH + 8.5
        if n_steps:
            h += NOTICE_STEPS_H
    return dict(ov=ov, lang=lang, has_desc=has_desc, en_name=en_name, old=old,
                show_old=show_old, foot=foot, notice=notice, n_lines=n_lines,
                n_steps=n_steps, extra=extra, h=h)


def card_height(it, t=None):
    p = card_parts(it, t)
    return p['h'] + (CARD_GAP_DESC if p['has_desc'] else CARD_GAP_PLAIN)


def draw_card(s, top, it, t=None):
    p = card_parts(it, t)
    ov, has_desc, en_name = p['ov'], p['has_desc'], p['en_name']
    old, show_old, foot, extra, h = p['old'], p['show_old'], p['foot'], p['extra'], p['h']
    s.rect(CARD_X, top, CARD_W, h, BEIGE, radius=8.5039)

    img_h = IMG_H_DESC if has_desc else IMG_H_PLAIN
    img_bottom = top + (CARD_H_DESC + extra if has_desc else CARD_H_PLAIN) - IMG_BOTTOM_PAD
    if ov and ov.get('photo_before'):
        # 旧 → 新 を並べて、写真が変わることを絵で見せる
        pair_h, pair_bottom = 58.0, top + 68.0
        lab = ov.get('photo_labels', {})
        for cx, fname, key in ((69.0, ov['photo_before'], 'before'),
                               (127.0, it.get('image', ''), 'after')):
            if not fname or not s.image(fname, cx, pair_bottom, pair_h, max_w=46):
                s.missing_image(cx, pair_bottom, pair_h, 40, '？')
            name = lab.get(key, {}).get(p['lang'], lab.get(key, {}).get('ja', ''))
            tw = w(name, 6.5) + 10
            now = (key == 'before')      # いま使うほうを橙で塗って目立たせる
            s.rect(cx - tw / 2, pair_bottom + 3.5, tw, 12.0, GOLD if now else (0.87, 0.865, 0.855),
                   radius=6.0)
            s.text(cx, pair_bottom + 12.0, name, 6.5, WHITE if now else MUTED,
                   bold=now, align='center')
        s.text(98.0, pair_bottom - pair_h / 2 + 4, '→', 11, MUTED, bold=True, align='center')
    elif it.get('image'):
        s.image(it['image'], IMG_CX, img_bottom, img_h)

    genre_label = t('genre_label', 'ジャンル帯：') if t else 'ジャンル帯：'
    s.text(R, top + DY_GENRE, genre_label + it['genre'], 7, MUTED, align='right')

    label, color = BADGE[it['kind']]
    if t:
        label = t.badge(it['kind'])
    s.rect(BADGE_X, top + DY_BADGE, BADGE_W, BADGE_H, color, radius=2.8346)
    s.text(BADGE_X + BADGE_W / 2, top + DY_BADGE + 10.46, label, 7, WHITE,
           bold=True, align='center')

    ja_name = ov.get('ja', it['ja']) if ov else it['ja']
    ja = '／ ' + ja_name if ja_name else ''
    size = 12
    for cand in (12, 10, 9):             # 名前が長いときだけ落とす
        size = cand
        if NAME_X + w(en_name, cand) + JA_GAP + w(ja, 9) <= R:
            break
    s.text(NAME_X, top + DY_NAME, en_name, size, DARK, bold=True)
    s.text(NAME_X + w(en_name, size) + JA_GAP, top + DY_JA, ja, 9, MUTED)

    if show_old:
        cur = t('current_label', '現行：') if t else '現行：'
        s.text(BADGE_X, top + DY_OLD, cur + old, 7.5, RED)

    if has_desc:
        box_top = top + (DY_BOX if show_old else DY_BOX_NO_OLD)
        s.rect(BOX_X, box_top, BOX_W, BOX_H, WHITE, radius=4.2520)
        s.rect(BOX_X, box_top, BAR_W, BOX_H, GOLD, radius=2)
        s.text(BOX_X + BOX_PAD_X, box_top + DY_BOX_LABEL,
               t('desc_label', '説明文') if t else '説明文', 7, GOLD, bold=True)
        s.text(BOX_X + BOX_PAD_X, box_top + DY_BOX_BODY, it['desc_en'], 10, DARK, bold=True)
        if foot:
            s.text(BADGE_X, top + DY_FOOT + extra, foot, 7.5, MUTED)
        if p['notice']:
            n_top = box_top + BOX_H + 8.5
            n_h = NOTICE_PAD + len(p['n_lines']) * NOTICE_LH
            s.rect(BOX_X, n_top, BOX_W, n_h, RED_BG, radius=4.2520)
            s.rect(BOX_X, n_top, BAR_W, n_h, RED, radius=2)
            s.text(BOX_X + BOX_PAD_X, n_top + 11.4,
                   p['notice']['label'].get(p['lang'], p['notice']['label']['ja']),
                   7, RED, bold=True)
            for i, line in enumerate(p['n_lines']):
                s.text(BOX_X + BOX_PAD_X, n_top + 22.6 + i * NOTICE_LH, line, 8, DARK)
            if p['n_steps']:
                base = n_top + 22.6 + len(p['n_lines']) * NOTICE_LH
                title = p['notice'].get('steps_title', {})
                s.text(BOX_X + BOX_PAD_X, base + 7.0,
                       title.get(p['lang'], title.get('ja', '')), 7, RED, bold=True)
                x, cy = BOX_X + BOX_PAD_X, base + 11.0
                for i, st in enumerate(p['n_steps']):
                    cw_ = w(st, 7) + 12
                    s.rect(x, cy, cw_, 13.5, WHITE, radius=6.75)
                    s.text(x + cw_ / 2, cy + 9.4, st, 7, DARK, align='center')
                    x += cw_
                    if i < len(p['n_steps']) - 1:
                        s.text(x + 5.5, cy + 9.4, '→', 7, MUTED, align='center')
                        x += 11
    else:
        note = t.item(it, 'note') if t else it.get('note')
        if ov:
            note = ov.get('note_%s' % t.lang) or ov.get('note')
        if note:
            s.text(BADGE_X, top + DY_NOTE, note, 8, MUTED)

    return h + (CARD_GAP_DESC if has_desc else CARD_GAP_PLAIN)


def draw_lead(s, y, lines, size=9.5, color=DARK):
    flat = [l for line in lines for l in wrap(line, size, CW)]   # 念のため折り返す
    for i, line in enumerate(flat):
        s.text(M, y + i * LEAD_LH, line, size, color)
    # リード文の下に置くものの上端
    return y + (len(flat) - 1) * LEAD_LH + (12.73 if len(flat) > 1 else 10.33)


# ── 表 ──────────────────────────────────────────────────────────
def table(s, top, headers, cols, rows, head_h, head_dy, row_h, row_dy, head_size, cell):
    """cols=各列の左x／rows=各行の値／cell=列ごとの (文字の大きさ, 色, 太字)"""
    s.rect(M, top, CW, head_h, DARK)
    for x, label in zip(cols, headers):
        s.text(x, top + head_dy, label, head_size, WHITE, bold=True)
    y = top + head_h
    for i, row in enumerate(rows):
        if i % 2 == 0:
            s.rect(M, y, CW, row_h, BEIGE)
        for x, value, (size, color, bold) in zip(cols, row, cell):
            s.text(x, y + row_dy, value, size, color, bold=bold)
        y += row_h
    return y


def draw_box(s, top, title, body, pad=13.65, min_h=0):
    lines = wrap(body, 8, WRAP_W)
    h = max(min_h, pad + len(lines) * 11.6)
    s.rect(M, top, CW, h, BEIGE, radius=4.2520)
    s.rect(M, top, BAR_W, h, GOLD, radius=2)
    s.text(CALLOUT_X, top + 14.2, title, 9.5, DARK, bold=True)
    for i, line in enumerate(lines):
        s.text(CALLOUT_X, top + 27.8 + i * 11.6, line, 8, MUTED)
    return h


# ── PDF ─────────────────────────────────────────────────────────
def build_pdf(m, path, only_changes=False, lang='ja'):
    """only_changes=True なら、名前が変わる商品の2ページだけを出す（海外に配る用）。"""
    use_language(lang)
    t = Words(m, lang)
    items = m['items']
    meta, sec = m['meta'], m['sections']
    head = {'title': t('title'), 'header_right': t('header_right'), 'footer': t('footer')}
    wamei = [i for i in items if i['kind'] == '和名維持']
    rename = sorted([i for i in items if i['kind'] == '英語名変更'],
                    key=lambda i: i.get('card_seq', 999))
    wamei.sort(key=lambda i: i.get('card_seq', 999))
    keep = [i for i in items if i['kind'] == '変更不要']
    reprint = [i for i in items if i['kind'] == '再販時に修正']

    # 英語名変更のカードは、1ページ目に入るところまで入れて、残りを次のページへ送る。
    # （カードが高くなる言語・商品があるので、高さを測って割る）
    y = LEAD_Y
    for line in [l for x in t('wamei_lead') for l in wrap(x, 9.5, CW)]:
        y += LEAD_LH
    y = LEAD_Y + (len(t('wamei_lead')) - 1) * LEAD_LH + 12.73
    for it in wamei:
        y += card_height(it, t)
    y += 17.87 + LEAD_LH + 12.73                 # 2つめのリード文（2行）
    pages_of_rename, cur = [], []
    for it in rename:
        if cur and y + card_parts(it, t)['h'] > PAGE_LIMIT:
            pages_of_rename.append(cur)
            cur, y = [], LEAD_Y + 10.33          # 次のページはリード文1行のあとから
        cur.append(it)
        y += card_height(it, t)
    if cur:
        pages_of_rename.append(cur)
    total = len(pages_of_rename) if only_changes else 2 + len(pages_of_rename)
    # 海外版はレシピのページを最後に足すので、ページ数に1つ足しておく
    recipe = find_recipe(m) if (only_changes and lang != 'ja') else None
    if recipe:
        total += 1

    s = Sheet(path, t('pdf_title'))

    # 1ページ目 ────────────────────────────────
    s.page(head, t('policy'), 1, total)
    y = draw_lead(s, LEAD_Y, t('wamei_lead'))
    for it in wamei:
        y += draw_card(s, y, it, t)
    n = len(rename)
    lead = [l.format(n=n, i=1, t=len(pages_of_rename)) for l in t('rename_lead')]
    y = draw_lead(s, y + 17.87, lead)
    for it in pages_of_rename[0]:
        y += draw_card(s, y, it, t)
    s.done()

    # 2ページ目以降（英語名変更の続き） ─────────
    for idx, group in enumerate(pages_of_rename[1:], start=2):
        s.page(head, t('page2_subtitle'), idx, total)
        lead = [l.format(n=n, i=idx, t=len(pages_of_rename)) for l in t('rename_lead_cont')]
        y = draw_lead(s, LEAD_Y, lead)
        for it in group:
            y += draw_card(s, y, it, t)
        s.done()

    if only_changes:
        s.save()
        if recipe:
            attach_recipe(path, recipe, lang)
        return

    # 変更不要＋運用ルール ──────────────────────
    s.page(head, sec['page3_subtitle'], total - 1, total)
    s.text(M, 90.7, sec['page3_table_title'], 10, DARK, bold=True)
    rows = [(i['en'], i['ja'], i['genre']) for i in keep]
    y = table(s, 104.8819, ['英語名', '日本語名', 'ジャンル帯'],
              [M + TBL_PAD_X, 235.7, 411.1], rows,
              head_h=14.1732, head_dy=10.18, row_h=12.4724, row_dy=9.88,
              head_size=7.5,
              cell=[(8, DARK, True), (7.5, MUTED, False), (7.5, MUTED, False)])
    y += 17.04
    for callout in m['callouts']:
        y += draw_box(s, y, callout['title'], callout['body'], min_h=28.3465) + 5.67
    y += 11.35 - 5.67
    s.text(M, y, m['rules_title'], 10, DARK, bold=True)
    y += 17.0
    for rule in m['rules']:
        y += draw_box(s, y, rule['title'], rule['body'], pad=25.5) + 5.67
    s.done()

    # 再販時に修正 ──────────────────────────────
    s.page(head, sec['page4_subtitle'], total, total)
    s.rect(M, 85.0394, CW, 31.1811, RED, radius=4.2520)
    s.text(M + CW / 2, 105.74, sec['page4_banner'], 13, WHITE, bold=True, align='center')
    s.text(M, 136.5, sec['page4_lead'], 9, MUTED)

    cards = [i for i in reprint if i.get('image')]
    cards.sort(key=lambda i: i.get('card_seq', 999))
    y = 154.8
    for it in cards:
        y += draw_card(s, y, it)

    def chip(top, label, color):
        s.rect(M, top, 62.3622, 15.5906, color, radius=2.8346)
        s.text(M + 62.3622 / 2, top + 11.3, label, 7.5, WHITE, bold=True, align='center')

    wamei_rows = [i for i in reprint if i.get('desc_en')]
    other_rows = [i for i in reprint if i not in cards and i not in wamei_rows]
    other_rows += [i for i in items if i.get('reprint_row')]

    y += 15.6
    chip(y, '和名維持', NAVY)
    y += 24.1
    y = table(s, y, ['商品（日本語）', '英語名', '説明文'],
              [M + TBL_PAD_X, 141.7, 311.8],
              [(i['ja'], i['en'], i.get('desc_en', '')) for i in wamei_rows],
              head_h=15.5906, head_dy=11.34, row_h=17.0079, row_dy=11.8,
              head_size=8,
              cell=[(8, DARK, False), (8.5, DARK, True), (8, MUTED, False)])
    y += 16.4
    s.text(M, y, sec['page4_wamei_note'], 8, MUTED)

    y += 19.0
    chip(y, '英語名', RED)
    y += 24.1
    table(s, y, ['商品（日本語）', '英語名', '補足'],
          [M + TBL_PAD_X, 141.7, 311.8],
          [(i.get('reprint_row', {}).get('ja', i['ja']),
            i['en'],
            i.get('reprint_row', {}).get('note', i.get('note', ''))) for i in other_rows],
          head_h=15.5906, head_dy=11.34, row_h=17.0079, row_dy=11.8,
          head_size=8,
          cell=[(8, DARK, False), (8.5, DARK, True), (8, MUTED, False)])
    s.done()
    s.save()


# ── xlsx ────────────────────────────────────────────────────────
def build_xlsx(m, path):
    import openpyxl
    from openpyxl.styles import Font, PatternFill, Alignment

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = '商品名マスタ'
    headers = ['No', '大分類', 'ジャンル帯', '英語名（新）', '日本語名',
               '現行英語名（旧）', '変更区分', '英語説明文', '備考']
    widths = [6, 9, 24, 36, 32, 30, 14, 42, 48]
    head_fill = PatternFill('solid', fgColor='222222')
    center = Alignment(vertical='center', wrap_text=True)

    ws.append(headers)
    for i, (cell, width) in enumerate(zip(ws[1], widths), start=1):
        cell.font = Font(bold=True, size=10, color='FFFFFF')
        cell.fill = head_fill
        cell.alignment = center
        ws.column_dimensions[chr(64 + i)].width = width
    ws.row_dimensions[1].height = 22

    for it in m['items']:
        ws.append([it['no'], it['group'], it['genre'], it['en'], it['ja'],
                   it.get('old_en', ''), it['kind'], it.get('desc_en', ''),
                   it.get('remark', '')])
        row = ws[ws.max_row]
        for cell in row:
            cell.font = Font(size=10)
            cell.alignment = center
        row[3].font = Font(size=10, bold=True)
        fill = XLSX_FILL.get(it['kind'])
        if fill:
            row[6].fill = PatternFill('solid', fgColor=fill)

    ws.freeze_panes = 'A2'
    ws.auto_filter.ref = 'A1:I%d' % ws.max_row

    ws2 = wb.create_sheet('凡例')
    ws2.column_dimensions['A'].width = 16
    ws2.column_dimensions['B'].width = 90
    for i, row in enumerate(m['legend'], start=1):
        ws2.append(row)
        for cell in ws2[i]:
            cell.alignment = center
            if i == 1:
                cell.font = Font(bold=True, color='FFFFFF')
                cell.fill = head_fill
        fill = XLSX_FILL.get(row[0])          # 変更区分の行は一覧と同じ色をつける
        if i > 1 and fill:
            ws2.cell(i, 1).fill = PatternFill('solid', fgColor=fill)
    wb.save(path)


# ── HP更新用の md ───────────────────────────────────────────────
def build_md(m, path):
    hp = m['hp']
    items = [i for i in m['items'] if i.get('hp')]
    items.sort(key=lambda i: i['no'])
    out = ['# ' + hp['title'], '']
    for line in hp['intro']:
        out.append(('  - ' if line.startswith('  ') else '- ') + line.strip())
    out += ['', '## 商品一覧（%d品）' % len(items), '',
            '| No | ジャンル帯 | 英語名（新） | 日本語名 | 旧英語名 | 変更区分 | '
            '英語説明文 | Web用ファイル名（zip） | Dropbox ファイル名（regular） |',
            '|---|---|---|---|---|---|---|---|---|']
    for i in items:
        out.append('| %d | %s | %s | %s | %s | %s | %s | %s | %s |' % (
            i['no'], i['genre'], i['en'], i['ja'], i.get('old_en', ''), i['kind'],
            i.get('desc_en', ''), i['hp']['web_filename'], i['hp']['dropbox_filename']))
    desc = [i for i in items if i.get('desc_en')]
    out += ['', '## 英語説明文を表示する商品', '', hp['desc_section'], '',
            '## 最終確認チェックリスト', '']
    out += ['- [ ] ' + c for c in hp['checklist']]
    out.append('')
    open(path, 'w', encoding='utf-8').write('\n'.join(out))
    return len(items), len(desc)


def main():
    m = json.load(open(os.path.join(HERE, 'master.json'), encoding='utf-8'))
    os.makedirs(OUT, exist_ok=True)
    meta = m['meta']

    if '--changes' in sys.argv:          # 名前が変わる商品だけの2ページ
        langs = [a.split('=', 1)[1] for a in sys.argv if a.startswith('--lang=')] or ['ja']
        for lang in (['ja', 'en', 'th', 'zh'] if langs == ['all'] else langs):
            t = Words(m, lang)
            pdf = os.path.join(OUT, t('pdf_changes_filename'))
            build_pdf(m, pdf, only_changes=True, lang=lang)
            print('変更ぶんPDF[%s]:' % lang, os.path.basename(pdf))
        return

    pdf = os.path.join(OUT, meta['pdf_filename'])
    build_pdf(m, pdf)
    print('PDF   :', os.path.basename(pdf))

    xlsx = os.path.join(OUT, meta['xlsx_filename'])
    build_xlsx(m, xlsx)
    print('Excel :', os.path.basename(xlsx), '（%d品）' % len(m['items']))

    md = os.path.join(OUT, meta['md_filename'])
    n, d = build_md(m, md)
    print('HP用md:', os.path.basename(md), '（%d品・説明文%d件）' % (n, d))


if __name__ == '__main__':
    main()
