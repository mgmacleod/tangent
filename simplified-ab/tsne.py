# tsne.py

import json
import os
import umap
import re   
import requests
import time
import threading
import queue
from pathlib import Path
import traceback
import numpy as np
from sklearn.manifold import TSNE
from collections import defaultdict
from dataclasses import dataclass
from typing import Optional, Dict, Tuple
import hdbscan
from scipy.spatial.distance import pdist, squareform
from flask import Flask, jsonify, request, Response
from flask_cors import CORS
import pandas as pd
from datetime import datetime
from sklearn.metrics.pairwise import cosine_similarity

# Flask application
app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": "*",
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "User-Agent", "Accept", "Accept-Language", "Connection"],
        "supports_credentials": True,
        "max_age": 3600
    }
})

EMBEDDING_MODEL = os.getenv('EMBEDDING_MODEL', 'all-minilm')
GENERATION_MODEL = os.getenv('GENERATION_MODEL', 'qwen2.5-coder:7b')


models_data = []

# Constants
BASE_DATA_DIR = './processed_data'
CLAUDE_DATA_DIR = os.path.join(BASE_DATA_DIR, 'claude')
CHATGPT_DATA_DIR = os.path.join(BASE_DATA_DIR, 'chatgpt')
REQUIRED_FILES = [
    'analytics.json',
    'embeddings_2d.json',
    'clusters.json',
    'topics.json',
    'chat_titles.json',
    'reflections.json'
]



@dataclass
class ProcessingTask:
    file_path: str
    status: str
    progress: float
    chat_type: str = ""
    data_dir: str = ""
    error: Optional[str] = None
    completed: bool = False

class BackgroundProcessor:
    def __init__(self):
        self.tasks: Dict[str, ProcessingTask] = {}
        self.task_queue = queue.Queue()
        self.processing_thread = threading.Thread(target=self._process_queue, daemon=True)
        self.processing_thread.start()

    def start_task(self, file_path: str) -> str:
        task_id = str(time.time())
        try:
            chat_type, data_dir = detect_chat_type(file_path)
            task = ProcessingTask(
                file_path=file_path,
                status='queued',
                progress=0.0,
                chat_type=chat_type,
                data_dir=data_dir
            )
            self.tasks[task_id] = task
            self.task_queue.put((task_id, task))
            return task_id
        except Exception as e:
            raise Exception(f"Error starting task: {str(e)}")

    def get_task_status(self, task_id: str) -> Optional[ProcessingTask]:
        return self.tasks.get(task_id)

    def _process_queue(self):
        while True:
            try:
                task_id, task = self.task_queue.get()
                if task_id not in self.tasks:
                    continue

                task.status = 'processing'
                try:
                    # Load and process the data based on chat type
                    with open(task.file_path, 'r') as f:
                        data = json.load(f)

                    # Process messages based on chat type
                    messages = (process_chatgpt_messages(data) if task.chat_type == "chatgpt" 
                              else process_claude_messages(data))

                    # Create DataFrame and process month by month
                    df = pd.DataFrame(messages)
                    df['month_year'] = df['timestamp'].dt.strftime('%Y-%m')

                    total_months = len(df['month_year'].unique())
                    current_month = 0

                    for update in process_data_by_month(df):
                        current_month += 1
                        task.progress = (current_month / total_months) * 100

                        # Save state and files
                        save_state(update, update['month_year'], task.data_dir)
                        
                        # Save monthly messages
                        month_messages = df[df['month_year'] <= update['month_year']]
                        messages_json = month_messages.to_json(orient='records', date_format='iso')
                        
                        # Save to appropriate directory
                        states_dir = os.path.join(task.data_dir, 'states')
                        os.makedirs(states_dir, exist_ok=True)
                        
                        with open(os.path.join(states_dir, f'messages_{update["month_year"]}.json'), 'w') as f:
                            f.write(messages_json)

                        # Update latest state files
                        save_latest_state(update, task.data_dir)

                    task.completed = True
                    task.status = 'completed'

                except Exception as e:
                    task.error = str(e)
                    task.status = 'failed'
                    print(f"Processing error: {str(e)}")
                    traceback.print_exc()

            except Exception as e:
                print(f"Error in processing thread: {str(e)}")
                traceback.print_exc()
                continue

            finally:
                self.task_queue.task_done()


def save_latest_state(update, data_dir):
    """Save the latest state files to the appropriate directory"""
    with open(os.path.join(data_dir, 'embeddings_2d.json'), 'w') as f:
        json.dump(update['points'], f)
    with open(os.path.join(data_dir, 'clusters.json'), 'w') as f:
        json.dump(update['clusters'], f)
    with open(os.path.join(data_dir, 'topics.json'), 'w') as f:
        json.dump(update['topics'], f)
    with open(os.path.join(data_dir, 'chat_titles.json'), 'w') as f:
        json.dump(update['titles'], f)


background_processor = BackgroundProcessor()

def ensure_directories():
    """Ensure all required data directories exist"""
    # Create base data directory
    os.makedirs(BASE_DATA_DIR, exist_ok=True)
    
    # Create chat-specific directories
    os.makedirs(CLAUDE_DATA_DIR, exist_ok=True)
    os.makedirs(CHATGPT_DATA_DIR, exist_ok=True)
    
    # Create states directories for both chat types
    os.makedirs(os.path.join(CLAUDE_DATA_DIR, 'states'), exist_ok=True)
    os.makedirs(os.path.join(CHATGPT_DATA_DIR, 'states'), exist_ok=True)

def check_files_exist(data_dir: str) -> dict:
    """Check which required files exist in the specified directory"""
    REQUIRED_FILES = [
        'analytics.json',
        'embeddings_2d.json',
        'clusters.json',
        'topics.json',
        'chat_titles.json',
        'reflections.json'
    ]
    
    existing_files = {}
    for file in REQUIRED_FILES:
        path = os.path.join(data_dir, file)
        existing_files[file] = os.path.exists(path)
    return existing_files

