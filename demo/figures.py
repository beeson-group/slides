"""Draws the demo figures of the slide template.

Two figures show the zero-velocity curves of the Earth–Moon CR3BP in the dark and light slide
styles. Lengths are in Earth–Moon rotating-frame units. Run it as

    uv run --with matplotlib,numpy,scipy python demo/figures.py .

from the root of the repository, and the two files are written into demo/.
"""
import sys
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from scipy.optimize import brentq

root = sys.argv[1]
mu = 0.01215


def omega(x, y):
    """The pseudo-potential of the CR3BP at (x, y), with the mass ratio mu."""
    r1 = np.hypot(x + mu, y)
    r2 = np.hypot(x - 1 + mu, y)
    return 0.5 * (x * x + y * y) + (1 - mu) / r1 + mu / r2


def dodx(x):
    """The x derivative of the pseudo-potential on the x axis, whose zeros are L1, L2, and L3."""
    return x - (1 - mu) * (x + mu) / abs(x + mu) ** 3 - mu * (x - 1 + mu) / abs(x - 1 + mu) ** 3


L1 = brentq(dodx, 0.5, 1 - mu - 1e-3)
L2 = brentq(dodx, 1 - mu + 1e-3, 1.5)
L3 = brentq(dodx, -1.5, -mu - 1e-3)
# the Jacobi constant of each collinear point, i.e. the level of its zero-velocity curve
C = {k: 2 * omega(v, 0.0) for k, v in dict(L1=L1, L2=L2, L3=L3).items()}


def zvc(style, out):
    """Writes the zero-velocity curves at the three collinear levels in the given mplstyle."""
    plt.style.use(style)
    fig, ax = plt.subplots(figsize=(6, 7.2))
    x = np.linspace(-1.6, 1.6, 900)
    y = np.linspace(-1.6, 1.6, 900)
    X, Y = np.meshgrid(x, y)
    Z = 2 * omega(X, Y)
    colors = plt.rcParams["axes.prop_cycle"].by_key()["color"]
    for name, col in zip(["L1", "L2", "L3"], colors[:3]):
        ax.contour(X, Y, Z, levels=[C[name]], colors=[col], linewidths=2.2)
        ax.plot([], [], color=col, label=f"$C = C_{{\\mathcal{{L}}_{name[1]}}}$")
    text = plt.rcParams["text.color"]
    ax.plot([-mu], [0], "o", color=text, ms=7)
    ax.plot([1 - mu], [0], "o", color=text, ms=4)
    # each label is set in a gap between the curves next to its point. L1 is inside the realm of the
    # Earth, L2 under the loop around the Moon, and L3 between its curve and the outer curves of C_L1 and C_L2
    offsets = dict(L1=(-11, 0, "right", "center"), L2=(2, -17, "right", "top"), L3=(-8, 0, "right", "center"))
    for name, v in dict(L1=L1, L2=L2, L3=L3).items():
        ax.plot([v], [0], "x", color=text, ms=8, mew=1.8)
        dx, dy, ha, va = offsets[name]
        ax.annotate(f"$\\mathcal{{L}}_{name[1]}$", (v, 0), xytext=(dx, dy), textcoords="offset points",
                    ha=ha, va=va, fontsize=14)
    ax.grid(True)
    ax.set_aspect("equal")
    ax.set_xlim(-1.6, 1.6)
    ax.set_ylim(-1.6, 1.6)
    ax.set_xlabel("$x$")
    ax.set_ylabel("$y$")
    ax.legend(loc="upper center", bbox_to_anchor=(0.5, -0.1), ncol=3, fontsize=14, columnspacing=1.2)
    fig.savefig(out)
    plt.close(fig)


for mode in ("dark", "light"):
    zvc(f"{root}/styles/beeson-{mode}.mplstyle", f"{root}/demo/figure-{mode}.png")

print("L1 L2 L3", L1, L2, L3, "C", C)
