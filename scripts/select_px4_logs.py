"""Pick PX4 Flight Review logs that are likely real, sustained flights, and print their ids.

flight_review's download_logs.py filters by rating and flight mode but not by duration, so a
plain `--rating Good` mostly returns short hops and bench tests. This script reads the same
public database index and keeps quadrotor logs that:

  - have the requested rating (default: Good) and no error labels
  - last at least --min-duration seconds (log length; the seed script later checks airborne time)
  - don't come from the software-in-the-loop simulator
  - spread across vehicles (at most --max-per-vehicle logs each)

Usage (prints space-separated log ids, newest first):
  .venv/bin/python scripts/select_px4_logs.py -n 15
  cd flight_review/app && ../../.venv/bin/python download_logs.py --log-id $(…) -d ../../data/raw/good --yes
"""

from __future__ import annotations

import argparse
import sys

import requests

DB_INFO_URL = "https://review.px4.io/dbinfo"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("-n", "--max-num", type=int, default=15)
    parser.add_argument("--rating", default="good")
    parser.add_argument("--min-duration", type=float, default=180)
    parser.add_argument("--max-duration", type=float, default=1800, help="skip very long logs (large downloads)")
    parser.add_argument("--max-per-vehicle", type=int, default=1)
    args = parser.parse_args()

    entries = requests.get(DB_INFO_URL, timeout=120).json()
    picked = [
        e
        for e in entries
        if e.get("mav_type", "").lower() == "quadrotor"
        and e.get("rating", "").lower() == args.rating.lower()
        and not e.get("error_labels")
        and args.min_duration <= (e.get("duration_s") or 0) <= args.max_duration
        and e.get("sys_hw") != "PX4_SITL"
    ]
    picked.sort(key=lambda e: e.get("log_date", ""), reverse=True)

    # One busy test campaign can dominate the newest logs; keep the set varied across vehicles.
    per_vehicle: dict[str, int] = {}
    varied = []
    for e in picked:
        vehicle = e.get("vehicle_uuid") or e.get("sys_hw") or e["log_id"]
        if per_vehicle.get(vehicle, 0) < args.max_per_vehicle:
            per_vehicle[vehicle] = per_vehicle.get(vehicle, 0) + 1
            varied.append(e)
    picked = varied

    print(f"{len(picked)} of {len(entries)} logs match; taking {min(len(picked), args.max_num)}", file=sys.stderr)
    for e in picked[: args.max_num]:
        print(f"  {e['log_id']}  {e['log_date']}  {e['duration_s']:>5}s  {e.get('sys_hw')}", file=sys.stderr)
    print(" ".join(e["log_id"] for e in picked[: args.max_num]))


if __name__ == "__main__":
    main()
