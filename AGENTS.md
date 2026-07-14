# AGENTS.md

# Project Persona & System Context

The project is a youtube summarizer and analyser project that fetches the details and transcript from a youtube video and gives a detailed summary using Google Gemini LLM.

### System Architecture and Tech Stack
- **Frontend:** React (TS)
- **Backend:** Express JS
- **Deployment:** AWS Elastic Beanstalk
- **External Services:** Youtube Data API

### Requirement & Specifications
- The Specs of the Project, including the architecture and folder structure are on `SPEC.md` file.
- Use the file to get more context about the project.

### Critical Constraints & Guard Rails
- Make sure the project is deployable to AWS Elastic Beanstalk on free tier.

### Local Agent Capabilities
Available repository scoped skills are located in `.agent/skills/`
- Use `/aws-cost-guardrails/` for effectively ensuring the project is runnable on free tier AWS.
- Use `/elastic-beanstalk-deployment/` for understanding about how the deployment on elastic beanstalk can be made.
- Use `/llm-provider-abstraction/` for writing or modifying code that calls the LLM.
- Use `/vector-search-with-pgvector/` for implementing transcript chunking, embedding storage or similarity search
- Use `/youtube-data-fetching/` for implementing or modifying code that fetches transcripts, metadata, or stats for a YouTube video