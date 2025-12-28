# Google reCAPTCHA Enterprise Setup Guide

This guide walks you through setting up Google reCAPTCHA Enterprise for the DataClaus SDK.

## Prerequisites

- Google Cloud Platform account
- Access to Google Cloud Console
- React Native project with Expo

---

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Enter a project name (e.g., `dataclaus-recaptcha`)
4. Click **Create**

---

## Step 2: Enable reCAPTCHA Enterprise API

1. Go to **APIs & Services** → **Enable APIs and Services**
2. Search for "reCAPTCHA Enterprise API"
3. Click **Enable**

Or use this direct link:

```
https://console.cloud.google.com/apis/library/recaptchaenterprise.googleapis.com
```

---

## Step 3: Create reCAPTCHA Enterprise Key

### For iOS App:

1. Go to **reCAPTCHA Enterprise** in the Cloud Console
   - Or visit: https://console.cloud.google.com/security/recaptcha
2. Click **Create Key**
3. Fill in:
   - **Display Name**: `DataClaus iOS`
   - **Platform Type**: `iOS app`
   - **iOS bundle ID**: Your app's bundle ID (e.g., `com.dataclaus.demo`)
4. Click **Create**
5. **Copy the Site Key** - you'll need this!

### For Android App:

1. Click **Create Key** again
2. Fill in:
   - **Display Name**: `DataClaus Android`
   - **Platform Type**: `Android app`
   - **Android package name**: Your app's package (e.g., `com.dataclaus.demo`)
   - **SHA-256 certificate fingerprint** (optional but recommended for production)
3. Click **Create**
4. **Copy the Site Key**

---

## Step 4: Set Up Service Account (for Backend)

1. Go to **IAM & Admin** → **Service Accounts**
2. Click **Create Service Account**
3. Fill in:
   - **Name**: `recaptcha-verifier`
   - **Description**: `Service account for reCAPTCHA verification`
4. Click **Create and Continue**
5. Add role: **reCAPTCHA Enterprise Agent**
6. Click **Done**
7. Click on the new service account → **Keys** tab
8. Click **Add Key** → **Create new key** → **JSON**
9. Save the downloaded JSON file securely

---

## Step 5: Configure Your Project

### Environment Variables

Create or update `.env` files:

**Mobile App (.env):**

```bash
# reCAPTCHA Site Key for your platform
RECAPTCHA_SITE_KEY_IOS=your_ios_site_key_here
RECAPTCHA_SITE_KEY_ANDROID=your_android_site_key_here
```

**Backend (.env):**

```bash
# Google Cloud Configuration
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json

# reCAPTCHA Configuration
RECAPTCHA_SITE_KEY=your_site_key_here
RECAPTCHA_SCORE_THRESHOLD=0.5
```

---

## Step 6: Install Dependencies

### Mobile App (React Native):

```bash
cd apps/demo-mobile

# Install Google's official reCAPTCHA React Native package
npx expo install @google-cloud/recaptcha-enterprise-react-native

# For Expo, you may need a development build
npx expo prebuild
```

### Backend (Node.js):

```bash
cd apps/demo-backend

# Install Google Cloud reCAPTCHA Enterprise
npm install @google-cloud/recaptcha-enterprise
```

---

## Step 7: iOS Configuration (Podfile)

Update `ios/Podfile`:

```ruby
# Add at the top of your Podfile
platform :ios, '13.0'

# Before 'target' block, add:
use_frameworks! :linkage => :static

# Disable Flipper (conflicts with static linking)
flipper_config = FlipperConfiguration.disabled

target 'YourAppName' do
  # ... your existing config
end
```

Then run:

```bash
cd ios
pod install
```

---

## Step 8: Usage in Your App

### Basic Usage:

