import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv
from groq import Groq
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend communication

load_dotenv()

# Groq client
client = Groq(api_key=os.getenv("GROQ_API_KEY"))
# GitHub token
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

# In-memory storage (replace with database in production)
PULL_REQUESTS = []
REVIEWS = []
DIFFS = {}

def review_code(diff_text):
    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": "You are a senior software engineer performing code reviews."},
                {"role": "user", "content": f"""Review this code diff:

{diff_text}

Provide:
- Potential bugs
- Architectural concerns
- Simplification suggestions
- Security issues

Use bullet points."""}
            ],
            max_tokens=1000,
            temperature=0.5
        )
        
        return response.choices[0].message.content
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return f"Error: {str(e)}"


def fetch_github_prs(owner, repo):
    """Fetch open PRs from GitHub"""
    url = f"https://api.github.com/repos/{owner}/{repo}/pulls"
    headers = {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json",
        "User-Agent": "AI-Code-Reviewer"
    }
    
    try:
        response = requests.get(url, headers=headers)
        if response.ok:
            prs = response.json()
            return [{
                "id": f"{owner}/{repo}/{pr['number']}",
                "number": pr["number"],
                "title": pr["title"],
                "author": pr["user"]["login"],
                "repo": f"{owner}/{repo}",
                "status": pr["state"],
                "url": pr["html_url"]
            } for pr in prs]
    except Exception as e:
        print(f"Error fetching PRs: {e}")
    
    return []


@app.route("/api/prs", methods=["GET"])
def get_prs():
    """Get list of open PRs - configure your repos here"""
    # TODO: Configure your GitHub repos here
    owner = os.getenv("GITHUB_OWNER", "octocat")
    repo = os.getenv("GITHUB_REPO", "Hello-World")
    
    prs = fetch_github_prs(owner, repo)
    
    # Merge with stored PRs from webhooks
    all_prs = {pr["id"]: pr for pr in PULL_REQUESTS}
    for pr in prs:
        all_prs[pr["id"]] = pr
    
    PULL_REQUESTS.clear()
    PULL_REQUESTS.extend(all_prs.values())
    
    return jsonify(list(all_prs.values()))


@app.route("/api/prs/<path:pr_id>/diff", methods=["GET"])
def get_diff(pr_id):
    """Get diff for a specific PR"""
    # Check if we have it cached
    if pr_id in DIFFS:
        return DIFFS[pr_id], 200, {'Content-Type': 'text/plain'}
    
    # Parse pr_id (format: owner/repo/number)
    try:
        parts = pr_id.split("/")
        if len(parts) >= 3:
            owner, repo, pr_number = parts[0], parts[1], parts[2]
            
            url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/files"
            headers = {
                "Authorization": f"token {GITHUB_TOKEN}",
                "Accept": "application/vnd.github+json",
                "User-Agent": "AI-Code-Reviewer"
            }
            
            response = requests.get(url, headers=headers)
            if response.ok:
                files = response.json()
                diffs = []
                for f in files:
                    diff = f.get("patch", "")
                    if diff:
                        diffs.append(f"--- {f['filename']} ---\n{diff}")
                
                full_diff = "\n\n".join(diffs)
                DIFFS[pr_id] = full_diff
                return full_diff, 200, {'Content-Type': 'text/plain'}
    except Exception as e:
        print(f"Error fetching diff: {e}")
    
    return "Unable to fetch diff", 404, {'Content-Type': 'text/plain'}


@app.route("/api/prs/<path:pr_id>/review", methods=["GET", "POST"])
def trigger_review(pr_id):
    """Trigger AI review for a PR"""
    # Get the diff
    if pr_id not in DIFFS:
        # Try to fetch it first
        get_diff(pr_id)
    
    if pr_id not in DIFFS:
        return jsonify({"error": "Could not load diff"}), 404
    
    diff_text = DIFFS[pr_id]
    
    print(f"\n----- Running AI Review for {pr_id} -----")
    review_text = review_code(diff_text)
    print(review_text)
    print("\n----- End Review -----")
    
    # Find the PR details
    pr_details = next((pr for pr in PULL_REQUESTS if pr["id"] == pr_id), None)
    
    # Store the review
    review_obj = {
        "id": len(REVIEWS),
        "pr_id": pr_id,
        "pr": pr_details or {"title": pr_id, "number": pr_id},
        "review": review_text,
        "summary": review_text[:100] + "..." if len(review_text) > 100 else review_text,
        "timestamp": datetime.now().isoformat()
    }
    
    REVIEWS.insert(0, review_obj)
    
    return jsonify({"status": "ok", "review": review_text})


@app.route("/api/reviews", methods=["GET"])
def get_reviews():
    """Get all reviews"""
    return jsonify(REVIEWS)


@app.route("/api/metrics", methods=["GET"])
def get_metrics():
    """Get metrics"""
    return jsonify({
        "total": len(PULL_REQUESTS),
        "issues": sum(1 for r in REVIEWS if "bug" in r["review"].lower() or "issue" in r["review"].lower()),
        "recent": REVIEWS[:5]
    })


@app.route("/github/webhook", methods=["POST"])
def webhook():
    """Handle GitHub webhooks"""
    try:
        data = request.json
        event_type = request.headers.get("X-GitHub-Event")

        if event_type != "pull_request":
            return jsonify({"status": "ignored", "event": event_type})
        
        pr = data["pull_request"]
        repo = data["repository"]["name"]
        owner = data["repository"]["owner"]["login"]
        pr_number = pr["number"]
        pr_id = f"{owner}/{repo}/{pr_number}"

        # Store PR info
        pr_obj = {
            "id": pr_id,
            "number": pr_number,
            "title": pr["title"],
            "author": pr["user"]["login"],
            "repo": f"{owner}/{repo}",
            "status": pr["state"],
            "url": pr["html_url"]
        }
        
        # Update or add PR
        existing = next((i for i, p in enumerate(PULL_REQUESTS) if p["id"] == pr_id), None)
        if existing is not None:
            PULL_REQUESTS[existing] = pr_obj
        else:
            PULL_REQUESTS.append(pr_obj)

        # Fetch and cache the diff
        url = f"https://api.github.com/repos/{owner}/{repo}/pulls/{pr_number}/files"
        headers = {
            "Authorization": f"token {GITHUB_TOKEN}",
            "Accept": "application/vnd.github+json",
            "User-Agent": "AI-Code-Reviewer"
        }

        response = requests.get(url, headers=headers)
        files = response.json()

        diffs = []
        for f in files:
            diff = f.get("patch")
            if diff:
                diffs.append(f"--- {f['filename']} ---\n{diff}")

        full_diff = "\n\n".join(diffs)
        DIFFS[pr_id] = full_diff

        print(f"\n----- Webhook received for PR #{pr_number} -----")
        print(f"Stored diff for {pr_id}")

        return jsonify({"status": "received", "files": len(files), "pr_id": pr_id})
    
    except Exception as e:
        print(f"Webhook error: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


if __name__ == "__main__":
    print("AI Code Reviewer backend running on port 5000")
    print("Frontend should connect to http://localhost:5000")
    app.run(port=5000, debug=True)
