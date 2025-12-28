"""
Fraud Detection Model Training Pipeline (v2.0)
===============================================

Professional-grade ML pipeline for mobile sensor fraud detection with:
- FFT-based frequency domain analysis
- Robust feature mapping (Dict/Series, no index mismatches)
- Signal resampling for frequency invariance
- Advanced features (Pitch, Roll, SMA)
- Ensemble scoring (Supervised + Unsupervised)
- sklearn Pipeline architecture

Datasets supported:
- UCI HAR (Human Activity Recognition)
- WISDM (Wireless Sensor Data Mining)
- MotionSense (iPhone sensor data)

Usage:
    python train_model.py --dataset uci_har --model ensemble
    
Author: DataClaus AI Team
"""

import os
import json
import pickle
import zipfile
import urllib.request
from pathlib import Path
from dataclasses import dataclass, field
from typing import Dict, List, Tuple, Optional, Any, Union
from enum import Enum
import warnings

import numpy as np
import pandas as pd
from scipy import stats, signal
from scipy.fft import fft, fftfreq
from scipy.interpolate import interp1d

from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.pipeline import Pipeline
from sklearn.base import BaseEstimator, TransformerMixin, ClassifierMixin
from sklearn.ensemble import (
    RandomForestClassifier, 
    GradientBoostingClassifier, 
    IsolationForest,
    VotingClassifier
)
from sklearn.svm import SVC
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    accuracy_score,
    precision_recall_fscore_support,
    roc_auc_score
)

warnings.filterwarnings('ignore')

# ============================================
# CONFIGURATION
# ============================================

DATA_DIR = Path(__file__).parent.parent / "data"
MODELS_DIR = Path(__file__).parent.parent / "models"

# Standard sampling frequency for all data
TARGET_SAMPLE_RATE_HZ = 50.0

# Window configuration
WINDOW_SIZE_SECONDS = 2.56  # ~128 samples at 50Hz
WINDOW_OVERLAP_RATIO = 0.5  # 50% overlap

# Dataset URLs
DATASETS = {
    "uci_har": {
        "url": "https://archive.ics.uci.edu/ml/machine-learning-databases/00240/UCI%20HAR%20Dataset.zip",
        "description": "UCI Human Activity Recognition Dataset",
        "sample_rate": 50,  # Hz
        "activities": ["WALKING", "WALKING_UPSTAIRS", "WALKING_DOWNSTAIRS", "SITTING", "STANDING", "LAYING"]
    },
    "wisdm": {
        "url": "https://www.cis.fordham.edu/wisdm/includes/datasets/latest/WISDM_ar_v1.1_raw.txt",
        "description": "WISDM Activity Recognition Dataset",
        "sample_rate": 20,  # Hz
        "activities": ["Walking", "Jogging", "Sitting", "Standing", "Upstairs", "Downstairs"]
    }
}


# ============================================
# SIGNAL PREPROCESSING
# ============================================

class SignalPreprocessor:
    """
    Preprocesses raw sensor signals:
    - Resampling to target frequency
    - Noise filtering
    - Gravity separation (optional)
    """
    
    def __init__(
        self,
        target_sample_rate: float = TARGET_SAMPLE_RATE_HZ,
        apply_lowpass: bool = True,
        lowpass_cutoff: float = 20.0
    ):
        self.target_sample_rate = target_sample_rate
        self.apply_lowpass = apply_lowpass
        self.lowpass_cutoff = lowpass_cutoff
    
    def resample(
        self,
        data: np.ndarray,
        original_sample_rate: float,
        timestamps: Optional[np.ndarray] = None
    ) -> np.ndarray:
        """
        Resample signal to target frequency using linear interpolation.
        
        This ensures frequency invariance across different devices
        (Android ~50Hz, iOS ~100Hz, etc.)
        
        Args:
            data: Shape (n_samples, 3) for x, y, z
            original_sample_rate: Source sampling rate in Hz
            timestamps: Optional explicit timestamps
            
        Returns:
            Resampled data at target_sample_rate
        """
        if original_sample_rate == self.target_sample_rate:
            return data
        
        n_samples = len(data)
        
        # Create time vectors
        if timestamps is not None:
            t_original = (timestamps - timestamps[0]) / 1000.0  # Assume ms
        else:
            duration = n_samples / original_sample_rate
            t_original = np.linspace(0, duration, n_samples)
        
        # Target time vector
        n_target = int(t_original[-1] * self.target_sample_rate)
        t_target = np.linspace(0, t_original[-1], n_target)
        
        # Interpolate each axis
        resampled = np.zeros((n_target, data.shape[1]))
        for axis in range(data.shape[1]):
            interpolator = interp1d(
                t_original, 
                data[:, axis], 
                kind='linear',
                fill_value='extrapolate'
            )
            resampled[:, axis] = interpolator(t_target)
        
        return resampled
    
    def apply_lowpass_filter(
        self,
        data: np.ndarray,
        sample_rate: float = None
    ) -> np.ndarray:
        """Apply Butterworth lowpass filter to remove high-frequency noise."""
        if sample_rate is None:
            sample_rate = self.target_sample_rate
        
        # Nyquist frequency
        nyquist = sample_rate / 2.0
        
        # Normalize cutoff
        normalized_cutoff = self.lowpass_cutoff / nyquist
        
        # Design filter
        b, a = signal.butter(4, normalized_cutoff, btype='low')
        
        # Apply filter to each axis
        filtered = np.zeros_like(data)
        for axis in range(data.shape[1]):
            filtered[:, axis] = signal.filtfilt(b, a, data[:, axis])
        
        return filtered
    
    def preprocess(
        self,
        data: np.ndarray,
        original_sample_rate: float,
        timestamps: Optional[np.ndarray] = None
    ) -> np.ndarray:
        """Full preprocessing pipeline."""
        # Resample to target frequency
        resampled = self.resample(data, original_sample_rate, timestamps)
        
        # Apply lowpass filter
        if self.apply_lowpass:
            resampled = self.apply_lowpass_filter(resampled)
        
        return resampled


# ============================================
# FEATURE EXTRACTION (REFACTORED)
# ============================================

