# Fraud Detection System - Adaptive Data Collection

## Overview

This document explains the optimized fraud detection system that solves the **adaptive data collection problem** - how to collect meaningful data when user behavior varies dramatically (lying in bed vs. running vs. driving).

## The Problem

Traditional fixed-window collection has issues:

| User Activity     | Problem with Fixed Collection           |
| ----------------- | --------------------------------------- |
| 🛋️ Lying in bed   | Too little motion = sparse, boring data |
| 🚶 Normal walking | Ideal scenario                          |
| 🚗 In a car       | High vibration, not human motion        |
| 🏃 Running        | Need more samples to capture pattern    |

**Fixed collection doesn't know what the user is doing**, so it either:

- Collects too little (misses patterns)
- Collects too much (wastes battery, data)

## The Solution: Activity-Aware Adaptive Windowing

Our system dynamically adjusts based on detected activity:

```
┌─────────────────────────────────────────────────────────┐
│                  ADAPTIVE COLLECTION                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────┐                                        │
│  │ Accelerometer│──▶ Activity Detection ──▶ Sample Rate │
│  └─────────────┘        ▼                    Adjustment │
│                    ┌──────────┐                         │
│                    │ Activity │                         │
│                    │  State   │                         │
│                    └──────────┘                         │
│                         │                               │
│         ┌───────────────┼───────────────┐              │
│         ▼               ▼               ▼              │
│   ┌───────────┐  ┌───────────┐   ┌───────────┐        │
│   │Stationary │  │  Walking  │   │  Vehicle  │        │
│   │  0.5x     │  │   1.5x    │   │   1.2x    │        │
│   │sample rate│  │sample rate│   │sample rate│        │
│   └───────────┘  └───────────┘   └───────────┘        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### How It Works

1. **Initial Collection** (100ms samples at 50Hz)

   - Collect a small burst of accelerometer data
   - Calculate magnitude, variance, and deviation from gravity

2. **Activity Classification**

   ```
   deviation < 0.3 m/s²  →  STATIONARY
   deviation < 2.0 m/s²  →  MICRO_MOTION
   deviation < 5.0 m/s²  →  WALKING or VEHICLE (check stepping pattern)
   deviation >= 5.0 m/s² →  RUNNING or VEHICLE
   ```

3. **Stepping Pattern Detection**

   - Look for oscillation in Z-axis (up/down motion)
   - Count zero-crossings to estimate step frequency
   - Walking: 1.5-2.5 Hz | Running: 2.5-4 Hz

4. **Adaptive Rate Adjustment**
   | Activity | Sample Rate | Reason |
   |----------|-------------|--------|
   | Stationary | 25Hz (0.5x) | Save battery, data is stable |
   | Micro Motion | 50Hz (1x) | Normal phone usage |
   | Walking | 75Hz (1.5x) | Capture stepping pattern |
   | Running | 75Hz (1.5x) | Need good pattern capture |
   | Vehicle | 60Hz (1.2x) | Capture vibration signature |

## How Much Data Before Ingestion?

The system uses **quality gates** instead of fixed time windows:

### Minimum Requirements

| Gate                    | Requirement    | Purpose                        |
| ----------------------- | -------------- | ------------------------------ |
| `minSamplesForAnalysis` | 100 samples    | Basic statistical significance |
| `stabilityRequirement`  | Variance < 0.5 | Activity state stabilized      |
| `minCollectionTime`     | 3-5 seconds    | Catch activity transitions     |

### Adaptive Duration

```typescript
getRecommendedCollectionDuration() {
  switch (this.currentActivityState) {
    case 'stationary':
      // Need more time to ensure it's really stationary
      // (not just a brief pause)
      return baseWindow * 1.5;  // 7.5 seconds

    case 'walking':
    case 'running':
      // Pattern detection is faster with rhythmic motion
      return baseWindow * 0.8;  // 4 seconds

    default:
      return baseWindow;  // 5 seconds
  }
}
```

### Quality Signals

Instead of "collect for X seconds", we check:

1. **Sample Count**: Do we have enough data points?
2. **Stability**: Has the activity state been consistent?
3. **Pattern Quality**: Can we detect human-like patterns?
4. **Cross-Validation**: Do different sensors agree?

## Fraud Detection Signals

### 1. Accelerometer Analysis

| Signal              | Detection Method   | Fraud Indicator  |
| ------------------- | ------------------ | ---------------- |
| Static readings     | Variance < 0.001   | Simulated sensor |
| Perfect patterns    | No jitter          | Bot/emulator     |
| Unnatural magnitude | Not near 9.81 m/s² | Fake data        |
| Missing noise       | Too clean          | Synthesized      |

### 2. Emulator Detection

```typescript
// Build fingerprints
const suspiciousSignatures = ['generic', 'sdk', 'emulator', 'goldfish', 'vbox', 'genymotion', 'nox', 'Andy'];

