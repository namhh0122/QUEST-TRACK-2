# 화면 오른쪽 아래에 앉아 있는 펭귄 데스크톱 펫
# 실행: week-03 폴더에서 python pet.py
# 묶기: week-03 폴더에서
#   python -m PyInstaller --onefile --windowed --name pet --add-data "art/frames;art/frames" pet.py
import sys
from pathlib import Path

from pynput import keyboard
from PySide6.QtCore import QPointF, QTimer, Qt, Signal
from PySide6.QtGui import QColor, QCursor, QPainter, QPainterPath, QPixmap
from PySide6.QtWidgets import QApplication, QLabel, QMenu, QWidget

# exe 로 묶으면 그림이 임시 폴더(sys._MEIPASS)에 풀린다
HERE = Path(getattr(sys, "_MEIPASS", Path(__file__).parent))
FRAMES = HERE / "art" / "frames"
SIZE = 220  # 펫 창 크기 (가로세로). cut.py 의 SIZE 와 같아야 한다
REST_MS = 300  # 마지막 키를 누르고 이만큼(밀리초) 지나면 ① 으로 돌아감
SLEEP_MS = 10_000  # 이만큼(밀리초) 아무 키도 안 누르면 ④ 졸기

# 그림 순서: ① 두 발 들기, ② 왼발 누름, ③ 오른발 누름, ④ 졸기
UP, LEFT, RIGHT, SLEEP = range(4)
NAMES = ["1_up.png", "2_left.png", "3_right.png", "4_sleep.png"]

# 눈 (①②③ 그림에서 같은 자리). 숫자는 150 크기 그림에서 잰 것이라 SIZE 에 맞춰 늘린다.
# (가운데 x, 가운데 y, 테두리 안쪽 가로 반지름, 세로 반지름, 원래 반짝이 x, y)
SCALE = SIZE / 150
EYES = [
    tuple(v * SCALE for v in eye)
    for eye in [
        (47.5, 66.0, 5.5, 7.0, 50.0, 62.0),
        (94.0, 66.0, 5.0, 7.0, 91.2, 62.0),
    ]
]
GLINT_R = 2.5 * SCALE  # 하얀 반짝이 반지름
IRIS = QColor(0x0E, 0x4A, 0x9A)  # 원래 반짝이를 지울 눈 파란색
GLINT = QColor(255, 255, 255)
EYE_FULL = 200  # 마우스가 이만큼 멀어지면 반짝이가 눈 가장자리까지 감
EYE_TICK_MS = 33  # 마우스 위치를 읽는 간격 (1초에 약 30번)


def eye_inside(cx, cy, rx, ry, grow=0.0):
    """눈 테두리 안쪽. 반짝이가 이 밖으로 나가지 않게 자르는 데 쓴다."""
    path = QPainterPath()
    path.addEllipse(QPointF(cx, cy), rx + grow, ry + grow)
    return path


def erase_glints(frame):
    """그림에 원래 있던 하얀 반짝이를 눈 파란색으로 지운다."""
    plain = QPixmap(frame)
    p = QPainter(plain)
    p.setRenderHint(QPainter.Antialiasing)
    p.setPen(Qt.NoPen)
    p.setBrush(IRIS)
    for cx, cy, rx, ry, gx, gy in EYES:
        # 반짝이 가장자리의 흐린 점까지 지우려고 조금 넓게 칠한다
        p.setClipPath(eye_inside(cx, cy, rx, ry, 1.0 * SCALE))
        p.drawEllipse(QPointF(gx, gy), GLINT_R + 1.5 * SCALE, GLINT_R + 1.5 * SCALE)
    p.end()
    return plain


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
        # 눈 뜬 그림(①②③)은 반짝이를 지워 둔다. ④는 눈을 감아서 그대로 쓴다.
        self.plain = {i: erase_glints(self.frames[i]) for i in (UP, LEFT, RIGHT)}
        self.look = QPointF(0, 0)  # 마우스 쪽 방향 (길이 0~1)
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
        if index not in self.plain:
            self.picture.setPixmap(self.frames[index])
            return
        # 반짝이를 지운 눈 안에, 마우스 쪽으로 하얀 반짝이를 그린다
        picture = QPixmap(self.plain[index])
        p = QPainter(picture)
        p.setRenderHint(QPainter.Antialiasing)
        p.setPen(Qt.NoPen)
        p.setBrush(GLINT)
        for cx, cy, rx, ry, _gx, _gy in EYES:
            p.setClipPath(eye_inside(cx, cy, rx, ry))
            # 반짝이가 눈 테두리 안에 다 들어가는 만큼만 움직인다
            gx = cx + self.look.x() * (rx - GLINT_R)
            gy = cy + self.look.y() * (ry - GLINT_R)
            p.drawEllipse(QPointF(gx, gy), GLINT_R, GLINT_R)
        p.end()
        self.picture.setPixmap(picture)

    def follow_mouse(self):
        # 두 눈 사이 가운데에서 마우스까지의 방향
        middle = QPointF(sum(e[0] for e in EYES) / 2, sum(e[1] for e in EYES) / 2)
        to_mouse = QPointF(QCursor.pos()) - QPointF(self.mapToGlobal(middle.toPoint()))
        distance = (to_mouse.x() ** 2 + to_mouse.y() ** 2) ** 0.5
        if distance < 1:
            look = QPointF(0, 0)
        else:
            look = to_mouse / distance * min(1.0, distance / EYE_FULL)
        if (look - self.look).manhattanLength() < 0.03:
            return  # 거의 그대로면 다시 그리지 않는다
        self.look = look
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
