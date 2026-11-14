"""Writes the tycho viewer of the demo deck into index.html.

The scene is the L1 halo family of the Earth–Moon circular restricted three-body problem, after the
halo example of tycho, in three panels: the rotating frame, the barycentric inertial frame, and the
inertial frame centered on the Moon. The family is continued here in the initial z, from 8000 km to
40000 km in 40 equal steps. Each member is corrected by Newton's method on its initial x and y
velocity, so that vx and vz vanish at the half period, and it is then propagated for one period.
The mass ratio is mu = 0.01215, as in src/orbits.ts, and a distance unit is 384400 km. You need
pytycho with build_embed, of the build from which theme/vendor/tycho/tycho.js was copied, and SciPy.
Run it as

    uv run --project <the tycho checkout> --with scipy python demo/tycho-scene.py index.html

The <tycho-viewer> element is written as a kiosk, i.e. without controls, into the figure box of the slide
"Tycho on a slide", between its two marker comments, or in place of the div with the id tycho-slot
on the first run. A kiosk plays from the initial state of the scene, in which the three panels are
laid out, and its keys still step the selected member along the family.
"""
import sys
from pathlib import Path

import numpy as np
from scipy.integrate import solve_ivp

import pytycho as ty

MU = 0.01215
DU = 384400.0
Z_START, Z_END, STEPS = 8000.0, 40000.0, 40
# x0 and vy0 of the member at 8000 km, rounded to four digits, from a correction of the third-order
# approximation of [Richardson 1980](https://doi.org/10.1007/BF01229511)
SEED = (0.8234, 0.1332)
DENSE = 2000
SAMPLES = 480
LAPS = 9
# a trail fraction is of the whole loop of LAPS periods, hence a quarter period
TRAIL = 0.25 / LAPS
START = "<!-- tycho-viewer start, written by demo/tycho-scene.py -->"
END = "<!-- tycho-viewer end -->"


def rhs(t, s):
    """The CR3BP equations of motion in the rotating frame, with the state (x, y, z, vx, vy, vz)."""
    x, y, z, vx, vy, vz = s[:6]
    k1 = (1 - MU) / np.sqrt((x + MU) ** 2 + y**2 + z**2) ** 3
    k2 = MU / np.sqrt((x - 1 + MU) ** 2 + y**2 + z**2) ** 3
    ax = x + 2 * vy - k1 * (x + MU) - k2 * (x - 1 + MU)
    return np.array([vx, vy, vz, ax, y - 2 * vx - (k1 + k2) * y, -(k1 + k2) * z])


def rhs_stm(t, s):
    """The equations of motion followed by the variational equations of the STM, stored row by row."""
    x, y, z = s[:3]
    d1, d2 = np.array([x + MU, y, z]), np.array([x - 1 + MU, y, z])
    r1, r2 = np.linalg.norm(d1), np.linalg.norm(d2)
    hessian = np.diag([1.0, 1.0, 0.0])
    hessian += (1 - MU) * (3 * np.outer(d1, d1) / r1**5 - np.eye(3) / r1**3)
    hessian += MU * (3 * np.outer(d2, d2) / r2**5 - np.eye(3) / r2**3)
    a = np.zeros((6, 6))
    a[:3, 3:] = np.eye(3)
    a[3:, :3] = hessian
    a[3, 4], a[4, 3] = 2.0, -2.0
    return np.concatenate([rhs(t, s), (a @ s[6:].reshape(6, 6)).ravel()])


def crossing(t, s):
    """The event y = 0 after the start, i.e. the half period of a symmetric orbit with vy0 above zero."""
    return s[1] if t > 0.5 else 1.0


crossing.direction = -1
crossing.terminal = True


def correct(x0, z0, vy0):
    """Returns x0, vy0, and the period of the halo orbit through (x0, 0, z0) with the velocity
    (0, vy0, 0), corrected from the guess with z0 held fixed."""
    for _ in range(20):
        start = np.concatenate([[x0, 0.0, z0, 0.0, vy0, 0.0], np.eye(6).ravel()])
        sol = solve_ivp(rhs_stm, (0.0, 6.0), start, events=crossing, method="DOP853", rtol=1e-12, atol=1e-12)
        if not sol.t_events[0].size:
            raise RuntimeError(f"no crossing from x0 = {x0}, z0 = {z0}, vy0 = {vy0}")
        half, end = sol.t_events[0][0], sol.y_events[0][0]
        miss = end[[3, 5]]
        if np.abs(miss).max() < 1e-11:
            return x0, vy0, 2 * half
        stm = end[6:].reshape(6, 6)
        # the crossing time is shifted by -dy / vy when x0 or vy0 is changed, hence this shift, times
        # the rates of vx and vz at the crossing, is added to their derivatives
        rate = rhs(half, end)
        jacobian = stm[np.ix_([3, 5], [0, 4])] - np.outer(rate[[3, 5]], stm[1, [0, 4]]) / end[4]
        dx0, dvy0 = np.linalg.solve(jacobian, -miss)
        x0, vy0 = x0 + dx0, vy0 + dvy0
    raise RuntimeError(f"the corrector does not converge at z0 = {z0}")


def halo_family():
    """Returns the members from Z_START to Z_END as tuples (z0, x0, vy0, period), nondimensional. The
    guess of each member is extrapolated linearly from the two members before it."""
    members = []
    x0, vy0 = SEED
    for z0 in np.linspace(Z_START, Z_END, STEPS + 1) / DU:
        if len(members) >= 2:
            (_, xa, va, _), (_, xb, vb, _) = members[-2:]
            x0, vy0 = 2 * xb - xa, 2 * vb - va
        members.append((z0, *correct(x0, z0, vy0)))
    return members


