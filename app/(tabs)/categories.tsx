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
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/lib/theme';
import type { Category, Series } from '@/lib/types';
import { ErrorState } from '@/components/States';
import { LayoutGrid } from 'lucide-react-native';

export default function CategoriesScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] =
    useState<Category | null>(null);

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

      if (error) {
        throw error;
      }

      const categoryData = (data as Category[]) || [];

      setCategories(categoryData);

      // اختيار أول تصنيف تلقائيًا
      if (categoryData.length > 0) {
        setSelectedCategory((current) => current || categoryData[0]);
      }
    } catch (err) {
      console.error('fetchCategories error:', err);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchSeries = useCallback(async (categoryId: string) => {
    setSeriesLoading(true);

    try {
      const { data, error } = await supabase
        .from('series')
        .select('*')
        .eq('category_id', categoryId)
        .order('view_count', { ascending: false });

      if (error) {
        console.error('fetchSeries error:', error);
        setSeries([]);
        return;
      }

      setSeries((data as Series[]) || []);
    } catch (err) {
      console.error('fetchSeries exception:', err);
      setSeries([]);
    } finally {
      setSeriesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (selectedCategory?.id) {
      fetchSeries(selectedCategory.id);
    }
  }, [selectedCategory, fetchSeries]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCategories();

    if (selectedCategory?.id) {
      fetchSeries(selectedCategory.id);
    }
  }, [fetchCategories, fetchSeries, selectedCategory]);

  const handleSeriesPress = (s: Series) => {
    router.push(`/series/${s.id}`);
  };

  const handleCategoryPress = (category: Category) => {
    setSelectedCategory(category);
  };

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator
          size="large"
          color={Colors.primary[500]}
        />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <ErrorState
          message="حدث خطأ أثناء تحميل التصنيفات."
          onRetry={fetchCategories}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>التصنيفات</Text>
        <Text style={styles.headerSubtitle}>
          اختر تصنيفًا لمشاهدة المسلسلات
        </Text>
      </View>

      {/* Categories horizontal bar */}
      <View style={styles.categoriesWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
          directionalLockEnabled
          bounces
        >
          {categories.length > 0 ? (
            categories.map((cat) => {
              const isActive = selectedCategory?.id === cat.id;

              return (
                <TouchableOpacity
                  key={cat.id}
                  activeOpacity={0.8}
                  onPress={() => handleCategoryPress(cat)}
                  style={[
                    styles.tab,
                    isActive && styles.tabActive,
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.tabText,
                      isActive && styles.tabTextActive,
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.noCategories}>
              <Text style={styles.noCategoriesText}>
                لا توجد تصنيفات حاليًا
              </Text>
            </View>
          )}
        </ScrollView>
      </View>

      {/* Series */}
      <ScrollView
        style={styles.seriesContainer}
        contentContainerStyle={styles.seriesContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary[500]}
            colors={[Colors.primary[500]]}
          />
        }
      >

        {/* Selected category header */}
        {selectedCategory && (
          <View style={styles.categoryBanner}>

            <View style={styles.categoryBannerIcon}>
              <LayoutGrid
                size={24}
                color={Colors.primary[500]}
                strokeWidth={2}
              />
            </View>

            <View style={styles.categoryBannerText}>
              <Text style={styles.categoryTitle}>
                {selectedCategory.name}
              </Text>

              <Text style={styles.categoryCount}>
                {series.length} مسلسل
              </Text>
            </View>

          </View>
        )}

        {/* Loading series */}
        {seriesLoading ? (
          <View style={styles.seriesLoading}>
            <ActivityIndicator
              size="large"
              color={Colors.primary[500]}
            />
          </View>
        ) : series.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIcon}>
              <LayoutGrid
                size={36}
                color={Colors.dark.textMuted}
                strokeWidth={1.5}
              />
            </View>

            <Text style={styles.emptyTitle}>
              لا توجد مسلسلات
            </Text>

            <Text style={styles.emptyText}>
              لا توجد مسلسلات في هذا التصنيف بعد
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {series.map((s) => (
              <View
                key={s.id}
                style={styles.gridItem}
              >
                <SeriesCardSmall
                  series={s}
                  onPress={handleSeriesPress}
                />
              </View>
            ))}
          </View>
        )}

        <View style={styles.bottomSpace} />

      </ScrollView>
    </View>
  );
}

function SeriesCardSmall({
  series,
  onPress,
}: {
  series: Series;
  onPress: (s: Series) => void;
}) {
  const screenWidth = Dimensions.get('window').width;

  const cardWidth = (screenWidth - 48) / 2;

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => onPress(series)}
      style={[
        styles.seriesCard,
        {
          width: cardWidth,
        },
      ]}
    >

      {/* Poster */}
      <View style={styles.cardImageContainer}>

        {series.cover_image_url ? (
          <ImageBackground
            source={{
              uri: series.cover_image_url,
            }}
            style={styles.cardImage}
            imageStyle={styles.cardImageRadius}
          >
            <LinearGradient
              colors={[
                'transparent',
                'rgba(0,0,0,0.85)',
              ]}
              style={styles.cardGradient}
            />

            <View style={styles.cardBottomInfo}>

              <Text style={styles.cardRating}>
                ★ {Number(series.rating || 0).toFixed(1)}
              </Text>

              <Text style={styles.cardEpisodes}>
                {series.total_episodes || 0} حلقة
              </Text>

            </View>
          </ImageBackground>
        ) : (
          <View style={styles.noImage}>
            <LayoutGrid
              size={38}
              color={Colors.dark.textMuted}
              strokeWidth={1.5}
            />
          </View>
        )}

      </View>

      {/* Title */}
      <Text
        style={styles.cardTitle}
        numberOfLines={1}
      >
        {series.title}
      </Text>

      {/* Status */}
      <Text style={styles.cardStatus}>
        {series.status === 'completed'
          ? 'مكتمل'
          : 'مستمر'}
      </Text>

    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },

  loadingScreen: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Header */

  header: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },

  headerTitle: {
    fontSize: 28,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
  },

  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textMuted,
  },

  /* Categories */

  categoriesWrapper: {
    height: 58,
    width: '100%',
  },

  tabsContent: {
    paddingHorizontal: 20,

    // مهم جدًا:
    // يمنع زر التصنيف من التمدد عموديًا
    alignItems: 'center',

    gap: 8,
  },

  tab: {
    minHeight: 40,
    height: 40,

    paddingHorizontal: 17,

    borderRadius: 20,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: Colors.dark.surface,

    borderWidth: 1,
    borderColor: Colors.dark.border,
  },

  tabActive: {
    backgroundColor: Colors.primary[600],
    borderColor: Colors.primary[500],

    shadowColor: Colors.primary[500],
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3,
    },

    elevation: 4,
  },

  tabText: {
    fontSize: 13,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textSecondary,
  },

  tabTextActive: {
    fontFamily: 'Cairo-Bold',
    color: '#FFFFFF',
  },

  noCategories: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  noCategoriesText: {
    fontSize: 13,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textMuted,
  },

  /* Series */

  seriesContainer: {
    flex: 1,
  },

  seriesContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 32,
  },

  categoryBanner: {
    minHeight: 72,

    flexDirection: 'row',
    alignItems: 'center',

    marginBottom: 18,
    padding: 12,

    backgroundColor: Colors.dark.surface,

    borderRadius: 16,

    borderWidth: 1,
    borderColor: Colors.dark.border,
  },

  categoryBannerIcon: {
    width: 48,
    height: 48,

    borderRadius: 14,

    backgroundColor: 'rgba(249, 115, 22, 0.15)',

    alignItems: 'center',
    justifyContent: 'center',
  },

  categoryBannerText: {
    flex: 1,
    marginLeft: 12,
  },

  categoryTitle: {
    fontSize: 18,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
  },

  categoryCount: {
    marginTop: 1,

    fontSize: 12,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textSecondary,
  },

  seriesLoading: {
    paddingVertical: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Grid */

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',

    justifyContent: 'space-between',

    rowGap: 20,
  },

  gridItem: {
    width: '48%',
  },

  seriesCard: {
    alignSelf: 'flex-start',
  },

  /* Poster */

  cardImageContainer: {
    width: '100%',
    height: 230,

    borderRadius: 14,

    overflow: 'hidden',

    backgroundColor: Colors.dark.surfaceLight,

    borderWidth: 1,
    borderColor: Colors.dark.border,
  },

  cardImage: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  cardImageRadius: {
    borderRadius: 14,
  },

  noImage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cardGradient: {
    position: 'absolute',

    left: 0,
    right: 0,
    bottom: 0,

    height: '55%',
  },

  cardBottomInfo: {
    flexDirection: 'row',

    justifyContent: 'space-between',

    alignItems: 'center',

    paddingHorizontal: 9,
    paddingBottom: 9,
  },

  cardRating: {
    fontSize: 11,
    fontFamily: 'Cairo-SemiBold',
    color: Colors.warning[400],
  },

  cardEpisodes: {
    fontSize: 10,
    fontFamily: 'Cairo-Regular',
    color: '#FFFFFF',
  },

  cardTitle: {
    marginTop: 8,

    fontSize: 14,
    fontFamily: 'Cairo-SemiBold',

    color: Colors.dark.text,
  },

  cardStatus: {
    marginTop: 1,

    fontSize: 11,
    fontFamily: 'Cairo-Regular',

    color: Colors.dark.textMuted,
  },

  /* Empty */

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',

    paddingVertical: 70,
  },

  emptyIcon: {
    width: 70,
    height: 70,

    borderRadius: 20,

    backgroundColor: Colors.dark.surface,

    alignItems: 'center',
    justifyContent: 'center',

    marginBottom: 14,
  },

  emptyTitle: {
    fontSize: 17,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
  },

  emptyText: {
    marginTop: 4,

    fontSize: 13,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textMuted,

    textAlign: 'center',
  },

  bottomSpace: {
    height: 20,
  },
});