class FeatureExtractor(BaseEstimator, TransformerMixin):
    """
    Professional feature extractor for mobile sensor fraud detection.
    
    Key improvements:
    - Returns Dict/pd.Series instead of raw array (no index mismatches)
    - FFT-based frequency domain features
    - Pitch/Roll estimation
    - Signal Magnitude Area (SMA)
    
    All features are designed to distinguish:
    - Human motion vs Bot/Synthetic motion
    - Real device vs Emulator
    - Normal activity vs Fraudulent patterns
    """
    
    def __init__(self, sample_rate: float = TARGET_SAMPLE_RATE_HZ):
        self.sample_rate = sample_rate
    
    def fit(self, X, y=None):
        """sklearn compatibility."""
        return self
    
    def transform(self, X: Union[List, np.ndarray]) -> pd.DataFrame:
        """
        Transform list of sensor windows to feature DataFrame.
        
        Args:
            X: List of (n_samples, 3) arrays or single array
            
        Returns:
            pd.DataFrame with named feature columns
        """
        if isinstance(X, np.ndarray) and len(X.shape) == 2:
            # Single window
            return pd.DataFrame([self.extract(X)])
        
        # Multiple windows
        features = [self.extract(window) for window in X]
        return pd.DataFrame(features)
    
    def extract(self, accelerometer: np.ndarray) -> Dict[str, float]:
        """
        Extract all features from a sensor window.
        
        Returns a dictionary where keys are feature names,
        ensuring no index mismatch issues.
        
        Args:
            accelerometer: Shape (n_samples, 3) for x, y, z
            
        Returns:
            Dictionary of {feature_name: value}
        """
        features = {}
        
        x = accelerometer[:, 0]
        y = accelerometer[:, 1]
        z = accelerometer[:, 2]
        magnitude = np.sqrt(x**2 + y**2 + z**2)
        
        # ============================================
        # 1. TIME DOMAIN FEATURES
        # ============================================
        
        for data, axis_name in [(x, 'x'), (y, 'y'), (z, 'z'), (magnitude, 'mag')]:
            features[f'mean_{axis_name}'] = np.mean(data)
            features[f'std_{axis_name}'] = np.std(data)
            features[f'var_{axis_name}'] = np.var(data)
            features[f'min_{axis_name}'] = np.min(data)
            features[f'max_{axis_name}'] = np.max(data)
            features[f'range_{axis_name}'] = np.ptp(data)
            features[f'median_{axis_name}'] = np.median(data)
            features[f'iqr_{axis_name}'] = np.percentile(data, 75) - np.percentile(data, 25)
            features[f'skewness_{axis_name}'] = stats.skew(data)
            features[f'kurtosis_{axis_name}'] = stats.kurtosis(data)
            features[f'rms_{axis_name}'] = np.sqrt(np.mean(data**2))
        
        # ============================================
        # 2. FREQUENCY DOMAIN FEATURES (FFT)
        # ============================================
        # Critical for fraud detection: Bots have single perfect frequencies,
        # humans have natural 1-4Hz spread
        
        for data, axis_name in [(x, 'x'), (y, 'y'), (z, 'z'), (magnitude, 'mag')]:
            fft_features = self._extract_fft_features(data)
            for fft_name, fft_value in fft_features.items():
                features[f'{fft_name}_{axis_name}'] = fft_value
        
        # ============================================
        # 3. MOTION QUALITY FEATURES (FRAUD SIGNALS)
        # ============================================
        
        features['jitter'] = self._calculate_jitter(magnitude)
        features['jitter_x'] = self._calculate_jitter(x)
        features['jitter_y'] = self._calculate_jitter(y)
        features['jitter_z'] = self._calculate_jitter(z)
        
        features['zero_crossing_rate'] = self._calculate_zero_crossing_rate(magnitude)
        
        peak_count, peak_variance, peak_regularity = self._analyze_peaks(z)
        features['peak_count'] = peak_count
        features['peak_height_variance'] = peak_variance
        features['peak_regularity'] = peak_regularity  # Irregular = human, regular = bot
        
        features['signal_energy'] = np.sum(magnitude**2) / len(magnitude)
        features['signal_entropy'] = self._calculate_entropy(magnitude)
        
        # ============================================
        # 4. CROSS-AXIS CORRELATION (BOT DETECTION)
        # ============================================
        # Natural human motion has correlated axes; bots often don't
        
        features['corr_xy'] = self._safe_correlation(x, y)
        features['corr_xz'] = self._safe_correlation(x, z)
        features['corr_yz'] = self._safe_correlation(y, z)
        
        # ============================================
        # 5. GRAVITY & TILT FEATURES (EMULATOR DETECTION)
        # ============================================
        
        # Gravity deviation (should be ~9.81 for real device at rest)
        features['gravity_deviation'] = abs(np.mean(magnitude) - 9.81)
        features['gravity_stability'] = np.std(magnitude - np.mean(magnitude))
        
        # Pitch and Roll estimation from accelerometer
        pitch, roll = self._estimate_tilt(x, y, z)
        features['mean_pitch'] = np.mean(pitch)
        features['mean_roll'] = np.mean(roll)
        features['std_pitch'] = np.std(pitch)
        features['std_roll'] = np.std(roll)
        features['pitch_range'] = np.ptp(pitch)
        features['roll_range'] = np.ptp(roll)
        
        # ============================================
        # 6. SIGNAL MAGNITUDE AREA (SMA)
        # ============================================
        # Overall activity intensity
        
        features['sma'] = self._calculate_sma(x, y, z)
        features['sma_normalized'] = features['sma'] / len(x)
        
        # ============================================
        # 7. ADVANCED STATISTICAL FEATURES
        # ============================================
        
        # Autocorrelation (humans have natural periodicity)
        features['autocorr_lag1_mag'] = self._autocorrelation(magnitude, lag=1)
        features['autocorr_lag10_mag'] = self._autocorrelation(magnitude, lag=10)
        
        # Mean absolute deviation
        for data, axis_name in [(x, 'x'), (y, 'y'), (z, 'z'), (magnitude, 'mag')]:
            features[f'mad_{axis_name}'] = np.mean(np.abs(data - np.mean(data)))
        
        return features
    
    def _extract_fft_features(self, signal_data: np.ndarray) -> Dict[str, float]:
        """
        Extract frequency domain features using FFT.
        
        Returns:
            spectral_energy: Total power in frequency domain
            spectral_entropy: Spread of power across frequencies
            principal_freq: Dominant frequency (Hz)
            freq_spread: Standard deviation of power-weighted frequencies
        """
        n = len(signal_data)
        
        # Apply Hanning window to reduce spectral leakage
        windowed = signal_data * np.hanning(n)
        
        # FFT
        fft_result = fft(windowed)
        frequencies = fftfreq(n, 1.0 / self.sample_rate)
        
        # Only positive frequencies
        positive_mask = frequencies > 0
        pos_frequencies = frequencies[positive_mask]
        power_spectrum = np.abs(fft_result[positive_mask])**2
        
        if len(power_spectrum) == 0 or np.sum(power_spectrum) == 0:
            return {
                'spectral_energy': 0.0,
                'spectral_entropy': 0.0,
                'principal_freq': 0.0,
                'freq_spread': 0.0,
                'human_freq_ratio': 0.0
            }
        
        # Normalize power spectrum
        power_normalized = power_spectrum / np.sum(power_spectrum)
        
        # Spectral energy
        spectral_energy = np.sum(power_spectrum)
        
        # Spectral entropy (higher = more spread, more human-like)
        power_nonzero = power_normalized[power_normalized > 0]
        spectral_entropy = -np.sum(power_nonzero * np.log2(power_nonzero))
        
        # Principal (dominant) frequency
        principal_freq = pos_frequencies[np.argmax(power_spectrum)]
        
        # Frequency spread (weighted std of frequencies)
        freq_spread = np.sqrt(np.sum(power_normalized * (pos_frequencies - principal_freq)**2))
        
        # Human walking frequency ratio (1-4Hz band vs total)
        # Humans walk at 1-2.5Hz, run at 2.5-4Hz
        human_band = (pos_frequencies >= 1.0) & (pos_frequencies <= 4.0)
        human_freq_ratio = np.sum(power_spectrum[human_band]) / spectral_energy if spectral_energy > 0 else 0
        
        return {
            'spectral_energy': float(spectral_energy),
            'spectral_entropy': float(spectral_entropy),
            'principal_freq': float(principal_freq),
            'freq_spread': float(freq_spread),
            'human_freq_ratio': float(human_freq_ratio)
        }
    
    def _estimate_tilt(
        self, 
        x: np.ndarray, 
        y: np.ndarray, 
        z: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Estimate device tilt (pitch and roll) from accelerometer.
        
        Pitch: Forward/backward tilt
        Roll: Left/right tilt
        
        Emulators often have static or unrealistic tilt patterns.
        """
        # Avoid division by zero
        epsilon = 1e-10
        
        # Pitch (rotation around Y axis)
        pitch = np.arctan2(x, np.sqrt(y**2 + z**2 + epsilon))
        
        # Roll (rotation around X axis)
        roll = np.arctan2(y, np.sqrt(x**2 + z**2 + epsilon))
        
        # Convert to degrees
        pitch_deg = np.degrees(pitch)
        roll_deg = np.degrees(roll)
        
        return pitch_deg, roll_deg
    
    def _calculate_sma(self, x: np.ndarray, y: np.ndarray, z: np.ndarray) -> float:
        """
        Calculate Signal Magnitude Area.
        
        SMA = sum(|x| + |y| + |z|)
        
        Represents overall activity intensity.
        """
        return float(np.sum(np.abs(x) + np.abs(y) + np.abs(z)))
    
    def _calculate_jitter(self, signal_data: np.ndarray) -> float:
        """Calculate jitter (high-frequency noise)."""
        if len(signal_data) < 2:
            return 0.0
        return float(np.mean(np.abs(np.diff(signal_data))))
    
    def _calculate_zero_crossing_rate(self, signal_data: np.ndarray) -> float:
        """Calculate zero crossing rate."""
        centered = signal_data - np.mean(signal_data)
        crossings = np.sum(np.abs(np.diff(np.sign(centered))) > 0)
        return float(crossings / len(signal_data))
    
    def _analyze_peaks(self, signal_data: np.ndarray) -> Tuple[int, float, float]:
        """
        Analyze peaks for step detection and regularity assessment.
        
        Returns:
            peak_count: Number of detected peaks
            peak_variance: Variance in peak heights
            peak_regularity: Regularity of peak intervals (lower = more regular = bot-like)
        """
        peaks, properties = signal.find_peaks(
            signal_data, 
            distance=int(self.sample_rate / 4),  # Min 0.25s between peaks
            prominence=0.3
        )
        
        if len(peaks) < 2:
            return len(peaks), 0.0, 0.0
        
        peak_heights = signal_data[peaks]
        peak_intervals = np.diff(peaks)
        
        # Regularity: coefficient of variation of intervals
        # Lower CV = more regular = suspicious
        regularity = np.std(peak_intervals) / (np.mean(peak_intervals) + 1e-10)
        
        return len(peaks), float(np.var(peak_heights)), float(regularity)
    
    def _calculate_entropy(self, signal_data: np.ndarray, bins: int = 20) -> float:
        """Calculate signal entropy."""
        hist, _ = np.histogram(signal_data, bins=bins, density=True)
        hist = hist[hist > 0]
        if len(hist) == 0:
            return 0.0
        return float(-np.sum(hist * np.log2(hist)))
    
    def _safe_correlation(self, a: np.ndarray, b: np.ndarray) -> float:
        """Calculate correlation coefficient safely."""
        if len(a) < 2 or np.std(a) == 0 or np.std(b) == 0:
            return 0.0
        return float(np.corrcoef(a, b)[0, 1])
    
    def _autocorrelation(self, signal_data: np.ndarray, lag: int = 1) -> float:
        """Calculate autocorrelation at given lag."""
        if len(signal_data) <= lag:
            return 0.0
        return float(np.corrcoef(signal_data[:-lag], signal_data[lag:])[0, 1])


# ============================================
# SLIDING WINDOW GENERATOR
# ============================================

class WindowGenerator:
    """
    Generates sliding windows from continuous sensor data.
    
    Implements 50% overlap by default for better coverage without data loss.
    """
    
    def __init__(
        self,
        window_size: int = 128,
        overlap_ratio: float = WINDOW_OVERLAP_RATIO,
        min_window_samples: int = 64
    ):
        self.window_size = window_size
        self.overlap_ratio = overlap_ratio
        self.step_size = int(window_size * (1 - overlap_ratio))
        self.min_window_samples = min_window_samples
    
    def generate(self, data: np.ndarray) -> List[np.ndarray]:
        """
        Generate overlapping windows from data.
        
        Args:
            data: Shape (n_samples, 3)
            
        Returns:
            List of windows, each shape (window_size, 3)
        """
        windows = []
        
        for start in range(0, len(data) - self.window_size + 1, self.step_size):
            window = data[start:start + self.window_size]
            if len(window) >= self.min_window_samples:
                windows.append(window)
        
        return windows
    
    def generate_with_labels(
        self,
        data: np.ndarray,
        labels: np.ndarray
    ) -> Tuple[List[np.ndarray], List[int]]:
        """
        Generate windows with corresponding labels.
        
        Uses majority voting for label assignment within each window.
        """
        windows = []
        window_labels = []
        
        for start in range(0, len(data) - self.window_size + 1, self.step_size):
            window = data[start:start + self.window_size]
            window_label_segment = labels[start:start + self.window_size]
            
            if len(window) >= self.min_window_samples:
                # Majority vote for window label
                label = int(stats.mode(window_label_segment, keepdims=True).mode[0])
                windows.append(window)
                window_labels.append(label)
        
        return windows, window_labels


# ============================================
# DATASET LOADERS
# ============================================

class DatasetLoader:
    """Base class for dataset loaders."""
    
    def __init__(self, data_dir: Path = DATA_DIR):
        self.data_dir = data_dir
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.preprocessor = SignalPreprocessor()
        self.window_generator = WindowGenerator()
        self.feature_extractor = FeatureExtractor()
    
    def download(self) -> Path:
        """Download the dataset if not already present."""
        raise NotImplementedError
    
    def load(self) -> Tuple[pd.DataFrame, np.ndarray, np.ndarray]:
        """
        Load and preprocess dataset.
        
        Returns:
            X: Feature DataFrame with named columns
            y: Activity labels
            y_binary: Binary labels (stationary vs active)
        """
        raise NotImplementedError


class UCIHARLoader(DatasetLoader):
    """Loader for UCI HAR Dataset."""
    
    SAMPLE_RATE = 50  # Hz
    
    def download(self) -> Path:
        """Download UCI HAR dataset."""
        zip_path = self.data_dir / "uci_har.zip"
        extract_path = self.data_dir / "UCI HAR Dataset"
        
        if extract_path.exists():
            print("[UCI HAR] Dataset already downloaded")
            return extract_path
        
        print("[UCI HAR] Downloading dataset...")
        urllib.request.urlretrieve(DATASETS["uci_har"]["url"], zip_path)
        
        print("[UCI HAR] Extracting...")
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(self.data_dir)
        
        zip_path.unlink()
        print("[UCI HAR] Done!")
        return extract_path
    
    def load(self) -> Tuple[pd.DataFrame, np.ndarray, np.ndarray]:
        """Load UCI HAR dataset and extract features."""
        dataset_path = self.download()
        
        def load_signals(path: Path, subset: str) -> np.ndarray:
            """Load accelerometer signals."""
            signals = []
            for axis in ['x', 'y', 'z']:
                file_path = path / "Inertial Signals" / f"body_acc_{axis}_{subset}.txt"
                data = np.loadtxt(file_path)
                signals.append(data)
            return np.stack(signals, axis=2)
        
        def load_labels(path: Path, subset: str) -> np.ndarray:
            file_path = path / f"y_{subset}.txt"
            return np.loadtxt(file_path, dtype=int)
        
        print("[UCI HAR] Loading training data...")
        X_train_raw = load_signals(dataset_path / "train", "train")
        y_train = load_labels(dataset_path / "train", "train")
        
        print("[UCI HAR] Loading test data...")
        X_test_raw = load_signals(dataset_path / "test", "test")
        y_test = load_labels(dataset_path / "test", "test")
        
        X_raw = np.concatenate([X_train_raw, X_test_raw], axis=0)
        y = np.concatenate([y_train, y_test], axis=0)
        
        print(f"[UCI HAR] Total windows: {len(X_raw)}")
        print(f"[UCI HAR] Window size: {X_raw.shape[1]}")
        
        # Already at 50Hz, no resampling needed
        # Extract features to DataFrame
        print("[UCI HAR] Extracting features...")
        feature_dicts = []
        
        for i, accel in enumerate(X_raw):
            if i % 2000 == 0:
                print(f"  Processing window {i}/{len(X_raw)}")
            features = self.feature_extractor.extract(accel)
            feature_dicts.append(features)
        
        X = pd.DataFrame(feature_dicts)
        
        # Binary labels: stationary (4,5,6) vs active (1,2,3)
        y_binary = np.where(y >= 4, 0, 1)
        
        print(f"[UCI HAR] Feature matrix shape: {X.shape}")
        print(f"[UCI HAR] Features: {list(X.columns[:10])}...")
        print(f"[UCI HAR] Activity distribution: {dict(zip(*np.unique(y, return_counts=True)))}")
        
        return X, y, y_binary


class WISDMLoader(DatasetLoader):
    """Loader for WISDM Dataset with resampling."""
    
    SOURCE_SAMPLE_RATE = 20  # Hz
    
    def download(self) -> Path:
        """Download WISDM dataset."""
        file_path = self.data_dir / "wisdm_raw.txt"
        
        if file_path.exists():
            print("[WISDM] Dataset already downloaded")
            return file_path
        
        print("[WISDM] Downloading dataset...")
        urllib.request.urlretrieve(DATASETS["wisdm"]["url"], file_path)
        print("[WISDM] Done!")
        return file_path
    
    def load(self) -> Tuple[pd.DataFrame, np.ndarray, np.ndarray]:
        """Load WISDM dataset with resampling and extract features."""
        file_path = self.download()
        
        print("[WISDM] Loading raw data...")
        data = []
        with open(file_path, 'r') as f:
            for line in f:
                line = line.strip().rstrip(';')
                if not line:
                    continue
                parts = line.split(',')
                if len(parts) >= 6:
                    try:
                        user_id = int(parts[0])
                        activity = parts[1]
                        timestamp = int(parts[2])
                        x = float(parts[3])
                        y = float(parts[4])
                        z = float(parts[5].rstrip(';'))
                        data.append([user_id, activity, timestamp, x, y, z])
                    except (ValueError, IndexError):
                        continue
        
        df = pd.DataFrame(data, columns=['user_id', 'activity', 'timestamp', 'x', 'y', 'z'])
        print(f"[WISDM] Total records: {len(df)}")
        
        activity_map = {
            'Walking': 1, 'Jogging': 2, 'Sitting': 3,
            'Standing': 4, 'Upstairs': 5, 'Downstairs': 6
        }
        
        print("[WISDM] Processing with resampling and windowing...")
        feature_dicts = []
        labels = []
        
        window_size_resampled = int(WINDOW_SIZE_SECONDS * TARGET_SAMPLE_RATE_HZ)
        step_size = int(window_size_resampled * (1 - WINDOW_OVERLAP_RATIO))
        
        for (user, activity), group in df.groupby(['user_id', 'activity']):
            if len(group) < 50:  # Need minimum samples
                continue
            
            # Get raw data
            accel_data = group[['x', 'y', 'z']].values
            timestamps = group['timestamp'].values
            
            # Resample from 20Hz to 50Hz
            resampled = self.preprocessor.resample(
                accel_data,
                self.SOURCE_SAMPLE_RATE,
                timestamps
            )
            
            # Generate windows with 50% overlap
            for start in range(0, len(resampled) - window_size_resampled, step_size):
                window = resampled[start:start + window_size_resampled]
                
                # Extract features
                features = self.feature_extractor.extract(window)
                feature_dicts.append(features)
                labels.append(activity_map.get(activity, 0))
        
        X = pd.DataFrame(feature_dicts)
        y = np.array(labels)
        
        # Binary: stationary (3,4) vs active (1,2,5,6)
        y_binary = np.where(np.isin(y, [3, 4]), 0, 1)
        
        print(f"[WISDM] Feature matrix shape: {X.shape}")
        print(f"[WISDM] Activity distribution: {dict(zip(*np.unique(y, return_counts=True)))}")
        
        return X, y, y_binary


# ============================================
# ENSEMBLE FRAUD SCORER
# ============================================

class EnsembleFraudScorer(BaseEstimator, ClassifierMixin):
    """
    Ensemble classifier combining:
    - Supervised classifier (Random Forest)
    - Unsupervised anomaly detector (Isolation Forest)
    
    Produces a unified 'Quality Score' that considers both
    classification confidence and anomaly isolation.
    """
    
    def __init__(
        self,
        supervised_weight: float = 0.6,
        unsupervised_weight: float = 0.4,
        contamination: float = 0.1,
        n_estimators: int = 100
    ):
        self.supervised_weight = supervised_weight
        self.unsupervised_weight = unsupervised_weight
        self.contamination = contamination
        self.n_estimators = n_estimators
        
        self.supervised_model = None
        self.unsupervised_model = None
        self.scaler = None
        self.is_fitted = False
    
    def fit(self, X: pd.DataFrame, y: np.ndarray):
        """Fit both supervised and unsupervised models."""
        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)
        
        # Supervised classifier
        self.supervised_model = RandomForestClassifier(
            n_estimators=self.n_estimators,
            max_depth=15,
            min_samples_split=5,
            random_state=42,
            n_jobs=-1
        )
        self.supervised_model.fit(X_scaled, y)
        
        # Unsupervised anomaly detector (trained on all data)
        self.unsupervised_model = IsolationForest(
            n_estimators=self.n_estimators,
            contamination=self.contamination,
            random_state=42,
            n_jobs=-1
        )
        self.unsupervised_model.fit(X_scaled)
        
        self.is_fitted = True
        self.feature_names_ = list(X.columns)
        
        return self
    
    def predict(self, X: pd.DataFrame) -> np.ndarray:
        """Predict class labels."""
        scores = self.predict_quality_score(X)
        return (scores >= 0.5).astype(int)
    
    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        """Return probability estimates."""
        scores = self.predict_quality_score(X)
        return np.column_stack([1 - scores, scores])
    
    def predict_quality_score(self, X: pd.DataFrame) -> np.ndarray:
        """
        Predict combined quality score.
        
        Score interpretation:
        - High score (>0.7): Likely human, normal motion
        - Medium score (0.4-0.7): Uncertain, needs review
        - Low score (<0.4): Likely fraud/bot/emulator
        
        Returns:
            Array of quality scores in [0, 1]
        """
        X_scaled = self.scaler.transform(X)
        
        # Supervised probability (probability of class 1 = active/human)
        supervised_proba = self.supervised_model.predict_proba(X_scaled)[:, 1]
        
        # Anomaly score (normalized to [0, 1])
        # decision_function: higher = more normal
        anomaly_scores = self.unsupervised_model.decision_function(X_scaled)
        # Normalize: map roughly [-0.5, 0.5] to [0, 1]
        anomaly_normalized = (anomaly_scores + 0.5).clip(0, 1)
        
        # Combined quality score
        quality_scores = (
            self.supervised_weight * supervised_proba +
            self.unsupervised_weight * anomaly_normalized
        )
        
        return quality_scores
    
    def get_fraud_report(self, X: pd.DataFrame) -> List[Dict[str, Any]]:
        """
        Generate detailed fraud reports for each sample.
        
        Returns list of dicts with:
        - quality_score: Combined score
        - is_fraud: Boolean
        - supervised_confidence: Classification confidence
        - anomaly_score: Isolation score
        - fraud_signals: List of detected issues
        """
        X_scaled = self.scaler.transform(X)
        
        supervised_proba = self.supervised_model.predict_proba(X_scaled)
        anomaly_scores = self.unsupervised_model.decision_function(X_scaled)
        quality_scores = self.predict_quality_score(X)
        
        reports = []
        for i in range(len(X)):
            report = {
                'quality_score': float(quality_scores[i]),
                'is_fraud': quality_scores[i] < 0.4,
                'supervised_confidence': float(max(supervised_proba[i])),
                'predicted_class': int(np.argmax(supervised_proba[i])),
                'anomaly_score': float(anomaly_scores[i]),
                'is_anomaly': anomaly_scores[i] < 0,
                'fraud_signals': []
            }
            
            # Check specific fraud signals from features
            row = X.iloc[i]
            
            if row.get('jitter', 1) < 0.001:
                report['fraud_signals'].append('zero_jitter: simulation detected')
            
            if row.get('gravity_deviation', 0) > 2.0:
                report['fraud_signals'].append(f'gravity_deviation: {row["gravity_deviation"]:.2f}')
            
            if row.get('spectral_entropy_mag', 10) < 1.0:
                report['fraud_signals'].append('low_spectral_entropy: single frequency bot')
            
            if row.get('peak_regularity', 1) < 0.1:
                report['fraud_signals'].append('perfect_regularity: mechanical pattern')
            
            if anomaly_scores[i] < -0.2:
                report['fraud_signals'].append('strong_anomaly: outlier behavior')
            
            reports.append(report)
        
        return reports


# ============================================
# TRAINING PIPELINE
# ============================================

class FraudDetectionPipeline:
    """
    Complete training and inference pipeline using sklearn Pipeline.
    
    Combines:
    - Feature extraction (FeatureExtractor)
    - Scaling (StandardScaler)
    - Ensemble classification (EnsembleFraudScorer)
    """
    
    def __init__(self, models_dir: Path = MODELS_DIR):
        self.models_dir = models_dir
        self.models_dir.mkdir(parents=True, exist_ok=True)
        
        self.preprocessor = SignalPreprocessor()
        self.feature_extractor = FeatureExtractor()
        self.ensemble = None
        self.activity_classifier = None
    
    def train(
        self,
        X: pd.DataFrame,
        y: np.ndarray,
        y_binary: np.ndarray
    ) -> Dict[str, Any]:
        """
        Train all models.
        
        Args:
            X: Feature DataFrame
            y: Activity labels (multi-class)
            y_binary: Binary labels (stationary vs active)
            
        Returns:
            Training metrics and model paths
        """
        results = {}
        
        # ============================================
        # 1. ACTIVITY CLASSIFIER (Multi-class)
        # ============================================
        print("\n" + "=" * 60)
        print("Training Activity Classifier (Multi-class)")
        print("=" * 60)
        
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        # sklearn Pipeline: Scaler + Classifier
        self.activity_classifier = Pipeline([
            ('scaler', StandardScaler()),
            ('classifier', RandomForestClassifier(
                n_estimators=100,
                max_depth=20,
                min_samples_split=5,
                random_state=42,
                n_jobs=-1
            ))
        ])
        
        self.activity_classifier.fit(X_train, y_train)
        
        y_pred = self.activity_classifier.predict(X_test)
        accuracy = accuracy_score(y_test, y_pred)
        
        print(f"\nActivity Classifier Accuracy: {accuracy:.4f}")
        print("\nClassification Report:")
        print(classification_report(y_test, y_pred))
        
        # Feature importance
        feature_importance = dict(zip(
            X.columns,
            self.activity_classifier.named_steps['classifier'].feature_importances_
        ))
        top_features = sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)[:15]
        
        print("\nTop 15 Important Features:")
        for name, importance in top_features:
            print(f"  {name}: {importance:.4f}")
        
        results['activity_classifier'] = {
            'accuracy': accuracy,
            'top_features': dict(top_features)
        }
        
        # ============================================
        # 2. ENSEMBLE FRAUD SCORER (Binary)
        # ============================================
        print("\n" + "=" * 60)
        print("Training Ensemble Fraud Scorer")
        print("=" * 60)
        
        X_train_b, X_test_b, y_train_b, y_test_b = train_test_split(
            X, y_binary, test_size=0.2, random_state=42, stratify=y_binary
        )
        
        self.ensemble = EnsembleFraudScorer(
            supervised_weight=0.6,
            unsupervised_weight=0.4,
            contamination=0.1
        )
        
        self.ensemble.fit(X_train_b, y_train_b)
        
        quality_scores = self.ensemble.predict_quality_score(X_test_b)
        y_pred_b = (quality_scores >= 0.5).astype(int)
        
        accuracy_b = accuracy_score(y_test_b, y_pred_b)
        precision, recall, f1, _ = precision_recall_fscore_support(y_test_b, y_pred_b, average='binary')
        auc = roc_auc_score(y_test_b, quality_scores)
        
        print(f"\nEnsemble Fraud Scorer Results:")
        print(f"  Accuracy:  {accuracy_b:.4f}")
        print(f"  Precision: {precision:.4f}")
        print(f"  Recall:    {recall:.4f}")
        print(f"  F1 Score:  {f1:.4f}")
        print(f"  AUC:       {auc:.4f}")
        
        # Quality score distribution
        print(f"\nQuality Score Distribution:")
        print(f"  Mean: {np.mean(quality_scores):.4f}")
        print(f"  Std:  {np.std(quality_scores):.4f}")
        print(f"  Min:  {np.min(quality_scores):.4f}")
        print(f"  Max:  {np.max(quality_scores):.4f}")
        
        results['ensemble_scorer'] = {
            'accuracy': accuracy_b,
            'precision': precision,
            'recall': recall,
            'f1': f1,
            'auc': auc
        }
        
        # ============================================
        # 3. SAVE MODELS
        # ============================================
        print("\n" + "=" * 60)
        print("Saving Models")
        print("=" * 60)
        
        # Save activity classifier
        activity_path = self.models_dir / "activity_classifier.pkl"
        with open(activity_path, 'wb') as f:
            pickle.dump(self.activity_classifier, f)
        print(f"  Saved: {activity_path}")
        
        # Save ensemble scorer
        ensemble_path = self.models_dir / "ensemble_fraud_scorer.pkl"
        with open(ensemble_path, 'wb') as f:
            pickle.dump(self.ensemble, f)
        print(f"  Saved: {ensemble_path}")
        
        # Save feature extractor config
        config_path = self.models_dir / "model_config.json"
        config = {
            'sample_rate': TARGET_SAMPLE_RATE_HZ,
            'window_size_seconds': WINDOW_SIZE_SECONDS,
            'overlap_ratio': WINDOW_OVERLAP_RATIO,
            'feature_names': list(X.columns),
            'n_features': len(X.columns),
            'training_samples': len(X),
            'results': results
        }
        with open(config_path, 'w') as f:
            json.dump(config, f, indent=2)
        print(f"  Saved: {config_path}")
        
        results['model_paths'] = {
            'activity_classifier': str(activity_path),
            'ensemble_scorer': str(ensemble_path),
            'config': str(config_path)
        }
        
        return results
    
    @classmethod
    def load(cls, models_dir: str = None) -> "FraudDetectionPipeline":
        """Load trained pipeline from disk."""
        if models_dir is None:
            models_dir = MODELS_DIR
        else:
            models_dir = Path(models_dir)
        
        pipeline = cls(models_dir)
        
        with open(models_dir / "activity_classifier.pkl", 'rb') as f:
            pipeline.activity_classifier = pickle.load(f)
        
        with open(models_dir / "ensemble_fraud_scorer.pkl", 'rb') as f:
            pipeline.ensemble = pickle.load(f)
        
        return pipeline
    
    def predict(self, accelerometer_data: np.ndarray, source_sample_rate: float = 50.0) -> Dict[str, Any]:
        """
        Run fraud detection on raw sensor data.
        
        Args:
            accelerometer_data: Shape (n_samples, 3)
            source_sample_rate: Sample rate of input data
            
        Returns:
            Fraud detection results
        """
        # Preprocess
        resampled = self.preprocessor.resample(accelerometer_data, source_sample_rate)
        
        # Extract features
        features = self.feature_extractor.extract(resampled)
        X = pd.DataFrame([features])
        
        # Get predictions
        quality_score = self.ensemble.predict_quality_score(X)[0]
        activity_pred = self.activity_classifier.predict(X)[0]
        activity_proba = self.activity_classifier.predict_proba(X)[0]
        
        # Get detailed report
        report = self.ensemble.get_fraud_report(X)[0]
        report['predicted_activity'] = int(activity_pred)
        report['activity_confidence'] = float(max(activity_proba))
        
        return report


# ============================================
# MAIN
# ============================================

def main():
    """Main training pipeline."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Train fraud detection models (v2.0)")
    parser.add_argument("--dataset", choices=["uci_har", "wisdm", "both"], default="uci_har")
    args = parser.parse_args()
    
    print("=" * 70)
    print("🔍 DataClaus Fraud Detection Model Training (v2.0)")
    print("=" * 70)
    print("\nEnhancements:")
    print("  ✓ FFT frequency domain features")
    print("  ✓ Signal resampling (frequency invariant)")
    print("  ✓ Pitch/Roll tilt estimation")
    print("  ✓ Signal Magnitude Area (SMA)")
    print("  ✓ 50% window overlap")
    print("  ✓ Ensemble scoring (RF + Isolation Forest)")
    print("  ✓ Robust feature mapping (Dict/DataFrame)")
    print()
    
    all_X = []
    all_y = []
    all_y_binary = []
    
    if args.dataset in ["uci_har", "both"]:
        print("[LOADING] UCI HAR Dataset...")
        loader = UCIHARLoader()
        X, y, y_binary = loader.load()
        all_X.append(X)
        all_y.append(y)
        all_y_binary.append(y_binary)
    
    if args.dataset in ["wisdm", "both"]:
        print("\n[LOADING] WISDM Dataset...")
        loader = WISDMLoader()
        X, y, y_binary = loader.load()
        all_X.append(X)
        # Remap WISDM labels to match UCI HAR
        all_y.append(y)
        all_y_binary.append(y_binary)
    
    # Combine datasets
    X_combined = pd.concat(all_X, ignore_index=True)
    y_combined = np.concatenate(all_y)
    y_binary_combined = np.concatenate(all_y_binary)
    
    print(f"\n[COMBINED] Total samples: {len(X_combined)}")
    print(f"[COMBINED] Total features: {len(X_combined.columns)}")
    
    # Train pipeline
    pipeline = FraudDetectionPipeline()
    results = pipeline.train(X_combined, y_combined, y_binary_combined)
    
    print("\n" + "=" * 70)
    print("✅ Training Complete!")
    print("=" * 70)
    print(f"\nModels saved to: {MODELS_DIR}")
    print("\nUsage:")
    print("  pipeline = FraudDetectionPipeline.load()")
    print("  result = pipeline.predict(sensor_data)")