// Sensor availability
if (!hasRealSensors || sensorsReturnStatic) {
  addFraudSignal('emulator_sensors');
}
```

### 3. Scroll Throttle Analysis

| Pattern            | Detection              | Severity |
| ------------------ | ---------------------- | -------- |
| Uniform intervals  | Variance < 1ms         | High     |
| Superhuman speed   | Interval < 16ms        | High     |
| Mechanical pattern | Same interval repeated | Medium   |

### 4. Battery State

```python
# Suspicious patterns:
- Level never changes (simulated)
- Always at 100% (fake)
- Rapid drain when not charging (impossible)
```

### 5. Pedometer Cross-Validation

```python
# If claiming to walk but:
if (pedometer.steps > 0 and not motion.is_human_like):
    addFraudSignal('pedometer_mismatch')

# If cadence doesn't match activity:
if (activity == 'walking' and not (90 <= cadence <= 130)):
    addFraudSignal('cadence_mismatch')
```

## Usage Example

```typescript
import { useFraudDetection } from '@dataclaus/sdk-react-native';
import { Accelerometer, Gyroscope, Pedometer } from 'expo-sensors';

function App() {
  const { state, metrics, start, stop, canAnalyze } = useFraudDetection(
    { Accelerometer, Gyroscope, Pedometer },
    {
      minCollectionTime: 5000, // Min 5 seconds
      minSamplesForAnalysis: 100, // At least 100 samples
      baseSampleRate: 50, // 50 Hz base rate
    }
  );

  // UI shows:
  // - Current activity state (stationary/walking/etc)
  // - Collection progress (samples/time)
  // - Adaptive sample rate

  // When canAnalyze is true, the user can analyze
  // OR wait for automatic quality threshold

  const handleStop = async () => {
    const fraud = await stop();
    // fraud.fraudScore: 0-1 (higher = more suspicious)
    // fraud.fraudSignals: Array of detected issues
    // fraud.motionPatterns: Motion analysis results
  };
}
```

## AI Worker Integration

The AI Worker receives pre-analyzed fraud signals but also performs its own analysis:

```python
class FraudScorer:
    def score(self, event):
        # 1. Re-analyze motion if raw samples included
        motion = self.motion_analyzer.analyze(samples)

        # 2. Check emulator signals from client
        if event.get('is_emulator'):
            add_fraud_signal('emulator', 'critical')

        # 3. Calculate combined score
        fraud_score = self.calculate_fraud_score(signals)
        quality_score = self.calculate_quality_score(motion, fraud_score)

        # 4. Calculate payout
        payout = base_rate * quality_mult * fraud_penalty
```

## Configuration Reference

```typescript
interface AdaptiveWindowConfig {
  // Base collection settings
  baseSampleRate: number; // 50 Hz default
  baseWindowDuration: number; // 5000 ms default

  // Activity thresholds (m/s² deviation from gravity)
  stationaryThreshold: number; // 0.3 default
  walkingThreshold: number; // 2.0 default
  runningThreshold: number; // 5.0 default

  // Quality gates
  minSamplesForAnalysis: number; // 100 default
  stabilityRequirement: number; // 0.5 variance threshold
}
```

## Summary

The adaptive collection system solves the "how much data" problem by:

1. **Detecting activity** in real-time from accelerometer data
2. **Adjusting sample rate** based on activity needs
3. **Using quality gates** instead of fixed time windows
4. **Cross-validating** multiple sensor signals
5. **Producing fraud scores** based on combined signals

This means:

- 🛋️ **Resting user**: Lower sample rate, longer window, checks for "too perfect" data
- 🚶 **Walking user**: Normal rate, shorter window, validates stepping pattern
- 🚗 **Vehicle user**: Higher rate, detects vibration vs walking pattern
- 🤖 **Bot/Emulator**: Caught by multiple signals (static sensors, no jitter, emulator fingerprints)
