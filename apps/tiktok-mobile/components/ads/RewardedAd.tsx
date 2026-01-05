import { RewardedAd, RewardedAdEventType, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import { api } from '../../services/api';

const adUnitId = __DEV__ ? TestIds.REWARDED : 'ca-app-pub-xxxxxxxxxxxxx/yyyyyyyyyy';

let rewarded: RewardedAd | null = null;

export const loadRewarded = () => {
  if (rewarded) return;

  const ad = RewardedAd.createForAdRequest(adUnitId, {
    requestNonPersonalizedAdsOnly: true,
  });

  ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
    rewarded = ad;
  });

  ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, (reward) => {
    // Record impression and reward user
    // The backend should ideally verify this server-side with SSV callbacks from AdMob
    // For now we trust the client (client-side verification)
    api.recordAdImpression('rewarded').catch(console.error);
  });

  ad.addAdEventListener(AdEventType.CLOSED, () => {
    rewarded = null;
    loadRewarded();
  });

  ad.load();
};

export const showRewarded = async (): Promise<boolean> => {
  if (rewarded) {
    rewarded.show();
    // Reset handled in event listener
    return true;
  } else {
    loadRewarded();
    return false;
  }
};
