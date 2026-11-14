"""Writes demo/broucke-sample.js, the members of Broucke's families 7 and 11 drawn by the demo deck.

The members are read from broucke-input.tyd of the TyCHO Broucke example through build.py of the
same folder, whose read_input() checks the SHA-256 of the file and whose declare_frames() declares
the frame tree. The positions are stored in the rotating-pulsating frame and are taken to the other
frames through this tree. TyCHO is looked for in the folder named by the variable TYCHO, and else in
a checkout next to this repository. Run it from the folder of this repository as

    uv run --project ../tycho/code python demo/broucke.py

and the file is written next to this script.
"""

import importlib.util
import itertools
import json
import os
import pathlib
import sys

import numpy as np
import pytycho as ty
from pytycho._evaluate import Context, FrameTree
from pytycho._thin import _segment_distance

TYCHO = pathlib.Path(os.environ.get("TYCHO", pathlib.Path(__file__).resolve().parents[2] / "tycho"))
BROUCKE = TYCHO / "code" / "examples" / "broucke"
OUTPUT = pathlib.Path(__file__).resolve().parent / "broucke-sample.js"
# the frame keys of the file, mapped to frames of the TyCHO frame tree declared in build.py
FRAMES = {
    "pulsating": "rotating-pulsating",
    "rotating": "rotating",
    "inertial": "barycentric-inertial",
    "inertial-m2": "inertial-m2",
}
BRANCHES = ("periapsis", "apoapsis")
# the sets of the file, as family, branch, (lowest, count), extra, and kinds. the members of a set are
# those nearest to count values of e evenly spaced from lowest to the largest e of the branch, and to
# the values in extra. kinds gives the records of each member as pairs of a frame key and a begin. the
# extra members of the rotating set of family 7 at apoapsis fill the widest gap of its crescent
SETS = (
    (7, "periapsis", (0.0, 8), (), (("pulsating", "ray"), ("inertial-m2", "golden"), ("inertial", "golden"))),
    (7, "apoapsis", (0.0, 8), (0.882, 0.929), (("rotating", "ray"),)),
    (7, "apoapsis", (0.5, 10), (), (("inertial-m2", "golden"),)),
    (11, "periapsis", (0.0, 8), (), (("pulsating", "ray"), ("inertial", "golden"))),
)
# the polar angle about m2 in the pulsating frame, in deg, of the ray on which a record with begin
# "ray" is begun
START_ANGLE = {7: 160.0, 11: 175.0}
GOLDEN = (np.sqrt(5.0) - 1.0) / 2.0
# the largest distance of a stored sample from the chord drawn over it, nondimensional
TOLERANCE = 8e-4
# the largest step of true anomaly between two kept samples, in rad
MAX_STEP = 2 * np.pi / 90
DIGITS = 4
# the fraction of the time of a trace over which its tip is sped up from rest, and as much at the end
EASE = 0.1


def load_build():
    """The module examples/broucke/build.py, imported without writing bytecode into the checkout."""
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location("broucke_build", BROUCKE / "build.py")
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def read_member(build, container, tree, family, branch, i):
    """Member i of a branch, with its planar positions in every frame of FRAMES and its channels."""
    sid = f"family-{family}-{branch}"
    mu = dict(build.FAMILIES)[str(family)]
    offsets = container.view(f"{sid}/offsets")
    rows = slice(int(offsets[i]), int(offsets[i + 1]))
    planar = np.asarray(container.view(f"{sid}/positions")[rows])
    positions = np.hstack([planar, np.zeros((len(planar), 1))])
    channels = {n: np.asarray(container.view(f"{sid}/channels/{n}")[rows]) for n in build.CHANNELS}
    context = Context({"mu": mu}, channels.get, len(planar))
    frames = {k: tree.transform(positions, "rotating-pulsating", f, context)[:, :2] for k, f in FRAMES.items()}
    theta = channels["true_anomaly"]
    # a record is rolled to its begin, which needs a closed orbit of one period of the primaries
    assert abs(theta[-1] - theta[0] - 2 * np.pi) < 1e-9, f"{sid} member {i} is not of period 2 pi"
    for k, p in frames.items():
        assert np.linalg.norm(p[-1] - p[0]) < 1e-6, f"{sid} member {i} is not closed in {k}"
    e = float(container.view(f"{sid}/parameters/eccentricity")[i])
    return {"family": family, "branch": branch, "e": e, "mu": mu, "channels": channels, "frames": frames, "starts": {}}


