# Document Service Architecture

The `document-service` is a core microservice within the backend architecture, built with Express.js, primarily responsible for comprehensive document management, AI-driven analysis, summarization, and chat functionalities. It operates on port `5002` and integrates with several external and internal components to deliver its features.

## 1. External Interactions and Dependencies:

*   **API Gateway (`gateway-service`):** All external requests to the `document-service` are routed through the API Gateway.
    *   Requests to `/files` are proxied to `/api/doc/` on the `document-service`.
    *   Requests to `/docs` are proxied to `/api/files/` on the `document-service`.
    *   The Gateway applies `authMiddleware` to secure these routes, validating JWT tokens and injecting the authenticated user's ID into the `x-user-id` header for downstream use by the `document-service`.
*   **Frontend:** Interacts with the `document-service` via the API Gateway for all document-related operations, uploads, and chat.
*   **Payment Service (via API Gateway):** The `tokenUsageService` within the `document-service` fetches user plan details from an external Payment Service (proxied through the API Gateway) to enforce resource limits.
*   **Google Cloud Storage (GCS):** Used by `gcsService` for storing raw document files.
*   **Large Language Models (LLMs):** Integrated via `aiService` and `embeddingService` for AI analysis, summarization, question answering, and generating vector embeddings. This includes models like Gemini, OpenAI, Anthropic, and DeepSeek.
*   **Google Cloud Document AI:** Utilized by `documentAiService` for advanced OCR and batch document processing.
*   **PostgreSQL Database:** The primary data store for all document metadata, file information, chat histories, chunks, embeddings, and processing job statuses.

## 2. Internal Components and Data Flow:

The `document-service` follows a layered architecture:

*   **Entry Point (`index.js`):** Initializes the Express application, configures middleware (`cookie-parser`, `express.json()`, `morgan`, `cors`), connects to the database, and mounts the various route handlers.
*   **Middleware:**
    *   **`auth.js`:** Authenticates requests by validating JWT tokens, extracting user information, and attaching it to the request object (`req.user`).
    *   **`checkTokenLimits.js`:** Enforces user-specific resource quotas (tokens, documents, storage). It interacts with `tokenUsageService` to fetch user plans and current usage, applies a 9.5-hour token renewal cooldown, and blocks requests if limits are exceeded. It also passes usage details to controllers.
*   **Routes (`documentRoutes.js`, `fileRoutes.js`, `chatRoutes.js`, `secretManagerRoutes.js`):** Define API endpoints (e.g., `/api/doc`, `/api/files`) and map them to specific controller functions. They apply authentication and token limit middleware as needed.
*   **Controllers (`documentController.js`, `FileController.js`, `chatController.js`, `contentController.js`, `secretManagerController.js`):** Contain the business logic for handling requests. They orchestrate interactions between services and models.
    *   `documentController.js`: Manages individual document operations (upload, AI analysis, summarization, chat, editing, downloading).
    *   `FileController.js`: Handles folder and file management within folders (creation, upload to folders, folder summaries, queries, folder chats).
    *   `chatController.js`: Provides read-only access to chat histories.
    *   `secretManagerController.js`: (Inferred from `index.js` routes) Manages secrets.
*   **Services:** Encapsulate specific functionalities and external integrations.
    *   **`gcsService.js`:** Handles file uploads to and signed URL generation from Google Cloud Storage.
    *   **`aiService.js`:** Communicates with various Large Language Models.
    *   **`embeddingService.js`:** Generates vector embeddings using LLMs.
    *   **`tokenUsageService.js`:** Manages user resource consumption, interacts with the Payment Service for plan details, and updates local usage records in the database.
    *   **`documentAiService.js`:** Integrates with Google Cloud Document AI.
    *   **`chunkingService.js`:** Breaks down documents into smaller chunks.
    *   **`conversionService.js`:** Handles document format conversions.
    *   **`folderAiService.js`:** (Inferred) AI logic for folder-level queries.
*   **Models (`documentModel.js`, `File.js`, `FileChat.js`, `FolderChat.js`, `FileChunk.js`, `ChunkVector.js`, `ProcessingJob.js`):** Define data structures and provide an ORM-like interface for interacting with the PostgreSQL database. They manage metadata for documents, files, folders, chat messages, document chunks, vector embeddings, and processing jobs.

## 3. Example Data Flow (Document Upload and Processing):

