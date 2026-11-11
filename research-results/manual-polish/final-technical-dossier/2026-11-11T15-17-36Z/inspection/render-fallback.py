from collections import defaultdict
from html import escape
from pathlib import Path
import math
import re
import sys
import textwrap

FOLDER = Path(sys.argv[1])
TITLES = [
    "Architectuur", "Uitvoeringsflow", "Vertrouwensgrenzen", "Capability-goedkeuring",
    "Gateway naar Paper", "Bewijs en advies", "Multi-file opslaan en uitvoeren",
    "Deno, Docker en gVisor", "Vereenvoudigd PostgreSQL-model", "UI-navigatie",
    "Architectuur voor presentatie", "Uitvoering voor presentatie",
    "Goedkeuring voor presentatie", "Compose-netwerken", "Timeout en audit",
]


def label(x, y, value, *, size=14, anchor="middle", weight=500):
    return (f'<text x="{x}" y="{y}" text-anchor="{anchor}" font-size="{size}" '
            f'font-weight="{weight}">{escape(value)}</text>')


def box(x, y, width, height, value, *, fill="#eef2ff"):
    elements = [f'<rect x="{x}" y="{y}" width="{width}" height="{height}" '
                f'rx="8" fill="{fill}" stroke="#94a3b8"/>']
    rows = textwrap.wrap(value.replace("_", " "), max(12, width // 8))
    for i, row in enumerate(rows):
        elements.append(label(x + width / 2, y + height / 2 + 5 + (i - (len(rows)-1)/2)*17, row))
    return "".join(elements)


def path(points, *, end=True, start=False, dashed=False):
    value = " ".join(("M" if i == 0 else "L") + f"{x},{y}" for i, (x,y) in enumerate(points))
    return (f'<path d="{value}" fill="none" stroke="#475569" stroke-width="1.5"'
            + (' marker-end="url(#arrow)"' if end else '')
            + (' marker-start="url(#arrow)"' if start else '')
            + (' stroke-dasharray="5 5"' if dashed else '') + '/>')


def background(width, height, title, elements):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" '
            f'viewBox="0 0 {width} {height}" role="img" aria-label="{escape(title)}">'
            '<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" '
            'orient="auto-start-reverse" markerUnits="userSpaceOnUse">'
            '<path d="M0 0L8 4L0 8z" fill="#475569"/></marker></defs>'
            f'<rect width="{width}" height="{height}" fill="#fff"/>'
            '<g font-family="Segoe UI,Arial,sans-serif" fill="#0f172a">'
            + label(30, 39, title, size=23, anchor="start", weight=700)
            + "".join(elements) + '</g></svg>')


def sequence(lines, title):
    participants, messages = {}, []
    for line in lines:
        if m := re.fullmatch(r"(?:participant|actor) (\w+) as (.+)", line):
            participants[m[1]] = m[2]
        elif m := re.fullmatch(r"(\w+)(--?>>)(\w+): (.+)", line):
            messages.append(("message", *m.groups()))
        elif line.startswith(("alt ", "else ", "Note ")):
            messages.append(("note", line.split(": ", 1)[-1] if line.startswith("Note ") else line.replace("alt ", "", 1).replace("else ", "", 1)))
    lane = 205
    width = max(650, len(participants)*lane + 70)
    xs = {key: (width - (len(participants)-1)*lane)/2 + i*lane
          for i, key in enumerate(participants)}
    height = 156 + len(messages)*53
    elements = []
    for key, value in participants.items():
        x = xs[key]
        elements.extend([path([(x, 113), (x, height-28)], end=False, dashed=True),
                         box(x-84, 67, 168, 46, value)])
    for i, item in enumerate(messages):
        y = 145 + i*53
        if item[0] == "note":
            elements.append(box(30, y-21, width-60, 34, item[1], fill="#fffbeb"))
            continue
        _, left, arrow, right, text = item
        x, z = xs[left], xs[right]
        if x == z:
            direction = -1 if x > width - 190 else 1
            edge = x + direction * 26
            elements.append(path([(x, y), (edge, y), (edge, y+15), (x, y+15)], dashed=arrow.startswith("--")))
            anchor = "start" if direction == 1 else "end"
            elements.append(label(x + direction * 33, y+6, text, size=12, anchor=anchor))
        else:
            elements.append(path([(x, y), (z, y)], dashed=arrow.startswith("--")))
            middle = (x+z)/2
            rows = textwrap.wrap(text, max(24, int(abs(x-z)/7)))
            for j, row in enumerate(rows):
                elements.append(label(middle, y-8-(len(rows)-1-j)*13, row, size=12))
    return background(width, height, title, elements)


def graph(lines, title, er=False):
    nodes, edges, members = {}, [], defaultdict(list)
    group = None
    for line in lines:
        if line.startswith("subgraph "):
            group = line.partition("[")[2].rstrip("]")
            continue
        if line == "end":
            group = None
            continue
        if er:
            m = re.fullmatch(r"(\w+) (\S+) (\w+) : (.+)", line)
            if m:
                a, relation, b, tag = m.groups()
                nodes.setdefault(a, a)
                nodes.setdefault(b, b)
                edges.append((a, b, relation + " " + tag, "er"))
            continue
        parts = re.split(r" (<-->|-->|-\.->|---)(?:\|([^|]+)\|)? ", line)
        keys = []
        for part in (parts[0], parts[3]) if len(parts) == 4 else (parts[0],):
            m = re.fullmatch(r"(\w+)(?:\[\(?(.+?)\)?\]|\{(.+)\})?", part)
            if not m:
                raise ValueError(f"unparsed node: {part}")
            key, normal, choice = m.groups()
            if normal or choice or key not in nodes:
                nodes[key] = normal or choice or key
            keys.append(key)
            if group and key not in members[group]:
                members[group].append(key)
        if len(keys) == 2:
            edges.append((keys[0], keys[1], parts[2] or "", parts[1]))

    # Deterministic ranks use first discovery. Back-links and joins use separate side channels.
    rank = {next(iter(nodes)): 0}
    for _ in nodes:
        for a, b, _, _ in edges:
            if a in rank and b not in rank:
                rank[b] = rank[a] + 1
    for key in nodes:
        rank.setdefault(key, 0)
    by_rank = defaultdict(list)
    for key in nodes:
        by_rank[rank[key]].append(key)
    width = max(780, max(map(len, by_rank.values()))*235 + 120)
    height = 155 + max(by_rank)*130
    positions = {}
    for r, keys in by_rank.items():
        for i, key in enumerate(keys):
            positions[key] = ((width - (len(keys)-1)*230)/2 + i*230, 103 + r*130)
    colors = {key: color for (g, keys), color in zip(members.items(), ["#fffbeb", "#ecfeff", "#f0fdf4"])
              for key in keys}
    elements = []
    for i, (a, b, tag, kind) in enumerate(edges):
        x, y = positions[a]
        z, t = positions[b]
        if y < t:
            level = y + 44 + (i % 4)*9
            points = [(x, y+25), (x, level), (z, level), (z, t-27)]
            tag_x, tag_y = (x+z)/2+5, level-5
        else:
            side = width-26-(i%5)*13
            points = [(x+95,y), (side,y), (side,t-35), (z,t-35), (z,t-27)]
            tag_x, tag_y = side-9, (t+y)/2
        elements.append(path(points, end=kind not in ("---","er"), start=kind=="<-->", dashed=kind=="-.->"))
        if tag:
            anchor = "end" if y >= t else "middle"
            elements.append(label(tag_x, tag_y, tag, size=11, anchor=anchor))
    for key, name in nodes.items():
        x, y = positions[key]
        elements.append(box(x-95, y-25, 190, 50, name, fill=colors.get(key,"#eef2ff")))
    if members:
        for i,(name, keys) in enumerate(members.items()):
            color = colors[keys[0]]
            x = 25 + i*245
            elements.append(f'<rect x="{x}" y="{height-29}" width="13" height="13" fill="{color}" stroke="#94a3b8"/>')
            elements.append(label(x+20, height-18, name, size=12, anchor="start"))
    return background(width, height, title, elements)


for source in sorted(FOLDER.glob("*.mmd")):
    lines = [line.strip() for line in source.read_text(encoding="utf-8").splitlines() if line.strip()]
    title = TITLES[int(source.name[:2])-1]
    svg = sequence(lines[1:], title) if lines[0] == "sequenceDiagram" else graph(lines[1:], title, lines[0] == "erDiagram")
    source.with_suffix(".svg").write_text(svg, encoding="utf-8")
    print("PASS", source.name)

