import { InterstitialAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import { api } from '../../services/api';

const adUnitId = __DEV__ ? TestIds.INTERSTITIAL : 'ca-app-pub-xxxxxxxxxxxxx/yyyyyyyyyy';

// Pre-load an interstitial
let interstitial: InterstitialAd | null = null;

export const loadInterstitial = () => {
  if (interstitial) return;

  const ad = InterstitialAd.createForAdRequest(adUnitId, {
    requestNonPersonalizedAdsOnly: true,
  });

  ad.addAdEventListener(AdEventType.LOADED, () => {
    interstitial = ad;
  });

  ad.addAdEventListener(AdEventType.CLOSED, () => {
    interstitial = null;
    loadInterstitial(); // Load next one
  });

  ad.load();
};

export const showInterstitial = () => {
  if (interstitial) {
    interstitial.show();
    // Record impression
    api.recordAdImpression('interstitial').catch(console.error);
    interstitial = null;
    loadInterstitial(); // Pre-load next
  } else {
    loadInterstitial();
  }
};
