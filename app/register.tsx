import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StatusBar,
  SafeAreaView,
  Animated,
  Dimensions,
} from 'react-native';
import { apiFetch } from './utils/api';
import { saveAuthData, saveUserProfile } from './utils/storage';

const { width, height } = Dimensions.get('window');

const HEALTH_GOALS = [
  { id: 'low-sugar', label: '🍬 Low Sugar', emoji: '🍬' },
  { id: 'diabetic-friendly', label: '💉 Diabetic Friendly', emoji: '💉' },
  { id: 'low-salt', label: '🧂 Low Salt', emoji: '🧂' },
  { id: 'hypertension', label: '❤️ Hypertension', emoji: '❤️' },
  { id: 'heart-health', label: '💚 Heart Health', emoji: '💚' },
  { id: 'low-fat', label: '🥗 Low Fat', emoji: '🥗' },
  { id: 'general-wellness', label: '⭐ General Wellness', emoji: '⭐' },
];

const DIETARY_PREFS = [
  { id: 'balanced', label: '⚖️ Balanced', emoji: '⚖️' },
  { id: 'vegetarian', label: '🥦 Vegetarian', emoji: '🥦' },
  { id: 'vegan', label: '🌱 Vegan', emoji: '🌱' },
  { id: 'pescatarian', label: '🐟 Pescatarian', emoji: '🐟' },
  { id: 'keto', label: '🥑 Keto', emoji: '🥑' },
  { id: 'halal', label: '☪️ Halal', emoji: '☪️' },
  { id: 'gluten-free', label: '🌾 Gluten-Free', emoji: '🌾' },
  { id: 'dairy-free', label: '🥛 Dairy-Free', emoji: '🥛' },
];

