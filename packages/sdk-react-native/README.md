# @dataclaus/sdk-react-native

DataClaus React Native SDK for collecting sensor and behavioral data with advanced fraud detection and reCAPTCHA Enterprise integration.

## Features

- 📊 **Sensor Data Collection** - Accelerometer, gyroscope, touch patterns
- 🔍 **Fraud Detection** - Adaptive collection with real-time fraud analysis
- 🛡️ **reCAPTCHA Enterprise** - Bot detection and user verification
- ⚡ **Adaptive Sampling** - Dynamic sample rates based on activity
- 🔋 **Battery Efficient** - Smart collection that preserves battery

## Installation

```bash
npm install @dataclaus/sdk-react-native

# Required peer dependencies
npx expo install expo-sensors expo-battery
```

## Usage

### Basic Data Collection

```typescript
import { useDataClaus as useDataClausCollector } from '@dataclaus/sdk-react-native';

function App() {
  const { start, stop, isCollecting, events } = useDataClausCollector({
    apiUrl: 'https://your-backend.com',
    userId: 'user123',
  });

  return <Button title={isCollecting ? 'Stop' : 'Start'} onPress={isCollecting ? stop : start} />;
}
```

### Fraud Detection

```typescript
import { useFraudDetection } from '@dataclaus/sdk-react-native';
import { Accelerometer, Gyroscope, Pedometer } from 'expo-sensors';

function FraudScreen() {
  const { state, metrics, start, stop, analyze } = useFraudDetection({ Accelerometer, Gyroscope, Pedometer }, { debug: true, minCollectionTime: 5000 });

  return (
    <View>
      <Text>Activity: {state.activityState}</Text>
      <Text>Samples: {state.samplesCollected}</Text>
      {metrics && <Text>Fraud Score: {metrics.fraudScore}</Text>}
    </View>
  );
}
```

### reCAPTCHA Enterprise

```typescript
import { useRecaptcha } from '@dataclaus/sdk-react-native';

function LoginScreen() {
  const { verifyAction, isReady, isLoading } = useRecaptcha({
    siteKey: 'YOUR_RECAPTCHA_SITE_KEY',
    backendUrl: 'https://your-backend.com',
  });

  const handleLogin = async () => {
    const result = await verifyAction('login');
    if (result.isBot) {
      alert('Bot detected!');
    } else {
      // Proceed with login
    }
  };
}
```

## API Reference

### useDataClausCollector(config)

Main hook for sensor data collection.

### useFraudDetection(sensors, config)

Hook for fraud detection with adaptive sampling.

### useRecaptcha(config)

Hook for reCAPTCHA Enterprise integration.

## License

MIT
