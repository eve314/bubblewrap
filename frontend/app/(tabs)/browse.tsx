import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../../src/services/api';

const GRIEF_TOPICS = [
  'All',
  'Loss of Parent',
  'Loss of Spouse/Partner',
  'Loss of Child',
  'Loss of Sibling',
  'Loss of Friend',
  'Loss of Pet',
  'Pregnancy/Infant Loss',
  'Loss to Suicide',
  'Loss to Illness',
  'Sudden/Unexpected Loss',
];

export default function BrowseScreen() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [selectedTopic, setSelectedTopic] = useState('All');
  const [isLoading, setIsLoading] = useState(true);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const topic = selectedTopic === 'All' ? undefined : selectedTopic;
      const data = await apiService.browseUsers(topic);
      setUsers(data.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [selectedTopic]);

  const handleConnect = async (userId: string) => {
    try {
      await apiService.sendConnectionRequest(userId);
      Alert.alert('Request Sent', 'Your connection request has been sent.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send request');
    }
  };

  const renderUser = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.userCard}
      onPress={() => router.push(`/user/${item.user_id}`)}
    >
      <View style={styles.userHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.name?.[0] || '?'}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.userBio} numberOfLines={2}>
            {item.bio || 'No bio yet'}
          </Text>
        </View>
      </View>
      <View style={styles.topicsContainer}>
        {(item.grief_topics || []).slice(0, 3).map((topic: string, index: number) => (
          <View key={index} style={styles.topicTag}>
            <Text style={styles.topicTagText}>{topic}</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity
        style={styles.connectButton}
        onPress={() => handleConnect(item.user_id)}
      >
        <Ionicons name="person-add" size={18} color="#fff" />
        <Text style={styles.connectButtonText}>Connect</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Find Support</Text>
        <Text style={styles.subtitle}>Connect with others who understand</Text>
      </View>

      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={GRIEF_TOPICS}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                selectedTopic === item && styles.filterChipSelected,
              ]}
              onPress={() => setSelectedTopic(item)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedTopic === item && styles.filterChipTextSelected,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.filterList}
        />
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6B7FD7" />
        </View>
      ) : users.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={60} color="#666" />
          <Text style={styles.emptyText}>No users found</Text>
          <Text style={styles.emptySubtext}>Try selecting a different topic</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.user_id}
          renderItem={renderUser}
          contentContainerStyle={styles.userList}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A2E',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    color: '#9BA4D9',
    marginTop: 4,
  },
  filterContainer: {
    marginBottom: 16,
  },
  filterList: {
    paddingHorizontal: 20,
  },
  filterChip: {
    backgroundColor: '#252541',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#3A3A5A',
  },
  filterChipSelected: {
    backgroundColor: '#6B7FD7',
    borderColor: '#6B7FD7',
  },
  filterChipText: {
    color: '#B8BDD9',
    fontSize: 14,
  },
  filterChipTextSelected: {
    color: '#fff',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 16,
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 4,
  },
  userList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  userCard: {
    backgroundColor: '#252541',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  userHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#6B7FD7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  userBio: {
    color: '#9BA4D9',
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  topicsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  topicTag: {
    backgroundColor: 'rgba(107, 127, 215, 0.2)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  topicTagText: {
    color: '#9BA4D9',
    fontSize: 12,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6B7FD7',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
