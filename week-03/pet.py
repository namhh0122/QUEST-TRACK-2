# 화면 오른쪽 아래에 앉아 있는 펭귄 데스크톱 펫
# 실행: week-03 폴더에서 python pet.py
import sys
from pathlib import Path

from pynput import keyboard
from PySide6.QtCore import QTimer, Qt, Signal
from PySide6.QtGui import QPixmap
from PySide6.QtWidgets import QApplication, QLabel, QMenu, QWidget

HERE = Path(__file__).parent
FRAMES = HERE / "art" / "frames"
SIZE = 150  # 펫 창 크기 (가로세로)
REST_MS = 300  # 마지막 키를 누르고 이만큼(밀리초) 지나면 ① 으로 돌아감

# 그림 순서: ① 두 발 들기, ② 왼발 누름, ③ 오른발 누름, ④ 졸기
UP, LEFT, RIGHT, SLEEP = range(4)
NAMES = ["1_up.png", "2_left.png", "3_right.png", "4_sleep.png"]


class Pet(QWidget):
    # 키 듣기는 다른 스레드에서 돌아서, 신호로 펫에게 "눌렸다"는 것만 전한다
    key_pressed = Signal()

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

        self.drag_offset = None  # 끄는 중일 때, 창 왼쪽 위에서 마우스까지의 거리
        self.move_to_corner()

        # 몇 번 눌렀는지만 센다 (어떤 키인지는 저장하지 않음, 끄면 사라짐)
        self.key_count = 0
        self.rest_timer = QTimer(self, singleShot=True, interval=REST_MS)
        self.rest_timer.timeout.connect(lambda: self.show_frame(UP))
        self.key_pressed.connect(self.on_key)

    def on_key(self):
        self.key_count += 1
        # 홀수 번째는 ② 왼발, 짝수 번째는 ③ 오른발
        self.show_frame(LEFT if self.key_count % 2 else RIGHT)
        self.rest_timer.start()

    def show_frame(self, index):
        self.picture.setPixmap(self.frames[index])

    def move_to_corner(self):
        # 작업표시줄을 뺀 화면 영역의 오른쪽 아래에 붙인다
        area = self.screen().availableGeometry()
        self.move(area.right() - SIZE + 1, area.bottom() - SIZE + 1)

    # 왼쪽 버튼으로 끌어서 옮기기
    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            self.drag_offset = event.globalPosition().toPoint() - self.pos()

    def mouseMoveEvent(self, event):
        if self.drag_offset is not None:
            self.move(event.globalPosition().toPoint() - self.drag_offset)

    def mouseReleaseEvent(self, event):
        if event.button() == Qt.LeftButton:
            self.drag_offset = None

    # 오른쪽 클릭 메뉴
    def contextMenuEvent(self, event):
        menu = QMenu(self)
        menu.addAction("끄기", QApplication.quit)
        menu.exec(event.globalPos())


def main():
    app = QApplication(sys.argv)
    pet = Pet()
    pet.show()

    # 키를 누를 때마다 신호만 보낸다. 어떤 키인지(_key)는 쓰지 않고 버린다.
    listener = keyboard.Listener(on_press=lambda _key: pet.key_pressed.emit())
    listener.start()
    app.aboutToQuit.connect(listener.stop)

    sys.exit(app.exec())


if __name__ == "__main__":
    main()
