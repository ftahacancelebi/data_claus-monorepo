"""
DataClaus AI Worker - Fraud Detection Engine
=============================================
Enhanced scoring with fraud detection signals:
- Accelerometer motion patterns
- Emulator/Device detection
- Scroll event analysis
- Battery state verification
- Pedometer cross-validation

Pipeline:
  Kafka (ingest.raw_data) -> AI Worker -> PostgreSQL (scored_events)
"""

import os
import json
import time
from datetime import datetime
from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass, asdict

import numpy as np
from scipy import stats
from scipy.signal import find_peaks
from confluent_kafka import Consumer, KafkaError, KafkaException
import psycopg
from dotenv import load_dotenv

load_dotenv()

# Configuration
CONFIG = {
    "KAFKA_BOOTSTRAP_SERVERS": os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9094"),
    "KAFKA_GROUP_ID": os.getenv("KAFKA_GROUP_ID", "ai-worker-group"),
    "KAFKA_TOPIC": os.getenv("KAFKA_TOPIC", "ingest.raw_data"),
    "DB_HOST": os.getenv("POSTGRES_HOST", "localhost"),
    "DB_PORT": os.getenv("POSTGRES_PORT", "5432"),
    "DB_USER": os.getenv("POSTGRES_USER", "postgres"),
    "DB_PASSWORD": os.getenv("POSTGRES_PASSWORD", "postgres"),
    "DB_NAME": os.getenv("POSTGRES_DB", "dataclaus"),
}


# ============================================
# FRAUD DETECTION DATA CLASSES
# ============================================

@dataclass
class MotionAnalysis:
    """Results from accelerometer/gyroscope analysis."""
    avg_magnitude: float
    variance: float
    jitter: float
    peak_frequency: float
    is_human_like: bool
    activity_state: str
    confidence: float


@dataclass
class ScrollAnalysis:
    """Results from scroll event analysis."""
    avg_interval_ms: float
    min_interval_ms: float
    variance: float
    is_suspicious: bool
    suspicious_patterns: List[str]


@dataclass
class BatteryAnalysis:
    """Results from battery state analysis."""
    is_simulated: bool
    change_rate: float
    never_changes: bool
    always_full: bool


@dataclass
class FraudScore:
    """Complete fraud analysis result."""
    quality_score: float      # 0.0 to 1.0 (higher = better quality)
    fraud_score: float        # 0.0 to 1.0 (higher = more fraud signals)
    is_human: bool
    is_emulator: bool
    motion_analysis: MotionAnalysis
    scroll_analysis: Optional[ScrollAnalysis]
    battery_analysis: Optional[BatteryAnalysis]
    fraud_signals: List[Dict[str, Any]]
    payout: float


# ============================================
# MOTION ANALYSIS ENGINE
# ============================================

