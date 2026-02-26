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

export default function GroupsScreen() {
  const router = useRouter();
  const [groups, setGroups] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchGroups = async () => {
    setIsLoading(true);
    try {
      // First, seed default groups if needed
      await apiService.seedGroups();
      const data = await apiService.getGroups();
      setGroups(data.groups || []);
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleJoinGroup = async (groupId: string) => {
    try {
      await apiService.joinGroup(groupId);
      fetchGroups();
      Alert.alert('Joined!', 'You have joined the group.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to join group');
    }
  };

  const handleLeaveGroup = async (groupId: string) => {
    try {
      await apiService.leaveGroup(groupId);
      fetchGroups();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to leave group');
    }
  };

  const renderGroup = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.groupCard}
      onPress={() => {
        if (item.is_member) {
          router.push(`/group/${item.group_id}`);
        } else {
          Alert.alert(
            'Join Group',
            `Would you like to join "${item.name}"?`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Join', onPress: () => handleJoinGroup(item.group_id) },
            ]
          );
        }
      }}
    >
      <View style={styles.groupIcon}>
        <Ionicons name="people" size={24} color="#6B7FD7" />
      </View>
      <View style={styles.groupInfo}>
        <Text style={styles.groupName}>{item.name}</Text>
        <Text style={styles.groupDescription} numberOfLines={2}>
          {item.description}
        </Text>
        <View style={styles.groupMeta}>
          <View style={styles.topicBadge}>
            <Text style={styles.topicBadgeText}>{item.topic}</Text>
          </View>
          <Text style={styles.memberCount}>
            <Ionicons name="people-outline" size={14} color="#666" />{' '}
            {item.member_count} members
          </Text>
        </View>
      </View>
      {item.is_member ? (
        <View style={styles.memberBadge}>
          <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
        </View>
      ) : (
        <TouchableOpacity
          style={styles.joinButton}
          onPress={() => handleJoinGroup(item.group_id)}
        >
          <Text style={styles.joinButtonText}>Join</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Support Groups</Text>
        <Text style={styles.subtitle}>Join communities of people who understand</Text>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6B7FD7" />
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={60} color="#666" />
          <Text style={styles.emptyText}>No groups available</Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.group_id}
          renderItem={renderGroup}
          contentContainerStyle={styles.groupList}
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
    paddingBottom: 20,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#fff',
    fontSize: 18,
    marginTop: 16,
  },
  groupList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  groupCard: {
    backgroundColor: '#252541',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  groupIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(107, 127, 215, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  groupDescription: {
    color: '#9BA4D9',
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  groupMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 12,
  },
  topicBadge: {
    backgroundColor: 'rgba(107, 127, 215, 0.2)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  topicBadgeText: {
    color: '#9BA4D9',
    fontSize: 11,
  },
  memberCount: {
    color: '#666',
    fontSize: 12,
  },
  joinButton: {
    backgroundColor: '#6B7FD7',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginLeft: 8,
  },
  joinButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  memberBadge: {
    marginLeft: 8,
  },
});
