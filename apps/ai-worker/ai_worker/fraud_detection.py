import logging
import numpy as np
from sklearn.ensemble import IsolationForest

logger = logging.getLogger(__name__)

class FraudDetector:
    def __init__(self):
        self.model = IsolationForest(n_estimators=100, contamination=0.1, random_state=42)
        self.is_trained = False
        # Dummy data for initial training to avoid errors if predict is called before train
        # In a real system, we'd load a saved model.
        X_train = np.random.rand(100, 2) 
        self.model.fit(X_train)
        self.is_trained = True
        logger.info("FraudDetector initialized with dummy model.")

    def train(self, data):
        """
        Train the model with new data.
        data: list of feature vectors (e.g., [[val1, val2], ...])
        """
        if not data:
            return
        
        X = np.array(data)
        self.model.fit(X)
        self.is_trained = True
        logger.info("FraudDetector retrained.")

    def predict(self, features):
        """
        Predict if a transaction is fraudulent.
        features: list or array of features [val1, val2, ...]
        Returns: 1 for inlier (normal), -1 for outlier (fraud)
        """
        if not self.is_trained:
            logger.warning("Model not trained yet.")
            return 0 # Unknown

        X = np.array([features])
        prediction = self.model.predict(X)
        return prediction[0]

    def get_score(self, features):
        """
        Get anomaly score.
        Lower is more abnormal.
        """
        if not self.is_trained:
            return 0.0
        
        X = np.array([features])
        score = self.model.decision_function(X)
        return score[0]