def send_progress(step, progress=0):
    return f"data: {json.dumps({'type': 'progress', 'step': step, 'progress': progress})}\n\n"

def send_error(message):
    return f"data: {json.dumps({'type': 'error', 'message': message})}\n\n"

def send_complete():
    return f"data: {json.dumps({'type': 'complete'})}\n\n"


def check_files_exist():
    """Check which required files exist"""
    existing_files = {}
    for file in REQUIRED_FILES:
        path = os.path.join(DATA_DIR, file)
        existing_files[file] = os.path.exists(path)
    return existing_files

def get_embeddings(texts):
    """Get embeddings from the embedding API"""
    url = 'http://localhost:11434/api/embed'
    payload = {'model': EMBEDDING_MODEL, 'input': texts}
    headers = {'Content-Type': 'application/json'}

    try:
        response = requests.post(url, json=payload, headers=headers)
        if response.status_code == 200:
            return response.json()['embeddings']
        else:
            print(f"Error: {response.status_code}, {response.text}")
            return None
    except Exception as e:
        print(f"Error getting embeddings: {str(e)}")
        return None


def detect_chat_type(file_path: str) -> Tuple[str, str]:
    """
    Detect whether the file contains Claude or ChatGPT chats and return the appropriate data directory
    """
    try:
        with open(file_path, 'r') as f:
            data = json.load(f)
            
        # Check first item in the data
        if isinstance(data, list):
            first_item = data[0] if data else {}
            
            # ChatGPT format detection (has 'mapping' field)
            if isinstance(first_item, dict) and "mapping" in first_item:
                os.makedirs(CHATGPT_DATA_DIR, exist_ok=True)
                return "chatgpt", CHATGPT_DATA_DIR
            
            # Claude format detection (has 'chat_messages' field)
            elif isinstance(first_item, dict) and "chat_messages" in first_item:
                os.makedirs(CLAUDE_DATA_DIR, exist_ok=True)
                return "claude", CLAUDE_DATA_DIR
            
        raise ValueError("Unknown chat format")
        
    except Exception as e:
        raise Exception(f"Error detecting chat type: {str(e)}")

def process_claude_messages(data: list) -> list:
    """Process Claude format messages"""
    messages = []
    for chat in data:
        for msg in chat.get("chat_messages", []):
            if not isinstance(msg, dict):
                continue
                
            try:
                timestamp = pd.to_datetime(msg.get("created_at"))
            except (ValueError, TypeError):
                continue
                
            messages.append({
                "chat_name": chat.get("name", "Unnamed Chat"),
                "chat_id": chat.get("uuid", ""),
                "message_id": msg.get("uuid", ""),
                "sender": msg.get("sender", "unknown"),
                "timestamp": timestamp,
                "text": msg.get("text", "")
            })
    return messages

def generate_reflection_for_cluster(struggle_texts):
    """Generate a reflection for a cluster based on struggle texts"""
    if not struggle_texts:
        return ""

    texts = "\n".join(f"- {text}" for text in struggle_texts)
    prompt = f"""You are a helpful assistant. Review the following user messages where they express difficulties:

{texts}

Summarize the key challenges they faced and provide a reflection or guidance that addresses these challenges.

Provide ONLY the reflection."""

    payload = {
        'model': GENERATION_MODEL,
        'prompt': prompt,
        'stream': False,
        'options': {
            'temperature': 0.5
        }
    }

    try:
        response = requests.post(
            'http://localhost:11434/api/generate',
            json=payload,
            headers={'Content-Type': 'application/json'}
        )

        if response.status_code == 200:
            reflection = response.json()['response'].strip()
            return reflection
        else:
            print(f"API request failed for generating reflection.")
            return ""
    except Exception as e:
        print(f"Error generating reflection: {str(e)}")
        return ""

def generate_topic_for_cluster(titles):
    """Generate a topic label for a cluster of titles"""
    titles_text = "\n".join(f"- {title}" for title in titles)
    prompt = f"""You are a technical topic analyzer. Review these related titles and provide a single concise topic label (2-4 words) that best describes their common theme.

Titles:
{titles_text}

Provide ONLY the topic label, nothing else. Examples:
"Network Security Tools"
"UI Animation Design"
"Data Visualization"
"API Integration"
"""

    payload = {
        'model': GENERATION_MODEL,
        'prompt': prompt,
        'stream': False,
        'options': {
            'temperature': 0.2
        }
    }

    try:
        response = requests.post(
            'http://localhost:11434/api/generate',
            json=payload,
            headers={'Content-Type': 'application/json'}
        )

        if response.status_code == 200:
            topic = response.json()['response'].strip().strip('"')
            return topic if topic else "Miscellaneous"
        else:
            print(f"API request failed for cluster with titles: {titles[:2]}...")
            return "Topic Generation Failed"

    except Exception as e:
        print(f"Error generating topic: {str(e)}")
        return "Error"

