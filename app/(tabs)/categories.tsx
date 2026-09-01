import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/lib/theme';
import type { Category, Series } from '@/lib/types';
import { SeriesRow } from '@/components/SeriesRow';
import { ErrorState } from '@/components/States';
import { LayoutGrid } from 'lucide-react-native';

export default function CategoriesScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [series, setSeries] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCategories = useCallback(async () => {
    setError(false);
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setCategories((data as Category[]) || []);
      if (data && data.length > 0 && !selectedCategory) {
        setSelectedCategory(data[0]);
      }
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory]);

  const fetchSeries = useCallback(async (categoryId: string) => {
    setSeriesLoading(true);
    try {
      const { data, error } = await supabase
        .from('series')
        .select('*')
        .eq('category_id', categoryId)
        .order('view_count', { ascending: false });
      if (!error) {
        setSeries((data as Series[]) || []);
      }
    } finally {
      setSeriesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (selectedCategory) {
      fetchSeries(selectedCategory.id);
    }
  }, [selectedCategory, fetchSeries]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCategories();
  }, [fetchCategories]);

  const handleSeriesPress = (s: Series) => {
    router.push(`/series/${s.id}`);
  };

  if (loading) {
    return <View style={styles.container} />;
  }

  if (error) {
    return <ErrorState message="حدث خطأ أثناء تحميل التصنيفات." onRetry={fetchCategories} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>التصنيفات</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsContent}
      >
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            onPress={() => setSelectedCategory(cat)}
            style={[
              styles.tab,
              selectedCategory?.id === cat.id && styles.tabActive,
            ]}
          >
            <Text
              style={[
                styles.tabText,
                selectedCategory?.id === cat.id && styles.tabTextActive,
              ]}
            >
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.seriesContainer}
        contentContainerStyle={styles.seriesContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary[500]} />}
      >
        {selectedCategory && (
          <View style={styles.categoryBanner}>
            <View style={styles.categoryBannerIcon}>
              <LayoutGrid size={28} color={Colors.primary[500]} strokeWidth={2} />
            </View>
            <Text style={styles.categoryTitle}>{selectedCategory.name}</Text>
            <Text style={styles.categoryCount}>{series.length} مسلسل</Text>
          </View>
        )}

        {series.length === 0 && !seriesLoading ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>لا توجد مسلسلات في هذا التصنيف بعد</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {series.map((s) => (
              <View key={s.id} style={styles.gridItem}>
                <SeriesCardSmall series={s} onPress={handleSeriesPress} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function SeriesCardSmall({ series, onPress }: { series: Series; onPress: (s: Series) => void }) {
  const cardWidth = (Dimensions.get('window').width - 48) / 2;
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={() => onPress(series)} style={{ width: cardWidth }}>
      <View style={styles.cardImageContainer}>
        {series.cover_image_url && (
          <ImageBackground
            source={{ uri: series.cover_image_url }}
            style={styles.cardImage}
            imageStyle={styles.cardImageRadius}
          >
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.cardGradient} />
            <View style={styles.cardBottomInfo}>
              <Text style={styles.cardRating}>★ {Number(series.rating).toFixed(1)}</Text>
              <Text style={styles.cardEpisodes}>{series.total_episodes} حلقة</Text>
            </View>
          </ImageBackground>
        )}
      </View>
      <Text style={styles.cardTitle} numberOfLines={1}>{series.title}</Text>
      <Text style={styles.cardStatus}>{series.status === 'completed' ? 'مكتمل' : 'مستمر'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
  },
  tabsContent: {
    paddingHorizontal: 16,
    gap: 8,
    paddingVertical: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  tabActive: {
    backgroundColor: Colors.primary[600],
    borderColor: Colors.primary[500],
  },
  tabText: {
    fontSize: 13,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textSecondary,
  },
  tabTextActive: {
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
  },
  seriesContainer: {
    flex: 1,
  },
  seriesContent: {
    padding: 16,
    paddingBottom: 32,
  },
  categoryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
    padding: 16,
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  categoryBannerIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
  },
  categoryCount: {
    fontSize: 13,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textSecondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  gridItem: {},
  cardImageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.dark.surfaceLight,
  height: 200,
  borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  cardImage: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  cardImageRadius: {
    borderRadius: 12,
  },
  cardGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
  },
  cardBottomInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  cardRating: {
    fontSize: 11,
    fontFamily: 'Cairo-SemiBold',
    color: Colors.warning[400],
  },
  cardEpisodes: {
    fontSize: 10,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textSecondary,
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: 'Cairo-SemiBold',
    color: Colors.dark.text,
    marginTop: 8,
  },
  cardStatus: {
    fontSize: 12,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textMuted,
  },
});
