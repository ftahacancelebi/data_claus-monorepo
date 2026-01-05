import React, { useState, useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { api } from '../../services/api';

interface BannerAdProps {
  unitId?: string;
  size?: BannerAdSize;
}

const adUnitId = __DEV__ ? TestIds.BANNER : 'ca-app-pub-xxxxxxxxxxxxx/yyyyyyyyyy'; // Replace with real ID in production

export function DataClausBannerAd({ 
  unitId = adUnitId, 
  size = BannerAdSize.ANCHORED_ADAPTIVE_BANNER 
}: BannerAdProps) {
  const [loaded, setLoaded] = useState(false);
  const impressionRecorded = useRef(false);

  // In a real app, you would verify the impression with the callback
  // For now, we record it when the ad loads successfully
  const handleAdLoaded = () => {
    setLoaded(true);
    if (!impressionRecorded.current) {
      impressionRecorded.current = true;
      // Record impression with DataClaus to earn revenue
      api.recordAdImpression('banner').catch(err => {
        console.log('[Ad] Failed to record impression:', err);
      });
    }
  };

  const handleError = (err: Error) => {
    console.log('[Ad] Failed to load banner:', err);
    setLoaded(false);
  };

  return (
    <View style={[styles.container, !loaded && styles.hidden]}>
      <BannerAd
        unitId={unitId}
        size={size}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdLoaded={handleAdLoaded}
        onAdFailedToLoad={handleError}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 10,
  },
  hidden: {
    height: 0,
    opacity: 0,
    paddingVertical: 0, 
  },
});
