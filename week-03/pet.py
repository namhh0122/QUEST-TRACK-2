# 화면 오른쪽 아래에 앉아 있는 펭귄 데스크톱 펫
# 실행: week-03 폴더에서 python pet.py
import sys
from pathlib import Path

from PySide6.QtCore import Qt
from PySide6.QtGui import QPixmap
from PySide6.QtWidgets import QApplication, QLabel, QWidget

HERE = Path(__file__).parent
FRAMES = HERE / "art" / "frames"
SIZE = 150  # 펫 창 크기 (가로세로)

# 그림 순서: ① 두 발 들기, ② 왼발 누름, ③ 오른발 누름, ④ 졸기
UP, LEFT, RIGHT, SLEEP = range(4)
NAMES = ["1_up.png", "2_left.png", "3_right.png", "4_sleep.png"]


class Pet(QWidget):
    def __init__(self):
        super().__init__()
        # 테두리 없음 + 항상 맨 위
        self.setWindowFlags(Qt.FramelessWindowHint | Qt.WindowStaysOnTopHint)
        # 창 배경을 투명하게 해서 펭귄만 보이게
        self.setAttribute(Qt.WA_TranslucentBackground)
        self.setFixedSize(SIZE, SIZE)

        self.frames = [QPixmap(str(FRAMES / name)) for name in NAMES]
        self.picture = QLabel(self)
        self.picture.setFixedSize(SIZE, SIZE)
        self.picture.setScaledContents(True)
        self.show_frame(UP)

        self.move_to_corner()

    def show_frame(self, index):
        self.picture.setPixmap(self.frames[index])

    def move_to_corner(self):
        # 작업표시줄을 뺀 화면 영역의 오른쪽 아래에 붙인다
        area = self.screen().availableGeometry()
        self.move(area.right() - SIZE + 1, area.bottom() - SIZE + 1)


def main():
    app = QApplication(sys.argv)
    pet = Pet()
    pet.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
