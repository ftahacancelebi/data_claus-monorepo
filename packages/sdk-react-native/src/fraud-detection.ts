/**
 * DataClaus Fraud Detection Module
 * =================================
 *
 * Optimized collection system with adaptive windowing for fraud detection.
 *
 * Metrics collected:
 * - Accelerometer patterns (motion analysis)
 * - Emulator/Device detection
 * - Scroll event throttle analysis
 * - Battery state monitoring
 * - Pedometer data (activity verification)
 *
 * The system uses ACTIVITY-AWARE ADAPTIVE COLLECTION to handle:
 * - Low motion (resting/sleeping)
 * - High motion (walking/running/driving)
 * - Normal usage patterns
 */

import { Platform, NativeModules, Dimensions } from 'react-native';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface FraudMetrics {
  // Device authenticity
  isEmulator: boolean;
  emulatorSignals: EmulatorSignal[];
  deviceConfidence: number;

  // Motion patterns
  motionPatterns: MotionPattern;
  activityState: ActivityState;

  // Interaction patterns
  scrollThrottle: ScrollThrottleMetrics;
  touchPatterns: TouchPatternMetrics;

  // System state
  battery: BatteryMetrics;

  // Pedometer (if available)
  pedometer: PedometerMetrics | null;

  // Overall fraud signals
  fraudScore: number; // 0.0 (legit) to 1.0 (fraud)
  fraudSignals: FraudSignal[];
}

export interface EmulatorSignal {
  type: 'build' | 'sensor' | 'network' | 'system';
  signal: string;
  confidence: number;
}

export type ActivityState =
  | 'stationary' // No movement (lying down, sitting)
  | 'micro_motion' // Slight movements (holding phone)
  | 'walking' // Normal walking
  | 'running' // Intense activity
  | 'vehicle' // In a moving vehicle
  | 'unknown';

export interface MotionPattern {
  avgMagnitude: number;
  variance: number;
  jitter: number;
  peakFrequency: number;
  isHumanLike: boolean;
  samples: number;
}

export interface ScrollThrottleMetrics {
  avgInterval: number; // ms between scroll events
  minInterval: number; // fastest scroll interval
  maxInterval: number; // slowest scroll interval
  variance: number;
  scrollVelocity: number; // pixels per second
  suspiciousPatterns: string[];
}

export interface TouchPatternMetrics {
  avgTouchDuration: number;
  touchPressureVariance: number;
  touchPointVariance: number;
  multiTouchRatio: number;
}

export interface BatteryMetrics {
  level: number;
  isCharging: boolean;
  levelChangeRate: number; // % per minute
  isSimulated: boolean; // Detects fake battery APIs
}

export interface PedometerMetrics {
  stepsInWindow: number;
  cadence: number; // steps per minute
  isAvailable: boolean;
  matchesAccelerometer: boolean;
}

export interface FraudSignal {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  score: number;
}

export interface AdaptiveWindowConfig {
  // Base settings
  baseSampleRate: number; // Hz (default: 50)
  baseWindowDuration: number; // ms (default: 5000)

  // Adaptive thresholds
  stationaryThreshold: number; // Below this = stationary
  walkingThreshold: number; // Above this = walking
  runningThreshold: number; // Above this = running/vehicle

  // Minimum samples before analysis
  minSamplesForAnalysis: number; // default: 100

  // Quality gates
  stabilityRequirement: number; // variance threshold to consider stable
}

// ============================================
// DEFAULT CONFIGURATION
// ============================================

export const DEFAULT_CONFIG: AdaptiveWindowConfig = {
  baseSampleRate: 50, // 50 Hz
  baseWindowDuration: 5000, // 5 seconds
  stationaryThreshold: 0.3, // m/s² deviation from gravity
  walkingThreshold: 2.0, // m/s²
  runningThreshold: 5.0, // m/s²
  minSamplesForAnalysis: 100,
  stabilityRequirement: 0.5,
};

// ============================================
// FRAUD DETECTION COLLECTOR
// ============================================

export class FraudDetectionCollector {
  private config: AdaptiveWindowConfig;