def process_data():
    """Process the data and generate all required files"""
    print("\nProcessing data...")

    # Load raw data
    with open(os.path.join(DATA_DIR, 'analytics.json'), 'r') as f:
        data = json.load(f)

    chat_titles = list(data['chat_lengths'].keys())

    # Get embeddings for chat titles
    print("Getting embeddings for chat titles...")
    embeddings = get_embeddings(chat_titles)
    if embeddings is None:
        raise Exception("Failed to retrieve embeddings.")

    embeddings_array = np.array(embeddings)

    # Perform t-SNE
    print("Performing t-SNE...")
    tsne = TSNE(
        n_components=2,
        random_state=42,
        perplexity=30,
        n_iter=1000,
        learning_rate='auto',
        init='random'
    )
    embeddings_2d = tsne.fit_transform(embeddings_array)

    # Calculate distances
    print("Calculating distances...")
    distances = pdist(embeddings_array, metric='cosine')
    distance_matrix = squareform(distances)

    # Perform clustering
    print("Performing clustering...")
    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=2,
        min_samples=1,
        metric='precomputed',
        cluster_selection_epsilon=0.3,
        cluster_selection_method='leaf',
        prediction_data=True
    )

    clusters = clusterer.fit_predict(distance_matrix)

    # Handle outliers
    print("Processing outliers...")
    outlier_mask = clusters == -1
    if np.any(outlier_mask):
        outlier_indices = np.where(outlier_mask)[0]
        valid_clusters = np.unique(clusters[clusters != -1])

        for idx in outlier_indices:
            if len(valid_clusters) > 0:
                distances_to_clusters = {}
                for valid_cluster in valid_clusters:
                    cluster_points = clusters == valid_cluster
                    avg_distance = np.mean(distance_matrix[idx, cluster_points])
                    distances_to_clusters[valid_cluster] = avg_distance

                nearest_cluster = min(distances_to_clusters.items(), key=lambda x: x[1])[0]
                clusters[idx] = nearest_cluster
            else:
                new_cluster = max(clusters) + 1 if len(clusters) > 0 else 0
                clusters[idx] = new_cluster

    # Group titles by cluster
    cluster_titles = defaultdict(list)
    for title, cluster_id in zip(chat_titles, clusters):
        cluster_titles[cluster_id].append(title)

    # Load struggle messages
    with open(os.path.join(DATA_DIR, 'struggles.json'), 'r') as f:
        struggles_by_chat = json.load(f)

    # Map chat names to cluster IDs
    chat_name_to_cluster = dict(zip(chat_titles, clusters))

    # Collect struggle texts by cluster
    struggles_by_cluster = defaultdict(list)
    for chat_name, struggle_texts in struggles_by_chat.items():
        cluster_id = chat_name_to_cluster.get(chat_name)
        if cluster_id is not None:
            struggles_by_cluster[cluster_id].extend(struggle_texts)

    # Generate topics, reflections, and metadata
    print("Generating topics and reflections...")
    cluster_metadata = {}

    for cluster_id, titles in cluster_titles.items():
        print(f"Processing cluster {cluster_id} with {len(titles)} titles...")
        topic = generate_topic_for_cluster(titles)
        struggle_texts = struggles_by_cluster.get(cluster_id, [])
        reflection = generate_reflection_for_cluster(struggle_texts)

        cluster_metadata[cluster_id] = {
            "topic": topic,
            "size": len(titles),
            "coherence": np.mean([
                1 - distance_matrix[i, j]
                for i in np.where(clusters == cluster_id)[0]
                for j in np.where(clusters == cluster_id)[0]
                if i < j
            ]) if len(titles) > 1 else 1.0,
            "reflection": reflection
        }

    # **Added Code Starts Here**
    # Identify chats that have reflections
    print("Identifying chats with reflections...")
    chats_with_reflections = set()
    for cluster_id, meta in cluster_metadata.items():
        if meta['reflection']:
            chats_in_cluster = cluster_titles[cluster_id]
            chats_with_reflections.update(chats_in_cluster)

    # Save chats_with_reflections to a JSON file
    with open(os.path.join(DATA_DIR, 'chats_with_reflections.json'), 'w') as f:
        json.dump(list(chats_with_reflections), f)
    # **Added Code Ends Here**

    # Save results
    print("Saving results...")
    with open(os.path.join(DATA_DIR, 'embeddings_2d.json'), 'w') as f:
        json.dump(embeddings_2d.tolist(), f)

    with open(os.path.join(DATA_DIR, 'clusters.json'), 'w') as f:
        json.dump(clusters.tolist(), f)

    with open(os.path.join(DATA_DIR, 'topics.json'), 'w') as f:
        topics_with_metadata = {str(k): v for k, v in cluster_metadata.items()}
        json.dump(topics_with_metadata, f)

    with open(os.path.join(DATA_DIR, 'chat_titles.json'), 'w') as f:
        json.dump(chat_titles, f)

    # Generate embeddings for reflections
    reflections = [meta['reflection'] for meta in cluster_metadata.values()]
    print("Generating embeddings for reflections...")
    reflection_embeddings = get_embeddings(reflections)

    # Save reflections and their embeddings
    with open(os.path.join(DATA_DIR, 'reflections.json'), 'w') as f:
        reflections_data = {
            str(cluster_id): {
                'reflection': meta['reflection'],
                'embedding': embedding
            }
            for cluster_id, meta, embedding in zip(cluster_metadata.keys(), cluster_metadata.values(), reflection_embeddings)
            if meta['reflection']
        }
        json.dump(reflections_data, f)

    # Print statistics
    num_clusters = len(np.unique(clusters))
    avg_cluster_size = np.mean([len(titles) for titles in cluster_titles.values()])

    print(f"\nClustering Statistics:")
    print(f"Number of clusters: {num_clusters}")
    print(f"Average cluster size: {avg_cluster_size:.1f}")

    return True

def identify_struggle_messages(df):
    """Identify messages where the user expresses struggles"""
    struggle_keywords = [
        "I'm struggling with",
        "I don't understand",
        "This is confusing",
        "I'm stuck on",
        "Need help with",
        "This doesn't make sense",
        "Can't figure out",
        "Having trouble with",
        "Not sure how to",
        "Difficult to",
        "Problem with",
        "Issue with",
        "Error when",
        "Failing to"
    ]

    pattern = '|'.join(struggle_keywords)
    struggle_df = df[df['text'].str.contains(pattern, case=False, na=False)]
    return struggle_df

