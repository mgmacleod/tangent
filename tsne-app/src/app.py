from flask import Flask
from flask_cors import CORS
from routes.api import api_bp
from routes.chats import chats_bp
from routes.messages import messages_bp
from routes.states import states_bp
from routes.topics import topics_bp
from config import BASE_DATA_DIR

app = Flask(__name__)
CORS(app)

app.register_blueprint(api_bp, url_prefix='/api')
app.register_blueprint(chats_bp, url_prefix='/api/chats')
app.register_blueprint(messages_bp, url_prefix='/api/messages')
app.register_blueprint(states_bp, url_prefix='/api/states')
app.register_blueprint(topics_bp, url_prefix='/api/topics')

if __name__ == "__main__":
    app.run(debug=True, port=5001)