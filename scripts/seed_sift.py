"""Convert PX4 ULog flight logs into Parquet tables for Sift mode.

Reads data/raw/<label>/<log id>.ulg (see the PX4 data pipeline in CLAUDE.md)
and writes three tables to public/data/sift/:

  flights.parquet    one row per flight (label, start time, duration, summary stats)
  telemetry.parquet  every flight resampled to a shared 10 Hz timeline
  events.parquet     rule-based anomalies (sustained vibration, vibration spikes, battery sag)

Usage:
  .venv/bin/python scripts/seed_sift.py
"""

from __future__ import annotations

import argparse
import datetime as dt
from pathlib import Path

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from pyulog import ULog

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw"
OUT_DIR = ROOT / "public" / "data" / "sift"

RESAMPLE_HZ = 10
# When a log sits in several label folders, the earliest label here wins.
LABEL_PRIORITY = ["vibration", "component-failure", "sensor-error", "good"]

# Flights with less time in the air than this (bench tests, aborted takeoffs) are skipped.
MIN_AIRBORNE_S = 60.0

# Battery voltage below this means no battery sensor is connected.
MIN_VALID_BATTERY_V = 1.0
TOPICS = [
    "battery_status",
    "sensor_combined",
    "vehicle_attitude",
    "vehicle_local_position",
    "actuator_outputs",
    "vehicle_gps_position",
    "vehicle_land_detected",
]

# Vibration metric: rolling std of the accelerometer magnitude over this window.
VIB_WINDOW_S = 0.5
# vibration_high: sustained vibration above an absolute level.
VIB_HIGH_MS2 = 4.0
VIB_HIGH_MIN_DURATION_S = 10.0
# vibration_spike: short burst well above the trailing baseline.
VIB_SPIKE_BASELINE_S = 30.0
VIB_SPIKE_RATIO = 2.0
VIB_SPIKE_FLOOR_MS2 = 3.0
VIB_SPIKE_MIN_DURATION_S = 0.3

# battery_sag: voltage drop below its rolling median, relative to that median.
SAG_BASELINE_S = 20.0
SAG_THRESHOLD = 0.015
SAG_MIN_DURATION_S = 0.5

# Events closer together than this are merged into one.
EVENT_MERGE_GAP_S = 1.0


def topic(ulog: ULog, name: str, multi_id: int = 0):
    for d in ulog.data_list:
        if d.name == name and d.multi_id == multi_id:
            return d.data
    return None


def seconds(data, t0: int) -> np.ndarray:
    return (data["timestamp"].astype(np.int64) - t0) / 1e6


def resample(t_src: np.ndarray, values: np.ndarray, t_grid: np.ndarray) -> np.ndarray:
    """Linear interpolation onto the grid; NaN outside the source time range."""
    out = np.interp(t_grid, t_src, values.astype(np.float64))
    out[(t_grid < t_src[0]) | (t_grid > t_src[-1])] = np.nan
    return out


def quat_to_euler_deg(q0, q1, q2, q3):
    roll = np.arctan2(2 * (q0 * q1 + q2 * q3), 1 - 2 * (q1**2 + q2**2))
    pitch = np.arcsin(np.clip(2 * (q0 * q2 - q3 * q1), -1, 1))
    yaw = np.arctan2(2 * (q0 * q3 + q1 * q2), 1 - 2 * (q2**2 + q3**2))
    return np.degrees(roll), np.degrees(pitch), np.degrees(yaw)


