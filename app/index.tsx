import { MaterialCommunityIcons as Icon } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { setOnboardingCompleted } from './utils/storage';

const { width } = Dimensions.get('window');

export default function OnboardingScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 4000,
        useNativeDriver: true,
      })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handleCreateAccount = async () => {
    await setOnboardingCompleted(true);
    router.replace('/register');
  };

  const handleSkip = async () => {
    await setOnboardingCompleted(true);
    router.replace('/home');
  };

  const features: {
    icon: React.ComponentProps<typeof Icon>['name'];
    title: string;
    description: string;
    colors: readonly [string, string, ...string[]];
    iconColors: readonly [string, string, ...string[]];
    iconColor: string;
  }[] = [
    {
      icon: 'heart-pulse',
      title: 'Smart Health Scoring',
      description: 'Get instant health scores for every product you scan',
      colors: ['rgba(16, 185, 129, 0.1)', 'rgba(20, 184, 166, 0.1)'],
      iconColors: ['#d1fae5', '#99f6e4'],
      iconColor: '#10b981',
    },
    {
      icon: 'star-four-points',
      title: 'Personalized Insights',
      description: 'Recommendations tailored to your health goals',
      colors: ['rgba(168, 85, 247, 0.1)', 'rgba(236, 72, 153, 0.1)'],
      iconColors: ['#f3e8ff', '#fce7f3'],
      iconColor: '#a855f7',
    },
    {
      icon: 'trending-up',
      title: 'Track Your Progress',
      description: 'Monitor your healthy choices over time',
      colors: ['rgba(59, 130, 246, 0.1)', 'rgba(6, 182, 212, 0.1)'],
      iconColors: ['#dbeafe', '#cffafe'],
      iconColor: '#3b82f6',
    },
    {
      icon: 'trophy',
      title: 'Earn Rewards',
      description: 'Collect badges and points for healthy decisions',
      colors: ['rgba(245, 158, 11, 0.1)', 'rgba(249, 115, 22, 0.1)'],
      iconColors: ['#fef3c7', '#fed7aa'],
      iconColor: '#f59e0b',
    },
  ];

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const rotateReverse = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-360deg'],
  });

  const shimmerTranslateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-width * 2, width * 2],
  });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#f8fafc', '#ffffff', 'rgba(16, 185, 129, 0.05)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Animated background circles */}
        <Animated.View
          style={[styles.bgCircle, styles.bgCircle1, { transform: [{ rotate }] }]}
        >
          <LinearGradient
            colors={['rgba(16, 185, 129, 0.2)', 'rgba(20, 184, 166, 0.2)']}
            style={styles.bgCircleGradient}
          />
        </Animated.View>
        <Animated.View
          style={[styles.bgCircle, styles.bgCircle2, { transform: [{ rotate: rotateReverse }] }]}
        >
          <LinearGradient
            colors={['rgba(168, 85, 247, 0.2)', 'rgba(236, 72, 153, 0.2)']}
            style={styles.bgCircleGradient}
          />
        </Animated.View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Animated.View
            style={[
              styles.content,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            {/* Logo Section */}
            <View style={styles.logoSection}>
              <Animated.View
                style={[styles.logoContainer, { transform: [{ scale: scaleAnim }] }]}
              >
                <LinearGradient
                  colors={['#10b981', '#14b8a6']}
                  style={styles.logoGradient}
                >
                  <Icon name="heart-pulse" size={48} color="#fff" />
                </LinearGradient>
                <Animated.View
                  style={[
                    styles.decorCircle,
                    styles.decorCircle1,
                    { transform: [{ rotate }] },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.decorCircle,
                    styles.decorCircle2,
                    { transform: [{ rotate: rotateReverse }] },
                  ]}
                />
              </Animated.View>

              <Animated.View
                style={{
                  opacity: fadeAnim,
                  transform: [
                    {
                      translateY: fadeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                    },
                  ],
                }}
              >
                <Text style={styles.title}>Welcome to HEALTHMAX</Text>
                <Text style={styles.subtitle}>
                  Start your journey to healthier grocery choices
                </Text>
              </Animated.View>
            </View>

            {/* Features */}
            <View style={styles.featuresContainer}>
              {features.map((feature, index) => (
                <Animated.View
                  key={index}
                  style={[
                    styles.featureCard,
                    {
                      opacity: fadeAnim,
                      transform: [
                        {
                          translateX: fadeAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-20, 0],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <LinearGradient
                    colors={feature.colors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.featureGradient}
                  >
                    <View style={styles.featureDecor} />
                    <View style={styles.featureContent}>
                      <LinearGradient
                        colors={feature.iconColors}
                        style={styles.featureIconContainer}
                      >
                        <Icon
                          name={feature.icon}
                          size={32}
                          color={feature.iconColor}
                        />
                      </LinearGradient>
                      <View style={styles.featureTextContainer}>
                        <Text style={styles.featureTitle}>{feature.title}</Text>
                        <Text style={styles.featureDescription}>
                          {feature.description}
                        </Text>
                      </View>
                    </View>
                  </LinearGradient>
                </Animated.View>
              ))}
            </View>

            {/* Buttons */}
            <Animated.View style={[styles.buttonsContainer, { opacity: fadeAnim }]}>
              <TouchableOpacity
                onPress={handleCreateAccount}
                activeOpacity={0.9}
                style={styles.primaryButtonContainer}
              >
                <LinearGradient
                  colors={['#10b981', '#14b8a6']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.primaryButton}
                >
                  <Animated.View
                    style={[
                      styles.shimmer,
                      { transform: [{ translateX: shimmerTranslateX }] },
                    ]}
                  />
                  <Icon name="star-four-points" size={20} color="#fff" />
                  <Text style={styles.primaryButtonText}>
                    Create Account & Personalize
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSkip}
                activeOpacity={0.8}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>
                  Skip - Use Offline Mode
                </Text>
              </TouchableOpacity>

              <Text style={styles.footerText}>
                Create an account to save your progress across devices
              </Text>
            </Animated.View>
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1 },
  bgCircle: { position: 'absolute', width: 400, height: 400 },
  bgCircleGradient: { width: '100%', height: '100%', borderRadius: 200 },
  bgCircle1: { top: -100, right: -100 },
  bgCircle2: { bottom: -100, left: -100 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingVertical: 40 },
  content: {
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 24,
  },
  logoSection: { alignItems: 'center', marginBottom: 32 },
  logoContainer: { position: 'relative', marginBottom: 16 },
  logoGradient: {
    width: 96,
    height: 96,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  decorCircle: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 4,
  },
  decorCircle1: { top: -8, right: -8, borderColor: '#f59e0b' },
  decorCircle2: { bottom: -8, left: -8, borderColor: '#a855f7' },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#10b981',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  featuresContainer: { marginBottom: 32, gap: 16 },
  featureCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  featureGradient: { padding: 20, position: 'relative' },
  featureDecor: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  featureContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    zIndex: 10,
  },
  featureIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  featureTextContainer: { flex: 1 },
  featureTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  featureDescription: { fontSize: 14, color: '#64748b', lineHeight: 20 },
  buttonsContainer: { gap: 12 },
  primaryButtonContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  primaryButton: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    position: 'relative',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: width * 0.5,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    zIndex: 10,
  },
  secondaryButton: {
    height: 56,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  secondaryButtonText: { fontSize: 18, fontWeight: '600', color: '#1e293b' },
  footerText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  },
});