# art/sheet.png (2×2 네 칸)을 잘라서 펫 크기 그림 4장으로 저장한다.
# 실행: week-03 폴더에서 python cut.py
from pathlib import Path

from PIL import Image

HERE = Path(__file__).parent
SHEET = HERE / "art" / "sheet.png"
OUT = HERE / "art" / "frames"
SIZE = 150  # 펫 창 크기 (가로세로)
MARGIN = 6  # 그림 둘레에 남길 여백 (원래 그림 기준)
FAINT = 8   # 이보다 흐린 점은 완전히 투명하게 (배경의 희미한 얼룩 지우기)

# 칸 순서: ① 왼쪽 위, ② 오른쪽 위, ③ 왼쪽 아래, ④ 오른쪽 아래
NAMES = ["1_up.png", "2_left.png", "3_right.png", "4_sleep.png"]


def main():
    sheet = Image.open(SHEET).convert("RGBA")
    half_w, half_h = sheet.width // 2, sheet.height // 2
    cells = [
        sheet.crop((x, y, x + half_w, y + half_h))
        for y in (0, half_h)
        for x in (0, half_w)
    ]

    # 희미한 얼룩을 지운다
    for cell in cells:
        alpha = cell.getchannel("A").point(lambda v: 0 if v < FAINT else v)
        cell.putalpha(alpha)

    # 네 칸을 모두 담는 하나의 상자로 똑같이 자른다 (그래야 펭귄이 흔들리지 않는다)
    boxes = [cell.getbbox() for cell in cells]
    left = min(b[0] for b in boxes) - MARGIN
    top = min(b[1] for b in boxes) - MARGIN
    right = max(b[2] for b in boxes) + MARGIN
    bottom = max(b[3] for b in boxes) + MARGIN

    # 정사각형으로 맞춘다 (짧은 쪽을 양옆으로 늘림)
    side = max(right - left, bottom - top)
    cx, cy = (left + right) // 2, (top + bottom) // 2
    box = (cx - side // 2, cy - side // 2, cx - side // 2 + side, cy - side // 2 + side)

    OUT.mkdir(parents=True, exist_ok=True)
    for cell, name in zip(cells, NAMES):
        frame = cell.crop(box).resize((SIZE, SIZE), Image.LANCZOS)
        frame.save(OUT / name)
        print("저장:", OUT / name)
    print("자른 상자:", box)


if __name__ == "__main__":
    main()
