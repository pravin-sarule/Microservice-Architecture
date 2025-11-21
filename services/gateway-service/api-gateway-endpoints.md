# API Gateway Endpoints

This document outlines the API Gateway endpoints and their corresponding backend service routes.

## Base URL
All API Gateway endpoints are prefixed with the Gateway's base URL (e.g., `http://localhost:5000`).

## Authentication Service Endpoints (`/auth`)

Proxied to `AUTH_SERVICE_URL` (e.g., `http://localhost:5001`) with path rewrite `/auth` to `/api/auth`.

| Gateway Endpoint           | Method | Description             | Backend Service Route |
|----------------------------|--------|-------------------------|-----------------------|
| `/auth/register`           | POST   | Register a new user     | `/api/auth/register`  |
| `/auth/login`              | POST   | Login user              | `/api/auth/login`     |
| `/auth/update`             | PUT    | Update user profile     | `/api/auth/update`    |
| `/auth/delete`             | DELETE | Delete user account     | `/api/auth/delete`    |
| `/auth/logout`             | POST   | Logout user             | `/api/auth/logout`    |
| `/auth/profile`            | GET    | Fetch user profile      | `/api/auth/profile`   |
| `/auth/user-info`          | GET    | Get user info (fullname, email, mobile) | `/api/auth/user-info` |
| `/auth/professional-profile` | GET  | Get professional profile | `/api/auth/professional-profile` |
| `/auth/professional-profile` | PUT  | Update professional profile | `/api/auth/professional-profile` |

## Document Service Endpoints (`/files`)

Proxied to `FILE_SERVICE_URL` (e.g., `http://localhost:5002`) with path rewrite `/files` to `/api/doc`.
All routes under `/files` are protected by JWT authentication.

| Gateway Endpoint                       | Method | Description                         | Backend Service Route         |
|----------------------------------------|--------|-------------------------------------|-------------------------------|
| `/files/batch-upload`                  | POST   | Batch upload and process documents  | `/api/doc/batch-upload`       |
| `/files/analyze`                       | POST   | Analyze a document                  | `/api/doc/analyze`            |
| `/files/summary`                       | POST   | Get summary of document chunks      | `/api/doc/summary`            |
| `/files/chat`                          | POST   | Chat with a document                | `/api/doc/chat`               |
| `/files/save`                          | POST   | Save edited document                | `/api/doc/save`               |
| `/files/download/:file_id/:format`     | GET    | Download edited document variants   | `/api/doc/download/:file_id/:format` |
| `/files/chat-history/:file_id`         | GET    | Get chat history for a document     | `/api/doc/chat-history/:file_id` |
| `/files/status/:file_id`               | GET    | Get document processing status      | `/api/doc/status/:file_id`    |

## Payment Service Endpoints (`/payments`)

Proxied to `PAYMENT_SERVICE_URL` (e.g., `http://localhost:5003`) with path rewrite `/payments` to `/api/payments`.
All routes under `/payments` are protected by JWT authentication.

| Gateway Endpoint                   | Method | Description                         | Backend Service Route         |
|------------------------------------|--------|-------------------------------------|-------------------------------|
| `/payments/test`                   | GET    | Test payment service                | `/api/payments/test`          |
| `/payments/ping`                   | GET    | Ping payment service                | `/api/payments/ping`          |
| `/payments/test-config`            | GET    | Test Razorpay configuration         | `/api/payments/test-config`   |
| `/payments/test-razorpay-connection`| GET    | Test Razorpay API connection        | `/api/payments/test-razorpay-connection` |
| `/payments/subscription/start`     | POST   | Start a new subscription            | `/api/payments/subscription/start` |
| `/payments/subscription/verify`    | POST   | Verify a subscription               | `/api/payments/subscription/verify` |
| `/payments/history`                | GET    | Get user payment history            | `/api/payments/history`       |
| `/payments/token-usage`            | POST   | Check and deduct user tokens        | `/api/payments/token-usage`   |