class MotionAnalyzer:
    """Analyzes accelerometer and gyroscope data for human patterns."""
    
    # Thresholds for activity detection
    STATIONARY_THRESHOLD = 0.3  # m/s² deviation from gravity
    WALKING_THRESHOLD = 2.0
    RUNNING_THRESHOLD = 5.0
    
    # Human motion characteristics
    GRAVITY = 9.81
    HUMAN_MAGNITUDE_MIN = 8.0
    HUMAN_MAGNITUDE_MAX = 12.0
    WALKING_FREQ_MIN = 1.5  # Hz
    WALKING_FREQ_MAX = 2.5  # Hz
    RUNNING_FREQ_MIN = 2.5  # Hz
    RUNNING_FREQ_MAX = 4.0  # Hz
    
    def analyze(self, samples: List[Dict[str, float]], sample_rate: float = 50.0) -> MotionAnalysis:
        """
        Analyze motion samples for human-like patterns.
        
        Args:
            samples: List of {x, y, z} accelerometer readings
            sample_rate: Samples per second (Hz)
        
        Returns:
            MotionAnalysis with fraud detection signals
        """
        if len(samples) < 10:
            return MotionAnalysis(
                avg_magnitude=0,
                variance=0,
                jitter=0,
                peak_frequency=0,
                is_human_like=False,
                activity_state='insufficient_data',
                confidence=0
            )
        
        # Extract components
        x = np.array([s.get('x', 0) for s in samples])
        y = np.array([s.get('y', 0) for s in samples])
        z = np.array([s.get('z', 0) for s in samples])
        
        # Calculate magnitude
        magnitude = np.sqrt(x**2 + y**2 + z**2)
        avg_magnitude = np.mean(magnitude)
        variance = np.var(magnitude)
        
        # Calculate jitter (high-frequency noise)
        jitter = np.mean(np.abs(np.diff(magnitude)))
        
        # Estimate peak frequency using zero-crossings
        centered = magnitude - np.mean(magnitude)
        crossings = np.sum(np.abs(np.diff(np.sign(centered))) > 0)
        duration = len(samples) / sample_rate
        peak_frequency = crossings / (2 * duration) if duration > 0 else 0
        
        # Detect activity state
        deviation_from_gravity = np.abs(magnitude - self.GRAVITY)
        avg_deviation = np.mean(deviation_from_gravity)
        
        if avg_deviation < self.STATIONARY_THRESHOLD and variance < 0.1:
            activity_state = 'stationary'
        elif avg_deviation < self.WALKING_THRESHOLD:
            activity_state = 'micro_motion'
        elif avg_deviation < self.RUNNING_THRESHOLD:
            # Check for stepping pattern
            if self._has_stepping_pattern(z, sample_rate):
                activity_state = 'walking'
            else:
                activity_state = 'vehicle'
        else:
            if self._has_stepping_pattern(z, sample_rate):
                activity_state = 'running'
            else:
                activity_state = 'vehicle'
        
        # Determine if human-like
        is_human_like = self._check_human_patterns(
            avg_magnitude, variance, jitter, peak_frequency, activity_state
        )
        
        # Calculate confidence
        confidence = self._calculate_confidence(len(samples), variance, is_human_like)
        
        return MotionAnalysis(
            avg_magnitude=float(avg_magnitude),
            variance=float(variance),
            jitter=float(jitter),
            peak_frequency=float(peak_frequency),
            is_human_like=is_human_like,
            activity_state=activity_state,
            confidence=confidence
        )
    
    def _has_stepping_pattern(self, z_values: np.ndarray, sample_rate: float) -> bool:
        """Detect stepping pattern characteristic of walking/running."""
        if len(z_values) < 30:
            return False
        
        # Find peaks in z-acceleration (vertical component)
        centered = z_values - np.mean(z_values)
        peaks, _ = find_peaks(centered, distance=int(sample_rate / 4))  # Min 0.25s between steps
        
        if len(peaks) < 2:
            return False
        
        # Calculate step frequency
        step_intervals = np.diff(peaks) / sample_rate
        avg_step_freq = 1 / np.mean(step_intervals) if np.mean(step_intervals) > 0 else 0
        
        # Walking: 1.5-2.5 Hz, Running: 2.5-4 Hz
        return 1.0 <= avg_step_freq <= 4.5
    
    def _check_human_patterns(
        self, 
        avg_magnitude: float, 
        variance: float, 
        jitter: float, 
        peak_frequency: float,
        activity_state: str
    ) -> bool:
        """Check if motion patterns match expected human behavior."""
        # Magnitude should be near gravity with some variance
        magnitude_ok = self.HUMAN_MAGNITUDE_MIN <= avg_magnitude <= self.HUMAN_MAGNITUDE_MAX
        
        # Should have some variance (not perfectly static)
        variance_ok = variance > 0.001
        
        # Should have natural jitter (not too perfect, not too noisy)
        jitter_ok = 0.0001 < jitter < 10.0
        
        # Activity-appropriate frequency
        if activity_state == 'walking':
            freq_ok = self.WALKING_FREQ_MIN <= peak_frequency <= self.WALKING_FREQ_MAX
        elif activity_state == 'running':
            freq_ok = self.RUNNING_FREQ_MIN <= peak_frequency <= self.RUNNING_FREQ_MAX
        else:
            freq_ok = True  # Don't check frequency for other states
        
        return magnitude_ok and variance_ok and jitter_ok and freq_ok
    
    def _calculate_confidence(self, sample_count: int, variance: float, is_human_like: bool) -> float:
        """Calculate confidence in analysis based on data quality."""
        # More samples = higher confidence
        sample_factor = min(1.0, sample_count / 200)
        
        # Reasonable variance = higher confidence
        variance_factor = 1.0 if 0.01 < variance < 50 else 0.5
        
        # Human-like patterns = higher confidence in our assessment
        human_factor = 1.0 if is_human_like else 0.8
        
        return sample_factor * variance_factor * human_factor


