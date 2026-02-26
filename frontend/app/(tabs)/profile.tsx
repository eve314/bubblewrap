import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { apiService } from '../../src/services/api';

const GRIEF_TOPICS = [
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
  'Other',
];

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, refreshUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [selectedTopics, setSelectedTopics] = useState<string[]>(user?.grief_topics || []);
  const [isSaving, setIsSaving] = useState(false);

  const toggleTopic = (topic: string) => {
    if (selectedTopics.includes(topic)) {
      setSelectedTopics(selectedTopics.filter((t) => t !== topic));
    } else {
      setSelectedTopics([...selectedTopics, topic]);
    }
  };

  const handleSave = async () => {
    if (!bio.trim()) {
      Alert.alert('Please add a bio');
      return;
    }
    if (selectedTopics.length === 0) {
      Alert.alert('Please select at least one topic');
      return;
    }

    setIsSaving(true);
    try {
      await apiService.updateProfile({
        name: name.trim(),
        bio: bio.trim(),
        grief_topics: selectedTopics,
      });
      await refreshUser();
      setIsEditing(false);
      Alert.alert('Profile updated!');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: logout },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>Profile</Text>
            {!isEditing && (
              <TouchableOpacity onPress={() => setIsEditing(true)}>
                <Ionicons name="pencil" size={24} color="#6B7FD7" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.profileHeader}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarTextLarge}>{user?.name?.[0] || '?'}</Text>
            </View>
            {isEditing ? (
              <TextInput
                style={styles.nameInput}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                placeholderTextColor="#666"
              />
            ) : (
              <Text style={styles.profileName}>{user?.name}</Text>
            )}
            <Text style={styles.profileEmail}>{user?.email}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About Me</Text>
            {isEditing ? (
              <TextInput
                style={styles.bioInput}
                value={bio}
                onChangeText={setBio}
                placeholder="Tell others about your journey..."
                placeholderTextColor="#666"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            ) : (
              <Text style={styles.bioText}>{user?.bio || 'No bio yet'}</Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Topics</Text>
            {isEditing ? (
              <View style={styles.topicsContainer}>
                {GRIEF_TOPICS.map((topic) => (
                  <TouchableOpacity
                    key={topic}
                    style={[
                      styles.topicChip,
                      selectedTopics.includes(topic) && styles.topicChipSelected,
                    ]}
                    onPress={() => toggleTopic(topic)}
                  >
                    <Text
                      style={[
                        styles.topicText,
                        selectedTopics.includes(topic) && styles.topicTextSelected,
                      ]}
                    >
                      {topic}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.topicsContainer}>
                {(user?.grief_topics || []).map((topic: string) => (
                  <View key={topic} style={[styles.topicChip, styles.topicChipSelected]}>
                    <Text style={[styles.topicText, styles.topicTextSelected]}>{topic}</Text>
                  </View>
                ))}
                {(!user?.grief_topics || user.grief_topics.length === 0) && (
                  <Text style={styles.noTopicsText}>No topics selected</Text>
                )}
              </View>
            )}
          </View>

          {isEditing && (
            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setIsEditing(false);
                  setName(user?.name || '');
                  setBio(user?.bio || '');
                  setSelectedTopics(user?.grief_topics || []);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={isSaving}
              >
                <Text style={styles.saveButtonText}>
                  {isSaving ? 'Saving...' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {!isEditing && (
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color="#FF6B6B" />
              <Text style={styles.logoutButtonText}>Logout</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1A2E',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 30,
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
  nameInput: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#6B7FD7',
    paddingBottom: 4,
    minWidth: 150,
  },
  profileEmail: {
    color: '#9BA4D9',
    fontSize: 14,
    marginTop: 4,
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
  bioInput: {
    backgroundColor: '#252541',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#3A3A5A',
  },
  topicsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  topicChip: {
    backgroundColor: '#252541',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#3A3A5A',
  },
  topicChipSelected: {
    backgroundColor: '#6B7FD7',
    borderColor: '#6B7FD7',
  },
  topicText: {
    color: '#B8BDD9',
    fontSize: 14,
  },
  topicTextSelected: {
    color: '#fff',
  },
  noTopicsText: {
    color: '#666',
    fontSize: 14,
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#252541',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#6B7FD7',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 20,
    marginBottom: 40,
    gap: 8,
  },
  logoutButtonText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: '600',
  },
});
