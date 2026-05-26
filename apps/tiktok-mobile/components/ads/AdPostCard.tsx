import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

export interface AdPostCardData {
  brand_name: string;
  headline: string;
  sub_copy: string;
  cta_label: string;
  image_url?: string | null;
  matched_tags: string[];
}

interface Props {
  data: AdPostCardData;
}

export function AdPostCard({ data }: Props) {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {data.brand_name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.brandName}>{data.brand_name}</Text>
          <Text style={styles.sponsoredText}>Sponsorlu · DataClaus</Text>
        </View>
        <View style={styles.adBadge}>
          <Text style={styles.adBadgeText}>REKLAM</Text>
        </View>
      </View>

      {/* Image */}
      <Image
        source={{
          uri: data.image_url ?? `https://picsum.photos/seed/ad-${data.brand_name}/800/450`,
        }}
        style={styles.image}
        resizeMode="cover"
      />

      {/* Copy */}
      <View style={styles.body}>
        <Text style={styles.headline}>{data.headline}</Text>
        <Text style={styles.subCopy}>{data.sub_copy}</Text>
      </View>

      {/* Tag match box */}
      {data.matched_tags.length > 0 && (
        <View style={styles.tagBox}>
          <Text style={styles.tagBoxTitle}>Neden bu reklam? Sana göre seçildi:</Text>
          <View style={styles.tagRow}>
            {data.matched_tags.slice(0, 4).map((tag) => (
              <View key={tag} style={styles.tagChip}>
                <Text style={styles.tagText}>#{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* CTA */}
      <TouchableOpacity style={styles.cta} activeOpacity={0.85}>
        <Text style={styles.ctaText}>{data.cta_label}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderTopWidth: 3,
    borderTopColor: '#7c3aed',
    marginVertical: 4,
    paddingBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  headerText: { flex: 1 },
  brandName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  sponsoredText: {
    fontSize: 11,
    color: '#7c3aed',
  },
  adBadge: {
    backgroundColor: '#ede9fe',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  adBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#7c3aed',
  },
  image: {
    width: width,
    height: width * 0.56,
  },
  body: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  headline: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  subCopy: {
    fontSize: 12,
    color: '#6b7280',
  },
  tagBox: {
    marginHorizontal: 12,
    marginBottom: 10,
    backgroundColor: '#ede9fe',
    borderRadius: 8,
    padding: 10,
  },
  tagBoxTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7c3aed',
    marginBottom: 6,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagChip: {
    backgroundColor: '#ddd6fe',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 11,
    color: '#6d28d9',
    fontWeight: '600',
  },
  cta: {
    marginHorizontal: 12,
    backgroundColor: '#7c3aed',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  ctaText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
});