# ============================================
# SCROLL ANALYSIS ENGINE
# ============================================

class ScrollAnalyzer:
    """Analyzes scroll event patterns for bot detection."""
    
    # Thresholds
    MIN_HUMAN_INTERVAL_MS = 16  # ~60 FPS, faster is suspicious
    PERFECT_VARIANCE_THRESHOLD = 1.0  # Too low variance = bot
    
    def analyze(self, scroll_events: List[Dict[str, Any]]) -> Optional[ScrollAnalysis]:
        """Analyze scroll event patterns."""
        if len(scroll_events) < 3:
            return None
        
        # Extract timestamps and calculate intervals
        timestamps = [e.get('ts', e.get('timestamp', 0)) for e in scroll_events]
        intervals = np.diff(timestamps)
        
        if len(intervals) == 0:
            return None
        
        avg_interval = np.mean(intervals)
        min_interval = np.min(intervals)
        variance = np.var(intervals)
        
        suspicious_patterns = []
        
        # Check for bot patterns
        if variance < self.PERFECT_VARIANCE_THRESHOLD:
            suspicious_patterns.append('perfectly_uniform_intervals')
        
        if min_interval < self.MIN_HUMAN_INTERVAL_MS:
            suspicious_patterns.append('superhuman_scroll_speed')
        
        # Check for mechanical scroll patterns (exactly equal intervals)
        unique_intervals = len(np.unique(np.round(intervals, 1)))
        if unique_intervals < 3 and len(intervals) > 10:
            suspicious_patterns.append('mechanical_pattern')
        
        return ScrollAnalysis(
            avg_interval_ms=float(avg_interval),
            min_interval_ms=float(min_interval),
            variance=float(variance),
            is_suspicious=len(suspicious_patterns) > 0,
            suspicious_patterns=suspicious_patterns
        )


# ============================================
# BATTERY ANALYSIS ENGINE
# ============================================

class BatteryAnalyzer:
    """Analyzes battery state for simulation detection."""
    
    def analyze(self, battery_history: List[Dict[str, Any]]) -> Optional[BatteryAnalysis]:
        """Analyze battery state patterns."""
        if len(battery_history) < 2:
            return None
        
        levels = [h.get('level', 0) for h in battery_history]
        charging_states = [h.get('charging', False) for h in battery_history]
        timestamps = [h.get('ts', 0) for h in battery_history]
        
        # Check if level never changes
        never_changes = len(set(levels)) == 1
        
        # Check if always at 100%
        always_full = all(l >= 99 for l in levels)
        
        # Calculate change rate
        if len(timestamps) >= 2 and timestamps[-1] > timestamps[0]:
            duration_minutes = (timestamps[-1] - timestamps[0]) / 60000
            level_change = levels[-1] - levels[0]
            change_rate = level_change / duration_minutes if duration_minutes > 0 else 0
        else:
            change_rate = 0
        
        # Suspicious: rapid drain without charging, or never changing
        is_simulated = never_changes or always_full or (not any(charging_states) and abs(change_rate) > 5)
        
        return BatteryAnalysis(
            is_simulated=is_simulated,
            change_rate=float(change_rate),
            never_changes=never_changes,
            always_full=always_full
        )


# ============================================
# FRAUD SCORING ENGINE
# ============================================

