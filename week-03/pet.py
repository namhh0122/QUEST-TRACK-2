# 화면 오른쪽 아래에 앉아 있는 펭귄 데스크톱 펫
# 실행: week-03 폴더에서 python pet.py
# 묶기: week-03 폴더에서
#   python -m PyInstaller --onefile --windowed --name pet --add-data "art/frames;art/frames" pet.py
import sys
from pathlib import Path

from pynput import keyboard
from PySide6.QtCore import QPointF, QRectF, QTimer, Qt, Signal
from PySide6.QtGui import QColor, QCursor, QPainter, QPainterPath, QPixmap
from PySide6.QtWidgets import QApplication, QLabel, QMenu, QWidget

# exe 로 묶으면 그림이 임시 폴더(sys._MEIPASS)에 풀린다
HERE = Path(getattr(sys, "_MEIPASS", Path(__file__).parent))
FRAMES = HERE / "art" / "frames"
SIZE = 150  # 펫 창 크기 (가로세로)
REST_MS = 300  # 마지막 키를 누르고 이만큼(밀리초) 지나면 ① 으로 돌아감
SLEEP_MS = 10_000  # 이만큼(밀리초) 아무 키도 안 누르면 ④ 졸기

# 그림 순서: ① 두 발 들기, ② 왼발 누름, ③ 오른발 누름, ④ 졸기
UP, LEFT, RIGHT, SLEEP = range(4)
NAMES = ["1_up.png", "2_left.png", "3_right.png", "4_sleep.png"]

# 눈 (①②③ 그림에서 같은 자리): (가운데 x, 가운데 y, 가로 반지름, 세로 반지름)
EYES = [(47.5, 66.0, 8.5, 10.0), (94.0, 66.0, 8.0, 10.0)]
EYE_SHIFT = 2.0  # 눈이 움직이는 최대 거리 (점)
EYE_FULL = 200  # 마우스가 이만큼 멀어지면 끝까지 움직임
FACE = QColor(0xF9, 0xF9, 0xFA)  # 원래 눈 자리를 덮을 얼굴색
EYE_TICK_MS = 33  # 마우스 위치를 읽는 간격 (1초에 약 30번)


def eye_path(cx, cy, rx, ry, grow=0.0):
    path = QPainterPath()
    path.addEllipse(QPointF(cx, cy), rx + grow, ry + grow)
    return path


def split_eyes(frame):
    """그림을 '눈 없는 얼굴'과 '오려 낸 눈'으로 나눈다."""
    face = QPixmap(frame)
    eyes = QPixmap(frame.size())
    eyes.fill(Qt.transparent)
    for cx, cy, rx, ry in EYES:
        p = QPainter(eyes)
        p.setClipPath(eye_path(cx, cy, rx, ry))
        p.drawPixmap(0, 0, frame)
        p.end()

        p = QPainter(face)
        p.setRenderHint(QPainter.Antialiasing)
        p.fillPath(eye_path(cx, cy, rx, ry, EYE_SHIFT + 0.5), FACE)
        p.end()
    return face, eyes


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
        # 눈 뜬 그림(①②③)은 얼굴과 눈을 나눠 둔다. ④는 눈을 감아서 그대로 쓴다.
        self.split = {i: split_eyes(self.frames[i]) for i in (UP, LEFT, RIGHT)}
        self.eye_offset = QPointF(0, 0)
        self.current = UP
        self.picture = QLabel(self)
        self.picture.setFixedSize(SIZE, SIZE)
        self.picture.setScaledContents(True)
        self.show_frame(UP)

        # 마우스 위치는 화면에서 바로 읽기만 하고 저장하지 않는다
        self.eye_timer = QTimer(self, interval=EYE_TICK_MS)
        self.eye_timer.timeout.connect(self.follow_mouse)
        self.eye_timer.start()

        self.drag_offset = None  # 끄는 중일 때, 창 왼쪽 위에서 마우스까지의 거리
        self.move_to_corner()

        # 몇 번 눌렀는지만 센다 (어떤 키인지는 저장하지 않음, 끄면 사라짐)
        self.key_count = 0
        self.left_next = True  # 다음 키에 ② 왼발을 낼 차례인지
        self.rest_timer = QTimer(self, singleShot=True, interval=REST_MS)
        self.rest_timer.timeout.connect(lambda: self.show_frame(UP))
        self.sleep_timer = QTimer(self, singleShot=True, interval=SLEEP_MS)
        self.sleep_timer.timeout.connect(self.fall_asleep)
        self.sleep_timer.start()
        self.key_pressed.connect(self.on_key)

    def on_key(self):
        self.key_count += 1
        # ② 왼발과 ③ 오른발을 번갈아
        self.show_frame(LEFT if self.left_next else RIGHT)
        self.left_next = not self.left_next
        self.rest_timer.start()
        self.sleep_timer.start()  # 키를 누를 때마다 졸기 시계를 처음부터 다시

    def fall_asleep(self):
        self.show_frame(SLEEP)
        self.left_next = True  # 깨어나면 ② 부터

    def show_frame(self, index):
        self.current = index
        if index not in self.split:
            self.picture.setPixmap(self.frames[index])
            return
        # 눈 없는 얼굴 위에 눈을 마우스 쪽으로 옮겨 그린다
        face, eyes = self.split[index]
        picture = QPixmap(face)
        p = QPainter(picture)
        p.setRenderHint(QPainter.SmoothPixmapTransform)
        p.drawPixmap(QRectF(eyes.rect()).translated(self.eye_offset), eyes, QRectF(eyes.rect()))
        p.end()
        self.picture.setPixmap(picture)

    def follow_mouse(self):
        # 두 눈 사이 가운데에서 마우스까지의 방향
        middle = QPointF(sum(e[0] for e in EYES) / 2, sum(e[1] for e in EYES) / 2)
        to_mouse = QPointF(QCursor.pos()) - QPointF(self.mapToGlobal(middle.toPoint()))
        distance = (to_mouse.x() ** 2 + to_mouse.y() ** 2) ** 0.5
        if distance < 1:
            offset = QPointF(0, 0)
        else:
            offset = to_mouse / distance * EYE_SHIFT * min(1.0, distance / EYE_FULL)
        if (offset - self.eye_offset).manhattanLength() < 0.1:
            return  # 거의 그대로면 다시 그리지 않는다
        self.eye_offset = offset
        self.show_frame(self.current)

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
