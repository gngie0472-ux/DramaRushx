import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
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
  const { width: screenWidth } = useWindowDimensions();

  /*
   * Responsive 3-column grid.
   *
   * The card automatically becomes smaller/larger
   * depending on the phone screen width.
   */

  const horizontalPadding = 16;
  const gap = 10;

  const availableWidth =
    screenWidth -
    horizontalPadding * 2 -
    gap * 2;

  const cardWidth = Math.floor(
    availableWidth / 3
  );

  return (
    <View style={styles.container}>
      {/* Section header */}
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
              size={15}
              color={Colors.primary[400]}
              strokeWidth={2}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Responsive 3-column grid */}
      <View style={styles.grid}>
        {series.map((item) => (
          <View
            key={item.id}
            style={[
              styles.gridItem,
              {
                width: cardWidth,
              },
            ]}
          >
            <SeriesCard
              series={item}
              onPress={onSeriesPress}
              width={cardWidth}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
    marginBottom: 8,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',

    paddingHorizontal: 16,

    marginBottom: 10,
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

    paddingVertical: 4,
    paddingHorizontal: 2,
  },

  seeAllText: {
    fontSize: 12,

    fontFamily: 'Cairo-Regular',

    color: Colors.primary[400],

    textAlign: 'left',
  },

  grid: {
    flexDirection: 'row',

    flexWrap: 'wrap',

    paddingHorizontal: 16,

    columnGap: 10,

    rowGap: 16,

    alignItems: 'flex-start',
  },

  gridItem: {
    flexGrow: 0,
    flexShrink: 0,
  },
});
