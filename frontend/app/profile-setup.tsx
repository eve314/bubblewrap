import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { apiService } from '../src/services/api';

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

export default function ProfileSetup() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [bio, setBio] = useState(user?.bio || '');
  const [selectedTopics, setSelectedTopics] = useState<string[]>(user?.grief_topics || []);
  const [isLoading, setIsLoading] = useState(false);

  const toggleTopic = (topic: string) => {
    if (selectedTopics.includes(topic)) {
      setSelectedTopics(selectedTopics.filter((t) => t !== topic));
    } else {
      setSelectedTopics([...selectedTopics, topic]);
    }
  };

  const handleSave = async () => {
    if (!bio.trim()) {
      Alert.alert('Please add a short bio', 'This helps others understand your journey.');
      return;
    }
    if (selectedTopics.length === 0) {
      Alert.alert('Please select at least one topic', 'This helps connect you with others who share similar experiences.');
      return;
    }

    setIsLoading(true);
    try {
      await apiService.updateProfile({
        bio: bio.trim(),
        grief_topics: selectedTopics,
      });
      await refreshUser();
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Profile update error:', error);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.title}>Complete Your Profile</Text>
            <Text style={styles.subtitle}>
              Help us connect you with others who understand your journey
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About You</Text>
            <Text style={styles.sectionSubtitle}>
              Share a little about yourself and your grief journey (optional to share specifics)
            </Text>
            <TextInput
              style={styles.bioInput}
              placeholder="I'm here because..."
              placeholderTextColor="#666"
              multiline
              numberOfLines={4}
              value={bio}
              onChangeText={setBio}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What brings you here?</Text>
            <Text style={styles.sectionSubtitle}>
              Select the topics that relate to your experience
            </Text>
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
                  {selectedTopics.includes(topic) && (
                    <Ionicons name="checkmark" size={16} color="#fff" style={styles.checkIcon} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isLoading}
          >
            <Text style={styles.saveButtonText}>
              {isLoading ? 'Saving...' : 'Continue'}
            </Text>
          </TouchableOpacity>
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
    marginTop: 20,
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#9BA4D9',
    lineHeight: 22,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  bioInput: {
    backgroundColor: '#252541',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#3A3A5A',
  },
  topicsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  topicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#252541',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
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
    fontWeight: '500',
  },
  checkIcon: {
    marginLeft: 6,
  },
  saveButton: {
    backgroundColor: '#6B7FD7',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
