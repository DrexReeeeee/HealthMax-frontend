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

// ─── Validation Constants ──────────────────────────────────────
const MIN_AGE = 1;
const MAX_AGE = 120;
const MIN_WEIGHT = 1;
const MAX_WEIGHT = 500;

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

  // ─── Age validation ──────────────────────────────────────────
  const handleAgeChange = (text: string) => {
    // Only allow whole numbers (no decimals, no negative)
    const cleaned = text.replace(/[^0-9]/g, '');
    update('age', cleaned);
  };

  const validateAge = (): string | null => {
    if (!form.age || form.age.trim() === '') {
      return null; // Age is optional
    }
    const ageNum = parseInt(form.age, 10);
    if (isNaN(ageNum)) {
      return 'Please enter a valid whole number for age.';
    }
    if (ageNum < MIN_AGE) {
      return `Age must be at least ${MIN_AGE}.`;
    }
    if (ageNum > MAX_AGE) {
      return `Age must be ${MAX_AGE} or less.`;
    }
    if (form.age.includes('.')) {
      return 'Age must be a whole number (no decimals).';
    }
    return null;
  };

  // ─── Weight validation ───────────────────────────────────────
  const handleWeightChange = (text: string) => {
    // Allow numbers and one decimal point
    // Reject: multiple dots, negative signs, letters
    let cleaned = text.replace(/[^0-9.]/g, '');
    
    // Only allow one decimal point
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Limit to 1 decimal place
    if (parts.length === 2 && parts[1].length > 1) {
      cleaned = parts[0] + '.' + parts[1].substring(0, 1);
    }
    
    update('weight', cleaned);
  };

  const validateWeight = (): string | null => {
    if (!form.weight || form.weight.trim() === '') {
      return null; // Weight is optional
    }
    const weightNum = parseFloat(form.weight);
    if (isNaN(weightNum)) {
      return 'Please enter a valid number for weight.';
    }
    if (weightNum < MIN_WEIGHT) {
      return `Weight must be at least ${MIN_WEIGHT} kg.`;
    }
    if (weightNum > MAX_WEIGHT) {
      return `Weight must be ${MAX_WEIGHT} kg or less.`;
    }
    return null;
  };

  // ─── Email validation ────────────────────────────────────────
  const validateEmail = (): string | null => {
    if (!form.email || form.email.trim() === '') {
      return 'Email is required.';
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(form.email)) {
      return 'Please enter a valid email address.';
    }
    return null;
  };

  // ─── Username validation ─────────────────────────────────────
  const validateUsername = (): string | null => {
    if (!form.username || form.username.trim() === '') {
      return 'Username is required.';
    }
    if (form.username.trim().length < 2) {
      return 'Username must be at least 2 characters.';
    }
    if (form.username.trim().length > 30) {
      return 'Username must be 30 characters or less.';
    }
    return null;
  };

  // ─── Password validation ─────────────────────────────────────
  const validatePassword = (): string | null => {
    if (!form.password || form.password.length < 6) {
      return 'Password must be at least 6 characters.';
    }
    if (form.password.length > 128) {
      return 'Password must be 128 characters or less.';
    }
    return null;
  };

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
      const usernameError = validateUsername();
      if (usernameError) {
        Alert.alert('Invalid Username', usernameError);
        return;
      }
      const emailError = validateEmail();
      if (emailError) {
        Alert.alert('Invalid Email', emailError);
        return;
      }
      const passwordError = validatePassword();
      if (passwordError) {
        Alert.alert('Weak Password', passwordError);
        return;
      }
    }

    if (currentStep === 1) {
      const ageError = validateAge();
      if (ageError) {
        Alert.alert('Invalid Age', ageError);
        return;
      }
      const weightError = validateWeight();
      if (weightError) {
        Alert.alert('Invalid Weight', weightError);
        return;
      }
    }

    if (currentStep < steps.length - 1) {
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
      router.replace('/');
    }
  };

  const handleRegister = async () => {
    // Final validation before submit
    const usernameError = validateUsername();
    if (usernameError) {
      Alert.alert('Invalid Username', usernameError);
      return;
    }
    const emailError = validateEmail();
    if (emailError) {
      Alert.alert('Invalid Email', emailError);
      return;
    }
    const passwordError = validatePassword();
    if (passwordError) {
      Alert.alert('Weak Password', passwordError);
      return;
    }

    // Parse age and weight safely
    const parsedAge = form.age && form.age.trim() !== '' 
      ? parseInt(form.age, 10) 
      : undefined;
    const parsedWeight = form.weight && form.weight.trim() !== '' 
      ? parseFloat(form.weight) 
      : undefined;

    // Validate parsed values
    if (parsedAge !== undefined && (isNaN(parsedAge) || parsedAge < MIN_AGE || parsedAge > MAX_AGE)) {
      Alert.alert('Invalid Age', `Age must be between ${MIN_AGE} and ${MAX_AGE}.`);
      return;
    }
    if (parsedWeight !== undefined && (isNaN(parsedWeight) || parsedWeight < MIN_WEIGHT || parsedWeight > MAX_WEIGHT)) {
      Alert.alert('Invalid Weight', `Weight must be between ${MIN_WEIGHT} and ${MAX_WEIGHT} kg.`);
      return;
    }

    setLoading(true);
    try {
      const { ok, data } = await apiFetch(
        '/api/auth/register',
        {
          method: 'POST',
          body: JSON.stringify({
            username: form.username.trim(),
            email: form.email.trim(),
            password: form.password,
            age: parsedAge,
            weight: parsedWeight,
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
          body: JSON.stringify({ email: form.email.trim(), password: form.password }),
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
        age: parsedAge,
        weight: parsedWeight,
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
                  maxLength={30}
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
              <Text style={styles.fieldHint}>We'll never share your email.</Text>
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
              <Text style={styles.fieldHint}>Must be at least 6 characters.</Text>
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
                  onChangeText={handleAgeChange}
                  placeholder="Age (optional)"
                  placeholderTextColor="#94a3b8"
                  keyboardType="number-pad"
                  maxLength={3}
                />
              </View>
              <Text style={styles.fieldHint}>Whole numbers only · {MIN_AGE}–{MAX_AGE} years</Text>
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.iconInput}>
                <Feather name="activity" size={20} color="#94a3b8" />
                <TextInput
                  style={styles.iconTextField}
                  value={form.weight}
                  onChangeText={handleWeightChange}
                  placeholder="Weight in kg (optional)"
                  placeholderTextColor="#94a3b8"
                  keyboardType="decimal-pad"
                  maxLength={6}
                />
              </View>
              <Text style={styles.fieldHint}>Accepts one decimal place · {MIN_WEIGHT}–{MAX_WEIGHT} kg</Text>
            </View>

            <View style={styles.infoBox}>
              <Feather name="info" size={16} color="#64748b" />
              <Text style={styles.infoText}>
                Age and weight are optional. We use them to personalize your health recommendations.
              </Text>
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
          <View style={styles.header}>
            <Text style={styles.stepTitle}>{steps[currentStep].title}</Text>
            <Text style={styles.stepSubtitle}>{steps[currentStep].subtitle}</Text>
          </View>

          {renderStepContent()}

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
  fieldHint: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 6,
    marginLeft: 4,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  infoText: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
    flex: 1,
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