def analyze_claude_chats(filepath: str) -> dict:
    """Analyze Claude chats and extract analytics"""
    with open(filepath, 'r') as f:
        data = json.load(f)

    messages = []
    for chat in data:
        for msg in chat["chat_messages"]:
            messages.append({
                "chat_name": chat["name"],
                "chat_id": chat["uuid"],
                "message_id": msg["uuid"],
                "sender": msg["sender"],
                "timestamp": msg["created_at"],
                "text": msg["text"],
                "has_attachments": bool(msg.get("attachments")),
                "has_files": bool(msg.get("files"))
            })

    df = pd.DataFrame(messages)
    df["timestamp"] = pd.to_datetime(df["timestamp"])

    messages_by_date = df.groupby(df["timestamp"].dt.strftime("%Y-%m-%d")).size()

    # Identify struggle messages
    struggle_df = identify_struggle_messages(df)

    # Group struggle messages by chat
    struggles_by_chat = struggle_df.groupby('chat_name')['text'].apply(list).to_dict()

    analytics = {
        "basic_stats": {
            "total_chats": len(data),
            "total_messages": len(messages),
            "date_range": {
                "start": df["timestamp"].min().strftime("%Y-%m-%d"),
                "end": df["timestamp"].max().strftime("%Y-%m-%d")
            }
        },
        "sender_distribution": df["sender"].value_counts().to_dict(),
        "messages_by_date": messages_by_date.to_dict(),
        "chat_lengths": df.groupby("chat_name").size().to_dict(),
        "struggles": {k: len(v) for k, v in struggles_by_chat.items()}
    }

    output_dir = Path(DATA_DIR)
    output_dir.mkdir(exist_ok=True)

    with open(output_dir / "analytics.json", "w") as f:
        json.dump(analytics, f, indent=2)

    # Save struggle messages
    with open(output_dir / "struggles.json", "w") as f:
        json.dump(struggles_by_chat, f, indent=2)

    df["timestamp"] = df["timestamp"].apply(lambda x: x.strftime("%Y-%m-%d %H:%M:%S"))
    df.to_json(output_dir / "messages.json", orient="records", indent=2)

    return analytics

def generate_topics(clusters, chat_titles):
    """Generate topics for clusters"""
    # Group titles by cluster
    cluster_titles = defaultdict(list)
    for title, cluster_id in zip(chat_titles, clusters):
        cluster_titles[cluster_id].append(title)

    # Generate topics for each cluster
    cluster_metadata = {}
    for cluster_id, titles in cluster_titles.items():
        topic = generate_topic_for_cluster(titles)
        cluster_metadata[str(cluster_id)] = {
            "topic": topic,
            "size": len(titles),
            "coherence": 1.0  # Simplified coherence calculation
        }

    # Save topics
    with open(os.path.join(DATA_DIR, 'topics.json'), 'w') as f:
        json.dump(cluster_metadata, f, indent=2)




def save_state(state_data, month_year, data_dir):
    """Save a specific state with timestamp to the appropriate directory"""
    state_dir = os.path.join(data_dir, 'states')
    os.makedirs(state_dir, exist_ok=True)

    state_file = os.path.join(state_dir, f'state_{month_year}.json')
    with open(state_file, 'w') as f:
        json.dump({
            'month_year': month_year,
            'points': state_data['points'],
            'clusters': state_data['clusters'],
            'titles': state_data['titles'],
            'topics': state_data['topics'],
            'total_conversations': state_data['total_conversations']
        }, f)


def process_claude_messages(data: list) -> list:
    """Process Claude format messages and reconstruct conversation tree if possible."""
    messages = []
    for chat in data:
        chat_name = chat.get("name", "Unnamed Chat")
        chat_id = chat.get("uuid", "")
        chat_messages = chat.get("chat_messages", [])
        # Build a message dictionary
        messages_dict = {}
        for msg in chat_messages:
            if not isinstance(msg, dict):
                continue
            msg_id = msg.get("uuid", "")
            messages_dict[msg_id] = {
                'id': msg_id,
                'parent_id': msg.get('parent', None),  # Assuming 'parent' field exists
                'message': msg,
                'children': []
            }
        # Link children to parents
        for msg_id, msg_data in messages_dict.items():
            parent_id = msg_data['parent_id']
            if parent_id and parent_id in messages_dict:
                messages_dict[parent_id]['children'].append(msg_data)
        # Find root messages
        root_messages = [msg for msg in messages_dict.values() if not msg['parent_id']]
        # Traverse the tree(s)
        for root in root_messages:
            traverse_claude_tree(root, chat_name, chat_id, messages)
    return messages

def traverse_claude_tree(node, chat_name, chat_id, messages, branch_id='0'):
    """Recursively traverse the conversation tree and extract messages."""
    msg = node['message']
    try:
        # Ensure timestamp is in datetime format
        timestamp = pd.to_datetime(msg.get("created_at"))
        if pd.isna(timestamp):
            return
        messages.append({
            "chat_name": chat_name,
            "chat_id": chat_id,
            "message_id": msg.get("uuid", ""),
            "parent_message_id": node['parent_id'],
            "branch_id": branch_id,
            "sender": msg.get("sender", "unknown"),
            "timestamp": timestamp,
            "text": msg.get("text", "")
        })
        # If the node has multiple children, we have a branch
        if len(node['children']) > 1:
            for idx, child in enumerate(node['children']):
                # Assign a new branch_id for each branch
                new_branch_id = f"{branch_id}.{idx}"
                traverse_claude_tree(child, chat_name, chat_id, messages, new_branch_id)
        else:
            for child in node['children']:
                traverse_claude_tree(child, chat_name, chat_id, messages, branch_id)
    except (ValueError, TypeError) as e:
        print(f"Error processing timestamp: {e}")
        return