def ray_start(points, center, angle):
    """The index of the stored sample at the crossing of a closed orbit with a ray, farthest from center.

    The ray is begun at center and pointed at the polar angle given, in rad. The index is the one of the
    sample nearest to the crossing, from 0 to len(points) - 2, since the last sample is the first. It is
    None when the orbit does not cross the ray.
    """
    direction = np.array([np.cos(angle), np.sin(angle)])
    side = (points - center) @ np.array([-direction[1], direction[0]])
    j = np.nonzero(side[:-1] * side[1:] < 0)[0]
    f = side[j] / (side[j] - side[j + 1])
    along = (points[j] + f[:, None] * (points[j + 1] - points[j]) - center) @ direction
    if not (along > 0).any():
        return None
    i = int(np.argmax(np.where(along > 0, along, -np.inf)))
    return int(j[i] + (f[i] > 0.5)) % (len(points) - 1)


def length_start(points, fraction):
    """The index of the stored sample of a closed orbit nearest to the fraction given of its length."""
    s = np.r_[0.0, np.cumsum(np.hypot(*np.diff(points, axis=0).T))]
    return int(np.argmin(np.abs(s[:-1] / s[-1] - fraction)))


def kept_samples(frames, theta, forced):
    """The increasing indices of the samples kept of one member, jointly in every frame of frames.

    The samples forced are kept, and one at least every MAX_STEP of theta. Then, by the Douglas-Peucker
    algorithm in each frame, the farthest stored sample from the chord between two kept samples is kept
    while it is farther than TOLERANCE, until a pass over the frames keeps nothing new.
    """
    m = len(theta)
    grid = np.linspace(theta[0], theta[-1], int(np.ceil((theta[-1] - theta[0]) / MAX_STEP)) + 1)
    kept = set(np.clip(np.searchsorted(theta, grid), 0, m - 1).tolist()) | {0, m - 1} | set(forced)
    while True:
        added = set()
        anchors = sorted(kept)
        for p in frames:
            for a, b in itertools.pairwise(anchors):
                stack = [(a, b)]
                while stack:
                    i, j = stack.pop()
                    if j - i < 2:
                        continue
                    d = _segment_distance(p[i + 1 : j], p[i], p[j])
                    worst = int(np.argmax(d))
                    if d[worst] > TOLERANCE:
                        k = i + 1 + worst
                        added.add(k)
                        stack += [(i, k), (k, j)]
        if added <= kept:
            return np.array(sorted(kept))
        kept |= added


def clock_of(points):
    """The time of each point of a trajectory traced in a unit time, from 0 to 1.

    The tip is moved at a constant speed along the polyline, except over the fraction EASE of the time
    at each end, in which its speed is raised linearly from rest and lowered linearly to rest.
    """
    s = np.r_[0.0, np.cumsum(np.hypot(*np.diff(points, axis=0).T))]
    u = s / s[-1]
    top = 1.0 / (1.0 - EASE)
    eased = top * EASE / 2
    return np.where(
        u < eased,
        np.sqrt(2 * EASE * u / top),
        np.where(u > 1 - eased, 1 - np.sqrt(2 * EASE * np.clip(1 - u, 0, None) / top), u / top + EASE / 2),
    )


