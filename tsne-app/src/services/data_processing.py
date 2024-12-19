import os
import json
import pandas as pd
from collections import defaultdict
from typing import List, Dict, Tuple

def process_claude_messages(data: List[dict]) -> List[dict]:
    messages = []
    for chat in data:
        chat_name = chat.get("name", "Unnamed Chat")
        chat_id = chat.get("uuid", "")
        chat_messages = chat.get("chat_messages", [])
        children_by_parent = defaultdict(list)
        messages_dict = {}

        for msg in chat_messages:
            # Logic to build messages_dict and children_by_parent

        for msg_id, msg in messages_dict.items():
            # Logic to process messages with branch information

    return messages

def process_chatgpt_messages(data: List[dict]) -> List[dict]:
    messages = []
    for conversation in data:
        # Logic to process ChatGPT format messages

    if messages:
        # Convert to DataFrame for timestamp handling

    return messages

def traverse_tree(node: dict, conv_title: str, conv_id: str, messages: List[dict], branch_id: str = "0"):
    message_data = node["message"]
    if not message_data or "content" not in message_data:
        return
    content = message_data.get("content", {})
    if isinstance(content, dict) and "parts" in content:
        # Logic to handle content parts
    else:
        # Logic to handle other content types
    try:
        # Logic to process message data
    except (ValueError, TypeError) as e:
        print(f"Error processing message: {e}")

def identify_struggle_messages(df: pd.DataFrame) -> pd.DataFrame:
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
        "Failing to",
    ]
    pattern = "|".join(struggle_keywords)
    struggle_df = df[df["text"].str.contains(pattern, case=False, na=False)]
    return struggle_df

def generate_cluster_metadata(clusters: List[int], chat_titles: List[str], distance_matrix: pd.DataFrame) -> Dict[int, dict]:
    cluster_titles = defaultdict(list)
    for title, cluster_id in zip(chat_titles, clusters):
        cluster_titles[cluster_id].append(title)

    cluster_metadata = {}
    for cluster_id, titles in cluster_titles.items():
        # Logic to generate metadata for each cluster

    return cluster_metadata