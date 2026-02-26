import axios from 'axios';

const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || '';
const API_URL = `${API_BASE}/api`;

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const apiService = {
  // Auth
  exchangeSession: async (sessionId: string) => {
    const response = await api.post('/auth/session', { session_id: sessionId });
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  logout: async () => {
    const response = await api.post('/auth/logout');
    return response.data;
  },

  // User Profile
  updateProfile: async (data: { name?: string; bio?: string; grief_topics?: string[]; picture?: string }) => {
    const response = await api.put('/users/profile', data);
    return response.data;
  },

  // Browse Users
  browseUsers: async (topic?: string, skip: number = 0, limit: number = 20) => {
    const params: any = { skip, limit };
    if (topic) params.topic = topic;
    const response = await api.get('/users/browse', { params });
    return response.data;
  },

  getUser: async (userId: string) => {
    const response = await api.get(`/users/${userId}`);
    return response.data;
  },

  // Connections
  sendConnectionRequest: async (toUserId: string, message?: string) => {
    const response = await api.post(`/connections/request/${toUserId}`, null, {
      params: { message },
    });
    return response.data;
  },

  getConnectionRequests: async () => {
    const response = await api.get('/connections/requests');
    return response.data;
  },

  respondToConnection: async (requestId: string, accept: boolean) => {
    const response = await api.post(`/connections/respond/${requestId}`, null, {
      params: { accept },
    });
    return response.data;
  },

  getConnections: async () => {
    const response = await api.get('/connections');
    return response.data;
  },

  // Conversations
  getConversations: async () => {
    const response = await api.get('/conversations');
    return response.data;
  },

  getConversation: async (conversationId: string) => {
    const response = await api.get(`/conversations/${conversationId}`);
    return response.data;
  },

  getMessages: async (conversationId: string, skip: number = 0, limit: number = 50) => {
    const response = await api.get(`/conversations/${conversationId}/messages`, {
      params: { skip, limit },
    });
    return response.data;
  },

  sendMessage: async (conversationId: string, data: { content?: string; message_type?: string; media_data?: string }) => {
    const response = await api.post(`/conversations/${conversationId}/messages`, data);
    return response.data;
  },

  // Groups
  getGroups: async (topic?: string) => {
    const params: any = {};
    if (topic) params.topic = topic;
    const response = await api.get('/groups', { params });
    return response.data;
  },

  joinGroup: async (groupId: string) => {
    const response = await api.post(`/groups/${groupId}/join`);
    return response.data;
  },

  leaveGroup: async (groupId: string) => {
    const response = await api.post(`/groups/${groupId}/leave`);
    return response.data;
  },

  getGroupMessages: async (groupId: string, skip: number = 0, limit: number = 50) => {
    const response = await api.get(`/groups/${groupId}/messages`, {
      params: { skip, limit },
    });
    return response.data;
  },

  sendGroupMessage: async (groupId: string, data: { content?: string; message_type?: string; media_data?: string }) => {
    const response = await api.post(`/groups/${groupId}/messages`, data);
    return response.data;
  },

  seedGroups: async () => {
    try {
      const response = await api.post('/seed-groups');
      return response.data;
    } catch (error) {
      // Ignore errors if groups already exist
      return null;
    }
  },

  // Topics
  getGriefTopics: async () => {
    const response = await api.get('/grief-topics');
    return response.data;
  },
};
