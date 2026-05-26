/**
 * Video Feed Screen
 * 
 * TikTok-style vertical scrolling video feed
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api, Video as VideoType } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { useRouter } from 'expo-router';
import { DataClausBannerAd } from '../../components/ads/BannerAd';
import { showRewarded } from '../../components/ads/RewardedAd';
import { showInterstitial } from '../../components/ads/InterstitialAd';
import { AdPostCard, AdPostCardData } from '../../components/ads/AdPostCard';

const { width, height } = Dimensions.get('window');
const PLAYER_HEIGHT = height - 85; // Subtract tab bar

// commondatastorage.googleapis.com is unreliable from local sims (slow / reset).
// Use a colorful Picsum image (proven reachable in this env) as the safe fallback.
const PLACEHOLDER_THUMBNAIL = 'https://picsum.photos/seed/dataclaus-feed/800/1400';

// Picsum proxy for any item — gives us a reliable "video frame" per item without
// depending on the gtv-videos-bucket.
function frameFor(item: { id: string; creator: { avatar?: string } }): string {
  return `https://picsum.photos/seed/${encodeURIComponent(item.id)}/800/1400`;
}

interface FeedItem extends VideoType {
  type?: 'video' | 'ad';
  adType?: string;
  adData?: AdPostCardData;
}

function formatCount(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function VideoItem({ 
  item, 
  isActive 
}: { 
  item: FeedItem; 
  isActive: boolean;
}) {
  const [isLiked, setIsLiked] = useState(item.isLiked || false);
  const [likesCount, setLikesCount] = useState(item.likesCount || item.likes || 0);
  const [isMuted, setIsMuted] = useState(false);
  // Skip the backend-provided thumbnail (commondatastorage bucket is flaky from
  // simulators); use a per-item Picsum seed so every card has a distinct frame.
  const [posterUri, setPosterUri] = useState<string>(frameFor(item));

  useEffect(() => {
    if (isActive) {
      api.recordView(item.id, 0, false).catch(() => {});
    }
  }, [isActive, item.id]);

  const handleLike = async () => {
    const newIsLiked = !isLiked;
    setIsLiked(newIsLiked);
    setLikesCount(prev => newIsLiked ? prev + 1 : prev - 1);

    try {
      await api.likeVideo(item.id);
    } catch (error) {
      // Revert on error
      setIsLiked(!newIsLiked);
      setLikesCount(prev => newIsLiked ? prev - 1 : prev + 1);
    }
  };

  return (
    <View style={styles.videoContainer}>
      {/* Dark gradient as the last-resort visible layer if even the Image fails. */}
      <LinearGradient
        colors={['#1a1033', '#0b0b1f', '#000']}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      {/* Video Poster (expo-av broken on SDK 54 + new arch; Picsum frame instead) */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={() => setIsMuted(!isMuted)}
        style={styles.videoTouchable}
      >
        <Image
          source={{ uri: posterUri }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
          onError={() => {
            if (posterUri !== PLACEHOLDER_THUMBNAIL) {
              setPosterUri(PLACEHOLDER_THUMBNAIL);
            }
          }}
        />

        {/* Play indicator only when this card isn't the active one */}
        {!isActive && (
          <View style={styles.muteIndicator}>
            <Ionicons name="play" size={24} color="#fff" />
          </View>
        )}

        {isMuted && isActive && (
          <View style={styles.muteIndicator}>
            <Ionicons name="volume-mute" size={24} color="#fff" />
          </View>
        )}
      </TouchableOpacity>

      {/* Gradient Overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)']}
        style={styles.gradient}
        pointerEvents="none"
      />

      {/* Right Actions */}
      <View style={styles.actions}>
        {/* Avatar */}
        <TouchableOpacity style={styles.avatarContainer}>
          <Image source={{ uri: item.creator.avatar }} style={styles.avatar} />
          <View style={styles.followButton}>
            <Ionicons name="add" size={12} color="#fff" />
          </View>
        </TouchableOpacity>

        {/* Like */}
        <TouchableOpacity style={styles.action} onPress={handleLike}>
          <Ionicons 
            name={isLiked ? 'heart' : 'heart-outline'} 
            size={32} 
            color={isLiked ? '#fe2c55' : '#fff'} 
          />
          <Text style={styles.actionText}>{formatCount(likesCount)}</Text>
        </TouchableOpacity>

        {/* Comments */}
        <TouchableOpacity style={styles.action}>
          <Ionicons name="chatbubble-ellipses" size={28} color="#fff" />
          <Text style={styles.actionText}>{formatCount(item.comments)}</Text>
        </TouchableOpacity>

        {/* Share */}
        <TouchableOpacity style={styles.action}>
          <Ionicons name="arrow-redo" size={28} color="#fff" />
          <Text style={styles.actionText}>{formatCount(item.shares)}</Text>
        </TouchableOpacity>

        {/* Music */}
        <View style={styles.musicDisk}>
          <Image source={{ uri: item.creator.avatar }} style={styles.musicImage} />
        </View>
      </View>

      {/* Bottom Info */}
      <View style={styles.info}>
        <View style={styles.creatorRow}>
          <Text style={styles.username}>{item.creator.username}</Text>
          {item.creator.verified && (
            <Ionicons name="checkmark-circle" size={16} color="#25f4ee" />
          )}
        </View>
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>
        <View style={styles.musicRow}>
          <Ionicons name="musical-notes" size={14} color="#fff" />
          <Text style={styles.musicText} numberOfLines={1}>
            {item.music.title} - {item.music.artist}
          </Text>
        </View>
      </View>
    </View>
  );
}

