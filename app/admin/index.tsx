import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Colors } from '@/lib/theme';
import type { Series, Episode, Category } from '@/lib/types';
import {
  ChevronLeft,
  Plus,
  Edit3,
  Trash2,
  Film,
  Users,
  Eye,
  TrendingUp,
  DollarSign,
  Crown,
  Coins,
  Wallet,
  ArrowDownToLine,
  RefreshCw,
  LayoutGrid,
  X,
} from 'lucide-react-native';

type Tab = 'stats' | 'series' | 'episodes' | 'categories';

export default function AdminScreen() {
  const { session, profile, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('stats');
  const [loading, setLoading] = useState(true);

  if (!session?.user || !isAdmin) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={24} color={Colors.dark.text} strokeWidth={2} />
          </TouchableOpacity>
        </View>
        <View style={styles.accessDenied}>
          <Text style={styles.accessDeniedText}>Access Denied</Text>
          <Text style={styles.accessDeniedSub}>You need admin privileges to access this page.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={24} color={Colors.dark.text} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
      </View>

      <View style={styles.tabsRow}>
        <TabButton label="Stats" active={activeTab === 'stats'} onPress={() => setActiveTab('stats')} />
        <TabButton label="Series" active={activeTab === 'series'} onPress={() => setActiveTab('series')} />
        <TabButton label="Episodes" active={activeTab === 'episodes'} onPress={() => setActiveTab('episodes')} />
        <TabButton label="Categories" active={activeTab === 'categories'} onPress={() => setActiveTab('categories')} />
      </View>

      {activeTab === 'stats' && <StatsTab />}
      {activeTab === 'series' && <SeriesTab />}
      {activeTab === 'episodes' && <EpisodesTab />}
      {activeTab === 'categories' && <CategoriesTab />}
    </View>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.tab, active && styles.tabActive]}
      onPress={onPress}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ============ OWNER DASHBOARD ============
