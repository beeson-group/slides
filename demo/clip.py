"""Draws the demo clip of the slide template, a distant retrograde orbit traced about the Moon.

The clip and its poster are written for the dark and the light mode, on the background of each
mode, since a video does not have a transparent background. The poster is the last frame, i.e. the
complete orbit. Lengths are in Earth–Moon rotating-frame units. Run it as

    uv run --with matplotlib,numpy,scipy python demo/clip.py .

from the root of the repository with ffmpeg on the PATH, and the four files are written into demo/.
"""
import subprocess
import sys
from pathlib import Path

import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from scipy.integrate import solve_ivp
from scipy.optimize import brentq

root = Path(sys.argv[1])
mu = 0.01215
SIZE, FPS, SECONDS = 600, 24, 6
FRAMES = FPS * SECONDS
MODES = {"dark": "#050505", "light": "#faf8f3"}


def field(t, s):
    """The planar equations of motion of the CR3BP for the state s = (x, y, vx, vy)."""
    x, y, vx, vy = s
    r1 = np.hypot(x + mu, y) ** 3
    r2 = np.hypot(x - 1 + mu, y) ** 3
    ax = 2 * vy + x - (1 - mu) * (x + mu) / r1 - mu * (x - 1 + mu) / r2
    ay = -2 * vx + y - (1 - mu) * y / r1 - mu * y / r2
    return [vx, vy, ax, ay]


def half_period(vy0, x0, dense=False):
    """Integrates from (x0, 0) with a velocity vy0 to the next crossing of the x axis, downward."""
    crossing = lambda t, s: s[1]
    crossing.terminal, crossing.direction = True, -1
    return solve_ivp(field, (0, 20), [x0, 0, 0, vy0], events=crossing, rtol=1e-10, atol=1e-10, dense_output=dense)


# on the x axis the orbit is perpendicular to it, hence a periodic orbit has vx = 0 at the crossing
x0 = 1 - mu - 0.2
vy0 = brentq(lambda v: half_period(v, x0).y_events[0][0][2], 0.5, 0.6)
half = half_period(vy0, x0, dense=True)
x, y = half.sol(np.linspace(0, half.t[-1], 600))[:2]
# the second half of a symmetric orbit is the first half mirrored in the x axis
x, y = np.concatenate([x, x[::-1]]), np.concatenate([y, -y[::-1]])
moon = 1 - mu


def draw(style, background, count):
    """Returns a figure with the first count points of the orbit, the Moon, and the head."""
    plt.style.use(style)
    fig = plt.figure(figsize=(SIZE / 100, SIZE / 100), dpi=100, facecolor=background, layout="none")
    ax = fig.add_axes([0, 0, 1, 1], facecolor=background)
    reach = 1.1 * max(np.abs(x - moon).max(), np.abs(y).max())
    ax.set_xlim(moon - reach, moon + reach)
    ax.set_ylim(-reach, reach)
    ax.set_aspect("equal")
    ax.axis("off")
    orange = "#f08050" if background == MODES["dark"] else "#c8571e"
    gray = "#a6a6a0" if background == MODES["dark"] else "#55554f"
    ax.plot(x[:count], y[:count], color=orange, lw=2.2)
    ax.plot(x[count - 1], y[count - 1], "o", color=orange, ms=9)
    ax.plot(moon, 0, "o", color=gray, ms=12)
    ax.text(moon, -0.045, "Moon", color=gray, ha="center", va="top", fontsize=18)
    return fig


def pixels(fig):
    """Returns the RGB bytes of a figure, and closes it."""
    fig.canvas.draw()
    data = np.asarray(fig.canvas.buffer_rgba())[:, :, :3].tobytes()
    plt.close(fig)
    return data


for mode, background in MODES.items():
    style = root / "styles" / f"beeson-{mode}.mplstyle"
    encoder = subprocess.Popen(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
         "-s", f"{SIZE}x{SIZE}", "-r", str(FPS), "-i", "-", "-an", "-c:v", "libx264",
         "-profile:v", "main", "-pix_fmt", "yuv420p", "-crf", "28", "-preset", "veryslow",
         "-movflags", "+faststart", str(root / "demo" / f"clip-{mode}.mp4")],
        stdin=subprocess.PIPE,
    )
    for frame in range(1, FRAMES + 1):
        count = max(2, round(frame / FRAMES * len(x)))
        encoder.stdin.write(pixels(draw(style, background, count)))
    encoder.stdin.close()
    encoder.wait()
    fig = draw(style, background, len(x))
    fig.savefig(root / "demo" / f"clip-{mode}.png", dpi=100, facecolor=background, transparent=False)
    plt.close(fig)
