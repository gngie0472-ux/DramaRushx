import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Colors } from '@/lib/theme';
import { ChevronRight } from 'lucide-react-native';
import type { Series } from '@/lib/types';
import { SeriesCard } from './SeriesCard';

interface SeriesRowProps {
  title: string;
  series: Series[];
  onSeriesPress: (series: Series) => void;
  onSeeAll?: () => void;
  loading?: boolean;
}

export function SeriesRow({
  title,
  series,
  onSeriesPress,
  onSeeAll,
}: SeriesRowProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>

        {onSeeAll && (
          <TouchableOpacity
            onPress={onSeeAll}
            style={styles.seeAllButton}
          >
            <Text style={styles.seeAllText}>See All</Text>

            <ChevronRight
              size={16}
              color={Colors.primary[400]}
              strokeWidth={2}
            />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={series}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SeriesCard
            series={item}
            onPress={onSeriesPress}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },

  title: {
    fontSize: 18,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
    textAlign: 'left',
  },

  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },

  seeAllText: {
    fontSize: 13,
    fontFamily: 'Cairo-Regular',
    color: Colors.primary[400],
    textAlign: 'left',
  },

  listContent: {
    paddingHorizontal: 12,
    gap: 12,
  },
});
