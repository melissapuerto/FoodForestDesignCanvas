#!/usr/bin/env python3
"""Measure the energy + carbon of a Kuxtal build/test run and compute its
Software Carbon Intensity (SCI), per the Green Software Foundation spec
SCI = ((E x I) + M) / R.

This is the harness the "Use and Value Renewable Sources" / "Expose the Seams"
guidelines ask for (measure energy of test runs; report SCI). It wraps the real
`npm` commands in a CodeCarbon tracker and writes a JSON + Markdown report.

HONESTY (same rule as ENERGY.md): on a runner without Intel RAPL/powercap,
CodeCarbon estimates CPU energy from TDP rather than reading hardware counters,
so E is an ESTIMATE, not a hardware measurement. Re-run on a RAPL-capable CI
runner for hardware-accurate numbers. The methodology and the harness are the
durable deliverable; the absolute joules are calibration.

Usage:  python3 scripts/energy/measure_energy.py [--project DIR] [--out DIR]
"""
import argparse, json, os, subprocess, sys, time, datetime, glob

# ---- Documented constants (transparent; substitute for your context) ----
# Grid marginal carbon intensity, gCO2eq/kWh. Global average ~480 (Ember/IEA
# 2023). Substitute the CI runner region's marginal intensity for accuracy.
GRID_INTENSITY_G_PER_KWH = 480.0
# Embodied carbon of a laptop-class CI machine (~300 kgCO2e), amortised over a
# 4-year service life to the seconds this run occupied it (SCI "M" term).
EMBODIED_DEVICE_G = 300_000.0
DEVICE_LIFETIME_S = 4 * 365 * 24 * 3600
# Runtime (per-visit) proxy — matches the in-app factor in src/lib/loading/facts.ts
ENERGY_KWH_PER_GB = 0.81
FIRST_VISIT_BYTES = 470_000   # full canvas path gz (first-paint set + map engine)

def run_tracked(commands, project_dir, out_dir):
    from codecarbon import OfflineEmissionsTracker
    tracker = OfflineEmissionsTracker(
        country_iso_code="USA",          # documented placeholder region
        output_dir=out_dir,
        save_to_file=True,
        log_level="error",
        measure_power_secs=1,
    )
    t0 = time.time()
    tracker.start()
    try:
        for cmd in commands:
            print(f"  · running: {cmd}")
            subprocess.run(cmd, cwd=project_dir, shell=True, check=False,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    finally:
        emissions_kg = tracker.stop()
    dur = time.time() - t0
    data = getattr(tracker, "final_emissions_data", None)
    energy_kwh = float(getattr(data, "energy_consumed", 0.0) or 0.0)
    return emissions_kg or 0.0, energy_kwh, dur

def sci(energy_kwh, duration_s):
    E = energy_kwh
    I = GRID_INTENSITY_G_PER_KWH
    M = EMBODIED_DEVICE_G * (duration_s / DEVICE_LIFETIME_S)  # amortised embodied
    operational = E * I
    return {
        "energy_kwh": round(E, 8),
        "grid_intensity_g_per_kwh": I,
        "operational_gco2e": round(operational, 6),
        "embodied_gco2e": round(M, 6),
        "sci_gco2e_per_run": round(operational + M, 6),
        "functional_unit": "1 CI build+test run",
    }

def visit_sci():
    E = (FIRST_VISIT_BYTES / 1e9) * ENERGY_KWH_PER_GB
    return {
        "first_visit_bytes_gz": FIRST_VISIT_BYTES,
        "energy_kwh": round(E, 9),
        "operational_gco2e": round(E * GRID_INTENSITY_G_PER_KWH, 6),
        "note": "Repeat visits transfer ~0 bytes (offline-first), so SCI≈embodied only.",
        "functional_unit": "1 first visit (cold cache)",
    }

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--project", default=os.getcwd())
    ap.add_argument("--out", default=os.path.join(os.getcwd(), "docs", "energy"))
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)

    print("Measuring energy of: npm run build + npm test")
    emissions_kg, energy_kwh, dur = run_tracked(
        ["npm run build", "npm test"], args.project, args.out
    )
    build_test = sci(energy_kwh, dur)
    report = {
        "measured_at": datetime.datetime.now().isoformat(timespec="seconds"),
        "harness": "CodeCarbon OfflineEmissionsTracker",
        "rapl_available": os.path.isdir("/sys/class/powercap/intel-rapl"),
        "duration_s": round(dur, 1),
        "codecarbon_emissions_kg": round(emissions_kg, 8),
        "build_test_run": build_test,
        "per_visit": visit_sci(),
        "caveat": ("Energy is TDP-estimated (no RAPL in this environment). "
                   "Re-run on a RAPL-capable CI runner for hardware-accurate E."),
    }
    with open(os.path.join(args.out, "energy-report.json"), "w") as f:
        json.dump(report, f, indent=2)
    print(json.dumps(report, indent=2))
    return report

if __name__ == "__main__":
    main()
