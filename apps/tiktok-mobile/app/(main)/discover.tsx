/**
 * Discover Screen
 */

import { View, Text, StyleSheet, TextInput, ScrollView, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const CATEGORIES = ['All', 'Dance', 'Comedy', 'Food', 'Sports', 'Gaming', 'Music'];
const TRENDING = [
  { tag: '#viral', views: '12.5B' },
  { tag: '#dance', views: '8.2B' },
  { tag: '#funny', views: '6.7B' },
  { tag: '#fyp', views: '5.1B' },
];

export default function DiscoverScreen() {
  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#888" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search"
            placeholderTextColor="#888"
          />
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Categories */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.categories}
          contentContainerStyle={styles.categoriesContent}
        >
          {CATEGORIES.map((cat, i) => (
            <TouchableOpacity 
              key={cat} 
              style={[styles.category, i === 0 && styles.categoryActive]}
            >
              <Text style={[styles.categoryText, i === 0 && styles.categoryTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Trending */}
        <Text style={styles.sectionTitle}>Trending</Text>
        <View style={styles.trending}>
          {TRENDING.map((item) => (
            <TouchableOpacity key={item.tag} style={styles.trendingItem}>
              <View style={styles.trendingIcon}>
                <Ionicons name="trending-up" size={20} color="#fe2c55" />
              </View>
              <View style={styles.trendingInfo}>
                <Text style={styles.trendingTag}>{item.tag}</Text>
                <Text style={styles.trendingViews}>{item.views} views</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Grid */}
        <Text style={styles.sectionTitle}>For You</Text>
        <View style={styles.grid}>
          {Array(6).fill(null).map((_, i) => (
            <TouchableOpacity key={i} style={styles.gridItem}>
              <Image
                source={{ uri: `https://picsum.photos/200/300?random=${i}` }}
                style={styles.gridImage}
              />
              <View style={styles.gridOverlay}>
                <Ionicons name="play" size={12} color="#fff" />
                <Text style={styles.gridViews}>{Math.floor(Math.random() * 1000)}K</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  searchContainer: {
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  categories: {
    marginBottom: 20,
  },
  categoriesContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  category: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
  },
  categoryActive: {
    backgroundColor: '#fe2c55',
  },
  categoryText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
  },
  categoryTextActive: {
    color: '#fff',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  trending: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  trendingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  trendingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(254, 44, 85, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  trendingInfo: {
    flex: 1,
  },
  trendingTag: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  trendingViews: {
    color: '#888',
    fontSize: 13,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
  },
  gridItem: {
    width: '33.33%',
    padding: 4,
  },
  gridImage: {
    width: '100%',
    aspectRatio: 0.7,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
  },
  gridOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gridViews: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
