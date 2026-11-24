#!/usr/bin/env python3
"""Create the MFM Oracle A6 gift card and a QR pointing to the verified live app.

Dependencies: reportlab, Pillow. Optional preview render: pypdfium2.
  python3 scripts/gift-card.py --output-dir ../../
  python3 scripts/gift-card.py --url https://YOUR-ACCOUNT.github.io/mfm-oracle/ \
      --name 'RECIPIENT' --output-dir ../../

With no URL, creates a clearly marked preview without a QR. The example URL is
only an example: a real HTTPS page containing MFM Oracle must respond first.
"""
from __future__ import annotations

import argparse
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from PIL import Image, ImageDraw
from reportlab.graphics.barcode import qrencoder
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

WIDTH, HEIGHT = 105 * mm, 148 * mm
INK = colors.HexColor('#080c14')
GOLD = colors.HexColor('#c6a56b')
PALE = colors.HexColor('#f0e9dc')
MUTED = colors.HexColor('#aaa99f')
SERIF, ITALIC, SANS, BOLD = 'Times-Roman', 'Times-Italic', 'Helvetica', 'Helvetica-Bold'


def register_fonts():
    global SERIF, ITALIC, SANS, BOLD
    candidates = [
        (Path('/System/Library/Fonts/Supplemental'), {
            'CardSerif': 'Georgia.ttf', 'CardItalic': 'Georgia Italic.ttf',
            'CardSans': 'Arial.ttf', 'CardBold': 'Arial Bold.ttf'}),
        (Path('/usr/share/fonts/truetype/dejavu'), {
            'CardSerif': 'DejaVuSerif.ttf', 'CardItalic': 'DejaVuSerifCondensed-Italic.ttf',
            'CardSans': 'DejaVuSans.ttf', 'CardBold': 'DejaVuSans-Bold.ttf'}),
    ]
    for directory, files in candidates:
        if all((directory / filename).exists() for filename in files.values()):
            for name, filename in files.items():
                pdfmetrics.registerFont(TTFont(name, str(directory / filename)))
            SERIF, ITALIC, SANS, BOLD = 'CardSerif', 'CardItalic', 'CardSans', 'CardBold'
            return


def center(c, text, y, font=None, size=10, color=PALE):
    c.setFillColor(color)
    c.setFont(font or SANS, size)
    c.drawCentredString(WIDTH / 2, y, text)


def tracked(c, text, y, size=7, spacing=1.6, color=GOLD):
    c.saveState()
    text_width = pdfmetrics.stringWidth(text, SANS, size) + max(0, len(text)-1) * spacing
    t = c.beginText((WIDTH-text_width)/2, y)
    t.setFont(SANS, size)
    t.setFillColor(color)
    t.setCharSpace(spacing)
    t.textOut(text)
    c.drawText(t)
    c.restoreState()


def wrap(text, font, size, max_width):
    lines, line = [], ''
    words = []
    for word in text.split():
        # Protect printed margins even if a custom dedication has a long token.
        fragment = ''
        for char in word:
            if fragment and pdfmetrics.stringWidth(fragment+char, font, size) > max_width:
                words.append(fragment)
                fragment = char
            else:
                fragment += char
        words.append(fragment)
    for word in words:
        candidate = f'{line} {word}'.strip()
        if line and pdfmetrics.stringWidth(candidate, font, size) > max_width:
            lines.append(line)
            line = word
        else:
            line = candidate
    if line:
        lines.append(line)
    return lines


def centered_lines(c, text, y, font=None, size=10, leading=15, color=PALE, max_width=240):
    lines = wrap(text, font or SANS, size, max_width)
    for line in lines:
        center(c, line, y, font, size, color)
        y -= leading
    return y