def vibration_metric(sc, t0: int) -> tuple[np.ndarray, np.ndarray]:
    t = seconds(sc, t0)
    mag = np.sqrt(sum(sc[f"accelerometer_m_s2[{i}]"].astype(np.float64) ** 2 for i in range(3)))
    rate = len(t) / max(t[-1] - t[0], 1e-6)
    window = max(int(rate * VIB_WINDOW_S), 2)
    vib = pd.Series(mag).rolling(window, center=True, min_periods=window // 2).std().to_numpy()
    return t, vib


def find_runs(mask: np.ndarray, t: np.ndarray, min_duration_s: float) -> list[tuple[int, int]]:
    """Index ranges [start, end] where mask is true, merged across short gaps."""
    runs: list[list[int]] = []
    idx = np.flatnonzero(mask)
    if idx.size == 0:
        return []
    start = prev = idx[0]
    for i in idx[1:]:
        if t[i] - t[prev] > EVENT_MERGE_GAP_S:
            runs.append([start, prev])
            start = i
        prev = i
    runs.append([start, prev])
    return [(s, e) for s, e in runs if t[e] - t[s] >= min_duration_s]


def firmware_version(ulog: ULog) -> str | None:
    """PX4 packs the release as 0xMMmmppTT (major, minor, patch, type; type 0xFF = release)."""
    packed = ulog.msg_info_dict.get("ver_sw_release")
    if not packed:
        return None
    major, minor, patch, kind = (packed >> 24) & 0xFF, (packed >> 16) & 0xFF, (packed >> 8) & 0xFF, packed & 0xFF
    return f"v{major}.{minor}.{patch}" + ("" if kind == 0xFF else "-dev")


def flight_start_utc(ulog: ULog) -> str | None:
    gps = topic(ulog, "vehicle_gps_position")
    if gps is None or "time_utc_usec" not in gps:
        return None
    utc = gps["time_utc_usec"].astype(np.int64)
    valid = np.flatnonzero(utc > 0)
    if valid.size == 0:
        return None
    i = valid[0]
    start_us = utc[i] - (int(gps["timestamp"][i]) - ulog.start_timestamp)
    return dt.datetime.fromtimestamp(start_us / 1e6, dt.timezone.utc).isoformat()


class SkipLog(Exception):
    """A log that is readable but should not be part of the dataset."""


def is_simulated(ulog: ULog) -> bool:
    return ulog.msg_info_dict.get("ver_hw") == "PX4_SITL" or ulog.initial_parameters.get("SYS_HITL", 0) != 0


def airborne_seconds(ulog: ULog) -> float | None:
    """Time PX4's land detector reports the vehicle as not landed; None if the topic is missing."""
    land = topic(ulog, "vehicle_land_detected")
    if land is None or "landed" not in land:
        return None
    t = land["timestamp"].astype(np.int64)
    # Each sample's state lasts until the next sample (the last one until the end of the log).
    durations = np.diff(np.append(t, ulog.last_timestamp)) / 1e6
    return float(durations[land["landed"] == 0].sum())


def process(path: Path, label: str) -> tuple[dict, pd.DataFrame, list[dict]]:
    ulog = ULog(str(path), TOPICS)
    flight_id = path.stem
    t0 = ulog.start_timestamp

    if is_simulated(ulog):
        raise SkipLog("simulated (SITL/HITL)")
    airborne_s = airborne_seconds(ulog)
    if airborne_s is None:
        raise SkipLog("no land detector data")
    if airborne_s < MIN_AIRBORNE_S:
        raise SkipLog(f"airborne {airborne_s:.0f}s, under {MIN_AIRBORNE_S:.0f}s")

    sc = topic(ulog, "sensor_combined")
    if sc is None:
        raise ValueError(f"{path.name}: no sensor_combined")
    t_vib, vib = vibration_metric(sc, t0)
    t_grid = np.arange(t_vib[0], t_vib[-1], 1 / RESAMPLE_HZ)
    n = len(t_grid)
    nan = np.full(n, np.nan)

    cols: dict[str, np.ndarray] = {"t_s": t_grid}

    bat = topic(ulog, "battery_status")
    if bat is not None and np.nanmedian(bat["voltage_v"]) < MIN_VALID_BATTERY_V:
        bat = None
    if bat is not None:
        tb = seconds(bat, t0)
        cols["battery_v"] = resample(tb, bat["voltage_v"], t_grid)
        cols["battery_a"] = resample(tb, bat["current_a"], t_grid)
        cols["battery_pct"] = resample(tb, bat["remaining"] * 100, t_grid)
    else:
        cols["battery_v"] = cols["battery_a"] = cols["battery_pct"] = nan

    att = topic(ulog, "vehicle_attitude")
    if att is not None:
        ta = seconds(att, t0)
        roll, pitch, yaw = quat_to_euler_deg(*(att[f"q[{i}]"] for i in range(4)))
        cols["roll_deg"] = resample(ta, roll, t_grid)
        cols["pitch_deg"] = resample(ta, pitch, t_grid)
        cols["yaw_deg"] = resample(ta, yaw, t_grid)
    else:
        cols["roll_deg"] = cols["pitch_deg"] = cols["yaw_deg"] = nan

    pos = topic(ulog, "vehicle_local_position")
    if pos is not None:
        tp = seconds(pos, t0)
        # Height above the first position sample (the EKF origin varies between logs).
        cols["height_m"] = resample(tp, -(pos["z"] - pos["z"][0]), t_grid)
        cols["speed_ms"] = resample(tp, np.hypot(pos["vx"], pos["vy"]), t_grid)
    else:
        cols["height_m"] = cols["speed_ms"] = nan

    ts = seconds(sc, t0)
    for i, axis in enumerate("xyz"):
        cols[f"accel_{axis}"] = resample(ts, sc[f"accelerometer_m_s2[{i}]"], t_grid)
    vib_ok = ~np.isnan(vib)
    cols["vib_ms2"] = resample(t_vib[vib_ok], vib[vib_ok], t_grid)

    act = topic(ulog, "actuator_outputs")
    for m in range(4):
        if act is not None and f"output[{m}]" in act:
            cols[f"motor_{m}"] = resample(seconds(act, t0), act[f"output[{m}]"], t_grid)
        else:
            cols[f"motor_{m}"] = nan

    telemetry = pd.DataFrame(cols)
    telemetry.insert(0, "flight_id", flight_id)

    events = detect_events(flight_id, telemetry)

    flight = {
        "flight_id": flight_id,
        "label": label,
        "started_at": flight_start_utc(ulog),
        "duration_s": float(t_grid[-1] - t_grid[0]),
        "airborne_s": airborne_s,
        "sw_version": firmware_version(ulog),
        "hardware": ulog.msg_info_dict.get("ver_hw"),
        "max_vib_ms2": float(np.nanmax(telemetry["vib_ms2"])),
        "min_battery_v": float(np.nanmin(telemetry["battery_v"])) if bat is not None else None,
        "event_count": len(events),
    }
    return flight, telemetry, events


def detect_events(flight_id: str, tel: pd.DataFrame) -> list[dict]:
    t = tel["t_s"].to_numpy()
    events: list[dict] = []

    vib_series = tel["vib_ms2"]
    vib = vib_series.to_numpy()
    for s, e in find_runs(vib > VIB_HIGH_MS2, t, VIB_HIGH_MIN_DURATION_S):
        events.append(event(flight_id, "vibration_high", t, s, e, np.nanmax(vib[s : e + 1]), "m/s²"))

    window = int(VIB_SPIKE_BASELINE_S * RESAMPLE_HZ)
    baseline = vib_series.rolling(window, min_periods=window // 6).median().shift(1).to_numpy()
    spike = (vib > VIB_SPIKE_RATIO * baseline) & (vib > VIB_SPIKE_FLOOR_MS2)
    for s, e in find_runs(spike, t, VIB_SPIKE_MIN_DURATION_S):
        events.append(event(flight_id, "vibration_spike", t, s, e, np.nanmax(vib[s : e + 1]), "m/s²"))

    v = tel["battery_v"]
    if v.notna().any():
        window = int(SAG_BASELINE_S * RESAMPLE_HZ)
        baseline = v.rolling(window, center=True, min_periods=window // 4).median()
        sag = ((baseline - v) / baseline).to_numpy()
        for s, e in find_runs(sag > SAG_THRESHOLD, t, SAG_MIN_DURATION_S):
            events.append(event(flight_id, "battery_sag", t, s, e, np.nanmax(sag[s : e + 1]) * 100, "%"))

    events.sort(key=lambda ev: ev["start_s"])
    for i, ev in enumerate(events):
        ev["event_id"] = f"{flight_id[:8]}-{i:03d}"
    return events


def event(flight_id, kind, t, s, e, peak, unit) -> dict:
    return {
        "event_id": "",
        "flight_id": flight_id,
        "type": kind,
        "start_s": float(t[s]),
        "end_s": float(t[e]),
        "peak": float(peak),
        "unit": unit,
    }


def write(df: pd.DataFrame, name: str, schema: pa.Schema | None = None) -> None:
    table = pa.Table.from_pandas(df, schema=schema, preserve_index=False)
    path = OUT_DIR / name
    pq.write_table(table, path, compression="zstd")
    print(f"  {path.relative_to(ROOT)}  {len(df):>7} rows  {path.stat().st_size / 1024:>7.0f} KB")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--raw-dir", type=Path, default=RAW_DIR)
    args = parser.parse_args()

    # Sort by label folder in a fixed priority so duplicates keep their most specific label.
    priority = {name: i for i, name in enumerate(LABEL_PRIORITY)}
    logs = sorted(args.raw_dir.glob("*/*.ulg"), key=lambda p: (priority.get(p.parent.name, len(priority)), p.stem))
    if not logs:
        raise SystemExit(f"No .ulg files under {args.raw_dir}")

    flights, telemetry, events = [], [], []
    seen: set[str] = set()
    skipped_filtered = skipped_duplicate = skipped_error = 0
    for path in logs:
        label = path.parent.name
        # A log can carry several error labels and land in two folders; keep the first.
        if path.stem in seen:
            print(f"{label:<18} {path.stem[:8]}  skipped: already seen under another label")
            skipped_duplicate += 1
            continue
        try:
            flight, tel, evs = process(path, label)
        except SkipLog as reason:
            print(f"{label:<18} {path.stem[:8]}  skipped: {reason}")
            skipped_filtered += 1
            continue
        except Exception as error:  # noqa: BLE001 - one bad log shouldn't stop the seed
            print(f"{label:<18} {path.stem[:8]}  skipped: {error}")
            skipped_error += 1
            continue
        seen.add(path.stem)
        print(f"{label:<18} {path.stem[:8]}  {flight['airborne_s']:>6.0f}s air  "
              f"max vib {flight['max_vib_ms2']:5.2f}  events {len(evs)}")
        flights.append(flight)
        telemetry.append(tel)
        events.extend(evs)

    print(f"Kept {len(flights)} of {len(logs)} logs "
          f"({skipped_filtered} short or simulated, {skipped_duplicate} duplicates, {skipped_error} unreadable)")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print("Wrote:")
    flights_df = pd.DataFrame(flights)
    flights_df["started_at"] = pd.to_datetime(flights_df["started_at"], utc=True)
    write(flights_df, "flights.parquet")

    tel_df = pd.concat(telemetry, ignore_index=True)
    float_cols = [c for c in tel_df.columns if c != "flight_id"]
    tel_df[float_cols] = tel_df[float_cols].astype(np.float32)
    write(tel_df, "telemetry.parquet")

    events_schema = pa.schema([
        ("event_id", pa.string()), ("flight_id", pa.string()), ("type", pa.string()),
        ("start_s", pa.float64()), ("end_s", pa.float64()), ("peak", pa.float64()), ("unit", pa.string()),
    ])
    write(pd.DataFrame(events, columns=events_schema.names), "events.parquet", events_schema)


if __name__ == "__main__":
    main()
