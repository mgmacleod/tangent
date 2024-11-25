import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

export const ConversationLoader = ({ 
  title, 
  onLoadComplete, 
  onError, 
  chatType = 'chatgpt',
  className = '' 
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);

  const loadMessages = useCallback(async () => {
    try {
      const encodedTitle = encodeURIComponent(title);
      const response = await axios.get(
        `http://127.0.0.1:5000/api/messages/${encodedTitle}?type=${chatType}`,
        {
          validateStatus: function (status) {
            return status < 500; // Handle 404s without throwing
          },
          onDownloadProgress: (progressEvent) => {
            const percentage = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setProgress(percentage);
          }
        }
      );

      if (response.status === 200 && response.data) {
        // Process the messages and create nodes
        const nodes = [{
          id: Date.now(),
          title: title,
          messages: response.data,
          type: 'conversation',
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
          chatType: chatType
        }];

        // Call the completion callback with the new nodes
        if (onLoadComplete) {
          onLoadComplete(nodes);
        }
      } else {
        throw new Error('Failed to load conversation');
      }

    } catch (error) {
      console.error('Error loading conversation:', error);
      setError(error.message);
      if (onError) {
        onError(error);
      }
    } finally {
      setLoading(false);
    }
  }, [title, chatType, onLoadComplete, onError]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const LoadingIndicator = () => (
    <div className="flex items-center space-x-2">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>Loading conversation... {progress}%</span>
    </div>
  );

  const ErrorMessage = () => (
    <div className="text-destructive">
      Error loading conversation: {error}
    </div>
  );

  return (
    <div className={`conversation-loader ${className}`}>
      {loading && <LoadingIndicator />}
      {error && <ErrorMessage />}
    </div>
  );
};

export class ConversationLoaderClass {
  constructor({ title, onLoadComplete, chatType = 'chatgpt' }) {
    this.title = title;
    this.onLoadComplete = onLoadComplete;
    this.chatType = chatType;
  }

  async process() {
    try {
      const encodedTitle = encodeURIComponent(this.title);
      const response = await axios.get(
        `http://127.0.0.1:5000/api/messages/${encodedTitle}?type=${this.chatType}`,
        {
          validateStatus: function (status) {
            return status < 500;
          }
        }
      );

      if (response.status === 200 && response.data) {
        const nodes = [{
          id: Date.now(),
          title: this.title,
          messages: response.data,
          type: 'conversation',
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
          chatType: this.chatType
        }];

        if (this.onLoadComplete) {
          this.onLoadComplete(nodes);
        }

        return nodes;
      }
      
      throw new Error('Failed to load conversation');

    } catch (error) {
      console.error('Error processing conversation:', error);
      throw error;
    }
  }

  async loadAllMessages() {
    try {
      const encodedTitle = encodeURIComponent(this.title);
      const response = await axios.get(
        `http://127.0.0.1:5000/api/messages_all/${encodedTitle}?type=${this.chatType}`,
        {
          validateStatus: function (status) {
            return status < 500;
          }
        }
      );

      if (response.status === 200) {
        return response.data;
      }
      return null;
    } catch (error) {
      console.error(`Error fetching all messages:`, error);
      return null;
    }
  }
}

// Helper function to fetch messages for a specific conversation
export const fetchMessages = async (title, chatType = 'chatgpt') => {
  const encodedTitle = encodeURIComponent(title);
  try {
    const response = await axios.get(
      `http://127.0.0.1:5000/api/messages/${encodedTitle}?type=${chatType}`,
      {
        validateStatus: function (status) {
          return status < 500;
        }
      }
    );
    if (response.status === 200) {
      return response.data;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching messages:`, error);
    return null;
  }
};

// Helper function to fetch all messages for a specific conversation
export const fetchAllMessages = async (title, chatType = 'chatgpt') => {
  const encodedTitle = encodeURIComponent(title);
  try {
    const response = await axios.get(
      `http://127.0.0.1:5000/api/messages_all/${encodedTitle}?type=${chatType}`,
      {
        validateStatus: function (status) {
          return status < 500;
        }
      }
    );
    if (response.status === 200) {
      return response.data;
    }
    return null;
  } catch (error) {
    console.error(`Error fetching all messages:`, error);
    return null;
  }
};

export default ConversationLoader;