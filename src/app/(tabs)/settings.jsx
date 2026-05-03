import React, { useState } from 'react';
import { Alert, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import * as StoreReview from 'expo-store-review';
import {
  Shield,
  FileText,
  Star,
  Mail,
  Crown,
  RotateCcw,
  ChevronRight,
  Sparkles,
} from 'lucide-react-native';
import { AppShell, COLORS } from '../../components/DesignSystem';

const PRIVACY_POLICY_URL =
  process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL || 'https://www.apple.com/legal/privacy/';
const TERMS_URL =
  process.env.EXPO_PUBLIC_TERMS_OF_USE_URL ||
  'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL || 'support@marathonplanner.app';
const PREMIUM_URL = process.env.EXPO_PUBLIC_PREMIUM_URL || '';

const openExternalUrl = async (url) => {
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      throw new Error(`Cannot open ${url}`);
    }
    await Linking.openURL(url);
  } catch (error) {
    Alert.alert('Unavailable', 'This link is not available right now.');
  }
};

const SettingsRow = ({ icon: Icon, title, subtitle, onPress, destructive = false }) => (
  <Pressable
    accessibilityRole="button"
    onPress={onPress}
    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
  >
    <View style={[styles.rowIcon, destructive && styles.rowIconAccent]}>
      <Icon size={18} color={destructive ? '#B45309' : COLORS.primary} />
    </View>
    <View style={styles.rowContent}>
      <Text style={styles.rowTitle}>{title}</Text>
      {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
    </View>
    <ChevronRight size={18} color={COLORS.mutedForeground} />
  </Pressable>
);

export default function SettingsScreen() {
  const [showPremium, setShowPremium] = useState(false);

  const appVersion = Constants.expoConfig?.version || '1.0.0';

  const rateUs = async () => {
    try {
      await StoreReview.requestReview();
    } catch (error) {
      Alert.alert('Rate Us', 'The in-app review flow is unavailable on this device.');
    }
  };

  const contactUs = async () => {
    const subject = encodeURIComponent('Support request');
    const body = encodeURIComponent('Hi Pace Runner support,\n\nI need help with:');
    await openExternalUrl(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`);
  };

  const restorePurchases = () => {
    Alert.alert(
      'Restore Purchases',
      'Restore purchases is ready for billing-provider integration. Connect your purchase SDK to enable it.',
    );
  };

  const openPremium = async () => {
    if (PREMIUM_URL) {
      await openExternalUrl(PREMIUM_URL);
      return;
    }
    setShowPremium(true);
  };

  return (
    <>
      <AppShell title="Settings" subtitle="Manage app preferences">
        

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Premium</Text>
          <View style={styles.card}>
            <SettingsRow
              icon={Crown}
              title="Upgrade Premium"
              subtitle="Unlock advanced analytics, coaching, and more"
              onPress={openPremium}
            />
            <View style={styles.divider} />
            <SettingsRow
              icon={RotateCcw}
              title="Restore Purchases"
              subtitle="Reapply your existing premium access"
              onPress={restorePurchases}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Support</Text>
          <View style={styles.card}>
            <SettingsRow
              icon={Star}
              title="Rate Us"
              subtitle="Leave a review in the App Store or Play Store"
              onPress={rateUs}
            />
            <View style={styles.divider} />
            <SettingsRow
              icon={Mail}
              title="Contact Us"
              subtitle={SUPPORT_EMAIL}
              onPress={contactUs}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Legal</Text>
          <View style={styles.card}>
            <SettingsRow
              icon={Shield}
              title="Privacy Policy"
              subtitle="How your data is handled"
              onPress={() => openExternalUrl(PRIVACY_POLICY_URL)}
            />
            <View style={styles.divider} />
            <SettingsRow
              icon={FileText}
              title="Terms of Use"
              subtitle="Rules and usage terms"
              onPress={() => openExternalUrl(TERMS_URL)}
            />
          </View>
        </View>

        <Text style={styles.footerText}>Built for everyday runners.</Text>
      </AppShell>

      <Modal
        visible={showPremium}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPremium(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowPremium(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalPill}>
              <Crown size={14} color="#FFFFFF" />
              <Text style={styles.modalPillText}>PREMIUM</Text>
            </View>
            <Text style={styles.modalTitle}>Upgrade your training</Text>
            <Text style={styles.modalSubtitle}>
              Premium unlocks advanced analytics, smarter training guidance, and more ways to stay consistent.
            </Text>

            <View style={styles.modalFeatureList}>
              <Text style={styles.modalFeature}>• Advanced analytics</Text>
              <Text style={styles.modalFeature}>• Smarter plan insights</Text>
              <Text style={styles.modalFeature}>• Priority support</Text>
            </View>

            <Pressable
              style={styles.modalPrimaryButton}
              onPress={() => {
                setShowPremium(false);
                Alert.alert('Premium', 'Connect your checkout or in-app purchase flow to complete this action.');
              }}
            >
              <Text style={styles.modalPrimaryText}>Get Premium</Text>
            </Pressable>

            <Pressable style={styles.modalSecondaryButton} onPress={() => setShowPremium(false)}>
              <Text style={styles.modalSecondaryText}>Maybe Later</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 20,
    marginBottom: 28,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  heroBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  versionText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '600',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 30,
    fontWeight: '700',
    marginBottom: 10,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    lineHeight: 22,
  },
  section: {
    marginBottom: 22,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: COLORS.workspaceBg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  rowPressed: {
    backgroundColor: '#F8FAFC',
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  rowIconAccent: {
    backgroundColor: '#FEF3C7',
  },
  rowContent: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.foreground,
    marginBottom: 4,
  },
  rowSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.mutedForeground,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: 72,
  },
  footerText: {
    textAlign: 'center',
    color: COLORS.mutedForeground,
    fontSize: 13,
    marginTop: 6,
    marginBottom: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
    justifyContent: 'flex-end',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#0F172A',
    borderRadius: 28,
    padding: 24,
  },
  modalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
  },
  modalPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
    marginBottom: 10,
  },
  modalSubtitle: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 18,
  },
  modalFeatureList: {
    gap: 8,
    marginBottom: 22,
  },
  modalFeature: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
  },
  modalPrimaryButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 14,
    marginBottom: 10,
  },
  modalPrimaryText: {
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '700',
  },
  modalSecondaryButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  modalSecondaryText: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 14,
    fontWeight: '600',
  },
});