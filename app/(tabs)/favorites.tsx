import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Colors } from '@/lib/theme';
import type { Series } from '@/lib/types';
import { SeriesCard } from '@/components/SeriesCard';
import { EmptyState, ErrorState } from '@/components/States';
import { Heart } from 'lucide-react-native';

const screenWidth = Dimensions.get('window').width;
const cardWidth = (screenWidth - 48) / 2;

export default function FavoritesScreen() {
  const { session } = useAuth();
  const [favorites, setFavorites] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFavorites = useCallback(async () => {
    if (!session?.user) {
      setLoading(false);
      return;
    }
    setError(false);
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select(`
          series:series!inner(*)
        `)
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const seriesList = ((data as any[]) || []).map((row) => row.series).filter(Boolean);
      setFavorites(seriesList as Series[]);
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchFavorites();
  }, [fetchFavorites]);

  const handleSeriesPress = (s: Series) => {
    router.push(`/series/${s.id}`);
  };

  if (!session?.user) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>المفضلة</Text>
        </View>
        <View style={styles.authPrompt}>
          <Heart size={48} color={Colors.dark.textMuted} strokeWidth={1.5} />
          <Text style={styles.authPromptText}>سجل الدخول لحفظ مفضلتك</Text>
          <TouchableOpacity
            style={styles.authButton}
            onPress={() => router.push('/auth/login')}
          >
            <Text style={styles.authButtonText}>تسجيل الدخول</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return <View style={styles.container} />;
  }

  if (error) {
    return <ErrorState message="حدث خطأ أثناء تحميل المفضلة." onRetry={fetchFavorites} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Favorites</Text>
        {favorites.length > 0 && (
          <Text style={styles.count}>{favorites.length} مسلسل</Text>
        )}
      </View>
      {favorites.length === 0 ? (
        <EmptyState message="لم تقم بإضافة أي مسلسل للمفضلة بعد" />
      ) : (
        <FlatList
          data={favorites}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary[500]} />}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.cardContainer}>
              <SeriesCard series={item} onPress={handleSeriesPress} width={cardWidth} />
            </View>
          )}
        />
      )}
    </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
  },
  count: {
    fontSize: 13,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textSecondary,
  },
  listContent: {
    padding: 16,
    gap: 16,
  },
  cardContainer: {},
  authPrompt: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingBottom: 40,
  },
  authPromptText: {
    fontSize: 15,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textSecondary,
  },
  authButton: {
    paddingHorizontal: 28,
    paddingVertical: 12,
    backgroundColor: Colors.primary[600],
    borderRadius: 12,
  },
  authButtonText: {
    fontSize: 14,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
  },
});
