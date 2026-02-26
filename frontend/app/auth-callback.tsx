import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';

export default function AuthCallback() {
  const router = useRouter();
  const { processAuth } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const handleAuthCallback = async () => {
      try {
        // Get session_id from URL fragment
        const hash = typeof window !== 'undefined' ? window.location.hash : '';
        const params = new URLSearchParams(hash.replace('#', ''));
        const sessionId = params.get('session_id');

        if (!sessionId) {
          console.error('No session_id found in URL');
          router.replace('/');
          return;
        }

        // Process authentication
        const user = await processAuth(sessionId);

        if (user) {
          // Clear the hash from URL
          if (typeof window !== 'undefined') {
            window.history.replaceState(null, '', window.location.pathname);
          }
          
          // Navigate based on profile completion
          if (user.is_profile_complete) {
            router.replace('/(tabs)');
          } else {
            router.replace('/profile-setup');
          }
        } else {
          router.replace('/');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        router.replace('/');
      }
    };

    handleAuthCallback();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#6B7FD7" />
      <Text style={styles.text}>Signing you in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1A1A2E',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: '#9BA4D9',
  },
});