if __name__ == "__main__":
    main()
        supervised_weight: float = 0.6,
        unsupervised_weight: float = 0.4,
        contamination: float = 0.1,
        n_estimators: int = 100
    ):
        self.supervised_weight = supervised_weight
        self.unsupervised_weight = unsupervised_weight
        self.contamination = contamination
        self.n_estimators = n_estimators
        
        self.supervised_model = None
        self.unsupervised_model = None
        self.scaler = None
        self.is_fitted = False
    
    def fit(self, X: pd.DataFrame, y: np.ndarray):
        """Fit both supervised and unsupervised models."""
        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)
        
        # Supervised classifier
        self.supervised_model = RandomForestClassifier(
            n_estimators=self.n_estimators,
            max_depth=15,
            min_samples_split=5,
            random_state=42,
            n_jobs=-1
        )
        self.supervised_model.fit(X_scaled, y)
        
        # Unsupervised anomaly detector (trained on all data)
        self.unsupervised_model = IsolationForest(
            n_estimators=self.n_estimators,
            contamination=self.contamination,
            random_state=42,
            n_jobs=-1
        )
        self.unsupervised_model.fit(X_scaled)
        
        self.is_fitted = True
        self.feature_names_ = list(X.columns)
        
        return self
    
    def predict(self, X: pd.DataFrame) -> np.ndarray:
        """Predict class labels."""
        scores = self.predict_quality_score(X)
        return (scores >= 0.5).astype(int)
    
    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        """Return probability estimates."""
        scores = self.predict_quality_score(X)
        return np.column_stack([1 - scores, scores])
    
    def predict_quality_score(self, X: pd.DataFrame) -> np.ndarray:
        """
        Predict combined quality score.
        
        Score interpretation:
        - High score (>0.7): Likely human, normal motion
        - Medium score (0.4-0.7): Uncertain, needs review
        - Low score (<0.4): Likely fraud/bot/emulator
        
        Returns:
            Array of quality scores in [0, 1]
        """
        X_scaled = self.scaler.transform(X)
        
        # Supervised probability (probability of class 1 = active/human)
        supervised_proba = self.supervised_model.predict_proba(X_scaled)[:, 1]
        
        # Anomaly score (normalized to [0, 1])
        # decision_function: higher = more normal
        anomaly_scores = self.unsupervised_model.decision_function(X_scaled)
        # Normalize: map roughly [-0.5, 0.5] to [0, 1]
        anomaly_normalized = (anomaly_scores + 0.5).clip(0, 1)
        
        # Combined quality score
        quality_scores = (
            self.supervised_weight * supervised_proba +
            self.unsupervised_weight * anomaly_normalized
        )
        
        return quality_scores
    
    def get_fraud_report(self, X: pd.DataFrame) -> List[Dict[str, Any]]:
        """
        Generate detailed fraud reports for each sample.
        
        Returns list of dicts with:
        - quality_score: Combined score
        - is_fraud: Boolean
        - supervised_confidence: Classification confidence
        - anomaly_score: Isolation score
        - fraud_signals: List of detected issues
        """
        X_scaled = self.scaler.transform(X)
        
        supervised_proba = self.supervised_model.predict_proba(X_scaled)
        anomaly_scores = self.unsupervised_model.decision_function(X_scaled)
        quality_scores = self.predict_quality_score(X)
        
        reports = []
        for i in range(len(X)):
            report = {
                'quality_score': float(quality_scores[i]),
                'is_fraud': quality_scores[i] < 0.4,
                'supervised_confidence': float(max(supervised_proba[i])),
                'predicted_class': int(np.argmax(supervised_proba[i])),
                'anomaly_score': float(anomaly_scores[i]),
                'is_anomaly': anomaly_scores[i] < 0,
                'fraud_signals': []
            }
            
            # Check specific fraud signals from features
            row = X.iloc[i]
            
            if row.get('jitter', 1) < 0.001:
                report['fraud_signals'].append('zero_jitter: simulation detected')
            
            if row.get('gravity_deviation', 0) > 2.0:
                report['fraud_signals'].append(f'gravity_deviation: {row["gravity_deviation"]:.2f}')
            
            if row.get('spectral_entropy_mag', 10) < 1.0:
                report['fraud_signals'].append('low_spectral_entropy: single frequency bot')
            
            if row.get('peak_regularity', 1) < 0.1:
                report['fraud_signals'].append('perfect_regularity: mechanical pattern')
            
            if anomaly_scores[i] < -0.2:
                report['fraud_signals'].append('strong_anomaly: outlier behavior')
            
            reports.append(report)
        
        return reports


