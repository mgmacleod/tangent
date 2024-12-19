from flask import Blueprint, jsonify, request
from services.data_processing import get_chat_messages

messages_bp = Blueprint("messages", __name__)


@messages_bp.route("/api/messages/<path:chat_name>", methods=["GET"])
def get_chat_messages_route(chat_name):
    try:
        chat_type = request.args.get(
            "type", "claude"
        )  # Default to claude if not specified
        messages = get_chat_messages(chat_name, chat_type=chat_type)
        return jsonify({"messages": messages})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@messages_bp.route("/api/messages_all/<path:chat_name>", methods=["GET"])
def get_all_chat_messages_route(chat_name):
    try:
        chat_type = request.args.get(
            "type", "claude"
        )  # Default to claude if not specified
        messages = get_chat_messages(chat_name, chat_type=chat_type, all_messages=True)
        return jsonify({"branches": messages})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