class FraudScorer:
    """Combines all signals to produce final fraud/quality scores."""
    
    def __init__(self):
        self.motion_analyzer = MotionAnalyzer()
        self.scroll_analyzer = ScrollAnalyzer()
        self.battery_analyzer = BatteryAnalyzer()
    
    def score(self, event: Dict[str, Any]) -> FraudScore:
        """
        Calculate comprehensive fraud and quality scores.
        
        Args:
            event: Raw event data containing sensor readings and metadata
        
        Returns:
            FraudScore with all analysis results
        """
        fraud_signals = []
        payload = event.get('payload', {})
        
        # ============================================
        # 1. EMULATOR DETECTION
        # ============================================
        is_emulator = False
        emulator_signals = event.get('emulator_signals', [])
        if emulator_signals:
            is_emulator = any(s.get('confidence', 0) > 0.7 for s in emulator_signals)
            if is_emulator:
                fraud_signals.append({
                    'type': 'emulator_detected',
                    'severity': 'critical',
                    'score': 0.9
                })
        
        # Check for emulator in device info
        device_info = event.get('device', {})
        if self._check_device_emulator(device_info):
            is_emulator = True
            fraud_signals.append({
                'type': 'emulator_device_info',
                'severity': 'critical',
                'score': 0.85
            })
        
        # ============================================
        # 2. MOTION ANALYSIS
        # ============================================
        accel_samples = self._extract_accel_samples(payload)
        motion_analysis = self.motion_analyzer.analyze(accel_samples)
        
        if not motion_analysis.is_human_like and motion_analysis.confidence > 0.5:
            fraud_signals.append({
                'type': 'unnatural_motion',
                'severity': 'high',
                'score': 0.7,
                'details': motion_analysis.activity_state
            })
        
        if motion_analysis.variance < 0.001 and len(accel_samples) > 50:
            fraud_signals.append({
                'type': 'static_accelerometer',
                'severity': 'high',
                'score': 0.8,
                'details': 'Near-zero variance indicates simulated data'
            })
        
        # ============================================
        # 3. SCROLL ANALYSIS
        # ============================================
        scroll_events = payload.get('scroll_events', [])
        scroll_analysis = self.scroll_analyzer.analyze(scroll_events) if scroll_events else None
        
        if scroll_analysis and scroll_analysis.is_suspicious:
            for pattern in scroll_analysis.suspicious_patterns:
                severity = 'high' if pattern == 'superhuman_scroll_speed' else 'medium'
                fraud_signals.append({
                    'type': f'scroll_{pattern}',
                    'severity': severity,
                    'score': 0.6
                })
        
        # ============================================
        # 4. BATTERY ANALYSIS
        # ============================================
        battery_history = payload.get('battery_history', [])
        battery_analysis = self.battery_analyzer.analyze(battery_history) if battery_history else None
        
        if battery_analysis and battery_analysis.is_simulated:
            fraud_signals.append({
                'type': 'simulated_battery',
                'severity': 'medium',
                'score': 0.5,
                'details': {
                    'never_changes': battery_analysis.never_changes,
                    'always_full': battery_analysis.always_full
                }
            })
        
        # ============================================
        # 5. PEDOMETER VALIDATION
        # ============================================
        pedometer_data = payload.get('pedometer', {})
        if pedometer_data and motion_analysis.activity_state in ['walking', 'running']:
            if not self._validate_pedometer(pedometer_data, motion_analysis):
                fraud_signals.append({
                    'type': 'pedometer_mismatch',
                    'severity': 'medium',
                    'score': 0.6,
                    'details': 'Pedometer data conflicts with accelerometer patterns'
                })
        
        # ============================================
        # CALCULATE FINAL SCORES
        # ============================================
        fraud_score = self._calculate_fraud_score(fraud_signals)
        quality_score = self._calculate_quality_score(motion_analysis, fraud_score)
        is_human = quality_score > 0.4 and fraud_score < 0.5
        
        # Calculate payout based on quality
        payout = self._calculate_payout(quality_score, fraud_score)
        
        return FraudScore(
            quality_score=round(quality_score, 4),
            fraud_score=round(fraud_score, 4),
            is_human=is_human,
            is_emulator=is_emulator,
            motion_analysis=motion_analysis,
            scroll_analysis=scroll_analysis,
            battery_analysis=battery_analysis,
            fraud_signals=fraud_signals,
            payout=round(payout, 6)
        )
    
    def _check_device_emulator(self, device_info: Dict[str, Any]) -> bool:
        """Check device info for emulator signatures."""
        suspicious = ['emulator', 'simulator', 'sdk', 'genymotion', 'vbox', 'goldfish']
        
        model = str(device_info.get('model', '')).lower()
        brand = str(device_info.get('brand', '')).lower()
        manufacturer = str(device_info.get('manufacturer', '')).lower()
        
        return any(s in model or s in brand or s in manufacturer for s in suspicious)
    
    def _extract_accel_samples(self, payload: Dict[str, Any]) -> List[Dict[str, float]]:
        """Extract accelerometer samples from various payload formats."""
        # Format 1: Direct accelerometer object
        if 'accelerometer' in payload:
            accel = payload['accelerometer']
            if isinstance(accel, dict):
                return [accel]
            elif isinstance(accel, list):
                return accel
        
        # Format 2: Sensor samples array
        if 'sensor_samples' in payload:
            return [s for s in payload['sensor_samples'] if 'x' in s and 'y' in s and 'z' in s]
        
        # Format 3: Raw samples
        if 'samples' in payload:
            return payload['samples']
        
        return []
    
    def _validate_pedometer(self, pedometer: Dict[str, Any], motion: MotionAnalysis) -> bool:
        """Cross-validate pedometer data with motion analysis."""
        steps = pedometer.get('steps', 0)
        cadence = pedometer.get('cadence', 0)
        
        # If claiming walking/running but motion doesn't match
        if steps > 0 and not motion.is_human_like:
            return False
        
        # Check if cadence matches activity
        if motion.activity_state == 'walking':
            # Walking cadence: 90-130 steps/min
            if cadence > 0 and not (70 <= cadence <= 150):
                return False
        elif motion.activity_state == 'running':
            # Running cadence: 150-200 steps/min
            if cadence > 0 and not (130 <= cadence <= 220):
                return False
        
        return True
    
    def _calculate_fraud_score(self, signals: List[Dict[str, Any]]) -> float:
        """Calculate overall fraud score from signals."""
        if not signals:
            return 0.0
        
        severity_weights = {
            'low': 0.3,
            'medium': 0.5,
            'high': 0.8,
            'critical': 1.0
        }
        
        total_score = 0
        total_weight = 0
        
        for signal in signals:
            weight = severity_weights.get(signal.get('severity', 'low'), 0.5)
            total_score += signal.get('score', 0.5) * weight
            total_weight += weight
        
        raw_score = total_score / total_weight if total_weight > 0 else 0
        
        # Apply signal count boost
        signal_boost = min(len(signals) * 0.08, 0.3)
        
        return min(1.0, raw_score + signal_boost)
    
    def _calculate_quality_score(self, motion: MotionAnalysis, fraud_score: float) -> float:
        """Calculate quality score based on data quality and fraud signals."""
        base_score = 0.5
        
        # Human-like motion boosts quality
        if motion.is_human_like:
            base_score += 0.3
        
        # Good confidence boosts quality
        base_score += motion.confidence * 0.2
        
        # Fraud signals reduce quality
        base_score -= fraud_score * 0.5
        
        return max(0.0, min(1.0, base_score))
    
    def _calculate_payout(self, quality_score: float, fraud_score: float) -> float:
        """Calculate payout based on quality and fraud scores."""
        # Base rate: $0.001 per event
        base_rate = 0.001
        
        # Quality multiplier: 0.5x to 1.5x
        quality_mult = 0.5 + quality_score
        
        # Fraud penalty: reduce to 0 if high fraud score
        fraud_penalty = max(0, 1 - fraud_score * 2)
        
        return base_rate * quality_mult * fraud_penalty


