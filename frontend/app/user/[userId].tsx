import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../../src/services/api';

export default function UserProfileScreen() {
  const router = useRouter();
  const { userId } = useLocalSearchParams();
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const data = await apiService.getUser(userId as string);
        setUserProfile(data);
      } catch (error) {
        console.error('Error fetching user:', error);
        Alert.alert('Error', 'Failed to load user profile');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, [userId]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await apiService.sendConnectionRequest(userId as string);
      Alert.alert('Request Sent', 'Your connection request has been sent.');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to send request');
    } finally {
      setIsConnecting(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6B7FD7" />
        </View>
      </SafeAreaView>
    );
  }

  if (!userProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>User not found</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backLink}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarTextLarge}>{userProfile.name?.[0] || '?'}</Text>
          </View>
          <Text style={styles.profileName}>{userProfile.name}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.bioText}>{userProfile.bio || 'No bio provided'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Journey Topics</Text>
          <View style={styles.topicsContainer}>
            {(userProfile.grief_topics || []).length > 0 ? (
              userProfile.grief_topics.map((topic: string, index: number) => (
                <View key={index} style={styles.topicChip}>
                  <Text style={styles.topicText}>{topic}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.noTopicsText}>No topics shared</Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.connectButton, isConnecting && styles.connectButtonDisabled]}
          onPress={handleConnect}
          disabled={isConnecting}
        >
          <Ionicons name="person-add" size={20} color="#fff" />
          <Text style={styles.connectButtonText}>
            {isConnecting ? 'Sending...' : 'Send Connection Request'}
          </Text>
        </TouchableOpacity>

        <View style={styles.supportNote}>
          <Ionicons name="shield-checkmark" size={20} color="#6B7FD7" />
          <Text style={styles.supportNoteText}>
            This is a safe space. All conversations are private and moderated for safety.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A2E',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 16,
  },
  backLink: {
    color: '#6B7FD7',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A4E',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  avatarLarge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#6B7FD7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarTextLarge: {
    color: '#fff',
    fontSize: 40,
    fontWeight: 'bold',
  },
  profileName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  bioText: {
    color: '#B8BDD9',
    fontSize: 16,
    lineHeight: 24,
  },
  topicsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  topicChip: {
    backgroundColor: '#6B7FD7',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  topicText: {
    color: '#fff',
    fontSize: 14,
  },
  noTopicsText: {
    color: '#666',
    fontSize: 14,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6B7FD7',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 10,
    gap: 10,
  },
  connectButtonDisabled: {
    opacity: 0.6,
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  supportNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(107, 127, 215, 0.1)',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
    marginBottom: 40,
    gap: 12,
  },
  supportNoteText: {
    flex: 1,
    color: '#9BA4D9',
    fontSize: 14,
    lineHeight: 20,
  },
});