  // Sensor buffers with timestamps
  private accelBuffer: Array<{ x: number; y: number; z: number; ts: number }> =
    [];
  private gyroBuffer: Array<{ x: number; y: number; z: number; ts: number }> =
    [];
  private scrollBuffer: Array<{
    ts: number;
    deltaY: number;
    velocity: number;
  }> = [];
  private touchBuffer: Array<{
    ts: number;
    duration: number;
    pressure: number;
    x: number;
    y: number;
  }> = [];

  // Battery tracking
  private batteryHistory: Array<{
    ts: number;
    level: number;
    charging: boolean;
  }> = [];

  // Pedometer
  private pedometerData: { steps: number; ts: number }[] = [];

  // State
  private currentActivityState: ActivityState = 'unknown';
  private adaptiveSampleRate: number;
  private windowStartTime: number = 0;
  private isCollecting: boolean = false;

  // Emulator detection cache
  private emulatorSignals: EmulatorSignal[] = [];
  private emulatorChecked: boolean = false;

  constructor(config: Partial<AdaptiveWindowConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.adaptiveSampleRate = this.config.baseSampleRate;
  }

  // ============================================
  // EMULATOR DETECTION
  // ============================================

  /**
   * Comprehensive emulator/simulator detection
   * Checks multiple signals to determine device authenticity
   */
  async detectEmulator(): Promise<{
    isEmulator: boolean;
    signals: EmulatorSignal[];
    confidence: number;
  }> {
    if (this.emulatorChecked) {
      return {
        isEmulator: this.emulatorSignals.some((s) => s.confidence > 0.7),
        signals: this.emulatorSignals,
        confidence: this.calculateEmulatorConfidence(),
      };
    }

    const signals: EmulatorSignal[] = [];

    // 1. Platform-specific build checks
    if (Platform.OS === 'android') {
      signals.push(...this.checkAndroidEmulatorSignals());
    } else if (Platform.OS === 'ios') {
      signals.push(...this.checkIOSSimulatorSignals());
    }

    // 2. Sensor availability check (emulators often lack sensors)
    const sensorSignals = await this.checkSensorAvailability();
    signals.push(...sensorSignals);

    // 3. System property checks
    signals.push(...this.checkSystemProperties());

    this.emulatorSignals = signals;
    this.emulatorChecked = true;

    return {
      isEmulator: signals.some((s) => s.confidence > 0.7),
      signals,
      confidence: this.calculateEmulatorConfidence(),
    };
  }

  private checkAndroidEmulatorSignals(): EmulatorSignal[] {
    const signals: EmulatorSignal[] = [];

    // Check for common emulator fingerprints in build properties
    const suspiciousFingerprints = [
      'generic',
      'sdk',
      'google_sdk',
      'emulator',
      'genymotion',
      'vbox',
      'goldfish',
      'ranchu',
      'Andy',
      'Droid4X',
      'nox',
    ];

    // Check brand/manufacturer (accessible via NativeModules or device-info)
    try {
      const constants = Platform.constants as Record<string, unknown>;
      const brand = ((constants?.Brand as string) || '').toLowerCase();
      const model = ((constants?.Model as string) || '').toLowerCase();

      for (const fingerprint of suspiciousFingerprints) {
        if (brand.includes(fingerprint) || model.includes(fingerprint)) {
          signals.push({
            type: 'build',
            signal: `Suspicious fingerprint: ${fingerprint}`,
            confidence: 0.85,
          });
        }
      }
    } catch (e) {
      // Ignore if not available
    }

    return signals;
  }

  private checkIOSSimulatorSignals(): EmulatorSignal[] {
    const signals: EmulatorSignal[] = [];

    // Check for simulator runtime
    if ((Platform as any).isSimulator) {
      signals.push({
        type: 'build',
        signal: 'iOS Simulator detected via Platform.isSimulator',
        confidence: 0.95,
      });
    }

    // Check architecture (x86/x64 on iOS = simulator)
    const isArm = Platform.constants?.reactNativeVersion?.minor !== undefined;
    // This is a heuristic; better checks require native modules

    return signals;
  }

