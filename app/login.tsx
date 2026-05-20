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
import { saveAuthData } from './utils/storage';

const { width, height } = Dimensions.get('window');

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.5)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  
  // Background animation values
  const bgAnim = useRef(new Animated.Value(0)).current;
  const circle1Anim = useRef(new Animated.Value(0)).current;
  const circle2Anim = useRef(new Animated.Value(0)).current;
  const circle3Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
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
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 40,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Background animations
    Animated.loop(
      Animated.sequence([
        Animated.timing(bgAnim, {
          toValue: 1,
          duration: 4000,
          useNativeDriver: false,
        }),
        Animated.timing(bgAnim, {
          toValue: 0,
          duration: 4000,
          useNativeDriver: false,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(circle1Anim, {
          toValue: 1,
          duration: 5000,
          useNativeDriver: true,
        }),
        Animated.timing(circle1Anim, {
          toValue: 0,
          duration: 5000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(circle2Anim, {
          toValue: 1,
          duration: 6000,
          useNativeDriver: true,
        }),
        Animated.timing(circle2Anim, {
          toValue: 0,
          duration: 6000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(circle3Anim, {
          toValue: 1,
          duration: 7000,
          useNativeDriver: true,
        }),
        Animated.timing(circle3Anim, {
          toValue: 0,
          duration: 7000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const validateEmail = (text: string) => {
    setEmail(text);
    if (text && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError('');
    }
  };

  const validatePassword = (text: string) => {
    setPassword(text);
    if (text && text.length < 6) {
      setPasswordError('Password must be at least 6 characters');
    } else {
      setPasswordError('');
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing Info', 'Please enter your email and password.');
      return;
    }

    if (emailError || passwordError) {
      Alert.alert('Invalid Input', 'Please fix the errors before continuing.');
      return;
    }

    // Button press animation
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(buttonScale, {
        toValue: 1,
        tension: 200,
        friction: 3,
        useNativeDriver: true,
      }),
    ]).start();

    setLoading(true);
    try {
      const { ok, data } = await apiFetch(
        '/api/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        },
        false
      );

      if (!ok) {
        Alert.alert('Login Failed', data.message || 'Invalid email or password.');
        return;
      }

      await saveAuthData({
        access_token: data.access_token,
        user: data.user,
      });

      router.replace('/home');
    } catch (err) {
      Alert.alert('Error', 'Could not connect to server. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      
      {/* Animated Background */}
      <Animated.View style={[styles.background, {
        backgroundColor: bgAnim.interpolate({
          inputRange: [0, 1],
          outputRange: ['#f8fafc', '#f0fdf4']
        })
      }]}>
        <Animated.View style={[styles.circle, styles.circle1, {
          transform: [
            {
              scale: circle1Anim.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.4]
              })
            },
            {
              translateX: circle1Anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 80]
              })
            },
            {
              translateY: circle1Anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -40]
              })
            }
          ],
          opacity: circle1Anim.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0.08, 0.15, 0.08]
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
              translateX: circle2Anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -60]
              })
            },
            {
              translateY: circle2Anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 50]
              })
            }
          ],
          opacity: circle2Anim.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0.06, 0.12, 0.06]
          })
        }]} />
        
        <Animated.View style={[styles.circle, styles.circle3, {
          transform: [
            {
              scale: circle3Anim.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 1.2]
              })
            },
            {
              translateY: circle3Anim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 30]
              })
            }
          ],
          opacity: circle3Anim.interpolate({
            inputRange: [0, 0.5, 1],
            outputRange: [0.04, 0.1, 0.04]
          })
        }]} />
      </Animated.View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ opacity: fadeAnim }}>
            <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
              <Feather name="arrow-left" size={22} color="#475569" />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View style={[
            styles.header,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }]
            }
          ]}>
            <View style={styles.logoBox}>
              <Feather name="activity" size={36} color="#10b981" />
            </View>
            <Text style={styles.appName}>HealthMax</Text>
            <Text style={styles.tagline}>Your smart food companion</Text>
          </Animated.View>

          <Animated.View style={[
            styles.card,
            {
              opacity: fadeAnim,
              transform: [
                { translateY: slideAnim },
                { scale: scaleAnim }
              ]
            }
          ]}>
            <Text style={styles.cardTitle}>Welcome back</Text>
            <Text style={styles.cardSubtitle}>Sign in to your account</Text>

            <Text style={styles.label}>Email Address</Text>
            <View>
              <View style={[styles.inputWrapper, emailError && styles.inputWrapperError]}>
                <Feather name="mail" size={18} color={emailError ? '#ef4444' : '#94a3b8'} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={validateEmail}
                  placeholder="juan@example.com"
                  placeholderTextColor="#94a3b8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              {emailError ? (
                <Text style={styles.errorText}>{emailError}</Text>
              ) : (
                <Text style={styles.hintText}>We'll never share your email</Text>
              )}
            </View>

            <Text style={styles.label}>Password</Text>
            <View>
              <View style={[styles.passwordWrapper, passwordError && styles.inputWrapperError]}>
                <Feather name="lock" size={18} color={passwordError ? '#ef4444' : '#94a3b8'} />
                <TextInput
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={validatePassword}
                  placeholder="••••••••"
                  placeholderTextColor="#94a3b8"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                  <Feather name={showPassword ? 'eye-off' : 'eye'} size={20} color="#94a3b8" />
                </TouchableOpacity>
              </View>
              {passwordError && <Text style={styles.errorText}>{passwordError}</Text>}
            </View>

            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.primaryBtnText}>Sign In</Text>
                )}
              </TouchableOpacity>
            </Animated.View>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => router.push('/register')}
            >
              <Text style={styles.secondaryBtnText}>Create an Account</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f8fafc' 
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
    width: width * 0.7,
    height: width * 0.7,
    top: -width * 0.2,
    right: -width * 0.1,
  },
  circle2: {
    width: width * 0.5,
    height: width * 0.5,
    bottom: height * 0.1,
    left: -width * 0.2,
  },
  circle3: {
    width: width * 0.4,
    height: width * 0.4,
    bottom: -width * 0.1,
    right: -width * 0.1,
  },
  keyboardView: { 
    flex: 1 
  },
  scrollContent: { 
    paddingHorizontal: 24, 
    paddingTop: Platform.OS === 'ios' ? 12 : 24,
    paddingBottom: 40 
  },
  backBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    marginBottom: 24,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignSelf: 'flex-start',
  },
  backText: { 
    fontSize: 16, 
    color: '#475569', 
    fontWeight: '500' 
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoBox: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  appName: {
    fontSize: 34,
    fontWeight: '800',
    color: '#0f172a',
  },
  tagline: {
    fontSize: 15,
    color: '#64748b',
    marginTop: 6,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 8,
  },
  cardTitle: {
    fontSize: 30,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 15,
    color: '#64748b',
    marginBottom: 28,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
    marginTop: 20,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: '#f8fafc',
    gap: 12,
  },
  inputWrapperError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0f172a',
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    gap: 12,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0f172a',
  },
  eyeBtn: {
    paddingVertical: 12,
  },
  hintText: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 6,
    marginLeft: 4,
  },
  errorText: {
    fontSize: 11,
    color: '#ef4444',
    marginTop: 6,
    marginLeft: 4,
  },
  primaryBtn: {
    backgroundColor: '#10b981',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 32,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e2e8f0',
  },
  dividerText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  secondaryBtn: {
    borderWidth: 1.5,
    borderColor: '#10b981',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
  },
});