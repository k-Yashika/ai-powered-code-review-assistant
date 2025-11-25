# 🧠 AI-Powered Code Review Assistant  
Automatically reviews GitHub Pull Requests using AI (Groq/LLM), Flask webhooks & a React dashboard.

---

## 🚀 Overview

This project is a full **AI-driven code review system** that connects directly to GitHub Pull Requests. Whenever a PR is opened or updated, GitHub sends a webhook → your Flask backend fetches the diff → sends it to an AI model → stores the review → shows it live in your React dashboard.

It gives developers:

- ⚡ Instant AI-generated PR reviews  
- 🔍 Detection of bugs, architecture issues, simplifications & security problems  
- 📊 Live dashboard updating automatically  
- 🔗 GitHub integration using Webhooks  
- 🚀 Uses Groq for fast, inexpensive LLM inference  

Perfect for solo developers or teams building AI-powered development tools.

---

## 🏗 Architecture

GitHub PR → Webhook → Flask Server → GitHub API → Code Diff
↓
Groq AI Model → Review Output → /reviews/latest
↓
React Dashboard (polls every 4s)


---

## ✨ Features

### 🔄 GitHub Webhook Integration  
Automatically receives PR events and fetches changed files.

### 🧠 AI Code Review  
Uses Groq’s `llama-3.1-8b-instant` model to analyze diffs.

### 📦 Real-time Dashboard  
Frontend polls the backend for new reviews and updates automatically.

### 🔐 Secure Token Management  
Environment variables using `.env` for all secrets.

### 🌍 CORS-enabled  
React frontend can safely call the Flask backend.

---

## 🧠 How the AI Review Works

1. GitHub webhook triggers on PR update
2. Backend fetches changed files via GitHub API
3. Extracts the unified diff (patch)
4. Sends it to Groq
5. Stores the latest review
6. React dashboard calls /reviews/latest every 4 seconds and updates automatically
