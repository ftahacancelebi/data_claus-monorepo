import os
import json
import logging
import signal
import sys
from dotenv import load_dotenv
from confluent_kafka import Consumer, KafkaError, KafkaException
from ai_worker.fraud_detection import FraudDetector

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

KAFKA_BROKER = os.getenv('KAFKA_BROKER', 'localhost:9092')
KAFKA_TOPIC = os.getenv('KAFKA_TOPIC', 'ingest.raw_data')
KAFKA_GROUP_ID = os.getenv('KAFKA_GROUP_ID', 'ai-worker-group')

# Initialize Fraud Detector
fraud_detector = FraudDetector()

def main():
    logger.info("Starting AI Worker...")
    
    # Kafka Consumer Configuration
    conf = {
        'bootstrap.servers': KAFKA_BROKER,
        'group.id': KAFKA_GROUP_ID,
        'auto.offset.reset': 'earliest'
    }

    consumer = Consumer(conf)
    
    try:
        consumer.subscribe([KAFKA_TOPIC])
        logger.info(f"Subscribed to topic: {KAFKA_TOPIC}")

        while True:
            msg = consumer.poll(timeout=1.0)
            
            if msg is None:
                continue
            
            if msg.error():
                if msg.error().code() == KafkaError._PARTITION_EOF:
                    # End of partition event
                    logger.debug(f"{msg.topic()} [{msg.partition()}] reached end at offset {msg.offset()}")
                elif msg.error():
                    raise KafkaException(msg.error())
            else:
                # Proper message
                process_message(msg)

    except KeyboardInterrupt:
        logger.info("Aborted by user")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
    finally:
        # Close down consumer to commit final offsets.
        consumer.close()
        logger.info("Consumer closed")

def process_message(msg):
    try:
        key = msg.key().decode('utf-8') if msg.key() else None
        value = msg.value().decode('utf-8')
        data = json.loads(value)
        
        event_id = data.get('event_id')
        logger.info(f"Received message: Key={key}, EventID={event_id}")
        
        # Feature Extraction (Dummy for now)
        # In reality, we'd extract relevant features from 'data'
        payload_data = data.get('data', {})
        # Example: use 'amount' and 'duration' if available, else random
        f1 = float(payload_data.get('amount', 0.0))
        f2 = float(payload_data.get('duration', 0.0))
        features = [f1, f2]
        
        # Fraud Detection
        is_fraud = fraud_detector.predict(features)
        score = fraud_detector.get_score(features)
        
        status = "Normal" if is_fraud == 1 else "Fraud"
        logger.info(f"Event {event_id}: Status={status}, Score={score:.4f}")
        
        # TODO: Save to database
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to decode JSON: {e}")
    except Exception as e:
        logger.error(f"Error processing message: {e}")

if __name__ == '__main__':
    main()