# ============================================
# DATABASE OPERATIONS
# ============================================

def get_db_connection():
    """Create a database connection."""
    return psycopg.connect(
        host=CONFIG["DB_HOST"],
        port=CONFIG["DB_PORT"],
        user=CONFIG["DB_USER"],
        password=CONFIG["DB_PASSWORD"],
        dbname=CONFIG["DB_NAME"],
    )


def save_scored_event(conn, event: Dict[str, Any], score: FraudScore) -> None:
    """Save scored event to database with fraud metrics."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO scored_events (
                id, event_id, developer_id, user_id, 
                quality_score, fraud_score, is_human, is_emulator,
                activity_state, motion_confidence,
                jitter, time_variance,
                campaign_id, payout, processed_at,
                fraud_signals
            ) VALUES (
                gen_random_uuid(), %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s,
                %s, %s,
                %s, %s, NOW(),
                %s
            )
            ON CONFLICT (event_id) DO UPDATE SET
                quality_score = EXCLUDED.quality_score,
                fraud_score = EXCLUDED.fraud_score,
                is_human = EXCLUDED.is_human,
                is_emulator = EXCLUDED.is_emulator,
                activity_state = EXCLUDED.activity_state,
                motion_confidence = EXCLUDED.motion_confidence,
                jitter = EXCLUDED.jitter,
                payout = EXCLUDED.payout,
                fraud_signals = EXCLUDED.fraud_signals,
                processed_at = NOW()
            """,
            (
                event.get("event_id"),
                event.get("developer_id"),
                event.get("user_id"),
                score.quality_score,
                score.fraud_score,
                score.is_human,
                score.is_emulator,
                score.motion_analysis.activity_state,
                score.motion_analysis.confidence,
                score.motion_analysis.jitter,
                score.motion_analysis.variance,
                event.get("campaign_id"),
                score.payout,
                json.dumps(score.fraud_signals),
            ),
        )
        conn.commit()


