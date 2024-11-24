<div align="center">
  <img src="https://github.com/user-attachments/assets/4243cc3b-1d62-4aa9-aa77-0d8414e06053" alt="tangent" style="border-radius: 10px">
</div>

<div align="center">
  
## What is this?
Tangent is a canvas for exploring AI conversations, treating each chat branch as an experiment you can merge, compare, and discard. It lets you resurrect conversations that hit context limits, pick up abandoned threads, and map the hidden connections between different discussions.

## Core stuff it does:

</div>

* Resurrect & Continue: Pick up conversations that hit Claude's context limit or were abandoned mid-thought
* Branch & Explore: Split conversations at any point to test different approaches
* Offline-First: Powered completely by local models (Ollama currenly but more planned)
* Smart Merging: Combine the best parts of different conversation branches using LLMs
* Topic Clustering: Group and filter conversations based on their learned topics.
* Pattern Detection: Surface common topics and struggles across conversations
* AI Reflections: Get insights on recurring themes and challenges
* Archive Support: Supports Claude and ChatGPT data exports (more to come).


<div align="center">

> The idea is to make your interaction with AI assistants more of an visual/textual/audio exploration rather than a plain chat interface. Think less "chat app" and more "thoughts workbench" where you can experiment freely, revive old threads that still have potential, or dive into tangents.

## Prerequisites

</div>


* [Whisper.cpp](https://github.com/ggerganov/whisper.cpp) (`git clone https://github.com/ggerganov/whisper.cpp` -> `cd whisper.cpp` -> `sh ./models/download-ggml-model.sh base.en` -> `make` -> `make server && ./server`)
* [Ollama](https://ollama.com/) (project was kinda hardcoded for ollama but can be generalized to accept diff backends)
* Exported Archive Data (from Claude or ChatGPT).

<div align="center">



</div>

<div align="center">
  
### Environment Setup

</div>

Initialize a new venv (mac):
```bash
python3 -m venv rhunic_env
source rhunic_env/bin/activate
```

Install Python packages:
```bash
pip install flask flask-cors scikit-learn numpy pandas hdbscan umap-learn requests
```

<div align="center">
  
### Ollama Setup

</div>

Install Ollama
> find the appropriate image for your system here: https://ollama.com/

Verify installation
```bash
ollama --version                                                                                                                      
ollama version is 0.4.4
```

Download models (embedding + llm)
> if you choose to swap these pls see the `Configure local models` section below
```bash
ollama pull all-minilm
ollama pull qwen2.5-coder:7b
```

Start Ollama (download if u don't already have it)
```bash
ollama serve
```

<div align="center">
  
### Backend Setup

</div>

Configure local models:
```bash
cd simplified-ab
export EMBEDDING_MODEL="custom-embedding-model"
export GENERATION_MODEL="custom-generation-model"
```

Then run with:
```bash
python3 tsne.py
```

Or all together:
```bash
python3 tsne.py --embedding-model "custom-embedding-model" --generation-model "custom-generation-model"
```

<div align="center">
  
  ### Frontend Setup
  
</div>

```bash
cd simplified-ui
npm i
npm start
```

> if you get any missing pckg error just manually install it and restart the UI