  private async checkSensorAvailability(): Promise<EmulatorSignal[]> {
    const signals: EmulatorSignal[] = [];

    // Emulators often:
    // 1. Have perfect sensor readings (no noise)
    // 2. Have sensors but they return static values
    // 3. Don't have certain sensors at all

    // Check if accelerometer has realistic noise
    if (this.accelBuffer.length >= 10) {
      const variance = this.calculateVariance(this.accelBuffer.map((s) => s.x));
      if (variance < 0.0001) {
        signals.push({
          type: 'sensor',
          signal: 'Accelerometer variance too low (perfect readings)',
          confidence: 0.75,
        });
      }
    }

    return signals;
  }

  private checkSystemProperties(): EmulatorSignal[] {
    const signals: EmulatorSignal[] = [];

    // Screen density check (some emulators have unusual densities)
    const { scale } = Dimensions.get('window');
    if (scale % 1 !== 0 && scale !== 1.5 && scale !== 2.5 && scale !== 3.5) {
      signals.push({
        type: 'system',
        signal: `Unusual screen scale: ${scale}`,
        confidence: 0.4,
      });
    }

    return signals;
  }

  private calculateEmulatorConfidence(): number {
    if (this.emulatorSignals.length === 0) return 0;

    // Weighted average of signal confidences
    const maxConfidence = Math.max(
      ...this.emulatorSignals.map((s) => s.confidence)
    );
    const avgConfidence =
      this.emulatorSignals.reduce((a, s) => a + s.confidence, 0) /
      this.emulatorSignals.length;

    // Use max with a penalty for few signals
    return (
      maxConfidence * (1 - 0.1 * Math.max(0, 3 - this.emulatorSignals.length))
    );
  }

  // ============================================
  // ADAPTIVE SAMPLING
  // ============================================

  /**
   * Start collecting data with adaptive windowing
   */
  start(): void {
    if (this.isCollecting) return;

    this.isCollecting = true;
    this.windowStartTime = Date.now();
    this.clearBuffers();

    console.log('[FraudDetection] Collection started with adaptive windowing');
  }

  /**
   * Stop collection and return final metrics
   */
  async stop(): Promise<FraudMetrics> {
    this.isCollecting = false;
    console.log('[FraudDetection] Collection stopped, analyzing...');

    return this.analyze();
  }

  /**
   * Dynamically adjust sample rate based on detected activity
   */
  private updateAdaptiveSampleRate(): void {
    switch (this.currentActivityState) {
      case 'stationary':
        // Low activity = reduce sampling to save battery
        this.adaptiveSampleRate = this.config.baseSampleRate * 0.5;
        break;
      case 'micro_motion':
        // Normal phone usage
        this.adaptiveSampleRate = this.config.baseSampleRate;
        break;
      case 'walking':
      case 'running':
        // Increase sampling for better activity capture
        this.adaptiveSampleRate = this.config.baseSampleRate * 1.5;
        break;
      case 'vehicle':
        // High vibration, need good sampling
        this.adaptiveSampleRate = this.config.baseSampleRate * 1.2;
        break;
      default:
        this.adaptiveSampleRate = this.config.baseSampleRate;
    }
  }

  /**
   * Detect current activity state from accelerometer data
   */
  private detectActivityState(): void {
    if (this.accelBuffer.length < 20) {
      this.currentActivityState = 'unknown';
      return;
    }

    // Calculate deviation from gravity (9.8 m/s²)
    const recentSamples = this.accelBuffer.slice(-50);
    const deviations = recentSamples.map((s) => {
      const magnitude = Math.sqrt(s.x ** 2 + s.y ** 2 + s.z ** 2);
      return Math.abs(magnitude - 9.81);
    });

    const avgDeviation =
      deviations.reduce((a, b) => a + b, 0) / deviations.length;
    const variance = this.calculateVariance(deviations);

    // Activity classification based on motion patterns
    if (avgDeviation < this.config.stationaryThreshold && variance < 0.1) {
      this.currentActivityState = 'stationary';
    } else if (avgDeviation < this.config.walkingThreshold) {
      this.currentActivityState = 'micro_motion';
    } else if (avgDeviation < this.config.runningThreshold) {
      // Check for stepping pattern (oscillating acceleration)
      const hasSteppingPattern = this.detectSteppingPattern();
      this.currentActivityState = hasSteppingPattern ? 'walking' : 'vehicle';
    } else {
      // Very high activity
      const hasSteppingPattern = this.detectSteppingPattern();
      this.currentActivityState = hasSteppingPattern ? 'running' : 'vehicle';
    }

    this.updateAdaptiveSampleRate();
  }

