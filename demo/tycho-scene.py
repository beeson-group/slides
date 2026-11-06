"""Writes the tycho viewer of the demo deck into index.html.

The scene holds two periodic orbits of the Earth-Moon circular restricted three-body problem, a
distant retrograde orbit and a planar Lyapunov orbit about L1, drawn in the rotating frame and in
the barycentric inertial frame. Both orbits are found here by a secant correction of the initial
velocity on the x axis, with the mass ratio mu = 0.01215, in nondimensional units. The script
needs pytycho with build_embed, and SciPy. Run it as

    uv run --with scipy python demo/tycho-scene.py index.html

from a Python environment that holds pytycho. The <tycho-viewer> element is written between the
two marker comments of the slide "Tycho on a slide", or in place of the div with the id
tycho-slot on the first run.
"""
import sys
from pathlib import Path

import numpy as np
from scipy.optimize import brentq
from scipy.integrate import solve_ivp

import pytycho as ty

MU = 0.01215
SAMPLES = 600
START = "<!-- tycho-viewer start, written by demo/tycho-scene.py -->"
END = "<!-- tycho-viewer end -->"


def rhs(t, s):
    """The planar CR3BP equations of motion in the rotating frame, with the state (x, y, vx, vy)."""
    x, y, vx, vy = s
    r1 = np.hypot(x + MU, y)
    r2 = np.hypot(x - 1 + MU, y)
    ax = x + 2 * vy - (1 - MU) * (x + MU) / r1**3 - MU * (x - 1 + MU) / r2**3
    ay = y - 2 * vx - (1 - MU) * y / r1**3 - MU * y / r2**3
    return [vx, vy, ax, ay]


def crossing(t, s):
    """The event y = 0 after the start, i.e. the half period of a symmetric orbit."""
    return s[1] if t > 0.05 else 1.0


crossing.direction = -1
crossing.terminal = True


def half_period_vx(x0, vy0):
    """Returns the x velocity and the time at the first return of the orbit to the x axis."""
    sol = solve_ivp(rhs, (0.0, 12.0), [x0, 0.0, 0.0, vy0], events=crossing, rtol=1e-11, atol=1e-13)
    if not sol.t_events[0].size:
        raise RuntimeError(f"no crossing from x0 = {x0}, vy0 = {vy0}")
    return sol.y_events[0][0][2], sol.t_events[0][0]


def periodic(x0, vy_low, vy_high):
    """Returns the positions and times of one period of the symmetric orbit through (x0, 0) whose
    initial y velocity lies between vy_low and vy_high, where vx at the half period changes sign."""
    vy0 = brentq(lambda v: half_period_vx(x0, v)[0], vy_low, vy_high, xtol=1e-12)
    period = 2 * half_period_vx(x0, vy0)[1]
    t = np.linspace(0.0, period, SAMPLES)
    sol = solve_ivp(rhs, (0.0, period), [x0, 0.0, 0.0, vy0], t_eval=t, rtol=1e-11, atol=1e-13)
    positions = np.column_stack([sol.y[0], sol.y[1], np.zeros(SAMPLES)])
    return positions, t, period


def l1():
    """The x coordinate of L1, the zero of the x derivative of the pseudo-potential between the primaries."""
    def dodx(x):
        return x - (1 - MU) * (x + MU) / abs(x + MU) ** 3 - MU * (x - 1 + MU) / abs(x - 1 + MU) ** 3
    return brentq(dodx, 0.5, 1 - MU - 1e-3)


def build():
    """Returns the scene of the two orbits."""
    scene = ty.Scene(title="two periodic orbits of the Earth–Moon system")
    rotating = scene.frame("rotating", label="rotating", axes=("x", "y", "z"), unit="DU")
    scene.frame("inertial", label="inertial", axes=("ξ", "η", "ζ"), unit="DU", parent=rotating,
                rotation=ty.rotation("z", ty.channel("time")))
    earth = scene.body("earth", frame=rotating, position=[-MU, 0.0, 0.0], label="Earth", color="#56b4e9")
    moon = scene.body("moon", frame=rotating, position=[1 - MU, 0.0, 0.0], label="Moon", color="#a6a6a0")

    orbits = scene.track_set("orbits", frame=rotating, periodic=True, label="periodic orbits",
                             attrs={"mu": MU})
    # a distant retrograde orbit 0.10 DU left of the Moon, which circles it clockwise, hence upward
    # at the start, and a Lyapunov orbit 0.03 DU left of L1. the brackets of the initial y velocity
    # come from a scan of the crossing velocity, and each holds one sign change of a single branch
    for x0, low, high in ((1 - MU - 0.10, 0.45, 0.50), (l1() - 0.03, 0.28, 0.33)):
        positions, t, period = periodic(x0, low, high)
        orbits.add(positions, channels={"time": t}, parameters={"period": period})
    orbits.describe("time", unit="TU")

    frame = scene.choice("frame", ["rotating", "inertial"], scope="panel")
    scene.clock(channels=["time", "@index"], steps=360)
    layers = [
        ty.track(orbits, width=1.2, opacity=0.55),
        ty.track(orbits, 0, trail=0.35, head=True, width=2.4, color="#f08050"),
        ty.track(orbits, 1, trail=0.35, head=True, width=2.4, color="#c94fe6"),
        ty.body(earth, size=7.0),
        ty.body(moon, size=4.0, trail=1.0),
        ty.axes(),
    ]
    # the Lyapunov orbit drives the clock, since its period is the longer one
    scene.view("main", frame=frame, driver=ty.driver(orbits, 1), layers=layers)
    scene.panel("p1", "main", {frame: "rotating"})
    scene.tabs(frame, label="frame")
    scene.transport()
    return scene


def main(deck):
    scene = build()
    element = ty.build_embed(scene.to_document(), scene.to_container(), theme="dark", autoplay=True,
                             class_="zone")
    page = Path(deck).read_text(encoding="utf-8")
    block = f"{START}\n{element}\n{END}"
    if START in page and END in page:
        head, rest = page.split(START, 1)
        _, tail = rest.split(END, 1)
        page = head + block + tail
    else:
        slot = '<div class="zone" id="tycho-slot"></div>'
        if slot not in page:
            raise SystemExit("neither the markers nor the slot div are in the deck")
        page = page.replace(slot, block)
    Path(deck).write_text(page, encoding="utf-8")
    print(f"wrote {len(element)} characters of viewer into {deck}")


if __name__ == "__main__":
    main(sys.argv[1])
