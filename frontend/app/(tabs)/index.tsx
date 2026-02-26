import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { apiService } from '../../src/services/api';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [recentConversations, setRecentConversations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [requestsData, conversationsData] = await Promise.all([
        apiService.getConnectionRequests(),
        apiService.getConversations(),
      ]);
      setPendingRequests(requestsData.requests || []);
      setRecentConversations((conversationsData.conversations || []).slice(0, 3));
    } catch (error) {
      console.error('Error fetching home data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await apiService.respondToConnection(requestId, true);
      fetchData();
    } catch (error) {
      console.error('Error accepting request:', error);
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6B7FD7" />
        }
      >
        <View style={styles.header}>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.userName}>{user?.name || 'Friend'}</Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push('/(tabs)/browse')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(107, 127, 215, 0.2)' }]}>
              <Ionicons name="search" size={24} color="#6B7FD7" />
            </View>
            <Text style={styles.quickActionText}>Find Support</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push('/(tabs)/groups')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(155, 164, 217, 0.2)' }]}>
              <Ionicons name="people" size={24} color="#9BA4D9" />
            </View>
            <Text style={styles.quickActionText}>Join Groups</Text>
          </TouchableOpacity>
        </View>

        {/* Pending Connection Requests */}
        {pendingRequests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Connection Requests</Text>
            {pendingRequests.map((request) => (
              <View key={request.request_id} style={styles.requestCard}>
                <View style={styles.requestInfo}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {request.from_user?.name?.[0] || '?'}
                    </Text>
                  </View>
                  <View style={styles.requestDetails}>
                    <Text style={styles.requestName}>{request.from_user?.name}</Text>
                    <Text style={styles.requestTopics} numberOfLines={1}>
                      {request.from_user?.grief_topics?.join(', ') || 'No topics'}
                    </Text>
                  </View>
                </View>
                <View style={styles.requestActions}>
                  <TouchableOpacity
                    style={styles.acceptButton}
                    onPress={() => handleAcceptRequest(request.request_id)}
                  >
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Recent Conversations */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Conversations</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/messages')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          {recentConversations.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubble-outline" size={40} color="#666" />
              <Text style={styles.emptyStateText}>No conversations yet</Text>
              <Text style={styles.emptyStateSubtext}>Connect with others to start chatting</Text>
            </View>
          ) : (
            recentConversations.map((conv) => (
              <TouchableOpacity
                key={conv.conversation_id}
                style={styles.conversationCard}
                onPress={() => router.push(`/chat/${conv.conversation_id}`)}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {conv.other_user?.name?.[0] || '?'}
                  </Text>
                </View>
                <View style={styles.conversationInfo}>
                  <Text style={styles.conversationName}>{conv.other_user?.name}</Text>
                  <Text style={styles.lastMessage} numberOfLines={1}>
                    {conv.last_message || 'Start a conversation'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Supportive Quote */}
        <View style={styles.quoteCard}>
          <Ionicons name="heart" size={24} color="#6B7FD7" />
          <Text style={styles.quoteText}>
            "Grief is the price we pay for love. And it is worth every penny."
          </Text>
          <Text style={styles.quoteAuthor}>- Unknown</Text>
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
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    marginTop: 10,
    marginBottom: 24,
  },
  greeting: {
    fontSize: 16,
    color: '#9BA4D9',
  },
  userName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  quickActionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  quickAction: {
    flex: 1,
    backgroundColor: '#252541',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  seeAllText: {
    color: '#6B7FD7',
    fontSize: 14,
  },
  requestCard: {
    backgroundColor: '#252541',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  requestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6B7FD7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  requestDetails: {
    flex: 1,
  },
  requestName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  requestTopics: {
    color: '#9BA4D9',
    fontSize: 12,
    marginTop: 2,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    backgroundColor: '#6B7FD7',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  conversationCard: {
    backgroundColor: '#252541',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  conversationInfo: {
    flex: 1,
    marginRight: 8,
  },
  conversationName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  lastMessage: {
    color: '#9BA4D9',
    fontSize: 14,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#252541',
    borderRadius: 12,
  },
  emptyStateText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
  },
  emptyStateSubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 4,
  },
  quoteCard: {
    backgroundColor: 'rgba(107, 127, 215, 0.1)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 32,
  },
  quoteText: {
    color: '#B8BDD9',
    fontSize: 16,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 24,
  },
  quoteAuthor: {
    color: '#666',
    fontSize: 14,
    marginTop: 8,
  },
});
