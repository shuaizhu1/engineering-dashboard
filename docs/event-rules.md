# Event rules (Sift mode)

The seed script (`scripts/seed_sift.py`) flags three kinds of events in each flight. All rules run on the 10 Hz telemetry grid, only while PX4's land detector reports the vehicle airborne, and compare each flight with its own baseline.

| Event | Rule |
| --- | --- |
| Vibration spike | Vibration above 3× its trailing 30 s median and above 5 m/s², for at least 0.2 s |
| Sustained vibration | Vibration above 2× the flight's airborne median and above 4 m/s², for at least 10 s |
| Battery sag | Voltage more than 5% below its 20 s rolling median, for at least 1 s |

**Vibration** is the RMS of high-pass filtered 3-axis acceleration: a 0.1 s rolling mean is subtracted to remove the low-frequency motion of normal maneuvering, then the RMS is taken over 0.5 s.

## Why relative rules

Tested on 33 flights (2026-10-30), no fixed vibration level separated good-rated flights from flights labeled "Vibration". Medians of each flight's 95th-percentile vibration:

| Metric | Good | Vibration |
| --- | --- | --- |
| Rolling std of acceleration magnitude (first version) | 3.8 | 3.6 |
| High-pass RMS (current) | 6.6 | 5.0 |
| PX4's onboard `accel_vibration_metric` | 7.0 | 8.5 |

Airframes differ in IMU mounting, filtering and logging rate, and the labels are user-submitted, so an absolute threshold fires on half the good flights. Anomalies relative to each flight's own baseline hold up better.

## Effect of the retune

| | First rules | Current rules |
| --- | --- | --- |
| Events in total | 385 | 45 |
| Good flights with any event | 88% | 44% |
| Vibration flights with any event | 91% | 73% |
| Median events per airborne minute: good / vibration | 1.13 / 0.78 | 0.00 / 0.11 |

The first rules (1.5% battery sag, fixed 4 m/s² sustained vibration on the unfiltered metric) fired on every hard throttle punch and on ordinary maneuvering. Good-rated flights still produce most battery-sag events (9 of 11): they are often flown hard on older packs, which is a real voltage drop, not a fault label.
