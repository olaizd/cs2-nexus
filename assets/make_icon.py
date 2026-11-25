from PIL import Image, ImageDraw
import math, os

S = 1024
img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle([32, 32, S - 32, S - 32], radius=190, fill=(7, 15, 25, 255), outline=(24, 52, 70, 255), width=8)

cx = cy = S // 2
r = 390
hexp = [(cx + r * math.cos(math.radians(60 * i - 30)), cy + r * math.sin(math.radians(60 * i - 30))) for i in range(6)]
for w, c in [(26, (16, 60, 78, 255)), (12, (103, 232, 255, 255))]:
    d.line(hexp + [hexp[0]], fill=c, width=w, joint='curve')

ncol = (230, 250, 255, 255)
d.line([(370, 690), (370, 334)], fill=ncol, width=46)
d.line([(370, 334), (654, 690)], fill=ncol, width=46)
d.line([(654, 690), (654, 334)], fill=ncol, width=46)
d.line([(700, 220), (820, 340)], fill=(255, 79, 216, 255), width=34)
d.line([(760, 190), (860, 290)], fill=(255, 79, 216, 255), width=18)
d.ellipse([770, 610, 850, 690], fill=(103, 232, 255, 255))
img = img.resize((256, 256), Image.LANCZOS)
base = os.path.dirname(os.path.abspath(__file__))
img.save(os.path.join(base, 'icon.ico'), sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
img.save(os.path.join(base, 'icon.png'))
print('ok')