  /**
   * Detect stepping pattern characteristic of walking/running
   */
  private detectSteppingPattern(): boolean {
    if (this.accelBuffer.length < 30) return false;

    const zValues = this.accelBuffer.slice(-30).map((s) => s.z);
    let crossings = 0;
    const mean = zValues.reduce((a, b) => a + b, 0) / zValues.length;

    for (let i = 1; i < zValues.length; i++) {
      if (
        (zValues[i - 1] < mean && zValues[i] >= mean) ||
        (zValues[i - 1] >= mean && zValues[i] < mean)
      ) {
        crossings++;
      }
    }

    // Walking typically has 2-4 Hz stepping frequency
    // 30 samples at 50Hz = 0.6 seconds
    // Expected crossings: 2-5 for walking
    return crossings >= 2 && crossings <= 10;
  }

  // ============================================
  // DATA INGESTION
  // ============================================

  /**
   * Track accelerometer reading
   */
  trackAccelerometer(data: { x: number; y: number; z: number }): void {
    if (!this.isCollecting) return;

    this.accelBuffer.push({ ...data, ts: Date.now() });

    // Keep buffer manageable (5000 samples max = ~100 seconds at 50Hz)
    if (this.accelBuffer.length > 5000) {
      this.accelBuffer = this.accelBuffer.slice(-5000);
    }

    // Update activity state periodically
    if (this.accelBuffer.length % 20 === 0) {
      this.detectActivityState();
    }
  }

  /**
   * Track gyroscope reading
   */
  trackGyroscope(data: { x: number; y: number; z: number }): void {
    if (!this.isCollecting) return;

    this.gyroBuffer.push({ ...data, ts: Date.now() });

    if (this.gyroBuffer.length > 5000) {
      this.gyroBuffer = this.gyroBuffer.slice(-5000);
    }
  }

  /**
   * Track scroll event
   */
  trackScroll(deltaY: number, velocity: number): void {
    if (!this.isCollecting) return;

    this.scrollBuffer.push({
      ts: Date.now(),
      deltaY,
      velocity,
    });

    if (this.scrollBuffer.length > 1000) {
      this.scrollBuffer = this.scrollBuffer.slice(-1000);
    }
  }

  /**
   * Track touch event
   */
  trackTouch(duration: number, pressure: number, x: number, y: number): void {
    if (!this.isCollecting) return;

    this.touchBuffer.push({ ts: Date.now(), duration, pressure, x, y });

    if (this.touchBuffer.length > 1000) {
      this.touchBuffer = this.touchBuffer.slice(-1000);
    }
  }

  /**
   * Track battery state
   */
  trackBattery(level: number, isCharging: boolean): void {
    if (!this.isCollecting) return;

    this.batteryHistory.push({ ts: Date.now(), level, charging: isCharging });

    if (this.batteryHistory.length > 100) {
      this.batteryHistory = this.batteryHistory.slice(-100);
    }
  }

  /**
   * Track pedometer data
   */
  trackPedometer(steps: number): void {
    if (!this.isCollecting) return;

    this.pedometerData.push({ ts: Date.now(), steps });

    if (this.pedometerData.length > 100) {
      this.pedometerData = this.pedometerData.slice(-100);
    }
  }

  // ============================================
  // ANALYSIS ENGINE
  // ============================================

  /**
   * Analyze collected data and compute fraud metrics
   */
  async analyze(): Promise<FraudMetrics> {
    const emulatorInfo = await this.detectEmulator();
    const motionPatterns = this.analyzeMotionPatterns();
    const scrollMetrics = this.analyzeScrollThrottle();
    const touchMetrics = this.analyzeTouchPatterns();
    const batteryMetrics = this.analyzeBattery();
    const pedometerMetrics = this.analyzePedometer();

    const fraudSignals = this.calculateFraudSignals(
      emulatorInfo,
      motionPatterns,
      scrollMetrics,
      touchMetrics,
      batteryMetrics,
      pedometerMetrics
    );

    const fraudScore = this.calculateFraudScore(fraudSignals);

    return {
      isEmulator: emulatorInfo.isEmulator,
      emulatorSignals: emulatorInfo.signals,
      deviceConfidence: 1 - emulatorInfo.confidence,
      motionPatterns,
      activityState: this.currentActivityState,
      scrollThrottle: scrollMetrics,
      touchPatterns: touchMetrics,
      battery: batteryMetrics,
      pedometer: pedometerMetrics,
      fraudScore,
      fraudSignals,
    };
  }

