"""Draws the demo figures of the slide template.

Two figures show the zero-velocity curves of the Earth–Moon CR3BP in the dark and light slide
styles. A third figure shows the northern halo family of the libration point L2 in three projections,
colored by the Jacobi constant, as a journal figure on white for the paper class of the theme. The
family is continued from the seed of halos() in src/scenes.ts. Lengths are in Earth–Moon
rotating-frame units. Run it as

    uv run --with matplotlib,numpy,scipy python demo/figures.py .

from the root of the repository, and the three files are written into demo/.
"""
import io
import sys
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from scipy.integrate import solve_ivp
from scipy.optimize import brentq
from PIL import Image

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
    for name, v in dict(L1=L1, L2=L2, L3=L3).items():
        ax.plot([v], [0], "+", color=text, ms=9, mew=1.6)
        ax.annotate(f"$\\mathcal{{L}}_{name[1]}$", (v, 0), xytext=(0, 9), textcoords="offset points",
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


def rhs(t, s):
    """The time derivative of the state s of the CR3BP in the rotating frame."""
    x, y, z, vx, vy, vz = s
    r1 = np.sqrt((x + mu) ** 2 + y * y + z * z)
    r2 = np.sqrt((x - 1 + mu) ** 2 + y * y + z * z)
    k1, k2 = (1 - mu) / r1 ** 3, mu / r2 ** 3
    return [vx, vy, vz, 2 * vy + x - k1 * (x + mu) - k2 * (x - 1 + mu), -2 * vx + y - (k1 + k2) * y,
            -(k1 + k2) * z]


def crossing(s):
    """The time and the state of the first upward crossing of the plane y = 0 after the start."""
    plane = lambda t, q: q[1] if t > 1e-3 else -1.0
    plane.terminal, plane.direction = True, 1
    r = solve_ivp(rhs, (0, 8), s, method="DOP853", rtol=1e-12, atol=1e-12, events=plane)
    return r.t_events[0][0], r.y_events[0][0]


def corrected(s, free):
    """The state s with its components free changed until vx and vz vanish at the crossing."""
    s = np.array(s, float)
    for _ in range(30):
        t, q = crossing(s)
        miss = q[[3, 5]]
        if np.max(np.abs(miss)) < 1e-10:
            return s, t
        J = np.zeros((2, 2))
        for k, i in enumerate(free):
            d = s.copy()
            d[i] += 1e-7
            J[:, k] = (crossing(d)[1][[3, 5]] - miss) / 1e-7
        s[free] -= np.linalg.solve(J, miss)
    raise RuntimeError("the halo orbit was not corrected")


def jacobi(s):
    """The Jacobi constant of the state s."""
    x, y, z = s[:3]
    r1, r2 = np.sqrt((x + mu) ** 2 + y * y + z * z), np.sqrt((x - 1 + mu) ** 2 + y * y + z * z)
    return x * x + y * y + 2 * (1 - mu) / r1 + 2 * mu / r2 - s[3] ** 2 - s[4] ** 2 - s[5] ** 2


# the family is continued in z at its far crossing of the plane y = 0, and then in x toward the
# Moon, which ends it at a near-rectilinear halo orbit with a perilune of about 2300 km
halos = []
s = np.array([1.18, 0, 0.0139, 0, -0.1568, 0])
for z in np.linspace(0.0139, 0.09, 12):
    s[2] = z
    s, half = corrected(s, [0, 4])
    halos.append((s.copy(), half))
for x in np.linspace(s[0], 1.015, 17)[1:]:
    s[0] = x
    s, half = corrected(s, [2, 4])
    halos.append((s.copy(), half))
paths = [solve_ivp(rhs, (0, 2 * half), s, method="DOP853", rtol=1e-11, atol=1e-11,
                   t_eval=np.linspace(0, 2 * half, 600)).y[:3] for s, half in halos]
levels = np.array([jacobi(s) for s, _ in halos])

plt.style.use("default")
plt.rcParams.update({"font.family": "serif", "font.serif": ["cmr10"], "mathtext.fontset": "cm",
                     "axes.formatter.use_mathtext": True,
                     "font.size": 14, "axes.linewidth": 0.8, "savefig.dpi": 200})
norm = matplotlib.colors.Normalize(levels.min(), levels.max())
cmap = plt.get_cmap("viridis")
# the aspect of the plate of a figure slide, whose figure is 1680 by 630 px
fig, axes = plt.subplots(1, 3, figsize=(10.5, 3.94), layout="constrained")
moon, point = np.array([1 - mu, 0, 0]), np.array([L2, 0, 0])
for ax, (a, b) in zip(axes, [(0, 1), (0, 2), (1, 2)]):
    for path, level in zip(paths, levels):
        ax.plot(path[a], path[b], color=cmap(norm(level)), lw=0.8)
    ax.plot(moon[a], moon[b], "o", color="0.35", ms=5, zorder=5)
    marks = [moon]
    if a == 0:
        ax.plot(point[a], point[b], "+", color="k", ms=9, mew=1.3, zorder=5)
        ax.annotate(r"$\mathcal{L}_2$", (point[a], point[b]), xytext=(6, 5), textcoords="offset points")
        marks.append(point)
    # the axes are fitted to the orbits and the marks, with a margin of 4 percent
    for axis, i in ((ax.set_xlim, a), (ax.set_ylim, b)):
        values = np.concatenate([p[i] for p in paths] + [[m[i] for m in marks]])
        pad = 0.04 * np.ptp(values)
        axis(values.min() - pad, values.max() + pad)
    ax.set_aspect("equal")
    ax.set_xlabel(f"${'xyz'[a]}$")
    ax.set_ylabel(f"${'xyz'[b]}$", labelpad=2)
    ax.tick_params(direction="in", length=3, width=0.8, top=True, right=True)
    ax.locator_params(nbins=4)
fig.colorbar(plt.cm.ScalarMappable(norm=norm, cmap=cmap), ax=axes, label="Jacobi constant $C$",
             shrink=0.9, pad=0.02)
# the figure is written with a palette of 256 colors, at a third of the size of a full-color file
image = io.BytesIO()
fig.savefig(image, format="png", facecolor="white")
Image.open(image).convert("RGB").quantize(256).save(f"{root}/demo/figure-paper.png", optimize=True)
print("L1 L2 L3", L1, L2, L3, "C", C, "halos", len(halos), "C", levels.min(), levels.max())
