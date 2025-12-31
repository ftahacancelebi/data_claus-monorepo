/**
 * Video Feed Screen
 * 
 * TikTok-style vertical scrolling video feed
 */

import { useState, useEffect, useRef, useCallback } from 'react';
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
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { api, Video as VideoType } from '../../services/api';

const { width, height } = Dimensions.get('window');
const PLAYER_HEIGHT = height - 85; // Subtract tab bar

interface FeedItem extends VideoType {
  type?: 'video' | 'ad';
  adType?: string;
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
  const videoRef = useRef<Video>(null);
  const [isLiked, setIsLiked] = useState(item.isLiked || false);
  const [likesCount, setLikesCount] = useState(item.likesCount || item.likes || 0);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isActive) {
      videoRef.current?.playAsync();
      // Record view
      api.recordView(item.id, 0, false).catch(() => {});
    } else {
      videoRef.current?.pauseAsync();
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
      {/* Video Player */}
      <TouchableOpacity 
        activeOpacity={1} 
        onPress={() => setIsMuted(!isMuted)}
        style={styles.videoTouchable}
      >
        <Video
          ref={videoRef}
          source={{ uri: item.url }}
          style={styles.video}
          resizeMode={ResizeMode.COVER}
          isLooping
          isMuted={isMuted}
          onLoadStart={() => setIsLoading(true)}
          onLoad={() => setIsLoading(false)}
        />

        {/* Loading */}
        {isLoading && (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}

        {/* Mute Indicator */}
        {isMuted && !isLoading && (
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

function AdItem({ adType }: { adType: string }) {
  return (
    <View style={styles.adContainer}>
      <LinearGradient
        colors={['#fe2c55', '#25f4ee']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.adGradient}
      >
        <View style={styles.adContent}>
          <Ionicons name="gift" size={64} color="#fff" />
          <Text style={styles.adTitle}>
            {adType === 'rewarded' ? 'Watch & Earn!' : 'Sponsored'}
          </Text>
          <Text style={styles.adSubtitle}>
            {adType === 'rewarded' 
              ? 'Watch this ad to earn coins + real money!' 
              : 'Swipe up to learn more'}
          </Text>
          {adType === 'rewarded' && (
            <TouchableOpacity style={styles.adButton}>
              <Text style={styles.adButtonText}>Watch Now</Text>
            </TouchableOpacity>
          )}
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

  const loadFeed = useCallback(async (pageNum: number = 1) => {
    try {
      const result = await api.getFeed(pageNum);
      const videos = result.videos.map(v => ({
        ...v,
        type: 'type' in v && v.type === 'ad' ? 'ad' as const : 'video' as const,
      }));

      if (pageNum === 1) {
        setFeed(videos as FeedItem[]);
      } else {
        setFeed(prev => [...prev, ...(videos as FeedItem[])]);
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
      return <AdItem adType={item.adType || 'native'} />;
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
});