function StatsTab() {
  const [stats, setStats] = useState({
    users: 0,
    totalViews: 0,
    topSeries: [] as any[],
    topEpisodes: [] as any[],
    coinsSold: 0,
    revenue: 0,
    withdrawn: 0,
    withdrawable: 0,
    pendingWithdrawals: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState('bank_transfer');
  const [withdrawDestination, setWithdrawDestination] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  const load = useCallback(async () => {
    const [metricsRes, seriesRes, episodesRes, withdrawalsRes] = await Promise.all([
      supabase.rpc('owner_metrics'),
      supabase.from('series').select('title, view_count').order('view_count', { ascending: false }).limit(5),
      supabase.from('episodes').select('title, episode_number, view_count, series:series(title)').order('view_count', { ascending: false }).limit(5),
      supabase.from('revenue_withdrawals').select('amount, status'),
    ]);

    if (metricsRes.error || seriesRes.error || episodesRes.error || withdrawalsRes.error) {
      const first = metricsRes.error || seriesRes.error || episodesRes.error || withdrawalsRes.error;
      Alert.alert('Dashboard error', first?.message || 'Could not load dashboard');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const m = (metricsRes.data || {}) as any;
    const withdrawals = withdrawalsRes.data || [];
    setStats({
      users: Number(m.users || 0),
      totalViews: Number(m.total_views || 0),
      topSeries: (seriesRes.data as any[]) || [],
      topEpisodes: (episodesRes.data as any[]) || [],
      coinsSold: Number(m.coins_sold || 0),
      revenue: Number(m.revenue || 0),
      withdrawn: Number(m.withdrawn || 0),
      pendingWithdrawals: Number(m.pending_withdrawals || 0),
      withdrawable: Number(m.withdrawable || 0),
    });
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
  };

  const requestWithdrawal = async () => {
    const amount = Number(withdrawAmount.replace(',', '.'));
    if (!amount || amount <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid withdrawal amount.');
      return;
    }
    if (amount > stats.withdrawable) {
      Alert.alert('Insufficient balance', `Maximum available: $${stats.withdrawable.toFixed(2)}`);
      return;
    }
    if (!withdrawDestination.trim()) {
      Alert.alert('Destination required', 'Enter your bank account or payout destination.');
      return;
    }

    setWithdrawing(true);
    const { error } = await supabase.from('revenue_withdrawals').insert({
      amount: Number(amount.toFixed(2)),
      method: withdrawMethod,
      destination: withdrawDestination.trim(),
      status: 'pending',
    });
    setWithdrawing(false);
    if (error) {
      Alert.alert('Withdrawal failed', error.message);
      return;
    }
    setWithdrawAmount('');
    Alert.alert('Request submitted', 'Your withdrawal request was created. It must be processed by the configured payout provider.');
    await load();
  };

  if (loading) return <View style={styles.tabContainer} />;

  return (
    <ScrollView style={styles.tabContainer} contentContainerStyle={styles.statsContent}>
      <View style={styles.dashboardHeaderRow}>
        <View>
          <Text style={styles.dashboardTitle}>Owner Dashboard</Text>
          <Text style={styles.dashboardSubtitle}>Private financial and audience overview</Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={refresh} disabled={refreshing}>
          <RefreshCw size={18} color={Colors.dark.text} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <View style={styles.statsGrid}>
        <StatCard icon={<Users size={22} color={Colors.secondary[400]} strokeWidth={2} />} value={stats.users} label="Users" />
        <StatCard icon={<Eye size={22} color={Colors.primary[400]} strokeWidth={2} />} value={stats.totalViews.toLocaleString()} label="Total Episode Views" />
        <StatCard icon={<Coins size={22} color={Colors.warning[400]} strokeWidth={2} />} value={stats.coinsSold.toLocaleString()} label="Coins Sold" />
        <StatCard icon={<DollarSign size={22} color={Colors.success[400]} strokeWidth={2} />} value={`$${stats.revenue.toFixed(2)}`} label="Gross Revenue" />
      </View>

      <View style={styles.balanceCard}>
        <View style={styles.balanceIcon}><Wallet size={24} color={Colors.dark.text} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.balanceLabel}>Available to withdraw</Text>
          <Text style={styles.balanceValue}>${stats.withdrawable.toFixed(2)}</Text>
          <Text style={styles.balanceSub}>Paid out: ${stats.withdrawn.toFixed(2)} · Pending: ${stats.pendingWithdrawals.toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.withdrawCard}>
        <Text style={styles.statsSectionTitle}>Withdraw Revenue</Text>
        <Text style={styles.withdrawHint}>Enter the amount and your payout destination. The app creates a secure withdrawal request. Google Play pays app developers through its payout system; this request is for a separate payout provider only when you configure one.</Text>
        <FormField label="Amount (USD)" value={withdrawAmount} onChangeText={setWithdrawAmount} placeholder="25.00" keyboardType="numeric" />
        <FormField label="Payout destination" value={withdrawDestination} onChangeText={setWithdrawDestination} placeholder="Bank account / payout account" />
        <View style={styles.methodRow}>
          {['bank_transfer', 'paypal'].map((method) => (
            <TouchableOpacity key={method} style={[styles.methodChip, withdrawMethod === method && styles.methodChipActive]} onPress={() => setWithdrawMethod(method)}>
              <Text style={[styles.methodChipText, withdrawMethod === method && styles.methodChipTextActive]}>{method === 'paypal' ? 'PayPal' : 'Bank Transfer'}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity style={styles.withdrawButton} onPress={requestWithdrawal} disabled={withdrawing}>
          <ArrowDownToLine size={19} color={Colors.dark.text} />
          <Text style={styles.withdrawButtonText}>{withdrawing ? 'Submitting...' : 'Request Withdrawal'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsSection}>
        <Text style={styles.statsSectionTitle}>Most Watched Series</Text>
        {stats.topSeries.map((s, i) => (
          <View key={s.title + i} style={styles.rankRow}>
            <Text style={styles.rankNumber}>{i + 1}</Text>
            <Text style={styles.rankTitle} numberOfLines={1}>{s.title}</Text>
            <Text style={styles.rankValue}>{Number(s.view_count || 0).toLocaleString()}</Text>
          </View>
        ))}
      </View>

      <View style={styles.statsSection}>
        <Text style={styles.statsSectionTitle}>Most Watched Episodes</Text>
        {stats.topEpisodes.map((e, i) => (
          <View key={e.title + i} style={styles.rankRow}>
            <Text style={styles.rankNumber}>{i + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.rankTitle} numberOfLines={1}>Ep {e.episode_number}: {e.title}</Text>
              <Text style={styles.rankSubTitle} numberOfLines={1}>{e.series?.title || 'Unknown series'}</Text>
            </View>
            <Text style={styles.rankValue}>{Number(e.view_count || 0).toLocaleString()}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ============ SERIES TAB ============
function SeriesTab() {
  const [series, setSeries] = useState<Series[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Series | null>(null);
  const [showForm, setShowForm] = useState(false);

  const fetchSeries = useCallback(async () => {
    try {
      const { data } = await supabase.from('series').select('*').order('sort_order', { ascending: true });
      setSeries((data as Series[]) || []);
      const { data: cats } = await supabase.from('categories').select('*').order('sort_order');
      setCategories((cats as Category[]) || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSeries();
  }, [fetchSeries]);

  const handleDelete = (s: Series) => {
    Alert.alert('Delete Series', `Delete "${s.title}"? This will also delete all its episodes.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('series').delete().eq('id', s.id);
          fetchSeries();
        },
      },
    ]);
  };

  if (loading) return <View style={styles.tabContainer} />;

  if (showForm) {
    return <SeriesForm series={editing} categories={categories} onClose={() => { setShowForm(false); setEditing(null); }} onSaved={fetchSeries} />;
  }

  return (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => { setEditing(null); setShowForm(true); }}
      >
        <Plus size={20} color={Colors.dark.text} strokeWidth={2} />
        <Text style={styles.addButtonText}>Add Series</Text>
      </TouchableOpacity>
      <FlatList
        data={series}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.adminRow}>
            <View style={styles.adminRowInfo}>
              <Text style={styles.adminRowTitle}>{item.title}</Text>
              <Text style={styles.adminRowSub}>
                {item.total_episodes} eps | {item.status === 'completed' ? 'Completed' : 'Ongoing'} | {item.is_free ? 'Free' : 'Paid'}
              </Text>
            </View>
            <View style={styles.adminRowActions}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => { setEditing(item); setShowForm(true); }}
              >
                <Edit3 size={16} color={Colors.secondary[400]} strokeWidth={2} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDelete(item)}
              >
                <Trash2 size={16} color={Colors.error[400]} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

function SeriesForm({
  series,
  categories,
  onClose,
  onSaved,
}: {
  series: Series | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(series?.title || '');
  const [description, setDescription] = useState(series?.description || '');
  const [coverUrl, setCoverUrl] = useState(series?.cover_image_url || '');
  const [bannerUrl, setBannerUrl] = useState(series?.banner_image_url || '');
  const [categoryId, setCategoryId] = useState(series?.category_id || '');
  const [rating, setRating] = useState(String(series?.rating || '0'));
  const [totalEpisodes, setTotalEpisodes] = useState(String(series?.total_episodes || '0'));
  const [status, setStatus] = useState<'ongoing' | 'completed'>(series?.status || 'ongoing');
  const [isFree, setIsFree] = useState(series?.is_free || false);
  const [isFeatured, setIsFeatured] = useState(series?.is_featured || false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Title is required');
      return;
    }
    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim(),
      cover_image_url: coverUrl.trim() || null,
      banner_image_url: bannerUrl.trim() || null,
      category_id: categoryId || null,
      rating: parseFloat(rating) || 0,
      total_episodes: parseInt(totalEpisodes) || 0,
      status,
      is_free: isFree,
      is_featured: isFeatured,
    };

    if (series) {
      await supabase.from('series').update(payload).eq('id', series.id);
    } else {
      await supabase.from('series').insert(payload);
    }
    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <ScrollView style={styles.tabContainer} contentContainerStyle={styles.formContent}>
      <View style={styles.formHeader}>
        <Text style={styles.formTitle}>{series ? 'Edit Series' : 'Add Series'}</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <X size={22} color={Colors.dark.text} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <FormField label="Title" value={title} onChangeText={setTitle} placeholder="Series title" />
      <FormField label="Description" value={description} onChangeText={setDescription} placeholder="Description" multiline />
      <FormField label="Cover Image URL" value={coverUrl} onChangeText={setCoverUrl} placeholder="https://..." />
      <FormField label="Banner Image URL" value={bannerUrl} onChangeText={setBannerUrl} placeholder="https://..." />

      <Text style={styles.formLabel}>Category</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryPicker}>
        {categories.map((c) => (
          <TouchableOpacity
            key={c.id}
            style={[styles.categoryChip, categoryId === c.id && styles.categoryChipActive]}
            onPress={() => setCategoryId(c.id)}
          >
            <Text style={[styles.categoryChipText, categoryId === c.id && styles.categoryChipTextActive]}>
              {c.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FormField label="Rating (0-10)" value={rating} onChangeText={setRating} placeholder="8.5" keyboardType="numeric" />
      <FormField label="Total Episodes" value={totalEpisodes} onChangeText={setTotalEpisodes} placeholder="12" keyboardType="numeric" />

      <Text style={styles.formLabel}>Status</Text>
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleButton, status === 'ongoing' && styles.toggleButtonActive]}
          onPress={() => setStatus('ongoing')}
        >
          <Text style={[styles.toggleText, status === 'ongoing' && styles.toggleTextActive]}>Ongoing</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleButton, status === 'completed' && styles.toggleButtonActive]}
          onPress={() => setStatus('completed')}
        >
          <Text style={[styles.toggleText, status === 'completed' && styles.toggleTextActive]}>Completed</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.checkboxRow} onPress={() => setIsFree(!isFree)}>
        <View style={[styles.checkbox, isFree && styles.checkboxActive]}>
          {isFree && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={styles.checkboxLabel}>Free Series</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.checkboxRow} onPress={() => setIsFeatured(!isFeatured)}>
        <View style={[styles.checkbox, isFeatured && styles.checkboxActive]}>
          {isFeatured && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={styles.checkboxLabel}>Featured</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ============ EPISODES TAB ============
function EpisodesTab() {
  const [series, setSeries] = useState<Series[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<Series | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Episode | null>(null);

  const fetchSeries = useCallback(async () => {
    const { data } = await supabase.from('series').select('id, title').order('title');
    setSeries((data as Series[]) || []);
    setLoading(false);
  }, []);

  const fetchEpisodes = useCallback(async (seriesId: string) => {
    const { data } = await supabase
      .from('episodes')
      .select('id, series_id, episode_number, title, description, thumbnail_url, video_path, duration, is_free, coin_price, view_count, created_at')
      .eq('series_id', seriesId)
      .order('episode_number', { ascending: true });
    setEpisodes((data as Episode[]) || []);
  }, []);

  useEffect(() => {
    fetchSeries();
  }, [fetchSeries]);

  useEffect(() => {
    if (selectedSeries) fetchEpisodes(selectedSeries.id);
  }, [selectedSeries, fetchEpisodes]);

  const handleDelete = (ep: Episode) => {
    Alert.alert('Delete Episode', `Delete "${ep.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('episodes').delete().eq('id', ep.id);
          if (selectedSeries) fetchEpisodes(selectedSeries.id);
        },
      },
    ]);
  };

  if (loading) return <View style={styles.tabContainer} />;

  if (showForm && selectedSeries) {
    return (
      <EpisodeForm
        episode={editing}
        seriesId={selectedSeries.id}
        nextEpisodeNumber={episodes.length + 1}
        onClose={() => { setShowForm(false); setEditing(null); }}
        onSaved={() => { fetchEpisodes(selectedSeries.id); setShowForm(false); setEditing(null); }}
      />
    );
  }

  return (
    <View style={styles.tabContainer}>
      <Text style={styles.formLabel}>Select Series</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryPicker}>
        {series.map((s) => (
          <TouchableOpacity
            key={s.id}
            style={[styles.categoryChip, selectedSeries?.id === s.id && styles.categoryChipActive]}
            onPress={() => setSelectedSeries(s)}
          >
            <Text style={[styles.categoryChipText, selectedSeries?.id === s.id && styles.categoryChipTextActive]}>
              {s.title}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {selectedSeries && (
        <>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => { setEditing(null); setShowForm(true); }}
          >
            <Plus size={20} color={Colors.dark.text} strokeWidth={2} />
            <Text style={styles.addButtonText}>Add Episode</Text>
          </TouchableOpacity>

          <FlatList
            data={episodes}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.adminRow}>
                <View style={styles.adminRowInfo}>
                  <Text style={styles.adminRowTitle}>Ep {item.episode_number}: {item.title}</Text>
                  <Text style={styles.adminRowSub}>
                    {item.is_free ? 'Free' : `${item.coin_price} coins`} | {item.duration}s
                  </Text>
                </View>
                <View style={styles.adminRowActions}>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => { setEditing(item); setShowForm(true); }}
                  >
                    <Edit3 size={16} color={Colors.secondary[400]} strokeWidth={2} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDelete(item)}
                  >
                    <Trash2 size={16} color={Colors.error[400]} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        </>
      )}
    </View>
  );
}

function EpisodeForm({
  episode,
  seriesId,
  nextEpisodeNumber,
  onClose,
  onSaved,
}: {
  episode: Episode | null;
  seriesId: string;
  nextEpisodeNumber: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(episode?.title || '');
  const [description, setDescription] = useState(episode?.description || '');
  const [thumbnailUrl, setThumbnailUrl] = useState(episode?.thumbnail_url || '');
  const [videoPath, setVideoPath] = useState(episode?.video_path || '');
  const [selectedVideoName, setSelectedVideoName] = useState('');
  const [episodeNumber, setEpisodeNumber] = useState(String(episode?.episode_number || nextEpisodeNumber));
  const [duration, setDuration] = useState(String(episode?.duration || '180'));
  const [isFree, setIsFree] = useState(episode?.is_free || false);
  const [coinPrice, setCoinPrice] = useState(String(episode?.coin_price || '50'));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const pickAndUploadVideo = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'video/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setUploading(true);
      const safeName = (asset.name || 'video.mp4').replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `episodes/${seriesId}/${Date.now()}-${safeName}`;
      const response = await fetch(asset.uri);
      const arrayBuffer = await response.arrayBuffer();
      const { error: uploadError } = await supabase.storage.from('videos').upload(path, arrayBuffer, {
        contentType: asset.mimeType || 'video/mp4',
        upsert: false,
      });
      if (uploadError) throw uploadError;
      setVideoPath(path);
      setSelectedVideoName(asset.name || path);
      Alert.alert('Upload complete', 'The video was uploaded to private storage.');
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Unable to upload video.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Title is required');
      return;
    }
    if (!videoPath.trim()) {
      Alert.alert('Video required', 'Choose and upload the episode video first.');
      return;
    }
    setSaving(true);
    const payload = {
      series_id: seriesId,
      episode_number: parseInt(episodeNumber) || nextEpisodeNumber,
      title: title.trim(),
      description: description.trim(),
      thumbnail_url: thumbnailUrl.trim() || null,
      video_path: videoPath.trim(),
      duration: parseInt(duration) || 0,
      is_free: isFree,
      coin_price: isFree ? 0 : (parseInt(coinPrice) || 0),
    };

    const result = episode
      ? await supabase.from('episodes').update(payload).eq('id', episode.id)
      : await supabase.from('episodes').insert(payload);
    setSaving(false);
    if (result.error) {
      Alert.alert('Save failed', result.error.message);
      return;
    }
    onSaved();
  };

  return (
    <ScrollView style={styles.tabContainer} contentContainerStyle={styles.formContent}>
      <View style={styles.formHeader}>
        <Text style={styles.formTitle}>{episode ? 'Edit Episode' : 'Add Episode'}</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <X size={22} color={Colors.dark.text} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <FormField label="Episode Number" value={episodeNumber} onChangeText={setEpisodeNumber} placeholder="1" keyboardType="numeric" />
      <FormField label="Title" value={title} onChangeText={setTitle} placeholder="Episode title" />
      <FormField label="Description" value={description} onChangeText={setDescription} placeholder="Description" multiline />
      <FormField label="Thumbnail URL" value={thumbnailUrl} onChangeText={setThumbnailUrl} placeholder="https://..." />
      <TouchableOpacity style={styles.uploadButton} onPress={pickAndUploadVideo} disabled={uploading}>
        {uploading ? <ActivityIndicator size="small" color={Colors.dark.text} /> : <Film size={18} color={Colors.dark.text} strokeWidth={2} />}
        <Text style={styles.uploadButtonText}>{uploading ? 'Uploading video...' : 'Choose & Upload Video'}</Text>
      </TouchableOpacity>
      <Text style={styles.uploadStatus}>
        {selectedVideoName ? `Uploaded: ${selectedVideoName}` : videoPath ? 'Private video already uploaded' : 'No video uploaded'}
      </Text>
      <FormField label="Duration (seconds)" value={duration} onChangeText={setDuration} placeholder="180" keyboardType="numeric" />

      <TouchableOpacity style={styles.checkboxRow} onPress={() => setIsFree(!isFree)}>
        <View style={[styles.checkbox, isFree && styles.checkboxActive]}>
          {isFree && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={styles.checkboxLabel}>Free Episode</Text>
      </TouchableOpacity>

      {!isFree && (
        <FormField label="Coin Price" value={coinPrice} onChangeText={setCoinPrice} placeholder="50" keyboardType="numeric" />
      )}

      <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
        <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ============ CATEGORIES TAB ============
function CategoriesTab() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase.from('categories').select('*').order('sort_order');
    setCategories((data as Category[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleAdd = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    const slug = name.trim().toLowerCase().replace(/\s+/g, '-');
    await supabase.from('categories').insert({
      name: name.trim(),
      slug,
      image_url: imageUrl.trim() || null,
    });
    setName('');
    setImageUrl('');
    setShowForm(false);
    fetchCategories();
  };

  const handleDelete = (c: Category) => {
    Alert.alert('Delete Category', `Delete "${c.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('categories').delete().eq('id', c.id);
          fetchCategories();
        },
      },
    ]);
  };

  if (loading) return <View style={styles.tabContainer} />;

  return (
    <View style={styles.tabContainer}>
      {showForm ? (
        <View style={styles.formContent}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>Add Category</Text>
            <TouchableOpacity onPress={() => setShowForm(false)} style={styles.closeButton}>
              <X size={22} color={Colors.dark.text} strokeWidth={2} />
            </TouchableOpacity>
          </View>
          <FormField label="Name" value={name} onChangeText={setName} placeholder="Category name" />
          <FormField label="Image URL" value={imageUrl} onChangeText={setImageUrl} placeholder="https://..." />
          <TouchableOpacity style={styles.saveButton} onPress={handleAdd}>
            <Text style={styles.saveButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowForm(true)}>
            <Plus size={20} color={Colors.dark.text} strokeWidth={2} />
            <Text style={styles.addButtonText}>Add Category</Text>
          </TouchableOpacity>
          <FlatList
            data={categories}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.adminRow}>
                <View style={styles.adminRowInfo}>
                  <Text style={styles.adminRowTitle}>{item.name}</Text>
                  <Text style={styles.adminRowSub}>/{item.slug}</Text>
                </View>
                <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item)}>
                  <Trash2 size={16} color={Colors.error[400]} strokeWidth={2} />
                </TouchableOpacity>
              </View>
            )}
          />
        </>
      )}
    </View>
  );
}

// ============ SHARED FORM COMPONENT ============
function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric' | 'email-address';
}) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        style={[styles.formInput, multiline && styles.formInputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.dark.textMuted}
        multiline={multiline}
        keyboardType={keyboardType || 'default'}
        textAlign="left"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    paddingTop: Platform.OS === 'android' ? 40 : 56,
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.surface,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
  },
  accessDenied: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  accessDeniedText: {
    fontSize: 22,
    fontFamily: 'Cairo-Bold',
    color: Colors.error[400],
  },
  accessDeniedSub: {
    fontSize: 14,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textSecondary,
    textAlign: 'center',
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
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
  tabContainer: {
    flex: 1,
  },
  statsContent: {
    padding: 16,
    paddingBottom: 32,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
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
    fontSize: 22,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textSecondary,
  },
  statsSection: {
    marginBottom: 24,
  },
  statsSectionTitle: {
    fontSize: 16,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
    marginBottom: 12,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  rankNumber: {
    width: 24,
    fontSize: 16,
    fontFamily: 'Cairo-Bold',
    color: Colors.primary[400],
  },
  rankTitle: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Cairo-SemiBold',
    color: Colors.dark.text,
  },
  rankValue: {
    fontSize: 13,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textSecondary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary[600],
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    margin: 16,
  },
  addButtonText: {
    fontSize: 14,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
  },
  listContent: {
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 32,
  },
  adminRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  adminRowInfo: {
    flex: 1,
    gap: 4,
  },
  adminRowTitle: {
    fontSize: 14,
    fontFamily: 'Cairo-SemiBold',
    color: Colors.dark.text,
  },
  adminRowSub: {
    fontSize: 12,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textSecondary,
  },
  adminRowActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.dark.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formContent: {
    padding: 16,
    paddingBottom: 32,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 20,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.surface,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 13,
    fontFamily: 'Cairo-SemiBold',
    color: Colors.dark.textSecondary,
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'android' ? 10 : 14,
    fontSize: 15,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.text,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  formInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  categoryPicker: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  categoryChipActive: {
    backgroundColor: Colors.primary[600],
    borderColor: Colors.primary[500],
  },
  categoryChipText: {
    fontSize: 13,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textSecondary,
  },
  categoryChipTextActive: {
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: Colors.primary[600],
    borderColor: Colors.primary[500],
  },
  toggleText: {
    fontSize: 14,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.textSecondary,
  },
  toggleTextActive: {
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.dark.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: Colors.primary[600],
    borderColor: Colors.primary[500],
  },
  checkmark: {
    color: Colors.dark.text,
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 14,
    fontFamily: 'Cairo-Regular',
    color: Colors.dark.text,
  },
  uploadButton: {
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: Colors.secondary[600],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  uploadButtonText: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: '700',
  },
  uploadStatus: {
    color: Colors.dark.textMuted,
    fontSize: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  saveButton: {
    backgroundColor: Colors.primary[600],
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontFamily: 'Cairo-Bold',
    color: Colors.dark.text,
  },
});