export default function Register() {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    age: '',
    weight: '',
    healthGoal: '',
    dietaryPreference: '',
  });

  const update = (key: string, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const steps = [
    {
      title: 'Welcome to FitMax! 👋',
      subtitle: 'First, let\'s create your account',
      fields: ['username', 'email', 'password'],
    },
    {
      title: 'Tell us about yourself',
      subtitle: 'This helps personalize your experience',
      fields: ['age', 'weight'],
    },
    {
      title: 'What\'s your health goal?',
      subtitle: 'Pick one that matters most to you',
      fields: ['healthGoal'],
    },
    {
      title: 'Any dietary preferences?',
      subtitle: 'We\'ll use this to filter products',
      fields: ['dietaryPreference'],
    },
  ];

  const handleNext = () => {
    // Validate current step
    if (currentStep === 0) {
      if (!form.username || !form.email || !form.password) {
        Alert.alert('Missing Info', 'Please fill in all account details');
        return;
      }
      if (form.password.length < 6) {
        Alert.alert('Weak Password', 'Password must be at least 6 characters');
        return;
      }
    }

    if (currentStep < steps.length - 1) {
      // Animate transition
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
      
      setCurrentStep(currentStep + 1);
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      handleRegister();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
      
      setCurrentStep(currentStep - 1);
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      // FIX: Redirect to index.tsx (onboarding) instead of using router.back()
      router.replace('/');
    }
  };

  const handleRegister = async () => {
    if (!form.username || !form.email || !form.password) {
      Alert.alert('Missing Info', 'Username, email, and password are required.');
      return;
    }
    if (form.password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const { ok, data } = await apiFetch(
        '/api/auth/register',
        {
          method: 'POST',
          body: JSON.stringify({
            username: form.username,
            email: form.email,
            password: form.password,
            age: form.age ? parseInt(form.age) : undefined,
            weight: form.weight ? parseFloat(form.weight) : undefined,
            health_goal: form.healthGoal || undefined,
            dietary_preference: form.dietaryPreference || undefined,
          }),
        },
        false
      );

      if (!ok) {
        Alert.alert('Registration Failed', data.message || 'Something went wrong.');
        return;
      }

      const loginRes = await apiFetch(
        '/api/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ email: form.email, password: form.password }),
        },
        false
      );

      if (!loginRes.ok) {
        Alert.alert('Account Created!', 'Please sign in.');
        router.replace('/login');
        return;
      }

      await saveAuthData({
        access_token: loginRes.data.access_token,
        user: loginRes.data.user,
      });

      await saveUserProfile({
        id: loginRes.data.user.id,
        username: loginRes.data.user.username,
        email: loginRes.data.user.email,
        age: form.age ? parseInt(form.age) : undefined,
        weight: form.weight ? parseFloat(form.weight) : undefined,
        healthGoals: form.healthGoal ? [form.healthGoal] : [],
        dietaryPreferences: form.dietaryPreference ? [form.dietaryPreference] : [],
        createdAt: new Date().toISOString(),
      });

      router.replace('/home');
    } catch (err) {
      Alert.alert('Error', 'Could not connect to server. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <Animated.View style={[styles.stepContainer, { opacity: fadeAnim }]}>
            <View style={styles.inputGroup}>
              <View style={styles.iconInput}>
                <Feather name="user" size={20} color="#94a3b8" />
                <TextInput
                  style={styles.iconTextField}
                  value={form.username}
                  onChangeText={t => update('username', t)}
                  placeholder="Username"
                  placeholderTextColor="#94a3b8"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.iconInput}>
                <Feather name="mail" size={20} color="#94a3b8" />
                <TextInput
                  style={styles.iconTextField}
                  value={form.email}
                  onChangeText={t => update('email', t)}
                  placeholder="Email address"
                  placeholderTextColor="#94a3b8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.iconInput}>
                <Feather name="lock" size={20} color="#94a3b8" />
                <TextInput
                  style={styles.iconTextField}
                  value={form.password}
                  onChangeText={t => update('password', t)}
                  placeholder="Password (min. 6 characters)"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Feather name={showPassword ? 'eye-off' : 'eye'} size={20} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        );

      case 1:
        return (
          <Animated.View style={[styles.stepContainer, { opacity: fadeAnim }]}>
            <View style={styles.inputGroup}>
              <View style={styles.iconInput}>
                <Feather name="calendar" size={20} color="#94a3b8" />
                <TextInput
                  style={styles.iconTextField}
                  value={form.age}
                  onChangeText={t => update('age', t)}
                  placeholder="Age"
                  placeholderTextColor="#94a3b8"
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.iconInput}>
                <Feather name="activity" size={20} color="#94a3b8" />
                <TextInput
                  style={styles.iconTextField}
                  value={form.weight}
                  onChangeText={t => update('weight', t)}
                  placeholder="Weight (kg)"
                  placeholderTextColor="#94a3b8"
                  keyboardType="decimal-pad"
                />
              </View>
            </View>
          </Animated.View>
        );

      case 2:
        return (
          <Animated.View style={[styles.stepContainer, { opacity: fadeAnim }]}>
            <View style={styles.optionsGrid}>
              {HEALTH_GOALS.map(goal => {
                const selected = form.healthGoal === goal.id;
                return (
                  <TouchableOpacity
                    key={goal.id}
                    onPress={() => update('healthGoal', selected ? '' : goal.id)}
                    style={[styles.optionCard, selected && styles.optionCardSelected]}
                  >
                    <Text style={styles.optionEmoji}>{goal.emoji}</Text>
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                      {goal.label}
                    </Text>
                    {selected && (
                      <View style={styles.checkmark}>
                        <Feather name="check" size={16} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>
        );

      case 3:
        return (
          <Animated.View style={[styles.stepContainer, { opacity: fadeAnim }]}>
            <View style={styles.optionsGrid}>
              {DIETARY_PREFS.map(pref => {
                const selected = form.dietaryPreference === pref.id;
                return (
                  <TouchableOpacity
                    key={pref.id}
                    onPress={() => update('dietaryPreference', selected ? '' : pref.id)}
                    style={[styles.optionCard, selected && styles.optionCardSelected]}
                  >
                    <Text style={styles.optionEmoji}>{pref.emoji}</Text>
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                      {pref.label}
                    </Text>
                    {selected && (
                      <View style={styles.checkmark}>
                        <Feather name="check" size={16} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>
        );

      default:
        return null;
    }
  };

  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Feather name="arrow-left" size={24} color="#1e293b" />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.stepTitle}>{steps[currentStep].title}</Text>
            <Text style={styles.stepSubtitle}>{steps[currentStep].subtitle}</Text>
          </View>

          {/* Step Content */}
          {renderStepContent()}

          {/* Navigation Buttons */}
          <View style={styles.navigationButtons}>
            <TouchableOpacity
              style={[styles.nextButton, loading && styles.nextButtonDisabled]}
              onPress={handleNext}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={styles.nextButtonText}>
                    {currentStep === steps.length - 1 ? 'Create Account' : 'Continue'}
                  </Text>
                  <Feather name="arrow-right" size={20} color="#fff" />
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Login Link for first step */}
          {currentStep === 0 && (
            <View style={styles.loginRow}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.replace('/login')}>
                <Text style={styles.loginLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: '#fff' 
  },
  flex: { 
    flex: 1 
  },
  progressContainer: {
    position: 'relative',
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
    paddingHorizontal: 20,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e2e8f0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 2,
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 12 : 16,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 48,
  },
  stepTitle: {
    fontSize: 34,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
    lineHeight: 42,
  },
  stepSubtitle: {
    fontSize: 17,
    color: '#64748b',
    lineHeight: 24,
  },
  stepContainer: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 20,
  },
  iconInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    gap: 12,
  },
  iconTextField: {
    flex: 1,
    fontSize: 17,
    paddingVertical: 18,
    color: '#0f172a',
  },
  optionsGrid: {
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    backgroundColor: '#fff',
    position: 'relative',
  },
  optionCardSelected: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  optionEmoji: {
    fontSize: 28,
    marginRight: 16,
  },
  optionText: {
    flex: 1,
    fontSize: 17,
    fontWeight: '500',
    color: '#334155',
  },
  optionTextSelected: {
    color: '#10b981',
    fontWeight: '600',
  },
  checkmark: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navigationButtons: {
    marginTop: 40,
  },
  nextButton: {
    flexDirection: 'row',
    backgroundColor: '#10b981',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  nextButtonDisabled: {
    opacity: 0.6,
  },
  nextButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
    paddingVertical: 16,
  },
  loginText: {
    fontSize: 15,
    color: '#64748b',
  },
  loginLink: {
    fontSize: 15,
    fontWeight: '700',
    color: '#10b981',
  },
});