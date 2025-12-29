# 🦖 Dino D2 — Newsletter Sending Platform

**Dino D2** is a scalable, multi-tenant newsletter sending platform built on AWS.  
It allows creators and businesses to manage subscribers, send email campaigns, and track engagement — all from a fast, secure web interface.

---

## 🚀 Overview

Dino D2 combines a lightweight static frontend with a serverless backend to deliver a cost-effective and high-performance SaaS product.  
It supports:
- Multi-tenant architecture (each tenant fully isolated by a unique Tenant Id)
- Subscriber management
- Campaign creation
- Real-time engagement tracking via pixel analytics
- Email sending powered by Amazon SES
- Authentication and user management via Amazon Cognito

The **frontend** (in this repository) is a static web app built with **HTML, JavaScript, and CSS**, hosted on **Amazon S3** and distributed globally via **CloudFront**

---

## 🧩 System Architecture

**Frontend**
- Static website (HTML/JS/CSS)
- Hosted on **Amazon S3**
- Delivered via **Amazon CloudFront**
- Authenticated using **Amazon Cognito**

**Backend**
- **Amazon API Gateway** for HTTP endpoints
- **AWS Lambda** and **Simple Queue Service** for business logic (subscriber management, newsletter sending, tracking)
- **Amazon DynamoDB** for database storage using the unique Tenant Id as the partition key
- **Amazon SES** for newsletter email delivery
- **CloudWatch** for metrics and logging

**Other**
- **Custom Domain:** `dinod2.com`
- **SSL/TLS Certificates:** Managed via AWS Certificate Manager

---

## 📊 Key Features

- **Multi-Tenant Design** — all tenant data securely isolated
- **Email Campaigns** — create, and send personalized newsletters
- **Tracking Pixel Analytics** — monitors opens for engagement insights
- **Responsive Frontend** — clean, modern, and mobile-friendly
- **Serverless Architecture** — low cost, easy to scale, minimal maintenance

---

## 🧱 Tech Stack

| Layer | Technology |
|-------|-------------|
| Frontend | HTML, CSS, JavaScript |
| Hosting | Amazon S3 + CloudFront + Github Pages |
| Authentication | Amazon Cognito |
| API | Amazon API Gateway |
| Logic | AWS Lambda (Python) + Simple Queue Service |
| Database | Amazon DynamoDB |
| Email | Amazon SES |
| Monitoring | CloudWatch |

---

## 🕒 Project Timeline

|  | Date | Milestone | Description |
|-----|------|------------|-------------|
| ✅ | 04/2025 | Fickle Friday Launch | The launch of original newsletter service built on AWS for my newsletter, Fickle Friday |
| ✅ | 10/2025 | MVP Complete | Minimum Functioning Email Newsletter Platform. Main functions of the backend complete. Frontend technically capable, but not beautiful |
| ✅ | 10/20/2025 | First User Onboarding | I will be onboarding one user to provide feedback and build out onboarding process |
| ✅ | 12/2025 | Closed Beta Begins | Frontend "beautified" and ready for a handful of additional beta users |
| ⏳ | 04/2026 | Public Beta | Waitlist opens for early users |
| ⏳ | 07/2026 | Full Launch | Officially open to the public as a full-blown service. |

*(This section will be updated as development progresses.)*


---

## 🧠 Design Philosophy

- **Serverless-first**: minimize maintenance and maximize scalability  
- **Simplicity over complexity**: every component should be understandable at a glance  
- **Privacy and transparency**: all subscriber data is securely managed and never shared  
- **Built for creators**: empowering individuals to own their audience and messaging 
