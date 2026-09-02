import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';

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
  if (!series || series.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {title}
        </Text>

        {onSeeAll && (
          <TouchableOpacity
            onPress={onSeeAll}
            style={styles.seeAllButton}
            activeOpacity={0.7}
          >
            <Text style={styles.seeAllText}>
              See All
            </Text>

            <ChevronRight
              size={16}
              color={Colors.primary[400]}
              strokeWidth={2.5}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Horizontal Series List */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rowContent}
        decelerationRate="fast"
        snapToAlignment="start"
      >
        {series.map((item) => (
          <View
            key={item.id}
            style={styles.cardWrapper}
          >
            <SeriesCard
              series={item}
              onPress={onSeriesPress}
              width={145}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 18,
    marginBottom: 6,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginBottom: 12,
  },

  title: {
    fontSize: 21,
    lineHeight: 27,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
  },

  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingLeft: 8,
  },

  seeAllText: {
    fontSize: 12,
    fontFamily: 'Cairo-SemiBold',
    color: Colors.primary[400],
  },

  rowContent: {
    paddingLeft: 18,
    paddingRight: 8,
  },

  cardWrapper: {
    marginRight: 12,
  },
});
