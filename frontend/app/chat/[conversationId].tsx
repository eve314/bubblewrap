import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { useAuth } from '../../src/context/AuthContext';
import { apiService } from '../../src/services/api';
import { formatDistanceToNow } from 'date-fns';
import { Image } from 'expo-image';

export default function ChatScreen() {
  const router = useRouter();
  const { conversationId } = useLocalSearchParams();
  const { user } = useAuth();
  const [conversation, setConversation] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showCrisisAlert, setShowCrisisAlert] = useState(false);
  const [crisisData, setCrisisData] = useState<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const fetchData = async () => {
    try {
      const [convData, messagesData] = await Promise.all([
        apiService.getConversation(conversationId as string),
        apiService.getMessages(conversationId as string),
      ]);
      setConversation(convData);
      setMessages(messagesData.messages || []);
    } catch (error) {
      console.error('Error fetching chat:', error);
      Alert.alert('Error', 'Failed to load conversation');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // Poll for new messages
    return () => clearInterval(interval);
  }, [conversationId]);

  const sendMessage = async (content?: string, type: string = 'text', mediaData?: string) => {
    if (!content && !mediaData) return;
    
    setIsSending(true);
    try {
      const response = await apiService.sendMessage(conversationId as string, {
        content,
        message_type: type,
        media_data: mediaData,
      });
      
      setMessages((prev) => [...prev, response.message]);
      setMessageText('');

      // Check for crisis alert
      if (response.crisis_alert) {
        setCrisisData(response.crisis_alert);
        setShowCrisisAlert(true);
      }

      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendText = () => {
    if (messageText.trim()) {
      sendMessage(messageText.trim(), 'text');
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0].base64) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      sendMessage(undefined, 'image', base64Image);
    }
  };

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant microphone permission');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (uri) {
        // Convert to base64
        const response = await fetch(uri);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result as string;
          sendMessage(undefined, 'voice', base64);
        };
        reader.readAsDataURL(blob);
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
    }
  };

  const playAudio = async (base64Data: string) => {
    try {
      const { sound } = await Audio.Sound.createAsync({ uri: base64Data });
      await sound.playAsync();
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return '';
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isOwnMessage = item.sender_id === user?.user_id;

    return (
      <View
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessage : styles.otherMessage,
        ]}
      >
        {item.message_type === 'text' && (
          <Text style={[styles.messageText, isOwnMessage && styles.ownMessageText]}>
            {item.content}
          </Text>
        )}
        {item.message_type === 'image' && item.media_data && (
          <Image
            source={{ uri: item.media_data }}
            style={styles.messageImage}
            contentFit="cover"
          />
        )}
        {item.message_type === 'voice' && item.media_data && (
          <TouchableOpacity
            style={styles.voiceMessage}
            onPress={() => playAudio(item.media_data)}
          >
            <Ionicons name="play" size={24} color={isOwnMessage ? '#fff' : '#6B7FD7'} />
            <Text style={[styles.voiceText, isOwnMessage && styles.ownMessageText]}>
              Voice message
            </Text>
          </TouchableOpacity>
        )}
        <Text style={[styles.messageTime, isOwnMessage && styles.ownMessageTime]}>
          {formatTime(item.created_at)}
        </Text>
        {item.crisis_detected && (
          <View style={styles.crisisIndicator}>
            <Ionicons name="heart" size={12} color="#FF6B6B" />
          </View>
        )}
      </View>
    );
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>
              {conversation?.other_user?.name?.[0] || '?'}
            </Text>
          </View>
          <Text style={styles.headerName}>{conversation?.other_user?.name}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.chatContainer}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.message_id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />

        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.mediaButton} onPress={handlePickImage}>
            <Ionicons name="image" size={24} color="#6B7FD7" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.mediaButton, isRecording && styles.recordingButton]}
            onPressIn={startRecording}
            onPressOut={stopRecording}
          >
            <Ionicons name="mic" size={24} color={isRecording ? '#FF6B6B' : '#6B7FD7'} />
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="#666"
            value={messageText}
            onChangeText={setMessageText}
            multiline
          />

          <TouchableOpacity
            style={[styles.sendButton, (!messageText.trim() || isSending) && styles.sendButtonDisabled]}
            onPress={handleSendText}
            disabled={!messageText.trim() || isSending}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Crisis Alert Modal */}
      <Modal visible={showCrisisAlert} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="heart" size={40} color="#FF6B6B" />
              <Text style={styles.modalTitle}>We Care About You</Text>
            </View>
            <Text style={styles.modalMessage}>{crisisData?.support_message}</Text>
            <Text style={styles.resourcesTitle}>Support Resources:</Text>
            {crisisData?.resources?.map((resource: string, index: number) => (
              <Text key={index} style={styles.resourceText}>{resource}</Text>
            ))}
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowCrisisAlert(false)}
            >
              <Text style={styles.modalButtonText}>I Understand</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#6B7FD7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerAvatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  messageContainer: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  ownMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#6B7FD7',
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#252541',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    color: '#B8BDD9',
    fontSize: 16,
    lineHeight: 22,
  },
  ownMessageText: {
    color: '#fff',
  },
  messageTime: {
    color: '#666',
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  voiceMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  voiceText: {
    color: '#B8BDD9',
    fontSize: 14,
  },
  crisisIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#2A2A4E',
    gap: 8,
  },
  mediaButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingButton: {
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    borderRadius: 20,
  },
  input: {
    flex: 1,
    backgroundColor: '#252541',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 16,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6B7FD7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#252541',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    alignItems: 'center',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 12,
  },
  modalMessage: {
    color: '#B8BDD9',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  resourcesTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  resourceText: {
    color: '#9BA4D9',
    fontSize: 14,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  modalButton: {
    backgroundColor: '#6B7FD7',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginTop: 20,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
