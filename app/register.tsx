import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
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
  { id: 'low-sugar', label: 'Low Sugar', icon: 'droplet' },
  { id: 'diabetic-friendly', label: 'Diabetic Friendly', icon: 'activity' },
  { id: 'low-salt', label: 'Low Salt', icon: 'wind' },
  { id: 'hypertension', label: 'Hypertension', icon: 'heart' },
  { id: 'heart-health', label: 'Heart Health', icon: 'heart' },
  { id: 'low-fat', label: 'Low Fat', icon: 'trending-down' },
  { id: 'general-wellness', label: 'General Wellness', icon: 'smile' },
];

const DIETARY_PREFS = [
  { id: 'balanced', label: 'Balanced', icon: 'compass' },
  { id: 'vegetarian', label: 'Vegetarian', icon: 'leaf' },
  { id: 'vegan', label: 'Vegan', icon: 'sun' },
  { id: 'pescatarian', label: 'Pescatarian', icon: 'anchor' },
  { id: 'keto', label: 'Keto', icon: 'zap' },
  { id: 'halal', label: 'Halal', icon: 'star' },
  { id: 'gluten-free', label: 'Gluten-Free', icon: 'x-circle' },
  { id: 'dairy-free', label: 'Dairy-Free', icon: 'slash' },
];

const MIN_AGE = 1;
const MAX_AGE = 120;
const MIN_WEIGHT = 1;
const MAX_WEIGHT = 500;