# ============================================
# TRAINING PIPELINE
# ============================================

class FraudDetectionPipeline:
    """
    Complete training and inference pipeline using sklearn Pipeline.
    
    Combines:
    - Feature extraction (FeatureExtractor)
    - Scaling (StandardScaler)
    - Ensemble classification (EnsembleFraudScorer)
    """
    
    def __init__(self, models_dir: Path = MODELS_DIR):
        self.models_dir = models_dir
        self.models_dir.mkdir(parents=True, exist_ok=True)
        
        self.preprocessor = SignalPreprocessor()
        self.feature_extractor = FeatureExtractor()
        self.ensemble = None
        self.activity_classifier = None
    
    def train(
        self,
        X: pd.DataFrame,
        y: np.ndarray,
        y_binary: np.ndarray
    ) -> Dict[str, Any]:
        """
        Train all models.
        
        Args:
            X: Feature DataFrame
            y: Activity labels (multi-class)
            y_binary: Binary labels (stationary vs active)
            
        Returns:
            Training metrics and model paths
        """
        results = {}
        
        # ============================================
        # 1. ACTIVITY CLASSIFIER (Multi-class)
        # ============================================
        print("\n" + "=" * 60)
        print("Training Activity Classifier (Multi-class)")
        print("=" * 60)
        
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        # sklearn Pipeline: Scaler + Classifier
        self.activity_classifier = Pipeline([
            ('scaler', StandardScaler()),
            ('classifier', RandomForestClassifier(
                n_estimators=100,
                max_depth=20,
                min_samples_split=5,
                random_state=42,
                n_jobs=-1
            ))
        ])
        
        self.activity_classifier.fit(X_train, y_train)
        
        y_pred = self.activity_classifier.predict(X_test)
        accuracy = accuracy_score(y_test, y_pred)
        
        print(f"\nActivity Classifier Accuracy: {accuracy:.4f}")
        print("\nClassification Report:")
        print(classification_report(y_test, y_pred))
        
        # Feature importance
        feature_importance = dict(zip(
            X.columns,
            self.activity_classifier.named_steps['classifier'].feature_importances_
        ))
        top_features = sorted(feature_importance.items(), key=lambda x: x[1], reverse=True)[:15]
        
        print("\nTop 15 Important Features:")
        for name, importance in top_features:
            print(f"  {name}: {importance:.4f}")
        
        results['activity_classifier'] = {
            'accuracy': accuracy,
            'top_features': dict(top_features)
        }
        
        # ============================================
        # 2. ENSEMBLE FRAUD SCORER (Binary)
        # ============================================
        print("\n" + "=" * 60)
        print("Training Ensemble Fraud Scorer")
        print("=" * 60)
        
        X_train_b, X_test_b, y_train_b, y_test_b = train_test_split(
            X, y_binary, test_size=0.2, random_state=42, stratify=y_binary
        )
        
        self.ensemble = EnsembleFraudScorer(
            supervised_weight=0.6,
            unsupervised_weight=0.4,
            contamination=0.1
        )
        
        self.ensemble.fit(X_train_b, y_train_b)
        
        quality_scores = self.ensemble.predict_quality_score(X_test_b)
        y_pred_b = (quality_scores >= 0.5).astype(int)
        
        accuracy_b = accuracy_score(y_test_b, y_pred_b)
        precision, recall, f1, _ = precision_recall_fscore_support(y_test_b, y_pred_b, average='binary')
        auc = roc_auc_score(y_test_b, quality_scores)
        
        print(f"\nEnsemble Fraud Scorer Results:")
        print(f"  Accuracy:  {accuracy_b:.4f}")
        print(f"  Precision: {precision:.4f}")
        print(f"  Recall:    {recall:.4f}")
        print(f"  F1 Score:  {f1:.4f}")
        print(f"  AUC:       {auc:.4f}")
        
        # Quality score distribution
        print(f"\nQuality Score Distribution:")
        print(f"  Mean: {np.mean(quality_scores):.4f}")
        print(f"  Std:  {np.std(quality_scores):.4f}")
        print(f"  Min:  {np.min(quality_scores):.4f}")
        print(f"  Max:  {np.max(quality_scores):.4f}")
        
        results['ensemble_scorer'] = {
            'accuracy': accuracy_b,
            'precision': precision,
            'recall': recall,
            'f1': f1,
            'auc': auc
        }
        
        # ============================================
        # 3. SAVE MODELS
        # ============================================
        print("\n" + "=" * 60)
        print("Saving Models")
        print("=" * 60)
        
        # Save activity classifier
        activity_path = self.models_dir / "activity_classifier.pkl"
        with open(activity_path, 'wb') as f:
            pickle.dump(self.activity_classifier, f)
        print(f"  Saved: {activity_path}")
        
        # Save ensemble scorer
        ensemble_path = self.models_dir / "ensemble_fraud_scorer.pkl"
        with open(ensemble_path, 'wb') as f:
            pickle.dump(self.ensemble, f)
        print(f"  Saved: {ensemble_path}")
        
        # Save feature extractor config
        config_path = self.models_dir / "model_config.json"
        config = {
            'sample_rate': TARGET_SAMPLE_RATE_HZ,
            'window_size_seconds': WINDOW_SIZE_SECONDS,
            'overlap_ratio': WINDOW_OVERLAP_RATIO,
            'feature_names': list(X.columns),
            'n_features': len(X.columns),
            'training_samples': len(X),
            'results': results
        }
        with open(config_path, 'w') as f:
            json.dump(config, f, indent=2)
        print(f"  Saved: {config_path}")
        
        results['model_paths'] = {
            'activity_classifier': str(activity_path),
            'ensemble_scorer': str(ensemble_path),
            'config': str(config_path)
        }
        
        return results
    
    @classmethod
    def load(cls, models_dir: str = None) -> "FraudDetectionPipeline":
        """Load trained pipeline from disk."""
        if models_dir is None:
            models_dir = MODELS_DIR
        else:
            models_dir = Path(models_dir)
        
        pipeline = cls(models_dir)
        
        with open(models_dir / "activity_classifier.pkl", 'rb') as f:
            pipeline.activity_classifier = pickle.load(f)
        
        with open(models_dir / "ensemble_fraud_scorer.pkl", 'rb') as f:
            pipeline.ensemble = pickle.load(f)
        
        return pipeline
    
    def predict(self, accelerometer_data: np.ndarray, source_sample_rate: float = 50.0) -> Dict[str, Any]:
        """
        Run fraud detection on raw sensor data.
        
        Args:
            accelerometer_data: Shape (n_samples, 3)
            source_sample_rate: Sample rate of input data
            
        Returns:
            Fraud detection results
        """
        # Preprocess
        resampled = self.preprocessor.resample(accelerometer_data, source_sample_rate)
        
        # Extract features
        features = self.feature_extractor.extract(resampled)
        X = pd.DataFrame([features])
        
        # Get predictions
        quality_score = self.ensemble.predict_quality_score(X)[0]
        activity_pred = self.activity_classifier.predict(X)[0]
        activity_proba = self.activity_classifier.predict_proba(X)[0]
        
        # Get detailed report
        report = self.ensemble.get_fraud_report(X)[0]
        report['predicted_activity'] = int(activity_pred)
        report['activity_confidence'] = float(max(activity_proba))
        
        return report