def choose(build, container, tree):
    """The members of every set in the order of the file, each with the start of each of its records."""
    members = {}
    for family, branch, (lowest, count), extra, kinds in SETS:
        eccentricities = np.asarray(container.view(f"family-{family}-{branch}/parameters/eccentricity"))
        targets = [*np.linspace(lowest, eccentricities.max(), count), *extra]
        chosen = dict.fromkeys(int(np.argmin(np.abs(eccentricities - t))) for t in targets)
        for i in chosen:
            if (family, branch, i) not in members:
                members[family, branch, i] = read_member(build, container, tree, family, branch, i)
        group = sorted((members[family, branch, i] for i in chosen), key=lambda m: -m["e"])
        # the frames of a member share its samples, hence the crossing is found in the pulsating frame
        # and its index begins a record in any frame
        rays = [
            ray_start(m["frames"]["pulsating"], np.array([1.0 - m["mu"], 0.0]), np.radians(START_ANGLE[family]))
            for m in group
        ]
        for name, begin in kinds:
            if begin == "ray" and None in rays:
                print(f"family {family} {branch}: a member misses the ray, hence the {name} set is begun golden")
                begin = "golden"
            for k, (m, ray) in enumerate(zip(group, rays)):
                golden = length_start(m["frames"][name], (k * GOLDEN) % 1.0)
                m["starts"][name] = ray if begin == "ray" else golden
        values = ", ".join(f"{m['e']:.3f}" for m in group)
        print(f"family {family:>2} {branch:9} {'/'.join(n for n, _ in kinds)}: e = {values}")
    families = [int(f) for f, _ in build.FAMILIES]
    order = lambda m: (families.index(m["family"]), BRANCHES.index(m["branch"]), -m["e"])
    return sorted(members.values(), key=order)


def records_of(member):
    """The records of a member, one per frame with a start, from samples kept jointly in these frames."""
    theta, starts = member["channels"]["true_anomaly"], member["starts"]
    names = [n for n in FRAMES if n in starts]
    kept = kept_samples([member["frames"][n] for n in names], theta, starts.values())
    records = []
    for name in names:
        k, m = starts[name], len(theta)
        order = np.r_[k : m - 1, 0 : k + 1]
        points = member["frames"][name][order[np.isin(order, kept)]]
        t = np.round(clock_of(points), DIGITS)
        assert np.all(np.diff(t) >= 0) and t[0] == 0 and t[-1] == 1
        records.append(
            {
                "family": member["family"],
                "branch": member["branch"],
                "frame": name,
                "e": round(member["e"], 6),
                "mu": member["mu"],
                "bbox": [round(float(v), DIGITS) for v in (*points.min(axis=0), *points.max(axis=0))],
                "t": t.tolist(),
                "points": np.round(points, DIGITS).tolist(),
            }
        )
    return records


def bodies_of(member, tree):
    """The body entry of a member, with m1 and m2 at the first point of each of its records."""
    entry = {"family": member["family"], "branch": member["branch"], "e": round(member["e"], 6), "mu": member["mu"]}
    for name in (n for n in FRAMES if n in member["starts"]):
        k = member["starts"][name]
        at = Context({"mu": member["mu"]}, {c: v[k : k + 1] for c, v in member["channels"].items()}.get, 1)
        entry[name] = {
            body: [round(float(v), DIGITS) for v in tree.body_position(body, FRAMES[name], at)[0, :2]]
            for body in ("m1", "m2")
        }
    return entry