interface AdCreative {
  id: string;
  brandName: string;
  imageUrl: string;
  ctaText: string | null;
}

function AdItem({ adType, isActive }: { adType: string; isActive: boolean }) {
  const [creative, setCreative] = useState<AdCreative | null | undefined>(undefined);

  useEffect(() => {
    api.getActiveAdCreative().then(setCreative).catch(() => setCreative(null));
  }, []);

  useEffect(() => {
    if (!isActive) return;
    api.recordAdImpression('rewarded').catch(() => {});
  }, [isActive, adType]);

  // Loading state — neutral dark while fetching
  if (creative === undefined) {
    return (
      <View style={[styles.adContainer, { backgroundColor: '#111' }]}>
        <View style={styles.adBadge}>
          <Text style={styles.adBadgeText}>Ad</Text>
        </View>
      </View>
    );
  }

  // Real creative uploaded by a buyer
  if (creative) {
    return (
      <View style={styles.adContainer}>
        <Image
          source={{ uri: creative.imageUrl }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
        />
        {/* Dark gradient at bottom for text legibility */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.75)']}
          style={styles.adRealGradient}
          pointerEvents="none"
        />
        <View style={styles.adRealInfo}>
          <Text style={styles.adRealBrand}>{creative.brandName}</Text>
          {creative.ctaText && (
            <TouchableOpacity style={styles.adButton}>
              <Text style={styles.adButtonText}>{creative.ctaText}</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.adBadge}>
          <Text style={styles.adBadgeText}>Sponsored</Text>
        </View>
      </View>
    );
  }

  // Placeholder — no active creative yet
  return (
    <View style={styles.adContainer}>
      <LinearGradient
        colors={['#1a1a2e', '#16213e', '#0f3460']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.adGradient}
      >
        <View style={styles.adContent}>
          <View style={styles.adPlaceholderBadge}>
            <Text style={styles.adPlaceholderBadgeText}>Reklam Alanı</Text>
          </View>
          <Text style={styles.adTitle}>Markanızın Reklamı</Text>
          <Text style={styles.adSubtitle}>
            Bu alana reklamınızı yerleştirin.{'\n'}
            DataClaus portalından yükleyebilirsiniz.
          </Text>
          <View style={styles.adPlaceholderDivider} />
          <Text style={styles.adPlaceholderUrl}>dataclaus.io/advertise</Text>
        </View>
      </LinearGradient>
      <View style={styles.adBadge}>
        <Text style={styles.adBadgeText}>Ad</Text>
      </View>
    </View>
  );
}

export default function FeedScreen() {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const adDataRef = useRef<AdPostCardData | null>(null);
  const { logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.replace('/auth');
  };

  const loadFeed = useCallback(async (pageNum: number = 1) => {
    try {
      const result = await api.getFeed(pageNum);
      const videos: FeedItem[] = result.videos.map(v => ({
        ...v,
        type: ('type' in v && v.type === 'ad' ? 'ad' : 'video') as 'video' | 'ad',
      })) as FeedItem[];

      // Collect tags from all videos for ad targeting
      const allTags = videos.flatMap(v => v.tags ?? []);
      const uniqueTags = [...new Set(allTags)].slice(0, 8);

      // Fetch ad on first load only (when adDataRef is still null)
      let currentAdData = adDataRef.current;
      if (pageNum === 1 && currentAdData === null && uniqueTags.length > 0) {
        try {
          const served = await api.serveFeedAd(uniqueTags);
          if (served) {
            currentAdData = {
              brand_name: served.brand_name,
              headline: served.headline,
              sub_copy: served.sub_copy,
              cta_label: served.cta_label,
              image_url: served.image_url,
              matched_tags: served.matched_tags,
            };
            adDataRef.current = currentAdData;
          }
        } catch {
          // Ad fetch failure is non-fatal
        }
      }

      // Inject ad at position 4 on first page if we have enough videos
      if (pageNum === 1 && currentAdData && videos.length > 4) {
        const adItem: FeedItem = {
          id: `ad-post-${Date.now()}`,
          type: 'ad' as const,
          adType: 'post',
          adData: currentAdData,
          url: '',
          thumbnail: '',
          description: '',
          creator: { id: '', username: '', avatar: '', verified: false },
          likes: 0,
          comments: 0,
          shares: 0,
          views: 0,
          music: { title: '', artist: '' },
          tags: [],
        };
        videos.splice(4, 0, adItem);
      }

      if (pageNum === 1) {
        setFeed(videos);
      } else {
        setFeed(prev => [...prev, ...videos]);
      }
      setHasMore(result.hasMore);
    } catch (error) {
      console.error('Failed to load feed:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: any[] }) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index || 0);
    }
  }, []);

  const loadMore = () => {
    if (!isLoading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadFeed(nextPage);
    }
  };

  const renderItem = ({ item, index }: { item: FeedItem; index: number }) => {
    if (item.type === 'ad') {
      if (item.adData) {
        return <AdPostCard data={item.adData} />;
      }
      return <AdItem adType={item.adType || 'native'} isActive={index === activeIndex} />;
    }
    return <VideoItem item={item} isActive={index === activeIndex} />;
  };

  if (isLoading && feed.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fe2c55" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Following</Text>
        <Text style={[styles.headerText, styles.headerActive]}>For You</Text>
      </View>

      <TouchableOpacity 
        style={styles.logoutButton} 
        onPress={handleLogout}
      >
        <Ionicons name="log-out-outline" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Feed */}
      <FlatList
        data={feed}
        renderItem={renderItem}
        keyExtractor={(item, index) => item.id || `ad-${index}`}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={PLAYER_HEIGHT}
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        getItemLayout={(_, index) => ({
          length: PLAYER_HEIGHT,
          offset: PLAYER_HEIGHT * index,
          index,
        })}
      />

      {/* AdMob Banner */}
      <View style={styles.bannerContainer}>
        <DataClausBannerAd />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    zIndex: 10,
  },
  logoutButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 20,
    padding: 8,
  },
  headerText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 17,
    fontWeight: '600',
  },
  headerActive: {
    color: '#fff',
    fontWeight: '700',
  },
  videoContainer: {
    width,
    height: PLAYER_HEIGHT,
  },
  videoTouchable: {
    flex: 1,
  },
  video: {
    flex: 1,
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  muteIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  actions: {
    position: 'absolute',
    right: 12,
    bottom: 120,
    alignItems: 'center',
    gap: 20,
  },
  avatarContainer: {
    marginBottom: 10,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#fff',
  },
  followButton: {
    position: 'absolute',
    bottom: -8,
    alignSelf: 'center',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fe2c55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  action: {
    alignItems: 'center',
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  musicDisk: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  musicImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  info: {
    position: 'absolute',
    bottom: 100,
    left: 12,
    right: 80,
  },
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  username: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  description: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  musicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  musicText: {
    color: '#fff',
    fontSize: 13,
  },
  adContainer: {
    width,
    height: PLAYER_HEIGHT,
    position: 'relative',
  },
  adGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adContent: {
    alignItems: 'center',
    gap: 16,
  },
  adTitle: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
  },
  adSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    textAlign: 'center',
    maxWidth: 250,
  },
  adButton: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 30,
    marginTop: 8,
  },
  adButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
  adBadge: {
    position: 'absolute',
    top: 60,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
  },
  adBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  adRealGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 220,
  },
  adRealInfo: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    gap: 12,
  },
  adRealBrand: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  adPlaceholderBadge: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 8,
  },
  adPlaceholderBadgeText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  adPlaceholderDivider: {
    height: 1,
    width: 60,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginVertical: 8,
  },
  adPlaceholderUrl: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '500',
  },
  bannerContainer: {
    position: 'absolute',
    bottom: 0, // Flush with top of tab bar (FeedScreen content sits above tab bar)
    alignSelf: 'center',
    zIndex: 100,
  },
});