def jacobi(s):
    """The Jacobi constant of the state s."""
    x, y, z, vx, vy, vz = s
    r1 = np.sqrt((x + MU) ** 2 + y**2 + z**2)
    r2 = np.sqrt((x - 1 + MU) ** 2 + y**2 + z**2)
    return x**2 + y**2 + 2 * (1 - MU) / r1 + 2 * MU / r2 - (vx**2 + vy**2 + vz**2)


def build():
    """Returns the scene of the halo family."""
    scene = ty.Scene(title="Earth–Moon L1 halo family")
    rotating = scene.frame("rotating", label="rotating", axes=("x", "y", "z"), unit="DU")
    inertial = scene.frame("barycentric-inertial", label="barycentric inertial", axes=("X", "Y", "Z"), unit="DU",
                           parent=rotating, rotation=ty.rotation("z", ty.channel("time")))
    earth = scene.body("earth", frame=rotating, position=[-ty.attr("mu"), 0.0, 0.0], label="Earth", color="#56b4e9")
    moon = scene.body("moon", frame=rotating, position=[1 - ty.attr("mu"), 0.0, 0.0], label="Moon", color="#999999")
    scene.frame("inertial-moon", label="inertial, centered on the Moon", axes=("X", "Y", "Z"), unit="DU",
                parent=inertial, origin=moon)
    frames = ["rotating", "barycentric-inertial", "inertial-moon"]

    family = scene.track_set("halo", frame=rotating, tags={"family": "L1 halo"}, attrs={"mu": MU}, periodic=True,
                             label="Earth–Moon L1 halo family")
    members = halo_family()
    for z0, x0, vy0, period in members:
        t = np.linspace(0.0, period, DENSE)
        sol = solve_ivp(rhs, (0.0, period), [x0, 0.0, z0, 0.0, vy0, 0.0], t_eval=t, method="DOP853",
                        rtol=1e-12, atol=1e-12)
        positions = sol.y[:3].T
        family.add(positions, channels={"time": t}, parameters={
            "z0": z0 * DU,
            "period": period,
            "energy": jacobi(sol.y[:, 0]),
        })
    family.describe("time", unit="TU")
    family.describe("z0", label="initial z", unit="km")
    family.describe("period", label="period", unit="TU")
    family.describe("energy", label="Jacobi constant")
    # the samples are kept at equal steps of arclength in all three frames, hence the passes near the
    # Moon in the frame centered on it are not cut short
    family.thin(SAMPLES, frames=frames)

    frame = scene.choice("frame", frames, labels=["rotating", "barycentric inertial", "inertial, Moon"], scope="panel")
    z0 = scene.selector("z0", parameter="z0", default=members[len(members) // 2][0] * DU)
    # one loop of the clock is LAPS periods long, about four revolutions of the Moon, so that the
    # inertial traces are closed round the Earth
    scene.clock("fraction", channels=["time", "@index"], labels=["time", "sample"], steps=SAMPLES * LAPS, laps=LAPS)
    plasma = {"parameter": "z0", "colormap": "plasma"}
    scene.view("main", frame=frame, driver=ty.driver(family, z0),
               camera={"kind": "orbit", "projection": "perspective", "up": "z"}, layers=[
                   ty.track(family, "all", color=plasma, opacity=0.05,
                            highlight={"var": z0, "width": 2.5, "opacity": 1.0, "kernel": {"width": 0.05, "opacity": 0.55}}),
                   ty.track(family, z0, trail=TRAIL, taper=(0, 0), color=plasma, width=22.0, opacity=0.3),
                   ty.track(family, z0, trail=TRAIL, taper=(0, 0), color=plasma, width=6.0),
                   # the orange of the deck, since a layer color is fixed, and white would be lost in
                   # the light mode
                   ty.track(family, z0, trail=TRAIL, head=True, color="#f08050", width=2.0),
                   ty.body(earth, trail=1.0, size=8.0),
                   ty.body(moon, trail=1.0, size=5.0),
                   ty.axes(),
                   ty.grid(),
               ])
    scene.panel("rotating", "main", {frame: "rotating"})
    scene.panel("inertial", "main", {frame: "barycentric-inertial"})
    scene.panel("moon", "main", {frame: "inertial-moon"})
    scene.layout(ty.split("col", 0.5, "rotating", ty.split("row", 0.5, "inertial", "moon")))
    scene.slider(z0, label="initial z, km", domain=family)
    scene.tabs(frame, label="frame")
    scene.transport()
    scene.readout("caption", "z0 = ", {"member": "z0", "digits": 5}, " km, period ", {"member": "period", "digits": 5},
                  " TU, Jacobi constant ", {"member": "energy", "digits": 7})
    return scene


def main(deck):
    scene = build()
    element = ty.build_embed(scene.to_document(), scene.to_container(), theme="dark", kiosk=True, class_="figure-box")
    page = Path(deck).read_text(encoding="utf-8")
    block = f"{START}\n{element}\n{END}"
    if START in page and END in page:
        head, rest = page.split(START, 1)
        _, tail = rest.split(END, 1)
        page = head + block + tail
    else:
        slot = '<div class="figure-box" id="tycho-slot"></div>'
        if slot not in page:
            raise SystemExit("neither the markers nor the slot div are in the deck")
        page = page.replace(slot, block)
    Path(deck).write_text(page, encoding="utf-8")
    print(f"wrote {len(element)} characters of viewer into {deck}")


if __name__ == "__main__":
    main(sys.argv[1])
