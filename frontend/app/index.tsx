import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';

const { width } = Dimensions.get('window');

export default function LandingPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.is_profile_complete) {
        router.replace('/(tabs)');
      } else {
        router.replace('/profile-setup');
      }
    }
  }, [isAuthenticated, user]);

  const handleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    const redirectUrl = currentOrigin + '/auth-callback';
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    
    if (typeof window !== 'undefined') {
      window.location.href = authUrl;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="heart" size={80} color="#6B7FD7" />
        </View>
        
        <Text style={styles.title}>Compassion Space</Text>
        <Text style={styles.subtitle}>A safe place for grief support</Text>
        
        <View style={styles.featuresContainer}>
          <View style={styles.featureItem}>
            <Ionicons name="people" size={24} color="#9BA4D9" />
            <Text style={styles.featureText}>Connect with others who understand</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="chatbubbles" size={24} color="#9BA4D9" />
            <Text style={styles.featureText}>Private 1-to-1 conversations</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="shield-checkmark" size={24} color="#9BA4D9" />
            <Text style={styles.featureText}>Safe & supportive community</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
          <Ionicons name="logo-google" size={24} color="#fff" />
          <Text style={styles.loginButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          By continuing, you agree to our community guidelines and privacy policy.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A2E',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(107, 127, 215, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#9BA4D9',
    marginBottom: 40,
    textAlign: 'center',
  },
  featuresContainer: {
    width: '100%',
    marginBottom: 40,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  featureText: {
    fontSize: 16,
    color: '#B8BDD9',
    marginLeft: 12,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6B7FD7',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    marginBottom: 16,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
  disclaimer: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
