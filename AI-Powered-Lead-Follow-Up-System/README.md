# Automated Lead Reply Detection & Alert System

A real-time inbox monitoring system that instantly detects when a prospect replies to an outreach email, enriches the alert with CRM context, notifies the operator via Slack, and automatically updates the lead's pipeline status — ensuring zero replied leads ever go unnoticed or unactioned.

---

### 1. Features

- **Real-Time Inbox Monitoring:** Polls the connected inbox continuously, triggering the workflow the moment a new email is received.
- **Intelligent Lead Matching:** Cross-references the sender's email address against the CRM database to confirm the reply belongs to a known, previously contacted lead before taking any action.
- **Contextual Data Extraction:** Uses custom JavaScript to parse and clean the incoming email data — extracting the sender name, email address, message snippet, and current pipeline status into a structured payload.
- **Instant Slack Notification:** Fires a formatted, markdown-rich Slack alert to the designated operator the moment a reply is confirmed, including the company name, sender details, pipeline status, message preview, and a direct deep-link to the Gmail thread.
- **Automatic Pipeline Status Update:** Immediately updates the lead's status in the database from "Contacted" to "Responded" after the alert is sent, keeping the CRM accurate in real time with no manual intervention.
- **Fault-Tolerant Status Sync:** The database update node is configured to retry on failure, ensuring pipeline status is always recorded even under intermittent connectivity conditions.

---

### 2. Tech Stack

- **Orchestration:** n8n
- **Database:** Baserow
- **Inbox Trigger:** Gmail (OAuth2 — Gmail Trigger node)
- **Notification Delivery:** Slack API
- **Custom Logic:** JavaScript (email parsing, sender extraction, data normalization, safe string handling)

---

### 3. External Dependencies

- **Gmail OAuth2 Account:** A connected Gmail inbox authenticated via OAuth2, used as the monitored outreach address that the trigger polls for new incoming messages.
- **Baserow Workspace:** A configured Baserow database and table containing your lead records, with fields for email address and pipeline status that the lookup and update nodes query against.
- **Slack API Credentials:** An active Slack integration with a configured user or channel ID to receive the real-time reply notifications.
- **Consistent Email Field:** The lead records in your database must contain the exact email address used in outreach — this is what the lookup node uses to match incoming replies to known prospects.

---

### 4. Business & Technical Impact

- **Eliminates Missed Replies:** Removes the risk of a hot prospect's reply getting buried in a busy inbox — every confirmed reply from a known lead triggers an immediate, actionable alert.
- **Compresses Response Time:** By delivering a Slack notification with full context and a direct Gmail thread link the moment a reply lands, the operator can respond within seconds rather than discovering the email hours later.
- **Keeps the CRM Truthful:** Automatic status updates mean the pipeline always reflects reality — no manual logging, no stale "Contacted" records sitting on leads who have already replied.
- **Fully Adaptable:** The inbox being monitored, the CRM fields being matched, the Slack recipient, and the pipeline status labels are all configurable — making this system deployable for any outreach pipeline or sales workflow.
