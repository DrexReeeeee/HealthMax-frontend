import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
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
} from 'react-native';
import { apiFetch } from './utils/api';
import { saveAuthData } from './utils/storage';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing Info', 'Please enter your email and password.');
      return;
    }

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
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color="#475569" />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.logoBox}>
              <Feather name="activity" size={32} color="#10b981" />
            </View>
            <Text style={styles.appName}>FitMax</Text>
            <Text style={styles.tagline}>Your smart food companion</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome back</Text>
            <Text style={styles.cardSubtitle}>Sign in to your account</Text>

            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="juan@example.com"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#94a3b8"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Feather name={showPassword ? 'eye-off' : 'eye'} size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

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
          </View>
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
    width: 80,
    height: 80,
    borderRadius: 22,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 32,
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
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  cardTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  cardSubtitle: {
    fontSize: 15,
    color: '#64748b',
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0f172a',
  },
  eyeBtn: {
    paddingHorizontal: 16,
  },
  primaryBtn: {
    backgroundColor: '#10b981',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 28,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
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
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
  },
});