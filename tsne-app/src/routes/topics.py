from flask import Blueprint, request, jsonify
from services.topic_generation import generate_topic_for_cluster
import os
import json
from config import CLAUDE_DATA_DIR, CHATGPT_DATA_DIR

topics_bp = Blueprint("topics", __name__)


@topics_bp.route("/api/topics", methods=["GET"])
def get_topics():
    try:
        chat_type = request.args.get("type", "claude")
        data_dir = CLAUDE_DATA_DIR if chat_type == "claude" else CHATGPT_DATA_DIR

        topics_path = os.path.join(data_dir, "topics.json")
        if not os.path.exists(topics_path):
            return jsonify({"error": "Topics not found"}), 404

        with open(topics_path, "r") as f:
            topics = json.load(f)

        return jsonify(topics)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@topics_bp.route("/api/topics/generate", methods=["POST"])
def generate_topic():
    try:
        data = request.json
        titles = data.get("titles", [])
        if not titles:
            return jsonify({"error": "No titles provided"}), 400

        topic = generate_topic_for_cluster(titles)
        return jsonify({"topic": topic})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