def process_chatgpt_messages(data: list) -> list:
    """Process ChatGPT format messages and reconstruct conversation tree with proper timestamp handling."""
    messages = []
    for conversation in data:
        conv_title = conversation.get('title', 'Untitled Chat')
        conv_id = conversation.get('id', '')

        if "mapping" in conversation:
            mapping = conversation["mapping"]
            # Build a tree structure
            nodes = {}
            for node_id, node_data in mapping.items():
                # Extract message data
                message_data = node_data.get('message', {})
                if not message_data:
                    continue
                    
                # Handle timestamp conversion
                created_at = message_data.get("create_time")
                try:
                    if isinstance(created_at, (int, float)):
                        timestamp = pd.to_datetime(created_at, unit='s')
                    else:
                        timestamp = pd.to_datetime(created_at)
                    
                    if pd.isna(timestamp):
                        continue
                except (ValueError, TypeError):
                    continue

                # Extract content
                content = message_data.get("content", {})
                if isinstance(content, dict) and "parts" in content:
                    text = " ".join(str(part) for part in content["parts"])
                else:
                    text = str(content)

                # Get sender information
                sender_role = message_data.get("author", {}).get("role")
                sender = "human" if sender_role == "user" else "assistant"

                messages.append({
                    "chat_name": conv_title,
                    "chat_id": conv_id,
                    "message_id": message_data.get("id", ""),
                    "parent_message_id": node_data.get('parent'),
                    "branch_id": "0",  # Default branch ID
                    "sender": sender,
                    "timestamp": timestamp,  # This will be a pandas datetime object
                    "text": text
                })

    # Convert to DataFrame for timestamp handling
    if messages:
        df = pd.DataFrame(messages)
        # Ensure timestamp is in datetime format
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        # Sort by timestamp
        df = df.sort_values('timestamp')
        messages = df.to_dict('records')

    return messages

def traverse_tree(node, conv_title, conv_id, messages, branch_id='0'):
    """Recursively traverse the conversation tree and extract messages."""
    message_data = node['message']
    if not message_data or 'content' not in message_data:
        return
    content = message_data.get("content", {})
    if isinstance(content, dict) and "parts" in content:
        text = " ".join(str(part) for part in content["parts"])
    else:
        text = str(content)
    try:
        # Handle UNIX timestamp format
        created_at = message_data.get("create_time")
        if isinstance(created_at, (int, float)):
            timestamp = pd.to_datetime(created_at, unit='s')
        else:
            timestamp = pd.to_datetime(created_at)
        if pd.isna(timestamp):
            return
        sender_role = message_data.get("author", {}).get("role")
        messages.append({
            "chat_name": conv_title,
            "chat_id": conv_id,
            "message_id": message_data.get("id", ""),
            "parent_message_id": node['parent_id'],
            "branch_id": branch_id,
            "sender": "human" if sender_role == "user" else "assistant",
            "timestamp": timestamp,
            "text": text
        })
        # If the node has multiple children, we have a branch
        if len(node['children']) > 1:
            for idx, child in enumerate(node['children']):
                # Assign a new branch_id for each branch
                new_branch_id = f"{branch_id}.{idx}"
                traverse_tree(child, conv_title, conv_id, messages, new_branch_id)
        else:
            for child in node['children']:
                traverse_tree(child, conv_title, conv_id, messages, branch_id)
    except (ValueError, TypeError) as e:
        print(f"Error processing timestamp: {e}")
        return

def process_data_by_month(df):
    """Process data month by month and yield updates."""
    try:
        # Ensure timestamp column is datetime
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        
        # Remove any rows with invalid timestamps
        df = df.dropna(subset=['timestamp'])
        
        # Add month_year column with consistent format
        df['month_year'] = df['timestamp'].dt.strftime('%Y-%m')
        
        # Sort by month_year
        months = sorted(df['month_year'].unique())

        if not months:
            raise ValueError("No valid months found in data")

        accumulated_data = pd.DataFrame()
        
        print(f"Processing {len(months)} months of data...")
        for month in months:
            try:
                # Get data for current month and all previous months
                month_mask = df['month_year'] <= month
                accumulated_data = df[month_mask].copy()

                # Group messages by chat and branch for this time period
                chat_messages = accumulated_data.groupby(['chat_name', 'branch_id'])['text'].agg(list)
                chat_titles = ["{} (Branch {})".format(chat_name, branch_id) for chat_name, branch_id in chat_messages.index]

                if len(chat_titles) < 2:
                    print(f"Skipping month {month} - insufficient data points")
                    continue

                print(f"Processing month {month} with {len(chat_titles)} chats...")
                # Process the month's data and yield update
                update_data = process_single_month(chat_titles, month)
                if update_data:
                    yield update_data

            except Exception as e:
                print(f"Error processing month {month}: {str(e)}")
                traceback.print_exc()
                continue

    except Exception as e:
        print(f"Error in process_data_by_month: {str(e)}")
        traceback.print_exc()
        raise Exception(f"Error in process_data_by_month: {str(e)}")


def generate_cluster_metadata(clusters, chat_titles, distance_matrix):
    """Generate metadata for each cluster including topics and coherence scores"""
    # Group titles by cluster
    cluster_titles = defaultdict(list)
    for title, cluster_id in zip(chat_titles, clusters):
        cluster_titles[cluster_id].append(title)

    # Generate metadata for each cluster
    cluster_metadata = {}
    for cluster_id, titles in cluster_titles.items():
        # Generate topic label for cluster
        topic = generate_topic_for_cluster(titles)

        # Calculate coherence score based on pairwise distances
        cluster_indices = np.where(clusters == cluster_id)[0]
        coherence = 1.0  # Default for single-point clusters

        if len(cluster_indices) > 1:
            # Calculate average pairwise similarity within cluster
            cluster_distances = distance_matrix[cluster_indices][:, cluster_indices]
            coherence = np.mean([
                1 - cluster_distances[i, j]
                for i in range(len(cluster_indices))
                for j in range(i + 1, len(cluster_indices))
            ])

        cluster_metadata[str(cluster_id)] = {
            "topic": topic,
            "size": len(titles),
            "coherence": float(coherence),  # Ensure coherence is JSON serializable
            "reflection": ""  # Initialize empty reflection that can be populated later
        }

    return cluster_metadata

