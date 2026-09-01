import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/lib/theme';
import type { Series } from '@/lib/types';
import { SeriesCard } from '@/components/SeriesCard';
import { EmptyState } from '@/components/States';
import { Search as SearchIcon, X } from 'lucide-react-native';

const screenWidth = Dimensions.get('window').width;
const cardWidth = (screenWidth - 48) / 2;

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Series[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const { data, error } = await supabase
        .from('series')
        .select('*')
        .ilike('title', `%${searchQuery}%`)
        .order('view_count', { ascending: false })
        .limit(20);

      if (!error) {
        setResults((data as Series[]) || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (debounceTimer) clearTimeout(debounceTimer);
    const timer = setTimeout(() => {
      performSearch(text);
    }, 400);
    setDebounceTimer(timer);
  }, [debounceTimer, performSearch]);

  useEffect(() => {
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [debounceTimer]);

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setSearched(false);
  };

  const handleSeriesPress = (s: Series) => {
    router.push(`/series/${s.id}`);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>البحث</Text>
      </View>
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <SearchIcon size={20} color={Colors.dark.textMuted} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            placeholder="ابحث عن مسلسل..."
            placeholderTextColor={Colors.dark.textMuted}
            value={query}
            onChangeText={handleSearch}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
              <X size={18} color={Colors.dark.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary[500]} />
        </View>
      ) : searched && results.length === 0 ? (
        <EmptyState message="لا توجد نتائج مطابقة لبحثك" />
      ) : !searched ? (
        <View style={styles.placeholderContainer}>
          <SearchIcon size={48} color={Colors.dark.textMuted} strokeWidth={1.5} />
          <Text style={styles.placeholderText}>ابحث عن مسلسلاتك المفضلة</Text>
        </View>
      ) : (
        <FlatList
          data={results}
          numColumns={2}
          contentContainerStyle={styles.resultsContent}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.resultItem}>
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
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'android' ? 8 : 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.text,
    padding: 0,
    textAlign: 'left',
  },
  clearButton: {
    padding: 4,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  placeholderText: {
    fontSize: 15,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textSecondary,
  },
  resultsContent: {
    padding: 16,
    gap: 16,
  },
  resultItem: {},
});