  private analyzeMotionPatterns(): MotionPattern {
    if (this.accelBuffer.length < 10) {
      return {
        avgMagnitude: 0,
        variance: 0,
        jitter: 0,
        peakFrequency: 0,
        isHumanLike: false,
        samples: 0,
      };
    }

    const magnitudes = this.accelBuffer.map((s) =>
      Math.sqrt(s.x ** 2 + s.y ** 2 + s.z ** 2)
    );

    const avgMagnitude =
      magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
    const variance = this.calculateVariance(magnitudes);

    // Jitter: high-frequency noise (difference between consecutive samples)
    let jitterSum = 0;
    for (let i = 1; i < magnitudes.length; i++) {
      jitterSum += Math.abs(magnitudes[i] - magnitudes[i - 1]);
    }
    const jitter = jitterSum / (magnitudes.length - 1);

    // Simple peak frequency estimation via zero-crossings
    const centered = magnitudes.map((m) => m - avgMagnitude);
    let crossings = 0;
    for (let i = 1; i < centered.length; i++) {
      if (centered[i - 1] * centered[i] < 0) crossings++;
    }

    // Duration in seconds
    const duration =
      (this.accelBuffer[this.accelBuffer.length - 1].ts -
        this.accelBuffer[0].ts) /
      1000;
    const peakFrequency = duration > 0 ? crossings / (2 * duration) : 0;

    // Human-like motion criteria:
    // 1. Magnitude near gravity (9.81) with some variance
    // 2. Reasonable jitter (not too perfect, not too noisy)
    // 3. Variance within expected range
    const isHumanLike =
      avgMagnitude > 8.0 &&
      avgMagnitude < 12.0 &&
      variance > 0.01 &&
      variance < 50 &&
      jitter > 0.001 &&
      jitter < 5;

    return {
      avgMagnitude,
      variance,
      jitter,
      peakFrequency,
      isHumanLike,
      samples: this.accelBuffer.length,
    };
  }