def process_single_month(chat_titles, month):
    try:
        print(f"Starting processing for month {month} with {len(chat_titles)} chats")

        # Get embeddings
        print(f"Fetching embeddings for {len(chat_titles)} titles...")
        embeddings = get_embeddings(chat_titles)
        if embeddings is None:
            print("Embeddings retrieval failed.")
            return None
        print("Embeddings retrieved successfully.")

        embeddings_array = np.array(embeddings)

        # Perform t-SNE
        print("Performing UMAP...")
        reducer = umap.UMAP(n_neighbors=15, min_dist=0.1, random_state=42)
        
        embeddings_2d = reducer.fit_transform(embeddings_array)
        # Calculate distances and perform clustering
        distances = pdist(embeddings_array, metric='cosine')
        distance_matrix = squareform(distances)

        clusters = perform_clustering(distance_matrix, len(chat_titles))

        # Generate topics and metadata
        cluster_metadata = generate_cluster_metadata(
            clusters, chat_titles, distance_matrix)

        return {
            'month_year': month,
            'points': embeddings_2d.tolist(),
            'clusters': clusters.tolist(),
            'titles': chat_titles,
            'topics': cluster_metadata,
            'total_conversations': len(chat_titles)
        }

    except Exception as e:
        print(f"Error processing single month: {str(e)}")
        return None

def perform_clustering(distance_matrix, n_points):
    """Perform clustering with proper error handling"""
    try:
        min_cluster_size = min(2, n_points - 1)
        clusterer = hdbscan.HDBSCAN(
            min_cluster_size=min_cluster_size,
            min_samples=1,
            metric='precomputed',
            cluster_selection_epsilon=0.3,
            cluster_selection_method='leaf',
            # Remove prediction_data since we're using precomputed distances
            prediction_data=False
        )

        clusters = clusterer.fit_predict(distance_matrix)

        # Handle outliers
        outlier_mask = clusters == -1
        if np.any(outlier_mask):
            clusters = handle_outliers(clusters, distance_matrix)

        return clusters

    except Exception as e:
        raise Exception(f"Clustering failed: {str(e)}")

def handle_outliers(clusters, distance_matrix):
    """Handle outlier points in clustering"""
    outlier_indices = np.where(clusters == -1)[0]
    valid_clusters = np.unique(clusters[clusters != -1])

    for idx in outlier_indices:
        if len(valid_clusters) > 0:
            distances_to_clusters = {}
            for valid_cluster in valid_clusters:
                cluster_points = clusters == valid_cluster
                avg_distance = np.mean(distance_matrix[idx, cluster_points])
                distances_to_clusters[valid_cluster] = avg_distance

            nearest_cluster = min(distances_to_clusters.items(), key=lambda x: x[1])[0]
            clusters[idx] = nearest_cluster
        else:
            new_cluster = max(clusters) + 1 if len(clusters) > 0 else 0
            clusters[idx] = new_cluster

    return clusters


def fetch_and_store_models():
    global models_data
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive',
        }
        
        print("Fetching models from ollama.com/library...")
        models_response = requests.get('https://ollama.com/library', headers=headers, timeout=10)
        print(f"Initial response status: {models_response.status_code}")
        
        if models_response.status_code != 200:
            print(f"Failed to fetch models: Status {models_response.status_code}")
            return

        model_links = re.findall(r'href="/library/([^"]+)', models_response.text)
        print(f"Found {len(model_links)} model links")
        
        if not model_links:
            print("No models found")
            return

        model_names = [link for link in model_links if link]
        print(f"Processing models: {model_names}")

        models_data = []
        for name in model_names:
            try:
                print(f"Fetching tags for {name}...")
                tags_response = requests.get(
                    f'https://ollama.com/library/{name}/tags', 
                    headers=headers, 
                    timeout=10
                )
                print(f"Tags response status for {name}: {tags_response.status_code}")
                
                if tags_response.status_code == 200:
                    tags = re.findall(f'{name}:[^"\\s]*', tags_response.text)
                    filtered_tags = [
                        tag for tag in tags 
                        if not any(x in tag for x in ['text', 'base', 'fp']) 
                        and not re.match(r'.*q[45]_[01]', tag)
                    ]
                    
                    model_type = (
                        'vision' if 'vision' in name 
                        else 'embedding' if 'minilm' in name 
                        else 'text'
                    )
                    
                    models_data.append({
                        'name': name,
                        'tags': filtered_tags,
                        'type': model_type
                    })
                    print(f"Successfully processed {name}")
                else:
                    print(f"Failed to get tags for {name}")
            except Exception as e:
                print(f"Error processing {name}: {str(e)}")
                continue

        print(f"Fetched and stored {len(models_data)} models")
    except Exception as e:
        print(f"Error fetching library models: {str(e)}")
        traceback.print_exc()

def generate_shift_label(parent_messages, child_messages):
    # Prepare the prompt
    parent_text = "\n".join([f"{msg['sender']}: {msg['text']}" for msg in parent_messages])
    child_text = "\n".join([f"{msg['sender']}: {msg['text']}" for msg in child_messages])

    prompt = f"""Parent Conversation Snippet:
{parent_text}

Child Conversation Snippet:
{child_text}

Describe the shift in conversation direction in one concise label."""

    # Call the LLM API
    payload = {
        'model': GENERATION_MODEL,
        'prompt': prompt,
        'stream': False,
        'options': {
            'temperature': 0.5
        }
    }

    try:
        response = requests.post(
            'http://localhost:11434/api/generate',
            json=payload,
            headers={'Content-Type': 'application/json'}
        )
        if response.status_code == 200:
            label = response.json()['response'].strip()
            return label
        else:
            print(f"Error generating shift label: {response.status_code}, {response.text}")
            return "Shift Label Generation Failed"
    except Exception as e:
        print(f"Error generating shift label: {str(e)}")
        return "Error"


def get_messages_around_index(messages, index, window=1):
    start = max(0, index - window)
    end = min(len(messages), index + window + 1)
    return messages[start:end]

# Function to start background tasks
def start_background_tasks():
    # Start a background thread to fetch models
    threading.Thread(target=fetch_and_store_models, daemon=True).start()


@app.before_request
def before_request():
    print("Incoming request:")
    print(f"Path: {request.path}")
    print(f"Method: {request.method}")
    print(f"Headers: {dict(request.headers)}")