def process_message(msg_value: bytes, conn, scorer: FraudScorer) -> None:
    """Process a single Kafka message with fraud detection."""
    try:
        event = json.loads(msg_value.decode("utf-8"))
        
        event_id = event.get('event_id', 'unknown')
        print(f"\n[AI Worker] Processing event: {event_id}")
        
        # Calculate fraud and quality scores
        score = scorer.score(event)
        
        # Log results
        status = "✅ HUMAN" if score.is_human else "⚠️ SUSPICIOUS"
        emulator = "📱 REAL" if not score.is_emulator else "🤖 EMULATOR"
        
        print(f"[AI Worker] {status} | {emulator}")
        print(f"[AI Worker] Quality: {score.quality_score:.2f} | Fraud: {score.fraud_score:.2f}")
        print(f"[AI Worker] Activity: {score.motion_analysis.activity_state} | Payout: ${score.payout:.6f}")
        
        if score.fraud_signals:
            print(f"[AI Worker] Fraud signals: {[s['type'] for s in score.fraud_signals]}")
        
        # Save to database
        save_scored_event(conn, event, score)
        
    except json.JSONDecodeError as e:
        print(f"[AI Worker] Failed to parse message: {e}")
    except Exception as e:
        print(f"[AI Worker] Error processing message: {e}")
        import traceback
        traceback.print_exc()


# ============================================
# MAIN CONSUMER LOOP
# ============================================

def run_consumer():
    """Main Kafka consumer loop with fraud detection."""
    print("=" * 60)
    print("🔍 DataClaus AI Worker - Fraud Detection Engine")
    print("=" * 60)
    print(f"Kafka: {CONFIG['KAFKA_BOOTSTRAP_SERVERS']}")
    print(f"Topic: {CONFIG['KAFKA_TOPIC']}")
    print(f"Database: {CONFIG['DB_HOST']}:{CONFIG['DB_PORT']}/{CONFIG['DB_NAME']}")
    print("=" * 60)
    print()
    print("Fraud Detection Signals:")
    print("  • Accelerometer motion patterns")
    print("  • Emulator/device detection")
    print("  • Scroll event analysis")
    print("  • Battery state verification")
    print("  • Pedometer cross-validation")
    print()
    print("=" * 60)
    
    # Initialize scorer
    scorer = FraudScorer()
    
    # Create Kafka consumer
    consumer = Consumer({
        "bootstrap.servers": CONFIG["KAFKA_BOOTSTRAP_SERVERS"],
        "group.id": CONFIG["KAFKA_GROUP_ID"],
        "auto.offset.reset": "earliest",
        "enable.auto.commit": True,
    })
    
    consumer.subscribe([CONFIG["KAFKA_TOPIC"]])
    print(f"[AI Worker] Subscribed to topic: {CONFIG['KAFKA_TOPIC']}")
    
    # Database connection
    conn = get_db_connection()
    print("[AI Worker] Connected to database")
    print("[AI Worker] Waiting for messages...\n")
    
    try:
        while True:
            msg = consumer.poll(timeout=1.0)
            
            if msg is None:
                continue
            
            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    continue
                else:
                    raise KafkaException(msg.error())
            
            process_message(msg.value(), conn, scorer)
            
    except KeyboardInterrupt:
        print("\n[AI Worker] Shutting down...")
    finally:
        consumer.close()
        conn.close()
        print("[AI Worker] Goodbye!")


if __name__ == "__main__":
    run_consumer()