def base(c, preview=False):
    c.setFillColor(INK)
    c.rect(0, 0, WIDTH, HEIGHT, fill=1, stroke=0)
    c.setStrokeColor(GOLD)
    c.setLineWidth(.45)
    c.rect(13, 13, WIDTH-26, HEIGHT-26, fill=0, stroke=1)
    # A restrained double corner detail, leaving generous inner margins.
    c.setStrokeColor(colors.HexColor('#5a4b35'))
    c.setLineWidth(.3)
    for x, direction in ((18, 1), (WIDTH-18, -1)):
        for y, vertical in ((18, 1), (HEIGHT-18, -1)):
            c.line(x, y, x+direction*11, y)
            c.line(x, y, x, y+vertical*11)
    if preview:
        center(c, 'MAQUETTE · LIEN À VENIR', 22, SANS, 5.5, MUTED)


def star(c, x, y, radius=5):
    c.setStrokeColor(GOLD)
    c.setLineWidth(.55)
    c.line(x-radius, y, x+radius, y)
    c.line(x, y-radius, x, y+radius)
    c.setFillColor(GOLD)
    c.circle(x, y, 1.2, stroke=0, fill=1)


def sphere(c, cx, cy, radius):
    # Layered vector gradients remain crisp at print resolution.
    c.saveState()
    for i in range(32):
        c.setFillColor(colors.Color(.0, .0, .0, alpha=.018))
        c.ellipse(cx-radius*.72-i*.25, cy-radius-8-i*.08,
                  cx+radius*.72+i*.25, cy-radius+5+i*.08, stroke=0, fill=1)
    c.setFillColor(colors.HexColor('#030509'))
    c.circle(cx, cy, radius, stroke=0, fill=1)
    for i in range(90):
        t = i/89
        r = radius*(1-t*.94)
        c.setFillColor(colors.Color(.025+.105*t, .035+.12*t, .055+.145*t))
        c.circle(cx-radius*.24*t, cy+radius*.30*t, r, stroke=0, fill=1)
    c.setStrokeColor(colors.HexColor('#64707a'))
    c.setLineWidth(.55)
    c.arc(cx-radius+1, cy-radius+1, cx+radius-1, cy+radius-1, 31, 124)
    c.setStrokeColor(colors.HexColor('#ad9164'))
    c.setLineWidth(.7)
    c.arc(cx-radius+1, cy-radius+1, cx+radius-1, cy+radius-1, 224, 49)
    c.setFillColor(colors.Color(.89, .92, .96, alpha=.12))
    c.ellipse(cx-radius*.52, cy+radius*.57, cx+radius*.15, cy+radius*.75, stroke=0, fill=1)
    c.setFillColor(colors.HexColor('#05070b'))
    c.circle(cx, cy-2, radius*.427, stroke=0, fill=1)
    c.setFillColor(colors.HexColor('#ede9df'))
    c.circle(cx, cy, radius*.40, stroke=0, fill=1)
    c.setFillColor(colors.HexColor('#10141c'))
    c.setFont(SERIF, radius*.70)
    c.drawCentredString(cx, cy-radius*.237, '8')
    c.restoreState()


def front(c, name, preview):
    base(c, preview)
    star(c, WIDTH/2, 383, 6)
    tracked(c, 'ÉDITION DE DIPLÔME · 2026', 363, size=6.6, spacing=1.7)
    center(c, 'MFM', 323, SERIF, 36)
    center(c, 'ORACLE', 286, SERIF, 36)
    sphere(c, WIDTH/2, 204, 63)
    center(c, 'Evidence-Based Magic', 112, ITALIC, 12, GOLD)
    tracked(c, 'À LA SCIENCE. AU DOUTE. AU CAFÉ.', 91, size=5.8, spacing=1.0, color=MUTED)
    c.setStrokeColor(colors.HexColor('#5d4e36'))
    c.setLineWidth(.4)
    c.line(WIDTH/2-20, 75, WIDTH/2+20, 75)
    center(c, 'Félicitations, spécialiste !', 56, SERIF, 12)
    if name:
        size = 9
        while pdfmetrics.stringWidth(name, SANS, size) > WIDTH-70 and size > 5:
            size -= .25
        center(c, name, 40, SANS, size, GOLD)
    else:
        tracked(c, 'MÉDECINE MATERNO-FŒTALE', 40, size=5.8, spacing=1.05, color=GOLD)
    c.showPage()


