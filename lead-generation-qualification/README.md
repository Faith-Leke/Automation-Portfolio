# AI-Powered Lead Generation & Qualification System

An intelligent, fully automated pipeline that discovers, scrapes, and evaluates B2B prospects at scale — delivering only pre-qualified, high-intent leads directly into your CRM or database.

---

### 1. Features

- **Automated Market Rotation:** Cycles through any configurable list of target markets, regions, or cities to execute localized search queries at scale.
- **Google Places Scraping:** Uses the Serper API to actively search for businesses matching any target service category or industry vertical across multiple locations.
- **Deduplication Engine:** Queries the database before processing to check for existing records, ensuring zero duplicate leads enter the pipeline.
- **Deep Web Scraping:** Extracts the full readable content of any prospect's website using Jina AI, converting raw pages into structured markdown for AI analysis.
- **AI-Powered Lead Classification:** Leverages an LLM to evaluate each prospect against your defined business criteria and classify them into configurable qualification categories.
- **Intelligent Triage & Routing:** Automatically routes qualified prospects to the CRM while discarding irrelevant leads before they ever pollute your database.
- **Smart Email Extraction:** Uses custom JavaScript and Regex logic to extract valid contact emails from website content, filtering out junk extensions and deprioritizing generic addresses in favour of personal contacts.
- **API Key Rotation:** Automatically rotates across multiple API keys to manage request volume and eliminate rate-limiting as a bottleneck.
- **Automated Database Sync:** Saves fully enriched, qualified lead records — including company details, contact email, AI classification reasoning, and fit score — directly into your database.

---

### 2. Tech Stack

- **Orchestration:** n8n
- **Database:** Baserow
- **AI / LLM:** Groq (Llama-3.3-70b-versatile)
- **Custom Logic:** JavaScript (API key rotation, Regex email extraction, payload mapping)

---

### 3. External Dependencies

- **Serper API Access:** Required to power the Google Places search queries that drive prospect discovery.
- **Groq API Keys:** An array of active Groq API keys is required in the Key Rotator node to fuel LLM classification at volume.
- **Baserow Workspace:** A configured Baserow database and table with fields mapped to your required lead properties (e.g. company name, website, email, AI reasoning, fit category, location).
- **Jina AI Endpoint:** The `r.jina.ai` endpoint must be active to convert prospect websites into readable markdown for AI processing.

---

### 4. Business & Technical Impact

- **Eliminates Manual Research:** Replaces hours of manual prospecting and company vetting with a fully autonomous discovery and evaluation engine that runs on a configurable schedule.
- **Keeps Your CRM Clean:** The triage system actively discards unqualified prospects before they reach your database, ensuring your pipeline contains only high-intent leads.
- **Built for Scale & High Availability:** A custom API key rotator combined with volume-controlled batch processing ensures the system runs continuously without hitting third-party rate limits — fully hands-off, every day of the week.
- **Fully Adaptable:** Every classification category, search query, and qualification criterion is configurable — making this system deployable across any industry, market, or lead generation use case.