1.  **Request:** User uploads a document via the Frontend, which sends a request to the API Gateway (e.g., `POST /files/batch-upload`).
2.  **Gateway Processing:** The API Gateway authenticates the request, adds `x-user-id` header, and forwards it to `document-service` (e.g., `POST /api/doc/batch-upload`).
3.  **Document Service Entry:** The request hits `document-service/index.js`, then `document-service/routes/documentRoutes.js`.
4.  **Authentication:** `document-service/middleware/auth.js` verifies the JWT.
5.  **Token Limits:** `document-service/middleware/checkTokenLimits.js` calls `tokenUsageService.getUserUsageAndPlan` (which queries the local DB and the external Payment Service via Gateway) to check and enforce resource limits.
6.  **Controller Action:** `documentController.batchUploadDocuments` is invoked.
7.  **GCS Upload:** `gcsService.uploadToGCS` stores the raw file.
8.  **Database Entry:** `documentModel.saveFileMetadata` and `ProcessingJobModel.createJob` record initial file and job status.
9.  **Asynchronous Processing:** A background process (or separate function call) is initiated:
    *   `documentAiService.batchProcessDocument` (for OCR) or `utils/textExtractor.extractText` extracts text.
    *   `chunkingService.chunkDocument` breaks text into chunks.
    *   `embeddingService.generateEmbeddings` creates vector embeddings for chunks.
    *   `FileChunkModel` and `ChunkVectorModel` store chunks and embeddings.
    *   `aiService.getSummaryFromChunks` generates a summary.
    *   `documentModel` updates document status and stores the summary.
    *   `ProcessingJobModel` updates job status.
10. **Usage Update:** `tokenUsageService.incrementUsage` updates the user's consumed resources in the local database.
11. **Response:** The `document-service` sends a `202 Accepted` response to the Gateway, indicating successful initiation of processing.

This architecture ensures modularity, scalability, and clear separation of concerns, allowing for efficient document processing and AI integration.

```mermaid
graph TD
    subgraph "User Interface"
        Frontend[Frontend Application]
    end

    subgraph "API Gateway (gateway-service)"
        Gateway[API Gateway]
        AuthMiddleware(Authentication Middleware)
        FileProxy(File/Document Proxy)
    end

    subgraph "Document Service (Port 5002)"
        DocServiceApp(Express App)
        AuthMW[Auth Middleware]
        TokenLimitsMW[Token Limits Middleware]

        subgraph "Routes"
            DocRoutes[/api/doc/*]
            FileRoutes[/api/files/*]
            ChatRoutes[/api/chat/*]
            SecretRoutes[/api/secrets/*]
        end

        subgraph "Controllers"
            DocController[DocumentController]
            FileController[FileController]
            ChatController[ChatController]
            SecretController[SecretManagerController]
        end

        subgraph "Services"
            GCS_Service[GCS Service]
            AI_Service[AI Service (LLMs)]
            Embedding_Service[Embedding Service]
            TokenUsage_Service[Token Usage Service]
            DocAI_Service[Document AI Service]
            Chunking_Service[Chunking Service]
            Conversion_Service[Conversion Service]
            FolderAI_Service[Folder AI Service]
        end

        subgraph "Models (PostgreSQL ORM)"
            DocumentModel[Document Model]
            FileModel[File/Folder Model]
            FileChatModel[File Chat Model]
            FolderChatModel[Folder Chat Model]
            FileChunkModel[File Chunk Model]
            ChunkVectorModel[Chunk Vector Model]
            ProcessingJobModel[Processing Job Model]
        end

        DocServiceApp --> AuthMW
        AuthMW --> TokenLimitsMW
        TokenLimitsMW --> DocRoutes
        TokenLimitsMW --> FileRoutes
        TokenLimitsMW --> ChatRoutes
        TokenLimitsMW --> SecretRoutes

        DocRoutes --> DocController
        FileRoutes --> FileController
        ChatRoutes --> ChatController
        SecretRoutes --> SecretController

        DocController --> GCS_Service
        DocController --> AI_Service
        DocController --> Embedding_Service
        DocController --> DocAI_Service
        DocController --> Chunking_Service
        DocController --> Conversion_Service
        DocController --> TokenUsage_Service
        DocController --> DocumentModel
        DocController --> FileModel
        DocController --> FileChunkModel
        DocController --> ChunkVectorModel
        DocController --> ProcessingJobModel

        FileController --> GCS_Service
        FileController --> AI_Service
        FileController --> Embedding_Service
        FileController --> FolderAI_Service
        FileController --> TokenUsage_Service
        FileController --> FileModel
        FileController --> DocumentModel
        FileController --> FileChunkModel
        FileController --> ChunkVectorModel
        FileController --> FolderChatModel

        ChatController --> FileChatModel
        ChatController --> FolderChatModel

        TokenUsage_Service --> PaymentService[Payment Service (External)]
        TokenUsage_Service --> PostgreSQL[PostgreSQL Database]
        DocumentModel --> PostgreSQL
        FileModel --> PostgreSQL
        FileChatModel --> PostgreSQL
        FolderChatModel --> PostgreSQL
        FileChunkModel --> PostgreSQL
        ChunkVectorModel --> PostgreSQL
        ProcessingJobModel --> PostgreSQL
    end

    subgraph "External Services"
        PostgreSQL
        GCS[Google Cloud Storage]
        LLMs[Large Language Models (Gemini, OpenAI, Anthropic, DeepSeek)]
        GoogleDocAI[Google Cloud Document AI]
        PaymentService