  private analyzeScrollThrottle(): ScrollThrottleMetrics {
    if (this.scrollBuffer.length < 2) {
      return {
        avgInterval: 0,
        minInterval: 0,
        maxInterval: 0,
        variance: 0,
        scrollVelocity: 0,
        suspiciousPatterns: [],
      };
    }

    const intervals: number[] = [];
    const velocities: number[] = [];

    for (let i = 1; i < this.scrollBuffer.length; i++) {
      intervals.push(this.scrollBuffer[i].ts - this.scrollBuffer[i - 1].ts);
      velocities.push(Math.abs(this.scrollBuffer[i].velocity));
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const minInterval = Math.min(...intervals);
    const maxInterval = Math.max(...intervals);
    const variance = this.calculateVariance(intervals);
    const scrollVelocity =
      velocities.reduce((a, b) => a + b, 0) / velocities.length;

    const suspiciousPatterns: string[] = [];

    // Check for bot-like patterns
    if (variance < 1) {
      suspiciousPatterns.push('perfectly_uniform_intervals');
    }
    if (minInterval < 5) {
      suspiciousPatterns.push('superhuman_scroll_speed');
    }
    if (avgInterval > 0 && maxInterval / avgInterval > 10) {
      suspiciousPatterns.push('erratic_scroll_pattern');
    }

    return {
      avgInterval,
      minInterval,
      maxInterval,
      variance,
      scrollVelocity,
      suspiciousPatterns,
    };
  }

  private analyzeTouchPatterns(): TouchPatternMetrics {
    if (this.touchBuffer.length < 2) {
      return {
        avgTouchDuration: 0,
        touchPressureVariance: 0,
        touchPointVariance: 0,
        multiTouchRatio: 0,
      };
    }

    const durations = this.touchBuffer.map((t) => t.duration);
    const pressures = this.touchBuffer.map((t) => t.pressure);
    const xPositions = this.touchBuffer.map((t) => t.x);
    const yPositions = this.touchBuffer.map((t) => t.y);

    return {
      avgTouchDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      touchPressureVariance: this.calculateVariance(pressures),
      touchPointVariance:
        this.calculateVariance(xPositions) + this.calculateVariance(yPositions),
      multiTouchRatio: 0, // Would need more data to calculate
    };
  }

  private analyzeBattery(): BatteryMetrics {
    if (this.batteryHistory.length < 2) {
      return {
        level: 0,
        isCharging: false,
        levelChangeRate: 0,
        isSimulated: false,
      };
    }

    const latest = this.batteryHistory[this.batteryHistory.length - 1];
    const oldest = this.batteryHistory[0];
    const durationMinutes = (latest.ts - oldest.ts) / 60000;

    const levelChange = latest.level - oldest.level;
    const levelChangeRate =
      durationMinutes > 0 ? levelChange / durationMinutes : 0;

    // Suspicious battery patterns:
    // 1. Level never changes
    // 2. Level changes too rapidly (without charging)
    // 3. Level is always exactly 100%
    const levels = this.batteryHistory.map((h) => h.level);
    const allSame = levels.every((l) => l === levels[0]);
    const rapidChange = !latest.charging && Math.abs(levelChangeRate) > 5; // More than 5%/min without charging
    const always100 = levels.every((l) => l >= 99);

    const isSimulated = allSame || rapidChange || always100;

    return {
      level: latest.level,
      isCharging: latest.charging,
      levelChangeRate,
      isSimulated,
    };
  }

  private analyzePedometer(): PedometerMetrics | null {
    if (this.pedometerData.length < 2) {
      return null;
    }

    const latest = this.pedometerData[this.pedometerData.length - 1];
    const oldest = this.pedometerData[0];

    const stepsInWindow = latest.steps - oldest.steps;
    const durationMinutes = (latest.ts - oldest.ts) / 60000;
    const cadence = durationMinutes > 0 ? stepsInWindow / durationMinutes : 0;

    // Cross-validate with accelerometer
    const matchesAccelerometer = this.crossValidatePedometer(stepsInWindow);

    return {
      stepsInWindow,
      cadence,
      isAvailable: true,
      matchesAccelerometer,
    };
  }

  private crossValidatePedometer(reportedSteps: number): boolean {
    if (this.accelBuffer.length < 50 || reportedSteps === 0) return true;

    // Estimate steps from accelerometer zero-crossings
    const zValues = this.accelBuffer.map((s) => s.z);
    const mean = zValues.reduce((a, b) => a + b, 0) / zValues.length;

    let crossings = 0;
    for (let i = 1; i < zValues.length; i++) {
      if (zValues[i - 1] < mean && zValues[i] >= mean) {
        crossings++;
      }
    }

    // Each step typically has one positive zero-crossing
    const estimatedSteps = Math.floor(crossings * 0.5);
    const ratio = estimatedSteps > 0 ? reportedSteps / estimatedSteps : 1;

    // Allow 50% variance
    return ratio > 0.5 && ratio < 2.0;
  }

  private calculateFraudSignals(
    emulator: { isEmulator: boolean; confidence: number },
    motion: MotionPattern,
    scroll: ScrollThrottleMetrics,
    touch: TouchPatternMetrics,
    battery: BatteryMetrics,
    pedometer: PedometerMetrics | null
  ): FraudSignal[] {
    const signals: FraudSignal[] = [];

    // Emulator signals
    if (emulator.isEmulator) {
      signals.push({
        type: 'emulator_detected',
        severity: 'critical',
        description: 'Device appears to be an emulator/simulator',
        score: 0.9,
      });
    }

    // Motion signals
    if (!motion.isHumanLike && motion.samples > 50) {
      signals.push({
        type: 'unnatural_motion',
        severity: 'high',
        description: 'Motion patterns do not match human behavior',
        score: 0.7,
      });
    }

    if (motion.variance < 0.001 && motion.samples > 50) {
      signals.push({
        type: 'static_accelerometer',
        severity: 'high',
        description: 'Accelerometer shows no variance (possibly simulated)',
        score: 0.8,
      });
    }

    // Scroll signals
    for (const pattern of scroll.suspiciousPatterns) {
      signals.push({
        type: `scroll_${pattern}`,
        severity: pattern === 'superhuman_scroll_speed' ? 'high' : 'medium',
        description: `Suspicious scroll pattern: ${pattern}`,
        score: pattern === 'perfectly_uniform_intervals' ? 0.6 : 0.5,
      });
    }

    // Battery signals
    if (battery.isSimulated) {
      signals.push({
        type: 'simulated_battery',
        severity: 'medium',
        description: 'Battery readings appear simulated',
        score: 0.5,
      });
    }

    // Pedometer signals
    if (pedometer && !pedometer.matchesAccelerometer) {
      signals.push({
        type: 'pedometer_mismatch',
        severity: 'medium',
        description: 'Pedometer data does not match accelerometer patterns',
        score: 0.6,
      });
    }

    return signals;
  }

  private calculateFraudScore(signals: FraudSignal[]): number {
    if (signals.length === 0) return 0;

    // Weighted combination of signals
    let totalScore = 0;
    let totalWeight = 0;

    const severityWeights = {
      low: 0.3,
      medium: 0.5,
      high: 0.8,
      critical: 1.0,
    };

    for (const signal of signals) {
      const weight = severityWeights[signal.severity];
      totalScore += signal.score * weight;
      totalWeight += weight;
    }

    // Normalize and cap at 1.0
    const rawScore = totalWeight > 0 ? totalScore / totalWeight : 0;

    // Apply signal count boost (more signals = higher confidence in fraud)
    const signalBoost = Math.min(signals.length * 0.1, 0.3);

    return Math.min(1.0, rawScore + signalBoost);
  }

  // ============================================
  // UTILITIES
  // ============================================

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  }