@app.after_request
def after_request(response):
    print("Outgoing response:")
    print(f"Status: {response.status_code}")
    print(f"Headers: {dict(response.headers)}")
    return response


@app.route('/api/process', methods=['POST'])
def process_uploaded_data():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400

        file = request.files['file']
        if not file.filename.endswith('.json'):
            return jsonify({'error': 'Invalid file type'}), 400

        # Save uploaded file
        data_dir = Path('./unprocessed')
        data_dir.mkdir(exist_ok=True)
        file_path = data_dir / 'chat_data.json'
        file.save(file_path)

        # Start background processing
        task_id = background_processor.start_task(str(file_path))

        return jsonify({
            'task_id': task_id,
            'message': 'Processing started'
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/process/status/<task_id>', methods=['GET'])
def get_processing_status(task_id):
    task = background_processor.get_task_status(task_id)
    if not task:
        return jsonify({'error': 'Task not found'}), 404

    return jsonify({
        'status': task.status,
        'progress': task.progress,
        'error': task.error,
        'completed': task.completed
    })

@app.route('/api/visualization', methods=['GET'])
def get_visualization_data():
    chat_type = request.args.get('type', 'claude')  # Default to claude if not specified
    data_dir = CLAUDE_DATA_DIR if chat_type == 'claude' else CHATGPT_DATA_DIR
    
    try:
        data = load_visualization_data(data_dir)
        if not data['points'] or not data['clusters'] or not data['titles']:
            return jsonify({'error': 'No visualization data found'}), 404
            
        return jsonify({
            'points': data['points'],
            'clusters': data['clusters'],
            'titles': data['titles'],
            'topics': data['topics'],
            'chats_with_reflections': data['chats_with_reflections']
        })
        
    except Exception as e:
        print(f"Error getting visualization data: {str(e)}")
        return jsonify({'error': str(e)}), 500


def load_visualization_data(data_dir: str) -> dict:
    """Load visualization data from the specified directory."""
    try:
        data = {}
        
        # Load embeddings
        embeddings_path = os.path.join(data_dir, 'embeddings_2d.json')
        if os.path.exists(embeddings_path):
            with open(embeddings_path, 'r') as f:
                data['points'] = json.load(f)
        else:
            data['points'] = []
            
        # Load clusters
        clusters_path = os.path.join(data_dir, 'clusters.json')
        if os.path.exists(clusters_path):
            with open(clusters_path, 'r') as f:
                data['clusters'] = json.load(f)
        else:
            data['clusters'] = []
            
        # Load topics
        topics_path = os.path.join(data_dir, 'topics.json')
        if os.path.exists(topics_path):
            with open(topics_path, 'r') as f:
                data['topics'] = json.load(f)
        else:
            data['topics'] = {}
            
        # Load chat titles (now include branch info)
        titles_path = os.path.join(data_dir, 'chat_titles.json')
        if os.path.exists(titles_path):
            with open(titles_path, 'r') as f:
                data['titles'] = json.load(f)
        else:
            data['titles'] = []
            
        # Load chats with reflections
        reflections_path = os.path.join(data_dir, 'chats_with_reflections.json')
        if os.path.exists(reflections_path):
            with open(reflections_path, 'r') as f:
                data['chats_with_reflections'] = json.load(f)
        else:
            data['chats_with_reflections'] = []
            
        return data
        
    except Exception as e:
        print(f"Error loading visualization data: {str(e)}")
        return {
            'points': [],
            'clusters': [],
            'titles': [],
            'topics': {},
            'chats_with_reflections': []
        }


@app.route('/api/states', methods=['GET'])
def get_available_states():
    try:
        chat_type = request.args.get('type', 'claude')
        data_dir = CLAUDE_DATA_DIR if chat_type == 'claude' else CHATGPT_DATA_DIR
        
        state_dir = os.path.join(data_dir, 'states')
        if not os.path.exists(state_dir):
            return jsonify({'states': []})

        states = []
        for file in os.listdir(state_dir):
            if file.startswith('state_') and file.endswith('.json'):
                with open(os.path.join(state_dir, file), 'r') as f:
                    state_data = json.load(f)
                    states.append({
                        'month_year': state_data['month_year'],
                        'total_conversations': state_data['total_conversations']
                    })

        return jsonify({'states': sorted(states, key=lambda x: x['month_year'])})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/state/<month_year>', methods=['GET'])
def get_state(month_year):
    try:
        chat_type = request.args.get('type', 'claude')
        data_dir = CLAUDE_DATA_DIR if chat_type == 'claude' else CHATGPT_DATA_DIR
        
        state_file = os.path.join(data_dir, 'states', f'state_{month_year}.json')
        if not os.path.exists(state_file):
            return jsonify({'error': 'State not found'}), 404

        with open(state_file, 'r') as f:
            return jsonify(json.load(f))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/get-reflections', methods=['POST'])
def get_reflections():
    try:
        chat_type = request.args.get('type', 'claude')
        data_dir = CLAUDE_DATA_DIR if chat_type == 'claude' else CHATGPT_DATA_DIR
        
        data = request.json
        current_context = data.get('context', '')

        if not current_context:
            return jsonify({'reflections': []})

        # Generate embedding for current context
        context_embedding = get_embeddings([current_context])[0]

        # Load reflections and embeddings
        reflections_file = os.path.join(data_dir, 'reflections.json')
        if not os.path.exists(reflections_file):
            return jsonify({'reflections': []})
            
        with open(reflections_file, 'r') as f:
            reflections_data = json.load(f)

        # Compute similarity scores
        similarities = []
        for cluster_id, data in reflections_data.items():
            reflection_embedding = data['embedding']
            similarity = np.dot(context_embedding, reflection_embedding) / (
                np.linalg.norm(context_embedding) * np.linalg.norm(reflection_embedding)
            )
            similarities.append((similarity, data['reflection']))

        # Sort and filter reflections
        similarities.sort(reverse=True)
        top_reflections = [ref for sim, ref in similarities[:3] if sim > 0.5]

        return jsonify({'reflections': top_reflections})

    except Exception as e:
        print(f"Error retrieving reflections: {str(e)}")
        return jsonify({'reflections': []})

@app.route('/api/content/identify-messages', methods=['POST'])
def identify_relevant_messages():
    try:
        chat_type = request.args.get('type', 'claude')
        data_dir = CLAUDE_DATA_DIR if chat_type == 'claude' else CHATGPT_DATA_DIR
        
        topic_id = request.json['topicId']

        # Load necessary data
        with open(os.path.join(data_dir, 'messages.json'), 'r') as f:
            all_messages = json.load(f)

        with open(os.path.join(data_dir, 'chat_titles.json'), 'r') as f:
            chat_titles = json.load(f)

        with open(os.path.join(data_dir, 'clusters.json'), 'r') as f:
            clusters = json.load(f)

        # Get messages from the selected topic
        topic_messages = []
        for message in all_messages:
            chat_index = chat_titles.index(message['chat_name'])
            if clusters[chat_index] == int(topic_id):
                topic_messages.append(message)

        # Process messages
        message_texts = [msg['text'] for msg in topic_messages]
        embeddings = get_embeddings(message_texts)

        # Calculate scores
        centroid = np.mean(embeddings, axis=0)
        similarities = cosine_similarity([centroid], embeddings)[0]
        lengths = np.array([len(msg['text']) for msg in topic_messages])
        length_scores = lengths / np.max(lengths) if lengths.size > 0 else np.array([])
        final_scores = 0.6 * similarities + 0.4 * length_scores

        # Get top messages
        top_indices = np.argsort(final_scores)[-20:][::-1]
        top_messages = [topic_messages[i] for i in top_indices]

        return jsonify(top_messages)

    except Exception as e:
        print(f"Error identifying messages: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/topics', methods=['GET'])
def get_topics():
    try:
        chat_type = request.args.get('type', 'claude')
        data_dir = CLAUDE_DATA_DIR if chat_type == 'claude' else CHATGPT_DATA_DIR
        
        with open(os.path.join(data_dir, 'topics.json'), 'r') as f:
            topics = json.load(f)
        return jsonify(topics)
    except Exception as e:
        print(f"Error getting topics: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/messages_all/<path:chat_name>', methods=['GET'])
def get_all_chat_messages(chat_name):
    try:
        chat_type = request.args.get('type', 'chatgpt')
        data_dir = CLAUDE_DATA_DIR if chat_type == 'claude' else CHATGPT_DATA_DIR
        states_dir = os.path.join(data_dir, 'states')
        
        # Get latest messages file
        message_files = [f for f in os.listdir(states_dir) if f.startswith('messages_')]
        if not message_files:
            return jsonify({'error': 'No message data found'}), 404

        latest_file = sorted(message_files)[-1]
        messages_path = os.path.join(states_dir, latest_file)

        print(f"Loading messages from: {messages_path}")
        with open(messages_path, 'r') as f:
            all_messages = json.load(f)

        # **Parse chat_name to extract base name**
        match = re.match(r'^(.*) \(Branch \d+\)$', chat_name)
        if match:
            base_chat_name = match.group(1)
        else:
            base_chat_name = chat_name

        # **Filter messages for the base chat name**
        chat_messages = [msg for msg in all_messages if msg.get('chat_name') == base_chat_name]

        if not chat_messages:
            return jsonify({'error': f'No messages found for chat: {chat_name}'}), 404

        # Group messages by branch_id
        from collections import defaultdict
        branches = defaultdict(list)
        for msg in chat_messages:
            branch_id = msg.get('branch_id', '0')
            branches[branch_id].append(msg)

        # Sort messages within each branch
        for branch_msgs in branches.values():
            branch_msgs.sort(key=lambda x: pd.to_datetime(x.get('timestamp', '0')))

        return jsonify({'branches': branches})

    except Exception as e:
        print(f"Error retrieving messages: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/messages/<path:chat_name>', methods=['GET'])
def get_chat_messages(chat_name):
    """Get messages for a specific chat and branch."""
    try:
        chat_type = request.args.get('type', 'chatgpt')
        data_dir = CLAUDE_DATA_DIR if chat_type == 'claude' else CHATGPT_DATA_DIR
        states_dir = os.path.join(data_dir, 'states')
        
        # Get the latest messages file
        message_files = [f for f in os.listdir(states_dir) if f.startswith('messages_')]
        if not message_files:
            return jsonify({'error': 'No message data found'}), 404
                
        latest_file = sorted(message_files)[-1]
        messages_path = os.path.join(states_dir, latest_file)
            
        print(f"Loading messages from: {messages_path}")
        with open(messages_path, 'r') as f:
            all_messages = json.load(f)

        # Parse chat_name to extract base name and branch_id
        match = re.match(r'^(.*) \(Branch (\d+)\)$', chat_name)
        if match:
            base_chat_name = match.group(1)
            branch_id = match.group(2)
        else:
            base_chat_name = chat_name
            branch_id = '0'  # Default branch ID if none is specified

        # Filter messages based on base_chat_name and branch_id
        chat_messages = [
            msg for msg in all_messages
            if msg.get('chat_name') == base_chat_name and msg.get('branch_id', '0') == branch_id
        ]

        if not chat_messages:
            return jsonify({'error': f'No messages found for chat: {chat_name}'}), 404

        # Sort messages by timestamp
        chat_messages.sort(key=lambda x: pd.to_datetime(x.get('timestamp', '0')))
        
        return jsonify({'messages': chat_messages})

    except Exception as e:
        print(f"Error retrieving messages: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500
    
@app.route('/api/models/library', methods=['GET'])
def get_library_models():
    global models_data
    if not models_data:
        return jsonify({'error': 'Models data not yet loaded'}), 503
    return jsonify({'models': models_data})

if __name__ == '__main__':
    # Ensure data directory exists
    ensure_directories()
    # Start background tasks
    start_background_tasks()
    print("\nStarting Flask server...")
    app.run(debug=True)