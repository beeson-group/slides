"""Draws the demo figures of the slide template.

Two figures show the zero-velocity curves of the Earth-Moon CR3BP in the dark and light slide
styles, and a third shows the pseudo-potential along the x axis as a journal figure in black on
white, for the paper class of the theme. Lengths are in Earth-Moon rotating-frame units. Run it as

    uv run --with matplotlib,numpy,scipy python demo/figures.py .

from the root of the repository, and the three files are written into demo/.
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
        ax.plot([], [], color=col, label=f"$C = C_{{\\mathrm{{{name}}}}}$")
    text = plt.rcParams["text.color"]
    ax.plot([-mu], [0], "o", color=text, ms=7)
    ax.plot([1 - mu], [0], "o", color=text, ms=4)
    for name, v in dict(L1=L1, L2=L2, L3=L3).items():
        ax.plot([v], [0], "+", color=text, ms=9, mew=1.6)
        ax.annotate(f"$\\mathrm{{{name}}}$", (v, 0), xytext=(0, 9), textcoords="offset points",
                    ha="center", fontsize=14)
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

plt.style.use("default")
plt.rcParams.update({"font.family": "serif", "font.serif": ["STIXGeneral"], "mathtext.fontset": "stix",
                     "font.size": 12, "savefig.dpi": 200})
fig, ax = plt.subplots(figsize=(7, 4.2), constrained_layout=True)
xs = np.linspace(-1.6, 1.6, 4000)
U = -2 * omega(xs, 0.0)
# the singularities at the two bodies are cut out of the curve
U[np.abs(xs + mu) < 0.02] = np.nan
U[np.abs(xs - 1 + mu) < 0.012] = np.nan
ax.plot(xs, U, color="k", lw=1.2)
for name, v in dict(L1=L1, L2=L2, L3=L3).items():
    ax.plot([v], [-C[name]], "o", color="k", ms=4)
    ax.annotate(f"$\\mathrm{{{name}}}$", (v, -C[name]), xytext=(0, 7), textcoords="offset points",
                ha="center")
ax.set_ylim(-3.6, -2.95)
ax.set_xlim(-1.6, 1.6)
ax.set_xlabel("$x$ (rotating frame, Earth–Moon units)")
ax.set_ylabel("$-2\\,\\Omega(x, 0)$")
ax.set_title("Pseudo-potential along the $x$ axis, $\\mu = 0.01215$")
ax.grid(True, lw=0.4, color="0.85")
fig.savefig(f"{root}/demo/figure-paper.png", facecolor="white")
print("L1 L2 L3", L1, L2, L3, "C", C)