  private clearBuffers(): void {
    this.accelBuffer = [];
    this.gyroBuffer = [];
    this.scrollBuffer = [];
    this.touchBuffer = [];
    this.batteryHistory = [];
    this.pedometerData = [];
  }

  // ============================================
  // PUBLIC API
  // ============================================

  /**
   * Get current adaptive sample rate
   */
  getCurrentSampleRate(): number {
    return this.adaptiveSampleRate;
  }

  /**
   * Get recommended collection duration based on activity
   */
  getRecommendedCollectionDuration(): number {
    switch (this.currentActivityState) {
      case 'stationary':
        // Need more time to ensure stability
        return this.config.baseWindowDuration * 1.5;
      case 'walking':
      case 'running':
        // Faster pattern detection possible
        return this.config.baseWindowDuration * 0.8;
      default:
        return this.config.baseWindowDuration;
    }
  }

  /**
   * Check if we have enough data for analysis
   */
  hasEnoughData(): boolean {
    return this.accelBuffer.length >= this.config.minSamplesForAnalysis;
  }

  /**
   * Get collection progress (0-1)
   */
  getCollectionProgress(): number {
    const samples = this.accelBuffer.length;
    const required = this.config.minSamplesForAnalysis;
    return Math.min(1, samples / required);
  }

  /**
   * Get current activity state
   */
  getActivityState(): ActivityState {
    return this.currentActivityState;
  }

  /**
   * Export collected data for debugging
   */
  exportData(): object {
    return {
      accelerometer: this.accelBuffer.length,
      gyroscope: this.gyroBuffer.length,
      scroll: this.scrollBuffer.length,
      touch: this.touchBuffer.length,
      battery: this.batteryHistory.length,
      pedometer: this.pedometerData.length,
      activityState: this.currentActivityState,
      sampleRate: this.adaptiveSampleRate,
      collectionDuration: Date.now() - this.windowStartTime,
    };
  }
}

// Export singleton instance factory
export function createFraudDetector(
  config?: Partial<AdaptiveWindowConfig>
): FraudDetectionCollector {
  return new FraudDetectionCollector(config);
}

export default FraudDetectionCollector;