def qr_matrix(url):
    qr = qrencoder.QRCode(None, qrencoder.QRErrorCorrectLevel.M)
    qr.addData(url)
    qr.make()
    return [[bool(qr.isDark(y, x)) for x in range(qr.getModuleCount())]
            for y in range(qr.getModuleCount())]


def qr_png(matrix, destination):
    module, quiet = 16, 4
    n = len(matrix)
    image = Image.new('RGB', ((n+2*quiet)*module, (n+2*quiet)*module), '#ffffff')
    draw = ImageDraw.Draw(image)
    for y, row in enumerate(matrix):
        for x, dark in enumerate(row):
            if dark:
                draw.rectangle(((x+quiet)*module, (y+quiet)*module,
                                (x+quiet+1)*module-1, (y+quiet+1)*module-1), fill='#080c14')
    image.save(destination, dpi=(600, 600))


def draw_qr(c, matrix, x, y, size):
    quiet = 4
    count = len(matrix)
    module = size/(count+2*quiet)
    c.setFillColor(colors.white)
    c.rect(x, y, size, size, fill=1, stroke=0)
    c.setFillColor(INK)
    for row, values in enumerate(matrix):
        for col, dark in enumerate(values):
            if dark:
                c.rect(x+(col+quiet)*module,
                       y+size-(row+quiet+1)*module,
                       module+.008, module+.008, fill=1, stroke=0)


def back(c, url, matrix, name, dedication, preview):
    base(c, preview)
    tracked(c, 'LE DIPLÔME EST BIEN RÉEL.', 380, size=6.5, spacing=1.35)
    center(c, 'Les prédictions, un peu moins.', 357, ITALIC, 13)
    if dedication:
        dedication_size = 10.5
        while len(wrap(dedication, SERIF, dedication_size, 239)) > 3 and dedication_size > 7:
            dedication_size -= .25
        centered_lines(c, dedication, 328, SERIF, dedication_size, 15, max_width=239)
    else:
        center(c, 'Toutes ces années de formation…', 328, SERIF, 10.5)
        center(c, 'Alors qu’il suffisait de télécharger', 312, SERIF, 10.5)
        center(c, 'l’application.', 296, SERIF, 10.5)
    # QR has a four-module white quiet zone, with no decoration across its modules.
    qr_size = 96
    qr_x, qr_y = (WIDTH-qr_size)/2, 181
    if matrix:
        draw_qr(c, matrix, qr_x, qr_y, qr_size)
        c.linkURL(url, (qr_x, qr_y, qr_x+qr_size, qr_y+qr_size), relative=0)
        tracked(c, 'L’ORACLE TIENT DANS TA POCHE.', 167, size=5.7, spacing=.9)
    else:
        c.setStrokeColor(colors.HexColor('#5e503c'))
        c.setLineWidth(.5)
        c.roundRect(qr_x, qr_y, qr_size, qr_size, 3, stroke=1, fill=0)
        star(c, WIDTH/2, qr_y+62, 9)
        center(c, 'Lien disponible', qr_y+36, SANS, 8, MUTED)
        center(c, 'après mise en ligne', qr_y+23, SANS, 8, MUTED)
        tracked(c, 'L’ORACLE TIENT DANS TA POCHE.', 167, size=5.7, spacing=.9)
    steps = [
        ('01', 'Scanne le code et ouvre dans Safari.'),
        ('02', 'Partager → Sur l’écran d’accueil.'),
        ('03', 'Ouvre une fois en ligne. Puis secoue !'),
    ]
    y = 143
    for number, label in steps:
        c.setFillColor(GOLD)
        c.setFont(SANS, 6.3)
        c.drawString(35, y, number)
        c.setFillColor(PALE)
        c.setFont(SANS, 7.2)
        c.drawString(54, y, label)
        y -= 16
    center(c, 'Active le mode secousse, ou touche la boule.', 91, SANS, 6.5, MUTED)
    center(c, 'Fonctionne hors ligne après le premier chargement.', 80, SANS, 6.5, MUTED)
    c.setStrokeColor(colors.HexColor('#5d4e36'))
    c.setLineWidth(.4)
    c.line(38, 68, WIDTH-38, 68)
    center(c, 'Niveau de preuve Z · Non remboursé par la LAMal', 55, SANS, 6.2, GOLD)
    center(c, 'Jeu humoristique exclusivement.', 42, SANS, 6.2, MUTED)
    center(c, 'Aucune utilisation clinique.', 32, SANS, 6.2, MUTED)
    c.showPage()


