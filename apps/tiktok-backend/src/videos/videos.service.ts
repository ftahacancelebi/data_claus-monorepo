/**
 * Videos Service
 *
 * Manages video content and interactions.
 * Uses real video data stored in a JSON file (for demo purposes).
 * In production, this would connect to a database.
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface VideoCreator {
  id: string;
  username: string;
  avatar: string;
  verified: boolean;
}

export interface VideoMusic {
  title: string;
  artist: string;
}

export interface Video {
  id: string;
  url: string;
  thumbnail: string;
  description: string;
  creator: VideoCreator;
  likes: number;
  comments: number;
  shares: number;
  views: number;
  music: VideoMusic;
}

export interface FeedItem {
  type: 'video' | 'ad';
  video?: Video;
  adType?: 'banner' | 'interstitial' | 'rewarded';
  adSlot?: number;
}

@Injectable()
export class VideosService {
  private videos: Video[] = [];
  private userLikes: Map<string, Set<string>> = new Map();
  private userViews: Map<string, Set<string>> = new Map();

  constructor() {
    this.loadVideos();
  }

  /**
   * Load videos from JSON file.
   * In production, this would be a database.
   */
  private loadVideos(): void {
    try {
      const dataPath = path.join(__dirname, '../../data/videos.json');
      if (fs.existsSync(dataPath)) {
        const data = fs.readFileSync(dataPath, 'utf-8');
        this.videos = JSON.parse(data);
      } else {
        // Create default videos if file doesn't exist
        this.videos = this.createDefaultVideos();
        // Save to file
        fs.mkdirSync(path.dirname(dataPath), { recursive: true });
        fs.writeFileSync(dataPath, JSON.stringify(this.videos, null, 2));
      }
    } catch (error) {
      console.error('Failed to load videos:', error);
      this.videos = this.createDefaultVideos();
    }
  }

  /**
   * Create default demo videos.
   */
  private createDefaultVideos(): Video[] {
    return [
      {
        id: 'video_1',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        thumbnail:
          'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',
        description:
          'Big Buck Bunny - A classic animated short film 🐰 #animation #fun',
        creator: {
          id: 'creator_1',
          username: 'animation_studio',
          avatar: 'https://i.pravatar.cc/150?u=creator1',
          verified: true,
        },
        likes: 15420,
        comments: 892,
        shares: 234,
        views: 125000,
        music: { title: 'Original Sound', artist: 'Blender Foundation' },
      },
      {
        id: 'video_2',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        thumbnail:
          'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ElephantsDream.jpg',
        description:
          'Elephants Dream - First Blender Open Movie 🐘 #openSourcet #blender',
        creator: {
          id: 'creator_2',
          username: 'blender_films',
          avatar: 'https://i.pravatar.cc/150?u=creator2',
          verified: true,
        },
        likes: 8932,
        comments: 456,
        shares: 123,
        views: 83000,
        music: { title: 'Dream', artist: 'Proog & Emo' },
      },
      {
        id: 'video_3',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        thumbnail:
          'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg',
        description: 'For Bigger Blazes - Action packed! 🔥 #action #adventure',
        creator: {
          id: 'creator_3',
          username: 'action_clips',
          avatar: 'https://i.pravatar.cc/150?u=creator3',
          verified: false,
        },
        likes: 5621,
        comments: 234,
        shares: 89,
        views: 45000,
        music: { title: 'Blaze', artist: 'Chrome' },
      },
      {
        id: 'video_4',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        thumbnail:
          'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerEscapes.jpg',
        description:
          'For Bigger Escapes - The chase is on! 🏃 #escape #thriller',
        creator: {
          id: 'creator_4',
          username: 'thriller_vids',
          avatar: 'https://i.pravatar.cc/150?u=creator4',
          verified: false,
        },
        likes: 7823,
        comments: 345,
        shares: 156,
        views: 62000,
        music: { title: 'Escape', artist: 'Chrome' },
      },
      {
        id: 'video_5',
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
        thumbnail:
          'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerFun.jpg',
        description: 'For Bigger Fun - Enjoy the ride! 🎢 #fun #entertainment',
        creator: {
          id: 'creator_5',
          username: 'fun_times',
          avatar: 'https://i.pravatar.cc/150?u=creator5',
          verified: true,
        },
        likes: 12456,
        comments: 678,
        shares: 289,
        views: 98000,
        music: { title: 'Fun Times', artist: 'Chrome' },
      },
    ];
  }

  /**
   * Get video feed with optional ad slots.
   */
  getFeed(
    page: number = 1,
    limit: number = 10,
    userId?: string,
  ): {
    items: FeedItem[];
    page: number;
    limit: number;
    hasMore: boolean;
  } {
    const start = (page - 1) * limit;
    const end = start + limit;
    const pageVideos = this.videos.slice(start, end);

    const items: FeedItem[] = [];
    const userLikesSet = userId ? this.userLikes.get(userId) : undefined;

    pageVideos.forEach((video, index) => {
      // Add video with user-specific data
      const videoWithUserData = {
        ...video,
        isLiked: userLikesSet?.has(video.id) ?? false,
      };
      items.push({ type: 'video', video: videoWithUserData });

      // Insert ad slot every 3 videos
      if ((index + 1) % 3 === 0) {
        const adTypes: Array<'banner' | 'interstitial' | 'rewarded'> = [
          'banner',
          'interstitial',
          'rewarded',
        ];
        items.push({
          type: 'ad',
          adType: adTypes[index % adTypes.length],
          adSlot: Math.floor(index / 3) + 1,
        });
      }
    });

    return {
      items,
      page,
      limit,
      hasMore: end < this.videos.length,
    };
  }

  /**
   * Get a single video by ID.
   */
  getVideo(id: string): Video {
    const video = this.videos.find((v) => v.id === id);
    if (!video) {
      throw new NotFoundException(`Video ${id} not found`);
    }
    return video;
  }

  /**
   * Like/unlike a video.
   */
  toggleLike(
    videoId: string,
    userId: string,
  ): { isLiked: boolean; likesCount: number } {
    const video = this.getVideo(videoId);

    if (!this.userLikes.has(userId)) {
      this.userLikes.set(userId, new Set());
    }

    const userLikesSet = this.userLikes.get(userId)!;
    const wasLiked = userLikesSet.has(videoId);

    if (wasLiked) {
      userLikesSet.delete(videoId);
      video.likes--;
    } else {
      userLikesSet.add(videoId);
      video.likes++;
    }

    return {
      isLiked: !wasLiked,
      likesCount: video.likes,
    };
  }

  /**
   * Record a video view.
   */
  recordView(
    videoId: string,
    userId: string,
    duration: number,
    completed: boolean,
  ): { isNewView: boolean; viewsCount: number } {
    const video = this.getVideo(videoId);

    if (!this.userViews.has(userId)) {
      this.userViews.set(userId, new Set());
    }

    const userViewsSet = this.userViews.get(userId)!;
    const isNewView = !userViewsSet.has(videoId);

    if (isNewView) {
      userViewsSet.add(videoId);
      video.views++;
    }

    return {
      isNewView,
      viewsCount: video.views,
    };
  }
}