```typescript
import { useRecaptcha } from '@dataclaus/sdk-react-native';
import { Platform } from 'react-native';

// Get the right key for the platform
const RECAPTCHA_SITE_KEY = Platform.OS === 'ios' ? process.env.RECAPTCHA_SITE_KEY_IOS : process.env.RECAPTCHA_SITE_KEY_ANDROID;

function LoginScreen() {
  const { verifyAction, isReady, isLoading, error } = useRecaptcha({
    siteKey: RECAPTCHA_SITE_KEY,
    backendUrl: 'https://your-backend.com',
    scoreThreshold: 0.5,
    debug: __DEV__,
  });

  const handleLogin = async (email: string, password: string) => {
    try {
      // Step 1: Verify with reCAPTCHA
      const result = await verifyAction('login');

      if (result.isBot) {
        Alert.alert('Security Check', 'Please try again later');
        return;
      }

      // Step 2: Proceed with login
      await loginUser(email, password);
    } catch (error) {
      console.error('reCAPTCHA error:', error);
    }
  };

  return (
    <View>
      {isLoading && <ActivityIndicator />}
      {error && <Text>Error: {error.message}</Text>}
      <Button title="Login" onPress={() => handleLogin(email, password)} disabled={!isReady || isLoading} />
    </View>
  );
}
```

---

## Step 9: Backend Verification (Production)

Replace the demo endpoint with real Google Cloud verification:

```javascript
// server.js - Production version

const { RecaptchaEnterpriseServiceClient } = require('@google-cloud/recaptcha-enterprise');

const client = new RecaptchaEnterpriseServiceClient();

app.post('/dataclaus/recaptcha/verify', async (req, res) => {
  try {
    const { token, action } = req.body;

    const projectPath = `projects/${process.env.GOOGLE_CLOUD_PROJECT}`;

    const [assessment] = await client.createAssessment({
      parent: projectPath,
      assessment: {
        event: {
          token,
          siteKey: process.env.RECAPTCHA_SITE_KEY,
          expectedAction: action,
        },
      },
    });

    const score = assessment.riskAnalysis?.score || 0;
    const tokenValid = assessment.tokenProperties?.valid || false;
    const actionValid = assessment.tokenProperties?.action === action;

    res.json({
      score,
      tokenValid,
      actionValid,
      isBot: score < 0.5,
      reasons: assessment.riskAnalysis?.reasons || [],
    });
  } catch (error) {
    console.error('reCAPTCHA verification failed:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});
```

---

## Troubleshooting

### "Module not found" Error

Make sure you've installed the package:

```bash
npx expo install @google-cloud/recaptcha-enterprise-react-native
```

### iOS Build Fails

Ensure Podfile has static linking:

```ruby
use_frameworks! :linkage => :static
```

Then clean and reinstall:

```bash
cd ios
rm -rf Pods Podfile.lock
pod install
```

### "Site key not found" Error

1. Verify the site key matches your platform (iOS vs Android)
2. Ensure the bundle ID matches exactly what's in Cloud Console
3. For Android, check the package name matches

### Score Always Returns 0

1. Token might be expired (2 minute max)
2. Action name might not match between client and server
3. Site key might be incorrect

---

## Testing

### Test Mode

Use these test tokens for development:

- High score (human): Any token with proper format
- Low score (bot): Token containing "test" or "fake"

### Debug Mode

Enable debug logging:

```typescript
useRecaptcha({
  siteKey: 'YOUR_KEY',
  debug: true, // Enable console logs
});
```

---

## Pricing

reCAPTCHA Enterprise pricing:

- **First 10,000 assessments/month**: Free
- **10,001 - 100,000**: $1 per 1,000
- **100,001+**: $0.50 per 1,000

See: https://cloud.google.com/recaptcha-enterprise/pricing

---

## Security Best Practices

1. **Never expose Site Keys in public repositories**
2. **Use platform-specific keys** (separate iOS and Android)
3. **Always verify on backend** (never trust client-only)
4. **Set appropriate score thresholds** (0.5 is a good default)
5. **Annotate assessments** to improve the model over time
6. **Monitor rejected users** for false positives

---

## Quick Checklist

- [ ] Created Google Cloud project
- [ ] Enabled reCAPTCHA Enterprise API
- [ ] Created reCAPTCHA key for iOS
- [ ] Created reCAPTCHA key for Android
- [ ] Created service account for backend
- [ ] Downloaded service account JSON key
- [ ] Installed `@google-cloud/recaptcha-enterprise-react-native`
- [ ] Configured iOS Podfile with static linking
- [ ] Set environment variables
- [ ] Tested in development mode
