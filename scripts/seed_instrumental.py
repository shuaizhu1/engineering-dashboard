"""Build the Instrumental mode ("Line Inspector") dataset from DeepPCB board images.

DeepPCB (https://github.com/tangsanli5201/DeepPCB, MIT) has 640x640 PCB image pairs: a defect-free
template and an aligned tested image annotated with defect boxes. The images and boxes are real;
the production context around them (serials, lines, stations, timestamps) is synthetic, with a
planted defect spike for the demo story to find.

Reads data/raw/deeppcb/PCBData/group*/ (sparse clone, see README) and writes to public/data/instrumental/:

  units.parquet     one row per inspected board (serial, line, station, time, result, image)
  defects.parquet   one row per defect box on a failed board (DeepPCB annotation, image pixel coords)
  images/<id>.webp  full 640x640 board image (lossless, sharp edges for zoom)
  thumbs/<id>.webp  160x160 thumbnail for the grid

Failed boards show a DeepPCB tested image with its defects; passed boards show a template image.

Usage:
  .venv/bin/python scripts/seed_instrumental.py               # small sample
  .venv/bin/python scripts/seed_instrumental.py --units 5000 --images 0
"""

from __future__ import annotations

import argparse
import datetime as dt
import shutil
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw" / "deeppcb" / "PCBData"
OUT_DIR = ROOT / "public" / "data" / "instrumental"

SEED = 7
THUMB_PX = 160

# DeepPCB class IDs (0 is background and unused).
DEFECT_TYPES = {1: "open", 2: "short", 3: "mousebite", 4: "spur", 5: "copper", 6: "pin-hole"}

LINES = ["L1", "L2", "L3"]
STATIONS = ["AOI-1", "AOI-2"]
START = dt.datetime(2026, 10, 5, tzinfo=dt.timezone.utc)
# Production runs two shifts, 06:00-22:00.
SHIFT_START_H, SHIFT_END_H = 6, 22

# Normal first-pass fail rate per line.
BASE_FAIL_RATE = {"L1": 0.06, "L2": 0.07, "L3": 0.09}

# Planted spike: a worn etch step on L2 feeding AOI-2 starts leaving copper bridges (shorts).
# Inside the window that station fails far more boards, and the failures are short-heavy.
SPIKE_LINE, SPIKE_STATION = "L2", "AOI-2"
SPIKE_DAYS = (9, 11)  # day offsets from START, end exclusive
SPIKE_FAIL_RATE = 0.7
SPIKE_TYPE = "short"
# DeepPCB balances defect types within each image (at most ~43% of one type), so spike failures
# reuse the most short-heavy images in the whole dataset to make the shift visible in the Pareto.
SPIKE_POOL_SIZE = 12


@dataclass
class Pair:
    image_id: str  # DeepPCB stem, e.g. "00041000"
    test: Path
    template: Path
    defects: list[tuple[int, int, int, int, str]]

    @property
    def spike_share(self) -> float:
        return sum(d[4] == SPIKE_TYPE for d in self.defects) / len(self.defects)


def load_pairs(raw_dir: Path) -> list[Pair]:
    pairs = []
    for test in sorted(raw_dir.glob("group*/*/*_test.jpg")):
        stem = test.name.removesuffix("_test.jpg")
        notes = test.parent.parent / f"{test.parent.name}_not" / f"{stem}.txt"
        template = test.with_name(f"{stem}_temp.jpg")
        if not notes.exists() or not template.exists():
            continue
        defects = []
        # The README documents commas, but the files are space-separated; accept both.
        for line in notes.read_text().splitlines():
            parts = line.replace(",", " ").split()
            if len(parts) != 5:
                continue
            x1, y1, x2, y2, kind = map(int, parts)
            if kind in DEFECT_TYPES:
                defects.append((x1, y1, x2, y2, DEFECT_TYPES[kind]))
        if defects:
            pairs.append(Pair(stem, test, template, defects))
    return pairs


