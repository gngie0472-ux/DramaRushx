import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  RefreshControl,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Colors } from '@/lib/theme';
import type { Transaction, Subscription } from '@/lib/types';
import { ErrorState } from '@/components/States';
import {
  User as UserIcon,
  Coins,
  Crown,
  LogOut,
  ChevronLeft,
  Shield,
  Wallet,
  History,
  Settings,
  Bell,
  HelpCircle,
  Film,
} from 'lucide-react-native';

export default function ProfileScreen() {
  const { session, profile, signOut, isAdmin, refreshProfile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUserData = useCallback(async () => {
    if (!session?.user) return;
    setLoading(true);
    try {
      const [txRes, subRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', session.user.id)
          .maybeSingle(),
      ]);
      if (!txRes.error) setTransactions((txRes.data as Transaction[]) || []);
      if (!subRes.error) setSubscription((subRes.data as Subscription) || null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useEffect(() => {
    if (session?.user) {
      fetchUserData();
    }
  }, [session, fetchUserData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refreshProfile();
    fetchUserData();
  }, [refreshProfile, fetchUserData]);

  const handleSignOut = () => {
    Alert.alert('تسجيل الخروج', 'هل أنت متأكد من تسجيل الخروج؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'تسجيل الخروج', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  if (!session?.user) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>حسابي</Text>
        </View>
        <View style={styles.authPrompt}>
          <UserIcon size={56} color={Colors.dark.textMuted} strokeWidth={1.5} />
          <Text style={styles.authPromptText}>سجل الدخول للوصول إلى حسابك</Text>
          <View style={styles.authButtons}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push('/auth/login')}
            >
              <Text style={styles.primaryButtonText}>تسجيل الدخول</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.push('/auth/signup')}
            >
              <Text style={styles.secondaryButtonText}>إنشاء حساب</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  const hasActiveSub = subscription?.status === 'active' && new Date(subscription.expiry_date) > new Date();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary[500]} />}
    >
      <View style={styles.profileHeader}>
        <View style={styles.avatarContainer}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <UserIcon size={32} color={Colors.dark.text} strokeWidth={2} />
            </View>
          )}
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{profile?.name || 'مستخدم'}</Text>
          <Text style={styles.profileEmail}>{session.user.email}</Text>
          {isAdmin && (
            <View style={styles.adminBadge}>
              <Shield size={12} color={Colors.warning[400]} strokeWidth={2.5} />
              <Text style={styles.adminBadgeText}>مدير</Text>
            </View>
          )}
        </View>
      </View>

      {/* Coins & Subscription cards */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <Coins size={22} color={Colors.primary[500]} strokeWidth={2} />
          </View>
          <Text style={styles.statValue}>{profile?.coins ?? 0}</Text>
          <Text style={styles.statLabel}>عملة</Text>
        </View>
        <View style={styles.statCard}>
          <View style={styles.statIconContainer}>
            <Crown size={22} color={hasActiveSub ? Colors.warning[400] : Colors.dark.textMuted} strokeWidth={2} />
          </View>
          <Text style={styles.statValue}>{hasActiveSub ? 'مفعّل' : 'غير مفعّل'}</Text>
          <Text style={styles.statLabel}>الاشتراك</Text>
        </View>
      </View>

      {/* Subscription section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>الاشتراك</Text>
        {hasActiveSub ? (
          <View style={styles.subCard}>
            <Crown size={24} color={Colors.warning[400]} strokeWidth={2} />
            <View style={styles.subInfo}>
              <Text style={styles.subPlan}>
                {subscription!.plan === 'monthly' ? 'اشتراك شهري' : 'اشتراك سنوي'}
              </Text>
              <Text style={styles.subExpiry}>
                ينتهي في {new Date(subscription!.expiry_date).toLocaleDateString('ar')}
              </Text>
            </View>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>نشط</Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.subscribeButton}
            onPress={() => {
              router.push('/store');
            }}
          >
            <Crown size={20} color={Colors.dark.background} strokeWidth={2} />
            <Text style={styles.subscribeButtonText}>اشترك الآن لمشاهدة كل المحتوى</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Coins purchase */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>العملات</Text>
        <TouchableOpacity
          style={styles.coinsButton}
          onPress={() => {
            router.push('/store');
          }}
        >
          <Wallet size={20} color={Colors.primary[500]} strokeWidth={2} />
          <Text style={styles.coinsButtonText}>شراء عملات</Text>
          <ChevronLeft size={18} color={Colors.dark.textMuted} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* Recent transactions */}
      {transactions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>سجل العمليات</Text>
          {transactions.slice(0, 5).map((tx) => (
            <View key={tx.id} style={styles.txRow}>
              <View style={styles.txIconContainer}>
                {tx.coins >= 0 ? (
                  <Coins size={16} color={Colors.success[400]} strokeWidth={2} />
                ) : (
                  <Film size={16} color={Colors.error[400]} strokeWidth={2} />
                )}
              </View>
              <View style={styles.txInfo}>
                <Text style={styles.txDescription} numberOfLines={1}>
                  {tx.description || 'عملية'}
                </Text>
                <Text style={styles.txDate}>
                  {new Date(tx.created_at).toLocaleDateString('ar')}
                </Text>
              </View>
              <Text style={[styles.txAmount, { color: tx.coins >= 0 ? Colors.success[400] : Colors.error[400] }]}>
                {tx.coins >= 0 ? '+' : ''}{tx.coins}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Menu */}
      <View style={styles.section}>
        {isAdmin && (
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push('/admin')}
          >
            <View style={styles.menuIconContainer}>
              <Shield size={20} color={Colors.warning[400]} strokeWidth={2} />
            </View>
            <Text style={styles.menuText}>لوحة التحكم</Text>
            <ChevronLeft size={18} color={Colors.dark.textMuted} strokeWidth={2} />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('Coming Soon', 'Settings will be available soon')}>
          <View style={styles.menuIconContainer}>
            <Settings size={20} color={Colors.dark.textSecondary} strokeWidth={2} />
          </View>
          <Text style={styles.menuText}>Settings</Text>
          <ChevronLeft size={18} color={Colors.dark.textMuted} strokeWidth={2} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('قريباً', 'الإشعارات ستتوفر قريباً')}>
          <View style={styles.menuIconContainer}>
            <Bell size={20} color={Colors.dark.textSecondary} strokeWidth={2} />
          </View>
          <Text style={styles.menuText}>الإشعارات</Text>
          <ChevronLeft size={18} color={Colors.dark.textMuted} strokeWidth={2} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => Alert.alert('قريباً', 'المساعدة ستتوفر قريباً')}>
          <View style={styles.menuIconContainer}>
            <HelpCircle size={20} color={Colors.dark.textSecondary} strokeWidth={2} />
          </View>
          <Text style={styles.menuText}>المساعدة</Text>
          <ChevronLeft size={18} color={Colors.dark.textMuted} strokeWidth={2} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.menuItem, styles.signOutItem]} onPress={handleSignOut}>
          <View style={styles.menuIconContainer}>
            <LogOut size={20} color={Colors.error[400]} strokeWidth={2} />
          </View>
          <Text style={[styles.menuText, { color: Colors.error[400] }]}>تسجيل الخروج</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  content: {
    paddingBottom: 32,
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
  authButtons: {
    gap: 12,
    alignItems: 'center',
  },
  primaryButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: Colors.primary[600],
    borderRadius: 12,
  },
  primaryButtonText: {
    fontSize: 14,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
  },
  secondaryButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.dark.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  profileInfo: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    fontSize: 20,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
  },
  profileEmail: {
    fontSize: 13,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textSecondary,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  adminBadgeText: {
    fontSize: 11,
    fontFamily: 'Cairo-Bold',
    color: Colors.warning[400],
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.dark.surface,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.dark.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 18,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textSecondary,
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
    marginBottom: 12,
  },
  subCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.warning[400],
  },
  subInfo: {
    flex: 1,
    gap: 4,
  },
  subPlan: {
    fontSize: 15,
    fontFamily: 'Cairo-SemiBold',
    color: Colors.dark.text,
  },
  subExpiry: {
    fontSize: 12,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textSecondary,
  },
  activeBadge: {
    backgroundColor: Colors.success[600],
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activeBadgeText: {
    fontSize: 11,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
  },
  subscribeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.warning[500],
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    justifyContent: 'center',
  },
  subscribeButtonText: {
    fontSize: 14,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.background,
  },
  coinsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  coinsButtonText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Cairo-SemiBold',
    color: Colors.dark.text,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  txIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.dark.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txInfo: {
    flex: 1,
    gap: 2,
  },
  txDescription: {
    fontSize: 13,
    fontFamily: 'Cairo-SemiBold',
    color: Colors.dark.text,
  },
  txDate: {
    fontSize: 11,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textMuted,
  },
  txAmount: {
    fontSize: 14,
    fontFamily: 'Cairo-Bold',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.dark.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Cairo-SemiBold',
    color: Colors.dark.text,
  },
  signOutItem: {
    borderBottomWidth: 0,
  marginTop: 8,
  borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  bottomPadding: {
    height: 20,
  },
});
