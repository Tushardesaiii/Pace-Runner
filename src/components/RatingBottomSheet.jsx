import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, Platform, Modal } from 'react-native';
import * as StoreReview from 'expo-store-review';
import * as Haptics from 'expo-haptics';
import { Star } from 'lucide-react-native';

const RatingBottomSheet = ({ isVisible, onClose }) => {
  const [rating, setRating] = useState(0);
  const snapPoints = useMemo(() => ['35%'], []);

  useEffect(() => {
    if (!isVisible) {
      setRating(0);
    }
  }, [isVisible]);

  const dismissSheet = useCallback(() => {
    if (onClose) onClose();
  }, [onClose]);

  const openAndroidStorePage = useCallback(async () => {
    const packageName = 'com.marathonplanner.app';
    const marketUrl = `market://details?id=${packageName}&showAllReviews=true`;
    const webUrl = `https://play.google.com/store/apps/details?id=${packageName}&showAllReviews=true`;

    try {
      const canOpenMarket = await Linking.canOpenURL(marketUrl);
      await Linking.openURL(canOpenMarket ? marketUrl : webUrl);
    } catch (error) {
      await Linking.openURL(webUrl);
    }
  }, []);

  const handleRating = async (val) => {
    Haptics.selectionAsync();
    setRating(val);

    // If rating is high, ask for store review
    if (val >= 4) {
      setTimeout(async () => {
        try {
          const canUseNativeReview = await StoreReview.isAvailableAsync();

          if (canUseNativeReview) {
            await StoreReview.requestReview();
          } else if (Platform.OS === 'android') {
            await openAndroidStorePage();
          }
        } catch (error) {
          if (Platform.OS === 'android') {
            await openAndroidStorePage();
          }
        }
        dismissSheet();
      }, 500);
    } else {
      // For lower ratings, you might want to show a feedback form
      // Here we just dismiss after a short delay for simplicity
      setTimeout(() => {
        dismissSheet();
      }, 800);
    }
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={dismissSheet}
    >
      <Pressable style={styles.overlay} onPress={dismissSheet}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handleIndicator} />
          <View style={styles.container}>
            <Text style={styles.title}>Enjoying Pace Runner?</Text>
            <Text style={styles.subtitle}>Tap a star to rate it on the App Store.</Text>

            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable
                  key={star}
                  onPress={() => handleRating(star)}
                  style={({ pressed }) => [
                    styles.starButton,
                    pressed && { opacity: 0.7, transform: [{ scale: 0.9 }] }
                  ]}
                >
                  <Star
                    size={40}
                    color={star <= rating ? "#FFD700" : "#E0E0E0"}
                    fill={star <= rating ? "#FFD700" : "transparent"}
                    strokeWidth={1.5}
                  />
                </Pressable>
              ))}
            </View>

            <Pressable 
              style={styles.cancelButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                dismissSheet();
              }}
            >
              <Text style={styles.cancelText}>Not Now</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
  },
  handleIndicator: {
    backgroundColor: '#DDDDDD',
    width: 40,
    height: 5,
    borderRadius: 999,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 16,
    alignItems: 'center',
    paddingBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#222222',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#717171',
    marginBottom: 32,
    textAlign: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 32,
  },
  starButton: {
    padding: 4,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#717171',
  },
});

export default RatingBottomSheet;