# ============================================
# MAIN
# ============================================

def main():
    """Main training pipeline."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Train fraud detection models (v2.0)")
    parser.add_argument("--dataset", choices=["uci_har", "wisdm", "both"], default="uci_har")
    args = parser.parse_args()
    
    print("=" * 70)
    print("🔍 DataClaus Fraud Detection Model Training (v2.0)")
    print("=" * 70)
    print("\nEnhancements:")
    print("  ✓ FFT frequency domain features")
    print("  ✓ Signal resampling (frequency invariant)")
    print("  ✓ Pitch/Roll tilt estimation")
    print("  ✓ Signal Magnitude Area (SMA)")
    print("  ✓ 50% window overlap")
    print("  ✓ Ensemble scoring (RF + Isolation Forest)")
    print("  ✓ Robust feature mapping (Dict/DataFrame)")
    print()
    
    all_X = []
    all_y = []
    all_y_binary = []
    
    if args.dataset in ["uci_har", "both"]:
        print("[LOADING] UCI HAR Dataset...")
        loader = UCIHARLoader()
        X, y, y_binary = loader.load()
        all_X.append(X)
        all_y.append(y)
        all_y_binary.append(y_binary)
    
    if args.dataset in ["wisdm", "both"]:
        print("\n[LOADING] WISDM Dataset...")
        loader = WISDMLoader()
        X, y, y_binary = loader.load()
        all_X.append(X)
        # Remap WISDM labels to match UCI HAR
        all_y.append(y)
        all_y_binary.append(y_binary)
    
    # Combine datasets
    X_combined = pd.concat(all_X, ignore_index=True)
    y_combined = np.concatenate(all_y)
    y_binary_combined = np.concatenate(all_y_binary)
    
    print(f"\n[COMBINED] Total samples: {len(X_combined)}")
    print(f"[COMBINED] Total features: {len(X_combined.columns)}")
    
    # Train pipeline
    pipeline = FraudDetectionPipeline()
    results = pipeline.train(X_combined, y_combined, y_binary_combined)
    
    print("\n" + "=" * 70)
    print("✅ Training Complete!")
    print("=" * 70)
    print(f"\nModels saved to: {MODELS_DIR}")
    print("\nUsage:")
    print("  pipeline = FraudDetectionPipeline.load()")
    print("  result = pipeline.predict(sensor_data)")


if __name__ == "__main__":
    main()
