import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiService } from '../../src/services/api';
import { formatDistanceToNow } from 'date-fns';

export default function MessagesScreen() {
  const router = useRouter();
  const [conversations, setConversations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchConversations = async () => {
    try {
      const data = await apiService.getConversations();
      setConversations(data.conversations || []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchConversations();
  };

  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return '';
    }
  };

  const renderConversation = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.conversationCard}
      onPress={() => router.push(`/chat/${item.conversation_id}`)}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.other_user?.name?.[0] || '?'}</Text>
      </View>
      <View style={styles.conversationInfo}>
        <View style={styles.conversationHeader}>
          <Text style={styles.conversationName}>{item.other_user?.name}</Text>
          <Text style={styles.conversationTime}>{formatTime(item.updated_at)}</Text>
        </View>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.last_message || 'Start a conversation'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#666" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6B7FD7" />
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubble-outline" size={60} color="#666" />
          <Text style={styles.emptyText}>No messages yet</Text>
          <Text style={styles.emptySubtext}>Connect with others to start chatting</Text>
          <TouchableOpacity
            style={styles.browseButton}
            onPress={() => router.push('/(tabs)/browse')}
          >
            <Text style={styles.browseButtonText}>Find People</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.conversation_id}
          renderItem={renderConversation}
          contentContainerStyle={styles.conversationList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6B7FD7" />
          }
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
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
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
    textAlign: 'center',
  },
  browseButton: {
    backgroundColor: '#6B7FD7',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    marginTop: 20,
  },
  browseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  conversationList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  conversationCard: {
    backgroundColor: '#252541',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
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
  conversationInfo: {
    flex: 1,
    marginRight: 8,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  conversationName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  conversationTime: {
    color: '#666',
    fontSize: 12,
  },
  lastMessage: {
    color: '#9BA4D9',
    fontSize: 14,
    marginTop: 4,
  },
});