def verified_url(value):
    parsed = urlparse(value)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('Provide the real public HTTPS URL of the deployed application.')
    if parsed.hostname in {'localhost', '127.0.0.1', '::1'}:
        raise ValueError('The gift QR must point to the public deployed app, not localhost.')
    request = Request(value, headers={'User-Agent': 'MFM-Oracle-Gift-Card/1.0'})
    with urlopen(request, timeout=30) as response:
        final_url = response.geturl()
        body = response.read(2_000_000).decode('utf-8', errors='replace')
        if response.status != 200 or urlparse(final_url).scheme != 'https':
            raise ValueError('The application must be live over HTTPS before generating a QR.')
        if 'mfm oracle' not in body.lower() and 'mfm-oracle' not in body.lower():
            raise ValueError('The URL did not return the MFM Oracle application.')
    return final_url


def render_preview(pdf_path, png_path):
    try:
        import pypdfium2 as pdfium
    except ImportError:
        return False
    doc = pdfium.PdfDocument(str(pdf_path))
    images = [doc[i].render(scale=2).to_pil().convert('RGB') for i in range(len(doc))]
    gutter, margin = 36, 36
    contact = Image.new('RGB', (sum(im.width for im in images)+gutter+margin*2,
                                max(im.height for im in images)+margin*2), '#e7e4dd')
    x = margin
    for image in images:
        contact.paste(image, (x, margin))
        x += image.width+gutter
    contact.save(png_path)
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--url', help='Real, already deployed HTTPS application URL (verified before use).')
    parser.add_argument('--name', default='', help='Recipient name; no name is invented if omitted.')
    parser.add_argument('--dedication', default='', help='Optional short French dedication, up to 140 characters.')
    parser.add_argument('--output-dir', type=Path, default=Path('gift-card'))
    args = parser.parse_args()
    if len(args.dedication) > 140:
        parser.error('Keep the dedication to 140 characters so it fits the printed card.')
    if len(args.name) > 70:
        parser.error('Keep the recipient name to 70 characters.')
    register_fonts()
    try:
        url = verified_url(args.url) if args.url else None
    except Exception as exc:
        parser.error(f'Cannot generate the final QR: {exc}')
    args.output_dir.mkdir(parents=True, exist_ok=True)
    stem = 'gift-card' if url else 'gift-card-preview'
    pdf_path = args.output_dir/f'{stem}.pdf'
    matrix = qr_matrix(url) if url else None
    c = canvas.Canvas(str(pdf_path), pagesize=(WIDTH, HEIGHT), pageCompression=1)
    c.setTitle('MFM Oracle - Carte cadeau' + ('' if url else ' - Maquette'))
    c.setAuthor('MFM Oracle')
    c.setSubject('Carte A6 recto-verso. Impression à 100 %, recto-verso, bord long. Jeu humoristique exclusivement.')
    front(c, args.name.strip(), not url)
    back(c, url, matrix, args.name.strip(), args.dedication.strip(), not url)
    c.save()
    if url:
        qr_png(matrix, args.output_dir/'mfm-oracle-qr.png')
        (args.output_dir/'mfm-oracle-url.txt').write_text(url+'\n', encoding='utf-8')
    render_preview(pdf_path, args.output_dir/f'{stem}.png')
    print(pdf_path.resolve())
    if url:
        print('Verified QR destination:', url)
    else:
        print('Preview only: no QR has been generated. Re-run with the verified deployed --url.')
    print('Print: A6 (105 × 148 mm), actual size / 100%, double-sided, flip on the long edge.')


if __name__ == '__main__':
    main()