export default function Register() {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, label: '', color: '' });

  // Background animation values
  const bgAnim = useRef(new Animated.Value(0)).current;
  const circle1Anim = useRef(new Animated.Value(0)).current;
  const circle2Anim = useRef(new Animated.Value(0)).current;

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

  // Background animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bgAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: false,
        }),
        Animated.timing(bgAnim, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: false,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(circle1Anim, {
          toValue: 1,
          duration: 4000,
          useNativeDriver: true,
        }),
        Animated.timing(circle1Anim, {
          toValue: 0,
          duration: 4000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(circle2Anim, {
          toValue: 1,
          duration: 5000,
          useNativeDriver: true,
        }),
        Animated.timing(circle2Anim, {
          toValue: 0,
          duration: 5000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Password strength checker
  const checkPasswordStrength = (password: string) => {
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    
    let label = '';
    let color = '';
    if (score <= 2) {
      label = 'Weak';
      color = '#ef4444';
    } else if (score <= 4) {
      label = 'Medium';
      color = '#f59e0b';
    } else {
      label = 'Strong';
      color = '#10b981';
    }
    
    setPasswordStrength({ score, label, color });
    return score >= 2;
  };

  const handlePasswordChange = (text: string) => {
    update('password', text);
    checkPasswordStrength(text);
  };

  const handleAgeChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    update('age', cleaned);
  };

  const handleWeightChange = (text: string) => {
    let cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
    if (parts.length === 2 && parts[1].length > 1) {
      cleaned = parts[0] + '.' + parts[1].substring(0, 1);
    }
    update('weight', cleaned);
  };

  const validateAge = (): string | null => {
    if (!form.age || form.age.trim() === '') {
      return null;
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

  const validateWeight = (): string | null => {
    if (!form.weight || form.weight.trim() === '') {
      return null;
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

  const validatePassword = (): string | null => {
    if (!form.password || form.password.length < 6) {
      return 'Password must be at least 6 characters.';
    }
    if (form.password.length > 128) {
      return 'Password must be 128 characters or less.';
    }
    return null;
  };

  const validateConfirmPassword = (): string | null => {
    if (!confirmPassword) {
      return 'Please confirm your password.';
    }
    if (form.password !== confirmPassword) {
      return 'Passwords do not match.';
    }
    return null;
  };

  const steps = [
    {
      title: 'Welcome to HealthMax',
      subtitle: 'First, let\'s create your account',
      fields: ['username', 'email', 'password', 'confirmPassword'],
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
      const confirmError = validateConfirmPassword();
      if (confirmError) {
        Alert.alert('Password Mismatch', confirmError);
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
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: -50,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 0.95,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 100,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        setCurrentStep(currentStep + 1);
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(slideAnim, {
            toValue: 0,
            tension: 50,
            friction: 7,
            useNativeDriver: true,
          }),
        ]).start();
      });
    } else {
      handleRegister();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 50,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setCurrentStep(currentStep - 1);
        scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.spring(slideAnim, {
            toValue: 0,
            tension: 50,
            friction: 7,
            useNativeDriver: true,
          }),
        ]).start();
      });
    } else {
      router.replace('/');
    }
  };

  const handleRegister = async () => {
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
    const confirmError = validateConfirmPassword();
    if (confirmError) {
      Alert.alert('Password Mismatch', confirmError);
      return;
    }

    const parsedAge = form.age && form.age.trim() !== '' 
      ? parseInt(form.age, 10) 
      : undefined;
    const parsedWeight = form.weight && form.weight.trim() !== '' 
      ? parseFloat(form.weight) 
      : undefined;

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
          <Animated.View style={[styles.stepContainer, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
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
                  onChangeText={handlePasswordChange}
                  placeholder="Password"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  <Feather name={showPassword ? 'eye-off' : 'eye'} size={20} color="#94a3b8" />
                </TouchableOpacity>
              </View>
              {form.password.length > 0 && (
                <View style={styles.strengthContainer}>
                  <View style={styles.strengthBar}>
                    <View style={[styles.strengthFill, { width: `${(passwordStrength.score / 6) * 100}%`, backgroundColor: passwordStrength.color }]} />
                  </View>
                  <Text style={[styles.strengthText, { color: passwordStrength.color }]}>
                    {passwordStrength.label} password
                  </Text>
                </View>
              )}
              <Text style={styles.fieldHint}>Must be at least 6 characters.</Text>
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.iconInput}>
                <Feather name="lock" size={20} color="#94a3b8" />
                <TextInput
                  style={styles.iconTextField}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm password"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
              </View>
              {confirmPassword.length > 0 && form.password !== confirmPassword && (
                <Text style={styles.errorHint}>Passwords do not match</Text>
              )}
            </View>
          </Animated.View>
        );

      case 1:
        return (
          <Animated.View style={[styles.stepContainer, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
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
          <Animated.View style={[styles.stepContainer, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
            <View style={styles.optionsGrid}>
              {HEALTH_GOALS.map(goal => {
                const selected = form.healthGoal === goal.id;
                return (
                  <TouchableOpacity
                    key={goal.id}
                    onPress={() => update('healthGoal', selected ? '' : goal.id)}
                    style={[styles.optionCard, selected && styles.optionCardSelected]}
                  >
                    <Feather name={goal.icon as any} size={24} color={selected ? '#10b981' : '#64748b'} />
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                      {goal.label}
                    </Text>
                    {selected && (
                      <View style={styles.checkmark}>
                        <Feather name="check" size={14} color="#fff" />
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
          <Animated.View style={[styles.stepContainer, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>
            <View style={styles.optionsGrid}>
              {DIETARY_PREFS.map(pref => {
                const selected = form.dietaryPreference === pref.id;
                return (
                  <TouchableOpacity
                    key={pref.id}
                    onPress={() => update('dietaryPreference', selected ? '' : pref.id)}
                    style={[styles.optionCard, selected && styles.optionCardSelected]}
                  >
                    <Feather name={pref.icon as any} size={24} color={selected ? '#10b981' : '#64748b'} />
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                      {pref.label}
                    </Text>
                    {selected && (
                      <View style={styles.checkmark}>
                        <Feather name="check" size={14} color="#fff" />
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
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Animated Background */}
      <Animated.View style={[styles.background, {
        backgroundColor: bgAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ['#ffffff', '#f0fdf4']
        })
      }]}>
        <Animated.View style={[styles.circle, styles.circle1, {
          transform: [
            {
              scale: circle1Anim.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.5]
              })
            },
            {
              translateX: circle1Anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 50]
              })
            }
          ],
          opacity: circle1Anim.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0.1, 0.2, 0.1]
          })
        }]} />
        <Animated.View style={[styles.circle, styles.circle2, {
          transform: [
            {
              scale: circle2Anim.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.3]
              })
            },
            {
              translateY: circle2Anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -30]
              })
            }
          ],
          opacity: circle2Anim.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0.05, 0.15, 0.05]
          })
        }]} />
      </Animated.View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <Animated.View style={[styles.progressFill, { width: `${progress}%` }]} />
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

          <Animated.View style={[styles.navigationButtons, { transform: [{ scale: scaleAnim }] }]}>
            <TouchableOpacity
              style={[styles.nextButton, loading && styles.nextButtonDisabled]}
              onPress={handleNext}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <>
                  <Text style={styles.nextButtonText}>
                    {currentStep === steps.length - 1 ? 'Create Account' : 'Continue'}
                  </Text>
                  <Feather name="arrow-right" size={20} color="#ffffff" />
                </>
              )}
            </TouchableOpacity>
          </Animated.View>

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
    backgroundColor: '#ffffff' 
  },
  flex: { 
    flex: 1 
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  circle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: '#10b981',
  },
  circle1: {
    width: width * 0.6,
    height: width * 0.6,
    top: -width * 0.2,
    right: -width * 0.1,
  },
  circle2: {
    width: width * 0.8,
    height: width * 0.8,
    bottom: -width * 0.3,
    left: -width * 0.2,
  },
  progressContainer: {
    position: 'relative',
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
    paddingHorizontal: 24,
    zIndex: 1,
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
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 48,
  },
  stepTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
    lineHeight: 40,
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#64748b',
    lineHeight: 24,
  },
  stepContainer: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 24,
  },
  iconInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    gap: 12,
  },
  iconTextField: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 18,
    color: '#0f172a',
  },
  fieldHint: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 8,
    marginLeft: 4,
  },
  errorHint: {
    fontSize: 12,
    color: '#ef4444',
    marginTop: 8,
    marginLeft: 4,
  },
  strengthContainer: {
    marginTop: 8,
    gap: 4,
  },
  strengthBar: {
    height: 3,
    backgroundColor: '#e2e8f0',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  strengthFill: {
    height: '100%',
    borderRadius: 1.5,
  },
  strengthText: {
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 4,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
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
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    backgroundColor: '#ffffff',
    gap: 14,
  },
  optionCardSelected: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#334155',
  },
  optionTextSelected: {
    color: '#10b981',
  },
  checkmark: {
    width: 20,
    height: 20,
    borderRadius: 10,
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
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  nextButtonDisabled: {
    opacity: 0.6,
  },
  nextButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#ffffff',
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
    fontWeight: '600',
    color: '#10b981',
  },
});