def generate_units(pairs: list[Pair], spike_pool: list[Pair], n_units: int, days: int,
                   rng: np.random.Generator) -> tuple[pd.DataFrame, pd.DataFrame]:
    offsets = np.sort(rng.random(n_units)) * days
    units, defects = [], []
    for i, offset in enumerate(offsets):
        day = int(offset)
        hour = SHIFT_START_H + (offset - day) * (SHIFT_END_H - SHIFT_START_H)
        inspected_at = START + dt.timedelta(days=day, seconds=round(hour * 3600))
        line = LINES[rng.integers(len(LINES))]
        station = STATIONS[rng.integers(len(STATIONS))]
        in_spike = line == SPIKE_LINE and station == SPIKE_STATION and SPIKE_DAYS[0] <= day < SPIKE_DAYS[1]

        fail_rate = SPIKE_FAIL_RATE if in_spike else BASE_FAIL_RATE[line]
        failed = rng.random() < fail_rate
        pool = spike_pool if in_spike else pairs
        pair = pool[rng.integers(len(pool))]
        serial = f"SN{100001 + i}"

        units.append({
            "serial": serial,
            "line": line,
            "station": station,
            "inspected_at": inspected_at,
            "result": "fail" if failed else "pass",
            "defect_count": len(pair.defects) if failed else 0,
            "image_id": f"{pair.image_id}_{'test' if failed else 'temp'}",
        })
        if failed:
            for x1, y1, x2, y2, kind in pair.defects:
                defects.append({"serial": serial, "type": kind, "x1": x1, "y1": y1, "x2": x2, "y2": y2})

    units_df = pd.DataFrame(units)
    units_df["inspected_at"] = pd.to_datetime(units_df["inspected_at"], utc=True)
    defects_df = pd.DataFrame(defects, columns=["serial", "type", "x1", "y1", "x2", "y2"])
    defects_df[["x1", "y1", "x2", "y2"]] = defects_df[["x1", "y1", "x2", "y2"]].astype(np.int16)
    return units_df, defects_df


def write_images(pairs: list[Pair], used: set[str]) -> None:
    images_dir, thumbs_dir = OUT_DIR / "images", OUT_DIR / "thumbs"
    for d in (images_dir, thumbs_dir):
        shutil.rmtree(d, ignore_errors=True)
        d.mkdir(parents=True)
    total = 0
    for pair in pairs:
        for variant, src in (("test", pair.test), ("temp", pair.template)):
            image_id = f"{pair.image_id}_{variant}"
            if image_id not in used:
                continue
            im = Image.open(src).convert("L")
            im.save(images_dir / f"{image_id}.webp", "WEBP", lossless=True, method=6)
            im.thumbnail((THUMB_PX, THUMB_PX))
            im.save(thumbs_dir / f"{image_id}.webp", "WEBP", quality=70, method=6)
            total += (images_dir / f"{image_id}.webp").stat().st_size + (thumbs_dir / f"{image_id}.webp").stat().st_size
    print(f"  {len(used)} images + thumbnails  {total / 1024:>7.0f} KB")


def write(df: pd.DataFrame, name: str) -> None:
    path = OUT_DIR / name
    # Small tables are read with hyparquet, which decodes Snappy natively.
    pq.write_table(pa.Table.from_pandas(df, preserve_index=False), path, compression="snappy")
    print(f"  {path.relative_to(ROOT)}  {len(df):>7} rows  {path.stat().st_size / 1024:>7.0f} KB")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--raw-dir", type=Path, default=RAW_DIR)
    parser.add_argument("--units", type=int, default=1500, help="boards to generate")
    parser.add_argument("--days", type=int, default=14)
    parser.add_argument("--images", type=int, default=40, help="DeepPCB pairs to sample (0 = all)")
    args = parser.parse_args()

    rng = np.random.default_rng(SEED)
    all_pairs = load_pairs(args.raw_dir)
    if not all_pairs:
        raise SystemExit(f"No DeepPCB image pairs under {args.raw_dir}")
    pairs = all_pairs
    if 0 < args.images < len(all_pairs):
        pairs = [all_pairs[i] for i in sorted(rng.choice(len(all_pairs), args.images, replace=False))]
    spike_pool = sorted(all_pairs, key=lambda p: p.spike_share, reverse=True)[:SPIKE_POOL_SIZE]
    print(f"Using {len(pairs)} DeepPCB image pairs, plus {len(spike_pool)} short-heavy ones for the spike")

    units, defects = generate_units(pairs, spike_pool, args.units, args.days, rng)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print("Wrote:")
    write(units, "units.parquet")
    write(defects, "defects.parquet")
    write_images(all_pairs, set(units["image_id"]))


if __name__ == "__main__":
    main()
