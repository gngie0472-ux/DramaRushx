import { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useIAP, type Purchase } from 'expo-iap';
import {
  ChevronLeft,
  Coins,
  Crown,
  ShieldCheck,
  Sparkles,
  Ban,
  PlayCircle,
  Check,
} from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { Colors } from '@/lib/theme';

const COIN_IDS = [
  'dramarush_coins_100',
  'dramarush_coins_550',
  'dramarush_coins_1200',
  'dramarush_coins_2500',
];

const SUB_IDS = [
  'dramarush_premium_monthly',
  'dramarush_premium_yearly',
];

const coinLabels: Record<string, string> = {
  dramarush_coins_100: '100 Coins',
  dramarush_coins_550: '550 Coins',
  dramarush_coins_1200: '1,200 Coins',
  dramarush_coins_2500: '2,500 Coins',
};

const coinDescriptions: Record<string, string> = {
  dramarush_coins_100: 'Starter Pack',
  dramarush_coins_550: 'Best for casual watching',
  dramarush_coins_1200: 'Popular choice',
  dramarush_coins_2500: 'Best value',
};

export default function StoreScreen() {
  const [busy, setBusy] = useState(false);

  const {
    connected,
    products,
    subscriptions,
    fetchProducts,
    requestPurchase,
    finishTransaction,
  } = useIAP({
    onPurchaseSuccess: async (purchase: Purchase) => {
      try {
        const productId = purchase.productId;

        const isSub = SUB_IDS.includes(productId);

        const purchaseToken =
          purchase.purchaseToken || purchase.transactionId;

        if (!purchaseToken) {
          throw new Error(
            'Google Play did not return a purchase token.'
          );
        }

        const { data, error } =
          await supabase.functions.invoke(
            'verify-google-purchase',
            {
              body: {
                productId,
                purchaseToken,
                productKind: isSub
                  ? 'subscription'
                  : 'product',
              },
            }
          );

        if (error) {
          throw error;
        }

        if (data?.error) {
          throw new Error(data.error);
        }

        await finishTransaction({
          purchase,
          isConsumable: !isSub,
        });

        Alert.alert(
          'Purchase successful',
          isSub
            ? 'Your VIP subscription has been activated.'
            : 'Coins have been added to your account.'
        );
      } catch (e) {
        Alert.alert(
          'Payment verification failed',
          e instanceof Error
            ? e.message
            : 'Please try again.'
        );
      } finally {
        setBusy(false);
      }
    },

    onPurchaseError: (error) => {
      setBusy(false);

      if (
        String(error?.code || '')
          .toLowerCase()
          .includes('cancel')
      ) {
        return;
      }

      Alert.alert(
        'Purchase failed',
        error?.message || 'Unable to complete the purchase.'
      );
    },
  });

  useEffect(() => {
    if (!connected) return;

    fetchProducts({
      skus: COIN_IDS,
      type: 'in-app',
    }).catch(() => {});

    fetchProducts({
      skus: SUB_IDS,
      type: 'subs',
    }).catch(() => {});
  }, [connected, fetchProducts]);

  const buy = async (
    id: string,
    subscription = false
  ) => {
    if (busy) return;

    setBusy(true);

    try {
      await requestPurchase({
        request: {
          google: {
            skus: [id],
          },
        },
        type: subscription ? 'subs' : 'in-app',
      });
    } catch (e) {
      setBusy(false);

      Alert.alert(
        'Purchase failed',
        e instanceof Error
          ? e.message
          : 'Unable to start the payment.'
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.8}
        >
          <ChevronLeft
            size={25}
            color={Colors.dark.text}
          />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Crown
            size={20}
            color={Colors.primary[400]}
            fill={Colors.primary[400]}
          />

          <Text style={styles.headerTitle}>
            VIP Store
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* VIP HERO */}
        <View style={styles.vipHero}>
          <View style={styles.vipGlow} />

          <View style={styles.crownCircle}>
            <Crown
              size={34}
              color={Colors.primary[400]}
              fill={Colors.primary[400]}
            />
          </View>

          <View style={styles.vipBadge}>
            <Sparkles
              size={13}
              color={Colors.primary[400]}
              fill={Colors.primary[400]}
            />

            <Text style={styles.vipBadgeText}>
              PREMIUM
            </Text>
          </View>

          <Text style={styles.vipTitle}>
            Unlock VIP
          </Text>

          <Text style={styles.vipSubtitle}>
            Enjoy DramaRush without limits
          </Text>

          {/* FEATURES */}
          <View style={styles.featuresContainer}>
            <Feature
              icon={
                <Ban
                  size={18}
                  color={Colors.primary[400]}
                />
              }
              text="Remove all ads"
            />

            <Feature
              icon={
                <PlayCircle
                  size={18}
                  color={Colors.primary[400]}
                />
              }
              text="Watch premium episodes"
            />

            <Feature
              icon={
                <Sparkles
                  size={18}
                  color={Colors.primary[400]}
                />
              }
              text="Premium VIP experience"
            />
          </View>
        </View>

        {/* SUBSCRIPTIONS */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>
              VIP Membership
            </Text>

            <Text style={styles.sectionSubtitle}>
              Choose your VIP plan
            </Text>
          </View>

          <Crown
            size={24}
            color={Colors.primary[400]}
          />
        </View>

        {!connected && (
          <View style={styles.loadingBox}>
            <ActivityIndicator
              color={Colors.primary[400]}
            />

            <Text style={styles.loadingText}>
              Connecting to Google Play...
            </Text>
          </View>
        )}

        {subscriptions.map((subscription) => {
          const yearly = subscription.id.includes(
            'yearly'
          );

          return (
            <TouchableOpacity
              key={subscription.id}
              style={[
                styles.subscriptionCard,
                yearly && styles.subscriptionCardFeatured,
              ]}
              disabled={busy}
              activeOpacity={0.85}
              onPress={() =>
                buy(subscription.id, true)
              }
            >
              {yearly && (
                <View style={styles.bestValueBadge}>
                  <Sparkles
                    size={12}
                    color={Colors.dark.background}
                    fill={Colors.dark.background}
                  />

                  <Text style={styles.bestValueText}>
                    BEST VALUE
                  </Text>
                </View>
              )}

              <View style={styles.subscriptionIcon}>
                <Crown
                  size={23}
                  color={Colors.primary[400]}
                  fill={
                    yearly
                      ? Colors.primary[400]
                      : 'transparent'
                  }
                />
              </View>

              <View style={styles.subscriptionInfo}>
                <Text style={styles.subscriptionTitle}>
                  {yearly
                    ? 'Yearly VIP'
                    : 'Monthly VIP'}
                </Text>

                <Text style={styles.subscriptionDescription}>
                  {yearly
                    ? 'Full VIP access for one year'
                    : 'Full VIP access every month'}
                </Text>

                <Text style={styles.subscriptionPrice}>
                  {subscription.displayPrice}
                </Text>
              </View>

              <View style={styles.subscribeButton}>
                <Text style={styles.subscribeButtonText}>
                  Subscribe
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* COINS */}
        <View
          style={[
            styles.sectionHeader,
            { marginTop: 30 },
          ]}
        >
          <View>
            <Text style={styles.sectionTitle}>
              Recharge Coins
            </Text>

            <Text style={styles.sectionSubtitle}>
              Use coins to unlock premium episodes
            </Text>
          </View>

          <Coins
            size={25}
            color={Colors.warning[400]}
          />
        </View>

        <View style={styles.coinsGrid}>
          {products.map((product) => {
            const isPopular =
              product.id ===
              'dramarush_coins_1200';

            const isBest =
              product.id ===
              'dramarush_coins_2500';

            return (
              <TouchableOpacity
                key={product.id}
                style={[
                  styles.coinCard,
                  isPopular &&
                    styles.coinCardPopular,
                ]}
                disabled={busy}
                activeOpacity={0.85}
                onPress={() => buy(product.id)}
              >
                {(isPopular || isBest) && (
                  <View
                    style={styles.coinBadge}
                  >
                    <Text style={styles.coinBadgeText}>
                      {isBest
                        ? 'BEST VALUE'
                        : 'POPULAR'}
                    </Text>
                  </View>
                )}

                <View style={styles.coinIconCircle}>
                  <Coins
                    size={26}
                    color={Colors.warning[400]}
                  />
                </View>

                <Text style={styles.coinAmount}>
                  {coinLabels[product.id] ||
                    product.title}
                </Text>

                <Text
                  style={
                    styles.coinDescription
                  }
                >
                  {coinDescriptions[
                    product.id
                  ] || 'Coins pack'}
                </Text>

                <View style={styles.coinBottom}>
                  <Text style={styles.coinPrice}>
                    {product.displayPrice}
                  </Text>

                  <View style={styles.buyButton}>
                    <Text style={styles.buyButtonText}>
                      Buy
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* SECURITY */}
        <View style={styles.securityCard}>
          <View style={styles.securityIcon}>
            <ShieldCheck
              size={22}
              color={Colors.primary[400]}
            />
          </View>

          <View style={styles.securityTextContainer}>
            <Text style={styles.securityTitle}>
              Secure payments
            </Text>

            <Text style={styles.securityText}>
              Every purchase is verified securely
              on our server before your coins or
              VIP membership are activated.
            </Text>
          </View>
        </View>

        {/* BENEFITS */}
        <View style={styles.benefitsCard}>
          <Text style={styles.benefitsTitle}>
            Why go VIP?
          </Text>

          <Benefit text="No advertisements" />
          <Benefit text="Access premium episodes" />
          <Benefit text="Fast and secure activation" />
          <Benefit text="Support DramaRush" />
        </View>

        {busy && (
          <View style={styles.processingContainer}>
            <ActivityIndicator
              size="small"
              color={Colors.primary[400]}
            />

            <Text style={styles.processingText}>
              Processing purchase...
            </Text>
          </View>
        )}

        <Text style={styles.footerNote}>
          Purchases are processed through Google Play.
          Payment verification is performed securely
          on the DramaRush server.
        </Text>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </View>
  );
}

/* ============================================================
   FEATURE COMPONENT
   ============================================================ */

function Feature({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <View style={styles.featureRow}>
      <View style={styles.featureIcon}>
        {icon}
      </View>

      <Text style={styles.featureText}>
        {text}
      </Text>

      <Check
        size={17}
        color={Colors.primary[400]}
        strokeWidth={2.5}
      />
    </View>
  );
}

/* ============================================================
   BENEFIT COMPONENT
   ============================================================ */

function Benefit({
  text,
}: {
  text: string;
}) {
  return (
    <View style={styles.benefitRow}>
      <View style={styles.checkCircle}>
        <Check
          size={13}
          color={Colors.dark.background}
          strokeWidth={3}
        />
      </View>

      <Text style={styles.benefitText}>
        {text}
      </Text>
    </View>
  );
}

/* ============================================================
   STYLES
   ============================================================ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },

  header: {
    height: 62,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
    backgroundColor: Colors.dark.background,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.surface,
  },

  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
    gap: 7,
  },

  headerTitle: {
    color: Colors.dark.text,
    fontSize: 20,
    fontFamily: 'Cairo-Bold',
  },

  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 30,
  },

  /* =========================
     VIP HERO
     ========================= */

  vipHero: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.35)',
    marginBottom: 28,
  },

  vipGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(249,115,22,0.08)',
    top: -100,
    right: -60,
  },

  crownCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(249,115,22,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.35)',
    marginBottom: 12,
  },

  vipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(249,115,22,0.13)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.28)',
  },

  vipBadgeText: {
    color: Colors.primary[400],
    fontSize: 10,
    fontFamily: 'Cairo-Bold',
    letterSpacing: 1,
  },

  vipTitle: {
    color: Colors.dark.text,
    fontSize: 28,
    fontFamily: 'Cairo-Bold',
    marginTop: 7,
  },

  vipSubtitle: {
    color: Colors.dark.textMuted,
    fontSize: 13,
    fontFamily: 'Cairo-Regular',
    marginTop: 2,
    textAlign: 'center',
  },

  featuresContainer: {
    width: '100%',
    marginTop: 20,
    gap: 9,
  },

  featureRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.025)',
  },

  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(249,115,22,0.10)',
    marginRight: 9,
  },

  featureText: {
    flex: 1,
    color: Colors.dark.text,
    fontSize: 13,
    fontFamily: 'Cairo-Regular',
  },

  /* =========================
     SECTIONS
     ========================= */

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 13,
  },

  sectionTitle: {
    color: Colors.dark.text,
    fontSize: 20,
    fontFamily: 'Cairo-Bold',
  },

  sectionSubtitle: {
    color: Colors.dark.textMuted,
    fontSize: 12,
    fontFamily: 'Cairo-Regular',
    marginTop: 1,
  },

  loadingBox: {
    minHeight: 70,
    borderRadius: 15,
    backgroundColor: Colors.dark.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  loadingText: {
    color: Colors.dark.textMuted,
    fontSize: 12,
    marginTop: 7,
    fontFamily: 'Cairo-Regular',
  },

  /* =========================
     SUBSCRIPTIONS
     ========================= */

  subscriptionCard: {
    position: 'relative',
    overflow: 'hidden',
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 10,
    borderRadius: 17,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },

  subscriptionCardFeatured: {
    borderColor: Colors.primary[500],
    backgroundColor: 'rgba(249,115,22,0.07)',
  },

  bestValueBadge: {
    position: 'absolute',
    right: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderBottomLeftRadius: 9,
    backgroundColor: Colors.primary[500],
  },

  bestValueText: {
    color: Colors.dark.background,
    fontSize: 8,
    fontFamily: 'Cairo-Bold',
  },

  subscriptionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(249,115,22,0.10)',
    marginRight: 12,
  },

  subscriptionInfo: {
    flex: 1,
  },

  subscriptionTitle: {
    color: Colors.dark.text,
    fontSize: 16,
    fontFamily: 'Cairo-Bold',
  },

  subscriptionDescription: {
    color: Colors.dark.textMuted,
    fontSize: 10,
    fontFamily: 'Cairo-Regular',
    marginTop: 1,
  },

  subscriptionPrice: {
    color: Colors.primary[400],
    fontSize: 15,
    fontFamily: 'Cairo-Bold',
    marginTop: 3,
  },

  subscribeButton: {
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: Colors.primary[500],
    marginLeft: 7,
  },

  subscribeButtonText: {
    color: Colors.dark.background,
    fontSize: 11,
    fontFamily: 'Cairo-Bold',
  },

  /* =========================
     COINS
     ========================= */

  coinsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  coinCard: {
    position: 'relative',
    overflow: 'hidden',
    width: '48.5%',
    minHeight: 190,
    marginBottom: 11,
    padding: 14,
    borderRadius: 17,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },

  coinCardPopular: {
    borderColor: 'rgba(249,115,22,0.55)',
  },

  coinBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderBottomLeftRadius: 9,
    backgroundColor: Colors.primary[500],
  },

  coinBadgeText: {
    color: Colors.dark.background,
    fontSize: 7,
    fontFamily: 'Cairo-Bold',
  },

  coinIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(250,204,21,0.09)',
    marginBottom: 10,
  },

  coinAmount: {
    color: Colors.dark.text,
    fontSize: 16,
    fontFamily: 'Cairo-Bold',
  },

  coinDescription: {
    color: Colors.dark.textMuted,
    fontSize: 10,
    lineHeight: 15,
    minHeight: 30,
    marginTop: 2,
    fontFamily: 'Cairo-Regular',
  },

  coinBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },

  coinPrice: {
    flex: 1,
    color: Colors.dark.text,
    fontSize: 13,
    fontFamily: 'Cairo-Bold',
  },

  buyButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: 'rgba(249,115,22,0.13)',
  },

  buyButtonText: {
    color: Colors.primary[400],
    fontSize: 10,
    fontFamily: 'Cairo-Bold',
  },

  /* =========================
     SECURITY
     ========================= */

  securityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 15,
    backgroundColor: 'rgba(249,115,22,0.055)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.16)',
    marginTop: 18,
  },

  securityIcon: {
    width: 43,
    height: 43,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(249,115,22,0.10)',
    marginRight: 11,
  },

  securityTextContainer: {
    flex: 1,
  },

  securityTitle: {
    color: Colors.dark.text,
    fontSize: 13,
    fontFamily: 'Cairo-Bold',
    marginBottom: 2,
  },

  securityText: {
    color: Colors.dark.textMuted,
    fontSize: 10,
    lineHeight: 15,
    fontFamily: 'Cairo-Regular',
  },

  /* =========================
     BENEFITS
     ========================= */

  benefitsCard: {
    marginTop: 12,
    padding: 16,
    borderRadius: 15,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },

  benefitsTitle: {
    color: Colors.dark.text,
    fontSize: 15,
    fontFamily: 'Cairo-Bold',
    marginBottom: 11,
  },

  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },

  checkCircle: {
    width: 21,
    height: 21,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary[500],
    marginRight: 9,
  },

  benefitText: {
    color: Colors.dark.textMuted,
    fontSize: 12,
    fontFamily: 'Cairo-Regular',
  },

  /* =========================
     PROCESSING
     ========================= */

  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    gap: 8,
  },

  processingText: {
    color: Colors.primary[400],
    fontSize: 12,
    fontFamily: 'Cairo-Regular',
  },

  footerNote: {
    color: Colors.dark.textMuted,
    fontSize: 9,
    lineHeight: 14,
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
    fontFamily: 'Cairo-Regular',
  },

  bottomSpace: {
    height: 25,
  },
});
