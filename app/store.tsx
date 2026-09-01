import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useIAP, type Purchase } from 'expo-iap';
import { ChevronLeft, Coins, Crown } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/lib/theme';

const COIN_IDS = [
  'dramarush_coins_100',
  'dramarush_coins_550',
  'dramarush_coins_1200',
  'dramarush_coins_2500',
];
const SUB_IDS = ['dramarush_premium_monthly', 'dramarush_premium_yearly'];

const coinLabels: Record<string, string> = {
  dramarush_coins_100: '100 Coins',
  dramarush_coins_550: '550 Coins',
  dramarush_coins_1200: '1,200 Coins',
  dramarush_coins_2500: '2,500 Coins',
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
        const purchaseToken = purchase.purchaseToken || purchase.transactionId;
        if (!purchaseToken) throw new Error('Google Play did not return a purchase token.');

        const { data, error } = await supabase.functions.invoke('verify-google-purchase', {
          body: {
            productId,
            purchaseToken,
            productKind: isSub ? 'subscription' : 'product',
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        await finishTransaction({ purchase, isConsumable: !isSub });
        Alert.alert('تمت العملية', isSub ? 'تم تفعيل اشتراكك.' : 'تمت إضافة العملات إلى حسابك.');
      } catch (e) {
        Alert.alert('تعذر تأكيد الدفع', e instanceof Error ? e.message : 'حاول مرة أخرى.');
      } finally {
        setBusy(false);
      }
    },
    onPurchaseError: (error) => {
      setBusy(false);
      if (String(error?.code || '').toLowerCase().includes('cancel')) return;
      Alert.alert('فشل الشراء', error?.message || 'تعذر إتمام العملية.');
    },
  });

  useEffect(() => {
    if (!connected) return;
    fetchProducts({ skus: COIN_IDS, type: 'in-app' }).catch(() => {});
    fetchProducts({ skus: SUB_IDS, type: 'subs' }).catch(() => {});
  }, [connected, fetchProducts]);

  const buy = async (id: string, subscription = false) => {
    setBusy(true);
    try {
      await requestPurchase({
        request: { google: subscription ? { skus: [id] } : { skus: [id] } },
        type: subscription ? 'subs' : 'in-app',
      });
    } catch (e) {
      setBusy(false);
      Alert.alert('فشل الشراء', e instanceof Error ? e.message : 'تعذر بدء عملية الدفع.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <ChevronLeft size={24} color={Colors.dark.text} />
        </TouchableOpacity>
        <Text style={styles.title}>المتجر</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>شراء العملات</Text>
        {!connected && <Text style={styles.muted}>جاري الاتصال بـ Google Play...</Text>}
        {products.map((p) => (
          <TouchableOpacity key={p.id} style={styles.card} disabled={busy} onPress={() => buy(p.id)}>
            <View style={styles.icon}><Coins size={22} color={Colors.warning[400]} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{coinLabels[p.id] || p.title}</Text>
              <Text style={styles.price}>{p.displayPrice}</Text>
            </View>
            <Text style={styles.buy}>شراء</Text>
          </TouchableOpacity>
        ))}

        <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Premium</Text>
        {subscriptions.map((s) => (
          <TouchableOpacity key={s.id} style={styles.card} disabled={busy} onPress={() => buy(s.id, true)}>
            <View style={styles.icon}><Crown size={22} color={Colors.primary[400]} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{s.id.includes('yearly') ? 'اشتراك سنوي' : 'اشتراك شهري'}</Text>
              <Text style={styles.price}>{s.displayPrice}</Text>
            </View>
            <Text style={styles.buy}>اشتراك</Text>
          </TouchableOpacity>
        ))}
        {busy && <ActivityIndicator style={{ marginTop: 20 }} color={Colors.primary[400]} />}
        <Text style={styles.note}>يتم التحقق من كل عملية شراء على الخادم قبل إضافة العملات أو تفعيل الاشتراك.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.background },
  header: { height: 60, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: Colors.dark.border },
  back: { padding: 8 },
  title: { color: Colors.dark.text, fontSize: 20, fontWeight: '700', marginLeft: 8 },
  content: { padding: 16 },
  sectionTitle: { color: Colors.dark.text, fontSize: 20, fontWeight: '800', marginBottom: 12 },
  muted: { color: Colors.dark.textMuted, marginBottom: 12 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.dark.surface, borderRadius: 14, padding: 15, marginBottom: 10, borderWidth: 1, borderColor: Colors.dark.border },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.dark.background, marginRight: 12 },
  cardTitle: { color: Colors.dark.text, fontSize: 16, fontWeight: '700' },
  price: { color: Colors.dark.textMuted, marginTop: 4 },
  buy: { color: Colors.primary[400], fontWeight: '800' },
  note: { color: Colors.dark.textMuted, fontSize: 12, lineHeight: 18, marginTop: 24, textAlign: 'center' },
});