README = [
    "Members of Broucke's families 7 and 11 of the planar ER3BP, taken from the example data of TyCHO "
    "for the demo deck and the tests of the template, and written by demo/broucke.py.",
    "Each entry of 'families' is one member in one frame: family (7 or 11), branch ('periapsis' for the "
    "members that start on the x axis at true anomaly 0, 'apoapsis' for those that start there at true "
    "anomaly pi), frame, the eccentricity e of the primaries, the mass ratio mu, bbox as [xmin, ymin, "
    "xmax, ymax], t as the time of each point, and points as [x, y] over one period, with the last point "
    "equal to the first.",
    "Frame 'pulsating' is the rotating-pulsating frame, in which the primary m1 is fixed at (-mu, 0) and "
    "the secondary m2 at (1 - mu, 0). Frame 'rotating' is the frame turning with the primaries, i.e. the "
    "pulsating position scaled by the separation rho = (1 - e^2) / (1 + e cos theta) at true anomaly "
    "theta. Frame 'inertial' is the barycentric inertial frame, i.e. the rotating position rotated by "
    "theta about the barycenter. Frame 'inertial-m2' is the inertial frame centered on m2. Lengths are "
    "nondimensional, in units of the semi-major axis of the relative orbit of the primaries.",
    "Family 7 at periapsis has 8 members evenly spaced in e from 0 to 0.5, in the frames 'pulsating', "
    "'inertial-m2', and 'inertial'. Family 7 at apoapsis has, in the frame 'rotating', the 8 members "
    "nearest to 8 values of e evenly spaced from 0 to the largest e of the branch and the 2 members "
    "nearest to e = 0.882 and e = 0.929, and in the frame 'inertial-m2', the 10 members nearest to 10 "
    "values of e evenly spaced from 0.5 to the largest e. Family 11 at periapsis has 8 members evenly "
    "spaced in e, in the frames 'pulsating' and 'inertial'.",
    "The entries are ordered by family, then with periapsis before apoapsis, then by decreasing e, so "
    "that a staggered trace sweeps each family.",
    "A record in the frame 'pulsating' or 'rotating' is begun where the orbit crosses the ray from m2 at "
    + " and ".join(f"the polar angle {a:g} deg for family {f}" for f, a in START_ANGLE.items())
    + ", in the pulsating frame and at the crossing farthest from m2, so that the members of a staggered "
    "trace are begun one after another at one place. Any other record is begun at a fraction of the "
    "length of its polyline from the golden-ratio sequence over the members of its set, with the same "
    "fraction in every frame of a member, so that the starts of a drawing traced at once are spread "
    "along it.",
    "The time t runs from 0 at the first point to 1 at the last, in proportion to the length along the "
    f"polyline, except over the first and the last {EASE:g} of the time, in which the tip is sped up from "
    "rest and slowed to rest. Every trajectory is thus traced in the same time at an even pace.",
    "The samples of a member are kept jointly in its frames, at least one every "
    f"{np.degrees(MAX_STEP):g} degrees of true anomaly, and more wherever the computed orbit is farther "
    f"than {TOLERANCE:g} from the chord, with coordinates and times rounded to {DIGITS} decimals.",
    "Each entry of 'bodies' gives, for one member, the positions of m1 and m2 at the first point of its "
    "record in each of its frames.",
]


def written(document):
    """The document as a script for Beeson.trajectories, with one record per line."""
    lines = ["Beeson.trajectories({"]
    keys = list(document)
    for n, key in enumerate(keys):
        value, comma = document[key], "," if n < len(keys) - 1 else ""
        if isinstance(value, list) and value and isinstance(value[0], dict):
            rows = [json.dumps(v, separators=(",", ":")) for v in value]
            lines += [f'  "{key}": [', *[f"    {r}," for r in rows[:-1]], f"    {rows[-1]}", f"  ]{comma}"]
        else:
            lines.append(f'  "{key}": {json.dumps(value)}{comma}')
    return "\n".join([*lines, "});"]) + "\n"


def main():
    build = load_build()
    container = build.read_input(BROUCKE / "broucke-input.tyd")
    scene = ty.Scene(title="Broucke sample")
    build.declare_frames(scene)
    tree = FrameTree(scene._frames, scene._bodies)
    members = choose(build, container, tree)
    document = {
        "readme": README,
        "families": [r for m in members for r in records_of(m)],
        "bodies": [bodies_of(m, tree) for m in members],
    }
    OUTPUT.write_text(written(document))
    print(f"wrote {len(document['families'])} polylines to {OUTPUT} ({OUTPUT.stat().st_size / 1e3:.0f} kB)")


if __name__ == "__main__":
    main()
